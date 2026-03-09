// app/api/payments/flutterwave/refund/route.ts
//
// Initiates a full or partial refund via Flutterwave.
// Only callable by company_admin or super_admin — verified via Firebase ID token.
//
// Requires:
//   booking.flutterwaveFlwRef   — the Flutterwave transaction reference
//   booking.flutterwaveTransactionId — the numeric transaction ID
//
// Partial refunds: pass `amount` in the request body. Omit for full refund.

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";
import { decryptSecret } from "@/lib/Encrypt-secret";

// Sandbox: https://developersandbox-api.flutterwave.com
// Production: https://api.flutterwave.com/v3
const FLW_API = process.env.FLW_ENV === "production"
  ? "https://api.flutterwave.com/v3"
  : "https://developersandbox-api.flutterwave.com";

export async function POST(req: NextRequest) {
  try {
    // ── Authenticate & authorise ────────────────────────────────────────────
    const authHeader = req.headers.get("authorization") ?? "";
    const idToken    = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken)
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(idToken);
    const callerSnap = await adminDb.collection("users").doc(decoded.uid).get();
    const callerRole = callerSnap.data()?.role as string | undefined;

    if (callerRole !== "company_admin" && callerRole !== "super_admin")
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });

    // ── Parse request ────────────────────────────────────────────────────────
    const body = await req.json();
    const { bookingId, amount: partialAmount } = body;

    if (!bookingId)
      return NextResponse.json({ error: "bookingId is required" }, { status: 400 });

    // ── Fetch booking ────────────────────────────────────────────────────────
    const bookingSnap = await adminDb.collection("bookings").doc(bookingId).get();
    if (!bookingSnap.exists)
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });

    const booking   = bookingSnap.data()!;
    const companyId = booking.companyId as string;

    if (booking.paymentStatus !== "paid")
      return NextResponse.json({ error: "Only paid bookings can be refunded" }, { status: 400 });

    if (booking.paymentProvider !== "flutterwave")
      return NextResponse.json({ error: "This booking was not paid via Flutterwave" }, { status: 400 });

    const flwTransactionId = booking.flutterwaveTransactionId as number | undefined;
    if (!flwTransactionId)
      return NextResponse.json(
        { error: "Flutterwave transaction ID not found on booking — cannot refund" },
        { status: 400 },
      );

    // Prevent duplicate refund attempts
    if (booking.refundStatus === "refunded" || booking.refundStatus === "pending")
      return NextResponse.json({ error: `Refund already ${booking.refundStatus}` }, { status: 409 });

    // ── Resolve secret key ───────────────────────────────────────────────────
    let secretKey = process.env.FLW_SECRET_KEY ?? "";
    try {
      const companySnap = await adminDb.collection("companies").doc(companyId).get();
      const ps = companySnap.data()?.paymentSettings;
      if (ps?.flutterwaveEnabled && ps?.flutterwaveSecretKeyEnc)
        secretKey = decryptSecret(ps.flutterwaveSecretKeyEnc);
    } catch { /* fall back to env key */ }

    if (!secretKey)
      return NextResponse.json({ error: "Payment gateway not configured" }, { status: 500 });

    // Mark as pending before calling Flutterwave (prevents duplicate requests)
    await bookingSnap.ref.update({
      refundStatus:      "pending",
      refundInitiatedAt: new Date(),
      refundInitiatedBy: decoded.uid,
      updatedAt:         new Date(),
    });

    // ── Call Flutterwave refund API ──────────────────────────────────────────
    const refundBody: Record<string, unknown> = {};
    if (partialAmount) refundBody.amount = partialAmount;

    const flwRes = await fetch(`${FLW_API}/transactions/${flwTransactionId}/refund`, {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(refundBody),
    });

    const flwData = await flwRes.json();

    if (!flwRes.ok || flwData.status !== "success") {
      console.error("[flw/refund] Flutterwave API error:", flwData);
      // Revert the pending mark
      await bookingSnap.ref.update({ refundStatus: "failed", updatedAt: new Date() });
      return NextResponse.json(
        { error: flwData.message ?? "Refund request failed" },
        { status: 502 },
      );
    }

    const refundData = flwData.data;

    // ── Update booking ────────────────────────────────────────────────────────
    await bookingSnap.ref.update({
      paymentStatus:     "refunded",
      bookingStatus:     "cancelled",
      refundStatus:      "refunded",
      refundAmount:      refundData?.amount_refunded ?? partialAmount ?? booking.totalAmount,
      refundedAt:        new Date(),
      flwRefundId:       refundData?.id ?? null,
      updatedAt:         new Date(),
    });

    console.log(`[flw/refund] Booking ${bookingId} refunded by ${decoded.uid}`);
    return NextResponse.json({
      success:      true,
      refundAmount: refundData?.amount_refunded,
      flwRefundId:  refundData?.id,
    });

  } catch (err: any) {
    console.error("[flw/refund] Unhandled error:", err);
    return NextResponse.json({ error: err.message ?? "Internal server error" }, { status: 500 });
  }
}