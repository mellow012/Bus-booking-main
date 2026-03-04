// app/api/paychangu/webhook/route.ts
//
// PayChangu calls this URL after a payment completes (success or failure).
// We verify the payload and update the booking in Firestore.
//
// Required env vars:
//   PAYCHANGU_SECRET_KEY  — used to verify the webhook signature

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const data    = JSON.parse(rawBody);

    // ── Verify the webhook signature ──────────────────────────────────────────
    // PayChangu signs the payload with your secret key using HMAC-SHA256.
    // Always verify — never trust an unverified webhook.
    const signature        = req.headers.get("x-paychangu-signature") || "";
    const secretKey        = process.env.PAYCHANGU_SECRET_KEY!;
    const expectedSig      = crypto
      .createHmac("sha256", secretKey)
      .update(rawBody)
      .digest("hex");

    if (signature !== expectedSig) {
      console.warn("[paychangu/webhook] Invalid signature — ignoring");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // ── Parse the event ───────────────────────────────────────────────────────
    const { tx_ref, status, reference } = data;

    if (!tx_ref) {
      return NextResponse.json({ error: "Missing tx_ref" }, { status: 400 });
    }

    const bookingRef  = adminDb.collection("bookings").doc(tx_ref);
    const bookingSnap = await bookingRef.get();

    if (!bookingSnap.exists) {
      // Not our booking — acknowledge to stop PayChangu retrying
      return NextResponse.json({ received: true });
    }

    // ── Map PayChangu status → our status ─────────────────────────────────────
    let paymentStatus: string;
    let bookingStatus: string;

    switch (status?.toLowerCase()) {
      case "successful":
      case "success":
        paymentStatus = "paid";
        bookingStatus = "confirmed";
        break;
      case "failed":
      case "cancelled":
        paymentStatus = "failed";
        bookingStatus = "payment_failed";
        break;
      default:
        paymentStatus = "pending";
        bookingStatus = bookingSnap.data()?.bookingStatus || "pending";
    }

    await bookingRef.update({
      paymentStatus,
      bookingStatus,
      paychanguReference: reference || bookingSnap.data()?.paychanguReference,
      paymentUpdatedAt:   new Date(),
    });

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("[paychangu/webhook]", err);
    // Return 200 to prevent PayChangu from retrying on our processing errors
    return NextResponse.json({ received: true, warning: err.message });
  }
}