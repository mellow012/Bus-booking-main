import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { encryptSecret } from '@/lib/crypto.server';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  try {
    // Auth: superadmin only for now
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return unauthorized();
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decoded = await adminAuth.verifyIdToken(idToken);
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get();

    if (!userSnap.exists || userSnap.data()?.role !== 'superadmin') {
      return unauthorized();
    }

    const { companyId, secretKey } = await req.json();

    if (!companyId || typeof secretKey !== 'string' || secretKey.trim().length < 20) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const companyRef = adminDb.collection('companies').doc(companyId);
    const companySnap = await companyRef.get();
    if (!companySnap.exists) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Encrypt once
    const encryptedSecret = await encryptSecret(secretKey.trim());

    await companyRef.update({
      'paymentSettings.paychanguEnabled': true,
      'paymentSettings.paychanguEncryptedSecret': encryptedSecret,
      'paymentSettings.paychanguUpdatedAt': Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    return NextResponse.json({ success: true, message: 'PayChangu key stored securely' });

  } catch (err: any) {
    console.error('PayChangu setup error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}