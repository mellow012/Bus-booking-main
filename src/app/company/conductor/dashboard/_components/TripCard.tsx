'use client';

import React, { FC } from 'react';
import { Schedule, Bus, Route } from '@/types';
import { Bus as BusIcon, Clock, ArrowRight, CheckCircle, Radio } from 'lucide-react';
import { format } from 'date-fns';

const toDate = (v: unknown): Date => {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  if (v && typeof v === 'object' && 'toDate' in v && typeof (v as any).toDate === 'function') return (v as any).toDate();
  return new Date(v as string | number);
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

type TripBucket = 'live' | 'today' | 'week' | 'completed';

const getTripBucket = (t: Schedule): TripBucket => {
  const ts = t.tripStatus ?? 'scheduled';
  const dep = toDate(t.departureDateTime);
  if (ts === 'boarding' || ts === 'in_transit') return 'live';
  if (ts === 'completed') return 'completed';
  if (isSameDay(dep, new Date())) return 'today';
  return 'week';
};

interface TripCardProps {
  trip: Schedule;
  bus: Bus | undefined;
  route?: Route | undefined;
  onClick: () => void;
}

const TripCard: FC<TripCardProps> = ({ trip, bus, route, onClick }) => {
  const dep = toDate(trip.departureDateTime);
  const arr = toDate(trip.arrivalDateTime);
  const ts = trip.tripStatus ?? 'scheduled';
  const bkt = getTripBucket(trip);

  const accentCls =
    bkt === 'live' ? 'border-l-green-500' :
      bkt === 'today' ? 'border-l-blue-500' :
        bkt === 'completed' ? 'border-l-gray-300' : 'border-l-slate-300';

  const tsBadgeCls =
    ts === 'boarding' ? 'bg-green-100 text-green-800 border-green-200' :
      ts === 'in_transit' ? 'bg-blue-100 text-blue-800 border-blue-200' :
        ts === 'completed' ? 'bg-gray-100 text-gray-500 border-gray-200' :
          'bg-slate-100 text-slate-600 border-slate-200';

  const tsLabel =
    ts === 'boarding' ? '🟢 Boarding' :
      ts === 'in_transit' ? '🚌 In Transit' :
        ts === 'completed' ? '✓ Completed' : 'Scheduled';

  const booked = trip.bookedSeats?.length || 0;
  const pct = bus?.capacity ? Math.min((booked / bus.capacity) * 100, 100) : 0;

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border border-l-4 shadow-sm hover:shadow-md active:scale-[0.98] transition-all duration-200 cursor-pointer ${accentCls} ${bkt === 'completed' ? 'opacity-70' : ''}`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 truncate">
              {trip.departureLocation || route?.origin || 'TBD'} → {trip.arrivalLocation || route?.destination || 'TBD'}
            </p>
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
              <BusIcon className="w-3.5 h-3.5" /> {bus?.licensePlate ?? '—'} · {bus?.busType ?? '—'}
            </p>
          </div>
          <span className="shrink-0 text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1.5 rounded-lg">
            {isSameDay(dep, new Date()) ? 'Today' : format(dep, 'EEE d MMM')}
          </span>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-700 mb-3">
          <Clock className="w-4 h-4 text-gray-400" />
          <span className="font-bold text-base">{format(dep, 'HH:mm')}</span>
          <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
          <span className="font-bold text-base">{format(arr, 'HH:mm')}</span>
        </div>

        {bus?.capacity && (
          <div className="mb-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span className="font-medium">{booked} booked</span>
              <span className="font-medium">{bus.capacity - booked} free</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${pct > 75 ? 'bg-red-400' : pct > 50 ? 'bg-amber-400' : 'bg-green-400'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${tsBadgeCls}`}>{tsLabel}</span>
          <span className="text-xs text-blue-600 font-bold">
            {(ts === 'boarding' || ts === 'in_transit') ? 'Manage →' : 'View →'}
          </span>
        </div>
      </div>
    </div>
  );
};

export { getTripBucket, toDate, isSameDay };
export default TripCard;
