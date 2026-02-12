import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore, FieldValue } from 'firebase-admin/firestore';

// A function to safely get credentials, throwing an error if env vars are missing.
// This improves type safety by guaranteeing the variables are strings.
const sanitizePrivateKey = (key?: string) => {
  if (!key) return undefined;
  // Convert escaped newlines, remove stray carriage returns, and strip surrounding quotes
  return key.replace(/\\n/g, '\n').replace(/\r/g, '').replace(/^"|"$/g, '').trim();
};

const getServiceAccount = () => {
  const privateKey = sanitizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

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
