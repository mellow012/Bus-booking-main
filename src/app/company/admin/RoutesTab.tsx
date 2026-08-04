'use client';

import React, { useState, Fragment } from 'react';
import { Route, RouteStop } from '@/types';
import { Map, MapPin, Plus, Edit3, Trash2, Search, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';
import { Button } from '@/components/ui/button';
import StopsEditor from '@/components/common/StopsEditor';
import { createRoute, updateRoute, deleteRoute } from '@/lib/actions/fleet.actions';

interface RoutesTabProps {
  dashboard: any;
}

export default function RoutesTab({ dashboard }: RoutesTabProps) {
  const { dashboardData, fetchInitialData, userProfile } = dashboard;
  const routes: Route[] = dashboardData?.routes || [];
  const companyId = userProfile?.companyId?.trim() || '';

  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Partial<Route> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const filteredRoutes = routes.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.name?.toLowerCase().includes(q) ||
      r.origin?.toLowerCase().includes(q) ||
      r.destination?.toLowerCase().includes(q)
    );
  });

  const handleOpenCreate = () => {
    setEditingRoute({
      name: '',
      origin: '',
      destination: '',
      distance: 100,
      duration: 120,
      baseFare: 5000,
      stops: [],
      isActive: true,
      companyId,
    });
    setErrorMsg(null);
    setShowModal(true);
  };

  const handleOpenEdit = (route: Route) => {
    setEditingRoute({
      ...route,
      stops: Array.isArray(route.stops) ? route.stops : [],
    });
    setErrorMsg(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoute) return;

    if (!editingRoute.name?.trim() || !editingRoute.origin?.trim() || !editingRoute.destination?.trim()) {
      setErrorMsg('Route Name, Origin, and Destination are required.');
      return;
    }

    const originStr = editingRoute.origin.trim().toLowerCase();
    const destStr = editingRoute.destination.trim().toLowerCase();
    const isDuplicate = routes.some(r => 
      r.id !== editingRoute.id &&
      r.origin?.trim().toLowerCase() === originStr &&
      r.destination?.trim().toLowerCase() === destStr
    );

    if (isDuplicate) {
      setErrorMsg(`A route from ${editingRoute.origin.trim()} to ${editingRoute.destination.trim()} already exists.`);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      if (editingRoute.id) {
        const res = await updateRoute(editingRoute.id, editingRoute);
        if (!res.success) throw new Error(res.error || 'Failed to update route');
        setSuccessMsg('Route updated successfully!');
      } else {
        const res = await createRoute({
          ...editingRoute,
          companyId,
        });
        if (!res.success) throw new Error(res.error || 'Failed to create route');
        setSuccessMsg('Route created successfully!');
      }

      await fetchInitialData?.();
      setShowModal(false);
      setEditingRoute(null);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while saving the route.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this route?')) return;
    try {
      const res = await deleteRoute(id);
      if (!res.success) throw new Error('Failed to delete route');
      await fetchInitialData?.();
      setSuccessMsg('Route deleted.');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to delete route.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Map className="w-6 h-6 text-indigo-600" />
            Route Manager
          </h2>
          <p className="text-xs text-gray-500 mt-1">Configure company routes, intermediate pick-up stops, and base fares.</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-100"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Route</span>
        </button>
      </div>

      {/* Success Notification Banner */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search routes by name, origin, or destination…"
          className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
        />
      </div>

      {/* Route Cards Grid */}
      {filteredRoutes.length === 0 ? (
        <div className="py-12 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-gray-900 font-bold">{searchQuery ? 'No matching routes found' : 'No routes configured yet'}</h3>
          <p className="text-xs text-gray-500 mt-1">Add routes to start setting up schedules and intermediate stops for passengers.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRoutes.map((route) => {
            const stopsList = (Array.isArray(route.stops) ? route.stops : []) as RouteStop[];
            return (
              <div key={route.id} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4 hover:border-indigo-200 transition-all">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">{route.name}</h3>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">{route.origin} → {route.destination}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    route.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {route.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-gray-50 p-3 rounded-xl text-center text-xs border border-gray-100">
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Distance</p>
                    <p className="font-bold text-gray-800">{route.distance} km</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Stops</p>
                    <p className="font-bold text-indigo-600">{stopsList.length} stops</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Base Fare</p>
                    <p className="font-bold text-gray-800">MWK {route.baseFare?.toLocaleString()}</p>
                  </div>
                </div>

                {/* Stops Summary */}
                {stopsList.length > 0 && (
                  <div className="text-[11px] text-gray-600 bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100">
                    <p className="font-bold text-indigo-900 mb-1">Pick-up Points:</p>
                    <p className="truncate font-medium">{stopsList.map((s) => s.name).join(' → ')}</p>
                  </div>
                )}

                <div className="pt-2 border-t border-gray-100 flex justify-end gap-2">
                  <button
                    onClick={() => handleOpenEdit(route)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Stops & Details</span>
                  </button>
                  <button
                    onClick={() => handleDelete(route.id)}
                    className="p-1.5 text-gray-400 hover:text-rose-600 transition-colors"
                    title="Delete Route"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Route Modal */}
      <Transition.Root show={showModal && !!editingRoute} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-xl transition-all w-full max-w-2xl border border-gray-100">
                  <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                    <Dialog.Title as="h3" className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <Map className="w-5 h-5 text-indigo-600" />
                      {editingRoute?.id ? 'Edit Route & Intermediate Stops' : 'Create New Route'}
                    </Dialog.Title>
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="text-gray-400 hover:text-gray-600 text-lg font-semibold"
                    >
                      ×
                    </button>
                  </div>

                  {editingRoute && (
                    <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                      {errorMsg && (
                        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-700 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                          <span>{errorMsg}</span>
                        </div>
                      )}

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Route Name *</label>
                          <input
                            type="text"
                            value={editingRoute.name || ''}
                            onChange={(e) => setEditingRoute({ ...editingRoute, name: e.target.value })}
                            placeholder="e.g. Lilongwe - Blantyre Express"
                            className="h-10 mt-1 block w-full rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                            required
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Origin *</label>
                            <input
                              type="text"
                              value={editingRoute.origin || ''}
                              onChange={(e) => setEditingRoute({ ...editingRoute, origin: e.target.value })}
                              placeholder="Lilongwe"
                              className="h-10 mt-1 block w-full rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700">Destination *</label>
                            <input
                              type="text"
                              value={editingRoute.destination || ''}
                              onChange={(e) => setEditingRoute({ ...editingRoute, destination: e.target.value })}
                              placeholder="Blantyre"
                              className="h-10 mt-1 block w-full rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                              required
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Distance (km)</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={editingRoute.distance ?? ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === '' || /^\d*\.?\d*$/.test(v)) setEditingRoute({ ...editingRoute, distance: v === '' ? undefined : (parseFloat(v) as any) });
                              }}
                              className="h-10 mt-1 block w-full rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                              placeholder="310"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700">Base Fare (MWK)</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={editingRoute.baseFare ?? ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === '' || /^\d*\.?\d*$/.test(v)) setEditingRoute({ ...editingRoute, baseFare: v === '' ? undefined : (parseFloat(v) as any) });
                              }}
                              className="h-10 mt-1 block w-full rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                              placeholder="5000"
                            />
                          </div>
                        </div>

                        {/* Shared Stops Editor */}
                        <div className="pt-3 border-t border-gray-100">
                          <StopsEditor
                            stops={(editingRoute.stops as RouteStop[]) || []}
                            onChange={(newStops) => setEditingRoute({ ...editingRoute, stops: newStops })}
                          />
                        </div>
                      </div>

                      {/* Footer Buttons */}
                      <div className="flex justify-end gap-3 pt-4 border-t border-gray-50 mt-6">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowModal(false)}
                          className="rounded-xl h-10"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={isSubmitting}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-10 min-w-[100px]"
                        >
                          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Route & Stops'}
                        </Button>
                      </div>
                    </form>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
    </div>
  );
}
