'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Route, Schedule, Bus } from '@/types';
import {
  Map, MapPin, Calendar, Bus as BusIcon, Plus, LayoutTemplate,
  Clock, Sparkles, ChevronLeft, ChevronRight, Search, BadgeCheck, ChevronDown
} from 'lucide-react';
import { parseUtcDate } from '@/lib/timezone';

const isRelevantSchedule = (s: Schedule) => {
  if (s.status === 'archived' || !!s.isArchived) return false;
  const now = new Date();
  return parseUtcDate(s.departureDateTime as unknown as string) >= now || ['boarding', 'in_transit', 'arrived'].includes(s.tripStatus || '');
};

import UnifiedScheduleModal from '@/components/company/UnifiedScheduleModal';
import GenerateTripsModal from '@/components/company/GenerateTripsModal';
import StopsEditor from '@/components/common/StopsEditor';
import RouteScheduleSection from '@/app/company/admin/RegionsTab/components/RouteScheduleSection';

interface RoutesTabProps {
  dashboard: any;
}

export default function RoutesTab({ dashboard }: RoutesTabProps) {
  const router = useRouter();
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
  const [archiveExpanded, setArchiveExpanded] = useState(false);

  const ROUTES_PER_PAGE = 6;
  const SCHEDULES_PER_PAGE = 6;
  const [routesPage, setRoutesPage] = useState(1);
  const [schedulesPage, setSchedulesPage] = useState(1);

  const totalRoutesPages = Math.ceil(filteredRoutes.length / ROUTES_PER_PAGE) || 1;
  const pagedRoutes = filteredRoutes.slice((routesPage - 1) * ROUTES_PER_PAGE, routesPage * ROUTES_PER_PAGE);

  useEffect(() => { setRoutesPage(1); }, [searchQuery]);
  useEffect(() => { 
    setSchedulesPage(1); 
    setArchiveExpanded(false);
  }, [selectedRouteId, scheduleFilterDate]);

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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {pagedRoutes.map((route: Route) => {
                const isSelected = selectedRouteId === route.id;
                const routeScheduleCount = schedules.filter((s: Schedule) => s.routeId === route.id && isRelevantSchedule(s)).length;
                const routeTemplates = templates?.filter((t: any) => t.routeId === route.id) || [];
                return (
                  <button
                    key={route.id}
                    type="button"
                    onClick={() => setSelectedRouteId(route.id)}
                    className={`text-left bg-white rounded-xl border p-4 transition-all shadow-sm active:scale-[0.98] ${
                      isSelected
                        ? 'border-indigo-600 ring-2 ring-indigo-600 ring-opacity-20'
                        : 'border-gray-200 hover:border-indigo-200 hover:shadow-md'
                    }`}
                  >
                    {/* Top Row Icon and Badge */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                        <Map className="w-5 h-5" />
                      </div>
                      {route.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-emerald-50 text-emerald-700">
                          <BadgeCheck className="w-3 h-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-gray-100 text-gray-400">
                          Inactive
                        </span>
                      )}
                    </div>

                    {/* Middle Section Title and Caption */}
                    <h3 className="font-bold text-gray-900 text-lg truncate">{route.name}</h3>
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {route.origin} → {route.destination}
                    </p>
                    <p className="text-xs text-indigo-600 font-semibold mt-1">
                      MWK {route.baseFare?.toLocaleString() ?? '—'} • {routeTemplates.length} blueprint{routeTemplates.length === 1 ? '' : 's'}
                    </p>

                    {/* Bottom Status Panel */}
                    <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600 border border-slate-100 flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900 capitalize">
                        {routeScheduleCount} upcoming trip{routeScheduleCount === 1 ? '' : 's'}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-widest rounded-full px-2.5 py-1 bg-indigo-100 text-indigo-700">
                        Schedules
                      </span>
                    </div>
                  </button>
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

            const filteredSelectedRouteSchedules = schedules.filter((schedule: Schedule) => {
              if (schedule.routeId !== selectedRouteId) return false;
              if (schedule.status === 'archived' || !!schedule.isArchived) return false;
              if (!scheduleFilterDate) return true;
              const d = parseUtcDate(schedule.departureDateTime as unknown as string);
              const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              return localDate === scheduleFilterDate;
            });

            const upcomingSchedules = filteredSelectedRouteSchedules.filter(isRelevantSchedule)
              .sort((a: Schedule, b: Schedule) => {
                const activeStatuses = ['boarding', 'in_transit'];
                const aActive = activeStatuses.includes(a.tripStatus || '');
                const bActive = activeStatuses.includes(b.tripStatus || '');
                if (aActive !== bActive) return aActive ? -1 : 1;
                return parseUtcDate(a.departureDateTime as unknown as string).getTime() - parseUtcDate(b.departureDateTime as unknown as string).getTime();
              });

            const completedSchedules = filteredSelectedRouteSchedules.filter((s: Schedule) => !isRelevantSchedule(s))
              .sort((a: Schedule, b: Schedule) => parseUtcDate(b.departureDateTime as unknown as string).getTime() - parseUtcDate(a.departureDateTime as unknown as string).getTime());

            const pagedSchedules = upcomingSchedules.slice(
              (schedulesPage - 1) * SCHEDULES_PER_PAGE,
              schedulesPage * SCHEDULES_PER_PAGE
            );
            
            const routeBookings = dashboard.bookings?.filter((b: any) => b.routeId === selectedRouteId) || [];
            const revenue = routeBookings
              .filter((b: any) => b.paymentStatus === 'paid')
              .reduce((sum: number, b: any) => sum + (b.totalAmount || 0), 0);

            return (
              <div className="mt-8">
                <RouteScheduleSection
                  route={selectedRoute}
                  scheduleCount={filteredSelectedRouteSchedules.length}
                  revenue={revenue}
                  filterDate={scheduleFilterDate}
                  onFilterDateChange={setScheduleFilterDate}
                  onAddSchedule={() => openCreateSchedule(selectedRoute.id)}
                  pagedSchedules={pagedSchedules}
                  currentAndUpcomingCount={upcomingSchedules.length}
                  completedSchedules={completedSchedules}
                  page={schedulesPage}
                  onPreviousPage={() => setSchedulesPage((p) => Math.max(p - 1, 1))}
                  onNextPage={() => setSchedulesPage((p) => Math.min(p + 1, Math.ceil(upcomingSchedules.length / SCHEDULES_PER_PAGE) || 1))}
                  buses={buses}
                  bookings={dashboard.bookings || []}
                  templates={templates}
                  companyId={companyId}
                  onTripsGenerated={() => openGenerateTrips(selectedRoute.id)}
                  onScheduleDeleted={() => dashboard.fetchInitialData?.(true)}
                  baseUrl="/company/operator/dashboard"
                />
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
