"use client";
import { useMemo, useState, useEffect } from "react";
import {
  DollarSign, Users, Calendar, Truck, TrendingUp,
  Clock, AlertTriangle, CheckCircle, Activity, MapPin,
  ArrowRight, User, Plus, Eye, X,
  Route as RouteIcon, CreditCard, Wallet, BarChart3,
  ChevronRight, Sparkles, Zap, Building2
} from "lucide-react";
import { Company, Schedule, Route, Bus, Booking } from "@/types";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

type TabType = "overview" | "schedules" | "routes" | "buses" | "bookings" | "operators" | "profile" | "settings" | "payments";

interface OverviewTabProps {
  dashboardData: {
    company: Company | null;
    schedules: Schedule[];
    routes: Route[];
    buses: Bus[];
    bookings: Booking[];
    operatorNames?: Record<string, string>;
    conductorNames?: Record<string, string>;
  };
  paymentSettings?: Record<string, any>;
  realtimeStatus: {
    isConnected: boolean;
    lastUpdate: Date | null;
    pendingUpdates: number;
  };
  setActiveTab: (tab: TabType) => void;
  handleStatusToggle: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toDate = (date: any): Date => {
  if (!date) return new Date();
  if (date instanceof Date) return date;
  if (typeof date === "string" || typeof date === "number") return new Date(date);
  return new Date();
};

const fmt = (n: number) => n.toLocaleString("en-MW");
const fmtTime = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// ─── Sub-components ────────────────────────────────────────────────────────────

function KineticStatCard({ title, value, icon: Icon, iconBg, iconColor, badge, subtitle }: {
  title: string;
  value: string;
  icon: any;
  iconBg: string;
  iconColor: string;
  badge?: { text: string; className: string };
  subtitle?: string;
}) {
  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl shadow-[0_8px_30px_-10px_rgba(0,0,0,0.05)] p-4 sm:p-6 relative overflow-hidden flex flex-col justify-between min-h-[140px] sm:min-h-[160px] border border-gray-100 group hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] transition-all duration-500 text-left">
      <div className="absolute -right-8 -top-8 w-24 h-24 bg-indigo-600/5 rounded-full blur-3xl group-hover:bg-indigo-600/10 transition-colors"></div>
      
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className={`p-3 rounded-2xl ${iconBg} shadow-sm border border-white/50 group-hover:scale-110 transition-transform duration-500`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        {badge && (
          <span className={`text-[9px] font-black px-2.5 py-1.5 rounded-xl uppercase tracking-widest border shadow-sm ${badge.className}`}>
            {badge.text}
          </span>
        )}
      </div>
      <div className="relative z-10">
        <p className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 sm:mb-1.5">{title}</p>
        <p className="text-2xl sm:text-3xl font-black text-gray-900 leading-none tracking-tight">{value}</p>
        {subtitle && <p className="text-[10px] sm:text-[11px] font-bold text-gray-400 mt-2 flex items-center gap-1.5"><Sparkles className="w-3 h-3 text-indigo-400" /> {subtitle}</p>}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function OverviewTab({ dashboardData, realtimeStatus, setActiveTab, handleStatusToggle, paymentSettings }: OverviewTabProps) {
  const { company, schedules, routes, buses, bookings } = dashboardData;
  const [isWizardMinimized, setIsWizardMinimized] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('wizard_minimized') === 'true';
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem('wizard_minimized', String(isWizardMinimized));
  }, [isWizardMinimized]);

  const stats = useMemo(() => {
    const paid = bookings.filter(b => b.paymentStatus === "paid");
    const totalRev = paid.reduce((s, b) => s + (b.totalAmount || 0), 0);
    const pendingCount = bookings.filter(b => b.bookingStatus === "pending").length;
    const confirmedCount = bookings.filter(b => b.bookingStatus === "confirmed").length;
    const activeBusesCount = buses.filter(b => b.status === "active").length;
    const activeRoutesCount = routes.filter(r => r.status === "active").length;
    const activeSchedulesCount = schedules.filter(s => s.status === "active").length;

    return {
      totalRevenue: totalRev,
      totalBookings: bookings.length,
      confirmedBookings: confirmedCount,
      pendingBookings: pendingCount,
      activeBuses: activeBusesCount,
      totalBuses: buses.length,
      activeRoutes: activeRoutesCount,
      totalRoutes: routes.length,
      activeSchedules: activeSchedulesCount,
      totalSchedules: schedules.length,
    };
  }, [bookings, buses, routes, schedules]);

  const recentBookings = useMemo(() =>
    [...bookings]
      .sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime())
      .slice(0, 5),
    [bookings]
  );

  const chartData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const weekData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const dayRevenue = bookings
        .filter(b => b.paymentStatus === "paid")
        .filter(b => {
          const bd = toDate(b.createdAt);
          return bd >= dayStart && bd < dayEnd;
        })
        .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

      weekData.push({
        name: days[d.getDay()],
        value: dayRevenue,
        isToday: i === 0,
      });
    }
    return weekData;
  }, [bookings]);

  const hasChartData = chartData.some(d => d.value > 0);

  const todaySchedules = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    return schedules
      .filter(s => {
        const dep = toDate(s.departureDateTime);
        return dep >= todayStart && dep < todayEnd && s.status === "active";
      })
      .sort((a, b) => toDate(a.departureDateTime).getTime() - toDate(b.departureDateTime).getTime())
      .slice(0, 4);
  }, [schedules]);

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-12 px-2 sm:px-0">

      {/* ── Page Header Area ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3 uppercase">
             OPERATIONAL OVERVIEW
             {realtimeStatus.isConnected && <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.4)]" />}
          </h1>
          <p className="text-[10px] sm:text-[11px] font-black text-gray-400 uppercase tracking-widest mt-1.5 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-400" />
            {company?.name || 'GENERIC PARTNER'} • CONTROL CENTER
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setActiveTab('bookings')} 
            className="group w-full sm:w-auto flex items-center justify-center gap-3 bg-indigo-600 text-white px-6 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95"
          >
            <Eye className="w-4 h-4 group-hover:scale-110 transition-transform" /> 
            Live Bookings
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <KineticStatCard
          title="AGGREGATE REVENUE"
          value={`MWK ${fmt(stats.totalRevenue)}`}
          icon={DollarSign}
          iconBg="bg-indigo-50" iconColor="text-indigo-600"
          subtitle={`${stats.confirmedBookings} confirmed bookings`}
        />
        <KineticStatCard
          title="OPERATIONAL FLEET"
          value={String(stats.activeBuses)}
          icon={Truck}
          iconBg="bg-emerald-50" iconColor="text-emerald-600"
          subtitle={`${stats.totalBuses} total vessels`}
        />
        <KineticStatCard
          title="PENDING APPROVALS"
          value={String(stats.pendingBookings)}
          icon={Users}
          iconBg="bg-rose-50" iconColor="text-rose-600"
          badge={stats.pendingBookings > 0 ? { text: "CRITICAL", className: "bg-rose-100 text-rose-700 border-rose-200" } : undefined}
          subtitle={`${stats.totalBookings} total attempts`}
        />
        <KineticStatCard
          title="ACTIVE CORRIDORS"
          value={String(stats.activeRoutes)}
          icon={MapPin}
          iconBg="bg-amber-50" iconColor="text-amber-600"
          subtitle={`${stats.activeSchedules} scheduled trips`}
        />
      </div>

      {/* ── Middle Section ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 text-left">

        {/* Today's Departures */}
        <div className="lg:col-span-2 bg-white rounded-[2rem] shadow-[0_8px_30px_-10px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden flex flex-col group">
          <div className="flex items-center justify-between p-5 sm:p-6 border-b border-gray-50">
            <div>
               <h2 className="text-xs sm:text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                 <Calendar className="w-4 h-4 text-indigo-500" /> DAILY LOGISTICS WINDOW
               </h2>
               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Real-time departure monitoring</p>
            </div>
            <button onClick={() => setActiveTab('schedules')} className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest flex items-center gap-1.5 transition-colors">
              FULL LOG <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1">
            {todaySchedules.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-gray-50">
                {todaySchedules.map(s => {
                  const route = routes.find(r => r.id === s.routeId);
                  const bus = buses.find(b => b.id === s.busId);
                  const dep = toDate(s.departureDateTime);
                  const capacity = bus?.capacity ?? 0;
                  const available = s.availableSeats ?? 0;
                  const booked = capacity > 0 ? capacity - available : 0;
                  const fillPct = capacity > 0 ? Math.round((booked / capacity) * 100) : 0;

                  return (
                    <div key={s.id} className="bg-white p-5 sm:p-6 hover:bg-indigo-50/30 transition-all duration-300">
                      <div className="flex items-center justify-between mb-4">
                        <div className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black tracking-widest shadow-md shadow-indigo-100">
                           {dep.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="flex flex-col items-end">
                           <span className="text-[10px] font-black text-gray-900">{fillPct}% LOAD</span>
                           <div className="w-20 h-1 bg-gray-100 rounded-full mt-1 overflow-hidden">
                              <div className={`h-full transition-all duration-1000 ${fillPct > 80 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${fillPct}%` }} />
                           </div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-black text-gray-900 uppercase tracking-tight">
                          {route ? `${route.origin} → ${route.destination}` : 'UNDEFINED CORRIDOR'}
                        </p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                          <Truck className="w-3.5 h-3.5 text-indigo-300" />
                          {bus?.licensePlate ?? 'UNASSIGNED'} • {bus?.busType ?? 'GENERIC'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center py-16 sm:py-20 bg-gray-50/30">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4 border border-gray-100">
                   <Zap className="w-6 h-6 text-gray-200" />
                </div>
                <p className="text-[10px] sm:text-[11px] font-black text-gray-400 uppercase tracking-widest">No Operational departures identified</p>
              </div>
            )}
          </div>
        </div>

        {/* Revenue Trends */}
        <div className="bg-white rounded-[2rem] shadow-[0_8px_30px_-10px_rgba(0,0,0,0.05)] border border-gray-100 flex flex-col p-5 sm:p-6 overflow-hidden">
          <div className="mb-6">
             <h2 className="text-xs sm:text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
               <TrendingUp className="w-4 h-4 text-emerald-500" /> YIELD ANALYTICS
             </h2>
             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">7-Day performance cycle</p>
          </div>
          
          <div className="flex-1 flex flex-col min-h-[220px]">
            {hasChartData ? (
              <>
                <div className="flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#9ca3af', fontWeight: 'bold' }} />
                      <YAxis hide />
                      <Tooltip
                        cursor={{ fill: 'rgba(99, 102, 241, 0.05)', radius: 8 }}
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                        itemStyle={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}
                      />
                      <Bar dataKey="value" radius={[6, 6, 6, 6]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.isToday ? '#4f46e5' : '#e2e8f0'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-6 pt-6 border-t border-gray-50 flex justify-between items-center">
                  <div>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">CYCLICAL TOTAL</p>
                    <p className="text-base sm:text-lg font-black text-gray-900 tracking-tight">MWK {fmt(chartData.reduce((s, d) => s + d.value, 0))}</p>
                  </div>
                  <button onClick={() => setActiveTab('payments')} className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all">
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mb-4">
                   <BarChart3 className="w-6 h-6 text-gray-200" />
                </div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Transaction history null</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Setup Wizard: Progressive Onboarding ── */}
      {(() => {
        const steps = [
          {
            id: 'profile',
            title: 'CORE IDENTITY',
            desc: 'Assets & Branding',
            tab: 'profile' as TabType,
            isDone: !!(company?.logo && company?.contact),
            icon: User
          },
          {
            id: 'payments',
            title: 'GATEWAY SYNC',
            desc: 'Financial Integration',
            tab: 'settings' as TabType,
            isDone: !!(paymentSettings?.publicKey || (paymentSettings as any)?.live_public_key),
            icon: CreditCard
          },
          {
            id: 'routes',
            title: 'TRANSIT MAPPING',
            desc: 'Station Hierarchies',
            tab: 'routes' as TabType,
            isDone: routes.length > 0,
            icon: RouteIcon
          },
          {
            id: 'buses',
            title: 'FLEET REGISTRY',
            desc: 'Asset Enumeration',
            tab: 'buses' as TabType,
            isDone: buses.length > 0,
            icon: Truck
          },
          {
            id: 'schedules',
            title: 'LAUNCH WINDOW',
            desc: 'Operational Lifecycle',
            tab: 'schedules' as TabType,
            isDone: schedules.length > 0,
            icon: Calendar
          },
          {
            id: 'team',
            title: 'CREW MANIFESTO',
            desc: 'Human Resource Sync',
            tab: 'operators' as TabType,
            isDone: Object.keys(dashboardData.operatorNames ?? {}).length > 0 || Object.keys(dashboardData.conductorNames ?? {}).length > 0,
            icon: Users
          }
        ];

        const completedCount = steps.filter(s => s.isDone).length;
        const progressPercent = Math.round((completedCount / steps.length) * 100);
        const nextStep = steps.find(s => !s.isDone);

        if (progressPercent === 100) return null;

        return (
          <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden">
            <div className="p-6 sm:p-8 bg-indigo-900 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600 rounded-full blur-[100px] opacity-20 -mr-32 -mt-32"></div>
               <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-600 rounded-full blur-[80px] opacity-10 -ml-24 -mb-24"></div>
               
               <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 sm:gap-8 text-left">
                  <div className="space-y-2">
                     <span className="px-3 py-1 bg-white/10 text-white/90 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest border border-white/10 backdrop-blur-sm">
                        OPERATIONAL READINESS
                     </span>
                     <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">ONBOARDING</h2>
                     <p className="text-white/50 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest">Sync your infrastructure</p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 sm:gap-8">
                     <div className="flex items-center gap-4 sm:gap-5">
                        <div className="text-right">
                           <p className="text-3xl sm:text-4xl font-black text-white leading-none tracking-tighter">{progressPercent}%</p>
                           <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mt-1.5">INDEX</p>
                        </div>
                        <div className="w-16 h-16 sm:w-20 sm:h-20 relative">
                           <svg className="w-full h-full -rotate-90 drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]" viewBox="0 0 36 36">
                              <circle cx="18" cy="18" r="16" fill="none" className="stroke-white/10" strokeWidth="4" />
                              <circle cx="18" cy="18" r="16" fill="none" className="transition-all duration-1000" strokeWidth="4" 
                                      style={{ stroke: 'white' }} strokeDasharray={`${progressPercent}, 100`} strokeLinecap="round" />
                           </svg>
                        </div>
                     </div>
                     <button 
                       onClick={() => setIsWizardMinimized(!isWizardMinimized)}
                       className="w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white text-white hover:text-indigo-900 rounded-2xl transition-all border border-white/10"
                     >
                       {isWizardMinimized ? <Plus className="w-5 h-5" /> : <X className="w-5 h-5" />}
                     </button>
                  </div>
               </div>
            </div>

            {!isWizardMinimized && (
              <div className="p-5 sm:p-8 animate-in fade-in slide-in-from-top-4 duration-500 text-left">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {steps.map((step, idx) => (
                    <button
                      key={step.id}
                      onClick={() => setActiveTab(step.tab)}
                      className={`group relative p-5 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border transition-all duration-300 text-left flex flex-col gap-4 ${
                        step.isDone 
                          ? 'bg-emerald-50/30 border-emerald-100 hover:bg-emerald-50' 
                          : nextStep?.id === step.id 
                            ? 'bg-white border-indigo-200 shadow-xl shadow-indigo-50 ring-2 ring-indigo-50 active:scale-95' 
                            : 'bg-gray-50/50 border-gray-50 text-gray-300 pointer-events-none'
                      }`}
                    >
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                        step.isDone ? 'bg-emerald-100 text-emerald-600' : nextStep?.id === step.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white border border-gray-100 text-gray-200'
                      }`}>
                        {step.isDone ? <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6" /> : <step.icon className="w-5 h-5 sm:w-6 sm:h-6" />}
                      </div>
                      
                      <div>
                        <div className="flex items-center justify-between mb-1">
                           <p className={`text-[9px] font-black uppercase tracking-widest ${step.isDone ? 'text-emerald-600/60' : nextStep?.id === step.id ? 'text-indigo-600' : 'text-gray-400'}`}>STEP {idx + 1}</p>
                           {step.isDone && <span className="text-[8px] font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-200">DONE</span>}
                        </div>
                        <p className={`text-xs sm:text-sm font-black tracking-tight uppercase ${step.isDone ? 'text-emerald-900/40' : 'text-gray-900'}`}>{step.title}</p>
                        <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-widest">{step.desc}</p>
                      </div>

                      {nextStep?.id === step.id && (
                        <div className="absolute right-5 sm:right-6 bottom-5 sm:bottom-6 w-7 h-7 sm:w-8 sm:h-8 rounded-xl sm:rounded-2xl bg-indigo-600 text-white flex items-center justify-center animate-pulse shadow-xl shadow-indigo-100">
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Recent Bookings Section */}
      <div className="bg-white rounded-[2rem] shadow-[0_8px_30px_-10px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden text-left">
        <div className="flex items-center justify-between p-5 sm:p-8 border-b border-gray-50">
          <div>
             <h2 className="text-xs sm:text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
               <Users className="w-4 h-4 text-rose-500" /> TRANSACTION LEDGER
             </h2>
             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Recent passenger interactions</p>
          </div>
          <button onClick={() => setActiveTab('bookings')} className="px-4 py-2 sm:px-5 sm:py-2.5 bg-gray-50 hover:bg-indigo-50 text-gray-900 text-[9px] sm:text-[10px] font-black uppercase tracking-widest rounded-xl sm:rounded-2xl border border-gray-100 hover:border-indigo-100 transition-all">
            FULL AUDIT
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="bg-gray-50/50">
                {['Reference', 'Identity', 'Operational Corridor', 'Yield', 'Lifecycle', 'Financials'].map(h => (
                  <th key={h} className="px-6 sm:px-8 py-4 sm:py-5 font-black text-gray-400 text-[9px] sm:text-[10px] uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentBookings.length > 0 ? recentBookings.map((b) => {
                const name = b.passengerDetails?.[0]?.name || "ANONYMOUS";
                const initials = name.substring(0, 1).toUpperCase();
                const isConfirmed = b.bookingStatus === 'confirmed';
                const isPending = b.bookingStatus === 'pending';
                const sch = schedules.find(s => s.id === b.scheduleId);
                const route = sch ? routes.find(r => r.id === sch.routeId) : undefined;

                return (
                  <tr key={b.id} className="hover:bg-indigo-50/20 transition-colors group">
                    <td className="px-6 sm:px-8 py-5 sm:py-6">
                      <span className="font-mono text-[10px] sm:text-[11px] font-black text-gray-400 bg-gray-50 px-2.5 py-1.5 rounded-xl border border-gray-100 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all">
                        #{b.bookingReference || b.id.substring(0, 8).toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 sm:px-8 py-5 sm:py-6">
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-indigo-50 flex items-center justify-center text-xs sm:text-[12px] font-black text-indigo-600 border border-indigo-100 group-hover:scale-110 transition-transform">
                          {initials}
                        </div>
                        <span className="text-xs sm:text-sm font-black text-gray-900 uppercase tracking-tight">{name}</span>
                      </div>
                    </td>
                    <td className="px-6 sm:px-8 py-5 sm:py-6">
                       {route ? (
                          <div className="flex flex-col gap-0.5">
                             <p className="text-[11px] sm:text-xs font-black text-gray-700 uppercase tracking-tight">{route.origin} → {route.destination}</p>
                             <p className="text-[8px] sm:text-[9px] font-bold text-gray-400 uppercase tracking-widest">{fmtTime(toDate(sch?.departureDateTime))}</p>
                          </div>
                       ) : <span className="text-gray-300">N/A</span>}
                    </td>
                    <td className="px-6 sm:px-8 py-5 sm:py-6 text-xs sm:text-sm font-black text-gray-900">MWK {fmt(b.totalAmount || 0)}</td>
                    <td className="px-6 sm:px-8 py-5 sm:py-6">
                      <span className={`px-2 py-1 sm:px-3 sm:py-1.5 text-[8px] sm:text-[9px] font-black rounded-lg sm:rounded-xl uppercase tracking-widest border shadow-sm ${
                        isConfirmed ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        isPending ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-rose-50 text-rose-700 border-rose-100'
                      }`}>
                        {b.bookingStatus}
                      </span>
                    </td>
                    <td className="px-6 sm:px-8 py-5 sm:py-6">
                      <span className={`inline-flex items-center gap-1.5 sm:gap-2 px-2 py-1 sm:px-3 sm:py-1.5 text-[8px] sm:text-[9px] font-black rounded-lg sm:rounded-xl border uppercase tracking-widest ${
                        b.paymentStatus === 'paid'
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                          : 'bg-gray-50 text-gray-400 border-gray-100'
                      }`}>
                        <div className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${b.paymentStatus === 'paid' ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                        {b.paymentStatus}
                      </span>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={6} className="px-6 sm:px-8 py-16 sm:py-20 text-center">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-50 rounded-2xl sm:rounded-[2rem] flex items-center justify-center mx-auto mb-4">
                       <Users className="w-6 h-6 text-gray-200" />
                    </div>
                    <p className="text-[10px] sm:text-[11px] font-black text-gray-400 uppercase tracking-widest">Transaction log cleared</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
