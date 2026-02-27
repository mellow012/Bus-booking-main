/**
 * POST /api/notifications/send
 * Send notification to one or multiple users
 * Only admins and authorized systems can send
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { logger } from '@/lib/logger';
import { sendNotificationToUser, broadcastNotification } from '@/lib/fcmService';
import { z } from 'zod';
import { notificationSchema } from '@/lib/validationSchemas';

export async function POST(request: NextRequest) {
  try {
    // Get authorization token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const idToken = authHeader.substring(7);
    let userId: string;
    let userRole: string;

    // Verify ID token
    try {
      const decodedToken = await adminAuth.verifyIdToken(idToken, true);
      userId = decodedToken.uid;
      userRole = decodedToken.customClaims?.role || 'customer';
    } catch (error: any) {
      await logger.logError('notification', 'Token verification failed on notification send', error, {});
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Check authorization - only admins and system can send
    const ALLOWED_ROLES = ['superadmin', 'company_admin'];
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

    // Send notifications
    const results = await broadcastNotification(recipientIds, {
      title,
      body: messageBody,
      icon,
      data,
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
