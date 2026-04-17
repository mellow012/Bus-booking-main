"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  Bell,
  Trash2,
  CheckCheck,
  Loader2,
  AlertCircle,
  Clock,
  Info,
  AlertTriangle,
  CheckCircle2,
  Filter,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "react-hot-toast";

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

interface NotificationsTabProps {
  userId: string;
  companyId: string;
  setError: (msg: string) => void;
  setSuccess: (msg: string) => void;
}

export default function NotificationsManagementTab({ userId, companyId, setError, setSuccess }: NotificationsTabProps) {
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("Notification")
        .select("*")
        .eq("userId", userId)
        .order("createdAt", { ascending: false })
        .limit(50);

      if (error) throw error;
      setNotifications(data || []);
    } catch (err: any) {
      console.error("Error fetching notifications:", err);
      setError("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, [userId, setError]);

  useEffect(() => {
    fetchNotifications();
    
    // Subscribe to new notifications
    const channel = supabase
      .channel("admin-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "Notification", filter: `userId=eq.${userId}` },
        (payload) => {
          setNotifications((prev) => [payload.new as NotificationResponse, ...prev]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, fetchNotifications]);

  const handleMarkRead = async (id: string) => {
    try {
      setActionLoading(id);
      const { error } = await supabase
        .from("Notification")
        .update({ isRead: true })
        .eq("id", id);

      if (error) throw error;
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      toast.success("Marked as read");
    } catch (err: any) {
      toast.error("Failed to update notification");
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setActionLoading("mark-all");
      const { error } = await supabase
        .from("Notification")
        .update({ isRead: true })
        .eq("userId", userId)
        .eq("isRead", false);

      if (error) throw error;
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setSuccess("All notifications marked as read");
    } catch (err: any) {
      setError("Failed to update notifications");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm("Are you sure you want to delete all notifications?")) return;
    try {
      setActionLoading("delete-all");
      const { error } = await supabase
        .from("Notification")
        .delete()
        .eq("userId", userId);

      if (error) throw error;
      setNotifications([]);
      setSuccess("All notifications deleted");
    } catch (err: any) {
      setError("Failed to delete notifications");
    } finally {
      setActionLoading(null);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.isRead;
    if (filter === "read") return n.isRead;
    return true;
  });

  const getIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case "booking": return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "payment": return <Clock className="w-5 h-5 text-blue-500" />;
      case "alert": return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      default: return <Info className="w-5 h-5 text-indigo-500" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-gray-900 tracking-tight">Notifications</h1>
          <p className="text-[13px] text-gray-500 font-medium">
            Manage your alerts and system updates
          </p>
        </div>
        <div className="flex gap-2">
          {notifications.some(n => !n.isRead) && (
            <button
              onClick={handleMarkAllRead}
              disabled={!!actionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-colors"
            >
              {actionLoading === "mark-all" ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
              Mark All Read
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={handleDeleteAll}
              disabled={!!actionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 text-xs font-bold rounded-lg border border-red-100 hover:bg-red-100 transition-colors"
            >
              {actionLoading === "delete-all" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-gray-100 p-2 flex items-center gap-1">
        {(["all", "unread", "read"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
              filter === t 
                ? "bg-indigo-900 text-white shadow-sm" 
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 text-indigo-900 animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-500 font-medium">Loading notifications...</p>
          </div>
        ) : filteredNotifications.length > 0 ? (
          <div className="divide-y divide-gray-50">
            {filteredNotifications.map((n) => (
              <div
                key={n.id}
                className={`p-5 flex items-start gap-4 transition-colors hover:bg-gray-50/50 ${
                  !n.isRead ? "bg-indigo-50/30" : ""
                }`}
              >
                <div className={`mt-1 p-2 rounded-lg ${!n.isRead ? "bg-white shadow-sm" : "bg-gray-50"}`}>
                  {getIcon(n.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className={`text-sm font-bold ${!n.isRead ? "text-gray-900" : "text-gray-600"}`}>
                      {n.title}
                    </h3>
                    <span className="text-[10px] font-medium text-gray-400">
                      {new Date(n.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </div>
                  <p className={`text-[13px] leading-relaxed mb-3 ${!n.isRead ? "text-gray-700" : "text-gray-500"}`}>
                    {n.message}
                  </p>
                  {!n.isRead && (
                    <button
                      onClick={() => handleMarkRead(n.id)}
                      disabled={actionLoading === n.id}
                      className="text-[11px] font-bold text-indigo-900 hover:text-indigo-700 flex items-center gap-1"
                    >
                      {actionLoading === n.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <CheckCheck className="w-3 h-3" />
                      )}
                      Mark as read
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-sm font-bold text-gray-900 mb-1">No notifications found</p>
            <p className="text-xs text-gray-500">You're all caught up! Check back later for updates.</p>
          </div>
        )}
      </div>
    </div>
  );
}
