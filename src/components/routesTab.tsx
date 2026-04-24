"use client";

import { FC, useState, useMemo } from "react";
import { Plus, Edit3, Trash2, Search, MapPin, Navigation, Clock, CreditCard, Sparkles, Zap, ChevronRight, Activity, Map, ArrowRight } from "lucide-react";
import * as dbActions from "@/lib/actions/db.actions";
import Modal from "@/components/Modals";
import { Button } from "@/components/ui/button";
import { Route } from "@/types";

interface RoutesTabProps {
  routes: Route[];
  setRoutes: React.Dispatch<React.SetStateAction<Route[]>>;
  companyId: string;
  setError: (msg: string) => void;
  setSuccess: (msg: string) => void;
}

const RoutesTab: FC<RoutesTabProps> = ({ routes, setRoutes, companyId, setError, setSuccess }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editRoute, setEditRoute] = useState<Route | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const [newRoute, setNewRoute] = useState({
    origin: "",
    destination: "",
    baseFare: 0,
    duration: 0,
    stops: [] as { id: string; name: string; distanceFromOrigin: number; order: number }[],
    isActive: true,
  });

  const filteredRoutes = useMemo(() =>
    routes.filter(r =>
      r.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.destination.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [routes, searchTerm]
  );

  const stats = useMemo(() => ({
    total: routes.length,
    active: routes.filter(r => r.status === 'active' || r.isActive).length,
    avgPrice: routes.length > 0 ? Math.round(routes.reduce((s, r) => s + (r.baseFare || 0), 0) / routes.length) : 0,
    totalStops: routes.reduce((s, r) => s + (r.stops?.length || 0), 0)
  }), [routes]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const routeData = { ...newRoute, companyId, status: 'active' as const };
      const result = await dbActions.createRoute(routeData);
      if (!result.success) throw new Error(result.error);
      setRoutes([...routes, result.data as Route]);
      setShowAddModal(false);
      setNewRoute({ origin: "", destination: "", baseFare: 0, duration: 0, stops: [], isActive: true });
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
      setRoutes(routes.map(r => r.id === editRoute.id ? result.data as Route : r));
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
          <div key={i} className="bg-white rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-6 shadow-sm border border-gray-100 relative overflow-hidden group text-left">
            <div className={`p-3 rounded-2xl ${s.bg} w-fit mb-4 group-hover:scale-110 transition-transform`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{s.label}</p>
            <p className="text-xl sm:text-2xl font-black text-gray-900 leading-tight">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 sm:p-6">
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
            className="w-full lg:w-auto bg-indigo-600 text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Corridor
          </button>
        </div>
      </div>

      {/* Routes Grid */}
      {filteredRoutes.length === 0 ? (
        <div className="bg-white rounded-[2.5rem] border border-gray-100 p-16 sm:p-24 text-center">
           <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
             <Navigation className="w-8 h-8 text-gray-200" />
           </div>
           <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-2">No Corridors Found</h3>
           <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest max-w-xs mx-auto">Define your transit network to begin scheduling fleet operations.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8">
          {filteredRoutes.map(route => (
            <div key={route.id} className="bg-white rounded-[2rem] sm:rounded-[2.5rem] border border-gray-100 overflow-hidden flex flex-col hover:shadow-2xl transition-all duration-500 group relative text-left">
              <div className="absolute top-6 right-6">
                <span className={`px-3 py-1.5 text-[9px] font-black rounded-xl uppercase tracking-widest border shadow-sm ${
                  route.isActive || route.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-gray-50 text-gray-400 border-gray-100'
                }`}>
                  {route.status || (route.isActive ? 'Active' : 'Inactive')}
                </span>
              </div>

              <div className="p-6 sm:p-8 flex-1 flex flex-col">
                <div className="mb-8">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Main Corridor</p>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight uppercase leading-tight group-hover:text-indigo-600 transition-colors">
                    {route.origin} <span className="text-gray-300 mx-1">→</span> {route.destination}
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-8">
                  <div>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Starting Yield</p>
                    <p className="text-lg font-black text-gray-900 tracking-tight">MWK {fmt(route.baseFare || 0)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Est. Duration</p>
                    <p className="text-lg font-black text-gray-900 tracking-tight">{route.duration}m</p>
                  </div>
                </div>

                <div className="bg-gray-50/50 rounded-2xl p-4 sm:p-6 mb-8 border border-gray-50">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-4">Intermediate Transit Points ({route.stops?.length || 0})</p>
                  {route.stops && route.stops.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {route.stops.map((stop: any, idx: number) => (
                        <span key={idx} className="bg-white px-2.5 py-1 rounded-lg text-[10px] font-bold text-gray-600 border border-gray-100 shadow-sm">
                          {stop.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] font-bold text-gray-300 uppercase italic">Direct Express Only</p>
                  )}
                </div>

                <div className="mt-auto pt-6 border-t border-gray-50 flex gap-2">
                   <button
                     onClick={() => { setEditRoute(route); setShowEditModal(true); }}
                     className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 bg-gray-50 text-gray-700 hover:bg-indigo-600 hover:text-white rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest border border-gray-100"
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Origin Hub</label>
              <input
                type="text"
                value={newRoute.origin}
                onChange={e => setNewRoute({ ...newRoute, origin: e.target.value })}
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold"
                placeholder="e.g., Lilongwe"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Destination Terminal</label>
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
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Base Equity (MWK)</label>
              <input
                type="number"
                value={newRoute.baseFare}
                onChange={e => setNewRoute({ ...newRoute, baseFare: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Est. Duration (Minutes)</label>
              <input
                type="number"
                value={newRoute.duration}
                onChange={e => setNewRoute({ ...newRoute, duration: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold"
                placeholder="e.g., 270"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-8 border-t border-gray-50">
            <button type="button" onClick={() => setShowAddModal(false)} className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors">Cancel</button>
            <button
              type="submit"
              disabled={actionLoading}
              className="bg-indigo-600 text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
            >
              {actionLoading ? 'Initializing...' : 'Confirm Corridor'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

const fmt = (n: number) => n.toLocaleString();

export default RoutesTab;
