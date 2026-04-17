// src/lib/firebaseAdmin.ts
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getMessaging, Messaging } from "firebase-admin/messaging";

/**
 * Firebase Admin Initialization (FCM ONLY)
 * 
 * We have migrated Auth and Firestore to Supabase.
 * Firebase Admin is retained SOLELY for dispatching Push Notifications via FCM.
 */

const sanitizePrivateKey = (key?: string): string | undefined => {
  if (!key) return undefined;
  return key
    .replace(/\\\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r/g, "")
    .replace(/^["']/, "")
    .replace(/["',\s]+$/, "")
    .trim();
};

let _adminApp: App | null = null;

function getAdminApp(): App {
  if (_adminApp) return _adminApp;

  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = sanitizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  if (process.env.NODE_ENV === "development") {
    console.log("[firebaseAdmin] Initializing FCM-only Admin App");
  }

  const missing: string[] = [];
  if (!projectId)   missing.push("FIREBASE_PROJECT_ID");
  if (!clientEmail) missing.push("FIREBASE_CLIENT_EMAIL");
  if (!privateKey)  missing.push("FIREBASE_PRIVATE_KEY");

  if (missing.length) {
    throw new Error(`Firebase Admin env vars not set: ${missing.join(", ")}`);
  }

  _adminApp =
    getApps().find((app) => app.name === "admin") ??
    initializeApp(
      { credential: cert({ projectId: projectId!, clientEmail: clientEmail!, privateKey: privateKey! }) },
      "admin"
    );

  return _adminApp;
}

/**
 * Lazy accessor for Firebase Messaging service.
 */
export function getAdminMessaging(): Messaging {
  return getMessaging(getAdminApp());
}

/**
 * Named exports for backward compatibility in notification services.
 */
export const adminMessaging = new Proxy({} as Messaging, {
  get: (_, p) => (getAdminMessaging() as any)[p],
});