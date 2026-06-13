"use client";

import React, { useState, useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import useChiefGrowth from './_hooks/useChiefGrowth';
import Fuse from 'fuse.js';
import {
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  Users, Building2,
  Search, RefreshCw, ChevronLeft, ChevronRight, Bell,
  Bus, Activity, CheckCircle2, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Minus,
  Zap, BarChart3, Map, ChevronDown, Sparkles,
  TrendingUp, UserPlus, Clock,
} from 'lucide-react';

// ─── TYPES ────────────────────────────────────────────────────────────────────

type TrendDay = { date: string; users: number; bookings: number; customers: number; staff: number };
type TopRoute  = { route: string; bookings: number; revenue: number };
type RecentSignup = {
  id: string; firstName: string; lastName: string;
  email: string; role: string; createdAt: string; companyId?: string | null;
};
type CompanyRow = {
  id: string; name: string; email: string; phone?: string | null;
  status: string; planType: string; createdAt: string;
  bookingsCount: number; busesCount: number; routesCount: number; operatorsCount: number;
};

interface Stats {
  totalUsers: number; customerCount: number; companyCount: number; crewCount: number;
  newUsersThisMonth: number; newUsersLastMonth: number; userGrowthPct: number;
  totalBookings: number; confirmedBookings: number; pendingBookings: number; cancelledBookings: number;
  bookingsThisMonth: number; bookingsLastMonth: number; bookingGrowthPct: number;
  conversionRate: number; cancellationRate: number;
  activeSchedules: number; completedTrips: number; activeRoutes: number; activeBuses: number;
  trendData: TrendDay[];
  topRoutes: TopRoute[];
  recentSignups: RecentSignup[];
  companies: CompanyRow[];
}

interface Props { initialData: any[]; initialMeta: any; stats: Stats }

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const ROLE_META: Record<string, { label: string; color: string }> = {
  customer:        { label: 'Customer',      color: '#6366f1' },
  company_admin:   { label: 'Company Admin', color: '#8b5cf6' },
  operator:        { label: 'Operator',      color: '#06b6d4' },
  conductor:       { label: 'Conductor',     color: '#f59e0b' },
  chief_of_growth: { label: 'CoG',           color: '#10b981' },
  superadmin:      { label: 'Super Admin',   color: '#ef4444' },
};
const COMPANY_PAGE_SIZE = 8;

// ─── UTILS ────────────────────────────────────────────────────────────────────

const fmtNum  = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
const fmtAxisDate = (s: string) =>
  new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

// ─── MICRO COMPONENTS ─────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const m = ROLE_META[role] || { label: role, color: '#94a3b8' };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider"
      style={{ background: `${m.color}15`, color: m.color }}>
      {m.label}
    </span>
  );
}

function GrowthChip({ pct }: { pct: number }) {
  if (pct > 0)  return <span className="flex items-center gap-0.5 text-[10px] font-black text-emerald-600"><ArrowUpRight className="w-3 h-3" />+{pct}% MoM</span>;
  if (pct < 0)  return <span className="flex items-center gap-0.5 text-[10px] font-black text-rose-600"><ArrowDownRight className="w-3 h-3" />{pct}% MoM</span>;
  return <span className="flex items-center gap-0.5 text-[10px] font-black text-slate-400"><Minus className="w-3 h-3" />Flat</span>;
}

function SectionHeader({ title, sub, icon: Icon }: { title: string; sub?: string; icon?: any }) {
  return (
    <div className="flex items-start gap-2.5">
      {Icon && (
        <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-indigo-600" />
        </div>
      )}
      <div>
        <h3 className="font-black text-slate-900 text-sm leading-tight">{title}</h3>
        {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden w-full">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }} />
    </div>
  );
}

function AlertCard({ type, title, desc }: { type: 'warning' | 'info' | 'success'; title: string; desc: string }) {
  const cfg = {
    warning: { bg: 'bg-amber-50 border-amber-100', icon: AlertTriangle, ic: 'text-amber-500', tc: 'text-amber-800' },
    info:    { bg: 'bg-blue-50 border-blue-100',   icon: Zap,           ic: 'text-blue-500',  tc: 'text-blue-800'  },
    success: { bg: 'bg-emerald-50 border-emerald-100', icon: CheckCircle2, ic: 'text-emerald-500', tc: 'text-emerald-800' },
  }[type];
  const Icon = cfg.icon;
  return (
    <div className={`flex items-start gap-2.5 p-3 rounded-xl border ${cfg.bg}`}>
      <Icon className={`w-4 h-4 ${cfg.ic} shrink-0 mt-0.5`} />
      <div>
        <p className={`text-[11px] font-extrabold ${cfg.tc}`}>{title}</p>
        <p className={`text-[10px] ${cfg.tc} opacity-85 mt-0.5 leading-snug`}>{desc}</p>
      </div>
    </div>
  );
}

// KPI Header Card ──────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, accent, onClick, active }: {
  label: string; value: string | number; sub?: string;
  icon: any; accent: string; onClick?: () => void; active?: boolean;
}) {
  return (
    <button onClick={onClick}
      className={`flex flex-col gap-3 p-4 rounded-2xl border text-left w-full transition-all duration-200
        ${active ? 'border-transparent shadow-lg scale-[1.02]' : 'bg-white border-slate-100 hover:shadow-md hover:scale-[1.01]'}`}
      style={active ? { background: `linear-gradient(135deg, ${accent})` } : {}}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${active ? 'bg-white/20' : 'bg-slate-50'}`}>
        <Icon className="w-4 h-4" style={{ color: active ? '#fff' : accent.split(',')[0] }} />
      </div>
      <div>
        <p className={`text-2xl font-black leading-none ${active ? 'text-white' : 'text-slate-900'}`}>{value}</p>
        <p className={`text-[9px] font-black uppercase tracking-widest mt-1.5 ${active ? 'text-white/80' : 'text-slate-500'}`}>{label}</p>
        {sub && <p className={`text-[10px] mt-0.5 ${active ? 'text-white/70' : 'text-slate-400'}`}>{sub}</p>}
      </div>
    </button>
  );
}

// Chart Tooltip ────────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900/95 text-white px-3 py-2 rounded-xl shadow-xl text-xs border border-white/10">
      <p className="font-bold text-slate-300 mb-1 text-[10px] uppercase tracking-wider">{fmtAxisDate(label)}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center justify-between gap-4" style={{ color: p.color }}>
          <span className="text-slate-300">{p.name}</span>
          <span className="font-extrabold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

// ─── MAIN INNER COMPONENT ────────────────────────────────────────────────────

type TabId = 'users' | 'analytics' | 'companies' | 'routes';

// Fuse config for company search
const COMPANY_FUSE_OPTIONS = {
  keys: [
    { name: 'name',     weight: 0.5 },
    { name: 'email',    weight: 0.3 },
    { name: 'planType', weight: 0.1 },
    { name: 'status',   weight: 0.1 },
  ],
  threshold:          0.4,
  ignoreLocation:     true,
  minMatchCharLength: 1,
  includeScore:       true,
};

function InnerDashboard({ initialData, initialMeta, stats }: Props) {
  const { users, meta, loading, query, setQuery, refresh, next, prev, isFuzzyActive } = useChiefGrowth(initialData, initialMeta);
  const [activeTab, setActiveTab] = useState<TabId>('users');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [companyPage, setCompanyPage] = useState<number>(0);
  const [companySearch, setCompanySearch] = useState<string>('');

  // Smart growth alerts
  const alerts = useMemo(() => {
    const out: Array<{ type: 'warning' | 'info' | 'success'; title: string; desc: string }> = [];
    if (stats.cancellationRate > 15)
      out.push({ type: 'warning', title: 'High Cancellation Rate', desc: `${stats.cancellationRate}% of bookings cancelled — review operator reliability.` });
    if (stats.userGrowthPct > 10)
      out.push({ type: 'success', title: 'Strong User Acquisition', desc: `+${stats.userGrowthPct}% new signups this month. Momentum is building!` });
    if (stats.conversionRate < 60)
      out.push({ type: 'info', title: 'Booking Conversion Opportunity', desc: `Only ${stats.conversionRate}% of bookings are confirmed. Streamline checkout.` });
    if (stats.newUsersThisMonth > stats.newUsersLastMonth)
      out.push({ type: 'success', title: 'Accelerating Growth', desc: `${stats.newUsersThisMonth} signups this month vs ${stats.newUsersLastMonth} last month.` });
    if (out.length === 0)
      out.push({ type: 'success', title: 'Platform Healthy', desc: 'All user engagement metrics are tracking well.' });
    return out.slice(0, 3);
  }, [stats]);

  // Booking status breakdown for pie
  const bookingPie = useMemo(() => [
    { name: 'Confirmed', value: stats.confirmedBookings, color: '#10b981' },
    { name: 'Pending',   value: stats.pendingBookings,   color: '#f59e0b' },
    { name: 'Cancelled', value: stats.cancelledBookings, color: '#ef4444' },
  ].filter(d => d.value > 0), [stats]);

  // Users filtered by role (fuzzy search is already applied by the hook)
  const filteredUsers = useMemo(() =>
    roleFilter === 'all' ? users : users.filter((u: any) => u.role === roleFilter),
    [users, roleFilter]);

  // Fuse index for company search
  const companyFuse = useMemo(() => new Fuse(stats.companies, COMPANY_FUSE_OPTIONS), [stats.companies]);

  // Companies fuzzy-filtered + paginated
  const filteredCompanies = useMemo(() => {
    const q = companySearch.trim();
    if (!q) return stats.companies;
    return companyFuse.search(q).map(r => r.item);
  }, [stats.companies, companySearch, companyFuse]);

  const isCompanyFuzzyActive = companySearch.trim().length > 0;
  const totalCompanyPages = Math.ceil(filteredCompanies.length / COMPANY_PAGE_SIZE);
  const paginatedCompanies = useMemo(() => {
    const start = companyPage * COMPANY_PAGE_SIZE;
    return filteredCompanies.slice(start, start + COMPANY_PAGE_SIZE);
  }, [filteredCompanies, companyPage]);

  // Booking breakdown pie colours
  const maxRouteBookings = Math.max(...stats.topRoutes.map(r => r.bookings), 1);

  // Role breakdown for user analytics pie
  const rolePie = useMemo(() => [
    { name: 'Customers',    value: stats.customerCount,                    color: '#6366f1' },
    { name: 'Company Staff',value: stats.crewCount,                        color: '#06b6d4' },
    { name: 'Other',        value: Math.max(0, stats.totalUsers - stats.customerCount - stats.crewCount), color: '#f59e0b' },
  ].filter(d => d.value > 0), [stats]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

      {/* ══ SUMMARY KPIs ════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total Users" value={fmtNum(stats.totalUsers)}
          sub={`${stats.customerCount} customers`} icon={Users}
          accent="#6366f1, #818cf8" active={activeTab === 'users'} onClick={() => setActiveTab('users')} />
        <KpiCard label="Engagement" value={`${stats.conversionRate}%`}
          sub="Booking conversion rate" icon={TrendingUp}
          accent="#059669, #34d399" active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} />
        <KpiCard label="Partner Companies" value={stats.companyCount}
          sub={`${stats.activeBuses} active buses`} icon={Building2}
          accent="#7c3aed, #a78bfa" active={activeTab === 'companies'} onClick={() => setActiveTab('companies')} />
        <KpiCard label="Active Routes" value={stats.activeRoutes}
          sub={`${stats.completedTrips} trips done`} icon={Map}
          accent="#db2777, #f472b6" active={activeTab === 'routes'} onClick={() => setActiveTab('routes')} />
      </div>

      {/* ══ NAVIGATION TABS ══════════════════════════════════════════════════ */}
      <div className="border-b border-slate-200 flex flex-wrap gap-0">
        {[
          { id: 'users',     label: 'Users & Fleet',         icon: Users },
          { id: 'analytics', label: 'Engagement & Signups',  icon: BarChart3 },
          { id: 'companies', label: 'Partner Companies',     icon: Building2 },
          { id: 'routes',    label: 'Route Activity',        icon: Map },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as TabId)}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-bold transition-all duration-150
              ${activeTab === t.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200'
              }`}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 1 — USERS & FLEET
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* MAIN: User Directory Table */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
            {/* Table header */}
            <div className="p-5 border-b border-slate-50 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
              <SectionHeader title="Registered Users" sub="All platform accounts — search, filter by role, paginate" icon={Users} />
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    className="pl-9 pr-4 py-1.5 text-xs bg-slate-50 rounded-xl border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-200 placeholder:text-slate-400 w-44"
                    placeholder="Search name or email…"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                  />
                </div>
                <div className="relative">
                  <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
                    className="appearance-none pl-3 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-100 rounded-xl focus:outline-none text-slate-600 font-medium cursor-pointer">
                    <option value="all">All Roles</option>
                    {Object.entries(ROLE_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                </div>
                <button onClick={() => refresh()} className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-400">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Table body */}
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-xs">
                <thead className="bg-slate-50/75 border-b border-slate-100">
                  <tr>
                    {['Name', 'Email', 'Role', 'Company', 'Joined'].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-[10px] font-black uppercase tracking-widest text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="border-b border-slate-50">
                        {[...Array(5)].map((_, j) => (
                          <td key={j} className="py-3 px-4"><div className="h-3 bg-slate-100 rounded animate-pulse w-3/4" /></td>
                        ))}
                      </tr>
                    ))
                    : filteredUsers.length === 0
                      ? <tr><td colSpan={5} className="py-14 text-center text-slate-400 text-xs">No users match your filters</td></tr>
                      : filteredUsers.map((u: any) => (
                        <tr key={u.id} className="border-b border-slate-50 hover:bg-indigo-50/20 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black shrink-0"
                                style={{ background: ROLE_META[u.role]?.color || '#94a3b8' }}>
                                {(u.firstName?.[0] || u.email?.[0] || '?').toUpperCase()}
                              </div>
                              <span className="font-bold text-slate-800 truncate max-w-[100px]">{u.firstName} {u.lastName}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-500 max-w-[160px] truncate">{u.email}</td>
                          <td className="py-3 px-4"><RoleBadge role={u.role} /></td>
                          <td className="py-3 px-4 text-slate-400 max-w-[100px] truncate">{u.companyId || '—'}</td>
                          <td className="py-3 px-4 text-slate-400">{u.createdAt ? fmtDate(new Date(u.createdAt).toISOString()) : '—'}</td>
                        </tr>
                      ))
                  }
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-slate-50/30">
              <p className="text-[10px] font-bold text-slate-400">{filteredUsers.length} of {stats.totalUsers} accounts</p>
              <div className="flex gap-2">
                <button onClick={() => prev()} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 font-bold transition-colors">
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>
                <button onClick={() => next()} disabled={!meta.nextCursor}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 font-bold disabled:opacity-40 transition-colors">
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* SIDE: Alerts + Signup stream + Fleet summary */}
          <div className="space-y-5">

            {/* Growth alerts */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-3">
              <SectionHeader title="Growth Signals" sub="Automated insights from your data" icon={Sparkles} />
              {alerts.map((a, i) => <AlertCard key={i} {...a} />)}
            </div>

            {/* New this month vs last */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
              <SectionHeader title="Acquisition Pulse" sub="New registrations comparison" icon={UserPlus} />
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 bg-indigo-50 rounded-2xl text-center">
                  <p className="text-2xl font-black text-indigo-700">+{stats.newUsersThisMonth}</p>
                  <p className="text-[9px] text-indigo-400 font-black uppercase mt-1">This Month</p>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-2xl text-center">
                  <p className="text-2xl font-black text-slate-600">+{stats.newUsersLastMonth}</p>
                  <p className="text-[9px] text-slate-400 font-black uppercase mt-1">Last Month</p>
                </div>
              </div>
              <div className="space-y-2.5 pt-1">
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-500 font-bold">Customers</span>
                    <span className="font-black text-indigo-600">{Math.round((stats.customerCount / Math.max(stats.totalUsers, 1)) * 100)}%</span>
                  </div>
                  <ProgressBar pct={(stats.customerCount / Math.max(stats.totalUsers, 1)) * 100} color="#6366f1" />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-500 font-bold">Crew / Staff</span>
                    <span className="font-black text-cyan-600">{Math.round((stats.crewCount / Math.max(stats.totalUsers, 1)) * 100)}%</span>
                  </div>
                  <ProgressBar pct={(stats.crewCount / Math.max(stats.totalUsers, 1)) * 100} color="#06b6d4" />
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-50">
                  <GrowthChip pct={stats.userGrowthPct} />
                  <span className="text-[10px] font-bold text-slate-400">{stats.totalUsers} total accounts</span>
                </div>
              </div>
            </div>

            {/* Recent signups */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-3">
              <SectionHeader title="Latest Registrations" sub="Newest accounts on platform" icon={Bell} />
              {stats.recentSignups.slice(0, 5).map(u => (
                <div key={u.id} className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0"
                    style={{ background: ROLE_META[u.role]?.color || '#94a3b8' }}>
                    {(u.firstName?.[0] || u.email[0]).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800 truncate leading-tight">{u.firstName} {u.lastName}</p>
                    <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <RoleBadge role={u.role} />
                    <span className="text-[9px] text-slate-400">{fmtDate(u.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Fleet snapshot */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
              <SectionHeader title="Fleet Snapshot" sub="Operational assets across all partners" icon={Bus} />
              <div className="grid grid-cols-2 gap-3 mt-4">
                {[
                  { label: 'Active Buses',     value: stats.activeBuses,     color: '#6366f1' },
                  { label: 'Active Routes',    value: stats.activeRoutes,    color: '#10b981' },
                  { label: 'Live Schedules',   value: stats.activeSchedules, color: '#06b6d4' },
                  { label: 'Trips Completed',  value: stats.completedTrips,  color: '#f59e0b' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="p-3.5 bg-slate-50 rounded-2xl">
                    <p className="text-xl font-black" style={{ color }}>{fmtNum(value)}</p>
                    <p className="text-[9px] text-slate-400 font-black uppercase mt-1 leading-snug">{label}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2 — ENGAGEMENT & SIGNUPS (no revenue)
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">

          {/* Row 1: Signup trend + Role distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Area chart: daily signups */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
              <SectionHeader title="Daily Signups — Last 30 Days" sub="Customer vs staff account registrations" icon={TrendingUp} />
              <div className="flex items-center gap-4 mt-4 mb-1">
                <span className="flex items-center gap-1.5 text-[11px] text-slate-500 font-bold">
                  <span className="w-3 h-2 rounded-sm bg-indigo-500 inline-block" /> Customers
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-slate-500 font-bold">
                  <span className="w-3 h-2 rounded-sm bg-cyan-500 inline-block" /> Staff / Crew
                </span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={stats.trendData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gCust" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gStaff" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#06b6d4" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tickFormatter={fmtAxisDate} tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={6} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="customers" name="Customers" stroke="#6366f1" strokeWidth={2.5} fill="url(#gCust)" dot={false} />
                  <Area type="monotone" dataKey="staff"     name="Staff"     stroke="#06b6d4" strokeWidth={2.5} fill="url(#gStaff)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Role distribution pie */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex flex-col">
              <SectionHeader title="User Composition" sub="Breakdown of account types" icon={Users} />
              <div className="flex items-center justify-center mt-4">
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={rolePie} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                      {rolePie.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: any, n: any) => [`${v} accounts`, n]} contentStyle={{ borderRadius: 10, fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2.5 mt-3">
                {rolePie.map((d, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="flex items-center gap-1.5 text-slate-500 font-bold">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: d.color }} />{d.name}
                      </span>
                      <span className="font-black text-slate-800">{d.value}</span>
                    </div>
                    <ProgressBar pct={(d.value / Math.max(stats.totalUsers, 1)) * 100} color={d.color} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: Total signups bar + Booking engagement */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Total daily signups bar chart */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
              <SectionHeader title="Total Daily Registrations" sub="Combined new accounts per day" icon={UserPlus} />
              <ResponsiveContainer width="100%" height={180} className="mt-4">
                <BarChart data={stats.trendData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={fmtAxisDate} tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={6} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="users" name="New Signups" fill="#6366f1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Booking engagement (count only, no revenue) */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex flex-col justify-between">
              <SectionHeader title="Booking Engagement" sub="Platform booking activity" icon={Activity} />
              <div className="space-y-3 mt-5">
                {[
                  { label: 'Total Bookings',   value: stats.totalBookings,     color: '#6366f1' },
                  { label: 'This Month',        value: stats.bookingsThisMonth, color: '#10b981' },
                  { label: 'Confirmed',         value: stats.confirmedBookings, color: '#10b981' },
                  { label: 'Pending Review',    value: stats.pendingBookings,   color: '#f59e0b' },
                  { label: 'Cancelled',         value: stats.cancelledBookings, color: '#ef4444' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-bold">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                      {label}
                    </div>
                    <span className="text-xs font-black text-slate-800">{fmtNum(value)}</span>
                  </div>
                ))}
              </div>
              <div className="pt-4 mt-4 border-t border-slate-50">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-bold">Booking MoM</span>
                  <GrowthChip pct={stats.bookingGrowthPct} />
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Booking funnel donut + Engagement timeline */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Total daily bookings trend (no revenue) */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
              <SectionHeader title="Booking Activity Trend" sub="Daily booking volumes — last 30 days" icon={Clock} />
              <ResponsiveContainer width="100%" height={180} className="mt-4">
                <AreaChart data={stats.trendData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gBook" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tickFormatter={fmtAxisDate} tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={6} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="bookings" name="Bookings" stroke="#10b981" strokeWidth={2.5} fill="url(#gBook)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Booking status donut */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
              <SectionHeader title="Booking Status Breakdown" sub="Confirmed vs pending vs cancelled" icon={CheckCircle2} />
              <div className="flex items-center gap-4 mt-4">
                <ResponsiveContainer width={140} height={140}>
                  <PieChart>
                    <Pie data={bookingPie} cx="50%" cy="50%" innerRadius={38} outerRadius={62} paddingAngle={3} dataKey="value">
                      {bookingPie.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: any, n: any) => [`${v} bookings`, n]} contentStyle={{ borderRadius: 10, fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2.5">
                  {bookingPie.map(d => (
                    <div key={d.name}>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="flex items-center gap-1.5 text-slate-500 font-bold">
                          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: d.color }} />{d.name}
                        </span>
                        <span className="font-black" style={{ color: d.color }}>{d.value}</span>
                      </div>
                      <ProgressBar pct={(d.value / Math.max(stats.totalBookings, 1)) * 100} color={d.color} />
                    </div>
                  ))}
                  <div className="pt-2 border-t border-slate-50 flex justify-between text-[10px]">
                    <span className="text-slate-400 font-bold">Conversion rate</span>
                    <span className="font-black text-emerald-600">{stats.conversionRate}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 3 — PARTNER COMPANIES (table + pagination)
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'companies' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

          {/* Header + search */}
          <div className="p-5 border-b border-slate-50 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
            <SectionHeader title="Partner Companies" sub={`${stats.companyCount} registered bus operators`} icon={Building2} />
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                className="pl-9 pr-4 py-1.5 text-xs bg-slate-50 rounded-xl border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-200 placeholder:text-slate-400 w-52"
                placeholder="Search company name or email…"
                value={companySearch}
                onChange={e => { setCompanySearch(e.target.value); setCompanyPage(0); }}
              />
            </div>
          </div>

          {/* Companies table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50/75 border-b border-slate-100">
                <tr>
                  {['Company', 'Email', 'Plan', 'Bookings', 'Buses', 'Routes', 'Crew', 'Status', 'Joined'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedCompanies.length === 0 ? (
                  <tr><td colSpan={9} className="py-14 text-center text-slate-400">No companies found</td></tr>
                ) : (
                  paginatedCompanies.map(c => (
                    <tr key={c.id} className="border-b border-slate-50 hover:bg-indigo-50/20 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-xs font-black shrink-0">
                            {c.name[0]?.toUpperCase()}
                          </div>
                          <span className="font-bold text-slate-800 truncate max-w-[120px]">{c.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-500 max-w-[150px] truncate">{c.email}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-violet-50 text-violet-600 capitalize">{c.planType}</span>
                      </td>
                      <td className="py-3 px-4 font-black text-indigo-600 text-center">{c.bookingsCount}</td>
                      <td className="py-3 px-4 font-bold text-slate-700 text-center">{c.busesCount}</td>
                      <td className="py-3 px-4 font-bold text-slate-700 text-center">{c.routesCount}</td>
                      <td className="py-3 px-4 font-bold text-slate-700 text-center">{c.operatorsCount}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                          c.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                        }`}>{c.status}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap">{fmtDate(c.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-slate-50/30">
            <p className="text-[10px] font-bold text-slate-400">
              Showing {Math.min(companyPage * COMPANY_PAGE_SIZE + 1, filteredCompanies.length)}–{Math.min((companyPage + 1) * COMPANY_PAGE_SIZE, filteredCompanies.length)} of {filteredCompanies.length} companies
            </p>
            <div className="flex items-center gap-3">
              {/* Page number buttons */}
              <div className="flex gap-1">
                {Array.from({ length: totalCompanyPages }).map((_, i) => (
                  <button key={i} onClick={() => setCompanyPage(i)}
                    className={`w-7 h-7 text-xs rounded-lg font-bold transition-all ${
                      companyPage === i
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}>
                    {i + 1}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => setCompanyPage(p => Math.max(0, p - 1))} disabled={companyPage === 0}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 font-bold disabled:opacity-40">
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>
                <button onClick={() => setCompanyPage(p => Math.min(totalCompanyPages - 1, p + 1))} disabled={companyPage >= totalCompanyPages - 1}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 font-bold disabled:opacity-40">
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 4 — ROUTE ACTIVITY (bookings only, no revenue)
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'routes' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <SectionHeader title="Route Traffic — Last 30 Days" sub="Booking volumes per route (no revenue data)" icon={Map} />
            {stats.topRoutes.length === 0 ? (
              <div className="py-16 text-center text-slate-400">No route booking data found for this period.</div>
            ) : (
              <div className="mt-5">
                <div className="grid grid-cols-3 text-[10px] font-black uppercase tracking-widest text-slate-400 pb-2 border-b border-slate-100 px-2">
                  <span className="col-span-2">Route</span>
                  <span className="text-right">Bookings</span>
                </div>
                {stats.topRoutes.map((r, i) => (
                  <div key={i} className="grid grid-cols-3 items-center py-4 border-b border-slate-50 last:border-0 px-2 hover:bg-slate-50/50 transition-colors">
                    <div className="col-span-2 flex items-center gap-3">
                      <div className="w-7 h-7 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0"
                        style={{ background: ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b'][i] }}>
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 truncate">{r.route}</p>
                        <div className="mt-1.5 w-full max-w-[200px]">
                          <ProgressBar pct={(r.bookings / maxRouteBookings) * 100} color={['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b'][i]} />
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-slate-900">{r.bookings}</p>
                      <p className="text-[9px] text-slate-400">bookings</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Booking activity per route as bar chart */}
          {stats.topRoutes.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
              <SectionHeader title="Route Booking Volume Chart" sub="Visual comparison of route engagement" icon={BarChart3} />
              <ResponsiveContainer width="100%" height={210} className="mt-4">
                <BarChart data={stats.topRoutes} margin={{ top: 5, right: 10, left: -20, bottom: 35 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="route" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} angle={-20} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip formatter={(v: any) => [`${v} bookings`, 'Volume']} contentStyle={{ borderRadius: 12, fontSize: 11 }} />
                  <Bar dataKey="bookings" name="Bookings" radius={[5, 5, 0, 0]}>
                    {stats.topRoutes.map((_, i) => (
                      <Cell key={i} fill={['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b'][i]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      <div className="text-center pt-2 pb-4">
        <p className="text-[10px] text-slate-300 font-medium">Growth Command Centre · Engagement-focused · No revenue metrics displayed</p>
      </div>

    </div>
  );
}

// ─── PROVIDER WRAPPER ─────────────────────────────────────────────────────────

export default function DashboardClient(props: Props) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <InnerDashboard {...props} />
    </QueryClientProvider>
  );
}
