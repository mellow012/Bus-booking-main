// components/SegmentPriceEditor.tsx
//
// Embedded in the Add/Edit Schedule forms in SchedulesTab.
// Lets operators set a price for each stop-to-stop pair on the route.
//
// DATA MODEL:
//   schedule.segmentPrices: { [key: `${originStopId}:${destStopId}`]: number }
//
// The component only renders pairs where the user travels forward (origin before dest).
// Pairs with no price entered are left out of the map — the booking API falls back
// to proportional calculation for those.
//
// USAGE:
//   <SegmentPriceEditor
//     routeId={schedule.routeId}
//     fullPrice={schedule.price}
//     value={segmentPrices}
//     onChange={setSegmentPrices}
//   />

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { Info, ChevronDown, ChevronUp, Tag } from 'lucide-react';

interface RouteStop { id: string; name: string; }

interface SegmentPriceEditorProps {
  routeId:   string;
  fullPrice: number;
  value:     Record<string, number>;
  onChange:  (prices: Record<string, number>) => void;
}

/** Client-side proportional estimate — mirrors server logic */
function proportionalEstimate(
  fullPrice: number,
  stops:     RouteStop[],
  originId:  string,
  destId:    string,
): number {
  const oi = stops.findIndex(s => s.id === originId);
  const di = stops.findIndex(s => s.id === destId);
  if (oi === -1 || di === -1 || di <= oi || stops.length < 2) return fullPrice;
  const raw     = ((di - oi) / (stops.length - 1)) * fullPrice;
  const rounded = Math.round(raw / 50) * 50;
  return Math.max(50, rounded);
}

const SegmentPriceEditor: React.FC<SegmentPriceEditorProps> = ({
  routeId, fullPrice, value, onChange,
}) => {
  const [stops,     setStops]     = useState<RouteStop[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [collapsed, setCollapsed] = useState(true);

  // Load stops from route document
  useEffect(() => {
    if (!routeId) { setStops([]); return; }
    setLoading(true);
    getDoc(doc(db, 'routes', routeId))
      .then(snap => {
        if (!snap.exists()) { setStops([]); return; }
        const data = snap.data();
        const list: RouteStop[] = [];
        if (data.origin)      list.push({ id: '__origin__',      name: data.origin });
        if (data.stops)       list.push(...(data.stops as RouteStop[]).filter(s => s?.id && s?.name));
        if (data.destination) list.push({ id: '__destination__', name: data.destination });
        setStops(list);
      })
      .catch(() => setStops([]))
      .finally(() => setLoading(false));
  }, [routeId]);

  // All forward stop pairs (origin before dest)
  const pairs = useMemo(() => {
    const result: { originId: string; originName: string; destId: string; destName: string }[] = [];
    for (let i = 0; i < stops.length - 1; i++) {
      for (let j = i + 1; j < stops.length; j++) {
        result.push({
          originId:   stops[i].id,
          originName: stops[i].name,
          destId:     stops[j].id,
          destName:   stops[j].name,
        });
      }
    }
    return result;
  }, [stops]);

  if (!routeId || stops.length < 2) return null;

  // Skip full-trip pair (it's set via the main price field)
  const segmentPairs = pairs.filter(
    p => !(p.originId === '__origin__' && p.destId === '__destination__')
  );
  if (segmentPairs.length === 0) return null;

  const setPairPrice = (key: string, raw: string) => {
    const num = parseInt(raw.replace(/[^\d]/g, ''), 10);
    if (isNaN(num) || num <= 0) {
      // Clear the key if blank/zero — API will use proportional fallback
      const next = { ...value };
      delete next[key];
      onChange(next);
    } else {
      onChange({ ...value, [key]: num });
    }
  };

  const setCounts = segmentPairs.filter(p => {
    const key = `${p.originId}:${p.destId}`;
    return typeof value[key] === 'number' && value[key] > 0;
  }).length;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Header — collapsible */}
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-semibold text-gray-800">Segment Prices</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
            {setCounts}/{segmentPairs.length} set
          </span>
        </div>
        <div className="flex items-center gap-2">
          {setCounts < segmentPairs.length && (
            <span className="text-xs text-blue-600">Unset = proportional estimate</span>
          )}
          {collapsed
            ? <ChevronDown className="w-4 h-4 text-gray-400" />
            : <ChevronUp   className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {!collapsed && (
        <div className="p-4 space-y-3">
          {/* Info banner */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              Leave a segment blank to auto-calculate its price proportionally from the full trip fare
              (MWK {fullPrice.toLocaleString()}). Only set prices for segments you want to override.
            </span>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500 text-center py-4">Loading stops…</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {segmentPairs.map(pair => {
                const key       = `${pair.originId}:${pair.destId}`;
                const estimate  = proportionalEstimate(fullPrice, stops, pair.originId, pair.destId);
                const hasCustom = typeof value[key] === 'number' && value[key] > 0;

                return (
                  <div key={key} className="flex items-center gap-3 p-2.5 bg-white border border-gray-100 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">
                        {pair.originName}
                        <span className="text-gray-400 mx-1">→</span>
                        {pair.destName}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Estimate: MWK {estimate.toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs text-gray-500">MWK</span>
                      <input
                        type="number"
                        min="0"
                        step="50"
                        placeholder={String(estimate)}
                        value={hasCustom ? value[key] : ''}
                        onChange={e => setPairPrice(key, e.target.value)}
                        className={`w-28 px-2 py-1.5 border rounded-lg text-sm text-right focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${
                          hasCustom
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-800 font-medium'
                            : 'border-gray-200 bg-gray-50 text-gray-500'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SegmentPriceEditor;