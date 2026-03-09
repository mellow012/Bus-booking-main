'use client';

import React, { useState, useEffect, useCallback, useMemo, memo, ChangeEvent, FormEvent, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { sendNotification } from '../../contexts/NotificationContext';
import {
  collection, query, where, getDocs, doc, getDoc, orderBy,
  updateDoc, deleteDoc, increment, arrayRemove, Timestamp,
  writeBatch, onSnapshot, serverTimestamp, limit as firestoreLimit,
} from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { useAuth } from '@/contexts/AuthContext';
import { Booking, Schedule, Bus, Route, Company, UserProfile, NotificationType } from '@/types';
import {
  Bus as BusIcon, MapPin, Clock, Download, XCircle, CheckCircle, Loader2,
  Search, CreditCard, Armchair, Bell, AlertTriangle, Calendar, Users,
  Filter, RefreshCw, Zap, Shield, Smartphone, ArrowRight, Trash2,
  ChevronRight, Building2, Wallet,
} from 'lucide-react';
import Modal from '../../components/Modals';
import AlertMessage from '../../components/AlertMessage';
import { getAuth } from 'firebase/auth';

// ─── PaymentProvider type ─────────────────────────────────────────────────────
type PaymentProvider = 'flutterwave' | 'paychangu' | 'cash' | 'local_bank';

// ─── Types ────────────────────────────────────────────────────────────────────
interface BookingWithDetails extends Booking {
  schedule:             Schedule;
  bus:                  Bus;
  route:                Route;
  company:              Company;
  paymentProvider?:     PaymentProvider;
  originStopId?:        string;
  destinationStopId?:   string;
  originStopName?:      string;
  destinationStopName?: string;
  pricePerPerson?:      number;
}
  
interface SearchFilters {
  busType?:    string | string[];
  priceRange?: { min?: number; max?: number };
  company?:    string;
  [key: string]: unknown;
}

interface StatCard {
  label: string;
  value: number;
  key:   'all' | 'confirmed' | 'pending' | 'cancelled' | 'upcoming';
  Icon:  React.FC<{ className?: string }>;
}

interface PaymentMethod {
  id:               string;
  provider:         string;   // 'paychangu' | 'flutterwave' | 'cash'
  label:            string;
  tagline:          string;
  numbers:          string;
  logoText:         string;
  logoBg:           string;
  logoFg:           string;
  badgeBg:          string;
  badgeFg:          string;
  phonePlaceholder: string;
  phoneHint:        string | undefined;
}

interface PaymentCategory {
  id:             string;
  label:          string;
  description:    string;
  Icon:           React.FC<{ className?: string }>;
  iconBg:         string;
  activeBg:       string;
  activeBorder:   string;
  inactiveBorder: string;
  methods:        PaymentMethod[];
}

// ─── Payment Categories ───────────────────────────────────────────────────────
//  Mobile Money  → PayChangu  (proper MWK sandbox + live support)
//  Card          → Flutterwave (Visa / Mastercard)
//  Cash          → client-side only, no redirect
const PAYMENT_CATEGORIES: PaymentCategory[] = [
  {
    id:             'mobile_money',
    label:          'Mobile Money',
    description:    'Instant payment from your mobile wallet',
    Icon:           Smartphone,
    iconBg:         'bg-emerald-500',
    activeBg:       'bg-gradient-to-br from-emerald-50 to-teal-50',
    activeBorder:   'border-emerald-300',
    inactiveBorder: 'border-gray-200',
    methods: [
      {
        id:               'airtel',
        provider:         'paychangu',          // ← PayChangu for mobile money
        label:            'Airtel Money',
        tagline:          'Fast, secure mobile payments',
        numbers:          '099 · 077',
        logoText:         'A',
        logoBg:           '#EF0000',
        logoFg:           '#FFFFFF',
        badgeBg:          '#FFF0F0',
        badgeFg:          '#C00000',
        phonePlaceholder: '+265 99X XXX XXX',
        phoneHint:        'Use your Airtel number (099 / 077)',
      },
      {
        id:               'tnm',
        provider:         'paychangu',          // ← PayChangu for mobile money
        label:            'TNM Mpamba',
        tagline:          'Reliable TNM mobile payments',
        numbers:          '088 · 0881',
        logoText:         'T',
        logoBg:           '#004B9B',
        logoFg:           '#FFFFFF',
        badgeBg:          '#EEF4FF',
        badgeFg:          '#003A7A',
        phonePlaceholder: '+265 88X XXX XXX',
        phoneHint:        'Use your TNM number (088)',
      },
    ],
  },
  {
    id:             'card_bank',
    label:          'Card Payment',
    description:    'Visa, Mastercard & international cards',
    Icon:           Building2,
    iconBg:         'bg-blue-600',
    activeBg:       'bg-gradient-to-br from-blue-50 to-indigo-50',
    activeBorder:   'border-blue-300',
    inactiveBorder: 'border-gray-200',
    methods: [
      {
        id:               'card',
        provider:         'flutterwave',         // ← Flutterwave for cards
        label:            'Card Payment',
        tagline:          'Visa, Mastercard & Amex — powered by Flutterwave',
        numbers:          'All major cards',
        logoText:         'FW',
        logoBg:           '#F5A623',
        logoFg:           '#FFFFFF',
        badgeBg:          '#FFF8EC',
        badgeFg:          '#B87C0C',
        phonePlaceholder: '+265 XXX XXX XXX',
        phoneHint:        undefined,
      },
    ],
  },
  {
    id:             'cash',
    label:          'Cash on Boarding',
    description:    'Pay the conductor when you board',
    Icon:           Wallet,
    iconBg:         'bg-gray-600',
    activeBg:       'bg-gradient-to-br from-gray-50 to-slate-50',
    activeBorder:   'border-gray-400',
    inactiveBorder: 'border-gray-200',
    methods: [
      {
        id:               'cash_on_boarding',
        provider:         'cash',
        label:            'Cash on Boarding',
        tagline:          'Pay when you board — exact change appreciated',
        numbers:          'No card required',
        logoText:         'MK',
        logoBg:           '#4B5563',
        logoFg:           '#FFFFFF',
        badgeBg:          '#F3F4F6',
        badgeFg:          '#374151',
        phonePlaceholder: '',
        phoneHint:        undefined,
      },
    ],
  },
];

// ─── Helper: stop id → name ───────────────────────────────────────────────────
function resolveStopName(
  stopId:    string | undefined,
  savedName: string | undefined,
  route:     Route,
  fallback:  string,
): string {
  if (savedName) return savedName;
  if (stopId === '__origin__')      return route.origin      || fallback;
  if (stopId === '__destination__') return route.destination || fallback;
  if (stopId && route.stops) {
    const f = route.stops.find((s) => s.id === stopId);
    if (f) return f.name;
  }
  return fallback;
}

// ─── Error Boundary ───────────────────────────────────────────────────────────
interface ErrorBoundaryProps  { children: React.ReactNode; fallback?: React.ComponentType<{ error: Error; retry: () => void }>; }
interface ErrorBoundaryState  { hasError: boolean; error: Error | null; }

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(e: Error): ErrorBoundaryState { return { hasError: true, error: e }; }
  componentDidCatch(e: Error, i: React.ErrorInfo) { console.error('Bookings page error:', e, i); }
  render() {
    if (this.state.hasError) {
      const F = this.props.fallback ?? DefaultErrorFallback;
      return <F error={this.state.error as Error} retry={() => this.setState({ hasError: false, error: null })} />;
    }
    return this.props.children;
  }
}

const DefaultErrorFallback: React.FC<{ error: Error; retry: () => void }> = ({ error, retry }) => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
    <div className="max-w-md mx-auto text-center p-8 bg-white rounded-xl shadow-lg">
      <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h2>
      <p className="text-gray-600 mb-6">We encountered an unexpected error. Please try again.</p>
      <button onClick={retry} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">Try Again</button>
      <details className="mt-4 text-left">
        <summary className="text-sm text-gray-500 cursor-pointer">Technical Details</summary>
        <pre className="text-xs text-gray-400 mt-2 p-2 bg-gray-50 rounded overflow-auto">{error.message}</pre>
      </details>
    </div>
  </div>
);

// ─── PaymentMethodSelector ────────────────────────────────────────────────────
const PaymentMethodSelector: React.FC<{
  booking:  BookingWithDetails;
  onSelect: (provider: string, subMethodId: string, label: string) => void;
  loading:  boolean;
}> = ({ booking, onSelect, loading }) => {
  const [openCat, setOpenCat] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* Amount header */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-800 to-slate-900 text-white p-5">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Secure Checkout</span>
        </div>
        <p className="text-sm text-slate-300 mb-1">
          {booking.route.origin}<span className="mx-2 text-slate-500">→</span>{booking.route.destination}
        </p>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-3xl font-bold tracking-tight">MWK {booking.totalAmount.toLocaleString()}</span>
          {booking.passengerDetails.length > 1 && (
            <span className="text-xs text-slate-400">{booking.passengerDetails.length} passengers</span>
          )}
        </div>
      </div>

      {/* Provider badges */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Select payment method</span>
        <div className="flex gap-1 ml-auto">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">PayChangu · Mobile</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200 font-medium">Flutterwave · Card</span>
        </div>
      </div>

      {PAYMENT_CATEGORIES.map((cat) => {
        const isOpen  = openCat === cat.id;
        const CatIcon = cat.Icon;
        return (
          <div key={cat.id} className={`rounded-2xl border-2 overflow-hidden transition-all duration-200 shadow-sm ${isOpen ? `${cat.activeBorder} shadow-md` : cat.inactiveBorder}`}>
            <button type="button" onClick={() => setOpenCat(isOpen ? null : cat.id)} disabled={loading}
              className={`w-full flex items-center gap-4 p-4 text-left transition-colors ${isOpen ? cat.activeBg : 'bg-white hover:bg-gray-50'}`}>
              <div className={`w-11 h-11 rounded-xl ${cat.iconBg} flex items-center justify-center shrink-0 shadow-md`}>
                <CatIcon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900">{cat.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{cat.description}</p>
              </div>
              <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-90' : ''}`} />
            </button>

            {isOpen && (
              <div className={`${cat.activeBg} border-t ${cat.activeBorder}`}>
                {cat.methods.map((m, idx) => (
                  <button key={m.id} type="button" onClick={() => onSelect(m.provider, m.id, m.label)} disabled={loading}
                    className={`w-full flex items-center gap-4 px-5 py-4 hover:bg-white/70 active:bg-white/90 transition-colors text-left ${idx > 0 ? 'border-t border-white/60' : ''}`}>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm font-black text-lg"
                      style={{ backgroundColor: m.logoBg, color: m.logoFg }}>
                      {m.logoText}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-bold text-gray-900">{m.label}</p>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: m.badgeBg, color: m.badgeFg }}>
                          {m.numbers}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{m.tagline}</p>
                    </div>
                    {loading
                      ? <Loader2 className="w-4 h-4 animate-spin text-gray-400 shrink-0" />
                      : <ArrowRight className="w-4 h-4 text-gray-400 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <p className="text-[11px] text-gray-400 text-center flex items-center justify-center gap-1.5 pt-1">
        <Shield className="w-3 h-3" />All transactions are encrypted end-to-end
      </p>
    </div>
  );
};

// ─── ConfirmAndPayForm ────────────────────────────────────────────────────────
const ConfirmAndPayForm: React.FC<{
  booking:       BookingWithDetails;
  subMethodId:   string;
  providerLabel: string;
  provider:      string;
  userDetails:   { name: string; email: string; phone: string };
  onChange:      (d: { name: string; email: string; phone: string }) => void;
  onSubmit:      (e: FormEvent) => void;
  loading:       boolean;
  formatDate:    (dt: unknown) => string;
  formatTime:    (dt: unknown) => string;
}> = ({ booking, subMethodId, providerLabel, provider, userDetails, onChange, onSubmit, loading, formatDate, formatTime }) => {
  const method = PAYMENT_CATEGORIES.flatMap((c) => c.methods).find((m) => m.id === subMethodId);
  const isCash = provider === 'cash';

  // Provider attribution label for footer
  const providerAttr = provider === 'paychangu'
    ? 'Payments processed securely by PayChangu'
    : provider === 'flutterwave'
      ? 'Payments processed securely by Flutterwave'
      : null;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Booking summary */}
      <div className="rounded-xl overflow-hidden border border-gray-200">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-bold text-gray-900">Booking Summary</span>
        </div>
        <div className="px-4 py-3 space-y-2 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-gray-500 shrink-0">Route</span>
            <span className="font-medium text-gray-900 text-right">{booking.route.origin} → {booking.route.destination}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Departure</span>
            <span className="font-medium text-gray-900">{formatDate(booking.schedule.departureDateTime)} · {formatTime(booking.schedule.departureDateTime)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Passengers</span>
            <span className="font-medium text-gray-900">{booking.passengerDetails.length}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Pay via</span>
            <div className="flex items-center gap-2">
              {method && (
                <span className="w-5 h-5 rounded text-[11px] font-black flex items-center justify-center"
                  style={{ backgroundColor: method.logoBg, color: method.logoFg }}>
                  {method.logoText}
                </span>
              )}
              <span className="font-medium text-gray-900">{providerLabel}</span>
            </div>
          </div>
          <div className="flex justify-between pt-2 border-t border-gray-100 mt-1">
            <span className="font-bold text-gray-800">Total</span>
            <span className="text-xl font-bold text-gray-900">MWK {booking.totalAmount.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Cash notice */}
      {isCash ? (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-start gap-3">
            <Wallet className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold mb-1">Cash on Boarding</p>
              <p>Your seat will be reserved. Please have <strong>MWK {booking.totalAmount.toLocaleString()}</strong> ready to pay the conductor when you board. Exact change is appreciated.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">Full Name</label>
            <input type="text" value={userDetails.name}
              onChange={(e) => onChange({ ...userDetails, name: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your full name" required />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">Email Address</label>
            <input type="email" value={userDetails.email}
              onChange={(e) => onChange({ ...userDetails, email: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="you@example.com" required />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Phone Number
              {method?.phoneHint && <span className="ml-2 text-gray-400 font-normal normal-case">{method.phoneHint}</span>}
            </label>
            <input type="tel" value={userDetails.phone}
              onChange={(e) => onChange({ ...userDetails, phone: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={method?.phonePlaceholder ?? '+265 XXX XXX XXX'} required />
          </div>
        </div>
      )}

      <button type="submit" disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg font-bold disabled:opacity-50 active:scale-[.98]">
        {loading
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
          : isCash
            ? <><Wallet className="w-4 h-4" /> Confirm — Pay on Boarding</>
            : <><Zap className="w-4 h-4" /> Confirm & Pay — MWK {booking.totalAmount.toLocaleString()}</>}
      </button>

      {!isCash && providerAttr && (
        <p className="text-[11px] text-center text-gray-400 flex items-center justify-center gap-1">
          <Shield className="w-3 h-3" /> {providerAttr}
        </p>
      )}
    </form>
  );
};

// ─── BookingCard ──────────────────────────────────────────────────────────────
const BookingCard = memo<{
  booking:               BookingWithDetails;
  onCancel:              (bookingId: string, scheduleId: string, seatNumbers: string[]) => Promise<void>;
  onDelete:              (bookingId: string) => Promise<void>;
  onDownload:            (booking: BookingWithDetails, includeQR: boolean) => Promise<void>;
  onPayment:             (booking: BookingWithDetails) => void;
  actionLoading:         string | null;
  formatTime:            (dateTime: unknown) => string;
  formatDate:            (dateTime: unknown) => string;
  getStatusColor:        (status: string) => string;
  getPaymentStatusColor: (status: string) => string;
}>(({ booking, onCancel, onDelete, onDownload, onPayment, actionLoading,
      formatTime, formatDate, getStatusColor, getPaymentStatusColor }) => {

  const handleCancel   = useCallback(() => onCancel(booking.id, booking.scheduleId, booking.seatNumbers), [booking.id, booking.scheduleId, booking.seatNumbers, onCancel]);
  const handleDelete   = useCallback(() => onDelete(booking.id), [booking.id, onDelete]);
  const handleDLWithQR = useCallback(() => onDownload(booking, true),  [booking, onDownload]);
  const handleDLOnly   = useCallback(() => onDownload(booking, false), [booking, onDownload]);
  const handlePayment  = useCallback(() => onPayment(booking), [booking, onPayment]);

  const originName = resolveStopName(booking.originStopId, booking.originStopName, booking.route, booking.route?.origin || 'N/A');
  const alightName = resolveStopName(booking.destinationStopId, booking.destinationStopName, booking.route, booking.route?.destination || 'N/A');
  const isSegment  = originName !== (booking.route?.origin || '') || alightName !== (booking.route?.destination || '');
  const isCash     = (booking as any).paymentMethod === 'cash_on_boarding';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all duration-300">
      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shrink-0">
              <span className="text-white font-bold text-lg">{booking.company.name?.charAt(0) || 'C'}</span>
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{booking.company.name}</h3>
              <p className="text-sm text-gray-600 truncate">Ref: {booking.bookingReference || booking.id.slice(-8)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(booking.bookingStatus)}`}>
              {booking.bookingStatus.charAt(0).toUpperCase() + booking.bookingStatus.slice(1)}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPaymentStatusColor(booking.paymentStatus)}`}>
              {booking.paymentStatus.charAt(0).toUpperCase() + booking.paymentStatus.slice(1)}
            </span>
            {isCash && (
              <span className="px-3 py-1 rounded-full text-xs font-medium border bg-gray-100 text-gray-700 border-gray-300 flex items-center gap-1">
                <Wallet className="w-3 h-3" />Cash
              </span>
            )}
            {isSegment && (
              <span className="px-3 py-1 rounded-full text-xs font-medium border bg-orange-50 text-orange-700 border-orange-200">Segment</span>
            )}
          </div>
        </div>

        {/* Route timeline */}
        <div className="flex flex-col sm:flex-row items-center gap-4 p-3 bg-gray-50 rounded-xl mb-4">
          <div className="text-center min-w-[80px]">
            <div className="text-lg sm:text-xl font-bold text-gray-900">{formatTime(booking.schedule.departureDateTime)}</div>
            <div className="text-sm text-gray-600 flex items-center justify-center gap-1"><MapPin className="w-3 h-3" /><span className="truncate">{originName}</span></div>
            <div className="text-xs text-gray-500 mt-1">{formatDate(booking.schedule.departureDateTime)}</div>
          </div>
          <div className="flex-1 mx-2 hidden sm:block">
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t-2 border-dashed border-gray-300" /></div>
              <div className="relative flex justify-center"><div className="bg-white px-3 py-1 rounded-full border border-gray-200"><BusIcon className="w-4 h-4 text-gray-500" /></div></div>
            </div>
            <div className="text-center mt-2"><span className="text-xs text-gray-500">{Math.floor((booking.route.duration || 0) / 60)}h {(booking.route.duration || 0) % 60}m</span></div>
          </div>
          <div className="text-center min-w-[80px]">
            <div className="text-lg sm:text-xl font-bold text-gray-900">{formatTime(booking.schedule.arrivalDateTime)}</div>
            <div className="text-sm text-gray-600 flex items-center justify-center gap-1"><MapPin className="w-3 h-3" /><span className="truncate">{alightName}</span></div>
            <div className="text-xs text-gray-500 mt-1">{formatDate(booking.schedule.arrivalDateTime)}</div>
          </div>
        </div>

        {isSegment && (
          <div className="mb-4 px-3 py-2 bg-orange-50 border border-orange-100 rounded-lg text-xs text-orange-700">
            Full route: {booking.route?.origin} → {booking.route?.destination}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
              <div className="flex items-center gap-2"><BusIcon className="w-4 h-4 text-gray-400" /><span className="truncate">{booking.bus?.busType || 'N/A'} · {booking.bus?.licensePlate || 'N/A'}</span></div>
              <div className="flex items-center gap-2"><Users className="w-4 h-4 text-gray-400" /><span>{booking.passengerDetails?.length || 0} passenger{(booking.passengerDetails?.length || 0) > 1 ? 's' : ''}</span></div>
              <div className="flex items-center gap-2"><Armchair className="w-4 h-4 text-gray-400" /><span className="truncate">Seats: {booking.seatNumbers.join(', ')}</span></div>
              <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-gray-400" /><span className="truncate">Booked: {formatDate(booking.createdAt)}</span></div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-3 md:p-4">
            <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2"><Users className="w-4 h-4" />Passengers</h4>
            <div className="space-y-2 max-h-36 overflow-y-auto text-sm">
              {booking.passengerDetails.map((p, i) => (
                <div key={i}>
                  <p className="font-medium text-gray-800 truncate">{p.name}</p>
                  <p className="text-gray-600">Age: {p.age} · {p.gender} · Seat: {p.seatNumber}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col justify-between">
            <div className="mb-3 text-right">
              <div className="text-2xl font-bold text-gray-900">MWK {booking.totalAmount?.toLocaleString()}</div>
              <div className="text-sm text-gray-600">Total Amount</div>
              {booking.pricePerPerson && booking.passengerDetails?.length > 1 && (
                <div className="text-xs text-gray-500">MWK {booking.pricePerPerson.toLocaleString()} × {booking.passengerDetails.length}</div>
              )}
            </div>
            <div className="space-y-2">
              {/* Pay Now button — confirmed but unpaid, not cash */}
              {booking.bookingStatus === 'confirmed' && booking.paymentStatus === 'pending' && !isCash && (
                <button onClick={handlePayment} disabled={actionLoading === booking.id}
                  className="w-full px-3 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-md flex items-center justify-center gap-2">
                  {actionLoading === booking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Zap className="w-4 h-4" /><span className="font-medium">Pay Now</span></>}
                </button>
              )}
              {/* Download ticket — paid */}
              {booking.bookingStatus === 'confirmed' && booking.paymentStatus === 'paid' && (<>
                <button onClick={handleDLWithQR} disabled={actionLoading === `download_${booking.id}`}
                  className="w-full px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200 flex items-center justify-center gap-2">
                  {actionLoading === `download_${booking.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Download className="w-4 h-4" /><span>Ticket + QR</span></>}
                </button>
                <button onClick={handleDLOnly} disabled={actionLoading === `download_${booking.id}`}
                  className="w-full px-3 py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 flex items-center justify-center gap-2">
                  <Download className="w-4 h-4" /><span>Ticket Only</span>
                </button>
              </>)}
              {/* Boarding pass — cash confirmed */}
              {booking.bookingStatus === 'confirmed' && isCash && (
                <button onClick={handleDLWithQR} disabled={actionLoading === `download_${booking.id}`}
                  className="w-full px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200 flex items-center justify-center gap-2">
                  {actionLoading === `download_${booking.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Download className="w-4 h-4" /><span>Boarding Pass</span></>}
                </button>
              )}
              {/* Cancel — pending or confirmed+unpaid (not cash) */}
              {(booking.bookingStatus === 'pending' || (booking.bookingStatus === 'confirmed' && booking.paymentStatus === 'pending' && !isCash)) && (
                <button onClick={handleCancel} disabled={actionLoading === booking.id}
                  className="w-full px-3 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors border border-red-200 flex items-center justify-center gap-2">
                  {actionLoading === booking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><XCircle className="w-4 h-4" /><span>Cancel</span></>}
                </button>
              )}
              {/* Request refund — paid */}
              {booking.bookingStatus === 'confirmed' && booking.paymentStatus === 'paid' && !isCash && (
                <button onClick={handleCancel} disabled={actionLoading === booking.id}
                  className="w-full px-3 py-2 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors border border-amber-200 flex items-center justify-center gap-2">
                  {actionLoading === booking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><AlertTriangle className="w-4 h-4" /><span>Request Refund</span></>}
                </button>
              )}
              {/* Delete — cancelled */}
              {booking.bookingStatus === 'cancelled' && (
                <button onClick={handleDelete} disabled={actionLoading === booking.id}
                  className="w-full px-3 py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 flex items-center justify-center gap-2">
                  {actionLoading === booking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-4 h-4" /><span>Delete</span></>}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Payment required banner */}
      {booking.bookingStatus === 'confirmed' && booking.paymentStatus === 'pending' && !isCash && (
        <div className="bg-gradient-to-r from-emerald-50 to-blue-50 border-t border-emerald-200 p-3 sm:p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-800">Booking Approved — Payment Required</p>
              <p className="text-xs text-emerald-700">Complete payment via PayChangu (mobile money) or Flutterwave (card) to secure your seats.</p>
            </div>
            <Shield className="w-5 h-5 text-emerald-600 ml-auto" />
          </div>
        </div>
      )}

      {/* Cash on boarding banner */}
      {isCash && booking.bookingStatus === 'confirmed' && (
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-t border-amber-200 p-3 sm:p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center">
              <Wallet className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-amber-800">Cash on Boarding</p>
              <p className="text-xs text-amber-700">Have MWK {booking.totalAmount.toLocaleString()} ready to pay the conductor.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
BookingCard.displayName = 'BookingCard';

// ─── Main Page ────────────────────────────────────────────────────────────────
const BookingsPage: React.FC = () => {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { user, userProfile } = useAuth();

  const [bookings,         setBookings]         = useState<BookingWithDetails[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<BookingWithDetails[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [actionLoading,    setActionLoading]    = useState<string | null>(null);
  const [error,            setError]            = useState('');
  const [success,          setSuccess]          = useState('');
  const [filters,          setFilters]          = useState<SearchFilters>({});
  const [activeFilter,     setActiveFilter]     = useState('all');
  const [showFilters,      setShowFilters]      = useState(false);
  const [notifications,    setNotifications]    = useState<string[]>([]);
  const [currentPage,      setCurrentPage]      = useState(1);
  const bookingsPerPage = 5;

  const [methodModalOpen,  setMethodModalOpen]  = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [selectedBooking,  setSelectedBooking]  = useState<BookingWithDetails | null>(null);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedSubId,    setSelectedSubId]    = useState('');
  const [selectedLabel,    setSelectedLabel]    = useState('');
  const [userDetails,      setUserDetails]      = useState({ name: '', email: '', phone: '+265' });

  const cleanupFunctions   = useRef<Set<() => void>>(new Set());
  const statusesMapRef     = useRef<Map<string, { bookingStatus: string; paymentStatus: string }>>(new Map());
  const initialSnapshotRef = useRef(true);
  const scheduleCache      = useRef<Map<string, Schedule>>(new Map());
  const busCache           = useRef<Map<string, Bus>>(new Map());
  const routeCache         = useRef<Map<string, Route>>(new Map());
  const companyCache       = useRef<Map<string, Company>>(new Map());

  const formatTime = useCallback((dateTime: unknown): string => {
    let d: Date;
    if (dateTime instanceof Date)          d = dateTime;
    else if ((dateTime as any)?.toDate)    d = (dateTime as any).toDate();
    else if ((dateTime as any)?.seconds)   d = new Date((dateTime as any).seconds * 1000);
    else if (typeof dateTime === 'string') d = new Date(dateTime);
    else return 'N/A';
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }, []);

  const formatDate = useCallback((dateTime: unknown): string => {
    let d: Date;
    if (dateTime instanceof Date)          d = dateTime;
    else if ((dateTime as any)?.toDate)    d = (dateTime as any).toDate();
    else if ((dateTime as any)?.seconds)   d = new Date((dateTime as any).seconds * 1000);
    else if (typeof dateTime === 'string') d = new Date(dateTime);
    else return 'N/A';
    return d.toLocaleDateString('en-GB', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  }, []);

  const getStatusColor = useCallback((s: string): string => (
    ({ confirmed: 'bg-emerald-100 text-emerald-800 border-emerald-200', cancelled: 'bg-red-100 text-red-800 border-red-200', pending: 'bg-amber-100 text-amber-800 border-amber-200' } as Record<string, string>)[s]
    ?? 'bg-gray-100 text-gray-800 border-gray-200'
  ), []);

  const getPaymentStatusColor = useCallback((s: string): string => (
    ({ paid: 'bg-emerald-100 text-emerald-800 border-emerald-200', failed: 'bg-red-100 text-red-800 border-red-200', pending: 'bg-amber-100 text-amber-800 border-amber-200' } as Record<string, string>)[s]
    ?? 'bg-gray-100 text-gray-800 border-gray-200'
  ), []);

  const isBookingExpired = useCallback((b: BookingWithDetails) => {
    const arr = b.schedule.arrivalDateTime instanceof Timestamp
      ? b.schedule.arrivalDateTime.toDate()
      : new Date(b.schedule.arrivalDateTime as unknown as string);
    return arr < new Date()
      && b.bookingStatus !== 'completed'
      && b.bookingStatus !== 'cancelled'
      && !(b.bookingStatus === 'confirmed' && b.paymentStatus === 'paid')
      && !((b as any).paymentMethod === 'cash_on_boarding' && b.bookingStatus === 'confirmed');
  }, []);

  const applyFiltersLogic = useCallback((src: BookingWithDetails[], af: string, cf: SearchFilters) => {
    let f = [...src];
    const now = new Date();
    if      (af === 'confirmed') f = f.filter((b) => b.bookingStatus === 'confirmed' && (b.paymentStatus === 'paid' || (b as any).paymentMethod === 'cash_on_boarding'));
    else if (af === 'pending')   f = f.filter((b) => b.bookingStatus === 'pending' || (b.bookingStatus === 'confirmed' && b.paymentStatus === 'pending' && (b as any).paymentMethod !== 'cash_on_boarding'));
    else if (af === 'cancelled') f = f.filter((b) => b.bookingStatus === 'cancelled');
    else if (af === 'upcoming')  f = f.filter((b) => {
      const d = b.schedule?.departureDateTime instanceof Timestamp ? b.schedule.departureDateTime.toDate() : new Date(b.schedule?.departureDateTime as unknown as string);
      return d > now && b.bookingStatus === 'confirmed' && (b.paymentStatus === 'paid' || (b as any).paymentMethod === 'cash_on_boarding');
    });
    if (cf.busType)    { const t = Array.isArray(cf.busType) ? cf.busType : [cf.busType]; f = f.filter((b) => b.bus?.busType && t.includes(b.bus.busType)); }
    if (cf.priceRange) { f = f.filter((b) => b.schedule?.price !== undefined && b.schedule.price >= ((cf.priceRange as any)?.min ?? 0) && b.schedule.price <= ((cf.priceRange as any)?.max ?? Infinity)); }
    if (cf.company)    f = f.filter((b) => b.company?.name === cf.company);
    setFilteredBookings(f);
    setCurrentPage(1);
  }, []);

  const fetchBookings = useCallback(async (retryCount = 0) => {
    if (!user) return;
    setLoading(true); setError('');
    try {
      const snap = await getDocs(query(collection(db, 'bookings'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'), firestoreLimit(50)));
      const raw = snap.docs.map((d) => ({
        id: d.id, bookingReference: d.data().bookingReference || d.id, ...d.data(),
        bookingDate: d.data().bookingDate instanceof Timestamp ? d.data().bookingDate.toDate() : new Date(d.data().bookingDate),
        createdAt:   d.data().createdAt   instanceof Timestamp ? d.data().createdAt.toDate()   : new Date(d.data().createdAt),
        updatedAt:   d.data().updatedAt   instanceof Timestamp ? d.data().updatedAt.toDate()   : new Date(d.data().updatedAt),
      })) as unknown as Booking[];

      const schedIds = new Set(raw.filter((b) => !scheduleCache.current.has(b.scheduleId)).map((b) => b.scheduleId));
      const coIds    = new Set(raw.filter((b) => !companyCache.current.has(b.companyId)).map((b) => b.companyId));
      await Promise.all([...schedIds].map(async (id) => { const s = await getDoc(doc(db, 'schedules', id)); if (s.exists()) scheduleCache.current.set(id, { id: s.id, ...s.data() } as Schedule); }));
      const busIds = new Set<string>(); const routeIds = new Set<string>();
      raw.forEach((b) => { const sc = scheduleCache.current.get(b.scheduleId); if (!sc) return; if (sc.busId && !busCache.current.has(sc.busId)) busIds.add(sc.busId); if (sc.routeId && !routeCache.current.has(sc.routeId)) routeIds.add(sc.routeId); });
      await Promise.all([
        ...[...busIds  ].map(async (id) => { const s = await getDoc(doc(db, 'buses',     id)); if (s.exists()) busCache.current.set(id,   { id: s.id, ...s.data() } as Bus);     }),
        ...[...routeIds].map(async (id) => { const s = await getDoc(doc(db, 'routes',    id)); if (s.exists()) routeCache.current.set(id,  { id: s.id, ...s.data() } as Route);   }),
        ...[...coIds   ].map(async (id) => { const s = await getDoc(doc(db, 'companies', id)); if (s.exists()) companyCache.current.set(id, { id: s.id, ...s.data() } as Company); }),
      ]);
      const details: BookingWithDetails[] = [];
      for (const b of raw) {
        const sc = scheduleCache.current.get(b.scheduleId); const co = companyCache.current.get(b.companyId);
        if (!sc || !co) continue;
        const bus = busCache.current.get(sc.busId); const route = routeCache.current.get(sc.routeId);
        if (!bus || !route) continue;
        details.push({ ...b, schedule: sc, bus, route, company: co } as BookingWithDetails);
      }
      const valid = details.filter((b) => !isBookingExpired(b));
      setBookings(valid);
      applyFiltersLogic(valid, activeFilter, filters);
    } catch {
      if (retryCount < 2) { setTimeout(() => fetchBookings(retryCount + 1), 1000 * 2 ** retryCount); return; }
      setError('Failed to load bookings. Please check your connection and try again.');
    } finally { setLoading(false); }
  }, [user, activeFilter, filters, isBookingExpired, applyFiltersLogic]);

  const handleCancelBooking = useCallback(async (bookingId: string, scheduleId: string, seatNumbers: string[]) => {
    const b = bookings.find((x) => x.id === bookingId);
    if (!b) { setError('Booking not found'); return; }
    const dep = b.schedule.departureDateTime instanceof Timestamp
      ? b.schedule.departureDateTime.toDate()
      : new Date(b.schedule.departureDateTime as unknown as string);
    if (dep < new Date()) { setError('Cannot cancel a past departure.'); return; }
    const isPaid = b.paymentStatus === 'paid';
    if (isPaid && !window.confirm('This booking has been paid for. Cancelling may affect your refund eligibility. Continue?')) return;
    setActionLoading(bookingId); setError('');
    try {
      const batch = writeBatch(db);
      const upd: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (!isPaid) {
        upd.bookingStatus      = 'cancelled';
        upd.cancellationDate   = serverTimestamp();
        upd.cancellationReason = 'Customer initiated';
        sendNotification({ userId: b.userId, type: 'cancellation', title: 'Booking Cancelled', message: `Your booking ${bookingId.slice(-8)} (${b.route.origin} → ${b.route.destination}) has been cancelled.`, data: { bookingId, url: '/bookings' } });
      } else {
        upd.cancellationRequested = true;
        upd.cancellationReason    = 'Customer requested';
        sendNotification({ userId: b.userId, type: 'cancellation_requested', title: 'Cancellation Requested', message: `Cancellation for booking ${bookingId.slice(-8)} is under review.`, data: { bookingId, url: '/bookings' } });
      }
      batch.update(doc(db, 'bookings', bookingId), upd);
      if (!isPaid) batch.update(doc(db, 'schedules', scheduleId), { availableSeats: increment(seatNumbers.length), bookedSeats: arrayRemove(...seatNumbers), updatedAt: serverTimestamp() });
      await batch.commit();
      scheduleCache.current.delete(scheduleId);
      setSuccess(isPaid ? 'Cancellation requested. An admin will review.' : 'Booking cancelled successfully.');
      setTimeout(() => setSuccess(''), 5000);
      fetchBookings();
    } catch (err: unknown) { setError(`Failed to cancel: ${err instanceof Error ? err.message : String(err)}`); }
    finally { setActionLoading(null); }
  }, [bookings, fetchBookings]);

  const handleDeleteBooking = useCallback(async (bookingId: string) => {
    const b = bookings.find((x) => x.id === bookingId);
    if (!b || b.bookingStatus !== 'cancelled') { setError('Only cancelled bookings can be deleted.'); return; }
    if (!window.confirm('Permanently delete this cancelled booking?')) return;
    setActionLoading(bookingId);
    try { await deleteDoc(doc(db, 'bookings', bookingId)); setSuccess('Booking deleted.'); setTimeout(() => setSuccess(''), 5000); fetchBookings(); }
    catch (err: unknown) { setError(`Failed to delete: ${err instanceof Error ? err.message : String(err)}`); }
    finally { setActionLoading(null); }
  }, [bookings, fetchBookings]);

  const handleDownloadTicket = useCallback(async (booking: BookingWithDetails, includeQR: boolean) => {
    setActionLoading(`download_${booking.id}`);
    try {
      const [{ default: PDF }, { default: QR }] = await Promise.all([import('jspdf'), import('qrcode')]);
      const pdf = new PDF(); let y = 30; const lh = 8;
      const boarding  = resolveStopName(booking.originStopId, booking.originStopName, booking.route, booking.route.origin);
      const alighting = resolveStopName(booking.destinationStopId, booking.destinationStopName, booking.route, booking.route.destination);
      const isSeg = boarding !== booking.route.origin || alighting !== booking.route.destination;
      const line = (l: string, v: string, b = false) => { pdf.setFont('helvetica', b ? 'bold' : 'normal'); pdf.text(`${l}: ${v}`, 20, y); y += lh; };
      pdf.setFontSize(20); pdf.setFont('helvetica', 'bold'); pdf.text('Bus Ticket', 20, 20); pdf.setFontSize(12); pdf.setFont('helvetica', 'normal');
      line('Booking Reference', booking.bookingReference || booking.id.slice(-8), true);
      line('Company', booking.company.name); line('Full Route', `${booking.route.origin} → ${booking.route.destination}`);
      if (isSeg) { y += 2; pdf.setFont('helvetica', 'bold'); pdf.text('--- PASSENGER SEGMENT ---', 20, y); y += lh; pdf.setFont('helvetica', 'normal'); line('Boarding', boarding, true); line('Alighting', alighting, true); y += 2; }
      else { line('Boarding', boarding); line('Alighting', alighting); }
      line('Date', formatDate(booking.schedule.departureDateTime)); line('Departure', formatTime(booking.schedule.departureDateTime));
      line('Arrival (Est.)', formatTime(booking.schedule.arrivalDateTime)); line('Bus', `${booking.bus.busType} (${booking.bus.licensePlate || 'N/A'})`); line('Seats', booking.seatNumbers.join(', '));
      y += 4; pdf.text('Passengers:', 20, y); y += lh;
      booking.passengerDetails.forEach((p) => { pdf.text(`• ${p.name} (Age: ${p.age}, Seat: ${p.seatNumber})`, 25, y); y += lh; });
      y += 4; line('Total', `MWK ${booking.totalAmount.toLocaleString()}`, true);
      if (booking.pricePerPerson && booking.passengerDetails.length > 1) line('Breakdown', `MWK ${booking.pricePerPerson.toLocaleString()} × ${booking.passengerDetails.length}`);
      line('Payment', (booking as any).paymentMethod === 'cash_on_boarding' ? 'Cash on Boarding' : booking.paymentStatus.charAt(0).toUpperCase() + booking.paymentStatus.slice(1));
      if (includeQR) {
        const qr = await QR.toDataURL(JSON.stringify({ bookingId: booking.id, boarding, alighting, seats: booking.seatNumbers, amount: booking.totalAmount }), { width: 200 });
        pdf.addImage(qr, 'PNG', 140, 30, 50, 50); pdf.setFontSize(8); pdf.text('Scan to verify', 150, 85);
      }
      pdf.save(`ticket_${booking.bookingReference || booking.id.slice(-8)}.pdf`); setSuccess('Ticket downloaded!');
    } catch { setError('Failed to generate PDF.'); }
    finally { setActionLoading(null); }
  }, [formatDate, formatTime]);

  const handleOpenPayment = useCallback((booking: BookingWithDetails) => {
    if (!booking.seatNumbers?.length || !booking.passengerDetails?.length) { setError('Invalid booking data.'); return; }
    setSelectedBooking(booking);
    const pp = booking.passengerDetails[0];
    setUserDetails({ name: pp.name || `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim(), email: userProfile?.email || '', phone: userProfile?.phone || '+265' });
    setMethodModalOpen(true);
  }, [userProfile]);

  const handleMethodSelect = useCallback((provider: string, subId: string, label: string) => {
    setSelectedProvider(provider); setSelectedSubId(subId); setSelectedLabel(label);
    setMethodModalOpen(false); setConfirmModalOpen(true);
  }, []);

  // ── handleConfirmAndPay ────────────────────────────────────────────────────
  // Routes by provider:
  //   'cash'        → Firestore update only, no redirect
  //   'paychangu'   → /api/payments/paychangu/charge  (mobile money: Airtel, TNM)
  //   'flutterwave' → /api/payments/flutterwave/charge (card: Visa, Mastercard)
  const handleConfirmAndPay = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedBooking || !selectedProvider) { setError('Missing booking or payment method'); return; }

    const isCash = selectedProvider === 'cash';

    if (!isCash) {
      if (userDetails.name.trim().length < 2)                            { setError('Please provide a valid full name'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userDetails.email))        { setError('Please provide a valid email'); return; }
      if (!/^\+?\d{10,15}$/.test(userDetails.phone.replace(/\s/g, ''))) { setError('Please provide a valid phone number'); return; }
    }

    setActionLoading(selectedBooking.id); setError('');

    try {
      const cu = getAuth().currentUser;
      if (!cu) throw new Error('Not authenticated');
      const token = await cu.getIdToken();

      // ── Cash path ────────────────────────────────────────────────────────
      if (isCash) {
        await updateDoc(doc(db, 'bookings', selectedBooking.id), {
          paymentMethod:   'cash_on_boarding',
          paymentStatus:   'pending',
          paymentProvider: 'cash',
          updatedAt:       new Date(),
        });
        setConfirmModalOpen(false);
        setSuccess('Booking confirmed — please pay the conductor when you board.');
        setTimeout(() => setSuccess(''), 6000);
        fetchBookings();
        return;
      }

      // ── Gateway paths ────────────────────────────────────────────────────
      // paychangu → mobile money (Airtel / TNM)
      // flutterwave → card (Visa / Mastercard)
      const apiRoute = selectedProvider === 'paychangu'
        ? '/api/payments/paychangu/charge'
        : '/api/payments/flutterwave/charge';

      const res = await fetch(apiRoute, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId:       selectedBooking.id,
          paymentProvider: selectedProvider,
          customerDetails: {
            email: userDetails.email.toLowerCase().trim(),
            name:  userDetails.name.trim(),
            phone: userDetails.phone.trim(),
          },
          metadata: {
            route:          `${selectedBooking.route.origin}-${selectedBooking.route.destination}`,
            departure:      selectedBooking.schedule.departureDateTime instanceof Timestamp
                              ? selectedBooking.schedule.departureDateTime.toDate().toISOString()
                              : new Date(selectedBooking.schedule.departureDateTime as unknown as string).toISOString(),
            passengerCount: String(selectedBooking.passengerDetails.length),
            seatNumbers:    selectedBooking.seatNumbers.join(','),
            subMethod:      selectedSubId,
          },
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || result.message || 'Payment session failed');

      if (result.success && result.checkoutUrl) {
        setConfirmModalOpen(false);
        const providerName = selectedProvider === 'paychangu' ? 'PayChangu' : 'Flutterwave';
        setSuccess(`Redirecting to ${providerName}…`);
        setTimeout(() => { window.location.href = result.checkoutUrl; }, 1200);
      } else {
        throw new Error(result.error || 'Invalid server response');
      }
    } catch (err: unknown) { setError(`Payment failed: ${err instanceof Error ? err.message : String(err)}`); }
    finally { setActionLoading(null); }
  }, [selectedBooking, selectedProvider, selectedSubId, userDetails, fetchBookings]);

  // ── verifyPaymentStatus ────────────────────────────────────────────────────
  // PayChangu return: ?payment_verify=true&provider=paychangu&tx_ref={bookingId}
  // Flutterwave return: ?payment_verify=true&provider=flutterwave&tx_ref=bk_xxx&transaction_id=123&status=successful
  const verifyPaymentStatus = useCallback(async (provider: string, txRef: string, transactionId?: string) => {
    setActionLoading(`verify_${txRef}`);
    try {
      const cu = getAuth().currentUser;
      if (!cu) throw new Error('Not authenticated');
      const token = await cu.getIdToken();

      let res: Response;
      if (provider === 'paychangu') {
        const params = new URLSearchParams({ provider, tx_ref: txRef });
        res = await fetch(`/api/payments/verify?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      } else if (provider === 'flutterwave') {
        const params = new URLSearchParams({ tx_ref: txRef });
        if (transactionId) params.append('transaction_id', transactionId);
        res = await fetch(`/api/payments/flutterwave/verify?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      } else {
        setError('Unknown payment provider'); return;
      }

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Verification failed');
      if (result.success && result.status === 'paid') {
        setSuccess('Payment verified! Your booking is confirmed.');
        fetchBookings();
      } else {
        setError(`Payment status: ${result.status || 'unknown'}. Please contact support if you were charged.`);
      }
    } catch (err: unknown) { setError(`Verification failed: ${err instanceof Error ? err.message : String(err)}`); }
    finally { setActionLoading(null); }
  }, [fetchBookings]);

  const bookingStats = useMemo(() => {
    const now = new Date();
    return {
      all:       bookings.length,
      confirmed: bookings.filter((b) => b.bookingStatus === 'confirmed' && (b.paymentStatus === 'paid' || (b as any).paymentMethod === 'cash_on_boarding')).length,
      pending:   bookings.filter((b) => b.bookingStatus === 'pending' || (b.bookingStatus === 'confirmed' && b.paymentStatus === 'pending' && (b as any).paymentMethod !== 'cash_on_boarding')).length,
      cancelled: bookings.filter((b) => b.bookingStatus === 'cancelled').length,
      upcoming:  bookings.filter((b) => {
        const d = b.schedule?.departureDateTime instanceof Timestamp ? b.schedule.departureDateTime.toDate() : new Date(b.schedule?.departureDateTime as unknown as string);
        return d > now && b.bookingStatus === 'confirmed' && (b.paymentStatus === 'paid' || (b as any).paymentMethod === 'cash_on_boarding');
      }).length,
    };
  }, [bookings]);

  const paginatedBookings = useMemo(() => filteredBookings.slice((currentPage - 1) * bookingsPerPage, currentPage * bookingsPerPage), [filteredBookings, currentPage]);
  const totalPages        = useMemo(() => Math.ceil(filteredBookings.length / bookingsPerPage), [filteredBookings.length]);

  const handleFilterChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters((prev) => {
      const next = { ...prev };
      if (name === 'priceRangeMin' || name === 'priceRangeMax') next.priceRange = { ...(next.priceRange as object), [name === 'priceRangeMin' ? 'min' : 'max']: value ? Number(value) : undefined };
      else next[name] = value || undefined;
      return next;
    });
  }, []);

  const handleStatusFilter = useCallback((s: string) => {
    setActiveFilter(s); applyFiltersLogic(bookings, s, filters);
  }, [bookings, filters, applyFiltersLogic]);

  // ── URL param handling ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) { router.push('/login'); return; }

    const pv            = searchParams.get('payment_verify');
    const provider      = searchParams.get('provider');
    const txRef         = searchParams.get('tx_ref');
    const transactionId = searchParams.get('transaction_id') ?? undefined;
    const flwStatus     = searchParams.get('status');
    const successP      = searchParams.get('success');
    const cancelled     = searchParams.get('cancelled');

    if (successP === 'true' && !pv) { setSuccess('Action completed!'); setTimeout(() => setSuccess(''), 5000); }

    if (cancelled === 'true' || flwStatus === 'cancelled') {
      setError('Payment was cancelled. You can try again anytime.');
      setTimeout(() => setError(''), 6000);
    }

    if (pv === 'true' && provider && txRef) {
      if (flwStatus !== 'cancelled') {
        verifyPaymentStatus(provider, txRef, transactionId);
      }
      const clean = new URL(window.location.href);
      ['payment_verify', 'provider', 'tx_ref', 'transaction_id', 'status', 'cancelled', 'success']
        .forEach((k) => clean.searchParams.delete(k));
      window.history.replaceState({}, '', clean.toString());
    }

    fetchBookings();
    return () => { cleanupFunctions.current.forEach((fn) => fn()); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, router]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'bookings'), where('userId', '==', user.uid), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      if (initialSnapshotRef.current) {
        snap.docs.forEach((d) => { const dt = d.data(); statusesMapRef.current.set(d.id, { bookingStatus: dt.bookingStatus || '', paymentStatus: dt.paymentStatus || '' }); });
        initialSnapshotRef.current = false;
        return;
      }
      snap.docChanges().forEach((ch) => {
        if (ch.type !== 'modified') return;
        const id = ch.doc.id; const nd = ch.doc.data();
        const prev = statusesMapRef.current.get(id) || { bookingStatus: '', paymentStatus: '' };
        const nbs = nd.bookingStatus || ''; const nps = nd.paymentStatus || ''; const ref = nd.bookingReference || id.slice(-8);
        if (prev.bookingStatus !== nbs) { const m = nbs === 'confirmed' ? `Booking ${ref} approved!` : `Booking ${ref} → "${nbs}"`; setNotifications((p) => [m, ...p]); setSuccess(m); setTimeout(() => setSuccess(''), 6000); fetchBookings(); }
        if (prev.paymentStatus !== nps) { const m = nps === 'paid' ? `Payment received for ${ref}!` : `Payment for ${ref} → "${nps}"`; setNotifications((p) => [m, ...p]); setSuccess(m); setTimeout(() => setSuccess(''), 6000); fetchBookings(); }
        statusesMapRef.current.set(id, { bookingStatus: nbs, paymentStatus: nps });
      });
    }, (err) => console.error('Snapshot error:', err));
    cleanupFunctions.current.add(unsub);
    return () => { unsub(); cleanupFunctions.current.delete(unsub); };
  }, [user, fetchBookings]);

  useEffect(() => { applyFiltersLogic(bookings, activeFilter, filters); }, [activeFilter, filters, bookings, applyFiltersLogic]);

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse space-y-6">
        <div className="bg-white rounded-2xl shadow-sm p-6"><div className="h-8 bg-gray-200 rounded w-1/4 mb-4" /><div className="grid grid-cols-1 md:grid-cols-5 gap-4">{[...Array(5)].map((_, i) => (<div key={i} className="bg-gray-100 rounded-xl p-4"><div className="h-4 bg-gray-200 rounded w-3/4 mb-2" /><div className="h-6 bg-gray-200 rounded w-1/2" /></div>))}</div></div>
        {[...Array(3)].map((_, i) => (<div key={i} className="bg-white rounded-2xl shadow-sm p-6"><div className="h-24 bg-gray-200 rounded" /></div>))}
      </div>
    </div>
  );

  const statCards: StatCard[] = [
    { label: 'All Bookings', value: bookingStats.all,       key: 'all',       Icon: BusIcon     },
    { label: 'Confirmed',    value: bookingStats.confirmed, key: 'confirmed', Icon: CheckCircle },
    { label: 'Pending',      value: bookingStats.pending,   key: 'pending',   Icon: Clock       },
    { label: 'Cancelled',    value: bookingStats.cancelled, key: 'cancelled', Icon: XCircle     },
    { label: 'Upcoming',     value: bookingStats.upcoming,  key: 'upcoming',  Icon: Calendar    },
  ];

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {notifications.length > 0 && (
            <div className="fixed top-4 right-4 z-50 space-y-2">
              {notifications.map((n, i) => (
                <div key={i} className="bg-emerald-500 text-white p-4 rounded-lg shadow-lg max-w-sm flex items-start gap-3">
                  <Bell className="w-5 h-5 mt-0.5 shrink-0" />
                  <div><p className="font-medium text-sm">Booking Update</p><p className="text-xs opacity-90 mt-1">{n}</p></div>
                  <button onClick={() => setNotifications((p) => p.filter((_, j) => j !== i))} className="ml-auto text-white/80 hover:text-white"><XCircle className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}

          {success && <div className="mb-6"><AlertMessage type="success" message={success} onClose={() => setSuccess('')} /></div>}
          {error   && <div className="mb-6"><AlertMessage type="error"   message={error}   onClose={() => setError('')}   /></div>}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">My Bookings</h1>
                <p className="text-gray-600">Manage and track your bus ticket bookings</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <button onClick={() => fetchBookings()} disabled={loading} className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 w-full sm:w-auto">
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Refresh
                </button>
                <button onClick={() => router.push('/search')} className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all hover:scale-105 shadow-lg w-full sm:w-auto justify-center">
                  <Search className="w-4 h-4" />Book New Ticket
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
              {statCards.map(({ label, value, key, Icon }) => (
                <button key={key} onClick={() => handleStatusFilter(key)}
                  className={`p-4 rounded-xl transition-all hover:scale-105 border-2 ${activeFilter === key ? 'border-blue-200 bg-blue-50 shadow-md' : 'border-transparent bg-white hover:border-gray-200 shadow-sm'}`}>
                  <div className="flex items-center justify-center mb-2"><Icon className="w-5 h-5 text-gray-600" /></div>
                  <p className="text-2xl font-bold text-gray-900 text-center">{value}</p>
                  <p className="text-sm text-gray-600 text-center mt-1">{label}</p>
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-6 pt-4 border-t border-gray-100 gap-3">
              <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 w-full sm:w-auto">
                <Filter className="w-4 h-4" />{showFilters ? 'Hide Filters' : 'Show Filters'}
              </button>
              <p className="text-sm text-gray-600">Showing {filteredBookings.length} of {bookings.length} bookings</p>
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bus Type</label>
                  <select name="busType" value={(filters.busType as string) || ''} onChange={handleFilterChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    <option value="">All Types</option><option value="AC">AC</option><option value="Non-AC">Non-AC</option><option value="Sleeper">Sleeper</option><option value="Semi-Sleeper">Semi-Sleeper</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
                  <select name="company" value={(filters.company as string) || ''} onChange={handleFilterChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    <option value="">All Companies</option>
                    {[...new Set(bookings.map((b) => b.company.name))].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Price Range (MWK)</label>
                  <div className="flex gap-2">
                    <input type="number" name="priceRangeMin" placeholder="Min" value={(filters.priceRange as any)?.min || ''} onChange={handleFilterChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                    <input type="number" name="priceRangeMax" placeholder="Max" value={(filters.priceRange as any)?.max || ''} onChange={handleFilterChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="sm:col-span-2 md:col-span-3">
                  <button onClick={() => { setFilters({}); setActiveFilter('all'); }} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                    <XCircle className="w-4 h-4" />Clear Filters
                  </button>
                </div>
              </div>
            )}
          </div>

          {filteredBookings.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
              <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6"><BusIcon className="w-10 h-10 text-gray-400" /></div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No {activeFilter === 'all' ? '' : activeFilter} bookings found</h3>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">{activeFilter === 'all' ? "You haven't made any bus bookings yet." : `You don't have any ${activeFilter} bookings.`}</p>
              <button onClick={() => router.push('/search')} className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all hover:scale-105 shadow-lg">
                <Search className="w-5 h-5" />Search for Buses
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {paginatedBookings.map((b) => (
                <BookingCard key={b.id} booking={b} onCancel={handleCancelBooking} onDelete={handleDeleteBooking}
                  onDownload={handleDownloadTicket} onPayment={handleOpenPayment} actionLoading={actionLoading}
                  formatTime={formatTime} formatDate={formatDate} getStatusColor={getStatusColor} getPaymentStatusColor={getPaymentStatusColor}
                />
              ))}
              {filteredBookings.length > bookingsPerPage && (
                <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-3">
                  <button onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} disabled={currentPage === 1} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg disabled:opacity-50 hover:bg-gray-200 w-full sm:w-auto">Previous</button>
                  <span className="text-sm text-gray-600">Page {currentPage} of {totalPages} ({filteredBookings.length} total)</span>
                  <button onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg disabled:opacity-50 hover:bg-gray-200 w-full sm:w-auto">Next</button>
                </div>
              )}
            </div>
          )}

          <Modal isOpen={methodModalOpen} onClose={() => setMethodModalOpen(false)} title="Choose Payment Method">
            {selectedBooking && (
              <PaymentMethodSelector booking={selectedBooking} onSelect={handleMethodSelect} loading={actionLoading === selectedBooking.id} />
            )}
          </Modal>

          <Modal isOpen={confirmModalOpen} onClose={() => setConfirmModalOpen(false)} title="Confirm & Pay">
            {selectedBooking && (
              <ConfirmAndPayForm
                booking={selectedBooking}
                subMethodId={selectedSubId}
                providerLabel={selectedLabel}
                provider={selectedProvider}
                userDetails={userDetails}
                onChange={setUserDetails}
                onSubmit={handleConfirmAndPay}
                loading={actionLoading === selectedBooking.id}
                formatDate={formatDate}
                formatTime={formatTime}
              />
            )}
          </Modal>

        </div>
      </div>
    </ErrorBoundary>
  );
};

export default BookingsPage;