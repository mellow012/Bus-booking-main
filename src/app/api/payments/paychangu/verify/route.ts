// app/api/payments/paychangu/verify/route.ts
//
// Called after PayChangu redirects the user's browser back to the app.
// PayChangu GETs this URL with ?tx_ref=...&status=...
//
// FLOW:
//   1. Quick-fail on bad status param
//   2. Look up booking by paychanguReference field (tx_ref is PayChangu's ref)
//   3. Idempotency: skip if already paid
//   4. Server-side verify with PayChangu API
//   5. Update Firestore
//   6. Redirect browser to /bookings with result params

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

const PAYCHANGU_API = "https://api.paychangu.com";

export async function GET(req: NextRequest) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

  const { searchParams } = new URL(req.url);
  const txRef  = searchParams.get("tx_ref");
  const status = searchParams.get("status");

  // ── Quick-fail on missing ref or obviously bad status ─────────────────────
  if (!txRef) {
    return NextResponse.redirect(`${appUrl}/bookings?error=payment_failed`);
  }

  const SUCCESSFUL_STATUSES = ["success", "successful", "completed"];
  if (status && !SUCCESSFUL_STATUSES.includes(status.toLowerCase())) {
    return NextResponse.redirect(
      `${appUrl}/bookings?error=payment_failed&tx_ref=${txRef}`
    );
  }

  try {
    // ── Look up booking by PayChangu's tx_ref ─────────────────────────────
    // We stored their reference as paychanguReference in the charge route.
    const querySnap = await adminDb
      .collection("bookings")
      .where("paychanguReference", "==", txRef)
      .limit(1)
      .get();

    if (querySnap.empty) {
      console.error("[paychangu/verify] No booking found for tx_ref:", txRef);
      return NextResponse.redirect(`${appUrl}/bookings?error=booking_not_found`);
    }

    const bookingDoc = querySnap.docs[0];
    const booking    = bookingDoc.data();

    // ── Idempotency: already paid, just redirect ──────────────────────────
    if (booking.paymentStatus === "paid") {
      return NextResponse.redirect(
        `${appUrl}/bookings?payment_verify=true&provider=paychangu&tx_ref=${txRef}&status=success`
      );
    }

    // ── Server-side verification ──────────────────────────────────────────
    // Never trust the status param alone — always verify with PayChangu.
    const verifyRes = await fetch(`${PAYCHANGU_API}/verify-payment/${txRef}`, {
      method:  "GET",
      headers: {
        Accept:        "application/json",
        Authorization: `Bearer ${process.env.PAYCHANGU_SECRET_KEY}`,
      },
    });

    // Read raw text first so a non-JSON response (HTML error page) doesn't
    // crash the route — log it so we can see exactly what PayChangu returned.
    const rawText = await verifyRes.text();
    console.log("[paychangu/verify] raw response:", verifyRes.status, rawText.slice(0, 300));

    if (!verifyRes.ok) {
      console.error("[paychangu/verify] HTTP error:", verifyRes.status);
      return NextResponse.redirect(`${appUrl}/bookings?error=verification_failed&tx_ref=${txRef}`);
    }

    let result: any;
    try {
      result = JSON.parse(rawText);
    } catch {
      console.error("[paychangu/verify] Non-JSON response from PayChangu:", rawText.slice(0, 500));
      return NextResponse.redirect(`${appUrl}/bookings?error=verification_failed&tx_ref=${txRef}`);
    }
    const verified =
      result.status === "success" &&
      SUCCESSFUL_STATUSES.includes((result.data?.status ?? "").toLowerCase());

    if (!verified) {
      console.warn("[paychangu/verify] Verification failed:", result);
      await bookingDoc.ref.update({
        paymentStatus: "failed",
        bookingStatus: "payment_failed",
        updatedAt:     new Date(),
      });
      return NextResponse.redirect(`${appUrl}/bookings?error=verification_failed&tx_ref=${txRef}`);
    }

    // ── Mark paid ─────────────────────────────────────────────────────────
    await bookingDoc.ref.update({
      paymentStatus:      "paid",
      bookingStatus:      "confirmed",
      paychanguReference: txRef,
      paymentCompletedAt: new Date(),
      updatedAt:          new Date(),
    });

    return NextResponse.redirect(
      `${appUrl}/bookings?payment_verify=true&provider=paychangu&tx_ref=${txRef}&status=success`
    );

  } catch (error: any) {
    console.error("[paychangu/verify] Unhandled error:", error);
    return NextResponse.redirect(`${appUrl}/bookings?error=server_error`);
  }
}