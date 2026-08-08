'use client';

import { useState } from 'react';
import { BUS_STATUSES, BUS_TYPES, SEAT_LAYOUT_TYPES, CAPACITY_LIMITS } from '../../../_lib/constants';
import { BusFormState } from '../../types';
import { RowOverride, RowOverrideType } from '@/lib/seatLayout';
import { Plus, Trash2 } from 'lucide-react';

interface AddBusFormProps {
  form: BusFormState & { seatLayoutPreset?: string; firstRowSeats?: number; rowOverrides?: RowOverride[] };
  onChange: (form: any) => void;
}

export default function AddBusForm({ form, onChange }: AddBusFormProps) {
  const set = (patch: Partial<any>) => onChange({ ...form, ...patch });

  const [showAddOverride, setShowAddOverride] = useState(false);
  const [newOverridePosMode, setNewOverridePosMode] = useState<'first' | 'last' | 'specific'>('last');
  const [newOverrideSpecificRow, setNewOverrideSpecificRow] = useState<number>(5);
  const [newOverrideType, setNewOverrideType] = useState<RowOverrideType>('bench');
  const [newOverrideBenchSeats, setNewOverrideBenchSeats] = useState<number>(5);
  const [newOverrideLeftSeats, setNewOverrideLeftSeats] = useState<number>(2);
  const [newOverrideRightSeats, setNewOverrideRightSeats] = useState<number>(0);
  const [newOverrideLabel, setNewOverrideLabel] = useState<string>('W/C');

  const rowOverrides = form.rowOverrides || [];

  const handleAddOverride = () => {
    const position = newOverridePosMode === 'specific' ? newOverrideSpecificRow : newOverridePosMode;
    let overrideObj: RowOverride;

    if (newOverrideType === 'bench') {
      overrideObj = { position, type: 'bench', benchSeats: newOverrideBenchSeats };
    } else if (newOverrideType === 'block') {
      overrideObj = { position, type: 'block', label: newOverrideLabel || 'W/C' };
    } else {
      overrideObj = { position, type: 'asymmetric', leftSeats: newOverrideLeftSeats, rightSeats: newOverrideRightSeats };
    }

    set({ rowOverrides: [...rowOverrides, overrideObj] });
    setShowAddOverride(false);
  };

  const handleRemoveOverride = (index: number) => {
    set({ rowOverrides: rowOverrides.filter((_, i) => i !== index) });
  };

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
          <label className="block text-sm font-medium text-gray-700 mb-1">Bus Category (Tier)</label>
          <select value={form.busType} onChange={(e) => set({ busType: e.target.value })} className="block w-full rounded-lg border-gray-300 shadow-sm sm:text-sm px-3 py-2 border">
            {BUS_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Seat Layout Shape</label>
          <select
            value={form.seatLayoutPreset || 'coach'}
            onChange={(e) => set({ seatLayoutPreset: e.target.value })}
            className="block w-full rounded-lg border-gray-300 shadow-sm sm:text-sm px-3 py-2 border"
          >
            {SEAT_LAYOUT_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
        <div className="relative rounded-lg border border-gray-300 bg-white shadow-sm focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all">
          <input
            type="number"
            value={form.capacity}
            onChange={(e) => set({ capacity: e.target.value })}
            min={CAPACITY_LIMITS.min}
            max={CAPACITY_LIMITS.max}
            className="block w-full bg-transparent px-3 py-2 pr-16 text-sm text-gray-900 focus:outline-none border-none"
          />
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">seats</span>
          </div>
        </div>
      </div>

      {/* Row Overrides Section */}
      <div className="pt-2 border-t border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">Custom Row Overrides</label>
          {!showAddOverride && (
            <button
              type="button"
              onClick={() => setShowAddOverride(true)}
              className="text-xs text-brand-600 font-bold hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Override
            </button>
          )}
        </div>

        {rowOverrides.length > 0 ? (
          <div className="space-y-1.5 mb-3">
            {rowOverrides.map((ov, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <span className="font-bold text-gray-800 capitalize">
                    {ov.position === 'first' ? 'First Row' : ov.position === 'last' ? 'Last Row' : `Row ${ov.position}`}:
                  </span>{' '}
                  <span className="text-gray-600">
                    {ov.type === 'bench' ? `Bench (${ov.benchSeats || 5} seats)` : ov.type === 'block' ? `Block (${ov.label || 'W/C'})` : `Asymmetric (${ov.leftSeats || 0}L / ${ov.rightSeats || 0}R)`}
                  </span>
                </div>
                <button type="button" onClick={() => handleRemoveOverride(i)} className="text-rose-500 hover:text-rose-700">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 mb-2 italic">No custom row overrides added (using default preset grid).</p>
        )}

        {showAddOverride && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3 mb-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-gray-600 mb-1">Position</label>
                <select value={newOverridePosMode} onChange={e => setNewOverridePosMode(e.target.value as any)} className="w-full px-2 py-1 border border-gray-300 rounded">
                  <option value="last">Last Row</option>
                  <option value="first">First Row</option>
                  <option value="specific">Specific Row #</option>
                </select>
              </div>
              {newOverridePosMode === 'specific' && (
                <div>
                  <label className="block text-gray-600 mb-1">Row Number</label>
                  <input type="number" min="1" max="30" value={newOverrideSpecificRow} onChange={e => setNewOverrideSpecificRow(parseInt(e.target.value) || 1)} className="w-full px-2 py-1 border border-gray-300 rounded" />
                </div>
              )}
              <div>
                <label className="block text-gray-600 mb-1">Override Type</label>
                <select value={newOverrideType} onChange={e => setNewOverrideType(e.target.value as any)} className="w-full px-2 py-1 border border-gray-300 rounded">
                  <option value="bench">Bench Row (Continuous)</option>
                  <option value="block">Non-seat Block (W/C)</option>
                  <option value="asymmetric">Asymmetric Row</option>
                </select>
              </div>
            </div>

            {newOverrideType === 'bench' && (
              <div>
                <label className="block text-gray-600 mb-1">Bench Seats Count</label>
                <input type="number" min="1" max="6" value={newOverrideBenchSeats} onChange={e => setNewOverrideBenchSeats(parseInt(e.target.value) || 5)} className="w-full px-2 py-1 border border-gray-300 rounded" />
              </div>
            )}

            {newOverrideType === 'block' && (
              <div>
                <label className="block text-gray-600 mb-1">Block Label</label>
                <input type="text" placeholder="W/C" value={newOverrideLabel} onChange={e => setNewOverrideLabel(e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded" />
              </div>
            )}

            {newOverrideType === 'asymmetric' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-600 mb-1">Left Seats</label>
                  <input type="number" min="0" max="3" value={newOverrideLeftSeats} onChange={e => setNewOverrideLeftSeats(parseInt(e.target.value) || 0)} className="w-full px-2 py-1 border border-gray-300 rounded" />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">Right Seats</label>
                  <input type="number" min="0" max="3" value={newOverrideRightSeats} onChange={e => setNewOverrideRightSeats(parseInt(e.target.value) || 0)} className="w-full px-2 py-1 border border-gray-300 rounded" />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowAddOverride(false)} className="px-2.5 py-1 text-gray-500 hover:text-gray-700">Cancel</button>
              <button type="button" onClick={handleAddOverride} className="px-3 py-1 bg-brand-600 text-white rounded font-bold hover:bg-brand-700">Save Override</button>
            </div>
          </div>
        )}
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