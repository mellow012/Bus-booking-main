// app/api/payments/paychangu/charge/route.ts
//
// Handles Airtel Money + TNM Mpamba payments via PayChangu hosted checkout.
//
// FLOW:
//   POST /api/payments/paychangu/charge
//   → PayChangu returns a checkout_url
//   → frontend redirects: window.location.href = checkoutUrl
//   → PayChangu redirects browser to /api/payments/paychangu/webhook?tx_ref=...&booking_id=...
//   → webhook GET handler forwards to /api/payments/paychangu/verify
//   → verify confirms with PayChangu API, updates Firestore, redirects to /bookings

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { decryptSecret } from "@/lib/Encrypt-secret";

const PaymentsService = require("paychangu");

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bookingId, customerDetails, metadata } = body;

    const customerEmail = customerDetails?.email as string | undefined;
    const customerName  = customerDetails?.name  as string | undefined;
    const subMethod     = metadata?.subMethod    as string | undefined;

    const missing: string[] = [];
    if (!bookingId)     missing.push("bookingId");
    if (!customerEmail) missing.push("customerDetails.email");
    if (!customerName)  missing.push("customerDetails.name");
    if (missing.length) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(", ")}` },
        { status: 400 },
      );
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

    // ── Fetch booking — amount & companyId from DB only ───────────────────────
    const bookingSnap = await adminDb.collection("bookings").doc(bookingId).get();
    if (!bookingSnap.exists) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    const booking   = bookingSnap.data()!;
    const companyId = booking.companyId   as string;
    const amount    = booking.totalAmount as number;
    if (!amount || !companyId) {
      return NextResponse.json({ error: "Booking is missing amount or company" }, { status: 400 });
    }

    // Block double-payment
    if (booking.paymentStatus === "paid") {
      return NextResponse.json({ error: "This booking has already been paid" }, { status: 409 });
    }

    // ── Fetch company PayChangu settings ──────────────────────────────────────
    const companySnap = await adminDb.collection("companies").doc(companyId).get();
    if (!companySnap.exists) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }
    const ps = companySnap.data()?.paymentSettings;

    if (!ps?.paychanguEnabled) {
      return NextResponse.json({ error: "PayChangu is not enabled for this company" }, { status: 400 });
    }
    if (!ps?.paychanguSecretKeyEnc) {
      return NextResponse.json({ error: "PayChangu secret key not configured" }, { status: 400 });
    }

    // ── Decrypt secret key ────────────────────────────────────────────────────
    let secretKey: string;
    try {
      secretKey = decryptSecret(ps.paychanguSecretKeyEnc);
    } catch (e: any) {
      console.error("[paychangu/charge] Decryption failed:", e.message);
      return NextResponse.json(
        { error: "Payment gateway configuration error — contact support" },
        { status: 500 },
      );
    }

    const paymentService = new PaymentsService({ apiKey: secretKey });

    const nameParts   = (customerName as string).trim().split(/\s+/);
    const firstName   = nameParts[0];
    const lastName    = nameParts.slice(1).join(" ") || firstName;
    const routeLabel  = metadata?.route
      ? (metadata.route as string).replace("-", " → ")
      : "Bus Ticket";
    const description = `${routeLabel} — Booking #${(bookingId as string).slice(-8)}`;

    const paymentResponse = await paymentService.initiatePayment({
      amount,
      email:       customerEmail,
      first_name:  firstName,
      last_name:   lastName,
      description,
      callbackUrl: `${appUrl}/api/payments/paychangu/webhook`,
      // booking_id passed through so verify can do a direct doc lookup
      // instead of relying on paychanguReference matching
      returnUrl:   `${appUrl}/api/payments/paychangu/webhook?booking_id=${bookingId}`,
    });

    // Log so we can see exactly what tx_ref PayChangu assigns
    console.log("[paychangu/charge] response data:", JSON.stringify(paymentResponse?.data ?? paymentResponse));

    // ── Persist payment state ─────────────────────────────────────────────────
    // Store both paychanguTxRef (PayChangu's UUID) and paychanguReference
    // so the verify route can find the booking either way.
    const paychanguTxRef = paymentResponse?.data?.tx_ref ?? null;

    await adminDb.collection("bookings").doc(bookingId).update({
      paymentStatus:      "pending",
      paymentProvider:    "paychangu",
      paychanguReference: paychanguTxRef ?? bookingId,
      paychanguTxRef:     paychanguTxRef,
      paychanguNetwork:   subMethod?.toUpperCase() ?? null,
      paymentInitiatedAt: new Date(),
      updatedAt:          new Date(),
    });

    // ── Extract checkout URL ──────────────────────────────────────────────────
    const checkoutUrl: string | null =
      paymentResponse?.data?.checkout_url ??
      paymentResponse?.data?.link         ??
      paymentResponse?.checkout_url       ??
      paymentResponse?.link               ??
      null;

    if (!checkoutUrl) {
      console.error("[paychangu/charge] No checkout URL in response:", paymentResponse);
      return NextResponse.json(
        { error: "PayChangu did not return a payment URL" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success:   true,
      checkoutUrl,
      reference: paychanguTxRef ?? bookingId,
    });

  } catch (err: any) {
    console.error("[paychangu/charge] Unhandled error:", err);
    return NextResponse.json(
      { error: err?.response?.data?.message ?? err?.message ?? "Internal server error" },
      { status: 500 },
    );
  }
}