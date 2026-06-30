'use client';

import React, { useMemo, useState } from 'react';
import {
  MapPin, Bus as BusIcon, Calendar, ChevronRight, ChevronDown,
  PlusCircle, X, AlertCircle, Loader2, Route as RouteIcon, BadgeCheck, Users,
} from 'lucide-react';
import { Route, Bus, Schedule, Booking } from '@/types';
import { BUS_TYPES, BUS_STATUSES, CAPACITY_LIMITS } from './_lib/constants';

interface RegionsTabProps {
  dashboard: any;
}

type ModalType = 'addRoute' | 'addBus' | 'addSchedule' | null;

export default function RegionsTab({ dashboard }: RegionsTabProps) {
  const { dashboardData, addItem, showAlert } = dashboard;
  const { routes, buses, schedules, operators, bookings } = dashboardData;
  const allBranches = dashboardData.regions || [];

  const searchQuery = dashboard.searchQuery?.toLowerCase() || '';

  const branches = allBranches.filter((branch: any) => {
    if (!searchQuery) return true;
    if (branch.name?.toLowerCase().includes(searchQuery)) return true;
    const branchRoutes = routes.filter((r: Route) => r.regionId === branch.id);
    return branchRoutes.some((r: Route) =>
      r.name?.toLowerCase().includes(searchQuery) ||
      r.origin?.toLowerCase().includes(searchQuery) ||
      r.destination?.toLowerCase().includes(searchQuery)
    );
  });

  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null);

  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [modalContext, setModalContext] = useState<{ branchId?: string; routeId?: string }>({});
  const [saving, setSaving] = useState(false);

  const [routeForm, setRouteForm] = useState({ name: '', origin: '', destination: '', distance: '', duration: '', baseFare: '' });
  const [busForm, setBusForm] = useState({ licensePlate: '', busType: 'Economy' as string, capacity: '45', status: 'active' });
  const [scheduleForm, setScheduleForm] = useState({ routeId: '', busId: '', departureDate: '', departureTime: '', arrivalDate: '', arrivalTime: '', price: '', availableSeats: '' });

  const selectedBranch = branches.find((b: any) => b.id === selectedBranchId) || null;
  const selectedBranchRoutes = useMemo(
    () => (selectedBranchId ? routes.filter((r: Route) => r.regionId === selectedBranchId) : []),
    [routes, selectedBranchId]
  );

  // Upcoming trips across every route in the selected branch, soonest first
  const branchUpcomingTrips = useMemo(() => {
    if (!selectedBranchId) return [];
    const routeIds = new Set(selectedBranchRoutes.map((r: Route) => r.id));
    const now = Date.now();
    return schedules
      .filter((s: Schedule) => routeIds.has(s.routeId) && new Date(s.departureDateTime).getTime() >= now && s.status !== 'archived')
      .sort((a: Schedule, b: Schedule) => new Date(a.departureDateTime).getTime() - new Date(b.departureDateTime).getTime())
      .slice(0, 8);
  }, [schedules, selectedBranchId, selectedBranchRoutes]);

  const selectBranch = (id: string) => {
    setSelectedBranchId(prev => (prev === id ? null : id));
    setExpandedRoute(null);
  };

  const toggleRoute = (id: string) => setExpandedRoute(expandedRoute === id ? null : id);

  const resetForms = () => {
    setRouteForm({ name: '', origin: '', destination: '', distance: '', duration: '', baseFare: '' });
    setBusForm({ licensePlate: '', busType: 'Economy', capacity: '45', status: 'active' });
    setScheduleForm({ routeId: '', busId: '', departureDate: '', departureTime: '', arrivalDate: '', arrivalTime: '', price: '', availableSeats: '' });
  };

  const openModal = (type: ModalType, context: typeof modalContext = {}) => {
    setActiveModal(type);
    setModalContext(context);
    resetForms();
    if (type === 'addSchedule' && context.routeId) {
      setScheduleForm(p => ({ ...p, routeId: context.routeId! }));
    }
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
    } catch { showAlert('error', 'Failed to add route'); }
    finally { setSaving(false); }
  };

  const handleAddBus = async () => {
    if (!busForm.licensePlate) { showAlert('error', 'License plate is required.'); return; }
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
    } catch { showAlert('error', 'Failed to add bus'); }
    finally { setSaving(false); }
  };

  const handleAddSchedule = async () => {
    const routeId = modalContext.routeId || scheduleForm.routeId;
    if (!routeId) { showAlert('error', 'Please select a route.'); return; }
    if (!scheduleForm.busId || !scheduleForm.departureDate || !scheduleForm.departureTime || !scheduleForm.price) {
      showAlert('error', 'Please fill in bus, departure date/time, and price.');
      return;
    }
    setSaving(true);
    try {
      const departureDateTime = new Date(`${scheduleForm.departureDate}T${scheduleForm.departureTime}`);
      const arrivalDateTime = scheduleForm.arrivalDate && scheduleForm.arrivalTime
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
    } catch { showAlert('error', 'Failed to add schedule'); }
    finally { setSaving(false); }
  };

  const unassignedRoutes = routes.filter((r: Route) =>
    !r.regionId && (!searchQuery || r.name?.toLowerCase().includes(searchQuery) || r.origin?.toLowerCase().includes(searchQuery) || r.destination?.toLowerCase().includes(searchQuery))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <MapPin className="w-6 h-6 text-indigo-600" />
            Branches &amp; Routes
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Select a branch to manage its routes, buses, and schedules.
          </p>
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

      {/* Branch Grid */}
      {branches.length === 0 ? (
        <div className="py-12 text-center bg-white rounded-2xl border border-dashed border-gray-200">
          <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-900 mb-1">No Branches Yet</h3>
          <p className="text-gray-500 max-w-md mx-auto">Add branches in the Operators &amp; Branches tab first, then come back here to add routes and schedules.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {branches.map((branch: any) => {
            const branchRoutes = routes.filter((r: Route) => r.regionId === branch.id);
            const branchOperators = operators.filter((o: any) => o.regionId === branch.id);
            const isSelected = selectedBranchId === branch.id;

            return (
              <button
                key={branch.id}
                onClick={() => selectBranch(branch.id)}
                className={`text-left bg-white rounded-xl border p-4 transition-all shadow-sm ${isSelected ? 'border-indigo-600 ring-2 ring-indigo-600 ring-opacity-20' : 'border-gray-200 hover:border-indigo-200 hover:shadow-md'
                  }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                    <MapPin className="w-5 h-5" />
                  </div>
                  {branch.isActive !== undefined && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${branch.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'
                      }`}>
                      {branch.isActive && <BadgeCheck className="w-3 h-3" />}
                      {branch.isActive ? 'Active' : 'Inactive'}
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-gray-900 text-lg truncate">{branch.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{branchRoutes.length} Routes • {branchOperators.length} Operators</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Selected branch details */}
      {selectedBranch && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">{selectedBranch.name}</h3>
                <p className="text-xs text-gray-500">{selectedBranchRoutes.length} routes in this branch</p>
              </div>
            </div>
            <button
              onClick={() => openModal('addRoute', { branchId: selectedBranch.id })}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg flex items-center gap-1"
            >
              <PlusCircle className="w-3 h-3" /> Add Route
            </button>
          </div>

          <div className="p-5 space-y-3">
            {selectedBranchRoutes.length === 0 ? (
              <div className="text-center py-6">
                <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No routes in this branch yet.</p>
              </div>
            ) : (
              selectedBranchRoutes.map((route: Route) => {
                const isRouteExpanded = expandedRoute === route.id;
                const routeSchedules = schedules.filter((s: Schedule) => s.routeId === route.id);
                const routeBookings = bookings.filter((b: Booking) => b.routeId === route.id);
                const routeRevenue = routeBookings.filter((b: Booking) => b.paymentStatus === 'paid').reduce((acc: number, b: Booking) => acc + (b.totalAmount || 0), 0);

                return (
                  <div key={route.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                    <div
                      onClick={() => toggleRoute(route.id)}
                      className="p-4 flex items-center justify-between cursor-pointer hover:bg-indigo-50/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600">
                          <RouteIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">{route.name}</h4>
                          <p className="text-xs text-gray-500">{route.origin} → {route.destination} • {routeSchedules.length} Schedules • {routeBookings.length} Bookings</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-green-600">MWK {routeRevenue.toLocaleString()}</span>
                        {isRouteExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                      </div>
                    </div>

                    {isRouteExpanded && (
                      <div className="p-4 border-t border-gray-100 bg-gray-50/50 space-y-3">
                        {routeSchedules.length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-4">No schedules created for this route yet.</p>
                        ) : (
                          routeSchedules.map((schedule: Schedule) => {
                            const bus = buses.find((b: Bus) => b.id === schedule.busId);
                            const sBookings = bookings.filter((b: Booking) => b.scheduleId === schedule.id);
                            const sRevenue = sBookings.filter((b: Booking) => b.paymentStatus === 'paid').reduce((acc: number, b: Booking) => acc + (b.totalAmount || 0), 0);

                            return (
                              <div key={schedule.id} className="bg-white p-3 rounded-lg border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <Calendar className="w-4 h-4 text-indigo-500" />
                                    <span className="font-medium text-sm text-gray-900">
                                      {new Date(schedule.departureDateTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${schedule.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                      }`}>
                                      {schedule.tripStatus || schedule.status}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <BusIcon className="w-3 h-3" />
                                    <span>{bus ? `${bus.licensePlate} (${bus.capacity} seats)` : 'No Bus'}</span>
                                    <span>• MWK {schedule.price?.toLocaleString()} per seat</span>
                                  </div>
                                </div>

                                <div className="flex gap-4 text-sm bg-gray-50 px-4 py-2 rounded-lg border border-gray-100">
                                  <div className="text-center">
                                    <div className="font-bold text-gray-900">{sBookings.length}</div>
                                    <div className="text-[10px] text-gray-500 uppercase">Bookings</div>
                                  </div>
                                  <div className="w-px bg-gray-200"></div>
                                  <div className="text-center">
                                    <div className="font-bold text-green-600">MWK {sRevenue.toLocaleString()}</div>
                                    <div className="text-[10px] text-gray-500 uppercase">Revenue</div>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}

                        <button
                          onClick={() => openModal('addSchedule', { branchId: selectedBranch.id, routeId: route.id })}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg flex items-center gap-1 w-fit"
                        >
                          <PlusCircle className="w-3 h-3" /> Add Schedule
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Recently Scheduled / Upcoming Trips — scoped to this branch */}
          <div className="p-5 border-t border-gray-100 bg-gray-50/30">
            <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-500" /> Upcoming Trips in {selectedBranch.name}
            </h4>
            {branchUpcomingTrips.length === 0 ? (
              <p className="text-sm text-gray-500">No upcoming trips scheduled in this branch.</p>
            ) : (
              <div className="space-y-2">
                {branchUpcomingTrips.map((schedule: Schedule) => {
                  const route = routes.find((r: Route) => r.id === schedule.routeId);
                  const bus = buses.find((b: Bus) => b.id === schedule.busId);
                  return (
                    <div key={schedule.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white px-4 py-2.5 rounded-lg border border-gray-100">
                      <div className="flex items-center gap-3">
                        <RouteIcon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="text-sm font-semibold text-gray-900">{route ? `${route.origin} → ${route.destination}` : 'Unknown route'}</span>
                        <span className="text-xs text-gray-400">{bus?.licensePlate || 'No bus'}</span>
                      </div>
                      <span className="text-xs font-medium text-gray-500">
                        {new Date(schedule.departureDateTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Unassigned Routes */}
      {unassignedRoutes.length > 0 && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
          <h3 className="font-bold text-amber-900 mb-2 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" /> Unassigned Routes
          </h3>
          <p className="text-sm text-amber-700 mb-3">These routes are not assigned to any branch.</p>
          <div className="space-y-2">
            {unassignedRoutes.map((route: Route) => (
              <div key={route.id} className="bg-white p-3 rounded-lg border border-amber-100 flex justify-between items-center">
                <div>
                  <span className="font-medium text-gray-900">{route.name}</span>
                  <span className="text-xs text-gray-500 ml-2">{route.origin} → {route.destination}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── MODALS ─── */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setActiveModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {activeModal === 'addRoute' ? 'Add New Route' : activeModal === 'addBus' ? 'Add New Bus' : 'Create Schedule'}
              </h2>
              <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">

              {activeModal === 'addRoute' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Route Name *</label>
                    <input type="text" value={routeForm.name} onChange={e => setRouteForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="e.g., Lilongwe - Blantyre Express" className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Origin *</label>
                      <input type="text" value={routeForm.origin} onChange={e => setRouteForm(p => ({ ...p, origin: e.target.value }))}
                        placeholder="Lilongwe" className="block w-full rounded-lg border-gray-300 shadow-sm sm:text-sm px-3 py-2 border" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Destination *</label>
                      <input type="text" value={routeForm.destination} onChange={e => setRouteForm(p => ({ ...p, destination: e.target.value }))}
                        placeholder="Blantyre" className="block w-full rounded-lg border-gray-300 shadow-sm sm:text-sm px-3 py-2 border" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Distance (km)</label>
                      <input type="number" value={routeForm.distance} onChange={e => setRouteForm(p => ({ ...p, distance: e.target.value }))}
                        placeholder="310" className="block w-full rounded-lg border-gray-300 shadow-sm sm:text-sm px-3 py-2 border" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Duration (min)</label>
                      <input type="number" value={routeForm.duration} onChange={e => setRouteForm(p => ({ ...p, duration: e.target.value }))}
                        placeholder="240" className="block w-full rounded-lg border-gray-300 shadow-sm sm:text-sm px-3 py-2 border" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Base Fare (MWK)</label>
                      <input type="number" value={routeForm.baseFare} onChange={e => setRouteForm(p => ({ ...p, baseFare: e.target.value }))}
                        placeholder="5000" className="block w-full rounded-lg border-gray-300 shadow-sm sm:text-sm px-3 py-2 border" />
                    </div>
                  </div>
                </>
              )}

              {activeModal === 'addBus' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">License Plate *</label>
                    <input type="text" value={busForm.licensePlate} onChange={e => setBusForm(p => ({ ...p, licensePlate: e.target.value }))}
                      placeholder="BT 1234" className="block w-full rounded-lg border-gray-300 shadow-sm sm:text-sm px-3 py-2 border" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Bus Type</label>
                      <select value={busForm.busType} onChange={e => setBusForm(p => ({ ...p, busType: e.target.value }))}
                        className="block w-full rounded-lg border-gray-300 shadow-sm sm:text-sm px-3 py-2 border">
                        {BUS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                      <input type="number" value={busForm.capacity} onChange={e => setBusForm(p => ({ ...p, capacity: e.target.value }))}
                        min={CAPACITY_LIMITS.min} max={CAPACITY_LIMITS.max}
                        className="block w-full rounded-lg border-gray-300 shadow-sm sm:text-sm px-3 py-2 border" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select value={busForm.status} onChange={e => setBusForm(p => ({ ...p, status: e.target.value }))}
                      className="block w-full rounded-lg border-gray-300 shadow-sm sm:text-sm px-3 py-2 border">
                      {BUS_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                    </select>
                  </div>
                </>
              )}

              {activeModal === 'addSchedule' && (
                <>
                  {!modalContext.routeId && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Route *</label>
                      <select value={scheduleForm.routeId} onChange={e => setScheduleForm(p => ({ ...p, routeId: e.target.value }))}
                        className="block w-full rounded-lg border-gray-300 shadow-sm sm:text-sm px-3 py-2 border">
                        <option value="">Select a route</option>
                        {(modalContext.branchId ? routes.filter((r: Route) => r.regionId === modalContext.branchId) : routes).map((r: Route) => (
                          <option key={r.id} value={r.id}>{r.name || `${r.origin} → ${r.destination}`}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bus *</label>
                    <select value={scheduleForm.busId} onChange={e => {
                      const bus = buses.find((b: Bus) => b.id === e.target.value);
                      setScheduleForm(p => ({ ...p, busId: e.target.value, availableSeats: bus?.capacity?.toString() || p.availableSeats }));
                    }} className="block w-full rounded-lg border-gray-300 shadow-sm sm:text-sm px-3 py-2 border">
                      <option value="">Select a bus</option>
                      {buses.filter((b: Bus) => b.status === 'active').map((b: Bus) => (
                        <option key={b.id} value={b.id}>{b.licensePlate} — {b.busType} ({b.capacity} seats)</option>
                      ))}
                    </select>
                    {buses.filter((b: Bus) => b.status === 'active').length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">No active buses. Add a bus first.</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Departure Date *</label>
                      <input type="date" value={scheduleForm.departureDate} onChange={e => setScheduleForm(p => ({ ...p, departureDate: e.target.value }))}
                        className="block w-full rounded-lg border-gray-300 shadow-sm sm:text-sm px-3 py-2 border" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Departure Time *</label>
                      <input type="time" value={scheduleForm.departureTime} onChange={e => setScheduleForm(p => ({ ...p, departureTime: e.target.value }))}
                        className="block w-full rounded-lg border-gray-300 shadow-sm sm:text-sm px-3 py-2 border" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Arrival Date</label>
                      <input type="date" value={scheduleForm.arrivalDate} onChange={e => setScheduleForm(p => ({ ...p, arrivalDate: e.target.value }))}
                        className="block w-full rounded-lg border-gray-300 shadow-sm sm:text-sm px-3 py-2 border" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Arrival Time</label>
                      <input type="time" value={scheduleForm.arrivalTime} onChange={e => setScheduleForm(p => ({ ...p, arrivalTime: e.target.value }))}
                        className="block w-full rounded-lg border-gray-300 shadow-sm sm:text-sm px-3 py-2 border" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Price per Seat (MWK) *</label>
                      <input type="number" value={scheduleForm.price} onChange={e => setScheduleForm(p => ({ ...p, price: e.target.value }))}
                        placeholder="5000" className="block w-full rounded-lg border-gray-300 shadow-sm sm:text-sm px-3 py-2 border" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Available Seats</label>
                      <input type="number" value={scheduleForm.availableSeats} onChange={e => setScheduleForm(p => ({ ...p, availableSeats: e.target.value }))}
                        placeholder="Auto from bus" className="block w-full rounded-lg border-gray-300 shadow-sm sm:text-sm px-3 py-2 border" />
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setActiveModal(null)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors text-sm">
                Cancel
              </button>
              <button
                onClick={activeModal === 'addRoute' ? handleAddRoute : activeModal === 'addBus' ? handleAddBus : handleAddSchedule}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold transition-colors text-sm disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}