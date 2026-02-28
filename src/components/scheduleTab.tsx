"use client";

import { FC, useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  collection, updateDoc, deleteDoc, doc, getDocs,
  getDoc, query, where, setDoc, Timestamp, writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { Schedule, Route, Bus } from '@/types';
import Modal from './Modals';
import {
  Plus, Edit3, Trash2, Search, MapPin, Clock,
  CheckCircle, XCircle, DollarSign,
  Calendar as CalendarIcon, Grid, Repeat, Bus as BusIcon,
  Loader2, Users, ChevronLeft, ChevronRight, LayoutTemplate,
  Zap, AlertCircle, ToggleLeft, ToggleRight, Info,
  AlertTriangle, Archive, Eye, EyeOff, ChevronDown, ChevronUp,
  Radio, CalendarClock, Ban, List, Flame,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type TemplateStatus = 'active' | 'inactive';
type ViewTab  = 'instances' | 'templates';
type ViewMode = 'grouped'   | 'weekly';

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
  { value: 0, short: 'Sun', label: 'Sunday'    },
  { value: 1, short: 'Mon', label: 'Monday'    },
  { value: 2, short: 'Tue', label: 'Tuesday'   },
  { value: 3, short: 'Wed', label: 'Wednesday' },
  { value: 4, short: 'Thu', label: 'Thursday'  },
  { value: 5, short: 'Fri', label: 'Friday'    },
  { value: 6, short: 'Sat', label: 'Saturday'  },
] as const;

const ITEMS_PER_PAGE      = 4;
const WINDOW_DAYS         = 14;
const ARCHIVE_AFTER_DAYS  = 5;   // hide completed/cancelled/missed after N days
const AUTO_MISSED_HOURS   = 4;   // auto-write 'missed' if operator doesn't act within N hours
const PAST_DUE_HOURS      = 2;   // schedule is "attention" if departure was > N hours ago

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toDate = (v: any): Date => {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  if (typeof v?.toDate === 'function') return v.toDate();
  return new Date(v);
};

const fmtDateInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

const fmtDateTimeInput = (d: Date) => {
  const base = fmtDateInput(d);
  return `${base}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};

const instanceDocId = (templateId: string, date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth()+1).padStart(2,'0');
  const d = String(date.getDate()).padStart(2,'0');
  return `tpl_${templateId}_${y}-${m}-${d}`;
};

const applyTime = (date: Date, timeStr: string): Date => {
  const [h, m] = timeStr.split(':').map(Number);
  const r = new Date(date); r.setHours(h, m, 0, 0); return r;
};

const dayLabel = (days: DayOfWeek[]) => {
  if (!days.length || days.length === 7) return 'Every day';
  if (JSON.stringify([...days].sort()) === JSON.stringify([1,2,3,4,5])) return 'Weekdays';
  if (JSON.stringify([...days].sort()) === JSON.stringify([0,6]))       return 'Weekends';
  return days.map(d => DAYS[d].short).join(', ');
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth()    === b.getMonth()    &&
  a.getDate()     === b.getDate();

const hoursSince  = (d: Date) => (Date.now() - d.getTime()) / 3_600_000;
const daysSince   = (d: Date) => (Date.now() - d.getTime()) / 86_400_000;

// ─── Bucket types & logic ─────────────────────────────────────────────────────
// Determines which section a schedule belongs to in the grouped view.

export type Bucket = 'live' | 'attention' | 'today' | 'upcoming' | 'completed' | 'cancelled' | 'missed';

function getBucket(s: Schedule): Bucket | null {
  const dep        = toDate(s.departureDateTime);
  const tripStatus = (s as any).tripStatus as string | undefined;
  const status     = s.status as string;

  // ── Permanently hidden ──────────────────────────────────────────────────
  if (status === 'archived') return null;

  // ── Terminal statuses — hide after ARCHIVE_AFTER_DAYS ──────────────────
  if (status === 'completed' || status === 'cancelled' || status === 'missed') {
    const changedAt = toDate((s as any).statusChangedAt || s.updatedAt);
    if (daysSince(changedAt) > ARCHIVE_AFTER_DAYS) return null;
    return status as Bucket;
  }

  // ── Live (conductor has started the trip) ──────────────────────────────
  if (tripStatus === 'boarding' || tripStatus === 'in_transit') return 'live';

  // ── Needs attention — departure passed with no trip activity ───────────
  if (status === 'active' && hoursSince(dep) > PAST_DUE_HOURS) return 'attention';

  // ── Today's upcoming ───────────────────────────────────────────────────
  if (status === 'active' && isSameDay(dep, new Date()) && dep > new Date()) return 'today';

  // ── Future ─────────────────────────────────────────────────────────────
  if (status === 'active' && dep > new Date()) return 'upcoming';

  return null;
}

// ─── Empty-state factories ────────────────────────────────────────────────────

const emptyTemplate = (companyId: string, userId: string): Omit<ScheduleTemplate, 'id'> => ({
  companyId, routeId: '', busId: '',
  departureTime: '07:00', arrivalTime: '14:00',
  daysOfWeek: [1, 2, 3, 4, 5],
  validFrom: new Date(), validUntil: null,
  price: 0, availableSeats: 0,
  status: 'active', isActive: true,
  createdBy: userId, createdAt: new Date(), updatedAt: new Date(),
});

const emptySchedule = (companyId: string): Omit<Schedule, 'id'> => {
  const dep = new Date(); dep.setDate(dep.getDate() + 1); dep.setHours(8, 0, 0, 0);
  const arr = new Date(dep); arr.setHours(14, 0, 0, 0);
  return {
    companyId, busId: '', routeId: '',
    departureDateTime: dep, arrivalDateTime: arr,
    departureLocation: '', arrivalLocation: '',
    price: 0, availableSeats: 0, bookedSeats: [],
    status: 'active', isActive: true,
    createdBy: '', createdAt: new Date(), updatedAt: new Date(),
  };
};

// ─── Weekly view (unchanged) ──────────────────────────────────────────────────

const WeeklyView: FC<{
  schedules: Schedule[];
  routeMap: Map<string, Route>;
  busMap: Map<string, Bus>;
  staffMap: Map<string, string>;
  userProfile: any;
  onEdit: (s: Schedule) => void;
}> = ({ schedules, routeMap, busMap, staffMap, userProfile, onEdit }) => {
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = useMemo(() => {
    const d = new Date(); d.setHours(0,0,0,0);
    d.setDate(d.getDate() - d.getDay() + weekOffset * 7); return d;
  }, [weekOffset]);

  const weekEnd = useMemo(() => {
    const d = new Date(weekStart); d.setDate(d.getDate() + 6); d.setHours(23,59,59,999); return d;
  }, [weekStart]);

  const weekLabel = useMemo(() => {
    const o: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${weekStart.toLocaleDateString('en-MW', o)} – ${weekEnd.toLocaleDateString('en-MW', { ...o, year: 'numeric' })}`;
  }, [weekStart, weekEnd]);

  const weekSchedules = useMemo(() =>
    schedules.filter(s => { const d = toDate(s.departureDateTime); return d >= weekStart && d <= weekEnd; }),
    [schedules, weekStart, weekEnd]);

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <button onClick={() => setWeekOffset(o => o - 1)} className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"><ChevronLeft className="w-4 h-4" /></button>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-900">{weekLabel}</p>
          {weekOffset !== 0 && <button onClick={() => setWeekOffset(0)} className="text-xs text-blue-600 hover:underline">Back to this week</button>}
        </div>
        <button onClick={() => setWeekOffset(o => o + 1)} className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"><ChevronRight className="w-4 h-4" /></button>
      </div>
      <div className="overflow-x-auto">
        <div className="grid grid-cols-7 border-b bg-gray-50 min-w-[900px]">
          {DAYS.map((d, i) => {
            const cell = new Date(weekStart); cell.setDate(weekStart.getDate() + i);
            const tdy  = isSameDay(cell, new Date());
            return (
              <div key={d.value} className={`p-3 text-center border-r last:border-r-0 ${tdy ? 'bg-blue-50' : ''}`}>
                <p className={`text-xs font-semibold ${tdy ? 'text-blue-600' : 'text-gray-500'}`}>{d.short}</p>
                <p className={`text-lg font-bold ${tdy ? 'text-blue-600' : 'text-gray-800'}`}>{cell.getDate()}</p>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-7 min-w-[900px]">
          {DAYS.map((d, i) => {
            const cell    = new Date(weekStart); cell.setDate(weekStart.getDate() + i);
            const tdy     = isSameDay(cell, new Date());
            const daySchs = weekSchedules
              .filter(s => toDate(s.departureDateTime).getDay() === d.value)
              .sort((a, b) => toDate(a.departureDateTime).getTime() - toDate(b.departureDateTime).getTime());
            return (
              <div key={d.value} className={`border-r last:border-r-0 p-2 space-y-2 min-h-[380px] ${tdy ? 'bg-blue-50/30' : ''}`}>
                {daySchs.length === 0
                  ? <p className="text-gray-300 text-xs text-center pt-10">—</p>
                  : daySchs.map(s => {
                    const r  = routeMap.get(s.routeId);
                    const b  = busMap.get(s.busId);
                    const ts = (s as any).tripStatus as string | undefined;
                    const bk = getBucket(s);
                    const bg = s.status === 'cancelled'    ? 'bg-red-50 border-red-200'
                             : s.status === 'completed'    ? 'bg-gray-50 border-gray-200'
                             : ts === 'boarding'           ? 'bg-green-50 border-green-300'
                             : ts === 'in_transit'         ? 'bg-blue-50 border-blue-300'
                             : bk === 'attention'          ? 'bg-amber-50 border-amber-300'
                             :                               'bg-white border-blue-200';
                    return (
                      <div key={s.id} onClick={() => userProfile?.role === 'operator' && onEdit(s)}
                        className={`p-2 rounded-lg border text-xs ${userProfile?.role === 'operator' ? 'cursor-pointer hover:shadow-sm' : ''} ${bg}`}>
                        <p className="font-bold text-gray-900">{toDate(s.departureDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        <p className="text-gray-700 truncate font-medium">{r ? `${r.origin} → ${r.destination}` : '—'}</p>
                        <p className="text-gray-500">{b?.licensePlate ?? '—'}</p>
                        {ts && ts !== 'scheduled' && (
                          <span className={`inline-block mt-1 px-1 py-0.5 rounded text-[9px] font-bold uppercase ${ts === 'boarding' ? 'bg-green-200 text-green-800' : ts === 'in_transit' ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-700'}`}>
                            {ts === 'in_transit' ? 'In Transit' : ts}
                          </span>
                        )}
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </div>
      <div className="px-4 py-2 border-t bg-gray-50 flex items-center gap-4 text-xs text-gray-600">
        <span>{weekSchedules.length} schedule{weekSchedules.length !== 1 ? 's' : ''} this week</span>
        <span>·</span>
        <span>{weekSchedules.filter(s => s.status === 'active').length} active</span>
      </div>
    </div>
  );
};

// ─── Section header ───────────────────────────────────────────────────────────

const SectionHeader: FC<{
  icon: React.ReactNode; title: string; count: number;
  textCls: string; bgCls: string; pillCls: string;
  collapsed: boolean; onToggle: () => void; hint?: string;
}> = ({ icon, title, count, textCls, bgCls, pillCls, collapsed, onToggle, hint }) => (
  <button onClick={onToggle}
    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border font-medium text-sm transition-all hover:opacity-90 ${bgCls} ${textCls}`}>
    <div className="flex items-center gap-2.5 min-w-0">
      {icon}
      <span className="font-semibold">{title}</span>
      <span className={`px-2 py-0.5 rounded-full text-xs font-bold shrink-0 ${pillCls}`}>{count}</span>
      {hint && <span className="text-xs opacity-60 font-normal hidden sm:block truncate">{hint}</span>}
    </div>
    {collapsed ? <ChevronDown className="w-4 h-4 opacity-50 shrink-0" /> : <ChevronUp className="w-4 h-4 opacity-50 shrink-0" />}
  </button>
);

// ─── Schedule card ────────────────────────────────────────────────────────────

const ScheduleCard: FC<{
  schedule: Schedule;
  bucket: Bucket;
  route: Route | undefined;
  bus: Bus | undefined;
  staffMap: Map<string, string>;
  userProfile: any;
  countdown: number | null;   // seconds until auto-missed (attention bucket only)
  onEdit: () => void;
  onAction: (action: 'complete' | 'cancel' | 'missed') => void;
  onArchive: () => void;
  loading: boolean;
}> = ({ schedule, bucket, route, bus, staffMap, userProfile, countdown, onEdit, onAction, onArchive, loading }) => {
  const dep        = toDate(schedule.departureDateTime);
  const arr        = toDate(schedule.arrivalDateTime);
  const tripStatus = (schedule as any).tripStatus as string | undefined;
  const isTemplate = !!(schedule as any).templateId;
  const filled     = bus?.capacity ? ((bus.capacity - (schedule.availableSeats ?? 0)) / bus.capacity) * 100 : 0;

  const accentCls =
    bucket === 'live'       ? 'border-l-green-500' :
    bucket === 'attention'  ? 'border-l-amber-500'  :
    bucket === 'today'      ? 'border-l-blue-500'   :
    bucket === 'completed'  ? 'border-l-gray-300'   :
    bucket === 'cancelled'  ? 'border-l-red-400'    :
    bucket === 'missed'     ? 'border-l-orange-400' :
    'border-l-slate-200';

  const dimmed = bucket === 'completed' || bucket === 'cancelled' || bucket === 'missed';

  const statusBadge = (() => {
    if (tripStatus && tripStatus !== 'scheduled') {
      const map: Record<string, string> = {
        boarding:   'bg-green-100 text-green-800',
        in_transit: 'bg-blue-100 text-blue-800',
        completed:  'bg-gray-100 text-gray-600',
      };
      const label = tripStatus === 'in_transit' ? '🚌 In Transit' : tripStatus === 'boarding' ? '🟢 Boarding' : '✓ Complete';
      return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${map[tripStatus] ?? 'bg-gray-100 text-gray-600'}`}>{label}</span>;
    }
    const statusMap: Record<string, string> = {
      active:    'bg-green-100 text-green-700',
      completed: 'bg-gray-100 text-gray-600',
      cancelled: 'bg-red-100 text-red-700',
      missed:    'bg-orange-100 text-orange-700',
    };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusMap[schedule.status] ?? 'bg-gray-100 text-gray-600'}`}>{schedule.status}</span>;
  })();

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-l-4 hover:shadow-md transition-all duration-200 ${accentCls} ${dimmed ? 'opacity-70' : ''}`}>
      <div className="p-4">
        {/* Route + status */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              <p className="font-semibold text-gray-900 text-sm truncate">
                {route ? `${route.origin} → ${route.destination}` : 'Unknown Route'}
              </p>
              {isTemplate && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] shrink-0">Template</span>}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <BusIcon className="w-3 h-3 shrink-0" />
              <span className="truncate">{bus?.licensePlate ?? 'No bus'} · {bus?.busType ?? '—'}</span>
            </div>
          </div>
          <div className="shrink-0">{statusBadge}</div>
        </div>

        {/* Times + metrics */}
        <div className="flex items-center gap-3 text-xs mb-2 flex-wrap">
          <div className="flex items-center gap-1 text-gray-700 font-medium">
            <Clock className="w-3 h-3 text-gray-400" />
            {dep.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            <span className="text-gray-400 mx-0.5">→</span>
            {arr.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <span className="text-gray-400">·</span>
          <div className="flex items-center gap-1 text-gray-500">
            <CalendarIcon className="w-3 h-3" />
            {dep.toLocaleDateString('en-MW', { day: 'numeric', month: 'short' })}
          </div>
          <div className="flex items-center gap-1 text-gray-500 ml-auto">
            <Users className="w-3 h-3" />
            {schedule.availableSeats}/{bus?.capacity ?? '?'}
          </div>
          <span className="font-semibold text-gray-700">MWK {schedule.price?.toLocaleString()}</span>
        </div>

        {/* Fill bar */}
        <div className="w-full bg-gray-100 rounded-full h-1 mb-2">
          <div className={`h-full rounded-full transition-all ${filled > 75 ? 'bg-red-400' : filled > 50 ? 'bg-amber-400' : 'bg-green-400'}`}
            style={{ width: `${Math.min(filled, 100)}%` }} />
        </div>

        {/* Staff pills */}
        {(() => {
          const opIds  = (route?.assignedOperatorIds ?? []) as string[];
          const conIds = ((schedule as any).assignedConductorIds?.length
            ? (schedule as any).assignedConductorIds
            : bus?.conductorIds ?? []) as string[];
          if (!opIds.length && !conIds.length) return null;
          return (
            <div className="flex flex-wrap gap-1 mb-2">
              {opIds.map(id => (
                <span key={id} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px]">
                  <span className="font-bold">O</span>{staffMap.get(id) ?? id.slice(0,8)}
                </span>
              ))}
              {conIds.map((id: string) => (
                <span key={id} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-50 text-green-700 rounded-full text-[10px]">
                  <span className="font-bold">C</span>{staffMap.get(id) ?? id.slice(0,8)}
                </span>
              ))}
            </div>
          );
        })()}

        {/* Attention banner */}
        {bucket === 'attention' && (
          <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-semibold text-amber-800">Departure passed with no trip activity</p>
              {countdown !== null && countdown > 0 ? (
                <p className="text-amber-700 mt-0.5">
                  Auto-marking missed in{' '}
                  <strong>{Math.floor(countdown / 3600)}h {Math.floor((countdown % 3600) / 60)}m</strong>
                  {' '}— act below to override
                </p>
              ) : (
                <p className="text-amber-700 mt-0.5">Marking as missed now…</p>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        {userProfile?.role === 'operator' && (
          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100">
            {(bucket === 'today' || bucket === 'upcoming' || bucket === 'attention') && (
              <>
                <button onClick={() => onAction('complete')} disabled={loading}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50">
                  <CheckCircle className="w-3.5 h-3.5" /> Complete
                </button>
                <button onClick={() => onAction('cancel')} disabled={loading}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50">
                  <Ban className="w-3.5 h-3.5" /> Cancel
                </button>
                {bucket === 'attention' && (
                  <button onClick={() => onAction('missed')} disabled={loading}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors disabled:opacity-50">
                    <AlertTriangle className="w-3.5 h-3.5" /> Mark Missed
                  </button>
                )}
                <button onClick={onEdit} disabled={loading}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50 ml-auto">
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </button>
              </>
            )}
            {(bucket === 'completed' || bucket === 'cancelled' || bucket === 'missed') && (
              <button onClick={onArchive} disabled={loading}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50">
                <Archive className="w-3.5 h-3.5" /> Archive now
              </button>
            )}
            {bucket === 'live' && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Radio className="w-3 h-3" /> Managed by conductor
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Stat card ────────────────────────────────────────────────────────────────

const StatCard: FC<{ label: string; value: string | number; icon: React.ReactNode; colour: string }> = ({ label, value, icon, colour }) => (
  <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between">
    <div>
      <p className="text-sm text-gray-600">{label}</p>
      <p className={`text-2xl font-bold ${colour}`}>{value}</p>
    </div>
    {icon}
  </div>
);

// ─── Pagination ───────────────────────────────────────────────────────────────

const Pagination: FC<{ current: number; total: number; count: number; filtered: number; label: string; onChange: (p: number) => void }> = ({ current, total, count, filtered, label, onChange }) => {
  if (total <= 1) return null;
  const start = (current - 1) * count + 1;
  const end   = Math.min(current * count, filtered);
  const pages: (number | '…')[] = [];
  if (total <= 4) { for (let i = 1; i <= total; i++) pages.push(i); }
  else {
    pages.push(1);
    if (current > 3) pages.push('…');
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
    if (current < total - 2) pages.push('…');
    pages.push(total);
  }
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between bg-white rounded-xl border p-3 gap-2">
      <p className="text-xs sm:text-sm text-gray-600">Showing <span className="font-medium">{start}–{end}</span> of <span className="font-medium">{filtered}</span> {label}</p>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(current - 1)} disabled={current === 1} className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
        {pages.map((p, i) => p === '…' ? <span key={`e${i}`} className="px-2 text-gray-400">…</span> : (
          <button key={p} onClick={() => onChange(p as number)}
            className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${current === p ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{p}</button>
        ))}
        <button onClick={() => onChange(current + 1)} disabled={current === total} className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const SchedulesTab: FC<SchedulesTabProps> = ({
  schedules, setSchedules, routes, buses,
  companyId, addSchedule, setError, setSuccess, user, userProfile,
}) => {
  const [viewTab,    setViewTab]    = useState<ViewTab>('instances');
  const [viewMode,   setViewMode]   = useState<ViewMode>('grouped');
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [materLoading,  setMaterLoading]  = useState(false);

  // Which buckets are collapsed; terminal ones start collapsed
  const [collapsed, setCollapsed] = useState<Record<Bucket, boolean>>({
    live: false, attention: false, today: false, upcoming: false,
    completed: true, cancelled: true, missed: true,
  });
  const toggleCollapse = (b: Bucket) => setCollapsed(p => ({ ...p, [b]: !p[b] }));

  const [upcomingPage,  setUpcomingPage]  = useState(1);
  const [attentionPage, setAttentionPage] = useState(1);

  // Confirm modal for complete / cancel / missed
  const [confirmModal, setConfirmModal] = useState<{ schedule: Schedule; action: 'complete' | 'cancel' | 'missed' } | null>(null);

  // Template state
  const [templates,         setTemplates]         = useState<ScheduleTemplate[]>([]);
  const [templatesLoading,  setTemplatesLoading]  = useState(false);
  const [showTplAddModal,   setShowTplAddModal]   = useState(false);
  const [showTplEditModal,  setShowTplEditModal]  = useState(false);
  const [editTemplate,      setEditTemplate]      = useState<ScheduleTemplate | null>(null);
  const [newTemplate,       setNewTemplate]       = useState<Omit<ScheduleTemplate, 'id'>>(() => emptyTemplate(companyId, user?.uid ?? ''));

  // Schedule add/edit
  const [showAddModal,  setShowAddModal]  = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSchedule,  setEditSchedule] = useState<Schedule | null>(null);
  const [newSchedule,   setNewSchedule]  = useState<Omit<Schedule, 'id'>>(() => emptySchedule(companyId));

  // Lookups
  const routeMap    = useMemo(() => new Map(routes.map(r => [r.id, r])), [routes]);
  const busMap      = useMemo(() => new Map(buses.map(b => [b.id, b])), [buses]);
  const activeBuses = useMemo(() => buses.filter(b => b?.status === 'active'), [buses]);

  const assignedRouteIds = useMemo(() => {
    if (userProfile?.role !== 'operator') return null;
    const ids = new Set<string>();
    routes.forEach(r => { if ((r.assignedOperatorIds ?? []).includes(user?.uid)) ids.add(r.id); });
    return ids;
  }, [routes, userProfile, user]);

  const selectableRoutes = useMemo(() =>
    assignedRouteIds ? routes.filter(r => assignedRouteIds.has(r.id)) : routes,
    [routes, assignedRouteIds]);

  // Staff map
  const [staffMap, setStaffMap] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    if (!companyId) return;
    (async () => {
      try {
        const map = new Map<string, string>();
        const name = (d: any) => d.name?.trim() || [d.firstName, d.lastName].filter(Boolean).join(' ').trim() || d.email || '?';
        for (const coll of ['users', 'conductors', 'operators']) {
          const s = await getDocs(query(collection(db, coll), where('companyId', '==', companyId)));
          s.docs.forEach(d => { map.set(d.id, name(d.data())); const uid = d.data().uid; if (uid && uid !== d.id) map.set(uid, name(d.data())); });
        }
        setStaffMap(new Map(map));
      } catch {}
    })();
  }, [companyId]);

  // Templates
  const fetchTemplates = useCallback(async () => {
    if (!companyId) return;
    setTemplatesLoading(true);
    try {
      const s = await getDocs(query(collection(db, 'scheduleTemplates'), where('companyId', '==', companyId)));
      setTemplates(s.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, validFrom: toDate(data.validFrom), validUntil: data.validUntil ? toDate(data.validUntil) : null, createdAt: toDate(data.createdAt), updatedAt: toDate(data.updatedAt) } as ScheduleTemplate;
      }));
    } catch (e: any) { setError(`Failed to load templates: ${e.message}`); }
    finally { setTemplatesLoading(false); }
  }, [companyId, setError]);
  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  // Normalise schedules
  const validSchedules = useMemo(() =>
    schedules.filter(s => s?.id && s.routeId && s.busId).map(s => ({
      ...s,
      createdBy:         s.createdBy ?? '',
      departureDateTime: toDate(s.departureDateTime),
      arrivalDateTime:   toDate(s.arrivalDateTime),
      createdAt:         toDate(s.createdAt),
      updatedAt:         toDate(s.updatedAt),
    })), [schedules]);

  const scopedSchedules = useMemo(() => {
    let res = validSchedules;
    if (assignedRouteIds) res = res.filter(s => assignedRouteIds.has(s.routeId));
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      res = res.filter(s => {
        const r = routeMap.get(s.routeId); const b = busMap.get(s.busId);
        return r?.origin?.toLowerCase().includes(q) || r?.destination?.toLowerCase().includes(q) || b?.licensePlate?.toLowerCase().includes(q);
      });
    }
    return res;
  }, [validSchedules, assignedRouteIds, searchTerm, routeMap, busMap]);

  // Build bucketed map
  const bucketed = useMemo(() => {
    const map: Record<Bucket, Schedule[]> = { live: [], attention: [], today: [], upcoming: [], completed: [], cancelled: [], missed: [] };
    scopedSchedules.forEach(s => { const b = getBucket(s); if (b) map[b].push(s); });
    const asc  = (a: Schedule, b: Schedule) => toDate(a.departureDateTime).getTime() - toDate(b.departureDateTime).getTime();
    const desc = (a: Schedule, b: Schedule) => toDate(b.departureDateTime).getTime() - toDate(a.departureDateTime).getTime();
    map.live.sort(asc); map.attention.sort(asc); map.today.sort(asc); map.upcoming.sort(asc);
    map.completed.sort(desc); map.cancelled.sort(desc); map.missed.sort(desc);
    return map;
  }, [scopedSchedules]);

  // ── Auto-missed detection ─────────────────────────────────────────────────────
  // When a schedule enters 'attention', record the timestamp.
  // After AUTO_MISSED_HOURS with no operator action, silently write status:'missed'.
  const flaggedAtRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    bucketed.attention.forEach(s => {
      if (!flaggedAtRef.current.has(s.id)) {
        flaggedAtRef.current.set(s.id, Date.now());
      }
    });

    const interval = setInterval(async () => {
      for (const s of bucketed.attention) {
        const flaggedAt = flaggedAtRef.current.get(s.id);
        if (!flaggedAt) continue;
        const hoursElapsed = (Date.now() - flaggedAt) / 3_600_000;
        if (hoursElapsed < AUTO_MISSED_HOURS) continue;

        // Time's up — auto-write
        try {
          await updateDoc(doc(db, 'schedules', s.id), {
            status: 'missed', isActive: false,
            statusChangedAt: new Date(), updatedAt: serverTimestamp(),
          });
          flaggedAtRef.current.delete(s.id);
          setSchedules(prev => prev.map(p => p.id === s.id ? { ...p, status: 'missed' as any, isActive: false } : p));
        } catch {}
      }
    }, 60_000); // check every minute

    return () => clearInterval(interval);
  }, [bucketed.attention, setSchedules]);

  // Countdown helper — seconds remaining before auto-missed fires
  const getCountdown = useCallback((id: string): number | null => {
    const flaggedAt = flaggedAtRef.current.get(id);
    if (!flaggedAt) return null;
    return Math.max(0, Math.floor((AUTO_MISSED_HOURS * 3_600_000 - (Date.now() - flaggedAt)) / 1000));
  }, []);

  // ── Status mutations ──────────────────────────────────────────────────────────

  const applyStatus = async (s: Schedule, newStatus: string) => {
    setActionLoading(true);
    try {
      await updateDoc(doc(db, 'schedules', s.id), {
        status:          newStatus,
        isActive:        newStatus === 'active',
        isCompleted:     newStatus === 'completed',
        completedAt:     newStatus === 'completed' ? new Date() : null,
        statusChangedAt: new Date(),
        updatedAt:       serverTimestamp(),
      });
      setSchedules(prev => prev.map(p => p.id === s.id ? { ...p, status: newStatus as any, isActive: newStatus === 'active' } : p));
      flaggedAtRef.current.delete(s.id);
      setSuccess(`Schedule marked as ${newStatus}`);
    } catch (e: any) { setError(`Failed: ${e.message}`); }
    finally { setActionLoading(false); setConfirmModal(null); }
  };

  const handleArchive = async (s: Schedule) => {
    setActionLoading(true);
    try {
      await updateDoc(doc(db, 'schedules', s.id), { status: 'archived', updatedAt: serverTimestamp() });
      setSchedules(prev => prev.filter(p => p.id !== s.id));
      setSuccess('Schedule archived');
    } catch (e: any) { setError(`Failed: ${e.message}`); }
    finally { setActionLoading(false); }
  };

  // ── Stats ────────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const tplScoped = assignedRouteIds ? templates.filter(t => assignedRouteIds.has(t.routeId)) : templates;
    return {
      live:       bucketed.live.length,
      today:      bucketed.today.length,
      upcoming:   bucketed.upcoming.length,
      attention:  bucketed.attention.length,
      templates:  tplScoped.filter(t => t.isActive).length,
      totalSeats: scopedSchedules.filter(s => s.status === 'active').reduce((a, s) => a + (s.availableSeats ?? 0), 0),
    };
  }, [bucketed, templates, scopedSchedules, assignedRouteIds]);

  // ── Materialise ──────────────────────────────────────────────────────────────

  const handleMaterialize = useCallback(async () => {
    const active = templates.filter(t => t.isActive);
    if (!active.length) { setError('No active templates to generate schedules from'); return; }
    setMaterLoading(true);
    let created = 0;
    try {
      const today = new Date(); today.setHours(0,0,0,0);
      const routeCache = new Map<string, Route>();
      let batch = writeBatch(db); let ops = 0;
      const flush = async () => { if (ops > 0) { await batch.commit(); batch = writeBatch(db); ops = 0; } };

      for (const tpl of active) {
        let route = routeCache.get(tpl.routeId);
        if (!route) {
          const snap = await getDoc(doc(db, 'routes', tpl.routeId));
          if (snap.exists()) { route = { id: snap.id, ...snap.data() } as Route; routeCache.set(tpl.routeId, route); }
        }
        for (let offset = 0; offset < WINDOW_DAYS; offset++) {
          const date = new Date(today); date.setDate(today.getDate() + offset);
          const validFrom  = toDate(tpl.validFrom);
          const validUntil = tpl.validUntil ? toDate(tpl.validUntil) : null;
          if (date < validFrom) continue;
          if (validUntil && date > validUntil) continue;
          if (tpl.daysOfWeek.length > 0 && !tpl.daysOfWeek.includes(date.getDay() as DayOfWeek)) continue;
          const dep = applyTime(date, tpl.departureTime);
          const arr = applyTime(date, tpl.arrivalTime);
          if (arr <= dep) arr.setDate(arr.getDate() + 1);
          const ref = doc(db, 'schedules', instanceDocId(tpl.id, date));
          batch.set(ref, {
            companyId: tpl.companyId, routeId: tpl.routeId, busId: tpl.busId, templateId: tpl.id,
            departureDateTime: Timestamp.fromDate(dep), arrivalDateTime: Timestamp.fromDate(arr),
            departureLocation: route?.origin ?? '', arrivalLocation: route?.destination ?? '',
            stops: route?.stops ?? [],
            price: tpl.price, availableSeats: tpl.availableSeats, bookedSeats: [],
            status: 'active', isActive: true,
            tripStatus: 'scheduled', currentStopIndex: 0, departedStops: [],
            createdBy: user?.uid ?? '', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
          }, { merge: true });
          ops++; created++;
          if (ops >= 490) await flush();
        }
      }
      await flush();
      const snap = await getDocs(query(collection(db, 'schedules'), where('companyId', '==', companyId)));
      setSchedules(snap.docs.map(d => ({
        id: d.id, ...d.data(),
        departureDateTime: toDate((d.data() as any).departureDateTime),
        arrivalDateTime:   toDate((d.data() as any).arrivalDateTime),
        createdAt:         toDate((d.data() as any).createdAt),
        updatedAt:         toDate((d.data() as any).updatedAt),
      })) as Schedule[]);
      setSuccess(`Generated ${created} schedule instances for the next ${WINDOW_DAYS} days`);
    } catch (e: any) { setError(`Materialisation failed: ${e.message}`); }
    finally { setMaterLoading(false); }
  }, [templates, companyId, user, setSchedules, setError, setSuccess]);

  // ── Template CRUD ─────────────────────────────────────────────────────────────

  const validateTemplate = useCallback((t: any): string | null => {
    if (!t.routeId)            return 'Please select a route';
    if (!t.busId)              return 'Please select a bus';
    if (!t.departureTime)      return 'Enter a departure time';
    if (!t.arrivalTime)        return 'Enter an arrival time';
    if (t.price <= 0)          return 'Enter a valid price';
    if (t.availableSeats <= 0) return 'Enter valid seat count';
    const bus = busMap.get(t.busId);
    if (bus && t.availableSeats > bus.capacity) return `Seats cannot exceed bus capacity (${bus.capacity})`;
    return null;
  }, [busMap]);

  const handleAddTemplate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateTemplate(newTemplate); if (err) { setError(err); return; }
    setActionLoading(true);
    try {
      const ref = doc(collection(db, 'scheduleTemplates'));
      await setDoc(ref, { ...newTemplate, validFrom: Timestamp.fromDate(newTemplate.validFrom), validUntil: newTemplate.validUntil ? Timestamp.fromDate(newTemplate.validUntil) : null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      setTemplates(prev => [{ ...newTemplate, id: ref.id, createdAt: new Date(), updatedAt: new Date() }, ...prev]);
      setShowTplAddModal(false); setNewTemplate(emptyTemplate(companyId, user?.uid ?? ''));
      setSuccess('Template created! Click "Generate Schedules" to materialise instances.');
    } catch (e: any) { setError(`Failed: ${e.message}`); }
    finally { setActionLoading(false); }
  }, [newTemplate, validateTemplate, companyId, user, setError, setSuccess]);

  const handleEditTemplate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTemplate) return;
    const err = validateTemplate(editTemplate); if (err) { setError(err); return; }
    setActionLoading(true);
    try {
      await updateDoc(doc(db, 'scheduleTemplates', editTemplate.id), {
        routeId: editTemplate.routeId, busId: editTemplate.busId,
        departureTime: editTemplate.departureTime, arrivalTime: editTemplate.arrivalTime,
        daysOfWeek: editTemplate.daysOfWeek,
        validFrom: Timestamp.fromDate(toDate(editTemplate.validFrom)),
        validUntil: editTemplate.validUntil ? Timestamp.fromDate(toDate(editTemplate.validUntil)) : null,
        price: editTemplate.price, availableSeats: editTemplate.availableSeats,
        status: editTemplate.status, isActive: editTemplate.isActive, updatedAt: serverTimestamp(),
      });
      setTemplates(prev => prev.map(t => t.id === editTemplate.id ? editTemplate : t));
      setShowTplEditModal(false); setEditTemplate(null);
      setSuccess('Template updated.');
    } catch (e: any) { setError(`Failed: ${e.message}`); }
    finally { setActionLoading(false); }
  }, [editTemplate, validateTemplate, setError, setSuccess]);

  const handleDeleteTemplate = useCallback(async (id: string) => {
    if (!confirm('Delete this template? Existing schedule instances are not affected.')) return;
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, 'scheduleTemplates', id));
      setTemplates(prev => prev.filter(t => t.id !== id)); setSuccess('Template deleted');
    } catch (e: any) { setError(`Failed: ${e.message}`); }
    finally { setActionLoading(false); }
  }, [setError, setSuccess]);

  const handleToggleTemplate = useCallback(async (tpl: ScheduleTemplate) => {
    setActionLoading(true);
    try {
      await updateDoc(doc(db, 'scheduleTemplates', tpl.id), { isActive: !tpl.isActive, status: !tpl.isActive ? 'active' : 'inactive', updatedAt: serverTimestamp() });
      setTemplates(prev => prev.map(t => t.id === tpl.id ? { ...t, isActive: !t.isActive, status: !t.isActive ? 'active' : 'inactive' } : t));
      setSuccess(`Template ${!tpl.isActive ? 'activated' : 'paused'}`);
    } catch (e: any) { setError(`Failed: ${e.message}`); }
    finally { setActionLoading(false); }
  }, [setError, setSuccess]);

  // ── Schedule add/edit ─────────────────────────────────────────────────────────

  const validateSchedule = useCallback((data: any): string | null => {
    if (!data.routeId) return 'Please select a route';
    if (!data.busId)   return 'Please select a bus';
    if (!data.price || data.price <= 0) return 'Enter a valid price';
    if (!data.availableSeats || data.availableSeats <= 0) return 'Enter valid seat count';
    const bus = busMap.get(data.busId);
    if (!bus) return 'Selected bus not found';
    if (data.availableSeats > bus.capacity) return `Seats cannot exceed bus capacity (${bus.capacity})`;
    const dep = new Date(data.departureDateTime); const arr = new Date(data.arrivalDateTime);
    if (isNaN(dep.getTime())) return 'Invalid departure time';
    if (isNaN(arr.getTime())) return 'Invalid arrival time';
    if (dep <= new Date())    return 'Departure must be in the future';
    if (arr <= dep)           return 'Arrival must be after departure';
    return null;
  }, [busMap]);

  const handleAddSchedule = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateSchedule(newSchedule); if (err) { setError(err); return; }
    setActionLoading(true);
    try {
      const route    = routeMap.get(newSchedule.routeId);
      const enriched = { ...newSchedule, departureLocation: route?.origin ?? '', arrivalLocation: route?.destination ?? '', stops: route?.stops ?? [], tripStatus: 'scheduled', currentStopIndex: 0, departedStops: [], createdBy: user?.uid, isActive: true };
      const id = await addSchedule(enriched);
      if (id) {
        setSchedules(prev => [{ ...enriched, id, departureDateTime: new Date(newSchedule.departureDateTime), arrivalDateTime: new Date(newSchedule.arrivalDateTime) } as Schedule, ...prev]);
        setShowAddModal(false); setNewSchedule(emptySchedule(companyId)); setSuccess('One-off schedule added!');
      }
    } catch (e: any) { setError(`Failed: ${e.message}`); }
    finally { setActionLoading(false); }
  }, [newSchedule, validateSchedule, addSchedule, user, companyId, routeMap, setSchedules, setError, setSuccess]);

  const handleEditSchedule = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSchedule) return;
    const err = validateSchedule(editSchedule); if (err) { setError(err); return; }
    setActionLoading(true);
    try {
      const route = routeMap.get(editSchedule.routeId);
      await updateDoc(doc(db, 'schedules', editSchedule.id), {
        routeId: editSchedule.routeId, busId: editSchedule.busId,
        departureDateTime: Timestamp.fromDate(new Date(editSchedule.departureDateTime)),
        arrivalDateTime:   Timestamp.fromDate(new Date(editSchedule.arrivalDateTime)),
        departureLocation: route?.origin ?? editSchedule.departureLocation,
        arrivalLocation:   route?.destination ?? editSchedule.arrivalLocation,
        stops: route?.stops ?? (editSchedule as any).stops ?? [],
        price: editSchedule.price, availableSeats: editSchedule.availableSeats,
        status: editSchedule.status, isActive: editSchedule.status === 'active',
        assignedConductorIds: (editSchedule as any).assignedConductorIds ?? [],
        updatedAt: serverTimestamp(),
      });
      setSchedules(prev => prev.map(s => s.id === editSchedule.id ? editSchedule : s));
      setShowEditModal(false); setEditSchedule(null); setSuccess('Schedule updated!');
    } catch (e: any) { setError(`Failed: ${e.message}`); }
    finally { setActionLoading(false); }
  }, [editSchedule, validateSchedule, routeMap, setSchedules, setError, setSuccess]);

  const toggleDay = (day: DayOfWeek, isEdit = false) => {
    const setter = isEdit
      ? (fn: (t: ScheduleTemplate) => ScheduleTemplate) => setEditTemplate(p => p ? fn(p) : p)
      : (fn: (t: Omit<ScheduleTemplate,'id'>) => Omit<ScheduleTemplate,'id'>) => setNewTemplate(fn);
    (setter as any)((p: any) => ({
      ...p,
      daysOfWeek: p.daysOfWeek.includes(day)
        ? p.daysOfWeek.filter((d: DayOfWeek) => d !== day)
        : [...p.daysOfWeek, day].sort((a: number, b: number) => a - b),
    }));
  };

  // ── Template form ────────────────────────────────────────────────────────────

  const TemplateForm: FC<{ data: any; onChange: (p: any) => void; onSubmit: (e: React.FormEvent) => void; isEdit?: boolean; loading: boolean; onClose: () => void }> = ({ data, onChange, onSubmit, isEdit = false, loading, onClose }) => (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Route *</label>
          <select value={data.routeId} onChange={e => onChange({ routeId: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required>
            <option value="">Select Route</option>
            {selectableRoutes.map(r => <option key={r.id} value={r.id}>{r.origin} → {r.destination}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Bus *</label>
          <select value={data.busId} onChange={e => { const cap = busMap.get(e.target.value)?.capacity ?? 0; onChange({ busId: e.target.value, availableSeats: cap }); }} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required>
            <option value="">Select Bus</option>
            {activeBuses.map(b => <option key={b.id} value={b.id}>{b.licensePlate} – {b.busType} (cap {b.capacity})</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Departure time *</label><input type="time" value={data.departureTime} onChange={e => onChange({ departureTime: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Arrival time *</label><input type="time" value={data.arrivalTime} onChange={e => onChange({ arrivalTime: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required /></div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Runs on *</label>
        <div className="flex flex-wrap gap-2">
          {DAYS.map(d => (
            <button key={d.value} type="button" onClick={() => toggleDay(d.value as DayOfWeek, isEdit)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${(data.daysOfWeek as DayOfWeek[]).includes(d.value as DayOfWeek) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              {d.short}
            </button>
          ))}
          <button type="button" onClick={() => onChange({ daysOfWeek: data.daysOfWeek.length === 7 ? [] : [0,1,2,3,4,5,6] })} className="px-3 py-1.5 rounded-lg text-sm bg-gray-100 text-gray-700 hover:bg-gray-200">
            {data.daysOfWeek.length === 7 ? 'Clear all' : 'All'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">{data.daysOfWeek.length === 0 ? '⚠ Select at least one day' : dayLabel(data.daysOfWeek)}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Valid from *</label><input type="date" value={fmtDateInput(toDate(data.validFrom))} onChange={e => onChange({ validFrom: new Date(e.target.value) })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Valid until <span className="text-gray-400 font-normal">(blank = indefinite)</span></label><input type="date" value={data.validUntil ? fmtDateInput(toDate(data.validUntil)) : ''} onChange={e => onChange({ validUntil: e.target.value ? new Date(e.target.value) : null })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Price (MWK) *</label><input type="number" min="0" step="100" value={data.price || ''} onChange={e => onChange({ price: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="0" required /></div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Available seats *</label>
          <input type="number" min="1" max={busMap.get(data.busId)?.capacity || 100} value={data.availableSeats || ''} onChange={e => onChange({ availableSeats: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="0" required />
          {data.busId && busMap.get(data.busId) && <p className="text-xs text-gray-500 mt-1">Max: {busMap.get(data.busId)?.capacity}</p>}
        </div>
      </div>
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t">
        <button type="button" onClick={onClose} disabled={loading} className="px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
        <button type="submit" disabled={loading} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Saving…</span></> : <><LayoutTemplate className="w-4 h-4" /><span>{isEdit ? 'Update Template' : 'Create Template'}</span></>}
        </button>
      </div>
    </form>
  );

  // ── Grouped view section renderer ─────────────────────────────────────────────

  const BUCKET_CONFIGS: Record<Bucket, {
    icon: React.ReactNode; title: string;
    textCls: string; bgCls: string; pillCls: string; hint?: string;
  }> = {
    live:      { icon: <Radio className="w-4 h-4" />,          title: 'Live Now',        textCls: 'text-green-800',  bgCls: 'bg-green-50 border-green-200',    pillCls: 'bg-green-200 text-green-900',   hint: 'Trip in progress' },
    attention: { icon: <AlertTriangle className="w-4 h-4" />,  title: 'Needs Attention', textCls: 'text-amber-800',  bgCls: 'bg-amber-50 border-amber-200',    pillCls: 'bg-amber-200 text-amber-900',   hint: `Auto-marks missed after ${AUTO_MISSED_HOURS}h` },
    today:     { icon: <Flame className="w-4 h-4" />,          title: 'Today',           textCls: 'text-blue-800',   bgCls: 'bg-blue-50 border-blue-200',      pillCls: 'bg-blue-200 text-blue-900' },
    upcoming:  { icon: <CalendarClock className="w-4 h-4" />,  title: 'Upcoming',        textCls: 'text-slate-700',  bgCls: 'bg-slate-50 border-slate-200',    pillCls: 'bg-slate-200 text-slate-800' },
    completed: { icon: <CheckCircle className="w-4 h-4" />,    title: 'Completed',       textCls: 'text-gray-600',   bgCls: 'bg-gray-50 border-gray-200',      pillCls: 'bg-gray-200 text-gray-700',     hint: `Hidden after ${ARCHIVE_AFTER_DAYS} days` },
    cancelled: { icon: <Ban className="w-4 h-4" />,            title: 'Cancelled',       textCls: 'text-red-700',    bgCls: 'bg-red-50 border-red-200',        pillCls: 'bg-red-200 text-red-900',       hint: `Hidden after ${ARCHIVE_AFTER_DAYS} days` },
    missed:    { icon: <XCircle className="w-4 h-4" />,        title: 'Missed',          textCls: 'text-orange-700', bgCls: 'bg-orange-50 border-orange-200',  pillCls: 'bg-orange-200 text-orange-900', hint: `Hidden after ${ARCHIVE_AFTER_DAYS} days` },
  };

  const BUCKET_ORDER: Bucket[] = ['live', 'today', 'upcoming', 'attention', 'completed', 'cancelled', 'missed'];

  const renderBucket = (bucket: Bucket) => {
    const list = bucketed[bucket];
    if (!list.length) return null;
    const cfg = BUCKET_CONFIGS[bucket];
    const paged = bucket === 'upcoming'
      ? list.slice((upcomingPage  - 1) * ITEMS_PER_PAGE, upcomingPage  * ITEMS_PER_PAGE)
      : bucket === 'attention'
      ? list.slice((attentionPage - 1) * ITEMS_PER_PAGE, attentionPage * ITEMS_PER_PAGE)
      : list;

    return (
      <div key={bucket} id={`bucket-${bucket}`} className="space-y-3">
        <SectionHeader
          icon={cfg.icon} title={cfg.title} count={list.length}
          textCls={cfg.textCls} bgCls={cfg.bgCls} pillCls={cfg.pillCls}
          collapsed={collapsed[bucket]} onToggle={() => toggleCollapse(bucket)}
          hint={cfg.hint}
        />
        {!collapsed[bucket] && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-1">
              {paged.map(s => (
                <ScheduleCard
                  key={s.id} schedule={s} bucket={bucket}
                  route={routeMap.get(s.routeId)} bus={busMap.get(s.busId)}
                  staffMap={staffMap} userProfile={userProfile}
                  countdown={bucket === 'attention' ? getCountdown(s.id) : null}
                  onEdit={() => { setEditSchedule(s); setShowEditModal(true); }}
                  onAction={action => setConfirmModal({ schedule: s, action })}
                  onArchive={() => handleArchive(s)}
                  loading={actionLoading}
                />
              ))}
            </div>
            {bucket === 'upcoming' && (
              <Pagination current={upcomingPage} total={Math.ceil(list.length / ITEMS_PER_PAGE)}
                count={ITEMS_PER_PAGE} filtered={list.length} label="upcoming schedules"
                onChange={p => setUpcomingPage(p)} />
            )}
            {bucket === 'attention' && (
              <Pagination current={attentionPage} total={Math.ceil(list.length / ITEMS_PER_PAGE)}
                count={ITEMS_PER_PAGE} filtered={list.length} label="schedules needing attention"
                onChange={p => setAttentionPage(p)} />
            )}
          </>
        )}
      </div>
    );
  };

  const totalVisible = BUCKET_ORDER.reduce((acc, b) => acc + bucketed[b].length, 0);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Stats row — click to scroll to / expand that bucket */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {([
          { label: 'Live Now',     value: stats.live,       colour: 'text-green-600',  icon: <Radio         className="w-7 h-7 text-green-500" />,  bucket: 'live'      as Bucket },
          { label: 'Today',        value: stats.today,      colour: 'text-blue-600',   icon: <Flame         className="w-7 h-7 text-blue-500" />,   bucket: 'today'     as Bucket },
          { label: 'Upcoming',     value: stats.upcoming,   colour: 'text-slate-600',  icon: <CalendarClock className="w-7 h-7 text-slate-500" />,  bucket: 'upcoming'  as Bucket },
          { label: 'Needs Action', value: stats.attention,  colour: 'text-amber-600',  icon: <AlertTriangle className="w-7 h-7 text-amber-500" />,  bucket: 'attention' as Bucket },
          { label: 'Templates',    value: stats.templates,  colour: 'text-purple-600', icon: <LayoutTemplate className="w-7 h-7 text-purple-500" />, bucket: null },
          { label: 'Avail. Seats', value: stats.totalSeats, colour: 'text-gray-800',   icon: <Users          className="w-7 h-7 text-gray-500" />,   bucket: null },
        ] as const).map(({ label, value, colour, icon, bucket }) => (
          <div key={label}
            onClick={() => {
              if (!bucket) return;
              // Switch to grouped view, expand the bucket, scroll to it
              setViewTab('instances');
              setViewMode('grouped');
              setCollapsed(p => ({ ...p, [bucket]: false }));
              setTimeout(() => {
                document.getElementById(`bucket-${bucket}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 50);
            }}
            className={`bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between ${bucket ? 'cursor-pointer hover:shadow-md hover:border-blue-300 transition-all' : ''}`}
          >
            <div>
              <p className="text-sm text-gray-600">{label}</p>
              <p className={`text-2xl font-bold ${colour}`}>{value}</p>
            </div>
            {icon}
          </div>
        ))}
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
        <p className="text-sm text-blue-800">
          <span className="font-semibold">How it works: </span>
          Schedules are sorted into live, today, upcoming and past groups.
          Trips that passed with no conductor activity appear under <span className="font-semibold">Needs Attention</span> —
          you have <strong>{AUTO_MISSED_HOURS} hours</strong> to mark them complete, cancelled or missed before the system does it automatically.
          Completed, cancelled and missed schedules disappear after <strong>{ARCHIVE_AFTER_DAYS} days</strong>.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm border p-4 space-y-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" placeholder="Search by route or bus…" value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setUpcomingPage(1); setAttentionPage(1); }}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div className="flex flex-wrap gap-2">
            {userProfile?.role === 'operator' && (
              <>
                <button onClick={handleMaterialize} disabled={materLoading || actionLoading}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-lg hover:bg-green-700 disabled:opacity-50 whitespace-nowrap text-sm shadow-sm">
                  {materLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />} Generate Schedules
                </button>
                <button onClick={() => { setNewTemplate(emptyTemplate(companyId, user?.uid ?? '')); setShowTplAddModal(true); }} disabled={actionLoading}
                  className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2.5 rounded-lg hover:bg-purple-700 disabled:opacity-50 whitespace-nowrap text-sm shadow-sm">
                  <LayoutTemplate className="w-4 h-4" /> New Template
                </button>
                <button onClick={() => { setNewSchedule(emptySchedule(companyId)); setShowAddModal(true); }} disabled={actionLoading}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap text-sm shadow-sm">
                  <Plus className="w-4 h-4" /> One-off
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tab + view toggle */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            <button onClick={() => setViewTab('instances')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${viewTab === 'instances' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}>
              Schedules ({totalVisible})
            </button>
            <button onClick={() => setViewTab('templates')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${viewTab === 'templates' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}>
              Templates ({templates.length})
            </button>
          </div>

          {viewTab === 'instances' && (
            <div className="flex gap-1">
              <button onClick={() => setViewMode('grouped')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${viewMode === 'grouped' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                <List className="w-4 h-4" /> Groups
              </button>
              <button onClick={() => setViewMode('weekly')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${viewMode === 'weekly' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                <Grid className="w-4 h-4" /> Weekly
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Instances ─────────────────────────────────────────────────────────── */}
      {viewTab === 'instances' && (
        viewMode === 'grouped' ? (
          totalVisible === 0 ? (
            <div className="bg-white rounded-xl border p-12 text-center">
              <CalendarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {validSchedules.length === 0 ? 'No schedules yet' : 'No matching schedules'}
              </h3>
              <p className="text-gray-500 text-sm">
                {searchTerm ? 'Try a different search term' : 'Create a template and click "Generate Schedules", or add a one-off'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {BUCKET_ORDER.map(b => renderBucket(b))}
            </div>
          )
        ) : (
          <WeeklyView
            schedules={scopedSchedules}
            routeMap={routeMap} busMap={busMap} staffMap={staffMap}
            userProfile={userProfile}
            onEdit={s => { setEditSchedule(s); setShowEditModal(true); }}
          />
        )
      )}

      {/* ── Templates ─────────────────────────────────────────────────────────── */}
      {viewTab === 'templates' && (
        templatesLoading ? (
          <div className="bg-white rounded-xl border p-12 text-center">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-3" />
            <p className="text-gray-500">Loading templates…</p>
          </div>
        ) : templates.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center">
            <LayoutTemplate className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No templates yet</h3>
            <p className="text-gray-500 mb-6">Create your first template to automate recurring schedules</p>
            {userProfile?.role === 'operator' && (
              <button onClick={() => { setNewTemplate(emptyTemplate(companyId, user?.uid ?? '')); setShowTplAddModal(true); }}
                className="inline-flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700">
                <LayoutTemplate className="w-5 h-5" /> Create First Template
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map(tpl => {
              const route = routeMap.get(tpl.routeId); const bus = busMap.get(tpl.busId);
              return (
                <div key={tpl.id} className={`bg-white rounded-xl shadow-sm border transition-all ${tpl.isActive ? 'hover:shadow-md' : 'opacity-60'}`}>
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <LayoutTemplate className="w-4 h-4 text-purple-600" />
                          <h3 className="font-semibold text-gray-900">{route ? `${route.origin} → ${route.destination}` : 'Unknown Route'}</h3>
                        </div>
                        <p className="text-xs text-gray-500">{bus?.licensePlate ?? 'Unknown'} · {bus?.busType}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${tpl.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{tpl.isActive ? 'Active' : 'Paused'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b text-sm">
                      <div><p className="text-xs text-gray-500">Departure</p><p className="font-semibold">{tpl.departureTime}</p></div>
                      <div><p className="text-xs text-gray-500">Arrival</p><p className="font-semibold">{tpl.arrivalTime}</p></div>
                    </div>
                    <div className="space-y-1.5 mb-4 text-sm text-gray-700">
                      <div className="flex items-center gap-2"><Repeat className="w-4 h-4 text-blue-500" />{dayLabel(tpl.daysOfWeek)}</div>
                      <div className="flex items-center gap-2"><CalendarIcon className="w-4 h-4 text-gray-400" />From {fmtDateInput(toDate(tpl.validFrom))}{tpl.validUntil ? ` → ${fmtDateInput(toDate(tpl.validUntil))}` : ' (indefinite)'}</div>
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1"><DollarSign className="w-4 h-4 text-green-500" />MWK {tpl.price.toLocaleString()}</span>
                        <span className="flex items-center gap-1"><Users className="w-4 h-4 text-blue-500" />{tpl.availableSeats} seats</span>
                      </div>
                    </div>
                    {userProfile?.role === 'operator' && (
                      <div className="flex gap-2 pt-3 border-t">
                        <button onClick={() => handleToggleTemplate(tpl)} disabled={actionLoading}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm disabled:opacity-50 ${tpl.isActive ? 'text-yellow-700 bg-yellow-50 hover:bg-yellow-100' : 'text-green-700 bg-green-50 hover:bg-green-100'}`}>
                          {tpl.isActive ? <><ToggleLeft className="w-3.5 h-3.5" />Pause</> : <><ToggleRight className="w-3.5 h-3.5" />Activate</>}
                        </button>
                        <button onClick={() => { setEditTemplate(tpl); setShowTplEditModal(true); }} disabled={actionLoading} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg text-sm disabled:opacity-50"><Edit3 className="w-3.5 h-3.5" />Edit</button>
                        <button onClick={() => handleDeleteTemplate(tpl.id)} disabled={actionLoading} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-sm disabled:opacity-50"><Trash2 className="w-3.5 h-3.5" />Delete</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── Confirm action modal ───────────────────────────────────────────────── */}
      <Modal isOpen={!!confirmModal} onClose={() => setConfirmModal(null)} title="Confirm action">
        {confirmModal && (() => {
          const { schedule, action } = confirmModal;
          const route = routeMap.get(schedule.routeId);
          const dep   = toDate(schedule.departureDateTime);
          const configs = {
            complete: { colour: 'bg-green-600 hover:bg-green-700', icon: <CheckCircle className="w-4 h-4 mr-2" />, label: 'Mark Complete',  msg: 'This marks the trip as completed. It will be hidden after 5 days.' },
            cancel:   { colour: 'bg-red-600 hover:bg-red-700',     icon: <Ban className="w-4 h-4 mr-2" />,         label: 'Confirm Cancel', msg: 'This cancels the trip. Consider notifying affected passengers.' },
            missed:   { colour: 'bg-orange-600 hover:bg-orange-700', icon: <AlertTriangle className="w-4 h-4 mr-2" />, label: 'Mark Missed',   msg: 'This marks the trip as missed — it did not operate. No refunds are automatically issued.' },
          };
          const cfg = configs[action];
          return (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-xl border">
                <p className="font-semibold text-gray-900">{route ? `${route.origin} → ${route.destination}` : 'Schedule'}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {dep.toLocaleDateString('en-MW', { weekday: 'short', day: 'numeric', month: 'short' })}
                  {' · '}
                  {dep.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <p className="text-sm text-gray-600">{cfg.msg}</p>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setConfirmModal(null)} className="flex-1 px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm">Cancel</button>
                <button onClick={() => applyStatus(schedule, action === 'cancel' ? 'cancelled' : action)}
                  disabled={actionLoading}
                  className={`flex-1 flex items-center justify-center px-4 py-2.5 text-white rounded-lg text-sm disabled:opacity-50 ${cfg.colour}`}>
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : cfg.icon}
                  {cfg.label}
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ── Template modals ────────────────────────────────────────────────────── */}
      <Modal isOpen={showTplAddModal} onClose={() => setShowTplAddModal(false)} title="New Schedule Template">
        <TemplateForm data={newTemplate} onChange={p => setNewTemplate(prev => ({ ...prev, ...p }))} onSubmit={handleAddTemplate} loading={actionLoading} onClose={() => setShowTplAddModal(false)} />
      </Modal>
      <Modal isOpen={showTplEditModal && !!editTemplate} onClose={() => { setShowTplEditModal(false); setEditTemplate(null); }} title="Edit Schedule Template">
        {editTemplate && <TemplateForm data={editTemplate} onChange={p => setEditTemplate(prev => prev ? { ...prev, ...p } : prev)} onSubmit={handleEditTemplate} isEdit loading={actionLoading} onClose={() => { setShowTplEditModal(false); setEditTemplate(null); }} />}
      </Modal>

      {/* ── Add one-off ─────────────────────────────────────────────────────────── */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add One-off Schedule">
        <form onSubmit={handleAddSchedule} className="space-y-5">
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2 text-sm text-yellow-800">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> Use this for exceptional trips only. For regular services, create a Template instead.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Route *</label><select value={newSchedule.routeId} onChange={e => setNewSchedule({ ...newSchedule, routeId: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required><option value="">Select Route</option>{selectableRoutes.map(r => <option key={r.id} value={r.id}>{r.origin} → {r.destination}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Bus *</label><select value={newSchedule.busId} onChange={e => { const cap = busMap.get(e.target.value)?.capacity ?? 0; setNewSchedule({ ...newSchedule, busId: e.target.value, availableSeats: cap }); }} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required><option value="">Select Bus</option>{activeBuses.map(b => <option key={b.id} value={b.id}>{b.licensePlate} – {b.busType} (cap {b.capacity})</option>)}</select></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Departure *</label><input type="datetime-local" value={fmtDateTimeInput(toDate(newSchedule.departureDateTime))} onChange={e => setNewSchedule({ ...newSchedule, departureDateTime: new Date(e.target.value) })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Arrival *</label><input type="datetime-local" value={fmtDateTimeInput(toDate(newSchedule.arrivalDateTime))} onChange={e => setNewSchedule({ ...newSchedule, arrivalDateTime: new Date(e.target.value) })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Price (MWK) *</label><input type="number" min="0" step="100" value={newSchedule.price || ''} onChange={e => setNewSchedule({ ...newSchedule, price: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="0" required /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Seats *</label><input type="number" min="1" max={busMap.get(newSchedule.busId)?.capacity || 100} value={newSchedule.availableSeats || ''} onChange={e => setNewSchedule({ ...newSchedule, availableSeats: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="0" required /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label><select value={newSchedule.status} onChange={e => setNewSchedule({ ...newSchedule, status: e.target.value as any })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"><option value="active">Active</option><option value="cancelled">Cancelled</option></select></div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => setShowAddModal(false)} disabled={actionLoading} className="px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancel</button>
            <button type="submit" disabled={actionLoading} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
              {actionLoading ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Adding…</span></> : <><Plus className="w-4 h-4" /><span>Add Schedule</span></>}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Edit schedule ────────────────────────────────────────────────────────── */}
      <Modal isOpen={showEditModal && !!editSchedule} onClose={() => { setShowEditModal(false); setEditSchedule(null); }} title="Edit Schedule">
        {editSchedule && (
          <form onSubmit={handleEditSchedule} className="space-y-5">
            {(editSchedule as any).templateId && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg flex items-start gap-2 text-sm text-purple-800">
                <Info className="w-4 h-4 mt-0.5 shrink-0" /> Auto-generated from a template. Edits here only affect this instance.
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Route *</label><select value={editSchedule.routeId} onChange={e => setEditSchedule({ ...editSchedule, routeId: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required><option value="">Select Route</option>{selectableRoutes.map(r => <option key={r.id} value={r.id}>{r.origin} → {r.destination}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Bus *</label><select value={editSchedule.busId} onChange={e => { const cap = busMap.get(e.target.value)?.capacity ?? 0; setEditSchedule({ ...editSchedule, busId: e.target.value, availableSeats: cap }); }} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required><option value="">Select Bus</option>{activeBuses.map(b => <option key={b.id} value={b.id}>{b.licensePlate} – {b.busType} (cap {b.capacity})</option>)}</select></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Departure *</label><input type="datetime-local" value={fmtDateTimeInput(toDate(editSchedule.departureDateTime))} onChange={e => setEditSchedule({ ...editSchedule, departureDateTime: new Date(e.target.value) })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Arrival *</label><input type="datetime-local" value={fmtDateTimeInput(toDate(editSchedule.arrivalDateTime))} onChange={e => setEditSchedule({ ...editSchedule, arrivalDateTime: new Date(e.target.value) })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Price (MWK) *</label><input type="number" min="0" step="100" value={editSchedule.price || ''} onChange={e => setEditSchedule({ ...editSchedule, price: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="0" required /></div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Seats *</label>
                <input type="number" min="1" max={busMap.get(editSchedule.busId)?.capacity || 100} value={editSchedule.availableSeats || ''} onChange={e => setEditSchedule({ ...editSchedule, availableSeats: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="0" required />
                {editSchedule.busId && busMap.get(editSchedule.busId) && <p className="text-xs text-gray-500 mt-1">Max: {busMap.get(editSchedule.busId)?.capacity}</p>}
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label><select value={editSchedule.status} onChange={e => setEditSchedule({ ...editSchedule, status: e.target.value as any })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"><option value="active">Active</option><option value="cancelled">Cancelled</option><option value="completed">Completed</option></select></div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t">
              <button type="button" onClick={() => { setShowEditModal(false); setEditSchedule(null); }} disabled={actionLoading} className="px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancel</button>
              <button type="submit" disabled={actionLoading} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                {actionLoading ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Updating…</span></> : <><Edit3 className="w-4 h-4" /><span>Update Schedule</span></>}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default SchedulesTab;