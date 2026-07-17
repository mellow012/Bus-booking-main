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
  const jsonResponse = searchParams.get("json") === "true" || req.headers.get("accept")?.includes("application/json");

  const buildErrorRedirect = (code: string, extra: Record<string, string> = {}) => {
    if (jsonResponse) {
      return NextResponse.json({ success: false, status: "failed", message: code, ...extra }, { status: 400 });
    }
    const qs = new URLSearchParams({ error: code, ...extra });
    return NextResponse.redirect(`${appUrl}/bookings?${qs.toString()}`);
  };

  if (!txRef) {
    return buildErrorRedirect("payment_failed", { reason: "missing_tx_ref" });
  }

  if (status && !SUCCESS_STATUSES.includes(status.toLowerCase())) {
    return buildErrorRedirect("payment_failed", { reason: status.toLowerCase() });
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

    if (!verifyRes.ok) {
      const reason = `paychangu_http_${verifyRes.status}`;
      console.error("[paychangu/verify] HTTP error", verifyRes.status, rawText.slice(0, 500));
      return buildErrorRedirect("verification_failed", { reason });
    }

    let result: any;
    try { result = JSON.parse(rawText); }
    catch {
      console.error("[paychangu/verify] Non-JSON response:", rawText.slice(0, 500));
      return buildErrorRedirect("verification_failed", { reason: "invalid_response" });
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
      return buildErrorRedirect("verification_failed", { reason: "not_verified" });
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

    if (jsonResponse) {
      return NextResponse.json({ success: true, status: "paid", message: "Payment verified" });
    }

    return NextResponse.redirect(
      `${appUrl}/bookings?payment_verify=true&provider=paychangu&status=success`
    );

  } catch (error: any) {
    console.error("[paychangu/verify] Unhandled error:", error?.message ?? error);
    return buildErrorRedirect("server_error", { reason: "internal_exception" });
  }
}
