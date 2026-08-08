'use client';

import { Bus, Route } from '@/types';
import { ModalContext, ScheduleFormState } from '../../types';

interface AddScheduleFormProps {
  form: ScheduleFormState;
  onChange: (form: ScheduleFormState) => void;
  modalContext: ModalContext;
  routes: Route[];
  buses: Bus[];
}

export default function AddScheduleForm({ form, onChange, modalContext, routes, buses }: AddScheduleFormProps) {
  const set = (patch: Partial<ScheduleFormState>) => onChange({ ...form, ...patch });
  const activeBuses = buses.filter((b: Bus) => b.status === 'active');
  const routeOptions = modalContext.branchId ? routes.filter((r: Route) => r.regionId === modalContext.branchId) : routes;

  return (
    <>
      {!modalContext.routeId && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Route *</label>
          <select value={form.routeId} onChange={(e) => set({ routeId: e.target.value })} className="block w-full rounded-lg border-gray-300 shadow-sm sm:text-sm px-3 py-2 border">
            <option value="">Select a route</option>
            {routeOptions.map((r: Route) => (
              <option key={r.id} value={r.id}>
                {r.name || `${r.origin} → ${r.destination}`}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Bus *</label>
        <select
          value={form.busId}
          onChange={(e) => {
            const bus = buses.find((b: Bus) => b.id === e.target.value);
            set({ busId: e.target.value, availableSeats: bus?.capacity?.toString() || form.availableSeats });
          }}
          className="block w-full rounded-lg border-gray-300 shadow-sm sm:text-sm px-3 py-2 border"
        >
          <option value="">Select a bus</option>
          {activeBuses.map((b: Bus) => (
            <option key={b.id} value={b.id}>
              {b.licensePlate} — {b.busType} ({b.capacity} seats)
            </option>
          ))}
        </select>
        {activeBuses.length === 0 && <p className="text-xs text-amber-600 mt-1">No active buses. Add a bus first.</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Departure Date *</label>
          <input
            type="date"
            value={form.departureDate}
            onChange={(e) => set({ departureDate: e.target.value })}
            className="block w-full rounded-lg border-gray-300 shadow-sm sm:text-sm px-3 py-2 border"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Departure Time *</label>
          <input
            type="time"
            value={form.departureTime}
            onChange={(e) => set({ departureTime: e.target.value })}
            className="block w-full rounded-lg border-gray-300 shadow-sm sm:text-sm px-3 py-2 border"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Arrival Date</label>
          <input
            type="date"
            value={form.arrivalDate}
            onChange={(e) => set({ arrivalDate: e.target.value })}
            className="block w-full rounded-lg border-gray-300 shadow-sm sm:text-sm px-3 py-2 border"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Arrival Time</label>
          <input
            type="time"
            value={form.arrivalTime}
            onChange={(e) => set({ arrivalTime: e.target.value })}
            className="block w-full rounded-lg border-gray-300 shadow-sm sm:text-sm px-3 py-2 border"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Price per Seat *</label>
          <div className="relative rounded-lg border border-gray-300 bg-white shadow-sm focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <span className="text-[10px] font-bold text-gray-400">MWK</span>
            </div>
            <input
              type="number"
              value={form.price}
              onChange={(e) => set({ price: e.target.value })}
              placeholder="5000"
              className="block w-full bg-transparent pl-11 pr-3 py-2 text-sm text-gray-900 focus:outline-none border-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Available Seats</label>
          <div className="relative rounded-lg border border-gray-300 bg-white shadow-sm focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all">
            <input
              type="number"
              value={form.availableSeats}
              onChange={(e) => set({ availableSeats: e.target.value })}
              placeholder="Auto from bus"
              className="block w-full bg-transparent px-3 py-2 pr-16 text-sm text-gray-900 focus:outline-none border-none"
            />
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">seats</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}