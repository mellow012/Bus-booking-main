import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { prisma } from '@/lib/prisma';
import { sendPasswordResetEmail, sendOperatorInviteEmail } from '@/lib/email-service';

/**
 * POST /api/auth/resend-setup-email
 * Re-generates and re-sends a setup/onboarding link.
 * Handles Company Admins, Operators, and Conductors.
 */
export async function POST(request: NextRequest) {
  try {
    const { email, type } = await request.json();

    if (!email || !type) {
      return NextResponse.json(
        { error: 'Bad request', message: 'Email and type are required' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const trimmedEmail = email.trim().toLowerCase();

    // 1. Fetch entity details from database
    let name = 'User';
    let entityId = '';
    let companyName = 'TibhukeBus';
    let companyId = '';

    if (type === 'company') {
      const company = await prisma.company.findFirst({
        where: { email: trimmedEmail }
      });
      if (!company) {
        return NextResponse.json({ error: 'Not found', message: 'Company not found' }, { status: 404 });
      }
      name = company.name;
      entityId = company.id;
      companyName = company.name;
      companyId = company.id;
    } else {
      const user = await prisma.user.findUnique({
        where: { email: trimmedEmail },
        include: { company: true }
      });
      if (!user) {
        return NextResponse.json({ error: 'Not found', message: 'User not found' }, { status: 404 });
      }
      name = `${user.firstName} ${user.lastName}`.trim();
      entityId = user.id;
      companyName = user.company?.name || 'TibhukeBus';
      companyId = user.companyId || '';
    }

    // 2. Generate new setup link
    const setupPath = type === 'conductor' ? '/conductor/setup' : '/company/setup';
    const redirectUrl = new URL(setupPath, baseUrl);
    
    // Append tracking IDs to the URL for the setup page's initial fetch
    if (type === 'company') {
      redirectUrl.searchParams.append('companyId', entityId);
    } else {
      redirectUrl.searchParams.append('operatorId', entityId);
      redirectUrl.searchParams.append('email', trimmedEmail);
      redirectUrl.searchParams.append('role', type);
    }

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email: trimmedEmail,
      options: { redirectTo: redirectUrl.toString() },
    });

    if (linkError || !linkData.properties?.hashed_token) {
      throw linkError || new Error('Failed to generate setup link');
    }

    const tokenHash = linkData.properties.hashed_token;
    redirectUrl.searchParams.append('token_hash', tokenHash);
    const setupLink = redirectUrl.toString();

    // 3. Send appropriate email
    if (type === 'company') {
      await sendPasswordResetEmail(trimmedEmail, name, setupLink, entityId);
    } else {
      await sendOperatorInviteEmail(
        trimmedEmail,
        name,
        companyName,
        setupLink,
        entityId,
        type as any
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Setup email resent successfully',
    });

  } catch (error: any) {
    console.error('[resend-setup-email] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message || 'Failed to resend email' },
      { status: 500 }
    );
  }
}
