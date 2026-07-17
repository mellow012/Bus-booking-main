import { create } from 'zustand';

type DateRange = {
  from?: string | null;
  to?: string | null;
};

type OperatorFilterState = {
  routeId: string | null;
  scheduleId: string | null;
  bookingId: string | null;
  busId: string | null;
  dateRange: DateRange;

  setRoute: (id: string | null) => void;
  setSchedule: (id: string | null) => void;
  setBooking: (id: string | null) => void;
  setBus: (id: string | null) => void;
  setDateRange: (range: DateRange) => void;
  clearAll: () => void;
};

export const useOperatorFilterStore = create<OperatorFilterState>((set) => ({
  routeId: null,
  scheduleId: null,
  bookingId: null,
  busId: null,
  dateRange: { from: null, to: null },

  setRoute: (id) => set(() => ({ routeId: id })),
  setSchedule: (id) => set(() => ({ scheduleId: id })),
  setBooking: (id) => set(() => ({ bookingId: id })),
  setBus: (id) => set(() => ({ busId: id })),
  setDateRange: (range) => set(() => ({ dateRange: range })),
  clearAll: () => set(() => ({
    routeId: null,
    scheduleId: null,
    bookingId: null,
    busId: null,
    dateRange: { from: null, to: null }
  }))
}));

export default useOperatorFilterStore;
