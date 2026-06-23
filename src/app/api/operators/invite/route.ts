import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { sendOperatorInviteEmail } from '@/lib/email-service';
import { logger } from '@/lib/logger';

type TeamRole = 'operator' | 'conductor';

interface InviteTeamMemberRequest {
  name: string;
  email: string;
  role?: TeamRole; // defaults to 'operator' for backward compat
  companyId: string;
  companyName: string;
  invitedBy: string;
  region?: string;
  regionId?: string;
  routeIds?: string[];
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

    const { name, email, companyId, companyName, invitedBy, region, regionId, routeIds } = body;
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
      user_metadata: {
        full_name: name.trim(),
        role,           // e.g. 'operator' | 'conductor'
        companyId,      // used by middleware for multi-tenant safety
      },
    });

    if (createError || !userRecord) {
      throw createError || new Error('Failed to create user record');
    }

    // 4. Create user and operator records in PostgreSQL using transaction
    let operatorId: string;
    try {
      const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Resolve regionId if region string is provided
        let finalRegionId = regionId;
        if (!finalRegionId && region?.trim()) {
          const matchedRegion = await tx.region.findFirst({
            where: { name: { equals: region.trim(), mode: 'insensitive' }, companyId }
          });
          if (matchedRegion) {
            finalRegionId = matchedRegion.id;
          }
        }

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
            region: region || null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        // Also create operator record for linking routes/schedules
        await tx.operator.create({
          data: {
            id: userRecord.id,
            uid: userRecord.id,
            companyId,
            companyName,
            email: trimmedEmail,
            name: name.trim(),
            role,
            status: 'active',
            regionId: finalRegionId || null,
            invitationSent: true,
            invitationSentAt: new Date(),
            createdBy: invitedBy,
            routes: routeIds && routeIds.length > 0 ? {
              connect: routeIds.map((id: string) => ({ id }))
            } : undefined
          }
        });

        // Sync route assignedOperatorIds/assignedConductorIds arrays
        if (routeIds && routeIds.length > 0) {
          for (const routeId of routeIds) {
            const route = await tx.route.findUnique({
              where: { id: routeId },
              select: { assignedOperatorIds: true, assignedConductorIds: true }
            });
            if (route) {
              if (role === 'operator') {
                const updatedIds = Array.from(new Set([...(route.assignedOperatorIds || []), userRecord.id]));
                await tx.route.update({
                  where: { id: routeId },
                  data: { assignedOperatorIds: updatedIds }
                });
              } else if (role === 'conductor') {
                const updatedIds = Array.from(new Set([...(route.assignedConductorIds || []), userRecord.id]));
                await tx.route.update({
                  where: { id: routeId },
                  data: { assignedConductorIds: updatedIds }
                });
              }
            }
          }
        }

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
    const setupPath = '/company/setup';
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
    let emailFailed = false;

    // 6. Send email
    try {
      await sendOperatorInviteEmail(
        trimmedEmail,
        name.trim(),
        companyName,
        inviteLink,
        operatorId,
        role
      );
    } catch (emailError: any) {
      emailFailed = true;
      await logger.logWarning('auth', `Invite email delivery failed for ${trimmedEmail}: ${emailError.message || emailError}`);
    }

    await logger.logSuccess('auth', `Team member invited: ${role} (${trimmedEmail}) (Email failed: ${emailFailed})`, {
      action: 'invite_team_member',
      metadata: { role, companyId, operatorId, emailFailed },
    });

    return NextResponse.json({
      success: true,
      message: emailFailed 
        ? `${role === 'conductor' ? 'Conductor' : 'Operator'} recruited successfully in system, but the invitation email could not be sent (Resend API key is invalid/expired). Please copy and share the invitation link manually.`
        : `${role === 'conductor' ? 'Conductor' : 'Operator'} invitation sent successfully!`,
      operatorId,
      inviteLink,
      emailFailed,
    });

  } catch (error: any) {
    await logger.logError('auth', 'Error inviting team member', error, {
      action: 'invite_team_member_failed',
    });
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to send invite', message: '' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
