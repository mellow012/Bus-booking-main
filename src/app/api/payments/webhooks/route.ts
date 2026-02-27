import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { adminDb, FieldValue } from '@/lib/firebaseAdmin'; // Switched to Admin SDK
import { headers } from 'next/headers';
import crypto from 'crypto';

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

/* -------------------------------------------------- */
/* STRIPE HANDLERS                                    */
/* -------------------------------------------------- */

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
      // NEW: Handling explicit payment failures (e.g., card declined)
      await handleStripePaymentFailed(event.data.object as any);
      break;
    default:
      console.log('Unhandled Stripe event type:', event.type);
  }

  return NextResponse.json({ received: true });
}

async function handleStripePaymentSuccess(session: any) {
  const bookingId = session.metadata?.bookingId;
  if (!bookingId) {
    console.error('No bookingId in Stripe session metadata');
    return;
  }

  try {
    const bookingRef = adminDb.collection('bookings').doc(bookingId);
    const bookingDoc = await bookingRef.get();
    
    if (!bookingDoc.exists) {
      console.error('Booking not found:', bookingId);
      return;
    }

    const currentStatus = bookingDoc.data()?.paymentStatus;
    
    // Idempotency check
    if (currentStatus === 'paid') {
      console.log('Payment already processed for booking:', bookingId);
      return;
    }

    await bookingRef.update({
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
      paymentConfirmedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
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
    await adminDb.collection('bookings').doc(bookingId).update({
      paymentStatus: 'expired',
      paymentFailureReason: 'Stripe checkout session expired',
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log('Stripe payment expired for booking:', bookingId);
  } catch (error: any) {
    console.error('Error processing Stripe payment expiration:', error);
  }
}

/**
 * NEW: Handles Stripe payment failures (e.g., insufficient funds, card declined)
 */
async function handleStripePaymentFailed(paymentIntent: any) {
  const bookingId = paymentIntent.metadata?.bookingId;
  
  // If we don't have the bookingId in metadata (rare), we might need to query by intent ID
  // But standard flow usually propagates metadata.
  if (!bookingId) {
    console.warn('Stripe payment_failed: No bookingId in metadata', paymentIntent.id);
    return;
  }

  try {
    const failureMessage = paymentIntent.last_payment_error?.message || 'Card payment failed';
    const failureCode = paymentIntent.last_payment_error?.code || 'unknown';

    await adminDb.collection('bookings').doc(bookingId).update({
      paymentStatus: 'failed',
      paymentFailureReason: `Stripe: ${failureMessage} (Code: ${failureCode})`,
      paymentDetails: {
        provider: 'stripe',
        paymentIntentId: paymentIntent.id,
        status: 'failed',
        error: paymentIntent.last_payment_error,
      },
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`Stripe payment failed for booking ${bookingId}: ${failureMessage}`);
    
    // Note: The frontend 'bookings/page.tsx' has a real-time listener (onSnapshot).
    // When we update the status to 'failed' here, the user sees the update immediately.
    
  } catch (error: any) {
    console.error('Error processing Stripe payment failure:', error);
  }
}

/* -------------------------------------------------- */
/* PAYCHANGU HANDLERS                                 */
/* -------------------------------------------------- */

async function handlePayChanguWebhook(body: string) {
  const data = JSON.parse(body);
  console.log('PayChangu webhook data:', data);

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

async function handlePayChanguPaymentSuccess(data: any, txRef: string) {
  try {
    // FIX: Use robust lookup instead of string parsing
    const bookingId = await findBookingByTxRef(txRef);
    if (!bookingId) {
      console.error('Booking not found for successful tx_ref:', txRef);
      return;
    }

    const bookingRef = adminDb.collection('bookings').doc(bookingId);
    const bookingDoc = await bookingRef.get();
    
    if (!bookingDoc.exists) {
      console.error('Booking document not found:', bookingId);
      return;
    }

    const currentStatus = bookingDoc.data()?.paymentStatus;
    
    // Idempotency check
    if (currentStatus === 'paid') {
      console.log('Payment already processed for booking:', bookingId);
      return;
    }

    const paymentMethod = determinePayChanguPaymentMethod(data);

    await bookingRef.update({
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
      paymentConfirmedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log('PayChangu payment confirmed for booking:', bookingId);
  } catch (error: any) {
    console.error('Error processing PayChangu payment success:', error);
    throw error;
  }
}

async function handlePayChanguPaymentFailed(data: any, txRef: string) {
  try {
    // FIX: Use robust lookup
    const bookingId = await findBookingByTxRef(txRef);
    if (!bookingId) {
      console.error('Booking not found for failed payment tx_ref:', txRef);
      return;
    }

    await adminDb.collection('bookings').doc(bookingId).update({
      paymentStatus: 'failed',
      paymentFailureReason: `PayChangu: ${data.status} - ${data.message || 'Payment failed'}`,
      paymentDetails: {
        provider: 'paychangu',
        txRef: txRef,
        status: data.status,
        message: data.message,
        failureReason: data.failure_reason,
      },
      updatedAt: FieldValue.serverTimestamp(),
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

    await adminDb.collection('bookings').doc(bookingId).update({
      paymentStatus: 'pending',
      paymentDetails: {
        provider: 'paychangu',
        txRef: txRef,
        status: data.status,
        message: data.message,
      },
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log('PayChangu payment pending for booking:', bookingId);
  } catch (error: any) {
    console.error('Error processing PayChangu payment pending:', error);
  }
}

/* -------------------------------------------------- */
/* HELPERS                                            */
/* -------------------------------------------------- */

/**
 * FIX: Robust TX Ref Lookup
 * Replaces string parsing with a Firestore query using Admin SDK.
 */
async function findBookingByTxRef(txRef: string): Promise<string | null> {
  try {
    // 1. Try exact match on transactionReference
    const snapshot = await adminDb.collection('bookings')
      .where('transactionReference', '==', txRef)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      return snapshot.docs[0].id;
    }

    // 2. Fallback: Try match on paymentSessionId (sometimes used interchangeably)
    const sessionSnapshot = await adminDb.collection('bookings')
      .where('paymentSessionId', '==', txRef)
      .limit(1)
      .get();

    if (!sessionSnapshot.empty) {
      return sessionSnapshot.docs[0].id;
    }

    console.warn(`findBookingByTxRef: No booking found for ref ${txRef}`);
    return null;
  } catch (error) {
    console.error('Error in findBookingByTxRef:', error);
    return null;
  }
}

function determinePayChanguPaymentMethod(data: any): string {
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
  
  return 'mobile_money';
}