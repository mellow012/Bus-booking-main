import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging, Messaging } from 'firebase-admin/messaging';

// ─── Key sanitization ──────────────────────────────────────────────────────────
const sanitizePrivateKey = (key?: string): string | undefined => {
  if (!key) return undefined;
  return key
    .replace(/\\\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r/g, '')
    .replace(/^["']/, '')
    .replace(/["',\s]+$/, '')
    .trim();
};

// ─── FIX F-16 + F-29: Lazy initialization ─────────────────────────────────────
// Previously getServiceAccount() was called at module import time, meaning a
// missing env var would crash the entire Next.js process before it could serve
// any request or health check. Now initialization is deferred to first use.
//
// FIX F-29: Diagnostic logging that printed projectId and clientEmail is now
// gated to NODE_ENV === 'development' only and will not run in production.

let _adminApp: App | null = null;

function getAdminApp(): App {
  if (_adminApp) return _adminApp;

  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = sanitizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  // FIX F-29: diagnostic output only in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[firebaseAdmin] FIREBASE_PROJECT_ID set:',  !!projectId);
    console.log('[firebaseAdmin] FIREBASE_CLIENT_EMAIL set:', !!clientEmail);
    console.log('[firebaseAdmin] FIREBASE_PRIVATE_KEY set:',  !!privateKey);
    if (privateKey) {
      const startsOk = privateKey.startsWith('-----BEGIN RSA PRIVATE KEY-----') || privateKey.startsWith('-----BEGIN PRIVATE KEY-----');
      const endsOk   = privateKey.endsWith('-----END RSA PRIVATE KEY-----')     || privateKey.endsWith('-----END PRIVATE KEY-----');
      console.log('[firebaseAdmin] Private key starts correctly:', startsOk);
      console.log('[firebaseAdmin] Private key ends correctly:',   endsOk);
      if (!startsOk || !endsOk) {
        console.warn('[firebaseAdmin] Private key format may be wrong — check BEGIN/END headers');
      }
    }
  }

  const missing: string[] = [];
  if (!projectId)   missing.push('FIREBASE_PROJECT_ID');
  if (!clientEmail) missing.push('FIREBASE_CLIENT_EMAIL');
  if (!privateKey)  missing.push('FIREBASE_PRIVATE_KEY');

  if (missing.length) {
    // Throw here (on first use) rather than at import time so the pod can still
    // start, serve a health check, and report a meaningful error in logs.
    throw new Error(`Firebase Admin env vars not set: ${missing.join(', ')}`);
  }

  const keyOk =
    (privateKey!.includes('-----BEGIN RSA PRIVATE KEY-----') || privateKey!.includes('-----BEGIN PRIVATE KEY-----')) &&
    (privateKey!.includes('-----END RSA PRIVATE KEY-----')   || privateKey!.includes('-----END PRIVATE KEY-----'));

  if (!keyOk) {
    throw new Error(
      'FIREBASE_PRIVATE_KEY appears malformed — missing BEGIN/END headers. ' +
      'Ensure the key in .env.local has real newlines (not \\n) or that your env loader handles escape sequences.'
    );
  }

  _adminApp =
    getApps().find((app) => app.name === 'admin') ??
    initializeApp(
      { credential: cert({ projectId: projectId!, clientEmail: clientEmail!, privateKey: privateKey! }) },
      'admin'
    );

  return _adminApp;
}

// ─── Lazy service accessors ───────────────────────────────────────────────────
// Callers import these and call them like functions.
// Initialization only happens on first call, not at module load time.

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}

export function getAdminMessaging(): Messaging {
  return getMessaging(getAdminApp());
}

// ─── Legacy named exports (backward-compatible) ───────────────────────────────
// These are getter-style proxies so existing imports like
//   import { adminAuth } from '@/lib/firebaseAdmin'
// continue to work without any changes at call sites.
//
// They initialize on first property access, not at module load.

export const adminApp      = new Proxy({} as App,      { get: (_, p) => (getAdminApp() as any)[p] });
export const adminAuth     = new Proxy({} as Auth,     { get: (_, p) => (getAdminAuth() as any)[p] });
export const adminDb       = new Proxy({} as Firestore,{ get: (_, p) => (getAdminDb() as any)[p]   });
export const adminMessaging= new Proxy({} as Messaging,{ get: (_, p) => (getAdminMessaging() as any)[p] });
export const admin         = adminApp;

export { FieldValue };