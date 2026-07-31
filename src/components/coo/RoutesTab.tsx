"use client";

import React, { useState, useCallback, useMemo, FC } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import useFilterStore from '@/lib/stores/filterStore';
import * as dbActions from '@/lib/actions/db.actions';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Edit3, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { RouteStop } from '@/types';

type Props = { companyId?: string };

const generateStopId = (): string =>
  `stop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

const createEmptyStop = (order: number): RouteStop => ({
  id: generateStopId(),
  name: "",
  distanceFromOrigin: 0,
  order,
});

const resequence = (stops: RouteStop[]): RouteStop[] => stops.map((s, idx) => ({ ...s, order: idx }));

// ─── Intermediate Stops Editor Component ─────────────────────────────────────
interface StopsEditorProps {
  stops: RouteStop[];
  onChange: (stops: RouteStop[]) => void;
}

const StopsEditor: FC<StopsEditorProps> = ({ stops, onChange }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const sorted = useMemo(() => [...stops].sort((a, b) => a.order - b.order), [stops]);

  const handleAddStop = () => {
    const stop = createEmptyStop(stops.length);
    onChange([...stops, stop]);
    setExpandedId(null);
  };

  const handleRemoveStop = (id: string) => {
    onChange(resequence(stops.filter((s) => s.id !== id)));
  };

  const handleUpdateStop = (id: string, patch: Partial<RouteStop>) => {
    onChange(stops.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const handleMoveStop = (id: string, direction: -1 | 1) => {
    const idx = sorted.findIndex((s) => s.id === id);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= sorted.length) return;
    const next = [...sorted];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    onChange(resequence(next));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
          Intermediate Stops &amp; Pick-up Points ({stops.length})
        </label>
        <button
          type="button"
          onClick={handleAddStop}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-lg text-xs font-bold transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add Stop
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="text-xs text-gray-400 italic bg-gray-50 p-3 rounded-lg border border-dashed text-center">
          Direct Express Route — No intermediate pick-up stops added yet.
        </p>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {sorted.map((stop, idx) => (
            <div key={stop.id} className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-gray-400 w-5">#{idx + 1}</span>
                <input
                  type="text"
                  value={stop.name}
                  onChange={(e) => handleUpdateStop(stop.id, { name: e.target.value })}
                  placeholder="Stop name (e.g. Dedza)"
                  className="flex-1 min-w-[120px] px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-600 outline-none"
                  required
                />
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={stop.distanceFromOrigin}
                  onChange={(e) => handleUpdateStop(stop.id, { distanceFromOrigin: parseFloat(e.target.value) || 0 })}
                  placeholder="km from start"
                  className="w-24 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-600 outline-none"
                  required
                />
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleMoveStop(stop.id, -1)}
                    disabled={idx === 0}
                    className="p-1 text-gray-400 hover:text-indigo-600 disabled:opacity-20"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveStop(stop.id, 1)}
                    disabled={idx === sorted.length - 1}
                    className="p-1 text-gray-400 hover:text-indigo-600 disabled:opacity-20"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedId(expandedId === stop.id ? null : stop.id)}
                    className="px-2 py-1 text-[10px] font-bold text-gray-500 hover:text-indigo-600"
                  >
                    {expandedId === stop.id ? "Hide" : "More"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveStop(stop.id)}
                    className="p-1 text-rose-500 hover:text-rose-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {expandedId === stop.id && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-gray-200">
                  <input
                    type="text"
                    value={stop.pickupPoint || ""}
                    onChange={(e) => handleUpdateStop(stop.id, { pickupPoint: e.target.value })}
                    placeholder="Pickup point / terminal name"
                    className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium"
                  />
                  <input
                    type="text"
                    value={stop.address || ""}
                    onChange={(e) => handleUpdateStop(stop.id, { address: e.target.value })}
                    placeholder="Address / landmark"
                    className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium"
                  />
                  <input
                    type="number"
                    min="0"
                    value={stop.estimatedArrival ?? ""}
                    onChange={(e) => handleUpdateStop(stop.id, { estimatedArrival: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                    placeholder="Est. arrival (mins from departure)"
                    className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium"
                  />
                  <input
                    type="tel"
                    value={stop.contactPhone || ""}
                    onChange={(e) => handleUpdateStop(stop.id, { contactPhone: e.target.value })}
                    placeholder="Station contact phone"
                    className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main RoutesTab Component ────────────────────────────────────────────────
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
    stops: [] as RouteStop[],
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
      const result = await dbActions.createRoute({ ...formData, companyId, regionId, stops: formData.stops as any });
      if (result.success) {
        setShowAddModal(false);
        setFormData({ origin: '', destination: '', baseFare: 0, distance: 0, stops: [] });
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
      const result = await dbActions.updateRoute(selectedRoute.id, { ...formData, stops: formData.stops as any });
      if (result.success) {
        setShowEditModal(false);
        setSelectedRoute(null);
        setFormData({ origin: '', destination: '', baseFare: 0, distance: 0, stops: [] });
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
      origin: r.origin || '',
      destination: r.destination || '',
      baseFare: r.baseFare || 0,
      distance: r.distance || 0,
      stops: Array.isArray(r.stops) ? r.stops : [],
    });
    setShowEditModal(true);
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-12"><Loader2 className="w-10 h-10 text-gray-400 animate-spin" /></div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900">Routes &amp; Pick-up Stops</h3>
        <Button type="button" variant="secondary" className="inline-flex items-center gap-2 text-sm font-bold" onClick={() => { setShowAddModal(true); setFormData({ origin: '', destination: '', baseFare: 0, distance: 0, stops: [] }); }}>
          <Plus className="w-4 h-4" /> Add Route
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {routes.map(r => (
          <div key={r.id} onClick={() => setRoute(r.id)} className={`p-4 text-left rounded-xl border cursor-pointer transition-colors ${routeId === r.id ? 'border-indigo-600 bg-indigo-50' : 'border-gray-100 bg-white hover:border-indigo-200'}`}>
            <p className="font-bold text-sm text-gray-900 truncate">{r.origin} → {r.destination}</p>
            <p className="text-xs text-gray-400 mt-1">{r.company?.name || r.companyId}</p>
            <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
              <span>Base fare: MWK {r.baseFare?.toLocaleString() || 0}</span>
              <span className="font-semibold text-indigo-600">{Array.isArray(r.stops) ? r.stops.length : 0} stops</span>
            </div>
            <div className="flex gap-1 mt-3" onClick={e => e.stopPropagation()}>
              <Button type="button" variant="ghost" size="sm" className="p-1.5 text-blue-600 rounded text-xs hover:bg-blue-100" onClick={() => handleEditClick(r)} disabled={actionLoading}>
                <Edit3 className="w-3.5 h-3.5" /> Edit
              </Button>
              <Button type="button" variant="ghost" size="sm" className="p-1.5 text-red-600 rounded text-xs hover:bg-red-100" onClick={() => handleDelete(r.id)} disabled={actionLoading}>
                <Trash2 className="w-3.5 h-3.5" /> Delete
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

      {/* Add Route Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-lg max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900">Add Route Corridor</h2>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Origin</label>
                  <input type="text" placeholder="e.g. Mzuzu" value={formData.origin} onChange={e => setFormData(prev => ({ ...prev, origin: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Destination</label>
                  <input type="text" placeholder="e.g. Blantyre" value={formData.destination} onChange={e => setFormData(prev => ({ ...prev, destination: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Base Fare (MWK)</label>
                  <input type="number" placeholder="Base fare" value={formData.baseFare} onChange={e => setFormData(prev => ({ ...prev, baseFare: parseFloat(e.target.value) || 0 }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Total Distance (km)</label>
                  <input type="number" placeholder="Distance" value={formData.distance} onChange={e => setFormData(prev => ({ ...prev, distance: parseFloat(e.target.value) || 0 }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold" required />
                </div>
              </div>

              {/* Intermediate Stops Editor */}
              <div className="pt-2 border-t border-gray-100">
                <StopsEditor stops={formData.stops} onChange={(newStops) => setFormData((prev) => ({ ...prev, stops: newStops }))} />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" isLoading={actionLoading}>
                  Create Route
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Route Modal */}
      {showEditModal && selectedRoute && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-lg max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900">Edit Route Corridor</h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Origin</label>
                  <input type="text" placeholder="Origin" value={formData.origin} onChange={e => setFormData(prev => ({ ...prev, origin: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Destination</label>
                  <input type="text" placeholder="Destination" value={formData.destination} onChange={e => setFormData(prev => ({ ...prev, destination: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Base Fare (MWK)</label>
                  <input type="number" placeholder="Base Fare" value={formData.baseFare} onChange={e => setFormData(prev => ({ ...prev, baseFare: parseFloat(e.target.value) || 0 }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Total Distance (km)</label>
                  <input type="number" placeholder="Distance" value={formData.distance} onChange={e => setFormData(prev => ({ ...prev, distance: parseFloat(e.target.value) || 0 }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold" required />
                </div>
              </div>

              {/* Intermediate Stops Editor */}
              <div className="pt-2 border-t border-gray-100">
                <StopsEditor stops={formData.stops} onChange={(newStops) => setFormData((prev) => ({ ...prev, stops: newStops }))} />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowEditModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" isLoading={actionLoading}>
                  Update Route
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
