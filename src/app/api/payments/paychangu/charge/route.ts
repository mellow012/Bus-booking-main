// app/api/payments/paychangu/charge/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { paymentRateLimiter, getClientIp } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const { success, reset } = await paymentRateLimiter.limit(ip);
    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000);
      return NextResponse.json(
        { error: "Too many payment requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfter > 0 ? retryAfter : 60) } }
      );
    }
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

    // ── Fetch booking from PostgreSQL ──────────────────────────────────────────
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { company: true, schedule: true },
    });
    
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    
    const companyId = booking.companyId || booking.schedule?.companyId || booking.company?.id;
    const rawAmount = booking.totalAmount;
    const amount    = typeof rawAmount === "number" ? rawAmount : Number(rawAmount ?? 0);

    if (!companyId) {
      return NextResponse.json({ error: "Booking is missing associated bus company information" }, { status: 400 });
    }

    if (isNaN(amount) || amount < 0) {
      return NextResponse.json({ error: "Booking total amount is invalid" }, { status: 400 });
    }

    if (amount > 0 && amount <= 50) {
      return NextResponse.json(
        { error: "PayChangu requires a minimum payment amount greater than MWK 50." },
        { status: 400 }
      );
    }

    if (booking.paymentStatus === "paid") {
      return NextResponse.json({ error: "This booking has already been paid" }, { status: 409 });
    }

    if (amount === 0) {
      // Zero-cost booking (100% promo discount or free ticket) — auto-confirm ticket
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          paymentStatus: "paid",
          bookingStatus: "confirmed",
          paidAt: new Date(),
          updatedAt: new Date(),
        },
      });
      return NextResponse.json({
        success: true,
        isFree: true,
        message: "Booking confirmed (No payment required)",
      });
    }

    const secretKey = process.env.PAYCHANGU_SECRET_KEY;
    if (!secretKey) {
      console.error("[paychangu/charge] PAYCHANGU_SECRET_KEY not set");
      return NextResponse.json(
        { error: "Payment gateway is not configured. Contact support." },
        { status: 500 },
      );
    }

    const nameParts   = (customerName as string).trim().split(/\s+/);
    const firstName   = nameParts[0];
    const lastName    = nameParts.slice(1).join(" ") || firstName;
    const description = `Bus Ticket Booking ${(bookingId as string).slice(-8)}`;
    const customTxRef = `pc_${bookingId}_${Date.now()}`;

    const paymentPayload = {
      amount,
      currency:     "MWK",
      email:        customerEmail,
      first_name:   firstName,
      last_name:    lastName,
      description,
      tx_ref:       customTxRef,
      callback_url: `${appUrl}/api/payments/paychangu/webhook`,
      return_url:   `${appUrl}/api/payments/paychangu/return?tx_ref=${customTxRef}`,
    };

    // ── Direct fetch ───────────────────────────────────────────────────────────
    const apiRes = await fetch("https://api.paychangu.com/payment", {
      method: "POST",
      headers: {
        "Accept":        "application/json",
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${secretKey}`,
      },
      body: JSON.stringify(paymentPayload),
    });

    const rawText = await apiRes.text();
    let paymentResponse: Record<string, any>;
    try { paymentResponse = JSON.parse(rawText); }
    catch { paymentResponse = { raw: rawText }; }

    if (!apiRes.ok) {
      console.error("[paychangu/charge] API error:", apiRes.status, rawText);
      return NextResponse.json(
        { error: paymentResponse?.message ?? `PayChangu error ${apiRes.status}` },
        { status: 502 },
      );
    }

    // ── Persist payment state to PostgreSQL ────────────────────────────────────
    const paychanguTxRef =
      paymentResponse?.data?.tx_ref ??
      paymentResponse?.tx_ref       ??
      customTxRef;

    try {
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          paymentStatus: "pending",
          updatedAt: new Date(),
        },
      });
      
      // Create payment record
      await prisma.payment.create({
        data: {
          paymentId: paychanguTxRef,
          bookingId: bookingId,
          amount: amount,
          currency: "MWK",
          customerEmail: customerEmail,
          customerPhone: booking.contactPhone,
          status: "initiated",
          provider: "paychangu",
          txRef: paychanguTxRef,
          metadata: {
            customTxRef: customTxRef,
            subMethod: subMethod ?? null,
            fullResponse: paymentResponse,
          },
        },
      });
    } catch (dbErr: any) {
      console.error("[paychangu/charge] Database update failed:", dbErr.message);
    }

    // ── Extract checkout URL ───────────────────────────────────────────────────
    const checkoutUrl: string | null =
      paymentResponse?.data?.checkout_url ??
      paymentResponse?.data?.link         ??
      paymentResponse?.checkout_url       ??
      paymentResponse?.link               ??
      null;

    if (!checkoutUrl) {
      console.error("[paychangu/charge] No checkout URL in response:", rawText);
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
    console.error("[paychangu/charge] Unhandled error:", err?.message ?? err);
    return NextResponse.json(
      { error: err?.message ?? "Internal server error" },
      { status: 500 },
    );
  }
}
