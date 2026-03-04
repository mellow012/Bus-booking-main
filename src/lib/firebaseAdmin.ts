import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging, Messaging } from 'firebase-admin/messaging';

// ─── Key sanitization ──────────────────────────────────────────────────────────
// Handles all common .env formatting issues:
//   • Escaped \n  → real newlines  (most common on Windows)
//   • \\n         → real newlines  (double-escaped)
//   • \r          → stripped       (Windows CRLF)
//   • Surrounding quotes → stripped (some env loaders add them)
const sanitizePrivateKey = (key?: string): string | undefined => {
  if (!key) return undefined;
  return key
    .replace(/\\\\n/g, '\n')     // double-escaped first
    .replace(/\\n/g, '\n')       // then single-escaped
    .replace(/\r/g, '')          // strip carriage returns
    .replace(/^["']/, '')        // strip leading quote
    .replace(/["',\s]+$/, '')   // strip trailing quote, comma, whitespace in any combo
    .trim();
};

// ─── Service account validation ───────────────────────────────────────────────
const getServiceAccount = () => {
  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = sanitizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  // Diagnostic logging — remove after confirming it works
  if (process.env.NODE_ENV !== 'production') {
    console.log('[firebaseAdmin] FIREBASE_PROJECT_ID set:',   !!projectId,   projectId   ? `(${projectId})` : '');
    console.log('[firebaseAdmin] FIREBASE_CLIENT_EMAIL set:',  !!clientEmail, clientEmail ? `(${clientEmail.slice(0, 30)}...)` : '');
    console.log('[firebaseAdmin] FIREBASE_PRIVATE_KEY set:',   !!privateKey);
    if (privateKey) {
      const startsOk = privateKey.startsWith('-----BEGIN RSA PRIVATE KEY-----') || privateKey.startsWith('-----BEGIN PRIVATE KEY-----');
      const endsOk   = privateKey.endsWith('-----END RSA PRIVATE KEY-----')     || privateKey.endsWith('-----END PRIVATE KEY-----');
      console.log('[firebaseAdmin] Private key starts correctly:', startsOk);
      console.log('[firebaseAdmin] Private key ends correctly:',   endsOk);
      console.log('[firebaseAdmin] Private key length:', privateKey.length);
      if (!startsOk || !endsOk) {
        console.error('[firebaseAdmin] ⚠️  Private key format looks wrong. First 60 chars:', privateKey.slice(0, 60));
        console.error('[firebaseAdmin] ⚠️  Last 60 chars:', privateKey.slice(-60));
      }
    }
  }

  const missing: string[] = [];
  if (!projectId)   missing.push('FIREBASE_PROJECT_ID');
  if (!clientEmail) missing.push('FIREBASE_CLIENT_EMAIL');
  if (!privateKey)  missing.push('FIREBASE_PRIVATE_KEY');
  if (missing.length) {
    throw new Error(`Firebase Admin env vars not set: ${missing.join(', ')}`);
  }

  // Validate key structure
  const keyOk = (privateKey!.includes('-----BEGIN RSA PRIVATE KEY-----') || privateKey!.includes('-----BEGIN PRIVATE KEY-----'))
    && (privateKey!.includes('-----END RSA PRIVATE KEY-----')   || privateKey!.includes('-----END PRIVATE KEY-----'));
  if (!keyOk) {
    throw new Error(
      'FIREBASE_PRIVATE_KEY appears malformed — missing BEGIN/END headers. ' +
      'Make sure the key in .env.local has real newlines (not \\n) or that your env loader handles escape sequences.'
    );
  }

  return {
    projectId:   projectId!,
    clientEmail: clientEmail!,
    privateKey:  privateKey!,
  };
};

// ─── Initialize ───────────────────────────────────────────────────────────────
const serviceAccount = getServiceAccount();

const adminApp: App =
  getApps().find((app) => app.name === 'admin') ??
  initializeApp({ credential: cert(serviceAccount) }, 'admin');

const admin: App          = adminApp;
const adminAuth: Auth     = getAuth(adminApp);
const adminDb: Firestore  = getFirestore(adminApp);
const adminMessaging: Messaging = getMessaging(adminApp);

export { admin, adminApp, adminAuth, adminDb, adminMessaging, FieldValue };