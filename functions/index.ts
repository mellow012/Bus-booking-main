import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

export const onBookingCreated = functions.firestore
  .document("bookings/{bookingId}")
  .onCreate(async (snapshot, context) => {
    const bookingData = snapshot.data();
    if (!bookingData || !bookingData.scheduleId || !Array.isArray(bookingData.seatNumbers) || bookingData.seatNumbers.length === 0) {
      console.error("Invalid booking data:", bookingData);
      await snapshot.ref.update({ bookingStatus: "failed", error: "Invalid booking data" });
      return;
    }

    const { scheduleId, seatNumbers, companyId } = bookingData;
    const passengerCount = seatNumbers.length;

    const scheduleRef = db.doc(`schedules/${scheduleId}`);

    try {
      await db.runTransaction(async (transaction) => {
        const scheduleDoc = await transaction.get(scheduleRef);
        if (!scheduleDoc.exists) {
          throw new Error("Schedule document does not exist!");
        }

        const scheduleData = scheduleDoc.data() as { availableSeats: number; bookedSeats: string[] };
        const newAvailableSeats = scheduleData.availableSeats - passengerCount;

        if (newAvailableSeats < 0) {
          throw new Error("Not enough available seats to complete booking.");
        }

        // Verify companyId match (optional security check)
        if (scheduleData.companyId !== companyId) {
          throw new Error("Company ID mismatch between booking and schedule");
        }

        transaction.update(scheduleRef, {
          availableSeats: newAvailableSeats,
          bookedSeats: admin.firestore.FieldValue.arrayUnion(...seatNumbers),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Update booking status to confirmed after successful transaction
        transaction.update(snapshot.ref, {
          bookingStatus: "confirmed",
          paymentStatus: "pending",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      console.log(`Successfully updated schedule ${scheduleId} for booking ${context.params.bookingId}`);
    } catch (error) {
      console.error("Transaction failed:", error);
      await snapshot.ref.update({
        bookingStatus: "failed",
        paymentStatus: "cancelled",
        error: error.message,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });