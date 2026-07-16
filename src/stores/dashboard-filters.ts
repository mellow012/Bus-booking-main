import { create } from 'zustand';

interface DashboardFiltersState {
  companyId?: string;
  regionId?: string;
  routeId?: string;
  scheduleId?: string;
  busId?: string;
  operatorId?: string;
  setCompanyId: (companyId?: string) => void;
  setRegionId: (regionId?: string) => void;
  setRouteId: (routeId?: string) => void;
  setScheduleId: (scheduleId?: string) => void;
  setBusId: (busId?: string) => void;
  setOperatorId: (operatorId?: string) => void;
  resetFilters: () => void;
}

export const useDashboardFilters = create<DashboardFiltersState>((set) => ({
  companyId: undefined,
  regionId: undefined,
  routeId: undefined,
  scheduleId: undefined,
  busId: undefined,
  operatorId: undefined,
  setCompanyId: (companyId) => set({ companyId }),
  setRegionId: (regionId) => set({ regionId }),
  setRouteId: (routeId) => set({ routeId }),
  setScheduleId: (scheduleId) => set({ scheduleId }),
  setBusId: (busId) => set({ busId }),
  setOperatorId: (operatorId) => set({ operatorId }),
  resetFilters: () => set({
    companyId: undefined,
    regionId: undefined,
    routeId: undefined,
    scheduleId: undefined,
    busId: undefined,
    operatorId: undefined,
  }),
}));
