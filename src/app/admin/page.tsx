'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebaseConfig';
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  Timestamp,
  query,
  orderBy,
} from 'firebase/firestore';
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
} from 'lucide-react';
import AlertMessage from '../../components/AlertMessage';
import { Company, UserProfile, Booking, Schedule, Route, Bus, OperatorProfile, ConductorProfile } from '@/types/index';
import TabButton from '@/components/tabButton';
import StatCard from '@/components/startCard';

// ─── StatusBadge ──────────────────────────────────────────────────────────────
const StatusBadge: React.FC<{ status: string; type?: 'booking' | 'company' }> = ({
  status,
  type = 'company',
}) => {
  const lower = status?.toLowerCase() || 'unknown';
  let color = 'bg-gray-100 text-gray-800';
  let Icon: React.FC<{ className?: string }> = AlertCircle;

  if (type === 'company') {
    if (lower === 'active')   { color = 'bg-green-100 text-green-800 border-green-200';  Icon = CheckCircle; }
    if (lower === 'pending')  { color = 'bg-yellow-100 text-yellow-800 border-yellow-200'; Icon = Clock; }
    if (lower === 'inactive') { color = 'bg-red-100 text-red-800 border-red-200';        Icon = Ban; }
  } else {
    if (lower === 'confirmed') { color = 'bg-green-100 text-green-800';  Icon = CheckCircle; }
    if (lower === 'pending')   { color = 'bg-yellow-100 text-yellow-800'; Icon = Clock; }
    if (lower === 'completed') { color = 'bg-blue-100 text-blue-800';    Icon = CheckCircle; }
    if (lower === 'cancelled') { color = 'bg-red-100 text-red-800';      Icon = Ban; }
    if (lower === 'no-show')   { color = 'bg-orange-100 text-orange-800'; Icon = AlertCircle; }
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
type SortBy      = 'name' | 'createdAt' | 'status' | 'email';
type SortOrder   = 'asc' | 'desc';
type TabType     = 'overview' | 'companies' | 'bookings' | 'profile' | 'routes' | 'schedules';

interface AlertState   { type: 'error' | 'success' | 'warning' | 'info'; message: string; id: string; }
interface FormErrors   { name?: string; email?: string; contact?: string; adminPhone?: string; adminFirstName?: string; adminLastName?: string; }
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
const COMPANIES_PER_PAGE         = 10;
const BOOKINGS_PER_PAGE          = 10;
const MONTHLY_BOOKING_MULTIPLIER = 0.3;
const DEFAULT_GROWTH_RATES       = { monthly: 12.5, revenue: 18.2 } as const;

const STATUS_CONFIG = {
  active:   { color: 'bg-green-100 text-green-800 border-green-200',  icon: CheckCircle },
  pending:  { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock },
  inactive: { color: 'bg-red-100 text-red-800 border-red-200',        icon: Ban },
} as const;

// ─── Utilities ────────────────────────────────────────────────────────────────
const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validatePhone = (phone: string) => !phone || /^\+?[\d\s\-()]{8,15}$/.test(phone);

const convertTimestamp = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date)      return value;
  if (typeof value === 'string')  { const d = new Date(value); return isNaN(d.getTime()) ? null : d; }
  if (typeof value === 'number')  { const d = new Date(value); return isNaN(d.getTime()) ? null : d; }
  return null;
};

const formatDate = (date: Date | Timestamp | string | undefined | null): string => {
  if (!date) return '—';
  const d = convertTimestamp(date as any);
  if (!d) return 'Invalid date';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(d);
};

const debounce = <T extends (...args: any[]) => any>(func: T, wait: number) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => { clearTimeout(timeout); timeout = setTimeout(() => func(...args), wait); };
};

// ─── BookingsTab ──────────────────────────────────────────────────────────────
const BookingsTab: React.FC<{
  bookings: Booking[]; companies: Company[]; schedules: Schedule[]; routes: Route[];
  loading: boolean; setError: (msg: string) => void; setSuccess: (msg: string) => void;
}> = ({ bookings, companies, schedules, routes, loading, setError, setSuccess }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm,  setSearchTerm]  = useState('');
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
    const totalItems          = filteredBookings.length;
    const totalPages          = Math.ceil(totalItems / BOOKINGS_PER_PAGE);
    const indexOfLastBooking  = currentPage * BOOKINGS_PER_PAGE;
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
        const company  = companies.find(c => c.id === b.companyId);
        const schedule = schedules.find(s => s.id === b.scheduleId);
        const route    = schedule ? routes.find(r => r.id === schedule.routeId) : undefined;
        return [
          b.bookingReference,
          company?.name || 'Unknown',
          route ? `${route.origin} → ${route.destination}` : 'Unknown',
          b.bookingStatus,
          `MWK ${b.totalAmount.toLocaleString()}`,
          formatDate(b.createdAt as any),
        ].join(',');
      }).join('\n');
      const blob = new Blob(['Booking Reference,Company,Route,Status,Amount,Date\n' + rows], { type: 'text/csv' });
      const url  = URL.createObjectURL(blob);
      const a    = Object.assign(document.createElement('a'), { href: url, download: 'bookings-data.csv' });
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
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
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
          <div className="overflow-x-auto bg-white rounded-lg shadow">
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
                  const company  = companies.find(c => c.id === booking.companyId);
                  const schedule = schedules.find(s => s.id === booking.scheduleId);
                  const route    = schedule ? routes.find(r => r.id === schedule.routeId) : undefined;
                  const primary  = booking.passengerDetails?.[0];
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
                        {formatDate(booking.createdAt as any)}
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
  user: import('firebase/auth').User;
  onClose: () => void;
  onSaved: (updated: Company) => void;
  showAlert: (type: 'success' | 'error' | 'info' | 'warning', msg: string) => void;
}> = ({ company, user, onClose, onSaved, showAlert }) => {
  const ps = company.paymentSettings ?? {};

  const [paychanguEnabled,       setPaychanguEnabled]       = useState<boolean>(ps.paychanguEnabled      ?? false);
  const [paychanguReceiveNumber, setPaychanguReceiveNumber] = useState<string>(ps.paychanguReceiveNumber ?? '');
  const [paychanguPublicKey,     setPaychanguPublicKey]     = useState<string>(ps.paychanguPublicKey     ?? '');
  // Secret key field — always blank on load (never sent back to the browser)
  // Only populated when the admin types a new key. Empty = keep existing encrypted value.
  const [paychanguSecretKey,     setPaychanguSecretKey]     = useState<string>('');
  const [secretKeySet,           setSecretKeySet]           = useState<boolean>(!!ps.paychanguSecretKeyEnc);
  const [showSecret,             setShowSecret]             = useState<boolean>(false);

  const [stripeAccountId,  setStripeAccountId]  = useState<string>(ps.stripeAccountId          ?? '');
  const [stripeEnabled,    setStripeEnabled]    = useState<boolean>(ps.stripeEnabled            ?? false);
  const [stripeOnboarding, setStripeOnboarding] = useState<boolean>(ps.stripeOnboardingComplete ?? false);
  const [saving,  setSaving]  = useState(false);
  const [errors,  setErrors]  = useState<Record<string, string>>({});

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
    if (stripeEnabled && !stripeAccountId.trim())
      e.stripeAccountId = 'Stripe account ID is required when Stripe is enabled';
    if (stripeAccountId.trim() && !stripeAccountId.startsWith('acct_'))
      e.stripeAccountId = 'Stripe account ID should start with acct_';
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
        const idToken = await user?.getIdToken(true); // force refresh
        console.log('[encrypt] user uid:', user?.uid);
        console.log('[encrypt] token exists:', !!idToken);
        console.log('[encrypt] token preview:', idToken?.slice(0, 20));
        if (!idToken) throw new Error('Not authenticated — please sign in again');

        const res = await fetch('/api/admin/encrypt-paychangu-key', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
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
          paychanguReceiveNumber:   paychanguReceiveNumber.trim()   || null,
          paychanguPublicKey:       paychanguPublicKey.trim()       || null,
          paychanguSecretKeyEnc:    paychanguSecretKeyEnc           ?? null,
          stripeEnabled,
          stripeAccountId:          stripeAccountId.trim()          || null,
          stripeOnboardingComplete: stripeOnboarding,
        }).filter(([, v]) => v !== undefined)
      ) as Company['paymentSettings'];

      await updateDoc(doc(db, 'companies', company.id), {
        paymentSettings: updated,
        updatedAt: Timestamp.now(),
      });

      onSaved({ ...company, paymentSettings: updated });
      showAlert('success', `Payment settings saved for ${company.name}`);
      onClose();
    } catch (e: any) {
      showAlert('error', `Failed to save: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClearStripe = async () => {
    if (!window.confirm('Clear Stripe connection for this company? This cannot be undone.')) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'companies', company.id), {
        'paymentSettings.stripeEnabled':           false,
        'paymentSettings.stripeAccountId':         null,
        'paymentSettings.stripeOnboardingComplete': false,
        updatedAt: Timestamp.now(),
      });
      setStripeEnabled(false);
      setStripeAccountId('');
      setStripeOnboarding(false);
      onSaved({ ...company, paymentSettings: { ...ps, stripeEnabled: false, stripeAccountId: undefined, stripeOnboardingComplete: false } });
      showAlert('success', 'Stripe connection cleared.');
    } catch (e: any) {
      showAlert('error', `Failed to clear Stripe: ${e.message}`);
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

          <hr className="border-gray-100" />

          {/* ── Stripe ── */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#635BFF] flex items-center justify-center font-black text-white text-sm">S</div>
                <span className="font-semibold text-gray-900">Stripe</span>
              </div>
              <button
                type="button"
                onClick={() => setStripeEnabled(v => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${stripeEnabled ? 'bg-[#635BFF]' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${stripeEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className={`space-y-3 transition-opacity ${stripeEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Stripe Account ID <span className="text-gray-400 font-normal">(acct_...)</span>
                </label>
                <input
                  type="text"
                  value={stripeAccountId}
                  onChange={e => setStripeAccountId(e.target.value)}
                  placeholder="acct_xxxxxxxxxxxxxxxx"
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono ${errors.stripeAccountId ? 'border-red-400' : 'border-gray-300'}`}
                />
                {errors.stripeAccountId && <p className="text-red-500 text-xs mt-1">{errors.stripeAccountId}</p>}
                <p className="text-xs text-gray-400 mt-1">This is set automatically when the company connects via Stripe OAuth. You can also set it manually.</p>
              </div>

              {/* Onboarding toggle */}
              <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                <div>
                  <p className="text-xs font-semibold text-gray-700">Onboarding Complete</p>
                  <p className="text-xs text-gray-400">KYC / identity verification finished</p>
                </div>
                <button
                  type="button"
                  onClick={() => setStripeOnboarding(v => !v)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${stripeOnboarding ? 'bg-[#635BFF]' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${stripeOnboarding ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            {/* Status + clear button */}
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {stripeEnabled && stripeAccountId
                  ? <>
                      <CheckCircle className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="text-xs text-indigo-700 font-medium font-mono">{stripeAccountId}</span>
                      {stripeOnboarding
                        ? <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Onboarded</span>
                        : <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">Pending KYC</span>}
                    </>
                  : <><WifiOff className="w-3.5 h-3.5 text-gray-400" /><span className="text-xs text-gray-400">Not connected</span></>}
              </div>
              {stripeAccountId && (
                <button onClick={handleClearStripe} disabled={saving}
                  className="text-xs text-red-500 hover:text-red-700 underline disabled:opacity-50">
                  Clear connection
                </button>
              )}
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
const fmt = (d: any): string => {
  if (!d) return '—';
  const date = d instanceof Timestamp ? d.toDate() : d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
};

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  active:   { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', icon: <CheckCircle className="w-3.5 h-3.5" /> },
  pending:  { bg: 'bg-amber-50 border-amber-200',     text: 'text-amber-700',   icon: <Clock className="w-3.5 h-3.5" /> },
  inactive: { bg: 'bg-red-50 border-red-200',         text: 'text-red-700',     icon: <Ban className="w-3.5 h-3.5" /> },
};

// ── sub-components ────────────────────────────────────────────────────────────
const StatPill: React.FC<{ icon: React.ReactNode; label: string; value: number | string; color: string }> = ({
  icon, label, value, color,
}) => (
  <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${color}`}>
    <div className="shrink-0">{icon}</div>
    <div>
      <p className="text-xs text-gray-500 font-medium leading-none mb-0.5">{label}</p>
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
}

const ProfileTab: React.FC<ProfileTabProps> = ({
  companies, bookings, schedules, routes, buses = [], operators = [], openPaymentSettingsModal,
}) => {
  const [selected, setSelected] = useState<Company | null>(null);
  const [search, setSearch]     = useState('');

  const filtered = useMemo(() =>
    companies.filter(c =>
      !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase())
    ), [companies, search]);

  // ── derived stats for selected company ────────────────────────────────────
  const stats = useMemo(() => {
    if (!selected) return null;
    const id = selected.id;

    const companyBookings   = bookings.filter(b => b.companyId === id);
    const companySchedules  = schedules.filter(s => s.companyId === id);
    const companyRoutes     = routes.filter(r => r.companyId === id);
    const companyBuses      = buses.filter(b => b.companyId === id);
    const companyOperators  = operators.filter(o => o.companyId === id);

    const totalRevenue      = companyBookings
      .filter(b => b.bookingStatus !== 'cancelled')
      .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

    const confirmedBookings = companyBookings.filter(b => b.bookingStatus === 'confirmed').length;
    const pendingBookings   = companyBookings.filter(b => b.bookingStatus === 'pending').length;
    const cancelledBookings = companyBookings.filter(b => b.bookingStatus === 'cancelled').length;
    const completedBookings = companyBookings.filter(b => b.bookingStatus === 'completed').length;

    const activeSchedules   = companySchedules.filter(s => s.status === 'active').length;
    const activeRoutes      = companyRoutes.filter(r => r.status === 'active').length;
    const activeBuses       = companyBuses.filter(b => b.status === 'active').length;

    const recentBookings    = companyBookings
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
      companyBuses:  companyBuses.slice(0, 4),
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
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                {selected.logo
                  ? <img src={selected.logo} alt={selected.name} className="w-14 h-14 rounded-xl object-cover border" />
                  : <div className="w-14 h-14 rounded-xl bg-indigo-100 flex items-center justify-center">
                      <Building2 className="w-7 h-7 text-indigo-500" />
                    </div>}
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{selected.name}</h2>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusStyle?.bg} ${statusStyle?.text}`}>
                      {statusStyle?.icon}
                      <span className="capitalize">{selected.status}</span>
                    </span>
                    {selected.email && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Mail className="w-3 h-3" />{selected.email}
                      </span>
                    )}
                    {selected.contact && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Phone className="w-3 h-3" />{selected.contact}
                      </span>
                    )}
                  </div>
                  {selected.address && (
                    <p className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                      <MapPin className="w-3 h-3" />{selected.address}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => openPaymentSettingsModal(selected)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors">
                  <CreditCard className="w-3.5 h-3.5" /> Payment Settings
                </button>
              </div>
            </div>

            {/* ── Key Stats Grid ── */}
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatPill icon={<DollarSign className="w-4 h-4 text-emerald-600" />}
                  label="Total Revenue" value={`MWK ${stats.totalRevenue.toLocaleString()}`}
                  color="bg-emerald-50 border-emerald-100" />
                <StatPill icon={<Calendar className="w-4 h-4 text-blue-600" />}
                  label="Total Bookings" value={stats.totalBookings}
                  color="bg-blue-50 border-blue-100" />
                <StatPill icon={<Map className="w-4 h-4 text-violet-600" />}
                  label="Routes" value={`${stats.activeRoutes} / ${stats.totalRoutes}`}
                  color="bg-violet-50 border-violet-100" />
                <StatPill icon={<BarChart3 className="w-4 h-4 text-orange-600" />}
                  label="Schedules" value={`${stats.activeSchedules} / ${stats.totalSchedules}`}
                  color="bg-orange-50 border-orange-100" />
              </div>
            )}

            {/* ── Two column: Bookings breakdown + Payment ── */}
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Booking breakdown */}
                <div className="border rounded-xl p-4">
                  <SectionHeading icon={<Calendar className="w-4 h-4" />} label="Booking Breakdown" />
                  <div className="space-y-2">
                    {[
                      { label: 'Confirmed',  value: stats.confirmedBookings,  color: 'bg-emerald-500' },
                      { label: 'Pending',    value: stats.pendingBookings,    color: 'bg-amber-400' },
                      { label: 'Completed',  value: stats.completedBookings,  color: 'bg-blue-500' },
                      { label: 'Cancelled',  value: stats.cancelledBookings,  color: 'bg-red-400' },
                    ].map(({ label, value, color }) => {
                      const pct = stats.totalBookings > 0 ? Math.round((value / stats.totalBookings) * 100) : 0;
                      return (
                        <div key={label}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-gray-600">{label}</span>
                            <span className="font-semibold text-gray-900">{value} <span className="text-gray-400 font-normal">({pct}%)</span></span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Payment settings */}
                <div className="border rounded-xl p-4">
                  <SectionHeading icon={<CreditCard className="w-4 h-4" />} label="Payment Gateways" />
                  <div className="space-y-3">

                    {/* PayChangu */}
                    <div className={`flex items-center justify-between p-3 rounded-lg border ${stats.ps?.paychanguEnabled ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-emerald-500 flex items-center justify-center font-black text-white text-xs">P</div>
                        <div>
                          <p className="text-xs font-semibold text-gray-800">PayChangu</p>
                          {stats.ps?.paychanguReceiveNumber
                            ? <p className="text-xs text-gray-500">{stats.ps.paychanguReceiveNumber}</p>
                            : <p className="text-xs text-gray-400">No number set</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {stats.ps?.paychanguSecretKeyEnc
                          ? <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Key set</span>
                          : <span className="text-xs text-gray-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> No key</span>}
                        {stats.ps?.paychanguEnabled
                          ? <span className="ml-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Active</span>
                          : <span className="ml-1 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Disabled</span>}
                      </div>
                    </div>

                    {/* Stripe */}
                    <div className={`flex items-center justify-between p-3 rounded-lg border ${stats.ps?.stripeEnabled ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-[#635BFF] flex items-center justify-center font-black text-white text-xs">S</div>
                        <div>
                          <p className="text-xs font-semibold text-gray-800">Stripe</p>
                          {stats.ps?.stripeAccountId
                            ? <p className="text-xs text-gray-500 font-mono truncate max-w-[120px]">{stats.ps.stripeAccountId}</p>
                            : <p className="text-xs text-gray-400">Not connected</p>}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {stats.ps?.stripeEnabled
                          ? <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">Active</span>
                          : <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Disabled</span>}
                        {stats.ps?.stripeOnboardingComplete
                          ? <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Onboarded</span>
                          : stats.ps?.stripeAccountId
                            ? <span className="text-xs text-amber-500">Pending KYC</span>
                            : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Fleet + Operators ── */}
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Buses */}
                <div className="border rounded-xl p-4">
                  <SectionHeading icon={<BusIcon className="w-4 h-4" />} label={`Fleet (${stats.totalBuses} buses)`} />
                  {stats.companyBuses.length === 0 ? (
                    <p className="text-xs text-gray-400 py-2">No buses registered</p>
                  ) : (
                    <div className="space-y-2">
                      {stats.companyBuses.map(bus => (
                        <div key={bus.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                          <div>
                            <p className="text-xs font-semibold text-gray-800">{bus.licensePlate}</p>
                            <p className="text-xs text-gray-400">{bus.busType} · {bus.capacity} seats</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${bus.status === 'active' ? 'bg-emerald-100 text-emerald-700' : bus.status === 'maintenance' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                            {bus.status}
                          </span>
                        </div>
                      ))}
                      {stats.totalBuses > 4 && (
                        <p className="text-xs text-gray-400 pt-1">+{stats.totalBuses - 4} more buses</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Operators */}
                <div className="border rounded-xl p-4">
                  <SectionHeading icon={<UserCheck className="w-4 h-4" />} label={`Operators (${stats.totalOperators})`} />
                  {stats.companyOperators.length === 0 ? (
                    <p className="text-xs text-gray-400 py-2">No operators assigned</p>
                  ) : (
                    <div className="space-y-2">
                      {stats.companyOperators.map(op => (
                        <div key={op.id} className="flex items-center gap-2.5 py-1.5 border-b border-gray-50 last:border-0">
                          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0">
                            {op.firstName[0]}{op.lastName?.[0] ?? ''}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-800 truncate">{op.firstName} {op.lastName}</p>
                            <p className="text-xs text-gray-400 truncate capitalize">
                              {op.role.replace('_', ' ')}
                              {op.role === 'operator' && (op as OperatorProfile).region
                                ? ` · ${(op as OperatorProfile).region}` : ''}
                            </p>
                          </div>
                        </div>
                      ))}
                      {stats.totalOperators > 5 && (
                        <p className="text-xs text-gray-400 pt-1">+{stats.totalOperators - 5} more operators</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Routes ── */}
            {stats && stats.companyRoutes.length > 0 && (
              <div className="border rounded-xl p-4">
                <SectionHeading icon={<Map className="w-4 h-4" />} label={`Routes (${stats.totalRoutes})`} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {stats.companyRoutes.map(route => (
                    <div key={route.id} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                        <Map className="w-3.5 h-3.5 text-violet-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{route.origin} → {route.destination}</p>
                        <p className="text-xs text-gray-400">{route.distance} km · {Math.floor(route.duration / 60)}h {route.duration % 60}m
                          {route.stops?.length > 0 && ` · ${route.stops.length} stops`}
                        </p>
                      </div>
                      <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${route.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'}`}>
                        {route.status}
                      </span>
                    </div>
                  ))}
                  {stats.totalRoutes > 5 && (
                    <p className="text-xs text-gray-400 col-span-2">+{stats.totalRoutes - 5} more routes</p>
                  )}
                </div>
              </div>
            )}

            {/* ── Recent Bookings ── */}
            {stats && stats.recentBookings.length > 0 && (
              <div className="border rounded-xl p-4">
                <SectionHeading icon={<Layers className="w-4 h-4" />} label="Recent Bookings" />
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100">
                        {['Reference', 'Passengers', 'Amount', 'Status', 'Date'].map(h => (
                          <th key={h} className="pb-2 text-left text-gray-400 font-medium pr-4">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {stats.recentBookings.map(b => (
                        <tr key={b.id} className="hover:bg-gray-50">
                          <td className="py-2 pr-4 font-mono font-medium text-gray-700">{b.bookingReference}</td>
                          <td className="py-2 pr-4 text-gray-600">{b.passengerDetails?.length ?? 1}</td>
                          <td className="py-2 pr-4 font-medium text-gray-800">MWK {b.totalAmount?.toLocaleString()}</td>
                          <td className="py-2 pr-4">
                            <span className={`px-2 py-0.5 rounded-full font-medium ${
                              b.bookingStatus === 'confirmed'  ? 'bg-emerald-100 text-emerald-700' :
                              b.bookingStatus === 'pending'    ? 'bg-amber-100 text-amber-700' :
                              b.bookingStatus === 'completed'  ? 'bg-blue-100 text-blue-700' :
                              b.bookingStatus === 'cancelled'  ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>{b.bookingStatus}</span>
                          </td>
                          <td className="py-2 text-gray-400">{fmt(b.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Meta ── */}
            <div className="flex gap-4 text-xs text-gray-400 pt-2 border-t">
              <span>ID: <span className="font-mono text-gray-500">{selected.id}</span></span>
              <span>Created: {fmt(selected.createdAt)}</span>
              <span>Updated: {fmt(selected.updatedAt)}</span>
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

  const [companies,  setCompanies]  = useState<Company[]>([]);
  const [bookings,   setBookings]   = useState<Booking[]>([]);
  const [schedules,  setSchedules]  = useState<Schedule[]>([]);
  const [routes,     setRoutes]     = useState<Route[]>([]);
  const [buses,      setBuses]      = useState<Bus[]>([]);
  const [operators,  setOperators]  = useState<(OperatorProfile | ConductorProfile)[]>([]);
  const [stats,      setStats]      = useState<DashboardStats>({
    totalCompanies: 0, activeCompanies: 0, pendingCompanies: 0, inactiveCompanies: 0,
    totalRevenue: 0, monthlyRevenue: 0, totalBookings: 0, monthlyBookings: 0,
    monthlyGrowth: 0, revenueGrowth: 0,
  });

  const [loadingStates, setLoadingStates] = useState<LoadingStates>({
    companies: true, bookings: true, creating: false, updating: false, deleting: false, initializing: true,
  });

  const [alerts,     setAlerts]     = useState<AlertState[]>([]);
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const [searchTerm,   setSearchTerm]   = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy,       setSortBy]       = useState<SortBy>('createdAt');
  const [sortOrder,    setSortOrder]    = useState<SortOrder>('desc');
  const [currentPage,  setCurrentPage]  = useState(1);
  const [activeTab,    setActiveTab]    = useState<TabType>('overview');

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

  const clearAlert    = useCallback((id: string) => setAlerts(prev => prev.filter(a => a.id !== id)), []);
  const clearAllAlerts = useCallback(() => setAlerts([]), []);

  // ── Form validation ────────────────────────────────────────────────────────
  const validateForm = useCallback((): boolean => {
    const errors: FormErrors = {};
    if (!formData.name.trim())                                  errors.name  = 'Company name is required';
    if (!formData.email.trim())                                 errors.email = 'Admin email is required';
    else if (!validateEmail(formData.email))                    errors.email = 'Please enter a valid email address';
    if (formData.contact   && !validatePhone(formData.contact))   errors.contact    = 'Please enter a valid phone number';
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
        totalCompanies:  companyList.length,
        activeCompanies: companyList.filter(c => c.status === 'active').length,
        pendingCompanies: companyList.filter(c => c.status === 'pending').length,
        inactiveCompanies: companyList.filter(c => c.status === 'inactive').length,
        totalRevenue,
        monthlyRevenue:  totalRevenue * MONTHLY_BOOKING_MULTIPLIER,
        totalBookings:   bookingList.length,
        monthlyBookings: Math.floor(bookingList.length * MONTHLY_BOOKING_MULTIPLIER),
        monthlyGrowth:   DEFAULT_GROWTH_RATES.monthly,
        revenueGrowth:   DEFAULT_GROWTH_RATES.revenue,
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
    const unsubs: (() => void)[] = [];

    unsubs.push(onSnapshot(
      query(collection(db, 'companies'), orderBy('createdAt', 'desc')),
      snap => {
        setCompanies(snap.docs.map(d => ({
          id: d.id, ...d.data(),
          status:    d.data().status || 'pending',
          createdAt: convertTimestamp(d.data().createdAt),
          updatedAt: convertTimestamp(d.data().updatedAt),
        }) as Company));
        setLoadingState('companies', false);
      },
      err => { showAlert('error', `Failed to load companies: ${err.message}`); setLoadingState('companies', false); }
    ));

    unsubs.push(onSnapshot(
      collection(db, 'bookings'),
      snap => {
        setBookings(snap.docs.map(d => ({
          id: d.id, ...d.data(),
          createdAt:        convertTimestamp(d.data().createdAt),
          bookingDate:      convertTimestamp(d.data().bookingDate),
          cancellationDate: d.data().cancellationDate ? convertTimestamp(d.data().cancellationDate) : undefined,
          refundDate:       d.data().refundDate       ? convertTimestamp(d.data().refundDate)       : undefined,
        }) as Booking));
        setLoadingState('bookings', false);
      },
      err => { showAlert('error', `Failed to load bookings: ${err.message}`); setLoadingState('bookings', false); }
    ));

    (async () => {
      try {
        const [schSnap, rtSnap, busSnap, opSnap] = await Promise.all([
          getDocs(collection(db, 'schedules')),
          getDocs(collection(db, 'routes')),
          getDocs(collection(db, 'buses')),
          getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc'))),
        ]);
        setSchedules(schSnap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id, companyId: data.companyId || '', busId: data.busId || '',
            routeId: data.routeId || '', departureLocation: data.departureLocation || '',
            arrivalLocation: data.arrivalLocation || '',
            departureDateTime: convertTimestamp(data.departureDateTime),
            arrivalDateTime:   convertTimestamp(data.arrivalDateTime),
            price: data.price || 0, availableSeats: data.availableSeats || 0,
            bookedSeats: data.bookedSeats || [], status: data.status || 'active',
            isActive: data.isActive ?? true,
            createdAt: convertTimestamp(data.createdAt),
            updatedAt: data.updatedAt ? convertTimestamp(data.updatedAt) : undefined,
          } as Schedule;
        }));
        setRoutes(rtSnap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id, name: data.name || '', companyId: data.companyId || '',
            origin: data.origin || '', destination: data.destination || '',
            distance: data.distance || 0, duration: data.duration || 0,
            stops: data.stops || [], status: data.status || 'active',
            createdAt: convertTimestamp(data.createdAt),
            updatedAt: data.updatedAt ? convertTimestamp(data.updatedAt) : undefined,
          } as Route;
        }));
        setBuses(busSnap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id, companyId: data.companyId || '',
            licensePlate: data.licensePlate || '', busType: data.busType || 'Economy',
            status: data.status || 'active', capacity: data.capacity || 0,
          } as Bus;
        }));
        // Filter strictly: must have role operator or company_admin AND have required name fields
        setOperators(opSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((u: any) =>
            (u.role === 'operator' || u.role === 'company_admin' || u.role === 'conductor') &&
            typeof u.firstName === 'string' && u.firstName.length > 0 &&
            typeof u.lastName  === 'string'
          ) as (OperatorProfile | ConductorProfile)[]
        );
      } catch (e) {
        showAlert('error', 'Failed to load schedules and routes');
      } finally {
        setLoadingState('initializing', false);
      }
    })();

    return () => unsubs.forEach(fn => fn());
  }, [user, userProfile, authLoading, router, showAlert, setLoadingState]);

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
          companyName:        formData.name.trim(),
          companyEmail:       formData.email.trim().toLowerCase(),
          adminFirstName:     formData.adminFirstName?.trim() || '',
          adminLastName:      formData.adminLastName?.trim()  || '',
          adminPhone:         formData.adminPhone?.trim()     || '',
          companyContact:     formData.contact?.trim()        || '',
          companyAddress:     formData.address?.trim()        || '',
          companyDescription: formData.description?.trim()    || '',
          status:             formData.status,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      if (data.success) { showAlert('success', data.message || 'Company created!'); closeModal('add'); resetForm(); }
      else throw new Error(data.error || 'Failed to create company');
    } catch (e: any) {
      showAlert('error', e.message.includes('Failed to fetch')
        ? 'Network error. Please check your connection.'
        : e.message || 'Failed to create company.');
    } finally { setLoadingState('creating', false); }
  };

  const handleUpdateCompany = async () => {
    if (!validateForm() || !selectedCompany) { showAlert('error', 'Please fix the form errors.'); return; }
    setLoadingState('updating', true); clearAllAlerts();
    try {
      await updateDoc(doc(db, 'companies', selectedCompany.id), {
        name:        formData.name.trim(),
        contact:     formData.contact?.trim()  || '',
        address:     formData.address?.trim()  || '',
        description: formData.description?.trim() || '',
        status:      formData.status,
        updatedAt:   Timestamp.now(),
      });
      showAlert('success', 'Company updated successfully!');
      closeModal('edit');
    } catch (e: any) { showAlert('error', `Failed to update company: ${e.message}`); }
    finally { setLoadingState('updating', false); }
  };

  const handleDeleteCompany = async (companyId: string) => {
    setLoadingState('deleting', true); clearAllAlerts();
    try {
      await deleteDoc(doc(db, 'companies', companyId));
      showAlert('success', 'Company deleted successfully!');
      setModals(prev => ({ ...prev, delete: null }));
      setSelectedCompany(null);
    } catch (e: any) { showAlert('error', `Failed to delete company: ${e.message}`); }
    finally { setLoadingState('deleting', false); }
  };

  const handleStatusChange = async (companyId: string, newStatus: Company['status']) => {
    try {
      await updateDoc(doc(db, 'companies', companyId), { status: newStatus, updatedAt: Timestamp.now() });
      showAlert('success', `Company status updated to ${newStatus}`);
    } catch (e: any) { showAlert('error', `Failed to update status: ${e.message}`); }
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
        let av: any = a[sortBy as keyof Company];
        let bv: any = b[sortBy as keyof Company];
        if (sortBy === 'createdAt') {
          av = av instanceof Date ? av.getTime() : new Date(av ?? 0).getTime();
          bv = bv instanceof Date ? bv.getTime() : new Date(bv ?? 0).getTime();
        } else { av = String(av ?? '').toLowerCase(); bv = String(bv ?? '').toLowerCase(); }
        return av < bv ? (sortOrder === 'asc' ? -1 : 1) : av > bv ? (sortOrder === 'asc' ? 1 : -1) : 0;
      });
  }, [companies, searchTerm, statusFilter, sortBy, sortOrder]);

  const paginationData = useMemo(() => {
    const totalItems  = filteredAndSortedCompanies.length;
    const totalPages  = Math.ceil(totalItems / COMPANIES_PER_PAGE);
    const last        = currentPage * COMPANIES_PER_PAGE;
    const first       = last - COMPANIES_PER_PAGE;
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
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
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
      ['Total Companies',   stats.totalCompanies.toString()],
      ['Active Companies',  stats.activeCompanies.toString()],
      ['Pending Companies', stats.pendingCompanies.toString()],
      ['Inactive Companies',stats.inactiveCompanies.toString()],
      ['Total Revenue',    `MWK ${stats.totalRevenue.toLocaleString()}`],
      ['Total Bookings',    stats.totalBookings.toString()],
      ['Monthly Bookings',  stats.monthlyBookings.toString()],
      ['Monthly Growth',   `${stats.monthlyGrowth}%`],
      ['Revenue Growth',   `${stats.revenueGrowth}%`],
      ['Active Routes',     routes.length.toString()],
      ['Active Schedules',  schedules.length.toString()],
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
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Super Admin Dashboard</h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">Welcome, {userProfile?.firstName || userProfile?.email}</span>
            <button onClick={signOut} className="text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg border hover:bg-gray-50 transition-colors">
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Alerts */}
        <div className="space-y-2 mb-6">
          {alerts.map(a => (
            <AlertMessage key={a.id} type={a.type} message={a.message} onClose={() => clearAlert(a.id)} />
          ))}
        </div>

        {/* Tab nav */}
        <div className="flex flex-wrap gap-2 mb-8 bg-white p-2 rounded-xl shadow-sm">
          {([
            { id: 'overview',   label: 'Overview',   icon: BarChart3  },
            { id: 'companies',  label: 'Companies',  icon: Building2  },
            { id: 'bookings',   label: 'Bookings',   icon: List       },
            { id: 'routes',     label: 'Routes',     icon: Map        },
            { id: 'schedules',  label: 'Schedules',  icon: Calendar   },
            { id: 'profile',    label: 'Profile',    icon: User       },
          ] as const).map(tab => (
            <TabButton key={tab.id} id={tab.id} label={tab.label} icon={tab.icon}
              isActive={activeTab === tab.id} onClick={() => setActiveTab(tab.id as TabType)} />
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">

          {/* ── OVERVIEW ── */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Total Companies"  value={stats.totalCompanies}                          icon={Building2}   color="blue"   />
                <StatCard title="Total Revenue"    value={`MWK ${stats.totalRevenue.toLocaleString()}`} icon={DollarSign}  color="green"  />
                <StatCard title="Total Bookings"   value={stats.totalBookings}                           icon={Calendar}    color="purple" />
                <StatCard title="Active Routes"    value={routes.length}                                 icon={Map}         color="orange" />
                <StatCard title="Active Companies" value={stats.activeCompanies}                         icon={CheckCircle} color="green"  />
                <StatCard title="Pending Companies"value={stats.pendingCompanies}                        icon={Clock}       color="yellow" />
                <StatCard title="Monthly Growth"   value={`${stats.monthlyGrowth}%`}                    icon={BarChart3}   color="teal"   />
                <StatCard title="Revenue Growth"   value={`${stats.revenueGrowth}%`}                    icon={DollarSign}  color="indigo" />
              </div>
              <div className="flex justify-end">
                <button onClick={exportStatsData} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                  <Download className="w-5 h-5" /> Export Stats
                </button>
              </div>
            </div>
          )}

          {/* ── COMPANIES ── */}
          {activeTab === 'companies' && (
            <div className="space-y-6">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input type="text" placeholder="Search companies..." value={searchTerm}
                    onChange={e => { setSearchTerm(e.target.value); debouncedResetPage(); }}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                    className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500">
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <button onClick={() => setSortOrder(p => p === 'asc' ? 'desc' : 'asc')}
                    className="p-2 border rounded-lg hover:bg-gray-50">
                    {sortOrder === 'asc' ? <SortAsc className="w-5 h-5" /> : <SortDesc className="w-5 h-5" />}
                  </button>
                  <button onClick={exportCompaniesData}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                    <Download className="w-4 h-4" /> Export
                  </button>
                  <button onClick={() => openModal('add')}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                    <Plus className="w-5 h-5" /> Add Company
                  </button>
                </div>
              </div>

              {paginationData.totalItems === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No companies found</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      {/* ✅ FIX: all <th> elements are inside a single <tr> inside <thead> */}
                      <thead className="bg-gray-50">
                        <tr>
                          {['Company', 'Contact', 'Status', 'Created', 'Payments', 'Actions'].map(h => (
                            <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {paginationData.currentCompanies.map(company => (
                          <tr key={company.id} className="hover:bg-gray-50">
                            {/* Company */}
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                {company.logo
                                  ? <img src={company.logo} alt={company.name} className="h-10 w-10 rounded-lg object-cover" />
                                  : <Building2 className="h-10 w-10 text-gray-400 p-2 bg-gray-100 rounded-lg" />}
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">{company.name}</div>
                                  <div className="text-sm text-gray-500 flex items-center gap-1">
                                    <Mail className="w-3 h-3" />{company.email}
                                  </div>
                                </div>
                              </div>
                            </td>
                            {/* Contact */}
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900 flex items-center gap-1">
                                <Phone className="w-3 h-3" />{company.contact || 'N/A'}
                              </div>
                              {company.address && <div className="text-xs text-gray-500 mt-1">{company.address}</div>}
                            </td>
                            {/* Status */}
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(company.status)}`}>
                                {getStatusIcon(company.status)}
                                {company.status ? company.status.charAt(0).toUpperCase() + company.status.slice(1) : 'Unknown'}
                              </span>
                            </td>
                            {/* Created */}
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(company.createdAt as any)}
                            </td>
                            {/* Payments */}
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex gap-2 flex-wrap">
                                {company.paymentSettings?.paychanguEnabled ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    <CheckCircle className="w-3 h-3 mr-1" /> PayChangu
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-400">No PayChangu</span>
                                )}
                                {company.paymentSettings?.stripeAccountId && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                    <CreditCard className="w-3 h-3 mr-1" /> Stripe
                                  </span>
                                )}
                              </div>
                            </td>
                            {/* Actions */}
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <div className="flex items-center gap-2">
                                <button onClick={() => openModal('view', company)} className="text-blue-600 hover:text-blue-800 p-1" title="View">
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button onClick={() => openModal('edit', company)} className="text-amber-600 hover:text-amber-800 p-1" title="Edit">
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button onClick={() => openPaymentSettingsModal(company)} className="text-indigo-600 hover:text-indigo-900 p-1" title="Payments">
                                  <DollarSign className="w-4 h-4" />
                                </button>
                                <button onClick={() => openModal('delete', company)} className="text-red-600 hover:text-red-800 p-1" title="Delete">
                                  <Trash className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
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
            />
          )}

          {/* ── ROUTES ── */}
          {activeTab === 'routes' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Routes Management</h3>
                <button onClick={() => {
                  exportCSV(
                    routes.map(r => [r.id, r.name, r.origin, r.destination, r.distance, r.duration, formatDate(r.createdAt as any)].join(',')),
                    'ID,Name,Origin,Destination,Distance (km),Duration (min),Created', 'routes-data.csv'
                  );
                  showAlert('success', 'Routes exported!');
                }} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                  <Download className="w-4 h-4" /> Export Routes
                </button>
              </div>
              {routes.length === 0 ? (
                <div className="text-center py-12"><Map className="w-12 h-12 text-gray-400 mx-auto mb-4" /><p className="text-gray-600">No routes found</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Name', 'Origin', 'Destination', 'Distance', 'Duration', 'Stops', 'Status', 'Created'].map(h => (
                          <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {routes.map(route => (
                        <tr key={route.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{route.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{route.origin}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{route.destination}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{route.distance} km</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{Math.floor(route.duration / 60)}h {route.duration % 60}m</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{route.stops?.length || 0}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${route.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {route.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(route.createdAt as any)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── SCHEDULES ── */}
          {activeTab === 'schedules' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Schedules Management</h3>
                <button onClick={() => {
                  exportCSV(
                    schedules.map(s => {
                      const route = routes.find(r => r.id === s.routeId);
                      return [s.id, route?.name || 'Unknown', formatDate(s.departureDateTime as any), formatDate(s.arrivalDateTime as any), `MWK ${s.price.toLocaleString()}`, s.availableSeats, s.status, formatDate(s.createdAt as any)].join(',');
                    }),
                    'ID,Route,Departure,Arrival,Price,Available Seats,Status,Created', 'schedules-data.csv'
                  );
                  showAlert('success', 'Schedules exported!');
                }} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                  <Download className="w-4 h-4" /> Export Schedules
                </button>
              </div>
              {schedules.length === 0 ? (
                <div className="text-center py-12"><Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" /><p className="text-gray-600">No schedules found</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Route', 'Departure', 'Arrival', 'Price', 'Available Seats', 'Status', 'Created'].map(h => (
                          <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {schedules.map(schedule => {
                        const route = routes.find(r => r.id === schedule.routeId);
                        return (
                          <tr key={schedule.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{route?.name || 'Unknown Route'}</div>
                              <div className="text-xs text-gray-500">{route ? `${route.origin} → ${route.destination}` : 'N/A'}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(schedule.departureDateTime as any)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(schedule.arrivalDateTime as any)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">MWK {schedule.price.toLocaleString()}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{schedule.availableSeats}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${schedule.status === 'active' ? 'bg-green-100 text-green-800' : schedule.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                                {schedule.status.charAt(0).toUpperCase() + schedule.status.slice(1)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(schedule.createdAt as any)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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
                { id: 'name',           label: 'Company Name',        type: 'text',  key: 'name',           err: formErrors.name },
                { id: 'email',          label: 'Admin Email',         type: 'email', key: 'email',          err: formErrors.email },
                { id: 'adminFirstName', label: 'Admin First Name',    type: 'text',  key: 'adminFirstName', err: undefined },
                { id: 'adminLastName',  label: 'Admin Last Name',     type: 'text',  key: 'adminLastName',  err: undefined },
                { id: 'adminPhone',     label: 'Admin Phone (opt.)',  type: 'tel',   key: 'adminPhone',     err: formErrors.adminPhone },
                { id: 'contact',        label: 'Contact Phone',       type: 'tel',   key: 'contact',        err: formErrors.contact },
              ] as const).map(({ id, label, type, key, err }) => (
                <div key={id}>
                  <label htmlFor={`add-${id}`} className="block text-sm font-medium text-gray-700">{label}</label>
                  <input type={type} id={`add-${id}`} value={(formData as any)[key] ?? ''}
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
                { label: 'Email',        value: selectedCompany.email },
                { label: 'Contact',      value: selectedCompany.contact || 'N/A' },
                { label: 'Address',      value: selectedCompany.address || 'N/A' },
                { label: 'Created',      value: formatDate(selectedCompany.createdAt as any) },
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
          user={user}
          onClose={() => setPaymentModalCompany(null)}
          onSaved={updated => {
            setCompanies(prev => prev.map(c => c.id === updated.id ? updated : c));
            setPaymentModalCompany(null);
          }}
          showAlert={showAlert}
        />
      )}
    </div>
  );
}