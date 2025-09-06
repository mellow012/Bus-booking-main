import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { adminAuth, adminDb, adminFieldValue } from '@/lib/firebaseAdmin';

/**
 * GET handler
 * Query params:
 * - provider = 'stripe' | 'paychangu'
 * - session_id (for stripe)
 * - tx_ref (for paychangu)
 *
 * Requires Authorization: Bearer <firebase id token>
 */
export async function GET(request: Request) {
  // Auth check
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized: Missing Bearer token" }, { status: 401 });
  }
  const idToken = authHeader.split("Bearer ")[1].trim();

  let decoded: any;
  try {
    // Use the centralized adminAuth
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch (err: any) {
    console.error("Failed to verify id token:", err?.message || err);
    return NextResponse.json({ error: "Unauthorized: Invalid token" }, { status: 401 });
  }

  const userId = decoded?.uid;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized: Invalid token payload" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const provider = url.searchParams.get("provider");
    const sessionId = url.searchParams.get("session_id") || url.searchParams.get("sessionId") || null;
    const txRef = url.searchParams.get("tx_ref") || url.searchParams.get("txRef") || null;

    if (!provider || (provider !== "stripe" && provider !== "paychangu")) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    if (provider === "stripe") {
      return await verifyStripePayment(sessionId, userId);
    } else {
      return await verifyPayChanguPayment(txRef, userId);
    }
  } catch (err: any) {
    console.error("Verification error:", err);
    return NextResponse.json({ error: "Internal server error", message: err?.message }, { status: 500 });
  }
}

/* ---------------- Stripe verification ---------------- */
async function verifyStripePayment(sessionId: string | null, userId: string) {
  if (!sessionId) return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });

  try {
    // Expand payment_intent for reliable status & method detection
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent"] });

    // Try to derive booking id from session metadata or client_reference_id
    const metadataBookingId = (session.metadata as any)?.bookingId || null;
    const clientRef = (session.client_reference_id as string) || (session.metadata as any)?.client_reference_id || null;

    let bookingDoc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData> | null = null;

    if (metadataBookingId) {
      const docRef = await adminDb.collection("bookings").doc(metadataBookingId).get();
      if (docRef.exists) bookingDoc = docRef;
    }

    // flexible fallback lookups
    if (!bookingDoc) {
      // prefer explicit stripeSessionId field
      const bySession = await adminDb.collection("bookings").where("stripeSessionId", "==", sessionId).limit(1).get();
      if (!bySession.empty) bookingDoc = bySession.docs[0];
    }

    if (!bookingDoc && clientRef) {
      const byClientRef = await adminDb.collection("bookings").where("clientReferenceId", "==", clientRef).limit(1).get();
      if (!byClientRef.empty) bookingDoc = byClientRef.docs[0];
    }

    if (!bookingDoc) {
      // final fallback: try metadata.tx_ref or transactionReference stored
      const txRef = (session.metadata as any)?.tx_ref || (session.metadata as any)?.transactionReference;
      if (txRef) {
        const byTx = await adminDb.collection("bookings").where("transactionReference", "==", txRef).limit(1).get();
        if (!byTx.empty) bookingDoc = byTx.docs[0];
      }
    }

    if (!bookingDoc) {
      // Not fatal — return session status to caller
      const paid = isStripeSessionPaid(session);
      return NextResponse.json({ foundBooking: false, sessionId, paid, session: { id: session.id, payment_status: session.payment_status } }, { status: 200 });
    }

    const bookingData = bookingDoc.data();
    // ownership check
    if (bookingData?.userId && bookingData.userId !== userId) {
      return NextResponse.json({ error: "Forbidden: Not booking owner" }, { status: 403 });
    }

    const paid = isStripeSessionPaid(session);

    if (paid) {
      if (bookingData.paymentStatus !== "paid") {
        const paymentMethod = determineStripePaymentMethod(session);
        await adminDb.collection("bookings").doc(bookingDoc.id).update({
          paymentStatus: "paid",
          bookingStatus: "confirmed",
          paymentMethod,
          paymentDetails: {
            provider: "stripe",
            sessionId: session.id,
            paymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent as any)?.id,
            amountTotal: session.amount_total,
            currency: session.currency,
            customerEmail: session.customer_email || (session.customer_details as any)?.email,
            paymentStatus: session.payment_status,
            raw: session,
          },
          paymentConfirmedAt: adminFieldValue.serverTimestamp(),
          updatedAt: adminFieldValue.serverTimestamp(),
        });
      }

      const fresh = await adminDb.collection("bookings").doc(bookingDoc.id).get();
      return NextResponse.json({ success: true, status: "paid", bookingId: bookingDoc.id, booking: fresh.data() }, { status: 200 });
    }

    // Not paid
    return NextResponse.json({ success: false, status: session.payment_status || "unknown", message: "Payment not completed", session: { id: session.id, payment_status: session.payment_status } }, { status: 200 });
  } catch (err: any) {
    console.error("Stripe verification error:", err);
    if (err?.code === "resource_missing") {
      return NextResponse.json({ error: "Payment session not found", message: err?.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to verify Stripe payment", message: err?.message || String(err) }, { status: 500 });
  }
}

function isStripeSessionPaid(session: any) {
  if (!session) return false;
  if (session.payment_status === "paid") return true;
  const pi = session.payment_intent;
  if (pi && (pi.status === "succeeded" || pi.status === "paid")) return true;
  return false;
}

function determineStripePaymentMethod(session: any): string {
  try {
    const pi = session?.payment_intent;
    if (pi?.payment_method_types?.includes("card")) return "card";
    if (Array.isArray(pi?.payment_method_types) && pi.payment_method_types.length) return pi.payment_method_types[0];
    if (session?.mode === "subscription") return "subscription";
    return "stripe";
  } catch {
    return "stripe";
  }
}

/* ---------------- PayChangu verification ---------------- */
async function verifyPayChanguPayment(txRef: string | null, userId: string) {
  if (!txRef) return NextResponse.json({ error: "Missing tx_ref" }, { status: 400 });
  if (!process.env.PAYCHANGU_SECRET_KEY) {
    console.warn("PAYCHANGU_SECRET_KEY not configured");
    return NextResponse.json({ error: "PayChangu not configured" }, { status: 500 });
  }

  try {
    const res = await fetch(`https://api.paychangu.com/v1/transaction/verify/${encodeURIComponent(txRef)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.PAYCHANGU_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return NextResponse.json({ success: false, status: "verification_failed", message: errData?.message || "PayChangu verification failed" }, { status: res.status });
    }

    const payload = await res.json();
    const paymentData = payload?.data?.data || payload?.data || payload;

    if (!paymentData) {
      return NextResponse.json({ success: false, status: "invalid_response", message: "Invalid PayChangu response", payload }, { status: 500 });
    }

    // Find booking by transactionReference field
    const byTx = await adminDb.collection("bookings").where("transactionReference", "==", txRef).limit(1).get();
    if (byTx.empty) {
      const byMeta = await adminDb.collection("bookings").where("paymentSessionId", "==", txRef).limit(1).get();
      if (!byMeta.empty) {
        const bookingDoc = byMeta.docs[0];
        return await processPayChanguBookingUpdate(bookingDoc, paymentData, userId, txRef);
      } else {
        return NextResponse.json({ error: "Booking not found" }, { status: 404 });
      }
    } else {
      const bookingDoc = byTx.docs[0];
      return await processPayChanguBookingUpdate(bookingDoc, paymentData, userId, txRef);
    }
  } catch (err: any) {
    console.error("PayChangu verification error:", err);
    if (err?.name === "TypeError") {
      return NextResponse.json({ error: "Network error contacting PayChangu" }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to verify PayChangu payment", message: err?.message || String(err) }, { status: 500 });
  }
}

async function processPayChanguBookingUpdate(
  bookingDoc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>,
  paymentData: any,
  userId: string,
  txRef: string
) {
  const bookingData = bookingDoc.data();
  if (bookingData?.userId && bookingData.userId !== userId) {
    return NextResponse.json({ error: "Forbidden: Not booking owner" }, { status: 403 });
  }

  const status = (paymentData.status || "").toString().toLowerCase();

  if (["successful", "success", "completed"].includes(status)) {
    if (bookingData.paymentStatus !== "paid") {
      const paymentMethod = determinePayChanguPaymentMethod(paymentData);
      await adminDb.collection("bookings").doc(bookingDoc.id).update({
        paymentStatus: "paid",
        bookingStatus: "confirmed",
        paymentMethod,
        paymentDetails: {
          provider: "paychangu",
          transactionId: paymentData.transaction_id || paymentData.id,
          txRef,
          amount: paymentData.amount,
          currency: paymentData.currency,
          customerEmail: paymentData?.customer?.email || paymentData.email,
          status: paymentData.status,
          raw: paymentData,
        },
        paymentConfirmedAt: adminFieldValue.serverTimestamp(),
        updatedAt: adminFieldValue.serverTimestamp(),
      });
    }

    const fresh = await adminDb.collection("bookings").doc(bookingDoc.id).get();
    return NextResponse.json({ success: true, status: "paid", bookingId: bookingDoc.id, booking: fresh.data() }, { status: 200 });
  }

  if (["failed", "cancelled", "canceled"].includes(status)) {
    if (bookingData.paymentStatus !== "failed") {
      await adminDb.collection("bookings").doc(bookingDoc.id).update({
        paymentStatus: "failed",
        paymentFailureReason: `PayChangu: ${paymentData.status} - ${paymentData.message || "failed"}`,
        paymentDetails: {
          provider: "paychangu",
          txRef,
          status: paymentData.status,
          message: paymentData.message,
          raw: paymentData,
        },
        updatedAt: adminFieldValue.serverTimestamp(),
      });
    }
    return NextResponse.json({ success: false, status: "failed", message: paymentData.message || "Payment failed", bookingId: bookingDoc.id }, { status: 200 });
  }

  return NextResponse.json({ success: false, status: status || "unknown", message: paymentData.message || "Payment pending", data: paymentData }, { status: 200 });
}

function determinePayChanguPaymentMethod(data: any): string {
  const method = (data.payment_method || "").toString().toLowerCase();
  const channel = (data.channel || "").toString().toLowerCase();

  if (method.includes("card") || channel.includes("card") || method.includes("visa") || method.includes("mastercard")) return "card";
  if (method.includes("bank") || channel.includes("bank")) return "bank_transfer";
  if (method.includes("mobile") || channel.includes("mobile") || method.includes("airtel") || method.includes("tnm") || method.includes("mpamba")) return "mobile_money";
  return "mobile_money";
}