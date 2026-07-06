'use client';

import { RouteFormState } from '../../types';

interface AddRouteFormProps {
  form: RouteFormState;
  onChange: (form: RouteFormState) => void;
}

export default function AddRouteForm({ form, onChange }: AddRouteFormProps) {
  const set = (patch: Partial<RouteFormState>) => onChange({ ...form, ...patch });

  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Route Name *</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="e.g., Lilongwe - Blantyre Express"
          className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Origin *</label>
          <input
            type="text"
            value={form.origin}
            onChange={(e) => set({ origin: e.target.value })}
            placeholder="Lilongwe"
            className="block w-full rounded-lg border-gray-300 shadow-sm sm:text-sm px-3 py-2 border"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Destination *</label>
          <input
            type="text"
            value={form.destination}
            onChange={(e) => set({ destination: e.target.value })}
            placeholder="Blantyre"
            className="block w-full rounded-lg border-gray-300 shadow-sm sm:text-sm px-3 py-2 border"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Distance (km)</label>
          <input
            type="number"
            value={form.distance}
            onChange={(e) => set({ distance: e.target.value })}
            placeholder="310"
            className="block w-full rounded-lg border-gray-300 shadow-sm sm:text-sm px-3 py-2 border"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Duration (min)</label>
          <input
            type="number"
            value={form.duration}
            onChange={(e) => set({ duration: e.target.value })}
            placeholder="240"
            className="block w-full rounded-lg border-gray-300 shadow-sm sm:text-sm px-3 py-2 border"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Base Fare (MWK)</label>
          <input
            type="number"
            value={form.baseFare}
            onChange={(e) => set({ baseFare: e.target.value })}
            placeholder="5000"
            className="block w-full rounded-lg border-gray-300 shadow-sm sm:text-sm px-3 py-2 border"
          />
        </div>
      </div>
    </>
  );
}