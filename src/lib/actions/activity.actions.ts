'use server'

import prisma from '../prisma';
import { revalidatePath } from 'next/cache';
import { getCurrentUserFromServer } from '@/lib/auth-utils';

/**
 * --- Activity Logs ---
 */
export async function createActivityLog(data: {
  userId: string;
  action: string;
  description: string;
  companyId?: string;
  scheduleId?: string;
  metadata?: any;
}) {
  try {
    const log = await prisma.activityLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        description: data.description,
        companyId: data.companyId,
        scheduleId: data.scheduleId,
        metadata: data.metadata || {},
      },
    });
    if (data.companyId) revalidatePath('/company/admin');
    if (data.scheduleId) revalidatePath('/company/conductor/dashboard');
    return { success: true, data: log };
  } catch (error: unknown) {
    console.error('Error creating activity log:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function getActivityLogs(params: {
  companyId?: string;
  scheduleId?: string;
  limit?: number;
}) {
  try {
    const user = await getCurrentUserFromServer();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const platformWideRoles = ['super_admin', 'superadmin', 'chief_of_growth'];
    const isPlatformAdmin = platformWideRoles.includes(user.role ?? '');
    const companyId = isPlatformAdmin ? params.companyId : user.companyId ?? undefined;

    if (!isPlatformAdmin && !companyId) {
      return { success: false, error: 'Forbidden' };
    }

    const logs = await prisma.activityLog.findMany({
      where: {
        companyId,
        scheduleId: params.scheduleId,
      },
      orderBy: { createdAt: 'desc' },
      take: params.limit || 50,
      include: { user: true },
    });
    return { success: true, data: logs };
  } catch (error: unknown) {
    console.error('Error fetching activity logs:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * --- Notifications ---
 */
export async function createNotification(data: {
  userId: string;
  title: string;
  message: string;
  type: string;
  priority?: string;
  actionUrl?: string;
  data?: any;
}) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: data.userId,
        title: data.title,
        message: data.message,
        type: data.type,
        priority: data.priority || 'medium',
        actionUrl: data.actionUrl || null,
        data: data.data || {},
      },
    });
    return { success: true, data: notification };
  } catch (error: any) {
    console.error('Error creating notification:', error);
    return { success: false, error: error.message };
  }
}
