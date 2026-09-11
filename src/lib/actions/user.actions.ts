'use server'

import prisma from '../prisma';
import { revalidatePath } from 'next/cache';
import { UserProfile as User } from '@/types';
import { createClient } from '@/utils/supabase/server';
import { getCurrentUserFromServer } from '@/lib/auth-utils';

// ─────────────────────────────────────────────────────────────────────────────

export async function checkEmailExists(email: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  return !!existing;
}

// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/auth/profile equivalent — reads session server-side */
export async function getAuthenticatedUserProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'Unauthorized', data: null };
  return getUserById(user.id, user.email);
}

/** PATCH /api/auth/profile equivalent — whitelists fields, reads session server-side */
export async function updateAuthenticatedUserProfile(data: Record<string, unknown>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'Unauthorized', data: null };

  const updatableFields = [
    'firstName', 'lastName', 'phone', 'nationalId', 'sex',
    'currentAddress', 'setupCompleted', 'isActive', 'emailVerified',
    'passwordSet', 'invitationSent',
  ];

  const sanitizedData: Record<string, unknown> = {};
  updatableFields.forEach((field) => {
    if (data[field] !== undefined) sanitizedData[field] = data[field];
  });

  if (data.email) {
    sanitizedData.email = data.email;
  } else if (user.email) {
    sanitizedData.email = user.email;
  }

  return syncUser(user.id, sanitizedData as Partial<User>);
}

/** POST /api/auth/reset-password equivalent — marks passwordSet flag after Supabase Auth update */
export async function markPasswordSet(email?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const identifier = user?.id
    ? { id: user.id }
    : email
      ? { email: email.toLowerCase() }
      : null;

  if (!identifier) return { success: false as const, error: 'No active session or user identification found.' };

  try {
    await prisma.user.update({
      where: identifier as any,
      data: { passwordSet: true, updatedAt: new Date() },
    });
    return { success: true as const };
  } catch (dbError) {
    console.error('[markPasswordSet] prisma update failed:', dbError);
    // Non-fatal — Supabase Auth already updated the password
    return { success: true as const };
  }
}

/**
 * --- Users ---
 */
export async function getUserById(id: string, email?: string) {
  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id },
          { uid: id },
          ...(email ? [{ email }] : [])
        ]
      },
      orderBy: {
        setupCompleted: 'desc'
      }
    });

    if (user && id && user.uid !== id) {
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { uid: id, updatedAt: new Date() }
        });
        user.uid = id;
      } catch (syncErr) {
        console.warn('[getUserById] non-fatal error syncing uid:', syncErr);
      }
    }

    return { success: true, data: user as User | null };
  } catch (error: unknown) {
    console.error('Error fetching user by id:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function syncUser(id: string, data: Partial<User>) {
  try {
    // Sanitizing data: remove fields that should not be updated directly
    const { id: _, createdAt, updatedAt, ...updatableData } = data;
    const email = updatableData.email?.trim() || undefined;

    // 1. Search for existing record by id, uid, or email
    let existing = null;

    // First try by id (most specific)
    if (id) {
      existing = await prisma.user.findFirst({
        where: { OR: [{ id }, { uid: id }] },
        orderBy: { setupCompleted: 'desc' }
      });
    }

    // Then by email if not found (and email is provided)
    if (!existing && email) {
      existing = await prisma.user.findUnique({ where: { email } });
    }

    // If still not found but we have an id, try searching all users with that id pattern
    if (!existing && id && email) {
      existing = await prisma.user.findUnique({ where: { email } });
    }

    if (existing) {
      // Build non-destructive update data
      const safeUpdateData: any = {
        updatedAt: new Date(),
      };

      if (existing.uid !== id) {
        safeUpdateData.uid = id;
      }

      // Fields to sync only if provided and non-empty, unless existing value is empty
      const textFields = ['firstName', 'lastName', 'phone', 'nationalId', 'sex', 'currentAddress', 'role', 'companyId', 'region'];
      for (const field of textFields) {
        const incomingVal = (updatableData as any)[field];
        const existingVal = (existing as any)[field];

        if (incomingVal !== undefined && incomingVal !== null) {
          const strVal = String(incomingVal).trim();
          // If incoming value is non-empty, OR if existing value is missing/empty, apply update
          if (strVal !== '' || !existingVal || String(existingVal).trim() === '') {
            safeUpdateData[field] = incomingVal;
          }
        }
      }

      // Preserve setupCompleted = true if either incoming or existing is true
      if (updatableData.setupCompleted === true || existing.setupCompleted === true) {
        safeUpdateData.setupCompleted = true;
      } else if (updatableData.setupCompleted !== undefined) {
        safeUpdateData.setupCompleted = updatableData.setupCompleted;
      }

      // Sync other boolean / object flags if defined
      if (updatableData.isActive !== undefined) safeUpdateData.isActive = updatableData.isActive;
      if (updatableData.emailVerified !== undefined) safeUpdateData.emailVerified = updatableData.emailVerified;
      if (updatableData.passwordSet !== undefined) safeUpdateData.passwordSet = updatableData.passwordSet;
      if ((updatableData as any).fcmTokens !== undefined) safeUpdateData.fcmTokens = (updatableData as any).fcmTokens;
      if ((updatableData as any).preferences !== undefined) safeUpdateData.preferences = (updatableData as any).preferences;

      const user = await prisma.user.update({
        where: { id: existing.id },
        data: safeUpdateData,
      });
      return { success: true, data: user as User };
    }

    // 2. Create new record (only if not found by any means)
    // Make sure we have required fields
    const createData: any = {
      id,
      uid: id,
      ...(updatableData as any),
      firstName: updatableData.firstName || '',
      lastName: updatableData.lastName || '',
      email: email || '',
      role: updatableData.role || 'customer',
    };

    const companyScopedRoles = ['company_admin', 'operator', 'conductor'];
    if (companyScopedRoles.includes(createData.role) && !createData.companyId) {
      throw new Error(`companyId is required for role ${createData.role}`);
    }

    const user = await prisma.user.create({
      data: createData,
    });

    // Notify admins of new registration in background
    notifyAdminsOfNewRegistration(user).catch(err => {
      console.error('Error sending registration notification:', err);
    });

    return { success: true, data: user as User };
  } catch (error: unknown) {
    const err = error as any;
    console.error('Error syncing user:', error);

    // Handle unique constraint on email (fallback if somehow record slipped through)
    if (err?.code === 'P2002' && err?.meta?.target?.includes('email')) {
      try {
        // Extract email from error or from the original data
        let emailToFind = data.email?.trim() || undefined;
        if (!emailToFind && err?.meta?.target?.includes('email')) {
          // Try to get email from the failed create/update data
          return { success: false, error: 'Email already exists. Please use a different email or contact support.' };
        }

        if (emailToFind) {
          const existingByEmail = await prisma.user.findUnique({ where: { email: emailToFind } });
          if (existingByEmail) {
            const user = await prisma.user.update({
              where: { id: existingByEmail.id },
              data: {
                ...(data as any),
                uid: id,
                updatedAt: new Date(),
              },
            });
            return { success: true, data: user as User };
          }
        }
      } catch (fallbackErr) {
        console.error('Error in P2002 fallback handler:', fallbackErr);
      }
    }

    return { success: false, error: (error as Error).message };
  }
}

export async function updateUser(id: string, data: any) {
  try {
    // Sanitizing data: remove fields that should not be updated directly in Postgres
    const { id: _, createdAt, updatedAt, ...updatableData } = data;

    // Handle 'status' to 'isActive' mapping for UI compatibility
    if (updatableData.status) {
      updatableData.isActive = updatableData.status === 'active';
      delete updatableData.status;
    }

    // List of allowed fields in User model to prevent Prisma errors
    const allowedFields = [
      'uid', 'email', 'firstName', 'lastName', 'phone', 'role',
      'nationalId', 'sex', 'currentAddress', 'isActive',
      'emailVerified', 'setupCompleted', 'passwordSet', 'fcmTokens',
      'lastTokenUpdated', 'companyId', 'region', 'invitationSent',
      'invitationSentAt', 'createdBy', 'profilePicture'
    ];

    const sanitizedData: any = {};
    Object.keys(updatableData).forEach(key => {
      if (allowedFields.includes(key)) {
        sanitizedData[key] = updatableData[key];
      }
    });

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...sanitizedData,
        // If role is being changed, increment sessionVersion to invalidate cached session cookies
        ...(sanitizedData.role ? { sessionVersion: { increment: 1 } } : {}),
        updatedAt: new Date(),
      },
    });
    revalidatePath('/company/admin');
    revalidatePath('/company/operator/dashboard');
    return { success: true, data: user as User };
  } catch (error: unknown) {
    console.error('Error updating user:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteUser(id: string) {
  const authUser = await getCurrentUserFromServer();
  if (!authUser) {
    return { success: false, error: 'Unauthorized' };
  }
  if (!['super_admin', 'superadmin'].includes(authUser.role ?? '')) {
    return { success: false, error: 'Forbidden' };
  }
  if (id === authUser.id) {
    return { success: false, error: 'Cannot delete your own account' };
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!existingUser) {
      return { success: false, error: 'User not found' };
    }

    await prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        sessionVersion: { increment: 1 },
        updatedAt: new Date(),
      },
    });
    revalidatePath('/company/admin');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error deleting user:', error);
    return { success: false, error: (error as Error).message };
  }
}





/**
 * Notify all Superadmins and Chief of Growth users of a new user registration.
 */
async function notifyAdminsOfNewRegistration(newUser: any) {
  try {
    const admins = await prisma.user.findMany({
      where: {
        role: {
          in: ['superadmin', 'chief_of_growth']
        }
      },
      select: { id: true }
    });

    if (!admins.length) return;

    const name = [newUser.firstName, newUser.lastName].filter(Boolean).join(' ') || newUser.email || 'New User';

    const notificationsData = admins.map(admin => ({
      userId: admin.id,
      title: 'New User Registration',
      message: `${name} has registered on the platform as a ${newUser.role || 'customer'}.`,
      type: 'registration',
      priority: 'medium',
      actionUrl: '/admin/chief-of-growth',
      data: {
        registeredUserId: newUser.id,
        role: newUser.role || 'customer'
      }
    }));

    await prisma.notification.createMany({
      data: notificationsData
    });
  } catch (error) {
    console.error('Failed to notify admins of new registration:', error);
  }
}

type RoleChangeActor = {
  id: string;
  name?: string;
  role?: string;
  companyId?: string;
};

async function setUserRole(
  targetId: string,
  actor: RoleChangeActor,
  role: string,
) {
  try {
    const targetUser = await prisma.user.findFirst({
      where: { OR: [{ id: targetId }, { uid: targetId }] },
    });
    if (!targetUser) {
      return { success: false, error: 'User not found' };
    }

    const [user] = await prisma.$transaction([
      prisma.user.update({
        where: { id: targetUser.id },
        data: { role, sessionVersion: { increment: 1 }, updatedAt: new Date() },
      }),
      prisma.activityLog.create({
        data: {
          userId: actor.id,
          action: 'update_user_role',
          description: `Set user ${targetUser.id} role to ${role}`,
          companyId: actor.companyId || null,
          metadata: {
            targetUserId: targetUser.id,
            targetRole: role,
            actorName: actor.name || '',
            actorRole: actor.role || '',
          },
        },
      }),
    ]);

    revalidatePath('/company/admin');
    return { success: true, data: user };
  } catch (error: unknown) {
    console.error(`Error setting user role to ${role}:`, error);
    return { success: false, error: (error as Error).message };
  }
}

export async function setUserSuperAdmin(targetId: string, actor: RoleChangeActor) {
  return setUserRole(targetId, actor, 'superadmin');
}

export async function setUserChiefOfGrowth(targetId: string, actor: RoleChangeActor) {
  return setUserRole(targetId, actor, 'chief_of_growth');
}

export async function setUserCompanyAdmin(targetId: string, actor: RoleChangeActor) {
  return setUserRole(targetId, actor, 'company_admin');
}

export async function setUserOperator(targetId: string, actor: RoleChangeActor) {
  return setUserRole(targetId, actor, 'operator');
}





/**
 * Update operator assignments (region, status, and routes) in both User and Operator tables.
 */
export async function updateOperatorAssignments(id: string, data: { regionId?: string | null; routeIds?: string[]; status?: string }) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { success: false, error: 'Invalid operator assignment data' };
  }

  const allowedFields = new Set(['regionId', 'status', 'routeIds']);
  const unknownFields = Object.keys(data).filter((field) => !allowedFields.has(field));
  if (unknownFields.length > 0) {
    return { success: false, error: `Unsupported operator assignment field(s): ${unknownFields.join(', ')}` };
  }

  if (data.regionId !== undefined && data.regionId !== null && typeof data.regionId !== 'string') {
    return { success: false, error: 'regionId must be a string or null' };
  }

  if (data.status !== undefined && (!['active', 'inactive'].includes(data.status) || typeof data.status !== 'string')) {
    return { success: false, error: 'status must be active or inactive' };
  }

  if (data.routeIds !== undefined && (!Array.isArray(data.routeIds) || !data.routeIds.every((routeId) => typeof routeId === 'string'))) {
    return { success: false, error: 'routeIds must be an array of strings' };
  }

  try {
    // 1. Resolve operator user
    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: { role: true, companyId: true, email: true, firstName: true, lastName: true }
    });
    if (!existingUser) return { success: false, error: 'User not found' };

    const companyId = existingUser.companyId;

    // 2. Perform database transaction with a longer timeout because route updates
    // can take longer on cold or busy database connections.
    await prisma.$transaction(async (tx) => {
      // Update User table status and region (region string)
      const userUpdate: any = {
        updatedAt: new Date()
      };
      if (data.status) {
        userUpdate.isActive = data.status === 'active';
        if (data.status === 'active') {
          userUpdate.setupCompleted = true;
        }
      }
      
      if ('regionId' in data) {
        let regionName = null;
        if (data.regionId) {
          const reg = await tx.region.findUnique({ where: { id: data.regionId } });
          if (reg) regionName = reg.name;
        }
        userUpdate.region = regionName;
      }

      await tx.user.update({
        where: { id },
        data: userUpdate
      });

      // Update Operator table record if it exists (or create it if it doesn't)
      const operatorUpdate: any = {
        updatedAt: new Date()
      };
      if (data.status) {
        operatorUpdate.status = data.status;
      }
      if ('regionId' in data) {
        operatorUpdate.regionId = data.regionId || null;
      }

      const existingOperator = await tx.operator.findUnique({
        where: { id },
        select: { id: true }
      }) ?? await tx.operator.findUnique({
        where: { uid: id },
        select: { id: true }
      });

      const operatorRecordId = existingOperator?.id ?? id;

      if (existingOperator) {
        await tx.operator.update({
          where: { id: operatorRecordId },
          data: operatorUpdate
        });
      } else {
        await tx.operator.create({
          data: {
            id,
            uid: id,
            companyId: companyId || '',
            companyName: '',
            email: existingUser.email || '',
            name: `${existingUser.firstName} ${existingUser.lastName}`.trim() || 'Operator',
            role: existingUser.role || 'operator',
            status: data.status || 'active',
            regionId: data.regionId || null,
          }
        });
      }

      // Apply route relationships explicitly after the operator record exists.
      if (Array.isArray(data.routeIds)) {
        await tx.operator.update({
          where: { id: operatorRecordId },
          data: {
            routes: {
              set: []
            }
          }
        });

        if (data.routeIds.length > 0) {
          await tx.operator.update({
            where: { id: operatorRecordId },
            data: {
              routes: {
                connect: data.routeIds.map(rid => ({ id: rid }))
              }
            }
          });
        }
      }

    }, {
      timeout: 30000,
      maxWait: 10000,
    });

    revalidatePath('/company/admin');
    revalidatePath('/company/operator/dashboard');
    return { success: true };
  } catch (error: any) {
    console.error('Error updating operator assignments:', error);
    return { success: false, error: error.message };
  }
}
