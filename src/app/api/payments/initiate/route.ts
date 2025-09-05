import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { doc, getDoc, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { adminApp, adminAuth } from '@/lib/firebaseAdmin'; // Import from your custom file
import { z } from 'zod';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { v4 as uuidv4 } from 'uuid';
import PaymentsService from 'paychangu';

// --- Rate Limiter ---
const rateLimiter = new RateLimiterMemory({
  points: 10,
  duration: 60,
});

// --- Zod Schema for Input Validation ---
const requestSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  paymentProvider: z.enum(['stripe', 'paychangu']),
  customerDetails: z.object({
    email: z.string().email('Invalid email format').max(255).trim(),
    name: z.string().optional(),
    phone: z.string().optional(),
  }),
  metadata: z.record(z.string(), z.string()).optional(),
});

// Initialize PayChangu Service
const paymentService = new PaymentsService({
  apiKey: process.env.PAYCHANGU_SECRET_KEY || '',
  baseURL: process.env.NEXT_PUBLIC_PAYCHANGU_BASE_URL || 'https://api.paychangu.com',
});

// --- Main POST Handler ---
export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';

  // Apply Rate Limiting
  try {
    await rateLimiter.consume(ip);
  } catch (rateLimitError) {
    console.warn('Rate limit exceeded:', { ip });
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  // Verify Firebase Auth Token
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const idToken = authHeader.split('Bearer ')[1];
  let userId;
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken, true); // Use adminAuth from firebaseadmin
    userId = decodedToken.uid;
  } catch (error: any) {
    console.error('Token verification failed:', { error: error.message, ip });
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  // --- Process the Request ---
  try {
    const body = await request.json();
    const validatedData = requestSchema.parse(body);
    const { bookingId, paymentProvider, customerDetails, metadata } = validatedData;

    const bookingRef = doc(db, 'bookings', bookingId);
    let checkoutUrl: string | null = null;
    let transactionReference: string | null = null;

    // Firestore Transaction to ensure data consistency
    await runTransaction(db, async (transaction) => {
      const bookingDoc = await transaction.get(bookingRef);
      if (!bookingDoc.exists()) throw new Error('Booking not found');
      
      const bookingData = bookingDoc.data();
      if (bookingData?.userId !== userId) throw new Error('Access denied');
      if (bookingData?.paymentStatus === 'paid') throw new Error('Booking already paid');
      if (bookingData?.bookingStatus === 'cancelled') throw new Error('Booking is cancelled');

      const amount = bookingData.totalAmount;
      const currency = bookingData.currency || 'mwk';

      // --- BRANCH: PAYCHANGU LOGIC ---
      if (paymentProvider === 'paychangu') {
        if (!process.env.PAYCHANGU_SECRET_KEY) {
          throw new Error('PayChangu secret key is not configured.');
        }

        transactionReference = `booking_${bookingId.slice(0, 8)}_${uuidv4().slice(0, 8)}`;
        
        const paychanguPayload = {
          amount: amount,
          currency: currency.toUpperCase(),
          email: customerDetails.email,
          first_name: customerDetails.name?.split(' ')[0] || 'Valued',
          last_name: customerDetails.name?.split(' ').slice(1).join(' ') || 'Customer',
          description: `Payment for booking ${bookingId.slice(-8)}`,
          callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/webhooks`,
          returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/bookings?payment_verify=true&provider=paychangu&tx_ref=${transactionReference}`,
        };

        const response = await paymentService.initiatePayment(paychanguPayload);

        if (!response || !response.data?.checkout_url) {
          throw new Error('Failed to initialize PayChangu payment: No checkout URL');
        }
        
        checkoutUrl = response.data.checkout_url;
        
        transaction.update(bookingRef, {
          paymentStatus: 'processing',
          paymentProvider: 'paychangu',
          paymentMethod: 'mobile_money', // Updated by webhook
          transactionReference: transactionReference,
          paymentInitiatedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } 
      // --- BRANCH: STRIPE LOGIC ---
      else if (paymentProvider === 'stripe') {
        if (!process.env.STRIPE_SECRET_KEY) {
          throw new Error('Stripe secret key is not configured');
        }

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          mode: 'payment',
          customer_email: customerDetails.email,
          line_items: [{
            price_data: {
              currency: currency.toLowerCase(),
              product_data: {
                name: `Bus Ticket - Booking ${bookingId.slice(-8)}`,
                metadata: { bookingId, ...(metadata || {}) },
              },
              unit_amount: Math.round(amount * 100),
            },
            quantity: 1,
          }],
          metadata: { bookingId, userId, ...(metadata || {}) },
          success_url: `${process.env.NEXT_PUBLIC_APP_URL}/bookings?payment_verify=true&provider=stripe&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/bookings?cancelled=true`,
          expires_at: Math.floor(Date.now() / 1000) + (30 * 60),
        });

        checkoutUrl = session.url;

        transaction.update(bookingRef, {
          paymentStatus: 'processing',
          paymentProvider: 'stripe',
          paymentMethod: 'card',
          stripeSessionId: session.id,
          paymentInitiatedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    });

    if (!checkoutUrl) {
      throw new Error("Checkout URL could not be generated.");
    }

    return NextResponse.json({
      success: true,
      checkoutUrl: checkoutUrl,
      message: 'Payment session created successfully',
    }, { status: 200 });

  } catch (error: any) {
    console.error('Payment initiation error:', { error: error.message, userId, ip });
    // Log error and update booking status to 'failed'
    const bookingId = (await request.clone().json()).bookingId;
    if (bookingId) {
        try {
            await updateDoc(doc(db, 'bookings', bookingId), {
                paymentStatus: 'failed',
                paymentFailureReason: error.message || 'Unknown error',
                updatedAt: serverTimestamp(),
            });
        } catch (updateError) {
            console.error('Failed to update booking status on error:', { updateError, bookingId });
        }
    }
    const status = error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json({ error: 'Failed to create checkout session', message: error.message }, { status });
  }
}