// app/api/payments/paychangu/charge/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto.server";

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

    // ── Fetch booking from PostgreSQL ──────────────────────────────────────────
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { company: true },
    });
    
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    
    const companyId = booking.companyId;
    const amount    = Number(booking.totalAmount);

    if (!amount || !companyId) {
      return NextResponse.json({ error: "Booking is missing amount or company" }, { status: 400 });
    }
    if (booking.paymentStatus === "paid") {
      return NextResponse.json({ error: "This booking has already been paid" }, { status: 409 });
    }

    // ── Get company PayChangu settings from Prisma ──────────────────────────────
    const company = booking.company;
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }
    
    const ps = company.paymentSettings as Record<string, any>;

    if (!ps?.paychanguEnabled) {
      return NextResponse.json({ error: "PayChangu is not enabled for this company" }, { status: 400 });
    }
    if (!ps?.paychanguSecretKeyEnc) {
      return NextResponse.json({ error: "PayChangu secret key not configured" }, { status: 400 });
    }

    if (!ps?.paychanguEnabled) {
      return NextResponse.json({ error: "PayChangu is not enabled for this company" }, { status: 400 });
    }
    if (!ps?.paychanguSecretKeyEnc) {
      return NextResponse.json({ error: "PayChangu secret key not configured" }, { status: 400 });
    }

    // ── Decrypt secret key ────────────────────────────────────────────────────
    let secretKey: string;
    try {
      secretKey = await decryptSecret(ps.paychanguSecretKeyEnc);
    } catch (e: any) {
      console.error("[paychangu/charge] Decryption failed:", e.message);
      return NextResponse.json(
        { error: "Payment gateway configuration error — contact support" },
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
      return_url:   `${appUrl}/api/payments/paychangu/verify/${bookingId}`,
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
