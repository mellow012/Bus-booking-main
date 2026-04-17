/**
 * POST /api/notifications/mark-all-read
 * Mark all unread notifications as read for a user
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const schema = z.object({
  userId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = schema.parse(body);

    const result = await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    await logger.logSuccess('notification', 'Marked all notifications as read', {
      userId,
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    await logger.logError('notification', 'Failed to mark all notifications as read', error, {
      action: 'mark_all_read_error',
    });

    return NextResponse.json(
      { success: false, error: 'Failed to update notifications' },
      { status: 500 }
    );
  }
}

