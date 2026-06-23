  "use client";

  import { FC, useState, useMemo, useCallback, useEffect, useRef } from 'react';
  import { supabase } from '@/lib/supabase';
  import * as dbActions from '@/lib/actions/db.actions';
  import { Schedule, Route, Bus, ScheduleStatus } from '@/types';
  import Modal from './Modals';
  import {
    Plus, Edit3, Trash2, Search, MapPin, Clock,
    CheckCircle, XCircle, DollarSign,
    Calendar as CalendarIcon, Grid, Repeat, Bus as BusIcon,
    Loader2, Users, ChevronLeft, ChevronRight, LayoutTemplate,
    Zap, AlertCircle, ToggleLeft, ToggleRight, Info,
    AlertTriangle, Archive, Eye, EyeOff, ChevronDown, ChevronUp,
    Radio, CalendarClock, Ban, List, Flame, BarChart3, FileText,
    TrendingUp, TrendingDown, Clock3, CheckCheck, Sparkles, Map, User,
    X,
    Activity
  } from 'lucide-react';

  // ─── Types ────────────────────────────────────────────────────────────────────

  type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;
  type TemplateStatus = 'active' | 'inactive';
  type ViewTab  = 'instances' | 'templates' | 'reports';
  type ViewMode = 'grouped'   | 'weekly';

  // export type ScheduleStatus = 'active' | 'completed' | 'cancelled' | 'missed' | 'postponed' | 'archived';
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
  const NO_FEEDBACK_ARCHIVE_HOURS = 12;

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
    if (s.status === 'archived' || s.isArchived) return null;

    const dep        = toDate(s.departureDateTime);
    const arr        = toDate(s.arrivalDateTime);
    const tripStatus = (s as any).tripStatus as string | undefined;
    const hoursPastArrival = hoursSince(arr);

    // Clear if 12h past arrival and no feedback (tripStatus !== 'completed')
    if (tripStatus !== 'completed' && hoursPastArrival > NO_FEEDBACK_ARCHIVE_HOURS) return null;
    
    // General cutoff: 24h past arrival
    if (hoursPastArrival > ARCHIVE_AFTER_HOURS) return null;

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
      <div className="bg-white rounded-2xl sm:rounded-2xl shadow-sm p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between min-h-[120px] sm:min-h-[140px] border border-gray-100 group hover:shadow-sm transition-all duration-500 text-left">
        <div className="absolute -right-8 -top-8 w-24 h-24 bg-indigo-600/5 rounded-full blur-3xl group-hover:bg-indigo-600/10 transition-colors"></div>
        
        <div className="flex justify-between items-start mb-3 sm:mb-4 relative z-10">
          <div className={`p-2.5 rounded-2xl ${iconBg} shadow-sm border border-white/50 group-hover:scale-110 transition-transform duration-500`}>
            <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${iconColor}`} />
          </div>
        </div>
        <div className="relative z-10">
          <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{title}</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 leading-none tracking-tight">{value}</p>
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
    const [actionLoading, setActionLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 6;

    // Templates state
    const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [showAddTemplateModal, setShowAddTemplateModal] = useState(false);
    const [showEditTemplateModal, setShowEditTemplateModal] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<ScheduleTemplate | null>(null);

    const initialTemplateState = {
      routeId: '',
      busId: '',
      departureTime: '08:00',
      arrivalTime: '12:00',
      daysOfWeek: [] as DayOfWeek[],
      price: 0,
      availableSeats: 0,
    };
    const [templateFormData, setTemplateFormData] = useState(initialTemplateState);

    useEffect(() => {
      const fetchTemplates = async () => {
        setLoadingTemplates(true);
        const result = await dbActions.getScheduleTemplates(companyId);
        if (result.success) {
          setTemplates(result.data as unknown as ScheduleTemplate[]);
        }
        setLoadingTemplates(false);
      };
      if (companyId) fetchTemplates();
    }, [companyId]);

    // Handle template price/capacity auto-population
    useEffect(() => {
      if (templateFormData.routeId) {
        const route = routes.find(r => r.id === templateFormData.routeId);
        if (route) setTemplateFormData(prev => ({ ...prev, price: route.baseFare }));
      }
    }, [templateFormData.routeId, routes]);

    useEffect(() => {
      if (templateFormData.busId) {
        const bus = buses.find(b => b.id === templateFormData.busId);
        if (bus) setTemplateFormData(prev => ({ ...prev, availableSeats: bus.capacity }));
      }
    }, [templateFormData.busId, buses]);

    // Modals state
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);

    // Form state
    const initialFormState = {
      routeId: '',
      busId: '',
      departureDateTime: fmtDateTimeInput(new Date(Date.now() + 3600000)),
      arrivalDateTime: fmtDateTimeInput(new Date(Date.now() + 14400000)),
      price: 0,
      availableSeats: 0,
      status: 'active' as ScheduleStatus,
    };
    const [formData, setFormData] = useState(initialFormState);

    // Handle auto-populating fields when route/bus changes
    useEffect(() => {
      if (formData.routeId) {
        const route = routes.find(r => r.id === formData.routeId);
        if (route) setFormData(prev => ({ ...prev, price: route.baseFare }));
      }
    }, [formData.routeId, routes]);

    useEffect(() => {
      if (formData.busId) {
        const bus = buses.find(b => b.id === formData.busId);
        if (bus) setFormData(prev => ({ ...prev, availableSeats: bus.capacity }));
      }
    }, [formData.busId, buses]);

    const handleAddSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.routeId || !formData.busId) {
        setError("Please select both a route and a bus.");
        return;
      }

      setActionLoading(true);
      try {
        const route = routes.find(r => r.id === formData.routeId);
        const scheduleData = {
          ...formData,
          departureDateTime: new Date(formData.departureDateTime),
          arrivalDateTime: new Date(formData.arrivalDateTime),
          departureLocation: route?.origin,
          arrivalLocation: route?.destination,
          companyId,
        };
        
        const id = await addSchedule(scheduleData);
        if (id) {
          setSuccess("Schedule registered successfully!");
          setShowAddModal(false);
          setFormData(initialFormState);
        }
      } catch (err: any) {
        setError(err.message || "Failed to add schedule");
      } finally {
        setActionLoading(false);
      }
    };

    const handleEditClick = (s: Schedule) => {
      setSelectedSchedule(s);
      setFormData({
        routeId: s.routeId,
        busId: s.busId,
        departureDateTime: fmtDateTimeInput(toDate(s.departureDateTime)),
        arrivalDateTime: fmtDateTimeInput(toDate(s.arrivalDateTime)),
        price: s.price,
        availableSeats: s.availableSeats,
        status: s.status,
      });
      setShowEditModal(true);
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedSchedule) return;

      setActionLoading(true);
      try {
        const route = routes.find(r => r.id === formData.routeId);
        const updatedData = {
          ...formData,
          departureDateTime: new Date(formData.departureDateTime),
          arrivalDateTime: new Date(formData.arrivalDateTime),
          departureLocation: route?.origin,
          arrivalLocation: route?.destination,
        };

        const result = await dbActions.updateSchedule(selectedSchedule.id, updatedData as any);
        if (result.success) {
          setSchedules(prev => prev.map(s => s.id === selectedSchedule.id ? (result.data as unknown as Schedule) : s));
          setSuccess("Schedule updated successfully!");
          setShowEditModal(false);
        } else {
          throw new Error(result.error);
        }
      } catch (err: any) {
        setError(err.message || "Failed to update schedule");
      } finally {
        setActionLoading(false);
      }
    };

    const handleTemplateSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!templateFormData.routeId || !templateFormData.busId) {
        setError("Please select both a route and a bus.");
        return;
      }

      setActionLoading(true);
      try {
        if (showAddTemplateModal) {
          const result = await dbActions.createScheduleTemplate({
            ...templateFormData,
            companyId,
          });
          if (result.success) {
            setTemplates(prev => [result.data as unknown as ScheduleTemplate, ...prev]);
            setSuccess("Recurring template registered!");
            setShowAddTemplateModal(false);
          } else throw new Error(result.error);
        } else if (selectedTemplate) {
          const { availableSeats, ...updatableTemplateData } = templateFormData;
          const result = await dbActions.updateScheduleTemplate(selectedTemplate.id, updatableTemplateData);
          if (result.success) {
            setTemplates(prev => prev.map(t => t.id === selectedTemplate.id ? (result.data as unknown as ScheduleTemplate) : t));
            setSuccess("Template architecture updated!");
            setShowEditTemplateModal(false);
          } else throw new Error(result.error);
        }
      } catch (err: any) {
        setError(err.message || "Failed to process template");
      } finally {
        setActionLoading(false);
      }
    };

    const handleDeleteTemplate = async (id: string) => {
      if (!confirm("Are you sure you want to delete this template? Future instances will not be generated.")) return;
      setActionLoading(true);
      try {
        const result = await dbActions.deleteScheduleTemplate(id);
        if (result.success) {
          setTemplates(prev => prev.filter(t => t.id !== id));
          setSuccess("Template removed.");
        } else throw new Error(result.error);
      } catch (err: any) {
        setError(err.message || "Failed to delete template");
      } finally {
        setActionLoading(false);
      }
    };

    const handleDelete = async (id: string) => {
      if (!confirm("Are you sure you want to delete this schedule? This will also cancel all bookings for it.")) return;

      setActionLoading(true);
      try {
        const result = await dbActions.deleteSchedule(id);
        if (result.success) {
          setSchedules(prev => prev.filter(s => s.id !== id));
          setSuccess("Schedule deleted successfully.");
        } else {
          throw new Error(result.error);
        }
      } catch (err: any) {
        setError(err.message || "Failed to delete schedule");
      } finally {
        setActionLoading(false);
      }
    };

    // Filter & Search logic
    const filteredSchedules = useMemo(() => {
      let filtered = schedules.filter(s => {
        const route = routes.find(r => r.id === s.routeId);
        const bus = buses.find(b => b.id === s.busId);
        const search = searchTerm.toLowerCase();
        return (
          (route?.origin.toLowerCase().includes(search) ||
          route?.destination.toLowerCase().includes(search) ||
          bus?.licensePlate.toLowerCase().includes(search)) && 
          s.status !== 'archived'
        );
      });

      // Sort by latest (departure date descending)
      filtered.sort((a, b) => new Date(b.departureDateTime).getTime() - new Date(a.departureDateTime).getTime());

      return filtered;
    }, [schedules, searchTerm, routes, buses]);

    // Reset to first page when searching
    useEffect(() => {
      setCurrentPage(1);
    }, [searchTerm]);

    const totalPages = Math.ceil(filteredSchedules.length / ITEMS_PER_PAGE);
    const paginatedSchedules = filteredSchedules.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
    );

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
            value={activeView === 'instances' ? String(stats.total) : String(templates.length)}
            icon={activeView === 'instances' ? CalendarIcon : LayoutTemplate}
            iconBg="bg-indigo-50" iconColor="text-indigo-600"
            subtitle={activeView === 'instances' ? "Operational manifest" : "Active blueprints"}
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

        {/* Tab Switcher */}
        <div className="flex bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm w-fit mx-auto lg:mx-0">
          <button
            onClick={() => setActiveView('instances')}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all ${
              activeView === 'instances' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <CalendarIcon className="w-4 h-4" /> One-off Trips
          </button>
          <button
            onClick={() => setActiveView('templates')}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all ${
              activeView === 'templates' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Repeat className="w-4 h-4" /> Recurring Blueprints
          </button>
        </div>

        {/* Controls Area */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 text-left">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto flex-1 max-w-4xl">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={activeView === 'instances' ? "Search by vessel, origin or destination..." : "Search templates..."}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 focus:bg-white outline-none text-xs font-bold text-gray-700 transition-all"
                />
              </div>
              {activeView === 'instances' && (
                <div className="flex gap-2">
                  <button onClick={() => setViewMode(viewMode === 'grouped' ? 'weekly' : 'grouped')} 
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-indigo-50 text-indigo-600 rounded-2xl text-[10px] font-bold uppercase tracking-widest border border-indigo-100 transition-all">
                    {viewMode === 'grouped' ? <Grid className="w-4 h-4" /> : <List className="w-4 h-4" />}
                    {viewMode === 'grouped' ? 'Grouped' : 'Weekly'}
                  </button>
                </div>
              )}
            </div>
            <button 
              onClick={() => { 
                if (activeView === 'instances') {
                  setFormData(initialFormState); 
                  setShowAddModal(true); 
                } else {
                  setTemplateFormData(initialTemplateState);
                  setShowAddTemplateModal(true);
                }
              }}
              className="w-full lg:w-auto bg-indigo-600 text-white px-8 py-4 rounded-2xl text-[11px] font-bold uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> {activeView === 'instances' ? 'Register Schedule' : 'Create Template'}
            </button>
          </div>
        </div>

        {/* View Content */}
        {activeView === 'instances' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8 text-left">
          {paginatedSchedules.length > 0 ? (
            paginatedSchedules.map(schedule => {
              const route = routes.find(r => r.id === schedule.routeId);
              const bus = buses.find(b => b.id === schedule.busId);
              const bucket = getBucket(schedule) || 'upcoming';
              const dep = toDate(schedule.departureDateTime);
              const filled = bus?.capacity ? (((bus.capacity - (schedule.availableSeats ?? 0)) / bus.capacity) * 100) : 0;
              const badge = STATUS_BADGE[schedule.status] || STATUS_BADGE.active;

              return (
                <div key={schedule.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition-all duration-500 group relative">
                  <div className="h-32 sm:h-40 bg-slate-50 relative flex items-center justify-center border-b border-gray-50">
                    <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#6366f1 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
                    <div className="relative z-10 w-20 h-20 sm:w-24 sm:h-24 bg-white/80 backdrop-blur-md rounded-2xl shadow-sm flex items-center justify-center border border-white/50 text-indigo-600 group-hover:scale-110 transition-transform duration-500">
                        <BusIcon className="w-8 h-8 sm:w-10 sm:h-10" />
                    </div>
                    <div className="absolute top-4 left-4">
                        <span className={`px-3 py-1 text-[9px] uppercase font-bold tracking-widest rounded-xl border shadow-sm ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                    </div>
                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-xl shadow-sm border border-white/50">
                        <p className="text-[10px] font-bold text-gray-900 tracking-tight">{dep.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>

                  <div className="p-6 sm:p-8 flex-1 flex flex-col">
                    <div className="mb-6">
                      <h3 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight uppercase leading-tight group-hover:text-indigo-600 transition-colors">
                        {route ? `${route.origin} → ${route.destination}` : 'Unknown Corridor'}
                      </h3>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1.5 flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-indigo-300" /> {dep.toLocaleDateString('en-MW', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-6 mb-6">
                      <div>
                        <p className="text-[9px] text-gray-400 font-bold tracking-widest mb-1.5 uppercase">Vessel Details</p>
                        <p className="text-sm font-bold text-gray-900 uppercase tracking-tight">{bus?.licensePlate || 'N/A'}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">{bus?.busType || 'Standard'}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-gray-400 font-bold tracking-widest mb-1.5 uppercase">Price Point</p>
                        <p className="text-sm font-bold text-gray-900">MWK {schedule.price.toLocaleString()}</p>
                        <p className="text-[10px] font-bold text-emerald-500 uppercase">Revenue Focus</p>
                      </div>
                    </div>

                    <div className="space-y-4 mb-8">
                      <div className="flex items-center justify-between">
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Load Saturation</p>
                          <p className="text-[10px] font-bold text-gray-900">{filled.toFixed(0)}% FILL</p>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-1000 ${filled > 80 ? 'bg-rose-500' : 'bg-indigo-600'}`} style={{ width: `${filled}%` }} />
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          <Users className="w-3.5 h-3.5" /> {schedule.availableSeats} of {bus?.capacity || '?'} Available
                      </div>
                    </div>

                    <div className="mt-auto pt-6 border-t border-gray-50 flex gap-2">
                      <button 
                        onClick={() => handleEditClick(schedule)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 bg-gray-50 text-gray-700 hover:bg-gray-100 rounded-2xl transition-all text-[10px] font-bold uppercase tracking-widest border border-gray-100"
                      >
                        <Eye className="w-4 h-4" /> View
                      </button>
                      <button 
                        onClick={() => handleEditClick(schedule)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-2xl transition-all text-[10px] font-bold uppercase tracking-widest border border-indigo-100"
                      >
                        <Edit3 className="w-4 h-4" /> Manage
                      </button>
                      <button 
                        onClick={() => handleDelete(schedule.id)}
                        className="p-3.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-2xl transition-all border border-rose-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full py-24 text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <CalendarIcon className="w-8 h-8 text-gray-200" />
              </div>
              <p className="text-sm font-bold text-gray-900 uppercase tracking-widest">No matching schedules identified</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">Adjust your search parameters or register new operations.</p>
            </div>
          )}
        </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8 text-left">
            {templates.length > 0 ? (
              templates.filter(t => {
                const route = routes.find(r => r.id === t.routeId);
                const bus = buses.find(b => b.id === t.busId);
                const search = searchTerm.toLowerCase();
                return (
                  route?.origin.toLowerCase().includes(search) ||
                  route?.destination.toLowerCase().includes(search) ||
                  bus?.licensePlate.toLowerCase().includes(search)
                );
              }).map(template => {
                const route = routes.find(r => r.id === template.routeId);
                const bus = buses.find(b => b.id === template.busId);
                return (
                  <div key={template.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition-all duration-500 group relative">
                    <div className="h-32 sm:h-40 bg-indigo-50 relative flex items-center justify-center border-b border-gray-50">
                      <div className="relative z-10 w-20 h-20 bg-white/80 backdrop-blur-md rounded-2xl shadow-sm flex items-center justify-center border border-white/50 text-indigo-600 group-hover:rotate-12 transition-transform duration-500">
                        <Repeat className="w-8 h-8" />
                      </div>
                      <div className="absolute top-4 left-4">
                        <span className="px-3 py-1 text-[9px] uppercase font-bold tracking-widest rounded-xl border shadow-sm bg-white text-indigo-600 border-indigo-100">
                          Blueprints
                        </span>
                      </div>
                    </div>
                    <div className="p-6 sm:p-8 flex-1 flex flex-col text-left">
                      <h3 className="text-xl font-bold text-gray-900 tracking-tight uppercase mb-4">
                        {route ? `${route.origin} → ${route.destination}` : 'Unknown Corridor'}
                      </h3>
                      <div className="space-y-3 mb-6">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          <Clock className="w-3.5 h-3.5" /> {template.departureTime} - {template.arrivalTime}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {DAYS.map(day => {
                            const isActive = template.daysOfWeek.includes(day.value as any);
                            return (
                              <span key={day.value} className={`px-2 py-1 rounded-lg text-[8px] font-bold uppercase tracking-tighter border ${
                                isActive ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-300 border-gray-100'
                              }`}>
                                {day.short}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-8">
                        <div>
                            <p className="text-[9px] text-gray-400 font-bold tracking-widest mb-1 uppercase">Assigned Vessel</p>
                            <p className="text-sm font-bold text-gray-900 uppercase tracking-tight">{bus?.licensePlate || 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-[9px] text-gray-400 font-bold tracking-widest mb-1 uppercase">Unit Yield</p>
                            <p className="text-sm font-bold text-gray-900">MWK {template.price.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="mt-auto pt-6 border-t border-gray-50 flex gap-2">
                        <button 
                          onClick={() => {
                            setSelectedTemplate(template);
                            setTemplateFormData({
                              routeId: template.routeId,
                              busId: template.busId,
                              departureTime: template.departureTime,
                              arrivalTime: template.arrivalTime,
                              daysOfWeek: template.daysOfWeek as DayOfWeek[],
                              price: template.price,
                              availableSeats: template.availableSeats,
                            });
                            setShowEditTemplateModal(true);
                          }}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-2xl transition-all text-[10px] font-bold uppercase tracking-widest border border-indigo-100"
                        >
                          <Edit3 className="w-4 h-4" /> Manage
                        </button>
                        <button 
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="p-3.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-2xl transition-all border border-rose-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full py-24 text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-gray-200">
                    <LayoutTemplate className="w-8 h-8" />
                </div>
                <p className="text-sm font-bold text-gray-900 uppercase tracking-widest">No architecture blueprinted</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">Define recurring trip patterns to automate operational flow.</p>
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between bg-white px-6 py-4 rounded-2xl border border-gray-100 shadow-sm mt-8">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-100 text-[10px] font-bold rounded-xl text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-100 text-[10px] font-bold rounded-xl text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Showing <span className="text-gray-900">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
                  <span className="text-gray-900">{Math.min(currentPage * ITEMS_PER_PAGE, filteredSchedules.length)}</span> of{' '}
                  <span className="text-gray-900">{filteredSchedules.length}</span> manifests
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-xl shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-xl border border-gray-100 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <span className="sr-only">Previous</span>
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`relative inline-flex items-center px-4 py-2 border text-[10px] font-bold uppercase tracking-widest ${
                        currentPage === i + 1
                          ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                          : 'bg-white border-gray-100 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-xl border border-gray-100 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <span className="sr-only">Next</span>
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Modal */}
        <Modal 
          isOpen={showAddModal || showEditModal} 
          onClose={() => { setShowAddModal(false); setShowEditModal(false); }} 
          title={showAddModal ? "Register New Schedule" : "Manage Schedule"}
        >
          <form onSubmit={showAddModal ? handleAddSubmit : handleEditSubmit} className="space-y-6 text-left p-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Transit Corridor</label>
                <select
                  value={formData.routeId}
                  onChange={e => setFormData({ ...formData, routeId: e.target.value })}
                  className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold appearance-none"
                  required
                >
                  <option value="">Select Route</option>
                  {routes.map(r => (
                    <option key={r.id} value={r.id}>{r.origin} → {r.destination}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Assigned Vessel</label>
                <select
                  value={formData.busId}
                  onChange={e => setFormData({ ...formData, busId: e.target.value })}
                  className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold appearance-none"
                  required
                >
                  <option value="">Select Bus</option>
                  {buses.map(b => (
                    <option key={b.id} value={b.id}>{b.licensePlate} ({b.busType} - {b.capacity} seats)</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Departure Timeline</label>
                <input
                  type="datetime-local"
                  value={formData.departureDateTime}
                  onChange={e => setFormData({ ...formData, departureDateTime: e.target.value })}
                  className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Estimated Arrival</label>
                <input
                  type="datetime-local"
                  value={formData.arrivalDateTime}
                  onChange={e => setFormData({ ...formData, arrivalDateTime: e.target.value })}
                  className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Base Fare (MWK)</label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={e => setFormData({ ...formData, price: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Available Capacity</label>
                <input
                  type="number"
                  value={formData.availableSeats}
                  onChange={e => setFormData({ ...formData, availableSeats: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Operational Status</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as ScheduleStatus })}
                  className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold appearance-none"
                  required
                >
                  <option value="active">Active</option>
                  <option value="postponed">Postponed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-8 border-t border-gray-50">
              <button 
                type="button" 
                onClick={() => { setShowAddModal(false); setShowEditModal(false); }} 
                className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="bg-indigo-600 text-white px-8 py-4 rounded-2xl text-[11px] font-bold uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {showAddModal ? "Commit Schedule" : "Update Operation"}
              </button>
            </div>
          </form>
        </Modal>

        {/* Add/Edit Template Modal */}
        <Modal 
          isOpen={showAddTemplateModal || showEditTemplateModal} 
          onClose={() => { setShowAddTemplateModal(false); setShowEditTemplateModal(false); }} 
          title={showAddTemplateModal ? "Architect Recurring Operation" : "Refine Template blue print"}
        >
          <form onSubmit={handleTemplateSubmit} className="space-y-6 text-left p-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Transit Corridor</label>
                <select
                  value={templateFormData.routeId}
                  onChange={e => setTemplateFormData({ ...templateFormData, routeId: e.target.value })}
                  className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold appearance-none"
                  required
                >
                  <option value="">Select Route</option>
                  {routes.map(r => (
                    <option key={r.id} value={r.id}>{r.origin} → {r.destination}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Assigned Vessel</label>
                <select
                  value={templateFormData.busId}
                  onChange={e => setTemplateFormData({ ...templateFormData, busId: e.target.value })}
                  className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold appearance-none"
                  required
                >
                  <option value="">Select Bus</option>
                  {buses.map(b => (
                    <option key={b.id} value={b.id}>{b.licensePlate} ({b.busType} - {b.capacity} seats)</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Recurrence Cycle</label>
              <div className="flex flex-wrap gap-2">
                  {DAYS.map(day => {
                    const isActive = templateFormData.daysOfWeek.includes(day.value as any);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => {
                          const days = templateFormData.daysOfWeek.includes(day.value as any)
                            ? templateFormData.daysOfWeek.filter(d => d !== day.value)
                            : [...templateFormData.daysOfWeek, day.value as any];
                          setTemplateFormData({ ...templateFormData, daysOfWeek: days });
                        }}
                        className={`px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${
                          isActive ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100' : 'bg-white text-gray-400 border-gray-100 hover:border-indigo-200'
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Departure Time</label>
                <input
                  type="time"
                  value={templateFormData.departureTime}
                  onChange={e => setTemplateFormData({ ...templateFormData, departureTime: e.target.value })}
                  className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Arrival Time</label>
                <input
                  type="time"
                  value={templateFormData.arrivalTime}
                  onChange={e => setTemplateFormData({ ...templateFormData, arrivalTime: e.target.value })}
                  className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Base Fare (MWK)</label>
                <input
                  type="number"
                  value={templateFormData.price}
                  onChange={e => setTemplateFormData({ ...templateFormData, price: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Available Capacity</label>
                <input
                  type="number"
                  value={templateFormData.availableSeats}
                  onChange={e => setTemplateFormData({ ...templateFormData, availableSeats: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none text-sm font-bold"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-8 border-t border-gray-50">
              <button 
                type="button" 
                onClick={() => { setShowAddTemplateModal(false); setShowEditTemplateModal(false); }} 
                className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="bg-indigo-600 text-white px-8 py-4 rounded-2xl text-[11px] font-bold uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Repeat className="w-4 h-4" />}
                {showAddTemplateModal ? "Architect Blue print" : "Refine Architecture"}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    );
  };

  export default SchedulesTab;
