// app/api/payments/paychangu/webhook/route.ts
//
// Receives PayChangu payment event webhooks.
//
// SIGNATURE VERIFICATION:
//   PayChangu signs the payload with your secret key via HMAC-SHA256.
//   The signature is sent in the 'x-paychangu-signature' header.
//   We verify using timingSafeEqual to prevent timing-based attacks.
//
// REQUIRED ENV VARS:
//   PAYCHANGU_SECRET_KEY — your PayChangu secret key (same one used to initiate payments)
//
// FIRESTORE UPDATES:
//   successful → paymentStatus: 'paid',   bookingStatus: 'confirmed'
//   failed     → paymentStatus: 'failed', bookingStatus: 'payment_failed'
//   pending    → no change (wait for final event)
//
// NOTE: Always return 200 to PayChangu even on our own processing errors,
// otherwise PayChangu will keep retrying and flood your logs.

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // ── Verify signature ──────────────────────────────────────────────────────
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

    // timingSafeEqual requires equal-length buffers
    const sigBuffer      = Buffer.from(signatureHeader, 'hex');
    const expectedBuffer = Buffer.from(expectedSig,     'hex');

    const signatureValid =
      sigBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(sigBuffer, expectedBuffer);

    if (!signatureValid) {
      console.warn('[paychangu/webhook] Invalid signature — ignoring event');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // ── Parse event ───────────────────────────────────────────────────────────
    const data = JSON.parse(rawBody);
    const { tx_ref, status, reference } = data;

    if (!tx_ref) {
      return NextResponse.json({ received: true });
    }

    // ── Resolve booking ───────────────────────────────────────────────────────
    // PayChangu tx_ref = bookingId (set in charge route returnUrl)
    const bookingRef  = adminDb.collection('bookings').doc(tx_ref);
    const bookingSnap = await bookingRef.get();

    if (!bookingSnap.exists) {
      // Not our booking — acknowledge so PayChangu stops retrying
      return NextResponse.json({ received: true });
    }

    // ── Map PayChangu status → internal statuses ──────────────────────────────
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
        // 'pending' or anything unknown — leave bookingStatus unchanged
        paymentStatus = 'pending';
        bookingStatus = bookingSnap.data()?.bookingStatus ?? 'pending';
    }

    await bookingRef.update({
      paymentStatus,
      bookingStatus,
      paychanguReference: reference ?? bookingSnap.data()?.paychanguReference,
      paymentUpdatedAt:   new Date(),
      updatedAt:          new Date(),
      ...(normalised === 'successful' || normalised === 'success'
        ? { paymentCompletedAt: new Date() }
        : {}),
    });

    return NextResponse.json({ received: true });

  } catch (err: any) {
    console.error('[paychangu/webhook]', err);
    // Always 200 — prevents PayChangu from retrying on our own processing errors
    return NextResponse.json({ received: true, warning: err.message });
  }
}