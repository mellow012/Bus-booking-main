'use client';

import { PlusCircle, LayoutTemplate, Clock, Bus as BusIcon, Sparkles } from 'lucide-react';
import { Booking, Bus, Route, Schedule } from '@/types';
import ScheduleGrid from './ScheduleGrid';
import Pagination from './Pagination';
import CompletedSchedulesArchive from './CompleteSchedulesArchieve';
import GenerateTripsModal from '@/components/company/GenerateTripsModal';
import { useState, useMemo } from 'react';
import ConfirmDeleteModal from '../../ConfirmDeleteModal';
import { useAppToast } from '@/contexts/ToastContext';
import { deleteRoute } from '@/lib/actions/fleet.actions';
import { deleteScheduleTemplate } from '@/lib/actions/schedule.actions';
import { Trash2 } from 'lucide-react';

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
  operators?: any[];
  onScheduleDeleted?: () => void;
  baseUrl?: string;
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
  operators,
  onScheduleDeleted,
  baseUrl = '/company/admin',
}: RouteScheduleSectionProps) {
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const toast = useAppToast();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [templateDeleting, setTemplateDeleting] = useState<string | null>(null);

  const handleDeleteRoute = async () => {
    // Check dependencies
    const hasSchedules = pagedSchedules.length > 0 || completedSchedules.length > 0;
    const hasTemplates = templates?.some((t: any) => t.routeId === route.id);
    // Also bookings
    const routeBookings = bookings.filter((b: Booking) => b.routeId === route.id);

    if (hasSchedules || hasTemplates || routeBookings.length > 0) {
      toast.error(
        'Cannot delete route',
        `This route has active schedules, templates, or bookings. Please clear them first.`
      );
      setIsDeleteModalOpen(false);
      return;
    }

    setIsDeleting(true);
    try {
      const res = await deleteRoute(route.id);
      if (res.success) {
        toast.success('Route deleted', `${route.name} has been removed.`);
        // Note: the server action revalidates. Parent handles state update if needed.
      } else {
        toast.error('Failed to delete', res.error || 'Unknown error');
      }
    } catch (err: any) {
      toast.error('Error', err.message);
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!window.confirm('Are you sure you want to delete this blueprint?')) return;
    
    setTemplateDeleting(templateId);
    try {
      const res = await deleteScheduleTemplate(templateId);
      if (res.success) {
        toast.success('Blueprint deleted', 'The blueprint has been removed.');
        if (onScheduleDeleted) onScheduleDeleted(); // trigger refresh for client-side
      } else {
        toast.error('Failed to delete', res.error || 'Unknown error');
      }
    } catch (err: any) {
      toast.error('Error', err.message);
    } finally {
      setTemplateDeleting(null);
    }
  };

  // Stops Aggregation
  const stopAggregates = useMemo(() => {
    const routeBookings = bookings.filter(b => b.routeId === route.id && ['pending', 'confirmed', 'completed'].includes(b.bookingStatus));
    const stops = route.stops || [];
    return stops.map(stop => {
      const originCount = routeBookings.filter(b => b.metadata?.originStopId === stop.id).reduce((sum, b) => sum + (b.passengerDetails?.length || 0), 0);
      const destCount = routeBookings.filter(b => b.metadata?.destinationStopId === stop.id).reduce((sum, b) => sum + (b.passengerDetails?.length || 0), 0);
      return {
        ...stop,
        boardingPassengers: originCount,
        alightingPassengers: destCount,
      };
    });
  }, [route, bookings]);

  return (
    <div className="w-full space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start justify-between w-full lg:w-auto">
            <div>
              <h4 className="text-lg font-semibold text-gray-900">{route.name}</h4>
              <p className="text-sm text-gray-500">
                {route.origin} → {route.destination}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
            <span>{scheduleCount} schedules</span>
            <span>•</span>
            <span className="font-semibold text-green-600">MWK {revenue.toLocaleString()}</span>
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="ml-2 text-xs font-semibold text-red-600 hover:text-red-800 bg-red-50 px-3 py-1.5 rounded-lg flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" /> Delete Route
            </button>
            <button
              type="button"
              onClick={onAddSchedule}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 ml-2"
            >
              <PlusCircle className="w-4 h-4" /> Create Schedule
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h5 className="text-sm font-semibold text-gray-900">Upcoming Schedules</h5>
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
          </div>
        </div>

        <ScheduleGrid
          schedules={pagedSchedules}
          buses={buses}
          bookings={bookings}
          emptyMessage="No current or upcoming schedules match this route and date filter."
          operators={operators}
          route={route}
          onDeleteSuccess={onScheduleDeleted}
          baseUrl={baseUrl}
        />

        <Pagination page={page} totalItems={currentAndUpcomingCount} pageSize={5} onPrevious={onPreviousPage} onNext={onNextPage} />

        <div className="mt-8 pt-6 border-t border-gray-100">
          <h5 className="text-sm font-semibold text-gray-900 mb-4">Pick-up & Drop-off Stops</h5>
          {stopAggregates.length === 0 ? (
            <p className="text-sm text-gray-500">No intermediate stops configured for this route.</p>
          ) : (
            <div className="space-y-3">
              {stopAggregates.map(stop => (
                <div key={stop.id} className="flex justify-between items-center p-3 border border-gray-100 rounded-lg bg-gray-50">
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{stop.name}</p>
                    <p className="text-xs text-gray-500">Order: {stop.order} {stop.distanceFromOrigin ? `• ${stop.distanceFromOrigin} km` : ''}</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="text-right">
                      <p className="text-xs text-gray-500 uppercase tracking-wider">Boarding</p>
                      <p className="font-semibold text-sm text-indigo-600">{stop.boardingPassengers}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 uppercase tracking-wider">Alighting</p>
                      <p className="font-semibold text-sm text-emerald-600">{stop.alightingPassengers}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <CompletedSchedulesArchive schedules={completedSchedules} buses={buses} bookings={bookings} baseUrl={baseUrl} />

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
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-indigo-100 text-indigo-700">
                          Active
                        </span>
                        <button
                          onClick={() => handleDeleteTemplate(template.id)}
                          disabled={templateDeleting === template.id}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete Blueprint"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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

      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteRoute}
        isDeleting={isDeleting}
        title="Delete Route"
        message={`Are you sure you want to delete ${route.name}? This action cannot be undone.`}
      />
    </div>
  );
}