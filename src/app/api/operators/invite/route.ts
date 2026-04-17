import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { sendOperatorInviteEmail } from '@/lib/email-service';

type TeamRole = 'operator' | 'conductor';

interface InviteTeamMemberRequest {
  name: string;
  email: string;
  role?: TeamRole; // defaults to 'operator' for backward compat
  companyId: string;
  companyName: string;
  invitedBy: string;
}

interface ApiResponse {
  success: boolean;
  message: string;
  operatorId?: string;
  error?: string;
}

const VALID_ROLES: TeamRole[] = ['operator', 'conductor'];

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const body: InviteTeamMemberRequest = await request.json();
    console.log('Invite API received:', body);

    const { name, email, companyId, companyName, invitedBy } = body;
    const role: TeamRole = VALID_ROLES.includes(body.role as TeamRole) ? (body.role as TeamRole) : 'operator';

    // 1. Validation
    const missing: string[] = [];
    if (!name?.trim()) missing.push('name');
    if (!email?.trim()) missing.push('email');
    if (!companyId?.trim()) missing.push('companyId');
    if (!invitedBy?.trim()) missing.push('invitedBy');

    if (missing.length > 0) {
      return NextResponse.json(
        { success: false, error: `Missing fields: ${missing.join(', ')}`, message: '' },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();
    const adminClient = createAdminClient();

    // 2. Check for existing user in Supabase
    // Using listUsers instead of getUserByEmail because listUsers is more reliable for "checking existence" without erroring
    const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers();
    if (listError) throw listError;
    
    const existingUser = users.find(u => u.email === trimmedEmail);
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Email already in use', message: '' },
        { status: 400 }
      );
    }

    // 3. Create Supabase Auth User
    const { data: { user: userRecord }, error: createError } = await adminClient.auth.admin.createUser({
      email: trimmedEmail,
      email_confirm: false,
      user_metadata: { full_name: name.trim() },
    });

    if (createError || !userRecord) {
      throw createError || new Error('Failed to create user record');
    }

    // 4. Create user and operator records in PostgreSQL using transaction
    let operatorId: string;
    try {
      const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Create user record (Operator/Conductor are just Users with roles)
        const user = await tx.user.create({
          data: {
            id: userRecord.id,
            uid: userRecord.id, // Using Supabase ID for both
            email: trimmedEmail,
            firstName: name.trim().split(' ')[0] || name.trim(),
            lastName: name.trim().split(' ').slice(1).join(' ') || '',
            role: role === 'conductor' ? 'conductor' : 'operator',
            companyId,
            passwordSet: false,
            setupCompleted: false,
            invitationSent: true,
            invitationSentAt: new Date(),
            createdBy: invitedBy,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        return user;
      });

      operatorId = result.id;
    } catch (error: any) {
      // Rollback: delete the Auth user if DB operations fail
      await adminClient.auth.admin.deleteUser(userRecord.id).catch(() => {});
      throw error;
    }

    // 5. Generate password reset / setup link
    let baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    if (!baseUrl.startsWith('http')) {
      baseUrl = 'http://localhost:3000';
    }
    const setupPath = role === 'conductor' ? '/conductor/setup' : '/company/setup';
    const redirectUrl = new URL(setupPath, baseUrl);
    redirectUrl.searchParams.append('operatorId', operatorId);
    redirectUrl.searchParams.append('email', trimmedEmail);
    redirectUrl.searchParams.append('role', role);

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'recovery', // Recovery link works as a password setup link
      email: trimmedEmail,
      options: {
        redirectTo: redirectUrl.toString(),
      },
    });

    if (linkError || !linkData.properties?.hashed_token) {
      throw linkError || new Error('Failed to generate setup link');
    }

    const tokenHash = linkData.properties.hashed_token;
    redirectUrl.searchParams.append('token_hash', tokenHash);

    const inviteLink = redirectUrl.toString();

    // 6. Send email
    await sendOperatorInviteEmail(
      trimmedEmail,
      name.trim(),
      companyName,
      inviteLink,
      operatorId,
      role
    );

    return NextResponse.json({
      success: true,
      message: `${role === 'conductor' ? 'Conductor' : 'Operator'} invitation sent successfully!`,
      operatorId,
    });

  } catch (error: any) {
    console.error('Error inviting team member:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to send invite', message: '' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
