'use client';

import React from 'react';
import { generateSeatRows } from '@/lib/chatterSeatUtils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BookingRow {
  seatNumbers?: unknown;
  paymentStatus?: string;
}

interface ChatterSeatMapProps {
  totalSeats: number;
  bookings: BookingRow[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseSeatArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter((s): s is string => typeof s === 'string');
  if (typeof val === 'string') {
    try {
      const p = JSON.parse(val);
      if (Array.isArray(p)) return p.filter((s): s is string => typeof s === 'string');
    } catch {
      return [];
    }
  }
  return [];
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * ChatterSeatMap
 *
 * Renders an interactive seat-map for a ChatterSchedule, colour-coded by
 * booking payment status:
 *   paid    → emerald
 *   pending → amber
 *   failed  → rose  (new — cascades safely on hard-delete)
 *   empty   → white
 *
 * Extracted from MySchedulesClient so it can be used standalone.
 * Uses generateSeatRows from chatterSeatUtils for consistent row generation.
 */
export default function ChatterSeatMap({ totalSeats, bookings }: ChatterSeatMapProps) {
  const total = Math.max(0, Math.min(Number(totalSeats) || 0, 100));
  if (total === 0) return null;

  const rows = generateSeatRows(total);

  const paidSeats    = new Set(bookings.filter(b => b.paymentStatus === 'paid').flatMap(b => parseSeatArray(b.seatNumbers)));
  const pendingSeats = new Set(bookings.filter(b => b.paymentStatus === 'pending').flatMap(b => parseSeatArray(b.seatNumbers)));
  const failedSeats  = new Set(bookings.filter(b => b.paymentStatus === 'failed').flatMap(b => parseSeatArray(b.seatNumbers)));

  const seatCls = (n: string) => {
    if (paidSeats.has(n))    return 'bg-emerald-500 text-white border-emerald-600 shadow-emerald-100';
    if (pendingSeats.has(n)) return 'bg-amber-400  text-white border-amber-500   shadow-amber-100';
    if (failedSeats.has(n))  return 'bg-rose-500   text-white border-rose-600    shadow-rose-100';
    return 'bg-white text-slate-600 border-gray-200 hover:border-brand-300';
  };

  const LEGEND = [
    { color: 'bg-emerald-500', label: 'Paid' },
    { color: 'bg-amber-400',   label: 'Pending' },
    { color: 'bg-rose-500',    label: 'Failed' },
    { color: 'bg-white border border-gray-300', label: 'Empty' },
  ];

  return (
    <div className="rounded-2xl border border-gray-100 bg-slate-50/60 p-4">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-slate-500 mb-3">
        Live Seat Map
      </p>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 mb-4 pb-3 border-b border-slate-100">
        {LEGEND.map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <span className={`inline-block w-2.5 h-2.5 rounded ${color}`} />
            {label}
          </span>
        ))}
      </div>

      {/* Bus shell */}
      <div className="max-w-[220px] mx-auto border-4 border-slate-200 rounded-t-3xl rounded-b-xl bg-white p-3 shadow-inner">
        {/* Driver area */}
        <div className="flex justify-between items-center pb-3 mb-3 border-b border-slate-100">
          <div className="w-6 h-6 rounded-full bg-brand-700 flex items-center justify-center">
            <span className="text-[8px] font-black text-white">✦</span>
          </div>
          <div className="h-4 w-8 rounded bg-slate-100 border border-slate-200 flex items-center justify-center">
            <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">Door</span>
          </div>
        </div>

        {/* Seat grid */}
        <div className="space-y-2">
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className="flex justify-between items-center gap-1">
              {/* Left seats (A-side) */}
              <div className="flex gap-1 w-[45%] justify-end">
                {row.slice(0, 2).map(seatNum => (
                  <div
                    key={seatNum}
                    title={`Seat ${seatNum}`}
                    className={`w-7 h-7 rounded-lg border flex items-center justify-center text-[9px] font-bold shadow-sm transition-all ${seatCls(seatNum)}`}
                  >
                    {seatNum}
                  </div>
                ))}
              </div>

              {/* Aisle */}
              <div className="w-[10%] text-center text-[6px] font-bold text-slate-300 uppercase tracking-widest select-none">
                │
              </div>

              {/* Right seats (B-side) */}
              <div className="flex gap-1 w-[45%] justify-start">
                {row.slice(2, 4).map(seatNum => (
                  <div
                    key={seatNum}
                    title={`Seat ${seatNum}`}
                    className={`w-7 h-7 rounded-lg border flex items-center justify-center text-[9px] font-bold shadow-sm transition-all ${seatCls(seatNum)}`}
                  >
                    {seatNum}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
