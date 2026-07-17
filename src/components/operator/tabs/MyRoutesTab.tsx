'use client';

import React, { useState, useMemo } from 'react';
import { 
  MapPin, Calendar, Users, DollarSign, Bus as BusIcon, Route as RouteIcon, FileText, Share2, Clipboard, ArrowRight 
} from 'lucide-react';
import { Route, Schedule, Bus, Booking } from '@/types';

interface MyRoutesTabProps {
  assignedRoutes: Route[];
  schedules: Schedule[];
  buses: Bus[];
  bookings: Booking[];
  onGenerateManifest?: (scheduleId: string) => void;
}

export default function MyRoutesTab({
  assignedRoutes,
  schedules,
  buses,
  bookings,
  onGenerateManifest,
}: MyRoutesTabProps) {
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);

  // Active Route details
  const activeRoute = assignedRoutes[activeRouteIndex];

  // Calculate route metrics
  const metrics = useMemo(() => {
    if (!activeRoute) return null;

    const routeSchedules = schedules.filter(s => s.routeId === activeRoute.id);
    const activeRuns = routeSchedules.filter(s => s.status === 'active');
    const scheduleIds = routeSchedules.map(s => s.id);
    
    const routeBookings = bookings.filter(b => scheduleIds.includes(b.scheduleId) && b.bookingStatus !== 'cancelled');
    const recentBookingsCount = routeBookings.length;
    
    const routeEarnings = routeBookings
      .filter(b => b.paymentStatus === 'paid')
      .reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);

    // Unique buses scheduled on this route
    const uniqueBusIds = Array.from(new Set(routeSchedules.map(s => s.busId)));
    const linkedBusesCount = buses.filter(b => uniqueBusIds.includes(b.id)).length;

    // Get the next schedule for this route
    const nextSchedule = routeSchedules
      .filter(s => new Date(s.departureDateTime) > new Date() && s.status === 'active')
      .sort((a, b) => new Date(a.departureDateTime).getTime() - new Date(b.departureDateTime).getTime())[0];

    return {
      activeRunsCount: activeRuns.length,
      linkedBusesCount,
      recentBookingsCount,
      routeEarnings,
      nextSchedule,
    };
  }, [activeRoute, schedules, bookings, buses]);

  const handleShare = () => {
    if (!metrics?.nextSchedule) {
      alert('No active upcoming schedules to share.');
      return;
    }
    const shareUrl = `${window.location.origin}/book?routeId=${activeRoute.id}&scheduleId=${metrics.nextSchedule.id}`;
    navigator.clipboard.writeText(shareUrl)
      .then(() => alert('Route booking link copied to clipboard!'))
      .catch(() => alert('Failed to copy booking link.'));
  };

  if (assignedRoutes.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-12 border border-dashed border-gray-200 text-center">
        <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <RouteIcon className="w-10 h-10 text-gray-200" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 uppercase">No Routes Assigned</h3>
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-2">You are currently not assigned to operate any routes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
      {/* Route Switcher Tabs (Spreadsheet-like horizontal scroll) */}
      {assignedRoutes.length > 1 && (
        <div className="flex border-b border-gray-100 overflow-x-auto gap-2 p-1.5 bg-gray-100/50 rounded-2xl">
          {assignedRoutes.map((route, idx) => (
            <button
              key={route.id}
              onClick={() => setActiveRouteIndex(idx)}
              className={`px-5 py-3 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition-all truncate min-w-[140px] flex items-center justify-center gap-2 border ${
                activeRouteIndex === idx
                  ? 'bg-white text-indigo-700 shadow-sm border-gray-200/50'
                  : 'text-gray-400 border-transparent hover:text-gray-600 hover:bg-white/40'
              }`}
            >
              <RouteIcon className="w-3.5 h-3.5" />
              {route.name || `${route.origin} → ${route.destination}`}
            </button>
          ))}
        </div>
      )}

      {/* Main Route Pane */}
      {activeRoute && metrics && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          
          {/* Route Description Card */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-8 border border-gray-100 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4 bg-indigo-50 text-indigo-700 w-fit px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
                <MapPin className="w-3.5 h-3.5" />
                Active Corridor
              </div>
              <h3 className="text-3xl font-black text-gray-900 uppercase tracking-tight flex items-center gap-3">
                {activeRoute.origin} <ArrowRight className="w-6 h-6 text-gray-300" /> {activeRoute.destination}
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8">
                <div className="bg-gray-50/50 px-5 py-3 rounded-2xl border border-gray-100">
                  <p className="text-[8px] font-bold text-gray-400 uppercase mb-1">Distance</p>
                  <p className="text-lg font-black text-gray-800">{activeRoute.distance || '—'} km</p>
                </div>
                <div className="bg-gray-50/50 px-5 py-3 rounded-2xl border border-gray-100">
                  <p className="text-[8px] font-bold text-gray-400 uppercase mb-1">Duration</p>
                  <p className="text-lg font-black text-gray-800">{activeRoute.duration || '—'} mins</p>
                </div>
                <div className="bg-gray-50/50 px-5 py-3 rounded-2xl border border-gray-100">
                  <p className="text-[8px] font-bold text-gray-400 uppercase mb-1">Base Fare</p>
                  <p className="text-lg font-black text-gray-800">MWK {activeRoute.baseFare?.toLocaleString() || '0'}</p>
                </div>
                <div className="bg-gray-50/50 px-5 py-3 rounded-2xl border border-gray-100">
                  <p className="text-[8px] font-bold text-gray-400 uppercase mb-1">Active Status</p>
                  <p className="text-lg font-black text-emerald-600 uppercase">
                    {activeRoute.isActive ? 'Active' : 'Paused'}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions panel */}
            <div className="flex flex-wrap gap-4 mt-8 pt-6 border-t border-gray-50">
              {metrics.nextSchedule && onGenerateManifest && (
                <button
                  onClick={() => onGenerateManifest(metrics.nextSchedule!.id)}
                  className="flex items-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-xl shadow-indigo-100"
                >
                  <FileText className="w-4 h-4" />
                  Generate Manifest
                </button>
              )}
              <button
                onClick={handleShare}
                className="flex items-center gap-2 px-6 py-3.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm"
              >
                <Share2 className="w-4 h-4" />
                Share Route Link
              </button>
            </div>
          </div>

          {/* Quick Metrics Panel */}
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between space-y-6">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6">Corridor Performance</p>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Active Runs</span>
                  </div>
                  <span className="text-sm font-black text-gray-900">{metrics.activeRunsCount}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
                      <BusIcon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Linked Fleet</span>
                  </div>
                  <span className="text-sm font-black text-gray-900">{metrics.linkedBusesCount}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Tickets Booked</span>
                  </div>
                  <span className="text-sm font-black text-gray-900">{metrics.recentBookingsCount}</span>
                </div>
              </div>
            </div>

            <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
              <div>
                <span className="text-[8px] font-bold text-emerald-600 uppercase tracking-widest">Total Earnings</span>
                <p className="text-xl font-black text-emerald-800 mt-1">MWK {metrics.routeEarnings.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-100">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
