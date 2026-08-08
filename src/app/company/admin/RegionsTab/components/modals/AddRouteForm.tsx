'use client';

import React from 'react';
import { RouteFormState } from '../../types';
import { RouteStop } from '@/types';
import StopsEditor from '@/components/common/StopsEditor';

interface AddRouteFormProps {
  form: RouteFormState;
  onChange: (form: RouteFormState) => void;
}

/** Shared label + input block to enforce uniform styling across all fields */
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  'block w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-900 ' +
  'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm';

export default function AddRouteForm({ form, onChange }: AddRouteFormProps) {
  const set = (patch: Partial<RouteFormState>) => onChange({ ...form, ...patch });

  return (
    <div className="space-y-4">
      {/* Route Name */}
      <Field label="Route Name" required>
        <input
          type="text"
          value={form.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="e.g., Lilongwe – Blantyre Express"
          className={inputCls}
        />
      </Field>

      {/* Origin / Destination */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Origin" required>
          <input
            type="text"
            value={form.origin}
            onChange={(e) => set({ origin: e.target.value })}
            placeholder="Lilongwe"
            className={inputCls}
          />
        </Field>
        <Field label="Destination" required>
          <input
            type="text"
            value={form.destination}
            onChange={(e) => set({ destination: e.target.value })}
            placeholder="Blantyre"
            className={inputCls}
          />
        </Field>
      </div>

      {/* Numeric fields — use inputMode="decimal" so users can clear and retype freely */}
      <div className="grid grid-cols-3 gap-3">
        <Field label="Distance">
          <div className="relative rounded-xl border border-gray-200 bg-white shadow-sm focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all">
            <input
              type="text"
              inputMode="decimal"
              value={form.distance}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '' || /^\d*\.?\d*$/.test(v)) set({ distance: v });
              }}
              placeholder="310"
              className="block w-full bg-transparent px-3 py-2 pr-12 text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none"
            />
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">km</span>
            </div>
          </div>
        </Field>
        <Field label="Duration">
          <div className="relative rounded-xl border border-gray-200 bg-white shadow-sm focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all">
            <input
              type="text"
              inputMode="decimal"
              value={form.duration}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '' || /^\d*\.?\d*$/.test(v)) set({ duration: v });
              }}
              placeholder="240"
              className="block w-full bg-transparent px-3 py-2 pr-12 text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none"
            />
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">min</span>
            </div>
          </div>
        </Field>
        <Field label="Base Fare">
          <div className="relative rounded-xl border border-gray-200 bg-white shadow-sm focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <span className="text-[10px] font-bold text-gray-400">MWK</span>
            </div>
            <input
              type="text"
              inputMode="decimal"
              value={form.baseFare}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '' || /^\d*\.?\d*$/.test(v)) set({ baseFare: v });
              }}
              placeholder="5000"
              className="block w-full bg-transparent pl-11 pr-3 py-2 text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none"
            />
          </div>
        </Field>
      </div>

      {/* Stops Editor */}
      <div className="pt-2 border-t border-gray-100">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
          Intermediate Pick-up Stops <span className="text-gray-400 normal-case font-normal">(optional)</span>
        </p>
        <StopsEditor
          stops={form.stops || []}
          onChange={(newStops: RouteStop[]) => set({ stops: newStops })}
        />
      </div>
    </div>
  );
}