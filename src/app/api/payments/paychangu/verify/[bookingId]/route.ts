// app/api/payments/paychangu/verify/[bookingId]/route.ts
//
// PayChangu redirects here after payment: GET /api/payments/paychangu/verify/{bookingId}?tx_ref=...&status=...
// bookingId is in the path so PayChangu can't strip it.

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

const PAYCHANGU_API     = "https://api.paychangu.com";
const SUCCESS_STATUSES  = ["success", "successful", "completed"];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const appUrl    = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const { bookingId } = await params;
  const { searchParams } = new URL(req.url);
  const txRef  = searchParams.get("tx_ref");
  const status = searchParams.get("status");

  console.log("[paychangu/verify] bookingId:", bookingId, "tx_ref:", txRef, "status:", status);

  if (!bookingId) {
    return NextResponse.redirect(`${appUrl}/bookings?error=payment_failed`);
  }

  if (status && !SUCCESS_STATUSES.includes(status.toLowerCase())) {
    return NextResponse.redirect(`${appUrl}/bookings?error=payment_failed`);
  }

  try {
    // ── Direct doc lookup — bookingId is always in the path ──────────────────
    const bookingRef  = adminDb.collection("bookings").doc(bookingId);
    const bookingSnap = await bookingRef.get();

    if (!bookingSnap.exists) {
      console.error("[paychangu/verify] Booking not found:", bookingId);
      return NextResponse.redirect(`${appUrl}/bookings?error=booking_not_found`);
    }

    const booking = bookingSnap.data()!;

    // ── Idempotency ───────────────────────────────────────────────────────────
    if (booking.paymentStatus === "paid") {
      return NextResponse.redirect(
        `${appUrl}/bookings?payment_verify=true&provider=paychangu&status=success`
      );
    }

    // ── Server-side verification ──────────────────────────────────────────────
    // Use the tx_ref PayChangu gave us (their UUID) to verify with their API.
    const refToVerify = txRef ?? booking.paychanguReference;
    if (!refToVerify) {
      console.error("[paychangu/verify] No tx_ref to verify with");
      return NextResponse.redirect(`${appUrl}/bookings?error=verification_failed`);
    }

    const verifyRes = await fetch(`${PAYCHANGU_API}/verify-payment/${refToVerify}`, {
      method:  "GET",
      headers: {
        Accept:        "application/json",
        Authorization: `Bearer ${process.env.PAYCHANGU_SECRET_KEY}`,
      },
    });

    const rawText = await verifyRes.text();
    console.log("[paychangu/verify] PayChangu response:", verifyRes.status, rawText.slice(0, 300));

    if (!verifyRes.ok) {
      console.error("[paychangu/verify] HTTP error:", verifyRes.status);
      return NextResponse.redirect(`${appUrl}/bookings?error=verification_failed`);
    }

    let result: any;
    try {
      result = JSON.parse(rawText);
    } catch {
      console.error("[paychangu/verify] Non-JSON response:", rawText.slice(0, 500));
      return NextResponse.redirect(`${appUrl}/bookings?error=verification_failed`);
    }

    const verified =
      result.status === "success" &&
      SUCCESS_STATUSES.includes((result.data?.status ?? "").toLowerCase());

    if (!verified) {
      console.warn("[paychangu/verify] Not verified:", result);
      await bookingRef.update({
        paymentStatus: "failed",
        bookingStatus: "payment_failed",
        updatedAt:     new Date(),
      });
      return NextResponse.redirect(`${appUrl}/bookings?error=verification_failed`);
    }

    // ── Mark paid ─────────────────────────────────────────────────────────────
    await bookingRef.update({
      paymentStatus:      "paid",
      bookingStatus:      "confirmed",
      paychanguReference: refToVerify,
      paychanguTxRef:     refToVerify,
      paymentCompletedAt: new Date(),
      updatedAt:          new Date(),
    });

    return NextResponse.redirect(
      `${appUrl}/bookings?payment_verify=true&provider=paychangu&status=success`
    );

  } catch (error: any) {
    console.error("[paychangu/verify] Unhandled error:", error);
    return NextResponse.redirect(`${appUrl}/bookings?error=server_error`);
  }
}