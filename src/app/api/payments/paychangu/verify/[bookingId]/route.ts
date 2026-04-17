// app/api/payments/paychangu/verify/[bookingId]/route.ts
//
// PayChangu redirects here after payment: GET /api/payments/paychangu/verify/{bookingId}?tx_ref=...&status=...
// bookingId is in the path so PayChangu can't strip it.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const PAYCHANGU_API     = "https://api.paychangu.com";
const SUCCESS_STATUSES  = ["success", "successful", "completed"];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const appUrl    = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const { bookingId } = await params;
  const { searchParams } = new URL(req.url);
  const txRef  = searchParams.get("tx_ref");
  const status = searchParams.get("status");

  console.log("[paychangu/verify] bookingId:", bookingId, "tx_ref:", txRef, "status:", status);

  if (!bookingId) {
    return NextResponse.redirect(`${appUrl}/bookings?error=payment_failed`);
  }

  if (status && !SUCCESS_STATUSES.includes(status.toLowerCase())) {
    return NextResponse.redirect(`${appUrl}/bookings?error=payment_failed`);
  }

  try {
    // ── Lookup booking from PostgreSQL ──────────────────────────────────────
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        schedule: true,
        user: true,
        company: true,
      },
    });

    if (!booking) {
      console.error("[paychangu/verify] Booking not found:", bookingId);
      return NextResponse.redirect(`${appUrl}/bookings?error=booking_not_found`);
    }

    // ── Idempotency ───────────────────────────────────────────────────────────
    if (booking.paymentStatus === "paid") {
      console.log("[paychangu/verify] Booking already paid, returning success");
      return NextResponse.redirect(
        `${appUrl}/bookings?payment_verify=true&provider=paychangu&status=success`
      );
    }

    // ── Server-side verification ──────────────────────────────────────────────
    // Use the tx_ref PayChangu gave us (their UUID) to verify with their API.
    const refToVerify = txRef;
    if (!refToVerify) {
      console.error("[paychangu/verify] No tx_ref to verify with");
      return NextResponse.redirect(`${appUrl}/bookings?error=verification_failed`);
    }

    const verifyRes = await fetch(`${PAYCHANGU_API}/verify-payment/${refToVerify}`, {
      method:  "GET",
      headers: {
        Accept:        "application/json",
        Authorization: `Bearer ${process.env.PAYCHANGU_SECRET_KEY}`,
      },
    });

    const rawText = await verifyRes.text();
    console.log("[paychangu/verify] PayChangu response:", verifyRes.status, rawText.slice(0, 300));

    if (!verifyRes.ok) {
      console.error("[paychangu/verify] HTTP error:", verifyRes.status);
      return NextResponse.redirect(`${appUrl}/bookings?error=verification_failed`);
    }

    let result: Record<string, any>;
    try {
      result = JSON.parse(rawText);
    } catch {
      console.error("[paychangu/verify] Non-JSON response:", rawText.slice(0, 500));
      return NextResponse.redirect(`${appUrl}/bookings?error=verification_failed`);
    }

    const verified =
      result.status === "success" &&
      SUCCESS_STATUSES.includes((result.data?.status ?? "").toLowerCase());

    if (!verified) {
      console.warn("[paychangu/verify] Not verified:", result);
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          paymentStatus: "failed",
          bookingStatus: "payment_failed",
          updatedAt: new Date(),
        },
      });
      return NextResponse.redirect(`${appUrl}/bookings?error=verification_failed`);
    }

    // ── Mark paid with atomic transaction ─────────────────────────────────────
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Update booking status
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          paymentStatus: "paid",
          bookingStatus: "confirmed",
          paidAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Create payment record
      await tx.payment.create({
        data: {
          paymentId: refToVerify,
          bookingId: bookingId,
          amount: booking.totalAmount,
          currency: booking.currency,
          customerEmail: booking.contactEmail,
          customerPhone: booking.contactPhone,
          status: "completed",
          provider: "paychangu",
          txRef: refToVerify,
          metadata: result.data || {},
        },
      });
    });

    console.log("[paychangu/verify] Payment successful for booking:", bookingId);
    return NextResponse.redirect(
      `${appUrl}/bookings?payment_verify=true&provider=paychangu&status=success`
    );

  } catch (error: any) {
    console.error("[paychangu/verify] Unhandled error:", error);
    return NextResponse.redirect(`${appUrl}/bookings?error=server_error`);
  }
}