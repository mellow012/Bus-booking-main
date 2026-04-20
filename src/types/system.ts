// types/notifications.ts
//
// FIX TYPE-1: Notification.type union now matches NotificationType in NotificationContext.tsx.
// Previously 'booking_confirmed' | 'trip_reminder' | 'cancellation' | 'payment_received'
// had zero overlap with what NotificationTemplates actually emits ('booking','payment', etc.)
// causing TypeScript errors on every sendNotification() call.
//
// FIX TYPE-2: AuditLog interface aligned with auditLogs.ts.
// 'resource' → 'resourceType', 'userEmail' → 'userName' to match Firestore writes.

import { UserRole } from './core';

// ─── Notification ─────────────────────────────────────────────────────────────

// Keep in sync with NotificationType in NotificationContext.tsx
export type NotificationType =
  | 'booking'       // replaces 'booking_confirmed'
  | 'payment'       // replaces 'payment_received'
  | 'schedule'      // replaces 'trip_reminder'
  | 'system'
  | 'promotion'
  | 'alert'
  | 'cancellation' // retained for legacy Firestore documents
  | 'cancellation_requested';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  actionUrl?: string | null;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  isRead: boolean;
  createdAt: Date;
  readAt?: Date;
}

// ─── AuditLog ─────────────────────────────────────────────────────────────────

export type AuditAction =
  | 'create_schedule'
  | 'update_schedule'
  | 'delete_schedule'
  | 'archive_schedule'
  | 'create_booking'
  | 'update_booking'
  | 'mark_boarded'
  | 'mark_no_show'
  | 'collect_payment'
  | 'generate_report'
  | 'update_payment_status'
  | 'login'
  | 'logout'
  | 'access_dashboard'
  | 'export_data';

export interface AuditLog {
  id?: string;
  action: AuditAction;
  userId: string;
  userName: string;      // was: userEmail
  userRole: string;
  companyId: string;
  resourceType: string;  // was: resource
  resourceId: string;
  resourceName?: string;
  description: string;
  changes?: { before?: unknown; after?: unknown };
  ipAddress?: string;
  userAgent?: string;
  status: 'success' | 'failed';
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

// ─── SystemSettings ───────────────────────────────────────────────────────────

export interface SystemSettings {
  id: string;
  key: string;
  value: unknown;
  category: 'general' | 'payment' | 'booking' | 'notification';
  description?: string;
  updatedAt: Date;
}

// ─── Promotion ───────────────────────────────────────────────────────────────

export interface Promotion {
  id: string;
  code: string;
  title: string;
  description: string;
  discountValue: number;
  discountType: 'percentage' | 'fixed';
  minPurchase?: number | null;
  maxDiscount?: number | null;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}