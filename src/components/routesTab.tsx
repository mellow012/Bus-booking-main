"use client";

import { FC, useState, useMemo, useEffect } from "react";
import { Plus, Edit3, Trash2, Search, MapPin, Navigation, Clock, CreditCard, Sparkles, Zap, ChevronRight, ChevronUp, ChevronDown, Activity, Map, ArrowRight, Globe, Bus as BusIcon } from "lucide-react";
import * as dbActions from "@/lib/actions/db.actions";
import Modal from "@/components/Modals";
import { Button } from "@/components/ui/button";
import { Route, RouteStop, Bus } from "@/types";

interface CompanyRegion {
  id: string;
  name: string;
  isActive: boolean;
}

interface RoutesTabProps {
  routes: Route[];
  setRoutes: React.Dispatch<React.SetStateAction<Route[]>>;
  buses: Bus[];
  companyId: string;
  setError: (msg: string) => void;
  setSuccess: (msg: string) => void;
}

// ─── Stop helpers ───────────────────────────────────────────────────────────

const generateStopId = () => `stop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createEmptyStop = (order: number): RouteStop => ({
  id: generateStopId(),
  name: "",
  distanceFromOrigin: 0,
  order,
});

const resequence = (stops: RouteStop[]): RouteStop[] => stops.map((s, idx) => ({ ...s, order: idx }));

// ─── Stops editor ───────────────────────────────────────────────────────────

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
    onChange(resequence(stops.filter(s => s.id !== id)));
  };

  const handleUpdateStop = (id: string, patch: Partial<RouteStop>) => {
    onChange(stops.map(s => (s.id === id ? { ...s, ...patch } : s)));
  };

  const handleMoveStop = (id: string, direction: -1 | 1) => {
    const idx = sorted.findIndex(s => s.id === id);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= sorted.length) return;
    const next = [...sorted];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    onChange(resequence(next));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          Intermediate Transit Points ({stops.length})
        </label>
        <button
          type="button"
          onClick={handleAddStop}
          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all"
        >
          <Plus className="w-3 h-3" /> Add Stop
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="text-[10px] font-bold text-gray-300 uppercase italic">Direct Express — no intermediate stops</p>
      ) : (
        <div className="space-y-3">
          {sorted.map((stop, idx) => (
            <div key={stop.id} className="bg-gray-50/50 border border-gray-100 rounded-2xl p-3 sm:p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[9px] font-bold text-gray-400 w-5 shrink-0">#{idx + 1}</span>
                <input
                  type="text"
                  value={stop.name}
                  onChange={e => handleUpdateStop(stop.id, { name: e.target.value })}
                  placeholder="Stop name, e.g. Dedza"
                  className="flex-1 min-w-[140px] px-3 py-2 bg-white border border-gray-100 rounded-xl text-[12px] font-bold outline-none focus:ring-2 focus:ring-indigo-600"
                  required
                />
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={stop.distanceFromOrigin}
                  onChange={e => handleUpdateStop(stop.id, { distanceFromOrigin: parseFloat(e.target.value) || 0 })}
                  placeholder="km"
                  className="w-20 px-3 py-2 bg-white border border-gray-100 rounded-xl text-[12px] font-bold outline-none focus:ring-2 focus:ring-indigo-600"
                  required
                />
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleMoveStop(stop.id, -1)}
                    disabled={idx === 0}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-white hover:text-indigo-600 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveStop(stop.id, 1)}
                    disabled={idx === sorted.length - 1}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-white hover:text-indigo-600 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedId(expandedId === stop.id ? null : stop.id)}
                    className="px-2 py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-widest text-gray-400 hover:text-indigo-600 transition-all whitespace-nowrap"
                  >
                    {expandedId === stop.id ? "Hide" : "More"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveStop(stop.id)}
                    className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {expandedId === stop.id && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3 pt-3 border-t border-gray-100">
                  <input
                    type="text"
                    value={stop.pickupPoint || ""}
                    onChange={e => handleUpdateStop(stop.id, { pickupPoint: e.target.value })}
                    placeholder="Pickup point / terminal"
                    className="px-3 py-2 bg-white border border-gray-100 rounded-xl text-[11px] font-bold outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                  <input
                    type="text"
                    value={stop.address || ""}
                    onChange={e => handleUpdateStop(stop.id, { address: e.target.value })}
                    placeholder="Address"
                    className="px-3 py-2 bg-white border border-gray-100 rounded-xl text-[11px] font-bold outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                  <input
                    type="number"
                    min="0"
                    value={stop.estimatedArrival ?? ""}
                    onChange={e => handleUpdateStop(stop.id, { estimatedArrival: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="Est. arrival (min from departure)"
                    className="px-3 py-2 bg-white border border-gray-100 rounded-xl text-[11px] font-bold outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                  <input
                    type="text"
                    value={stop.contactPerson || ""}
                    onChange={e => handleUpdateStop(stop.id, { contactPerson: e.target.value })}
                    placeholder="Contact person"
                    className="px-3 py-2 bg-white border border-gray-100 rounded-xl text-[11px] font-bold outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                  <input
                    type="tel"
                    value={stop.contactPhone || ""}
                    onChange={e => handleUpdateStop(stop.id, { contactPhone: e.target.value })}
                    placeholder="Contact phone"
                    className="px-3 py-2 bg-white border border-gray-100 rounded-xl text-[11px] font-bold outline-none focus:ring-2 focus:ring-indigo-600"
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

// ─── Bus picker ─────────────────────────────────────────────────────────────

interface BusPickerProps {
  buses: Bus[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

const BusPicker: FC<BusPickerProps> = ({ buses, selectedIds, onChange }) => {
  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  };

  const totalCapacity = useMemo(
    () => (buses || []).filter(b => selectedIds.includes(b.id)).reduce((s, b) => s + (b.capacity || 0), 0),
    [buses, selectedIds]
  );

  if (!buses || buses.length === 0) {
    return <p className="text-[10px] font-bold text-gray-300 uppercase italic">No active fleet vehicles found for this company.</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Assigned Fleet</label>
        {selectedIds.length > 0 && (
          <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">
            {selectedIds.length} bus{selectedIds.length > 1 ? "es" : ""} · {totalCapacity} seats
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
        {buses.map(bus => {
          const checked = selectedIds.includes(bus.id);
          return (
            <label
              key={bus.id}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${
                checked ? "bg-indigo-50 border-indigo-200" : "bg-gray-50 border-gray-100"
              }`}
            >
              <input type="checkbox" checked={checked} onChange={() => toggle(bus.id)} className="accent-indigo-600" />
              <span className="flex-1 text-[11px] font-bold text-gray-700 truncate">{bus.licensePlate}</span>
              <span className="text-[9px] font-bold text-gray-400 uppercase whitespace-nowrap">
                {bus.busType} · {bus.capacity} seats{bus.status !== "active" ? ` · ${bus.status}` : ""}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
};

// ─── Main tab ───────────────────────────────────────────────────────────────

const RoutesTab: FC<RoutesTabProps> = ({ routes, setRoutes, companyId, setError, setSuccess, buses }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editRoute, setEditRoute] = useState<Route | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [regions, setRegions] = useState<CompanyRegion[]>([]);

  useEffect(() => {
    if (!companyId) return;
    fetch(`/api/admin/coo/regions?companyId=${companyId}&limit=100`, { credentials: "same-origin" })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data?.regions) setRegions(data.regions.filter((r: CompanyRegion) => r.isActive));
      })
      .catch(() => {});
  }, [companyId]);

  const fleetCapacity = (busIds?: string[]) =>
    buses.filter(b => busIds?.includes(b.id)).reduce((s, b) => s + (b.capacity || 0), 0);

  const [newRoute, setNewRoute] = useState({
    name: "",
    origin: "",
    destination: "",
    distance: 0,
    baseFare: 0,
    pricePerKm: undefined as number | undefined,
    duration: 0,
    stops: [] as RouteStop[],
    isActive: true,
    regionId: undefined as string | undefined,
    associatedBusIds: [] as string[],
  });

  const resetNewRoute = () =>
    setNewRoute({
      name: "",
      origin: "",
      destination: "",
      distance: 0,
      baseFare: 0,
      pricePerKm: undefined,
      duration: 0,
      stops: [],
      isActive: true,
      regionId: undefined,
      associatedBusIds: [],
    });

  const filteredRoutes = useMemo(
    () =>
      routes.filter(
        r =>
          r.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (r.name || "").toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [routes, searchTerm]
  );

  const stats = useMemo(
    () => ({
      total: routes.length,
      active: routes.filter(r => r.status === "active" || r.isActive).length,
      avgPrice: routes.length > 0 ? Math.round(routes.reduce((s, r) => s + (r.baseFare || 0), 0) / routes.length) : 0,
      totalStops: routes.reduce((s, r) => s + (r.stops?.length || 0), 0),
    }),
    [routes]
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const routeData = { 
        ...newRoute, 
        name: newRoute.name.trim() || `${newRoute.origin} - ${newRoute.destination}`,
        companyId, 
        status: "active" as const 
      };
      const result = await dbActions.createRoute(routeData);
      if (!result.success) throw new Error(result.error);
      setRoutes([...routes, result.data as Route]);
      setShowAddModal(false);
      resetNewRoute();
      setSuccess("Route created successfully!");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRoute) return;
    setActionLoading(true);
    try {
      const result = await dbActions.updateRoute(editRoute.id, { ...editRoute, updatedAt: new Date() });
      if (!result.success) throw new Error(result.error);
      setRoutes(routes.map(r => (r.id === editRoute.id ? (result.data as Route) : r)));
      setShowEditModal(false);
      setSuccess("Route updated!");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Archive this route corridor?")) return;
    setActionLoading(true);
    try {
      const result = await dbActions.deleteRoute(id);
      if (!result.success) throw new Error(result.error);
      setRoutes(routes.filter(r => r.id !== id));
      setSuccess("Route corridor archived.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 px-2 sm:px-0">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {[
          { label: "Active Corridors", value: stats.active, icon: Navigation, bg: "bg-indigo-50", color: "text-indigo-600" },
          { label: "Total Network", value: stats.total, icon: Map, bg: "bg-emerald-50", color: "text-emerald-600" },
          { label: "Transit Points", value: stats.totalStops, icon: MapPin, bg: "bg-amber-50", color: "text-amber-600" },
          { label: "Avg Yield", value: `MWK ${stats.avgPrice.toLocaleString()}`, icon: CreditCard, bg: "bg-rose-50", color: "text-rose-600" },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl sm:rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-100 relative overflow-hidden group text-left">
            <div className={`p-3 rounded-2xl ${s.bg} w-fit mb-4 group-hover:scale-110 transition-transform`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{s.label}</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search origin, destination, or corridors..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 sm:py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-[13px] font-bold text-gray-700"
            />
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="w-full lg:w-auto bg-indigo-600 text-white px-8 py-4 rounded-2xl text-[11px] font-bold uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Corridor
          </button>
        </div>
      </div>

      {/* Routes Grid */}
      {filteredRoutes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 sm:p-24 text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Navigation className="w-8 h-8 text-gray-200" />
          </div>
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-2">No Corridors Found</h3>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest max-w-xs mx-auto">Define your transit network to begin scheduling fleet operations.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8">
          {filteredRoutes.map(route => (
            <div key={route.id} className="bg-white rounded-2xl sm:rounded-2xl border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition-all duration-500 group relative text-left">
              <div className="absolute top-6 right-6">
                <span
                  className={`px-3 py-1.5 text-[9px] font-bold rounded-xl uppercase tracking-widest border shadow-sm ${
                    route.isActive || route.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-gray-50 text-gray-400 border-gray-100"
                  }`}
                >
                  {route.status || (route.isActive ? "Active" : "Inactive")}
                </span>
              </div>

              <div className="p-6 sm:p-8 flex-1 flex flex-col">
                <div className="mb-8">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                    <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">
                      {regions.find(r => r.id === route.regionId)?.name || "Unassigned Branch"}
                    </p>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight uppercase leading-tight group-hover:text-indigo-600 transition-colors">
                    {route.origin} <span className="text-gray-300 mx-1">→</span> {route.destination}
                  </h3>
                  {route.name && <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{route.name}</p>}
                </div>

                <div className="grid grid-cols-3 gap-4 mb-8">
                  <div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Yield</p>
                    <p className="text-base font-bold text-gray-900 tracking-tight">MWK {fmt(route.baseFare || 0)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Distance</p>
                    <p className="text-base font-bold text-gray-900 tracking-tight">{route.distance ? `${fmt(route.distance)} km` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Duration</p>
                    <p className="text-base font-bold text-gray-900 tracking-tight">{route.duration}m</p>
                  </div>
                </div>

                <div className="bg-gray-50/50 rounded-2xl p-4 sm:p-6 mb-6 border border-gray-50">
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-4">Intermediate Transit Points ({route.stops?.length || 0})</p>
                  {route.stops && route.stops.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {[...route.stops]
                        .sort((a, b) => a.order - b.order)
                        .map((stop, idx) => (
                          <span key={stop.id || idx} className="bg-white px-2.5 py-1 rounded-lg text-[10px] font-bold text-gray-600 border border-gray-100 shadow-sm">
                            {stop.name}
                          </span>
                        ))}
                    </div>
                  ) : (
                    <p className="text-[10px] font-bold text-gray-300 uppercase italic">Direct Express Only</p>
                  )}
                </div>

                {route.associatedBusIds && route.associatedBusIds.length > 0 && (
                  <div className="flex items-center gap-2 mb-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    <BusIcon className="w-3.5 h-3.5 text-gray-300" />
                    {route.associatedBusIds.length} bus{route.associatedBusIds.length > 1 ? "es" : ""} assigned
                    {fleetCapacity(route.associatedBusIds) > 0 ? ` · ${fleetCapacity(route.associatedBusIds)} seats` : ""}
                  </div>
                )}

                <div className="mt-auto pt-6 border-t border-gray-50 flex gap-2">
                  <button
                    onClick={() => {
                      setEditRoute(route);
                      setShowEditModal(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 bg-gray-50 text-gray-700 hover:bg-indigo-600 hover:text-white rounded-2xl transition-all text-[10px] font-bold uppercase tracking-widest border border-gray-100"
                  >
                    <Edit3 className="w-4 h-4" /> Manage
                  </button>
                  <button
                    onClick={() => handleDelete(route.id)}
                    className="px-4 py-3.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-2xl transition-all border border-rose-100 active:scale-95"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Define New Corridor">
        <form onSubmit={handleAdd} className="space-y-4 sm:space-y-6 text-left p-1">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Route Name / Label</label>
            <input
              type="text"
              value={newRoute.name}
              onChange={e => setNewRoute({ ...newRoute, name: e.target.value.slice(0, 50) })}
              className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold"
              placeholder="e.g., Lilongwe Express"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Origin Branch</label>
              {regions.length > 0 ? (
                <select
                  value={newRoute.regionId || ""}
                  onChange={e => {
                    const region = regions.find(r => r.id === e.target.value);
                    setNewRoute({ ...newRoute, regionId: region?.id, origin: region?.name || "" });
                  }}
                  className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold appearance-none"
                  required
                >
                  <option value="" disabled>
                    Select branch…
                  </option>
                  {regions.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <input
                    type="text"
                    value={newRoute.origin}
                    onChange={e => setNewRoute({ ...newRoute, origin: e.target.value })}
                    className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold"
                    placeholder="e.g., Lilongwe"
                    required
                  />
                  <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mt-1.5">No active branches found — route won't be linked to a region.</p>
                </>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Destination Terminal</label>
              <input
                type="text"
                value={newRoute.destination}
                onChange={e => setNewRoute({ ...newRoute, destination: e.target.value })}
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold"
                placeholder="e.g., Blantyre"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Distance (KM)</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={newRoute.distance}
                onChange={e => setNewRoute({ ...newRoute, distance: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold"
                placeholder="e.g., 320"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Est. Duration (Minutes)</label>
              <input
                type="number"
                min="0"
                value={newRoute.duration}
                onChange={e => setNewRoute({ ...newRoute, duration: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold"
                placeholder="e.g., 270"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Base Fare (MWK)</label>
              <input
                type="number"
                min="0"
                value={newRoute.baseFare}
                onChange={e => setNewRoute({ ...newRoute, baseFare: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Price per KM (Optional)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={newRoute.pricePerKm ?? ""}
                onChange={e => setNewRoute({ ...newRoute, pricePerKm: e.target.value ? parseFloat(e.target.value) : undefined })}
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold"
                placeholder="Used to price intermediate stops"
              />
            </div>
          </div>

          <div className="bg-gray-50/30 rounded-2xl p-4 sm:p-5 border border-gray-50">
            <StopsEditor stops={newRoute.stops} onChange={stops => setNewRoute({ ...newRoute, stops })} />
          </div>

          <div className="bg-gray-50/30 rounded-2xl p-4 sm:p-5 border border-gray-50">
            <BusPicker buses={buses} selectedIds={newRoute.associatedBusIds} onChange={ids => setNewRoute({ ...newRoute, associatedBusIds: ids })} />
          </div>

          <div className="flex justify-end gap-3 pt-8 border-t border-gray-50">
            <button type="button" onClick={() => setShowAddModal(false)} className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="bg-indigo-600 text-white px-8 py-4 rounded-2xl text-[11px] font-bold uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {actionLoading ? "Initializing..." : "Confirm Corridor"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Update Corridor Architecture">
        <form onSubmit={handleEdit} className="space-y-4 sm:space-y-6 text-left p-1">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Route Name / Label</label>
            <input
              type="text"
              value={editRoute?.name || ""}
              onChange={e => setEditRoute(prev => (prev ? { ...prev, name: e.target.value } : null))}
              className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Origin Branch</label>
              {regions.length > 0 ? (
                <select
                  value={editRoute?.regionId || ""}
                  onChange={e => {
                    const region = regions.find(r => r.id === e.target.value);
                    setEditRoute(prev => (prev ? { ...prev, regionId: region?.id, origin: region?.name || prev.origin } : null));
                  }}
                  className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold appearance-none"
                  required
                >
                  <option value="" disabled>
                    Select branch…
                  </option>
                  {editRoute?.regionId && !regions.find(r => r.id === editRoute.regionId) && (
                    <option value={editRoute.regionId}>{editRoute.origin} (inactive branch)</option>
                  )}
                  {regions.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={editRoute?.origin || ""}
                  onChange={e => setEditRoute(prev => (prev ? { ...prev, origin: e.target.value } : null))}
                  className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold"
                  required
                />
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Destination Terminal</label>
              <input
                type="text"
                value={editRoute?.destination || ""}
                onChange={e => setEditRoute(prev => (prev ? { ...prev, destination: e.target.value } : null))}
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Distance (KM)</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={editRoute?.distance || 0}
                onChange={e => setEditRoute(prev => (prev ? { ...prev, distance: parseFloat(e.target.value) || 0 } : null))}
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Est. Duration (Min)</label>
              <input
                type="number"
                min="0"
                value={editRoute?.duration || 0}
                onChange={e => setEditRoute(prev => (prev ? { ...prev, duration: parseInt(e.target.value) || 0 } : null))}
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Operational Status</label>
              <select
                value={editRoute?.status || "active"}
                onChange={e => setEditRoute(prev => (prev ? { ...prev, status: e.target.value as "active" | "inactive" } : null))}
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold appearance-none"
                required
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Base Fare (MWK)</label>
              <input
                type="number"
                min="0"
                value={editRoute?.baseFare || 0}
                onChange={e => setEditRoute(prev => (prev ? { ...prev, baseFare: parseInt(e.target.value) || 0 } : null))}
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Price per KM (Optional)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={editRoute?.pricePerKm ?? ""}
                onChange={e => setEditRoute(prev => (prev ? { ...prev, pricePerKm: e.target.value ? parseFloat(e.target.value) : undefined } : null))}
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold"
                placeholder="Used to price intermediate stops"
              />
            </div>
          </div>

          <div className="bg-gray-50/30 rounded-2xl p-4 sm:p-5 border border-gray-50">
            <StopsEditor stops={editRoute?.stops || []} onChange={stops => setEditRoute(prev => (prev ? { ...prev, stops } : null))} />
          </div>

          <div className="bg-gray-50/30 rounded-2xl p-4 sm:p-5 border border-gray-50">
            <BusPicker
              buses={buses}
              selectedIds={editRoute?.associatedBusIds || []}
              onChange={ids => setEditRoute(prev => (prev ? { ...prev, associatedBusIds: ids } : null))}
            />
          </div>

          <div className="flex justify-end gap-3 pt-8 border-t border-gray-50">
            <button type="button" onClick={() => setShowEditModal(false)} className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors">
              Discard
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="bg-indigo-600 text-white px-8 py-4 rounded-2xl text-[11px] font-bold uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
            >
              {actionLoading ? "Syncing..." : "Update Network"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

const fmt = (n: number) => n.toLocaleString();

export default RoutesTab;