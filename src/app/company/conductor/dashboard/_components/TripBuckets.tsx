'use client';

import React, { FC, useState, useMemo } from 'react';
import { Schedule, Bus, Route } from '@/types';
import { Calendar, ChevronDown, ChevronUp, Radio, Flame, CalendarClock, CheckCircle } from 'lucide-react';
import TripCard, { getTripBucket, toDate } from './TripCard';

type TripBucket = 'live' | 'today' | 'week' | 'completed';

const BUCKET_CFG: Record<TripBucket, {
  label: string; icon: React.ReactNode;
  textCls: string; bgCls: string; borderCls: string; pillCls: string;
}> = {
  live: { label: 'Live Now', icon: <Radio className="w-4 h-4" />, textCls: 'text-green-800', bgCls: 'bg-green-50', borderCls: 'border-green-200', pillCls: 'bg-green-200 text-green-900' },
  today: { label: 'Today', icon: <Flame className="w-4 h-4" />, textCls: 'text-blue-800', bgCls: 'bg-blue-50', borderCls: 'border-blue-200', pillCls: 'bg-blue-200 text-blue-900' },
  week: { label: 'This Week', icon: <CalendarClock className="w-4 h-4" />, textCls: 'text-slate-700', bgCls: 'bg-slate-50', borderCls: 'border-slate-200', pillCls: 'bg-slate-200 text-slate-800' },
  completed: { label: 'Completed', icon: <CheckCircle className="w-4 h-4" />, textCls: 'text-gray-600', bgCls: 'bg-gray-50', borderCls: 'border-gray-200', pillCls: 'bg-gray-200 text-gray-700' },
};

const BUCKET_ORDER: TripBucket[] = ['live', 'today', 'week', 'completed'];

interface TripBucketsProps {
  trips: Schedule[];
  buses: Bus[];
  routes: Route[];
  onSelect: (t: Schedule) => void;
}

const TripBuckets: FC<TripBucketsProps> = ({ trips, buses, routes, onSelect }) => {
  const [collapsed, setCollapsed] = useState<Record<TripBucket, boolean>>({
    live: false, today: false, week: false, completed: true,
  });
  const toggle = (b: TripBucket) => setCollapsed(p => ({ ...p, [b]: !p[b] }));
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

  const totalActive = bucketed.live.length + bucketed.today.length + bucketed.week.length;

  if (trips.length === 0) {
    return (
      <section>
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          <Calendar className="w-6 h-6 text-blue-600" /> Your Trips
        </h2>
        <div className="bg-white rounded-2xl p-10 text-center border shadow-sm">
          <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-xl font-medium text-gray-700">No trips assigned yet</p>
          <p className="text-gray-500 mt-2 text-sm">Your operator hasn&apos;t assigned any upcoming trips to your buses</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <Calendar className="w-6 h-6 text-blue-600" /> Your Trips
        </h2>
        <span className="text-sm text-gray-500">{totalActive} active</span>
      </div>
      <div className="space-y-4">
        {BUCKET_ORDER.map(bucket => {
          const list = bucketed[bucket];
          if (!list.length) return null;
          const cfg = BUCKET_CFG[bucket];
          return (
            <div key={bucket} className="space-y-3">
              <button
                onClick={() => toggle(bucket)}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border font-medium text-sm transition-all hover:opacity-90 ${cfg.bgCls} ${cfg.borderCls} ${cfg.textCls}`}
              >
                <div className="flex items-center gap-2.5">
                  {cfg.icon}
                  <span className="font-semibold">{cfg.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${cfg.pillCls}`}>{list.length}</span>
                </div>
                {collapsed[bucket] ? <ChevronDown className="w-4 h-4 opacity-50" /> : <ChevronUp className="w-4 h-4 opacity-50" />}
              </button>
              {!collapsed[bucket] && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 pl-1">
                  {list.map(trip => (
                    <TripCard key={trip.id} trip={trip} bus={busMap.get(trip.busId)} route={routeMap.get(trip.routeId)} onClick={() => onSelect(trip)} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default TripBuckets;
