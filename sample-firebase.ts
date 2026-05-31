import { adminDb } from './src/lib/firebaseAdmin';

async function checkSample() {
  const getSample = async (col: string) => {
    const snap = await adminDb.collection(col).limit(1).get();
    if (snap.empty) {
      console.log(`${col} is empty`);
      return;
    }
    console.log(`Sample from ${col}:`, snap.docs[0].id, snap.docs[0].data());
  };

  await getSample('buses');
  await getSample('schedules');
  await getSample('bookings');
}

checkSample().catch(console.error);
