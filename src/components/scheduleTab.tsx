"use client";

import { FC, useState, useMemo, useCallback, useEffect } from 'react';
import {
  collection, updateDoc, deleteDoc, doc, getDocs,
  getDoc, query, where, setDoc, Timestamp, writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { Schedule, Route, Bus } from '@/types';
import Modal from './Modals';
import {
  Plus, Edit3, Trash2, Search, MapPin, Clock, ArrowRight,
  Route as RouteIcon, CheckCircle, XCircle, DollarSign,
  Calendar as CalendarIcon, List, Grid, Repeat, Bus as BusIcon,
  Loader2, Users, ChevronLeft, ChevronRight, LayoutTemplate,
  Zap, AlertCircle, ToggleLeft, ToggleRight, Info,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type TemplateStatus = 'active' | 'inactive';
type ViewTab = 'instances' | 'templates';
type ViewMode = 'list' | 'weekly';
type FilterStatus = 'all' | 'active' | 'cancelled' | 'completed';

interface ScheduleTemplate {
  id: string;
  companyId: string;
  routeId: string;
  busId: string;
  departureTime: string;
  arrivalTime: string;
  daysOfWeek: DayOfWeek[];
  validFrom: Date;
  validUntil: Date | null;
  price: number;
  availableSeats: number;
  status: TemplateStatus;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Props ────────────────────────────────────────────────────────────────────

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

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = [
  { value: 0, short: 'Sun', label: 'Sunday' },
  { value: 1, short: 'Mon', label: 'Monday' },
  { value: 2, short: 'Tue', label: 'Tuesday' },
  { value: 3, short: 'Wed', label: 'Wednesday' },
  { value: 4, short: 'Thu', label: 'Thursday' },
  { value: 5, short: 'Fri', label: 'Friday' },
  { value: 6, short: 'Sat', label: 'Saturday' },
] as const;

const ITEMS_PER_PAGE = 8;
const WINDOW_DAYS = 14;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toDate = (v: any): Date => {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  if (typeof v?.toDate === 'function') return v.toDate();
  return new Date(v);
};

const fmtDateTime = (d: Date) =>
  d.toLocaleString('en-MW', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

const fmtDateInput = (d: Date) => {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const fmtDateTimeInput = (d: Date) => {
  const base = fmtDateInput(d);
  const h    = String(d.getHours()).padStart(2, '0');
  const min  = String(d.getMinutes()).padStart(2, '0');
  return `${base}T${h}:${min}`;
};

const instanceDocId = (templateId: string, date: Date) => {
  const y  = date.getFullYear();
  const m  = String(date.getMonth() + 1).padStart(2, '0');
  const d  = String(date.getDate()).padStart(2, '0');
  return `tpl_${templateId}_${y}-${m}-${d}`;
};

const applyTime = (date: Date, timeStr: string): Date => {
  const [h, m] = timeStr.split(':').map(Number);
  const r = new Date(date);
  r.setHours(h, m, 0, 0);
  return r;
};

const dayLabel = (days: DayOfWeek[]) => {
  if (days.length === 0) return 'Every day';
  if (days.length === 7) return 'Every day';
  if (JSON.stringify([...days].sort()) === JSON.stringify([1,2,3,4,5])) return 'Weekdays';
  if (JSON.stringify([...days].sort()) === JSON.stringify([0,6])) return 'Weekends';
  return days.map(d => DAYS[d].short).join(', ');
};

// ─── Empty state factories ────────────────────────────────────────────────────

const emptyTemplate = (companyId: string, userId: string): Omit<ScheduleTemplate, 'id'> => ({
  companyId,
  routeId: '',
  busId: '',
  departureTime: '07:00',
  arrivalTime: '14:00',
  daysOfWeek: [1, 2, 3, 4, 5],
  validFrom: new Date(),
  validUntil: null,
  price: 0,
  availableSeats: 0,
  status: 'active',
  isActive: true,
  createdBy: userId,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const emptySchedule = (companyId: string): Omit<Schedule, 'id'> => {
  const dep = new Date();
  dep.setDate(dep.getDate() + 1);
  dep.setHours(8, 0, 0, 0);
  const arr = new Date(dep);
  arr.setHours(14, 0, 0, 0);
  return {
    companyId, busId: '', routeId: '',
    departureDateTime: dep, arrivalDateTime: arr,
    departureLocation: '', arrivalLocation: '',
    price: 0, availableSeats: 0, bookedSeats: [],
    status: 'active', isActive: true,
    createdBy: '', createdAt: new Date(), updatedAt: new Date(),
  };
};


// ─── Weekly view with week navigation ────────────────────────────────────────

const startOfWeekDate = (offset: number): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay() + offset * 7);
  return d;
};

const WeeklyView: FC<{
  schedules: Schedule[];
  routeMap: Map<string, Route>;
  busMap: Map<string, Bus>;
  staffMap: Map<string, string>;
  userProfile: any;
  onEdit: (s: Schedule) => void;
}> = ({ schedules, routeMap, busMap, staffMap, userProfile, onEdit }) => {
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = useMemo(() => startOfWeekDate(weekOffset), [weekOffset]);
  const weekEnd   = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [weekStart]);

  const weekLabel = useMemo(() => {
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${weekStart.toLocaleDateString('en-MW', opts)} – ${weekEnd.toLocaleDateString('en-MW', { ...opts, year: 'numeric' })}`;
  }, [weekStart, weekEnd]);

  // Schedules that fall inside the displayed week
  const weekSchedules = useMemo(() =>
    schedules.filter(s => {
      const dep = toDate(s.departureDateTime);
      return dep >= weekStart && dep <= weekEnd;
    }),
    [schedules, weekStart, weekEnd],
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      {/* Week navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <button
          onClick={() => setWeekOffset(o => o - 1)}
          className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-900">{weekLabel}</p>
          {weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              className="text-xs text-blue-600 hover:underline"
            >
              Back to this week
            </button>
          )}
        </div>
        <button
          onClick={() => setWeekOffset(o => o + 1)}
          className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div className="grid grid-cols-7 text-center font-medium text-gray-700 border-b bg-gray-50 min-w-[900px]">
          {DAYS.map((d, i) => {
            const cellDate = new Date(weekStart);
            cellDate.setDate(weekStart.getDate() + i);
            const isToday = cellDate.toDateString() === new Date().toDateString();
            return (
              <div key={d.value} className={`p-3 border-r last:border-r-0 ${isToday ? 'bg-blue-50' : ''}`}>
                <p className={`text-xs font-semibold ${isToday ? 'text-blue-600' : 'text-gray-500'}`}>{d.short}</p>
                <p className={`text-lg font-bold ${isToday ? 'text-blue-600' : 'text-gray-800'}`}>
                  {cellDate.getDate()}
                </p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-7 min-w-[900px]">
          {DAYS.map((d, i) => {
            const cellDate = new Date(weekStart);
            cellDate.setDate(weekStart.getDate() + i);
            const isToday = cellDate.toDateString() === new Date().toDateString();

            const daySchs = weekSchedules
              .filter(s => toDate(s.departureDateTime).getDay() === d.value)
              .sort((a, b) => toDate(a.departureDateTime).getTime() - toDate(b.departureDateTime).getTime());

            return (
              <div key={d.value} className={`border-r last:border-r-0 p-2 space-y-2 min-h-[380px] ${isToday ? 'bg-blue-50/30' : ''}`}>
                {daySchs.length === 0
                  ? <p className="text-gray-300 text-xs text-center pt-10">—</p>
                  : daySchs.map(s => {
                    const r  = routeMap.get(s.routeId);
                    const b  = busMap.get(s.busId);
                    const r2         = routeMap.get(s.routeId);
                    const b2         = busMap.get(s.busId);
                    const opIds      = (r2?.assignedOperatorIds ?? []) as string[];
                    const busConIds2 = (b2?.conductorIds         ?? []) as string[];
                    const schConIds2 = ((s as any).assignedConductorIds ?? []) as string[];
                    const conIds     = schConIds2.length ? schConIds2 : busConIds2;
                    return (
                      <div
                        key={s.id}
                        onClick={() => userProfile?.role === 'operator' && onEdit(s)}
                        className={`p-2 rounded-lg border text-xs transition-colors ${
                          userProfile?.role === 'operator' ? 'cursor-pointer hover:shadow-sm' : ''
                        } ${
                          s.status === 'cancelled' ? 'bg-red-50 border-red-200' :
                          s.status === 'completed' ? 'bg-gray-50 border-gray-200' :
                                                     'bg-white border-blue-200'
                        }`}
                      >
                        <p className="font-bold text-gray-900">
                          {toDate(s.departureDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p className="text-gray-700 truncate font-medium">
                          {r ? `${r.origin} → ${r.destination}` : '—'}
                        </p>
                        <p className="text-gray-500">{b?.licensePlate ?? '—'}</p>
                        <p className="text-gray-500 mb-1">{s.availableSeats}/{b?.capacity ?? '?'} seats</p>
                        {opIds.map(uid => (
                          <div key={uid} className="flex items-center gap-1 mt-0.5">
                            <span className="w-3.5 h-3.5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[8px] shrink-0">O</span>
                            <span className="text-gray-600 truncate">{staffMap.get(uid) ?? '…'}</span>
                          </div>
                        ))}
                        {conIds.map(uid => (
                          <div key={uid} className="flex items-center gap-1 mt-0.5">
                            <span className="w-3.5 h-3.5 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-[8px] shrink-0">C</span>
                            <span className="text-gray-600 truncate">{staffMap.get(uid) ?? '…'}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })
                }
              </div>
            );
          })}
        </div>
      </div>

      {/* Week summary footer */}
      <div className="px-4 py-2 border-t bg-gray-50 flex items-center gap-4 text-xs text-gray-600">
        <span>{weekSchedules.length} schedule{weekSchedules.length !== 1 ? 's' : ''} this week</span>
        <span>•</span>
        <span>{weekSchedules.filter(s => s.status === 'active').length} active</span>
        <span>•</span>
        <span>{weekSchedules.reduce((a, s) => a + (s.availableSeats ?? 0), 0)} seats available</span>
      </div>
    </div>
  );
};

// ─── Stat card ────────────────────────────────────────────────────────────────

const StatCard: FC<{ label: string; value: string | number; icon: React.ReactNode; colour: string }> = ({
  label, value, icon, colour,
}) => (
  <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between">
    <div>
      <p className="text-sm text-gray-600">{label}</p>
      <p className={`text-2xl font-bold ${colour}`}>{value}</p>
    </div>
    {icon}
  </div>
);

// ─── Pagination bar ───────────────────────────────────────────────────────────

const Pagination: FC<{
  current: number; total: number; count: number; filtered: number;
  label: string; onChange: (p: number) => void;
}> = ({ current, total, count, filtered, label, onChange }) => {
  if (total <= 1) return null;
  const start = (current - 1) * count + 1;
  const end   = Math.min(current * count, filtered);

  // build a smart page window
  const pages: (number | '…')[] = [];
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    if (current > 3) pages.push('…');
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
    if (current < total - 2) pages.push('…');
    pages.push(total);
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between bg-white rounded-xl border p-3 sm:p-4 gap-2 sm:gap-3">
      <p className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
        Showing <span className="font-medium">{start}–{end}</span> of{' '}
        <span className="font-medium">{filtered}</span> {label}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(current - 1)} disabled={current === 1}
          className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {pages.map((p, i) =>
          p === '…'
            ? <span key={`e${i}`} className="px-2 text-gray-400">…</span>
            : (
              <button
                key={p}
                onClick={() => onChange(p as number)}
                className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                  current === p ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {p}
              </button>
            )
        )}
        <button
          onClick={() => onChange(current + 1)} disabled={current === total}
          className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const SchedulesTab: FC<SchedulesTabProps> = ({
  schedules, setSchedules, routes, buses,
  companyId, addSchedule, setError, setSuccess, user, userProfile,
}) => {

  // ── UI state ────────────────────────────────────────────────────────────────
  const [viewTab, setViewTab]       = useState<ViewTab>('instances');
  const [viewMode, setViewMode]     = useState<ViewMode>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [actionLoading, setActionLoading] = useState(false);
  const [materLoading, setMaterLoading]   = useState(false);

  // ── Pagination ───────────────────────────────────────────────────────────────
  const [instPage, setInstPage]  = useState(1);
  const [tplPage, setTplPage]    = useState(1);

  // ── Template state ───────────────────────────────────────────────────────────
  const [templates, setTemplates]           = useState<ScheduleTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [showTplAddModal, setShowTplAddModal]   = useState(false);
  const [showTplEditModal, setShowTplEditModal] = useState(false);
  const [editTemplate, setEditTemplate]         = useState<ScheduleTemplate | null>(null);
  const [newTemplate, setNewTemplate]           = useState<Omit<ScheduleTemplate, 'id'>>(() =>
    emptyTemplate(companyId, user?.uid ?? ''));

  // ── One-off schedule state ───────────────────────────────────────────────────
  const [showAddModal, setShowAddModal]   = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSchedule, setEditSchedule]   = useState<Schedule | null>(null);
  const [newSchedule, setNewSchedule]     = useState<Omit<Schedule, 'id'>>(() => emptySchedule(companyId));

  // ── Lookups ──────────────────────────────────────────────────────────────────
  const routeMap = useMemo(() => new Map(routes.map(r => [r.id, r])), [routes]);
  const busMap   = useMemo(() => new Map(buses.map(b => [b.id, b])), [buses]);
  const activeBuses = useMemo(() => buses.filter(b => b?.status === 'active'), [buses]);

  // ── Operator-assigned routes ──────────────────────────────────────────────────
  // For operators: only routes where their uid is in assignedOperatorIds.
  // Company admins and other roles see all routes.
  const assignedRouteIds = useMemo(() => {
    if (userProfile?.role !== 'operator') return null; // null = no restriction
    const ids = new Set<string>();
    routes.forEach(r => {
      if ((r.assignedOperatorIds ?? []).includes(user?.uid)) ids.add(r.id);
    });
    return ids;
  }, [routes, userProfile, user]);

  // Routes the operator can select in forms (all routes for admin, assigned only for operator)
  const selectableRoutes = useMemo(() => {
    if (!assignedRouteIds) return routes;
    return routes.filter(r => assignedRouteIds.has(r.id));
  }, [routes, assignedRouteIds]);

  // ── Fetch templates ──────────────────────────────────────────────────────────
  const fetchTemplates = useCallback(async () => {
    if (!companyId) return;
    setTemplatesLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'scheduleTemplates'), where('companyId', '==', companyId))
      );
      const list: ScheduleTemplate[] = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          validFrom:  toDate(data.validFrom),
          validUntil: data.validUntil ? toDate(data.validUntil) : null,
          createdAt:  toDate(data.createdAt),
          updatedAt:  toDate(data.updatedAt),
        } as ScheduleTemplate;
      });
      setTemplates(list);
    } catch (err: any) {
      setError(`Failed to load templates: ${err.message}`);
    } finally {
      setTemplatesLoading(false);
    }
  }, [companyId, setError]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  // ── Staff lookup map (uid → name) for schedule card display ──────────────────
  const [staffMap, setStaffMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!companyId) return;
    const fetchStaff = async () => {
      try {
        const map = new Map<string, string>();

        const resolveName = (data: any): string =>
          data.name?.trim() ||
          [data.firstName, data.lastName].filter(Boolean).join(' ').trim() ||
          data.email ||
          'Unknown';

        // ── 1. users collection (operators + conductors by role) ────────────
        // Indexes by Firestore doc ID AND uid field
        const usersSnap = await getDocs(
          query(collection(db, 'users'), where('companyId', '==', companyId),
            where('role', 'in', ['operator', 'conductor']))
        );
        usersSnap.docs.forEach(d => {
          const name = resolveName(d.data());
          map.set(d.id, name);
          const uid = d.data().uid;
          if (uid && uid !== d.id) map.set(uid, name);
        });

        // ── 2. conductors collection ────────────────────────────────────────
        // bus.conductorIds stores doc IDs from the /conductors collection
        const condSnap = await getDocs(
          query(collection(db, 'conductors'), where('companyId', '==', companyId))
        );
        condSnap.docs.forEach(d => {
          const name = resolveName(d.data());
          // Key: conductors collection doc ID (what bus.conductorIds stores)
          map.set(d.id, name);
          const uid = d.data().uid;
          if (uid && uid !== d.id) map.set(uid, name);
        });

        // ── 3. operators collection ─────────────────────────────────────────
        // route.assignedOperatorIds may store doc IDs from /operators collection
        const opSnap = await getDocs(
          query(collection(db, 'operators'), where('companyId', '==', companyId))
        );
        opSnap.docs.forEach(d => {
          const name = resolveName(d.data());
          map.set(d.id, name);
          const uid = d.data().uid;
          if (uid && uid !== d.id) map.set(uid, name);
        });

        setStaffMap(new Map(map));
      } catch (err) {
        console.warn('Could not fetch staff map:', err);
      }
    };
    fetchStaff();
  }, [companyId]);

  // ── Normalise incoming schedules ─────────────────────────────────────────────
  const validSchedules = useMemo(() =>
    schedules
      .filter(s => s?.id && s.routeId && s.busId)
      .map(s => ({
        ...s,
        createdBy:         s.createdBy ?? '',
        departureDateTime: toDate(s.departureDateTime),
        arrivalDateTime:   toDate(s.arrivalDateTime),
        createdAt:         toDate(s.createdAt),
        updatedAt:         toDate(s.updatedAt),
      })),
    [schedules],
  );

  // ── Filter schedules (instances) ─────────────────────────────────────────────
  const filteredSchedules = useMemo(() => {
    let res = validSchedules;
    // Operators only see schedules for routes they are assigned to
    if (assignedRouteIds !== null) {
      res = res.filter(s => assignedRouteIds.has(s.routeId));
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
    if (filterStatus !== 'all') res = res.filter(s => s.status === filterStatus);
    return res.sort((a, b) =>
      toDate(a.departureDateTime).getTime() - toDate(b.departureDateTime).getTime()
    );
  }, [validSchedules, searchTerm, filterStatus, routeMap, busMap, assignedRouteIds]);

  // ── Filter templates ─────────────────────────────────────────────────────────
  const filteredTemplates = useMemo(() => {
    let res = templates;
    // Operators only see templates for routes they are assigned to
    if (assignedRouteIds !== null) {
      res = res.filter(t => assignedRouteIds.has(t.routeId));
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      res = res.filter(t => {
        const r = routeMap.get(t.routeId);
        const b = busMap.get(t.busId);
        return (
          r?.origin?.toLowerCase().includes(q) ||
          r?.destination?.toLowerCase().includes(q) ||
          b?.licensePlate?.toLowerCase().includes(q)
        );
      });
    }
    return res;
  }, [templates, searchTerm, routeMap, busMap, assignedRouteIds]);

  // ── Paginate ─────────────────────────────────────────────────────────────────
  const pagedSchedules = useMemo(() => {
    const start = (instPage - 1) * ITEMS_PER_PAGE;
    return filteredSchedules.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredSchedules, instPage]);

  const pagedTemplates = useMemo(() => {
    const start = (tplPage - 1) * ITEMS_PER_PAGE;
    return filteredTemplates.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTemplates, tplPage]);

  const instTotalPages = Math.ceil(filteredSchedules.length / ITEMS_PER_PAGE);
  const tplTotalPages  = Math.ceil(filteredTemplates.length  / ITEMS_PER_PAGE);

  // ── Stats ────────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const scoped = assignedRouteIds
      ? validSchedules.filter(s => assignedRouteIds.has(s.routeId))
      : validSchedules;
    const scopedTpls = assignedRouteIds
      ? templates.filter(t => assignedRouteIds.has(t.routeId))
      : templates;
    return {
      total:      scoped.length,
      active:     scoped.filter(s => s.status === 'active').length,
      upcoming:   scoped.filter(s =>
        toDate(s.departureDateTime) > new Date() && s.status === 'active'
      ).length,
      templates:  scopedTpls.filter(t => t.isActive).length,
      totalSeats: scoped.reduce((a, s) => a + (s.availableSeats ?? 0), 0),
    };
  }, [validSchedules, templates, assignedRouteIds]);

  // ── Validation ───────────────────────────────────────────────────────────────
  const validateSchedule = useCallback((data: any): string | null => {
    if (!data.routeId)         return 'Please select a route';
    if (!data.busId)           return 'Please select a bus';
    if (!data.price || data.price <= 0) return 'Enter a valid price';
    if (!data.availableSeats || data.availableSeats <= 0) return 'Enter valid seat count';
    const bus = busMap.get(data.busId);
    if (!bus) return 'Selected bus not found';
    if (data.availableSeats > bus.capacity) return `Seats cannot exceed bus capacity (${bus.capacity})`;
    const dep = new Date(data.departureDateTime);
    const arr = new Date(data.arrivalDateTime);
    if (isNaN(dep.getTime()))  return 'Invalid departure time';
    if (isNaN(arr.getTime()))  return 'Invalid arrival time';
    if (dep <= new Date())     return 'Departure must be in the future';
    if (arr <= dep)            return 'Arrival must be after departure';
    return null;
  }, [busMap]);

  const validateTemplate = useCallback((t: Omit<ScheduleTemplate, 'id'>): string | null => {
    if (!t.routeId)           return 'Please select a route';
    if (!t.busId)             return 'Please select a bus';
    if (!t.departureTime)     return 'Enter a departure time';
    if (!t.arrivalTime)       return 'Enter an arrival time';
    if (t.price <= 0)         return 'Enter a valid price';
    if (t.availableSeats <= 0) return 'Enter valid seat count';
    const bus = busMap.get(t.busId);
    if (bus && t.availableSeats > bus.capacity)
      return `Seats cannot exceed bus capacity (${bus.capacity})`;
    return null;
  }, [busMap]);

  // ── Materialise schedules from all active templates ───────────────────────────
  const handleMaterialize = useCallback(async () => {
    const activeTemplates = templates.filter(t => t.isActive);
    if (!activeTemplates.length) {
      setError('No active templates to generate schedules from');
      return;
    }
    setMaterLoading(true);
    let created = 0;
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let batch = writeBatch(db);
      let ops   = 0;

      const flush = async () => {
        if (ops > 0) { await batch.commit(); batch = writeBatch(db); ops = 0; }
      };

      for (const tpl of activeTemplates) {
        for (let offset = 0; offset < WINDOW_DAYS; offset++) {
          const date = new Date(today);
          date.setDate(today.getDate() + offset);

          const validFrom  = toDate(tpl.validFrom);
          const validUntil = tpl.validUntil ? toDate(tpl.validUntil) : null;

          if (date < validFrom) continue;
          if (validUntil && date > validUntil) continue;
          if (tpl.daysOfWeek.length > 0 && !tpl.daysOfWeek.includes(date.getDay() as DayOfWeek)) continue;

          const dep = applyTime(date, tpl.departureTime);
          const arr = applyTime(date, tpl.arrivalTime);
          if (arr <= dep) arr.setDate(arr.getDate() + 1);

          const docId = instanceDocId(tpl.id, date);
          const ref   = doc(db, 'schedules', docId);

          batch.set(ref, {
            companyId:         tpl.companyId,
            routeId:           tpl.routeId,
            busId:             tpl.busId,
            templateId:        tpl.id,
            departureDateTime: Timestamp.fromDate(dep),
            arrivalDateTime:   Timestamp.fromDate(arr),
            departureLocation: '',
            arrivalLocation:   '',
            price:             tpl.price,
            availableSeats:    tpl.availableSeats,
            bookedSeats:       [],
            status:            'active',
            isActive:          true,
            createdBy:         user?.uid ?? '',
            createdAt:         serverTimestamp(),
            updatedAt:         serverTimestamp(),
          }, { merge: true });

          ops++;
          created++;
          if (ops >= 490) await flush();
        }
      }
      await flush();

      // Refresh schedule list
      const snap = await getDocs(
        query(collection(db, 'schedules'), where('companyId', '==', companyId))
      );
      setSchedules(snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        departureDateTime: toDate((d.data() as any).departureDateTime),
        arrivalDateTime:   toDate((d.data() as any).arrivalDateTime),
        createdAt:         toDate((d.data() as any).createdAt),
        updatedAt:         toDate((d.data() as any).updatedAt),
      })) as Schedule[]);

      setSuccess(`Generated ${created} schedule instances for the next ${WINDOW_DAYS} days`);
    } catch (err: any) {
      setError(`Materialisation failed: ${err.message}`);
    } finally {
      setMaterLoading(false);
    }
  }, [templates, companyId, user, setSchedules, setError, setSuccess]);

  // ── Template CRUD ─────────────────────────────────────────────────────────────

  const handleAddTemplate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateTemplate(newTemplate);
    if (err) { setError(err); return; }
    setActionLoading(true);
    try {
      const ref = doc(collection(db, 'scheduleTemplates'));
      const data = {
        ...newTemplate,
        validFrom:  Timestamp.fromDate(newTemplate.validFrom),
        validUntil: newTemplate.validUntil ? Timestamp.fromDate(newTemplate.validUntil) : null,
        createdAt:  serverTimestamp(),
        updatedAt:  serverTimestamp(),
      };
      await setDoc(ref, data);
      const saved: ScheduleTemplate = {
        ...newTemplate, id: ref.id,
        createdAt: new Date(), updatedAt: new Date(),
      };
      setTemplates(prev => [saved, ...prev]);
      setShowTplAddModal(false);
      setNewTemplate(emptyTemplate(companyId, user?.uid ?? ''));
      setSuccess('Template created! Click "Generate Schedules" to materialise instances.');
    } catch (err: any) {
      setError(`Failed to create template: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  }, [newTemplate, validateTemplate, companyId, user, setError, setSuccess]);

  const handleEditTemplate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTemplate) return;
    const err = validateTemplate(editTemplate);
    if (err) { setError(err); return; }
    setActionLoading(true);
    try {
      const ref = doc(db, 'scheduleTemplates', editTemplate.id);
      await updateDoc(ref, {
        routeId:        editTemplate.routeId,
        busId:          editTemplate.busId,
        departureTime:  editTemplate.departureTime,
        arrivalTime:    editTemplate.arrivalTime,
        daysOfWeek:     editTemplate.daysOfWeek,
        validFrom:      Timestamp.fromDate(toDate(editTemplate.validFrom)),
        validUntil:     editTemplate.validUntil ? Timestamp.fromDate(toDate(editTemplate.validUntil)) : null,
        price:          editTemplate.price,
        availableSeats: editTemplate.availableSeats,
        status:         editTemplate.status,
        isActive:       editTemplate.isActive,
        updatedAt:      serverTimestamp(),
      });
      setTemplates(prev => prev.map(t => t.id === editTemplate.id ? editTemplate : t));
      setShowTplEditModal(false);
      setEditTemplate(null);
      setSuccess('Template updated. Re-generate schedules to apply changes.');
    } catch (err: any) {
      setError(`Failed to update template: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  }, [editTemplate, validateTemplate, setError, setSuccess]);

  const handleDeleteTemplate = useCallback(async (id: string) => {
    if (!confirm('Delete this template? Existing schedule instances are not affected.')) return;
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, 'scheduleTemplates', id));
      setTemplates(prev => prev.filter(t => t.id !== id));
      setSuccess('Template deleted');
    } catch (err: any) {
      setError(`Failed to delete template: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  }, [setError, setSuccess]);

  const handleToggleTemplate = useCallback(async (tpl: ScheduleTemplate) => {
    setActionLoading(true);
    try {
      await updateDoc(doc(db, 'scheduleTemplates', tpl.id), {
        isActive: !tpl.isActive,
        status:   !tpl.isActive ? 'active' : 'inactive',
        updatedAt: serverTimestamp(),
      });
      setTemplates(prev =>
        prev.map(t => t.id === tpl.id
          ? { ...t, isActive: !t.isActive, status: !t.isActive ? 'active' : 'inactive' }
          : t
        )
      );
      setSuccess(`Template ${!tpl.isActive ? 'activated' : 'paused'}`);
    } catch (err: any) {
      setError(`Failed to toggle template: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  }, [setError, setSuccess]);

  // ── Instance CRUD ─────────────────────────────────────────────────────────────

  const handleAddSchedule = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (userProfile?.role === 'operator') {
      const routeDoc = await getDoc(doc(db, 'routes', newSchedule.routeId));
      if (!routeDoc.exists()) { setError('Selected route not found'); return; }
      if (!routeDoc.data()?.assignedOperatorIds?.includes(user?.uid)) {
        setError('You are not assigned to this route'); return;
      }
    }
    const err = validateSchedule(newSchedule);
    if (err) { setError(err); return; }
    setActionLoading(true);
    try {
      const id = await addSchedule({ ...newSchedule, createdBy: user?.uid, isActive: true });
      if (id) {
        setSchedules(prev => [{
          ...newSchedule, id,
          departureDateTime: new Date(newSchedule.departureDateTime),
          arrivalDateTime:   new Date(newSchedule.arrivalDateTime),
        } as Schedule, ...prev]);
        setShowAddModal(false);
        setNewSchedule(emptySchedule(companyId));
        setSuccess('One-off schedule added!');
      }
    } catch (err: any) {
      setError(`Failed to add schedule: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  }, [newSchedule, validateSchedule, addSchedule, user, companyId, setSchedules, setError, setSuccess, userProfile]);

  const handleEditSchedule = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSchedule) return;
    const err = validateSchedule(editSchedule);
    if (err) { setError(err); return; }
    setActionLoading(true);
    try {
      await updateDoc(doc(db, 'schedules', editSchedule.id), {
        routeId:                editSchedule.routeId,
        busId:                  editSchedule.busId,
        departureDateTime:      Timestamp.fromDate(new Date(editSchedule.departureDateTime)),
        arrivalDateTime:        Timestamp.fromDate(new Date(editSchedule.arrivalDateTime)),
        price:                  editSchedule.price,
        availableSeats:         editSchedule.availableSeats,
        status:                 editSchedule.status,
        isActive:               editSchedule.status === 'active',
        assignedConductorIds:   (editSchedule as any).assignedConductorIds ?? [],
        updatedAt:              serverTimestamp(),
      });
      setSchedules(prev => prev.map(s => s.id === editSchedule.id ? editSchedule : s));
      setShowEditModal(false);
      setEditSchedule(null);
      setSuccess('Schedule updated!');
    } catch (err: any) {
      setError(`Failed to update schedule: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  }, [editSchedule, validateSchedule, setSchedules, setError, setSuccess]);

  const handleDeleteSchedule = useCallback(async (id: string) => {
    if (!confirm('Delete this schedule?')) return;
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, 'schedules', id));
      setSchedules(prev => prev.filter(s => s.id !== id));
      setSuccess('Schedule deleted');
    } catch (err: any) {
      setError(`Failed to delete: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  }, [setSchedules, setError, setSuccess]);

  // ── Day-of-week toggle helper ─────────────────────────────────────────────────
  const toggleDay = (day: DayOfWeek, isEdit = false) => {
    const setter = isEdit
      ? (fn: (t: ScheduleTemplate) => ScheduleTemplate) => setEditTemplate(prev => prev ? fn(prev) : prev)
      : (fn: (t: Omit<ScheduleTemplate, 'id'>) => Omit<ScheduleTemplate, 'id'>) => setNewTemplate(fn);

    (setter as any)((prev: any) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d: DayOfWeek) => d !== day)
        : [...prev.daysOfWeek, day].sort((a: number, b: number) => a - b),
    }));
  };

  // ── Template form (shared for add + edit) ────────────────────────────────────
  const TemplateForm: FC<{
    data: Omit<ScheduleTemplate, 'id'> | ScheduleTemplate;
    onChange: (patch: any) => void;
    onSubmit: (e: React.FormEvent) => void;
    isEdit?: boolean;
    loading: boolean;
    onClose: () => void;
  }> = ({ data, onChange, onSubmit, isEdit = false, loading, onClose }) => (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Route + Bus */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Route *</label>
          <select
            value={data.routeId}
            onChange={e => onChange({ routeId: e.target.value })}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">Select Route</option>
            {selectableRoutes.map(r => (
              <option key={r.id} value={r.id}>{r.origin} → {r.destination}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Bus *</label>
          <select
            value={data.busId}
            onChange={e => {
              const cap = busMap.get(e.target.value)?.capacity ?? 0;
              onChange({ busId: e.target.value, availableSeats: cap });
            }}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">Select Bus</option>
            {activeBuses.map(b => (
              <option key={b.id} value={b.id}>{b.licensePlate} – {b.busType} (cap {b.capacity})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Times */}
      <div className="grid grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Departure time *</label>
          <input
            type="time"
            value={data.departureTime}
            onChange={e => onChange({ departureTime: e.target.value })}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Arrival time *</label>
          <input
            type="time"
            value={data.arrivalTime}
            onChange={e => onChange({ arrivalTime: e.target.value })}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
      </div>

      {/* Days of week */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Runs on *</label>
        <div className="flex flex-wrap gap-2">
          {DAYS.map(d => (
            <button
              key={d.value}
              type="button"
              onClick={() => toggleDay(d.value as DayOfWeek, isEdit)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                (data.daysOfWeek as DayOfWeek[]).includes(d.value as DayOfWeek)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {d.short}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onChange({ daysOfWeek: data.daysOfWeek.length === 7 ? [] : [0,1,2,3,4,5,6] })}
            className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            {data.daysOfWeek.length === 7 ? 'Clear all' : 'All'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {data.daysOfWeek.length === 0 ? '⚠ Select at least one day' : dayLabel(data.daysOfWeek as DayOfWeek[])}
        </p>
      </div>

      {/* Valid range */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Valid from *</label>
          <input
            type="date"
            value={fmtDateInput(toDate(data.validFrom))}
            onChange={e => onChange({ validFrom: new Date(e.target.value) })}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Valid until <span className="text-gray-400 font-normal">(leave blank = indefinite)</span>
          </label>
          <input
            type="date"
            value={data.validUntil ? fmtDateInput(toDate(data.validUntil)) : ''}
            onChange={e => onChange({ validUntil: e.target.value ? new Date(e.target.value) : null })}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Price + Seats */}
      <div className="grid grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Price (MWK) *</label>
          <input
            type="number" min="0" step="100"
            value={data.price || ''}
            onChange={e => onChange({ price: parseFloat(e.target.value) || 0 })}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="0" required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Available seats *</label>
          <input
            type="number" min="1"
            max={busMap.get(data.busId)?.capacity || 100}
            value={data.availableSeats || ''}
            onChange={e => onChange({ availableSeats: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="0" required
          />
          {data.busId && busMap.get(data.busId) && (
            <p className="text-xs text-gray-500 mt-1">Max: {busMap.get(data.busId)?.capacity}</p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-5 border-t">
        <button
          type="button" onClick={onClose} disabled={loading}
          className="px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit" disabled={loading}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Saving…</span></>
            : <><LayoutTemplate className="w-4 h-4" /><span>{isEdit ? 'Update Template' : 'Create Template'}</span></>
          }
        </button>
      </div>
    </form>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Stats ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <StatCard label="Total Schedules" value={stats.total}
          colour="text-gray-900"
          icon={<CalendarIcon className="w-8 h-8 text-blue-500" />} />
        <StatCard label="Active"           value={stats.active}
          colour="text-green-600"
          icon={<CheckCircle className="w-8 h-8 text-green-500" />} />
        <StatCard label="Upcoming"         value={stats.upcoming}
          colour="text-purple-600"
          icon={<Clock className="w-8 h-8 text-purple-500" />} />
        <StatCard label="Active Templates" value={stats.templates}
          colour="text-orange-600"
          icon={<LayoutTemplate className="w-8 h-8 text-orange-500" />} />
        <StatCard label="Total Capacity"   value={stats.totalSeats}
          colour="text-blue-600"
          icon={<Users className="w-8 h-8 text-blue-500" />} />
      </div>

      {/* ── Info banner ──────────────────────────────────────────────────────── */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
        <div className="text-sm text-blue-800">
          <span className="font-semibold">How it works: </span>
          Create a <span className="font-semibold">Schedule Template</span> for each recurring service
          (e.g. Mzuzu → Blantyre, 07:00, Mon–Fri). Then click{' '}
          <span className="font-semibold">Generate Schedules</span> to materialise bookable instances for
          the next {WINDOW_DAYS} days. One-off schedules can still be added manually.
        </div>
      </div>

      {/* ── Controls ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border p-4 space-y-4">
        {/* Search + filters row */}
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text" placeholder="Search by route or bus…"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setInstPage(1); setTplPage(1); }}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            {viewTab === 'instances' && (
              <select
                value={filterStatus}
                onChange={e => { setFilterStatus(e.target.value as FilterStatus); setInstPage(1); }}
                className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="cancelled">Cancelled</option>
                <option value="completed">Completed</option>
              </select>
            )}

            {/* Generate button — prominent */}
            {userProfile?.role === 'operator' && (
              <button
                onClick={handleMaterialize} disabled={materLoading || actionLoading}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 whitespace-nowrap shadow-sm"
              >
                {materLoading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Zap className="w-4 h-4" />
                }
                Generate Schedules
              </button>
            )}

            {/* Add template */}
            {userProfile?.role === 'operator' && (
              <button
                onClick={() => { setNewTemplate(emptyTemplate(companyId, user?.uid ?? '')); setShowTplAddModal(true); }}
                disabled={actionLoading}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-purple-600 text-white px-4 py-2.5 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 whitespace-nowrap shadow-sm"
              >
                <LayoutTemplate className="w-4 h-4" />
                New Template
              </button>
            )}

            {/* Add one-off schedule */}
            {userProfile?.role === 'operator' && (
              <button
                onClick={() => { setNewSchedule(emptySchedule(companyId)); setShowAddModal(true); }}
                disabled={actionLoading}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 whitespace-nowrap shadow-sm"
              >
                <Plus className="w-4 h-4" />
                One-off
              </button>
            )}
          </div>
        </div>

        {/* Tab + view mode row */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setViewTab('instances')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewTab === 'instances' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Schedules ({filteredSchedules.length}{filteredSchedules.length !== validSchedules.length ? ` of ${validSchedules.length}` : ''})
            </button>
            <button
              onClick={() => setViewTab('templates')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewTab === 'templates' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Templates ({filteredTemplates.length}{filteredTemplates.length !== templates.length ? ` of ${templates.length}` : ''})
            </button>
          </div>

          {/* View mode (list / weekly) — only on instances */}
          {viewTab === 'instances' && (
            <div className="flex gap-1">
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <List className="w-4 h-4" /> List
              </button>
              <button
                onClick={() => setViewMode('weekly')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  viewMode === 'weekly' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Grid className="w-4 h-4" /> Weekly
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          INSTANCES TAB
      ═══════════════════════════════════════════════════════════════════════ */}
      {viewTab === 'instances' && (
        <>
          {filteredSchedules.length === 0 ? (
            <div className="bg-white rounded-xl border p-12 text-center">
              <CalendarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {validSchedules.length === 0 ? 'No schedules yet' : 'No matching schedules'}
              </h3>
              <p className="text-gray-500 mb-6">
                {searchTerm || filterStatus !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Create a template and click "Generate Schedules", or add a one-off schedule'}
              </p>
            </div>
          ) : viewMode === 'list' ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                {pagedSchedules.map(schedule => {
                  const route = routeMap.get(schedule.routeId);
                  const bus   = busMap.get(schedule.busId);
                  const dep   = toDate(schedule.departureDateTime);
                  const arr   = toDate(schedule.arrivalDateTime);
                  const filled = bus?.capacity
                    ? ((bus.capacity - (schedule.availableSeats ?? 0)) / bus.capacity) * 100
                    : 0;
                  const isFromTemplate = !!(schedule as any).templateId;

                  return (
                    <div key={schedule.id} className="bg-white rounded-xl shadow-sm border hover:shadow-md transition-all duration-200">
                      <div className="p-4 sm:p-5">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <MapPin className="w-4 h-4 text-gray-400" />
                              <h3 className="font-semibold text-gray-900 text-sm sm:text-base leading-tight">
                                {route ? `${route.origin} → ${route.destination}` : 'Unknown Route'}
                              </h3>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <BusIcon className="w-3.5 h-3.5" />
                              <span>{bus?.licensePlate ?? 'Unknown'} • {bus?.busType}</span>
                              {isFromTemplate && (
                                <span className="ml-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">Template</span>
                              )}
                            </div>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            schedule.status === 'active'    ? 'bg-green-100 text-green-800' :
                            schedule.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                                              'bg-gray-100 text-gray-700'
                          }`}>
                            {schedule.status}
                          </span>
                        </div>

                        {/* Times */}
                        <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b">
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">Departure</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {dep.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <p className="text-xs text-gray-500">{dep.toLocaleDateString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">Arrival</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {arr.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <p className="text-xs text-gray-500">{arr.toLocaleDateString()}</p>
                          </div>
                        </div>

                        {/* Metrics */}
                        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
                          <div className="text-center">
                            <DollarSign className="w-4 h-4 text-green-600 mx-auto mb-0.5" />
                            <p className="text-xs font-bold text-gray-900">MWK {schedule.price?.toLocaleString()}</p>
                            <p className="text-xs text-gray-500">Price</p>
                          </div>
                          <div className="text-center">
                            <Users className="w-4 h-4 text-blue-600 mx-auto mb-0.5" />
                            <p className="text-xs font-bold text-gray-900">
                              {schedule.availableSeats}/{bus?.capacity ?? 0}
                            </p>
                            <p className="text-xs text-gray-500">Available</p>
                          </div>
                          <div className="text-center">
                            <CalendarIcon className="w-4 h-4 text-purple-600 mx-auto mb-0.5" />
                            <p className="text-xs font-bold text-gray-900">{filled.toFixed(0)}%</p>
                            <p className="text-xs text-gray-500">Filled</p>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mb-4">
                          <div
                            className={`h-full rounded-full transition-all ${
                              filled > 75 ? 'bg-red-500' : filled > 50 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${filled}%` }}
                          />
                        </div>

                        {/* Assigned Staff — operators from route, conductors from bus */}
                        {(() => {
                          const routeOpIds = (route?.assignedOperatorIds ?? []) as string[];
                          const busConIds  = (bus?.conductorIds           ?? []) as string[];
                          const schConIds  = ((schedule as any).assignedConductorIds ?? []) as string[];
                          // Schedule-level override wins; fall back to bus conductors
                          const conIds     = schConIds.length ? schConIds : busConIds;
                          const hasStaff   = routeOpIds.length > 0 || conIds.length > 0;
                          return (
                            <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-1.5">
                              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Assigned Staff</p>
                              {!hasStaff && (
                                <p className="text-xs text-gray-400 italic">No staff assigned</p>
                              )}
                              {routeOpIds.map(id => (
                                <div key={id} className="flex items-center gap-2 text-xs text-gray-700">
                                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px] shrink-0">O</span>
                                  <span className="font-medium truncate">{staffMap.get(id) ?? `ID:${id.slice(0,8)}…`}</span>
                                  <span className="text-gray-400 shrink-0">· Operator</span>
                                </div>
                              ))}
                              {conIds.map(id => (
                                <div key={id} className="flex items-center gap-2 text-xs text-gray-700">
                                  <span className="w-5 h-5 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-[10px] shrink-0">C</span>
                                  <span className="font-medium truncate">{staffMap.get(id) ?? `ID:${id.slice(0,8)}…`}</span>
                                  <span className="text-gray-400 shrink-0">· Conductor</span>
                                </div>
                              ))}
                            </div>
                          );
                        })()}

                        {/* Actions */}
                        {userProfile?.role === 'operator' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setEditSchedule(schedule); setShowEditModal(true); }}
                              disabled={actionLoading}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors text-sm disabled:opacity-50"
                            >
                              <Edit3 className="w-3.5 h-3.5" /> Edit
                            </button>
                            <button
                              onClick={() => handleDeleteSchedule(schedule.id)}
                              disabled={actionLoading}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors text-sm disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <Pagination
                current={instPage} total={instTotalPages}
                count={ITEMS_PER_PAGE} filtered={filteredSchedules.length}
                label="schedules" onChange={p => { setInstPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              />
            </>
          ) : (
            /* ── Weekly view ─────────────────────────────────────────────── */
            <WeeklyView
              schedules={filteredSchedules}
              routeMap={routeMap}
              busMap={busMap}
              staffMap={staffMap}
              userProfile={userProfile}
              onEdit={s => { setEditSchedule(s); setShowEditModal(true); }}
            />
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TEMPLATES TAB
      ═══════════════════════════════════════════════════════════════════════ */}
      {viewTab === 'templates' && (
        <>
          {templatesLoading ? (
            <div className="bg-white rounded-xl border p-12 text-center">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-3" />
              <p className="text-gray-500">Loading templates…</p>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="bg-white rounded-xl border p-12 text-center">
              <LayoutTemplate className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No templates yet</h3>
              <p className="text-gray-500 mb-6">
                Create your first template to automate recurring schedules
              </p>
              {userProfile?.role === 'operator' && (
                <button
                  onClick={() => { setNewTemplate(emptyTemplate(companyId, user?.uid ?? '')); setShowTplAddModal(true); }}
                  className="inline-flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <LayoutTemplate className="w-5 h-5" /> Create First Template
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                {pagedTemplates.map(tpl => {
                  const route = routeMap.get(tpl.routeId);
                  const bus   = busMap.get(tpl.busId);
                  return (
                    <div key={tpl.id} className={`bg-white rounded-xl shadow-sm border transition-all duration-200 ${
                      tpl.isActive ? 'hover:shadow-md' : 'opacity-60'
                    }`}>
                      <div className="p-4 sm:p-5">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <LayoutTemplate className="w-4 h-4 text-purple-600" />
                              <h3 className="font-semibold text-gray-900">
                                {route ? `${route.origin} → ${route.destination}` : 'Unknown Route'}
                              </h3>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <BusIcon className="w-3.5 h-3.5" />
                              <span>{bus?.licensePlate ?? 'Unknown'} • {bus?.busType}</span>
                            </div>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            tpl.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {tpl.isActive ? 'Active' : 'Paused'}
                          </span>
                        </div>

                        {/* Schedule details */}
                        <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b">
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">Departure</p>
                            <p className="text-sm font-semibold text-gray-900">{tpl.departureTime}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">Arrival</p>
                            <p className="text-sm font-semibold text-gray-900">{tpl.arrivalTime}</p>
                          </div>
                        </div>

                        {/* Recurrence + pricing */}
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <Repeat className="w-4 h-4 text-blue-500" />
                            <span>{dayLabel(tpl.daysOfWeek)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <CalendarIcon className="w-4 h-4 text-gray-400" />
                            <span>
                              From {fmtDateInput(toDate(tpl.validFrom))}
                              {tpl.validUntil ? ` → ${fmtDateInput(toDate(tpl.validUntil))}` : ' (indefinite)'}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-700">
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-4 h-4 text-green-500" />
                              MWK {tpl.price.toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="w-4 h-4 text-blue-500" />
                              {tpl.availableSeats} seats
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        {userProfile?.role === 'operator' && (
                          <div className="flex gap-2 pt-3 border-t">
                            <button
                              onClick={() => handleToggleTemplate(tpl)}
                              disabled={actionLoading}
                              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 ${
                                tpl.isActive
                                  ? 'text-yellow-700 bg-yellow-50 hover:bg-yellow-100'
                                  : 'text-green-700 bg-green-50 hover:bg-green-100'
                              }`}
                            >
                              {tpl.isActive
                                ? <><ToggleLeft className="w-3.5 h-3.5" /> Pause</>
                                : <><ToggleRight className="w-3.5 h-3.5" /> Activate</>
                              }
                            </button>
                            <button
                              onClick={() => { setEditTemplate(tpl); setShowTplEditModal(true); }}
                              disabled={actionLoading}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg text-sm transition-colors disabled:opacity-50"
                            >
                              <Edit3 className="w-3.5 h-3.5" /> Edit
                            </button>
                            <button
                              onClick={() => handleDeleteTemplate(tpl.id)}
                              disabled={actionLoading}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-sm transition-colors disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <Pagination
                current={tplPage} total={tplTotalPages}
                count={ITEMS_PER_PAGE} filtered={filteredTemplates.length}
                label="templates" onChange={p => { setTplPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              />
            </>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODALS
      ═══════════════════════════════════════════════════════════════════════ */}

      {/* Add Template */}
      <Modal isOpen={showTplAddModal} onClose={() => setShowTplAddModal(false)} title="New Schedule Template">
        <TemplateForm
          data={newTemplate}
          onChange={patch => setNewTemplate(prev => ({ ...prev, ...patch }))}
          onSubmit={handleAddTemplate}
          loading={actionLoading}
          onClose={() => setShowTplAddModal(false)}
        />
      </Modal>

      {/* Edit Template */}
      <Modal isOpen={showTplEditModal && !!editTemplate} onClose={() => { setShowTplEditModal(false); setEditTemplate(null); }} title="Edit Schedule Template">
        {editTemplate && (
          <TemplateForm
            data={editTemplate}
            onChange={patch => setEditTemplate(prev => prev ? { ...prev, ...patch } : prev)}
            onSubmit={handleEditTemplate}
            isEdit
            loading={actionLoading}
            onClose={() => { setShowTplEditModal(false); setEditTemplate(null); }}
          />
        )}
      </Modal>

      {/* Add One-off Schedule */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add One-off Schedule">
        <form onSubmit={handleAddSchedule} className="space-y-5">
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2 text-sm text-yellow-800">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            Use this for exceptional or non-recurring trips only. For regular services, create a Template instead.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Route *</label>
              <select
                value={newSchedule.routeId}
                onChange={e => setNewSchedule({ ...newSchedule, routeId: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select Route</option>
                {selectableRoutes.map(r => <option key={r.id} value={r.id}>{r.origin} → {r.destination}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Bus *</label>
              <select
                value={newSchedule.busId}
                onChange={e => {
                  const cap = busMap.get(e.target.value)?.capacity ?? 0;
                  setNewSchedule({ ...newSchedule, busId: e.target.value, availableSeats: cap });
                }}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select Bus</option>
                {activeBuses.map(b => <option key={b.id} value={b.id}>{b.licensePlate} – {b.busType} (cap {b.capacity})</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Departure *</label>
              <input
                type="datetime-local"
                value={fmtDateTimeInput(toDate(newSchedule.departureDateTime))}
                onChange={e => setNewSchedule({ ...newSchedule, departureDateTime: new Date(e.target.value) })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Arrival *</label>
              <input
                type="datetime-local"
                value={fmtDateTimeInput(toDate(newSchedule.arrivalDateTime))}
                onChange={e => setNewSchedule({ ...newSchedule, arrivalDateTime: new Date(e.target.value) })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Price (MWK) *</label>
              <input
                type="number" min="0" step="100"
                value={newSchedule.price || ''}
                onChange={e => setNewSchedule({ ...newSchedule, price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0" required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Seats *</label>
              <input
                type="number" min="1"
                max={busMap.get(newSchedule.busId)?.capacity || 100}
                value={newSchedule.availableSeats || ''}
                onChange={e => setNewSchedule({ ...newSchedule, availableSeats: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0" required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
              <select
                value={newSchedule.status}
                onChange={e => setNewSchedule({ ...newSchedule, status: e.target.value as any })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="active">Active</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => setShowAddModal(false)} disabled={actionLoading}
              className="px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={actionLoading}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2">
              {actionLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Adding…</span></>
                : <><Plus className="w-4 h-4" /><span>Add Schedule</span></>
              }
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Schedule */}
      <Modal isOpen={showEditModal && !!editSchedule} onClose={() => { setShowEditModal(false); setEditSchedule(null); }} title="Edit Schedule">
        {editSchedule && (
          <form onSubmit={handleEditSchedule} className="space-y-5">
            {(editSchedule as any).templateId && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg flex items-start gap-2 text-sm text-purple-800">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                This schedule was auto-generated from a template. Edits here only affect this instance.
                To change all future schedules, edit the template instead.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Route *</label>
                <select value={editSchedule.routeId}
                  onChange={e => setEditSchedule({ ...editSchedule, routeId: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" required>
                  <option value="">Select Route</option>
                  {selectableRoutes.map(r => <option key={r.id} value={r.id}>{r.origin} → {r.destination}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Bus *</label>
                <select value={editSchedule.busId}
                  onChange={e => {
                    const cap = busMap.get(e.target.value)?.capacity ?? 0;
                    setEditSchedule({ ...editSchedule, busId: e.target.value, availableSeats: cap });
                  }}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" required>
                  <option value="">Select Bus</option>
                  {activeBuses.map(b => <option key={b.id} value={b.id}>{b.licensePlate} – {b.busType} (cap {b.capacity})</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Departure *</label>
                <input type="datetime-local"
                  value={fmtDateTimeInput(toDate(editSchedule.departureDateTime))}
                  onChange={e => setEditSchedule({ ...editSchedule, departureDateTime: new Date(e.target.value) })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Arrival *</label>
                <input type="datetime-local"
                  value={fmtDateTimeInput(toDate(editSchedule.arrivalDateTime))}
                  onChange={e => setEditSchedule({ ...editSchedule, arrivalDateTime: new Date(e.target.value) })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" required />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Price (MWK) *</label>
                <input type="number" min="0" step="100"
                  value={editSchedule.price || ''}
                  onChange={e => setEditSchedule({ ...editSchedule, price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Seats *</label>
                <input type="number" min="1"
                  max={busMap.get(editSchedule.busId)?.capacity || 100}
                  value={editSchedule.availableSeats || ''}
                  onChange={e => setEditSchedule({ ...editSchedule, availableSeats: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0" required />
                {editSchedule.busId && busMap.get(editSchedule.busId) && (
                  <p className="text-xs text-gray-500 mt-1">Max: {busMap.get(editSchedule.busId)?.capacity}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                <select value={editSchedule.status}
                  onChange={e => setEditSchedule({ ...editSchedule, status: e.target.value as any })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option value="active">Active</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>

            {/* Conductor assignment */}
            {(() => {
              const bus = editSchedule ? busMap.get(editSchedule.busId) : null;
              const busConductors = (bus?.conductorIds ?? []) as string[];
              const currentConId  = ((editSchedule as any)?.assignedConductorIds?.[0]) ?? busConductors[0] ?? '';
              // build list of all conductors in company from staffMap
              const conductorOptions = Array.from(staffMap.entries())
                .filter(([uid]) => busConductors.includes(uid) || uid === currentConId);
              if (!conductorOptions.length) return null;
              return (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Assigned Conductor</label>
                  <select
                    value={currentConId}
                    onChange={e => setEditSchedule(prev => prev ? {
                      ...prev,
                      assignedConductorIds: e.target.value ? [e.target.value] : [],
                    } as any : prev)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">No conductor assigned</option>
                    {conductorOptions.map(([uid, name]) => (
                      <option key={uid} value={uid}>{name}</option>
                    ))}
                  </select>
                </div>
              );
            })()}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t">
              <button type="button" onClick={() => { setShowEditModal(false); setEditSchedule(null); }} disabled={actionLoading}
                className="px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={actionLoading}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2">
                {actionLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Updating…</span></>
                  : <><Edit3 className="w-4 h-4" /><span>Update Schedule</span></>
                }
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default SchedulesTab;