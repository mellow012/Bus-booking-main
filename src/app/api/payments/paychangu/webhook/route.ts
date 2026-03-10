// app/api/payments/paychangu/webhook/route.ts
//
// GET  — browser redirect from PayChangu after payment
// POST — server-to-server payment event from PayChangu

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import crypto from 'crypto';

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');

// ── GET — browser redirect ────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const txRef     = searchParams.get('tx_ref')     ?? searchParams.get('reference') ?? '';
  const status    = searchParams.get('status')     ?? '';
  const bookingId = searchParams.get('booking_id') ?? '';

  // Extract bookingId from custom tx_ref format: pc_{bookingId}_{timestamp}
  let resolvedBookingId = bookingId;
  if (!resolvedBookingId && txRef.startsWith('pc_')) {
    resolvedBookingId = txRef.split('_')[1] ?? '';
  }

  const qs = new URLSearchParams({
    ...(txRef  && { tx_ref: txRef }),
    ...(status && { status }),
  });

  if (resolvedBookingId) {
    return NextResponse.redirect(
      `${APP_URL}/api/payments/paychangu/verify/${resolvedBookingId}?${qs.toString()}`,
      302
    );
  }

  // Fallback for legacy payments
  return NextResponse.redirect(
    `${APP_URL}/api/payments/paychangu/verify?${qs.toString()}`,
    302
  );
}

// ── POST — server-to-server webhook ──────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // Verify signature
    const signatureHeader = req.headers.get('x-paychangu-signature') ?? '';
    const secretKey       = process.env.PAYCHANGU_SECRET_KEY;

    if (!secretKey) {
      console.error('[paychangu/webhook] PAYCHANGU_SECRET_KEY not set');
      return NextResponse.json({ received: true });
    }

    const expectedSig = crypto
      .createHmac('sha256', secretKey)
      .update(rawBody)
      .digest('hex');

    const sigBuffer      = Buffer.from(signatureHeader, 'hex');
    const expectedBuffer = Buffer.from(expectedSig, 'hex');

    const signatureValid =
      sigBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(sigBuffer, expectedBuffer);

    if (!signatureValid) {
      console.warn('[paychangu/webhook] Invalid signature — ignoring');
      return NextResponse.json({ received: true });
    }

    const data = JSON.parse(rawBody);
    const { tx_ref, status, reference } = data;

    console.log('[paychangu/webhook] event tx_ref:', tx_ref, 'status:', status);

    if (!tx_ref) {
      return NextResponse.json({ received: true });
    }

    // ── Resolve booking ───────────────────────────────────────────────────────
    // tx_ref may be our custom format pc_{bookingId}_{ts} or PayChangu's UUID.
    // Never use tx_ref as a doc ID directly.
    let bookingRef: FirebaseFirestore.DocumentReference | null = null;

    // 1. Custom format: extract bookingId from tx_ref
    if (tx_ref.startsWith('pc_')) {
      const bookingId = tx_ref.split('_')[1];
      if (bookingId) {
        const snap = await adminDb.collection('bookings').doc(bookingId).get();
        if (snap.exists) bookingRef = snap.ref;
      }
    }

    // 2. Query by stored reference fields
    if (!bookingRef) {
      for (const field of ['paychanguTxRef', 'paychanguReference', 'customTxRef']) {
        const snap = await adminDb
          .collection('bookings')
          .where(field, '==', tx_ref)
          .limit(1)
          .get();
        if (!snap.empty) { bookingRef = snap.docs[0].ref; break; }
      }
    }

    if (!bookingRef) {
      console.warn('[paychangu/webhook] Booking not found for tx_ref:', tx_ref);
      return NextResponse.json({ received: true });
    }

    const bookingSnap = await bookingRef.get();
    if (!bookingSnap.exists) return NextResponse.json({ received: true });

    // Idempotency
    if (bookingSnap.data()?.paymentStatus === 'paid') {
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
      paychanguReference: reference ?? tx_ref,
      paymentUpdatedAt:   new Date(),
      updatedAt:          new Date(),
      ...(paymentStatus === 'paid' ? { paymentCompletedAt: new Date() } : {}),
    });

    return NextResponse.json({ received: true });

  } catch (err: any) {
    console.error('[paychangu/webhook]', err);
    return NextResponse.json({ received: true, warning: err.message });
  }
}