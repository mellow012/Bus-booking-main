import { Route, Schedule } from '@/types';

export const DEFAULT_TRIP_DURATION_MS = 3 * 60 * 60 * 1000;

export function getTripWindow(schedule: Schedule) {
  const departure = new Date(schedule.departureDateTime).getTime();
  const arrival = schedule.arrivalDateTime
    ? new Date(schedule.arrivalDateTime).getTime()
    : departure + DEFAULT_TRIP_DURATION_MS;
  return { departure, arrival };
}

export function isArchivedSchedule(schedule: Schedule) {
  return schedule.status === 'archived' || !!schedule.isArchived;
}

export type ScheduleStatus = 'current' | 'upcoming' | 'completed';

export function getScheduleStatus(schedule: Schedule, now: number = Date.now()): ScheduleStatus {
  const { departure, arrival } = getTripWindow(schedule);
  if (now >= departure && now <= arrival) return 'current';
  if (now < departure) return 'upcoming';
  return 'completed';
}

export const SCHEDULE_STATUS_STYLES: Record<ScheduleStatus, string> = {
  current: 'bg-emerald-100 text-emerald-700',
  upcoming: 'bg-amber-100 text-amber-700',
  completed: 'bg-gray-100 text-gray-600',
};

export const SCHEDULE_STATUS_LABELS: Record<ScheduleStatus, string> = {
  current: 'Current',
  upcoming: 'Upcoming',
  completed: 'Completed',
};

export type BranchTripSummary = { type: 'active' | 'upcoming'; count: number } | null;

/** Active/upcoming trip summary for a single branch, used on the branch card. */
export function getBranchTripSummary(
  branchId: string,
  routes: Route[],
  schedules: Schedule[],
  now: number = Date.now()
): BranchTripSummary {
  const branchRouteIds = new Set(routes.filter((r) => r.regionId === branchId).map((r) => r.id));
  const trips = schedules
    .filter((s) => branchRouteIds.has(s.routeId) && !isArchivedSchedule(s))
    .map((s) => ({ schedule: s, ...getTripWindow(s) }));

  const activeCount = trips.filter((t) => now >= t.departure && now <= t.arrival).length;
  if (activeCount > 0) return { type: 'active', count: activeCount };

  const upcomingCount = trips.filter((t) => t.departure > now).length;
  if (upcomingCount > 0) return { type: 'upcoming', count: upcomingCount };

  return null;
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}