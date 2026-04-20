'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import * as dbActions from '@/lib/actions/db.actions';
// Firestore removed - Using SQL via API routes
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
  SortDesc,
  Eye,
  BarChart3,
  List,
  User,
  DollarSign,
  Calendar,
  Map,
  Download,
  Phone,
  Mail,
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
} from 'lucide-react';
import AlertMessage from '../../components/AlertMessage';
import { Company, UserProfile, Booking, Schedule, Route, Bus, OperatorProfile, ConductorProfile } from '@/types/index';
import TabButton from '@/components/tabButton';

// ─── Kinetic Theme Components ───────────────────────────────────────────────

const KineticStatCard: React.FC<{
  title: string;
  value: string | number;
  icon: any;
  iconBg: string;
  iconColor: string;
  badge?: { text: string; className: string };
  subtitle?: string;
}> = ({ title, value, icon: Icon, iconBg, iconColor, badge, subtitle }) => (
  <div className="bg-white rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] p-5 relative overflow-hidden flex flex-col justify-between min-h-[140px] border border-gray-100 transition-all hover:shadow-md group">
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
  </div>
);

// ─── StatusBadge ──────────────────────────────────────────────────────────────
const StatusBadge: React.FC<{ status: string; type?: 'booking' | 'company' }> = ({
  status,
  type = 'company',
}) => {
  const lower = status?.toLowerCase() || 'unknown';
  let color = 'bg-gray-100 text-gray-800';
  let Icon: React.FC<{ className?: string }> = AlertCircle;

  if (type === 'company') {
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

// ─── Types ────────────────────────────────────────────────────────────────────
type StatusFilter = 'all' | 'active' | 'inactive' | 'pending';
type SortBy = 'name' | 'createdAt' | 'status' | 'email';
type SortOrder = 'asc' | 'desc';
type TabType = 'overview' | 'companies' | 'bookings' | 'profile' | 'routes' | 'schedules';

interface AlertState { type: 'error' | 'success' | 'warning' | 'info'; message: string; id: string; }
interface FormErrors { name?: string; email?: string; contact?: string; adminPhone?: string; adminFirstName?: string; adminLastName?: string; }
interface LoadingStates { companies: boolean; bookings: boolean; creating: boolean; updating: boolean; deleting: boolean; initializing: boolean; }

interface DashboardStats {
  totalCompanies: number; activeCompanies: number; pendingCompanies: number; inactiveCompanies: number;
  totalRevenue: number; monthlyRevenue: number; totalBookings: number; monthlyBookings: number;
  monthlyGrowth: number; revenueGrowth: number;
}

interface CreateCompanyRequest {
  name: string; email: string; contact: string; status: Company['status'];
  address?: string; description?: string; adminFirstName?: string; adminLastName?: string; adminPhone?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const COMPANIES_PER_PAGE = 10;
const BOOKINGS_PER_PAGE = 10;
const MONTHLY_BOOKING_MULTIPLIER = 0.3;
const DEFAULT_GROWTH_RATES = { monthly: 12.5, revenue: 18.2 } as const;

const STATUS_CONFIG = {
  active: { color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
  pending: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock },
  inactive: { color: 'bg-red-100 text-red-800 border-red-200', icon: Ban },
} as const;

// ─── Utilities ────────────────────────────────────────────────────────────────
const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validatePhone = (phone: string) => !phone || /^\+?[\d\s\-()]{8,15}$/.test(phone);

const convertTimestamp = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  // Handle complex objects that might be firestore-like or custom
  const obj = value as Record<string, unknown>;
  if (typeof obj.toDate === 'function') return (obj.toDate as () => Date)();
  return null;
};

const formatDate = (date: Date | string | number | undefined | null): string => {
  if (!date) return '—';
  const d = convertTimestamp(date);
  if (!d) return 'Invalid date';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(d);
};

const debounce = <T extends (...args: unknown[]) => void>(func: T, wait: number) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
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
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Loading bookings...</p>
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

// ─── PaymentSettingsModal ─────────────────────────────────────────────────────
const PaymentSettingsModal: React.FC<{
  company: Company;
  onClose: () => void;
  onSaved: (updated: Company) => void;
  showAlert: (type: 'success' | 'error' | 'info' | 'warning', msg: string) => void;
}> = ({ company, onClose, onSaved, showAlert }) => {
  const ps = company.paymentSettings ?? {};

  const [paychanguEnabled, setPaychanguEnabled] = useState<boolean>(ps.paychanguEnabled ?? false);
  const [paychanguReceiveNumber, setPaychanguReceiveNumber] = useState<string>(ps.paychanguReceiveNumber ?? '');
  const [paychanguPublicKey, setPaychanguPublicKey] = useState<string>(ps.paychanguPublicKey ?? '');
  // Secret key field — always blank on load (never sent back to the browser)
  // Only populated when the admin types a new key. Empty = keep existing encrypted value.
  const [paychanguSecretKey, setPaychanguSecretKey] = useState<string>('');
  const [secretKeySet, setSecretKeySet] = useState<boolean>(!!ps.paychanguSecretKeyEnc);
  const [showSecret, setShowSecret] = useState<boolean>(false);

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (paychanguEnabled) {
      if (!paychanguReceiveNumber.trim())
        e.receiveNumber = 'Receive number is required when PayChangu is enabled';
      else if (!/^\+?[\d\s\-]{7,15}$/.test(paychanguReceiveNumber))
        e.receiveNumber = 'Enter a valid phone number';
      if (paychanguPublicKey.trim() && !paychanguPublicKey.startsWith('pub-'))
        e.publicKey = 'Public key should start with pub-';
      // Secret key required on first save; optional on updates (keep existing if blank)
      if (!secretKeySet && !paychanguSecretKey.trim())
        e.secretKey = 'Secret key is required — enter the sec-... key from your PayChangu dashboard';
      if (paychanguSecretKey.trim() && !paychanguSecretKey.trim().toLowerCase().startsWith('sec-'))
        e.secretKey = 'Secret key should start with sec-';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      // Encrypt the secret key server-side — the plaintext never goes to Firestore directly
      let paychanguSecretKeyEnc: string | undefined = ps.paychanguSecretKeyEnc; // keep existing if not changed
      if (paychanguSecretKey.trim()) {
        const res = await fetch('/api/admin/encrypt-paychangu-key', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ companyId: company.id, secretKey: paychanguSecretKey.trim().toLowerCase() }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to encrypt secret key');
        }
        const data = await res.json();
        paychanguSecretKeyEnc = data.encrypted; // server returns the encrypted blob
      }

      const updated: Company['paymentSettings'] = Object.fromEntries(
        Object.entries({
          paychanguEnabled,
          paychanguReceiveNumber: paychanguReceiveNumber.trim() || null,
          paychanguPublicKey: paychanguPublicKey.trim() || null,
          paychanguSecretKeyEnc: paychanguSecretKeyEnc ?? null,
        }).filter(([, v]) => v !== undefined)
      ) as Company['paymentSettings'];

      const result = await dbActions.updateCompany(company.id, {
        paymentSettings: updated,
        updatedAt: new Date(),
      });
      if (!result.success) throw new Error(result.error);

      onSaved({ ...company, paymentSettings: updated });
      showAlert('success', `Payment settings saved for ${company.name}`);
      onClose();
    } catch (e: unknown) {
      showAlert('error', `Failed to save: ${(e as any).message}`);
    } finally {
      setSaving(false);
    }
  };



  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Payment Settings</h3>
              <p className="text-xs text-gray-500 truncate max-w-[200px]">{company.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">

          {/* ── PayChangu ── */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-black text-white text-sm">P</div>
                <span className="font-semibold text-gray-900">PayChangu</span>
              </div>
              <button type="button" onClick={() => setPaychanguEnabled(v => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${paychanguEnabled ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${paychanguEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className={`space-y-3 transition-opacity ${paychanguEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              {/* Receive number */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Receive Number <span className="text-gray-400 font-normal">(mobile money number)</span>
                </label>
                <input type="tel" value={paychanguReceiveNumber}
                  onChange={e => setPaychanguReceiveNumber(e.target.value)}
                  placeholder="+265 99X XXX XXX"
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${errors.receiveNumber ? 'border-red-400' : 'border-gray-300'}`} />
                {errors.receiveNumber && <p className="text-red-500 text-xs mt-1">{errors.receiveNumber}</p>}
              </div>

              {/* Secret key — encrypted server-side, never stored plaintext */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Secret Key <span className="text-gray-400 font-normal">(sec-...)</span>
                  {secretKeySet && (
                    <span className="ml-2 inline-flex items-center gap-1 text-emerald-600">
                      <CheckCircle className="w-3 h-3" /> stored encrypted
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    value={paychanguSecretKey}
                    onChange={e => setPaychanguSecretKey(e.target.value)}
                    placeholder={secretKeySet ? '••••••••  (leave blank to keep existing)' : 'sec-xxxxxxxxxxxxxxxx'}
                    className={`w-full px-3 py-2 pr-10 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${errors.secretKey ? 'border-red-400' : 'border-gray-300'}`}
                  />
                  <button type="button" onClick={() => setShowSecret(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">
                    {showSecret ? 'hide' : 'show'}
                  </button>
                </div>
                {errors.secretKey && <p className="text-red-500 text-xs mt-1">{errors.secretKey}</p>}
                <p className="text-xs text-gray-400 mt-1">
                  Encrypted with AES-256-GCM before being stored. The encryption key lives only in your server env vars.
                </p>
              </div>

              {/* Public key */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Public Key <span className="text-gray-400 font-normal">(pub-... optional)</span>
                </label>
                <input type="text" value={paychanguPublicKey}
                  onChange={e => setPaychanguPublicKey(e.target.value)}
                  placeholder="pub-xxxxxxxxxxxxxxxx"
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${errors.publicKey ? 'border-red-400' : 'border-gray-300'}`} />
                {errors.publicKey && <p className="text-red-500 text-xs mt-1">{errors.publicKey}</p>}
              </div>
            </div>

            {/* Status pill */}
            <div className="mt-3 flex items-center gap-2">
              {paychanguEnabled && paychanguReceiveNumber
                ? <><Wifi className="w-3.5 h-3.5 text-emerald-500" /><span className="text-xs text-emerald-700 font-medium">Active — {paychanguReceiveNumber}</span></>
                : <><WifiOff className="w-3.5 h-3.5 text-gray-400" /><span className="text-xs text-gray-400">Not configured</span></>}
            </div>
          </section>


        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-white transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors font-medium">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

// ── helpers ───────────────────────────────────────────────────────────────────
const fmt = (d: unknown): string => {
  if (!d) return '—';
  const date = convertTimestamp(d);
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
};

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  active: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', icon: <CheckCircle className="w-3.5 h-3.5" /> },
  pending: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: <Clock className="w-3.5 h-3.5" /> },
  inactive: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', icon: <Ban className="w-3.5 h-3.5" /> },
};

// ── sub-components ────────────────────────────────────────────────────────────
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
  openPaymentSettingsModal: (company: Company) => void;
  onStatusChange: (companyId: string, status: Company['status']) => void;
}

const ProfileTab: React.FC<ProfileTabProps> = ({
  companies, bookings, schedules, routes, buses = [], operators = [], openPaymentSettingsModal, onStatusChange,
}) => {
  const [selected, setSelected] = useState<Company | null>(null);
  const [search, setSearch] = useState('');

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

    const recentBookings = companyBookings
      .slice()
      .sort((a, b) => {
        const at = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
        const bt = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
        return bt - at;
      })
      .slice(0, 5);

    return {
      totalRevenue, totalBookings: companyBookings.length,
      confirmedBookings, pendingBookings, cancelledBookings, completedBookings,
      totalSchedules: companySchedules.length, activeSchedules,
      totalRoutes: companyRoutes.length, activeRoutes,
      totalBuses: companyBuses.length, activeBuses,
      totalOperators: companyOperators.length,
      recentBookings,
      companyRoutes: companyRoutes.slice(0, 5),
      companyBuses: companyBuses.slice(0, 4),
      companyOperators: companyOperators.slice(0, 5),
      ps: selected.paymentSettings,
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
                  ? <img src={company.logo} alt={company.name} className="w-8 h-8 rounded-lg object-cover shrink-0" />
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
                  ? <img src={selected.logo} alt={selected.name} className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-md" />
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
                <div className="flex items-center bg-gray-50 border border-gray-100 rounded-xl p-1 shadow-sm">
                  {(['active', 'pending', 'inactive'] as Company['status'][]).map((status) => {
                    const isSelected = selected.status === status;
                    const style = isSelected ? STATUS_STYLES[status] : null;
                    const label = status === 'inactive' ? 'Pause' : status;

                    return (
                      <button
                        key={status}
                        onClick={() => onStatusChange(selected.id, status)}
                        className={`flex items-center gap-1.5 px-4 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all ${isSelected
                            ? `${style?.bg} ${style?.text} shadow-sm`
                            : 'text-gray-400 hover:text-gray-600 hover:bg-white'
                          }`}
                      >
                        <span className="capitalize">{label}</span>
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => openPaymentSettingsModal(selected)}
                  className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-indigo-600 border-2 border-indigo-100 bg-white rounded-xl hover:bg-indigo-50 hover:border-indigo-200 transition-all shadow-sm">
                  <CreditCard className="w-4 h-4" /> Gateway Config
                </button>
              </div>
            </div>

            {/* ── Key Performance Indicators ── */}
            {stats && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KineticStatCard
                  title="Total Revenue"
                  value={`MWK ${stats.totalRevenue.toLocaleString()}`}
                  icon={DollarSign}
                  iconBg="bg-blue-50" iconColor="text-blue-600"
                  subtitle={`${stats.confirmedBookings} confirmed bookings`}
                />
                <KineticStatCard
                  title="Fleet Status"
                  value={stats.activeBuses}
                  icon={BusIcon}
                  iconBg="bg-green-50" iconColor="text-green-600"
                  subtitle={`${stats.totalBuses} registered buses`}
                />
                <KineticStatCard
                  title="Team Strength"
                  value={stats.totalOperators}
                  icon={User2}
                  iconBg="bg-indigo-50" iconColor="text-indigo-600"
                  subtitle="Active operators/conductors"
                />
                <KineticStatCard
                  title="Connectivity"
                  value={stats.activeRoutes}
                  icon={MapPin}
                  iconBg="bg-purple-50" iconColor="text-purple-600"
                  subtitle={`${stats.totalRoutes} route networks`}
                />
              </div>
            )}

            {/* ── Subscription / Billing ── */}
            <div className="bg-indigo-900 rounded-2xl p-6 text-white shadow-xl shadow-indigo-100 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl opacity-50" />
              <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold">Enterprise Plan</h3>
                      <span className="px-2 py-0.5 bg-white/20 rounded text-[10px] font-black uppercase tracking-widest">Active</span>
                    </div>
                    <p className="text-white/60 text-sm">Next billing cycle starts May 1st, 2026</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="px-5 py-2.5 bg-white text-indigo-900 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-100 transition-colors shadow-lg">
                    Change Plan
                  </button>
                  <button className="px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-black uppercase tracking-widest transition-colors backdrop-blur-md">
                    View Invoices
                  </button>
                </div>
              </div>
            </div>

            {/* ── Detailed Breakdown ── */}
            {stats && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bookings Analysis */}
                <div className="bg-white rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-gray-100 p-6">
                  <SectionHeading icon={<Activity className="w-5 h-5" />} label="Booking Fulfillment" />
                  <div className="space-y-4 mt-4">
                    {[
                      { label: 'Confirmed (Paid)', value: stats.confirmedBookings, color: 'bg-indigo-600' },
                      { label: 'In Progress (Pending)', value: stats.pendingBookings, color: 'bg-amber-400' },
                      { label: 'Completed Trips', value: stats.completedBookings, color: 'bg-emerald-500' },
                      { label: 'Failed / Cancelled', value: stats.cancelledBookings, color: 'bg-red-400' },
                    ].map(item => {
                      const pct = stats.totalBookings > 0 ? Math.round((item.value / stats.totalBookings) * 100) : 0;
                      return (
                        <div key={item.label}>
                          <div className="flex justify-between items-end mb-1.5">
                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest leading-none">{item.label}</span>
                            <span className="text-sm font-black text-gray-900 leading-none">{item.value} <span className="text-[10px] font-bold text-gray-400 uppercase ml-1">({pct}%)</span></span>
                          </div>
                          <div className="h-1.5 bg-gray-50 rounded-full overflow-hidden">
                            <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Regional Activity */}
                <div className="bg-white rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-gray-100 p-6">
                  <SectionHeading icon={<MapPin className="w-5 h-5" />} label="Recent Operations" />
                  <div className="mt-4 space-y-3">
                    {stats.recentBookings.length > 0 ? stats.recentBookings.map(b => (
                      <div key={b.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors border border-gray-100">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center font-mono text-[10px] font-black text-indigo-600 border border-gray-100">
                            {b.bookingReference?.substring(0, 2) || 'BK'}
                          </div>
                          <div>
                            <p className="text-xs font-black text-gray-900 leading-none mb-1">{b.bookingReference || b.id.substring(0, 8)}</p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{fmt(b.createdAt)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-black text-gray-900 leading-none mb-1">MWK {b.totalAmount?.toLocaleString()}</p>
                          <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${b.bookingStatus === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                            {b.bookingStatus}
                          </span>
                        </div>
                      </div>
                    )) : (
                      <div className="h-40 flex flex-col items-center justify-center text-center opacity-40">
                        <Layers className="w-8 h-8 mb-2" />
                        <p className="text-xs font-bold uppercase tracking-widest">No Recent Data</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

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
  const [routes, setRoutes] = useState<Route[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [operators, setOperators] = useState<(OperatorProfile | ConductorProfile)[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalCompanies: 0, activeCompanies: 0, pendingCompanies: 0, inactiveCompanies: 0,
    totalRevenue: 0, monthlyRevenue: 0, totalBookings: 0, monthlyBookings: 0,
    monthlyGrowth: 0, revenueGrowth: 0,
  });

  const [refreshCount, setRefreshCount] = useState(0);

  const [loadingStates, setLoadingStates] = useState<LoadingStates>({
    companies: true, bookings: true, creating: false, updating: false, deleting: false, initializing: true,
  });

  const [alerts, setAlerts] = useState<AlertState[]>([]);
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const [modals, setModals] = useState({
    add: false, edit: false, view: false, delete: null as string | null,
  });
  const [paymentModalCompany, setPaymentModalCompany] = useState<Company | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  const [formData, setFormData] = useState<CreateCompanyRequest>({
    name: '', email: '', contact: '', status: 'pending',
    address: '', description: '', adminFirstName: '', adminLastName: '', adminPhone: '',
  });

  const isAuthorized = useMemo(() => userProfile?.role === 'superadmin', [userProfile?.role]);

  // ── Alerts ─────────────────────────────────────────────────────────────────
  const showAlert = useCallback((type: AlertState['type'], message: string) => {
    const id = Date.now().toString();
    setAlerts(prev => [...prev, { type, message, id }]);
    if (type === 'success' || type === 'info') {
      setTimeout(() => setAlerts(prev => prev.filter(a => a.id !== id)), 5000);
    }
  }, []);

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

  // ── Stats ──────────────────────────────────────────────────────────────────
  const calculateStats = useCallback((companyList: Company[], bookingList: Booking[]) => {
    try {
      const totalRevenue = bookingList.reduce((sum, b) =>
        b.bookingStatus !== 'cancelled' ? sum + (b.totalAmount || 0) : sum, 0);
      setStats({
        totalCompanies: companyList.length,
        activeCompanies: companyList.filter(c => c.status === 'active').length,
        pendingCompanies: companyList.filter(c => c.status === 'pending').length,
        inactiveCompanies: companyList.filter(c => c.status === 'inactive').length,
        totalRevenue,
        monthlyRevenue: totalRevenue * MONTHLY_BOOKING_MULTIPLIER,
        totalBookings: bookingList.length,
        monthlyBookings: Math.floor(bookingList.length * MONTHLY_BOOKING_MULTIPLIER),
        monthlyGrowth: DEFAULT_GROWTH_RATES.monthly,
        revenueGrowth: DEFAULT_GROWTH_RATES.revenue,
      });
    } catch (e) {
      console.error('Error calculating stats:', e);
      showAlert('error', 'Failed to calculate dashboard statistics');
    }
  }, [showAlert]);

  // ── Data fetching ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/'); return; }
    if (!userProfile) return;
    if (userProfile.role !== 'superadmin') { showAlert('error', "You don't have permission."); router.push('/'); return; }

    setLoadingState('initializing', true);

    const fetchDashboardData = async () => {
      try {
        const res = await fetch('/api/admin/data');
        if (!res.ok) throw new Error('Failed to fetch dashboard data');
        const { data } = await res.json();

        setCompanies(data.companies);
        setBookings(data.bookings);
        setSchedules(data.schedules);
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

    fetchDashboardData();
  }, [user, userProfile, authLoading, router, showAlert, setLoadingState, refreshCount]);

  useEffect(() => { calculateStats(companies, bookings); }, [companies, bookings, calculateStats]);

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
        contact: formData.contact?.trim() || '',
        address: formData.address?.trim() || '',
        description: formData.description?.trim() || '',
        status: formData.status,
        updatedAt: new Date(),
      });
      if (!result.success) throw new Error(result.error);
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

  // ── Placeholder for payment settings modal (wire up your own) ─────────────
  const openPaymentSettingsModal = useCallback((company: Company) => {
    setPaymentModalCompany(company);
  }, []);

  // ── Search / filter / sort ─────────────────────────────────────────────────
  const debouncedResetPage = useMemo(() => debounce(() => setCurrentPage(1), 300), []);

  const filteredAndSortedCompanies = useMemo(() => {
    return companies
      .filter(c => {
        const sl = searchTerm.toLowerCase();
        return (!searchTerm || c.name.toLowerCase().includes(sl) || c.email.toLowerCase().includes(sl))
          && (statusFilter === 'all' || c.status === statusFilter);
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
  }, [companies, searchTerm, statusFilter, sortBy, sortOrder]);

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

  useEffect(() => { setCurrentPage(1); }, [statusFilter, sortBy, sortOrder]);

  // ── Status helpers ─────────────────────────────────────────────────────────
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
      ['Monthly Growth', `${stats.monthlyGrowth}%`],
      ['Revenue Growth', `${stats.revenueGrowth}%`],
      ['Active Routes', routes.length.toString()],
      ['Active Schedules', schedules.length.toString()],
    ].map(r => r.join(',')), 'Metric,Value', 'dashboard-stats.csv');
    showAlert('success', 'Stats exported!');
  };

  // ── Loading / auth guards ──────────────────────────────────────────────────
  if (authLoading || loadingStates.initializing) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
        <p className="text-gray-600">{authLoading ? 'Authenticating...' : 'Loading Dashboard...'}</p>
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
  const SidebarItem = ({ id, label, icon: Icon }: { id: TabType; label: string; icon: any }) => {
    const isActive = activeTab === id;
    return (
      <button
        onClick={() => setActiveTab(id)}
        className={`w-full flex items-center group transition-all duration-200 relative rounded-xl h-11 px-4 space-x-3 mb-1 ${isActive ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
          }`}
      >
        <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'group-hover:text-indigo-600 text-gray-400'}`} />
        <span className="text-[13px] font-bold flex-1 text-left truncate">{label}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 h-screen sticky top-0 flex flex-col z-50 overflow-hidden">
        <div className="p-6 mb-2 flex items-center space-x-3">
          <div className="w-10 h-10 bg-indigo-900 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-indigo-900 text-[15px] leading-tight">Super Admin</h1>
            <p className="text-[10px] text-gray-400 font-bold tracking-wider uppercase">Platform Control</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pt-2">
          <SidebarItem id="overview" label="Overview" icon={BarChart3} />
          <SidebarItem id="companies" label="Companies" icon={Building2} />
          <SidebarItem id="bookings" label="Bookings" icon={List} />
          <SidebarItem id="routes" label="Routes" icon={Map} />
          <SidebarItem id="schedules" label="Schedules" icon={Calendar} />
          <SidebarItem id="profile" label="Profiles" icon={User} />

          <div className="pt-4 mt-4 border-t border-gray-50">
            <button
              onClick={signOut}
              className="w-full flex items-center group transition-all duration-200 relative rounded-xl h-11 px-4 space-x-3 text-red-500 hover:bg-red-50"
            >
              <Loader2 className="w-5 h-5 flex-shrink-0 group-hover:rotate-180 transition-transform" />
              <span className="text-[13px] font-bold">Sign Out</span>
            </button>
          </div>
        </nav>

        <div className="p-4 bg-gray-50/50 m-3 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-900 flex items-center justify-center text-[10px] font-black text-white">
              SA
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-gray-900 truncate">{userProfile?.firstName || 'Admin'}</p>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <p className="text-[10px] font-bold text-gray-500 uppercase">Super User</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-40 px-8 py-4 flex justify-between items-center h-[73px]">
          <div>
            <h2 className="text-[20px] font-bold text-gray-900 tracking-tight capitalize">
              {activeTab} Dashboard
            </h2>
            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest leading-none mt-1">
              Final Production Release v1.0
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setRefreshCount(r => r + 1)} className="p-2 text-gray-400 hover:bg-gray-50 rounded-lg transition-all" title="Refresh Data">
              <RefreshCw className={`w-4 h-4 ${loadingStates.initializing ? 'animate-spin' : ''}`} />
            </button>
            <div className="h-8 w-[1px] bg-gray-100" />
            <div className="flex items-center gap-3 pl-2">
              <div className="text-right">
                <p className="text-[12px] font-bold text-gray-900 leading-none">System Live</p>
                <p className="text-[10px] text-green-500 font-bold uppercase mt-1">All Systems Nominal</p>
              </div>
              <div className="w-9 h-9 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xs ring-4 ring-indigo-50/50">
                {userProfile?.firstName?.[0] || 'A'}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-8 overflow-y-auto">
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <KineticStatCard title="Total Companies" value={stats.totalCompanies} icon={Building2} iconBg="bg-blue-50" iconColor="text-blue-600" />
                  <KineticStatCard title="Total Revenue" value={`MWK ${stats.totalRevenue.toLocaleString()}`} icon={DollarSign} iconBg="bg-emerald-50" iconColor="text-emerald-600" subtitle={`MWK ${stats.monthlyRevenue.toLocaleString()} this month`} />
                  <KineticStatCard title="Total Bookings" value={stats.totalBookings} icon={List} iconBg="bg-indigo-50" iconColor="text-indigo-600" badge={{ text: `${stats.monthlyGrowth}% UP`, className: 'bg-green-100 text-green-700' }} />
                  <KineticStatCard title="Active Routes" value={routes.length} icon={Map} iconBg="bg-violet-50" iconColor="text-violet-600" />
                  <KineticStatCard title="Active Companies" value={stats.activeCompanies} icon={CheckCircle} iconBg="bg-green-50" iconColor="text-green-600" />
                  <KineticStatCard title="Pending Review" value={stats.pendingCompanies} icon={Clock} iconBg="bg-amber-50" iconColor="text-amber-600" badge={stats.pendingCompanies > 0 ? { text: 'ACTION', className: 'bg-amber-100 text-amber-700' } : undefined} />
                  <KineticStatCard title="Schedules Live" value={schedules.length} icon={Calendar} iconBg="bg-sky-50" iconColor="text-sky-600" />
                  <KineticStatCard title="Revenue Growth" value={`${stats.revenueGrowth}%`} icon={TrendingUp} iconBg="bg-rose-50" iconColor="text-rose-600" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Recent Activity / System Integrity */}
                  <div className="bg-white rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-gray-100 p-6">
                    <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-indigo-600" /> System Activity Summary
                    </h3>
                    <div className="space-y-4">
                      {[
                        { label: 'Active Subscriptions', value: stats.activeCompanies, total: stats.totalCompanies, color: 'bg-indigo-600' },
                        { label: 'Booking Fulfillment', value: stats.totalBookings - stats.pendingCompanies, total: stats.totalBookings, color: 'bg-emerald-500' },
                        { label: 'Platform Uptime', value: 99.9, total: 100, color: 'bg-blue-500' },
                      ].map(item => (
                        <div key={item.label}>
                          <div className="flex justify-between text-xs font-bold mb-1.5">
                            <span className="text-gray-500 uppercase tracking-wider">{item.label}</span>
                            <span className="text-gray-900">{item.value} / {item.total}</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${(item.value / item.total) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="bg-white rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-gray-100 p-6 flex flex-col">
                    <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Plus className="w-5 h-5 text-indigo-600" /> Administrative Actions
                    </h3>
                    <div className="grid grid-cols-2 gap-3 flex-1">
                      <button onClick={() => openModal('add')} className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-indigo-50/50 hover:bg-indigo-50 border border-indigo-100 border-dashed transition-all group">
                        <Building2 className="w-6 h-6 text-indigo-600 group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-bold text-indigo-900">Add Company</span>
                      </button>
                      <button onClick={exportStatsData} className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-emerald-50/50 hover:bg-emerald-50 border border-emerald-100 border-dashed transition-all group">
                        <Download className="w-6 h-6 text-emerald-600 group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-bold text-emerald-900">Export Stats</span>
                      </button>
                      <button onClick={() => setActiveTab('companies')} className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-amber-50/50 hover:bg-amber-50 border border-amber-100 border-dashed transition-all group">
                        <UserCheck className="w-6 h-6 text-amber-600 group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-bold text-amber-900">Audit Companies</span>
                      </button>
                      <button onClick={() => setActiveTab('bookings')} className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-violet-50/50 hover:bg-violet-50 border border-violet-100 border-dashed transition-all group">
                        <CreditCard className="w-6 h-6 text-violet-600 group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-bold text-violet-900">Global Bookings</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── COMPANIES ── */}
            {activeTab === 'companies' && (
              <div className="space-y-6">
                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                  <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input type="text" placeholder="Search companies..." value={searchTerm}
                      onChange={e => { setSearchTerm(e.target.value); debouncedResetPage(); }}
                      className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                      className="bg-white border-gray-200 rounded-xl px-3 py-2 text-sm font-bold text-gray-600 focus:ring-2 focus:ring-indigo-500 min-w-[120px]">
                      <option value="all">All Status</option>
                      <option value="active">Active</option>
                      <option value="pending">Pending</option>
                      <option value="inactive">Inactive</option>
                    </select>
                    <button onClick={() => setSortOrder(p => p === 'asc' ? 'desc' : 'asc')}
                      className="p-2.5 bg-white border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors shadow-sm">
                      {sortOrder === 'asc' ? <SortAsc className="w-4 h-4 text-gray-600" /> : <SortDesc className="w-4 h-4 text-gray-600" />}
                    </button>
                    <button onClick={exportCompaniesData}
                      className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl hover:bg-emerald-100 transition-colors text-sm font-black uppercase tracking-wider">
                      <Download className="w-4 h-4" /> Export
                    </button>
                    <button onClick={() => openModal('add')}
                      className="flex items-center gap-2 bg-indigo-900 text-white px-5 py-2 rounded-xl hover:bg-indigo-800 transition-all text-sm font-black uppercase tracking-wider shadow-lg shadow-indigo-100">
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
                              {['Company Identity', 'Operational Contact', 'Network Size', 'Subscription', 'Status', 'Actions'].map(h => (
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
                                      ? <img src={company.logo} alt={company.name} className="h-11 w-11 rounded-xl object-cover border-2 border-white shadow-sm" />
                                      : <div className="h-11 w-11 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100">
                                        <Building2 className="w-5 h-5 text-indigo-600" />
                                      </div>}
                                    <div className="min-w-0">
                                      <p className="text-sm font-black text-gray-900 leading-none mb-1 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{company.name}</p>
                                      <p className="text-[11px] font-bold text-gray-400 truncate flex items-center gap-1.5 lowercase">
                                        <Mail className="w-3 h-3" />{company.email}
                                      </p>
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
                                  <div className="flex items-center gap-3">
                                    <div className="flex -space-x-2">
                                      {[...Array(3)].map((_, i) => (
                                        <div key={i} className={`w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-black text-white ${['bg-indigo-400', 'bg-blue-400', 'bg-violet-400'][i]}`}>
                                          {['B', 'R', 'O'][i]}
                                        </div>
                                      ))}
                                    </div>
                                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">
                                      Active Assets
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-amber-50 text-amber-700 border border-amber-100">
                                      {company.planType || 'BASIC'}
                                    </span>
                                    {company.paymentSettings?.paychanguEnabled && (
                                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Gateway Online" />
                                    )}
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
                openPaymentSettingsModal={openPaymentSettingsModal}
                onStatusChange={handleStatusChange}
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
                                      <Map className="w-5 h-5 text-indigo-600 group-hover:text-white transition-colors" />
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
                                      ? <img src={scheduleCompany.logo} className="w-6 h-6 rounded border object-cover" />
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
          </div>
        </main>

        {/* ── MODALS ── */}

        {/* Add Company */}
        {modals.add && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b pb-4 mb-4">
                <h3 className="text-lg font-semibold">Add New Company</h3>
                <button onClick={() => closeModal('add')} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
              </div>
              <div className="space-y-4">
                {([
                  { id: 'name', label: 'Company Name', type: 'text', key: 'name', err: formErrors.name },
                  { id: 'email', label: 'Admin Email', type: 'email', key: 'email', err: formErrors.email },
                  { id: 'adminFirstName', label: 'Admin First Name', type: 'text', key: 'adminFirstName', err: undefined },
                  { id: 'adminLastName', label: 'Admin Last Name', type: 'text', key: 'adminLastName', err: undefined },
                  { id: 'adminPhone', label: 'Admin Phone (opt.)', type: 'tel', key: 'adminPhone', err: formErrors.adminPhone },
                  { id: 'contact', label: 'Contact Phone', type: 'tel', key: 'contact', err: formErrors.contact },
                ] as const).map(({ id, label, type, key, err }) => (
                  <div key={id}>
                    <label htmlFor={`add-${id}`} className="block text-sm font-medium text-gray-700">{label}</label>
                    <input type={type} id={`add-${id}`} value={(formData as unknown as Record<string, unknown>)[key] as string ?? ''}
                      onChange={e => setFormData(p => ({ ...p, [key]: e.target.value }))}
                      className={`mt-1 block w-full border rounded-md p-2 ${err ? 'border-red-500' : 'border-gray-300'}`} />
                    {err && <p className="text-red-500 text-xs mt-1">{err}</p>}
                  </div>
                ))}
                <div>
                  <label htmlFor="add-status" className="block text-sm font-medium text-gray-700">Status</label>
                  <select id="add-status" value={formData.status} onChange={e => setFormData(p => ({ ...p, status: e.target.value as Company['status'] }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md p-2">
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-4">
                <button onClick={() => closeModal('add')} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={handleCreateCompany} disabled={loadingStates.creating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 flex items-center gap-2">
                  {loadingStates.creating && <Loader2 className="w-4 h-4 animate-spin" />} Create
                </button>
              </div>
            </div>
          </div>
        )}

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
                  <label htmlFor="edit-email" className="block text-sm font-medium text-gray-700">Admin Email</label>
                  <input type="email" id="edit-email" value={formData.email} disabled
                    className="mt-1 block w-full border border-gray-300 rounded-md p-2 bg-gray-50 text-gray-500 cursor-not-allowed" />
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

        {/* ── Payment Settings Modal ── */}
        {paymentModalCompany && user && (
          <PaymentSettingsModal
            company={paymentModalCompany}
            onClose={() => setPaymentModalCompany(null)}
            onSaved={updated => {
              setCompanies(prev => prev.map(c => c.id === updated.id ? updated : c));
              setPaymentModalCompany(null);
            }}
            showAlert={showAlert}
          />
        )}
      </div>
    </div>
  );
}
