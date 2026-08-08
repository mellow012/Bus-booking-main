'use client';

import React, { useState, useMemo, FC } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { RouteStop } from '@/types';

export interface StopsEditorProps {
  stops: RouteStop[];
  onChange: (stops: RouteStop[]) => void;
  readOnly?: boolean;
}

export const generateStopId = (): string =>
  `stop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

export const createEmptyStop = (order: number): RouteStop => ({
  id: generateStopId(),
  name: '',
  distanceFromOrigin: 0,
  order,
});

export const resequenceStops = (stops: RouteStop[]): RouteStop[] =>
  stops.map((s, idx) => ({ ...s, order: idx }));

export const StopsEditor: FC<StopsEditorProps> = ({ stops = [], onChange, readOnly = false }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const sorted = useMemo(() => [...stops].sort((a, b) => a.order - b.order), [stops]);

  const handleAddStop = () => {
    if (readOnly) return;
    const stop = createEmptyStop(stops.length);
    onChange([...stops, stop]);
    setExpandedId(null);
  };

  const handleRemoveStop = (id: string) => {
    if (readOnly) return;
    onChange(resequenceStops(stops.filter((s) => s.id !== id)));
  };

  const handleUpdateStop = (id: string, patch: Partial<RouteStop>) => {
    if (readOnly) return;
    onChange(stops.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const handleMoveStop = (id: string, direction: -1 | 1) => {
    if (readOnly) return;
    const idx = sorted.findIndex((s) => s.id === id);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= sorted.length) return;
    const next = [...sorted];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    onChange(resequenceStops(next));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
          Intermediate Stops &amp; Pick-up Points ({stops.length})
        </label>
        {!readOnly && (
          <button
            type="button"
            onClick={handleAddStop}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-lg text-xs font-bold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Stop
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="text-xs text-gray-400 italic bg-gray-50 p-3 rounded-lg border border-dashed text-center">
          Direct Express Route — No intermediate pick-up stops added yet.
        </p>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {sorted.map((stop, idx) => (
            <div key={stop.id} className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-gray-400 w-5">#{idx + 1}</span>
                <div className="relative flex-1 min-w-[120px] rounded-lg border border-gray-300 bg-white shadow-sm focus-within:ring-2 focus-within:ring-indigo-600 transition-all">
                  <input
                    type="text"
                    value={stop.name}
                    onChange={(e) => handleUpdateStop(stop.id, { name: e.target.value })}
                    disabled={readOnly}
                    placeholder="Stop name (e.g. Dedza)"
                    className="block w-full bg-transparent px-3 py-1.5 text-xs font-bold text-gray-900 placeholder:text-gray-400 focus:outline-none disabled:bg-gray-100 disabled:text-gray-500 rounded-lg"
                    required
                  />
                </div>
                <div className="relative w-28 rounded-lg border border-gray-300 bg-white shadow-sm focus-within:ring-2 focus-within:ring-indigo-600 transition-all">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={stop.distanceFromOrigin}
                    onChange={(e) => handleUpdateStop(stop.id, { distanceFromOrigin: parseFloat(e.target.value) || 0 })}
                    disabled={readOnly}
                    placeholder="Distance"
                    className="block w-full bg-transparent px-3 py-1.5 pr-8 text-xs font-bold text-gray-900 placeholder:text-gray-400 focus:outline-none disabled:bg-gray-100 disabled:text-gray-500 rounded-lg"
                    required
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                    <span className="text-[9px] font-bold text-gray-400">km</span>
                  </div>
                </div>
                <div className="relative w-32 rounded-lg border border-gray-300 bg-white shadow-sm focus-within:ring-2 focus-within:ring-indigo-600 transition-all">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2">
                    <span className="text-[9px] font-bold text-gray-400">MWK</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={typeof stop.price === 'number' ? stop.price : ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? undefined : (parseInt(e.target.value, 10) || 0);
                      handleUpdateStop(stop.id, { price: val });
                    }}
                    disabled={readOnly}
                    placeholder="Fare from start"
                    className="block w-full bg-transparent pl-10 pr-3 py-1.5 text-xs font-bold text-gray-900 placeholder:text-gray-400 focus:outline-none disabled:bg-gray-100 disabled:text-gray-500 rounded-lg"
                  />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!readOnly && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleMoveStop(stop.id, -1)}
                        disabled={idx === 0}
                        className="p-1 text-gray-400 hover:text-indigo-600 disabled:opacity-20"
                        title="Move Up"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveStop(stop.id, 1)}
                        disabled={idx === sorted.length - 1}
                        className="p-1 text-gray-400 hover:text-indigo-600 disabled:opacity-20"
                        title="Move Down"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setExpandedId(expandedId === stop.id ? null : stop.id)}
                    className="px-2 py-1 text-[10px] font-bold text-gray-500 hover:text-indigo-600"
                  >
                    {expandedId === stop.id ? 'Hide' : 'More'}
                  </button>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => handleRemoveStop(stop.id)}
                      className="p-1 text-rose-500 hover:text-rose-700"
                      title="Remove Stop"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {expandedId === stop.id && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-gray-200">
                  <input
                    type="text"
                    value={stop.pickupPoint || ''}
                    onChange={(e) => handleUpdateStop(stop.id, { pickupPoint: e.target.value })}
                    disabled={readOnly}
                    placeholder="Pickup point / terminal name"
                    className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium disabled:bg-gray-100 disabled:text-gray-500"
                  />
                  <input
                    type="text"
                    value={stop.address || ''}
                    onChange={(e) => handleUpdateStop(stop.id, { address: e.target.value })}
                    disabled={readOnly}
                    placeholder="Address / landmark"
                    className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium disabled:bg-gray-100 disabled:text-gray-500"
                  />
                  <input
                    type="text"
                    value={stop.contactPerson || ''}
                    onChange={(e) => handleUpdateStop(stop.id, { contactPerson: e.target.value })}
                    disabled={readOnly}
                    placeholder="Contact person"
                    className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium disabled:bg-gray-100 disabled:text-gray-500"
                  />
                  <input
                    type="text"
                    value={stop.contactPhone || ''}
                    onChange={(e) => handleUpdateStop(stop.id, { contactPhone: e.target.value })}
                    disabled={readOnly}
                    placeholder="Contact phone"
                    className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium disabled:bg-gray-100 disabled:text-gray-500"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StopsEditor;
