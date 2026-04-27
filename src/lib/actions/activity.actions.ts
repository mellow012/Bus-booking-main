'use server'

import prisma from '../prisma';
import { revalidatePath } from 'next/cache';

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
    const logs = await prisma.activityLog.findMany({
      where: {
        companyId: params.companyId,
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
  data: object;
}) {
  try {
    const notification = await (prisma as unknown as {
      notification: { create: (o: object) => Promise<unknown> }
    }).notification.create({
      data: {
        userId: data.userId as string,
        title: data.title as string,
        message: data.message as string,
        type: data.type as string,
        priority: (data.priority as string) || 'medium',
        actionUrl: data.actionUrl as string,
        data: data.data as object,
      },
    });
    return { success: true, data: notification };
  } catch (error: unknown) {
    console.error('Error creating notification:', error);
    return { success: false, error: (error as Error).message };
  }
}
