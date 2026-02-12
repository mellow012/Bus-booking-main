import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { headers } from 'next/headers';
import crypto from 'crypto'; // Node.js built-in crypto module

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  
  const stripeSignature = headersList.get('stripe-signature');
  const paychanguSignature = headersList.get('Signature');
  const userAgent = headersList.get('user-agent') || '';
  const contentType = headersList.get('content-type') || '';

  try {
    // Handle Stripe Webhook
    if (stripeSignature) {
      return await handleStripeWebhook(body, stripeSignature);
    }
    
    // Handle PayChangu Webhook
    if (contentType.includes('application/json') && paychanguSignature && (
      userAgent.toLowerCase().includes('paychangu') || 
      body.includes('tx_ref') || 
      body.includes('transaction_id')
    )) {
      if (!process.env.PAYCHANGU_WEBHOOK_SECRET) {
        throw new Error('PayChangu webhook secret not configured');
      }

      // Validate PayChangu signature
      const computedSignature = crypto
        .createHmac('sha256', process.env.PAYCHANGU_WEBHOOK_SECRET)
        .update(body)
        .digest('hex');

      if (computedSignature !== paychanguSignature) {
        console.warn('Invalid PayChangu webhook signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }

      return await handlePayChanguWebhook(body);
    }
    
    console.warn('Unknown webhook source:', { userAgent, contentType, hasStripeSignature: !!stripeSignature, hasPayChanguSignature: !!paychanguSignature });
    return NextResponse.json({ error: 'Unknown webhook source' }, { status: 400 });
    
  } catch (error: any) {
    console.error('Webhook processing error:', {
      error: error.message,
      stack: error.stack,
      userAgent,
      contentType
    });
    return NextResponse.json({ error: 'Webhook processing failed', message: error.message }, { status: 500 });
  }
}
async function handleStripeWebhook(body: string, signature: string) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('Stripe webhook secret not configured');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body, 
      signature, 
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err: any) {
    console.error('Stripe signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid Stripe signature' }, { status: 400 });
  }

  console.log('Stripe webhook event:', event.type);

  switch (event.type) {
    case 'checkout.session.completed':
      await handleStripePaymentSuccess(event.data.object as any);
      break;
    case 'checkout.session.expired':
      await handleStripePaymentExpired(event.data.object as any);
      break;
    case 'payment_intent.payment_failed':
      await handleStripePaymentFailed(event.data.object as any);
      break;
    default:
      console.log('Unhandled Stripe event type:', event.type);
  }

  return NextResponse.json({ received: true });
}

async function handlePayChanguWebhook(body: string) {
  const data = JSON.parse(body);
  console.log('PayChangu webhook data:', data);

  // PayChangu webhook structure validation
  if (!data.tx_ref && !data.transaction_id) {
    throw new Error('Invalid PayChangu webhook: missing transaction reference');
  }

  const txRef = data.tx_ref || data.transaction_id;
  const status = data.status?.toLowerCase() || '';

  switch (status) {
    case 'success':
    case 'successful':
    case 'completed':
      await handlePayChanguPaymentSuccess(data, txRef);
      break;
    case 'failed':
    case 'cancelled':
    case 'canceled':
      await handlePayChanguPaymentFailed(data, txRef);
      break;
    case 'pending':
    case 'processing':
      await handlePayChanguPaymentPending(data, txRef);
      break;
    default:
      console.warn('Unknown PayChangu status:', status, data);
      return NextResponse.json({ 
        warning: `Unknown status: ${status}` 
      }, { status: 200 });
  }

  return NextResponse.json({ received: true });
}

// Stripe Event Handlers
async function handleStripePaymentSuccess(session: any) {
  const bookingId = session.metadata?.bookingId;
  if (!bookingId) {
    console.error('No bookingId in Stripe session metadata');
    return;
  }

  try {
    const bookingRef = doc(db, 'bookings', bookingId);
    const bookingDoc = await getDoc(bookingRef);
    
    if (!bookingDoc.exists()) {
      console.error('Booking not found:', bookingId);
      return;
    }

    const currentStatus = bookingDoc.data()?.paymentStatus;
    
    // Prevent duplicate processing
    if (currentStatus === 'paid') {
      console.log('Payment already processed for booking:', bookingId);
      return;
    }

    await updateDoc(bookingRef, {
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
      paymentDetails: {
        provider: 'stripe',
        sessionId: session.id,
        paymentIntentId: session.payment_intent,
        amountTotal: session.amount_total,
        currency: session.currency,
        customerEmail: session.customer_email,
        paymentStatus: session.payment_status,
      },
      paymentConfirmedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    console.log('Stripe payment confirmed for booking:', bookingId);
  } catch (error: any) {
    console.error('Error processing Stripe payment success:', error);
    throw error;
  }
}

async function handleStripePaymentExpired(session: any) {
  const bookingId = session.metadata?.bookingId;
  if (!bookingId) return;

  try {
    await updateDoc(doc(db, 'bookings', bookingId), {
      paymentStatus: 'expired',
      paymentFailureReason: 'Stripe checkout session expired',
      updatedAt: serverTimestamp(),
    });

    console.log('Stripe payment expired for booking:', bookingId);
  } catch (error: any) {
    console.error('Error processing Stripe payment expiration:', error);
  }
}

async function handleStripePaymentFailed(paymentIntent: any) {
  // Find booking by payment intent if needed
  // This is more complex as we need to query by stripeSessionId
  console.log('Stripe payment failed:', paymentIntent.id);
}

// PayChangu Event Handlers
async function handlePayChanguPaymentSuccess(data: any, txRef: string) {
  try {
    // Find booking by transaction reference
    const bookingId = await findBookingByTxRef(txRef);
    if (!bookingId) {
      console.error('Booking not found for tx_ref:', txRef);
      return;
    }

    const bookingRef = doc(db, 'bookings', bookingId);
    const bookingDoc = await getDoc(bookingRef);
    
    if (!bookingDoc.exists()) {
      console.error('Booking document not found:', bookingId);
      return;
    }

    const currentStatus = bookingDoc.data()?.paymentStatus;
    
    // Prevent duplicate processing
    if (currentStatus === 'paid') {
      console.log('Payment already processed for booking:', bookingId);
      return;
    }

    // Determine payment method from PayChangu data
    const paymentMethod = determinePayChanguPaymentMethod(data);

    await updateDoc(bookingRef, {
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
      paymentMethod: paymentMethod,
      paymentDetails: {
        provider: 'paychangu',
        transactionId: data.transaction_id || data.id,
        txRef: txRef,
        amount: data.amount,
        currency: data.currency,
        customerEmail: data.customer?.email || data.email,
        paymentMethod: paymentMethod,
        fees: data.fees,
        netAmount: data.net_amount,
        status: data.status,
      },
      paymentConfirmedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    console.log('PayChangu payment confirmed for booking:', bookingId);
  } catch (error: any) {
    console.error('Error processing PayChangu payment success:', error);
    throw error;
  }
}

async function handlePayChanguPaymentFailed(data: any, txRef: string) {
  try {
    const bookingId = await findBookingByTxRef(txRef);
    if (!bookingId) {
      console.error('Booking not found for failed payment tx_ref:', txRef);
      return;
    }

    await updateDoc(doc(db, 'bookings', bookingId), {
      paymentStatus: 'failed',
      paymentFailureReason: `PayChangu: ${data.status} - ${data.message || 'Payment failed'}`,
      paymentDetails: {
        provider: 'paychangu',
        txRef: txRef,
        status: data.status,
        message: data.message,
        failureReason: data.failure_reason,
      },
      updatedAt: serverTimestamp(),
    });

    console.log('PayChangu payment failed for booking:', bookingId);
  } catch (error: any) {
    console.error('Error processing PayChangu payment failure:', error);
  }
}

async function handlePayChanguPaymentPending(data: any, txRef: string) {
  try {
    const bookingId = await findBookingByTxRef(txRef);
    if (!bookingId) return;

    await updateDoc(doc(db, 'bookings', bookingId), {
      paymentStatus: 'pending',
      paymentDetails: {
        provider: 'paychangu',
        txRef: txRef,
        status: data.status,
        message: data.message,
      },
      updatedAt: serverTimestamp(),
    });

    console.log('PayChangu payment pending for booking:', bookingId);
  } catch (error: any) {
    console.error('Error processing PayChangu payment pending:', error);
  }
}

// Helper Functions
async function findBookingByTxRef(txRef: string): Promise<string | null> {
  try {
    // Extract booking ID from transaction reference if it follows the pattern
    if (txRef.includes('booking_')) {
      const parts = txRef.split('_');
      if (parts.length >= 2) {
        // Try to find booking with the extracted ID pattern
        const potentialBookingId = parts[1];
        const bookingRef = doc(db, 'bookings', potentialBookingId);
        const bookingDoc = await getDoc(bookingRef);
        
        if (bookingDoc.exists() && bookingDoc.data()?.transactionReference === txRef) {
          return potentialBookingId;
        }
      }
    }

    // If pattern matching fails, we'd need to query the collection
    // This is less efficient but more reliable
    console.warn('Could not extract booking ID from tx_ref pattern, might need collection query');
    return null;
  } catch (error) {
    console.error('Error finding booking by tx_ref:', error);
    return null;
  }
}

function determinePayChanguPaymentMethod(data: any): string {
  // Determine payment method based on PayChangu response data
  const method = data.payment_method?.toLowerCase() || '';
  const channel = data.channel?.toLowerCase() || '';
  
  if (method.includes('mobile') || channel.includes('mobile') || 
      method.includes('airtel') || method.includes('tnm') || 
      method.includes('mpamba')) {
    return 'mobile_money';
  }
  
  if (method.includes('card') || channel.includes('card') || 
      method.includes('visa') || method.includes('mastercard')) {
    return 'card';
  }
  
  if (method.includes('bank') || channel.includes('bank')) {
    return 'bank_transfer';
  }
  
  // Default to mobile money for PayChangu (most common in Malawi)
  return 'mobile_money';
}