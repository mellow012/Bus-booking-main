import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import serviceAccount from './serviceAccountKey.json'; // Ensure this path matches your service account file

// Check if an app with the name 'admin' already exists, then initialize or reuse it
const apps = getApps();
export const adminApp = apps.length === 0 || !apps.some(app => app.name === 'admin')
  ? initializeApp({
      credential: cert(serviceAccount as any),
    }, 'admin')
  : getApps().find(app => app.name === 'admin')!;

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
export { FieldValue }; // Export FieldValue for use in other files