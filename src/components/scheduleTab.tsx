"use client";

import { FC, useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import * as dbActions from '@/lib/actions/db.actions';
import { Schedule, Route, Bus } from '@/types';
import Modal from './Modals';
import {
  Plus, Edit3, Trash2, Search, MapPin, Clock,
  CheckCircle, XCircle, DollarSign,
  Calendar as CalendarIcon, Grid, Repeat, Bus as BusIcon,
  Loader2, Users, ChevronLeft, ChevronRight, LayoutTemplate,
  Zap, AlertCircle, ToggleLeft, ToggleRight, Info,
  AlertTriangle, Archive, Eye, EyeOff, ChevronDown, ChevronUp,
  Radio, CalendarClock, Ban, List, Flame, BarChart3, FileText,
  TrendingUp, TrendingDown, Clock3, CheckCheck, Sparkles, Map, Activity
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type TemplateStatus = 'active' | 'inactive';
type ViewTab  = 'instances' | 'templates' | 'reports';
type ViewMode = 'grouped'   | 'weekly';

export type ScheduleStatus = 'active' | 'completed' | 'cancelled' | 'missed' | 'postponed' | 'archived';
export type Bucket = 'live' | 'today' | 'upcoming' | 'past';

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

interface ScheduleReport {
  id: string;
  scheduleId: string;
  companyId: string;
  routeId: string;
  routeLabel: string;
  busId: string;
  busLabel: string;
  departureDateTime: Date;
  arrivalDateTime: Date;
  finalStatus: ScheduleStatus;
  bookedSeats: number;
  availableSeats: number;
  capacity: number;
  price: number;
  estimatedRevenue: number;
  archivedAt: Date;
  archivedReason: 'operator_action' | 'auto_24h';
  notes?: string;
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
  isAdmin?: boolean;
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

const ITEMS_PER_PAGE      = 6;
const WINDOW_DAYS         = 14;
const ARCHIVE_AFTER_HOURS = 24;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toDate = (v: unknown): Date => {
  if (v == null) return new Date(0);
  if (v instanceof Date) return v;
  return new Date(v as any);
};

const fmtDateInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

const fmtDateTimeInput = (d: Date) => {
  const base = fmtDateInput(d);
  return `${base}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth()    === b.getMonth()    &&
  a.getDate()     === b.getDate();

const hoursSince = (d: Date) => (Date.now() - d.getTime()) / 3_600_000;

function getBucket(s: Schedule): Bucket | null {
  if (s.status === 'archived') return null;

  const dep        = toDate(s.departureDateTime);
  const tripStatus = (s as any).tripStatus as string | undefined;
  const hoursAgo   = hoursSince(dep);

  if (hoursAgo > ARCHIVE_AFTER_HOURS) return null;

  if (tripStatus === 'boarding' || tripStatus === 'in_transit') return 'live';

  const now = new Date();

  if (dep > now) {
    return isSameDay(dep, now) ? 'today' : 'upcoming';
  }

  return 'past';
}

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  active:    { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Active'    },
  completed: { bg: 'bg-gray-100',   text: 'text-gray-600',   label: 'Completed' },
  cancelled: { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Cancelled' },
  missed:    { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Missed'    },
  postponed: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Postponed' },
  boarding:  { bg: 'bg-green-100',  text: 'text-green-800',  label: '🟢 Boarding' },
  in_transit:{ bg: 'bg-blue-100',   text: 'text-blue-800',   label: '🚌 In Transit' },
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function KineticStatCard({ title, value, icon: Icon, iconBg, iconColor, subtitle }: {
  title: string;
  value: string;
  icon: any;
  iconBg: string;
  iconColor: string;
  subtitle?: string;
}) {
  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl shadow-[0_8px_30px_-10px_rgba(0,0,0,0.05)] p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between min-h-[120px] sm:min-h-[140px] border border-gray-100 group hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] transition-all duration-500 text-left">
      <div className="absolute -right-8 -top-8 w-24 h-24 bg-indigo-600/5 rounded-full blur-3xl group-hover:bg-indigo-600/10 transition-colors"></div>
      
      <div className="flex justify-between items-start mb-3 sm:mb-4 relative z-10">
        <div className={`p-2.5 rounded-2xl ${iconBg} shadow-sm border border-white/50 group-hover:scale-110 transition-transform duration-500`}>
          <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${iconColor}`} />
        </div>
      </div>
      <div className="relative z-10">
        <p className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{title}</p>
        <p className="text-xl sm:text-2xl font-black text-gray-900 leading-none tracking-tight">{value}</p>
        {subtitle && <p className="text-[10px] sm:text-[11px] font-bold text-gray-400 mt-2 flex items-center gap-1.5"><Sparkles className="w-3 h-3 text-indigo-400" /> {subtitle}</p>}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

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
  isAdmin = false,
}) => {
  const [activeView, setActiveView] = useState<ViewTab>('instances');
  const [viewMode, setViewMode] = useState<ViewMode>('grouped');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  // Filter & Search logic
  const filteredSchedules = useMemo(() => {
    return schedules.filter(s => {
      const route = routes.find(r => r.id === s.routeId);
      const bus = buses.find(b => b.id === s.busId);
      const searchStr = `${route?.origin} ${route?.destination} ${bus?.licensePlate}`.toLowerCase();
      return searchStr.includes(searchTerm.toLowerCase()) && s.status !== 'archived';
    }).sort((a, b) => toDate(a.departureDateTime).getTime() - toDate(b.departureDateTime).getTime());
  }, [schedules, routes, buses, searchTerm]);

  const stats = useMemo(() => ({
    total: filteredSchedules.length,
    live: filteredSchedules.filter(s => getBucket(s) === 'live').length,
    today: filteredSchedules.filter(s => getBucket(s) === 'today').length,
    upcoming: filteredSchedules.filter(s => getBucket(s) === 'upcoming').length,
  }), [filteredSchedules]);

  return (
    <div className="space-y-6 sm:space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-[1600px] mx-auto px-2 sm:px-0">
      
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <KineticStatCard
          title="TOTAL TRIPS"
          value={String(stats.total)}
          icon={CalendarIcon}
          iconBg="bg-indigo-50" iconColor="text-indigo-600"
          subtitle="Operational manifest"
        />
        <KineticStatCard
          title="LIVE OPS"
          value={String(stats.live)}
          icon={Activity}
          iconBg="bg-emerald-50" iconColor="text-emerald-600"
          subtitle="Real-time transit"
        />
        <KineticStatCard
          title="TODAY"
          value={String(stats.today)}
          icon={Zap}
          iconBg="bg-amber-50" iconColor="text-amber-600"
          subtitle="Pending departures"
        />
        <KineticStatCard
          title="UPCOMING"
          value={String(stats.upcoming)}
          icon={CalendarClock}
          iconBg="bg-purple-50" iconColor="text-purple-600"
          subtitle="Next 7 days"
        />
      </div>

      {/* Controls Area */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 sm:p-6 text-left">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto flex-1 max-w-4xl">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by vessel, origin or destination..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 focus:bg-white outline-none text-xs font-bold text-gray-700 transition-all"
              />
            </div>
            <div className="flex gap-2">
               <button onClick={() => setViewMode(viewMode === 'grouped' ? 'weekly' : 'grouped')} 
                 className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-indigo-50 text-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-indigo-100 transition-all">
                 {viewMode === 'grouped' ? <Grid className="w-4 h-4" /> : <List className="w-4 h-4" />}
                 {viewMode === 'grouped' ? 'Grouped' : 'Weekly'}
               </button>
            </div>
          </div>
          <button className="w-full lg:w-auto bg-indigo-600 text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> Register Schedule
          </button>
        </div>
      </div>

      {/* View Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8 text-left">
        {filteredSchedules.length > 0 ? (
          filteredSchedules.map(schedule => {
            const route = routes.find(r => r.id === schedule.routeId);
            const bus = buses.find(b => b.id === schedule.busId);
            const bucket = getBucket(schedule) || 'upcoming';
            const dep = toDate(schedule.departureDateTime);
            const filled = bus?.capacity ? (((bus.capacity - (schedule.availableSeats ?? 0)) / bus.capacity) * 100) : 0;
            const badge = STATUS_BADGE[schedule.status] || STATUS_BADGE.active;

            return (
              <div key={schedule.id} className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden flex flex-col hover:shadow-2xl transition-all duration-500 group relative">
                <div className="h-32 sm:h-40 bg-slate-50 relative flex items-center justify-center border-b border-gray-50">
                   <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#6366f1 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
                   <div className="relative z-10 w-20 h-20 sm:w-24 sm:h-24 bg-white/80 backdrop-blur-md rounded-[2.5rem] shadow-sm flex items-center justify-center border border-white/50 text-indigo-600 group-hover:scale-110 transition-transform duration-500">
                      <BusIcon className="w-8 h-8 sm:w-10 sm:h-10" />
                   </div>
                   <div className="absolute top-4 left-4">
                      <span className={`px-3 py-1 text-[9px] uppercase font-black tracking-widest rounded-xl border shadow-sm ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                   </div>
                   <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-xl shadow-sm border border-white/50">
                      <p className="text-[10px] font-black text-gray-900 tracking-tight">{dep.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                   </div>
                </div>

                <div className="p-6 sm:p-8 flex-1 flex flex-col">
                  <div className="mb-6">
                    <h3 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight uppercase leading-tight group-hover:text-indigo-600 transition-colors">
                      {route ? `${route.origin} → ${route.destination}` : 'Unknown Corridor'}
                    </h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1.5 flex items-center gap-2">
                       <MapPin className="w-3.5 h-3.5 text-indigo-300" /> {dep.toLocaleDateString('en-MW', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <div>
                      <p className="text-[9px] text-gray-400 font-black tracking-widest mb-1.5 uppercase">Vessel Details</p>
                      <p className="text-sm font-black text-gray-900 uppercase tracking-tight">{bus?.licensePlate || 'N/A'}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">{bus?.busType || 'Standard'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-400 font-black tracking-widest mb-1.5 uppercase">Price Point</p>
                      <p className="text-sm font-black text-gray-900">MWK {schedule.price.toLocaleString()}</p>
                      <p className="text-[10px] font-bold text-emerald-500 uppercase">Revenue Focus</p>
                    </div>
                  </div>

                  <div className="space-y-4 mb-8">
                     <div className="flex items-center justify-between">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Load Saturation</p>
                        <p className="text-[10px] font-black text-gray-900">{filled.toFixed(0)}% FILL</p>
                     </div>
                     <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-1000 ${filled > 80 ? 'bg-rose-500' : 'bg-indigo-600'}`} style={{ width: `${filled}%` }} />
                     </div>
                     <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        <Users className="w-3.5 h-3.5" /> {schedule.availableSeats} of {bus?.capacity || '?'} Available
                     </div>
                  </div>

                  <div className="mt-auto pt-6 border-t border-gray-50 flex gap-2">
                     <button className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 bg-gray-50 text-gray-700 hover:bg-gray-100 rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest border border-gray-100">
                       <Eye className="w-4 h-4" /> View
                     </button>
                     <button className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest border border-indigo-100">
                       <Edit3 className="w-4 h-4" /> Manage
                     </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-24 text-center">
             <div className="w-16 h-16 bg-gray-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                <CalendarIcon className="w-8 h-8 text-gray-200" />
             </div>
             <p className="text-sm font-black text-gray-900 uppercase tracking-widest">No matching schedules identified</p>
             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">Adjust your search parameters or register new operations.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SchedulesTab;
