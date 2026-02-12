export interface Notification {
  id: string;
  userId: string;
  type: 'booking_confirmed' | 'trip_reminder' | 'cancellation' | 'system';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

export interface SystemSettings {
  id: string;
  key: string;
  value: any;
  category: 'general' | 'payment' | 'booking';
  description?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  resource: string;
  resourceId: string;
  changes?: { [key: string]: { old: any; new: any } };
  createdAt: Date;
}