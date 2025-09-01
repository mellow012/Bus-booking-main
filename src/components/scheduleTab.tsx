import { FC, useState, useMemo, useCallback } from 'react';
import { collection, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { Schedule, Route, Bus } from '@/types';
import Modal from './Modals';
import { Plus, Edit3, Trash2, Search, Clock, MapPin, DollarSign, Users, AlertCircle, Calendar, Bug } from 'lucide-react';

interface SchedulesTabProps {
  schedules: Schedule[];
  setSchedules: React.Dispatch<React.SetStateAction<Schedule[]>>;
  routes: Route[];
  buses: Bus[];
  companyId: string;
  addSchedule: (data: any) => Promise<string | null>;
  setError: (msg: string) => void;
  setSuccess: (msg: string) => void;
}

// Helper function to handle Firestore date conversion
const convertFirestoreDate = (date: any): Date => {
  if (!date) return new Date();
  if (date instanceof Date) return date;
  if (date.toDate && typeof date.toDate === 'function') {
    return date.toDate();
  }
  if (typeof date === 'string' || typeof date === 'number') {
    return new Date(date);
  }
  return new Date();
};

// Helper functions
const formatDateTime = (date: Date | string | null | undefined): string => {
  if (!date) return 'Invalid Date';
  
  try {
    const dateObj = convertFirestoreDate(date);
    if (isNaN(dateObj.getTime())) return 'Invalid Date';
    
    return dateObj.toLocaleString('en-MW', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'Invalid Date';
  }
};

const formatDateTimeInput = (date: Date | string | null | undefined): string => {
  if (!date) return '';
  
  try {
    const dateObj = convertFirestoreDate(date);
    if (isNaN(dateObj.getTime())) return '';
    
    // Format for datetime-local input
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return '';
  }
};

const createInitialSchedule = (companyId: string): Omit<Schedule, 'id'> => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 0, 0, 0);
  
  const arrivalTime = new Date(tomorrow);
  arrivalTime.setHours(12, 0, 0, 0);
  
  return {
    companyId,
    busId: '',
    routeId: '',
    departureDateTime: tomorrow,
    arrivalDateTime: arrivalTime,
    price: 0,
    availableSeats: 0,
    bookedSeats: [],
    status: 'active',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };
};

const SchedulesTab: FC<SchedulesTabProps> = ({ 
  schedules, 
  setSchedules, 
  routes, 
  buses, 
  companyId, 
  addSchedule, 
  setError, 
  setSuccess 
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSchedule, setEditSchedule] = useState<Schedule | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showDebug, setShowDebug] = useState(true); // Set to false in production
  const [newSchedule, setNewSchedule] = useState<Omit<Schedule, 'id'>>(() => createInitialSchedule(companyId));

  console.log('🔍 SchedulesTab render:', { 
    schedulesCount: schedules.length, 
    routesCount: routes.length, 
    busesCount: buses.length,
    companyId,
    firstSchedule: schedules[0],
    firstRoute: routes[0],
    firstBus: buses[0]
  });

  // Memoized lookup maps for better performance
  const routeMap = useMemo(() => {
    const map = new Map<string, Route>();
    routes.forEach(route => {
      if (route?.id) map.set(route.id, route);
    });
    console.log('🗺️ Route map created:', map.size, 'routes');
    return map;
  }, [routes]);

  const busMap = useMemo(() => {
    const map = new Map<string, Bus>();
    buses.forEach(bus => {
      if (bus?.id) map.set(bus.id, bus);
    });
    console.log('🚌 Bus map created:', map.size, 'buses');
    return map;
  }, [buses]);

  // Process and validate schedules with enhanced error handling
  const validSchedules = useMemo(() => {
    console.log('🔄 Processing schedules...', schedules.length, 'total');
    
    if (!Array.isArray(schedules)) {
      console.error('❌ schedules is not an array:', typeof schedules, schedules);
      return [];
    }

    const processedSchedules = schedules
      .filter((schedule, index) => {
        if (!schedule) {
          console.warn(`❌ Schedule ${index} is null/undefined`);
          return false;
        }
        
        const hasRequiredFields = schedule.id && schedule.routeId && schedule.busId;
        if (!hasRequiredFields) {
          console.warn(`❌ Schedule ${index} missing required fields:`, {
            id: !!schedule.id,
            routeId: !!schedule.routeId,
            busId: !!schedule.busId,
            schedule
          });
          return false;
        }
        
        return true;
      })
      .map((schedule, index) => {
        try {
          const processed = {
            ...schedule,
            // Ensure dates are properly converted
            departureDateTime: convertFirestoreDate(schedule.departureDateTime),
            arrivalDateTime: convertFirestoreDate(schedule.arrivalDateTime),
            createdAt: convertFirestoreDate(schedule.createdAt),
            updatedAt: convertFirestoreDate(schedule.updatedAt),
          };
          
          // Validate the processed dates
          if (isNaN(processed.departureDateTime.getTime()) || isNaN(processed.arrivalDateTime.getTime())) {
            console.warn(`⚠️ Schedule ${index} has invalid dates:`, {
              original: schedule,
              processed: {
                departureDateTime: processed.departureDateTime,
                arrivalDateTime: processed.arrivalDateTime
              }
            });
          }
          
          return processed;
        } catch (error) {
          console.error(`❌ Error processing schedule ${index}:`, error, schedule);
          return schedule; // Return original if processing fails
        }
      })
      // Remove duplicates based on ID
      .filter((schedule, index, arr) => 
        arr.findIndex(s => s.id === schedule.id) === index
      );

    console.log('✅ Valid schedules processed:', processedSchedules.length, 'out of', schedules.length);
    return processedSchedules;
  }, [schedules]);

  // Filter schedules based on search with better error handling
  const filteredSchedules = useMemo(() => {
    if (!searchTerm.trim()) return validSchedules;
    
    const searchLower = searchTerm.toLowerCase();
    return validSchedules.filter(schedule => {
      try {
        const route = routeMap.get(schedule.routeId);
        const bus = busMap.get(schedule.busId);
        
        return (
          route?.origin?.toLowerCase().includes(searchLower) ||
          route?.destination?.toLowerCase().includes(searchLower) ||
          bus?.licensePlate?.toLowerCase().includes(searchLower) ||
          schedule.status?.toLowerCase().includes(searchLower)
        );
      } catch (error) {
        console.error('Error filtering schedule:', error, schedule);
        return false;
      }
    });
  }, [validSchedules, routeMap, busMap, searchTerm]);

  // Form validation
  const validateScheduleForm = useCallback((scheduleData: any): string | null => {
    try {
      if (!scheduleData.routeId) return 'Please select a route';
      if (!scheduleData.busId) return 'Please select a bus';
      if (!scheduleData.price || scheduleData.price <= 0) return 'Please enter a valid price';
      if (!scheduleData.availableSeats || scheduleData.availableSeats <= 0) return 'Please enter valid available seats';
      
      const bus = busMap.get(scheduleData.busId);
      if (!bus) return 'Selected bus not found';
      if (scheduleData.availableSeats > bus.capacity) {
        return `Available seats cannot exceed bus capacity (${bus.capacity})`;
      }
      
      const now = new Date();
      const departureTime = new Date(scheduleData.departureDateTime);
      const arrivalTime = new Date(scheduleData.arrivalDateTime);
      
      if (isNaN(departureTime.getTime())) return 'Invalid departure time';
      if (isNaN(arrivalTime.getTime())) return 'Invalid arrival time';
      if (departureTime <= now) return 'Departure time must be in the future';
      if (arrivalTime <= departureTime) return 'Arrival time must be after departure time';
      
      return null;
    } catch (error) {
      console.error('Validation error:', error);
      return 'Form validation failed';
    }
  }, [busMap]);

  // Event handlers
  const handleAdd = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateScheduleForm(newSchedule);
    if (validationError) {
      setError(validationError);
      return;
    }
    
    setActionLoading(true);
    try {
      const result = await addSchedule({
        ...newSchedule,
        isActive: newSchedule.status === 'active'
      });
      
      if (result) {
        setNewSchedule(createInitialSchedule(companyId));
        setShowAddModal(false);
        setSuccess('Schedule added successfully!');
      }
    } catch (err: any) {
      console.error('❌ Add schedule error:', err);
      setError(`Failed to add schedule: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  }, [newSchedule, validateScheduleForm, addSchedule, companyId, setError, setSuccess]);

  const handleEdit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSchedule) return;
    
    const validationError = validateScheduleForm(editSchedule);
    if (validationError) {
      setError(validationError);
      return;
    }
    
    setActionLoading(true);
    try {
      const updatedData = { 
        ...editSchedule, 
        updatedAt: new Date(),
        isActive: editSchedule.status === 'active'
      };
      
      await updateDoc(doc(db, 'schedules', editSchedule.id), updatedData);
      
      setSchedules(prev => 
        prev.map(s => s.id === editSchedule.id ? updatedData : s)
      );
      
      setShowEditModal(false);
      setEditSchedule(null);
      setSuccess('Schedule updated successfully!');
    } catch (err: any) {
      console.error('❌ Edit schedule error:', err);
      setError(`Failed to update schedule: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  }, [editSchedule, validateScheduleForm, setSchedules, setError, setSuccess]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;
    
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, 'schedules', id));
      setSchedules(prev => prev.filter(s => s.id !== id));
      setSuccess('Schedule deleted successfully!');
    } catch (err: any) {
      console.error('❌ Delete schedule error:', err);
      setError(`Failed to delete schedule: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  }, [setSchedules, setError, setSuccess]);

  const handleBusChange = useCallback((busId: string, isEdit = false) => {
    const bus = busMap.get(busId);
    const maxSeats = bus?.capacity || 0;
    
    if (isEdit && editSchedule) {
      setEditSchedule({
        ...editSchedule,
        busId,
        availableSeats: Math.min(editSchedule.availableSeats, maxSeats)
      });
    } else {
      setNewSchedule(prev => ({
        ...prev,
        busId,
        availableSeats: maxSeats
      }));
    }
  }, [busMap, editSchedule]);

  // Get active buses for selection
  const activeBuses = useMemo(() => 
    buses.filter(bus => bus?.status === 'active'),
    [buses]
  );

  // Debug component
  const DebugInfo = () => showDebug ? (
    <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold text-yellow-800 flex items-center">
          <Bug className="w-4 h-4 mr-1" />
          Debug Information
        </h4>
        <button 
          onClick={() => setShowDebug(false)}
          className="text-yellow-600 hover:text-yellow-800 text-sm"
        >
          Hide
        </button>
      </div>
      <div className="text-sm space-y-1 text-yellow-900">
        <div><strong>Raw Schedules:</strong> {schedules.length}</div>
        <div><strong>Valid Schedules:</strong> {validSchedules.length}</div>
        <div><strong>Filtered Schedules:</strong> {filteredSchedules.length}</div>
        <div><strong>Routes:</strong> {routes.length}</div>
        <div><strong>Buses:</strong> {buses.length}</div>
        <div><strong>Active Buses:</strong> {activeBuses.length}</div>
        <div><strong>Company ID:</strong> "{companyId}"</div>
        
        {schedules.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-yellow-700 hover:text-yellow-800">
              View First Schedule Data
            </summary>
            <pre className="mt-2 text-xs bg-white p-3 rounded border overflow-auto max-h-32">
              {JSON.stringify(schedules[0], (key, value) => {
                if (value instanceof Date) return value.toISOString();
                if (value?.toDate) return `[Timestamp: ${value.toDate().toISOString()}]`;
                return value;
              }, 2)}
            </pre>
          </details>
        )}
        
        {routes.length > 0 && (
          <details className="mt-1">
            <summary className="cursor-pointer text-yellow-700 hover:text-yellow-800">
              View First Route Data
            </summary>
            <pre className="mt-2 text-xs bg-white p-3 rounded border overflow-auto max-h-32">
              {JSON.stringify(routes[0], null, 2)}
            </pre>
          </details>
        )}

        {buses.length > 0 && (
          <details className="mt-1">
            <summary className="cursor-pointer text-yellow-700 hover:text-yellow-800">
              View First Bus Data
            </summary>
            <pre className="mt-2 text-xs bg-white p-3 rounded border overflow-auto max-h-32">
              {JSON.stringify(buses[0], null, 2)}
            </pre>
          </details>
        )}
        
        <div className="mt-2 p-2 bg-white rounded border">
          <div className="text-xs font-medium mb-1">Quick Data Checks:</div>
          <div className="text-xs space-y-1">
            <div>✓ Schedules is array: {Array.isArray(schedules) ? 'Yes' : 'No'}</div>
            <div>✓ Routes is array: {Array.isArray(routes) ? 'Yes' : 'No'}</div>
            <div>✓ Buses is array: {Array.isArray(buses) ? 'Yes' : 'No'}</div>
            <div>✓ Company ID provided: {companyId ? 'Yes' : 'No'}</div>
            {validSchedules.length > 0 && (
              <div>✓ First valid schedule has route: {routeMap.has(validSchedules[0].routeId) ? 'Yes' : 'No'}</div>
            )}
            {validSchedules.length > 0 && (
              <div>✓ First valid schedule has bus: {busMap.has(validSchedules[0].busId) ? 'Yes' : 'No'}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  ) : (
    <button 
      onClick={() => setShowDebug(true)}
      className="mb-4 text-sm text-gray-500 hover:text-gray-700 flex items-center"
    >
      <Bug className="w-3 h-3 mr-1" />
      Show Debug Info
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Schedules</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage your bus schedules and timetables
          </p>
        </div>
        <button 
          onClick={() => {
            setNewSchedule(createInitialSchedule(companyId));
            setShowAddModal(true);
          }} 
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
          disabled={actionLoading}
        >
          <Plus className="w-4 h-4" />
          <span>Add Schedule</span>
        </button>
      </div>

      {/* Debug Info */}
      <DebugInfo />

      {/* Search and Stats */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search schedules by route, bus, or status..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <span className="flex items-center">
              <Calendar className="w-4 h-4 mr-1" />
              {validSchedules.length} Total
            </span>
            <span className="flex items-center">
              <Clock className="w-4 h-4 mr-1" />
              {validSchedules.filter(s => s.status === 'active').length} Active
            </span>
          </div>
        </div>
        
        {/* Schedules Table */}
        {filteredSchedules.length === 0 ? (
          <div className="text-center py-12">
            {validSchedules.length === 0 ? (
              <div>
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No schedules yet</h3>
                <p className="text-gray-500 mb-6">
                  {schedules.length === 0 
                    ? 'Create your first schedule to start managing your bus timetables'
                    : `Found ${schedules.length} schedules but none are valid. Check the debug info above.`
                  }
                </p>
                <button 
                  onClick={() => {
                    setNewSchedule(createInitialSchedule(companyId));
                    setShowAddModal(true);
                  }}
                  className="inline-flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add First Schedule</span>
                </button>
              </div>
            ) : (
              <div>
                <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No schedules match your search</h3>
                <p className="text-gray-500">Try adjusting your search terms</p>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Route</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Bus</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Departure</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Arrival</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Price</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Seats</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSchedules.map(schedule => {
                  const route = routeMap.get(schedule.routeId);
                  const bus = busMap.get(schedule.busId);
                  
                  return (
                    <tr key={schedule.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-4 px-4">
                        <div className="flex items-center">
                          <MapPin className="w-4 h-4 text-gray-400 mr-2" />
                          <div>
                            {route ? (
                              <div className="font-medium text-gray-900">
                                {route.origin} → {route.destination}
                              </div>
                            ) : (
                              <div className="text-red-600 text-sm flex items-center">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Route not found (ID: {schedule.routeId})
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        {bus ? (
                          <div>
                            <div className="font-medium text-gray-900">{bus.licensePlate}</div>
                            <div className="text-sm text-gray-500">{bus.busType}</div>
                          </div>
                        ) : (
                          <div className="text-red-600 text-sm flex items-center">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Bus not found (ID: {schedule.busId})
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 text-gray-400 mr-2" />
                          <div className="text-sm text-gray-900">
                            {formatDateTime(schedule.departureDateTime)}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 text-gray-400 mr-2" />
                          <div className="text-sm text-gray-900">
                            {formatDateTime(schedule.arrivalDateTime)}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center">
                          <DollarSign className="w-4 h-4 text-gray-400 mr-1" />
                          <span className="font-medium text-gray-900">
                            MWK {schedule.price?.toLocaleString('en-MW') || '0'}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center">
                          <Users className="w-4 h-4 text-gray-400 mr-1" />
                          <span className={`font-medium ${
                            schedule.availableSeats === 0 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {schedule.availableSeats}/{bus?.capacity || 0}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          schedule.status === 'active' 
                            ? 'bg-green-100 text-green-800 border border-green-200' 
                            : schedule.status === 'cancelled'
                            ? 'bg-red-100 text-red-800 border border-red-200'
                            : 'bg-gray-100 text-gray-800 border border-gray-200'
                        }`}>
                          {schedule.status}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-2">
                          <button 
                            onClick={() => { 
                              setEditSchedule(schedule); 
                              setShowEditModal(true); 
                            }} 
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                            disabled={actionLoading}
                            title="Edit schedule"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(schedule.id)} 
                            className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                            disabled={actionLoading}
                            title="Delete schedule"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Schedule">
        <form onSubmit={handleAdd} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Route *</label>
              <select
                value={newSchedule.routeId}
                onChange={e => setNewSchedule({ ...newSchedule, routeId: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select Route</option>
                {routes.map(route => (
                  <option key={route.id} value={route.id}>
                    {route.origin} → {route.destination}
                  </option>
                ))}
              </select>
              {routes.length === 0 && (
                <p className="text-sm text-red-600 mt-1">No routes available. Add routes first.</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Bus *</label>
              <select
                value={newSchedule.busId}
                onChange={e => handleBusChange(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select Bus</option>
                {activeBuses.map(bus => (
                  <option key={bus.id} value={bus.id}>
                    {bus.licensePlate} - {bus.busType} (Capacity: {bus.capacity})
                  </option>
                ))}
              </select>
              {activeBuses.length === 0 && (
                <p className="text-sm text-red-600 mt-1">No active buses available. Add buses first.</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Departure Date & Time *</label>
              <input
                type="datetime-local"
                value={formatDateTimeInput(newSchedule.departureDateTime)}
                onChange={e => setNewSchedule({ 
                  ...newSchedule, 
                  departureDateTime: new Date(e.target.value) 
                })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Arrival Date & Time *</label>
              <input
                type="datetime-local"
                value={formatDateTimeInput(newSchedule.arrivalDateTime)}
                onChange={e => setNewSchedule({ 
                  ...newSchedule, 
                  arrivalDateTime: new Date(e.target.value) 
                })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Price (MWK) *</label>
              <input
                type="number"
                min="0"
                step="100"
                value={newSchedule.price || ''}
                onChange={e => setNewSchedule({ 
                  ...newSchedule, 
                  price: parseFloat(e.target.value) || 0 
                })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Available Seats *</label>
              <input
                type="number"
                min="1"
                max={busMap.get(newSchedule.busId)?.capacity || 100}
                value={newSchedule.availableSeats || ''}
                onChange={e => setNewSchedule({ 
                  ...newSchedule, 
                  availableSeats: parseInt(e.target.value) || 0 
                })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
                required
              />
              {newSchedule.busId && busMap.get(newSchedule.busId) && (
                <p className="text-xs text-gray-500 mt-1">
                  Max capacity: {busMap.get(newSchedule.busId)?.capacity}
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
              <select
                value={newSchedule.status}
                onChange={e => setNewSchedule({ 
                  ...newSchedule, 
                  status: e.target.value as 'active' | 'cancelled' | 'completed' 
                })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="active">Active</option>
                <option value="cancelled">Cancelled</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t">
            <button 
              type="button" 
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              disabled={actionLoading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
              disabled={actionLoading}
            >
              {actionLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Adding...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Add Schedule</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal 
        isOpen={showEditModal} 
        onClose={() => {
          setShowEditModal(false);
          setEditSchedule(null);
        }} 
        title="Edit Schedule"
      >
        {editSchedule && (
          <form onSubmit={handleEdit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Route *</label>
                <select
                  value={editSchedule.routeId}
                  onChange={e => setEditSchedule({ ...editSchedule, routeId: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select Route</option>
                  {routes.map(route => (
                    <option key={route.id} value={route.id}>
                      {route.origin} → {route.destination}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bus *</label>
                <select
                  value={editSchedule.busId}
                  onChange={e => handleBusChange(e.target.value, true)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select Bus</option>
                  {activeBuses.map(bus => (
                    <option key={bus.id} value={bus.id}>
                      {bus.licensePlate} - {bus.busType} (Capacity: {bus.capacity})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Departure Date & Time *</label>
                <input
                  type="datetime-local"
                  value={formatDateTimeInput(editSchedule.departureDateTime)}
                  onChange={e => setEditSchedule({ 
                    ...editSchedule, 
                    departureDateTime: new Date(e.target.value) 
                  })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Arrival Date & Time *</label>
                <input
                  type="datetime-local"
                  value={formatDateTimeInput(editSchedule.arrivalDateTime)}
                  onChange={e => setEditSchedule({ 
                    ...editSchedule, 
                    arrivalDateTime: new Date(e.target.value) 
                  })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Price (MWK) *</label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={editSchedule.price || ''}
                  onChange={e => setEditSchedule({ 
                    ...editSchedule, 
                    price: parseFloat(e.target.value) || 0 
                  })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Available Seats *</label>
                <input
                  type="number"
                  min="1"
                  max={busMap.get(editSchedule.busId)?.capacity || 100}
                  value={editSchedule.availableSeats || ''}
                  onChange={e => setEditSchedule({ 
                    ...editSchedule, 
                    availableSeats: parseInt(e.target.value) || 0 
                  })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                  required
                />
                {editSchedule.busId && busMap.get(editSchedule.busId) && (
                  <p className="text-xs text-gray-500 mt-1">
                    Max capacity: {busMap.get(editSchedule.busId)?.capacity}
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
                <select
                  value={editSchedule.status}
                  onChange={e => setEditSchedule({ 
                    ...editSchedule, 
                    status: e.target.value as 'active' | 'cancelled' | 'completed' 
                  })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="active">Active</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-6 border-t">
              <button 
                type="button" 
                onClick={() => {
                  setShowEditModal(false);
                  setEditSchedule(null);
                }}
                className="px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Updating...</span>
                  </>
                ) : (
                  <>
                    <Edit3 className="w-4 h-4" />
                    <span>Update Schedule</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default SchedulesTab;