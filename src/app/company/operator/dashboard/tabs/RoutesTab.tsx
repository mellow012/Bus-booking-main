'use client';

import React, { useState, useEffect } from 'react';
import { Route, Schedule, Bus } from '@/types';
import {
  Map, MapPin, Calendar, Bus as BusIcon, Plus, LayoutTemplate,
  Clock, Sparkles, ChevronLeft, ChevronRight, Search,
} from 'lucide-react';

import UnifiedScheduleModal from '@/components/company/UnifiedScheduleModal';
import GenerateTripsModal from '@/components/company/GenerateTripsModal';
import StopsEditor from '@/components/common/StopsEditor';

interface RoutesTabProps {
  dashboard: any;
}

export default function RoutesTab({ dashboard }: RoutesTabProps) {
  const { assignedRoutes, schedules, templates, buses, userProfile: profile } = dashboard;
  const companyId = profile?.companyId?.trim() || '';

  const searchQuery = dashboard.searchQuery?.toLowerCase() || '';

  const filteredRoutes = assignedRoutes.filter((r: Route) => {
    if (!searchQuery) return true;
    return (
      r.name?.toLowerCase().includes(searchQuery) ||
      r.origin?.toLowerCase().includes(searchQuery) ||
      r.destination?.toLowerCase().includes(searchQuery)
    );
  });

  const [showUnifiedModal, setShowUnifiedModal] = useState(false);
  const [preSelectedRouteId, setPreSelectedRouteId] = useState<string | undefined>();
  const [generateRouteId, setGenerateRouteId] = useState<string | undefined>();
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [scheduleFilterDate, setScheduleFilterDate] = useState<string>('');

  const ROUTES_PER_PAGE = 6;
  const SCHEDULES_PER_PAGE = 6;
  const [routesPage, setRoutesPage] = useState(1);
  const [schedulesPage, setSchedulesPage] = useState(1);

  const totalRoutesPages = Math.ceil(filteredRoutes.length / ROUTES_PER_PAGE) || 1;
  const pagedRoutes = filteredRoutes.slice((routesPage - 1) * ROUTES_PER_PAGE, routesPage * ROUTES_PER_PAGE);

  useEffect(() => { setRoutesPage(1); }, [searchQuery]);
  useEffect(() => { setSchedulesPage(1); }, [selectedRouteId, scheduleFilterDate]);

  useEffect(() => {
    if (filteredRoutes.length > 0 && (!selectedRouteId || !filteredRoutes.find((r: Route) => r.id === selectedRouteId))) {
      setSelectedRouteId(filteredRoutes[0].id);
    }
  }, [filteredRoutes, selectedRouteId]);

  const openCreateSchedule = (routeId?: string) => {
    setPreSelectedRouteId(routeId);
    setShowUnifiedModal(true);
  };

  const openGenerateTrips = (routeId: string) => {
    setGenerateRouteId(routeId);
    setShowGenerateModal(true);
  };

  const tripStatusConfig: Record<string, { label: string; color: string }> = {
    scheduled:  { label: 'Scheduled',  color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    boarding:   { label: 'Boarding',   color: 'bg-amber-50 text-amber-700 border-amber-200' },
    in_transit: { label: 'In Transit', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    arrived:    { label: 'Arrived',    color: 'bg-gray-100 text-gray-600 border-gray-200' },
    cancelled:  { label: 'Cancelled',  color: 'bg-red-50 text-red-600 border-red-200' },
    active:     { label: 'Active',     color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Map className="w-6 h-6 text-indigo-600" />
            My Assigned Routes
          </h2>
          <p className="text-xs text-gray-500 mt-1">Routes and schedules within your operational jurisdiction.</p>
        </div>
        <button
          onClick={() => openCreateSchedule()}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-100"
        >
          <Plus className="w-4 h-4" />
          Create Schedule
        </button>
      </div>

      {/* ── Empty State ───────────────────────────────────────────── */}
      {filteredRoutes.length === 0 ? (
        <div className="py-12 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-gray-900 font-bold">
            {searchQuery ? 'No routes match your search' : 'No routes assigned'}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            {searchQuery ? 'Try a different search term.' : 'Contact your company admin to assign routes to your branch.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* ── Route Cards Grid ────────────────────────────────────── */}
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pagedRoutes.map((route: Route) => {
                const isSelected = selectedRouteId === route.id;
                const routeScheduleCount = schedules.filter((s: Schedule) => s.routeId === route.id).length;
                return (
                  <div
                    key={route.id}
                    onClick={() => setSelectedRouteId(route.id)}
                    className={`bg-white rounded-2xl border p-5 shadow-sm cursor-pointer transition-all space-y-4 ${
                      isSelected
                        ? 'border-indigo-500 ring-1 ring-indigo-500 shadow-indigo-100/60'
                        : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                    }`}
                  >
                    {/* Card Header */}
                    <div className="flex justify-between items-start">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-gray-900 text-base truncate">{route.name}</h3>
                        <p className="text-xs text-gray-500 font-medium mt-0.5 flex items-center gap-1">
                          <MapPin className="w-3 h-3 shrink-0 text-gray-400" />
                          <span className="truncate">{route.origin} → {route.destination}</span>
                        </p>
                      </div>
                      <span className={`ml-2 shrink-0 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                        route.isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-gray-100 text-gray-500 border-gray-200'
                      }`}>
                        {route.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    {/* Stats Strip */}
                    <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-xl text-center text-xs border border-gray-100">
                      <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">Schedules</p>
                        <p className="font-bold text-indigo-600">{routeScheduleCount}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">Base Fare</p>
                        <p className="font-bold text-gray-800">MWK {route.baseFare?.toLocaleString() ?? '—'}</p>
                      </div>
                    </div>

                    {/* View indicator */}
                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-xs font-semibold text-indigo-600">
                        {isSelected ? '● Viewing details' : 'Click to view details'}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); openCreateSchedule(route.id); }}
                        className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-lg transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Schedule
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalRoutesPages > 1 && (
              <div className="mt-4 px-5 py-3 border border-gray-100 rounded-xl flex items-center justify-between text-xs text-gray-500 bg-gray-50/30">
                <span>
                  Page <span className="font-semibold text-gray-700">{routesPage}</span> of{' '}
                  <span className="font-semibold text-gray-700">{totalRoutesPages}</span> ({filteredRoutes.length} routes)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setRoutesPage((p) => Math.max(p - 1, 1))}
                    disabled={routesPage === 1}
                    className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-gray-600 transition-colors shadow-sm"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setRoutesPage((p) => Math.min(p + 1, totalRoutesPages))}
                    disabled={routesPage >= totalRoutesPages}
                    className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-gray-600 transition-colors shadow-sm"
                    title="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Selected Route Detail Panel ─────────────────────────── */}
          {selectedRouteId && (() => {
            const selectedRoute = filteredRoutes.find((r: Route) => r.id === selectedRouteId);
            if (!selectedRoute) return null;

            const routeSchedules = schedules.filter((s: Schedule) => {
              if (s.routeId !== selectedRouteId) return false;
              if (scheduleFilterDate) {
                const sDate = new Date(s.departureDateTime).toISOString().split('T')[0];
                return sDate === scheduleFilterDate;
              }
              const now = new Date();
              return s.departureDateTime >= now || ['boarding', 'in_transit', 'arrived'].includes(s.tripStatus || '');
            });
            const routeTemplates = templates?.filter((t: any) => t.routeId === selectedRouteId) || [];

            const totalSchedulesPages = Math.ceil(routeSchedules.length / SCHEDULES_PER_PAGE) || 1;
            const pagedSchedules = routeSchedules.slice(
              (schedulesPage - 1) * SCHEDULES_PER_PAGE,
              schedulesPage * SCHEDULES_PER_PAGE
            );

            return (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in duration-300">

                {/* Panel Header */}
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <Map className="h-4 w-4 text-indigo-600" />
                    {selectedRoute.name} — Details
                  </div>
                  {routeTemplates.length > 0 && (
                    <button
                      onClick={() => openGenerateTrips(selectedRoute.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition-colors border border-emerald-200"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Generate Trips
                    </button>
                  )}
                </div>

                {/* Stops Overview */}
                <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Pick-up Stops</p>
                  <StopsEditor
                    stops={selectedRoute.stops || []}
                    onChange={() => {}}
                    readOnly={true}
                  />
                </div>

                {/* Schedules + Templates Grid */}
                <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">

                  {/* Schedules Column */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 whitespace-nowrap">
                          {scheduleFilterDate ? 'Archived Schedules' : 'Active / Upcoming'}
                        </h4>
                        <input
                          type="date"
                          value={scheduleFilterDate}
                          onChange={(e) => setScheduleFilterDate(e.target.value)}
                          className="text-xs px-2 py-1 border border-gray-200 rounded-lg text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm"
                          title="Filter by date to see past schedules"
                        />
                        {scheduleFilterDate && (
                          <button
                            onClick={() => setScheduleFilterDate('')}
                            className="text-[10px] uppercase font-bold text-gray-400 hover:text-gray-700 transition-colors"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => openCreateSchedule(selectedRoute.id)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Add
                      </button>
                    </div>

                    {routeSchedules.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-xs font-medium">
                        {scheduleFilterDate ? 'No schedules found for this date.' : 'No active or upcoming schedules.'}
                      </div>
                    ) : (
                      <div>
                        <div className="space-y-2.5">
                          {pagedSchedules.map((schedule: Schedule) => {
                            const bus = buses.find((b: Bus) => b.id === schedule.busId);
                            const statusKey = schedule.tripStatus || schedule.status || 'scheduled';
                            const statusCfg = tripStatusConfig[statusKey] || { label: statusKey, color: 'bg-gray-100 text-gray-600 border-gray-200' };
                            return (
                              <div
                                key={schedule.id}
                                className="p-3.5 bg-white rounded-xl border border-gray-200 flex justify-between items-center hover:border-indigo-200 transition-colors shadow-sm"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                                    <Calendar className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <div className="text-sm font-bold text-gray-900">
                                      {new Date(schedule.departureDateTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                    </div>
                                    <span className={`inline-block mt-0.5 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${statusCfg.color}`}>
                                      {statusCfg.label}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100">
                                  <BusIcon className="w-3 h-3 text-gray-400" />
                                  {bus?.licensePlate || 'Unassigned'}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Schedules Pagination */}
                        {totalSchedulesPages > 1 && (
                          <div className="mt-3 px-4 py-2.5 border border-gray-100 rounded-xl flex items-center justify-between text-xs text-gray-500 bg-gray-50/30">
                            <span>
                              Page <span className="font-semibold text-gray-700">{schedulesPage}</span> of{' '}
                              <span className="font-semibold text-gray-700">{totalSchedulesPages}</span>
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => setSchedulesPage((p) => Math.max(p - 1, 1))}
                                disabled={schedulesPage === 1}
                                className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-gray-600 transition-colors shadow-sm"
                                title="Previous page"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setSchedulesPage((p) => Math.min(p + 1, totalSchedulesPages))}
                                disabled={schedulesPage >= totalSchedulesPages}
                                className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-gray-600 transition-colors shadow-sm"
                                title="Next page"
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Templates Column */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Recurring Blueprints</h4>
                    </div>

                    {routeTemplates.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-xs font-medium">
                        No active blueprints for this route.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {routeTemplates.map((template: any) => {
                          const bus = buses.find((b: Bus) => b.id === template.busId);
                          const shortDays = template.daysOfWeek
                            ?.map((d: number) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d])
                            .join(', ');
                          return (
                            <div
                              key={template.id}
                              className="p-3.5 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-indigo-200 transition-colors"
                            >
                              <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                                    <LayoutTemplate className="w-4 h-4" />
                                  </div>
                                  <span className="text-sm font-bold text-gray-900">{shortDays || 'No days set'}</span>
                                </div>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border bg-emerald-50 text-emerald-700 border-emerald-200">
                                  Active
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-xs text-gray-500 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                                <div className="flex items-center gap-1.5 font-semibold text-gray-700">
                                  <Clock className="w-3 h-3 text-gray-400" />
                                  {template.departureTime} – {template.arrivalTime}
                                </div>
                                <div className="flex items-center gap-1.5 font-semibold text-gray-700">
                                  <BusIcon className="w-3 h-3 text-gray-400" />
                                  {bus?.licensePlate || 'TBA'}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────────────── */}
      <UnifiedScheduleModal
        isOpen={showUnifiedModal}
        onClose={() => setShowUnifiedModal(false)}
        routes={assignedRoutes}
        buses={buses}
        companyId={companyId}
        onSuccess={() => dashboard.fetchInitialData?.()}
        preSelectedRouteId={preSelectedRouteId}
      />

      {showGenerateModal && generateRouteId && (
        <GenerateTripsModal
          isOpen={showGenerateModal}
          onClose={() => setShowGenerateModal(false)}
          companyId={companyId}
          routeId={generateRouteId}
          routeName={assignedRoutes.find((r: Route) => r.id === generateRouteId)?.name}
          onSuccess={() => dashboard.fetchInitialData?.()}
        />
      )}
    </div>
  );
}
