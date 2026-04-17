'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Bell, Trash2, Check, CheckCheck, Loader2, AlertCircle } from 'lucide-react';
import { Notification } from '@/types';

interface NotificationResponse {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  const ITEMS_PER_PAGE = 20;

  // Fetch notifications from API
  const fetchNotifications = useCallback(async (pageNum = 1, skipPoll = false) => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(pageNum === 1);
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: ITEMS_PER_PAGE.toString(),
      });

      const response = await fetch(`/api/notifications/list?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch notifications');

      const { data, total: totalCount, hasMore: more } = await response.json();
      if (pageNum === 1) {
        setNotifications(data);
      } else {
        setNotifications(prev => [...prev, ...data]);
      }
      setTotal(totalCount);
      setHasMore(more);
      setPage(pageNum);
      setError('');
    } catch (err: unknown) {
      setError((err as any).message || 'Failed to load notifications');
      console.error('Fetch notifications error:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Initial load and polling
  useEffect(() => {
    fetchNotifications(1);
    // Poll for new notifications every 10 seconds
    const interval = setInterval(() => fetchNotifications(1, true), 10000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Mark single notification as read
  const handleMarkRead = useCallback(async (notificationId: string) => {
    try {
      setActionLoading(notificationId);
      const response = await fetch(`/api/notifications/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      });

      if (!response.ok) throw new Error('Failed to mark as read');

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  }, []);

  // Mark all as read
  const handleMarkAllRead = useCallback(async () => {
    try {
      setActionLoading('mark-all');
      const response = await fetch(`/api/notifications/mark-all-read`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to mark all as read');

      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  }, []);

  // Clear all notifications
  const handleClearAll = useCallback(async () => {
    if (!window.confirm('Delete all notifications? This cannot be undone.')) return;

    try {
      setActionLoading('clear-all');
      const response = await fetch(`/api/notifications/clear-all`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to clear notifications');

      setNotifications([]);
      setTotal(0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  }, []);

  if (!user?.id) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Sign In Required</h2>
          <p className="text-gray-600">Please log in to view your notifications.</p>
        </div>
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Bell className="w-8 h-8 text-blue-600" />
              Notifications
            </h1>
            <p className="text-gray-600 mt-1">
              {total === 0 ? 'No notifications' : `${total} notification${total !== 1 ? 's' : ''}`}
              {unreadCount > 0 && `, ${unreadCount} unread`}
            </p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-red-900 font-medium">Error</p>
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {notifications.length > 0 && (
          <div className="mb-6 flex gap-2 flex-wrap">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={actionLoading === 'mark-all'}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {actionLoading === 'mark-all' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCheck className="w-4 h-4" />
                )}
                Mark All Read
              </button>
            )}
            <button
              onClick={handleClearAll}
              disabled={actionLoading === 'clear-all'}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition"
            >
              {actionLoading === 'clear-all' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Clear All
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && notifications.length === 0 && (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading notifications...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && notifications.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Notifications</h3>
            <p className="text-gray-600">You&apos;re all caught up! Check back later for updates.</p>
          </div>
        )}

        {/* Notifications List */}
        {!loading && notifications.length > 0 && (
          <>
            <div className="space-y-3">
              {notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`bg-white rounded-lg shadow-sm border transition-all ${
                    notification.isRead
                      ? 'border-gray-200'
                      : 'border-blue-200 bg-blue-50'
                  } p-4 hover:shadow-md`}
                >
                  <div className="flex gap-4">
                    {/* Icon */}
                    <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                      notification.isRead ? 'bg-gray-100' : 'bg-blue-100'
                    }`}>
                      {notification.isRead ? (
                        <Check className="w-5 h-5 text-gray-600" />
                      ) : (
                        <Bell className="w-5 h-5 text-blue-600" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-semibold text-gray-900 mb-1 ${
                        notification.isRead ? '' : 'text-blue-900'
                      }`}>
                        {notification.title}
                      </h3>
                      <p className="text-gray-600 text-sm mb-2">{notification.message}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(notification.createdAt).toLocaleString()}
                      </p>
                    </div>

                    {/* Actions */}
                    {!notification.isRead && (
                      <button
                        onClick={() => handleMarkRead(notification.id)}
                        disabled={actionLoading === notification.id}
                        className="ml-4 shrink-0 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition"
                      >
                        {actionLoading === notification.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Mark Read'
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Load More Button */}
            {hasMore && (
              <div className="mt-8 flex justify-center">
                <button
                  onClick={() => fetchNotifications(page + 1)}
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition inline-flex items-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Load More
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
