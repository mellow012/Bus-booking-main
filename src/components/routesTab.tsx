import { FC, useState, useMemo, useCallback, useEffect } from 'react';
import { collection, updateDoc, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { Route } from '@/types';
import Modal from './Modals';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Search, 
  MapPin, 
  Clock, 
  Navigation,
  ArrowRight,
  MapPinned,
  Route as RouteIcon,
  CheckCircle,
  XCircle,
  DollarSign,
  Copy,
  Users,
  UserCircle,
  MapPinIcon,
  AlertCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RoutesTabProps {
  routes: Route[];
  setRoutes: React.Dispatch<React.SetStateAction<Route[]>>;
  companyId: string;
  addRoute: (data: any) => Promise<string | null>;
  setError: (msg: string) => void;
  setSuccess: (msg: string) => void;
}

interface Operator {
  id: string;
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  region?: string;
  branch?: string;
  role: string;
  companyId: string;       // Alternative/backup field
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
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  region?: string;
}

const RoutesTab: FC<RoutesTabProps> = ({ routes, setRoutes, companyId, addRoute, setError, setSuccess }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showOperatorModal, setShowOperatorModal] = useState(false);
  const [editRoute, setEditRoute] = useState<Route | null>(null);
  const [selectedRouteForOperators, setSelectedRouteForOperators] = useState<Route | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [actionLoading, setActionLoading] = useState(false);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loadingOperators, setLoadingOperators] = useState(false);
  const [operatorInfo, setOperatorInfo] = useState<Map<string, OperatorInfo>>(new Map());
  
  // ✅ NEW: Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  
  const initialNewRoute: Omit<Route, 'id' | 'createdAt' | 'updatedAt'> = { 
    name: '',
    origin: '', 
    destination: '', 
    distance: 0, 
    duration: 0, 
    stops: [], 
    companyId, 
    status: 'active',
    isActive: true,
    baseFare: 0,
    pricePerKm: 0,
    assignedOperators: [],
    assignedOperatorIds: [],
  };
  
  const [newRoute, setNewRoute] = useState(initialNewRoute);

  // Fetch operators for the company
  const fetchOperators = useCallback(async () => {
    if (!companyId) return;
    
    setLoadingOperators(true);
    try {
      console.log('[RoutesTab] Fetching operators for company:', companyId);
      
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        where('companyId', '==', companyId),
        where('role', '==', 'operator')
      );
      
      const snapshot = await getDocs(q);
      const operatorsList: Operator[] = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log('[RoutesTab] Operator found:', {
          docId: doc.id,
          uid: data.uid,
          name: `${data.name}`
        });
        
        return {
          id: doc.id,
          uid: data.uid || doc.id,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          email: data.email || '',
          region: data.region,
          branch: data.branch,
          role: data.role
        } as Operator;
      });
      
      console.log('[RoutesTab] Total operators fetched:', operatorsList.length);
      setOperators(operatorsList);
    } catch (error: any) {
      console.error('[RoutesTab] Error fetching operators:', error);
      setError('Failed to load operators');
    } finally {
      setLoadingOperators(false);
    }
  }, [companyId, setError]);

  // ✅ Fixed: useEffect to fetch operators
  useEffect(() => {
    fetchOperators();
  }, [fetchOperators]);

  // ✅ NEW: Fetch operator details
 useEffect(() => {
    const fetchOperatorDetails = async () => {
      const operatorUIDs = new Set<string>();
      routes.forEach(route => {
        (route.assignedOperatorIds || []).forEach(uid => operatorUIDs.add(uid));
      });

      const operatorsMap = new Map<string, OperatorInfo>();
      for (const uid of operatorUIDs) {
        try {
          const userDoc = await getDocs(
            query(collection(db, 'users'), where('uid', '==', uid))
          );
          if (!userDoc.empty) {
            const data = userDoc.docs[0].data();
            operatorsMap.set(uid, {
              uid,
              firstName: data.firstName || data.name?.split(' ')[0] || '',
              lastName: data.lastName || data.name?.split(' ').slice(1).join(' ') || '',
              email: data.email || '',
              region: data.region
            });
          }
        } catch (error) {
          console.error(`Error fetching operator ${uid}:`, error);
        }
      }
      setOperatorInfo(operatorsMap);
    };

    if (routes.length > 0) {
      fetchOperatorDetails();
    }
  }, [routes]);

  const stats = useMemo(() => {
    return {
      total: routes.length,
      active: routes.filter(r => r.isActive).length,
      inactive: routes.filter(r => !r.isActive).length,
      totalDistance: routes.reduce((sum, r) => sum + r.distance, 0),
      totalRevenue: routes.reduce((sum, r) => sum + (r.baseFare || 0), 0),
      withOperators: routes.filter(r => (r.assignedOperatorIds || []).length > 0).length,
    };
  }, [routes]);

  const canAssignOperator = useCallback((operator: Operator, routeOrigin: string) => {
    if (!operator.region && !operator.branch) {
      return false;
    }
    
    const operatorLocation = (operator.region || operator.branch || '').toLowerCase().trim();
    const routeLocation = routeOrigin.toLowerCase().trim();
    
    return routeLocation.includes(operatorLocation) || operatorLocation.includes(routeLocation);
  }, []);

  const filteredRoutes = useMemo(() => {
    let filtered = routes.filter(r => 
      r.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.stops.some(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (filterStatus !== 'all') {
      filtered = filtered.filter(r => 
        filterStatus === 'active' ? r.isActive : !r.isActive
      );
    }

    return filtered;
  }, [routes, searchTerm, filterStatus]);

  // ✅ NEW: Pagination
  const paginatedRoutes = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredRoutes.slice(startIndex, endIndex);
  }, [filteredRoutes, currentPage]);

  const totalPages = Math.ceil(filteredRoutes.length / itemsPerPage);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoute.name.trim()) {
      setError('Route name is required');
      return;
    }
    if (newRoute.distance <= 0 || newRoute.duration <= 0) {
      setError('Distance and duration must be positive');
      return;
    }
    if ((newRoute.baseFare || 0) <= 0) {
      setError('Base fare is required and must be greater than 0');
      return;
    }
    const existingRoute = routes.find(r => r.origin === newRoute.origin && r.destination === newRoute.destination);
    if (existingRoute) {
      setError('Route with same origin and destination already exists');
      return;
    }
    setActionLoading(true);
    try {
      const result = await addRoute(newRoute);
      if (result) {
        setNewRoute(initialNewRoute);
        setShowAddModal(false);
        setSuccess('Route added successfully!');
      }
    } catch (err: any) {
      setError(`Failed to add route: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRoute || !editRoute.name.trim() || editRoute.distance <= 0 || editRoute.duration <= 0) {
      setError('Please fill all required fields with valid data');
      return;
    }
    setActionLoading(true);
    try {
      const docRef = doc(db, 'routes', editRoute.id);
      const updatedData = { ...editRoute, updatedAt: new Date() };
      await updateDoc(docRef, updatedData);
      setRoutes(routes.map(r => r.id === editRoute.id ? updatedData : r));
      setShowEditModal(false);
      setEditRoute(null);
      setSuccess('Route updated successfully!');
    } catch (err: any) {
      setError(`Failed to update route: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this route?')) return;
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, 'routes', id));
      setRoutes(routes.filter(r => r.id !== id));
      setSuccess('Route deleted successfully!');
    } catch (err: any) {
      setError(`Failed to delete route: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDuplicate = async (route: Route) => {
    const duplicatedRoute = {
      ...route,
      name: `${route.name} (Return)`,
      origin: route.destination,
      destination: route.origin,
      stops: [...route.stops].reverse(),
      assignedOperators: [],
      assignedOperatorIds: [],
      id: undefined,
      createdAt: undefined,
      updatedAt: undefined,
    };
    
    setNewRoute(duplicatedRoute as any);
    setShowAddModal(true);
  };

  const handleManageOperators = (route: Route) => {
    setSelectedRouteForOperators(route);
    setShowOperatorModal(true);
    if (operators.length === 0) {
      fetchOperators();
    }
  };

  const handleAssignOperator = async (operator: Operator) => {
    if (!selectedRouteForOperators) return;

    if (!operator.uid) {
      setError("Operator missing UID");
      return;
    }

    if (!canAssignOperator(operator, selectedRouteForOperators.origin)) {
      setError("Operator region does not match route origin");
      return;
    }

    const ids = selectedRouteForOperators.assignedOperatorIds || [];
    const ops = selectedRouteForOperators.assignedOperators || [];

    if (ids.includes(operator.uid)) {
      setError("Already assigned");
      return;
    }

    if (ids.length >= 2) {
      setError("Maximum 2 operators per route");
      return;
    }

    setActionLoading(true);

    try {
      const newOp: RouteOperator = {
        operatorId: operator.uid,
        operatorName: `${operator.firstName.trim()} ${operator.lastName.trim()}`.trim() || "Unknown Operator",
        operatorEmail: operator.email || "",
        region: operator.region || operator.branch || "",
        assignedAt: new Date(),
      };

      const updatedIds = [...ids, operator.uid];
      const updatedOps = [...ops, newOp];

      const ref = doc(db, 'routes', selectedRouteForOperators.id);

      console.log("[assign] → writing", {
        routeId: selectedRouteForOperators.id,
        newOperator: newOp.operatorName,
        totalOperators: updatedIds.length,
      });

      await updateDoc(ref, {
        assignedOperatorIds: updatedIds,
        assignedOperators: updatedOps,
        updatedAt: new Date(),
      });

      const updatedRoute = {
        ...selectedRouteForOperators,
        assignedOperatorIds: updatedIds,
        assignedOperators: updatedOps,
      };

      setRoutes(prev => prev.map(r => r.id === selectedRouteForOperators.id ? updatedRoute : r));
      setSelectedRouteForOperators(updatedRoute);

      setSuccess(`Assigned ${newOp.operatorName}`);
    } catch (err: any) {
      console.error("[assign] failed:", err);
      setError(`Failed to assign: ${err.message || "unknown error"}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveOperator = async (operatorId: string) => {
    if (!selectedRouteForOperators) return;

    setActionLoading(true);

    try {
      const ids = selectedRouteForOperators.assignedOperatorIds || [];
      const ops = selectedRouteForOperators.assignedOperators || [];

      const updatedIds = ids.filter(id => id !== operatorId);
      const updatedOps = ops.filter(op => op.operatorId !== operatorId);

      const ref = doc(db, 'routes', selectedRouteForOperators.id);

      await updateDoc(ref, {
        assignedOperatorIds: updatedIds,
        assignedOperators: updatedOps,
        updatedAt: new Date(),
      });

      const updatedRoute = {
        ...selectedRouteForOperators,
        assignedOperatorIds: updatedIds,
        assignedOperators: updatedOps,
      };

      setRoutes(prev => prev.map(r => r.id === selectedRouteForOperators.id ? updatedRoute : r));
      setSelectedRouteForOperators(updatedRoute);

      setSuccess("Operator removed");
    } catch (err: any) {
      console.error("[remove] failed:", err);
      setError("Failed to remove operator");
    } finally {
      setActionLoading(false);
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white p-5 rounded-xl border shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <RouteIcon className="w-8 h-8 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-sm text-gray-600">Total Routes</p>
        </div>
        
        <div className="bg-white p-5 rounded-xl border shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
          <p className="text-sm text-gray-600">Active Routes</p>
        </div>
        
        <div className="bg-white p-5 rounded-xl border shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.inactive}</p>
          <p className="text-sm text-gray-600">Inactive Routes</p>
        </div>
        
        <div className="bg-white p-5 rounded-xl border shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <MapPinned className="w-8 h-8 text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.totalDistance.toFixed(0)} km</p>
          <p className="text-sm text-gray-600">Total Distance</p>
        </div>
        
        <div className="bg-white p-5 rounded-xl border shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">MWK {stats.totalRevenue.toLocaleString()}</p>
          <p className="text-sm text-gray-600">Avg Base Fare</p>
        </div>

        <div className="bg-white p-5 rounded-xl border shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-8 h-8 text-orange-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.withOperators}</p>
          <p className="text-sm text-gray-600">With Operators</p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search routes by name, origin, destination, or stops..."
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); // Reset to first page when searching
              }}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={e => {
                setFilterStatus(e.target.value as any);
                setCurrentPage(1); // Reset to first page when filtering
              }}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>

            <Button 
              onClick={() => {
                setNewRoute(initialNewRoute);
                setShowAddModal(true);
              }} 
              className="bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2"
              disabled={actionLoading}
            >
              <Plus className="w-4 h-4" />
              Add Route
            </Button>
          </div>
        </div>
      </div>

      {/* Routes Grid */}
      {paginatedRoutes.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Navigation className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {routes.length === 0 ? 'No routes yet' : 'No routes match your search'}
          </h3>
          <p className="text-gray-500 mb-6">
            {searchTerm || filterStatus !== 'all'
              ? 'Try adjusting your search or filters' 
              : 'Add your first route to start managing your network'}
          </p>
          {routes.length === 0 && (
            <Button 
              onClick={() => {
                setNewRoute(initialNewRoute);
                setShowAddModal(true);
              }} 
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
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
                <div key={route.id} className="bg-white rounded-xl shadow-sm border hover:shadow-md transition-all duration-200">
                  <div className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Navigation className="w-5 h-5 text-blue-600" />
                          <h3 className="text-lg font-semibold text-gray-900 line-clamp-1">
                            {route.name}
                          </h3>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        route.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {route.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    {/* Route Path */}
                    <div className="mb-4 pb-4 border-b">
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span className="text-sm font-medium text-gray-900">{route.origin}</span>
                          </div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 text-right">
                          <div className="flex items-center justify-end gap-2 mb-1">
                            <span className="text-sm font-medium text-gray-900">{route.destination}</span>
                            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                          </div>
                        </div>
                      </div>

                      {/* Stops Indicator */}
                      {route.stops.length > 0 && (
                        <div className="mt-3 flex items-center gap-2">
                          <div className="flex-1 h-px bg-gray-200 relative">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2">
                              <span className="text-xs text-gray-500">{route.stops.length} stops</span>
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

                    {/* ✅ NEW: Assigned Operators Display */}
                   {opIds.length > 0 ? (
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-4 h-4 text-blue-600" />
                      <p className="text-xs font-semibold text-blue-900">
                        Assigned Operators ({opIds.length}/2)
                      </p>
                    </div>
                    <div className="space-y-2">
                      {opIds.map((uid, i) => {
                        const op = operatorInfo.get(uid);
                        const name = op 
                          ? `${op.firstName} ${op.lastName}`.trim() || "Unknown Operator"
                          : `Operator ${uid.slice(0,8)}…`;

                        const region = op?.region || '';

                        return (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <UserCircle className="w-3 h-3 text-blue-600" />
                            <span className="font-medium text-gray-900">{name}</span>
                            {region && (
                              <>
                                <span className="text-gray-500">•</span>
                                <div className="flex items-center gap-1">
                                  <MapPinIcon className="w-3 h-3 text-gray-400" />
                                  <span className="text-gray-600">{region}</span>
                                </div>
                              </>
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

                    {/* Stops List */}
                    {route.stops.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-medium text-gray-700 mb-2">Stops along the way:</p>
                        <div className="flex flex-wrap gap-1">
                          {route.stops.slice(0, 3).map((stop, idx) => (
                            <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-md">
                              {stop.name}
                            </span>
                          ))}
                          {route.stops.length > 3 && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-md">
                              +{route.stops.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="grid grid-cols-4 gap-2 pt-4 border-t">
                      <button
                        onClick={() => handleManageOperators(route)}
                        className="flex items-center justify-center gap-1 px-2 py-2 text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors text-sm"
                        title="Manage operators"
                      >
                        <Users className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { 
                          setEditRoute(route); 
                          setShowEditModal(true); 
                        }} 
                        className="flex items-center justify-center gap-1 px-2 py-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors text-sm"
                        disabled={actionLoading}
                        title="Edit route"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDuplicate(route)} 
                        className="flex items-center justify-center gap-1 px-2 py-2 text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors text-sm"
                        disabled={actionLoading}
                        title="Duplicate for return trip"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(route.id)} 
                        className="flex items-center justify-center gap-1 px-2 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors text-sm"
                        disabled={actionLoading}
                        title="Delete route"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ✅ NEW: Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white rounded-xl border p-4">
              <div className="text-sm text-gray-600">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredRoutes.length)} of {filteredRoutes.length} routes
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium ${
                        currentPage === page
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Operator Assignment Modal */}
      <Modal 
        isOpen={showOperatorModal} 
        onClose={() => {
          setShowOperatorModal(false);
          setSelectedRouteForOperators(null);
        }} 
        title="Manage Route Operators"
      >
        {selectedRouteForOperators && (
          <div className="space-y-6">
            {/* Route Info */}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <h4 className="font-semibold text-gray-900 mb-2">{selectedRouteForOperators.name}</h4>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPinIcon className="w-4 h-4" />
                <span>{selectedRouteForOperators.origin} → {selectedRouteForOperators.destination}</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Only operators from <span className="font-semibold">{selectedRouteForOperators.origin}</span> region can be assigned
              </p>
            </div>

            {/* Currently Assigned */}
            {selectedRouteForOperators.assignedOperators && selectedRouteForOperators.assignedOperators.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Currently Assigned ({selectedRouteForOperators.assignedOperators.length}/2)</h4>
                <div className="space-y-2">
                  {selectedRouteForOperators.assignedOperators.map((op) => (
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
                            <span>•</span>
                            <span>{op.operatorEmail}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveOperator(op.operatorId)}
                        disabled={actionLoading}
                        className="px-3 py-1 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Available Operators */}
            {selectedRouteForOperators.assignedOperators && selectedRouteForOperators.assignedOperators.length < 2 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">
                  Available Operators from {selectedRouteForOperators.origin}
                </h4>
                
                {loadingOperators ? (
                  <div className="text-center py-8">
                    <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-sm text-gray-500 mt-2">Loading operators...</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {operators
                      .filter(op => {
                        const isAssigned = selectedRouteForOperators.assignedOperators?.some(
                          assigned => assigned.operatorId === op.uid
                        );
                        const canAssign = canAssignOperator(op, selectedRouteForOperators.origin);
                        return !isAssigned && canAssign;
                      })
                      .map((op) => (
                        <div key={op.uid} className="flex items-center justify-between p-3 bg-white border rounded-lg hover:border-blue-300 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                              <UserCircle className="w-5 h-5 text-gray-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{op.firstName} {op.lastName}</p>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <MapPinIcon className="w-3 h-3" />
                                <span>{op.region || op.branch || 'No region set'}</span>
                                <span>•</span>
                                <span>{op.email}</span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleAssignOperator(op)}
                            disabled={actionLoading}
                            className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                          >
                            Assign
                          </button>
                        </div>
                      ))}
                    
                    {operators.filter(op => {
                      const isAssigned = selectedRouteForOperators.assignedOperators?.some(
                        assigned => assigned.operatorId === op.uid
                      );
                      const canAssign = canAssignOperator(op, selectedRouteForOperators.origin);
                      return !isAssigned && canAssign;
                    }).length === 0 && (
                      <div className="text-center py-8 bg-gray-50 rounded-lg">
                        <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-600">No available operators from {selectedRouteForOperators.origin}</p>
                        <p className="text-sm text-gray-500 mt-1">
                          Operators must have their region/branch set to {selectedRouteForOperators.origin} to be assigned
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Info Box */}
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-semibold mb-1">Region-Based Assignment</p>
                  <p>Operators can only be assigned to routes from their designated region/branch. This ensures they only manage bookings from their area.</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button
                onClick={() => {
                  setShowOperatorModal(false);
                  setSelectedRouteForOperators(null);
                }}
                variant="outline"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add/Edit Modal code remains the same... */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Route">
        <form onSubmit={handleAdd} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Route Name *</label>
            <input
              type="text"
              value={newRoute.name}
              onChange={e => setNewRoute({ ...newRoute, name: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Blantyre to Lilongwe Express"
              required
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Origin *</label>
              <input
                type="text"
                value={newRoute.origin}
                onChange={e => setNewRoute({ ...newRoute, origin: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Blantyre"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Destination *</label>
              <input
                type="text"
                value={newRoute.destination}
                onChange={e => setNewRoute({ ...newRoute, destination: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Lilongwe"
                required
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Distance (km) *</label>
              <input
                type="number"
                value={newRoute.distance || ''}
                onChange={e => setNewRoute({ ...newRoute, distance: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
                required
                min="1"
                step="0.1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Duration (minutes) *</label>
              <input
                type="number"
                value={newRoute.duration || ''}
                onChange={e => setNewRoute({ ...newRoute, duration: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
                required
                min="1"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Base Fare (MWK) *</label>
              <input
                type="number"
                value={newRoute.baseFare || ''}
                onChange={e => setNewRoute({ ...newRoute, baseFare: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
                required
                min="1"
                step="100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Price per KM (Optional)
              </label>
              <input
                type="number"
                value={newRoute.pricePerKm || ''}
                onChange={e => setNewRoute({ ...newRoute, pricePerKm: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
                min="0"
                step="10"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Stops & Pickup Points <span className="text-gray-500 font-normal">(comma-separated, optional)</span>
            </label>
            <input
              type="text"
              value={newRoute.stops.map(s => s.name).join(',')}
              onChange={e => setNewRoute({ 
                ...newRoute, 
                stops: e.target.value.split(',')
                  .map(name => name.trim())
                  .filter(name => name.length > 0)
                  .map((name, idx) => ({ 
                    id: `stop-${idx}`, 
                    name, 
                    order: idx, 
                    distanceFromOrigin: 0 
                  })) 
              })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Zomba Bus Station, Balaka Market, Ntcheu Junction"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t">
            <Button 
              type="button" 
              onClick={() => setShowAddModal(false)} 
              variant="outline" 
              className="bg-gray-100 hover:bg-gray-200"
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={actionLoading} 
              className="bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {actionLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Route
                </>
              )}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Route">
        {editRoute && (
          <form onSubmit={handleEdit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Route Name *</label>
              <input
                type="text"
                value={editRoute.name}
                onChange={e => setEditRoute({ ...editRoute, name: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Origin *</label>
                <input
                  type="text"
                  value={editRoute.origin}
                  onChange={e => setEditRoute({ ...editRoute, origin: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Destination *</label>
                <input
                  type="text"
                  value={editRoute.destination}
                  onChange={e => setEditRoute({ ...editRoute, destination: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Distance (km) *</label>
                <input
                  type="number"
                  value={editRoute.distance}
                  onChange={e => setEditRoute({ ...editRoute, distance: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  min="1"
                  step="0.1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Duration (minutes) *</label>
                <input
                  type="number"
                  value={editRoute.duration}
                  onChange={e => setEditRoute({ ...editRoute, duration: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  min="1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Base Fare (MWK) *</label>
                <input
                  type="number"
                  value={editRoute.baseFare || ''}
                  onChange={e => setEditRoute({ ...editRoute, baseFare: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  min="1"
                  step="100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Price per KM (Optional)</label>
                <input
                  type="number"
                  value={editRoute.pricePerKm || ''}
                  onChange={e => setEditRoute({ ...editRoute, pricePerKm: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="0"
                  step="10"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Stops & Pickup Points <span className="text-gray-500 font-normal">(comma-separated, optional)</span>
              </label>
              <input
                type="text"
                value={editRoute.stops.map(s => s.name).join(',')}
                onChange={e => setEditRoute({ 
                  ...editRoute, 
                  stops: e.target.value.split(',')
                    .map(name => name.trim())
                    .filter(name => name.length > 0)
                    .map((name, idx) => ({ 
                      id: `stop-${idx}`, 
                      name, 
                      order: idx, 
                      distanceFromOrigin: 0 
                    })) 
                })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-6 border-t">
              <Button 
                type="button" 
                onClick={() => {
                  setShowEditModal(false);
                  setEditRoute(null);
                }} 
                variant="outline" 
                className="bg-gray-100 hover:bg-gray-200"
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={actionLoading} 
                className="bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {actionLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Updating...
                  </>
                ) : (
                  <>
                    <Edit3 className="w-4 h-4 mr-2" />
                    Update Route
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default RoutesTab;