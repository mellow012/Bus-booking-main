// app/api/admin/encrypt-paychangu-key/route.ts
//
// Accepts a plaintext PayChangu secret key, encrypts it server-side,
// and returns the encrypted blob. The superadmin dashboard then writes
// the blob to Firestore — plaintext never touches the DB.
//
// Restricted to superadmins via Firebase auth token check.
//
// Required env var:
//   PAYCHANGU_ENCRYPTION_KEY — 64-char hex (32 bytes), generate with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { encryptSecret } from '@/lib/Encrypt-secret';

export async function POST(req: NextRequest) {
  // ── 1. Verify Firebase auth token ────────────────────────────────────────
  const idToken = req.headers.get('Authorization')?.replace('Bearer ', '').trim();
  console.log('[encrypt-route] Authorization header present:', !!req.headers.get('Authorization'));
  console.log('[encrypt-route] token preview:', idToken?.slice(0, 20));
  if (!idToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    uid = decoded.uid;
    console.log('[encrypt-route] verified uid:', uid);
  } catch (e: any) {
    console.error('[encrypt-route] verifyIdToken failed:', e.message);
    return NextResponse.json({ error: 'Invalid auth token' }, { status: 401 });
  }

  // ── 2. Verify the caller is a superadmin or company_admin of this company ──
  const { companyId, secretKey } = await req.json();
  if (!companyId || typeof companyId !== 'string')
    return NextResponse.json({ error: 'companyId is required' }, { status: 400 });

  const profileSnap = await adminDb.collection('users').doc(uid).get();
  const profile = profileSnap.data();
  const isSuperAdmin   = profile?.role === 'superadmin';
  const isCompanyAdmin = profile?.role === 'company_admin' && profile?.companyId === companyId;

  if (!isSuperAdmin && !isCompanyAdmin) {
    return NextResponse.json({ error: 'Forbidden — superadmin or company admin only' }, { status: 403 });
  }

  // ── 3. Validate payload ───────────────────────────────────────────────────
  if (!secretKey || typeof secretKey !== 'string')
    return NextResponse.json({ error: 'secretKey is required' }, { status: 400 });
  if (!secretKey.toLowerCase().startsWith('sec-'))
    return NextResponse.json({ error: 'secretKey must start with sec-' }, { status: 400 });

  // ── 4. Verify company exists ──────────────────────────────────────────────
  const companySnap = await adminDb.collection('companies').doc(companyId).get();
  if (!companySnap.exists)
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });

  // ── 5. Encrypt and return — do NOT write to Firestore here ────────────────
  // The dashboard writes the full paymentSettings object atomically.
  // We only encrypt here so the plaintext never transits through client JS unencrypted.
  try {
    const encrypted = encryptSecret(secretKey);
    return NextResponse.json({ encrypted });
  } catch (e: any) {
    console.error('[encrypt-paychangu-key]', e);
    return NextResponse.json(
      { error: e.message || 'Encryption failed — check PAYCHANGU_ENCRYPTION_KEY env var' },
      { status: 500 }
    );
  }
}