// utils/auditLogs.ts
//
// Migrated from Firestore to PostgreSQL via Prisma
// All queries now use Prisma with proper indexing on:
// - activityLog (companyId, userId, action, resourceType, timestamp DESC)
//
// Filtering is now performed at the database level, eliminating the need for
// composite indexes if using Prisma's query optimization.

import { prisma } from '@/lib/prisma';

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
  changes?: { before?: unknown; after?: unknown };
  ipAddress?: string;
  userAgent?: string;
  status: 'success' | 'failed';
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

// ─── Write ────────────────────────────────────────────────────────────────────

export const logAudit = async (
  auditLog: Omit<AuditLog, 'id' | 'timestamp'>
): Promise<string | undefined> => {
  try {
    const record = await prisma.activityLog.create({
      data: {
        action: auditLog.action,
        userId: auditLog.userId,
        companyId: auditLog.companyId,
        description: auditLog.description,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metadata: {
          userName: auditLog.userName,
          userRole: auditLog.userRole,
          resourceType: auditLog.resourceType,
          resourceId: auditLog.resourceId,
          resourceName: auditLog.resourceName || '',
          changes: auditLog.changes || {},
          ipAddress: auditLog.ipAddress || '',
          userAgent: auditLog.userAgent || '',
          status: auditLog.status,
          errorMessage: auditLog.errorMessage || '',
          ...(auditLog.metadata || {})
        } as any,
        createdAt: new Date(),
      },
    });
    return record.id;
  } catch (error) {
    console.error('[AUDIT ERROR] Failed to log audit:', error);
  }
};

// ─── Read – Optimized for PostgreSQL ──────────────────────────────────────────

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
    const hardLimit = Math.min(filters?.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    const records = await prisma.activityLog.findMany({
      where: {
        companyId,
        ...(filters?.action && { action: filters.action }),
        ...(filters?.userId && { userId: filters.userId }),
        ...(filters?.resourceType && { metadata: { path: ['resourceType'], equals: filters.resourceType } }),
        ...(filters?.startDate && { createdAt: { gte: filters.startDate } }),
        ...(filters?.endDate && { createdAt: { lte: filters.endDate } }),
      },
      orderBy: { createdAt: 'desc' },
      take: hardLimit,
    });

    return records.map(doc => {
      const meta = (doc.metadata as Record<string, any>) || {};
      return {
        id: doc.id,
        action: doc.action as AuditAction,
        userId: doc.userId,
        userName: meta.userName || '',
        userRole: meta.userRole || '',
        companyId: doc.companyId || '',
        resourceType: meta.resourceType || '',
        resourceId: meta.resourceId || '',
        resourceName: meta.resourceName || '',
        description: doc.description,
        changes: meta.changes,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        status: meta.status as 'success' | 'failed',
        errorMessage: meta.errorMessage,
        metadata: meta, // passing the raw meta
        timestamp: doc.createdAt,
      };
    }) as AuditLog[];
  } catch (error) {
    console.error('[AUDIT] Error fetching logs:', error);
    return [];
  }
};

// ─── Convenience log helpers (unchanged) ─────────────────────────────────────

export const logScheduleCreated = (
  userId: string, userName: string, userRole: string, companyId: string,
  scheduleId: string, route: string, details?: Record<string, unknown>
) => logAudit({
  action: 'create_schedule', userId, userName, userRole, companyId,
  resourceType: 'schedule', resourceId: scheduleId, resourceName: route,
  description: `Created schedule: ${route}`, metadata: details, status: 'success',
});

export const logScheduleUpdated = (
  userId: string, userName: string, userRole: string, companyId: string,
  scheduleId: string, route: string, beforeData?: unknown, afterData?: unknown
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
  errorMessage: string, context?: Record<string, unknown>
) => logAudit({
  action, userId, userName, userRole, companyId, resourceType, resourceId,
  description: `Failed to ${action}: ${errorMessage}`,
  status: 'failed', errorMessage, metadata: context,
});