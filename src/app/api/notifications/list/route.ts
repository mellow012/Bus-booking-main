/**
 * GET /api/notifications/list
 * Get notifications for a user with polling support
 * Used by NotificationContext for periodic polling (5s intervals)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(request: NextRequest) {
  try {
    // ── Auth & Security ──────────────────────────────────────────────────────
    // We expect the user to be authenticated via Supabase session
    const user = await getCurrentUser(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Missing or invalid authentication session' },
        { status: 401 }
      );
    }

    const requestedUserId = request.nextUrl.searchParams.get('userId');

    // Security check: ensure user can only see their own notifications
    // (unless they are a superadmin or similar authorized role)
    if (requestedUserId && requestedUserId !== user.id && user.role !== 'superadmin') {
      await logger.logSecurityEvent('Unauthorized notification list access attempt', request.headers.get('x-forwarded-for') || 'unknown', {
        userId: user.id,
        action: 'notification_list_unauthorized',
        metadata: { requestedUserId },
      });
      return NextResponse.json(
        { error: 'Forbidden', message: 'You can only view your own notifications' },
        { status: 403 }
      );
    }

    const userId = requestedUserId || user.id;

    // ── Fetch notifications ──────────────────────────────────────────────────
    const limit = Math.min(
      parseInt(request.nextUrl.searchParams.get('limit') || String(DEFAULT_LIMIT)),
      MAX_LIMIT
    );

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        userId: true,
        type: true,
        title: true,
        message: true,
        data: true,
        actionUrl: true,
        priority: true,
        isRead: true,
        readAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: notifications.map(n => ({
        id: n.id,
        userId: n.userId,
        type: n.type,
        title: n.title,
        message: n.message,
        data: n.data || {},
        actionUrl: n.actionUrl,
        priority: n.priority,
        isRead: n.isRead,
        readAt: n.readAt,
        createdAt: n.createdAt,
      })),
      count: notifications.length,
    });
  } catch (error: any) {
    await logger.logError('notification', 'Failed to fetch notifications', error, {
      action: 'list_error',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch notifications',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

