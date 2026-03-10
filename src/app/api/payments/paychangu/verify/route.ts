// app/api/payments/paychangu/verify/route.ts

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

const PAYCHANGU_API = "https://api.paychangu.com";
const SUCCESSFUL_STATUSES = ["success", "successful", "completed"];

export async function GET(req: NextRequest) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const { searchParams } = new URL(req.url);
  const txRef  = searchParams.get("tx_ref");
  const status = searchParams.get("status");

  if (!txRef) {
    return NextResponse.redirect(`${appUrl}/bookings?error=payment_failed`);
  }

  if (status && !SUCCESSFUL_STATUSES.includes(status.toLowerCase())) {
    return NextResponse.redirect(`${appUrl}/bookings?error=payment_failed&tx_ref=${txRef}`);
  }

  try {
    // ── Look up booking ───────────────────────────────────────────────────────
    // Strategy 1: tx_ref is our custom format pc_{bookingId}_{timestamp}
    // Strategy 2: direct field query on paychanguTxRef / paychanguReference / customTxRef
    // Strategy 3: scan recent pending PayChangu bookings (last resort)

    let bookingDoc: FirebaseFirestore.DocumentSnapshot | FirebaseFirestore.QueryDocumentSnapshot | null = null;

    // Strategy 1 — extract bookingId from custom tx_ref
    if (txRef.startsWith("pc_")) {
      const parts = txRef.split("_");
      const bookingId = parts[1];
      console.log("[paychangu/verify] Extracted bookingId from tx_ref:", bookingId);
      if (bookingId) {
        const snap = await adminDb.collection("bookings").doc(bookingId).get();
        if (snap.exists) bookingDoc = snap;
      }
    }

    // Strategy 2 — field query
    if (!bookingDoc) {
      for (const field of ["paychanguTxRef", "paychanguReference", "customTxRef"]) {
        const snap = await adminDb
          .collection("bookings")
          .where(field, "==", txRef)
          .limit(1)
          .get();
        if (!snap.empty) { bookingDoc = snap.docs[0]; break; }
      }
    }

    // Strategy 3 — scan recent pending (handles old charge route with no tx_ref stored)
    if (!bookingDoc) {
      console.warn("[paychangu/verify] Field queries failed — scanning recent pending bookings");
      const recentSnap = await adminDb
        .collection("bookings")
        .where("paymentProvider", "==", "paychangu")
        .where("paymentStatus",   "==", "pending")
        .orderBy("paymentInitiatedAt", "desc")
        .limit(10)
        .get();

      for (const doc of recentSnap.docs) {
        const ref = doc.data()?.paychanguReference ?? doc.data()?.paychanguTxRef;
        if (ref === txRef) { bookingDoc = doc; break; }
        if (!ref && !bookingDoc) bookingDoc = doc; // tentative — confirmed by verify below
      }
    }

    if (!bookingDoc?.exists) {
      console.error("[paychangu/verify] No booking found for tx_ref:", txRef);
      return NextResponse.redirect(`${appUrl}/bookings?error=booking_not_found`);
    }

    const booking = bookingDoc.data()!;

    // ── Idempotency ───────────────────────────────────────────────────────────
    if (booking.paymentStatus === "paid") {
      return NextResponse.redirect(
        `${appUrl}/bookings?payment_verify=true&provider=paychangu&tx_ref=${txRef}&status=success`
      );
    }

    // ── Server-side verification ──────────────────────────────────────────────
    const verifyRes = await fetch(`${PAYCHANGU_API}/verify-payment/${txRef}`, {
      method:  "GET",
      headers: {
        Accept:        "application/json",
        Authorization: `Bearer ${process.env.PAYCHANGU_SECRET_KEY}`,
      },
    });

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
      console.error("[paychangu/verify] Non-JSON response:", rawText.slice(0, 500));
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

    // ── Mark paid ─────────────────────────────────────────────────────────────
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