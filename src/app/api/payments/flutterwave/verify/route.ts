// app/api/payments/flutterwave/verify/route.ts
//
// Called by the bookings page after Flutterwave redirects back.
// Flutterwave return URL params: ?status=successful&tx_ref=bk_xxx&transaction_id=123456
//
// We verify by transaction_id (most reliable) if available,
// falling back to tx_ref query (slightly slower, 1 extra Firestore read).
//
// Returns: { success: boolean, status: 'paid' | 'failed' | 'pending', message?: string }

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const FLW_BASE = "https://api.flutterwave.com/v3";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const txRef         = searchParams.get("tx_ref");
  const transactionId = searchParams.get("transaction_id"); // numeric FLW transaction ID

  if (!txRef && !transactionId) {
    return NextResponse.json(
      { error: "Missing tx_ref or transaction_id" },
      { status: 400 },
    );
  }

  const secretKey = process.env.FLW_SECRET_KEY;
  if (!secretKey) {
    console.error("[flutterwave/verify] FLW_SECRET_KEY env var is not set");
    return NextResponse.json(
      { error: "Payment gateway not configured" },
      { status: 500 },
    );
  }

  try {
    // ── Verify with Flutterwave ───────────────────────────────────────────────
    // Prefer /transactions/{id}/verify (by numeric transaction_id) — it's a
    // direct lookup. Fall back to /transactions/verify_by_reference?tx_ref=...
    let verifyUrl: string;
    if (transactionId && /^\d+$/.test(transactionId)) {
      verifyUrl = `${FLW_BASE}/transactions/${transactionId}/verify`;
    } else {
      verifyUrl = `${FLW_BASE}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef!)}`;
    }

    const flwRes = await fetch(verifyUrl, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    const result = await flwRes.json();

    if (!flwRes.ok || result.status !== "success") {
      console.error("[flutterwave/verify] FLW error:", result);
      return NextResponse.json(
        { success: false, status: "failed", message: result.message ?? "Verification failed" },
        { status: 400 },
      );
    }

    const txData   = result.data;
    const flwStatus = txData?.status as string | undefined; // "successful" | "failed" | "pending"

    // ── Resolve the booking via tx_ref ────────────────────────────────────────
    // Our tx_ref format: "bk_{bookingId}_{timestamp}"
    // Parse bookingId directly to avoid a collection scan.
    const resolvedTxRef = txRef ?? (txData?.tx_ref as string | undefined);
    let booking: any = null;

    if (resolvedTxRef) {
      const parts = resolvedTxRef.split("_");
      // parts[0] = "bk", parts[1] = bookingId, parts[2] = timestamp
      if (parts.length >= 3 && parts[0] === "bk") {
        const bookingId = parts[1];
        booking = await prisma.booking.findUnique({
          where: { id: bookingId }
        });
      }
    }

    // Fallback: query by stored flutterwaveTxRef via payment record
    if (!booking && resolvedTxRef) {
      const payment = await prisma.payment.findFirst({
        where: { txRef: resolvedTxRef }
      });
      if (payment?.bookingId) {
        booking = await prisma.booking.findUnique({
          where: { id: payment.bookingId }
        });
      }
    }

    // ── Update PostgreSQL ──────────────────────────────────────────────────────
    if (booking) {
      if (flwStatus === "successful") {
        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            paymentStatus: "paid",
            bookingStatus: "confirmed",
            paidAt: new Date(),
            updatedAt: new Date(),
          }
        });
        
        // Update payment record
        await prisma.payment.updateMany({
          where: { txRef: resolvedTxRef },
          data: {
            status: "completed",
            metadata: {
              flutterwaveTransactionId: txData?.id ?? null,
              flutterwaveFlwRef: txData?.flw_ref ?? null,
            },
            updatedAt: new Date(),
          }
        });
      } else if (flwStatus === "failed") {
        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            paymentStatus: "failed",
            updatedAt: new Date(),
          }
        });
        
        await prisma.payment.updateMany({
          where: { txRef: resolvedTxRef },
          data: {
            status: "failed",
            updatedAt: new Date(),
          }
        });
      }
      // "pending" — leave as-is; webhook will update when it completes
    }

    const isPaid = flwStatus === "successful";
    return NextResponse.json({
      success: isPaid,
      status:  isPaid ? "paid" : flwStatus === "failed" ? "failed" : "pending",
      message: isPaid ? "Payment verified successfully" : `Transaction status: ${flwStatus}`,
    });

  } catch (err: any) {
    console.error("[flutterwave/verify] Unhandled error:", err);
    return NextResponse.json(
      { success: false, status: "failed", error: err?.message ?? "Internal server error" },
      { status: 500 },
    );
  }
}
