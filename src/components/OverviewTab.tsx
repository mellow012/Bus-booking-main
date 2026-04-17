"use client";
import { useMemo, useState, useEffect } from "react";
import {
  DollarSign, Users, Calendar, Truck, TrendingUp,
  Clock, AlertTriangle, CheckCircle, Activity, MapPin,
  ArrowRight, User, Plus, Eye, X,
  Route as RouteIcon, CreditCard, Wallet, BarChart3
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
    <div className="bg-white rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] p-5 relative overflow-hidden flex flex-col justify-between min-h-[140px] border border-gray-100">
      <div className="flex justify-between items-start mb-2">
        <div className={`p-2 rounded-lg ${iconBg}`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        {badge && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${badge.className}`}>
            {badge.text}
          </span>
        )}
      </div>
      <div className="mt-auto">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">{title}</p>
        <p className="text-2xl font-extrabold text-gray-900 leading-none">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-1.5">{subtitle}</p>}
      </div>
    </div>
  );
}

// Action card shown when data is empty
function GetStartedCard({ icon: Icon, title, description, buttonText, iconBg, iconColor, onClick }: {
  icon: any; title: string; description: string; buttonText: string;
  iconBg: string; iconColor: string; onClick: () => void;
}) {
  return (
    <div className="bg-white rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-gray-100 p-6 flex flex-col items-center text-center hover:shadow-lg transition-all">
      <div className={`w-14 h-14 rounded-xl ${iconBg} flex items-center justify-center mb-4`}>
        <Icon className={`w-7 h-7 ${iconColor}`} />
      </div>
      <h3 className="text-base font-bold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 mb-5 max-w-[200px]">{description}</p>
      <button
        onClick={onClick}
        className="bg-indigo-900 hover:bg-indigo-800 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
      >
        <Plus className="w-4 h-4" /> {buttonText}
      </button>
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
    const activeRoutesCount = routes.filter(r => r.isActive).length;
    const activeSchedulesCount = schedules.filter(s => s.status === "active" || s.isActive).length;

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

  // Build revenue chart data from real bookings over the last 7 days
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

  // Today's upcoming schedules
  const todaySchedules = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    return schedules
      .filter(s => {
        const dep = toDate(s.departureDateTime);
        return dep >= todayStart && dep < todayEnd && (s.status === "active" || s.isActive);
      })
      .sort((a, b) => toDate(a.departureDateTime).getTime() - toDate(b.departureDateTime).getTime())
      .slice(0, 4);
  }, [schedules]);

  const isEmpty = buses.length === 0 && routes.length === 0 && schedules.length === 0;

  return (
    <div className="space-y-6">

      {/* ── Page Header Area ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-gray-900 tracking-tight">Overview</h1>
          <p className="text-[13px] text-gray-500 font-medium">
            {company?.name ? `${company.name} — Dashboard` : 'Company Dashboard'}
          </p>
        </div>
        <div className="flex gap-3">
          {realtimeStatus.isConnected && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 text-xs font-bold rounded-md border border-green-200">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live
            </span>
          )}
          <button 
            onClick={() => setActiveTab('bookings')} 
            className="hover:opacity-90 text-white px-5 py-2.5 rounded-md text-sm font-semibold transition-colors shadow-sm flex items-center gap-2"
            style={{ backgroundColor: 'var(--brand-primary)' }}
          >
            <Eye className="w-4 h-4" /> View Bookings
          </button>
        </div>
      </div>

      
      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KineticStatCard
          title="TOTAL REVENUE"
          value={`MWK ${fmt(stats.totalRevenue)}`}
          icon={DollarSign}
          iconBg="bg-blue-50" iconColor="text-[color:var(--brand-primary)]"
          subtitle={`${stats.confirmedBookings} confirmed bookings`}
        />
        <KineticStatCard
          title="ACTIVE BUSES"
          value={String(stats.activeBuses)}
          icon={Truck}
          iconBg="bg-green-50" iconColor="text-green-700"
          subtitle={`${stats.totalBuses} total fleet`}
        />
        <KineticStatCard
          title="PENDING BOOKINGS"
          value={String(stats.pendingBookings)}
          icon={Users}
          iconBg="bg-amber-50" iconColor="text-amber-600"
          badge={stats.pendingBookings > 0 ? { text: "ACTION", className: "bg-amber-100 text-amber-700" } : undefined}
          subtitle={`${stats.totalBookings} total`}
        />
        <KineticStatCard
          title="ACTIVE ROUTES"
          value={String(stats.activeRoutes)}
          icon={MapPin}
          iconBg="bg-purple-50" iconColor="text-purple-600"
          subtitle={`${stats.activeSchedules} active schedules`}
        />
      </div>

      {/* ── Middle Section ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Today's Departures */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <h2 className="text-[16px] font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5" style={{ color: 'var(--brand-primary)' }} /> Today&apos;s Departures
            </h2>
            <button onClick={() => setActiveTab('schedules')} style={{ color: 'var(--brand-primary)' }} className="text-[12px] font-semibold hover:opacity-80 flex items-center gap-1">
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {todaySchedules.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {todaySchedules.map(s => {
                const route = routes.find(r => r.id === s.routeId);
                const bus = buses.find(b => b.id === s.busId);
                const dep = toDate(s.departureDateTime);
                const arr = toDate(s.arrivalDateTime);
                const capacity = bus?.capacity ?? 0;
                const available = s.availableSeats ?? 0;
                const booked = capacity > 0 ? capacity - available : 0;
                const fillPct = capacity > 0 ? Math.round((booked / capacity) * 100) : 0;

                return (
                  <div key={s.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/50 transition-colors">
                    <div className="w-12 h-12 text-white rounded-lg flex flex-col items-center justify-center shrink-0" style={{ backgroundColor: 'var(--brand-primary)' }}>
                      <span className="text-xs font-bold leading-none">{dep.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {route ? `${route.origin} → ${route.destination}` : 'Route not set'}
                      </p>
                      <p className="text-xs text-gray-500 font-medium">
                        {bus?.licensePlate ?? 'No bus'} · {bus?.busType ?? ''} · ETA {fmtTime(arr)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-gray-900">{booked}/{capacity}</p>
                      <div className="w-20 h-1.5 bg-gray-100 rounded-full mt-1">
                        <div
                          className={`h-full rounded-full transition-all ${fillPct > 75 ? 'bg-red-400' : fillPct > 50 ? 'bg-amber-400' : 'bg-green-400'}`}
                          style={{ width: `${fillPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
              <Calendar className="w-12 h-12 text-gray-200 mb-3" />
              <p className="text-sm font-medium text-gray-500">No departures scheduled today</p>
              <button onClick={() => setActiveTab('schedules')} className="mt-4 text-sm font-bold hover:opacity-80 flex items-center gap-1" style={{ color: 'var(--brand-primary)' }}>
                <Plus className="w-4 h-4" /> Create Schedule
              </button>
            </div>
          )}
        </div>

        {/* Revenue Trends */}
        <div className="bg-white rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-gray-100 flex flex-col min-h-[300px]">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <h2 className="text-[16px] font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" style={{ color: 'var(--brand-primary)' }} /> Revenue (7 days)
            </h2>
          </div>
          <div className="p-5 flex-1 flex flex-col">
            {hasChartData ? (
              <>
                <div className="flex-1 min-h-[150px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                      <YAxis hide />
                      <Tooltip
                        cursor={{ fill: '#f3f4f6' }}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: any) => [`MWK ${fmt(Number(value) || 0)}`, 'Revenue']}
                      />
                      <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.isToday ? '#312e81' : '#94a3b8'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 tracking-wider">7-DAY TOTAL</p>
                    <p className="text-sm font-bold text-gray-900">MWK {fmt(chartData.reduce((s, d) => s + d.value, 0))}</p>
                  </div>
                  <button onClick={() => setActiveTab('payments')} className="text-xs font-bold hover:opacity-80 flex items-center gap-1" style={{ color: 'var(--brand-primary)' }}>
                    Full Report <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <BarChart3 className="w-12 h-12 text-gray-200 mb-3" />
                <p className="text-sm font-medium text-gray-500">No revenue data yet</p>
                <p className="text-xs text-gray-400 mt-1 max-w-[180px]">Revenue will appear here once bookings come in.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom Section: Recent Bookings Table ── */}
      <div className="bg-white rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-gray-100">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-[16px] font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5" style={{ color: 'var(--brand-primary)' }} /> Recent Bookings
          </h2>
          <button onClick={() => setActiveTab('bookings')} className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold rounded border border-gray-200 transition-colors">
            View All <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-5 py-3 font-bold text-gray-500 text-[11px] uppercase tracking-wider">Reference</th>
                <th className="px-5 py-3 font-bold text-gray-500 text-[11px] uppercase tracking-wider">Passenger</th>
                <th className="px-5 py-3 font-bold text-gray-500 text-[11px] uppercase tracking-wider hidden md:table-cell">Route</th>
                <th className="px-5 py-3 font-bold text-gray-500 text-[11px] uppercase tracking-wider">Amount</th>
                <th className="px-5 py-3 font-bold text-gray-500 text-[11px] uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 font-bold text-gray-500 text-[11px] uppercase tracking-wider hidden sm:table-cell">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentBookings.length > 0 ? recentBookings.map((b, index) => {
                const name = b.passengerDetails?.[0]?.name || "Passenger";
                const initials = name.substring(0, 2).toUpperCase();
                const bgColors = ['bg-blue-100 text-blue-700', 'bg-green-100 text-green-700', 'bg-purple-100 text-purple-700', 'bg-orange-100 text-orange-700', 'bg-pink-100 text-pink-700'];
                const avatarColor = bgColors[index % bgColors.length];
                const isConfirmed = b.bookingStatus === 'confirmed';
                const isPending = b.bookingStatus === 'pending';
                const sch = schedules.find(s => s.id === b.scheduleId);
                const route = sch ? routes.find(r => r.id === sch.routeId) : undefined;

                return (
                  <tr key={b.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <span className="font-mono text-xs font-bold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
                        {b.bookingReference || b.id.substring(0, 8).toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${avatarColor}`}>
                          {initials}
                        </div>
                        <span className="font-bold text-gray-900">{name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-500 font-medium hidden md:table-cell">
                      {route ? `${route.origin} → ${route.destination}` : '—'}
                    </td>
                    <td className="px-5 py-4 font-bold text-gray-900">MWK {fmt(b.totalAmount || 0)}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full ${
                        isConfirmed ? 'bg-green-100 text-green-700' :
                        isPending ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {b.bookingStatus?.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-4 hidden sm:table-cell">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        b.paymentStatus === 'paid'
                          ? 'bg-green-50 text-green-600 border border-green-200'
                          : 'bg-gray-50 text-gray-500 border border-gray-200'
                      }`}>
                        {b.paymentStatus === 'paid' ? <CreditCard className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {b.paymentStatus?.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-500">No bookings yet</p>
                    <p className="text-xs text-gray-400 mt-1">Bookings will appear here once passengers start booking.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {recentBookings.length > 0 && (
          <div className="px-5 py-3 flex items-center justify-between border-t border-gray-100 bg-gray-50/50">
            <span className="text-[11px] font-bold text-gray-500">
              Showing {recentBookings.length} of {stats.totalBookings} bookings
            </span>
            <button onClick={() => setActiveTab('bookings')} className="text-xs font-bold hover:opacity-80 flex items-center gap-1" style={{ color: 'var(--brand-primary)' }}>
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}

      <div className="mt-8">
  {/* ── Setup Wizard: Progressive Onboarding ── */}
      {(() => {
        const steps = [
          {
            id: 'profile',
            title: 'Brand Identity',
            desc: 'Company logo & business details',
            tab: 'profile' as TabType,
            isDone: !!(company?.logo && company?.contact),
            icon: User
          },
          {
            id: 'payments',
            title: 'Wallet Setup',
            desc: 'Connect your PayChangu keys',
            tab: 'settings' as TabType,
            isDone: !!(paymentSettings?.publicKey || (paymentSettings as any)?.live_public_key),
            icon: CreditCard
          },
          {
            id: 'routes',
            title: 'Transit Map',
            desc: 'Origin, Destination & Fares',
            tab: 'routes' as TabType,
            isDone: routes.length > 0,
            icon: RouteIcon
          },
          {
            id: 'buses',
            title: 'Fleet Setup',
            desc: 'Register license plates & capacity',
            tab: 'buses' as TabType,
            isDone: buses.length > 0,
            icon: Truck
          },
          {
            id: 'schedules',
            title: 'Go Live!',
            desc: 'Launch your first schedule',
            tab: 'schedules' as TabType,
            isDone: schedules.length > 0,
            icon: Calendar
          },
          {
            id: 'team',
            title: 'Build the Team',
            desc: 'Add operators or conductors',
            tab: 'operators' as TabType,
            isDone: Object.keys(dashboardData.operatorNames ?? {}).length > 0 || Object.keys(dashboardData.conductorNames ?? {}).length > 0,
            icon: Users
          }
        ];

        const completedCount = steps.filter(s => s.isDone).length;
        const progressPercent = Math.round((completedCount / steps.length) * 100);
        const nextStep = steps.find(s => !s.isDone);

        // We show the wizard if not all steps are done
        if (progressPercent === 100) return null;

        return (
          <div className="bg-white rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-brand-primary/20 overflow-hidden" style={{ borderColor: 'var(--brand-primary)33' }}>
            <div className="p-6 text-white" style={{ background: 'linear-gradient(to right, var(--brand-primary), var(--brand-secondary))' }}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                <div>
                    <span className="px-2 py-0.5 bg-white/20 rounded text-[10px] font-bold uppercase tracking-wider">Onboarding</span>
                    <h2 className="text-xl font-bold">Guided Setup Wizard</h2>
                  </div>
                  <p className="text-white/70 text-sm">Complete these steps to fully activate your company operations.</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-2xl font-black leading-none">{progressPercent}%</p>
                      <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mt-1">Completion</p>
                    </div>
                    <div className="w-16 h-16 relative">
                       <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="16" fill="none" className="stroke-white/10" strokeWidth="3" />
                          <circle cx="18" cy="18" r="16" fill="none" className="transition-all duration-1000" strokeWidth="3" style={{ stroke: 'white' }} strokeDasharray={`${progressPercent}, 100`} strokeLinecap="round" />
                       </svg>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsWizardMinimized(!isWizardMinimized)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    title={isWizardMinimized ? "Show steps" : "Minimize wizard"}
                  >
                    {isWizardMinimized ? <Plus className="w-5 h-5" /> : <X className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>

            {!isWizardMinimized && (
              <div className="p-6 animate-in fade-in slide-in-from-top-2 duration-500">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {steps.map((step, idx) => (
                    <button
                      key={step.id}
                      onClick={() => setActiveTab(step.tab)}
                      className={`group relative p-4 rounded-xl border transition-all text-left flex items-start gap-4 ${
                        step.isDone 
                          ? 'bg-green-50/50 border-green-100 hover:bg-green-50' 
                          : nextStep?.id === step.id 
                            ? 'bg-blue-50/30 border-blue-200 ring-1 ring-blue-200 shadow-sm hover:shadow-md' 
                            : 'bg-gray-50/50 border-transparent text-gray-400 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                        step.isDone ? 'bg-green-100 text-green-600' : 'bg-white border text-gray-400'
                      }`}>
                        {step.isDone ? <CheckCircle className="w-5 h-5" /> : <step.icon className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <p className={`text-xs font-bold uppercase tracking-wider ${step.isDone ? 'text-green-700' : 'text-gray-500'}`}>Step {idx + 1}</p>
                          {step.isDone && <span className="text-[10px] font-bold text-green-600 bg-green-100 px-1.5 rounded">DONE</span>}
                        </div>
                        <p className={`font-bold truncate ${step.isDone ? 'text-green-900 line-through' : 'text-gray-900'}`}>{step.title}</p>
                        <p className="text-[11px] text-gray-500 truncate">{step.desc}</p>
                      </div>
                      {nextStep?.id === step.id && (
                        <div className="absolute right-4 bottom-4 w-6 h-6 rounded-full bg-brand-primary text-white flex items-center justify-center animate-bounce shadow-lg" style={{ backgroundColor: 'var(--brand-primary)' }}>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {nextStep && (
                  <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-lg border shadow-sm">
                        <nextStep.icon className="w-5 h-5" style={{ color: 'var(--brand-primary)' }} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Next Up</p>
                        <p className="font-bold text-gray-900">{nextStep.title}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setActiveTab(nextStep.tab)}
                      className="w-full sm:w-auto px-6 py-2.5 hover:opacity-90 text-white rounded-lg text-sm font-bold shadow-lg transition-all flex items-center justify-center gap-2"
                      style={{ backgroundColor: 'var(--brand-primary)' }}
                    >
                      Continue Setup <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      </div>
      </div>
    </div>
  );
}
