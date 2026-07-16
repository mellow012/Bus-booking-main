"use client";

import React, { useState, useCallback } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import useFilterStore from '@/lib/stores/filterStore';
import * as dbActions from '@/lib/actions/db.actions';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Edit3, Trash2, AlertCircle, Check } from 'lucide-react';

type Props = { companyId?: string; routes?: any[]; buses?: any[] };

const fmtDateTimeInput = (d: Date) => {
  const base = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return `${base}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};

const toDate = (v: unknown): Date => {
  if (v == null) return new Date(0);
  if (v instanceof Date) return v;
  return new Date(v as any);
};

export default function SchedulesTab({ companyId, routes = [], buses = [] }: Props) {
  const { regionId, routeId, scheduleId, setSchedule, dateRange } = useFilterStore();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const limit = 12;

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Form state
  const initialFormState = {
    routeId: routeId || '',
    busId: '',
    departureDateTime: fmtDateTimeInput(new Date(Date.now() + 3600000)),
    arrivalDateTime: fmtDateTimeInput(new Date(Date.now() + 14400000)),
    price: 0,
    availableSeats: 0,
  };
  const [formData, setFormData] = useState(initialFormState);

  // Auto-populate price and seats from route/bus
  const handleRouteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const rid = e.target.value;
    setFormData(prev => ({ ...prev, routeId: rid }));
    const route = routes.find(r => r.id === rid);
    if (route) setFormData(prev => ({ ...prev, price: route.baseFare || 0 }));
  };

  const handleBusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const bid = e.target.value;
    setFormData(prev => ({ ...prev, busId: bid }));
    const bus = buses.find(b => b.id === bid);
    if (bus) setFormData(prev => ({ ...prev, availableSeats: bus.seatCount || bus.capacity || 0 }));
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['cooSchedules', { companyId, regionId, routeId, page, limit, dateRange }],
    queryFn: async () => {
      const url = new URL('/api/admin/coo/schedules', window.location.origin);
      if (companyId) url.searchParams.set('companyId', companyId);
      if (regionId) url.searchParams.set('regionId', regionId);
      if (routeId) url.searchParams.set('routeId', routeId);
      url.searchParams.set('page', String(page));
      url.searchParams.set('limit', String(limit));
      if (dateRange?.from) url.searchParams.set('from', dateRange.from);
      if (dateRange?.to) url.searchParams.set('to', dateRange.to);
      const res = await fetch(url.toString(), { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to fetch schedules');
      return res.json();
    },
    placeholderData: keepPreviousData,
  });

  const schedules = ((data as any)?.schedules || []) as any[];
  const total = (data as any)?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const handleAddSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.routeId || !formData.busId) {
      alert('Please select both a route and a bus');
      return;
    }
    setActionLoading(true);
    try {
      const route = routes.find(r => r.id === formData.routeId);
      const scheduleData = {
        ...formData,
        departureDateTime: new Date(formData.departureDateTime),
        arrivalDateTime: new Date(formData.arrivalDateTime),
        departureLocation: route?.origin,
        arrivalLocation: route?.destination,
        companyId: companyId || route?.companyId || '',
      };
      const result = await dbActions.createSchedule(scheduleData);
      if (result.success) {
        setShowAddModal(false);
        setFormData(initialFormState);
        refetch();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to create schedule');
    } finally {
      setActionLoading(false);
    }
  }, [formData, routes, companyId, refetch]);

  const handleEditSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchedule) return;
    setActionLoading(true);
    try {
      const route = routes.find(r => r.id === formData.routeId);
      const updatedData = {
        ...formData,
        departureDateTime: new Date(formData.departureDateTime),
        arrivalDateTime: new Date(formData.arrivalDateTime),
        departureLocation: route?.origin,
        arrivalLocation: route?.destination,
      };
      const result = await dbActions.updateSchedule(selectedSchedule.id, updatedData);
      if (result.success) {
        setShowEditModal(false);
        setSelectedSchedule(null);
        setFormData(initialFormState);
        refetch();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update schedule');
    } finally {
      setActionLoading(false);
    }
  }, [formData, routes, selectedSchedule, refetch]);

  const handleDelete = useCallback(async (scheduleId: string) => {
    if (!window.confirm('Are you sure you want to delete this schedule?')) return;
    setActionLoading(true);
    try {
      const result = await dbActions.deleteSchedule(scheduleId);
      if (result.success) {
        setDeleteConfirm(null);
        refetch();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete schedule');
    } finally {
      setActionLoading(false);
    }
  }, [refetch]);

  const handleEditClick = (s: any) => {
    setSelectedSchedule(s);
    setFormData({
      routeId: s.routeId,
      busId: s.busId,
      departureDateTime: fmtDateTimeInput(toDate(s.departureDateTime)),
      arrivalDateTime: fmtDateTimeInput(toDate(s.arrivalDateTime)),
      price: s.price,
      availableSeats: s.availableSeats,
    });
    setShowEditModal(true);
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-12"><Loader2 className="w-10 h-10 text-gray-400 animate-spin" /></div>
  );

  return (
    <div className="space-y-4">
      {/* Header with Add button */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900">Schedules</h3>
        <Button
          type="button"
          variant="secondary"
          className="inline-flex items-center gap-2 text-sm font-bold"
          onClick={() => { setShowAddModal(true); setFormData(initialFormState); }}
        >
          <Plus className="w-4 h-4" /> Add Schedule
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-auto bg-white rounded-xl border border-gray-100">
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">Schedule</th>
              <th className="px-4 py-3 text-left">Departure</th>
              <th className="px-4 py-3 text-left">Bus</th>
              <th className="px-4 py-3 text-left">Price</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {schedules.map(s => (
              <tr key={s.id} onClick={() => setSchedule(s.id)} className={`hover:bg-gray-50 cursor-pointer transition-colors ${scheduleId === s.id ? 'bg-indigo-50' : ''}`}>
                <td className="px-4 py-3">{s.route ? `${s.route.origin} → ${s.route.destination}` : s.routeId}</td>
                <td className="px-4 py-3">{s.departureDateTime ? new Date(s.departureDateTime).toLocaleString() : '—'}</td>
                <td className="px-4 py-3">{s.bus?.licensePlate || s.busId}</td>
                <td className="px-4 py-3">MWK {s.price?.toLocaleString() || 0}</td>
                <td className="px-4 py-3 text-center">
                  <div className="inline-flex gap-1" onClick={e => e.stopPropagation()}>
                        <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="p-2 text-blue-600 rounded-lg hover:bg-blue-100"
                      onClick={() => handleEditClick(s)}
                      disabled={actionLoading}
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="p-2 text-red-600 rounded-lg hover:bg-red-100"
                      onClick={() => handleDelete(s.id)}
                      disabled={actionLoading}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" className="px-3" onClick={() => setPage(Math.max(1, page - 1))}>
            Prev
          </Button>
          <Button type="button" variant="outline" size="sm" className="px-3" onClick={() => setPage(Math.min(totalPages, page + 1))}>
            Next
          </Button>
        </div>
      </div>

      {schedules.length === 0 && <p className="text-sm text-gray-500">No schedules found.</p>}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Add Schedule</h2>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Route</label>
                <select value={formData.routeId} onChange={handleRouteChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                  <option value="">Select Route</option>
                  {routes.map(r => <option key={r.id} value={r.id}>{r.origin} → {r.destination}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Bus</label>
                <select value={formData.busId} onChange={handleBusChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                  <option value="">Select Bus</option>
                  {buses.map(b => <option key={b.id} value={b.id}>{b.registration || b.licensePlate}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Departure</label>
                  <input type="datetime-local" value={formData.departureDateTime} onChange={e => setFormData(prev => ({ ...prev, departureDateTime: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Arrival</label>
                  <input type="datetime-local" value={formData.arrivalDateTime} onChange={e => setFormData(prev => ({ ...prev, arrivalDateTime: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Price</label>
                  <input type="number" value={formData.price} onChange={e => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Available Seats</label>
                  <input type="number" value={formData.availableSeats} onChange={e => setFormData(prev => ({ ...prev, availableSeats: parseInt(e.target.value) }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" isLoading={actionLoading}>
                  Create
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedSchedule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Edit Schedule</h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Route</label>
                <select value={formData.routeId} onChange={handleRouteChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                  <option value="">Select Route</option>
                  {routes.map(r => <option key={r.id} value={r.id}>{r.origin} → {r.destination}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Bus</label>
                <select value={formData.busId} onChange={handleBusChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                  <option value="">Select Bus</option>
                  {buses.map(b => <option key={b.id} value={b.id}>{b.registration || b.licensePlate}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Departure</label>
                  <input type="datetime-local" value={formData.departureDateTime} onChange={e => setFormData(prev => ({ ...prev, departureDateTime: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Arrival</label>
                  <input type="datetime-local" value={formData.arrivalDateTime} onChange={e => setFormData(prev => ({ ...prev, arrivalDateTime: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Price</label>
                  <input type="number" value={formData.price} onChange={e => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Available Seats</label>
                  <input type="number" value={formData.availableSeats} onChange={e => setFormData(prev => ({ ...prev, availableSeats: parseInt(e.target.value) }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowEditModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" isLoading={actionLoading}>
                  Update
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
