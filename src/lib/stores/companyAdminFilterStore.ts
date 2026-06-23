import { create } from 'zustand';

// ── Types ─────────────────────────────────────────────────────────────────────

type DateRange = {
  from?: string | null;
  to?: string | null;
};

type CompanyAdminFilterState = {
  // Hierarchy filters
  regionId:   string | null;
  routeId:    string | null;
  scheduleId: string | null;
  bookingId:  string | null;

  // Date range
  dateRange: DateRange;

  // Actions
  setRegion:    (id: string | null) => void;
  setRoute:     (id: string | null) => void;
  setSchedule:  (id: string | null) => void;
  setBooking:   (payload: {
    id?:         string | null;
    scheduleId?: string | null;
    routeId?:    string | null;
    regionId?:   string | null;
  }) => void;
  setDateRange: (range: DateRange) => void;

  // Clears from a given level downward in the hierarchy
  clearFromRegion:   () => void;
  clearFromRoute:    () => void;
  clearFromSchedule: () => void;
  clearAll:          () => void;
};

// ── Store ─────────────────────────────────────────────────────────────────────

export const useCompanyAdminFilterStore = create<CompanyAdminFilterState>((set) => ({
  regionId:   null,
  routeId:    null,
  scheduleId: null,
  bookingId:  null,
  dateRange:  { from: null, to: null },

  // Set a region — clears everything downstream (route, schedule, booking)
  setRegion: (id) =>
    set(() => ({ regionId: id, routeId: null, scheduleId: null, bookingId: null })),

  // Set a route — clears schedule + booking downstream
  setRoute: (id) =>
    set(() => ({ routeId: id, scheduleId: null, bookingId: null })),

  // Set a schedule — clears booking downstream
  setSchedule: (id) =>
    set(() => ({ scheduleId: id, bookingId: null })),

  // Set booking with optional context synchronization
  setBooking: ({ id, scheduleId, routeId, regionId }) =>
    set(() => ({
      bookingId:  id         ?? null,
      scheduleId: scheduleId ?? null,
      routeId:    routeId    ?? null,
      regionId:   regionId   ?? null,
    })),

  setDateRange: (range) => set(() => ({ dateRange: range })),

  // Cascading clears — for breadcrumb click behavior
  clearFromRegion:   () => set(() => ({ regionId: null, routeId: null, scheduleId: null, bookingId: null })),
  clearFromRoute:    () => set(() => ({ routeId:  null, scheduleId: null, bookingId: null })),
  clearFromSchedule: () => set(() => ({ scheduleId: null, bookingId: null })),

  clearAll: () =>
    set(() => ({
      regionId:   null,
      routeId:    null,
      scheduleId: null,
      bookingId:  null,
      dateRange:  { from: null, to: null },
    })),
}));

export default useCompanyAdminFilterStore;
