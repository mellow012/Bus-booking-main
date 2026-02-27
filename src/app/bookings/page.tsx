'use client';

import React, { useState, useEffect, useCallback, useMemo, memo, ChangeEvent, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { sendNotification } from '../../contexts/NotificationContext';
import { NotificationTemplates } from '@/utils/notificationHelper';
import {
  collection, query, where, getDocs, doc, getDoc, orderBy,
  updateDoc, deleteDoc, increment, arrayRemove, Timestamp,
  writeBatch, onSnapshot, serverTimestamp, limit as firestoreLimit,
} from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { useAuth } from '@/contexts/AuthContext';
import { Booking, Schedule, Bus, Route, Company, UserProfile, PaymentProvider } from '@/types';
import {
  Bus as BusIcon, MapPin, Clock, Download, XCircle, CheckCircle, Loader2,
  Search, CreditCard, Armchair, Bell, AlertTriangle, Calendar, Users,
  Filter, RefreshCw, Zap, Shield, Smartphone, ArrowRight, Trash2,
} from 'lucide-react';
import Modal from '../../components/Modals';
import AlertMessage from '../../components/AlertMessage';
import { getAuth } from 'firebase/auth';

// ────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────
interface BookingWithDetails extends Booking {
  schedule: Schedule;
  bus: Bus;
  route: Route;
  company: Company;
  paymentProvider?: PaymentProvider;
  originStopId?: string;
  destinationStopId?: string;
  originStopName?: string;
  destinationStopName?: string;
  pricePerPerson?: number;
}

interface SearchFilters {
  busType?: string | string[];
  priceRange?: { min?: number; max?: number };
  company?: string;
  [key: string]: any;
}

// ────────────────────────────────────────────────
// HELPER: resolve a stop id → human-readable name
// ────────────────────────────────────────────────
function resolveStopName(
  stopId: string | undefined,
  savedName: string | undefined,
  route: Route,
  fallback: string
): string {
  if (savedName) return savedName;
  if (stopId === '__origin__') return route.origin || fallback;
  if (stopId === '__destination__') return route.destination || fallback;
  if (stopId && route.stops) {
    const found = route.stops.find((s) => s.id === stopId);
    if (found) return found.name;
  }
  return fallback;
}

// ────────────────────────────────────────────────
// Error Boundary
// ────────────────────────────────────────────────
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ComponentType<{ error: Error; retry: () => void }> },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) { console.error('Bookings page error:', error, errorInfo); }
  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent error={this.state.error!} retry={() => this.setState({ hasError: false, error: null })} />;
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
      <button onClick={retry} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
        Try Again
      </button>
      <details className="mt-4 text-left">
        <summary className="text-sm text-gray-500 cursor-pointer">Technical Details</summary>
        <pre className="text-xs text-gray-400 mt-2 p-2 bg-gray-50 rounded overflow-auto">{error.message}</pre>
      </details>
    </div>
  </div>
);

// ────────────────────────────────────────────────
// Booking Card (Memoized)
// ────────────────────────────────────────────────
const BookingCard = memo<{
  booking: BookingWithDetails;
  onCancel: (bookingId: string, scheduleId: string, seatNumbers: string[]) => Promise<void>;
  onDelete: (bookingId: string) => Promise<void>;
  onDownload: (booking: BookingWithDetails, includeQR: boolean) => Promise<void>;
  onPayment: (booking: BookingWithDetails) => void;
  actionLoading: string | null;
  formatTime: (dateTime: any) => string;
  formatDate: (dateTime: any) => string;
  getStatusColor: (status: string) => string;
  getPaymentStatusColor: (status: string) => string;
  getPaymentMethodIcon: (method: string) => { Icon: React.ComponentType<any>; label: string; description: string; logo: string };
}>(({ booking, onCancel, onDelete, onDownload, onPayment, actionLoading,
      formatTime, formatDate, getStatusColor, getPaymentStatusColor, getPaymentMethodIcon }) => {

  const handleCancel = useCallback(() => onCancel(booking.id, booking.scheduleId, booking.seatNumbers), [booking.id, booking.scheduleId, booking.seatNumbers, onCancel]);
  const handleDelete = useCallback(() => onDelete(booking.id), [booking.id, onDelete]);
  const handleDownloadWithQR = useCallback(() => onDownload(booking, true), [booking, onDownload]);
  const handleDownloadOnly = useCallback(() => onDownload(booking, false), [booking, onDownload]);
  const handlePayment = useCallback(() => onPayment(booking), [booking, onPayment]);

  const originName = resolveStopName(booking.originStopId, booking.originStopName, booking.route, booking.route?.origin || 'N/A');
  const alightName = resolveStopName(booking.destinationStopId, booking.destinationStopName, booking.route, booking.route?.destination || 'N/A');
  const isSegment = originName !== (booking.route?.origin || '') || alightName !== (booking.route?.destination || '');

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all duration-300">
      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
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
            {isSegment && (
              <span className="px-3 py-1 rounded-full text-xs font-medium border bg-orange-50 text-orange-700 border-orange-200">
                Segment
              </span>
            )}
          </div>
        </div>

        {/* Journey */}
        <div className="flex flex-col sm:flex-row items-center gap-4 p-3 bg-gray-50 rounded-xl mb-4">
          <div className="text-center min-w-[80px]">
            <div className="text-lg sm:text-xl font-bold text-gray-900">{formatTime(booking.schedule.departureDateTime)}</div>
            <div className="text-sm text-gray-600 flex items-center justify-center gap-1">
              <MapPin className="w-3 h-3" /><span className="truncate">{originName}</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">{formatDate(booking.schedule.departureDateTime)}</div>
          </div>
          <div className="flex-1 mx-2 hidden sm:block">
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t-2 border-dashed border-gray-300"></div></div>
              <div className="relative flex justify-center">
                <div className="bg-white px-3 py-1 rounded-full border border-gray-200"><BusIcon className="w-4 h-4 text-gray-500" /></div>
              </div>
            </div>
            <div className="text-center mt-2">
              <span className="text-xs text-gray-500">
                {Math.floor((booking.route.duration || 0) / 60)}h {(booking.route.duration || 0) % 60}m
              </span>
            </div>
          </div>
          <div className="text-center min-w-[80px]">
            <div className="text-lg sm:text-xl font-bold text-gray-900">{formatTime(booking.schedule.arrivalDateTime)}</div>
            <div className="text-sm text-gray-600 flex items-center justify-center gap-1">
              <MapPin className="w-3 h-3" /><span className="truncate">{alightName}</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">{formatDate(booking.schedule.arrivalDateTime)}</div>
          </div>
        </div>

        {isSegment && (
          <div className="mb-4 px-3 py-2 bg-orange-50 border border-orange-100 rounded-lg text-xs text-orange-700">
            Full route: {booking.route?.origin} → {booking.route?.destination}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="md:col-span-2 lg:col-span-2">
            <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <BusIcon className="w-4 h-4 text-gray-400" />
                <span className="truncate">{booking.bus?.busType || 'N/A'} • {booking.bus?.licensePlate || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" />
                <span>{booking.passengerDetails?.length || 0} passenger{(booking.passengerDetails?.length || 0) > 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-2">
                <Armchair className="w-4 h-4 text-gray-400" />
                <span className="truncate">Seats: {booking.seatNumbers.join(', ')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="truncate">Booked: {formatDate(booking.createdAt)}</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-3 md:p-4">
            <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2"><Users className="w-4 h-4" />Passengers</h4>
            <div className="space-y-2 max-h-36 overflow-y-auto text-sm">
              {booking.passengerDetails.map((passenger, index) => (
                <div key={index} className="text-sm">
                  <p className="font-medium text-gray-800 truncate">{passenger.name}</p>
                  <p className="text-gray-600">Age: {passenger.age} • {passenger.gender} • Seat: {passenger.seatNumber}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col justify-between lg:col-span-1">
            <div className="mb-3 text-right">
              <div className="text-2xl font-bold text-gray-900">MWK {booking.totalAmount?.toLocaleString()}</div>
              <div className="text-sm text-gray-600">Total Amount</div>
              {booking.pricePerPerson && booking.passengerDetails?.length > 1 && (
                <div className="text-xs text-gray-500">
                  MWK {booking.pricePerPerson.toLocaleString()} × {booking.passengerDetails.length}
                </div>
              )}
            </div>

            {booking.paymentProvider && (
              <div className="text-right text-xs text-gray-500 mb-3 flex items-center gap-2 justify-end">
                <span className="truncate">{getPaymentMethodIcon(booking.paymentProvider).label}</span>
              </div>
            )}

            <div className="space-y-2">
              {booking.bookingStatus === 'confirmed' && booking.paymentStatus === 'pending' && (
                <button onClick={handlePayment} disabled={actionLoading === booking.id}
                  className="w-full px-3 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-md flex items-center justify-center gap-2">
                  {actionLoading === booking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Zap className="w-4 h-4" /><span className="font-medium">Pay Now</span></>}
                </button>
              )}
              {booking.bookingStatus === 'confirmed' && booking.paymentStatus === 'paid' && (<>
                <button onClick={handleDownloadWithQR} disabled={actionLoading === `download_${booking.id}`}
                  className="w-full px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200 flex items-center justify-center gap-2">
                  {actionLoading === `download_${booking.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Download className="w-4 h-4" /><span>Ticket + QR</span></>}
                </button>
                <button onClick={handleDownloadOnly} disabled={actionLoading === `download_${booking.id}`}
                  className="w-full px-3 py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 flex items-center justify-center gap-2">
                  <Download className="w-4 h-4" /><span>Ticket Only</span>
                </button>
              </>)}
              {(booking.bookingStatus === 'pending' || (booking.bookingStatus === 'confirmed' && booking.paymentStatus === 'pending')) && (
                <button onClick={handleCancel} disabled={actionLoading === booking.id}
                  className="w-full px-3 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors border border-red-200 flex items-center justify-center gap-2">
                  {actionLoading === booking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><XCircle className="w-4 h-4" /><span>Cancel</span></>}
                </button>
              )}
              {booking.bookingStatus === 'confirmed' && booking.paymentStatus === 'paid' && (
                <button onClick={handleCancel} disabled={actionLoading === booking.id}
                  className="w-full px-3 py-2 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors border border-amber-200 flex items-center justify-center gap-2">
                  {actionLoading === booking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><AlertTriangle className="w-4 h-4" /><span>Request Refund</span></>}
                </button>
              )}
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

      {booking.bookingStatus === 'confirmed' && booking.paymentStatus === 'pending' && (
        <div className="bg-gradient-to-r from-emerald-50 to-blue-50 border-t border-emerald-200 p-3 sm:p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-800">Booking Approved - Payment Required</p>
              <p className="text-xs text-emerald-700">Your booking has been confirmed by the admin. Complete payment to secure your seats.</p>
            </div>
            <div className="ml-auto"><Shield className="w-5 h-5 text-emerald-600" /></div>
          </div>
        </div>
      )}
    </div>
  );
});

BookingCard.displayName = 'BookingCard';

// ────────────────────────────────────────────────
// Main Bookings Page
// ────────────────────────────────────────────────
const BookingsPage: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userProfile } = useAuth();

  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<BookingWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [paymentMethodModalOpen, setPaymentMethodModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingWithDetails | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const bookingsPerPage = 5;

  const [userDetails, setUserDetails] = useState({
    name: `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim() || '',
    email: userProfile?.email || '',
    phone: userProfile?.phone || '+265',
  });

  const cleanupFunctions = useMemo(() => new Set<() => void>(), []);
  const statusesMapRef = React.useRef<Map<string, { bookingStatus: string; paymentStatus: string }>>(new Map());
  const initialSnapshotRef = React.useRef(true);

  // ─── Cache refs to avoid re-fetching already-loaded related docs ───────────
  // Maps keyed by Firestore doc ID → fetched data. Persists across fetchBookings calls.
  const scheduleCache = React.useRef<Map<string, Schedule>>(new Map());
  const busCache      = React.useRef<Map<string, Bus>>(new Map());
  const routeCache    = React.useRef<Map<string, Route>>(new Map());
  const companyCache  = React.useRef<Map<string, Company>>(new Map());

  const formatTime = useCallback((dateTime: any) => {
    let date: Date;
    if (dateTime instanceof Date) date = dateTime;
    else if (dateTime?.toDate) date = dateTime.toDate();
    else if (dateTime?.seconds) date = new Date(dateTime.seconds * 1000);
    else if (typeof dateTime === 'string') date = new Date(dateTime);
    else return 'Invalid Time';
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }, []);

  const formatDate = useCallback((dateTime: any) => {
    let date: Date;
    if (dateTime instanceof Date) date = dateTime;
    else if (dateTime?.toDate) date = dateTime.toDate();
    else if (dateTime?.seconds) date = new Date(dateTime.seconds * 1000);
    else if (typeof dateTime === 'string') date = new Date(dateTime);
    else return 'Invalid Date';
    return date.toLocaleDateString('en-GB', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  }, []);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      case 'pending': return 'bg-amber-100 text-amber-800 border-amber-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }, []);

  const getPaymentStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'paid': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'failed': return 'bg-red-100 text-red-800 border-red-200';
      case 'pending': return 'bg-amber-100 text-amber-800 border-amber-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }, []);

  const getPaymentMethodIcon = useCallback((method: string) => {
    switch (method) {
      case 'mobile_money': return { Icon: Smartphone, label: 'Mobile Money', description: 'Airtel Money, TNM Mpamba', logo: '/images/mobile-money.png' };
      case 'card': case 'credit_card': return { Icon: CreditCard, label: 'Card Payment', description: 'Visa, Mastercard', logo: '/nb logo.jpg' };
      default: return { Icon: CreditCard, label: 'Secure Payment', description: 'Safe & secure', logo: '/images/payment-default.png' };
    }
  }, []);

  function isBookingExpired(booking: BookingWithDetails): boolean {
    const now = new Date();
    const arrivalDate = booking.schedule.arrivalDateTime instanceof Timestamp
      ? booking.schedule.arrivalDateTime.toDate()
      : new Date(booking.schedule.arrivalDateTime);
    const isTripPast = arrivalDate < now;
    const isIncomplete = booking.bookingStatus !== 'completed' && booking.bookingStatus !== 'cancelled'
      && !(booking.bookingStatus === 'confirmed' && booking.paymentStatus === 'paid');
    return isTripPast && isIncomplete;
  }

  const applyFiltersLogic = (bookingsToFilter: BookingWithDetails[], currentActiveFilter: string, currentFilters: SearchFilters) => {
    let filtered = [...bookingsToFilter];
    if (currentActiveFilter !== 'all') {
      switch (currentActiveFilter) {
        case 'confirmed': filtered = filtered.filter((b) => b.bookingStatus === 'confirmed' && b.paymentStatus === 'paid'); break;
        case 'pending': filtered = filtered.filter((b) => b.bookingStatus === 'pending' || (b.bookingStatus === 'confirmed' && b.paymentStatus === 'pending')); break;
        case 'cancelled': filtered = filtered.filter((b) => b.bookingStatus === 'cancelled'); break;
        case 'upcoming':
          const now = new Date();
          filtered = filtered.filter((b) => {
            if (!b.schedule?.departureDateTime) return false;
            const d = b.schedule.departureDateTime instanceof Timestamp ? b.schedule.departureDateTime.toDate() : new Date(b.schedule.departureDateTime);
            return d > now && b.bookingStatus === 'confirmed' && b.paymentStatus === 'paid';
          });
          break;
      }
    }
    if (currentFilters.busType) {
      const types = Array.isArray(currentFilters.busType) ? currentFilters.busType : [currentFilters.busType];
      filtered = filtered.filter((b) => b.bus?.busType && types.includes(b.bus.busType));
    }
    if (currentFilters.priceRange) {
      filtered = filtered.filter((b) => b.schedule?.price !== undefined &&
        b.schedule.price >= (currentFilters.priceRange?.min || 0) &&
        b.schedule.price <= (currentFilters.priceRange?.max || Infinity));
    }
    if (currentFilters.company) filtered = filtered.filter((b) => b.company?.name === currentFilters.company);
    setFilteredBookings(filtered);
    setCurrentPage(1);
  };

  // ─── OPTIMIZED fetchBookings ────────────────────────────────────────────────
  // Key changes:
  //   1. Collect all unique IDs first, fetch each only ONCE (not once per booking).
  //   2. Use in-memory cache refs so repeated calls (after cancel/delete) don't
  //      re-read docs that haven't changed.
  //   3. Remove the nested per-booking getDoc waterfall entirely.
  const fetchBookings = useCallback(async (retryCount = 0) => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      // Step 1: Fetch the user's bookings (1 read for up to 50 docs)
      const bookingsQuery = query(
        collection(db, 'bookings'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        firestoreLimit(50),
      );
      const bookingsSnapshot = await getDocs(bookingsQuery);
      const rawBookings = bookingsSnapshot.docs.map((d) => ({
        id: d.id,
        bookingReference: d.data().bookingReference || d.id,
        ...d.data(),
        bookingDate: d.data().bookingDate instanceof Timestamp ? d.data().bookingDate.toDate() : new Date(d.data().bookingDate),
        createdAt: d.data().createdAt instanceof Timestamp ? d.data().createdAt.toDate() : new Date(d.data().createdAt),
        updatedAt: d.data().updatedAt instanceof Timestamp ? d.data().updatedAt.toDate() : new Date(d.data().updatedAt),
      })) as unknown as Booking[];

      // Step 2: Collect unique IDs — only fetch what we don't already have cached
      const scheduleIdsNeeded  = new Set<string>();
      const companyIdsNeeded   = new Set<string>();

      rawBookings.forEach((b) => {
        if (b.scheduleId && !scheduleCache.current.has(b.scheduleId)) scheduleIdsNeeded.add(b.scheduleId);
        if (b.companyId  && !companyCache.current.has(b.companyId))   companyIdsNeeded.add(b.companyId);
      });

      // Step 3: Batch-fetch schedules (1 read per unique schedule not already cached)
      await Promise.all(
        [...scheduleIdsNeeded].map(async (id) => {
          const snap = await getDoc(doc(db, 'schedules', id));
          if (snap.exists()) scheduleCache.current.set(id, { id: snap.id, ...snap.data() } as Schedule);
        })
      );

      // Step 4: Now we know which busIds / routeIds we need
      const busIdsNeeded   = new Set<string>();
      const routeIdsNeeded = new Set<string>();

      rawBookings.forEach((b) => {
        const schedule = scheduleCache.current.get(b.scheduleId);
        if (!schedule) return;
        if (schedule.busId   && !busCache.current.has(schedule.busId))     busIdsNeeded.add(schedule.busId);
        if (schedule.routeId && !routeCache.current.has(schedule.routeId)) routeIdsNeeded.add(schedule.routeId);
      });

      // Step 5: Batch-fetch buses, routes, companies in parallel
      await Promise.all([
        ...[...busIdsNeeded].map(async (id) => {
          const snap = await getDoc(doc(db, 'buses', id));
          if (snap.exists()) busCache.current.set(id, { id: snap.id, ...snap.data() } as Bus);
        }),
        ...[...routeIdsNeeded].map(async (id) => {
          const snap = await getDoc(doc(db, 'routes', id));
          if (snap.exists()) routeCache.current.set(id, { id: snap.id, ...snap.data() } as Route);
        }),
        ...[...companyIdsNeeded].map(async (id) => {
          const snap = await getDoc(doc(db, 'companies', id));
          if (snap.exists()) companyCache.current.set(id, { id: snap.id, ...snap.data() } as Company);
        }),
      ]);

      // Step 6: Join everything from caches — zero extra Firestore reads
      const bookingsWithDetails: BookingWithDetails[] = [];
      for (const booking of rawBookings) {
        const schedule = scheduleCache.current.get(booking.scheduleId);
        const company  = companyCache.current.get(booking.companyId);
        if (!schedule || !company) continue;

        const bus   = busCache.current.get(schedule.busId);
        const route = routeCache.current.get(schedule.routeId);
        if (!bus || !route) continue;

        bookingsWithDetails.push({ ...booking, schedule, bus, route, company } as BookingWithDetails);
      }

      const validBookings = bookingsWithDetails.filter((b) => !isBookingExpired(b));
      setBookings(validBookings);
      applyFiltersLogic(validBookings, activeFilter, filters);
    } catch (err: any) {
      if (retryCount < 2) { setTimeout(() => fetchBookings(retryCount + 1), 1000 * Math.pow(2, retryCount)); return; }
      setError('Failed to load bookings. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [user, activeFilter, filters]);

  const handleCancelBooking = useCallback(async (bookingId: string, scheduleId: string, seatNumbers: string[]) => {
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) { setError('Booking not found'); return; }
    if (!booking.seatNumbers?.length || !booking.passengerDetails?.length) { setError('Invalid booking data.'); return; }
    const departureDate = booking.schedule.departureDateTime instanceof Timestamp ? booking.schedule.departureDateTime.toDate() : new Date(booking.schedule.departureDateTime);
    if (departureDate < new Date()) { setError('Cannot cancel a booking for a past departure.'); return; }

    let isCancellationRequest = false;
    if (booking.paymentStatus === 'paid') {
      if (!window.confirm('This booking has been paid for. Cancelling may affect your refund eligibility. Continue?')) return;
      isCancellationRequest = true;
    }

    setActionLoading(bookingId);
    setError('');
    try {
      const batch = writeBatch(db);
      const updates: { [key: string]: any } = { updatedAt: serverTimestamp() };
      if (!isCancellationRequest) {
        updates.bookingStatus = 'cancelled';
        updates.cancellationDate = serverTimestamp();
        updates.cancellationReason = 'Customer initiated';
        sendNotification({ userId: booking.userId, ...NotificationTemplates.bookingConfirmed(booking.id, `${booking.route.origin} → ${booking.route.destination}`), message: `Your booking ${bookingId.slice(-8)} has been cancelled.` });
      } else {
        updates.cancellationRequested = true;
        updates.cancellationReason = 'Customer requested';
        sendNotification({ userId: booking.userId, type: 'cancellation_requested', title: 'Cancellation Requested', message: `Your cancellation request for booking ${bookingId.slice(-8)} is under review.`, data: { bookingId, url: `/bookings` } });
      }
      batch.update(doc(db, 'bookings', bookingId), updates);
      if (!isCancellationRequest) batch.update(doc(db, 'schedules', scheduleId), { availableSeats: increment(seatNumbers.length), bookedSeats: arrayRemove(...seatNumbers), updatedAt: serverTimestamp() });
      await batch.commit();

      // Invalidate the schedule cache entry so it's re-fetched fresh next time
      scheduleCache.current.delete(scheduleId);

      setSuccess(isCancellationRequest ? 'Cancellation requested. An admin will review your request.' : 'Booking cancelled successfully.');
      setTimeout(() => setSuccess(''), 5000);
      fetchBookings();
    } catch (err: any) {
      setError(`Failed to cancel booking: ${err.message || 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  }, [bookings, fetchBookings]);

  const handleDeleteBooking = useCallback(async (bookingId: string) => {
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking || booking.bookingStatus !== 'cancelled') { setError('Only canceled bookings can be deleted.'); return; }
    if (!window.confirm('Are you sure you want to permanently delete this canceled booking?')) return;
    setActionLoading(bookingId);
    try {
      await deleteDoc(doc(db, 'bookings', bookingId));
      setSuccess('Booking deleted successfully.');
      setTimeout(() => setSuccess(''), 5000);
      fetchBookings();
    } catch (err: any) {
      setError(`Failed to delete booking: ${err.message || 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  }, [bookings, fetchBookings]);

  const bookingStats = useMemo(() => {
    const now = new Date();
    return {
      all: bookings.length,
      confirmed: bookings.filter((b) => b.bookingStatus === 'confirmed' && b.paymentStatus === 'paid').length,
      pending: bookings.filter((b) => b.bookingStatus === 'pending' || (b.bookingStatus === 'confirmed' && b.paymentStatus === 'pending')).length,
      cancelled: bookings.filter((b) => b.bookingStatus === 'cancelled').length,
      upcoming: bookings.filter((b) => {
        if (!b.schedule?.departureDateTime) return false;
        const d = b.schedule.departureDateTime instanceof Timestamp ? b.schedule.departureDateTime.toDate() : new Date(b.schedule.departureDateTime);
        return d > now && b.bookingStatus === 'confirmed' && b.paymentStatus === 'paid';
      }).length,
    };
  }, [bookings]);

  const paginatedBookings = useMemo(() => filteredBookings.slice((currentPage - 1) * bookingsPerPage, currentPage * bookingsPerPage), [filteredBookings, currentPage]);
  const totalPages = useMemo(() => Math.ceil(filteredBookings.length / bookingsPerPage), [filteredBookings.length]);

  const handleFilterChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters((prev) => {
      const next = { ...prev };
      if (name === 'priceRangeMin' || name === 'priceRangeMax') {
        next.priceRange = { ...next.priceRange, [name === 'priceRangeMin' ? 'min' : 'max']: value ? Number(value) : undefined };
      } else { next[name] = value || undefined; }
      return next;
    });
  }, []);

  const handleStatusFilter = useCallback((status: string) => {
    setActiveFilter(status);
    applyFiltersLogic(bookings, status, filters);
  }, [bookings, filters]);

  const handleDownloadTicket = useCallback(async (booking: BookingWithDetails, includeQR: boolean) => {
    setActionLoading(`download_${booking.id}`);
    try {
      const [{ default: PDF }, { default: QR }] = await Promise.all([import('jspdf'), import('qrcode')]);
      const pdf = new PDF();
      let yPos = 30;
      const lh = 8;

      const boardingStop = resolveStopName(booking.originStopId, booking.originStopName, booking.route, booking.route.origin);
      const alightingStop = resolveStopName(booking.destinationStopId, booking.destinationStopName, booking.route, booking.route.destination);
      const isSegment = boardingStop !== booking.route.origin || alightingStop !== booking.route.destination;

      const addLine = (label: string, value: string, bold = false) => {
        pdf.setFont('helvetica', bold ? 'bold' : 'normal');
        pdf.text(`${label}: ${value}`, 20, yPos);
        pdf.setFont('helvetica', 'normal');
        yPos += lh;
      };

      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Bus Ticket', 20, 20);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');

      addLine('Booking Reference', booking.bookingReference || booking.id.slice(-8), true);
      addLine('Company', booking.company.name);
      addLine('Full Route', `${booking.route.origin} → ${booking.route.destination}`);

      if (isSegment) {
        yPos += 2;
        pdf.setFont('helvetica', 'bold');
        pdf.text('--- PASSENGER SEGMENT ---', 20, yPos); yPos += lh;
        pdf.setFont('helvetica', 'normal');
        addLine('Boarding Stop', boardingStop, true);
        addLine('Alighting Stop', alightingStop, true);
        yPos += 2;
      } else {
        addLine('Boarding Stop', boardingStop);
        addLine('Alighting Stop', alightingStop);
      }

      addLine('Date', formatDate(booking.schedule.departureDateTime));
      addLine('Departure', formatTime(booking.schedule.departureDateTime));
      addLine('Arrival (Est.)', formatTime(booking.schedule.arrivalDateTime));
      addLine('Bus', `${booking.bus.busType} (${booking.bus.licensePlate || 'N/A'})`);
      addLine('Seats', booking.seatNumbers.join(', '));

      yPos += 4;
      pdf.text('Passengers:', 20, yPos); yPos += lh;
      booking.passengerDetails.forEach((p) => { pdf.text(`• ${p.name} (Age: ${p.age}, Seat: ${p.seatNumber})`, 25, yPos); yPos += lh; });

      yPos += 4;
      addLine('Total Amount', `MWK ${booking.totalAmount.toLocaleString()}`, true);
      if (booking.pricePerPerson && booking.passengerDetails.length > 1) {
        addLine('Price Breakdown', `MWK ${booking.pricePerPerson.toLocaleString()} × ${booking.passengerDetails.length} passengers`);
      }
      addLine('Payment Status', booking.paymentStatus.charAt(0).toUpperCase() + booking.paymentStatus.slice(1));

      if (includeQR && booking.bookingStatus === 'confirmed' && booking.paymentStatus === 'paid') {
        const qrData = JSON.stringify({ bookingId: booking.id, bookingReference: booking.bookingReference, boardingStop, alightingStop, seats: booking.seatNumbers, passengers: booking.passengerDetails.length, amount: booking.totalAmount });
        const qrCode = await QR.toDataURL(qrData, { width: 200 });
        pdf.addImage(qrCode, 'PNG', 140, 30, 50, 50);
        pdf.setFontSize(8);
        pdf.text('Scan for verification', 150, 85);
      }

      pdf.save(`ticket_${booking.bookingReference || booking.id.slice(-8)}.pdf`);
      setSuccess('Ticket downloaded successfully!');
    } catch (err) {
      console.error('PDF generation error:', err);
      setError('Failed to generate ticket PDF. Please try again.');
    } finally {
      setActionLoading(null);
    }
  }, [formatDate, formatTime]);

  const handleConfirmDetails = useCallback((booking: BookingWithDetails) => {
    if (!booking.seatNumbers?.length || !booking.passengerDetails?.length) { setError('Invalid booking data.'); return; }
    setSelectedBooking(booking);
    const primaryPassenger = booking.passengerDetails[0];
    setUserDetails({ name: primaryPassenger.name || `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim() || '', email: userProfile?.email || '', phone: userProfile?.phone || '+265' });
    setPaymentMethodModalOpen(true);
  }, [userProfile]);

  const handlePaymentMethodSelect = useCallback((method: string) => { setSelectedPaymentMethod(method); setPaymentMethodModalOpen(false); setConfirmModalOpen(true); }, []);

  const handleConfirmSubmit = useCallback((e: FormEvent) => {
    e.preventDefault();
    if (!userDetails.name || userDetails.name.trim().length < 2) { setError('Please provide a valid full name'); return; }
    if (!userDetails.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userDetails.email)) { setError('Please provide a valid email'); return; }
    if (!userDetails.phone || !/^\+?\d{10,15}$/.test(userDetails.phone.replace(/\s/g, ''))) { setError('Please provide a valid phone number'); return; }
    setConfirmModalOpen(false);
    setPaymentModalOpen(true);
  }, [userDetails]);

  const handlePayment = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedBooking || !selectedPaymentMethod) { setError('Please select a booking and payment method'); return; }
    setActionLoading(selectedBooking.id);
    setError('');
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('User not authenticated');
      const idToken = await currentUser.getIdToken();
      const response = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: selectedBooking.id, paymentProvider: selectedPaymentMethod === 'card' ? 'stripe' : 'paychangu', customerDetails: { email: userDetails.email.toLowerCase().trim(), name: userDetails.name.trim(), phone: userDetails.phone.trim() }, metadata: { route: `${selectedBooking.route.origin}-${selectedBooking.route.destination}`, departure: selectedBooking.schedule.departureDateTime instanceof Timestamp ? selectedBooking.schedule.departureDateTime.toDate().toISOString() : new Date(selectedBooking.schedule.departureDateTime).toISOString(), passengerCount: selectedBooking.passengerDetails.length.toString(), seatNumbers: selectedBooking.seatNumbers.join(',') } }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || result.message || 'Failed to create payment session');
      if (result.success && result.checkoutUrl) {
        setPaymentModalOpen(false);
        setSuccess(`Redirecting to ${selectedPaymentMethod === 'card' ? 'Stripe' : 'PayChangu'}...`);
        setTimeout(() => { window.location.href = result.checkoutUrl; }, 1500);
      } else throw new Error(result.error || 'Invalid response from server');
    } catch (err: any) {
      setError(`Payment failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  }, [selectedBooking, selectedPaymentMethod, userDetails]);

  const verifyPaymentStatus = useCallback(async (provider: string, identifier: string) => {
    setActionLoading(`verify_${identifier}`);
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('User not authenticated');
      const idToken = await currentUser.getIdToken();
      const params = new URLSearchParams({ provider });
      if (provider === 'stripe') params.append('session_id', identifier);
      else if (provider === 'paychangu') params.append('tx_ref', identifier);
      const response = await fetch(`/api/payments/verify?${params.toString()}`, { headers: { Authorization: `Bearer ${idToken}`, Accept: 'application/json' } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Verification failed');
      if (result.success && result.status === 'paid') { setSuccess('Payment verified!'); fetchBookings(); }
      else setError(`Payment status: ${result.status}. ${result.message || ''}`);
    } catch (err: any) {
      setError(`Failed to verify payment: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  }, [fetchBookings]);

  // Initial load
  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    const paymentVerify = searchParams.get('payment_verify');
    const provider = searchParams.get('provider');
    const successParam = searchParams.get('success');
    const cancelled = searchParams.get('cancelled');
    const sessionId = searchParams.get('session_id');
    const txRef = searchParams.get('tx_ref');
    if (successParam === 'true' && !paymentVerify) { setSuccess('Action completed successfully!'); setTimeout(() => setSuccess(''), 5000); }
    if (cancelled === 'true') { setError('Payment was cancelled. You can try again anytime.'); setTimeout(() => setError(''), 5000); }
    if (paymentVerify === 'true' && provider) {
      if (provider === 'stripe' && sessionId) verifyPaymentStatus('stripe', sessionId);
      else if (provider === 'paychangu' && txRef) verifyPaymentStatus('paychangu', txRef);
      else setError('Invalid payment verification parameters');
      const cleanUrl = new URL(window.location.href);
      ['payment_verify', 'provider', 'session_id', 'tx_ref', 'cancelled', 'success'].forEach((k) => cleanUrl.searchParams.delete(k));
      window.history.replaceState({}, '', cleanUrl.toString());
    }
    fetchBookings();
    return () => cleanupFunctions.forEach((cleanup) => cleanup());
  }, [user, router]);

  // Real-time listener — only tracks STATUS CHANGES, does NOT re-fetch all data
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'bookings'), where('userId', '==', user.uid), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (initialSnapshotRef.current) {
        snapshot.docs.forEach((d) => { const data = d.data() || {}; statusesMapRef.current.set(d.id, { bookingStatus: data.bookingStatus || '', paymentStatus: data.paymentStatus || '' }); });
        initialSnapshotRef.current = false;
        return;
      }
      snapshot.docChanges().forEach((change) => {
        if (change.type !== 'modified') return;
        const id = change.doc.id;
        const newData = change.doc.data() || {};
        const prev = statusesMapRef.current.get(id) || { bookingStatus: '', paymentStatus: '' };
        const newBookingStatus = newData.bookingStatus || '';
        const newPaymentStatus = newData.paymentStatus || '';
        if (prev.bookingStatus !== newBookingStatus) {
          const ref = newData.bookingReference || id.slice(-8);
          const msg = newBookingStatus === 'confirmed' ? `Your booking ${ref} has been approved.` : `Your booking ${ref} status changed to "${newBookingStatus}".`;
          setNotifications((p) => [msg, ...p]); setSuccess(msg); setTimeout(() => setSuccess(''), 6000);
          fetchBookings(); // only re-fetch on status change
        }
        if (prev.paymentStatus !== newPaymentStatus) {
          const ref = newData.bookingReference || id.slice(-8);
          const msg = newPaymentStatus === 'paid' ? `Payment received for booking ${ref}. Thank you!` : `Payment status for booking ${ref} updated to "${newPaymentStatus}".`;
          setNotifications((p) => [msg, ...p]); setSuccess(msg); setTimeout(() => setSuccess(''), 6000);
          fetchBookings(); // only re-fetch on status change
        }
        statusesMapRef.current.set(id, { bookingStatus: newBookingStatus, paymentStatus: newPaymentStatus });
      });
    }, (err) => console.error('Realtime listener error:', err));
    cleanupFunctions.add(unsubscribe);
    return () => { unsubscribe(); cleanupFunctions.delete(unsubscribe); };
  }, [user, cleanupFunctions]);

  // Apply filters on change
  useEffect(() => { applyFiltersLogic(bookings, activeFilter, filters); }, [activeFilter, filters, bookings]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-6">
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {[...Array(5)].map((_, i) => (<div key={i} className="bg-gray-100 rounded-xl p-4"><div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div><div className="h-6 bg-gray-200 rounded w-1/2"></div></div>))}
              </div>
            </div>
            {[...Array(3)].map((_, i) => (<div key={i} className="bg-white rounded-2xl shadow-sm p-6"><div className="h-24 bg-gray-200 rounded"></div></div>))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {notifications.length > 0 && (
            <div className="fixed top-4 right-4 z-50 space-y-2">
              {notifications.map((notification, index) => (
                <div key={index} className="bg-emerald-500 text-white p-4 rounded-lg shadow-lg max-w-sm flex items-start gap-3">
                  <Bell className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <div><p className="font-medium text-sm">Booking Update</p><p className="text-xs opacity-90 mt-1">{notification}</p></div>
                  <button onClick={() => setNotifications((prev) => prev.filter((_, i) => i !== index))} className="ml-auto text-white/80 hover:text-white"><XCircle className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}

          {success && <div className="mb-6"><AlertMessage type="success" message={success} onClose={() => setSuccess('')} /></div>}
          {error && <div className="mb-6"><AlertMessage type="error" message={error} onClose={() => setError('')} /></div>}

          {/* Header */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">My Bookings</h1>
                <p className="text-gray-600">Manage and track your bus ticket bookings</p>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
                <button onClick={() => fetchBookings()} disabled={loading} className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 w-full sm:w-auto">
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Refresh
                </button>
                <button onClick={() => router.push('/search')} className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:scale-105 shadow-lg w-full sm:w-auto justify-center">
                  <Search className="w-4 h-4" />Book New Ticket
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
              {[
                { label: 'All Bookings', value: bookingStats.all, key: 'all', icon: BusIcon },
                { label: 'Confirmed', value: bookingStats.confirmed, key: 'confirmed', icon: CheckCircle },
                { label: 'Pending', value: bookingStats.pending, key: 'pending', icon: Clock },
                { label: 'Cancelled', value: bookingStats.cancelled, key: 'cancelled', icon: XCircle },
                { label: 'Upcoming', value: bookingStats.upcoming, key: 'upcoming', icon: Calendar },
              ].map(({ label, value, key, icon: Icon }) => (
                <button key={key} onClick={() => handleStatusFilter(key)} className={`p-4 rounded-xl transition-all transform hover:scale-105 border-2 ${activeFilter === key ? 'border-blue-200 bg-blue-50 shadow-md' : 'border-transparent bg-white hover:border-gray-200 shadow-sm'}`}>
                  <div className="flex items-center justify-center gap-2 mb-2"><Icon className="w-5 h-5 text-gray-600" /></div>
                  <div className="text-center"><p className="text-2xl font-bold text-gray-900">{value}</p><p className="text-sm text-gray-600 mt-1">{label}</p></div>
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-6 pt-4 border-t border-gray-100 gap-3">
              <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors w-full sm:w-auto">
                <Filter className="w-4 h-4" />{showFilters ? 'Hide Filters' : 'Show Filters'}
              </button>
              <p className="text-sm text-gray-600">Showing {filteredBookings.length} of {bookings.length} bookings</p>
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bus Type</label>
                  <select name="busType" value={(filters.busType as string) || ''} onChange={handleFilterChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    <option value="">All Types</option>
                    <option value="AC">AC</option><option value="Non-AC">Non-AC</option><option value="Sleeper">Sleeper</option><option value="Semi-Sleeper">Semi-Sleeper</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
                  <select name="company" value={filters.company || ''} onChange={handleFilterChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    <option value="">All Companies</option>
                    {[...new Set(bookings.map((b) => b.company.name))].map((name) => <option key={name} value={name}>{name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Price Range</label>
                  <div className="flex gap-2">
                    <input type="number" name="priceRangeMin" placeholder="Min" value={filters.priceRange?.min || ''} onChange={handleFilterChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                    <input type="number" name="priceRangeMax" placeholder="Max" value={filters.priceRange?.max || ''} onChange={handleFilterChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="sm:col-span-2 md:col-span-3">
                  <button onClick={() => { setFilters({}); setActiveFilter('all'); }} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2">
                    <XCircle className="w-4 h-4" />Clear Filters
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Booking List */}
          {filteredBookings.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
              <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6"><BusIcon className="w-10 h-10 text-gray-400" /></div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No {activeFilter === 'all' ? '' : activeFilter} bookings found</h3>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">{activeFilter === 'all' ? "You haven't made any bus bookings yet." : `You don't have any ${activeFilter} bookings at the moment.`}</p>
              <button onClick={() => router.push('/search')} className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:scale-105 shadow-lg">
                <Search className="w-5 h-5" />Search for Buses
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {paginatedBookings.map((booking) => (
                <BookingCard key={booking.id} booking={booking} onCancel={handleCancelBooking} onDelete={handleDeleteBooking} onDownload={handleDownloadTicket} onPayment={handleConfirmDetails} actionLoading={actionLoading} formatTime={formatTime} formatDate={formatDate} getStatusColor={getStatusColor} getPaymentStatusColor={getPaymentStatusColor} getPaymentMethodIcon={getPaymentMethodIcon} />
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

          {/* Payment Method Modal */}
          <Modal isOpen={paymentMethodModalOpen} onClose={() => setPaymentMethodModalOpen(false)} title="Choose Payment Method">
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2"><Shield className="w-5 h-5 text-blue-600" />Secure Payment Options</h3>
                {selectedBooking && (
                  <div className="space-y-1 text-sm text-blue-700">
                    <p><strong>Route:</strong> {selectedBooking.route.origin} → {selectedBooking.route.destination}</p>
                    <p><strong>Amount:</strong> MWK {selectedBooking.totalAmount.toLocaleString()}</p>
                    <p><strong>Passengers:</strong> {selectedBooking.passengerDetails.length}</p>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <button onClick={() => handlePaymentMethodSelect('mobile_money')} disabled={actionLoading === selectedBooking?.id} className="w-full flex items-center justify-between p-4 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-all border-2 border-emerald-200 group hover:shadow-md disabled:opacity-50">
                  <div className="flex items-center gap-3"><Smartphone className="w-8 h-8 text-emerald-600" /><div><p className="font-medium">Mobile Money</p><p className="text-xs text-emerald-600">Airtel Money, TNM Mpamba</p></div></div>
                  {actionLoading === selectedBooking?.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5 text-emerald-600" />}
                </button>
                <button onClick={() => handlePaymentMethodSelect('card')} disabled={actionLoading === selectedBooking?.id} className="w-full flex items-center justify-between p-4 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-all border-2 border-blue-200 group hover:shadow-md disabled:opacity-50">
                  <div className="flex items-center gap-3"><CreditCard className="w-8 h-8 text-blue-600" /><div><p className="font-medium">Card Payment</p><p className="text-xs text-blue-600">Visa, Mastercard</p></div></div>
                  {actionLoading === selectedBooking?.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5 text-blue-600" />}
                </button>
              </div>
            </div>
          </Modal>

          {/* Confirm Details Modal */}
          <Modal isOpen={confirmModalOpen} onClose={() => setConfirmModalOpen(false)} title="Confirm Payment Details">
            <form onSubmit={handleConfirmSubmit} className="space-y-6">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2"><Shield className="w-5 h-5 text-blue-600" />Booking Summary</h3>
                {selectedBooking && (
                  <div className="space-y-1 text-sm text-blue-700">
                    <p><strong>Route:</strong> {selectedBooking.route.origin} → {selectedBooking.route.destination}</p>
                    <p><strong>Departure:</strong> {formatDate(selectedBooking.schedule.departureDateTime)} {formatTime(selectedBooking.schedule.departureDateTime)}</p>
                    <p><strong>Amount:</strong> MWK {selectedBooking.totalAmount.toLocaleString()}</p>
                    <p><strong>Method:</strong> {getPaymentMethodIcon(selectedPaymentMethod || '').label}</p>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input type="text" value={userDetails.name} onChange={(e) => setUserDetails({ ...userDetails, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Enter your full name" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={userDetails.email} onChange={(e) => setUserDetails({ ...userDetails, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Enter your email" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input type="tel" value={userDetails.phone} onChange={(e) => setUserDetails({ ...userDetails, phone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="+265123456789" required />
              </div>
              <button type="submit" disabled={actionLoading === selectedBooking?.id} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-all transform hover:scale-105 shadow-lg disabled:opacity-50">
                {actionLoading === selectedBooking?.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Zap className="w-4 h-4" /><span className="font-medium">Confirm & Pay</span></>}
              </button>
            </form>
          </Modal>

          {/* Payment Modal */}
          <Modal isOpen={paymentModalOpen} onClose={() => setPaymentModalOpen(false)} title="Complete Your Payment">
            <form onSubmit={handlePayment} className="space-y-6">
              <div className="bg-gradient-to-r from-emerald-50 to-blue-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2"><Shield className="w-5 h-5 text-emerald-600" />Payment Details</h3>
                {selectedBooking && (
                  <div className="space-y-1 text-sm text-emerald-700">
                    <p><strong>Route:</strong> {selectedBooking.route.origin} → {selectedBooking.route.destination}</p>
                    <p><strong>Amount:</strong> MWK {selectedBooking.totalAmount.toLocaleString()}</p>
                    <p><strong>Method:</strong> {getPaymentMethodIcon(selectedPaymentMethod || '').label}</p>
                    <p><strong>Name:</strong> {userDetails.name}</p>
                    <p><strong>Email:</strong> {userDetails.email}</p>
                    <p><strong>Phone:</strong> {userDetails.phone}</p>
                  </div>
                )}
              </div>
              <button type="submit" disabled={actionLoading === selectedBooking?.id} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-all transform hover:scale-105 shadow-lg disabled:opacity-50">
                {actionLoading === selectedBooking?.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Zap className="w-4 h-4" /><span className="font-medium">Proceed to Pay</span></>}
              </button>
            </form>
          </Modal>

        </div>
      </div>
    </ErrorBoundary>
  );
};

export default BookingsPage;