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

  const gradientCls =
    bkt === 'live' ? 'from-green-400 to-emerald-500' :
      bkt === 'today' ? 'from-blue-400 to-indigo-500' :
        bkt === 'completed' ? 'from-gray-300 to-gray-400' : 'from-slate-400 to-slate-600';

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
      className={`group bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-indigo-100 hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 cursor-pointer overflow-hidden flex flex-col ${bkt === 'completed' ? 'opacity-70' : ''}`}
    >
      <div className={`h-1.5 w-full bg-gradient-to-r ${gradientCls}`} />
      
      <div className="p-4 sm:p-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex-1 min-w-0">
            <p className="font-extrabold text-gray-900 text-lg truncate leading-tight group-hover:text-indigo-600 transition-colors">
              {trip.departureLocation || route?.origin || 'TBD'} <ArrowRight className="inline w-4 h-4 text-gray-400 mx-0.5" /> {trip.arrivalLocation || route?.destination || 'TBD'}
            </p>
            <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1.5 font-medium">
              <span className="bg-gray-100 px-2 py-0.5 rounded-full flex items-center gap-1 text-gray-600"><BusIcon className="w-3 h-3" /> {bus?.licensePlate ?? '—'}</span>
              <span>{bus?.busType ?? '—'}</span>
            </p>
          </div>
          <span className="shrink-0 text-[10px] sm:text-xs font-bold text-gray-500 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-lg uppercase tracking-wider">
            {isSameDay(dep, new Date()) ? 'Today' : format(dep, 'MMM d')}
          </span>
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 mb-4 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Depart</span>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-500" />
              <span className="font-black text-gray-900 text-lg sm:text-xl leading-none">{format(dep, 'HH:mm')}</span>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center px-4">
            <div className="h-[2px] w-full bg-gray-200 relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-gray-300" />
            </div>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Arrive</span>
            <div className="flex items-center gap-1.5 justify-end">
              <span className="font-black text-gray-900 text-lg sm:text-xl leading-none">{format(arr, 'HH:mm')}</span>
            </div>
          </div>
        </div>

        {bus?.capacity && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span className="font-semibold text-gray-700">{booked} booked</span>
              <span className="font-medium text-gray-400">{bus.capacity - booked} free seats</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${pct > 80 ? 'bg-red-400' : pct > 50 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-auto pt-3 border-t border-gray-100 flex items-center justify-between">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold border ${tsBadgeCls} tracking-wide`}>
            {tsLabel}
          </span>
          <span className="text-xs sm:text-sm text-indigo-600 font-bold group-hover:translate-x-1 transition-transform flex items-center gap-1">
            {(ts === 'boarding' || ts === 'in_transit') ? 'Manage Trip' : 'View Details'} <ArrowRight className="w-4 h-4" />
          </span>
        </div>
      </div>
    </div>
  );
};

export { getTripBucket, toDate, isSameDay };
export default TripCard;
