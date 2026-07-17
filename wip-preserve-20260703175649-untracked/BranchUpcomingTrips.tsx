'use client';

import { Calendar, Route as RouteIcon } from 'lucide-react';
import { Bus, Route, Schedule } from '@/types';
import { formatDateTime } from '../utils/schedule';

interface BranchUpcomingTripsProps {
  branchName: string;
  schedules: Schedule[];
  routes: Route[];
  buses: Bus[];
}

export default function BranchUpcomingTrips({ branchName, schedules, routes, buses }: BranchUpcomingTripsProps) {
  return (
    <div className="p-5 border-t border-gray-100 bg-gray-50/30">
      <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
        <Calendar className="w-4 h-4 text-indigo-500" /> Upcoming Trips in {branchName}
      </h4>
      {schedules.length === 0 ? (
        <p className="text-sm text-gray-500">No upcoming trips scheduled in this branch.</p>
      ) : (
        <div className="space-y-2">
          {schedules.map((schedule: Schedule) => {
            const route = routes.find((r: Route) => r.id === schedule.routeId);
            const bus = buses.find((b: Bus) => b.id === schedule.busId);
            return (
              <div key={schedule.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white px-4 py-2.5 rounded-lg border border-gray-100">
                <div className="flex items-center gap-3">
                  <RouteIcon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="text-sm font-semibold text-gray-900">{route ? `${route.origin} → ${route.destination}` : 'Unknown route'}</span>
                  <span className="text-xs text-gray-400">{bus?.licensePlate || 'No bus'}</span>
                </div>
                <span className="text-xs font-medium text-gray-500">{formatDateTime(schedule.departureDateTime.toISOString())}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}