"use client";

import { FC, useState, useMemo, useCallback } from 'react';
import { updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { Schedule, Route, Bus } from '@/types';
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
  LayoutGrid,
  Repeat,
  X,
  Bus as BusIcon
} from 'lucide-react';
// Calendar dependencies
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parseISO, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';

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

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' }
];

// ────────────────────────────────────────────────
// Your existing helper functions (unchanged)
// ────────────────────────────────────────────────

const convertFirestoreDate = (date: any): Date => {
  if (!date) return new Date();
  if (date instanceof Date) return date;
  if (date.toDate && typeof date.toDate === 'function') return date.toDate();
  if (typeof date === 'string' || typeof date === 'number') return new Date(date);
  return new Date();
};

const formatDateTime = (date: Date | string | null | undefined): string => {
  if (!date) return 'Invalid Date';
  try {
    const d = convertFirestoreDate(date);
    if (isNaN(d.getTime())) return 'Invalid Date';
    return d.toLocaleString('en-MW', {
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

const formatDateInput = (date: Date | string | null | undefined): string => {
  if (!date) return '';
  try {
    const d = convertFirestoreDate(date);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
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
    departureDateTime: tomorrow,
    arrivalDateTime: arrival,
    departureLocation: '',
    arrivalLocation: '',
    price: 0,
    availableSeats: 0,
    bookedSeats: [],
    status: 'active',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };
};

// ────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────

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
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'cancelled' | 'completed'>('all');
  const [actionLoading, setActionLoading] = useState(false);
  const [newSchedule, setNewSchedule] = useState<Omit<Schedule, 'id'>>(() => createInitialSchedule(companyId));
  const [recurrenceConfig, setRecurrenceConfig] = useState<RecurrenceConfig>({
    type: 'none',
    interval: 1,
    daysOfWeek: []
  });
  const [recurrenceEndType, setRecurrenceEndType] = useState<'date' | 'occurrences'>('occurrences');
  const [viewMode, setViewMode] = useState<'list' | 'weekly' | 'calendar'>('list');

  const routeMap = useMemo(() => new Map(routes.map(r => [r.id, r])), [routes]);
  const busMap = useMemo(() => new Map(buses.map(b => [b.id, b])), [buses]);

  const validSchedules = useMemo(() => {
    return schedules
      .filter(s => s?.id && s.routeId && s.busId)
      .map(s => ({
        ...s,
        departureDateTime: convertFirestoreDate(s.departureDateTime),
        arrivalDateTime: convertFirestoreDate(s.arrivalDateTime),
        createdAt: convertFirestoreDate(s.createdAt),
        updatedAt: convertFirestoreDate(s.updatedAt),
      }));
  }, [schedules]);

  const filteredSchedules = useMemo(() => {
    let res = validSchedules;
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
    if (filterStatus !== 'all') {
      res = res.filter(s => s.status === filterStatus);
    }
    return res;
  }, [validSchedules, searchTerm, filterStatus, routeMap, busMap]);

  const stats = useMemo(() => ({
    total: validSchedules.length,
    active: validSchedules.filter(s => s.status === 'active').length,
    upcoming: validSchedules.filter(s => convertFirestoreDate(s.departureDateTime) > new Date() && s.status === 'active').length,
    totalSeats: validSchedules.reduce((a, s) => a + (s.availableSeats || 0), 0),
  }), [validSchedules]);

  const activeBuses = useMemo(() => buses.filter(b => b?.status === 'active'), [buses]);

  const previewRecurringSchedules = useMemo(() => {
    if (recurrenceConfig.type === 'none') return [];
    try {
      return generateRecurringDates(new Date(newSchedule.departureDateTime), recurrenceConfig).slice(0, 5);
    } catch {
      return [];
    }
  }, [newSchedule.departureDateTime, recurrenceConfig]);

  const toggleDayOfWeek = (day: number) => {
    setRecurrenceConfig(prev => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek?.includes(day)
        ? prev.daysOfWeek.filter(d => d !== day)
        : [...(prev.daysOfWeek || []), day]
    }));
  };

  const validateScheduleForm = useCallback((data: any): string | null => {
    // Your existing validation logic (route, bus, price, seats, times, capacity check)
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
    if (isEdit && editSchedule) {
      setEditSchedule({ ...editSchedule, busId });
    } else {
      setNewSchedule({ ...newSchedule, busId });
    }
  }, [newSchedule, editSchedule]);

  const handleDelete = useCallback(async (scheduleId: string) => {
    if (!window.confirm('Are you sure you want to delete this schedule?')) {
      return;
    }

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

      setSchedules(prev =>
        prev.map(s => s.id === editSchedule.id ? editSchedule : s)
      );

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

    const err = validateScheduleForm(newSchedule);
    if (err) {
      setError(err);
      return;
    }

    if (recurrenceConfig.type === 'weekly' && (recurrenceConfig.daysOfWeek?.length ?? 0) === 0) {
      setError('Please select at least one day for weekly recurrence');
      return;
    }

    setActionLoading(true);
    const added: Schedule[] = [];

    try {
      if (recurrenceConfig.type === 'none') {
        const id = await addSchedule({
          ...newSchedule,
          isActive: newSchedule.status === 'active'
        });
        if (id) {
          added.push({ id, ...newSchedule } as Schedule);
          setSuccess('Schedule added successfully!');
        }
      } else {
        const dates = generateRecurringDates(new Date(newSchedule.departureDateTime), recurrenceConfig);
        if (dates.length === 0) {
          setError('No valid recurring dates generated');
          return;
        }

        const depBase = new Date(newSchedule.departureDateTime);
        const arrBase = new Date(newSchedule.arrivalDateTime);
        const duration = arrBase.getTime() - depBase.getTime();

        let count = 0;
        for (const d of dates) {
          const newDep = new Date(d);
          newDep.setHours(depBase.getHours(), depBase.getMinutes());

          const newArr = new Date(newDep.getTime() + duration);

          const id = await addSchedule({
            ...newSchedule,
            departureDateTime: newDep,
            arrivalDateTime: newArr,
            isActive: newSchedule.status === 'active'
          });

          if (id) {
            added.push({
              id,
              ...newSchedule,
              departureDateTime: newDep,
              arrivalDateTime: newArr
            } as Schedule);
            count++;
          }
        }
        setSuccess(`${count} recurring schedules added!`);
      }

      // Fix loading glitch: optimistic update
      setSchedules(prev => [...prev, ...added]);

      setNewSchedule(createInitialSchedule(companyId));
      setRecurrenceConfig({ type: 'none', interval: 1, daysOfWeek: [] });
      setRecurrenceEndType('occurrences');
      setShowAddModal(false);

    } catch (err: any) {
      setError(`Failed to add schedule(s): ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  }, [
    newSchedule,
    recurrenceConfig,
    validateScheduleForm,
    addSchedule,
    companyId,
    setError,
    setSuccess,
    setSchedules
  ]);

  // ────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Schedules</p>
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
            <Clock className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Upcoming</p>
              <p className="text-2xl font-bold text-purple-600">{stats.upcoming}</p>
            </div>
            <MapPin className="w-8 h-8 text-purple-600" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Capacity</p>
              <p className="text-2xl font-bold text-orange-600">{stats.totalSeats}</p>
            </div>
            <Users className="w-8 h-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Controls + Toggle */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by route or bus..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as any)}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="cancelled">Cancelled</option>
              <option value="completed">Completed</option>
            </select>

            <button
              onClick={() => {
                setNewSchedule(createInitialSchedule(companyId));
                setRecurrenceConfig({ type: 'none', interval: 1, daysOfWeek: [] });
                setRecurrenceEndType('occurrences');
                setShowAddModal(true);
              }}
              className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors shadow-sm whitespace-nowrap"
            >
              <Plus className="w-5 h-5" />
              Add Schedule
            </button>
          </div>
        </div>

        {/* View Toggle */}
        <div className="mt-4 flex gap-2 flex-wrap">
          <button
            onClick={() => setViewMode('list')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              viewMode === 'list' ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <List className="w-4 h-4" />
            List
          </button>
          <button
            onClick={() => setViewMode('weekly')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              viewMode === 'weekly' ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Grid className="w-4 h-4" />
            Weekly
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              viewMode === 'calendar' ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <CalendarIcon className="w-4 h-4" />
            Calendar
          </button>
        </div>
      </div>

      {/* Content Area */}
      {filteredSchedules.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <CalendarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {validSchedules.length === 0 ? 'No schedules yet' : 'No matching schedules'}
          </h3>
          <p className="text-gray-500 mb-6">
            {searchTerm || filterStatus !== 'all' ? 'Try adjusting filters' : 'Create your first schedule to get started'}
          </p>
          {validSchedules.length === 0 && (
            <button
              onClick={() => {
                setNewSchedule(createInitialSchedule(companyId));
                setRecurrenceConfig({ type: 'none', interval: 1, daysOfWeek: [] });
                setRecurrenceEndType('occurrences');
                setShowAddModal(true);
              }}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add First Schedule
            </button>
          )}
        </div>
      ) : viewMode === 'list' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredSchedules.map(schedule => {
            const route = routeMap.get(schedule.routeId);
            const bus = busMap.get(schedule.busId);
            const depTime = convertFirestoreDate(schedule.departureDateTime);
            const arrTime = convertFirestoreDate(schedule.arrivalDateTime);
            const seatsFilled = bus?.capacity
              ? ((bus.capacity - (schedule.availableSeats || 0)) / bus.capacity) * 100
              : 0;

            return (
              <div
                key={schedule.id}
                className="bg-white rounded-xl shadow-sm border hover:shadow-md transition-all duration-200"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="w-5 h-5 text-gray-400" />
                        <h3 className="text-lg font-semibold text-gray-900">
                          {route ? `${route.origin} → ${route.destination}` : 'Unknown Route'}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <BusIcon className="w-4 h-4" />
                        <span>{bus?.licensePlate || 'Unknown'} • {bus?.busType}</span>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        schedule.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : schedule.status === 'cancelled'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {schedule.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Departure</p>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-gray-900">
                          {depTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">{depTime.toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Arrival</p>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-medium text-gray-900">
                          {arrTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">{arrTime.toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <DollarSign className="w-5 h-5 text-green-600 mx-auto mb-1" />
                      <p className="text-sm font-bold text-gray-900">MWK {schedule.price?.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">Price</p>
                    </div>
                    <div className="text-center">
                      <Users className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                      <p className="text-sm font-bold text-gray-900">
                        {schedule.availableSeats}/{bus?.capacity || 0}
                      </p>
                      <p className="text-xs text-gray-500">Available</p>
                    </div>
                    <div className="text-center">
                      <CalendarIcon className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                      <p className="text-sm font-bold text-gray-900">{seatsFilled.toFixed(0)}%</p>
                      <p className="text-xs text-gray-500">Filled</p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          seatsFilled > 75 ? 'bg-red-500' : seatsFilled > 50 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${seatsFilled}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditSchedule(schedule);
                        setShowEditModal(true);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
                      disabled={actionLoading}
                    >
                      <Edit3 className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(schedule.id)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                      disabled={actionLoading}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : viewMode === 'weekly' ? (
        <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
          <div className="grid grid-cols-7 text-center font-medium text-gray-700 border-b bg-gray-50 min-w-[1000px]">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="p-4 border-r last:border-r-0">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 min-w-[1000px]">
            {Array.from({ length: 7 }).map((_, i) => {
              const daySchedules = filteredSchedules
                .filter(s => convertFirestoreDate(s.departureDateTime).getDay() === i)
                .sort((a, b) => convertFirestoreDate(a.departureDateTime).getTime() - convertFirestoreDate(b.departureDateTime).getTime());

              return (
                <div key={i} className="border-r last:border-r-0 p-4 space-y-3 min-h-[500px]">
                  {daySchedules.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-10">No schedules</p>
                  ) : (
                    daySchedules.map(s => {
                      const r = routeMap.get(s.routeId);
                      const b = busMap.get(s.busId);
                      const dep = convertFirestoreDate(s.departureDateTime);
                      const filled = b?.capacity ? ((b.capacity - (s.availableSeats || 0)) / b.capacity) * 100 : 0;

                      return (
                        <div
                          key={s.id}
                          className="p-3 bg-gray-50 rounded-lg border hover:bg-gray-100 cursor-pointer transition-colors"
                          onClick={() => {
                            setEditSchedule(s);
                            setShowEditModal(true);
                          }}
                        >
                          <div className="font-medium text-gray-900 mb-1 text-sm">
                            {dep.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="text-xs text-gray-600 mb-1 truncate">
                            {r ? `${r.origin} → ${r.destination}` : 'Unknown'}
                          </div>
                          <div className="text-xs text-gray-500 mb-1">
                            Bus: {b?.licensePlate || 'N/A'}
                          </div>
                          <div className="text-xs text-gray-700">
                            {s.availableSeats}/{b?.capacity || '?'} ({filled.toFixed(0)}%)
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border p-4" style={{ height: '700px' }}>
          <Calendar
            localizer={localizer}
            events={filteredSchedules.map(s => {
              const r = routeMap.get(s.routeId);
              return {
                title: r ? `${r.origin} → ${r.destination}` : 'Schedule',
                start: convertFirestoreDate(s.departureDateTime),
                end: convertFirestoreDate(s.arrivalDateTime),
                allDay: false,
                resource: s
              };
            })}
            startAccessor="start"
            endAccessor="end"
            style={{ height: '100%' }}
            onSelectEvent={(e: any) => {
              setEditSchedule(e.resource);
              setShowEditModal(true);
            }}
            eventPropGetter={(e: any) => {
              const st = e.resource.status;
              let bg = '#3b82f6';
              if (st === 'cancelled') bg = '#ef4444';
              if (st === 'completed') bg = '#6b7280';
              return { style: { backgroundColor: bg, border: 'none', color: 'white' } };
            }}
            popup
            showMultiDayTimes
          />
        </div>
      )}
      {/* Add Modal with Recurrence */}
      <Modal isOpen={showAddModal} onClose={() => {
        setShowAddModal(false);
        setRecurrenceConfig({ type: 'none', interval: 1, daysOfWeek: [] });
        setRecurrenceEndType('occurrences');
      }} title="Add New Schedule">
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

          {/* Recurrence Section */}
          <div className="border-t pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Repeat className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-medium text-gray-900">Recurrence</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Repeat</label>
                <select
                  value={recurrenceConfig.type}
                  onChange={e => setRecurrenceConfig({ 
                    ...recurrenceConfig, 
                    type: e.target.value as RecurrenceType,
                    daysOfWeek: e.target.value === 'weekly' ? [] : undefined
                  })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="none">Does not repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              {recurrenceConfig.type !== 'none' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Repeat every
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={recurrenceConfig.interval}
                        onChange={e => setRecurrenceConfig({ 
                          ...recurrenceConfig, 
                          interval: parseInt(e.target.value) || 1 
                        })}
                        className="w-20 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <span className="text-sm text-gray-600">
                        {recurrenceConfig.type === 'daily' && 'day(s)'}
                        {recurrenceConfig.type === 'weekly' && 'week(s)'}
                        {recurrenceConfig.type === 'monthly' && 'month(s)'}
                      </span>
                    </div>
                  </div>

                  {recurrenceConfig.type === 'weekly' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Repeat on
                      </label>
                      <div className="flex gap-2 flex-wrap">
                        {DAYS_OF_WEEK.map(day => (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => toggleDayOfWeek(day.value)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                              recurrenceConfig.daysOfWeek?.includes(day.value)
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ends
                    </label>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          id="endByOccurrences"
                          checked={recurrenceEndType === 'occurrences'}
                          onChange={() => setRecurrenceEndType('occurrences')}
                          className="w-4 h-4 text-blue-600"
                        />
                        <label htmlFor="endByOccurrences" className="text-sm text-gray-700">
                          After
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={recurrenceConfig.occurrences || 10}
                          onChange={e => setRecurrenceConfig({ 
                            ...recurrenceConfig, 
                            occurrences: parseInt(e.target.value) || 10,
                            endDate: undefined
                          })}
                          disabled={recurrenceEndType !== 'occurrences'}
                          className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                        />
                        <span className="text-sm text-gray-600">occurrences</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          id="endByDate"
                          checked={recurrenceEndType === 'date'}
                          onChange={() => setRecurrenceEndType('date')}
                          className="w-4 h-4 text-blue-600"
                        />
                        <label htmlFor="endByDate" className="text-sm text-gray-700">
                          On
                        </label>
                        <input
                          type="date"
                          value={recurrenceConfig.endDate ? formatDateInput(recurrenceConfig.endDate) : ''}
                          onChange={e => setRecurrenceConfig({ 
                            ...recurrenceConfig, 
                            endDate: new Date(e.target.value),
                            occurrences: undefined
                          })}
                          disabled={recurrenceEndType !== 'date'}
                          className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Preview */}
                  {previewRecurringSchedules.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm font-medium text-blue-900 mb-2">
                        Preview (showing first {previewRecurringSchedules.length} schedules):
                      </p>
                      <ul className="text-sm text-blue-800 space-y-1">
                        {previewRecurringSchedules.map((date, idx) => (
                          <li key={idx}>
                            {date.toLocaleDateString('en-MW', { 
                              weekday: 'short', 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </li>
                        ))}
                        {recurrenceConfig.occurrences && recurrenceConfig.occurrences > 5 && (
                          <li className="text-blue-600">
                            ... and {recurrenceConfig.occurrences - 5} more
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t">
            <button 
              type="button" 
              onClick={() => {
                setShowAddModal(false);
                setRecurrenceConfig({ type: 'none', interval: 1, daysOfWeek: [] });
                setRecurrenceEndType('occurrences');
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
                  <span>Adding...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>
                    {recurrenceConfig.type === 'none' 
                      ? 'Add Schedule' 
                      : `Add ${recurrenceConfig.occurrences || 'Recurring'} Schedules`
                    }
                  </span>
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