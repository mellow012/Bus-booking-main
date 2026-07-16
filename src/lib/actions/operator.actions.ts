'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { sendOperatorInviteEmail } from '@/lib/email-service';
import { logger } from '@/lib/logger';

type TeamRole = 'operator' | 'conductor';

interface InviteTeamMemberRequest {
  name: string;
  email: string;
  role?: TeamRole;
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
  inviteLink?: string;
  emailFailed?: boolean;
}

const VALID_ROLES: TeamRole[] = ['operator', 'conductor'];

export async function inviteOperator(body: InviteTeamMemberRequest): Promise<ApiResponse> {
  try {
    const { name, email, companyId, companyName, invitedBy, region, regionId, routeIds } = body;
    const role: TeamRole = VALID_ROLES.includes(body.role as TeamRole) ? (body.role as TeamRole) : 'operator';

    // 1. Validation
    const missing: string[] = [];
    if (!name?.trim()) missing.push('name');
    if (!email?.trim()) missing.push('email');
    if (!companyId?.trim()) missing.push('companyId');
    if (!invitedBy?.trim()) missing.push('invitedBy');

    if (missing.length > 0) {
      return { success: false, error: `Missing fields: ${missing.join(', ')}`, message: '' };
    }

    const trimmedEmail = email.trim().toLowerCase();
    const adminClient = createAdminClient();

    // 2. Check for existing user in Supabase
    const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers();
    if (listError) throw listError;
    
    const existingUser = users.find(u => u.email === trimmedEmail);
    if (existingUser) {
      return { success: false, error: 'Email already in use', message: '' };
    }

    // 3. Create Supabase Auth User
    const { data: { user: userRecord }, error: createError } = await adminClient.auth.admin.createUser({
      email: trimmedEmail,
      email_confirm: false,
      user_metadata: {
        full_name: name.trim(),
        role,
        companyId,
      },
    });

    if (createError || !userRecord) {
      throw createError || new Error('Failed to create user record');
    }

    // 4. Create user and operator records in PostgreSQL using transaction
    let operatorId: string;
    try {
      const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        let finalRegionId = regionId;
        let finalRegionName = region?.trim() || null;

        if (!finalRegionId && finalRegionName) {
          const matchedRegion = await tx.region.findFirst({
            where: { name: { equals: finalRegionName, mode: 'insensitive' }, companyId }
          });
          if (matchedRegion) {
            finalRegionId = matchedRegion.id;
          }
        }

        if (finalRegionId && !finalRegionName) {
          const matchedRegion = await tx.region.findUnique({ where: { id: finalRegionId } });
          if (matchedRegion) {
            finalRegionName = matchedRegion.name;
          }
        }

        const user = await tx.user.create({
          data: {
            id: userRecord.id,
            uid: userRecord.id,
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
            region: finalRegionName,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

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

        return user;
      });

      operatorId = result.id;
    } catch (error: any) {
      await adminClient.auth.admin.deleteUser(userRecord.id).catch(() => {});
      throw error;
    }

    // 5. Generate setup link
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
      type: 'recovery',
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

    return {
      success: true,
      message: emailFailed 
        ? `${role === 'conductor' ? 'Conductor' : 'Operator'} recruited successfully in system, but the invitation email could not be sent. Please copy and share the invitation link manually.`
        : `${role === 'conductor' ? 'Conductor' : 'Operator'} invitation sent successfully!`,
      operatorId,
      inviteLink,
      emailFailed,
    };

  } catch (error: any) {
    await logger.logError('auth', 'Error inviting team member', error, {
      action: 'invite_team_member_failed',
    });
    return { success: false, error: error.message || 'Failed to send invite', message: '' };
  }
}

interface ResendInviteRequest {
  operatorId: string;
  email: string;
  name: string;
  role?: TeamRole;
  companyId: string;
  companyName: string;
}

export async function resendOperatorInvite(body: ResendInviteRequest): Promise<ApiResponse> {
  try {
    const { operatorId, email, name, companyId, companyName } = body;
    const role: TeamRole = VALID_ROLES.includes(body.role as TeamRole) ? (body.role as TeamRole) : 'operator';

    // Validation
    if (!operatorId || !email || !companyId) {
      return { success: false, error: 'Missing required fields: operatorId, email, companyId', message: '' };
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Verify the operator record exists as User
    const operator = await prisma.user.findUnique({
      where: { id: operatorId }
    });

    if (!operator) {
      return { success: false, error: 'Team member not found', message: '' };
    }

    if (operator.setupCompleted) {
      return { success: false, error: 'Can only resend invitations for pending members', message: '' };
    }

    const adminClient = createAdminClient();
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
      type: 'recovery',
      email: trimmedEmail,
      options: {
        redirectTo: redirectUrl.toString(),
      },
    });

    if (linkError || !linkData.properties?.action_link) {
      throw linkError || new Error('Failed to generate setup link');
    }

    const inviteLink = linkData.properties.action_link;

    await prisma.user.update({
      where: { id: operatorId },
      data: {
        invitationSentAt: new Date(),
        updatedAt: new Date(),
      }
    });

    let emailFailed = false;
    try {
      await sendOperatorInviteEmail(
        trimmedEmail,
        name?.trim() || 'Team Member',
        companyName,
        inviteLink,
        operatorId,
        role
      );
    } catch (emailError: any) {
      emailFailed = true;
      console.error('Failed to resend email:', emailError);
    }

    return {
      success: true,
      message: emailFailed
        ? `Recruitment setup link regenerated, but the invitation email could not be sent. Please copy and share the link manually.`
        : `Invitation resent to ${trimmedEmail}`,
      inviteLink,
      emailFailed,
    };

  } catch (error: any) {
    console.error('Error resending invite:', error);
    return { success: false, error: error.message || 'Failed to resend invitation', message: '' };
  }
}
