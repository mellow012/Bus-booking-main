'use client';

import React from 'react';
import { Route, Schedule, Bus } from '@/types';
import { Map, MapPin, Calendar, Bus as BusIcon } from 'lucide-react';
import { getVisibleAssignedRoutes } from '../_lib/route-display';

interface RoutesTabProps {
  dashboard: any;
}

export default function RoutesTab({ dashboard }: RoutesTabProps) {
  const { assignedRoutes: routes, schedules, buses, userProfile: profile } = dashboard;
  const assignedRoutes = getVisibleAssignedRoutes(routes, profile);

  const searchQuery = dashboard.searchQuery?.toLowerCase() || '';

  const filteredRoutes = assignedRoutes.filter((r: Route) => {
    if (!searchQuery) return true;
    return (
      r.name?.toLowerCase().includes(searchQuery) ||
      r.origin?.toLowerCase().includes(searchQuery) ||
      r.destination?.toLowerCase().includes(searchQuery)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
          <Map className="w-6 h-6 text-indigo-600" />
          My Assigned Routes
        </h2>
        <p className="mt-1 text-sm text-gray-500">Routes and schedules within your operational jurisdiction.</p>
      </div>

      {filteredRoutes.length === 0 ? (
        <div className="py-12 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-gray-900 font-medium">{searchQuery ? 'No routes match your search' : 'No routes assigned'}</h3>
          <p className="text-gray-500 mt-1">{searchQuery ? 'Try a different search term.' : 'Contact your company admin to assign routes to your branch.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredRoutes.map((route: Route) => {
            const routeSchedules = schedules.filter((s: Schedule) => s.routeId === route.id);
            return (
              <div key={route.id} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{route.name}</h3>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3"/> {route.origin} → {route.destination}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    route.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {route.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="space-y-3 mt-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Upcoming Schedules</h4>
                  {routeSchedules.length === 0 ? (
                    <p className="text-sm text-gray-500">No schedules.</p>
                  ) : (
                    routeSchedules.slice(0, 3).map((schedule: Schedule) => {
                      const bus = buses.find((b:Bus) => b.id === schedule.busId);
                      return (
                        <div key={schedule.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100 flex justify-between items-center">
                          <div className="flex items-center gap-3 text-sm">
                            <Calendar className="w-4 h-4 text-indigo-500" />
                            <span className="font-medium text-gray-900">{new Date(schedule.departureDateTime).toLocaleString([], {dateStyle:'short', timeStyle:'short'})}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <BusIcon className="w-3 h-3" />
                            {bus?.licensePlate || 'TBA'}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
