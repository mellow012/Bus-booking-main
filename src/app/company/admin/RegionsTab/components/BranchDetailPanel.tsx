'use client';

import { AlertCircle, Calendar, MapPin, PlusCircle } from 'lucide-react';
import { Booking, Bus, Route, Schedule } from '@/types';
import { RouteWithScheduleInfo } from '../types';
import RouteTabStrip from './RouteTabStrip';
import RouteScheduleSection from './RouteScheduleSection';
import BranchUpcomingTrips from './BranchUpcomingTrips';

interface BranchDetailPanelProps {
  branch: any;
  branchRoutes: Route[];
  bookingsInBranch: number;
  routesWithScheduleInfo: RouteWithScheduleInfo[];
  selectedRoute: Route | null;
  selectedRouteId: string | null;
  onSelectRoute: (routeId: string) => void;
  onAddRoute: () => void;
  onAddSchedule: () => void;

  selectedRouteScheduleCount: number;
  selectedRouteRevenue: number;
  scheduleFilterDate: string;
  onFilterDateChange: (date: string) => void;
  pagedSchedules: Schedule[];
  currentAndUpcomingCount: number;
  completedSchedules: Schedule[];
  schedulePage: number;
  onPreviousPage: () => void;
  onNextPage: () => void;

  branchUpcomingTrips: Schedule[];
  routes: Route[];
  buses: Bus[];
  bookings: Booking[];
  templates: any[];
  companyId: string;
  onTripsGenerated?: () => void;
}

export default function BranchDetailPanel({
  branch,
  branchRoutes,
  bookingsInBranch,
  routesWithScheduleInfo,
  selectedRoute,
  selectedRouteId,
  onSelectRoute,
  onAddRoute,
  onAddSchedule,
  selectedRouteScheduleCount,
  selectedRouteRevenue,
  scheduleFilterDate,
  onFilterDateChange,
  pagedSchedules,
  currentAndUpcomingCount,
  completedSchedules,
  schedulePage,
  onPreviousPage,
  onNextPage,
  branchUpcomingTrips,
  routes,
  buses,
  bookings,
  templates,
  companyId,
  onTripsGenerated,
}: BranchDetailPanelProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="p-5 border-b border-gray-100 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between bg-gray-50/50">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">{branch.name}</h3>
            <p className="text-xs text-gray-500">{branchRoutes.length} routes in this branch</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={onAddRoute} className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg flex items-center gap-1">
            <PlusCircle className="w-3 h-3" /> Add Route
          </button>
          <button
            onClick={onAddSchedule}
            disabled={!selectedRoute}
            className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg flex items-center gap-1"
          >
            <Calendar className="w-3 h-3" /> Create Schedule
          </button>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {branchRoutes.length === 0 ? (
          <div className="text-center py-6">
            <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No routes in this branch yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
              <span>{branchRoutes.length} routes</span>
              <span>•</span>
              <span>{bookingsInBranch} bookings</span>
            </div>

            <RouteTabStrip routes={routesWithScheduleInfo} selectedRouteId={selectedRouteId} onSelectRoute={onSelectRoute} />

            {selectedRoute && (
              <RouteScheduleSection
                route={selectedRoute}
                scheduleCount={selectedRouteScheduleCount}
                revenue={selectedRouteRevenue}
                filterDate={scheduleFilterDate}
                onFilterDateChange={onFilterDateChange}
                onAddSchedule={onAddSchedule}
                pagedSchedules={pagedSchedules}
                currentAndUpcomingCount={currentAndUpcomingCount}
                completedSchedules={completedSchedules}
                page={schedulePage}
                onPreviousPage={onPreviousPage}
                onNextPage={onNextPage}
                buses={buses}
                bookings={bookings}
                templates={templates}
                companyId={companyId}
                onTripsGenerated={onTripsGenerated}
              />
            )}
          </div>
        )}
      </div>

      <BranchUpcomingTrips branchName={branch.name} schedules={branchUpcomingTrips} routes={routes} buses={buses} />
    </div>
  );
}