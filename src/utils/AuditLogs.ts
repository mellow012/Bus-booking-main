// ✅ AUDIT LOGS UTILITY
// Use this utility to log all important actions in your application

import { collection, addDoc, Timestamp, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

export type AuditAction =
  | "create_schedule"
  | "update_schedule"
  | "delete_schedule"
  | "archive_schedule"
  | "create_booking"
  | "update_booking"
  | "mark_boarded"
  | "mark_no_show"
  | "collect_payment"
  | "generate_report"
  | "update_payment_status"
  | "login"
  | "logout"
  | "access_dashboard"
  | "export_data";

export interface AuditLog {
  id?: string;
  action: AuditAction;
  userId: string;
  userName: string;
  userRole: string;
  companyId: string;
  resourceType: string; // "schedule", "booking", "payment", etc
  resourceId: string;
  resourceName?: string;
  description: string;
  changes?: {
    before?: any;
    after?: any;
  };
  ipAddress?: string;
  userAgent?: string;
  status: "success" | "failed";
  errorMessage?: string;
  metadata?: any;
  timestamp: Date;
}

/**
 * Log an audit entry
 * @param auditLog - The audit log details
 */
export const logAudit = async (auditLog: Omit<AuditLog, "id" | "timestamp">) => {
  try {
    const auditRef = collection(db, "auditLogs");
    const docRef = await addDoc(auditRef, {
      ...auditLog,
      timestamp: Timestamp.fromDate(new Date()),
    });

    console.log(`[AUDIT] ${auditLog.action} - ${auditLog.description}`, {
      logId: docRef.id,
      user: auditLog.userName,
    });

    return docRef.id;
  } catch (error: any) {
    console.error("[AUDIT ERROR] Failed to log audit:", error);
  }
};

/**
 * Log schedule creation
 */
export const logScheduleCreated = async (
  userId: string,
  userName: string,
  userRole: string,
  companyId: string,
  scheduleId: string,
  route: string,
  details?: any
) => {
  return logAudit({
    action: "create_schedule",
    userId,
    userName,
    userRole,
    companyId,
    resourceType: "schedule",
    resourceId: scheduleId,
    resourceName: route,
    description: `Created schedule: ${route}`,
    metadata: details,
    status: "success",
  });
};

/**
 * Log schedule update
 */
export const logScheduleUpdated = async (
  userId: string,
  userName: string,
  userRole: string,
  companyId: string,
  scheduleId: string,
  route: string,
  beforeData?: any,
  afterData?: any
) => {
  return logAudit({
    action: "update_schedule",
    userId,
    userName,
    userRole,
    companyId,
    resourceType: "schedule",
    resourceId: scheduleId,
    resourceName: route,
    description: `Updated schedule: ${route}`,
    changes: { before: beforeData, after: afterData },
    status: "success",
  });
};

/**
 * Log schedule archived
 */
export const logScheduleArchived = async (
  userId: string,
  userName: string,
  userRole: string,
  companyId: string,
  scheduleId: string,
  route: string
) => {
  return logAudit({
    action: "archive_schedule",
    userId,
    userName,
    userRole,
    companyId,
    resourceType: "schedule",
    resourceId: scheduleId,
    resourceName: route,
    description: `Archived schedule: ${route}`,
    status: "success",
  });
};

/**
 * Log payment collection
 */
export const logPaymentCollected = async (
  userId: string,
  userName: string,
  userRole: string,
  companyId: string,
  bookingId: string,
  passengerName: string,
  amount: number,
  method: string
) => {
  return logAudit({
    action: "collect_payment",
    userId,
    userName,
    userRole,
    companyId,
    resourceType: "booking",
    resourceId: bookingId,
    resourceName: passengerName,
    description: `Collected ${method} payment of MWK ${amount} from ${passengerName}`,
    metadata: { amount, method },
    status: "success",
  });
};

/**
 * Log passenger boarded
 */
export const logPassengerBoarded = async (
  userId: string,
  userName: string,
  userRole: string,
  companyId: string,
  bookingId: string,
  passengerName: string,
  seatNumber: string
) => {
  return logAudit({
    action: "mark_boarded",
    userId,
    userName,
    userRole,
    companyId,
    resourceType: "booking",
    resourceId: bookingId,
    resourceName: passengerName,
    description: `Marked ${passengerName} (Seat ${seatNumber}) as boarded`,
    status: "success",
  });
};

/**
 * Log passenger no-show
 */
export const logPassengerNoShow = async (
  userId: string,
  userName: string,
  userRole: string,
  companyId: string,
  bookingId: string,
  passengerName: string,
  seatNumber: string
) => {
  return logAudit({
    action: "mark_no_show",
    userId,
    userName,
    userRole,
    companyId,
    resourceType: "booking",
    resourceId: bookingId,
    resourceName: passengerName,
    description: `Marked ${passengerName} (Seat ${seatNumber}) as no-show`,
    status: "success",
  });
};

/**
 * Log report generation
 */
export const logReportGenerated = async (
  userId: string,
  userName: string,
  userRole: string,
  companyId: string,
  reportDate: Date,
  scheduleCount: number,
  bookingCount: number
) => {
  return logAudit({
    action: "generate_report",
    userId,
    userName,
    userRole,
    companyId,
    resourceType: "report",
    resourceId: `report_${reportDate.toISOString()}`,
    resourceName: `Daily Report - ${reportDate.toLocaleDateString()}`,
    description: `Generated daily report for ${reportDate.toLocaleDateString()} (${scheduleCount} schedules, ${bookingCount} bookings)`,
    metadata: { scheduleCount, bookingCount, reportDate },
    status: "success",
  });
};

/**
 * Log failed action
 */
export const logFailedAction = async (
  userId: string,
  userName: string,
  userRole: string,
  companyId: string,
  action: AuditAction,
  resourceType: string,
  resourceId: string,
  errorMessage: string,
  context?: any
) => {
  return logAudit({
    action,
    userId,
    userName,
    userRole,
    companyId,
    resourceType,
    resourceId,
    description: `Failed to ${action}: ${errorMessage}`,
    status: "failed",
    errorMessage,
    metadata: context,
  });
};

/**
 * Fetch audit logs for company
 */
export const getAuditLogs = async (
  companyId: string,
  filters?: {
    action?: AuditAction;
    userId?: string;
    resourceType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }
) => {
  try {
    let q = query(collection(db, "auditLogs"), where("companyId", "==", companyId));

    const snapshot = await getDocs(q);
    let logs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate?.() || new Date(),
    })) as AuditLog[];

    // Apply filters
    if (filters?.action) {
      logs = logs.filter(l => l.action === filters.action);
    }

    if (filters?.userId) {
      logs = logs.filter(l => l.userId === filters.userId);
    }

    if (filters?.resourceType) {
      logs = logs.filter(l => l.resourceType === filters.resourceType);
    }

    if (filters?.startDate && filters?.endDate) {
      logs = logs.filter(
        l => l.timestamp >= filters.startDate! && l.timestamp <= filters.endDate!
      );
    }

    // Sort by timestamp (newest first)
    logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Limit results
    if (filters?.limit) {
      logs = logs.slice(0, filters.limit);
    }

    return logs;
  } catch (error: any) {
    console.error("[AUDIT] Error fetching logs:", error);
    return [];
  }
};

/**
 * Export usage example:
 *
 * Import in your component:
 * import { logPaymentCollected, logPassengerBoarded } from "@/utils/auditLogs";
 *
 * Use in conductor dashboard when collecting payment:
 * await logPaymentCollected(
 *   user.uid,
 *   conductorName,
 *   userProfile.role,
 *   companyId,
 *   booking.id,
 *   booking.passengerDetails[0].name,
 *   booking.totalAmount,
 *   "cash_on_boarding"
 * );
 *
 * Use when marking boarded:
 * await logPassengerBoarded(
 *   user.uid,
 *   conductorName,
 *   userProfile.role,
 *   companyId,
 *   booking.id,
 *   booking.passengerDetails[0].name,
 *   booking.seatNumbers[0]
 * );
 */