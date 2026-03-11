// app/api/payments/paychangu/charge/route.ts
//
// Handles Airtel Money + TNM Mpamba payments via PayChangu hosted checkout.
//
// FLOW:
//   POST /api/payments/paychangu/charge
//   → PayChangu returns a checkout_url
//   → frontend redirects: window.location.href = checkoutUrl
//   → PayChangu redirects browser to /api/payments/paychangu/webhook?tx_ref=pc_{bookingId}_{ts}
//   → webhook GET handler forwards to /api/payments/paychangu/verify
//   → verify extracts bookingId from tx_ref, confirms with PayChangu, updates Firestore

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

    // ── Custom tx_ref with embedded bookingId ─────────────────────────────────
    // PayChangu strips query params from returnUrl, so we can't rely on
    // ?booking_id= surviving the redirect. Instead we embed the bookingId
    // in the tx_ref itself: pc_{bookingId}_{timestamp}
    // PayChangu always echoes tx_ref back in the redirect, so verify can
    // split it to extract bookingId — no query params or field queries needed.
    const customTxRef = `pc_${bookingId}_${Date.now()}`;

    const paymentResponse = await paymentService.initiatePayment({
      amount,
      email:       customerEmail,
      first_name:  firstName,
      last_name:   lastName,
      description,
      // Note: tx_ref not passed — PayChangu SDK doesn't support custom tx_ref
      // bookingId is embedded in the returnUrl path instead
      callbackUrl: `${appUrl}/api/payments/paychangu/webhook`,
      returnUrl:   `${appUrl}/api/payments/paychangu/verify/${bookingId}`,
    });

    // Log full response so we can see what PayChangu sends back
    console.log("[paychangu/charge] response data:", JSON.stringify(paymentResponse?.data ?? paymentResponse));

    // ── Persist payment state ─────────────────────────────────────────────────
    // The SDK wraps the response in a .data layer — the logged response IS
    // paymentResponse.data, so PayChangu's UUID is at .data.data.tx_ref.
    const paychanguTxRef =
      paymentResponse?.data?.data?.tx_ref ??  // SDK-wrapped: {data: {data: {tx_ref}}}
      paymentResponse?.data?.tx_ref       ??  // Direct: {data: {tx_ref}}
      paymentResponse?.tx_ref             ??  // Flat
      customTxRef;
    console.log("[paychangu/charge] storing paychanguTxRef:", paychanguTxRef, "for bookingId:", bookingId);

    try {
      await adminDb.collection("bookings").doc(bookingId).update({
        paymentStatus:      "pending",
        paymentProvider:    "paychangu",
        paychanguReference: paychanguTxRef,
        paychanguTxRef:     paychanguTxRef,
        customTxRef:        customTxRef,
        paychanguNetwork:   subMethod?.toUpperCase() ?? null,
        paymentInitiatedAt: new Date(),
        updatedAt:          new Date(),
      });
      console.log("[paychangu/charge] Firestore update SUCCESS for bookingId:", bookingId);
    } catch (fsErr: any) {
      console.error("[paychangu/charge] Firestore update FAILED:", fsErr.message);
    }

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
      success:     true,
      checkoutUrl,
      reference:   paychanguTxRef,
      customTxRef,
    });

  } catch (err: any) {
    console.error("[paychangu/charge] Unhandled error:", err);
    return NextResponse.json(
      { error: err?.response?.data?.message ?? err?.message ?? "Internal server error" },
      { status: 500 },
    );
  }
}