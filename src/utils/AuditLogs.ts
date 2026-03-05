// utils/auditLogs.ts
//
// FIX F-13: getAuditLogs() previously fetched the ENTIRE auditLogs collection
// for a company and then filtered in JavaScript. A company with 100,000 audit
// events would read all 100,000 documents on every call, causing out-of-memory
// errors and slow responses.
//
// All filters are now pushed into the Firestore query using where() clauses.
// A hard limit (default 500, max 1000) is always applied at the query level.
//
// REQUIRED COMPOSITE INDEXES (add to firestore.indexes.json):
//   Collection: auditLogs
//   Fields needed for common filter combinations:
//     1. companyId ASC, timestamp DESC                          (base query)
//     2. companyId ASC, action ASC, timestamp DESC              (+ action filter)
//     3. companyId ASC, userId ASC, timestamp DESC              (+ userId filter)
//     4. companyId ASC, resourceType ASC, timestamp DESC        (+ resourceType filter)
//     5. companyId ASC, timestamp ASC, timestamp DESC           (+ date range)
//
// Deploy indexes with: firebase deploy --only firestore:indexes

import {
  collection, addDoc, Timestamp,
  query, where, orderBy, limit, getDocs,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  userName: string;
  userRole: string;
  companyId: string;
  resourceType: string;
  resourceId: string;
  resourceName?: string;
  description: string;
  changes?: { before?: any; after?: any };
  ipAddress?: string;
  userAgent?: string;
  status: 'success' | 'failed';
  errorMessage?: string;
  metadata?: any;
  timestamp: Date;
}

// ─── Write ────────────────────────────────────────────────────────────────────

export const logAudit = async (
  auditLog: Omit<AuditLog, 'id' | 'timestamp'>
): Promise<string | undefined> => {
  try {
    const docRef = await addDoc(collection(db, 'auditLogs'), {
      ...auditLog,
      timestamp: Timestamp.fromDate(new Date()),
    });
    return docRef.id;
  } catch (error: any) {
    console.error('[AUDIT ERROR] Failed to log audit:', error);
  }
};

// ─── Read — FIX F-13 ──────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 500;
const MAX_LIMIT     = 1_000;

export const getAuditLogs = async (
  companyId: string,
  filters?: {
    action?: AuditAction;
    userId?: string;
    resourceType?: string;
    startDate?: Date;
    endDate?: Date;
    /** Max records to return. Capped at 1,000. Default: 500. */
    limit?: number;
  }
): Promise<AuditLog[]> => {
  try {
    const constraints: QueryConstraint[] = [
      where('companyId', '==', companyId),
    ];

    // Push every filter into the Firestore query — never filter in JS
    if (filters?.action) {
      constraints.push(where('action', '==', filters.action));
    }
    if (filters?.userId) {
      constraints.push(where('userId', '==', filters.userId));
    }
    if (filters?.resourceType) {
      constraints.push(where('resourceType', '==', filters.resourceType));
    }
    if (filters?.startDate) {
      constraints.push(where('timestamp', '>=', Timestamp.fromDate(filters.startDate)));
    }
    if (filters?.endDate) {
      constraints.push(where('timestamp', '<=', Timestamp.fromDate(filters.endDate)));
    }

    // Always order and always apply a hard limit — never unbounded reads
    constraints.push(orderBy('timestamp', 'desc'));
    const hardLimit = Math.min(filters?.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    constraints.push(limit(hardLimit));

    const snapshot = await getDocs(query(collection(db, 'auditLogs'), ...constraints));

    return snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
      timestamp: d.data().timestamp?.toDate?.() ?? new Date(),
    })) as AuditLog[];
  } catch (error: any) {
    console.error('[AUDIT] Error fetching logs:', error);
    return [];
  }
};

// ─── Convenience log helpers (unchanged) ─────────────────────────────────────

export const logScheduleCreated = (
  userId: string, userName: string, userRole: string, companyId: string,
  scheduleId: string, route: string, details?: any
) => logAudit({
  action: 'create_schedule', userId, userName, userRole, companyId,
  resourceType: 'schedule', resourceId: scheduleId, resourceName: route,
  description: `Created schedule: ${route}`, metadata: details, status: 'success',
});

export const logScheduleUpdated = (
  userId: string, userName: string, userRole: string, companyId: string,
  scheduleId: string, route: string, beforeData?: any, afterData?: any
) => logAudit({
  action: 'update_schedule', userId, userName, userRole, companyId,
  resourceType: 'schedule', resourceId: scheduleId, resourceName: route,
  description: `Updated schedule: ${route}`,
  changes: { before: beforeData, after: afterData }, status: 'success',
});

export const logScheduleArchived = (
  userId: string, userName: string, userRole: string, companyId: string,
  scheduleId: string, route: string
) => logAudit({
  action: 'archive_schedule', userId, userName, userRole, companyId,
  resourceType: 'schedule', resourceId: scheduleId, resourceName: route,
  description: `Archived schedule: ${route}`, status: 'success',
});

export const logPaymentCollected = (
  userId: string, userName: string, userRole: string, companyId: string,
  bookingId: string, passengerName: string, amount: number, method: string
) => logAudit({
  action: 'collect_payment', userId, userName, userRole, companyId,
  resourceType: 'booking', resourceId: bookingId, resourceName: passengerName,
  description: `Collected ${method} payment of MWK ${amount} from ${passengerName}`,
  metadata: { amount, method }, status: 'success',
});

export const logPassengerBoarded = (
  userId: string, userName: string, userRole: string, companyId: string,
  bookingId: string, passengerName: string, seatNumber: string
) => logAudit({
  action: 'mark_boarded', userId, userName, userRole, companyId,
  resourceType: 'booking', resourceId: bookingId, resourceName: passengerName,
  description: `Marked ${passengerName} (Seat ${seatNumber}) as boarded`, status: 'success',
});

export const logPassengerNoShow = (
  userId: string, userName: string, userRole: string, companyId: string,
  bookingId: string, passengerName: string, seatNumber: string
) => logAudit({
  action: 'mark_no_show', userId, userName, userRole, companyId,
  resourceType: 'booking', resourceId: bookingId, resourceName: passengerName,
  description: `Marked ${passengerName} (Seat ${seatNumber}) as no-show`, status: 'success',
});

export const logReportGenerated = (
  userId: string, userName: string, userRole: string, companyId: string,
  reportDate: Date, scheduleCount: number, bookingCount: number
) => logAudit({
  action: 'generate_report', userId, userName, userRole, companyId,
  resourceType: 'report', resourceId: `report_${reportDate.toISOString()}`,
  resourceName: `Daily Report - ${reportDate.toLocaleDateString()}`,
  description: `Generated daily report for ${reportDate.toLocaleDateString()} (${scheduleCount} schedules, ${bookingCount} bookings)`,
  metadata: { scheduleCount, bookingCount, reportDate }, status: 'success',
});

export const logFailedAction = (
  userId: string, userName: string, userRole: string, companyId: string,
  action: AuditAction, resourceType: string, resourceId: string,
  errorMessage: string, context?: any
) => logAudit({
  action, userId, userName, userRole, companyId, resourceType, resourceId,
  description: `Failed to ${action}: ${errorMessage}`,
  status: 'failed', errorMessage, metadata: context,
});