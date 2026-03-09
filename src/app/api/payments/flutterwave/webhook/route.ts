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
      // This avoids a collection scan on every webhook.
      const { adminDb } = await import("@/lib/firebaseAdmin");
      let bookingRef: FirebaseFirestore.DocumentReference | null = null;

      const parts = txRef.split("_");
      if (parts.length >= 3 && parts[0] === "bk") {
        const bookingId  = parts[1];
        const directSnap = await adminDb.collection("bookings").doc(bookingId).get();
        if (directSnap.exists) bookingRef = directSnap.ref;
      }

      // Fallback: query by stored field (handles manually-set tx_refs)
      if (!bookingRef) {
        const q = await adminDb
          .collection("bookings")
          .where("flutterwaveTxRef", "==", txRef)
          .limit(1)
          .get();
        if (!q.empty) bookingRef = q.docs[0].ref;
      }

      if (bookingRef) {
        if (flwStatus === "successful") {
          await bookingRef.update({
            paymentStatus:            "paid",
            bookingStatus:            "confirmed",
            flutterwaveTransactionId: txData?.id       ?? null,
            flutterwaveFlwRef:        txData?.flw_ref  ?? null,
            paymentCompletedAt:       new Date(),
            updatedAt:                new Date(),
          });
        } else if (flwStatus === "failed" || flwStatus === "cancelled") {
          await bookingRef.update({
            paymentStatus: "failed",
            updatedAt:     new Date(),
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