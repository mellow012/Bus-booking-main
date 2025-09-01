import { NextResponse } from 'next/server';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../../../lib/firebaseConfig';
import { getAuth } from 'firebase-admin/auth';
import admin from 'firebase-admin';
import { z } from 'zod';

if (!admin.apps.length) {
  admin.initializeApp();
}

const requestSchema = z.object({
  bookingId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().refine((c) => ['mwk'].includes(c.toLowerCase()), { message: 'Only MWK supported' }).optional().default('mwk'),
  customerDetails: z.object({ email: z.string().email(), phone: z.string().min(10) }),
  metadata: z.record(z.string()).optional(),
});

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const idToken = authHeader.split('Bearer ')[1];
  let userId;
  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    userId = decodedToken.uid;
  } catch (error) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
    const validatedData = requestSchema.parse(body);

    const { bookingId, amount, currency, customerDetails, metadata } = validatedData;
    const txRef = `TX${bookingId.slice(-8)}`; // Generate tx_ref from bookingId

    const bookingRef = doc(db, 'bookings', bookingId);
    const bookingDoc = await getDoc(bookingRef);
    if (!bookingDoc.exists() || bookingDoc.data()?.userId !== userId) {
      return NextResponse.json({ error: 'Booking not found or access denied' }, { status: 403 });
    }

    const bookingData = bookingDoc.data();
    if (bookingData.paymentStatus === 'paid' || bookingData.bookingStatus === 'cancelled') {
      return NextResponse.json({ error: `Booking ${bookingData.paymentStatus || 'cancelled'}` }, { status: 400 });
    }

    const paymentPayload = {
      amount: Number(amount),
      currency: currency.toUpperCase(),
      email: customerDetails.email.toLowerCase().trim(),
      first_name: metadata?.firstName || 'Customer',
      last_name: metadata?.lastName || 'User',
      phone_number: customerDetails.phone.trim(),
      tx_ref: txRef,
      description: `Payment for Booking ${bookingId.slice(-8)}`,
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/paychangu-api/callback`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/bookings?success=true&tx_ref=${txRef}`,
      payment_type: 'mobile_money',
      metadata: { bookingId, userId, ...metadata, initiated_at: new Date().toISOString(), source: 'bus_booking_system' },
    };

    console.log('Sending to PayChangu:', {
      ...paymentPayload,
      phone_number: '***masked***',
      email: '***masked***',
    });

    const response = await fetch('https://api.paychangu.com/payment', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PAYCHANGU_SECRET_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-API-KEY': process.env.NEXT_PUBLIC_PAYCHANGU_PUBLIC_KEY,
      },
      body: JSON.stringify(paymentPayload),
    });

    const responseText = await response.text();
    if (!response.ok) {
      const errorData = JSON.parse(responseText || '{}');
      console.error('PayChangu API Error:', { status: response.status, error: errorData.message || responseText });
      return NextResponse.json({ success: false, error: errorData.message || 'Payment initiation failed' }, { status: response.status || 500 });
    }

    const paymentResponse = JSON.parse(responseText);
    const checkoutUrl = paymentResponse.checkout_url || paymentResponse.data?.checkout_url;
    const paymentId = paymentResponse.payment_id || paymentResponse.data?.payment_id || txRef;

    if (!checkoutUrl) {
      console.error('No checkout URL in PayChangu response:', paymentResponse);
      return NextResponse.json({ success: false, error: 'Checkout URL not provided' }, { status: 500 });
    }

    await updateDoc(bookingRef, {
      paymentStatus: 'initiated',
      paymentProvider: 'paychangu',
      paymentMethod: 'mobile_money',
      paychanguTxRef: txRef,
      checkoutUrl,
      paymentInitiatedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      customerDetails,
      metadata: { ...bookingData.metadata, ...metadata },
    });

    return NextResponse.json({
      success: true,
      checkoutUrl,
      paymentId,
      txRef,
      message: 'PayChangu checkout session created',
    }, { status: 200 });
  } catch (error: any) {
    console.error('PayChangu checkout error:', { message: error.message, userId, body });
    if (body?.bookingId) {
      await updateDoc(doc(db, 'bookings', body.bookingId), {
        paymentStatus: 'failed',
        paymentFailureReason: error.message,
        updatedAt: serverTimestamp(),
      });
    }
    return NextResponse.json({ error: 'Failed to create checkout session', message: error.message }, { status: 500 });
  }
}