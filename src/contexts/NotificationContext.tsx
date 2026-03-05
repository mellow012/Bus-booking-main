'use client';
// FIX F-21: notificationHelper.ts has been DELETED.
// This file is now the single canonical source for:
//   - sendNotification()
//   - sendBulkNotification()
//   - NotificationTemplates
//   - NotificationProvider / useNotifications
//   - NotificationBell
//
// Any file that previously imported from notificationHelper.ts must be updated
// to import from this file instead:
//   import { sendNotification, NotificationTemplates } from '@/contexts/NotificationContext';
//
// FIX F-25: Notification type union is now consistent. The type field uses the
// same literal union everywhere — in the Notification type definition, in
// sendNotification params, and in NotificationTemplates. Previously the type
// definition used one set of values and the send-side used a different set.

import React, {
  createContext, useContext, useEffect, useState,
  ReactNode, useRef, useCallback,
} from 'react';
import { db } from '@/lib/firebaseConfig';
import {
  collection, query, where, orderBy, addDoc,
  onSnapshot, updateDoc, doc, writeBatch, Timestamp,
} from 'firebase/firestore';
import { Bell, X, Check, CheckCheck, Trash2 } from 'lucide-react';
import { Notification } from '@/types/index';

// ─── Types ────────────────────────────────────────────────────────────────────

// FIX F-25: Aligned with all emitted values from NotificationTemplates.
// Add any new notification type here AND to your Notification type in types/index.ts.
export type NotificationType =
  | 'booking'
  | 'payment'
  | 'schedule'
  | 'system'
  | 'promotion'
  | 'alert'
  | 'cancellation' // retained for legacy Firestore documents
  | 'cancellation_requested';

export interface SendNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  actionUrl?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearAll: () => Promise<void>;
  isLoading: boolean;
  sendNotification: (params: SendNotificationParams) => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationProvider');
  return context;
};

// ─── Provider ─────────────────────────────────────────────────────────────────

interface NotificationProviderProps {
  children: ReactNode;
  userId?: string;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children, userId }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate() || new Date(),
      } as Notification));
      setNotifications(data);
      setIsLoading(false);
    }, (error) => {
      console.error('Error fetching notifications:', error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { isRead: true, readAt: new Date() });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!userId || notifications.length === 0) return;
    try {
      const batch = writeBatch(db);
      notifications
        .filter(n => !n.isRead)
        .forEach(n => batch.update(doc(db, 'notifications', n.id), { isRead: true, readAt: new Date() }));
      await batch.commit();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }, [userId, notifications]);

  const clearAll = useCallback(async () => {
    if (!userId || notifications.length === 0) return;
    try {
      const batch = writeBatch(db);
      notifications.forEach(n => batch.delete(doc(db, 'notifications', n.id)));
      await batch.commit();
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  }, [userId, notifications]);

  // Bound version for context consumers
  const sendNotificationCtx = useCallback(async (params: SendNotificationParams) => {
    await sendNotification(params);
  }, []);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <NotificationContext.Provider value={{
      notifications, unreadCount,
      markAsRead, markAllAsRead, clearAll,
      isLoading, sendNotification: sendNotificationCtx,
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

// ─── NotificationBell UI ──────────────────────────────────────────────────────

export const NotificationBell: React.FC<{ userId: string; className?: string }> = ({ userId, className }) => {
  const { notifications, markAsRead, markAllAsRead, clearAll, unreadCount, isLoading } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-6 h-6 text-gray-600 hover:text-blue-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white shadow-lg rounded-lg z-50 border border-gray-200">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-semibold">Notifications</h3>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} className="p-1 hover:bg-blue-100 rounded" title="Mark all read">
                  <CheckCheck className="w-4 h-4 text-blue-600" />
                </button>
              )}
              <button onClick={clearAll} className="p-1 hover:bg-red-100 rounded" title="Clear all">
                <Trash2 className="w-4 h-4 text-red-600" />
              </button>
              <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-gray-500">Loading…</div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">No notifications</div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => { markAsRead(n.id); setIsOpen(false); }}
                  className={`p-3 hover:bg-gray-50 cursor-pointer flex items-start gap-2 ${!n.isRead ? 'bg-blue-50' : ''}`}
                >
                  <div className="text-blue-600 font-bold w-5 shrink-0">
                    {n.type.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className={`font-medium text-sm truncate ${!n.isRead ? 'text-gray-900' : 'text-gray-600'}`}>
                      {n.title}
                    </h4>
                    <p className={`text-xs ${!n.isRead ? 'text-gray-700' : 'text-gray-500'}`}>{n.message}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(n.createdAt).toLocaleString()}</p>
                  </div>
                  {!n.isRead && (
                    <button
                      onClick={e => { e.stopPropagation(); markAsRead(n.id); }}
                      className="p-1 hover:bg-blue-100 rounded shrink-0"
                    >
                      <Check className="w-4 h-4 text-blue-600" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Standalone helpers (canonical — imported everywhere) ─────────────────────

/** Write a single notification document to Firestore. */
export async function sendNotification({
  userId, type, title, message,
  data = {}, actionUrl, priority = 'medium',
}: SendNotificationParams): Promise<void> {
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined && v !== null)
  );
  await addDoc(collection(db, 'notifications'), {
    userId, type, title, message,
    data: cleanData,
    actionUrl: actionUrl || null,
    priority,
    isRead: false,
    createdAt: Timestamp.now(),
  });
}

/** Write notification documents for multiple users in parallel. */
export async function sendBulkNotification({
  userIds, type, title, message,
  data = {}, actionUrl, priority = 'medium',
}: {
  userIds: string[];
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  actionUrl?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}): Promise<void> {
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined && v !== null)
  );
  await Promise.all(
    userIds.map(uid =>
      addDoc(collection(db, 'notifications'), {
        userId: uid, type, title, message,
        data: cleanData,
        actionUrl: actionUrl || null,
        priority,
        isRead: false,
        createdAt: Timestamp.now(),
      })
    )
  );
}

// ─── Templates (FIX F-25: types aligned with NotificationType union) ──────────

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