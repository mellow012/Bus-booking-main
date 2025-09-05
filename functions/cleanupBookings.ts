// functions/cleanupBookings.js (using Firebase Functions)
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.cleanupAbandonedBookings = functions.pubsub.schedule('every 10 minutes').onRun(async (context) => {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
  const bookingsSnapshot = await admin.firestore().collection('bookings')
    .where('paymentStatus', 'in', ['pending', 'processing'])
    .where('paymentInitiatedAt', '<', cutoff)
    .get();

  const batch = admin.firestore().batch();
  bookingsSnapshot.forEach(doc => {
    const bookingData = doc.data();
    const bookingRef = doc.ref;
    const scheduleRef = admin.firestore().doc(`schedules/${bookingData.scheduleId}`);

    batch.update(bookingRef, {
      paymentStatus: 'abandoned',
      paymentFailureReason: 'Payment not completed within timeout',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    batch.update(scheduleRef, {
      heldSeats: admin.firestore.FieldValue.arrayRemove(...bookingData.seatNumbers.map(seat => ({
        seat,
        userId: bookingData.userId,
        expires: admin.firestore.FieldValue.serverTimestamp(),
      }))),
    }, { merge: true });
  });

  await batch.commit();
  console.log(`Cleaned up ${bookingsSnapshot.size} abandoned bookings`);
});