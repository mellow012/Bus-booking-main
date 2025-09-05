import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'), // Handle newlines
};

const apps = getApps();
export const adminApp = apps.length === 0 || !apps.some(app => app.name === 'admin')
  ? initializeApp({
      credential: cert(serviceAccount as any),
    }, 'admin')
  : getApps().find(app => app.name === 'admin')!;

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
export const adminFieldValue = FieldValue;
export { FieldValue };