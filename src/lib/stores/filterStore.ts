import { create } from 'zustand'

type DateRange = {
  from?: string | null
  to?: string | null
}

type FilterState = {
  regionId?: string | null
  routeId?: string | null
  scheduleId?: string | null
  bookingId?: string | null
  companyId?: string | null
  dateRange?: DateRange

  setRegion: (id?: string | null) => void
  setRoute: (id?: string | null) => void
  setSchedule: (id?: string | null) => void
  setBooking: (payload: {
    id?: string | null
    scheduleId?: string | null
    routeId?: string | null
    companyId?: string | null
    regionId?: string | null
  }) => void
  setCompany: (id?: string | null) => void
  setDateRange: (r: DateRange) => void
  clearAll: () => void
}

export const useFilterStore = create<FilterState>((set) => ({
  regionId: null,
  routeId: null,
  scheduleId: null,
  bookingId: null,
  companyId: null,
  dateRange: { from: null, to: null },

  setRegion: (id) => set(() => ({ regionId: id })),
  setRoute: (id) => set(() => ({ routeId: id })),
  setSchedule: (id) => set(() => ({ scheduleId: id })),
  setCompany: (id) => set(() => ({ companyId: id })),

  // setBooking accepts a booking payload and synchronizes the related ids
  setBooking: ({ id, scheduleId, routeId, companyId, regionId }) =>
    set(() => ({
      bookingId: id ?? null,
      scheduleId: scheduleId ?? null,
      routeId: routeId ?? null,
      companyId: companyId ?? null,
      regionId: regionId ?? null,
    })),

  setDateRange: (r) => set(() => ({ dateRange: r })),

  clearAll: () =>
    set(() => ({
      regionId: null,
      routeId: null,
      scheduleId: null,
      bookingId: null,
      companyId: null,
      dateRange: { from: null, to: null },
    })),
}))

export default useFilterStore
