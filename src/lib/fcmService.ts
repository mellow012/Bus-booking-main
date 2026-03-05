/**
 * Firebase Cloud Messaging Service (Admin SDK)
 *
 * FIX F-19: broadcastNotification() previously iterated userIds with a
 * for...of loop awaiting each sendNotificationToUser() call sequentially.
 * For 1,000 recipients this takes 100+ seconds.
 *
 * It now uses Promise.all() with a configurable batch size (default 50) so
 * notifications are sent in parallel within each batch, capped to avoid
 * overwhelming FCM's per-project quota limits.
 */

import { adminDb, adminMessaging } from './firebaseAdmin';
import { logger } from './logger';
import * as admin from 'firebase-admin';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, string>;
  clickAction?: string;
}

// ─── Single token ─────────────────────────────────────────────────────────────

export async function sendNotificationToToken(
  token: string,
  payload: NotificationPayload,
  userId?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const message: admin.messaging.Message = {
      token,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.icon,
      },
      data: payload.data || {},
      android: {
        ttl: 86_400,
        priority: 'high',
        notification: {
          title: payload.title,
          body: payload.body,
          icon: payload.icon || '/icon-192x192.png',
          sound: 'default',
        },
      },
      webpush: {
        headers: { TTL: '86400' },
        notification: {
          title: payload.title,
          body: payload.body,
          icon: payload.icon || '/icon-192x192.png',
          badge: payload.badge || '/badge-72x72.png',
          clickAction: payload.clickAction || '/',
        },
        data: payload.data,
      },
      apns: {
        headers: { 'apns-priority': '10' },
        payload: {
          aps: {
            alert: { title: payload.title, body: payload.body },
            sound: 'default',
            badge: 1,
            'mutable-content': 1,
          },
        },
      },
    };

    const messageId = await adminMessaging.send(message);

    await logger.logSuccess('notification', 'FCM notification sent', {
      userId,
      action: 'notification_sent',
      metadata: { messageId, token: token.substring(0, 20) + '…', title: payload.title },
    });

    return { success: true, messageId };
  } catch (error: any) {
    await logger.logError('notification', 'Failed to send FCM notification', error, {
      userId,
      action: 'notification_send_failed',
      metadata: { tokenPreview: token.substring(0, 20) + '…' },
    });
    return { success: false, error: error.message };
  }
}

// ─── All devices for a single user ───────────────────────────────────────────

export async function sendNotificationToUser(
  userId: string,
  payload: NotificationPayload
): Promise<{ success: boolean; tokensSent: number; results: any[] }> {
  try {
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) throw new Error('User not found');

    const fcmTokens: string[] = userDoc.data()?.fcmTokens || [];
    if (fcmTokens.length === 0) {
      await logger.logWarning('notification', 'No FCM tokens found for user', {
        userId, action: 'notification_no_tokens',
      });
      return { success: false, tokensSent: 0, results: [] };
    }

    const results = await Promise.all(
      fcmTokens.map(token => sendNotificationToToken(token, payload, userId))
    );
    const successCount = results.filter(r => r.success).length;

    await logger.logSuccess('notification', 'FCM notifications sent to user', {
      userId,
      action: 'notification_batch_sent',
      metadata: { tokenCount: fcmTokens.length, successCount, failureCount: fcmTokens.length - successCount },
    });

    return { success: successCount > 0, tokensSent: successCount, results };
  } catch (error: any) {
    await logger.logError('notification', 'Failed to send notifications to user', error, {
      userId, action: 'notification_batch_failed',
    });
    return { success: false, tokensSent: 0, results: [] };
  }
}

// ─── Broadcast to many users ──────────────────────────────────────────────────
// FIX F-19: replaced sequential for...of await with batched Promise.all.
// Each batch of BATCH_SIZE users is dispatched in parallel. We wait for one
// batch to complete before starting the next to avoid hitting FCM quota limits.

const BROADCAST_BATCH_SIZE = 50;

export async function broadcastNotification(
  userIds: string[],
  payload: NotificationPayload
): Promise<{ totalSent: number; results: Record<string, any> }> {
  const results: Record<string, any> = {};
  let totalSent = 0;

  // Split userIds into chunks of BROADCAST_BATCH_SIZE
  for (let i = 0; i < userIds.length; i += BROADCAST_BATCH_SIZE) {
    const batch = userIds.slice(i, i + BROADCAST_BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map(userId =>
        sendNotificationToUser(userId, payload).then(result => ({ userId, result }))
      )
    );

    for (const { userId, result } of batchResults) {
      results[userId] = result;
      totalSent += result.tokensSent;
    }
  }

  await logger.logSuccess('notification', 'Broadcast notifications completed', {
    action: 'notification_broadcast',
    metadata: { userCount: userIds.length, totalSent },
  });

  return { totalSent, results };
}

// ─── Token cleanup ────────────────────────────────────────────────────────────

export async function deleteUserToken(userId: string, token: string): Promise<void> {
  try {
    await adminDb.collection('users').doc(userId).update({
      fcmTokens: admin.firestore.FieldValue.arrayRemove(token),
      updatedAt: new Date(),
    });
    await logger.logSuccess('notification', 'FCM token deleted', {
      userId, action: 'token_deleted',
      metadata: { tokenPreview: token.substring(0, 20) + '…' },
    });
  } catch (error: any) {
    await logger.logWarning('notification', 'Failed to delete FCM token', {
      userId, action: 'token_delete_failed',
    });
  }
}