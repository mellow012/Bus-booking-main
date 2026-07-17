import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { encryptSecret } from '@/lib/crypto.server';

export async function POST(req: NextRequest) {
  try {
    // Auth: superadmin only for now
    const user = await getCurrentUser(req);
    
    if (!user || user.role !== 'superadmin') {
      return unauthorized();
    }

    const { companyId, secretKey } = await req.json();

    if (!companyId || typeof secretKey !== 'string' || secretKey.trim().length < 20) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, paymentSettings: true }
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Encrypt once (encryptSecret in crypto.server is async)
    const encryptedSecret = await encryptSecret(secretKey.trim());

    // Update JSON paymentSettings
    const currentSettings = (company.paymentSettings as Record<string, any>) || {};
    const updatedSettings = {
      ...currentSettings,
      paychanguEnabled: true,
      paychanguEncryptedSecret: encryptedSecret,
      paychanguUpdatedAt: new Date().toISOString(),
    };

    await prisma.company.update({
      where: { id: companyId },
      data: {
        paymentSettings: updatedSettings,
        updatedAt: new Date(),
      },
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
