'use client';

import { useMemo, useState } from 'react';
import { Bus as BusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Schedule, Route, Bus } from '@/types';
import { formatTime12 } from '@/lib/timezone';

interface MyTripsTabProps {
  trips: Schedule[];
  routes: Route[];
  buses: Bus[];
  selectedTrip: Schedule | null;
  setSelectedTrip: (trip: Schedule) => void;
  setActiveTab: (tab: any) => void;
}

export default function MyTripsTab({
  trips, routes, buses, selectedTrip, setSelectedTrip, setActiveTab
}: MyTripsTabProps) {
  const [tab, setTab] = useState<'current' | 'upcoming' | 'past'>('current');
  const visibleTrips = useMemo(() => trips.filter((trip) => {
    if (tab === 'past') return trip.tripStatus === 'completed' || trip.tripStatus === 'cancelled' || new Date(trip.arrivalDateTime) < new Date();
    if (tab === 'upcoming') return trip.tripStatus === 'scheduled' && new Date(trip.departureDateTime) >= new Date();
    return trip.tripStatus !== 'completed' && trip.tripStatus !== 'cancelled' && (trip.tripStatus !== 'scheduled' || new Date(trip.departureDateTime) < new Date());
  }), [trips, tab]);
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
       <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">My Assigned Trips</h2>
          <div className="flex gap-1 rounded-xl bg-white p-1 border">
            {(['current', 'upcoming', 'past'] as const).map((key) => <button key={key} onClick={() => setTab(key)} className={`rounded-lg px-3 py-2 text-[10px] font-bold uppercase ${tab === key ? 'bg-brand-700 text-white' : 'text-gray-500'}`}>{key}</button>)}
          </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleTrips.length === 0 ? (
            <div className="col-span-full bg-white p-12 rounded-3xl text-center border border-dashed">
               <p className="text-gray-500 font-bold">No trips assigned to you.</p>
            </div>
          ) : visibleTrips.map(trip => {
            const route = routes.find(r => r.id === trip.routeId);
            const bus = buses.find(b => b.id === trip.busId);
            const isSelected = selectedTrip?.id === trip.id;

            return (
              <div key={trip.id} className={`bg-white rounded-2xl border p-5 shadow-sm hover:shadow-md transition-all ${isSelected ? 'ring-2 ring-brand-700' : 'border-gray-200'}`}>
                 <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center text-brand-700 border border-brand-100">
                          <BusIcon className="w-5 h-5" />
                       </div>
                       <div>
                          <p className="text-sm font-bold text-gray-900">{route?.origin} → {route?.destination}</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{bus?.licensePlate || 'Bus N/A'}</p>
                       </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider ${
                      trip.tripStatus === 'boarding' ? 'bg-amber-100 text-amber-700' :
                      trip.tripStatus === 'in_transit' ? 'bg-blue-100 text-blue-700' :
                      trip.tripStatus === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {trip.tripStatus || 'Scheduled'}
                    </span>
                 </div>
                 
                 <div className="flex items-center justify-between mb-5">
                    <div>
                       <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Departure</p>
                       <p className="text-xs font-bold text-gray-900">{formatTime12(trip.departureDateTime)}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Arrival</p>
                       <p className="text-xs font-bold text-gray-900">{formatTime12(trip.arrivalDateTime)}</p>
                    </div>
                 </div>

                 <Button 
                   onClick={() => { setSelectedTrip(trip); setActiveTab('passengers'); }}
                   className={`w-full py-2.5 rounded-xl text-xs font-bold ${isSelected ? 'bg-brand-700 text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'}`}
                 >
                    {isSelected ? 'Manage Current Trip' : 'Select This Trip'}
                 </Button>
              </div>
            );
          })}
       </div>
    </div>
  );
}
