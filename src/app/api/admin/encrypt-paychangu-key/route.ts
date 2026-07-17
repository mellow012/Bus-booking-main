// app/api/admin/encrypt-paychangu-key/route.ts
//
// Accepts a plaintext PayChangu secret key, encrypts it server-side,
// and returns the encrypted blob. The superadmin dashboard then writes
// the blob to the DB — plaintext never touches the DB.
//
// Restricted to superadmins or company_admins via Supabase session.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { encryptSecret } from '@/lib/crypto.server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // ── 1. Authenticate & Authorise ───────────────────────────────────────────
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { companyId, secretKey } = await req.json();

  if (!companyId || typeof companyId !== 'string')
    return NextResponse.json({ error: 'companyId is required' }, { status: 400 });

  const isSuperAdmin   = user.role === 'superadmin';
  const isCompanyAdmin = user.role === 'company_admin' && user.companyId === companyId;

  if (!isSuperAdmin && !isCompanyAdmin) {
    return NextResponse.json({ error: 'Forbidden — superadmin or company admin only' }, { status: 403 });
  }

  // ── 2. Validate payload ───────────────────────────────────────────────────
  if (!secretKey || typeof secretKey !== 'string')
    return NextResponse.json({ error: 'secretKey is required' }, { status: 400 });
  if (!secretKey.toLowerCase().startsWith('sec-'))
    return NextResponse.json({ error: 'secretKey must start with sec-' }, { status: 400 });

  // ── 3. Verify company exists ──────────────────────────────────────────────
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true }
  });
  if (!company)
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });

  // ── 4. Encrypt and return — do NOT write to DB here ───────────────────────
  // The dashboard writes the full paymentSettings object atomically.
  // We only encrypt here so the plaintext never transits through client JS unencrypted.
  try {
    const encrypted = await encryptSecret(secretKey);
    return NextResponse.json({ encrypted });
  } catch (e: any) {
    console.error('[encrypt-paychangu-key]', e);
    return NextResponse.json(
      { error: e.message || 'Encryption failed — check MASTER_ENCRYPTION_KEY env var' },
      { status: 500 }
    );
  }
}
