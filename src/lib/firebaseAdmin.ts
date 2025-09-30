import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore, FieldValue } from 'firebase-admin/firestore';

// A function to safely get credentials, throwing an error if env vars are missing.
// This improves type safety by guaranteeing the variables are strings.
const getServiceAccount = () => {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
    throw new Error('Firebase Admin environment variables are not set. Please check your .env file.');
  }

  return {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: privateKey,
  };
};

const serviceAccount = getServiceAccount();

// Find an existing 'admin' app or initialize a new one.
// The nullish coalescing operator (??) makes this check very clean.
const adminApp: App =
  getApps().find((app) => app.name === 'admin') ??
  initializeApp(
    {
      credential: cert(serviceAccount), // No 'as any' needed now
    },
    'admin'
  );

const admin: App = adminApp; // Alias for clarity
const adminAuth: Auth = getAuth(adminApp);
const adminDb: Firestore = getFirestore(adminApp);

// Export everything in a single, clear statement.
export { admin ,adminApp, adminAuth, adminDb, FieldValue };
