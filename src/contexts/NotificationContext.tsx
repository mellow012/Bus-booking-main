'use client';
// contexts/NotificationContext.tsx
// Migrated from Firebase real-time listeners to polling API

import React, {
  createContext, useContext, useEffect, useState,
  ReactNode, useRef, useCallback,
} from 'react';
import { Bell, X, Check, CheckCheck, Trash2 } from 'lucide-react';
import { Notification } from '@/types/index';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'booking'
  | 'payment'
  | 'schedule'
  | 'system'
  | 'promotion'
  | 'alert'
  | 'cancellation'
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
  error: string | null;
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

export const NotificationProvider: React.FC<{ children: ReactNode; userId?: string }> = ({
  children,
  userId,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading]         = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const pollingIntervalRef                = useRef<NodeJS.Timeout | null>(null);

  // Polling interval: 5 seconds for notifications (balance between freshness and load)
  const POLLING_INTERVAL = 5000;

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;

    try {
      const response = await fetch('/api/notifications/list?userId=' + userId);
      
      if (response.status === 401) {
        // If unauthorized, stop polling as the session is likely expired or invalid.
        // This prevents the console from being flooded with 401 errors every interval.
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        return;
      }

      if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);

      const { data } = await response.json();
      setNotifications(data || []);
      setError(null);
    } catch (err: any) {
      // Log network errors or other unexpected issues
      console.error('[NotificationProvider] Polling error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);

    // Initial load
    fetchNotifications();

    // Set up polling
    pollingIntervalRef.current = setInterval(fetchNotifications, POLLING_INTERVAL);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [userId, fetchNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await fetch(`/api/notifications/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id }),
      });
      // Update local state optimistically
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, isRead: true } : n)
      );
    } catch (err) {
      console.error('[NotificationProvider] markAsRead failed:', err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    const unread = notifications.filter(n => !n.isRead);
    if (unread.length === 0) return;
    try {
      await fetch(`/api/notifications/mark-all-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      // Update local state optimistically
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('[NotificationProvider] markAllAsRead failed:', err);
    }
  }, [userId, notifications]);

  const clearAll = useCallback(async () => {
    if (!userId || notifications.length === 0) return;
    try {
      await fetch(`/api/notifications/clear-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      // Update local state optimistically
      setNotifications([]);
    } catch (err) {
      console.error('[NotificationProvider] clearAll failed:', err);
    }
  }, [userId, notifications]);

  const sendNotificationCtx = useCallback(async (params: SendNotificationParams) => {
    await sendNotification(params);
  }, []);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount: notifications.filter(n => !n.isRead).length,
      markAsRead,
      markAllAsRead,
      clearAll,
      isLoading,
      error,
      sendNotification: sendNotificationCtx,
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

// ─── NotificationBell ─────────────────────────────────────────────────────────

export const NotificationBell: React.FC<{ userId: string; className?: string }> = ({
  userId,
  className,
}) => {
  const { notifications, markAsRead, markAllAsRead, clearAll, unreadCount, isLoading, error } =
    useNotifications();
  const [isOpen,    setIsOpen]    = useState(false);
  const dropdownRef               = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className={`relative ${className ?? ''}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="w-6 h-6 text-gray-600 hover:text-blue-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed md:absolute inset-x-4 md:inset-x-auto md:right-0 mt-2 top-20 md:top-full md:w-80 bg-white shadow-xl rounded-xl z-50 border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-top-5 duration-200">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            <div className="flex gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="p-1.5 hover:bg-blue-100 rounded-lg transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-4 h-4 text-blue-600" />
                </button>
              )}
              <button
                onClick={clearAll}
                className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
                title="Clear all"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="p-6 text-center">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm text-gray-500">Loading notifications…</p>
              </div>
            ) : error === 'index_required' ? (
              <div className="p-4 text-center">
                <p className="text-sm text-amber-600 font-medium mb-1">Sync in progress…</p>
                <p className="text-xs text-gray-500">
                  Syncing notifications. Please try again in a moment.
                </p>
              </div>
            ) : error ? (
              <div className="p-4 text-center">
                <p className="text-sm text-red-500">Failed to load notifications.</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center">
                <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => { markAsRead(n.id); setIsOpen(false); }}
                  className={`px-4 py-3 hover:bg-gray-50 cursor-pointer flex items-start gap-3 border-b border-gray-50 last:border-0 transition-colors ${
                    !n.isRead ? 'bg-blue-50/60' : ''
                  }`}
                >
                  {/* Type indicator dot */}
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                    !n.isRead ? 'bg-blue-500' : 'bg-gray-300'
                  }`} />

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${
                      !n.isRead ? 'text-gray-900' : 'text-gray-600'
                    }`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>

                  {!n.isRead && (
                    <button
                      onClick={e => { e.stopPropagation(); markAsRead(n.id); }}
                      className="p-1 hover:bg-blue-100 rounded-lg shrink-0 transition-colors"
                      title="Mark as read"
                    >
                      <Check className="w-3.5 h-3.5 text-blue-600" />
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

// ─── Standalone helpers (API-based) ──────────────────────────────────────────

export async function sendNotification({
  userId, type, title, message,
  data = {}, actionUrl, priority = 'medium',
}: SendNotificationParams): Promise<void> {
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined && v !== null)
  );
  
  const response = await fetch('/api/notifications/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      type,
      title,
      message,
      data: cleanData,
      actionUrl: actionUrl ?? null,
      priority,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send notification: ${response.status}`);
  }
}

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
  
  const response = await fetch('/api/notifications/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipientIds: userIds,
      title,
      body: message,
      data: cleanData,
      clickAction: actionUrl ?? null,
      priority,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send bulk notifications: ${response.status}`);
  }
}

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
    message: `We received your payment of MWK ${amount.toLocaleString()}.`,
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