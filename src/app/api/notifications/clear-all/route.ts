/**
 * POST /api/notifications/clear-all
 * Delete all notifications for a user
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

    const result = await prisma.notification.deleteMany({
      where: { userId: targetUserId },
    });

    await logger.logSuccess('notification', 'Cleared all notifications', {
      userId: targetUserId,
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
    await logger.logError('notification', 'Failed to clear notifications', error, {
      action: 'clear_all_error',
    });

    return NextResponse.json(
      { success: false, error: 'Failed to delete notifications' },
      { status: 500 }
    );
  }
}

