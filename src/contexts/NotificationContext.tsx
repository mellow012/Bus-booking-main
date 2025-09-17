'use client';
import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { db } from '@/lib/firebaseConfig';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  addDoc,
  onSnapshot, 
  updateDoc, 
  doc, 
  writeBatch, 
  Timestamp 
} from 'firebase/firestore';
import { Bell, X, Check, CheckCheck, Trash2 } from 'lucide-react';
import { Notification } from '@/types/index';

// Add missing type definition
interface SendNotificationParams {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  actionUrl?: string;
  priority?: 'low' | 'medium' | 'high';
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

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

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
      const notificationData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      } as Notification));
      setNotifications(notificationData);
      setIsLoading(false);
    }, (error) => {
      console.error('Error fetching notifications:', error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { 
        isRead: true,
        readAt: new Date()
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!userId || notifications.length === 0) return;
    try {
      const batch = writeBatch(db);
      const unreadNotifications = notifications.filter(n => !n.isRead);
      unreadNotifications.forEach(notification => {
        const notificationRef = doc(db, 'notifications', notification.id);
        batch.update(notificationRef, { 
          isRead: true,
          readAt: new Date()
        });
      });
      await batch.commit();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const clearAll = async () => {
    if (!userId || notifications.length === 0) return;
    try {
      const batch = writeBatch(db);
      notifications.forEach(notification => {
        const notificationRef = doc(db, 'notifications', notification.id);
        batch.delete(notificationRef);
      });
      await batch.commit();
    } catch (error) {
      console.error('Error clearing all notifications:', error);
    }
  };

  // Updated sendNotification function without FCM send
  const sendNotification = async ({
    userId,
    type,
    title,
    message,
    data = {},
    actionUrl,
    priority = 'medium'
  }: SendNotificationParams) => {
    try {
      const cleanData = data ? Object.fromEntries(
        Object.entries(data).filter(([_, value]) => value !== undefined && value !== null)
      ) : {};

      const notificationDoc = {
        userId,
        type,
        title,
        message,
        data: cleanData,
        actionUrl: actionUrl || null,
        priority,
        isRead: false,
        createdAt: Timestamp.now(),
      };

      await addDoc(collection(db, 'notifications'), notificationDoc);
      console.log('Notification stored in Firestore successfully');
    } catch (error: any) {
      console.error('Error sending notification:', error);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <NotificationContext.Provider value={{ 
      notifications, 
      unreadCount, 
      markAsRead, 
      markAllAsRead, 
      clearAll, 
      isLoading,
      sendNotification 
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const NotificationBell: React.FC<{ userId: string; className?: string }> = ({ userId, className }) => {
  const { notifications, markAsRead, markAllAsRead, clearAll, unreadCount, isLoading } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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
            {unreadCount}
          </span>
        )}
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white shadow-lg rounded-lg z-50 border border-gray-200">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-semibold">Notifications</h3>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} className="p-1 hover:bg-blue-100 rounded">
                  <CheckCheck className="w-4 h-4 text-blue-600" />
                </button>
              )}
              <button onClick={clearAll} className="p-1 hover:bg-red-100 rounded">
                <Trash2 className="w-4 h-4 text-red-600" />
              </button>
              <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-gray-500">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">No notifications</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => { markAsRead(n.id); setIsOpen(false); }}
                  className={`p-3 hover:bg-gray-50 cursor-pointer ${!n.isRead ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <div className="text-blue-600">{n.type.charAt(0).toUpperCase()}</div>
                    <div>
                      <h4 className={`font-medium ${!n.isRead ? 'text-gray-900' : 'text-gray-600'}`}>{n.title}</h4>
                      <p className={`text-sm ${!n.isRead ? 'text-gray-700' : 'text-gray-500'}`}>{n.message}</p>
                      <p className="text-xs text-gray-400">{new Date(n.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                  {!n.isRead && (
                    <button
                      onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                      className="ml-2 p-1 hover:bg-blue-100 rounded"
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

// Keep these as standalone functions for backwards compatibility
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
    const cleanData = data ? Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined && value !== null)
    ) : {};

    await addDoc(collection(db, 'notifications'), {
      userId,
      type,
      title,
      message,
      data: cleanData,
      actionUrl: actionUrl || null,
      priority,
      isRead: false,
      createdAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

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
    const cleanData = data ? Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined && value !== null)
    ) : {};

    const batch = [];
    for (const userId of userIds) {
      batch.push(
        addDoc(collection(db, 'notifications'), {
          userId,
          type,
          title,
          message,
          data: cleanData,
          actionUrl: actionUrl || null,
          priority,
          isRead: false,
          createdAt: Timestamp.now(),
        })
      );
    }
    await Promise.all(batch);
  } catch (error) {
    console.error('Error sending bulk notifications:', error);
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