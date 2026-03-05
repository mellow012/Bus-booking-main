// app/api/paychangu/webhook/route.ts
//
// PAY-1: Webhook signature verification added (was missing in original).
// The uploaded version had verification but used a timing-unsafe string
// comparison (`signature !== expectedSig`). Fixed to use timingSafeEqual.

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // ── Verify the webhook signature ─────────────────────────────────────────
    // PayChangu signs the payload with your PAYCHANGU_SECRET_KEY via HMAC-SHA256.
    // We compare using timingSafeEqual to prevent timing-based side-channel attacks.
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
    const expectedBuffer = Buffer.from(expectedSig, 'hex');

    const signatureValid =
      sigBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(sigBuffer, expectedBuffer);

    if (!signatureValid) {
      console.warn('[paychangu/webhook] Invalid signature — ignoring event');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // ── Parse the event ───────────────────────────────────────────────────────
    const data = JSON.parse(rawBody);
    const { tx_ref, status, reference } = data;

    if (!tx_ref) {
      return NextResponse.json({ error: 'Missing tx_ref' }, { status: 400 });
    }

    const bookingRef  = adminDb.collection('bookings').doc(tx_ref);
    const bookingSnap = await bookingRef.get();

    if (!bookingSnap.exists) {
      // Not our booking — acknowledge so PayChangu stops retrying
      return NextResponse.json({ received: true });
    }

    // ── Map PayChangu status → internal statuses ──────────────────────────────
    let paymentStatus: string;
    let bookingStatus: string;

    switch (status?.toLowerCase()) {
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
      paychanguReference: reference ?? bookingSnap.data()?.paychanguReference,
      paymentUpdatedAt: new Date(),
    });

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('[paychangu/webhook]', err);
    // Return 200 to prevent PayChangu from retrying on our own processing errors
    return NextResponse.json({ received: true, warning: err.message });
  }
}