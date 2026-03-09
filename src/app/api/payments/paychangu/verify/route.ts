import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  
  // PayChangu appends these to your callback_url
  const txRef = searchParams.get("tx_ref");
  const status = searchParams.get("status");

  // 1. Quick check on the status returned in the URL
  if (!txRef || status !== "success") {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/bookings?error=payment_failed`);
  }

  try {
    // 2. Server-side verification with PayChangu
    const response = await fetch(`https://api.paychangu.com/verify-payment/${txRef}`, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${process.env.PAYCHANGU_SECRET_KEY}`,
      },
    });

    const result = await response.json();

    // 3. Confirm the payment is truly successful in their records
    if (result.status === "success" && result.data.status === "success") {
      const bookingId = txRef.split('_')[1]; // Assuming format: pc_BOOKINGID_timestamp

      // 4. Update Firestore
      const bookingRef = adminDb.collection("bookings").doc(bookingId);
      const bookingSnap = await bookingRef.get();

      if (bookingSnap.exists) {
        await bookingRef.update({
          paymentStatus: "paid",
          bookingStatus: "confirmed",
          paychanguRef: txRef,
          updatedAt: new Date(),
        });
      }

      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/bookings?success=true`);
    }

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/bookings?error=verification_failed`);

  } catch (error) {
    console.error("PayChangu Verification Error:", error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/bookings?error=server_error`);
  }
}