/**
 * Notification Service — Supabase Native (replaces Firebase FCM)
 * 
 * Strategy:
 *  1. Write notification to `Notification` table in Postgres (persistent, auditable)
 *  2. Supabase Realtime broadcasts it live to any connected clients
 *  3. Web Push API sends a browser notification if the user has a push subscription
 * 
 * This removes all Firebase Admin SDK dependencies.
 */

import prisma from './prisma';
import { logger } from './logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  clickAction?: string;
  data?: Record<string, string>;
  priority?: 'low' | 'medium' | 'high';
  type?: string;
}

interface SendResult {
  success: boolean;
  notificationId?: string;
  error?: string;
}

// ─── Core: Write to DB (triggers Supabase Realtime) ──────────────────────────

/**
 * Creates a persistent notification record in the database.
 * Supabase Realtime will broadcast the INSERT event to any subscribed clients.
 */
export async function sendNotificationToUser(
  userId: string,
  payload: NotificationPayload
): Promise<SendResult> {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        title: payload.title,
        message: payload.body,
        type: payload.type || 'system',
        priority: payload.priority || 'medium',
        actionUrl: payload.clickAction,
        data: payload.data ? payload.data : undefined,
        isRead: false,
      },
    });

    // Optionally send Web Push if subscription exists
    await sendWebPushToUser(userId, payload);

    await logger.logSuccess('notification', 'Notification sent to user', {
      userId,
      action: 'notification_sent',
      metadata: { notificationId: notification.id, title: payload.title },
    });

    return { success: true, notificationId: notification.id };
  } catch (error: any) {
    await logger.logError('notification', 'Failed to send notification', error, {
      userId,
      action: 'notification_send_failed',
    });
    return { success: false, error: error.message };
  }
}

/**
 * Broadcasts to multiple users — creates one DB record per user.
 */
export async function broadcastNotification(
  userIds: string[],
  payload: NotificationPayload
): Promise<{ totalSent: number; results: Record<string, SendResult> }> {
  const results: Record<string, SendResult> = {};
  let totalSent = 0;

  const BATCH = 50;
  for (let i = 0; i < userIds.length; i += BATCH) {
    const batch = userIds.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (userId) => {
        const result = await sendNotificationToUser(userId, payload);
        results[userId] = result;
        if (result.success) totalSent++;
      })
    );
  }

  await logger.logSuccess('notification', 'Broadcast notifications completed', {
    action: 'notification_broadcast',
    metadata: { userCount: userIds.length, totalSent },
  });

  return { totalSent, results };
}

// ─── Web Push (optional — requires VAPID keys) ───────────────────────────────

/**
 * Sends a Web Push notification to all subscriptions stored for a user.
 * Requires a VAPID key pair: set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in env.
 * 
 * If VAPID keys are not set, this silently skips (graceful degradation).
 * Supabase Realtime handles in-app delivery regardless.
 */
async function sendWebPushToUser(userId: string, payload: NotificationPayload): Promise<void> {
  const vapidPublic  = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:support@tibhukebus.com';

  if (!vapidPublic || !vapidPrivate) {
    // Web Push not configured — Supabase Realtime handles in-app delivery
    return;
  }

  try {
    // Fetch push subscriptions stored in the user's profile
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fcmTokens: true }, // Re-using fcmTokens field to store JSON push subscriptions
    });

    if (!user?.fcmTokens) return;

    const subscriptions = user.fcmTokens as any[];
    if (!Array.isArray(subscriptions) || subscriptions.length === 0) return;

    const webpush = await import('web-push').catch(() => null);
    if (!webpush) {
      console.warn('[NotificationService] web-push package not installed. Run: npm install web-push');
      return;
    }

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/tibhukebus_logo_transparent.png',
      badge: '/badge-72x72.png',
      data: { url: payload.clickAction || '/', ...payload.data },
    });

    await Promise.allSettled(
      subscriptions.map((sub) => webpush.sendNotification(sub, pushPayload))
    );
  } catch (error: any) {
    // Non-fatal: in-app notification was already saved
    console.warn('[NotificationService] Web Push failed (non-fatal):', error.message);
  }
}

// ─── Legacy shim: retain sendNotificationToToken signature ───────────────────

/**
 * @deprecated Use sendNotificationToUser instead.
 * Kept for backward compatibility while callers are updated.
 */
export async function sendNotificationToToken(
  _token: string,
  payload: NotificationPayload,
  userId?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!userId) return { success: false, error: 'userId required for Supabase notifications' };
  const result = await sendNotificationToUser(userId, payload);
  return { success: result.success, messageId: result.notificationId, error: result.error };
}

/**
 * @deprecated Token management no longer needed (no FCM tokens).
 */
export async function deleteUserToken(_userId: string, _token: string): Promise<void> {
  // No-op: Web Push subscriptions are managed client-side
}
