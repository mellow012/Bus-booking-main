import { adminDb } from './src/lib/firebaseAdmin';

async function verify() {
  const collections = await adminDb.listCollections();
  console.log('Firestore collections:', collections.map(c => c.id));
}
verify().catch(console.error);
