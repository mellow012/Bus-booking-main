/**
 * POST /api/notifications/send
 * Send notification to one or multiple users
 * Only admins and authorized systems can send
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendNotificationToUser, broadcastNotification } from '@/lib/fcmService';
import { z } from 'zod';
import { notificationSchema } from '@/lib/validationSchemas';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    if (!user) {
      await logger.logError('notification', 'Auth verification failed on notification send', new Error('No user'), {});
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Missing or invalid authentication session' },
        { status: 401 }
      );
    }

    const userId = user.id;
    const userRole = user.role || 'customer';

    // Check authorization - only admins and system can send
    const ALLOWED_ROLES = ['superadmin', 'company_admin', 'operator']; // Added operator as they might need to send notifications
    if (!ALLOWED_ROLES.includes(userRole)) {
      await logger.logSecurityEvent('Unauthorized notification send attempt', request.headers.get('x-forwarded-for') || 'unknown', {
        userId,
        action: 'notification_unauthorized_send',
        metadata: { userRole },
      });

      return NextResponse.json(
        { error: 'Unauthorized. Only admins can send notifications' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const { recipientIds, title, body: messageBody, data, icon, clickAction } = notificationSchema.parse(body);

    // Log the notification send attempt
    await logger.logSuccess('notification', 'Starting notification broadcast', {
      userId,
      action: 'notification_send_initiated',
      metadata: {
        recipientCount: recipientIds.length,
        title,
      },
    });

    // 1. Get SQL IDs for recipients (passed as Supabase/Firebase IDs)
    const sqlUsers = await prisma.user.findMany({
      where: { id: { in: recipientIds } },
      select: { id: true }
    });

    // 2. Persist notifications in SQL database
    if (sqlUsers.length > 0) {
      await (prisma as any).notification.createMany({
        data: sqlUsers.map(u => ({
          userId: u.id,
          title,
          message: messageBody,
          type: body.type || 'system',
          priority: body.priority || 'medium',
          actionUrl: clickAction || null,
          data: data || {},
        }))
      });
    }

    // 3. Broadcast via FCM (fcmService still handles Firebase Admin FCM initialization)
    const results = await broadcastNotification(recipientIds, {
      title,
      body: messageBody,
      icon,
      data: data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : undefined,
      clickAction,
    });

    // Calculate statistics
    const successCount = Object.values(results.results).filter(
      (r: any) => r.success || r.tokensSent > 0
    ).length;
    const failureCount = recipientIds.length - successCount;

    await logger.logSuccess('notification', 'Notification broadcast completed', {
      userId,
      action: 'notification_send_completed',
      metadata: {
        recipientCount: recipientIds.length,
        successCount,
        failureCount,
        totalTokensSent: results.totalSent,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Notifications sent',
        statistics: {
          recipientCount: recipientIds.length,
          successCount,
          failureCount,
          totalTokensSent: results.totalSent,
        },
        details: results.results,
      },
      { status: 200 }
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      await logger.logWarning('notification', 'Notification send validation error', {
        userId: 'unknown',
        action: 'notification_validation_error',
        metadata: {
          issues: error.issues,
        },
      });

      return NextResponse.json(
        {
          error: 'Validation error',
          issues: error.issues,
          success: false,
        },
        { status: 400 }
      );
    }

    await logger.logError('notification', 'Notification send failed', error, {
      action: 'notification_send_error',
    });

    return NextResponse.json(
      {
        error: 'Failed to send notifications',
        message: error.message,
        success: false,
      },
      { status: 500 }
    );
  }
}

