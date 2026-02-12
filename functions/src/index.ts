import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

// Set global options for cost control (v2 feature)
import { setGlobalOptions } from "firebase-functions";
setGlobalOptions({ maxInstances: 10 });

// Define the expected data shape for the createBooking function
interface CreateBookingData {
  scheduleId: string;
  passengerDetails: any[]; // Adjust to a specific type if passengerDetails has a defined structure
  selectedSeats: string[];
}

/**
 * A callable Cloud Function to securely create a booking and update the schedule in a single transaction.
 */
export const createBooking = functions.https.onCall(
  async (request) => {
    // Check authentication
    if (!request.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be logged in to make a booking."
      );
    }

    const { scheduleId, passengerDetails, selectedSeats } = request.data as CreateBookingData;
    const userId = request.auth.uid;

    if (!scheduleId || !passengerDetails || !Array.isArray(selectedSeats) || selectedSeats.length === 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing or invalid required booking information: scheduleId, passengerDetails, and selectedSeats are required."
      );
    }

    const scheduleRef = db.doc(`schedules/${scheduleId}`);
    const bookingRef = db.collection("bookings").doc();

    try {
      await db.runTransaction(async (transaction) => {
        const scheduleDoc = await transaction.get(scheduleRef);
        if (!scheduleDoc.exists) {
          throw new functions.https.HttpsError("not-found", "The selected schedule could not be found.");
        }

        const scheduleData = scheduleDoc.data()!;
        const existingBookedSeats = scheduleData.bookedSeats || [];

        const conflictingSeats = selectedSeats.filter((seat) => existingBookedSeats.includes(seat));
        if (conflictingSeats.length > 0) {
          throw new functions.https.HttpsError(
            "aborted",
            `Sorry, the seat(s) ${conflictingSeats.join(", ")} were just booked by someone else.`
          );
        }

        if (scheduleData.availableSeats < selectedSeats.length) {
          throw new functions.https.HttpsError(
            "aborted",
            "Not enough seats are available on this bus."
          );
        }

        const bookingData = {
          userId,
          scheduleId,
          companyId: scheduleData.companyId,
          passengerDetails,
          seatNumbers: selectedSeats,
          totalAmount: scheduleData.price * selectedSeats.length,
          bookingStatus: "pending",
          paymentStatus: "pending",
          bookingReference: `BK${Date.now().toString(36)}${Math.random().toString(36).substring(2, 8)}`.toUpperCase(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        transaction.set(bookingRef, bookingData);
        transaction.update(scheduleRef, {
          bookedSeats: admin.firestore.FieldValue.arrayUnion(...selectedSeats),
          availableSeats: admin.firestore.FieldValue.increment(-selectedSeats.length),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      return { success: true, bookingId: bookingRef.id };
    } catch (error) {
      console.error("Booking transaction failed:", error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError(
        "internal",
        "An unexpected error occurred while creating the booking. Please try again or contact support."
      );
    }
  }
);