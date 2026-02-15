"use client";

import { FC, useState, useMemo, useCallback, useEffect } from 'react';
import { updateDoc, deleteDoc, doc, getDoc, collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { Schedule, Route, Bus, Booking } from '@/types';
import Modal from './Modals';
import {
  Plus,
  Edit3,
  Trash2,
  Search,
  Clock,
  MapPin,
  DollarSign,
  Users,
  AlertCircle,
  Calendar as CalendarIcon,
  List,
  Grid,
  Repeat,
  Bus as BusIcon,
  Check,
  Lock,
  Unlock,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  UserCircle,
  MapPinIcon,
  Archive,
  ArchiveRestore,
  Eye,
  XCircle,
  Loader2,
  CheckCircle,
} from 'lucide-react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parseISO, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import { Button } from '@/components/ui/button';

const localizer = dateFnsLocalizer({
  format,
  parse: parseISO,
  startOfWeek,
  getDay,
  locales: { 'en-US': enUS },
});

interface SchedulesTabProps {
  schedules: Schedule[];
  setSchedules: React.Dispatch<React.SetStateAction<Schedule[]>>;
  routes: Route[];
  buses: Bus[];
  companyId: string;
  addSchedule: (data: any) => Promise<string | null>;
  setError: (msg: string) => void;
  setSuccess: (msg: string) => void;
  user: any; 
  userProfile: any;
}

type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly';

interface RecurrenceConfig {
  type: RecurrenceType;
  interval: number;
  endDate?: Date;
  occurrences?: number;
  daysOfWeek?: number[];
}

type ViewMode = 'list' | 'weekly' | 'calendar';
type ScheduleStatus = 'all' | 'active' | 'completed' | 'cancelled' | 'archived';

// ✅ Worker Info
interface WorkerInfo {
  uid: string;
  name: string;
  email: string;
  region?: string;
  role: string;
}

interface BusAvailabilityInfo {
  busId: string;
  isAvailable: boolean;
  totalCapacity: number;
  bookedSeats: number;
  availableSeats: number;
  occupancyPercentage: number;
  schedules: Schedule[];
  lastScheduleEnd?: Date;
  nextScheduleStart?: Date;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' }
];

// ✅ Schedule Status Badge
const ScheduleStatusBadge: FC<{ schedule: Schedule }> = ({ schedule }) => {
  const now = new Date();
  const arrivalTime = schedule.arrivalDateTime instanceof Date 
    ? schedule.arrivalDateTime 
    : new Date(schedule.arrivalDateTime);

  const hasArrived = now >= arrivalTime;
  const isArchived = schedule.isArchived || schedule.status === "archived";

  if (isArchived) {
    return (
      <div className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded-full font-medium">
        <Archive className="w-3 h-3" />
        <span>Archived</span>
      </div>
    );
  }

  if (hasArrived) {
    return (
      <div className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
        <CheckCircle className="w-3 h-3" />
        <span>Completed</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
      <Clock className="w-3 h-3" />
      <span>Active</span>
    </div>
  );
};

// ✅ Schedule Completion Bar
const ScheduleCompletionBar: FC<{ schedule: Schedule; bookings: Booking[] }> = ({ schedule, bookings }) => {
  const scheduleBookings = bookings.filter(b => b.scheduleId === schedule.id);
  const totalSeats = schedule.availableSeats + (schedule.bookedSeats?.length || 0);
  const bookedCount = scheduleBookings.length;
  const occupancyRate = totalSeats > 0 ? (bookedCount / totalSeats) * 100 : 0;

  const paidCount = scheduleBookings.filter(b => b.paymentStatus === "paid").length;
  const boardedCount = scheduleBookings.filter(b => b.bookingStatus === "boarded").length;
  const noShowCount = scheduleBookings.filter(b => b.bookingStatus === "no-show").length;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-gray-600">
        <span>Occupancy</span>
        <span>{occupancyRate.toFixed(0)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="h-2 rounded-full bg-blue-600 transition-all"
          style={{ width: `${occupancyRate}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs mt-2">
        <div>
          <span className="text-gray-600">Paid:</span>
          <span className="ml-1 font-bold text-green-700">{paidCount}</span>
        </div>
        <div>
          <span className="text-gray-600">Boarded:</span>
          <span className="ml-1 font-bold text-blue-700">{boardedCount}</span>
        </div>
        <div>
          <span className="text-gray-600">No-Show:</span>
          <span className="ml-1 font-bold text-red-700">{noShowCount}</span>
        </div>
      </div>
    </div>
  );
};

// Helper functions
const convertFirestoreDate = (date: any): Date => {
  if (!date) return new Date();
  if (date instanceof Date) return date;
  if (date.toDate && typeof date.toDate === 'function') return date.toDate();
  if (typeof date === 'string' || typeof date === 'number') return new Date(date);
  return new Date();
};

const formatDateTimeInput = (date: Date | string | null | undefined): string => {
  if (!date) return '';
  try {
    const d = convertFirestoreDate(date);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day}T${h}:${min}`;
  } catch {
    return '';
  }
};

const generateRecurringDates = (startDate: Date, config: RecurrenceConfig): Date[] => {
  const dates: Date[] = [];
  let current = new Date(startDate);
  current.setHours(0, 0, 0, 0);

  const max = config.occurrences || 52;
  const end = config.endDate
    ? new Date(config.endDate)
    : new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000);
  end.setHours(23, 59, 59, 999);

  if (config.type === 'weekly' && config.daysOfWeek?.length) {
    let week = 0;
    let it = 0;
    while (dates.length < max && current <= end && it < 1000) {
      if (config.daysOfWeek.includes(current.getDay())) {
        dates.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
      if (current.getDay() === 0) {
        week++;
        if (week % config.interval === 0 && week > 0) {
          current.setDate(current.getDate() + 7 * (config.interval - 1));
        }
      }
      it++;
    }
  } else {
    for (let i = 0; i < max; i++) {
      if (current > end) break;
      dates.push(new Date(current));
      switch (config.type) {
        case 'daily': current.setDate(current.getDate() + config.interval); break;
        case 'weekly': current.setDate(current.getDate() + 7 * config.interval); break;
        case 'monthly': current.setMonth(current.getMonth() + config.interval); break;
      }
    }
  }
  return dates;
};

const createInitialSchedule = (companyId: string): Omit<Schedule, 'id'> => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 0, 0, 0);
  const arrival = new Date(tomorrow);
  arrival.setHours(12, 0, 0, 0);

  return {
    companyId,
    busId: '',
    routeId: '',
    departureLocation: '',
    arrivalLocation: '',
    price: 0,
    availableSeats: 0,
    bookedSeats: [],
    status: 'active',
    isActive: true,
    createdBy: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    departureDateTime: tomorrow,
    arrivalDateTime: arrival
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
  setSuccess,
  user,
  userProfile,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editSchedule, setEditSchedule] = useState<Schedule | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<ScheduleStatus>('active');
  const [actionLoading, setActionLoading] = useState(false);
  const [newSchedule, setNewSchedule] = useState<Omit<Schedule, 'id'>>(() => createInitialSchedule(companyId));
  const [recurrenceConfig, setRecurrenceConfig] = useState<RecurrenceConfig>({
    type: 'none',
    interval: 1,
    daysOfWeek: []
  });
  const [recurrenceEndType, setRecurrenceEndType] = useState<'date' | 'occurrences'>('occurrences');
  const [viewMode, setViewMode] = useState<'list' | 'weekly' | 'calendar'>('list');
  const [fetchedRoutes, setFetchedRoutes] = useState<Route[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [workerInfo, setWorkerInfo] = useState<Map<string, WorkerInfo>>(new Map());
  const [loadingWorkerInfo, setLoadingWorkerInfo] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  
  // ✅ NEW: Bookings state
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [scheduleBookings, setScheduleBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  // ✅ Fetch routes from Firestore
  useEffect(() => {
    if (!companyId) return;

    const fetchRoutesFromFirestore = async () => {
      setLoadingRoutes(true);
      try {
        const routesRef = collection(db, 'routes');
        const q = query(routesRef, where('companyId', '==', companyId));
        const snapshot = await getDocs(q);
        
        const routesData: Route[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Route));

        setFetchedRoutes(routesData);
      } catch (error: any) {
        console.error('[SchedulesTab] Error fetching routes:', error);
        setFetchedRoutes(routes);
      } finally {
        setLoadingRoutes(false);
      }
    };

    fetchRoutesFromFirestore();
  }, [companyId, routes]);

  // ✅ Fetch all bookings for company (real-time)
  useEffect(() => {
    if (!companyId) return;

    const q = query(
      collection(db, "bookings"),
      where("companyId", "==", companyId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const bookings = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Booking[];

        setAllBookings(bookings);
      },
      (error) => {
        console.error("Error loading bookings:", error);
        setAllBookings([]);
      }
    );

    return () => unsubscribe();
  }, [companyId]);

  // ✅ Load bookings for selected schedule
  useEffect(() => {
    if (!selectedSchedule?.id) {
      setScheduleBookings([]);
      return;
    }

    setLoadingBookings(true);

    const q = query(
      collection(db, "bookings"),
      where("scheduleId", "==", selectedSchedule.id)
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const bookings = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Booking[];

        setScheduleBookings(bookings);
        setLoadingBookings(false);
      },
      (error) => {
        console.error("Error loading bookings:", error);
        setScheduleBookings([]);
        setLoadingBookings(false);
      }
    );

    return () => unsubscribe();
  }, [selectedSchedule?.id]);

  // ✅ REAL-TIME: Auto-complete schedules
  useEffect(() => {
    if (schedules.length === 0) return;

    const now = new Date();
    const schedulesToComplete = schedules.filter(s => {
      if (s.isArchived || s.status === "archived" || s.isCompleted) return false;

      const arrivalTime = s.arrivalDateTime instanceof Date
        ? s.arrivalDateTime
        : new Date(s.arrivalDateTime);

      return now >= arrivalTime;
    });

    schedulesToComplete.forEach(schedule => {
      updateScheduleStatus(schedule.id, "completed");
    });
  }, [schedules]);

  // ✅ Fetch operator and conductor info from operators collection
  useEffect(() => {
    const fetchWorkerInfo = async () => {
      setLoadingWorkerInfo(true);
      try {
        const workerIdentifiers = new Set<string>();

        fetchedRoutes.forEach(route => {
          (route.assignedOperatorIds || []).forEach(id => {
            if (id && typeof id === 'string') workerIdentifiers.add(id);
          });
        });

        buses.forEach(bus => {
          if (bus.conductorIds && Array.isArray(bus.conductorIds)) {
            bus.conductorIds.forEach(id => {
              if (id && typeof id === 'string') workerIdentifiers.add(id);
            });
          }
        });

        console.log('[SchedulesTab] Worker identifiers to fetch:', Array.from(workerIdentifiers));

        const workersMap = new Map<string, WorkerInfo>();
        
        if (workerIdentifiers.size > 0) {
          const operatorsRef = collection(db, 'operators');
          const q = query(operatorsRef, where('companyId', '==', companyId));
          const snapshot = await getDocs(q);
          
          snapshot.docs.forEach(doc => {
            const data = doc.data();
            const docId = doc.id;
            const authUid = data.uid;

            if ((docId && workerIdentifiers.has(docId)) || (authUid && workerIdentifiers.has(authUid))) {
              const info: WorkerInfo = {
                uid: authUid || docId,
                name: data.name || 'unknown',
                email: data.email || '',
                region: data.region || data.branch,
                role: data.role || ''
              };

              if (docId) workersMap.set(docId, info);
              if (authUid) workersMap.set(authUid, info);
            }
          });
        }

        console.log('[SchedulesTab] Total workers in map:', workersMap.size);
        setWorkerInfo(workersMap);
      } catch (error: any) {
        console.error('[SchedulesTab] Error fetching worker info:', error);
      } finally {
        setLoadingWorkerInfo(false);
      }
    };

    if ((fetchedRoutes.length > 0 || buses.length > 0) && companyId) {
      fetchWorkerInfo();
    }
  }, [fetchedRoutes, buses, companyId]);

  const routeMap = useMemo(() => {
    const allRoutes = fetchedRoutes.length > 0 ? fetchedRoutes : routes;
    return new Map(allRoutes.map(r => [r.id, r]));
  }, [fetchedRoutes, routes]);

  const busMap = useMemo(() => new Map(buses.map(b => [b.id, b])), [buses]);

  const operatorRoutes = useMemo(() => {
    const routesToFilter = fetchedRoutes.length > 0 ? fetchedRoutes : routes;
    
    if (userProfile?.role !== 'operator') {
      return routesToFilter;
    }

    const filtered = routesToFilter.filter(route => {
      const assignedOperatorIds = route.assignedOperatorIds || [];
      const cleanedIds = assignedOperatorIds.map(id => {
        return typeof id === 'string' ? id.replace(/^"|"$/g, '') : String(id);
      });
      
      const userUid = user?.uid;
      return cleanedIds.includes(userUid);
    });

    return filtered;
  }, [fetchedRoutes, routes, user?.uid, userProfile?.role]);

  const busAvailabilityMap = useMemo(() => {
    const availabilityMap = new Map<string, BusAvailabilityInfo>();
    const now = new Date();

    buses.forEach(bus => {
      const busSchedules = schedules.filter(s => s.busId === bus.id && s.status === 'active');
      
      const totalBooked = busSchedules.reduce((sum, s) => {
        const depDate = convertFirestoreDate(s.departureDateTime);
        const booked = (bus.capacity || 0) - (s.availableSeats || 0);
        if (depDate >= now) {
          return sum + booked;
        }
        return sum;
      }, 0);

      const futureSchedules = busSchedules.filter(s => 
        convertFirestoreDate(s.departureDateTime) >= now
      );

      const isAvailable = bus.status === 'active' && futureSchedules.length < 5;

      availabilityMap.set(bus.id, {
        busId: bus.id,
        isAvailable,
        totalCapacity: bus.capacity || 0,
        bookedSeats: totalBooked,
        availableSeats: (bus.capacity || 0) - totalBooked,
        occupancyPercentage: bus.capacity ? (totalBooked / bus.capacity) * 100 : 0,
        schedules: futureSchedules,
      });
    });

    return availabilityMap;
  }, [buses, schedules]);

  const validSchedules = useMemo(() => {
    return schedules
      .filter(s => s?.id && s.routeId && s.busId)
      .map(s => ({
        ...s,
        createdBy: s.createdBy || '',
        departureDateTime: convertFirestoreDate(s.departureDateTime),
        arrivalDateTime: convertFirestoreDate(s.arrivalDateTime),
        createdAt: convertFirestoreDate(s.createdAt),
        updatedAt: convertFirestoreDate(s.updatedAt),
      }));
  }, [schedules]);

  const filteredSchedules = useMemo(() => {
    let res = validSchedules;

    if (userProfile?.role === 'operator') {
      res = res.filter(s => s.createdBy === user?.uid);
    }

    if (filterStatus !== 'all') {
      res = res.filter(s => {
        if (filterStatus === 'active') {
          return s.status === 'active' && s.availableSeats > 0 && !s.isArchived;
        } else if (filterStatus === 'completed') {
          return s.isCompleted && !s.isArchived;
        } else if (filterStatus === 'archived') {
          return s.isArchived;
        }
        return s.status === filterStatus;
      });
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      res = res.filter(s => {
        const r = routeMap.get(s.routeId);
        const b = busMap.get(s.busId);
        return (
          r?.origin?.toLowerCase().includes(q) ||
          r?.destination?.toLowerCase().includes(q) ||
          b?.licensePlate?.toLowerCase().includes(q)
        );
      });
    }

    return res;
  }, [validSchedules, searchTerm, filterStatus, routeMap, busMap, userProfile, user]);

  const paginatedSchedules = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredSchedules.slice(startIndex, endIndex);
  }, [filteredSchedules, currentPage]);

  const totalPages = Math.ceil(filteredSchedules.length / itemsPerPage);

  const stats = useMemo(() => {
    const now = new Date();
    const active = validSchedules.filter(s => {
      if (s.isArchived) return false;
      const arrival = convertFirestoreDate(s.arrivalDateTime);
      return s.status === 'active' && s.availableSeats > 0 && now < arrival;
    }).length;

    const completed = validSchedules.filter(s => s.isCompleted && !s.isArchived).length;
    const archived = validSchedules.filter(s => s.isArchived).length;

    return {
      total: validSchedules.length,
      active,
      upcoming: validSchedules.filter(s => convertFirestoreDate(s.departureDateTime) > now && s.status === 'active').length,
      totalSeats: validSchedules.reduce((a, s) => a + (s.availableSeats || 0), 0),
      availableBuses: buses.filter(b => busAvailabilityMap.get(b.id)?.isAvailable).length,
      completed,
      archived,
    };
  }, [validSchedules, buses, busAvailabilityMap]);

  const activeBuses = useMemo(() => buses.filter(b => b?.status === 'active'), [buses]);

  const updateScheduleStatus = useCallback(async (scheduleId: string, status: string) => {
    try {
      const ref = doc(db, "schedules", scheduleId);
      await updateDoc(ref, {
        isCompleted: status === "completed",
        isArchived: status === "archived",
        status: status,
        completedAt: status === "completed" ? new Date() : null,
        archivedAt: status === "archived" ? new Date() : null,
        updatedAt: new Date(),
      });

      setSchedules(prev =>
        prev.map(s =>
          s.id === scheduleId
            ? {
                ...s,
                isCompleted: status === "completed",
                isArchived: status === "archived",
                status: status,
              }
            : s
        )
      );

      setSuccess(`Schedule ${status} successfully`);
    } catch (error: any) {
      setError(`Failed to ${status} schedule: ${error.message}`);
    }
  }, [setSchedules, setError, setSuccess]);

  const validateScheduleForm = useCallback((data: any): string | null => {
    if (!data.routeId) return 'Please select a route';
    if (!data.busId) return 'Please select a bus';
    if (!data.price || data.price <= 0) return 'Please enter a valid price';
    if (!data.availableSeats || data.availableSeats <= 0) return 'Please enter valid available seats';

    const bus = busMap.get(data.busId);
    if (!bus) return 'Selected bus not found';
    if (data.availableSeats > bus.capacity) {
      return `Available seats cannot exceed bus capacity (${bus.capacity})`;
    }

    const now = new Date();
    const dep = new Date(data.departureDateTime);
    const arr = new Date(data.arrivalDateTime);

    if (isNaN(dep.getTime())) return 'Invalid departure time';
    if (isNaN(arr.getTime())) return 'Invalid arrival time';
    if (dep <= now) return 'Departure time must be in the future';
    if (arr <= dep) return 'Arrival time must be after departure time';

    return null;
  }, [busMap]);

  const handleBusChange = useCallback((busId: string, isEdit: boolean = false) => {
    const selectedBus = buses.find(b => b.id === busId);
    
    if (isEdit && editSchedule) {
      setEditSchedule({ 
        ...editSchedule, 
        busId,
        availableSeats: selectedBus?.capacity || 0
      });
    } else {
      setNewSchedule({ 
        ...newSchedule, 
        busId,
        availableSeats: selectedBus?.capacity || 0
      });
    }
  }, [newSchedule, editSchedule, buses]);

  const handleDelete = useCallback(async (scheduleId: string) => {
    if (!window.confirm('Are you sure you want to delete this schedule?')) return;

    setActionLoading(true);
    try {
      await deleteDoc(doc(db, 'schedules', scheduleId));
      setSchedules(prev => prev.filter(s => s.id !== scheduleId));
      setSuccess('Schedule deleted successfully!');
    } catch (err: any) {
      setError(`Failed to delete schedule: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  }, [setSchedules, setError, setSuccess]);

  const handleEdit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSchedule) return;

    const err = validateScheduleForm(editSchedule);
    if (err) {
      setError(err);
      return;
    }

    setActionLoading(true);
    try {
      await updateDoc(doc(db, 'schedules', editSchedule.id), {
        routeId: editSchedule.routeId,
        busId: editSchedule.busId,
        departureDateTime: editSchedule.departureDateTime,
        arrivalDateTime: editSchedule.arrivalDateTime,
        price: editSchedule.price,
        availableSeats: editSchedule.availableSeats,
        status: editSchedule.status,
        isActive: editSchedule.status === 'active',
        updatedAt: new Date()
      });

      setSchedules(prev => prev.map(s => s.id === editSchedule.id ? editSchedule : s));
      setSuccess('Schedule updated successfully!');
      setShowEditModal(false);
      setEditSchedule(null);
    } catch (err: any) {
      setError(`Failed to update schedule: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  }, [editSchedule, validateScheduleForm, setSchedules, setError, setSuccess]);

  const handleAdd = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (userProfile?.role === 'operator') {
      if (!newSchedule.routeId) {
        setError('Please select a route first');
        return;
      }

      try {
        const routeDoc = await getDoc(doc(db, 'routes', newSchedule.routeId));
        if (!routeDoc.exists()) {
          setError('Selected route no longer exists');
          return;
        }

        const routeData = routeDoc.data();
        const assignedOperatorIds = routeData?.assignedOperatorIds || [];
        
        if (!assignedOperatorIds.includes(user?.uid)) {
          setError(`You are not assigned to this route: ${routeData?.name || 'Unknown'}`);
          return;
        }
      } catch (err: any) {
        console.error('[SchedulesTab] Error checking route:', err);
        setError(`Error validating route: ${err.message}`);
        return;
      }
    }

    const err = validateScheduleForm(newSchedule);
    if (err) {
      setError(err);
      return;
    }

    setActionLoading(true);
    const addedSchedules: Schedule[] = [];

    try {
      const baseScheduleData = {
        ...newSchedule,
        createdBy: user?.uid,
        companyId,
        isActive: newSchedule.status === 'active',
      };

      if (recurrenceConfig.type === 'none') {
        const id = await addSchedule(baseScheduleData);
        if (id) {
          addedSchedules.push({ 
            ...baseScheduleData, 
            id,
            departureDateTime: new Date(baseScheduleData.departureDateTime),
            arrivalDateTime: new Date(baseScheduleData.arrivalDateTime),
          } as Schedule);
        }
      } else {
        const dates = generateRecurringDates(new Date(newSchedule.departureDateTime), recurrenceConfig);
        const depBase = new Date(newSchedule.departureDateTime);
        const arrBase = new Date(newSchedule.arrivalDateTime);
        const duration = arrBase.getTime() - depBase.getTime();

        for (const d of dates) {
          const newDep = new Date(d);
          newDep.setHours(depBase.getHours(), depBase.getMinutes());
          const newArr = new Date(newDep.getTime() + duration);

          const id = await addSchedule({
            ...baseScheduleData,
            departureDateTime: newDep,
            arrivalDateTime: newArr,
          });

          if (id) {
            addedSchedules.push({
              ...baseScheduleData,
              id,
              departureDateTime: newDep,
              arrivalDateTime: newArr,
            } as Schedule);
          }
        }
      }

      if (addedSchedules.length > 0) {
        setSchedules(prev => [...addedSchedules, ...prev]);
        setShowAddModal(false);
        setNewSchedule(createInitialSchedule(companyId));
        setRecurrenceConfig({ type: 'none', interval: 1, daysOfWeek: [] });
        setRecurrenceEndType('occurrences');
        setSuccess(recurrenceConfig.type === 'none' ? 'Schedule created!' : `${addedSchedules.length} schedules created!`);
      }
    } catch (err: any) {
      console.error('[SchedulesTab] handleAdd error:', err);
      setError(`Failed to create schedule: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  }, [newSchedule, recurrenceConfig, addSchedule, user, companyId, setSchedules, userProfile, validateScheduleForm, setError, setSuccess]);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <CalendarIcon className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active</p>
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            </div>
            <Check className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Upcoming</p>
              <p className="text-2xl font-bold text-purple-600">{stats.upcoming}</p>
            </div>
            <Clock className="w-8 h-8 text-purple-600" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-blue-600">{stats.completed}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Archived</p>
              <p className="text-2xl font-bold text-gray-600">{stats.archived}</p>
            </div>
            <Archive className="w-8 h-8 text-gray-600" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Buses</p>
              <p className="text-2xl font-bold text-emerald-600">{stats.availableBuses}</p>
            </div>
            <BusIcon className="w-8 h-8 text-emerald-600" />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by route or bus..."
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={filterStatus}
              onChange={e => {
                setFilterStatus(e.target.value as ScheduleStatus);
                setCurrentPage(1);
              }}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Schedules</option>
              <option value="active">Active Only</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="archived">Archived</option>
            </select>

            {userProfile?.role === 'operator' && (
              <button
                onClick={() => {
                  setNewSchedule(createInitialSchedule(companyId));
                  setRecurrenceConfig({ type: 'none', interval: 1, daysOfWeek: [] });
                  setRecurrenceEndType('occurrences');
                  setShowAddModal(true);
                }}
                className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add Schedule
              </button>
            )}
          </div>
        </div>
      </div>

      {/* List View */}
      {paginatedSchedules.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <CalendarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No schedules</h3>
          <p className="text-gray-500">
            {filterStatus === 'active' 
              ? 'No active schedules with available seats'
              : 'Create your first schedule to get started'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {paginatedSchedules.map(schedule => {
              const route = routeMap.get(schedule.routeId);
              const bus = busMap.get(schedule.busId);
              const depTime = convertFirestoreDate(schedule.departureDateTime);
              const arrTime = convertFirestoreDate(schedule.arrivalDateTime);
              
              const assignedOperatorIds = route?.assignedOperatorIds || [];
              const conductorUid = bus?.conductorIds ? bus.conductorIds[0] : null;
              const assignedConductor = conductorUid ? workerInfo.get(conductorUid) : null;
              
              const scheduleBookingsList = allBookings.filter(b => b.scheduleId === schedule.id);

              return (
                <div key={schedule.id} className={`bg-white rounded-xl shadow-sm border hover:shadow-md transition-all ${
                  schedule.status === 'active' && schedule.availableSeats > 0 && !schedule.isArchived ? 'border-emerald-200' : ''
                }`}>
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {route ? `${route.origin} → ${route.destination}` : 'Unknown Route'}
                        </h3>
                        <p className="text-xs text-gray-600 mt-1">{bus?.licensePlate || 'N/A'}</p>
                      </div>
                      <ScheduleStatusBadge schedule={schedule} />
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b">
                      <div className="text-center">
                        <Clock className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                        <p className="text-sm font-bold">{depTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        <p className="text-xs text-gray-500">Depart</p>
                      </div>
                      <div className="text-center">
                        <DollarSign className="w-5 h-5 text-green-600 mx-auto mb-1" />
                        <p className="text-sm font-bold">MWK {schedule.price?.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">Price</p>
                      </div>
                      <div className="text-center">
                        <Users className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                        <p className="text-sm font-bold text-emerald-600">{schedule.availableSeats}</p>
                        <p className="text-xs text-gray-500">Seats</p>
                      </div>
                    </div>

                    {/* Completion Bar */}
                    <div className="mb-4">
                      <ScheduleCompletionBar schedule={schedule} bookings={scheduleBookingsList} />
                    </div>

                    {/* Operators */}
                    {assignedOperatorIds.length > 0 && (
                      <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-xs font-semibold text-blue-900 mb-2">Operator(s):</p>
                        <div className="space-y-1">
                          {assignedOperatorIds.map((opId, idx) => {
                            const opInfo = workerInfo.get(opId);
                            return (
                              <div key={`op-${idx}`} className="flex items-center gap-2">
                                <UserCircle className="w-3 h-3 text-blue-600" />
                                <span className="text-xs text-gray-900 font-medium">
                                  {opInfo 
                                    ? opInfo.name
                                    : `Operator ${opId.substring(0, 8)}...`}
                                  </span>
                                {opInfo?.region && (
                                  <>
                                    <span className="text-gray-400">•</span>
                                    <MapPinIcon className="w-3 h-3 text-gray-400" />
                                    <span className="text-xs text-gray-600">{opInfo.region}</span>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Conductor */}
                    {assignedConductor && (
                      <div className="mb-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                        <p className="text-xs font-semibold text-purple-900 mb-2">Conductor:</p>
                        <div className="flex items-center gap-2">
                          <UserCircle className="w-3 h-3 text-purple-600" />
                          <span className="text-xs text-gray-900 font-medium">
                            {assignedConductor.name}
                          </span>
                          {assignedConductor.email && (
                            <>
                              <span className="text-gray-400">•</span>
                              <span className="text-xs text-gray-600">{assignedConductor.email}</span>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedSchedule(schedule);
                          setShowDetailModal(true);
                        }}
                        className="flex-1"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>

                      {userProfile?.role === 'operator' && !schedule.isArchived && (
                        <button
                          onClick={() => {
                            setEditSchedule(schedule);
                            setShowEditModal(true);
                          }}
                          className="flex-1 px-4 py-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg text-sm font-medium"
                        >
                          <Edit3 className="w-4 h-4 inline mr-1" />
                          Edit
                        </button>
                      )}

                      {!schedule.isArchived && schedule.isCompleted && (
                        <Button
                          size="sm"
                          className="flex-1 bg-gray-600 hover:bg-gray-700"
                          onClick={() => updateScheduleStatus(schedule.id, "archived")}
                        >
                          <Archive className="w-4 h-4 mr-1" />
                          Archive
                        </Button>
                      )}

                      {schedule.isArchived && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateScheduleStatus(schedule.id, "active")}
                        >
                          <ArchiveRestore className="w-4 h-4 mr-1" />
                          Restore
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white rounded-xl border p-4">
              <div className="text-sm text-gray-600">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredSchedules.length)} of {filteredSchedules.length} schedules
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

      {/* Schedule Detail Modal */}
      {selectedSchedule && showDetailModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => {
          setShowDetailModal(false);
          setSelectedSchedule(null);
        }}>
          <div
            className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Schedule Details</h2>
              <button onClick={() => {
                setShowDetailModal(false);
                setSelectedSchedule(null);
              }} className="p-2 hover:bg-gray-100 rounded-lg">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Route</p>
                  <p className="font-semibold text-gray-900">
                    {routeMap.get(selectedSchedule.routeId)?.origin || "TBD"} →{" "}
                    {routeMap.get(selectedSchedule.routeId)?.destination || "TBD"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Bus</p>
                  <p className="font-semibold text-gray-900">
                    {busMap.get(selectedSchedule.busId)?.licensePlate || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Departure</p>
                  <p className="font-semibold text-gray-900">
                    {convertFirestoreDate(selectedSchedule.departureDateTime).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Arrival</p>
                  <p className="font-semibold text-gray-900">
                    {convertFirestoreDate(selectedSchedule.arrivalDateTime).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Bookings Summary */}
              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-900 mb-3">Bookings Summary</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="p-3 bg-blue-50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-blue-600">{scheduleBookings.length}</p>
                    <p className="text-xs text-gray-600">Total</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {scheduleBookings.filter(b => b.paymentStatus === "paid").length}
                    </p>
                    <p className="text-xs text-gray-600">Paid</p>
                  </div>
                  <div className="p-3 bg-yellow-50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-yellow-600">
                      {scheduleBookings.filter(b => b.paymentStatus === "pending").length}
                    </p>
                    <p className="text-xs text-gray-600">Pending</p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-purple-600">
                      MWK {scheduleBookings
                        .filter(b => b.paymentStatus === "paid")
                        .reduce((sum, b) => sum + (b.totalAmount || 0), 0)
                        .toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-600">Revenue</p>
                  </div>
                </div>
              </div>

              {/* Bookings List */}
              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-900 mb-3">Passengers</h3>
                {loadingBookings ? (
                  <div className="text-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                  </div>
                ) : scheduleBookings.length === 0 ? (
                  <p className="text-gray-600 text-center py-8">No bookings for this schedule</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {scheduleBookings.map(booking => (
                      <div key={booking.id} className="p-3 bg-gray-50 rounded-lg flex justify-between items-center">
                        <div>
                          <p className="font-medium text-gray-900">
                            {booking.passengerDetails?.[0]?.name || "N/A"}
                          </p>
                          <p className="text-xs text-gray-600">
                            Seats: {booking.seatNumbers?.join(", ") || "N/A"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">
                            MWK {booking.totalAmount?.toLocaleString() || "0"}
                          </p>
                          <div className="flex gap-1 mt-1">
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              booking.paymentStatus === "paid"
                                ? "bg-green-100 text-green-700"
                                : "bg-yellow-100 text-yellow-700"
                            }`}>
                              {booking.paymentStatus}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              booking.bookingStatus === "boarded"
                                ? "bg-green-100 text-green-700"
                                : booking.bookingStatus === "no-show"
                                ? "bg-red-100 text-red-700"
                                : "bg-gray-100 text-gray-700"
                            }`}>
                              {booking.bookingStatus}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      <Modal isOpen={showAddModal} onClose={() => {
        setShowAddModal(false);
        setRecurrenceConfig({ type: 'none', interval: 1, daysOfWeek: [] });
      }} title="Add New Schedule">
        <form onSubmit={handleAdd} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Route *</label>
              <select
                value={newSchedule.routeId || ''}
                onChange={e => setNewSchedule({ ...newSchedule, routeId: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select a route</option>
                {operatorRoutes.map(route => (
                  <option key={route.id} value={route.id}>
                    {route.origin} → {route.destination}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Bus *</label>
              <select
                value={newSchedule.busId || ''}
                onChange={e => handleBusChange(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select a bus</option>
                {activeBuses.map(bus => {
                  const availability = busAvailabilityMap.get(bus.id);
                  const occupancy = availability?.occupancyPercentage || 0;
                  
                  return (
                    <option 
                      key={bus.id} 
                      value={bus.id}
                    >
                      {availability?.isAvailable ? '✓' : '✗'} {bus.licensePlate} ({bus.capacity} seats) - {occupancy.toFixed(0)}% booked
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Departure *</label>
              <input
                type="datetime-local"
                value={formatDateTimeInput(newSchedule.departureDateTime)}
                onChange={e => setNewSchedule({ ...newSchedule, departureDateTime: new Date(e.target.value) })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Arrival *</label>
              <input
                type="datetime-local"
                value={formatDateTimeInput(newSchedule.arrivalDateTime)}
                onChange={e => setNewSchedule({ ...newSchedule, arrivalDateTime: new Date(e.target.value) })}
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
                value={newSchedule.price || ''}
                onChange={e => setNewSchedule({ ...newSchedule, price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                min="1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Available Seats *</label>
              <input
                type="number"
                value={newSchedule.availableSeats || ''}
                onChange={e => setNewSchedule({ ...newSchedule, availableSeats: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                min="1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
              <select
                value={newSchedule.status}
                onChange={e => setNewSchedule({ ...newSchedule, status: e.target.value as any })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="active">Active</option>
                <option value="cancelled">Cancelled</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg disabled:opacity-50"
            >
              {actionLoading ? 'Creating...' : 'Create Schedule'}
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
                  value={editSchedule.routeId || ''}
                  onChange={e => setEditSchedule({ ...editSchedule, routeId: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select Route</option>
                  {operatorRoutes.map(route => (
                    <option key={route.id} value={route.id}>
                      {route.origin} → {route.destination}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bus *</label>
                <select
                  value={editSchedule.busId || ''}
                  onChange={e => handleBusChange(e.target.value, true)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select Bus</option>
                  {activeBuses.map(bus => (
                    <option key={bus.id} value={bus.id}>
                      {bus.licensePlate} ({bus.capacity} seats)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Departure *</label>
                <input
                  type="datetime-local"
                  value={formatDateTimeInput(editSchedule.departureDateTime)}
                  onChange={e => setEditSchedule({ ...editSchedule, departureDateTime: new Date(e.target.value) })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Arrival *</label>
                <input
                  type="datetime-local"
                  value={formatDateTimeInput(editSchedule.arrivalDateTime)}
                  onChange={e => setEditSchedule({ ...editSchedule, arrivalDateTime: new Date(e.target.value) })}
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
                  value={editSchedule.price || ''}
                  onChange={e => setEditSchedule({ ...editSchedule, price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  min="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Available Seats *</label>
                <input
                  type="number"
                  value={editSchedule.availableSeats || ''}
                  onChange={e => setEditSchedule({ ...editSchedule, availableSeats: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  min="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
                <select
                  value={editSchedule.status || 'active'}
                  onChange={e => setEditSchedule({ ...editSchedule, status: e.target.value as any })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="active">Active</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg disabled:opacity-50"
              >
                {actionLoading ? 'Updating...' : 'Update Schedule'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default SchedulesTab;