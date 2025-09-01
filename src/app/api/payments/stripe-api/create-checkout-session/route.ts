import { NextResponse } from 'next/server';
import { stripe } from '../../../../../lib/stripe';
import { doc, getDoc, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../../../../lib/firebaseConfig';
import { getAuth } from 'firebase-admin/auth';
import admin from 'firebase-admin';
import { z } from 'zod';
import { RateLimiterMemory } from 'rate-limiter-flexible';

if (!admin.apps.length) {
  // Initialize with service account or environment configuration
  const serviceAccount = JSON.parse(process.env.FIREBASE_PRIVATE_KEY || '{}');
  if (Object.keys(serviceAccount).length === 0) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set or invalid');
  }
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL, // e.g., https://<your-project-id>.firebaseio.com
  });
}

// Initialize rate limiter (limit to 10 requests per minute per IP)
const rateLimiter = new RateLimiterMemory({
  points: 10,
  duration: 60,
});

const requestSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string()
    .refine((c) => ['usd', 'eur', 'gbp', 'mwk'].includes(c.toLowerCase()), { message: 'Unsupported currency' })
    .optional()
    .default('mwk'),
  customerDetails: z.object({
    email: z.string().email('Invalid email format').max(255).trim(),
  }),
  metadata: z.record(z.string(), z.string()).optional(),
});

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || request.socket?.remoteAddress || 'unknown';

  try {
    await rateLimiter.consume(ip);
  } catch (rateLimitError) {
    console.warn('Rate limit exceeded:', { ip, timestamp: new Date().toISOString() });
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn('Unauthorized request:', { ip, timestamp: new Date().toISOString() });
    return NextResponse.json({ error: 'Unauthorized: Missing or invalid Authorization header' }, { status: 401 });
  }

  const idToken = authHeader.split('Bearer ')[1];
  let userId;
  try {
    const decodedToken = await getAuth().verifyIdToken(idToken, true);
    userId = decodedToken.uid;
  } catch (error: any) {
    console.error('Token verification failed:', { error: error.message, ip, timestamp: new Date().toISOString() });
    return NextResponse.json({ error: 'Invalid or expired token', details: error.message }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
    const validatedData = requestSchema.parse(body);

    const { bookingId, amount, currency, customerDetails, metadata } = validatedData;

    const bookingRef = doc(db, 'bookings', bookingId);
    const result = await runTransaction(db, async (transaction) => {
      const bookingDoc = await transaction.get(bookingRef);
      if (!bookingDoc.exists()) {
        throw new Error('Booking not found');
      }
      const bookingData = bookingDoc.data();
      if (bookingData?.userId !== userId) {
        throw new Error('Access denied');
      }
      if (bookingData?.paymentStatus === 'paid' || bookingData?.bookingStatus === 'cancelled') {
        throw new Error(`Booking ${bookingData.paymentStatus || 'cancelled'}`);
      }

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
              name: `Bus Ticket - ${metadata?.route || 'Bus Booking'}`,
              description: `${metadata?.passengerCount || 1} passenger(s) - Booking ${bookingId.slice(-8)}`,
              metadata: { bookingId, ...(metadata || {}) },
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        }],
        metadata: { bookingId, userId, ...(metadata || {}) },
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/bookings?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/bookings?cancelled=true`,
        expires_at: Math.floor(Date.now() / 1000) + (30 * 60),
      });

      transaction.update(bookingRef, {
        paymentStatus: 'processing',
        paymentProvider: 'stripe',
        paymentMethod: 'card',
        stripeSessionId: session.id,
        stripeSessionUrl: session.url,
        paymentInitiatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        customerDetails: { email: customerDetails.email },
        metadata: { ...bookingData.metadata, ...metadata },
      });

      return { session, bookingData };
    });

    return NextResponse.json({
      success: true,
      sessionId: result.session.id,
      checkoutUrl: result.session.url,
      message: 'Stripe checkout session created successfully',
    }, {
      status: 200,
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, private' },
    });
  } catch (error: any) {
    console.error('Stripe checkout error:', {
      error: error.message,
      userId,
      body,
      ip,
      timestamp: new Date().toISOString(),
    });
    if (body?.bookingId) {
      try {
        await updateDoc(doc(db, 'bookings', body.bookingId), {
          paymentStatus: 'failed',
          paymentFailureReason: error.message || 'Unknown error',
          updatedAt: serverTimestamp(),
        });
      } catch (updateError) {
        console.error('Failed to update booking status:', { updateError, bookingId: body?.bookingId });
      }
    }
    const status = error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json({ error: 'Failed to create checkout session', message: error.message }, { status });
  }
}