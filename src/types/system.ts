import { UserRole } from './core';

export interface Notification {
  id: string;
  userId: string;
  type: 'booking_confirmed' | 'trip_reminder' | 'cancellation' | 'payment_received' | 'system';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  readAt?: Date;
}

export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  userRole: UserRole;
  action: string;
  resource: string;
  resourceId: string;
  companyId?: string;
  changes?: { [key: string]: { old: any; new: any } };
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export interface SystemSettings {
  id: string;
  key: string;
  value: any;
  category: 'general' | 'payment' | 'booking' | 'notification';
  description?: string;
  updatedAt: Date;
}

