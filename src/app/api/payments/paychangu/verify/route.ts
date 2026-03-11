// app/api/payments/paychangu/verify/route.ts
//
// PayChangu always redirects here after payment with ?tx_ref=<their UUID>
// regardless of what returnUrl we pass — the SDK overrides it.
//
// We find the booking by querying paychanguTxRef field (their UUID stored
// at charge time from paymentResponse?.data?.tx_ref).

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

const PAYCHANGU_API    = "https://api.paychangu.com";
const SUCCESS_STATUSES = ["success", "successful", "completed"];

export async function GET(req: NextRequest) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const { searchParams } = new URL(req.url);
  const txRef  = searchParams.get("tx_ref");
  const status = searchParams.get("status");

  console.log("[paychangu/verify] tx_ref:", txRef, "status:", status);

  if (!txRef) {
    return NextResponse.redirect(`${appUrl}/bookings?error=payment_failed`);
  }

  if (status && !SUCCESS_STATUSES.includes(status.toLowerCase())) {
    return NextResponse.redirect(`${appUrl}/bookings?error=payment_failed`);
  }

  try {
    // ── Find booking by PayChangu's UUID ──────────────────────────────────────
    let bookingRef: FirebaseFirestore.DocumentReference | null = null;

    // 1. Our custom pc_ format (if SDK ever respects tx_ref)
    if (txRef.startsWith("pc_")) {
      const bookingId = txRef.split("_")[1];
      if (bookingId) {
        const snap = await adminDb.collection("bookings").doc(bookingId).get();
        if (snap.exists) bookingRef = snap.ref;
      }
    }

    // 2. Query by stored reference fields (PayChangu UUID stored at charge time)
    if (!bookingRef) {
      for (const field of ["paychanguTxRef", "paychanguReference", "customTxRef"]) {
        const snap = await adminDb
          .collection("bookings")
          .where(field, "==", txRef)
          .limit(1)
          .get();
        if (!snap.empty) { bookingRef = snap.docs[0].ref; break; }
      }
    }

    if (!bookingRef) {
      console.error("[paychangu/verify] No booking found for tx_ref:", txRef);
      // Last resort — show the user their bookings page so they're not stranded
      return NextResponse.redirect(`${appUrl}/bookings?error=booking_not_found`);
    }

    const bookingSnap = await bookingRef.get();
    const booking     = bookingSnap.data()!;

    // Idempotency
    if (booking.paymentStatus === "paid") {
      return NextResponse.redirect(
        `${appUrl}/bookings?payment_verify=true&provider=paychangu&status=success`
      );
    }

    // ── Server-side verify ────────────────────────────────────────────────────
    const verifyRes = await fetch(`${PAYCHANGU_API}/verify-payment/${txRef}`, {
      method:  "GET",
      headers: {
        Accept:        "application/json",
        Authorization: `Bearer ${process.env.PAYCHANGU_SECRET_KEY}`,
      },
    });

    const rawText = await verifyRes.text();
    console.log("[paychangu/verify] PayChangu response:", verifyRes.status, rawText.slice(0, 300));

    if (!verifyRes.ok) {
      return NextResponse.redirect(`${appUrl}/bookings?error=verification_failed`);
    }

    let result: any;
    try { result = JSON.parse(rawText); }
    catch {
      console.error("[paychangu/verify] Non-JSON response:", rawText.slice(0, 300));
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
      paychanguReference: txRef,
      paychanguTxRef:     txRef,
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