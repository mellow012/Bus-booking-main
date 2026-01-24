import { FC, useState, useMemo, useCallback } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { Bus, BusType, BusStatus } from "@/types";
import Modal from "@/components/Modals";
import { db } from "@/lib/firebaseConfig";
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
  TrendingUp,
  Clock,
  DollarSign,
  Activity,
  Eye,
  MapPin,
  BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";

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
  fuelType?: string;
  yearOfManufacture?: number;
}

interface BusesTabProps {
  buses: Bus[];
  setBuses: React.Dispatch<React.SetStateAction<Bus[]>>;
  companyId: string;
  setError: (msg: string) => void;
  setSuccess: (msg: string) => void;
  // Add subscription tier prop
  subscriptionTier?: 'free' | 'premium' | 'enterprise';
  // Add schedules and bookings for metrics
  schedules?: any[];
  bookings?: any[];
}

const FREE_TIER_LIMIT = 3;

const BusesTab: FC<BusesTabProps> = ({ 
  buses, 
  setBuses, 
  companyId, 
  setError, 
  setSuccess,
  subscriptionTier = 'free', // Default to free tier
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
  const [actionLoading, setActionLoading] = useState(false);

  const initialNewBus: NewBusState = {
    licensePlate: "",
    busType: "AC",
    capacity: 40,
    amenities: [],
    companyId,
    status: "active",
    registrationNumber: "",
    fuelType: "Diesel",
  };
  
  const [newBus, setNewBus] = useState<NewBusState>(initialNewBus);

  // Check if user can add more buses
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

  // Calculate bus performance metrics
  const getBusMetrics = useCallback((busId: string) => {
    // Active schedules using this bus
    const activeSchedules = schedules.filter(s => 
      s.busId === busId && s.isActive && new Date(s.departureDateTime) > new Date()
    );

    // All schedules (for total trips)
    const allSchedules = schedules.filter(s => s.busId === busId);

    // Bookings for this bus
    const busScheduleIds = allSchedules.map(s => s.id);
    const busBookings = bookings.filter(b => busScheduleIds.includes(b.scheduleId));

    // Revenue calculation
    const totalRevenue = busBookings
      .filter(b => b.paymentStatus === 'paid')
      .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

    // Occupancy rate calculation
    const completedSchedules = allSchedules.filter(s => {
      const departureDate = new Date(s.departureDateTime);
      return departureDate < new Date();
    });

    const totalSeatsAvailable = completedSchedules.reduce((sum, s) => sum + (s.availableSeats || 0), 0);
    const totalSeatsBooked = busBookings.filter(b => {
      const schedule = allSchedules.find(s => s.id === b.scheduleId);
      if (!schedule) return false;
      const departureDate = new Date(schedule.departureDateTime);
      return departureDate < new Date();
    }).reduce((sum, b) => sum + (b.seatNumbers?.length || 0), 0);

    const occupancyRate = totalSeatsAvailable > 0 
      ? (totalSeatsBooked / totalSeatsAvailable) * 100 
      : 0;

    return {
      activeSchedules: activeSchedules.length,
      totalTrips: allSchedules.length,
      completedTrips: completedSchedules.length,
      totalBookings: busBookings.length,
      totalRevenue,
      occupancyRate: Math.round(occupancyRate),
      upcomingSchedules: activeSchedules.slice(0, 3) // Next 3 trips
    };
  }, [schedules, bookings]);

  const filteredBuses = useMemo(() => {
    let filtered = buses.filter(b =>
      b.licensePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.busType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.amenities?.some(a => a.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (filterStatus !== 'all') {
      filtered = filtered.filter(b => b.status === filterStatus);
    }

    return filtered;
  }, [buses, searchTerm, filterStatus]);

  const addBus = async (data: NewBusState) => {
    setActionLoading(true);
    try {
      const busData = {
        ...data,
        registrationDetails: {
          registrationNumber: data.registrationNumber || 'Pending',
          registrationDate: new Date(),
          expiryDate: data.registrationExpiry ? new Date(data.registrationExpiry) : new Date(),
          authority: 'Road Traffic Directorate',
        },
        insuranceExpiry: data.insuranceExpiry ? new Date(data.insuranceExpiry) : undefined,
        lastMaintenanceDate: data.lastMaintenanceDate ? new Date(data.lastMaintenanceDate) : undefined,
        nextMaintenanceDate: data.nextMaintenanceDate ? new Date(data.nextMaintenanceDate) : undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const docRef = await addDoc(collection(db, "buses"), busData as Omit<Bus, 'id'>);
      setBuses([...buses, { id: docRef.id, ...busData }] as Bus[]);
      return docRef.id;
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
    
    const result = await addBus(newBus);
    if (result) {
      setNewBus(initialNewBus);
      setShowAddModal(false);
      setSuccess("Bus added successfully!");
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBus || editBus.capacity < 10 || editBus.capacity > 100) {
      setError("Please provide a valid capacity between 10 and 100");
      return;
    }
    setActionLoading(true);
    try {
      const docRef = doc(db, "buses", editBus.id);
      const updatedData = { ...editBus, updatedAt: new Date() };
      const firestoreUpdateData = { ...updatedData };
      delete (firestoreUpdateData as Partial<Bus>).id;

      await updateDoc(docRef, firestoreUpdateData);
      setBuses(buses.map((b) => (b.id === editBus.id ? updatedData as Bus : b)));
      
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
      await deleteDoc(doc(db, "buses", id));
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
                  : `${remainingSlots} Bus Slot Remaining`}
              </h3>
              <p className="text-sm text-gray-700 mt-1">
                {buses.length >= FREE_TIER_LIMIT 
                  ? 'You\'ve reached the free tier limit of 3 buses. Upgrade to Premium for unlimited buses and advanced features.'
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-xl border shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <Truck className="w-8 h-8 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-sm text-gray-600">Total Buses</p>
          {subscriptionTier === 'free' && (
            <p className="text-xs text-purple-600 mt-1">Limit: {FREE_TIER_LIMIT}</p>
          )}
        </div>
        
        <div className="bg-white p-5 rounded-xl border shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
          <p className="text-sm text-gray-600">Active</p>
        </div>
        
        <div className="bg-white p-5 rounded-xl border shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.inactive}</p>
          <p className="text-sm text-gray-600">Inactive</p>
        </div>
        
        <div className="bg-white p-5 rounded-xl border shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <Wrench className="w-8 h-8 text-orange-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.maintenance}</p>
          <p className="text-sm text-gray-600">Maintenance</p>
        </div>
        
        <div className="bg-white p-5 rounded-xl border shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-8 h-8 text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.totalCapacity}</p>
          <p className="text-sm text-gray-600">Total Capacity</p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by license plate, type, or amenities..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as any)}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
              <option value="maintenance">Maintenance</option>
            </select>

            <Button 
              onClick={handleAddClick}
              className="bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2"
              disabled={actionLoading}
            >
              {!canAddBus && <Lock className="w-4 h-4" />}
              <Plus className="w-4 h-4" />
              Add Bus
            </Button>
          </div>
        </div>
      </div>

      {/* Buses Grid */}
      {filteredBuses.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Truck className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {buses.length === 0 ? 'No buses yet' : 'No buses match your search'}
          </h3>
          <p className="text-gray-500 mb-6">
            {searchTerm || filterStatus !== 'all'
              ? 'Try adjusting your search or filters' 
              : 'Add your first bus to start managing your fleet'}
          </p>
          {buses.length === 0 && canAddBus && (
            <Button 
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" /> Add First Bus
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredBuses.map(bus => (
            <div key={bus.id} className="bg-white rounded-xl shadow-sm border hover:shadow-md transition-all duration-200">
              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Truck className="w-5 h-5 text-blue-600" />
                      <h3 className="text-lg font-bold text-gray-900">
                        {bus.licensePlate}
                      </h3>
                    </div>
                    <p className="text-sm text-gray-600">{bus.busType}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    bus.status === 'active' 
                      ? 'bg-green-100 text-green-800' 
                      : bus.status === 'maintenance'
                      ? 'bg-orange-100 text-orange-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {bus.status}
                  </span>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-4 pb-4 border-b">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <Users className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                    <p className="text-lg font-bold text-gray-900">{bus.capacity}</p>
                    <p className="text-xs text-gray-600">Capacity</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <Zap className="w-4 h-4 text-purple-600 mx-auto mb-1" />
                    <p className="text-sm font-bold text-gray-900">{bus.fuelType || 'Diesel'}</p>
                    <p className="text-xs text-gray-600">Fuel Type</p>
                  </div>
                </div>

                {/* Registration Info */}
                {bus.registrationDetails && (
                  <div className="mb-4 text-sm">
                    <div className="flex items-center gap-2 text-gray-600 mb-1">
                      <FileText className="w-4 h-4" />
                      <span>Reg: {bus.registrationDetails.registrationNumber}</span>
                    </div>
                    {bus.registrationDetails.expiryDate && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="w-4 h-4" />
                        <span className="text-xs">
                          Expires: {new Date(bus.registrationDetails.expiryDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Amenities */}
                {bus.amenities && bus.amenities.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-700 mb-2">Amenities:</p>
                    <div className="flex flex-wrap gap-1">
                      {bus.amenities.slice(0, 3).map((amenity, idx) => (
                        <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded">
                          {amenity}
                        </span>
                      ))}
                      {bus.amenities.length > 3 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                          +{bus.amenities.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t">
                  <button
                    onClick={() => { 
                      setEditBus(bus); 
                      setShowEditModal(true); 
                    }} 
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                    disabled={actionLoading}
                  >
                    <Edit3 className="w-4 h-4" />
                    <span className="font-medium">Edit</span>
                  </button>
                  <button
                    onClick={() => handleDelete(bus.id)} 
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                    disabled={actionLoading}
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="font-medium">Delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

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
                // TODO: Redirect to pricing/contact page
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

      {/* Add Modal - Enhanced with more fields */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Bus">
        <form onSubmit={handleAdd} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">License Plate *</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Registration Number</label>
              <input
                type="text"
                value={newBus.registrationNumber}
                onChange={(e) => setNewBus({ ...newBus, registrationNumber: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., MW-BT-2024-001"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Bus Type *</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Capacity *</label>
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
                value={newBus.fuelType || 'Diesel'}
                onChange={(e) => setNewBus({ ...newBus, fuelType: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="Diesel">Diesel</option>
                <option value="Petrol">Petrol</option>
                <option value="Electric">Electric</option>
                <option value="Hybrid">Hybrid</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Year of Manufacture</label>
              <input
                type="number"
                value={newBus.yearOfManufacture || ''}
                onChange={(e) => setNewBus({ ...newBus, yearOfManufacture: parseInt(e.target.value) || undefined })}
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
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

      {/* Edit Modal - Enhanced */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Bus">
        {editBus && (
          <form onSubmit={handleEdit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">License Plate *</label>
                <input
                  type="text"
                  value={editBus.licensePlate}
                  onChange={(e) => setEditBus({ ...editBus, licensePlate: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Registration Number</label>
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
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bus Type *</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Capacity *</label>
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
                  onChange={(e) => setEditBus({ ...editBus,
                     fuelType: e.target.value as 'diesel'|'petrol'|'electric'|'hybrid' })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Diesel">diesel</option>
                  <option value="Petrol">petrol</option>
                  <option value="Electric">electric</option>
                  <option value="Hybrid">hybrid</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Year of Manufacture</label>
               <input
               type="number"
               value={editBus.yearOfManufacture || ''}
               onChange={(e) => {
                const val = parseInt(e.target.value);
                setEditBus({ 
                  ...editBus, 
                  // If parseInt fails (NaN), it defaults to 0 instead of undefined
                yearOfManufacture: isNaN(val) ? 0 : val 
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
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
    </div>
  );
};

export default BusesTab;