// Example using Firebase Cloud Functions
import * as functions from "firebase-functions";
import { db } from "@/lib/firebaseConfig";
import { getDocs, query, where, updateDoc, doc } from "firebase/firestore";

export const checkPendingPayments = functions.pubsub
  .schedule("every 5 minutes")
  .onRun(async () => {
    const pendingQuery = query(
      collection(db, "bookings"),
      where("paymentStatus", "in", ["processing", "redirected"]),
      where("paymentInitiatedAt", "<", new Date(Date.now() - 15 * 60 * 1000)) // Older than 15 minutes
    );

    const snapshot = await getDocs(pendingQuery);
    snapshot.forEach(async (docSnap) => {
      const data = docSnap.data();
      await verifyPaymentStatusServerSide(data.transactionReference);
    });
  });

async function verifyPaymentStatusServerSide(txRef: string) {
  try {
    const response = await fetch(
      `/api/payments/paychangu-api/verify?tx_ref=${encodeURIComponent(txRef)}`,
      { method: "GET", headers: { "Accept": "application/json" } }
    );
    const result = await response.json();

    if (result.success && result.data?.data) {
      const paymentData = result.data.data;
      const [_, bookingId] = txRef.split("_");
      const bookingRef = doc(db, "bookings", bookingId);

      await updateDoc(bookingRef, {
        paymentStatus: paymentData.status === "success" || paymentData.status === "completed" ? "paid" : "failed",
        transactionId: result.data.transaction_id || txRef,
        paymentConfirmedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (paymentData.status === "success" || paymentData.status === "completed") {
        const bookingDoc = await getDoc(bookingRef);
        await updateDoc(doc(db, "schedules", bookingDoc.data()?.scheduleId), {
          availableSeats: increment(-bookingDoc.data()?.seatNumbers.length),
          bookedSeats: arrayUnion(...bookingDoc.data()?.seatNumbers),
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    console.error("Fallback verification error:", error);
  }
}