'use client';

import { PlusCircle, LayoutTemplate, Clock, Bus as BusIcon, Sparkles } from 'lucide-react';
import { Booking, Bus, Route, Schedule } from '@/types';
import ScheduleGrid from './ScheduleGrid';
import Pagination from './Pagination';
import CompletedSchedulesArchive from './CompleteSchedulesArchieve';
import GenerateTripsModal from '@/components/company/GenerateTripsModal';
import { useState } from 'react';

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
  templates: any[];
  companyId: string;
  onTripsGenerated?: () => void;
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
  templates,
  companyId,
  onTripsGenerated,
}: RouteScheduleSectionProps) {
  const [showGenerateModal, setShowGenerateModal] = useState(false);
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

        <div className="mt-8 pt-6 border-t border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h5 className="text-sm font-semibold text-gray-900">Recurring Blueprints</h5>
              <p className="text-xs text-gray-500">Automatically generated schedules based on these templates.</p>
            </div>
            {templates?.filter((t: any) => t.routeId === route.id).length > 0 && (
              <button
                type="button"
                onClick={() => setShowGenerateModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" /> Generate Trips
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {(() => {
              const routeTemplates = templates?.filter((t: any) => t.routeId === route.id) || [];
              if (routeTemplates.length === 0) {
                return <p className="text-sm text-gray-500 col-span-full">No active blueprints.</p>;
              }
              return routeTemplates.map((template: any) => {
                const bus = buses.find((b:Bus) => b.id === template.busId);
                const shortDays = template.daysOfWeek?.map((d: number) => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ');
                return (
                  <div key={template.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <LayoutTemplate className="w-5 h-5 text-indigo-500" />
                        <span className="text-sm font-bold text-gray-900">{shortDays || 'No days set'}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-indigo-100 text-indigo-700">
                        Active
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 text-xs text-gray-600">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{template.departureTime} - {template.arrivalTime}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <BusIcon className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{bus?.licensePlate || 'TBA'}</span>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>
      
      {showGenerateModal && (
        <GenerateTripsModal
          isOpen={showGenerateModal}
          onClose={() => setShowGenerateModal(false)}
          companyId={companyId}
          routeId={route.id}
          routeName={`${route.origin} → ${route.destination}`}
          onSuccess={() => { onTripsGenerated?.(); }}
        />
      )}
    </div>
  );
}