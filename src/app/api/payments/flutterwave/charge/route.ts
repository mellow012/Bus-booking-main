// app/api/payments/flutterwave/charge/route.ts
//
// Flutterwave v3 Standard Checkout (redirect flow).
//
// HOW IT WORKS:
//   POST /api/payments/flutterwave/charge
//   → hits https://api.flutterwave.com/v3/payments with your SECRET key
//   → Flutterwave returns { data: { link: "https://checkout.flutterwave.com/..." } }
//   → we return { success: true, checkoutUrl: link } to the frontend
//   → frontend does: window.location.href = checkoutUrl
//   → after payment Flutterwave redirects to:
//       /bookings?payment_verify=true&provider=flutterwave&tx_ref=...&transaction_id=...&status=...
//
// WHY THE OLD CODE FAILED:
//   The previous version called /orchestration/direct-charges which is the v4
//   BETA API. That endpoint uses a completely different schema including a
//   `payment_method.type` enum — and 'mobile_money_malawi' is not a valid
//   value there (nor is it a stable API). v3 Standard Checkout doesn't use
//   payment_method at all; it accepts a plain `payment_options` string
//   ("mobilemoney", "card", etc.) and Flutterwave's hosted page handles the
//   rest. No OAuth / getFlwAccessToken() needed — just Bearer <secret_key>.
//
// REQUIRED ENV VARS:
//   FLW_SECRET_KEY        — FLWSECK_TEST-... or FLWSECK-...
//   NEXT_PUBLIC_APP_URL   — your app base URL (no trailing slash)

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

const FLW_V3_PAYMENTS = "https://api.flutterwave.com/v3/payments";

// Map our subMethodId → payment_options hint for the hosted checkout page.
// This just pre-selects the right tab; Flutterwave still shows all methods
// supported for MWK. Omitting it shows all options.
const SUB_METHOD_TO_PAYMENT_OPTIONS: Record<string, string> = {
  airtel: "mobilemoney",
  tnm:    "mobilemoney",
  card:   "card",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bookingId, customerDetails, metadata } = body;

    // ── Validate ─────────────────────────────────────────────────────────────
    const customerEmail = (customerDetails?.email as string | undefined)?.toLowerCase().trim();
    const customerName  = (customerDetails?.name  as string | undefined)?.trim();
    const customerPhone = (customerDetails?.phone as string | undefined)?.trim() ?? "";
    const subMethod     = (metadata?.subMethod    as string | undefined) ?? "";

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

    // ── Secret key ───────────────────────────────────────────────────────────
    const secretKey = process.env.FLW_SECRET_KEY;
    if (!secretKey) {
      console.error("[flutterwave/charge] FLW_SECRET_KEY env var is not set");
      return NextResponse.json(
        { error: "Payment gateway not configured — contact support" },
        { status: 500 },
      );
    }

    // ── Amount from Firestore only — never trust client ───────────────────────
    const bookingSnap = await adminDb.collection("bookings").doc(bookingId).get();
    if (!bookingSnap.exists) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    const booking = bookingSnap.data()!;
    const amount  = booking.totalAmount as number;
    if (!amount) {
      return NextResponse.json({ error: "Booking is missing amount" }, { status: 400 });
    }

    // ── tx_ref ────────────────────────────────────────────────────────────────
    // Embed bookingId so the webhook can resolve the booking without an extra
    // Firestore query (parse: txRef.split("_")[1]).
    const txRef = `bk_${bookingId}_${Date.now()}`;

    // ── Build the v3 Standard Checkout payload ────────────────────────────────
    // Docs: https://developer.flutterwave.com/reference/endpoints/payments/
    //
    //  currency "MWK"  → Flutterwave shows Malawi-compatible methods (Airtel, TNM)
    //  payment_options → pre-selects a tab on the hosted page (cosmetic hint only)
    //  redirect_url    → Flutterwave appends ?status=&tx_ref=&transaction_id= here
    //  customer.name   → single full-name string in v3 (not split first/last)
    const routeLabel  = metadata?.route
      ? (metadata.route as string).replace("-", " → ")
      : "Bus Ticket";
    const description = `${routeLabel} — Booking #${(bookingId as string).slice(-8)}`;

    const payload = {
      tx_ref:          txRef,
      amount:          Number(amount),
      currency:        "MWK",
      payment_options: SUB_METHOD_TO_PAYMENT_OPTIONS[subMethod] ?? "mobilemoney,card",
      redirect_url:    `${process.env.NEXT_PUBLIC_APP_URL}/bookings?payment_verify=true&provider=flutterwave`,
      customer: {
        email:       customerEmail,
        name:        customerName,
        phonenumber: customerPhone,
      },
      customizations: {
        title:       "TibhukeBus",
        description,
        // Replace with your actual hosted logo URL, or remove this key entirely.
        logo:        `${process.env.NEXT_PUBLIC_APP_URL}/logo.png`,
      },
      meta: {
        booking_id:      bookingId,
        route:           metadata?.route           ?? "",
        departure:       metadata?.departure        ?? "",
        passenger_count: metadata?.passengerCount   ?? "1",
        seat_numbers:    metadata?.seatNumbers      ?? "",
        sub_method:      subMethod,
      },
    };

    // ── Call Flutterwave ──────────────────────────────────────────────────────
    const flwRes = await fetch(FLW_V3_PAYMENTS, {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await flwRes.json();

    if (!flwRes.ok || result.status !== "success") {
      console.error("[flutterwave/charge] FLW error:", JSON.stringify(result, null, 2));
      return NextResponse.json(
        { error: result.message || "Flutterwave returned an error" },
        { status: 400 },
      );
    }

    const checkoutUrl: string | undefined = result?.data?.link;
    if (!checkoutUrl) {
      console.error("[flutterwave/charge] No checkout link in response:", result);
      return NextResponse.json(
        { error: "Flutterwave did not return a payment URL" },
        { status: 502 },
      );
    }

    // ── Persist tx_ref ────────────────────────────────────────────────────────
    await bookingSnap.ref.update({
      flutterwaveTxRef:   txRef,
      paymentStatus:      "pending",
      paymentProvider:    "flutterwave",
      paymentInitiatedAt: new Date(),
      updatedAt:          new Date(),
    });

    return NextResponse.json({ success: true, checkoutUrl, txRef });

  } catch (err: any) {
    console.error("[flutterwave/charge] Unhandled error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal server error" },
      { status: 500 },
    );
  }
}