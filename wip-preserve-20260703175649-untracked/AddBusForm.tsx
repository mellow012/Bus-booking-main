'use client';

import { BUS_STATUSES, BUS_TYPES, CAPACITY_LIMITS } from '../../../_lib/constants';
import { BusFormState } from '../../types';

interface AddBusFormProps {
  form: BusFormState;
  onChange: (form: BusFormState) => void;
}

export default function AddBusForm({ form, onChange }: AddBusFormProps) {
  const set = (patch: Partial<BusFormState>) => onChange({ ...form, ...patch });

  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">License Plate *</label>
        <input
          type="text"
          value={form.licensePlate}
          onChange={(e) => set({ licensePlate: e.target.value })}
          placeholder="BT 1234"
          className="block w-full rounded-lg border-gray-300 shadow-sm sm:text-sm px-3 py-2 border"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bus Type</label>
          <select value={form.busType} onChange={(e) => set({ busType: e.target.value })} className="block w-full rounded-lg border-gray-300 shadow-sm sm:text-sm px-3 py-2 border">
            {BUS_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
          <input
            type="number"
            value={form.capacity}
            onChange={(e) => set({ capacity: e.target.value })}
            min={CAPACITY_LIMITS.min}
            max={CAPACITY_LIMITS.max}
            className="block w-full rounded-lg border-gray-300 shadow-sm sm:text-sm px-3 py-2 border"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
        <select value={form.status} onChange={(e) => set({ status: e.target.value })} className="block w-full rounded-lg border-gray-300 shadow-sm sm:text-sm px-3 py-2 border">
          {BUS_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}