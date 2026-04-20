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
    <div className="space-y-6">
      {/* Free Tier Warning Banner */}
      {subscriptionTier === 'free' && buses.length >= FREE_TIER_LIMIT - 1 && (
        <div className={`rounded-xl p-4 border-2 ${
          buses.length >= FREE_TIER_LIMIT 
            ? 'bg-red-50 border-red-300' 
            : 'bg-yellow-50 border-yellow-300'
        }`}>
          <div className="flex items-start gap-3">
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
                  ? `You've reached the free tier limit of ${FREE_TIER_LIMIT} buses. Upgrade to Premium for unlimited buses and advanced features.`
                  : `Free tier includes ${FREE_TIER_LIMIT} buses. Add ${remainingSlots} more or upgrade for unlimited buses.`}
              </p>
            </div>
            <Button
              onClick={() => setShowUpgradeModal(true)}
              className="bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700"
            >
              <Crown className="w-4 h-4 mr-2" />
              Upgrade
            </Button>
          </div>
        </div>
      )}

      {/* Stats Cards - Kinetic Admin Style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        {[
          { label: "TOTAL FLEET", value: stats.total, icon: Truck, iconColor: "text-indigo-900", iconBg: "bg-indigo-50", limit: subscriptionTier === 'free' ? `Max ${FREE_TIER_LIMIT}` : null },
          { label: "ACTIVE & ON ROUTE", value: stats.active, icon: CheckCircle, iconColor: "text-green-700", iconBg: "bg-green-50" },
          { label: "IDLE / INACTIVE", value: stats.inactive, icon: XCircle, iconColor: "text-gray-500", iconBg: "bg-gray-100" },
          { label: "IN MAINTENANCE", value: stats.maintenance, icon: Wrench, iconColor: "text-red-500", iconBg: "bg-red-50" },
          { label: "NETWORK CAPACITY", value: `${stats.totalCapacity} SEATS`, icon: Users, iconColor: "text-purple-700", iconBg: "bg-purple-50" },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] p-5 relative overflow-hidden flex flex-col justify-between min-h-[120px] border border-gray-100">
             <div className="flex justify-between items-start mb-3">
                <div className={`p-2 rounded-lg ${s.iconBg}`}>
                   <s.icon className={`w-5 h-5 ${s.iconColor}`} />
                </div>
                {s.limit && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-700">{s.limit}</span>}
             </div>
             <div className="mt-auto">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">{s.label}</p>
                <p className="text-2xl font-extrabold text-gray-900 leading-none">{s.value}</p>
             </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl shadow-[0_8px_30px_-10px_rgba(0,0,0,0.05)] border border-gray-100 py-4 px-6">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-3 w-full lg:w-auto flex-1 max-w-4xl">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search buses, registration, amenities..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:bg-white outline-none text-[13px] font-bold text-gray-700 transition-all placeholder-gray-400"
              />
            </div>
            <div className="flex gap-3">
               <select
                 value={filterStatus}
                 onChange={e => setFilterStatus(e.target.value as any)}
                 className="py-2 px-3 bg-gray-50 border border-gray-100 rounded-xl text-[11px] font-black text-gray-500 uppercase tracking-wider outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all cursor-pointer"
               >
                 <option value="all">Global Lifecycle</option>
                 <option value="active">Operational</option>
                 <option value="inactive">Decommissioned</option>
                 <option value="maintenance">Maintenance</option>
               </select>

               <select
                 value={filterConductor}
                 onChange={e => setFilterConductor(e.target.value)}
                 className="py-2 px-3 bg-gray-50 border border-gray-100 rounded-xl text-[11px] font-black text-gray-500 uppercase tracking-wider outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all cursor-pointer"
               >
                 <option value="all">All Personnel</option>
                 {conductors.map(c => (
                   <option key={c.id} value={c.id}>{c.name}</option>
                 ))}
               </select>
            </div>
          </div>
          
          <Button 
            onClick={handleAddClick}
            className="bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-2 rounded-xl text-[11px] font-black uppercase tracking-widest px-6 py-5 shadow-lg shadow-indigo-100 active:scale-95 transition-all w-full lg:w-auto"
            disabled={actionLoading}
          >
            {!canAddBus && <Lock className="w-4 h-4" />}
            <Plus className="w-4 h-4" />
            Vessel Registration
          </Button>
        </div>
      </div>

      {/* Buses Grid */}
      {filteredBuses.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-16 text-center">
          <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <Truck className="w-10 h-10 text-indigo-900" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {buses.length === 0 ? 'Fleet is Empty' : 'No matches found'}
          </h3>
          <p className="text-sm font-medium text-gray-500 mb-6 max-w-md mx-auto">
            {searchTerm || filterStatus !== 'all'
              ? 'Try adjusting your search criteria.' 
              : 'Add your first vehicle to the registry to begin assigning routes and tracking performance.'}
          </p>
          {buses.length === 0 && canAddBus && (
            <Button 
              onClick={() => setShowAddModal(true)}
              className="bg-indigo-900 text-white hover:bg-indigo-800 font-bold"
            >
              <Plus className="w-4 h-4 mr-2" /> Register First Bus
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredBuses.map(bus => {
            const isMaintenance = bus.status === 'maintenance';
            
            return (
              <div key={bus.id} className="bg-white rounded-3xl border border-gray-100 overflow-hidden flex flex-col hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.08)] transition-all duration-500 group">
                {/* Image/Icon Header Area - Kinetic Glassmorphism */}
                <div className="h-40 bg-slate-50 relative flex items-center justify-center border-b border-gray-50 overflow-hidden">
                   <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#6366f1 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
                   <div className="absolute -right-8 -top-8 w-32 h-32 bg-indigo-600/5 rounded-full blur-3xl group-hover:bg-indigo-600/10 transition-colors"></div>
                   
                   <div className="relative z-10 w-24 h-24 bg-white/80 backdrop-blur-md rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex items-center justify-center border border-white/50 text-indigo-600 group-hover:scale-110 transition-transform duration-500">
                      <Truck className="w-10 h-10" />
                   </div>
                   
                   <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-2xl shadow-sm border border-white/50">
                      <span className="text-[10px] font-black text-gray-900 tracking-widest uppercase">UNIT ID: {bus.id.substring(0,6)}</span>
                   </div>

                   <div className="absolute top-4 right-4">
                      <span className={`px-3 py-1.5 text-[10px] uppercase font-black tracking-widest rounded-2xl border shadow-sm ${
                         bus.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                         isMaintenance ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-gray-50 text-gray-700 border-gray-100'
                      }`}>{bus.status}</span>
                   </div>
                </div>

                <div className="p-6 flex-1 flex flex-col">
                  {/* Title & Basics */}
                  <div className="mb-6">
                    <h3 className="text-2xl font-black text-gray-900 tracking-tight mb-1 group-hover:text-indigo-600 transition-colors uppercase">{bus.licensePlate}</h3>
                    <div className="flex items-center gap-3">
                       <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-xl uppercase tracking-widest border border-indigo-100">{bus.busType}</span>
                       <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">REG: {bus.registrationDetails?.registrationNumber || 'PENDING'}</span>
                    </div>
                  </div>

                  {/* Core Data Grid */}
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold tracking-widest mb-1 uppercase">MAX PAYLOAD</p>
                      <p className="text-sm font-black text-gray-900">{bus.capacity} <span className="text-[10px] text-gray-400 uppercase ml-0.5">SEATS</span></p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold tracking-widest mb-1 uppercase">FUEL SYSTEM</p>
                      <p className="text-sm font-black text-gray-900 uppercase">{bus.fuelType || 'Diesel'}</p>
                    </div>
                  </div>

                  {/* Default Crew / Conductor section */}
                  <div className="mb-6">
                     <p className="text-[10px] text-gray-400 font-bold tracking-widest mb-3 uppercase">ASSIGNED PERSONNEL</p>
                     {bus.conductorIds && bus.conductorIds.length > 0 ? (
                        <div className="flex flex-col gap-2.5">
                           {getConductorNames(bus.conductorIds).map((name, idx) => (
                              <div key={idx} className="flex items-center gap-3 group/person">
                                 <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-[11px] font-black text-indigo-600 border border-indigo-100 group-hover/person:bg-indigo-600 group-hover/person:text-white transition-all">
                                    {name.substring(0, 1)}
                                 </div>
                                 <span className="text-[13px] font-bold text-gray-900">{name}</span>
                              </div>
                           ))}
                        </div>
                     ) : (
                        <div className="py-3 px-4 bg-gray-50 border border-dashed border-gray-200 rounded-2xl">
                           <p className="text-[10px] font-bold text-gray-400 uppercase text-center">No Crew Assigned</p>
                        </div>
                     )}
                  </div>

                  <div className="mt-auto pt-6 border-t border-gray-50 flex gap-2">
                     <button
                       onClick={() => handleViewDetails(bus)}
                       className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-50 text-gray-700 hover:bg-gray-100 rounded-2xl transition-all text-[11px] font-black uppercase tracking-widest"
                     >
                       <Eye className="w-4 h-4" /> Insight
                     </button>
                     <button
                       onClick={() => { setEditBus(bus); setShowEditModal(true); }} 
                       className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-2xl transition-all text-[11px] font-black uppercase tracking-widest border border-indigo-100"
                       disabled={actionLoading}
                     >
                       <Edit3 className="w-4 h-4" /> Edit
                     </button>
                     <button
                        onClick={() => handleDelete(bus.id)} 
                        className="px-4 py-3 text-rose-600 bg-rose-50 hover:bg-rose-600 hover:text-white rounded-2xl transition-all border border-rose-100"
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
        <form onSubmit={handleAdd} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                License Plate <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newBus.licensePlate}
                onChange={(e) => setNewBus({ ...newBus, licensePlate: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., BT 1234"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vehicle Registration Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newBus.registrationNumber}
                onChange={(e) => setNewBus({ ...newBus, registrationNumber: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., MW-BT-2024-001"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Required for authentication purposes</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bus Type <span className="text-red-500">*</span>
              </label>
              <select
                value={newBus.busType}
                onChange={(e) => setNewBus({ ...newBus, busType: e.target.value as BusType })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="AC">AC</option>
                <option value="Non-AC">Non-AC</option>
                <option value="Sleeper">Sleeper</option>
                <option value="Semi-Sleeper">Semi-Sleeper</option>
                <option value="Luxury">Luxury</option>
                <option value="Economy">Economy</option>
                <option value="Minibus">Minibus</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Capacity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={newBus.capacity}
                onChange={(e) => setNewBus({ ...newBus, capacity: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                min="10"
                max="100"
                placeholder="40"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fuel Type</label>
              <select
                value={newBus.fuelType}
                onChange={(e) => setNewBus({ ...newBus, fuelType: e.target.value as FuelType })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="diesel">Diesel</option>
                <option value="petrol">Petrol</option>
                <option value="electric">Electric</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Year of Manufacture</label>
              <input
                type="number"
                value={newBus.yearOfManufacture ?? ''}
                onChange={(e) => {
                  const val = e.target.value ? parseInt(e.target.value) : undefined;
                  setNewBus({ ...newBus, yearOfManufacture: val });
                }}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min="1990"
                max={new Date().getFullYear() + 1}
                placeholder="2020"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amenities <span className="text-gray-500 font-normal">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={newBus.amenities.join(",")}
              onChange={(e) =>
                setNewBus({ ...newBus, amenities: e.target.value.split(",").map((a) => a.trim()).filter((a) => a) })
              }
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="WiFi, AC, USB Charging, Reclining Seats"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assign Conductors (max 2)
            </label>
            {loadingConductors ? (
              <div className="text-sm text-gray-500 italic">Loading available conductors...</div>
            ) : conductors.length === 0 ? (
              <div className="text-sm text-amber-700 bg-amber-50 p-3 rounded">
                No active conductors found for your company. Add conductors in the staff/users section first.
              </div>
            ) : (
              <>
                <select
                  multiple
                  value={newBus.conductorIds}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, opt => opt.value);
                    if (selected.length > 2) {
                      setError("Maximum 2 conductors allowed per bus");
                      return;
                    }
                    setNewBus({ ...newBus, conductorIds: selected });
                  }}
                  className="w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 h-28 p-2 text-sm scrollbar-thin"
                >
                  {conductors.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1.5">
                  Hold Ctrl (Windows) or Cmd (Mac) to select multiple. Max 2.
                </p>
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status <span className="text-red-500">*</span>
            </label>
            <select
              value={newBus.status}
              onChange={(e) => setNewBus({ ...newBus, status: e.target.value as BusStatus })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t">
            <Button 
              type="button" 
              onClick={() => setShowAddModal(false)} 
              variant="outline"
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={actionLoading}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {actionLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Bus
                </>
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Bus">
        {editBus && (
          <form onSubmit={handleEdit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  License Plate <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editBus.licensePlate}
                  onChange={(e) => setEditBus({ ...editBus, licensePlate: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vehicle Registration Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editBus.registrationDetails?.registrationNumber || ''}
                  onChange={(e) => setEditBus({ 
                    ...editBus, 
                    registrationDetails: {
                      ...editBus.registrationDetails,
                      registrationNumber: e.target.value,
                      registrationDate: editBus.registrationDetails?.registrationDate || new Date(),
                      expiryDate: editBus.registrationDetails?.expiryDate || new Date(),
                      authority: editBus.registrationDetails?.authority || 'Road Traffic Directorate'
                    }
                  })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Required for authentication purposes</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bus Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={editBus.busType}
                  onChange={(e) => setEditBus({ ...editBus, busType: e.target.value as BusType })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="AC">AC</option>
                  <option value="Non-AC">Non-AC</option>
                  <option value="Sleeper">Sleeper</option>
                  <option value="Semi-Sleeper">Semi-Sleeper</option>
                  <option value="Luxury">Luxury</option>
                  <option value="Economy">Economy</option>
                  <option value="Minibus">Minibus</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Capacity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={editBus.capacity}
                  onChange={(e) => setEditBus({ ...editBus, capacity: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  min="10"
                  max="100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fuel Type</label>
                <select
                  value={editBus.fuelType || 'diesel'}
                  onChange={(e) => setEditBus({ ...editBus, fuelType: e.target.value as FuelType })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="diesel">Diesel</option>
                  <option value="petrol">Petrol</option>
                  <option value="electric">Electric</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Year of Manufacture</label>
                <input
                  type="number"
                  // If the value is undefined or null, show an empty string in the input
                  value={editBus.yearOfManufacture ?? ''} 
                  onChange={(e) => {
                    // Parse the value; if it's empty, use a default (like the current year) 
                    // or keep the previous value to satisfy the 'number' requirement.
                    const val = e.target.value ? parseInt(e.target.value) : new Date().getFullYear();
                    
                    setEditBus({ 
                      ...editBus, 
                      yearOfManufacture: val // This is now guaranteed to be a number
                    });
                  }}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="1990"
                  max={new Date().getFullYear() + 1}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amenities <span className="text-gray-500 font-normal">(comma-separated)</span>
              </label>
              <input
                type="text"
                value={editBus.amenities?.join(",") || ''}
                onChange={(e) =>
                  setEditBus({ ...editBus, amenities: e.target.value.split(",").map((a) => a.trim()).filter((a) => a) })
                }
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assign Conductors (max 2)
              </label>
              {loadingConductors ? (
                <div className="text-sm text-gray-500 italic">Loading...</div>
              ) : conductors.length === 0 ? (
                <div className="text-sm text-amber-700 bg-amber-50 p-3 rounded">
                  No active conductors available.
                </div>
              ) : (
                <>
                  <select
                    multiple
                    value={editBus.conductorIds || []}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, opt => opt.value);
                      if (selected.length > 2) {
                        setError("Maximum 2 conductors allowed per bus");
                        return;
                      }
                      setEditBus({ ...editBus, conductorIds: selected });
                    }}
                    className="w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 h-28 p-2 text-sm scrollbar-thin"
                  >
                    {conductors.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1.5">
                    Hold Ctrl/Cmd to select multiple (max 2).
                  </p>
                </>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                value={editBus.status}
                onChange={(e) => setEditBus({ ...editBus, status: e.target.value as BusStatus })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>

            <div className="flex justify-end space-x-3 pt-6 border-t">
              <Button 
                type="button" 
                onClick={() => {
                  setShowEditModal(false);
                  setEditBus(null);
                }} 
                variant="outline"
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={actionLoading}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                {actionLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Updating...
                  </>
                ) : (
                  <>
                    <Edit3 className="w-4 h-4 mr-2" />
                    Update Bus
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Bus Details Modal */}
      <Modal 
        isOpen={showBusDetailsModal} 
        onClose={() => {
          setShowBusDetailsModal(false);
          setSelectedBusForDetails(null);
        }} 
        title="Bus Details"
      >
        {selectedBusForDetails && (
          <div className="space-y-6">
            <div className="flex items-start justify-between pb-4 border-b">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-1">
                  {selectedBusForDetails.licensePlate}
                </h3>
                <p className="text-gray-600">{selectedBusForDetails.busType}</p>
              </div>
              <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                selectedBusForDetails.status === 'active' 
                  ? 'bg-green-100 text-green-800' 
                  : selectedBusForDetails.status === 'maintenance'
                  ? 'bg-orange-100 text-orange-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {selectedBusForDetails.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Capacity</p>
                <p className="text-xl font-bold text-gray-900">{selectedBusForDetails.capacity} seats</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Fuel Type</p>
                <p className="text-xl font-bold text-gray-900 capitalize">{selectedBusForDetails.fuelType || 'diesel'}</p>
              </div>
              {selectedBusForDetails.yearOfManufacture && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Year</p>
                  <p className="text-xl font-bold text-gray-900">{selectedBusForDetails.yearOfManufacture}</p>
                </div>
              )}
            </div>

            {selectedBusForDetails.registrationDetails && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Registration Details
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Registration Number:</span>
                    <span className="font-medium text-gray-900">
                      {selectedBusForDetails.registrationDetails.registrationNumber}
                    </span>
                  </div>
                  {selectedBusForDetails.registrationDetails.expiryDate && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Expiry Date:</span>
                      <span className="font-medium text-gray-900">
                        {new Date(selectedBusForDetails.registrationDetails.expiryDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Authority:</span>
                    <span className="font-medium text-gray-900">
                      {selectedBusForDetails.registrationDetails.authority}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {selectedBusForDetails.conductorIds && selectedBusForDetails.conductorIds.length > 0 && (
              <div className="mt-6">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <User className="w-5 h-5 text-indigo-600" />
                  Default Assigned Conductors
                </h4>
                <div className="flex flex-wrap gap-2">
                  {getConductorNames(selectedBusForDetails.conductorIds).map((name, idx) => (
                    <span 
                      key={idx}
                      className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium border border-indigo-200"
                    >
                      {name}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Primary/regular conductors for this bus (max 2). Can be overridden per trip.
                </p>
              </div>
            )}

            {selectedBusForDetails.amenities && selectedBusForDetails.amenities.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Amenities</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedBusForDetails.amenities.map((amenity, idx) => (
                    <span key={idx} className="px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-lg border border-blue-200">
                      {amenity}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowBusDetailsModal(false);
                  setSelectedBusForDetails(null);
                }}
                className="flex-1"
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  setEditBus(selectedBusForDetails);
                  setShowBusDetailsModal(false);
                  setShowEditModal(true);
                }}
                className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
              >
                <Edit3 className="w-4 h-4 mr-2" />
                Edit Bus
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Upgrade Modal */}
      <Modal 
        isOpen={showUpgradeModal} 
        onClose={() => setShowUpgradeModal(false)} 
        title="Upgrade to Premium"
      >
        <div className="space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Crown className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Unlock Unlimited Buses
            </h3>
            <p className="text-gray-600">
              You've reached the free tier limit of {FREE_TIER_LIMIT} buses. Upgrade to add unlimited buses and access premium features.
            </p>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-6 border border-purple-200">
            <h4 className="font-semibold text-gray-900 mb-4">Premium Features:</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <span className="text-gray-700">Unlimited buses in your fleet</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <span className="text-gray-700">Advanced analytics and reporting</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <span className="text-gray-700">Priority customer support</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <span className="text-gray-700">Maintenance tracking & reminders</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <span className="text-gray-700">Multi-user access</span>
              </li>
            </ul>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowUpgradeModal(false)}
              className="flex-1"
            >
              Maybe Later
            </Button>
            <Button
              onClick={() => {
                window.location.href = 'mailto:support@busops.com?subject=Premium Upgrade Request';
              }}
              className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700"
            >
              <Crown className="w-4 h-4 mr-2" />
              Contact Admin
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default BusesTab;
