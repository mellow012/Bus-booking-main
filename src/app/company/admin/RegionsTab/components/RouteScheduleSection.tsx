'use client';

import { PlusCircle } from 'lucide-react';
import { Booking, Bus, Route, Schedule } from '@/types';
import ScheduleGrid from './ScheduleGrid';
import Pagination from './Pagination';
import CompletedSchedulesArchive from './CompleteSchedulesArchieve';

interface RouteScheduleSectionProps {
  route: Route;
  scheduleCount: number;
  revenue: number;
  filterDate: string;
  onFilterDateChange: (date: string) => void;
  onAddSchedule: () => void;
  pagedSchedules: Schedule[];
  currentAndUpcomingCount: number;
  completedSchedules: Schedule[];
  page: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
  buses: Bus[];
  bookings: Booking[];
}

export default function RouteScheduleSection({
  route,
  scheduleCount,
  revenue,
  filterDate,
  onFilterDateChange,
  onAddSchedule,
  pagedSchedules,
  currentAndUpcomingCount,
  completedSchedules,
  page,
  onPreviousPage,
  onNextPage,
  buses,
  bookings,
}: RouteScheduleSectionProps) {
  return (
    <div className="w-full space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h4 className="text-lg font-semibold text-gray-900">{route.name}</h4>
            <p className="text-sm text-gray-500">
              {route.origin} → {route.destination}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
            <span>{scheduleCount} schedules</span>
            <span>•</span>
            <span className="font-semibold text-green-600">MWK {revenue.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h5 className="text-sm font-semibold text-gray-900">Route schedule</h5>
            <p className="text-xs text-gray-500">Showing current and upcoming trips first, completed trips in the archive below.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <label htmlFor="route-filter-date" className="text-xs font-medium text-gray-600">
                Filter date
              </label>
              <input
                id="route-filter-date"
                type="date"
                value={filterDate}
                onChange={(event) => onFilterDateChange(event.target.value)}
                className="rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            <button
              type="button"
              onClick={onAddSchedule}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              <PlusCircle className="w-4 h-4" /> Add Schedule
            </button>
          </div>
        </div>

        <ScheduleGrid
          schedules={pagedSchedules}
          buses={buses}
          bookings={bookings}
          emptyMessage="No current or upcoming schedules match this route and date filter."
        />

        <Pagination page={page} totalItems={currentAndUpcomingCount} pageSize={5} onPrevious={onPreviousPage} onNext={onNextPage} />

        <CompletedSchedulesArchive schedules={completedSchedules} buses={buses} bookings={bookings} />
      </div>
    </div>
  );
}