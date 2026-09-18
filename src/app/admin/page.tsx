'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import * as dbActions from '@/lib/actions/db.actions';
import {
  Loader2,
  Plus,
  Edit,
  Trash,
  Building2,
  CheckCircle,
  Clock,
  Ban,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  X,
  Search,
  SortAsc,
  ChevronDown,
  Shield,
  LogOut,
  SortDesc,
  Eye,
  BarChart3,
  List,
  User,
  DollarSign,
  Calendar,
  Map as MapIcon,
  Download,
  Phone,
  Mail,
  MessageSquare,
  CreditCard,
  Smartphone,
  Wifi,
  WifiOff,
  Save,
  RefreshCw,
  BusIcon,
  MapPin,
  UserCheck,
  Layers,
  TrendingUp,
  Activity,
  User2,
  TicketPercent,
  Zap,
  Gift,
  Menu,
} from 'lucide-react';
import Image from 'next/image';
import AlertMessage from '@/components/AlertMessage';
import AdminPayments from '@/components/AdminPayments';
import { Company, UserProfile, Booking, Schedule, Route, Bus, OperatorProfile, ConductorProfile, Promotion, AuditLog, AuditAction } from '@/types/index';
import TabButton from '@/components/tabButton';
import CreateCompanyModal from '@/components/modals/CreateCompanyModal';
import DashboardBottomNav from "@/components/DashboardBottomNav";
import AdminSidebar from '@/components/AdminSidebar';
import { NotificationBell } from '@/contexts/NotificationContext';


// ─── Small UI components & constants restored for composability ───────────
const KineticStatCard: React.FC<{
  title: string; value: string | number; icon: any; iconBg: string; iconColor: string; badge?: { text: string; className: string }; subtitle?: string;
  onClick?: () => void; tooltipTitle?: string;
}> = ({ title, value, icon: Icon, iconBg, iconColor, badge, subtitle, onClick, tooltipTitle }) => {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      {...(onClick ? { onClick, type: 'button' as const, title: tooltipTitle } : {})}
      className={`bg-white rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] p-5 relative overflow-hidden flex flex-col justify-between min-h-[140px] border border-gray-100 transition-all hover:shadow-md group text-left w-full${
        onClick ? ' cursor-pointer hover:border-indigo-200 hover:ring-2 hover:ring-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400' : ''
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <div className={`p-2 rounded-lg ${iconBg} group-hover:scale-110 transition-transform`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        {badge && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded shadow-sm ${badge.className}`}>
            {badge.text}
          </span>
        )}
      </div>
      <div className="mt-auto">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">{title}</p>
        <p className="text-2xl font-extrabold text-gray-900 leading-none">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-1.5 font-medium">{subtitle}</p>}
      </div>
    </Wrapper>
  );
};

const StatusBadge: React.FC<{ status: string; type?: 'booking' | 'company' }> = ({ status, type = 'company' }) => {
  const lower = status?.toLowerCase() || 'unknown';
  let color = 'bg-gray-100 text-gray-800';
  let Icon: React.FC<{ className?: string }> = AlertCircle;

  if (type === 'company') {
    if (lower === 'unclaimed') { color = 'bg-slate-100 text-slate-700 border-slate-200'; Icon = AlertCircle; }
    if (lower === 'active') { color = 'bg-green-100 text-green-800 border-green-200'; Icon = CheckCircle; }
    if (lower === 'pending') { color = 'bg-yellow-100 text-yellow-800 border-yellow-200'; Icon = Clock; }
    if (lower === 'inactive') { color = 'bg-red-100 text-red-800 border-red-200'; Icon = Ban; }
  } else {
    if (lower === 'confirmed') { color = 'bg-green-100 text-green-800'; Icon = CheckCircle; }
    if (lower === 'pending') { color = 'bg-yellow-100 text-yellow-800'; Icon = Clock; }
    if (lower === 'completed') { color = 'bg-blue-100 text-blue-800'; Icon = CheckCircle; }
    if (lower === 'cancelled') { color = 'bg-red-100 text-red-800'; Icon = Ban; }
    if (lower === 'no-show') { color = 'bg-orange-100 text-orange-800'; Icon = AlertCircle; }
  }

  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${color}`}>
      <Icon className="w-3 h-3" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

// ─── Types & Constants ─────────────────────────────────────────────────────
type StatusFilter = 'all' | 'active' | 'inactive' | 'pending';
type SortBy = 'name' | 'createdAt' | 'status' | 'email';
type SortOrder = 'asc' | 'desc';
type TabType = 'overview' | 'companies' | 'users' | 'payments' | 'audit' | 'health' | 'profile' | 'bookings' | 'routes' | 'schedules' | 'promotions';

interface AlertState { type: 'error' | 'success' | 'warning' | 'info'; message: string; id: string; }
interface FormErrors { name?: string; email?: string; contact?: string; adminPhone?: string; adminFirstName?: string; adminLastName?: string; }
interface LoadingStates { companies: boolean; bookings: boolean; promotions: boolean; creating: boolean; updating: boolean; deleting: boolean; initializing: boolean; }

interface DashboardStats {
  totalCompanies: number;
  activeCompanies: number;
  pendingCompanies: number;
  inactiveCompanies: number;
  companyStatusCounts?: { active: number; pending: number; inactive: number; claimed: number; total: number };
  totalRevenue: number;
  monthlyRevenue: number;
  totalBookings: number;
  monthlyBookings: number;
  bookingPaymentCounts: { paid: number; pending: number; failed: number; paidRevenue: number };
}

interface HealthStatus { status: 'ok' | 'degraded' | 'unhealthy'; checks: Record<string, 'ok' | 'degraded' | 'error'>; timestamp: string; }

interface CreateCompanyRequest { name: string; email: string; contact: string; status: Company['status']; address?: string; description?: string; adminFirstName?: string; adminLastName?: string; adminPhone?: string; }

const COMPANIES_PER_PAGE = 10;
const BOOKINGS_PER_PAGE = 10;
const USERS_PER_PAGE = 12;

const isLiveRoute = (route: Route) => route.status === 'active' && route.isActive;
const isLiveSchedule = (schedule: Schedule) =>
  schedule.status === 'active' && schedule.isActive && !schedule.isArchived && !schedule.isCompleted && !schedule.completed;

const STATUS_CONFIG = {
  active: { color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
  pending: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock },
  inactive: { color: 'bg-red-100 text-red-800 border-red-200', icon: Ban },
} as const;

const STATUS_STYLES = {
  active: { bg: 'bg-green-100', text: 'text-green-800', icon: <CheckCircle className="w-3 h-3" /> },
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: <Clock className="w-3 h-3" /> },
  inactive: { bg: 'bg-red-100', text: 'text-red-800', icon: <Ban className="w-3 h-3" /> },
} as const;

const convertTimestamp = (value: Date | string | number | { toDate?: () => Date }): Date | null => {
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && typeof value.toDate === 'function') return value.toDate();
  const date = new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? null : date;
};

const validateEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const validatePhone = (value: string) => /^\+?[\d\s()-]{7,20}$/.test(value);


const formatDate = (date: Date | string | number | undefined | null): string => {
  if (!date) return '—';
  const d = convertTimestamp(date);
  if (!d) return 'Invalid date';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(d);
};

const fmt = (date: Date | string | number | undefined | null) => formatDate(date);

const debounce = <T extends (...args: unknown[]) => void>(func: T, wait: number) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

const fuzzyMatch = (text: string, query: string): boolean => {
  const normalized = text.toLowerCase();
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return terms.every(term => {
    let index = 0;
    for (const char of term) {
      index = normalized.indexOf(char, index);
      if (index === -1) return false;
      index += 1;
    }
    return true;
  });
};

// ─── BookingsTab ──────────────────────────────────────────────────────────────
const BookingsTab: React.FC<{
  bookings: Booking[]; companies: Company[]; schedules: Schedule[]; routes: Route[];
  loading: boolean; setError: (msg: string) => void; setSuccess: (msg: string) => void;
}> = ({ bookings, companies, schedules, routes, loading, setError, setSuccess }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<Booking['bookingStatus'] | 'all'>('all');

  const filteredBookings = useMemo(() => bookings.filter(booking => {
    const company = companies.find(c => c.id === booking.companyId);
    const matchesSearch = !searchTerm ||
      company?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.bookingReference.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || booking.bookingStatus === statusFilter;
    return matchesSearch && matchesStatus;
  }), [bookings, companies, searchTerm, statusFilter]);

  const paginationData = useMemo(() => {
    const totalItems = filteredBookings.length;
    const totalPages = Math.ceil(totalItems / BOOKINGS_PER_PAGE);
    const indexOfLastBooking = currentPage * BOOKINGS_PER_PAGE;
    const indexOfFirstBooking = indexOfLastBooking - BOOKINGS_PER_PAGE;
    return {
      currentBookings: filteredBookings.slice(indexOfFirstBooking, indexOfLastBooking),
      totalPages, totalItems,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1,
      startIndex: totalItems > 0 ? indexOfFirstBooking + 1 : 0,
      endIndex: Math.min(indexOfLastBooking, totalItems),
    };
  }, [filteredBookings, currentPage]);

  const exportBookingsData = () => {
    try {
      const rows = filteredBookings.map(b => {
        const company = companies.find(c => c.id === b.companyId);
        const schedule = schedules.find(s => s.id === b.scheduleId);
        const route = schedule ? routes.find(r => r.id === schedule.routeId) : undefined;
        return [
          b.bookingReference,
          company?.name || 'Unknown',
          route ? `${route.origin} → ${route.destination}` : 'Unknown',
          b.bookingStatus,
          `MWK ${b.totalAmount.toLocaleString()}`,
          formatDate(b.createdAt),
        ].join(',');
      }).join('\n');
      const blob = new Blob(['Booking Reference,Company,Route,Status,Amount,Date\n' + rows], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: 'bookings-data.csv' });
      a.click(); URL.revokeObjectURL(url);
      setSuccess('Bookings data exported successfully!');
    } catch { setError('Failed to export bookings data'); }
  };

  if (loading) return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="h-11 flex-1 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-11 w-32 bg-gray-100 rounded-xl animate-pulse" />
      </div>

      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((row) => (
          <div key={row} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm animate-pulse">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-2 flex-1">
                <div className="h-4 w-28 bg-gray-200 rounded" />
                <div className="h-3 w-48 bg-gray-100 rounded" />
              </div>
              <div className="flex gap-2">
                <div className="h-8 w-16 bg-gray-100 rounded-lg" />
                <div className="h-8 w-20 bg-gray-100 rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input type="text" placeholder="Search bookings..." value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as Booking['bookingStatus'] | 'all')}
          className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500">
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no-show">No Show</option>
        </select>
        <button onClick={exportBookingsData}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      {/* Table */}
      {paginationData.totalItems === 0 ? (
        <div className="text-center py-12">
          <List className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No bookings found</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto bg-white rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-gray-100 mb-4">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {['Booking Ref', 'Company', 'Route', 'Passenger', 'Amount', 'Status', 'Date'].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginationData.currentBookings.map(booking => {
                  const company = companies.find(c => c.id === booking.companyId);
                  const schedule = schedules.find(s => s.id === booking.scheduleId);
                  const route = schedule ? routes.find(r => r.id === schedule.routeId) : undefined;
                  const primary = booking.passengerDetails?.[0];
                  return (
                    <tr key={booking.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{booking.bookingReference}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{company?.name || 'Unknown'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{route ? `${route.origin} → ${route.destination}` : 'Unknown Route'}</div>
                        <div className="text-xs text-gray-500">Seats: {booking.seatNumbers.join(', ')}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{primary?.name || 'Unknown'}</div>
                        <div className="text-xs text-gray-500">{booking.passengerDetails.length} passenger(s)</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">MWK {booking.totalAmount.toLocaleString()}</div>
                        <div className="text-xs text-gray-500">Payment: {booking.paymentStatus}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={booking.bookingStatus} type="booking" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(booking.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-700">
              Showing {paginationData.startIndex} to {paginationData.endIndex} of {paginationData.totalItems} results
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={!paginationData.hasPrevPage}
                className="p-2 border rounded-lg disabled:opacity-50 hover:bg-gray-50"><ChevronLeft className="w-5 h-5" /></button>
              <span className="text-sm">Page {currentPage} of {paginationData.totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(p + 1, paginationData.totalPages))} disabled={!paginationData.hasNextPage}
                className="p-2 border rounded-lg disabled:opacity-50 hover:bg-gray-50"><ChevronRight className="w-5 h-5" /></button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ─── COO Tab (Minimal scaffold) ─────────────────────────────────────────────
const COOTab: React.FC<{ setActiveTab: (t: TabType) => void }> = ({ setActiveTab }) => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);

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

  useEffect(() => { fetchStats(); }, [fetchStats]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-black text-gray-900">Chief of Operations</h3>
          <p className="text-[10px] text-gray-400 mt-1">Overview and cross-company operational controls.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setActiveTab('bookings')} className="rounded-2xl bg-brand-700 px-4 py-2 text-xs font-semibold text-white">Manage Bookings</button>
          <button onClick={() => setActiveTab('schedules')} className="rounded-2xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700">Manage Schedules</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-widest text-gray-400">Total bookings</p>
          <p className="mt-3 text-2xl font-black text-gray-900">{stats?.bookingAgg?._count?.id ?? '—'}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-widest text-gray-400">Total booking value</p>
          <p className="mt-3 text-2xl font-black text-emerald-700">MWK {stats?.bookingAgg?._sum?.totalAmount ?? '—'}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-widest text-gray-400">Total payments</p>
          <p className="mt-3 text-2xl font-black text-gray-900">{stats?.paymentAgg?._count?.id ?? '—'}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-widest text-gray-400">Payments value</p>
          <p className="mt-3 text-2xl font-black text-emerald-700">MWK {stats?.paymentAgg?._sum?.amount ?? '—'}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border shadow-sm p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-2">By company</h4>
        {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
          <div className="text-xs text-gray-600">
            {stats?.byCompany?.length ? (
              stats.byCompany.slice(0, 10).map((c: any) => (
                <div key={c.companyId} className="flex items-center justify-between py-2 border-b last:border-b-0">
                  <div className="text-sm">{c.companyId}</div>
                  <div className="text-sm font-black">MWK {c._sum?.totalAmount ?? 0}</div>
                </div>
              ))
            ) : <p className="text-sm text-gray-400">No data</p>}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── PromotionsTab ────────────────────────────────────────────────────────────
const PromotionsTab: React.FC<{
  promotions: Promotion[];
  loading: boolean;
  onRefresh: () => void;
  setError: (msg: string) => void;
  setSuccess: (msg: string) => void;
}> = ({ promotions, loading, onRefresh, setError, setSuccess }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Partial<Promotion> | null>(null);

  const resetForm = () => {
    setEditingPromotion({
      code: '',
      title: '',
      description: '',
      discountValue: 0,
      discountType: 'percentage',
      minPurchase: 0,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isActive: true,
    });
  };

  const handleAdd = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleEdit = (promo: Promotion) => {
    setEditingPromotion(promo);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this promotion?')) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/promotions?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSuccess('Promotion deleted successfully');
        onRefresh();
      } else {
        throw new Error('Failed to delete promotion');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSave = async () => {
    if (!editingPromotion?.code || !editingPromotion?.title) {
      setError('Code and Title are required');
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingPromotion),
      });
      if (res.ok) {
        setSuccess(editingPromotion.id ? 'Promotion updated' : 'Promotion created');
        setIsModalOpen(false);
        onRefresh();
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save promotion');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (promo: Promotion) => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...promo, isActive: !promo.isActive }),
      });
      if (res.ok) {
        setSuccess(`Promotion ${promo.isActive ? 'deactivated' : 'activated'}`);
        onRefresh();
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Failed to toggle promotion status');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Platform Promotions</h3>
          <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Manage system-wide discount codes</p>
        </div>
        <button onClick={handleAdd} className="flex items-center gap-2 bg-brand-700 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-brand-800 transition-colors shadow-lg">
          <Plus className="w-4 h-4" /> Create Promotion
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {promotions.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
            <TicketPercent className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">No promotions found</p>
          </div>
        ) : promotions.map(promo => (
          <div key={promo.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${promo.isActive ? 'from-green-500/10 to-emerald-500/5' : 'from-gray-500/10 to-slate-500/5'} -mr-8 -mt-8 rounded-full blur-xl`} />

            <div className="flex justify-between items-start mb-4 relative">
              <div className={`p-2.5 rounded-xl ${promo.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                <TicketPercent className="w-5 h-5" />
              </div>
              <div className="flex gap-1">
                <button onClick={() => handleToggleStatus(promo)} title={promo.isActive ? "Deactivate" : "Activate"} className={`p-1.5 rounded-lg transition-colors ${promo.isActive ? 'text-amber-600 bg-amber-50' : 'text-green-600 bg-green-50'}`}>
                  {promo.isActive ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                </button>
                <button onClick={() => handleEdit(promo)} title="Edit" className="p-1.5 text-blue-600 bg-blue-50 rounded-lg transition-colors">
                  <Edit className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(promo.id)} title="Delete" className="p-1.5 text-red-600 bg-red-50 rounded-lg transition-colors">
                  <Trash className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="relative">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-black text-gray-900 uppercase tracking-tight">{promo.code}</h4>
                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${promo.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {promo.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-xs font-bold text-indigo-600 mb-2">{promo.title}</p>
              <p className="text-[11px] text-gray-500 line-clamp-2 mb-4 h-8">{promo.description}</p>

              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-50">
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Discount</p>
                  <p className="text-sm font-black text-gray-900">
                    {promo.discountType === 'percentage' ? `${promo.discountValue}%` : `MWK ${promo.discountValue.toLocaleString()}`}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Valid Until</p>
                  <p className="text-sm font-black text-gray-900">{formatDate(promo.endDate)}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Promotion Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-8 py-6 bg-gray-50 border-b flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight">{editingPromotion?.id ? 'Edit Promotion' : 'New Promotion'}</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Configure discount parameters</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-8 space-y-5 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Promo Code</label>
                  <input type="text" value={editingPromotion?.code} onChange={e => setEditingPromotion(p => ({ ...p!, code: e.target.value.toUpperCase() }))}
                    placeholder="E.G. WELCOME20" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-black uppercase tracking-wider focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Status</label>
                  <select value={editingPromotion?.isActive ? 'true' : 'false'} onChange={e => setEditingPromotion(p => ({ ...p!, isActive: e.target.value === 'true' }))}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all">
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Title</label>
                <input type="text" value={editingPromotion?.title} onChange={e => setEditingPromotion(p => ({ ...p!, title: e.target.value }))}
                  placeholder="Welcome Discount" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all" />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Description</label>
                <textarea value={editingPromotion?.description} onChange={e => setEditingPromotion(p => ({ ...p!, description: e.target.value }))}
                  rows={2} placeholder="Get 20% off on your first booking..." className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Discount Type</label>
                  <select value={editingPromotion?.discountType} onChange={e => setEditingPromotion(p => ({ ...p!, discountType: e.target.value as any }))}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all">
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed (MWK)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Value</label>
                  <input type="number" value={editingPromotion?.discountValue} onChange={e => setEditingPromotion(p => ({ ...p!, discountValue: Number(e.target.value) }))}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-black focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Min Purchase (MWK)</label>
                  <input type="number" value={editingPromotion?.minPurchase || 0} onChange={e => setEditingPromotion(p => ({ ...p!, minPurchase: Number(e.target.value) }))}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-black focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Max Discount (MWK)</label>
                  <input type="number" value={editingPromotion?.maxDiscount || 0} onChange={e => setEditingPromotion(p => ({ ...p!, maxDiscount: Number(e.target.value) }))}
                    placeholder="No Limit" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-black focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Start Date</label>
                  <input type="date" value={editingPromotion?.startDate ? new Date(editingPromotion.startDate).toISOString().split('T')[0] : ''}
                    onChange={e => setEditingPromotion(p => ({ ...p!, startDate: new Date(e.target.value) }))}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">End Date</label>
                  <input type="date" value={editingPromotion?.endDate ? new Date(editingPromotion.endDate).toISOString().split('T')[0] : ''}
                    onChange={e => setEditingPromotion(p => ({ ...p!, endDate: new Date(e.target.value) }))}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all" />
                </div>
              </div>
            </div>

            <div className="px-8 py-6 bg-gray-50 border-t flex gap-3 justify-end">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-gray-700 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={isSaving} className="bg-brand-700 text-white px-8 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-brand-100 hover:bg-brand-800 transition-all disabled:opacity-50 flex items-center gap-2">
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingPromotion?.id ? 'Update Promotion' : 'Create Promotion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatPill: React.FC<{ icon: React.ReactNode; label: string; value: number | string; color: string }> = ({
  icon, label, value, color,
}) => (
  <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] bg-white">
    <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>{icon}</div>
    <div>
      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider leading-none mb-1.5">{label}</p>
      <p className="text-base font-bold text-gray-900 leading-none">{value}</p>
    </div>
  </div>
);

const SectionHeading: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
  <div className="flex items-center gap-2 mb-3">
    <div className="text-gray-400">{icon}</div>
    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{label}</h4>
  </div>
);

// ── main component ────────────────────────────────────────────────────────────
interface ProfileTabProps {
  companies: Company[];
  bookings: Booking[];
  schedules: Schedule[];
  routes: Route[];
  buses?: Bus[];
  operators?: (OperatorProfile | ConductorProfile)[];
  selectedCompanyId: string | null;
  onStatusChange: (companyId: string, status: Company['status']) => void;
  onDelete: (companyId: string) => void;
}

const ProfileTab: React.FC<ProfileTabProps> = ({
  companies, bookings, schedules, routes, buses = [], operators = [], selectedCompanyId, onStatusChange, onDelete,
}) => {
  const [selected, setSelected] = useState<Company | null>(null);
  const [search, setSearch] = useState('');
  const [expandedKpi, setExpandedKpi] = useState<'bookings' | 'buses' | 'operators' | 'routes' | null>(null);
  const [kpiPage, setKpiPage] = useState(1);

  const ITEMS_PER_PAGE = 5;

  const handleKpiToggle = (kpi: 'bookings' | 'buses' | 'operators' | 'routes') => {
    if (expandedKpi === kpi) {
      setExpandedKpi(null);
    } else {
      setExpandedKpi(kpi);
      setKpiPage(1);
    }
  };

  const renderPagination = (total: number) => {
    if (total <= ITEMS_PER_PAGE) return null;
    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
    return (
      <div className="flex justify-between items-center pt-2 mt-2 border-t border-gray-100">
        <button 
          disabled={kpiPage === 1} 
          onClick={() => setKpiPage(p => Math.max(1, p - 1))}
          className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50 transition-colors"
        >
          Previous
        </button>
        <span className="text-xs text-gray-500 font-medium">Page {kpiPage} of {totalPages}</span>
        <button 
          disabled={kpiPage >= totalPages} 
          onClick={() => setKpiPage(p => p + 1)}
          className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50 transition-colors"
        >
          Next
        </button>
      </div>
    );
  };

  useEffect(() => {
    if (!selectedCompanyId) {
      setSelected(null);
      return;
    }

    const company = companies.find(item => item.id === selectedCompanyId) ?? null;
    setSelected(company);
  }, [companies, selectedCompanyId]);

  useEffect(() => {
    if (!selected) return;
    const updated = companies.find(company => company.id === selected.id);
    if (updated && updated !== selected) setSelected(updated);
  }, [companies, selected]);

  const filtered = useMemo(() =>
    companies.filter(c =>
      !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase())
    ), [companies, search]);

  // ── derived stats for selected company ────────────────────────────────────
  const stats = useMemo(() => {
    if (!selected) return null;
    const id = selected.id;

    const companyBookings = bookings.filter(b => b.companyId === id);
    const companySchedules = schedules.filter(s => s.companyId === id);
    const companyRoutes = routes.filter(r => r.companyId === id);
    const companyBuses = buses.filter(b => b.companyId === id);
    const companyOperators = operators.filter(o => o.companyId === id);

    const totalRevenue = companyBookings
      .filter(b => b.bookingStatus !== 'cancelled')
      .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

    const confirmedBookings = companyBookings.filter(b => b.bookingStatus === 'confirmed').length;
    const pendingBookings = companyBookings.filter(b => b.bookingStatus === 'pending').length;
    const cancelledBookings = companyBookings.filter(b => b.bookingStatus === 'cancelled').length;
    const completedBookings = companyBookings.filter(b => b.bookingStatus === 'completed').length;

    const activeSchedules = companySchedules.filter(s => s.status === 'active').length;
    const activeRoutes = companyRoutes.filter(r => r.status === 'active').length;
    const activeBuses = companyBuses.filter(b => b.status === 'active').length;

    return {
      totalRevenue, totalBookings: companyBookings.length,
      confirmedBookings, pendingBookings, cancelledBookings, completedBookings,
      totalSchedules: companySchedules.length, activeSchedules,
      totalRoutes: companyRoutes.length, activeRoutes,
      totalBuses: companyBuses.length, activeBuses,
      totalOperators: companyOperators.length,
      companyRoutes,
      companyBuses,
      companyOperators,
      confirmedBookingsList: companyBookings.filter(b => b.bookingStatus === 'confirmed'),
    };
  }, [selected, bookings, schedules, routes, buses, operators]);

  const statusStyle = selected ? STATUS_STYLES[selected.status] ?? STATUS_STYLES.inactive : null;

  return (
    <div className="flex gap-0 h-[75vh] -m-6 overflow-hidden rounded-xl">

      {/* ── LEFT: company list ─────────────────────────────────────────────── */}
      <div className="w-72 shrink-0 border-r flex flex-col bg-gray-50">
        <div className="px-4 py-3 border-b bg-white">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Companies</p>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text" placeholder="Search..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400">
              <Building2 className="w-6 h-6 mb-1" />
              <p className="text-xs">No companies found</p>
            </div>
          ) : filtered.map(company => {
            const s = STATUS_STYLES[company.status] ?? STATUS_STYLES.inactive;
            const isSelected = selected?.id === company.id;
            return (
              <button key={company.id} onClick={() => setSelected(company)}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 transition-colors flex items-center gap-3 group
                  ${isSelected ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : 'hover:bg-white'}`}>
                {company.logo
                  ? <Image src={company.logo} alt={company.name} width={32} height={32} className="w-8 h-8 rounded-lg object-cover shrink-0" />
                  : <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-indigo-500" />
                  </div>}
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-semibold truncate ${isSelected ? 'text-indigo-700' : 'text-gray-800'}`}>
                    {company.name}
                  </p>
                  <div className={`inline-flex items-center gap-1 mt-0.5 text-xs font-medium ${s.text}`}>
                    {s.icon}
                    <span className="capitalize">{company.status}</span>
                  </div>
                </div>
                <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-opacity ${isSelected ? 'text-indigo-400 opacity-100' : 'text-gray-300 opacity-0 group-hover:opacity-100'}`} />
              </button>
            );
          })}
        </div>

        <div className="px-4 py-2 border-t bg-white">
          <p className="text-xs text-gray-400">{filtered.length} of {companies.length} companies</p>
        </div>
      </div>

      {/* ── RIGHT: company detail ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-white">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
              <Building2 className="w-8 h-8 text-indigo-300" />
            </div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Select a company</p>
            <p className="text-xs text-gray-400">Choose a company from the list to view its full profile and stats.</p>
          </div>
        ) : (
          <div className="p-6 space-y-6">

            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-gray-100">
              <div className="flex items-center gap-5">
                {selected.logo
                  ? <Image src={selected.logo} alt={selected.name} width={64} height={64} className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-md" />
                  : <div className="w-16 h-16 rounded-2xl bg-indigo-900 flex items-center justify-center shadow-lg shadow-indigo-100">
                    <Building2 className="w-8 h-8 text-white" />
                  </div>}
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">{selected.name}</h2>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm ${statusStyle?.bg} ${statusStyle?.text}`}>
                      {selected.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 truncate max-w-md">
                    {selected.email && (
                      <span className="flex items-center gap-1.5 text-xs font-bold text-gray-400">
                        <Mail className="w-3.5 h-3.5" />{selected.email}
                      </span>
                    )}
                    {selected.contact && (
                      <span className="flex items-center gap-1.5 text-xs font-bold text-gray-400">
                        <Phone className="w-3.5 h-3.5" />{selected.contact}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {selected.status === 'active' && (
                  <button type="button" onClick={() => onStatusChange(selected.id, 'inactive')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-[11px] font-black uppercase tracking-wider rounded-xl border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100">
                    <Ban className="w-3.5 h-3.5" /> Deactivate
                  </button>
                )}
                {selected.status === 'inactive' && (
                  <button type="button" onClick={() => onStatusChange(selected.id, 'active')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-[11px] font-black uppercase tracking-wider rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                    <CheckCircle className="w-3.5 h-3.5" /> Reactivate
                  </button>
                )}
                <button type="button" onClick={() => onDelete(selected.id)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-[11px] font-black uppercase tracking-wider rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100">
                  <Trash className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>

            {/* ── Key Performance Indicators ── */}
            {stats && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <KineticStatCard
                    title="Confirmed booking value"
                    value={`MWK ${stats.totalRevenue.toLocaleString()}`}
                    icon={DollarSign}
                    iconBg="bg-blue-50" iconColor="text-blue-600"
                    subtitle={`${stats.confirmedBookings} confirmed bookings`}
                    onClick={() => handleKpiToggle('bookings')}
                    tooltipTitle="View confirmed bookings"
                  />
                  <KineticStatCard
                    title="Fleet Status"
                    value={stats.activeBuses}
                    icon={BusIcon}
                    iconBg="bg-green-50" iconColor="text-green-600"
                    subtitle={`${stats.totalBuses} registered buses`}
                    onClick={() => handleKpiToggle('buses')}
                    tooltipTitle="View fleet status"
                  />
                  <KineticStatCard
                    title="Team Strength"
                    value={stats.totalOperators}
                    icon={User2}
                    iconBg="bg-indigo-50" iconColor="text-indigo-600"
                    subtitle="Active operators/conductors"
                    onClick={() => handleKpiToggle('operators')}
                    tooltipTitle="View team members"
                  />
                  <KineticStatCard
                    title="Connectivity"
                    value={stats.activeRoutes}
                    icon={MapPin}
                    iconBg="bg-purple-50" iconColor="text-purple-600"
                    subtitle={`${stats.totalRoutes} route networks`}
                    onClick={() => handleKpiToggle('routes')}
                    tooltipTitle="View connectivity"
                  />
                </div>
                
                {/* ── KPI Detail Panel ── */}
                {expandedKpi && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex justify-between items-center mb-4">
                      <SectionHeading 
                        icon={
                          expandedKpi === 'bookings' ? <DollarSign className="w-5 h-5" /> : 
                          expandedKpi === 'buses' ? <BusIcon className="w-5 h-5" /> : 
                          expandedKpi === 'operators' ? <User2 className="w-5 h-5" /> : 
                          <MapPin className="w-5 h-5" />
                        } 
                        label={
                          expandedKpi === 'bookings' ? 'Confirmed Bookings' : 
                          expandedKpi === 'buses' ? 'Fleet Status' : 
                          expandedKpi === 'operators' ? 'Team Strength' : 
                          'Connectivity'
                        } 
                      />
                      <button onClick={() => setExpandedKpi(null)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    
                    {expandedKpi === 'bookings' && (
                      <div className="space-y-2">
                        {stats.confirmedBookingsList.length === 0 ? (
                          <p className="text-sm text-gray-500 italic">No confirmed bookings found.</p>
                        ) : (
                          <>
                            {stats.confirmedBookingsList.slice((kpiPage - 1) * ITEMS_PER_PAGE, kpiPage * ITEMS_PER_PAGE).map(b => (
                              <div key={b.id} className="flex items-center justify-between rounded-xl bg-gray-50 p-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">{b.passengerDetails?.[0]?.name || 'Anonymous'}</p>
                                  <p className="text-xs text-gray-400">{new Date(b.createdAt).toLocaleDateString()}</p>
                                </div>
                                <span className="text-sm font-bold text-gray-900">MWK {b.totalAmount?.toLocaleString() || 0}</span>
                              </div>
                            ))}
                            {renderPagination(stats.confirmedBookingsList.length)}
                          </>
                        )}
                      </div>
                    )}
                    
                    {expandedKpi === 'buses' && (
                      <div className="space-y-2">
                        {stats.companyBuses.length === 0 ? (
                          <p className="text-sm text-gray-500 italic">No registered buses found.</p>
                        ) : (
                          <>
                            {stats.companyBuses.slice((kpiPage - 1) * ITEMS_PER_PAGE, kpiPage * ITEMS_PER_PAGE).map(b => (
                              <div key={b.id} className="flex items-center justify-between rounded-xl bg-gray-50 p-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">{b.licensePlate}</p>
                                  <p className="text-xs text-gray-400">{b.capacity} seats</p>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${b.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>{b.status}</span>
                              </div>
                            ))}
                            {renderPagination(stats.companyBuses.length)}
                          </>
                        )}
                      </div>
                    )}

                    {expandedKpi === 'operators' && (
                      <div className="space-y-2">
                        {stats.companyOperators.length === 0 ? (
                          <p className="text-sm text-gray-500 italic">No team members found.</p>
                        ) : (
                          <>
                            {stats.companyOperators.slice((kpiPage - 1) * ITEMS_PER_PAGE, kpiPage * ITEMS_PER_PAGE).map(o => (
                              <div key={o.id} className="flex items-center justify-between rounded-xl bg-gray-50 p-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">{o.firstName} {o.lastName}</p>
                                  <p className="text-xs text-gray-400 capitalize">{o.role.replace('_', ' ')}</p>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${o.isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-600'}`}>{o.isActive ? 'active' : 'inactive'}</span>
                              </div>
                            ))}
                            {renderPagination(stats.companyOperators.length)}
                          </>
                        )}
                      </div>
                    )}

                    {expandedKpi === 'routes' && (
                      <div className="space-y-2">
                        {stats.companyRoutes.length === 0 ? (
                          <p className="text-sm text-gray-500 italic">No routes found.</p>
                        ) : (
                          <>
                            {stats.companyRoutes.slice((kpiPage - 1) * ITEMS_PER_PAGE, kpiPage * ITEMS_PER_PAGE).map(r => (
                              <div key={r.id} className="flex items-center justify-between rounded-xl bg-gray-50 p-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">{r.origin} → {r.destination}</p>
                                  <p className="text-xs text-gray-400">MWK {r.baseFare.toLocaleString()}</p>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${r.status === 'active' ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-600'}`}>{r.status}</span>
                              </div>
                            ))}
                            {renderPagination(stats.companyRoutes.length)}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <SectionHeading icon={<Mail className="w-5 h-5" />} label="Contact Information" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                {[
                  { label: 'Email', value: selected.email, icon: <Mail className="w-4 h-4" /> },
                  { label: 'Phone', value: selected.phone || selected.contact, icon: <Phone className="w-4 h-4" /> },
                  { label: 'Address', value: selected.address, icon: <MapPin className="w-4 h-4" /> },
                  { label: 'WhatsApp', value: (selected.contactSettings as any)?.whatsapp, icon: <MessageSquare className="w-4 h-4" /> },
                ].map(field => (
                  <div key={field.label} className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                    <span className="text-gray-500">{field.icon}</span>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400">{field.label}</p>
                      <p className={`text-sm font-medium truncate ${field.value ? 'text-gray-900' : 'text-gray-400 italic'}`}>{field.value || 'Not provided'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};


// ─── Main Component ───────────────────────────────────────────────────────────
export default function SuperAdminDashboard() {
  const router = useRouter();
  const { user, userProfile, signOut, loading: authLoading } = useAuth();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [schedulesTodayCount, setSchedulesTodayCount] = useState<number>(0);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [operators, setOperators] = useState<(OperatorProfile | ConductorProfile)[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalCompanies: 0, activeCompanies: 0, pendingCompanies: 0, inactiveCompanies: 0,
    totalRevenue: 0, monthlyRevenue: 0, totalBookings: 0, monthlyBookings: 0,
    bookingPaymentCounts: { paid: 0, pending: 0, failed: 0, paidRevenue: 0 },
  });

  const [refreshCount, setRefreshCount] = useState(0);
  const [isDashboardsOpen, setIsDashboardsOpen] = useState(false);
  const dashboardsRef = useRef<HTMLDivElement>(null);

  // Close Dashboards dropdown on outside click
  useEffect(() => {
    if (!isDashboardsOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dashboardsRef.current && !dashboardsRef.current.contains(e.target as Node)) {
        setIsDashboardsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDashboardsOpen]);

  const [loadingStates, setLoadingStates] = useState<LoadingStates>({
    companies: true, bookings: true, promotions: true, creating: false, updating: false, deleting: false, initializing: true,
  });

  const [alerts, setAlerts] = useState<AlertState[]>([]);
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const [searchTerm, setSearchTerm] = useState('');
  const [companyStatusFilter, setCompanyStatusFilter] = useState<'all' | 'active' | 'pending' | 'inactive'>('all');
  const [claimedOnly, setClaimedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [modals, setModals] = useState({
    add: false, edit: false, view: false, delete: null as string | null,
  });
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedPaymentCompany, setSelectedPaymentCompany] = useState<Company | null>(null);
  const [paymentCompanyQuery, setPaymentCompanyQuery] = useState('');
  const [paymentCompanyPage, setPaymentCompanyPage] = useState(1);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string>('');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('all');
  const [auditStatusFilter, setAuditStatusFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [auditCompanyFilter, setAuditCompanyFilter] = useState<string>('');
  const [auditStartDate, setAuditStartDate] = useState<string>('');
  const [auditEndDate, setAuditEndDate] = useState<string>('');
  const [auditSearchTerm, setAuditSearchTerm] = useState<string>('');
  const [auditLimit, setAuditLimit] = useState<number>(100);

  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState<string>('');

  const [formData, setFormData] = useState<CreateCompanyRequest>({
    name: '', email: '', contact: '', status: 'pending',
    address: '', description: '', adminFirstName: '', adminLastName: '', adminPhone: '',
  });

  // ── Unified Payment System State ───────────────────────────────────────────
  // Master PayChangu Configuration
  const [paymentEnvironment, setPaymentEnvironment] = useState<'test' | 'live'>('test');
  const [paymentConfigSaving, setPaymentConfigSaving] = useState(false);
  const [paymentConfigErrors, setPaymentConfigErrors] = useState<Record<string, string>>({});

  // Commission Rates Configuration
  const [paychanguFeePercent, setPaychanguFeePercent] = useState<number>(2.5); // What PayChangu takes
  const [companyFeePercent, setCompanyFeePercent] = useState<number>(80);      // What company gets
  // Platform fee is auto-calculated: 100 - paychanguFee - companyFee

  // Transactions & Reports
  const [transactions, setTransactions] = useState<any[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionFilter, setTransactionFilter] = useState<'all' | 'successful' | 'failed' | 'pending'>('all');
  const [transactionCompanyFilter, setTransactionCompanyFilter] = useState<string>('');
  const [showArchivedPayments, setShowArchivedPayments] = useState(false);
  const [showUnlinkedPayments, setShowUnlinkedPayments] = useState(false);
  const [transactionPage, setTransactionPage] = useState(1);

  // System Notification Preferences
  const [notificationPreferences, setNotificationPreferences] = useState({
    emailOnFailedTransaction: true,
    dailySettlementEmail: true,
    weeklyReportEmail: true,
    webhookEnabled: false,
    webhookUrl: '',
    notificationEmail: '',
  });

  const AUDIT_ACTIONS: AuditAction[] = [
    'create_schedule', 'update_schedule', 'delete_schedule', 'archive_schedule', 'create_booking', 'update_booking',
    'mark_boarded', 'mark_no_show', 'collect_payment', 'generate_report', 'update_payment_status', 'login', 'logout',
    'access_dashboard', 'export_data'
  ];
  const [notificationSaving, setNotificationSaving] = useState(false);

  const isAuthorized = useMemo(() => userProfile?.role === 'superadmin', [userProfile?.role]);

  // ── Alerts ─────────────────────────────────────────────────────────────────
  const showAlert = useCallback((type: AlertState['type'], message: string) => {
    const id = Date.now().toString();
    setAlerts((prev: AlertState[]) => [...prev, { type, message, id }]);
    if (type === 'success' || type === 'info') {
      setTimeout(() => setAlerts((prev: AlertState[]) => prev.filter(a => a.id !== id)), 5000);
    }
  }, []);

  // ── Users list + Role management helpers ─────────────────────────────────
  const [usersList, setUsersList] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userRoleGroupFilter, setUserRoleGroupFilter] = useState<'all' | 'company' | 'platform' | 'customer'>('all');
  const [usersPage, setUsersPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [selectedUserRole, setSelectedUserRole] = useState<string>('');
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [roleUpdating, setRoleUpdating] = useState(false);

  const ROLE_OPTIONS = ['super_admin','chief_of_growth','chief_of_operations','finance','company_admin','operator','conductor','customer'];
  const ROLE_LABELS: Record<string,string> = {
    super_admin: 'Super Admin', chief_of_growth: 'Chief of Growth', chief_of_operations: 'Chief of Operations',
    finance: 'Finance', company_admin: 'Company Admin', operator: 'Operator', conductor: 'Conductor', customer: 'Customer'
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await fetch('/api/admin/users?limit=200', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to fetch users');
      const json = await res.json();
      setUsersList(json?.data || []);
    } catch (e) {
      console.error('Failed to load users', e);
      showAlert('error', 'Failed to load users');
    } finally { setUsersLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const refreshUsers = () => fetchUsers();

  const fetchTransactions = async () => {
    setTransactionsLoading(true);
    try {
      const res = await fetch('/api/admin/payments?limit=200', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to fetch transactions');
      const json = await res.json();
      setTransactions(json?.data || []);
    } catch (e) {
      console.error('Failed to load transactions', e);
      showAlert('error', 'Failed to load transactions');
    } finally { setTransactionsLoading(false); }
  };

  useEffect(() => { fetchTransactions(); }, []);

  const fetchAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    setAuditError('');
    try {
      const params = new URLSearchParams();
      if (auditActionFilter !== 'all') params.set('action', auditActionFilter);
      if (auditStatusFilter !== 'all') params.set('status', auditStatusFilter);
      if (auditCompanyFilter) params.set('companyId', auditCompanyFilter);
      if (auditStartDate) params.set('startDate', auditStartDate);
      if (auditEndDate) params.set('endDate', auditEndDate);
      params.set('limit', String(auditLimit));

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`Failed to load audit logs (${res.status})`);
      const json = await res.json();
      setAuditLogs(json?.data || []);
    } catch (error: unknown) {
      console.error('Failed to fetch audit logs', error);
      setAuditError((error as Error).message || 'Failed to load audit logs');
    } finally {
      setAuditLoading(false);
    }
  }, [auditActionFilter, auditStatusFilter, auditCompanyFilter, auditStartDate, auditEndDate, auditLimit]);

  const fetchHealthStatus = useCallback(async () => {
    setHealthLoading(true);
    setHealthError('');
    try {
      const res = await fetch('/api/health', { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`Health endpoint returned ${res.status}`);
      const json = await res.json();
      setHealthStatus(json as HealthStatus);
    } catch (error: unknown) {
      console.error('Failed to fetch health status', error);
      setHealthError((error as Error).message || 'Unable to fetch health status');
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const filteredAuditLogs = useMemo(() => {
    if (!auditSearchTerm.trim()) return auditLogs;
    const query = auditSearchTerm.trim().toLowerCase();
    return auditLogs.filter(log => {
      return [
        log.userName,
        log.userRole,
        log.action,
        log.resourceType,
        log.resourceName,
        log.description,
        log.status,
        log.companyId,
      ].some(value => value?.toString().toLowerCase().includes(query));
    });
  }, [auditLogs, auditSearchTerm]);

  const auditPageData = useMemo(() => {
    const totalItems = filteredAuditLogs.length;
    const pageSize = 12;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    return {
      currentLogs: filteredAuditLogs.slice(0, pageSize),
      totalItems,
      totalPages,
      currentPage: 1,
    };
  }, [filteredAuditLogs]);

  const auditSummary = useMemo(() => {
    const total = auditLogs.length;
    const success = auditLogs.filter(log => log.status === 'success').length;
    const failed = auditLogs.filter(log => log.status === 'failed').length;
    const actions = Array.from(new Set(auditLogs.map(log => log.action)));
    return { total, success, failed, actions };
  }, [auditLogs]);

  const healthSummary = useMemo(() => {
    if (!healthStatus) return { ok: 0, degraded: 0, error: 0 };
    const counts = { ok: 0, degraded: 0, error: 0 };
    Object.values(healthStatus.checks).forEach(value => { counts[value] += 1; });
    return counts;
  }, [healthStatus]);

  const refreshAudit = useCallback(() => fetchAuditLogs(), [fetchAuditLogs]);
  const refreshHealth = useCallback(() => fetchHealthStatus(), [fetchHealthStatus]);

  useEffect(() => {
    if (activeTab === 'audit') fetchAuditLogs();
  }, [activeTab, fetchAuditLogs]);

  useEffect(() => {
    if (activeTab === 'health') fetchHealthStatus();
  }, [activeTab, fetchHealthStatus]);

  const companyOptions = useMemo(() => companies.map(company => ({ id: company.id, name: company.name })), [companies]);

  const auditStatusBadge = (status?: string) => {
    if (!status) return 'bg-gray-100 text-gray-700';
    const lower = String(status).toLowerCase();
    if (lower === 'success') return 'bg-emerald-100 text-emerald-700';
    if (lower === 'failed') return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-700';
  };

  const healthCheckBadge = (value: 'ok' | 'degraded' | 'error' | 'unhealthy') => {
    if (value === 'ok') return 'bg-emerald-100 text-emerald-700';
    if (value === 'degraded') return 'bg-amber-100 text-amber-700';
    return 'bg-red-100 text-red-700';
  };

  const renderHealthCheckLabel = (key: string) => {
    if (key === 'database') return 'Database';
    if (key === 'email') return 'Email service';
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const getActionName = (action: string) => {
    return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const getRelativeTime = (timestamp?: string | Date) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  };

  const getAuditRowDescription = (log: AuditLog) => {
    return log.description || `${getActionName(log.action)} on ${log.resourceType}`;
  };

  const getAuditColumnHeader = (label: string) => label;

  const renderAuditRow = (log: AuditLog) => (
    <tr key={log.id || `${log.action}_${log.timestamp.toISOString()}`} className="border-b last:border-b-0 hover:bg-gray-50 transition-colors">
      <td className="px-4 py-4 text-sm text-gray-900">{log.userName || 'Unknown'}</td>
      <td className="px-4 py-4 text-sm text-gray-900">{log.userRole}</td>
      <td className="px-4 py-4 text-sm text-gray-900">{getActionName(log.action)}</td>
      <td className="px-4 py-4 text-sm text-gray-900">{log.resourceType}</td>
      <td className="px-4 py-4 text-sm text-gray-900">{log.resourceName || log.resourceId || '—'}</td>
      <td className="px-4 py-4 text-sm text-gray-900">{getAuditRowDescription(log)}</td>
      <td className="px-4 py-4 text-sm text-gray-900"><span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wider ${auditStatusBadge(log.status)}`}>{log.status}</span></td>
      <td className="px-4 py-4 text-sm text-gray-500">{getRelativeTime(log.timestamp)}</td>
    </tr>
  );

  const renderHealthMetric = (key: string, value: 'ok' | 'degraded' | 'error' | 'unhealthy') => (
    <div key={key} className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm flex items-center justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400">{renderHealthCheckLabel(key)}</p>
      </div>
      <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest ${healthCheckBadge(value)}`}>
        {value}
      </span>
    </div>
  );

  const renderHealthSummary = () => {
    if (!healthStatus) return null;
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {Object.entries(healthStatus.checks).map(([key, value]) => renderHealthMetric(key, value))}
      </div>
    );
  };

  const renderSystemHealthBox = () => (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-2xl font-black text-gray-900">System status</p>
          <p className="text-sm text-gray-500 mt-1">Last checked {healthStatus ? getRelativeTime(healthStatus.timestamp) : 'never'}.</p>
        </div>
        <div className="inline-flex items-center gap-3 rounded-3xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-black text-gray-700">
          Current: <span className={`rounded-full px-3 py-1 ${healthStatus ? healthCheckBadge(healthStatus.status) : 'bg-gray-100 text-gray-600'}`}>{healthStatus?.status ?? 'unknown'}</span>
        </div>
      </div>
      <div className="mt-6 space-y-4">
        {renderHealthSummary()}
      </div>
      {healthError ? <p className="mt-4 text-sm text-red-600">{healthError}</p> : null}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs uppercase tracking-widest text-gray-400">Health endpoint snapshot</p>
        <button type="button" onClick={refreshHealth} className="inline-flex items-center justify-center rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-black text-white hover:bg-indigo-700 transition">Refresh</button>
      </div>
    </div>
  );

  const renderAuditActionsPanel = () => (
    <div className="grid gap-4 lg:grid-cols-4">
      <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <p className="text-xs uppercase tracking-widest text-gray-400">Total events</p>
        <p className="mt-3 text-3xl font-black text-gray-900">{auditSummary.total}</p>
      </div>
      <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <p className="text-xs uppercase tracking-widest text-gray-400">Successful</p>
        <p className="mt-3 text-3xl font-black text-emerald-700">{auditSummary.success}</p>
      </div>
      <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <p className="text-xs uppercase tracking-widest text-gray-400">Failed</p>
        <p className="mt-3 text-3xl font-black text-red-700">{auditSummary.failed}</p>
      </div>
      <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <p className="text-xs uppercase tracking-widest text-gray-400">Action types</p>
        <p className="mt-3 text-3xl font-black text-gray-900">{auditSummary.actions.length}</p>
      </div>
    </div>
  );

  const companyPaymentStats = useMemo(() => {
    const stats: Record<string, { revenue: number; paid: number; pending: number; failed: number }> = {};
    companies.forEach(c => { stats[c.id] = { revenue: 0, paid: 0, pending: 0, failed: 0 }; });
    bookings.forEach(b => {
      const companyStats = stats[b.companyId as string];
      if (!companyStats) return;
      const normalized = ((b as any).paymentStatus || '').toLowerCase();
      if (normalized === 'paid' || normalized === 'successful' || normalized === 'success') {
        companyStats.revenue += b.totalAmount || 0;
        companyStats.paid += 1;
      } else if (['pending', 'unpaid', 'initiated'].includes(normalized)) {
        companyStats.pending += 1;
      } else if (['failed', 'cancelled'].includes(normalized)) {
        companyStats.failed += 1;
      }
    });
    return stats;
  }, [companies, bookings]);

  const filteredPaymentCompanies = useMemo(() => {
    const query = paymentCompanyQuery.trim().toLowerCase();
    return companies
      .filter(c => !query || c.name.toLowerCase().includes(query) || c.email?.toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [companies, paymentCompanyQuery]);

  const paymentCompanyPagination = useMemo(() => {
    const totalItems = filteredPaymentCompanies.length;
    const pageSize = 8;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const currentPage = Math.min(paymentCompanyPage, totalPages);
    const startIndex = (currentPage - 1) * pageSize;
    return {
      totalItems,
      totalPages,
      currentPage,
      currentCompanies: filteredPaymentCompanies.slice(startIndex, startIndex + pageSize),
      startIndex: totalItems > 0 ? startIndex + 1 : 0,
      endIndex: Math.min(startIndex + pageSize, totalItems),
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1,
    };
  }, [filteredPaymentCompanies, paymentCompanyPage]);

  useEffect(() => {
    setPaymentCompanyPage(1);
  }, [paymentCompanyQuery]);

  const paymentSummary = useMemo(() => {
    const bookingPaymentCounts = stats.bookingPaymentCounts || { paid: 0, pending: 0, failed: 0, paidRevenue: 0 };
    return {
      totalCompanies: companies.length,
      totalRevenue: bookingPaymentCounts.paidRevenue,
      paidPayments: bookingPaymentCounts.paid,
      failedPayments: bookingPaymentCounts.failed,
      pendingPayments: bookingPaymentCounts.pending,
    };
  }, [companies.length, stats.bookingPaymentCounts]);

  // ── Real Transaction Data ─────────────────────────────────────────────────
  const realTransactions = useMemo(() => {
    return transactions.map((payment) => {
      const booking = payment.booking;
      const amount = payment.amount || 0;
      const rawStatus = (payment.status || 'pending').toLowerCase();
      const status = ['successful', 'success', 'paid'].includes(rawStatus)
        ? 'successful'
        : ['failed', 'cancelled'].includes(rawStatus) ? 'failed' : 'pending';
      return {
        id: payment.id,
        txRef: payment.txRef || 'No transaction reference',
        provider: payment.provider || 'Unknown provider',
        bookingId: booking?.id || 'No booking record',
        companyId: booking?.companyId || 'unlinked',
        companyName: booking ? (booking.company?.name || 'Unlinked company') : 'No booking record',
        amount: amount,
        status: status as 'successful' | 'failed' | 'pending',
        date: payment.createdAt,
        isArchived: !!payment.isArchived,
      };
    });
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return realTransactions.filter(t => {
      const statusMatch = transactionFilter === 'all' || t.status === transactionFilter;
      const companyMatch = !transactionCompanyFilter || t.companyId === transactionCompanyFilter;
      const archiveMatch = showArchivedPayments || !t.isArchived;
      const unlinkedMatch = showUnlinkedPayments || t.companyId !== 'unlinked';
      return statusMatch && companyMatch && archiveMatch && unlinkedMatch;
    });
  }, [realTransactions, transactionFilter, transactionCompanyFilter, showArchivedPayments, showUnlinkedPayments]);

  const transactionPagination = useMemo(() => {
    const totalItems = filteredTransactions.length;
    const pageSize = 8;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const currentPage = Math.min(transactionPage, totalPages);
    const startIndex = (currentPage - 1) * pageSize;
    return {
      totalItems,
      totalPages,
      currentPage,
      currentTransactions: filteredTransactions.slice(startIndex, startIndex + pageSize),
      startIndex: totalItems > 0 ? startIndex + 1 : 0,
      endIndex: Math.min(startIndex + pageSize, totalItems),
    };
  }, [filteredTransactions, transactionPage]);

  // ── Transaction Summary Stats ─────────────────────────────────────────────
  const transactionStats = useMemo(() => {
    const successful = realTransactions.filter(t => t.status === 'successful').length;
    const failed = realTransactions.filter(t => t.status === 'failed').length;
    const pending = realTransactions.filter(t => t.status === 'pending').length;
    const totalProcessed = realTransactions.reduce((sum, t) => sum + t.amount, 0);
    return {
      successful,
      failed,
      pending,
      totalProcessed,
    };
  }, [realTransactions]);

  const selectedCompanyTransactionStats = useMemo(() => {
    const scopedTransactions = selectedPaymentCompany
      ? realTransactions.filter(t => t.companyId === selectedPaymentCompany.id)
      : [];
    return {
      paid: scopedTransactions.filter(t => t.status === 'successful').length,
      pending: scopedTransactions.filter(t => t.status === 'pending').length,
      failed: scopedTransactions.filter(t => t.status === 'failed').length,
    };
  }, [realTransactions, selectedPaymentCompany]);

  const handleRoleChange = async (id: string, newRole: string) => {
    const previous = usersList;
    setUsersList((prev: any[]) => prev.map(u => u.id === id ? { ...u, role: newRole } : u));
    if (selectedUser?.id === id) {
      setSelectedUser((prev: any) => prev ? { ...prev, role: newRole } : prev);
    }
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
        method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed' }));
        throw new Error(err.error || 'Failed to update role');
      }
      showAlert('success', 'Role updated');
    } catch (e: any) {
      setUsersList(previous);
      console.error('Role update failed', e);
      showAlert('error', e.message || 'Failed to update role');
    }
  };

  const setupStatusBadge = (isComplete?: boolean) => isComplete
    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
    : 'bg-gray-100 text-gray-600 border border-gray-200';

  const userRoleGroupCounts = useMemo(() => {
    const companyRoles = new Set(['company_admin', 'operator', 'conductor']);
    const platformRoles = new Set(['super_admin', 'chief_of_growth', 'chief_of_operations', 'finance']);

    return {
      company: usersList.filter(user => companyRoles.has(user.role)).length,
      platform: usersList.filter(user => platformRoles.has(user.role)).length,
      customer: usersList.filter(user => user.role === 'customer').length,
      total: usersList.length,
    };
  }, [usersList]);

  const filteredUsers = useMemo(() => {
    const query = userSearchTerm.trim();
    return usersList.filter(user => {
      const matchesRoleGroup = userRoleGroupFilter === 'all'
        || (userRoleGroupFilter === 'company' && ['company_admin', 'operator', 'conductor'].includes(user.role))
        || (userRoleGroupFilter === 'platform' && ['super_admin', 'chief_of_growth', 'chief_of_operations', 'finance'].includes(user.role))
        || (userRoleGroupFilter === 'customer' && user.role === 'customer');

      if (!matchesRoleGroup) return false;

      if (!query) return true;

      const rawText = [
        `${user.firstName || ''} ${user.lastName || ''}`,
        user.email,
        ROLE_LABELS[user.role] || user.role,
        user.companyName || user.company?.name || user.companyId,
        user.id,
      ].filter(Boolean).join(' ');
      return fuzzyMatch(rawText, query);
    });
  }, [usersList, userSearchTerm, userRoleGroupFilter]);

  const usersPagination = useMemo(() => {
    const totalItems = filteredUsers.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / USERS_PER_PAGE));
    const startIndex = (usersPage - 1) * USERS_PER_PAGE;
    const currentUsers = filteredUsers.slice(startIndex, startIndex + USERS_PER_PAGE);
    return {
      currentUsers,
      totalPages,
      totalItems,
      startIndex: totalItems > 0 ? startIndex + 1 : 0,
      endIndex: Math.min(startIndex + USERS_PER_PAGE, totalItems),
      hasPrevPage: usersPage > 1,
      hasNextPage: usersPage < totalPages,
    };
  }, [filteredUsers, usersPage]);

  const openUserDetails = useCallback((user: any) => {
    setSelectedUser(user);
    setSelectedUserRole(user.role || 'customer');
    setUserModalOpen(true);
  }, []);

  const closeUserModal = useCallback(() => {
    setUserModalOpen(false);
    setSelectedUser(null);
    setSelectedUserRole('');
  }, []);

  const handleUserRoleSave = async () => {
    if (!selectedUser) return;
    if (selectedUserRole === selectedUser.role) {
      closeUserModal();
      return;
    }
    setRoleUpdating(true);
    try {
      await handleRoleChange(selectedUser.id, selectedUserRole);
      setSelectedUser((prev: any) => prev ? { ...prev, role: selectedUserRole } : prev);
      closeUserModal();
    } finally {
      setRoleUpdating(false);
    }
  };

  const clearAlert = useCallback((id: string) => setAlerts(prev => prev.filter(a => a.id !== id)), []);
  const clearAllAlerts = useCallback(() => setAlerts([]), []);

  // ── Form validation ────────────────────────────────────────────────────────
  const validateForm = useCallback((): boolean => {
    const errors: FormErrors = {};
    if (!formData.name.trim()) errors.name = 'Company name is required';
    if (!formData.email.trim()) errors.email = 'Admin email is required';
    else if (!validateEmail(formData.email)) errors.email = 'Please enter a valid email address';
    if (formData.contact && !validatePhone(formData.contact)) errors.contact = 'Please enter a valid phone number';
    if (formData.adminPhone && !validatePhone(formData.adminPhone)) errors.adminPhone = 'Please enter a valid admin phone number';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  const setLoadingState = useCallback((key: keyof LoadingStates, value: boolean) => {
    setLoadingStates(prev => ({ ...prev, [key]: value }));
  }, []);

  // ── Data fetching ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/'); return; }
    if (!userProfile) return;
    if (userProfile.role !== 'superadmin') { showAlert('error', "You don't have permission."); router.push('/'); return; }

    setLoadingState('initializing', true);

    const fetchDashboardData = async () => {
      try {
        const res = await fetch('/api/admin/data', {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (!res.ok) {
          const body = await res.text().catch(() => 'Unable to read response');
          throw new Error(`Failed to fetch dashboard data: ${res.status} ${body}`);
        }
        const { data } = await res.json();

        setCompanies(data.companies);
        setBookings(data.bookings);
        setSchedules(data.schedules);
        setSchedulesTodayCount(data.schedulesTodayCount ?? 0);
        setRoutes(data.routes);
        setBuses(data.buses);
        setOperators(data.operators);
        setStats(data.stats);

        setLoadingState('companies', false);
        setLoadingState('bookings', false);
      } catch (err: unknown) {
        showAlert('error', `Failed to load dashboard: ${(err as Error).message}`);
        setLoadingState('companies', false);
        setLoadingState('bookings', false);
      } finally {
        setLoadingState('initializing', false);
      }
    };

    const fetchPromotions = async () => {
      try {
        const res = await fetch('/api/promotions');
        const data = await res.json();
        if (data.success) setPromotions(data.data);
      } catch (err) {
        console.error('Failed to fetch promotions:', err);
      } finally {
        setLoadingState('promotions', false);
      }
    };

    fetchDashboardData();
    fetchPromotions();
  }, [user, userProfile, authLoading, router, showAlert, setLoadingState, refreshCount]);

  // ── Company CRUD ───────────────────────────────────────────────────────────
  const handleCreateCompany = async () => {
    if (!validateForm() || !user) { showAlert('error', 'Please fix the form errors or log in.'); return; }
    setLoadingState('creating', true); clearAllAlerts();
    try {
      const res = await fetch('/api/create-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: formData.name.trim(),
          companyEmail: formData.email.trim().toLowerCase(),
          adminFirstName: formData.adminFirstName?.trim() || '',
          adminLastName: formData.adminLastName?.trim() || '',
          adminPhone: formData.adminPhone?.trim() || '',
          companyContact: formData.contact?.trim() || '',
          companyAddress: formData.address?.trim() || '',
          companyDescription: formData.description?.trim() || '',
          status: formData.status,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      if (data.success) { showAlert('success', data.message || 'Company created!'); closeModal('add'); resetForm(); }
      else throw new Error(data.error || 'Failed to create company');
    } catch (e: unknown) {
      showAlert('error', (e as Error).message.includes('Failed to fetch')
        ? 'Network error. Please check your connection.'
        : (e as Error).message || 'Failed to create company.');
    } finally { setLoadingState('creating', false); }
  };

  const handleUpdateCompany = async () => {
    if (!validateForm() || !selectedCompany) { showAlert('error', 'Please fix the form errors.'); return; }
    setLoadingState('updating', true); clearAllAlerts();
    try {
      const result = await dbActions.updateCompany(selectedCompany.id, {
        name: formData.name.trim(),
        email: formData.email.trim(),
        contact: formData.contact?.trim() || '',
        address: formData.address?.trim() || '',
        description: formData.description?.trim() || '',
        status: formData.status,
        updatedAt: new Date(),
      });
      if (!result.success) throw new Error(result.error);
      setCompanies(prev => prev.map(c => c.id === selectedCompany.id ? { 
        ...c, 
        name: formData.name.trim(),
        email: formData.email.trim(),
        contact: formData.contact?.trim() || '',
        address: formData.address?.trim() || '',
        description: formData.description?.trim() || '',
        status: formData.status,
      } : c));
      showAlert('success', 'Company updated successfully!');
      closeModal('edit');
    } catch (e: unknown) { showAlert('error', `Failed to update company: ${(e as Error).message}`); }
    finally { setLoadingState('updating', false); }
  };

  const handleDeleteCompany = async (companyId: string) => {
    setLoadingState('deleting', true); clearAllAlerts();
    try {
      const result = await dbActions.deleteCompany(companyId);
      if (!result.success) throw new Error(result.error);
      setCompanies(prev => prev.filter(c => c.id !== companyId));
      showAlert('success', 'Company deleted successfully!');
      setModals(prev => ({ ...prev, delete: null }));
      setSelectedCompany(null);
    } catch (e: unknown) { showAlert('error', `Failed to delete company: ${(e as Error).message}`); }
    finally { setLoadingState('deleting', false); }
  };

  const handleStatusChange = async (companyId: string, newStatus: Company['status']) => {
    try {
      const result = await dbActions.updateCompany(companyId, { status: newStatus, updatedAt: new Date() });
      if (!result.success) throw new Error(result.error);
      setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, status: newStatus } : c));
      showAlert('success', `Company status updated to ${newStatus}`);
    } catch (e: unknown) { showAlert('error', `Failed to update status: ${(e as Error).message}`); }
  };

  const handleToggleBooking = async (company: Company) => {
    const newBookingState = !company.bookingEnabled;
    try {
      const result = await dbActions.updateCompanyBookingMode(company.id, newBookingState);
      if (!result.success) throw new Error(result.error);
      setCompanies(prev => prev.map(c => c.id === company.id ? { ...c, bookingEnabled: newBookingState, isPartner: newBookingState } : c));
      showAlert('success', `${company.name} booking is now ${newBookingState ? 'ENABLED (Online Booking Active)' : 'DISABLED (Schedule Only)'}`);
    } catch (e: unknown) { showAlert('error', `Failed to toggle booking: ${(e as Error).message}`); }
  };

  // ── Modal helpers ──────────────────────────────────────────────────────────
  const openModal = useCallback((modalType: keyof typeof modals, company?: Company) => {
    if (company) {
      setSelectedCompany(company);
      if (modalType === 'edit') {
        setFormData({
          name: company.name, email: company.email || '', contact: company.contact || '',
          status: company.status || 'pending', address: company.address || '',
          description: company.description || '', adminFirstName: '', adminLastName: '', adminPhone: '',
        });
      }
    }
    setModals(prev => ({ ...prev, [modalType]: modalType === 'delete' ? company?.id || true : true }));
    setFormErrors({});
  }, []);

  const resetForm = useCallback(() => {
    setFormData({ name: '', email: '', contact: '', status: 'pending', address: '', description: '', adminFirstName: '', adminLastName: '', adminPhone: '' });
    setFormErrors({});
  }, []);

  const closeModal = useCallback((modalType: keyof typeof modals) => {
    setModals(prev => ({ ...prev, [modalType]: modalType === 'delete' ? null : false }));
    setSelectedCompany(null);
    resetForm();
  }, [resetForm]);

  // ── Search / filter / sort ─────────────────────────────────────────────────
  const debouncedResetPage = useMemo(() => debounce(() => setCurrentPage(1), 300), []);

  const companyStatusCounts = useMemo(() => ({
    active: companies.filter(c => c.status === 'active').length,
    pending: companies.filter(c => c.status === 'pending').length,
    inactive: companies.filter(c => c.status === 'inactive').length,
    claimed: companies.filter(c => Boolean(c.isPartner)).length,
    total: companies.length,
  }), [companies]);

  const filteredAndSortedCompanies = useMemo(() => {
    return companies
      .filter(c => {
        const sl = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm || c.name.toLowerCase().includes(sl) || c.email.toLowerCase().includes(sl);
        const matchesStatus = companyStatusFilter === 'all' || c.status === companyStatusFilter;
        const matchesClaimed = !claimedOnly || Boolean(c.isPartner);
        return matchesSearch && matchesStatus && matchesClaimed;
      })
      .sort((a, b) => {
        let av: any = (a[sortBy as keyof Company] as any) ?? '';
        let bv: any = (b[sortBy as keyof Company] as any) ?? '';
        if (sortBy === 'createdAt') {
          av = av instanceof Date ? av.getTime() : new Date(av || 0).getTime();
          bv = bv instanceof Date ? bv.getTime() : new Date(bv || 0).getTime();
        } else {
          av = String(av).toLowerCase();
          bv = String(bv).toLowerCase();
        }
        return av < bv ? (sortOrder === 'asc' ? -1 : 1) : av > bv ? (sortOrder === 'asc' ? 1 : -1) : 0;
      });
  }, [companies, searchTerm, companyStatusFilter, claimedOnly, sortBy, sortOrder]);

  const paginationData = useMemo(() => {
    const totalItems = filteredAndSortedCompanies.length;
    const totalPages = Math.ceil(totalItems / COMPANIES_PER_PAGE);
    const last = currentPage * COMPANIES_PER_PAGE;
    const first = last - COMPANIES_PER_PAGE;
    return {
      currentCompanies: filteredAndSortedCompanies.slice(first, last),
      totalPages, totalItems,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1,
      startIndex: totalItems > 0 ? first + 1 : 0,
      endIndex: Math.min(last, totalItems),
    };
  }, [filteredAndSortedCompanies, currentPage]);

  useEffect(() => { setCurrentPage(1); }, [companyStatusFilter, claimedOnly, searchTerm, sortBy, sortOrder]);

  // ── Status helpers ─────────────────────────────────────────────────────────
  const toggleCompanyStatusFilter = (status: 'active' | 'pending' | 'inactive') => {
    setCompanyStatusFilter(prev => prev === status ? 'all' : status);
  };

  const toggleClaimedFilter = () => setClaimedOnly(prev => !prev);

  const getStatusIcon = useCallback((status?: string) => {
    const cfg = status ? STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] : null;
    const IconComponent: React.FC<{ className?: string }> = cfg?.icon ?? AlertCircle;
    return <IconComponent className="w-4 h-4" />;
  }, []);

  const getStatusColor = useCallback((status?: string) =>
    STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.color ?? 'bg-gray-100 text-gray-800 border-gray-200'
    , []);

  // ── Export helpers ─────────────────────────────────────────────────────────
  const exportCSV = (rows: string[], headers: string, filename: string) => {
    const blob = new Blob([headers + '\n' + rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    a.click(); URL.revokeObjectURL(url);
  };

  const exportCompaniesData = () => {
    exportCSV(
      filteredAndSortedCompanies.map(c => [c.id, c.name, c.email, c.contact || '', c.status || 'pending', formatDate(c.createdAt as any)].join(',')),
      'ID,Name,Email,Contact,Status,Created', 'companies-data.csv'
    );
    showAlert('success', 'Companies exported!');
  };

  const exportStatsData = () => {
    exportCSV([
      ['Total Companies', stats.totalCompanies.toString()],
      ['Active Companies', stats.activeCompanies.toString()],
      ['Pending Companies', stats.pendingCompanies.toString()],
      ['Inactive Companies', stats.inactiveCompanies.toString()],
      ['Total Revenue', `MWK ${stats.totalRevenue.toLocaleString()}`],
      ['Total Bookings', stats.totalBookings.toString()],
      ['Monthly Bookings', stats.monthlyBookings.toString()],
      ['Active Routes', routes.filter(isLiveRoute).length.toString()],
      ['Active Schedules', schedules.filter(isLiveSchedule).length.toString()],
    ].map(r => r.join(',')), 'Metric,Value', 'dashboard-stats.csv');
    showAlert('success', 'Stats exported!');
  };

  // ── Loading / auth guards ──────────────────────────────────────────────────
  if (authLoading || loadingStates.initializing) return (
    <div className="min-h-screen bg-gray-50 flex">
      <div className="hidden lg:flex w-72 flex-col bg-white border-r border-gray-200">
        <div className="h-16 flex items-center px-6 border-b border-gray-100">
          <div className="h-8 w-8 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-6 w-32 bg-gray-200 rounded-md animate-pulse ml-3" />
        </div>
        <div className="p-4 space-y-2 flex-1">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-11 bg-gray-100 rounded-lg animate-pulse flex items-center px-4 gap-3">
              <div className="h-5 w-5 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-gray-100">
          <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-200">
          <div className="h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
            <div className="h-6 w-40 bg-gray-200 rounded-md animate-pulse hidden sm:block" />
            <div className="flex items-center gap-4">
              <div className="h-10 w-48 bg-gray-100 rounded-full animate-pulse hidden md:block" />
              <div className="h-10 w-10 bg-gray-200 rounded-full animate-pulse" />
              <div className="h-10 w-10 bg-gray-200 rounded-full animate-pulse" />
            </div>
          </div>
          <div className="px-4 sm:px-6 lg:px-8 border-t border-gray-100 bg-white">
            <div className="flex gap-6 h-12 items-center">
              <div className="h-5 w-20 bg-gray-200 rounded animate-pulse" />
              <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
              <div className="h-5 w-16 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
              <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse" />
              <div className="h-10 w-32 bg-brand-100 rounded-lg animate-pulse" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                  <div className="h-5 w-10 bg-gray-200 rounded-lg animate-pulse mb-4" />
                  <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
                  <div className="h-8 bg-gray-300 rounded w-20 animate-pulse" />
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
              <div className="h-6 w-40 bg-gray-200 rounded animate-pulse mb-6" />
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-16 bg-gray-50 rounded-xl border border-gray-100 animate-pulse" />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );

  if (!isAuthorized) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-600 mb-4">You don&apos;t have permission to access this dashboard.</p>
        <button onClick={() => router.push('/')} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Go Home</button>
      </div>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  const handleTabChange = (nextTab: TabType) => {
    if (nextTab !== 'profile') {
      setSelectedCompany(null);
    }
    setActiveTab(nextTab);
  };

  const SidebarItem = ({ id, label, icon: Icon }: { id: TabType; label: string; icon: any }) => {
    const isActive = activeTab === id;
    return (
      <button
        onClick={() => handleTabChange(id)}
        className={`w-full flex items-center group transition-all duration-200 relative rounded-xl h-11 px-4 space-x-3 mb-1 ${isActive ? 'bg-brand-700 text-white shadow-md shadow-brand-200' : 'text-gray-500 hover:bg-brand-50 hover:text-brand-700'
          }`}
      >
        <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'group-hover:text-brand-700 text-gray-400'}`} />
        <span className="text-[13px] font-bold flex-1 text-left truncate">{label}</span>
      </button>
    );
  };

  return (
    <div className="admin-dashboard min-h-screen bg-gray-50 flex">
      {isMobileOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm" onClick={() => setIsMobileOpen(false)} />
      )}
      {/* Sidebar */}
      <AdminSidebar activeTab={String(activeTab)} setActiveTab={(t: string) => handleTabChange(t as TabType)} isMobileOpen={isMobileOpen} setIsMobileOpen={setIsMobileOpen} userProfile={userProfile} signOut={signOut} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-40 px-4 sm:px-8 py-4 flex justify-between items-center h-[73px]">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMobileOpen(true)} className="lg:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-[20px] font-bold text-gray-900 tracking-tight capitalize hidden sm:block">
                {activeTab} Dashboard
              </h2>
              <h2 className="text-[16px] font-bold text-gray-900 tracking-tight capitalize sm:hidden">
                {activeTab}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Dashboards Dropdown */}
            <div className="relative" ref={dashboardsRef}>
              <button
                onClick={() => setIsDashboardsOpen(prev => !prev)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  isDashboardsOpen
                    ? 'bg-brand-700 text-white shadow-md shadow-brand-200'
                    : 'text-gray-600 hover:bg-brand-50 hover:text-brand-700'
                }`}
                title="Switch Dashboards"
              >
                <Layers className="w-4 h-4" />
                <span className="hidden sm:inline">Dashboards</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isDashboardsOpen ? 'rotate-180' : ''}`} />
              </button>
              {isDashboardsOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <p className="px-4 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Role Dashboards</p>
                  <button
                    onClick={() => { setIsDashboardsOpen(false); router.push('/admin/chief-of-growth'); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-brand-50 hover:text-brand-700 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-[13px]">Chief of Growth</p>
                      <p className="text-[10px] text-gray-400">User growth & acquisition</p>
                    </div>
                  </button>
                  <button
                    onClick={() => { setIsDashboardsOpen(false); router.push('/admin/chief-of-operations'); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-brand-50 hover:text-brand-700 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                      <BusIcon className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-[13px]">Chief of Operations</p>
                      <p className="text-[10px] text-gray-400">Routes, buses & schedules</p>
                    </div>
                  </button>
                  <div className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 cursor-not-allowed">
                    <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                      <DollarSign className="w-4 h-4 text-gray-300" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-[13px]">Finance</p>
                      <p className="text-[10px] text-gray-300">Coming soon</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {userProfile?.id && (
              <NotificationBell userId={userProfile.id} className="relative" />
            )}
            <button onClick={() => setRefreshCount(r => r + 1)} className="p-2 text-gray-400 hover:bg-gray-50 rounded-lg transition-all" title="Refresh Data">
              <RefreshCw className={`w-4 h-4 ${loadingStates.initializing ? 'animate-spin' : ''}`} />
            </button>
            <div className="h-8 w-[1px] bg-gray-100" />
            <button
              type="button"
              onClick={() => router.push('/profile')}
              className="flex items-center gap-3 pl-2 py-1.5 pr-1 rounded-xl hover:bg-gray-50 transition-colors duration-200"
              aria-label="Open profile"
            >
              <div className="w-9 h-9 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-bold text-xs ring-4 ring-brand-50/50">
                {userProfile?.firstName?.[0] || userProfile?.email?.[0] || 'A'}
              </div>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 overflow-y-auto pb-32 lg:pb-8">
          {/* Alerts */}
          <div className="space-y-2 mb-6">
            {alerts.map(a => (
              <AlertMessage key={a.id} type={a.type} message={a.message} onClose={() => clearAlert(a.id)} />
            ))}
          </div>


          <div className="bg-white rounded-xl shadow-sm p-6">

            {/* ── OVERVIEW ── */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="flex justify-end">
                  <button
                    onClick={() => openModal('add')}
                    className="inline-flex items-center gap-2 bg-brand-700 text-white px-4 py-2.5 rounded-xl hover:bg-brand-800 transition-all text-sm font-black uppercase tracking-wider shadow-lg shadow-brand-100"
                  >
                    <Plus className="w-4 h-4" />
                    Add Company
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
                  <KineticStatCard title="Total Companies" value={stats.totalCompanies} icon={Building2} iconBg="bg-blue-50" iconColor="text-blue-600" />
                  <KineticStatCard title="Confirmed booking value" value={`MWK ${stats.totalRevenue.toLocaleString()}`} icon={DollarSign} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
                  <KineticStatCard title="Total Bookings" value={stats.totalBookings} icon={List} iconBg="bg-indigo-50" iconColor="text-indigo-600" />
                  <KineticStatCard title="Active Routes" value={routes.filter(isLiveRoute).length} icon={MapIcon} iconBg="bg-violet-50" iconColor="text-violet-600" />
                  <KineticStatCard
                    title="Schedules Today"
                    value={schedulesTodayCount}
                    icon={Calendar}
                    iconBg="bg-sky-50"
                    iconColor="text-sky-600"
                  />
                </div>

                <div className="bg-white rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-5 border-b border-gray-100">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Latest Companies</h3>
                      <p className="text-sm text-gray-500">Most recently added partner companies</p>
                    </div>
                    <button
                      onClick={() => handleTabChange('companies')}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      View all
                    </button>
                  </div>

                  <div className="divide-y divide-gray-100">
                    {companies.slice(0, 5).map((company) => {
                      const latestCompanyBadgeStatus = company.isPartner === false && company.bookingEnabled === false
                        ? 'Unclaimed'
                        : company.status || 'pending';

                      return (
                        <button
                          key={company.id}
                          type="button"
                          onClick={() => { setSelectedCompany(company); setActiveTab('profile'); }}
                          className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-11 w-11 bg-brand-50 rounded-xl flex items-center justify-center text-brand-700 ring-1 ring-brand-100">
                              <Building2 className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-gray-900 truncate">{company.name}</p>
                              <p className="text-xs text-gray-500 truncate">{company.email || 'No email provided'}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 shrink-0">
                            <StatusBadge status={latestCompanyBadgeStatus} type="company" />
                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                              {company.createdAt ? formatDate(company.createdAt) : 'New'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── COMPANIES ── */}
            {activeTab === 'companies' && (
              <div className="space-y-6">
                {/* ── Status Stat Cards Row ── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                  {[
                    { key: 'active', label: 'Active', count: companyStatusCounts.active, selected: companyStatusFilter === 'active' },
                    { key: 'claimed', label: 'Claimed', count: `${companyStatusCounts.claimed} of ${companyStatusCounts.total}`, selected: claimedOnly },
                    { key: 'pending', label: 'Pending', count: companyStatusCounts.pending, selected: companyStatusFilter === 'pending' },
                    { key: 'inactive', label: 'Inactive', count: companyStatusCounts.inactive, selected: companyStatusFilter === 'inactive' },
                  ].map(card => {
                    const isSelected = card.selected;
                    const onClick = card.key === 'claimed'
                      ? toggleClaimedFilter
                      : () => toggleCompanyStatusFilter(card.key as 'active' | 'pending' | 'inactive');

                    return (
                      <button
                        key={card.key}
                        type="button"
                        onClick={onClick}
                        className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${isSelected
                          ? 'border-brand-200 bg-brand-50 text-brand-700 shadow-sm shadow-brand-100'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-brand-200 hover:bg-brand-50/40'}`}
                      >
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">{card.label}</div>
                        <div className="mt-2 text-xl font-black leading-none">{card.count}</div>
                      </button>
                    );
                  })}
                </div>

                {/* ── Search & Actions Row ── */}
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                  <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search companies..."
                      value={searchTerm}
                      onChange={e => { setSearchTerm(e.target.value); debouncedResetPage(); }}
                      className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                      onClick={() => setSortOrder(p => p === 'asc' ? 'desc' : 'asc')}
                      className="p-2.5 bg-white border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
                      title={sortOrder === 'asc' ? 'Sort descending' : 'Sort ascending'}
                    >
                      {sortOrder === 'asc' ? <SortAsc className="w-4 h-4 text-gray-600" /> : <SortDesc className="w-4 h-4 text-gray-600" />}
                    </button>
                    <button
                      onClick={exportCompaniesData}
                      className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl hover:bg-emerald-100 transition-colors text-sm font-black uppercase tracking-wider"
                    >
                      <Download className="w-4 h-4" /> Export
                    </button>
                    <button
                      onClick={() => openModal('add')}
                      className="flex items-center gap-2 bg-indigo-900 text-white px-5 py-2 rounded-xl hover:bg-indigo-800 transition-all text-sm font-black uppercase tracking-wider shadow-lg shadow-indigo-100"
                    >
                      <Plus className="w-4 h-4" /> Add Company
                    </button>
                  </div>
                </div>

                {paginationData.totalItems === 0 ? (
                  <div className="text-center py-20 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                    <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">No companies found</p>
                    <p className="text-xs text-gray-400 mt-1">Try adjusting your filters or search term</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-white rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead className="bg-gray-50/50 border-b border-gray-50">
                            <tr>
                              {['Company Identity', 'Operational Contact', 'Booking Mode', 'Subscription', 'Status', 'Actions'].map(h => (
                                <th key={h} className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {paginationData.currentCompanies.map(company => (
                              <tr key={company.id} className="hover:bg-gray-50/50 transition-colors group">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-4">
                                    {company.logo
                                      ? <Image src={company.logo} alt={company.name} width={44} height={44} className="h-11 w-11 rounded-xl object-cover border-2 border-white shadow-sm" />
                                      : <div className="h-11 w-11 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100">
                                        <Building2 className="w-5 h-5 text-indigo-600" />
                                      </div>}
                                    <div className="min-w-0">
                                      <p className="text-sm font-black text-gray-900 leading-none mb-1 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{company.name}</p>
                                      <p className="text-[11px] font-bold text-gray-400 truncate flex items-center gap-1.5 lowercase">
                                        <Mail className="w-3 h-3" />{company.email}
                                      </p>
                                      {company.category && (
                                        <span className="inline-block mt-1 text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                          {company.category}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <p className="text-xs font-black text-gray-700 flex items-center gap-1.5 mb-1">
                                    <Phone className="w-3 h-3 text-gray-400" />{company.contact || 'N/A'}
                                  </p>
                                  <p className="text-[10px] font-bold text-gray-400 uppercase items-center gap-1 flex truncate max-w-[150px]">
                                    <MapPin className="w-3 h-3 shrink-0" />{company.address || 'Global Site'}
                                  </p>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex flex-col gap-1">
                                    <button
                                      onClick={() => handleToggleBooking(company)}
                                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all ${
                                        company.bookingEnabled
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 shadow-sm'
                                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                                      }`}
                                      title={company.bookingEnabled ? "Click to switch to Schedule Only (Disable Booking)" : "Click to Enable Online Booking"}
                                    >
                                      <span className={`w-2 h-2 rounded-full ${company.bookingEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                                      {company.bookingEnabled ? 'Booking Active' : 'Schedule Only'}
                                    </button>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-amber-50 text-amber-700 border border-amber-100">
                                      {company.planType || 'BASIC'}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${getStatusColor(company.status)}`}>
                                    {getStatusIcon(company.status)}
                                    {company.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-1.5">
                                    <button onClick={() => { setSelectedCompany(company); setActiveTab('profile'); }} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Full Analytics">
                                      <BarChart3 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => openModal('edit', company)} className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-all" title="Edit Config">
                                      <Edit className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => openModal('delete', company)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Terminate">
                                      <Trash className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="flex items-center justify-between px-2">
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                        Displaying {paginationData.startIndex}—{paginationData.endIndex} Of {paginationData.totalItems} Companies
                      </p>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={!paginationData.hasPrevPage}
                          className="p-2 bg-white border border-gray-100 rounded-xl disabled:opacity-30 hover:bg-gray-50 transition-all">
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="px-4 text-xs font-black text-gray-700">PAGE {currentPage}</span>
                        <button onClick={() => setCurrentPage(p => Math.min(p + 1, paginationData.totalPages))} disabled={!paginationData.hasNextPage}
                          className="p-2 bg-white border border-gray-100 rounded-xl disabled:opacity-30 hover:bg-gray-50 transition-all">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── USERS / ROLE & ACCESS ── */}
            {activeTab === 'users' && (
              <div className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-xl font-black text-gray-900">Users & Role Management</h3>
                    <p className="text-[10px] text-gray-400 mt-1">Search, assign platform roles, and review access.</p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={refreshUsers}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition"
                    >
                      <RefreshCw className="w-4 h-4" /> Refresh
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { key: 'company', label: 'Company roles', count: userRoleGroupCounts.company, selected: userRoleGroupFilter === 'company' },
                    { key: 'platform', label: 'Platform roles', count: userRoleGroupCounts.platform, selected: userRoleGroupFilter === 'platform' },
                    { key: 'customer', label: 'Customer', count: userRoleGroupCounts.customer, selected: userRoleGroupFilter === 'customer' },
                  ].map(card => {
                    const isSelected = !!card.selected;
                    const handleClick = () => {
                      setUserRoleGroupFilter(prev => prev === card.key ? 'all' : card.key as 'company' | 'platform' | 'customer');
                      setUsersPage(1);
                    };

                    return (
                      <button
                        key={card.key}
                        type="button"
                        onClick={handleClick}
                        className={`rounded-2xl border px-4 py-3 text-left transition-all ${isSelected
                          ? 'border-brand-200 bg-brand-50 text-brand-700 shadow-sm shadow-brand-100'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-brand-200 hover:bg-brand-50/40'}`}
                      >
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">{card.label}</div>
                        <div className="mt-2 text-xl font-black leading-none">{card.count}</div>
                      </button>
                    );
                  })}
                </div>

                <div className="relative w-full sm:w-[320px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search users, email, role, company..."
                    value={userSearchTerm}
                    onChange={e => { setUserSearchTerm(e.target.value); setUsersPage(1); }}
                    className="w-full pl-10 pr-4 py-2 rounded-2xl border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </div>

                <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[820px] text-left text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Name</th>
                          <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Email</th>
                          <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Role</th>
                          <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Company</th>
                          <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Setup</th>
                          <th className="px-4 py-3 text-xs font-black text-gray-400 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.length === 0 && !usersLoading ? (
                          <tr>
                            <td colSpan={6} className="py-16 text-center text-gray-400">No users match your search.</td>
                          </tr>
                        ) : (
                          usersPagination.currentUsers.map(u => (
                            <tr key={u.id} className="border-b hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => openUserDetails(u)}>
                              <td className="px-4 py-4">
                                <div className="font-bold text-gray-900">{u.firstName} {u.lastName}</div>
                              </td>
                              <td className="px-4 py-4 text-gray-600">{u.email}</td>
                              <td className="px-4 py-4">
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100">
                                  {ROLE_LABELS[u.role] || u.role}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-gray-500">{u.companyName || u.company?.name || '—'}</td>
                              <td className="px-4 py-4">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${setupStatusBadge(u.setupCompleted)}`}>
                                  {u.setupCompleted ? 'Complete' : 'Incomplete'}
                                </span>
                              </td>
                              <td className="px-4 py-4">
                                <button
                                  type="button"
                                  onClick={e => { e.stopPropagation(); openUserDetails(u); }}
                                  className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition"
                                >
                                  <Eye className="w-3.5 h-3.5" /> View
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between bg-gray-50">
                    <div className="text-[11px] text-gray-500">
                      Showing {usersPagination.startIndex}–{usersPagination.endIndex} of {usersPagination.totalItems} users
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setUsersPage(p => Math.max(p - 1, 1))}
                        disabled={!usersPagination.hasPrevPage}
                        className="inline-flex items-center justify-center w-9 h-9 rounded-2xl border border-gray-200 bg-white text-gray-600 disabled:opacity-40 hover:bg-gray-50 transition"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-sm font-black text-gray-700">{usersPagination.currentUsers.length ? usersPage : 0} / {usersPagination.totalPages}</span>
                      <button
                        onClick={() => setUsersPage(p => Math.min(p + 1, usersPagination.totalPages))}
                        disabled={!usersPagination.hasNextPage}
                        className="inline-flex items-center justify-center w-9 h-9 rounded-2xl border border-gray-200 bg-white text-gray-600 disabled:opacity-40 hover:bg-gray-50 transition"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {userModalOpen && selectedUser && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-black/40">
                    <div className="w-full max-w-2xl rounded-[28px] bg-white border border-gray-200 shadow-2xl overflow-hidden">
                      <div className="flex items-center justify-between px-6 py-5 border-b">
                        <div>
                          <h4 className="text-lg font-black text-gray-900">User details</h4>
                          <p className="text-xs text-gray-500">Review profile and update role for platform access.</p>
                        </div>
                        <button type="button" onClick={closeUserModal} className="text-gray-400 hover:text-gray-600">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="space-y-4 px-6 py-5">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Name</p>
                            <p className="mt-2 text-sm font-bold text-gray-900">{selectedUser.firstName} {selectedUser.lastName}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Email</p>
                            <p className="mt-2 text-sm text-gray-900">{selectedUser.email}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Company</p>
                            <p className="mt-2 text-sm text-gray-900">{selectedUser.companyName || selectedUser.company?.name || '—'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Setup complete</p>
                            <span className={`mt-2 inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide border ${setupStatusBadge(selectedUser.setupCompleted)}`}>
                              {selectedUser.setupCompleted ? 'Complete' : 'Incomplete'}
                            </span>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Current role</p>
                            <span className="mt-2 inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-black uppercase tracking-wide border border-indigo-100">
                              {ROLE_LABELS[selectedUser.role] || selectedUser.role}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400" htmlFor="role-select">Update role</label>
                          <select
                            id="role-select"
                            value={selectedUserRole}
                            onChange={e => setSelectedUserRole(e.target.value)}
                            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                          >
                            {ROLE_OPTIONS.map(r => (
                              <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex flex-col gap-3 px-6 py-5 border-t bg-gray-50 sm:flex-row sm:justify-end">
                        <button type="button" onClick={closeUserModal} className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 transition sm:w-auto">
                          Cancel
                        </button>
                        <button type="button" onClick={handleUserRoleSave} disabled={roleUpdating} className="w-full rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700 transition disabled:opacity-50 sm:w-auto">
                          {roleUpdating ? 'Saving...' : 'Save role'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── PAYMENTS / SYSTEM SETTINGS ── */}
            {activeTab === 'payments' && (
              <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-xl font-black text-gray-900">Payments</h3>
                    <p className="text-[10px] text-gray-400 mt-1">Platform-wide PayChangu payment activity and gross paid revenue.</p>
                  </div>
                  {selectedPaymentCompany ? (
                    <button type="button" onClick={() => {
                      setSelectedPaymentCompany(null);
                      setTransactionCompanyFilter('');
                      setTransactionPage(1);
                    }}
                      className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">
                      Back to payment summary
                    </button>
                  ) : null}
                </div>

                {!selectedPaymentCompany && (
                  <>
                    <p className="text-xs font-black uppercase tracking-widest text-gray-400">Booking payment state · all bookings</p>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <StatPill icon={<DollarSign className="w-4 h-4 text-white" />} label="Gross paid revenue" value={`MWK ${paymentSummary.totalRevenue.toLocaleString()}`} color="bg-emerald-100 text-emerald-700" />
                      <StatPill icon={<CheckCircle className="w-4 h-4 text-white" />} label="Paid bookings" value={paymentSummary.paidPayments} color="bg-blue-100 text-blue-700" />
                      <StatPill icon={<Clock className="w-4 h-4 text-white" />} label="Pending payments" value={paymentSummary.pendingPayments} color="bg-amber-100 text-amber-700" />
                      <StatPill icon={<AlertCircle className="w-4 h-4 text-white" />} label="Failed payments" value={paymentSummary.failedPayments} color="bg-red-100 text-red-700" />
                    </div>

                    <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5">
                      <div className="flex items-start gap-3">
                        <Activity className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
                        <div>
                          <p className="text-sm font-bold text-blue-900">Gateway signal: {transactionsLoading ? 'Loading' : 'Observed'}</p>
                          <p className="mt-1 text-xs text-blue-800">Log-derived operational signal from the existing PayChangu payment and security logging paths. This is not a persisted gateway health table.</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {!selectedPaymentCompany ? (
                  <div className="space-y-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">Company payment activity</h4>
                        <p className="text-[10px] text-gray-400">Gross paid revenue and payment-status counts from Booking records.</p>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="relative w-full sm:w-80">
                          <input
                            type="text"
                            value={paymentCompanyQuery}
                            onChange={e => setPaymentCompanyQuery(e.target.value)}
                            placeholder="Search companies..."
                            className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-5 py-4 font-black uppercase tracking-wider text-gray-400">Company</th>
                              <th className="px-5 py-4 font-black uppercase tracking-wider text-gray-400">Gross paid revenue</th>
                              <th className="px-5 py-4 font-black uppercase tracking-wider text-gray-400">Paid / pending / failed</th>
                              <th className="px-5 py-4 font-black uppercase tracking-wider text-gray-400">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {paymentCompanyPagination.currentCompanies.map(company => {
                              const stats = companyPaymentStats[company.id] ?? { revenue: 0, paid: 0, pending: 0, failed: 0 };
                              return (
                                <tr key={company.id} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-5 py-4">
                                    <div className="font-semibold text-gray-900">{company.name}</div>
                                    <div className="text-xs text-gray-400">{company.email || 'No email'}</div>
                                  </td>
                                  <td className="px-5 py-4">
                                    <div className="text-sm font-semibold text-gray-900">MWK {stats.revenue.toLocaleString()}</div>
                                    <div className="text-xs text-gray-400">{stats.paid} paid bookings</div>
                                  </td>
                                  <td className="px-5 py-4 text-xs font-semibold text-gray-700">
                                    {stats.paid} / {stats.pending} / {stats.failed}
                                  </td>
                                  <td className="px-5 py-4">
                                    <button type="button" onClick={() => {
                                      setSelectedPaymentCompany(company);
                                      setTransactionCompanyFilter(company.id);
                                      setTransactionPage(1);
                                    }}
                                      className="rounded-2xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition">
                                      View details
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between text-xs text-gray-500">
                        <span>
                          Showing {paymentCompanyPagination.startIndex}-{paymentCompanyPagination.endIndex} of {paymentCompanyPagination.totalItems} companies
                        </span>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => setPaymentCompanyPage(prev => Math.max(1, prev - 1))}
                            disabled={!paymentCompanyPagination.hasPrev}
                            className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 disabled:opacity-50">
                            Previous
                          </button>
                          <button type="button" onClick={() => setPaymentCompanyPage(prev => Math.min(paymentCompanyPagination.totalPages, prev + 1))}
                            disabled={!paymentCompanyPagination.hasNext}
                            className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 disabled:opacity-50">
                            Next
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 border-b border-gray-100 gap-4">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900">Recent transactions</h4>
                          <p className="text-[10px] text-gray-400">Payment records from the existing admin payments API.</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className="text-xs text-gray-400">{transactionStats.successful} paid / {transactionStats.pending} pending / {transactionStats.failed} failed</span>
                          <div className="flex items-center gap-4 text-xs font-medium text-gray-600">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input type="checkbox" checked={showArchivedPayments} onChange={(e) => setShowArchivedPayments(e.target.checked)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                              Show Archived
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input type="checkbox" checked={showUnlinkedPayments} onChange={(e) => setShowUnlinkedPayments(e.target.checked)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                              Show Unlinked (Test)
                            </label>
                          </div>
                        </div>
                      </div>
                      {transactionsLoading ? (
                        <div className="px-5 py-8 text-center text-sm text-gray-500">Loading transactions...</div>
                      ) : transactionPagination.currentTransactions.length === 0 ? (
                        <div className="px-5 py-8 text-center text-sm text-gray-500">No payment transactions found.</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-left text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-5 py-3 font-black uppercase tracking-wider text-gray-400">Reference</th>
                                <th className="px-5 py-3 font-black uppercase tracking-wider text-gray-400">Company</th>
                                <th className="px-5 py-3 font-black uppercase tracking-wider text-gray-400">Provider</th>
                                <th className="px-5 py-3 font-black uppercase tracking-wider text-gray-400">Amount</th>
                                <th className="px-5 py-3 font-black uppercase tracking-wider text-gray-400">Status</th>
                                <th className="px-5 py-3 font-black uppercase tracking-wider text-gray-400">Date</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {transactionPagination.currentTransactions.map(transaction => (
                                <tr key={transaction.id} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-5 py-3 font-mono text-xs text-gray-700">{transaction.txRef}</td>
                                  <td className="px-5 py-3 text-sm text-gray-900">{transaction.companyName}</td>
                                  <td className="px-5 py-3 text-xs text-gray-600">{transaction.provider}</td>
                                  <td className="px-5 py-3 text-sm font-semibold text-gray-900">MWK {transaction.amount.toLocaleString()}</td>
                                  <td className="px-5 py-3"><StatusBadge status={transaction.status} type="booking" /></td>
                                  <td className="px-5 py-3 text-xs text-gray-500">{formatDate(transaction.date)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {transactionPagination.totalPages > 1 ? (
                        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 text-xs text-gray-500">
                          <span>Showing {transactionPagination.startIndex}-{transactionPagination.endIndex} of {transactionPagination.totalItems}</span>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => setTransactionPage(prev => Math.max(1, prev - 1))} disabled={transactionPagination.currentPage <= 1} className="rounded-xl border border-gray-200 px-3 py-1.5 disabled:opacity-50">Previous</button>
                            <button type="button" onClick={() => setTransactionPage(prev => Math.min(transactionPagination.totalPages, prev + 1))} disabled={transactionPagination.currentPage >= transactionPagination.totalPages} className="rounded-xl border border-gray-200 px-3 py-1.5 disabled:opacity-50">Next</button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {(() => {
                      const companyStats = companyPaymentStats[selectedPaymentCompany.id] ?? { revenue: 0, paid: 0, pending: 0, failed: 0 };
                      return (
                        <>
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900">Payment snapshot · {selectedPaymentCompany.name}</h4>
                            <p className="text-[10px] text-gray-400 mt-1">Read-only company scope. Booking payment-state metrics and the matching transaction records are shown below.</p>
                          </div>
                          <p className="text-xs font-black uppercase tracking-widest text-gray-400">Booking payment state · {selectedPaymentCompany.name}</p>
                          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <StatPill icon={<DollarSign className="w-4 h-4 text-white" />} label="Gross paid revenue" value={`MWK ${companyStats.revenue.toLocaleString()}`} color="bg-emerald-100 text-emerald-700" />
                            <StatPill icon={<CheckCircle className="w-4 h-4 text-white" />} label="Paid bookings" value={companyStats.paid} color="bg-blue-100 text-blue-700" />
                            <StatPill icon={<Clock className="w-4 h-4 text-white" />} label="Pending payments" value={companyStats.pending} color="bg-amber-100 text-amber-700" />
                            <StatPill icon={<AlertCircle className="w-4 h-4 text-white" />} label="Failed payments" value={companyStats.failed} color="bg-red-100 text-red-700" />
                          </div>
                          <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5">
                            <div className="flex items-start gap-3">
                              <Activity className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
                              <div>
                                <p className="text-sm font-bold text-blue-900">Gateway signal: {transactionsLoading ? 'Loading' : 'Observed'}</p>
                                <p className="mt-1 text-xs text-blue-800">Log-derived operational signal from the existing PayChangu payment and security logging paths. This is not a persisted gateway health table.</p>
                              </div>
                            </div>
                          </div>
                          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 border-b border-gray-100 gap-4">
                              <div>
                                <h4 className="text-sm font-semibold text-gray-900">Transactions · {selectedPaymentCompany.name}</h4>
                                <p className="text-[10px] text-gray-400">Existing admin payment records filtered by companyId.</p>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <span className="text-xs text-gray-400">{selectedCompanyTransactionStats.paid} paid / {selectedCompanyTransactionStats.pending} pending / {selectedCompanyTransactionStats.failed} failed</span>
                                <div className="flex items-center gap-4 text-xs font-medium text-gray-600">
                                  <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input type="checkbox" checked={showArchivedPayments} onChange={(e) => setShowArchivedPayments(e.target.checked)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                    Show Archived
                                  </label>
                                  <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input type="checkbox" checked={showUnlinkedPayments} onChange={(e) => setShowUnlinkedPayments(e.target.checked)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                    Show Unlinked (Test)
                                  </label>
                                </div>
                              </div>
                            </div>
                            {transactionsLoading ? (
                              <div className="px-5 py-8 text-center text-sm text-gray-500">Loading transactions...</div>
                            ) : transactionPagination.currentTransactions.length === 0 ? (
                              <div className="px-5 py-8 text-center text-sm text-gray-500">No payment transactions found for this company.</div>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="min-w-full text-left text-sm">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-5 py-3 font-black uppercase tracking-wider text-gray-400">Reference</th>
                                      <th className="px-5 py-3 font-black uppercase tracking-wider text-gray-400">Provider</th>
                                      <th className="px-5 py-3 font-black uppercase tracking-wider text-gray-400">Amount</th>
                                      <th className="px-5 py-3 font-black uppercase tracking-wider text-gray-400">Status</th>
                                      <th className="px-5 py-3 font-black uppercase tracking-wider text-gray-400">Date</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {transactionPagination.currentTransactions.map(transaction => (
                                      <tr key={transaction.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-5 py-3 font-mono text-xs text-gray-700">{transaction.txRef}</td>
                                        <td className="px-5 py-3 text-xs text-gray-600">{transaction.provider}</td>
                                        <td className="px-5 py-3 text-sm font-semibold text-gray-900">MWK {transaction.amount.toLocaleString()}</td>
                                        <td className="px-5 py-3"><StatusBadge status={transaction.status} type="booking" /></td>
                                        <td className="px-5 py-3 text-xs text-gray-500">{formatDate(transaction.date)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                            {transactionPagination.totalPages > 1 ? (
                              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 text-xs text-gray-500">
                                <span>Showing {transactionPagination.startIndex}-{transactionPagination.endIndex} of {transactionPagination.totalItems}</span>
                                <div className="flex items-center gap-2">
                                  <button type="button" onClick={() => setTransactionPage(prev => Math.max(1, prev - 1))} disabled={transactionPagination.currentPage <= 1} className="rounded-xl border border-gray-200 px-3 py-1.5 disabled:opacity-50">Previous</button>
                                  <button type="button" onClick={() => setTransactionPage(prev => Math.min(transactionPagination.totalPages, prev + 1))} disabled={transactionPagination.currentPage >= transactionPagination.totalPages} className="rounded-xl border border-gray-200 px-3 py-1.5 disabled:opacity-50">Next</button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* ── AUDIT ── */}
            {activeTab === 'audit' && (
              <div className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-xl font-black text-gray-900">Audit Log</h3>
                    <p className="text-[10px] text-gray-400 mt-1">Recent sensitive actions, role changes and company approvals are listed here with filters and status details.</p>
                  </div>
                  <button type="button" onClick={refreshAudit} className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-black text-white hover:bg-indigo-700 transition">
                    <RefreshCw className="w-4 h-4" /> Refresh audit logs
                  </button>
                </div>

                <div className="grid gap-4 xl:grid-cols-4">
                  <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-widest text-gray-400">Total events</p>
                    <p className="mt-3 text-3xl font-black text-gray-900">{auditSummary.total}</p>
                  </div>
                  <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-widest text-gray-400">Successful</p>
                    <p className="mt-3 text-3xl font-black text-emerald-700">{auditSummary.success}</p>
                  </div>
                  <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-widest text-gray-400">Failed</p>
                    <p className="mt-3 text-3xl font-black text-red-700">{auditSummary.failed}</p>
                  </div>
                  <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-widest text-gray-400">Action types</p>
                    <p className="mt-3 text-3xl font-black text-gray-900">{auditSummary.actions.length}</p>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
                  <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Action</label>
                        <select value={auditActionFilter} onChange={e => setAuditActionFilter(e.target.value)} className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-200">
                          <option value="all">All actions</option>
                          {AUDIT_ACTIONS.map(action => (
                            <option key={action} value={action}>{getActionName(action)}</option>
                          ))}
                        </select>
                      </div>
                      <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Status</label>
                        <select value={auditStatusFilter} onChange={e => setAuditStatusFilter(e.target.value as 'all' | 'success' | 'failed')} className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-200">
                          <option value="all">All statuses</option>
                          <option value="success">Success</option>
                          <option value="failed">Failed</option>
                        </select>
                      </div>
                      <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Company</label>
                        <select value={auditCompanyFilter} onChange={e => setAuditCompanyFilter(e.target.value)} className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-200">
                          <option value="">All companies</option>
                          {companyOptions.map(company => (
                            <option key={company.id} value={company.id}>{company.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-3">
                        <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
                          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">From</label>
                          <input type="date" value={auditStartDate} onChange={e => setAuditStartDate(e.target.value)} className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                        </div>
                        <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
                          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">To</label>
                          <input type="date" value={auditEndDate} onChange={e => setAuditEndDate(e.target.value)} className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input type="text" value={auditSearchTerm} onChange={e => setAuditSearchTerm(e.target.value)} placeholder="Search audit logs..." className="w-full rounded-2xl border border-gray-200 bg-white pl-10 pr-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                      </div>
                      <button type="button" onClick={refreshAudit} className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-200 transition">Refresh</button>
                    </div>

                    <div className="overflow-x-auto rounded-3xl border border-gray-100 bg-white shadow-sm">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            {['User', 'Role', 'Action', 'Resource', 'Target', 'Description', 'Status', 'When'].map(header => (
                              <th key={header} className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">{header}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {auditLoading ? (
                            <tr>
                              <td colSpan={8} className="py-12 text-center text-gray-500">Loading audit logs...</td>
                            </tr>
                          ) : filteredAuditLogs.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="py-12 text-center text-gray-500">No audit logs found</td>
                            </tr>
                          ) : (
                            filteredAuditLogs.slice(0, 12).map(renderAuditRow)
                          )}
                        </tbody>
                      </table>
                    </div>
                    {auditError ? <p className="text-sm text-red-600">{auditError}</p> : null}
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
                      <p className="text-sm font-black text-gray-900">Audit insights</p>
                      <p className="mt-3 text-sm text-gray-500">Audit logs are captured for platform access, booking and payment events. Filter by action, company, and date range to support investigations.</p>
                    </div>
                    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
                      <p className="text-sm font-black text-gray-900">Top action types</p>
                      <div className="mt-4 space-y-2">
                        {auditSummary.actions.slice(0, 6).map(action => (
                          <div key={action} className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-700">{getActionName(action)}</div>
                        ))}
                        {auditSummary.actions.length === 0 && <div className="text-sm text-gray-400">No actions to display.</div>}
                      </div>
                    </div>
                    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
                      <p className="text-sm font-black text-gray-900">Query size</p>
                      <div className="mt-3 flex items-center gap-3">
                        <input type="number" min={10} max={500} value={auditLimit} onChange={e => setAuditLimit(Math.max(10, Math.min(500, Number(e.target.value))))} className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                        <span className="text-sm text-gray-500">records</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── SYSTEM HEALTH ── */}
            {activeTab === 'health' && (
              <div className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-xl font-black text-gray-900">System Health</h3>
                    <p className="text-[10px] text-gray-400 mt-1">Key system metrics: database connectivity, email delivery readiness, and platform health signals.</p>
                  </div>
                  <button type="button" onClick={refreshHealth} className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-black text-white hover:bg-indigo-700 transition">
                    <RefreshCw className="w-4 h-4" /> Refresh health
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-widest text-gray-400">Overall status</p>
                    <p className="mt-3 text-3xl font-black text-gray-900">{healthStatus?.status ?? 'unknown'}</p>
                  </div>
                  <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-widest text-gray-400">Checks passed</p>
                    <p className="mt-3 text-3xl font-black text-emerald-700">{healthSummary.ok}</p>
                  </div>
                  <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-widest text-gray-400">Degraded</p>
                    <p className="mt-3 text-3xl font-black text-amber-700">{healthSummary.degraded}</p>
                  </div>
                  <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-widest text-gray-400">Errors</p>
                    <p className="mt-3 text-3xl font-black text-red-700">{healthSummary.error}</p>
                  </div>
                </div>

                {healthError ? <div className="rounded-3xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">{healthError}</div> : null}

                <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
                  <div className="space-y-4">
                    {healthLoading ? (
                      <div className="rounded-3xl border border-gray-100 bg-white p-8 text-center text-gray-500">Checking system health...</div>
                    ) : healthStatus ? (
                      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">Health checks</p>
                            <p className="text-xs text-gray-400">Status by dependency</p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest ${healthCheckBadge(healthStatus.status)}`}>{healthStatus.status}</span>
                        </div>
                        <div className="mt-5 grid gap-4">
                          {Object.entries(healthStatus.checks).map(([key, value]) => renderHealthMetric(key, value))}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-3xl border border-gray-100 bg-white p-8 text-center text-gray-500">No health snapshot available yet.</div>
                    )}

                    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
                      <p className="text-sm font-semibold text-gray-900">Last updated</p>
                      <p className="mt-3 text-sm text-gray-500">{healthStatus ? `${new Date(healthStatus.timestamp).toLocaleString()}` : 'Never'}</p>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
                    <p className="text-sm font-semibold text-gray-900">Health review</p>
                    <div className="mt-4 space-y-3 text-sm text-gray-500">
                      <p>Use this screen to verify that database and email dependencies are reachable and to react quickly when degraded status appears.</p>
                      <p>Refresh after making infrastructure changes or deploying new code to confirm platform health.</p>
                      <p>If the status remains degraded or unhealthy, inspect logs and dependency configurations immediately.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── BOOKINGS ── */}
            {activeTab === 'bookings' && (
              <BookingsTab bookings={bookings} companies={companies} schedules={schedules} routes={routes}
                loading={loadingStates.bookings} setError={m => showAlert('error', m)} setSuccess={m => showAlert('success', m)} />
            )}

            {/* ── PROFILE ── */}
            {activeTab === 'profile' && (
              <ProfileTab
                companies={companies}
                bookings={bookings}
                schedules={schedules}
                routes={routes}
                buses={buses}
                operators={operators}
                selectedCompanyId={selectedCompany?.id ?? null}
                onStatusChange={handleStatusChange}
                onDelete={(companyId) => {
                  const company = companies.find(c => c.id === companyId);
                  if (company) openModal('delete', company);
                }}
              />
            )}

            {/* ── ROUTES ── */}
            {activeTab === 'routes' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-xl font-black text-gray-900 tracking-tight">NATIONAL ROUTE NETWORK</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Cross-Company Transit Corridor Management</p>
                  </div>
                  <button onClick={() => {
                    exportCSV(
                      routes.map(r => [r.id, r.name, r.origin, r.destination, r.distance, r.duration, formatDate(r.createdAt as any)].join(',')),
                      'ID,Name,Origin,Destination,Distance (km),Duration (min),Created', 'routes-data.csv'
                    );
                    showAlert('success', 'Global route data exported!');
                  }} className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-5 py-2.5 rounded-xl hover:bg-indigo-100 transition-all text-[11px] font-black uppercase tracking-wider shadow-sm border border-indigo-100">
                    <Download className="w-4 h-4" /> Comprehensive Export
                  </button>
                </div>

                {routes.length === 0 ? (
                  <div className="text-center py-20 bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-100">
                    <MapPin className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">No Active Routes Registered</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-3xl shadow-[0_8px_30px_-10px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50/50">
                          <tr>
                            {['Identifier', 'Transport Corridor', 'Operational Metrics', 'Entity Status', 'Registry Date'].map(h => (
                              <th key={h} className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {routes.map(route => {
                            const routeCompany = companies.find(c => c.id === route.companyId);
                            return (
                              <tr key={route.id} className="hover:bg-gray-50/50 transition-colors group">
                                <td className="px-6 py-5">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-100 group-hover:bg-indigo-600 transition-colors">
                                      <MapIcon className="w-5 h-5 text-indigo-600 group-hover:text-white transition-colors" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-black text-gray-900 group-hover:text-indigo-600 transition-colors">{route.name}</p>
                                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{routeCompany?.name || 'GENERIC'}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-5">
                                  <div className="flex items-center gap-4">
                                    <div className="space-y-0.5">
                                      <p className="text-xs font-black text-gray-700 uppercase tracking-tight">{route.origin}</p>
                                      <p className="text-[9px] font-bold text-gray-400 uppercase leading-none">START</p>
                                    </div>
                                    <div className="flex flex-col items-center">
                                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-200" />
                                      <div className="w-[1px] h-4 bg-indigo-50" />
                                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                    </div>
                                    <div className="space-y-0.5">
                                      <p className="text-xs font-black text-gray-700 uppercase tracking-tight">{route.destination}</p>
                                      <p className="text-[9px] font-bold text-gray-400 uppercase leading-none">END</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-5">
                                  <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                      <Activity className="w-3.5 h-3.5 text-indigo-400" />
                                      <span className="text-xs font-black text-gray-900">{route.distance} <span className="text-[10px] text-gray-400 uppercase">KM</span></span>
                                    </div>
                                    <div className="w-[1px] h-3 bg-gray-100" />
                                    <div className="flex items-center gap-2">
                                      <Clock className="w-3.5 h-3.5 text-indigo-400" />
                                      <span className="text-xs font-black text-gray-900">{Math.floor(route.duration / 60)}H {route.duration % 60}M</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-5">
                                  <span className={`px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border shadow-sm ${route.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                    {route.status}
                                  </span>
                                </td>
                                <td className="px-6 py-5">
                                  <p className="text-[10px] font-black text-gray-400 uppercase">{formatDate(route.createdAt as any)}</p>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── SCHEDULES ── */}
            {activeTab === 'schedules' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-xl font-black text-gray-900 tracking-tight">GLOBAL OPERATIONS LOG</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Real-time scheduling across all platform partners</p>
                  </div>
                  <button onClick={() => {
                    exportCSV(
                      schedules.map(s => {
                        const route = routes.find(r => r.id === s.routeId);
                        return [s.id, route?.name || 'Unknown', formatDate(s.departureDateTime as any), formatDate(s.arrivalDateTime as any), `MWK ${s.price.toLocaleString()}`, s.availableSeats, s.status, formatDate(s.createdAt as any)].join(',');
                      }),
                      'ID,Route,Departure,Arrival,Price,Available Seats,Status,Created', 'schedules-data.csv'
                    );
                    showAlert('success', 'Global schedules data exported!');
                  }} className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-5 py-2.5 rounded-xl hover:bg-indigo-100 transition-all text-[11px] font-black uppercase tracking-wider shadow-sm border border-indigo-100">
                    <Download className="w-4 h-4" /> Operations Export
                  </button>
                </div>

                {schedules.length === 0 ? (
                  <div className="text-center py-20 bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-100">
                    <Calendar className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">No Active Schedules Found</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-3xl shadow-[0_8px_30px_-10px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50/50">
                          <tr>
                            {['Service Route', 'Partner Identity', 'Operational Window', 'Asset Utilization', 'Audit Status'].map(h => (
                              <th key={h} className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {schedules.map(schedule => {
                            const route = routes.find(r => r.id === schedule.routeId);
                            const scheduleCompany = companies.find(c => c.id === schedule.companyId);
                            return (
                              <tr key={schedule.id} className="hover:bg-gray-50/50 transition-colors group">
                                <td className="px-6 py-5">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-100 group-hover:bg-indigo-600 transition-colors">
                                      <Calendar className="w-5 h-5 text-indigo-600 group-hover:text-white transition-colors" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-black text-gray-900 group-hover:text-indigo-600 transition-colors truncate max-w-[200px]">{route?.name || 'GENERIC SERVICE'}</p>
                                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{route ? `${route.origin} → ${route.destination}` : 'GLOBAL CORE'}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-5">
                                  <div className="flex items-center gap-2">
                                    {scheduleCompany?.logo
                                      ? <Image src={scheduleCompany.logo} alt="Company Logo" width={24} height={24} className="w-6 h-6 rounded border object-cover" />
                                      : <Building2 className="w-6 h-6 p-1 bg-gray-50 border rounded text-gray-300" />}
                                    <p className="text-xs font-black text-gray-700 uppercase tracking-tight">{scheduleCompany?.name || 'SYSTEM CORE'}</p>
                                  </div>
                                </td>
                                <td className="px-6 py-5">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                      <p className="text-[11px] font-black text-gray-700">{formatDate(schedule.departureDateTime)}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-gray-200" />
                                      <p className="text-[11px] font-bold text-gray-400">{formatDate(schedule.arrivalDateTime)}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-5">
                                  <div className="space-y-1">
                                    <p className="text-[11px] font-black text-gray-900">MWK {schedule.price.toLocaleString()}</p>
                                    <div className="flex items-center gap-1.5">
                                      <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(schedule.availableSeats / 60) * 100}%` }} />
                                      </div>
                                      <span className="text-[9px] font-black text-gray-400 uppercase">{schedule.availableSeats} LFT</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-5">
                                  <span className={`px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border shadow-sm ${schedule.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                    {schedule.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── PROMOTIONS ── */}
            {activeTab === 'promotions' && (
              <PromotionsTab
                promotions={promotions}
                loading={loadingStates.promotions}
                onRefresh={() => setRefreshCount(r => r + 1)}
                setError={m => showAlert('error', m)}
                setSuccess={m => showAlert('success', m)}
              />
            )}

          </div>
        </main>

        {/* ── MODALS ── */}

        {/* Add Company */}
        <CreateCompanyModal 
          isOpen={modals.add} 
          onClose={() => closeModal('add')}
          onSuccess={(msg) => { showAlert('success', msg); setRefreshCount(r => r + 1); }}
          onError={(msg) => showAlert('error', msg)}
        />
        {/* Edit Company */}
        {modals.edit && selectedCompany && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b pb-4 mb-4">
                <h3 className="text-lg font-semibold">Edit Company</h3>
                <button onClick={() => closeModal('edit')} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700">Company Name</label>
                  <input type="text" id="edit-name" value={formData.name}
                    onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                    className={`mt-1 block w-full border rounded-md p-2 ${formErrors.name ? 'border-red-500' : 'border-gray-300'}`} />
                  {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
                </div>
                <div>
                  <label htmlFor="edit-email" className="block text-sm font-medium text-gray-700">Official / Admin Email</label>
                  <input type="email" id="edit-email" value={formData.email}
                    onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                    className={`mt-1 block w-full border rounded-md p-2 ${formErrors.email ? 'border-red-500' : 'border-gray-300'}`} />
                  <p className="text-[11px] text-gray-400 mt-0.5">When partnering, replace the unclaimed placeholder email with the operator's official email.</p>
                  {formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}
                </div>
                <div>
                  <label htmlFor="edit-contact" className="block text-sm font-medium text-gray-700">Contact Phone</label>
                  <input type="tel" id="edit-contact" value={formData.contact}
                    onChange={e => setFormData(p => ({ ...p, contact: e.target.value }))}
                    className={`mt-1 block w-full border rounded-md p-2 ${formErrors.contact ? 'border-red-500' : 'border-gray-300'}`} />
                  {formErrors.contact && <p className="text-red-500 text-xs mt-1">{formErrors.contact}</p>}
                </div>
                <div>
                  <label htmlFor="edit-address" className="block text-sm font-medium text-gray-700">Address</label>
                  <input type="text" id="edit-address" value={formData.address ?? ''}
                    onChange={e => setFormData(p => ({ ...p, address: e.target.value }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md p-2" />
                </div>
                <div>
                  <label htmlFor="edit-status" className="block text-sm font-medium text-gray-700">Status</label>
                  <select id="edit-status" value={formData.status} onChange={e => setFormData(p => ({ ...p, status: e.target.value as Company['status'] }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md p-2">
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-4">
                <button onClick={() => closeModal('edit')} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={handleUpdateCompany} disabled={loadingStates.updating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 flex items-center gap-2">
                  {loadingStates.updating && <Loader2 className="w-4 h-4 animate-spin" />} Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View Company */}
        {modals.view && selectedCompany && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
              <div className="flex justify-between items-center border-b pb-4 mb-4">
                <h3 className="text-lg font-semibold">{selectedCompany.name}</h3>
                <button onClick={() => closeModal('view')} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
              </div>
              <div className="space-y-4">
                {[
                  { label: 'Email', value: selectedCompany.email },
                  { label: 'Contact', value: selectedCompany.contact || 'N/A' },
                  { label: 'Address', value: selectedCompany.address || 'N/A' },
                  { label: 'Created', value: formatDate(selectedCompany.createdAt as any) },
                  { label: 'Last Updated', value: formatDate(selectedCompany.updatedAt as any) },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-sm font-medium text-gray-700">{label}</p>
                    <p className="text-sm text-gray-900">{value}</p>
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700">Status</p>
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(selectedCompany.status)}`}>
                    {getStatusIcon(selectedCompany.status)}
                    {selectedCompany.status?.charAt(0).toUpperCase()}{selectedCompany.status?.slice(1)}
                  </span>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button onClick={() => { closeModal('view'); openModal('edit', selectedCompany!); }}
                  className="px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 flex items-center gap-2">
                  <Edit className="w-4 h-4" /> Edit
                </button>
                <button onClick={() => closeModal('view')} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Company */}
        {modals.delete && selectedCompany && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-2">Confirm Delete</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete <span className="font-bold">{selectedCompany.name}</span>? This cannot be undone.
              </p>
              <div className="flex justify-end gap-4">
                <button onClick={() => closeModal('delete')} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={() => { if (typeof modals.delete === 'string') handleDeleteCompany(modals.delete); }}
                  disabled={loadingStates.deleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-300 flex items-center gap-2">
                  {loadingStates.deleting && <Loader2 className="w-4 h-4 animate-spin" />} Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Bottom Nav */}
        <DashboardBottomNav
          activeTab={activeTab}
          onTabChange={(id) => {
            setActiveTab(id as TabType);
            setIsMobileOpen(false);
          }}
          tabs={(() => {
            const base = [
              { id: 'overview', label: 'Home', icon: BarChart3 },
              { id: 'companies', label: 'Firms', icon: Building2 },
              { id: 'users', label: 'Users', icon: User2 },
              { id: 'payments', label: 'Pay', icon: CreditCard },
            ];

            return base;
          })()}
        />
      </div>
    </div>
  );
}
