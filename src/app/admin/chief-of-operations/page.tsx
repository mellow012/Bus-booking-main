'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  BusIcon, List, Calendar, Search, ChevronLeft, ChevronRight,
  CheckCircle, X, Eye, Loader2, Clock, AlertCircle
} from 'lucide-react';
import RegionsTab from '@/components/coo/RegionsTab';
import BookingsTab from '@/components/coo/BookingsTab';
import RoutesTab from '@/components/coo/RoutesTab';
import SchedulesTab from '@/components/coo/SchedulesTab';
import BusesTab from '@/components/coo/BusesTab';
import PaymentsTab from '@/components/coo/PaymentsTab';
import Breadcrumbs from '@/components/coo/Breadcrumbs';
import useFilterStore from '@/lib/stores/filterStore';
import Fuse from 'fuse.js';
import { NotificationBell } from '@/contexts/NotificationContext';


type Tab = 'overview' | 'regions' | 'routes' | 'schedules' | 'buses' | 'bookings' | 'payments';

const ITEMS_PER_PAGE = 10;

// Status badge component
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const lower = status?.toLowerCase() || 'unknown';
  const config: Record<string, { bg: string; text: string }> = {
    confirmed: { bg: 'bg-green-100', text: 'text-green-800' },
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
    completed: { bg: 'bg-blue-100', text: 'text-blue-800' },
    cancelled: { bg: 'bg-red-100', text: 'text-red-800' },
    active: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
    inactive: { bg: 'bg-gray-100', text: 'text-gray-800' },
    'no-show': { bg: 'bg-orange-100', text: 'text-orange-800' },
    paid: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
    unpaid: { bg: 'bg-slate-100', text: 'text-slate-800' },
  };
  const cfg = config[lower] || { bg: 'bg-gray-100', text: 'text-gray-800' };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${cfg.bg} ${cfg.text}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

function ChiefOfOperationsPageContent() {
  const router = useRouter();
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [dataLoading, setDataLoading] = useState(false);

  // Pagination & search state
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCompany, setFilterCompany] = useState('all');

  // Table data
  const [bookings, setBookings] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [buses, setBuses] = useState<any[]>([]);

  // Fuzzy search setup
  const fuse = useMemo(() => {
    const data = activeTab === 'bookings' ? bookings
      : activeTab === 'schedules' ? schedules
      : activeTab === 'routes' ? routes
      : activeTab === 'buses' ? buses
      : [];
    return new Fuse(data, {
      keys: activeTab === 'bookings' ? ['bookingReference', 'companyId']
        : activeTab === 'schedules' ? ['id', 'routeId', 'companyId']
        : activeTab === 'routes' ? ['name', 'origin', 'destination']
        : activeTab === 'buses' ? ['registration', 'companyId']
        : [],
      threshold: 0.4,
      ignoreLocation: true,
    });
  }, [activeTab, bookings, schedules, routes, buses]);

  // Filtered and paginated data
  const filteredData = useMemo(() => {
    let data = activeTab === 'bookings' ? bookings
      : activeTab === 'schedules' ? schedules
      : activeTab === 'routes' ? routes
      : activeTab === 'buses' ? buses
      : [];

    // Apply search
    if (searchQuery.trim()) {
      const results = fuse.search(searchQuery);
      data = results.map(r => r.item);
    }

    // Apply filters
    if (filterStatus !== 'all' && activeTab === 'bookings') {
      data = data.filter((b: any) => b.bookingStatus === filterStatus);
    }
    if (filterStatus !== 'all' && activeTab === 'schedules') {
      data = data.filter((s: any) => s.status === filterStatus);
    }
    if (filterCompany !== 'all') {
      data = data.filter((item: any) => item.companyId === filterCompany);
    }

    return data;
  }, [searchQuery, filterStatus, filterCompany, activeTab, bookings, schedules, routes, buses, fuse]);

  // Pagination
  const paginatedData = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredData.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredData, page]);

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const s = useFilterStore.getState();
      const url = new URL('/api/admin/coo/payment-stats', window.location.origin);
      if (s.companyId) url.searchParams.set('companyId', s.companyId);
      if (s.regionId) url.searchParams.set('regionId', s.regionId);
      if (s.routeId) url.searchParams.set('routeId', s.routeId);
      if (s.scheduleId) url.searchParams.set('scheduleId', s.scheduleId);
      if (s.dateRange?.from) url.searchParams.set('from', s.dateRange.from);
      if (s.dateRange?.to) url.searchParams.set('to', s.dateRange.to);
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('COO stats fetch error', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch stats when filters change
  useEffect(() => {
    const unsub = useFilterStore.subscribe(() => fetchStats());
    return () => unsub();
  }, [fetchStats]);

  const fetchList = useCallback(async (tab: Tab) => {
    setDataLoading(true);
    try {
      if (tab === 'bookings') {
        const r = await fetch('/api/admin/coo/bookings?limit=500');
        if (r.ok) {
          const data = await r.json();
          setBookings(Array.isArray(data) ? data : data.bookings || []);
        }
      }
      if (tab === 'schedules') {
        const r = await fetch('/api/admin/coo/schedules?limit=500');
        if (r.ok) {
          const data = await r.json();
          setSchedules(Array.isArray(data) ? data : data.schedules || []);
        }
      }
      if (tab === 'routes') {
        const r = await fetch('/api/admin/coo/routes?limit=500');
        if (r.ok) {
          const data = await r.json();
          setRoutes(Array.isArray(data) ? data : data.routes || []);
        }
      }
      if (tab === 'buses') {
        const r = await fetch('/api/admin/coo/buses?limit=500');
        if (r.ok) {
          const data = await r.json();
          setBuses(Array.isArray(data) ? data : data.buses || []);
        }
      }
    } catch (err) {
      console.error('COO list fetch error', err);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!userProfile) return;
    if (!(userProfile.role === 'chief_of_operations' || userProfile.role === 'superadmin')) {
      router.push('/unauthorized');
      return;
    }
    fetchStats();
  }, [userProfile, fetchStats, router]);

  // Sync URL search params -> Zustand on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const regionId = params.get('regionId');
    const routeId = params.get('routeId');
    const scheduleId = params.get('scheduleId');
    const bookingId = params.get('bookingId');
    const companyId = params.get('companyId');
    const from = params.get('from');
    const to = params.get('to');

    const s = useFilterStore.getState();
    if (regionId) s.setRegion(regionId);
    if (routeId) s.setRoute(routeId);
    if (scheduleId) s.setSchedule(scheduleId);
    if (bookingId) s.setBooking({ id: bookingId, scheduleId, routeId, companyId, regionId });
    if (companyId) s.setCompany(companyId);
    if (from || to) s.setDateRange({ from, to });
  }, []);

  // Subscribe to filter store changes and update URL search params
  useEffect(() => {
    const unsub = useFilterStore.subscribe((state) => {
      const params = new URLSearchParams(window.location.search);
      if (state.regionId) params.set('regionId', state.regionId);
      else params.delete('regionId');
      if (state.routeId) params.set('routeId', state.routeId);
      else params.delete('routeId');
      if (state.scheduleId) params.set('scheduleId', state.scheduleId);
      else params.delete('scheduleId');
      if (state.bookingId) params.set('bookingId', state.bookingId);
      else params.delete('bookingId');
      if (state.companyId) params.set('companyId', state.companyId);
      else params.delete('companyId');
      if (state.dateRange?.from) params.set('from', state.dateRange.from);
      else params.delete('from');
      if (state.dateRange?.to) params.set('to', state.dateRange.to);
      else params.delete('to');

      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, '', newUrl);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    setPage(1);
    fetchList(activeTab);
  }, [activeTab, fetchList]);

  const { dateRange, setDateRange } = useFilterStore();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900">Chief of Operations</h1>
          <p className="text-sm text-gray-500 mt-1">Platform-wide operations dashboard.</p>
        </div>
        <div className="flex items-center gap-4">
          {userProfile?.id && (
            <NotificationBell userId={userProfile.id} className="relative" />
          )}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 rounded-full text-sm font-semibold text-indigo-700">
            <BusIcon className="w-5 h-5" /> Operational Hub
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Bookings', value: stats?.bookingAgg?._count?.id ?? '—', color: 'text-blue-600' },
          { label: 'Booking Value', value: `MWK ${stats?.bookingAgg?._sum?.totalAmount?.toLocaleString() ?? '—'}`, color: 'text-emerald-600' },
          { label: 'Total Payments', value: stats?.paymentAgg?._count?.id ?? '—', color: 'text-purple-600' },
          { label: 'Payment Value', value: `MWK ${stats?.paymentAgg?._sum?.amount?.toLocaleString() ?? '—'}`, color: 'text-orange-600' },
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-xs uppercase tracking-widest text-gray-400 font-bold">{card.label}</p>
            <p className={`mt-4 text-3xl font-black ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs Container */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Tab buttons */}
        <div className="border-b border-gray-100 px-6 py-4 flex gap-2 flex-wrap">
          {(['overview', 'regions', 'routes', 'schedules', 'buses', 'bookings', 'payments'] as Tab[]).map(tab => {
            const badge = tab === 'bookings' ? (stats?.pendingBookings ?? 0)
              : tab === 'payments' ? (stats?.pendingPayments ?? 0)
              : 0;
            return (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setPage(1); }}
                className={`relative px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                  activeTab === tab
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {badge > 0 && (
                  <span className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-black px-1 ${
                    activeTab === tab ? 'bg-white text-indigo-600' : 'bg-red-500 text-white'
                  } animate-pulse shadow`}>
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-xl border border-gray-100 p-4 bg-gray-50">
                <h4 className="font-bold text-gray-900 mb-4">Top Companies by Value</h4>
                {stats?.byCompany?.length ? (
                  <div className="space-y-2">
                    {stats.byCompany.slice(0, 8).map((c: any, i: number) => (
                      <div key={c.companyId || i} className="flex items-center justify-between p-3 bg-white rounded-lg">
                        <span className="text-sm font-medium text-gray-700 truncate">{c.companyName ?? c.companyId}</span>
                        <span className="text-sm font-black text-emerald-600">MWK {c._sum?.totalAmount?.toLocaleString() ?? 0}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-gray-500">No data</p>}
              </div>

              <div className="rounded-xl border border-gray-100 p-4 bg-gray-50">
                <h4 className="font-bold text-gray-900 mb-4">Quick Stats</h4>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Active Schedules', value: stats?.scheduleCount ?? '—' },
                    { label: 'Active Routes', value: stats?.routesCount ?? '—' },
                    { label: 'Total Buses', value: stats?.busesCount ?? '—' },
                    { label: 'Paid Bookings', value: stats?.paymentAgg?._count?.id ?? '—' },
                  ].map((stat, i) => (
                    <div key={i} className="bg-white rounded-lg p-3">
                      <p className="text-xs text-gray-500 font-bold mb-1">{stat.label}</p>
                      <p className="text-2xl font-black text-gray-900">{stat.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Search & Filters (for non-overview tabs) */}
          {activeTab !== 'overview' && (
            <div className="mb-6 flex gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[250px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder={`Search ${activeTab}...`}
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Status filter */}
              {(activeTab === 'bookings' || activeTab === 'schedules') && (
                <select
                  value={filterStatus}
                  onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                  className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                >
                  <option value="all">All Status</option>
                  {activeTab === 'bookings' && (
                    <>
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </>
                  )}
                  {activeTab === 'schedules' && (
                    <>
                      <option value="active">Active</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </>
                  )}
                </select>
              )}

              {/* Date range */}
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateRange?.from ?? ''}
                  onChange={(e) => setDateRange({ from: e.target.value || null, to: dateRange?.to ?? null })}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
                <input
                  type="date"
                  value={dateRange?.to ?? ''}
                  onChange={(e) => setDateRange({ from: dateRange?.from ?? null, to: e.target.value || null })}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
                <button onClick={() => setDateRange({ from: null, to: null })} className="px-3 py-2 bg-gray-50 rounded-lg text-sm">Clear dates</button>
              </div>
            </div>
          )}

          {/* Breadcrumb + Clear filters */}
          <div className="mb-4 flex items-center justify-between">
            <Breadcrumbs />
            <div>
              <button onClick={() => useFilterStore.getState().clearAll()} className="px-3 py-2 bg-gray-50 rounded-lg text-sm">Clear filters</button>
            </div>
          </div>

          {/* Regions tab (hierarchical root) */}
          {activeTab === 'regions' && (
            <div>
              <RegionsTab companyId={filterCompany !== 'all' ? filterCompany : undefined} />
            </div>
          )}

          {/* Bookings tab (now delegated to component) */}
          {activeTab === 'bookings' && (
            <div>
              <BookingsTab companyId={filterCompany !== 'all' ? filterCompany : undefined} />
            </div>
          )}

          {/* Schedules Table */}
          {activeTab === 'schedules' && (
            <div>
              <SchedulesTab companyId={filterCompany !== 'all' ? filterCompany : undefined} />
            </div>
          )}

          {/* Routes Table */}
          {activeTab === 'routes' && (
            <div>
              <RoutesTab companyId={filterCompany !== 'all' ? filterCompany : undefined} />
            </div>
          )}

          {/* Buses Table */}
          {activeTab === 'buses' && (
            <div>
              <BusesTab companyId={filterCompany !== 'all' ? filterCompany : undefined} />
            </div>
          )}

          {/* Payments tab */}
          {activeTab === 'payments' && (
            <div>
              <PaymentsTab companyId={filterCompany !== 'all' ? filterCompany : undefined} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ChiefOfOperationsPage() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ChiefOfOperationsPageContent />
    </QueryClientProvider>
  );
}

// Pagination component
function Pagination({ page, totalPages, onPageChange, total }: { page: number; totalPages: number; onPageChange: (p: number) => void; total: number }) {
  return (
    <div className="mt-4 flex items-center justify-between">
      <p className="text-sm text-gray-600">
        Showing <span className="font-bold">{Math.min((page - 1) * ITEMS_PER_PAGE + 1, total)}</span>–<span className="font-bold">{Math.min(page * ITEMS_PER_PAGE, total)}</span> of <span className="font-bold">{total}</span> results
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="px-4 py-2 text-sm font-bold text-gray-700">
          Page {page} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages || totalPages === 0}
          className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

