import { FC, useState, useMemo, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import * as dbActions from "@/lib/actions/db.actions";
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Search, 
  Truck,
  CheckCircle,
  XCircle,
  Wrench,
  Users,
  Calendar,
  FileText,
  Crown,
  Lock,
  AlertTriangle,
  Zap,
  Clock,
  Eye,
  UserCircle,
  User,
  X
} from "lucide-react";
import Modal from "@/components/Modals";
import { Button } from "@/components/ui/button";
import { Bus, BusType, BusStatus, FuelType } from "@/types/core";

interface Conductor {
  id: string;
  name: string;
}

interface NewBusState {
  licensePlate: string;
  busType: BusType;
  capacity: number;
  amenities: string[];
  companyId: string;
  status: BusStatus;
  registrationNumber?: string;
  registrationExpiry?: string;
  insuranceExpiry?: string;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  fuelType: FuelType;
  yearOfManufacture?: number;
  conductorIds: string[];
}

interface BusesTabProps {
  buses: Bus[];
  setBuses: React.Dispatch<React.SetStateAction<Bus[]>>;
  companyId: string;
  setError: (msg: string) => void;
  setSuccess: (msg: string) => void;
  subscriptionTier?: 'free' | 'premium' | 'enterprise';
  schedules?: any[];
  bookings?: any[];
}

const FREE_TIER_LIMIT = 6;

const BusesTab: FC<BusesTabProps> = ({ 
  buses, 
  setBuses, 
  companyId, 
  setError, 
  setSuccess,
  subscriptionTier = 'free',
  schedules = [],
  bookings = []
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showBusDetailsModal, setShowBusDetailsModal] = useState(false);
  const [selectedBusForDetails, setSelectedBusForDetails] = useState<Bus | null>(null);
  const [editBus, setEditBus] = useState<Bus | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'maintenance'>('all');
  const [filterConductor, setFilterConductor] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState(false);

  const [conductors, setConductors] = useState<Conductor[]>([]);
  const [loadingConductors, setLoadingConductors] = useState(false);

  const initialNewBus: NewBusState = {
    licensePlate: "",
    busType: "AC",
    capacity: 40,
    amenities: [],
    companyId,
    status: "active",
    registrationNumber: "",
    fuelType: "diesel",
    conductorIds: [],
  };
  
  const [newBus, setNewBus] = useState<NewBusState>(initialNewBus);

  useEffect(() => {
    if (!companyId) return;

    const fetchConductors = async () => {
      setLoadingConductors(true);
      const { data, error } = await supabase
        .from('User')
        .select('id, firstName, lastName, email')
        .eq('companyId', companyId)
        .in('role', ['conductor', 'operator']);
        
      if (error) {
        console.error("Error fetching conductors:", error);
        setError("Failed to load available conductors");
      } else {
        setConductors((data || []).map(c => ({
          id: c.id,
          name: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || "Unnamed Staff",
        })));
      }
      setLoadingConductors(false);
    };

    fetchConductors();

    const channel = supabase
      .channel('conductors-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'User', filter: `companyId=eq.${companyId}` }, () => {
        fetchConductors();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [companyId, setError]);

  const canAddBus = useMemo(() => {
    if (subscriptionTier === 'premium' || subscriptionTier === 'enterprise') {
      return true;
    }
    return buses.length < FREE_TIER_LIMIT;
  }, [buses.length, subscriptionTier]);

  const remainingSlots = useMemo(() => {
    if (subscriptionTier !== 'free') return null;
    return Math.max(0, FREE_TIER_LIMIT - buses.length);
  }, [buses.length, subscriptionTier]);

  const stats = useMemo(() => ({
    total: buses.length,
    active: buses.filter(b => b.status === 'active').length,
    inactive: buses.filter(b => b.status === 'inactive').length,
    maintenance: buses.filter(b => b.status === 'maintenance').length,
    totalCapacity: buses.reduce((sum, b) => sum + (b.capacity || 0), 0),
  }), [buses]);

  const filteredBuses = useMemo(() => {
    let filtered = buses.filter(b =>
      b.licensePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.busType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.registrationDetails?.registrationNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.amenities?.some(a => a.toLowerCase().includes(searchTerm.toLowerCase())) ||
      getConductorNames(b.conductorIds).some(n => n.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (filterStatus !== 'all') {
      filtered = filtered.filter(b => b.status === filterStatus);
    }

    if (filterConductor !== 'all') {
      filtered = filtered.filter(b => b.conductorIds?.includes(filterConductor));
    }

    return filtered;
  }, [buses, searchTerm, filterStatus, filterConductor, conductors]);

  const getConductorNames = (ids: string[] = []): string[] => {
    return ids
      .map(id => conductors.find(c => c.id === id)?.name)
      .filter((name): name is string => !!name);
  };

  const getBusAssignments = useCallback((busId: string) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todaySchedules = schedules.filter(s => {
      if (s.busId !== busId) return false;
      const departureDate = new Date(s.departureDateTime);
      return departureDate >= today && departureDate < tomorrow && s.isActive;
    });

    const upcomingDate = new Date(today);
    upcomingDate.setDate(upcomingDate.getDate() + 7);
    
    const upcomingSchedules = schedules.filter(s => {
      if (s.busId !== busId) return false;
      const departureDate = new Date(s.departureDateTime);
      return departureDate >= tomorrow && departureDate < upcomingDate && s.isActive;
    });

    const allSchedules = [...todaySchedules, ...upcomingSchedules];
    const drivers = [...new Set(allSchedules.map(s => s.driver).filter(Boolean))];
    const conductorsAssigned = [...new Set(allSchedules.map(s => s.conductor).filter(Boolean))];

    return {
      todaySchedules: todaySchedules.length,
      upcomingSchedules: upcomingSchedules.length,
      drivers: drivers.slice(0, 2) as string[],
      conductors: conductorsAssigned.slice(0, 2) as string[],
      hasAssignments: todaySchedules.length > 0 || upcomingSchedules.length > 0
    };
  }, [schedules]);

  const addBus = async (data: NewBusState) => {
  setActionLoading(true);
  try {
    const busData = {
      licensePlate: data.licensePlate,
      busType: data.busType,
      capacity: data.capacity,
      amenities: data.amenities || [],
      companyId: companyId,
      status: data.status,
      fuelType: data.fuelType,
      yearOfManufacture: data.yearOfManufacture || new Date().getFullYear(),
      registrationDetails: {
        registrationNumber: data.registrationNumber || 'Pending',
        registrationDate: new Date(),
        expiryDate: data.registrationExpiry ? new Date(data.registrationExpiry) : new Date(),
        authority: 'Road Traffic Directorate',
      },
      insuranceDetails: {
        provider: 'General Insurance',
        policyNumber: 'Pending',
        expiryDate: data.insuranceExpiry ? new Date(data.insuranceExpiry) : new Date(),
      },
      lastMaintenanceDate: data.lastMaintenanceDate ? new Date(data.lastMaintenanceDate) : new Date(),
      nextMaintenanceDate: data.nextMaintenanceDate ? new Date(data.nextMaintenanceDate) : new Date(),
      conductorIds: data.conductorIds || [],
    };
    
    const result = await dbActions.createBus(busData);
    if (!result.success) throw new Error(result.error);
    
    setBuses([...buses, result.data as unknown as Bus]);
    return result.data!.id;
  } catch (err: any) {
    setError(`Failed to add bus: ${err.message}`);
    return null;
  } finally {
    setActionLoading(false);
  }
};

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!canAddBus) {
      setShowUpgradeModal(true);
      return;
    }
    
    if (newBus.capacity < 10 || newBus.capacity > 100) {
      setError("Capacity must be between 10 and 100");
      return;
    }
    if (!newBus.licensePlate || !newBus.busType) {
      setError("License Plate and Bus Type are required");
      return;
    }
    
    if (!newBus.registrationNumber || newBus.registrationNumber.trim() === '') {
      setError("Vehicle Registration Number is required for authentication");
      return;
    }

    if (newBus.conductorIds.length > 2) {
      setError("Maximum 2 conductors allowed per bus");
      return;
    }
    
    const result = await addBus(newBus);
    if (result) {
      setNewBus(initialNewBus);
      setShowAddModal(false);
      setSuccess("Bus added successfully!");
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBus) return;

    if (editBus.capacity < 10 || editBus.capacity > 100) {
      setError("Please provide a valid capacity between 10 and 100");
      return;
    }
    
    if (!editBus.registrationDetails?.registrationNumber || 
        editBus.registrationDetails.registrationNumber.trim() === '') {
      setError("Vehicle Registration Number is required");
      return;
    }

    if (editBus.conductorIds && editBus.conductorIds.length > 2) {
      setError("Maximum 2 conductors allowed per bus");
      return;
    }
    
    setActionLoading(true);
    try {
      const { id, ...updatedData } = editBus;
      const result = await dbActions.updateBus(id, { ...updatedData, updatedAt: new Date() });
      if (!result.success) throw new Error(result.error);

      setBuses(buses.map((b) => (b.id === editBus.id ? result.data as unknown as Bus : b)));
      
      setShowEditModal(false);
      setEditBus(null);
      setSuccess("Bus updated successfully!");
    } catch (err: any) {
      setError(`Failed to update bus: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this bus?")) return;
    
    setActionLoading(true);
    try {
      const result = await dbActions.deleteBus(id);
      if (!result.success) throw new Error(result.error);
      
      setBuses(buses.filter((b) => b.id !== id));
      setSuccess("Bus deleted successfully!");
    } catch (err: any) {
      setError(`Failed to delete bus: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddClick = () => {
    if (!canAddBus) {
      setShowUpgradeModal(true);
    } else {
      setShowAddModal(true);
    }
  };

  const handleViewDetails = (bus: Bus) => {
    setSelectedBusForDetails(bus);
    setShowBusDetailsModal(true);
  };

  return (
    <div className="space-y-6 px-2 sm:px-0">
      {/* Free Tier Warning Banner */}
      {subscriptionTier === 'free' && buses.length >= FREE_TIER_LIMIT - 1 && (
        <div className={`rounded-xl p-4 border-2 ${
          buses.length >= FREE_TIER_LIMIT 
            ? 'bg-red-50 border-red-300' 
            : 'bg-yellow-50 border-yellow-300'
        }`}>
          <div className="flex flex-col sm:flex-row items-start gap-3">
            {buses.length >= FREE_TIER_LIMIT ? (
              <Lock className="w-5 h-5 text-red-600 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
            )}
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">
                {buses.length >= FREE_TIER_LIMIT 
                  ? 'Bus Limit Reached' 
                  : `${remainingSlots} Bus Slot${remainingSlots !== 1 ? 's' : ''} Remaining`}
              </h3>
              <p className="text-sm text-gray-700 mt-1">
                {buses.length >= FREE_TIER_LIMIT 
                  ? `You've reached the free tier limit of ${FREE_TIER_LIMIT} buses. Upgrade for more.`
                  : `Free tier includes ${FREE_TIER_LIMIT} buses. Add ${remainingSlots} more or upgrade.`}
              </p>
            </div>
            <Button
              onClick={() => setShowUpgradeModal(true)}
              className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-blue-600 text-white"
            >
              <Crown className="w-4 h-4 mr-2" />
              Upgrade
            </Button>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-5">
        {[
          { label: "TOTAL FLEET", value: stats.total, icon: Truck, iconColor: "text-indigo-900", iconBg: "bg-indigo-50", limit: subscriptionTier === 'free' ? `Max ${FREE_TIER_LIMIT}` : null },
          { label: "OPERATIONAL", value: stats.active, icon: CheckCircle, iconColor: "text-green-700", iconBg: "bg-green-50" },
          { label: "INACTIVE", value: stats.inactive, icon: XCircle, iconColor: "text-gray-500", iconBg: "bg-gray-100" },
          { label: "MAINTENANCE", value: stats.maintenance, icon: Wrench, iconColor: "text-red-500", iconBg: "bg-red-50" },
          { label: "CAPACITY", value: `${stats.totalCapacity} SEATS`, icon: Users, iconColor: "text-purple-700", iconBg: "bg-purple-50" },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm p-5 relative overflow-hidden flex flex-col justify-between min-h-[120px] border border-gray-100">
             <div className="flex justify-between items-start mb-3">
                <div className={`p-2 rounded-lg ${s.iconBg}`}>
                   <s.icon className={`w-5 h-5 ${s.iconColor}`} />
                </div>
                {s.limit && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-700">{s.limit}</span>}
             </div>
             <div className="mt-auto">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{s.label}</p>
                <p className="text-xl sm:text-2xl font-extrabold text-gray-900 leading-none">{s.value}</p>
             </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 py-4 px-4 sm:px-6">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto flex-1 max-w-4xl">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search buses..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:bg-white outline-none text-[13px] font-bold text-gray-700"
              />
            </div>
            <div className="flex gap-2">
               <select
                 value={filterStatus}
                 onChange={e => setFilterStatus(e.target.value as any)}
                 className="flex-1 sm:flex-none py-2.5 px-3 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-black text-gray-500 uppercase tracking-wider outline-none"
               >
                 <option value="all">Status</option>
                 <option value="active">Active</option>
                 <option value="inactive">Inactive</option>
                 <option value="maintenance">Maintenance</option>
               </select>

               <select
                 value={filterConductor}
                 onChange={e => setFilterConductor(e.target.value)}
                 className="flex-1 sm:flex-none py-2.5 px-3 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-black text-gray-500 uppercase tracking-wider outline-none"
               >
                 <option value="all">Personnel</option>
                 {conductors.map(c => (
                   <option key={c.id} value={c.id}>{c.name}</option>
                 ))}
               </select>
            </div>
          </div>
          
          <Button 
            onClick={handleAddClick}
            className="bg-indigo-600 text-white hover:bg-indigo-700 flex items-center justify-center gap-2 rounded-xl text-[10px] font-black uppercase tracking-widest px-8 py-6 shadow-lg shadow-indigo-100 active:scale-95 w-full lg:w-auto"
            disabled={actionLoading}
          >
            {!canAddBus && <Lock className="w-4 h-4" />}
            <Plus className="w-4 h-4" />
            Register Vessel
          </Button>
        </div>
      </div>

      {/* Buses Grid */}
      {filteredBuses.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 sm:p-16 text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <Truck className="w-8 h-8 sm:w-10 sm:h-10 text-indigo-900" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">
            {buses.length === 0 ? 'Fleet is Empty' : 'No matches found'}
          </h3>
          <p className="text-sm font-medium text-gray-500 mb-6 max-w-md mx-auto">
            Add vehicles to begin assigning routes and tracking performance.
          </p>
          {buses.length === 0 && canAddBus && (
            <Button 
              onClick={() => setShowAddModal(true)}
              className="bg-indigo-900 text-white font-bold"
            >
              <Plus className="w-4 h-4 mr-2" /> Register First Bus
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredBuses.map(bus => {
            const isMaintenance = bus.status === 'maintenance';
            
            return (
              <div key={bus.id} className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden flex flex-col hover:shadow-xl transition-all duration-500 group">
                <div className="h-32 sm:h-40 bg-slate-50 relative flex items-center justify-center border-b border-gray-50">
                   <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#6366f1 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
                   
                   <div className="relative z-10 w-20 h-20 sm:w-24 sm:h-24 bg-white/80 backdrop-blur-md rounded-[2rem] shadow-sm flex items-center justify-center border border-white/50 text-indigo-600 group-hover:scale-110 transition-transform duration-500">
                      <Truck className="w-8 h-8 sm:w-10 sm:h-10" />
                   </div>
                   
                   <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-xl shadow-sm border border-white/50">
                      <span className="text-[9px] font-black text-gray-900 tracking-widest uppercase">ID: {bus.id.substring(0,6)}</span>
                   </div>

                   <div className="absolute top-4 right-4">
                      <span className={`px-3 py-1 text-[9px] uppercase font-black tracking-widest rounded-xl border shadow-sm ${
                         bus.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                         isMaintenance ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-gray-50 text-gray-700 border-gray-100'
                      }`}>{bus.status}</span>
                   </div>
                </div>

                <div className="p-5 sm:p-6 flex-1 flex flex-col">
                  <div className="mb-6 text-left">
                    <h3 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight mb-1 group-hover:text-indigo-600 transition-colors uppercase">{bus.licensePlate}</h3>
                    <div className="flex items-center gap-2">
                       <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg uppercase tracking-widest border border-indigo-100">{bus.busType}</span>
                       <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">REG: {bus.registrationDetails?.registrationNumber || 'PENDING'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 sm:gap-6 mb-6 text-left">
                    <div>
                      <p className="text-[9px] text-gray-400 font-bold tracking-widest mb-1 uppercase">CAPACITY</p>
                      <p className="text-sm font-black text-gray-900">{bus.capacity} <span className="text-[9px] text-gray-400 uppercase ml-0.5">SEATS</span></p>
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-400 font-bold tracking-widest mb-1 uppercase">FUEL SYSTEM</p>
                      <p className="text-sm font-black text-gray-900 uppercase">{bus.fuelType || 'Diesel'}</p>
                    </div>
                  </div>

                  <div className="mb-6 text-left">
                     <p className="text-[9px] text-gray-400 font-bold tracking-widest mb-3 uppercase">CREW</p>
                     {bus.conductorIds && bus.conductorIds.length > 0 ? (
                        <div className="flex flex-col gap-2">
                           {getConductorNames(bus.conductorIds).map((name, idx) => (
                              <div key={idx} className="flex items-center gap-3">
                                 <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-[10px] font-black text-indigo-600 border border-indigo-100">
                                    {name.substring(0, 1)}
                                 </div>
                                 <span className="text-xs font-bold text-gray-900">{name}</span>
                              </div>
                           ))}
                        </div>
                     ) : (
                        <p className="text-[10px] font-bold text-gray-300 uppercase italic">No Crew Assigned</p>
                     )}
                  </div>

                  <div className="mt-auto pt-6 border-t border-gray-50 flex gap-2">
                     <button
                       onClick={() => handleViewDetails(bus)}
                       className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-gray-50 text-gray-700 hover:bg-gray-100 rounded-xl transition-all text-[9px] font-black uppercase tracking-widest"
                     >
                       <Eye className="w-4 h-4" /> Insight
                     </button>
                     <button
                       onClick={() => { setEditBus(bus); setShowEditModal(true); }} 
                       className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-xl transition-all text-[9px] font-black uppercase tracking-widest border border-indigo-100"
                       disabled={actionLoading}
                     >
                       <Edit3 className="w-4 h-4" /> Edit
                     </button>
                     <button
                        onClick={() => handleDelete(bus.id)} 
                        className="px-3 py-2.5 text-rose-600 bg-rose-50 hover:bg-rose-600 hover:text-white rounded-xl transition-all border border-rose-100"
                        disabled={actionLoading}
                     >
                        <Trash2 className="w-4 h-4" />
                     </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Bus">
        <form onSubmit={handleAdd} className="space-y-4 sm:space-y-6 p-1 text-left">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">License Plate</label>
              <input
                type="text"
                value={newBus.licensePlate}
                onChange={(e) => setNewBus({ ...newBus, licensePlate: e.target.value })}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm"
                placeholder="e.g., BT 1234"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Registration #</label>
              <input
                type="text"
                value={newBus.registrationNumber}
                onChange={(e) => setNewBus({ ...newBus, registrationNumber: e.target.value })}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm"
                placeholder="e.g., MW-2024-01"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Bus Type</label>
              <select
                value={newBus.busType}
                onChange={(e) => setNewBus({ ...newBus, busType: e.target.value as BusType })}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm"
                required
              >
                <option value="AC">AC</option>
                <option value="Non-AC">Non-AC</option>
                <option value="Luxury">Luxury</option>
                <option value="Economy">Economy</option>
                <option value="Minibus">Minibus</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Capacity</label>
              <input
                type="number"
                value={newBus.capacity}
                onChange={(e) => setNewBus({ ...newBus, capacity: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm"
                required
                min="10"
                max="100"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6">
            <Button type="button" onClick={() => setShowAddModal(false)} variant="outline">Cancel</Button>
            <Button type="submit" disabled={actionLoading} className="bg-indigo-600 text-white">
              {actionLoading ? "Registering..." : "Register Bus"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default BusesTab;
