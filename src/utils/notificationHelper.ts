import { db } from '@/lib/firebaseConfig';
import { addDoc, collection, Timestamp } from 'firebase/firestore';

export interface SendNotificationParams {
  userId: string;
  type: 'booking' | 'payment' | 'schedule' | 'system' | 'promotion' | 'alert';
  title: string;
  message: string;
  data?: any;
  actionUrl?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

export async function sendNotification({
  userId,
  type,
  title,
  message,
  data = {},
  actionUrl,
  priority = 'medium'
}: SendNotificationParams) {
  try {
    await addDoc(collection(db, 'notifications'), {
      userId,
      type,
      title,
      message,
      data,
      actionUrl,
      priority,
      isRead: false,
      createdAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
}

// Batch notification helper for multiple users
export async function sendBulkNotification({
  userIds,
  type,
  title,
  message,
  data = {},
  actionUrl,
  priority = 'medium'
}: {
  userIds: string[];
  type: string;
  title: string;
  message: string;
  data?: any;
  actionUrl?: string;
  priority?: string;
}) {
  try {
    const batch = [];
    for (const userId of userIds) {
      batch.push(
        addDoc(collection(db, 'notifications'), {
          userId,
          type,
          title,
          message,
          data,
          actionUrl,
          priority,
          isRead: false,
          createdAt: Timestamp.now(),
        })
      );
    }
    await Promise.all(batch);
  } catch (error) {
    console.error('Error sending bulk notifications:', error);
    throw error;
  }
}

// Pre-built notification templates
export const NotificationTemplates = {
  bookingConfirmed: (bookingId: string, route: string) => ({
    type: 'booking' as const,
    title: 'Booking Confirmed! 🎉',
    message: `Your booking for ${route} has been confirmed.`,
    actionUrl: `/bookings/${bookingId}`,
    priority: 'high' as const,
  }),

  paymentReceived: (amount: number, bookingId: string) => ({
    type: 'payment' as const,
    title: 'Payment Received',
    message: `We've received your payment of MWK ${amount.toLocaleString()}.`,
    actionUrl: `/bookings/${bookingId}`,
    priority: 'medium' as const,
  }),

  scheduleChanged: (route: string, newTime: string) => ({
    type: 'schedule' as const,
    title: 'Schedule Update',
    message: `The departure time for ${route} has been changed to ${newTime}.`,
    priority: 'high' as const,
  }),

  promotionAlert: (discount: number, validUntil: string) => ({
    type: 'promotion' as const,
    title: `${discount}% Off Your Next Trip! 🎁`,
    message: `Limited time offer valid until ${validUntil}.`,
    actionUrl: '/schedules',
    priority: 'low' as const,
  }),

  systemMaintenance: (date: string) => ({
    type: 'system' as const,
    title: 'Scheduled Maintenance',
    message: `System maintenance scheduled for ${date}. Some features may be temporarily unavailable.`,
    priority: 'medium' as const,
  }),
};
