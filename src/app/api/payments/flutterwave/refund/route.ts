// app/api/payments/flutterwave/refund/route.ts
//
// Initiates a full or partial refund via Flutterwave.
// Only callable by company_admin or super_admin — verified via Supabase session.
//
// Partial refunds: pass `amount` in the request body. Omit for full refund.

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto.server";

// Sandbox: https://developersandbox-api.flutterwave.com
// Production: https://api.flutterwave.com/v3
const FLW_API = process.env.FLW_ENV === "production"
  ? "https://api.flutterwave.com/v3"
  : "https://developersandbox-api.flutterwave.com";

export async function POST(req: NextRequest) {
  try {
    // ── Authenticate & authorise ────────────────────────────────────────────
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    if (user.role !== "company_admin" && user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
    }

    // ── Parse request ────────────────────────────────────────────────────────
    const body = await req.json();
    const { bookingId, amount: partialAmount } = body;

    if (!bookingId) {
      return NextResponse.json({ error: "bookingId is required" }, { status: 400 });
    }

    // ── Fetch booking with associated payment ───────────────────────────────
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        payments: {
          where: { provider: 'flutterwave', status: 'completed' },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.paymentStatus !== "paid") {
      return NextResponse.json({ error: "Only paid bookings can be refunded" }, { status: 400 });
    }

    const payment = booking.payments[0];
    if (!payment) {
      return NextResponse.json({ error: "This booking was not paid via Flutterwave or payment record not found" }, { status: 400 });
    }

    const metadata = payment.metadata as any;
    const flwTransactionId = metadata?.flutterwaveTransactionId;

    if (!flwTransactionId) {
      return NextResponse.json(
        { error: "Flutterwave transaction ID not found on booking — cannot refund" },
        { status: 400 },
      );
    }

    // Prevent duplicate refund attempts (using custom metadata in Booking if needed, or checking status)
    // For now, checking paymentStatus === refunded is handled above.

    // ── Resolve secret key ───────────────────────────────────────────────────
    let secretKey = process.env.FLW_SECRET_KEY ?? "";
    try {
      const company = await prisma.company.findUnique({
        where: { id: booking.companyId },
        select: { paymentSettings: true }
      });
      const ps = company?.paymentSettings as any;
      if (ps?.flutterwaveEnabled && ps?.flutterwaveSecretKeyEnc) {
        secretKey = await decryptSecret(ps.flutterwaveSecretKeyEnc);
      }
    } catch { /* fall back to env key */ }

    if (!secretKey) {
      return NextResponse.json({ error: "Payment gateway not configured" }, { status: 500 });
    }

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
      return NextResponse.json(
        { error: flwData.message ?? "Refund request failed" },
        { status: 502 },
      );
    }

    const refundData = flwData.data;

    // ── Update booking ────────────────────────────────────────────────────────
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        paymentStatus:     "refunded",
        bookingStatus:     "cancelled",
        cancellationDate:  new Date(),
        updatedAt:         new Date(),
      }
    });

    console.log(`[flw/refund] Booking ${bookingId} refunded by ${user.id}`);
    return NextResponse.json({
      success:      true,
      refundAmount: refundData?.amount_refunded ?? partialAmount ?? booking.totalAmount,
      flwRefundId:  refundData?.id,
    });

  } catch (err: any) {
    console.error("[flw/refund] Unhandled error:", err);
    return NextResponse.json({ error: err.message ?? "Internal server error" }, { status: 500 });
  }
}
