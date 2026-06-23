'use server'

import prisma from '../prisma';
import { revalidatePath } from 'next/cache';
import { UserProfile as User } from '@/types';

/**
 * --- Users ---
 */
export async function getUserById(id: string) {
  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id },
          { uid: id }
        ]
      },
      orderBy: {
        setupCompleted: 'desc'
      }
    });
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
    // This handles cases where the id might be stored differently
    if (!existing && id && email) {
      existing = await prisma.user.findUnique({ where: { email } });
    }

    const updateData: any = {
      ...(updatableData as any),
      updatedAt: new Date(),
    };

    if (existing) {
      // Update existing record
      if (existing.uid !== id) {
        updateData.uid = id;
      }
      // Ensure id is set if it's not already
      if (existing.id !== id) {
        // Don't change the primary id, but sync the uid
      }
      const user = await prisma.user.update({
        where: { id: existing.id },
        data: updateData,
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
      'invitationSentAt', 'createdBy'
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
  try {
    await prisma.user.delete({ where: { id } });
    revalidatePath('/company/admin');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error deleting user:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Set a user to `super_admin` role. Atomically updates role and sessionVersion
 * and creates an ActivityLog entry recording the change.
 */
export async function setUserSuperAdmin(targetId: string, actor: { id: string; name?: string; role?: string; companyId?: string }) {
  try {
    const targetUser = await prisma.user.findFirst({
      where: {
        OR: [
          { id: targetId },
          { uid: targetId }
        ]
      }
    });
    if (!targetUser) {
      return { success: false, error: 'User not found' };
    }

    const [user, log] = await prisma.$transaction([
      prisma.user.update({
        where: { id: targetUser.id },
        data: ( { role: 'superadmin', sessionVersion: { increment: 1 }, updatedAt: new Date() } as any ),
      }),
      prisma.activityLog.create({
        data: {
          userId: actor.id,
          action: 'update_user_role',
          description: `Set user ${targetUser.id} role to superadmin`,
          companyId: actor.companyId || null,
          metadata: {
            targetUserId: targetUser.id,
            targetRole: 'superadmin',
            actorName: actor.name || '',
            actorRole: actor.role || '',
          },
        },
      }),
    ]);
    revalidatePath('/company/admin');
    return { success: true, data: user };
  } catch (error: unknown) {
    console.error('Error setting user super admin:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Set a user to `chief_of_growth` role. Atomically updates role and sessionVersion
 * and creates an ActivityLog entry recording the change.
 */
export async function setUserChiefOfGrowth(targetId: string, actor: { id: string; name?: string; role?: string; companyId?: string }) {
  try {
    const targetUser = await prisma.user.findFirst({
      where: {
        OR: [
          { id: targetId },
          { uid: targetId }
        ]
      }
    });
    if (!targetUser) {
      return { success: false, error: 'User not found' };
    }

    const [user, log] = await prisma.$transaction([
      prisma.user.update({
        where: { id: targetUser.id },
        data: ( { role: 'chief_of_growth', sessionVersion: { increment: 1 }, updatedAt: new Date() } as any ),
      }),
      prisma.activityLog.create({
        data: {
          userId: actor.id,
          action: 'update_user_role',
          description: `Set user ${targetUser.id} role to chief_of_growth`,
          companyId: actor.companyId || null,
          metadata: {
            targetUserId: targetUser.id,
            targetRole: 'chief_of_growth',
            actorName: actor.name || '',
            actorRole: actor.role || '',
          },
        },
      }),
    ]);
    revalidatePath('/company/admin');
    return { success: true, data: user };
  } catch (error: unknown) {
    console.error('Error setting user chief of growth:', error);
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

/**
 * Set a user to `company_admin` role. Atomically updates role and sessionVersion
 * and creates an ActivityLog entry recording the change.
 */
export async function setUserCompanyAdmin(targetId: string, actor: { id: string; name?: string; role?: string; companyId?: string }) {
  try {
    const targetUser = await prisma.user.findFirst({
      where: {
        OR: [
          { id: targetId },
          { uid: targetId }
        ]
      }
    });
    if (!targetUser) {
      return { success: false, error: 'User not found' };
    }

    const [user, log] = await prisma.$transaction([
      prisma.user.update({
        where: { id: targetUser.id },
        data: ( { role: 'company_admin', sessionVersion: { increment: 1 }, updatedAt: new Date() } as any ),
      }),
      prisma.activityLog.create({
        data: {
          userId: actor.id,
          action: 'update_user_role',
          description: `Set user ${targetUser.id} role to company_admin`,
          companyId: actor.companyId || null,
          metadata: {
            targetUserId: targetUser.id,
            targetRole: 'company_admin',
            actorName: actor.name || '',
            actorRole: actor.role || '',
          },
        },
      }),
    ]);
    revalidatePath('/company/admin');
    return { success: true, data: user };
  } catch (error: unknown) {
    console.error('Error setting user company admin:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Set a user to `operator` role. Atomically updates role and sessionVersion
 * and creates an ActivityLog entry recording the change.
 */
export async function setUserOperator(targetId: string, actor: { id: string; name?: string; role?: string; companyId?: string }) {
  try {
    const targetUser = await prisma.user.findFirst({
      where: {
        OR: [
          { id: targetId },
          { uid: targetId }
        ]
      }
    });
    if (!targetUser) {
      return { success: false, error: 'User not found' };
    }

    const [user, log] = await prisma.$transaction([
      prisma.user.update({
        where: { id: targetUser.id },
        data: ( { role: 'operator', sessionVersion: { increment: 1 }, updatedAt: new Date() } as any ),
      }),
      prisma.activityLog.create({
        data: {
          userId: actor.id,
          action: 'update_user_role',
          description: `Set user ${targetUser.id} role to operator`,
          companyId: actor.companyId || null,
          metadata: {
            targetUserId: targetUser.id,
            targetRole: 'operator',
            actorName: actor.name || '',
            actorRole: actor.role || '',
          },
        },
      }),
    ]);
    revalidatePath('/company/admin');
    return { success: true, data: user };
  } catch (error: unknown) {
    console.error('Error setting user operator:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Update operator assignments (region, status, and routes) in both User and Operator tables.
 */
export async function updateOperatorAssignments(id: string, data: { regionId?: string | null; routeIds?: string[]; status?: string }) {
  try {
    // 1. Resolve operator user
    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: { role: true, companyId: true, email: true, firstName: true, lastName: true }
    });
    if (!existingUser) return { success: false, error: 'User not found' };

    const companyId = existingUser.companyId;

    // 2. Perform database transaction
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
      
      let regionName = null;
      if (data.regionId) {
        const reg = await tx.region.findUnique({ where: { id: data.regionId } });
        if (reg) regionName = reg.name;
      }
      userUpdate.region = regionName;

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
      operatorUpdate.regionId = data.regionId || null;

      // Update route relationships
      if (data.routeIds) {
        // Disconnect from all routes first
        await tx.operator.update({
          where: { id },
          data: {
            routes: {
              set: [] // clears all routes
            }
          }
        });

        // Connect new routes
        operatorUpdate.routes = {
          connect: data.routeIds.map(rid => ({ id: rid }))
        };
      }

      await tx.operator.upsert({
        where: { id },
        update: operatorUpdate,
        create: {
          id,
          uid: id,
          companyId: companyId || '',
          companyName: '', // can be populated or empty
          email: existingUser.email || '',
          name: `${existingUser.firstName} ${existingUser.lastName}`.trim() || 'Operator',
          role: existingUser.role || 'operator',
          status: data.status || 'active',
          regionId: data.regionId || null,
          routes: data.routeIds && data.routeIds.length > 0 ? {
            connect: data.routeIds.map(rid => ({ id: rid }))
          } : undefined
        }
      });

      // Sync route assignedOperatorIds/assignedConductorIds arrays
      if (companyId) {
        const allRoutes = await tx.route.findMany({
          where: { companyId }
        });

        for (const route of allRoutes) {
          const isAssigned = data.routeIds?.includes(route.id);
          
          if (existingUser.role === 'operator') {
            let updatedIds = route.assignedOperatorIds || [];
            if (isAssigned) {
              updatedIds = Array.from(new Set([...updatedIds, id]));
            } else {
              updatedIds = updatedIds.filter(x => x !== id);
            }
            await tx.route.update({
              where: { id: route.id },
              data: { assignedOperatorIds: updatedIds }
            });
          } else if (existingUser.role === 'conductor') {
            let updatedIds = route.assignedConductorIds || [];
            if (isAssigned) {
              updatedIds = Array.from(new Set([...updatedIds, id]));
            } else {
              updatedIds = updatedIds.filter(x => x !== id);
            }
            await tx.route.update({
              where: { id: route.id },
              data: { assignedConductorIds: updatedIds }
            });
          }
        }
      }
    });

    revalidatePath('/company/admin');
    revalidatePath('/company/operator/dashboard');
    return { success: true };
  } catch (error: any) {
    console.error('Error updating operator assignments:', error);
    return { success: false, error: error.message };
  }
}
