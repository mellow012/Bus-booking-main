// app/api/payments/paychangu/verify/route.ts
//
// PayChangu always redirects here after payment with ?tx_ref=<their UUID>
// regardless of what returnUrl we pass — the SDK overrides it.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
    // ── Find payment and booking by txRef ────────────────────────────────────
    const payment = await prisma.payment.findFirst({
      where: { txRef },
      include: { booking: true }
    });

    if (!payment || !payment.booking) {
      console.error("[paychangu/verify] No payment/booking found for tx_ref:", txRef);
      return NextResponse.redirect(`${appUrl}/bookings?error=booking_not_found`);
    }

    const booking = payment.booking;

    // Idempotency
    if (booking.paymentStatus === "paid") {
      return NextResponse.redirect(
        `${appUrl}/bookings?payment_verify=true&provider=paychangu&status=success`
      );
    }

    // ── Server-side verify ────────────────────────────────────────────────────
    // Fallback to env key if not found on company (though charge used company key)
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
      return NextResponse.redirect(`${appUrl}/bookings?error=verification_failed`);
    }

    const verified =
      result.status === "success" &&
      SUCCESS_STATUSES.includes((result.data?.status ?? "").toLowerCase());

    if (!verified) {
      console.warn("[paychangu/verify] Not verified:", result);
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          paymentStatus: "failed",
          updatedAt:     new Date(),
        },
      });
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "failed",
          updatedAt: new Date(),
        }
      });
      return NextResponse.redirect(`${appUrl}/bookings?error=verification_failed`);
    }

    // ── Mark paid ─────────────────────────────────────────────────────────────
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        paymentStatus:      "paid",
        bookingStatus:      "confirmed",
        paidAt:             new Date(),
        updatedAt:          new Date(),
      },
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "completed",
        updatedAt: new Date(),
      }
    });

    return NextResponse.redirect(
      `${appUrl}/bookings?payment_verify=true&provider=paychangu&status=success`
    );

  } catch (error: any) {
    console.error("[paychangu/verify] Unhandled error:", error);
    return NextResponse.redirect(`${appUrl}/bookings?error=server_error`);
  }
}
