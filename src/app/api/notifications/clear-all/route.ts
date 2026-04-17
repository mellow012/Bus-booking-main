/**
 * POST /api/notifications/clear-all
 * Delete all notifications for a user
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

    const result = await prisma.notification.deleteMany({
      where: { userId },
    });

    await logger.logSuccess('notification', 'Cleared all notifications', {
      userId,
      action: 'clear_all',
      metadata: {
        count: result.count,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Deleted ${result.count} notifications`,
      count: result.count,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    await logger.logError('notification', 'Failed to clear notifications', error, {
      action: 'clear_all_error',
    });

    return NextResponse.json(
      { success: false, error: 'Failed to delete notifications' },
      { status: 500 }
    );
  }
}

