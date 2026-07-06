/**
 * POST /api/notifications/mark-all-read
 * Mark all unread notifications as read for a user
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized', message: 'Missing or invalid authentication session' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({} as any));
    const requestedUserId = body?.userId;
    const targetUserId = user.role === 'superadmin' && requestedUserId ? requestedUserId : user.id;

    const result = await prisma.notification.updateMany({
      where: {
        userId: targetUserId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    await logger.logSuccess('notification', 'Marked all notifications as read', {
      userId: targetUserId,
      action: 'mark_all_read',
      metadata: {
        count: result.count,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Marked ${result.count} notifications as read`,
      count: result.count,
    });
  } catch (error: any) {
    await logger.logError('notification', 'Failed to mark all notifications as read', error, {
      action: 'mark_all_read_error',
    });

    return NextResponse.json(
      { success: false, error: 'Failed to update notifications' },
      { status: 500 }
    );
  }
}

