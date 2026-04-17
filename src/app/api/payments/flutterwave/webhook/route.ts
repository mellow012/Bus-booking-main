// app/api/payments/flutterwave/webhook/route.ts
//
// Receives Flutterwave payment event webhooks.
//
// SIGNATURE VERIFICATION:
//   Flutterwave does NOT sign with HMAC-SHA256. Instead they send a plain
//   secret hash in the "verif-hash" header. You set this hash value in your
//   Flutterwave dashboard under Settings → Webhooks → "Secret hash".
//   Store it as FLW_WEBHOOK_HASH in your .env.
//   Reference: https://developer.flutterwave.com/docs/integration-guides/webhooks/
//
// WHY THE OLD CODE FAILED:
//   The previous version computed HMAC-SHA256 of the raw body and compared it
//   to the "flutterwave-signature" header — but that header doesn't exist.
//   Flutterwave uses "verif-hash" with a plain string comparison.
//
// REQUIRED ENV VARS:
//   FLW_WEBHOOK_HASH — the secret hash you configure in the FLW dashboard

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // ── Verify the webhook secret hash ────────────────────────────────────────
    // Flutterwave sends the value you set in the dashboard as "verif-hash".
    // Use timingSafeEqual to prevent timing attacks even on a plain string.
    const receivedHash = req.headers.get("verif-hash") ?? "";
    const expectedHash = process.env.FLW_WEBHOOK_HASH ?? "";

    if (!expectedHash) {
      console.error("[flutterwave/webhook] FLW_WEBHOOK_HASH env var is not set");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    const receivedBuf = Buffer.from(receivedHash);
    const expectedBuf = Buffer.from(expectedHash);
    const hashValid   =
      receivedBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(receivedBuf, expectedBuf);

    if (!hashValid) {
      console.warn("[flutterwave/webhook] Invalid verif-hash — ignoring event");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // ── Parse event ───────────────────────────────────────────────────────────
    const event = JSON.parse(rawBody);

    // Flutterwave sends event.event = "charge.completed" for successful payments
    if (event.event === "charge.completed") {
      const txData    = event.data;
      const flwStatus = (txData?.status as string | undefined)?.toLowerCase();
      const txRef     = txData?.tx_ref as string | undefined;

      if (!txRef) {
        // Nothing we can do without a tx_ref — still ack to stop retries
        return NextResponse.json({ received: true });
      }

      // ── Resolve booking ───────────────────────────────────────────────────
      // Parse bookingId from our tx_ref format: "bk_{bookingId}_{timestamp}"
      // This avoids a DB scan on every webhook.
      let booking: any = null;

      const parts = txRef.split("_");
      if (parts.length >= 3 && parts[0] === "bk") {
        const bookingId = parts[1];
        booking = await prisma.booking.findUnique({
          where: { id: bookingId }
        });
      }

      // Fallback: query by stored txRef via payment record
      if (!booking) {
        const payment = await prisma.payment.findFirst({
          where: { txRef }
        });
        if (payment?.bookingId) {
          booking = await prisma.booking.findUnique({
            where: { id: payment.bookingId }
          });
        }
      }

      if (booking) {
        if (flwStatus === "successful") {
          await prisma.booking.update({
            where: { id: booking.id },
            data: {
              paymentStatus: "paid",
              bookingStatus: "confirmed",
              paidAt: new Date(),
              updatedAt: new Date(),
            }
          });

          // Update payment record with transaction details
          await prisma.payment.updateMany({
            where: { txRef },
            data: {
              status: "completed",
              metadata: {
                flutterwaveTransactionId: txData?.id ?? null,
                flutterwaveFlwRef: txData?.flw_ref ?? null,
              },
              updatedAt: new Date(),
            }
          });
        } else if (flwStatus === "failed" || flwStatus === "cancelled") {
          await prisma.booking.update({
            where: { id: booking.id },
            data: {
              paymentStatus: "failed",
              updatedAt: new Date(),
            }
          });

          await prisma.payment.updateMany({
            where: { txRef },
            data: {
              status: "failed",
              updatedAt: new Date(),
            }
          });
        }
        // "pending" — do nothing; wait for the final event
      }
    }

    // Always return 200 to prevent Flutterwave from retrying indefinitely
    return NextResponse.json({ received: true });

  } catch (err: any) {
    console.error("[flutterwave/webhook] Unhandled error:", err);
    // Return 200 even on errors so FLW doesn't retry our own processing failures
    return NextResponse.json({ received: true, warning: err?.message });
  }
}   
