/**
 * POST /api/notifications/mark-read
 * Mark a single notification as read
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const schema = z.object({
  notificationId: z.string().min(1),
});

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', message: 'Missing or invalid authentication session' }, { status: 401 });
    }

    const body = await request.json();
    const { notificationId } = schema.parse(body);

    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
      select: { userId: true },
    });

    if (!notification) {
      return NextResponse.json({ success: false, error: 'Notification not found' }, { status: 404 });
    }

    if (notification.userId !== user.id && user.role !== 'superadmin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    await logger.logError('notification', 'Failed to mark notification as read', error, {
      action: 'mark_read_error',
    });

    return NextResponse.json(
      { success: false, error: 'Failed to update notification' },
      { status: 500 }
    );
  }
}

