import { FC, useState, useMemo, useCallback, useEffect } from 'react';
import { supabase } from "@/lib/supabase";
import * as dbActions from "@/lib/actions/db.actions";
import { Route } from '@/types';
import Modal from './Modals';
import {
  Plus, Edit3, Trash2, Search, MapPin, Clock, Navigation,
  ArrowRight, MapPinned, Route as RouteIcon, CheckCircle, XCircle,
  DollarSign, Copy, Users, UserCircle, MapPinIcon, AlertCircle,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoutesTabProps {
  routes: Route[];
  setRoutes: React.Dispatch<React.SetStateAction<Route[]>>;
  companyId: string;
  addRoute: (data: any) => Promise<string | null>;
  setError: (msg: string) => void;
  setSuccess: (msg: string) => void;
}

interface Operator {
  id: string; // Native UUID
  firstName: string;
  lastName: string;
  email: string;
  region?: string;
  branch?: string;
  role: string;
  companyId: string;
  phoneNumber?: string;
  createdAt: Date;
  updatedAt: Date;
  passwordSet: boolean;
}

interface RouteOperator {
  operatorId: string;
  operatorName: string;
  operatorEmail: string;
  region: string;
  assignedAt: Date;
}

interface OperatorInfo {
  id: string; // Native UUID
  firstName: string;
  lastName: string;
  email: string;
  region?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Chunk an array into sub-arrays of at most `size` elements */
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

// FIX RT-3: exact normalised match instead of bidirectional .includes()
// "Lilongwe" no longer matches "New Lilongwe Branch"
function locationsMatch(a: string, b: string): boolean {
  return a.toLowerCase().trim() === b.toLowerCase().trim();
}

// ─── Component ────────────────────────────────────────────────────────────────

const RoutesTab: FC<RoutesTabProps> = ({
  routes, setRoutes, companyId, addRoute, setError, setSuccess,
}) => {
  const [showAddModal,          setShowAddModal]          = useState(false);
  const [showEditModal,         setShowEditModal]         = useState(false);
  const [showOperatorModal,     setShowOperatorModal]     = useState(false);
  // FIX RT-2: replace window.confirm with a Modal
  const [deleteConfirmId,       setDeleteConfirmId]       = useState<string | null>(null);
  const [editRoute,             setEditRoute]             = useState<Route | null>(null);
  const [selectedRouteForOps,   setSelectedRouteForOps]   = useState<Route | null>(null);
  const [searchTerm,            setSearchTerm]            = useState('');
  const [filterStatus,          setFilterStatus]          = useState<'all' | 'active' | 'inactive'>('all');
  const [actionLoading,         setActionLoading]         = useState(false);
  const [operators,             setOperators]             = useState<Operator[]>([]);
  const [loadingOperators,      setLoadingOperators]      = useState(false);
  const [operatorInfo,          setOperatorInfo]          = useState<Map<string, OperatorInfo>>(new Map());
  const [currentPage,           setCurrentPage]           = useState(1);
  const itemsPerPage = 6;

  const initialNewRoute: Omit<Route, 'id' | 'createdAt' | 'updatedAt'> = {
    name: '', origin: '', destination: '', distance: 0, duration: 0,
    stops: [], companyId, status: 'active', isActive: true,
    baseFare: 0, pricePerKm: 0, assignedOperators: [], assignedOperatorIds: [],
  };
  const [newRoute, setNewRoute] = useState(initialNewRoute);

  // ── Fetch operators ──────────────────────────────────────────────────────────

  const fetchOperators = useCallback(async () => {
    if (!companyId) return;
    setLoadingOperators(true);
    try {
      const { data, error } = await supabase
        .from('User')
        .select('*')
        .eq('companyId', companyId)
        .eq('role', 'operator');
        
      if (error) throw error;
      
      setOperators((data || []).map(d => ({
        ...d,
        createdAt: new Date(d.createdAt),
        updatedAt: new Date(d.updatedAt),
      })) as Operator[]);
    } catch (err: unknown) {
      setError('Failed to load operators');
    } finally {
      setLoadingOperators(false);
    }
  }, [companyId, setError]);

  useEffect(() => { fetchOperators(); }, [fetchOperators]);

  // FIX RT-1: batched operator detail fetch using where('uid','in',[...chunk])
  // instead of one getDocs() per UID in a sequential loop
  useEffect(() => {
    const allUids = Array.from(
      new Set(routes.flatMap(r => r.assignedOperatorIds ?? []))
    );
    if (!allUids.length) return;

    let cancelled = false;
    (async () => {
      const map = new Map<string, OperatorInfo>();
      const { data, error } = await supabase
        .from('User')
        .select('id, firstName, lastName, email, region')
        .in('id', allUids);
        
      if (!error && data) {
        data.forEach(d => {
          map.set(d.id, {
            id:        d.id,
            firstName: d.firstName || '',
            lastName:  d.lastName  || '',
            email:     d.email     || '',
            region:    d.region || undefined,
          });
        });
      }
      if (!cancelled) setOperatorInfo(new Map(map));
    })();

    return () => { cancelled = true; };
  }, [routes]);

  // ── Stats ────────────────────────────────────────────────────────────────────

  const stats = useMemo(() => ({
    total:         routes.length,
    active:        routes.filter(r => r.isActive).length,
    inactive:      routes.filter(r => !r.isActive).length,
    totalDistance: routes.reduce((s, r) => s + r.distance, 0),
    totalRevenue:  routes.reduce((s, r) => s + (r.baseFare || 0), 0),
    withOperators: routes.filter(r => (r.assignedOperatorIds || []).length > 0).length,
  }), [routes]);

  // FIX RT-3: exact match
  const canAssignOperator = useCallback((op: Operator, routeOrigin: string) => {
    const opLoc = op.region || op.branch;
    if (!opLoc) return false;
    return locationsMatch(opLoc, routeOrigin);
  }, []);

  // ── Filtered + paginated routes ───────────────────────────────────────────

  const filteredRoutes = useMemo(() => {
    let list = routes.filter(r =>
      r.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.stops ?? []).some(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    if (filterStatus !== 'all')
      list = list.filter(r => filterStatus === 'active' ? r.isActive : !r.isActive);
    return list;
  }, [routes, searchTerm, filterStatus]);

  const paginatedRoutes = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRoutes.slice(start, start + itemsPerPage);
  }, [filteredRoutes, currentPage]);

  const totalPages = Math.ceil(filteredRoutes.length / itemsPerPage);

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoute.name.trim())             { setError('Route name is required'); return; }
    if (newRoute.distance <= 0 || newRoute.duration <= 0) { setError('Distance and duration must be positive'); return; }
    if ((newRoute.baseFare || 0) <= 0)     { setError('Base fare must be greater than 0'); return; }
    if (routes.find(r => r.origin === newRoute.origin && r.destination === newRoute.destination))
      { setError('Route with same origin and destination already exists'); return; }

    setActionLoading(true);
    try {
      const result = await addRoute(newRoute);
      if (result) { setNewRoute(initialNewRoute); setShowAddModal(false); setSuccess('Route added!'); }
    } catch (err: unknown) { setError(`Failed to add route: ${(err as any).message}`); }
    finally { setActionLoading(false); }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRoute || !editRoute.name.trim() || editRoute.distance <= 0 || editRoute.duration <= 0)
      { setError('Please fill all required fields'); return; }
    setActionLoading(true);
    try {
      const updated = { ...editRoute, updatedAt: new Date() };
      const { success, error, data } = await dbActions.updateRoute(editRoute.id, updated);
      if (!success) throw new Error(error);
      const FinalUpdated = { ...updated, ...data } as unknown as Route;
      setRoutes(routes.map(r => r.id === editRoute.id ? FinalUpdated : r));
      setShowEditModal(false); setEditRoute(null); setSuccess('Route updated!');
    } catch (err: unknown) { setError(`Failed to update: ${(err as any).message}`); }
    finally { setActionLoading(false); }
  };

  // FIX RT-2: delete called after Modal confirm, no window.confirm
  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    setActionLoading(true);
    try {
      const { success, error } = await dbActions.deleteRoute(deleteConfirmId);
      if (!success) throw new Error(error);
      setRoutes(routes.filter(r => r.id !== deleteConfirmId));
      setSuccess('Route deleted!');
    } catch (err: unknown) { setError(`Failed to delete: ${(err as any).message}`); }
    finally { setActionLoading(false); setDeleteConfirmId(null); }
  };

  const handleDuplicate = (route: Route) => {
    setNewRoute({
      ...route,
      name:                `${route.name} (Return)`,
      origin:              route.destination,
      destination:         route.origin,
      stops:               [...(route.stops ?? [])].reverse(),
      assignedOperators:   [],
      assignedOperatorIds: [],
    } as any);
    setShowAddModal(true);
  };

  const handleManageOperators = (route: Route) => {
    setSelectedRouteForOps(route);
    setShowOperatorModal(true);
    if (!operators.length) fetchOperators();
  };

  const handleAssignOperator = async (op: Operator) => {
    if (!selectedRouteForOps) return;
    if (!op.id)                                        { setError('Operator missing ID'); return; }
    if (!canAssignOperator(op, selectedRouteForOps.origin)) { setError("Operator region does not match route origin"); return; }

    const ids = selectedRouteForOps.assignedOperatorIds || [];
    const ops = selectedRouteForOps.assignedOperators   || [];

    if (ids.includes(op.id))  { setError('Already assigned'); return; }
    if (ids.length >= 2)       { setError('Maximum 2 operators per route'); return; }

    setActionLoading(true);
    try {
      const newOp: RouteOperator = {
        operatorId:    op.id,
        operatorName:  `${op.firstName} ${op.lastName}`.trim() || 'Unknown Operator',
        operatorEmail: op.email,
        region:        op.region || op.branch || '',
        assignedAt:    new Date(),
      };
      const updatedIds = [...ids, op.id];
      const updatedOps = [...ops, newOp];
      const { success, error } = await dbActions.updateRoute(selectedRouteForOps.id, {
        assignedOperatorIds: updatedIds, assignedOperators: updatedOps, updatedAt: new Date(),
      });
      if (!success) throw new Error(error);
      const updated = { ...selectedRouteForOps, assignedOperatorIds: updatedIds, assignedOperators: updatedOps };
      setRoutes(prev => prev.map(r => r.id === selectedRouteForOps.id ? updated : r));
      setSelectedRouteForOps(updated);
      setSuccess(`Assigned ${newOp.operatorName}`);
    } catch (err: unknown) { setError(`Failed to assign: ${(err as any).message}`); }
    finally { setActionLoading(false); }
  };

  const handleRemoveOperator = async (operatorId: string) => {
    if (!selectedRouteForOps) return;
    setActionLoading(true);
    try {
      const updatedIds = (selectedRouteForOps.assignedOperatorIds || []).filter(id => id !== operatorId);
      const updatedOps = (selectedRouteForOps.assignedOperators   || []).filter(op => op.operatorId !== operatorId);
      const { success, error } = await dbActions.updateRoute(selectedRouteForOps.id, {
        assignedOperatorIds: updatedIds, assignedOperators: updatedOps, updatedAt: new Date(),
      });
      if (!success) throw new Error(error);
      const updated = { ...selectedRouteForOps, assignedOperatorIds: updatedIds, assignedOperators: updatedOps };
      setRoutes(prev => prev.map(r => r.id === selectedRouteForOps.id ? updated : r));
      setSelectedRouteForOps(updated);
      setSuccess('Operator removed');
    } catch (err: any) { setError('Failed to remove operator'); }
    finally { setActionLoading(false); }
  };

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60); const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-5">
        {[
          { icon: <RouteIcon   className="w-5 h-5 text-blue-600"   />, bgObj: 'bg-blue-50',   value: stats.total,                                 label: 'TOTAL ROUTES'   },
          { icon: <CheckCircle className="w-5 h-5 text-green-600"  />, bgObj: 'bg-green-50',  value: stats.active,                                label: 'ACTIVE ROUTES'  },
          { icon: <XCircle     className="w-5 h-5 text-red-600"    />, bgObj: 'bg-red-50',    value: stats.inactive,                              label: 'INACTIVE ROUTES'},
          { icon: <MapPinned   className="w-5 h-5 text-purple-600" />, bgObj: 'bg-purple-50', value: `${stats.totalDistance.toFixed(0)} km`,       label: 'DISTANCE' },
          { icon: <DollarSign  className="w-5 h-5 text-green-600"  />, bgObj: 'bg-green-50',  value: `MWK ${stats.totalRevenue.toLocaleString()}`, label: 'AVG FARE'  },
          { icon: <Users       className="w-5 h-5 text-orange-600" />, bgObj: 'bg-orange-50', value: stats.withOperators,                         label: 'W/ OPERATORS' },
        ].map(({ icon, bgObj, value, label }) => (
          <div key={label} className="bg-white p-5 rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-gray-100 flex flex-col justify-between min-h-[120px] transition-all text-left">
             <div className="flex justify-between items-start mb-3">
                <div className={`p-2 rounded-lg ${bgObj}`}>
                   {icon}
                </div>
             </div>
             <div className="mt-auto">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
                <p className="text-2xl font-extrabold leading-none text-gray-900">{value}</p>
             </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-gray-100 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="text" placeholder="Search routes…" value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div className="flex gap-2">
            <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value as any); setCurrentPage(1); }}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
            <Button onClick={() => { setNewRoute(initialNewRoute); setShowAddModal(true); }}
              className="bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2" disabled={actionLoading}>
              <Plus className="w-4 h-4" /> Add Route
            </Button>
          </div>
        </div>
      </div>

      {/* Route grid */}
      {paginatedRoutes.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Navigation className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {routes.length === 0 ? 'No routes yet' : 'No routes match your search'}
          </h3>
          <p className="text-gray-500 mb-6">
            {searchTerm || filterStatus !== 'all' ? 'Try adjusting your search or filters' : 'Add your first route to start managing your network'}
          </p>
          {routes.length === 0 && (
            <Button onClick={() => { setNewRoute(initialNewRoute); setShowAddModal(true); }} className="bg-blue-600 text-white hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" /> Add First Route
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {paginatedRoutes.map(route => {
              const opIds = route.assignedOperatorIds || [];
              return (
                <div key={route.id} className="bg-white rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-gray-100 hover:shadow-[0_4px_15px_-3px_rgba(0,0,0,0.1)] transition-all duration-200">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Navigation className="w-5 h-5 text-blue-600" />
                        <h3 className="text-lg font-semibold text-gray-900 line-clamp-1">{route.name}</h3>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${route.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {route.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    {/* Route path */}
                    <div className="mb-4 pb-4 border-b">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 flex items-center gap-2">
                          <div className="w-3 h-3 bg-green-500 rounded-full" />
                          <span className="text-sm font-medium text-gray-900">{route.origin}</span>
                        </div>
                        <ArrowRight className="w-5 h-5 text-gray-400 shrink-0" />
                        <div className="flex-1 flex items-center justify-end gap-2">
                          <span className="text-sm font-medium text-gray-900">{route.destination}</span>
                          <div className="w-3 h-3 bg-red-500 rounded-full" />
                        </div>
                      </div>
                      {(route.stops?.length ?? 0) > 0 && (
                        <div className="mt-3 flex items-center gap-2">
                          <div className="flex-1 h-px bg-gray-200 relative">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2">
                              <span className="text-xs text-gray-500">{route.stops!.length} stops</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <MapPin className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                        <p className="text-sm font-bold text-gray-900">{route.distance} km</p>
                        <p className="text-xs text-gray-600">Distance</p>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <Clock className="w-4 h-4 text-purple-600 mx-auto mb-1" />
                        <p className="text-sm font-bold text-gray-900">{formatDuration(route.duration)}</p>
                        <p className="text-xs text-gray-600">Duration</p>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <DollarSign className="w-4 h-4 text-green-600 mx-auto mb-1" />
                        <p className="text-sm font-bold text-gray-900">
                          {route.baseFare ? `MWK ${route.baseFare.toLocaleString()}` : 'Not Set'}
                        </p>
                        <p className="text-xs text-gray-600">Base Fare</p>
                      </div>
                    </div>

                    {/* Operator badges */}
                    {opIds.length > 0 ? (
                      <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="w-4 h-4 text-blue-600" />
                          <p className="text-xs font-semibold text-blue-900">Assigned Operators ({opIds.length}/2)</p>
                        </div>
                        <div className="space-y-2">
                          {opIds.map((uid, i) => {
                            const op   = operatorInfo.get(uid);
                            const name = op ? `${op.firstName} ${op.lastName}`.trim() || 'Unknown Operator' : `Operator ${uid.slice(0,8)}…`;
                            return (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                <UserCircle className="w-3 h-3 text-blue-600" />
                                <span className="font-medium text-gray-900">{name}</span>
                                {op?.region && (
                                  <><span className="text-gray-500">•</span>
                                  <div className="flex items-center gap-1">
                                    <MapPinIcon className="w-3 h-3 text-gray-400" />
                                    <span className="text-gray-600">{op.region}</span>
                                  </div></>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="mb-4 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-yellow-600" />
                          <p className="text-xs text-yellow-800">No operators assigned</p>
                        </div>
                      </div>
                    )}

                    {/* Stops */}
                    {(route.stops?.length ?? 0) > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-medium text-gray-700 mb-2">Stops:</p>
                        <div className="flex flex-wrap gap-1">
                          {route.stops!.slice(0, 3).map((stop, idx) => (
                            <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-md">{stop.name}</span>
                          ))}
                          {route.stops!.length > 3 && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-md">+{route.stops!.length - 3} more</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="grid grid-cols-4 gap-2 pt-4 border-t">
                      <button onClick={() => handleManageOperators(route)}
                        className="flex items-center justify-center px-2 py-2 text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors" title="Manage operators">
                        <Users className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setEditRoute(route); setShowEditModal(true); }} disabled={actionLoading}
                        className="flex items-center justify-center px-2 py-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors" title="Edit">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDuplicate(route)} disabled={actionLoading}
                        className="flex items-center justify-center px-2 py-2 text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors" title="Duplicate return">
                        <Copy className="w-4 h-4" />
                      </button>
                      {/* FIX RT-2: sets deleteConfirmId, opens Modal */}
                      <button onClick={() => setDeleteConfirmId(route.id)} disabled={actionLoading}
                        className="flex items-center justify-center px-2 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white rounded-xl border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] p-4">
              <div className="text-sm text-gray-600">
                Showing {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, filteredRoutes.length)} of {filteredRoutes.length} routes
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button key={page} onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium ${currentPage === page ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    {page}
                  </button>
                ))}
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* FIX RT-2: Delete confirm modal */}
      <Modal isOpen={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} title="Delete Route">
        <div className="space-y-4">
          <p className="text-gray-600">Are you sure you want to delete this route? This action cannot be undone.</p>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setDeleteConfirmId(null)} disabled={actionLoading}
              className="flex-1 px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">
              Cancel
            </button>
            <button onClick={confirmDelete} disabled={actionLoading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50">
              {actionLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete
            </button>
          </div>
        </div>
      </Modal>

      {/* Operator Modal */}
      <Modal isOpen={showOperatorModal} onClose={() => { setShowOperatorModal(false); setSelectedRouteForOps(null); }} title="Manage Route Operators">
        {selectedRouteForOps && (
          <div className="space-y-6">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <h4 className="font-semibold text-gray-900 mb-2">{selectedRouteForOps.name}</h4>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPinIcon className="w-4 h-4" />
                <span>{selectedRouteForOps.origin} → {selectedRouteForOps.destination}</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Only operators with region exactly matching <span className="font-semibold">&quot;{selectedRouteForOps.origin}&quot;</span> can be assigned
              </p>
            </div>

            {/* Assigned */}
            {(selectedRouteForOps.assignedOperators ?? []).length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Currently Assigned ({selectedRouteForOps.assignedOperators!.length}/2)</h4>
                <div className="space-y-2">
                  {selectedRouteForOps.assignedOperators!.map(op => (
                    <div key={op.operatorId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <UserCircle className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{op.operatorName}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <MapPinIcon className="w-3 h-3" />
                            <span>{op.region}</span>
                            <span>·</span>
                            <span>{op.operatorEmail}</span>
                          </div>
                        </div>
                      </div>
                      <button onClick={() => handleRemoveOperator(op.operatorId)} disabled={actionLoading}
                        className="px-3 py-1 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-sm">
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Available */}
            {(selectedRouteForOps.assignedOperators ?? []).length < 2 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">
                  Available Operators from &quot;{selectedRouteForOps.origin}&quot;
                </h4>
                {loadingOperators ? (
                  <div className="text-center py-8">
                    <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-sm text-gray-500 mt-2">Loading…</p>
                  </div>
                ) : (() => {
                  const available = operators.filter(op => {
                    const assigned = selectedRouteForOps.assignedOperators?.some(a => a.operatorId === op.id);
                    return !assigned && canAssignOperator(op, selectedRouteForOps.origin);
                  });
                  return available.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-600">No available operators from &quot;{selectedRouteForOps.origin}&quot;</p>
                      <p className="text-sm text-gray-500 mt-1">Operators must have their region set to exactly &quot;{selectedRouteForOps.origin}&quot;</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {available.map(op => (
                        <div key={op.id} className="flex items-center justify-between p-3 bg-white border rounded-lg hover:border-blue-300 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                              <UserCircle className="w-5 h-5 text-gray-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{op.firstName} {op.lastName}</p>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <MapPinIcon className="w-3 h-3" />
                                <span>{op.region || op.branch || 'No region'}</span>
                                <span>·</span>
                                <span>{op.email}</span>
                              </div>
                            </div>
                          </div>
                          <button onClick={() => handleAssignOperator(op)} disabled={actionLoading}
                            className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm disabled:opacity-50">
                            Assign
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-semibold mb-1">Region-Based Assignment</p>
                  <p>Operator region must exactly match the route origin city.</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button onClick={() => { setShowOperatorModal(false); setSelectedRouteForOps(null); }} variant="outline">Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Route">
        <form onSubmit={handleAdd} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Route Name *</label>
            <input type="text" value={newRoute.name} onChange={e => setNewRoute({ ...newRoute, name: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="e.g., Blantyre to Lilongwe Express" required />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Origin *</label>
              <input type="text" value={newRoute.origin} onChange={e => setNewRoute({ ...newRoute, origin: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="e.g., Blantyre" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Destination *</label>
              <input type="text" value={newRoute.destination} onChange={e => setNewRoute({ ...newRoute, destination: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="e.g., Lilongwe" required />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Distance (km) *</label>
              <input type="number" value={newRoute.distance || ''} onChange={e => setNewRoute({ ...newRoute, distance: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="0" required min="1" step="0.1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Duration (minutes) *</label>
              <input type="number" value={newRoute.duration || ''} onChange={e => setNewRoute({ ...newRoute, duration: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="0" required min="1" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Base Fare (MWK) *</label>
              <input type="number" value={newRoute.baseFare || ''} onChange={e => setNewRoute({ ...newRoute, baseFare: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="0" required min="1" step="100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Price per KM (Optional)</label>
              <input type="number" value={newRoute.pricePerKm || ''} onChange={e => setNewRoute({ ...newRoute, pricePerKm: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="0" min="0" step="10" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Stops <span className="text-gray-400 font-normal">(comma-separated)</span></label>
            <input type="text" value={(newRoute.stops ?? []).map(s => s.name).join(',')}
              onChange={e => setNewRoute({ ...newRoute, stops: e.target.value.split(',').map(n => n.trim()).filter(Boolean).map((name, idx) => ({ id: `stop-${idx}`, name, order: idx, distanceFromOrigin: 0 })) })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="e.g., Zomba, Balaka, Ntcheu" />
          </div>
          <div className="flex justify-end gap-3 pt-6 border-t">
            <Button type="button" onClick={() => setShowAddModal(false)} variant="outline" disabled={actionLoading}>Cancel</Button>
            <Button type="submit" disabled={actionLoading} className="bg-blue-600 text-white hover:bg-blue-700">
              {actionLoading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Adding…</> : <><Plus className="w-4 h-4 mr-2" />Add Route</>}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Route">
        {editRoute && (
          <form onSubmit={handleEdit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Route Name *</label>
              <input type="text" value={editRoute.name} onChange={e => setEditRoute({ ...editRoute, name: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Origin *</label>
                <input type="text" value={editRoute.origin} onChange={e => setEditRoute({ ...editRoute, origin: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Destination *</label>
                <input type="text" value={editRoute.destination} onChange={e => setEditRoute({ ...editRoute, destination: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Distance (km) *</label>
                <input type="number" value={editRoute.distance} onChange={e => setEditRoute({ ...editRoute, distance: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required min="1" step="0.1" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Duration (minutes) *</label>
                <input type="number" value={editRoute.duration} onChange={e => setEditRoute({ ...editRoute, duration: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required min="1" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Base Fare (MWK) *</label>
                <input type="number" value={editRoute.baseFare || ''} onChange={e => setEditRoute({ ...editRoute, baseFare: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required min="1" step="100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Price per KM (Optional)</label>
                <input type="number" value={editRoute.pricePerKm || ''} onChange={e => setEditRoute({ ...editRoute, pricePerKm: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" min="0" step="10" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Stops <span className="text-gray-400 font-normal">(comma-separated)</span></label>
              <input type="text" value={(editRoute.stops ?? []).map(s => s.name).join(',')}
                onChange={e => setEditRoute({ ...editRoute, stops: e.target.value.split(',').map(n => n.trim()).filter(Boolean).map((name, idx) => ({ id: `stop-${idx}`, name, order: idx, distanceFromOrigin: 0 })) })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex justify-end gap-3 pt-6 border-t">
              <Button type="button" onClick={() => { setShowEditModal(false); setEditRoute(null); }} variant="outline" disabled={actionLoading}>Cancel</Button>
              <Button type="submit" disabled={actionLoading} className="bg-blue-600 text-white hover:bg-blue-700">
                {actionLoading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Updating…</> : <><Edit3 className="w-4 h-4 mr-2" />Update Route</>}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default RoutesTab;
