'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  BusIcon, List, Calendar, Search, ChevronLeft, ChevronRight,
  CheckCircle, X, Eye, Loader2, Clock, AlertCircle
} from 'lucide-react';
import Fuse from 'fuse.js';

type Tab = 'overview' | 'schedules' | 'bookings' | 'routes' | 'buses';

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

export default function ChiefOfOperationsPage() {
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
      const res = await fetch('/api/admin/coo/payment-stats');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('COO stats fetch error', err);
    } finally {
      setLoading(false);
    }
  }, []);

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

  useEffect(() => {
    setPage(1);
    fetchList(activeTab);
  }, [activeTab, fetchList]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900">Chief of Operations</h1>
          <p className="text-sm text-gray-500 mt-1">Platform-wide operations dashboard.</p>
        </div>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 rounded-full text-sm font-semibold text-indigo-700">
          <BusIcon className="w-5 h-5" /> Operational Hub
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
          {(['overview', 'bookings', 'schedules', 'routes', 'buses'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setPage(1); }}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                activeTab === tab
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
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
                        <span className="text-sm font-medium text-gray-700 truncate">{c.companyId}</span>
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
            </div>
          )}

          {/* Bookings Table */}
          {activeTab === 'bookings' && (
            <div>
              {dataLoading ? (
                <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" /></div>
              ) : paginatedData.length === 0 ? (
                <div className="text-center py-12 text-gray-500"><AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" /><p>No bookings found</p></div>
              ) : (
                <>
                  <div className="overflow-x-auto border border-gray-100 rounded-xl">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="px-6 py-3 text-left font-bold text-gray-700">Reference</th>
                          <th className="px-6 py-3 text-left font-bold text-gray-700">Company</th>
                          <th className="px-6 py-3 text-left font-bold text-gray-700">Amount</th>
                          <th className="px-6 py-3 text-left font-bold text-gray-700">Status</th>
                          <th className="px-6 py-3 text-left font-bold text-gray-700">Payment</th>
                          <th className="px-6 py-3 text-left font-bold text-gray-700">Date</th>
                          <th className="px-6 py-3 text-center font-bold text-gray-700">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {paginatedData.map((b: any) => (
                          <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-3 font-bold text-gray-900">{b.bookingReference}</td>
                            <td className="px-6 py-3 text-gray-700">{b.companyId}</td>
                            <td className="px-6 py-3 font-bold text-gray-900">MWK {b.totalAmount?.toLocaleString() ?? 0}</td>
                            <td className="px-6 py-3"><StatusBadge status={b.bookingStatus || 'unknown'} /></td>
                            <td className="px-6 py-3"><StatusBadge status={b.paymentStatus || 'unknown'} /></td>
                            <td className="px-6 py-3 text-gray-600 text-xs">{new Date(b.createdAt).toLocaleDateString()}</td>
                            <td className="px-6 py-3 text-center"><button className="text-indigo-600 hover:text-indigo-700"><Eye className="w-4 h-4" /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination page={page} totalPages={totalPages} onPageChange={setPage} total={filteredData.length} />
                </>
              )}
            </div>
          )}

          {/* Schedules Table */}
          {activeTab === 'schedules' && (
            <div>
              {dataLoading ? (
                <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" /></div>
              ) : paginatedData.length === 0 ? (
                <div className="text-center py-12 text-gray-500"><AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" /><p>No schedules found</p></div>
              ) : (
                <>
                  <div className="overflow-x-auto border border-gray-100 rounded-xl">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="px-6 py-3 text-left font-bold text-gray-700">Schedule ID</th>
                          <th className="px-6 py-3 text-left font-bold text-gray-700">Route</th>
                          <th className="px-6 py-3 text-left font-bold text-gray-700">Departure</th>
                          <th className="px-6 py-3 text-left font-bold text-gray-700">Status</th>
                          <th className="px-6 py-3 text-center font-bold text-gray-700">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {paginatedData.map((s: any) => (
                          <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-3 font-bold text-gray-900">{s.id?.substring(0, 8)}</td>
                            <td className="px-6 py-3 text-gray-700">{s.routeId?.substring(0, 12)}</td>
                            <td className="px-6 py-3 text-gray-600">{s.departureDateTime ? new Date(s.departureDateTime).toLocaleString() : '—'}</td>
                            <td className="px-6 py-3"><StatusBadge status={s.status || 'unknown'} /></td>
                            <td className="px-6 py-3 text-center"><button className="text-indigo-600 hover:text-indigo-700"><Eye className="w-4 h-4" /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination page={page} totalPages={totalPages} onPageChange={setPage} total={filteredData.length} />
                </>
              )}
            </div>
          )}

          {/* Routes Table */}
          {activeTab === 'routes' && (
            <div>
              {dataLoading ? (
                <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" /></div>
              ) : paginatedData.length === 0 ? (
                <div className="text-center py-12 text-gray-500"><AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" /><p>No routes found</p></div>
              ) : (
                <>
                  <div className="overflow-x-auto border border-gray-100 rounded-xl">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="px-6 py-3 text-left font-bold text-gray-700">Route Name</th>
                          <th className="px-6 py-3 text-left font-bold text-gray-700">Origin</th>
                          <th className="px-6 py-3 text-left font-bold text-gray-700">Destination</th>
                          <th className="px-6 py-3 text-left font-bold text-gray-700">Company</th>
                          <th className="px-6 py-3 text-center font-bold text-gray-700">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {paginatedData.map((r: any) => (
                          <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-3 font-bold text-gray-900">{r.name}</td>
                            <td className="px-6 py-3 text-gray-700">{r.origin}</td>
                            <td className="px-6 py-3 text-gray-700">{r.destination}</td>
                            <td className="px-6 py-3 text-gray-700">{r.companyId}</td>
                            <td className="px-6 py-3 text-center"><button className="text-indigo-600 hover:text-indigo-700"><Eye className="w-4 h-4" /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination page={page} totalPages={totalPages} onPageChange={setPage} total={filteredData.length} />
                </>
              )}
            </div>
          )}

          {/* Buses Table */}
          {activeTab === 'buses' && (
            <div>
              {dataLoading ? (
                <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" /></div>
              ) : paginatedData.length === 0 ? (
                <div className="text-center py-12 text-gray-500"><AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" /><p>No buses found</p></div>
              ) : (
                <>
                  <div className="overflow-x-auto border border-gray-100 rounded-xl">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="px-6 py-3 text-left font-bold text-gray-700">Registration</th>
                          <th className="px-6 py-3 text-left font-bold text-gray-700">Company</th>
                          <th className="px-6 py-3 text-left font-bold text-gray-700">Seats</th>
                          <th className="px-6 py-3 text-left font-bold text-gray-700">Status</th>
                          <th className="px-6 py-3 text-center font-bold text-gray-700">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {paginatedData.map((b: any) => (
                          <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-3 font-bold text-gray-900">{b.registration}</td>
                            <td className="px-6 py-3 text-gray-700">{b.companyId}</td>
                            <td className="px-6 py-3 text-gray-700">{b.seatCount ?? '—'}</td>
                            <td className="px-6 py-3"><StatusBadge status={b.isActive ? 'active' : 'inactive'} /></td>
                            <td className="px-6 py-3 text-center"><button className="text-indigo-600 hover:text-indigo-700"><Eye className="w-4 h-4" /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination page={page} totalPages={totalPages} onPageChange={setPage} total={filteredData.length} />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
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

