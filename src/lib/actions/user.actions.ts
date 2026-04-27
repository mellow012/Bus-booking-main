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

    // 1. Find existing record by any unique identifier
    // We check id, uid, and email to handle migration discrepancies
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { id },
          { uid: id },
          { email: updatableData.email || undefined }
        ].filter(Boolean) as any
      }
    });

    let user;
    if (existing) {
      // 2. Update existing record using its official primary key
      user = await prisma.user.update({
        where: { id: existing.id },
        data: {
          ...(updatableData as any),
          updatedAt: new Date(),
        }
      });
    } else {
      // 3. Create new record if none found
      user = await prisma.user.create({
        data: {
          id,
          uid: id, // Keep uid in sync for legacy compatibility
          ...(updatableData as any),
          firstName: updatableData.firstName || '',
          lastName: updatableData.lastName || '',
          email: updatableData.email || '',
          role: updatableData.role || 'customer',
        },
      });
    }

    return { success: true, data: user as User };
  } catch (error: unknown) {
    console.error('Error syncing user:', error);
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
