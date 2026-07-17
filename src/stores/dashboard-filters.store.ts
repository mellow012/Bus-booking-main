import { create } from 'zustand';

interface DashboardFiltersState {
  regionId: string | null;
  routeId: string | null;
  scheduleId: string | null;
  setRegionId: (regionId: string | null) => void;
  setRouteId: (routeId: string | null) => void;
  setScheduleId: (scheduleId: string | null) => void;
  resetFilters: () => void;
}

export const useDashboardFilters = create<DashboardFiltersState>((set) => ({
  regionId: null,
  routeId: null,
  scheduleId: null,
  setRegionId: (regionId) => set({ regionId, routeId: null, scheduleId: null }), // Reset dependent filters
  setRouteId: (routeId) => set({ routeId, scheduleId: null }), // Reset dependent filters
  setScheduleId: (scheduleId) => set({ scheduleId }),
  resetFilters: () => set({ regionId: null, routeId: null, scheduleId: null }),
}));
