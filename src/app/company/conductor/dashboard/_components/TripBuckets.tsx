'use client';

import React, { FC, useState, useMemo } from 'react';
import { Schedule, Bus, Route } from '@/types';
import { Calendar, Radio, Flame, CalendarClock, CheckCircle, LayoutGrid } from 'lucide-react';
import TripCard, { getTripBucket, toDate } from './TripCard';

// Add 'all' to trip buckets
type TripBucketFilter = 'all' | 'live' | 'today' | 'week' | 'completed';
type TripBucket = 'live' | 'today' | 'week' | 'completed';

const FILTER_CFG: Record<TripBucketFilter, {
  label: string; icon: React.ReactNode;
  activeCls: string; inactiveCls: string; pillCls: string;
}> = {
  all: { label: 'All Active', icon: <LayoutGrid className="w-4 h-4" />, activeCls: 'bg-indigo-600 text-white shadow-md border-indigo-600', inactiveCls: 'bg-white text-gray-600 hover:bg-gray-50 border-gray-200', pillCls: 'bg-indigo-500 text-white' },
  live: { label: 'Live Now', icon: <Radio className="w-4 h-4" />, activeCls: 'bg-green-600 text-white shadow-md border-green-600', inactiveCls: 'bg-white text-gray-600 hover:bg-green-50 border-gray-200', pillCls: 'bg-green-500 text-white' },
  today: { label: 'Today', icon: <Flame className="w-4 h-4" />, activeCls: 'bg-blue-600 text-white shadow-md border-blue-600', inactiveCls: 'bg-white text-gray-600 hover:bg-blue-50 border-gray-200', pillCls: 'bg-blue-500 text-white' },
  week: { label: 'This Week', icon: <CalendarClock className="w-4 h-4" />, activeCls: 'bg-slate-700 text-white shadow-md border-slate-700', inactiveCls: 'bg-white text-gray-600 hover:bg-slate-50 border-gray-200', pillCls: 'bg-slate-600 text-white' },
  completed: { label: 'Completed', icon: <CheckCircle className="w-4 h-4" />, activeCls: 'bg-gray-600 text-white shadow-md border-gray-600', inactiveCls: 'bg-white text-gray-500 hover:bg-gray-50 border-gray-200', pillCls: 'bg-gray-500 text-white' },
};

const FILTER_ORDER: TripBucketFilter[] = ['all', 'live', 'today', 'week', 'completed'];

interface TripBucketsProps {
  trips: Schedule[];
  buses: Bus[];
  routes: Route[];
  onSelect: (t: Schedule) => void;
}

const TripBuckets: FC<TripBucketsProps> = ({ trips, buses, routes, onSelect }) => {
  const [activeFilter, setActiveFilter] = useState<TripBucketFilter>('all');
  const busMap = useMemo(() => new Map(buses.map(b => [b.id, b])), [buses]);
  const routeMap = useMemo(() => new Map(routes.map(r => [r.id, r])), [routes]);

  const bucketed = useMemo(() => {
    const map: Record<TripBucket, Schedule[]> = { live: [], today: [], week: [], completed: [] };
    trips.forEach(t => { map[getTripBucket(t)].push(t); });
    const asc = (a: Schedule, b: Schedule) => toDate(a.departureDateTime).getTime() - toDate(b.departureDateTime).getTime();
    const desc = (a: Schedule, b: Schedule) => toDate(b.departureDateTime).getTime() - toDate(a.departureDateTime).getTime();
    map.live.sort(asc); map.today.sort(asc); map.week.sort(asc); map.completed.sort(desc);
    return map;
  }, [trips]);

  const allActive = useMemo(() => [...bucketed.live, ...bucketed.today, ...bucketed.week], [bucketed]);
  const counts: Record<TripBucketFilter, number> = {
    all: allActive.length,
    live: bucketed.live.length,
    today: bucketed.today.length,
    week: bucketed.week.length,
    completed: bucketed.completed.length
  };

  const displayedTrips = activeFilter === 'all' ? allActive : bucketed[activeFilter as TripBucket];

  if (trips.length === 0) {
    return (
      <section>
        <h2 className="text-xl sm:text-2xl font-bold mb-4 flex items-center gap-2">
          <Calendar className="w-6 h-6 text-blue-600" /> Your Trips
        </h2>
        <div className="bg-white rounded-2xl p-8 sm:p-10 text-center border shadow-sm">
          <Calendar className="w-14 h-14 text-gray-300 mx-auto mb-4" />
          <p className="text-lg font-semibold text-gray-700">No trips assigned yet</p>
          <p className="text-gray-500 mt-2 text-sm">Your operator hasn&apos;t assigned any upcoming trips to your buses</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <Calendar className="w-6 h-6 text-blue-600" /> Your Trips
        </h2>
        <span className="text-sm text-gray-500 font-medium bg-gray-100 px-3 py-1 rounded-full">{counts.all} active</span>
      </div>
      
      {/* Horizontal Pill Filters */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-2 scrollbar-hide snap-x px-1 -mx-1">
        {FILTER_ORDER.map(filter => {
          const cfg = FILTER_CFG[filter];
          const count = counts[filter];
          const isActive = activeFilter === filter;
          
          if (count === 0 && filter !== 'all') return null; // Hide empty buckets except 'all'
          
          return (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full border text-sm font-semibold whitespace-nowrap transition-all duration-300 snap-start shrink-0 active:scale-95 ${isActive ? cfg.activeCls : cfg.inactiveCls}`}
            >
              {cfg.icon}
              <span>{cfg.label}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ml-1 transition-colors ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Grid of Trips */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        {displayedTrips.length > 0 ? (
          displayedTrips.map(trip => (
            <div key={trip.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <TripCard trip={trip} bus={busMap.get(trip.busId)} route={routeMap.get(trip.routeId)} onClick={() => onSelect(trip)} />
            </div>
          ))
        ) : (
          <div className="col-span-full bg-gray-50 border border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-500 animate-in fade-in">
            No trips found in this category.
          </div>
        )}
      </div>
    </section>
  );
};

export default TripBuckets;
