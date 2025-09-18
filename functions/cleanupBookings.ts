import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

exports.cleanupAbandonedBookings = functions.pubsub.schedule('every 10 minutes').onRun(
  async (context: functions.CloudContext) => {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
    const bookingsSnapshot = await admin.firestore().collection('bookings')
      .where('paymentStatus', 'in', ['pending', 'processing'])
      .where('createdAt', '<', cutoff)
      .get();

    const batch = admin.firestore().batch();
    bookingsSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`Cleaned up ${bookingsSnapshot.size} abandoned bookings.`);
    return null;
  }
);