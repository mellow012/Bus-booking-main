"use client";

import React, { useState, useCallback } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import useFilterStore from '@/lib/stores/filterStore';
import * as dbActions from '@/lib/actions/db.actions';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Edit3, Trash2 } from 'lucide-react';

type Props = { companyId?: string };

export default function RoutesTab({ companyId }: Props) {
  const { regionId, routeId, setRoute, dateRange } = useFilterStore();
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const limit = 12;

  const [formData, setFormData] = useState({
    origin: '',
    destination: '',
    baseFare: 0,
    distance: 0,
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['cooRoutes', { companyId, regionId, page, limit, dateRange }],
    queryFn: async () => {
      const url = new URL('/api/admin/coo/routes', window.location.origin);
      if (companyId) url.searchParams.set('companyId', companyId);
      if (regionId) url.searchParams.set('regionId', regionId);
      url.searchParams.set('page', String(page));
      url.searchParams.set('limit', String(limit));
      if (dateRange?.from) url.searchParams.set('from', dateRange.from);
      if (dateRange?.to) url.searchParams.set('to', dateRange.to);
      const res = await fetch(url.toString(), { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to fetch routes');
      return res.json();
    },
    placeholderData: keepPreviousData,
  });

  const routes = ((data as any)?.routes || []) as any[];
  const total = (data as any)?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const handleAddSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.origin || !formData.destination) { alert('Origin and destination are required'); return; }
    setActionLoading(true);
    try {
      const result = await dbActions.createRoute({ ...formData, companyId, regionId });
      if (result.success) {
        setShowAddModal(false);
        setFormData({ origin: '', destination: '', baseFare: 0, distance: 0 });
        refetch();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to create route');
    } finally {
      setActionLoading(false);
    }
  }, [formData, companyId, regionId, refetch]);

  const handleEditSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoute) return;
    setActionLoading(true);
    try {
      const result = await dbActions.updateRoute(selectedRoute.id, formData);
      if (result.success) {
        setShowEditModal(false);
        setSelectedRoute(null);
        setFormData({ origin: '', destination: '', baseFare: 0, distance: 0 });
        refetch();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update route');
    } finally {
      setActionLoading(false);
    }
  }, [formData, selectedRoute, refetch]);

  const handleDelete = useCallback(async (routeId: string) => {
    if (!window.confirm('Are you sure you want to delete this route?')) return;
    setActionLoading(true);
    try {
      const result = await dbActions.deleteRoute(routeId);
      if (result.success) {
        refetch();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete route');
    } finally {
      setActionLoading(false);
    }
  }, [refetch]);

  const handleEditClick = (r: any) => {
    setSelectedRoute(r);
    setFormData({
      origin: r.origin,
      destination: r.destination,
      baseFare: r.baseFare || 0,
      distance: r.distance || 0,
    });
    setShowEditModal(true);
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-12"><Loader2 className="w-10 h-10 text-gray-400 animate-spin" /></div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900">Routes</h3>
        <Button type="button" variant="secondary" className="inline-flex items-center gap-2 text-sm font-bold" onClick={() => { setShowAddModal(true); setFormData({ origin: '', destination: '', baseFare: 0, distance: 0 }); }}>
          <Plus className="w-4 h-4" /> Add Route
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {routes.map(r => (
          <div key={r.id} onClick={() => setRoute(r.id)} className={`p-4 text-left rounded-xl border cursor-pointer transition-colors ${routeId === r.id ? 'border-indigo-600 bg-indigo-50' : 'border-gray-100 bg-white hover:border-indigo-200'}`}>
            <p className="font-bold text-sm text-gray-900 truncate">{r.origin} → {r.destination}</p>
            <p className="text-xs text-gray-400 mt-1">{r.company?.name || r.companyId}</p>
            <p className="text-xs text-gray-500 mt-2">Base fare: MWK {r.baseFare?.toLocaleString() || 0}</p>
            <div className="flex gap-1 mt-3" onClick={e => e.stopPropagation()}>
              <Button type="button" variant="ghost" size="sm" className="p-1.5 text-blue-600 rounded text-xs hover:bg-blue-100" onClick={() => handleEditClick(r)} disabled={actionLoading}>
                <Edit3 className="w-3.5 h-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="sm" className="p-1.5 text-red-600 rounded text-xs hover:bg-red-100" onClick={() => handleDelete(r.id)} disabled={actionLoading}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

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

      {routes.length === 0 && <p className="text-sm text-gray-500">No routes found.</p>}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Add Route</h2>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <input type="text" placeholder="Origin" value={formData.origin} onChange={e => setFormData(prev => ({ ...prev, origin: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              <input type="text" placeholder="Destination" value={formData.destination} onChange={e => setFormData(prev => ({ ...prev, destination: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              <input type="number" placeholder="Base Fare (MWK)" value={formData.baseFare} onChange={e => setFormData(prev => ({ ...prev, baseFare: parseFloat(e.target.value) }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              <input type="number" placeholder="Distance (km)" value={formData.distance} onChange={e => setFormData(prev => ({ ...prev, distance: parseFloat(e.target.value) }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
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

      {showEditModal && selectedRoute && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Edit Route</h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <input type="text" placeholder="Origin" value={formData.origin} onChange={e => setFormData(prev => ({ ...prev, origin: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              <input type="text" placeholder="Destination" value={formData.destination} onChange={e => setFormData(prev => ({ ...prev, destination: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              <input type="number" placeholder="Base Fare (MWK)" value={formData.baseFare} onChange={e => setFormData(prev => ({ ...prev, baseFare: parseFloat(e.target.value) }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              <input type="number" placeholder="Distance (km)" value={formData.distance} onChange={e => setFormData(prev => ({ ...prev, distance: parseFloat(e.target.value) }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
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
