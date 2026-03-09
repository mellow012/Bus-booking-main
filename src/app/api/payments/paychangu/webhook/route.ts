// app/api/payments/paychangu/webhook/route.ts
//
// Receives PayChangu payment event webhooks (POST),
// AND handles browser redirects from PayChangu after payment (GET).

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import crypto from 'crypto';

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');

// ── GET — browser redirect from PayChangu after payment ──────────────────────
// PayChangu sends the user here via GET with ?tx_ref=... after checkout.
// We just redirect to the bookings page where verify logic runs.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const txRef  = searchParams.get('tx_ref')  ?? searchParams.get('reference') ?? '';
  const status = searchParams.get('status')  ?? '';

  const qs = new URLSearchParams({
    payment_verify: 'true',
    provider:       'paychangu',
    tx_ref:         txRef,
    ...(status && { status }),
  });

  return NextResponse.redirect(`${APP_URL}/bookings?${qs.toString()}`, 302);
}

// ── POST — server-to-server webhook from PayChangu ───────────────────────────
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // Verify signature
    const signatureHeader = req.headers.get('x-paychangu-signature') ?? '';
    const secretKey       = process.env.PAYCHANGU_SECRET_KEY;

    if (!secretKey) {
      console.error('[paychangu/webhook] PAYCHANGU_SECRET_KEY env var is not set');
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const expectedSig = crypto
      .createHmac('sha256', secretKey)
      .update(rawBody)
      .digest('hex');

    const sigBuffer      = Buffer.from(signatureHeader, 'hex');
    const expectedBuffer = Buffer.from(expectedSig,     'hex');

    const signatureValid =
      sigBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(sigBuffer, expectedBuffer);

    if (!signatureValid) {
      console.warn('[paychangu/webhook] Invalid signature — ignoring event');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Parse event
    const data = JSON.parse(rawBody);
    const { tx_ref, status, reference } = data;

    if (!tx_ref) {
      return NextResponse.json({ received: true });
    }

    // Resolve booking
    const bookingRef  = adminDb.collection('bookings').doc(tx_ref);
    const bookingSnap = await bookingRef.get();

    if (!bookingSnap.exists) {
      return NextResponse.json({ received: true });
    }

    // Map status
    const normalised = status?.toLowerCase();
    let paymentStatus: string;
    let bookingStatus: string;

    switch (normalised) {
      case 'successful':
      case 'success':
        paymentStatus = 'paid';
        bookingStatus = 'confirmed';
        break;
      case 'failed':
      case 'cancelled':
        paymentStatus = 'failed';
        bookingStatus = 'payment_failed';
        break;
      default:
        paymentStatus = 'pending';
        bookingStatus = bookingSnap.data()?.bookingStatus ?? 'pending';
    }

    await bookingRef.update({
      paymentStatus,
      bookingStatus,
      paychanguReference:  reference ?? bookingSnap.data()?.paychanguReference,
      paymentUpdatedAt:    new Date(),
      updatedAt:           new Date(),
      ...(normalised === 'successful' || normalised === 'success'
        ? { paymentCompletedAt: new Date() }
        : {}),
    });

    return NextResponse.json({ received: true });

  } catch (err: any) {
    console.error('[paychangu/webhook]', err);
    return NextResponse.json({ received: true, warning: err.message });
  }
}