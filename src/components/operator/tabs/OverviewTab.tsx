'use client';

import React from 'react';
import { 
  Calendar, Users, DollarSign, Activity, MapPin, Bus as BusIcon, ArrowRight, UserCheck 
} from 'lucide-react';
import { Schedule, Route, Bus, Booking } from '@/types';

// Status badge helper component
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const lower = status?.toLowerCase() || 'unknown';
  const config: Record<string, { bg: string; text: string }> = {
    confirmed: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-100', text: 'text-emerald-800' },
    pending: { bg: 'bg-amber-50 text-amber-700 border-amber-100', text: 'text-amber-800' },
    completed: { bg: 'bg-blue-50 text-blue-700 border-blue-100', text: 'text-blue-800' },
    cancelled: { bg: 'bg-red-50 text-red-700 border-red-100', text: 'text-red-800' },
    active: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-100', text: 'text-emerald-800' },
    inactive: { bg: 'bg-gray-50 text-gray-700 border-gray-100', text: 'text-gray-800' },
  };
  const cfg = config[lower] || { bg: 'bg-gray-50 text-gray-700 border-gray-100', text: 'text-gray-800' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider border shadow-sm ${cfg.bg} ${cfg.text}`}>
      {status.replace('_', ' ')}
    </span>
  );
};

interface OverviewTabProps {
  stats: {
    todayTripsCount: number;
    seatsBooked: number;
    revenueToday: number;
    occupancyRate: number;
    upcomingTrips: Schedule[];
    liveTrip: Schedule | null;
    liveTripBookings: Booking[];
  };
  routes: Route[];
  buses: Bus[];
  bookings: Booking[];
  liveLocation: { lat: number; lng: number; updatedAt: string; address?: string } | null;
  setActiveTab: (tab: any) => void;
}

export default function OverviewTab({
  stats,
  routes,
  buses,
  bookings,
  liveLocation,
  setActiveTab,
}: OverviewTabProps) {
  const route = stats.liveTrip ? routes.find(r => r.id === stats.liveTrip?.routeId) : null;
  const bus = stats.liveTrip ? buses.find(b => b.id === stats.liveTrip?.busId) : null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Today's Active Runs", value: stats.todayTripsCount, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50/50' },
          { label: 'Revenue Generated', value: `MWK ${stats.revenueToday.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50/50' },
          { label: 'Passenger Fares Sold', value: `${stats.seatsBooked} seats`, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50/50' },
          { label: 'Average Occupancy', value: `${stats.occupancyRate}%`, icon: Activity, color: 'text-orange-600', bg: 'bg-orange-50/50' },
        ].map((card, idx) => (
          <div key={idx} className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">{card.label}</p>
              <p className={`mt-2 text-2xl font-black ${card.color}`}>{card.value}</p>
            </div>
            <div className={`p-4 rounded-2xl ${card.bg} ${card.color}`}>
              <card.icon className="w-5 h-5" />
            </div>
          </div>
        ))}
      </div>

      {/* Spotlight Active Run Control */}
      {stats.liveTrip ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-indigo-600 rounded-3xl p-8 text-white relative overflow-hidden shadow-xl shadow-indigo-100 h-full flex flex-col justify-center">
              <div className="absolute right-0 top-0 p-8 opacity-10">
                <BusIcon className="w-32 h-32" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-2 h-2 rounded-full ${stats.liveTrip.tripStatus === 'in_transit' ? 'bg-emerald-400 animate-pulse' : 'bg-white/50'}`} />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em]">
                    {stats.liveTrip.tripStatus === 'in_transit' ? 'Live Operations' : 
                     stats.liveTrip.tripStatus === 'boarding' ? 'Boarding Active' : 
                     stats.liveTrip.tripStatus === 'arrived' ? 'At Station' : 'Next Departure'}
                  </span>
                </div>
                <h3 className="text-3xl font-black uppercase tracking-tight mb-2 flex items-center gap-2">
                  {route ? `${route.origin} → ${route.destination}` : 'Corridor Run'}
                </h3>
                
                <div className="flex flex-wrap gap-4 mt-8">
                  <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10">
                    <p className="text-[8px] font-bold uppercase opacity-60 mb-1">Departure</p>
                    <p className="text-sm font-black">{new Date(stats.liveTrip.departureDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10">
                    <p className="text-[8px] font-bold uppercase opacity-60 mb-1">Bus Vessel</p>
                    <p className="text-sm font-black">{bus?.licensePlate || 'N/A'}</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10">
                    <p className="text-[8px] font-bold uppercase opacity-60 mb-1">Fares Filled</p>
                    <p className="text-sm font-black">{stats.liveTripBookings.length} / {bus?.capacity || '?'} seats</p>
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-[10px] font-bold uppercase opacity-60 mb-2 tracking-widest">Operational Status</p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                        <Activity className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-black capitalize">{stats.liveTrip.tripStatus?.replace('_', ' ') || 'In Operations'}</p>
                        <p className="text-[10px] opacity-60 font-bold uppercase">
                          {stats.liveTrip.tripStatus === 'boarding' ? `At ${stats.liveTrip.departureLocation || 'station'}` : 
                           stats.liveTrip.tripStatus === 'in_transit' ? 'En Route to Destination' : 
                           stats.liveTrip.tripStatus === 'arrived' ? 'Vessel Arrived' : 'Active Run'}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-[10px] font-bold uppercase opacity-60 mb-2 tracking-widest">Live GPS Coordinates</p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-rose-400" />
                      </div>
                      <div>
                        <p className="text-sm font-black truncate max-w-[200px]">
                          {liveLocation?.address || (liveLocation ? `${liveLocation.lat.toFixed(4)}, ${liveLocation.lng.toFixed(4)}` : 'Awaiting Signal...')}
                        </p>
                        <p className="text-[10px] opacity-60 font-bold uppercase">
                          {liveLocation ? `Last Sync: ${new Date(liveLocation.updatedAt).toLocaleTimeString()}` : 'Syncing with vessel'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm h-full flex flex-col justify-center">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Vessel Occupancy</p>
              <div className="flex items-center justify-center h-48 relative">
                <svg className="w-40 h-40 transform -rotate-90">
                  <circle cx="80" cy="80" r="70" stroke="#f1f5f9" strokeWidth="12" fill="transparent" />
                  <circle cx="80" cy="80" r="70" stroke="#4f46e5" strokeWidth="12" fill="transparent"
                    strokeDasharray={440}
                    strokeDashoffset={440 - (440 * stats.occupancyRate) / 100}
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-black text-gray-900">{stats.occupancyRate}%</span>
                  <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider mt-1">Booked capacity</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-12 border border-dashed border-gray-200 text-center">
          <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Calendar className="w-10 h-10 text-gray-200" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 uppercase">No Active Runs</h3>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-2">Initialize your assigned corridor runs to see live snapshot metrics.</p>
        </div>
      )}

      {/* Live Manifest Section */}
      {stats.liveTrip && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
            <div>
              <h3 className="font-bold text-gray-900 text-sm uppercase tracking-tight">Vessel Passenger Manifest</h3>
              <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest mt-0.5">Vessel: {bus?.licensePlate || 'N/A'}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-[10px] font-bold text-gray-400 uppercase">On Board</p>
                <p className="text-xs font-black text-emerald-600">
                  {stats.liveTripBookings.filter(b => b.bookingStatus === 'confirmed' || b.bookingStatus === 'completed').length} / {stats.liveTripBookings.length}
                </p>
              </div>
            </div>
          </div>
          
          {stats.liveTripBookings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Passenger</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Seat Allocation</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">Booking Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {stats.liveTripBookings.map(booking => (
                    <tr key={booking.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-gray-900 uppercase tracking-tight">{booking.passengerDetails?.[0]?.name || 'Anonymous'}</p>
                        <p className="text-[10px] text-gray-400 font-medium">{booking.contactPhone || 'No contact number'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center justify-center w-8 h-8 bg-gray-50 rounded-lg text-xs font-black text-gray-700 border border-gray-100 shadow-sm">
                          {booking.seatNumbers?.[0] || '?'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={booking.bookingStatus} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">{booking.bookingReference}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-dashed border-gray-200">
                <Users className="w-8 h-8 text-gray-300" />
              </div>
              <h4 className="text-sm font-bold text-gray-900 uppercase">No Boarded Passengers</h4>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">This run currently has no checked-in bookings.</p>
            </div>
          )}
        </div>
      )}

      {/* Today's Runs Manifest */}
      {stats.upcomingTrips.length > 0 && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
            <h3 className="font-bold text-gray-900 text-sm uppercase tracking-tight">Today&apos;s Run Schedule</h3>
            <button onClick={() => setActiveTab('schedules')} className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest hover:underline">
              View Schedules
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Route Corridor</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Departure Time</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Vessel</th>
                  <th className="px-6 py-4 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">Capacity Saturation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.upcomingTrips.map(trip => {
                  const tripRoute = routes.find(r => r.id === trip.routeId);
                  const tripBus = buses.find(b => b.id === trip.busId);
                  const tripBookingsCount = bookings.filter(b => b.scheduleId === trip.id).length;
                  const saturation = tripBus?.capacity ? Math.round((tripBookingsCount / tripBus.capacity) * 100) : 0;
                  
                  return (
                    <tr key={trip.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-gray-900 uppercase tracking-tight flex items-center gap-2">
                          {tripRoute?.origin} <ArrowRight className="w-3.5 h-3.5 text-gray-300" /> {tripRoute?.destination}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs font-bold text-gray-600">{new Date(trip.departureDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs font-bold text-gray-500">{tripBus?.licensePlate || 'N/A'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3 justify-center">
                          <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full transition-all duration-1000 ${saturation > 80 ? 'bg-rose-500' : 'bg-indigo-600'}`} style={{ width: `${saturation}%` }} />
                          </div>
                          <span className="text-[10px] font-bold text-gray-400 w-8">{saturation}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
