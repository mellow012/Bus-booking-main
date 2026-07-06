'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { MapPin, Bus as BusIcon, Calendar } from 'lucide-react';
import { Route, Bus, Schedule, Booking } from '@/types';

import BranchesGrid from './components/BranchesGrid';
import AllBranchesOverview from './components/BranchesOverview';
import BranchDetailPanel from './components/BranchDetailPanel';
import UnassignedRoutesPanel from './components/UnassignedRoutesPanel';
import RegionsModals from './components/modals/RegionsModal';

import { BranchUpcomingTrip, BusFormState, ModalContext, ModalType, RouteFormState, RouteWithScheduleInfo, ScheduleFormState } from './types';
import { getTripWindow, isArchivedSchedule } from './utils/schedule';

interface RegionsTabProps {
  dashboard: any;
}

const EMPTY_ROUTE_FORM: RouteFormState = { name: '', origin: '', destination: '', distance: '', duration: '', baseFare: '' };
const EMPTY_BUS_FORM: BusFormState = { licensePlate: '', busType: 'Economy', capacity: '45', status: 'active' };
const EMPTY_SCHEDULE_FORM: ScheduleFormState = { routeId: '', busId: '', departureDate: '', departureTime: '', arrivalDate: '', arrivalTime: '', price: '', availableSeats: '' };

export default function RegionsTab({ dashboard }: RegionsTabProps) {
  const { dashboardData, addItem, showAlert } = dashboard;
  const typedDashboardData = dashboardData as {
    routes: Route[];
    buses: Bus[];
    schedules: Schedule[];
    operators: any[];
    bookings: Booking[];
    regions: any[];
  };
  const { routes, buses, schedules, operators, bookings } = typedDashboardData;
  const allBranches = typedDashboardData.regions || [];

  const searchQuery = dashboard.searchQuery?.toLowerCase() || '';

  const branches = allBranches.filter((branch: any) => {
    if (!searchQuery) return true;
    if (branch.name?.toLowerCase().includes(searchQuery)) return true;
    const branchRoutes = routes.filter((r: Route) => r.regionId === branch.id);
    return branchRoutes.some(
      (r: Route) =>
        r.name?.toLowerCase().includes(searchQuery) || r.origin?.toLowerCase().includes(searchQuery) || r.destination?.toLowerCase().includes(searchQuery)
    );
  });

  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [scheduleFilterDate, setScheduleFilterDate] = useState<string>('');
  const [schedulePageByRoute, setSchedulePageByRoute] = useState<Record<string, number>>({});

  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [modalContext, setModalContext] = useState<ModalContext>({});
  const [saving, setSaving] = useState(false);

  const [routeForm, setRouteForm] = useState<RouteFormState>(EMPTY_ROUTE_FORM);
  const [busForm, setBusForm] = useState<BusFormState>(EMPTY_BUS_FORM);
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>(EMPTY_SCHEDULE_FORM);

  const selectedBranch = branches.find((b: any) => b.id === selectedBranchId) || null;
  const selectedBranchRoutes = useMemo(
    () => (selectedBranchId ? routes.filter((r: Route) => r.regionId === selectedBranchId) : []),
    [routes, selectedBranchId]
  );

  const routesWithScheduleInfo: RouteWithScheduleInfo[] = useMemo(() => {
    const now = Date.now();
    return selectedBranchRoutes
      .map((route: Route) => {
        const routeSchedules = schedules.filter((s: Schedule) => s.routeId === route.id && !isArchivedSchedule(s));
        const activeCount = routeSchedules.filter((schedule: Schedule) => {
          const { departure, arrival } = getTripWindow(schedule);
          return departure <= now && now <= arrival;
        }).length;
        return { route, activeCount, scheduleCount: routeSchedules.length };
      })
      .sort((a, b) => {
        if (a.activeCount !== b.activeCount) return b.activeCount - a.activeCount;
        if ((a.scheduleCount > 0) !== (b.scheduleCount > 0)) return b.scheduleCount > 0 ? -1 : 1;
        return b.scheduleCount - a.scheduleCount;
      });
  }, [selectedBranchRoutes, schedules]);

  const selectedRoute = selectedBranchRoutes.find((route: Route) => route.id === selectedRouteId) || selectedBranchRoutes[0] || null;

  const selectedRouteSchedules = useMemo(() => {
    if (!selectedRoute) return [];
    return schedules.filter((s: Schedule) => s.routeId === selectedRoute.id && !isArchivedSchedule(s));
  }, [schedules, selectedRoute]);

  const selectedRouteBookings = useMemo(() => {
    if (!selectedRoute) return [];
    return bookings.filter((b: Booking) => b.routeId === selectedRoute.id);
  }, [bookings, selectedRoute]);

  const selectedRouteRevenue = useMemo(() => {
    return selectedRouteBookings.filter((b: Booking) => b.paymentStatus === 'paid').reduce((acc: number, b: Booking) => acc + (b.totalAmount || 0), 0);
  }, [selectedRouteBookings]);

  const filteredSelectedRouteSchedules = useMemo(() => {
    return selectedRouteSchedules.filter((schedule: Schedule) => {
      if (!scheduleFilterDate) return true;
      return new Date(schedule.departureDateTime).toISOString().split('T')[0] === scheduleFilterDate;
    });
  }, [selectedRouteSchedules, scheduleFilterDate]);

  const selectedRouteNow = Date.now();
  const currentAndUpcomingSelectedRouteSchedules = filteredSelectedRouteSchedules
    .filter((schedule: Schedule) => getTripWindow(schedule).arrival >= selectedRouteNow)
    .sort((a: Schedule, b: Schedule) => {
      const activeStatuses = ['boarding', 'in_transit'];
      const aActive = activeStatuses.includes(a.tripStatus || '');
      const bActive = activeStatuses.includes(b.tripStatus || '');
      if (aActive !== bActive) return aActive ? -1 : 1;
      return new Date(a.departureDateTime).getTime() - new Date(b.departureDateTime).getTime();
    });

  const completedSelectedRouteSchedules = filteredSelectedRouteSchedules
    .filter((schedule: Schedule) => getTripWindow(schedule).arrival < selectedRouteNow)
    .sort((a: Schedule, b: Schedule) => new Date(b.departureDateTime).getTime() - new Date(a.departureDateTime).getTime());

  const selectedRoutePage = selectedRoute ? schedulePageByRoute[selectedRoute.id] || 1 : 1;
  const pagedSelectedRouteSchedules = currentAndUpcomingSelectedRouteSchedules.slice((selectedRoutePage - 1) * 5, selectedRoutePage * 5);

  const branchUpcomingTrips = useMemo(() => {
    if (!selectedBranchId) return [];
    const routeIds = new Set(selectedBranchRoutes.map((r: Route) => r.id));
    const now = Date.now();
    return schedules
      .filter((s: Schedule) => routeIds.has(s.routeId) && new Date(s.departureDateTime).getTime() >= now && !isArchivedSchedule(s))
      .sort((a: Schedule, b: Schedule) => new Date(a.departureDateTime).getTime() - new Date(b.departureDateTime).getTime())
      .slice(0, 8);
  }, [schedules, selectedBranchId, selectedBranchRoutes]);

  const allBranchUpcomingTrips = useMemo<BranchUpcomingTrip[]>(() => {
    const now = Date.now();
    return schedules
      .map((schedule: Schedule): BranchUpcomingTrip | null => {
        const route = routes.find((r: Route) => r.id === schedule.routeId);
        const branch = route ? allBranches.find((b: any) => b.id === route.regionId) : null;
        if (!route || !branch || !route.regionId) return null;
        const { departure, arrival } = getTripWindow(schedule);
        if (arrival < now || isArchivedSchedule(schedule)) return null;
        return { schedule, route, branch, departure, arrival };
      })
      .filter((item): item is BranchUpcomingTrip => item !== null)
      .sort((a, b) => a.departure - b.departure)
      .slice(0, 8);
  }, [schedules, routes, allBranches]);

  const selectBranch = (id: string) => {
    setSelectedBranchId((prev) => (prev === id ? null : id));
    setSelectedRouteId(null);
    setScheduleFilterDate('');
  };

  useEffect(() => {
    setSchedulePageByRoute({});
  }, [selectedBranchId, scheduleFilterDate]);

  useEffect(() => {
    if (selectedBranchRoutes.length === 0) {
      setSelectedRouteId(null);
      return;
    }
    if (!selectedRouteId || !selectedBranchRoutes.some((route: Route) => route.id === selectedRouteId)) {
      setSelectedRouteId(selectedBranchRoutes[0]?.id || null);
    }
  }, [selectedBranchRoutes, selectedRouteId]);

  const resetForms = () => {
    setRouteForm(EMPTY_ROUTE_FORM);
    setBusForm(EMPTY_BUS_FORM);
    setScheduleForm(EMPTY_SCHEDULE_FORM);
  };

  const openModal = (type: ModalType, context: ModalContext = {}) => {
    setActiveModal(type);
    setModalContext(context);
    resetForms();
    if (type === 'addSchedule' && context.routeId) {
      setScheduleForm((p) => ({ ...p, routeId: context.routeId! }));
    }
  };

  const handleAddReturnSchedule = (selectedRouteId?: string) => {
    if (!selectedRouteId) {
      showAlert('error', 'Please select a route first.');
      return;
    }

    const route = routes.find((r: Route) => r.id === selectedRouteId);
    if (!route) {
      showAlert('error', 'Selected route not found.');
      return;
    }

    const reverseRoute = routes.find(
      (r: Route) =>
        r.origin === route.destination &&
        r.destination === route.origin &&
        r.regionId === route.regionId
    );

    if (!reverseRoute) {
      showAlert('error', 'No matching return route exists for this route in the branch. Create a reverse route first.');
      return;
    }

    openModal('addSchedule', { branchId: modalContext.branchId, routeId: reverseRoute.id, isReturnSchedule: true });
  };

  const handleAddRoute = async () => {
    if (!routeForm.name || !routeForm.origin || !routeForm.destination) {
      showAlert('error', 'Please fill in route name, origin and destination.');
      return;
    }
    setSaving(true);
    try {
      await addItem('Route', {
        name: routeForm.name,
        origin: routeForm.origin,
        destination: routeForm.destination,
        distance: parseInt(routeForm.distance) || 0,
        duration: parseInt(routeForm.duration) || 0,
        baseFare: parseInt(routeForm.baseFare) || 0,
        regionId: modalContext.branchId || null,
        isActive: true,
        status: 'active',
      });
      setActiveModal(null);
    } catch {
      showAlert('error', 'Failed to add route');
    } finally {
      setSaving(false);
    }
  };

  const handleAddBus = async () => {
    if (!busForm.licensePlate) {
      showAlert('error', 'License plate is required.');
      return;
    }
    setSaving(true);
    try {
      await addItem('Bus', {
        licensePlate: busForm.licensePlate,
        busType: busForm.busType,
        capacity: parseInt(busForm.capacity) || 45,
        status: busForm.status,
        isActive: true,
        amenities: [],
      });
      setActiveModal(null);
    } catch {
      showAlert('error', 'Failed to add bus');
    } finally {
      setSaving(false);
    }
  };

  const handleAddSchedule = async () => {
    const routeId = modalContext.routeId || scheduleForm.routeId;
    if (!routeId) {
      showAlert('error', 'Please select a route.');
      return;
    }
    if (!scheduleForm.busId || !scheduleForm.departureDate || !scheduleForm.departureTime || !scheduleForm.price) {
      showAlert('error', 'Please fill in bus, departure date/time, and price.');
      return;
    }
    setSaving(true);
    try {
      const departureDateTime = new Date(`${scheduleForm.departureDate}T${scheduleForm.departureTime}`);
      const arrivalDateTime =
        scheduleForm.arrivalDate && scheduleForm.arrivalTime
          ? new Date(`${scheduleForm.arrivalDate}T${scheduleForm.arrivalTime}`)
          : new Date(departureDateTime.getTime() + 3 * 60 * 60 * 1000);

      const selectedBus = buses.find((b: Bus) => b.id === scheduleForm.busId);

      await addItem('Schedule', {
        routeId,
        busId: scheduleForm.busId,
        departureDateTime: departureDateTime.toISOString(),
        arrivalDateTime: arrivalDateTime.toISOString(),
        price: parseInt(scheduleForm.price),
        availableSeats: parseInt(scheduleForm.availableSeats) || selectedBus?.capacity || 45,
        status: 'active',
        tripStatus: 'scheduled',
      });
      setActiveModal(null);
    } catch {
      showAlert('error', 'Failed to add schedule');
    } finally {
      setSaving(false);
    }
  };

  const unassignedRoutes = routes.filter(
    (r: Route) => !r.regionId && (!searchQuery || r.name?.toLowerCase().includes(searchQuery) || r.origin?.toLowerCase().includes(searchQuery) || r.destination?.toLowerCase().includes(searchQuery))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <MapPin className="w-6 h-6 text-indigo-600" />
            Branches &amp; Routes
          </h2>
          <p className="mt-1 text-sm text-gray-500">Select a branch to manage its routes, buses, and schedules.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => openModal('addBus')} className="inline-flex items-center gap-2 rounded-lg bg-white border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm">
            <BusIcon className="h-4 w-4" /> Add Bus
          </button>
          <button
            onClick={() => selectedBranchId && openModal('addSchedule', { branchId: selectedBranchId })}
            disabled={!selectedBranchId}
            title={!selectedBranchId ? 'Select a branch first' : undefined}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-indigo-600"
          >
            <Calendar className="h-4 w-4" /> Create Schedule
          </button>
        </div>
      </div>

      {branches.length === 0 ? (
        <div className="py-12 text-center bg-white rounded-2xl border border-dashed border-gray-200">
          <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-900 mb-1">No Branches Yet</h3>
          <p className="text-gray-500 max-w-md mx-auto">Add branches in the Operators &amp; Branches tab first, then come back here to add routes and schedules.</p>
        </div>
      ) : (
        <>
          <BranchesGrid branches={branches} routes={routes} operators={operators} schedules={schedules} selectedBranchId={selectedBranchId} onSelectBranch={selectBranch} />

          {!selectedBranch && <AllBranchesOverview trips={allBranchUpcomingTrips} buses={buses} />}
        </>
      )}

      {selectedBranch && (
        <BranchDetailPanel
          branch={selectedBranch}
          branchRoutes={selectedBranchRoutes}
          bookingsInBranch={bookings.filter((b: Booking) => selectedBranchRoutes.some((route: Route) => route.id === b.routeId)).length}
          routesWithScheduleInfo={routesWithScheduleInfo}
          selectedRoute={selectedRoute}
          selectedRouteId={selectedRouteId}
          onSelectRoute={setSelectedRouteId}
          onAddRoute={() => openModal('addRoute', { branchId: selectedBranch.id })}
          onAddSchedule={() => selectedRoute && openModal('addSchedule', { branchId: selectedBranch.id, routeId: selectedRoute.id })}
          onAddReturnSchedule={() => handleAddReturnSchedule(selectedRoute?.id)}
          selectedRouteScheduleCount={selectedRouteSchedules.length}
          selectedRouteRevenue={selectedRouteRevenue}
          scheduleFilterDate={scheduleFilterDate}
          onFilterDateChange={setScheduleFilterDate}
          pagedSchedules={pagedSelectedRouteSchedules}
          currentAndUpcomingCount={currentAndUpcomingSelectedRouteSchedules.length}
          completedSchedules={completedSelectedRouteSchedules}
          schedulePage={selectedRoutePage}
          onPreviousPage={() =>
            selectedRoute && setSchedulePageByRoute((current) => ({ ...current, [selectedRoute.id]: Math.max(1, (current[selectedRoute.id] || 1) - 1) }))
          }
          onNextPage={() => selectedRoute && setSchedulePageByRoute((current) => ({ ...current, [selectedRoute.id]: (current[selectedRoute.id] || 1) + 1 }))}
          branchUpcomingTrips={branchUpcomingTrips}
          routes={routes}
          buses={buses}
          bookings={bookings}
        />
      )}

      <UnassignedRoutesPanel routes={unassignedRoutes} />

      <RegionsModals
        activeModal={activeModal}
        modalContext={modalContext}
        saving={saving}
        onClose={() => setActiveModal(null)}
        routeForm={routeForm}
        onRouteFormChange={setRouteForm}
        onSaveRoute={handleAddRoute}
        busForm={busForm}
        onBusFormChange={setBusForm}
        onSaveBus={handleAddBus}
        scheduleForm={scheduleForm}
        onScheduleFormChange={setScheduleForm}
        onSaveSchedule={handleAddSchedule}
        routes={routes}
        buses={buses}
      />
    </div>
  );
}