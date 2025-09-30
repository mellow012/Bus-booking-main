'use client';

import React, { useState, useEffect, useCallback, useMemo, memo, ChangeEvent, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { sendNotification } from '../../contexts/NotificationContext'; // Adjust the import path'
import { NotificationTemplates } from '@/utils/notificationHelper';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  orderBy, 
  updateDoc, 
  deleteDoc, 
  increment, 
  arrayRemove, 
  Timestamp, 
  writeBatch, 
  onSnapshot,
  serverTimestamp,
  limit as firestoreLimit
} from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { useAuth } from '@/contexts/AuthContext';
import { Booking, Schedule, Bus, Route, Company, UserProfile } from '@/types';
import { 
  Bus as BusIcon, 
  MapPin, 
  Clock, 
  Currency, 
  Download, 
  XCircle, 
  CheckCircle, 
  Loader2, 
  Search, 
  CreditCard, 
  User, 
  Mail, 
  Phone, 
  Armchair, 
  Bell,
  AlertTriangle,
  Calendar,
  Users,
  Filter,
  RefreshCw,
  Zap,
  Shield,
  Smartphone,
  Building,
  Star,
  ArrowRight,
  Trash2
} from 'lucide-react';
import Modal from '../../components/Modals';
import AlertMessage from '../../components/AlertMessage';
import { getAuth } from 'firebase/auth';

const jsPDF = React.lazy(() => import('jspdf').then(module => ({ default: module.jsPDF as any })));
const QRCode = React.lazy(() => import('qrcode').then(module => ({ default: module.default as any })));

interface BookingWithDetails extends Booking {
  schedule: Schedule;
  bus: Bus;
  route: Route;
  company: Company;
  paymentProvider?: string;
}

interface SearchFilters {
    busType?: string | string[];
    priceRange?: { min?: number; max?: number };
    company?: string; // FIX: Added 'company' property to resolve the current error.
    // Add other filter properties as needed
    [key: string]: any;
}

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ComponentType<{error: Error; retry: () => void}> },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Booking page error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent error={this.state.error!} retry={() => this.setState({ hasError: false, error: null })} />;
    }
    return this.props.children;
  }
}

const DefaultErrorFallback: React.FC<{error: Error; retry: () => void}> = ({ error, retry }) => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
    <div className="max-w-md mx-auto text-center p-8 bg-white rounded-xl shadow-lg">
      <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h2>
      <p className="text-gray-600 mb-6">We encountered an unexpected error. Please try again.</p>
      <button
        onClick={retry}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Try Again
      </button>
      <details className="mt-4 text-left">
        <summary className="text-sm text-gray-500 cursor-pointer">Technical Details</summary>
        <pre className="text-xs text-gray-400 mt-2 p-2 bg-gray-50 rounded overflow-auto">
          {error.message}
        </pre>
      </details>
    </div>
  </div>
);

// Memoized BookingCard component
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
}>(({
  booking,
  onCancel,
  onDelete,
  onDownload,
  onPayment,
  actionLoading,
  formatTime,
  formatDate,
  getStatusColor,
  getPaymentStatusColor,
  getPaymentMethodIcon
}) => {
  const handleCancel = useCallback(() => {
    onCancel(booking.id, booking.scheduleId, booking.seatNumbers);
  }, [booking.id, booking.scheduleId, booking.seatNumbers, onCancel]);

  const handleDelete = useCallback(() => {
    onDelete(booking.id);
  }, [booking.id, onDelete]);

  const handleDownloadWithQR = useCallback(() => {
    onDownload(booking, true);
  }, [booking, onDownload]);

  const handleDownloadOnly = useCallback(() => {
    onDownload(booking, false);
  }, [booking, onDownload]);

  const handlePayment = useCallback(() => {
    onPayment(booking);
  }, [booking, onPayment]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all duration-300 group">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-lg">{booking.company.name.charAt(0)}</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{booking.company.name}</h3>
              <p className="text-sm text-gray-600">Booking: {booking.bookingReference || booking.id.slice(-8)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(booking.bookingStatus)}`}>
              {booking.bookingStatus.charAt(0).toUpperCase() + booking.bookingStatus.slice(1)}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPaymentStatusColor(booking.paymentStatus)}`}>
              {booking.paymentStatus.charAt(0).toUpperCase() + booking.paymentStatus.slice(1)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6 p-4 bg-gray-50 rounded-xl">
              <div className="text-center">
                <div className="text-xl font-bold text-gray-900">{formatTime(booking.schedule.departureDateTime)}</div>
                <div className="text-sm text-gray-600 flex items-center justify-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {booking.route.origin}
                </div>
                <div className="text-xs text-gray-500 mt-1">{formatDate(booking.schedule.departureDateTime)}</div>
              </div>
              <div className="flex-1 mx-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t-2 border-dashed border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <div className="bg-white px-3 py-1 rounded-full border border-gray-200">
                      <BusIcon className="w-4 h-4 text-gray-500" />
                    </div>
                  </div>
                </div>
                <div className="text-center mt-2">
                  <span className="text-xs text-gray-500">{Math.round(booking.route.duration / 60)}h {booking.route.duration % 60}m</span>
                </div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-gray-900">{formatTime(booking.schedule.arrivalDateTime)}</div>
                <div className="text-sm text-gray-600 flex items-center justify-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {booking.route.destination}
                </div>
                <div className="text-xs text-gray-500 mt-1">{formatDate(booking.schedule.arrivalDateTime)}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <BusIcon className="w-4 h-4 text-gray-400" />
                <span>{booking.bus.busType} • {booking.bus.licensePlate || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" />
                <span>{booking.passengerDetails.length} passenger{booking.passengerDetails.length > 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-2">
                <Armchair className="w-4 h-4 text-gray-400" />
                <span>Seats: {booking.seatNumbers.join(', ')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span>Booked: {formatDate(booking.createdAt)}</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Passengers
            </h4>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {booking.passengerDetails.map((passenger, index) => (
                <div key={index} className="text-sm">
                  <p className="font-medium text-gray-800">{passenger.name}</p>
                  <p className="text-gray-600">Age: {passenger.age} • {passenger.gender} • Seat: {passenger.seatNumber}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col justify-between">
            <div className="mb-4">
              <div className="text-right mb-2">
                <div className="text-2xl font-bold text-gray-900">MWK {booking.totalAmount.toLocaleString()}</div>
                <div className="text-sm text-gray-600">Total Amount</div>
              </div>

              {booking.paymentProvider && (
                <div className="text-right text-xs text-gray-500">
                  via {booking.paymentProvider}
                  {booking.bookingReference && <div>Ref: {booking.bookingReference}</div>}
                </div>
              )}

              {booking.paymentProvider && (
                <div className="text-right text-xs text-gray-500 mt-1 flex items-center gap-2 justify-end">
                  <img src={getPaymentMethodIcon(booking.paymentProvider).logo} alt={`${getPaymentMethodIcon(booking.paymentProvider).label} logo`} className="w-6 h-6" />
                  <span>{getPaymentMethodIcon(booking.paymentProvider).label}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {booking.bookingStatus === 'confirmed' && booking.paymentStatus === 'pending' && (
                <button
                  onClick={handlePayment}
                  disabled={actionLoading === booking.id}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-all transform hover:scale-105 shadow-lg animate-pulse"
                  aria-label={`Pay for booking ${booking.bookingReference || booking.id.slice(-8)}`}
                >
                  {actionLoading === booking.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      <span className="font-medium">Pay Now</span>
                    </>
                  )}
                </button>
              )}

              {booking.bookingStatus === 'confirmed' && booking.paymentStatus === 'paid' && (
                <>
                  <button
                    onClick={handleDownloadWithQR}
                    disabled={actionLoading === `download_${booking.id}`}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200"
                    aria-label={`Download ticket with QR for booking ${booking.bookingReference || booking.id.slice(-8)}`}
                  >
                    {actionLoading === `download_${booking.id}` ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Ticket + QR</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleDownloadOnly}
                    disabled={actionLoading === `download_${booking.id}`}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
                    aria-label={`Download ticket without QR for booking ${booking.bookingReference || booking.id.slice(-8)}`}
                  >
                    <Download className="w-4 h-4" />
                    <span>Ticket Only</span>
                  </button>
                </>
              )}

              {(booking.bookingStatus === 'pending' ||
                (booking.bookingStatus === 'confirmed' && booking.paymentStatus === 'pending')) && (
                <button
                  onClick={handleCancel}
                  disabled={actionLoading === booking.id}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors border border-red-200"
                  aria-label={`Cancel booking ${booking.bookingReference || booking.id.slice(-8)}`}
                >
                  {actionLoading === booking.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      <span>Cancel</span>
                    </>
                  )}
                </button>
              )}

              {booking.bookingStatus === 'confirmed' && booking.paymentStatus === 'paid' && (
                <button
                  onClick={handleCancel}
                  disabled={actionLoading === booking.id}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors border border-amber-200"
                  aria-label={`Request refund for booking ${booking.bookingReference || booking.id.slice(-8)}`}
                >
                  {actionLoading === booking.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4" />
                      <span>Request Refund</span>
                    </>
                  )}
                </button>
              )}

              {booking.bookingStatus === 'cancelled' && (
                <button
                  onClick={handleDelete}
                  disabled={actionLoading === booking.id}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
                  aria-label={`Delete canceled booking ${booking.bookingReference || booking.id.slice(-8)}`}
                >
                  {actionLoading === booking.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {booking.bookingStatus === 'confirmed' && booking.paymentStatus === 'pending' && (
        <div className="bg-gradient-to-r from-emerald-50 to-blue-50 border-t border-emerald-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-800">Booking Approved - Payment Required</p>
              <p className="text-xs text-emerald-700">
                Your booking has been confirmed by the admin. Complete payment to secure your seats.
              </p>
            </div>
            <div className="ml-auto">
              <Shield className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

BookingCard.displayName = 'BookingCard';

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

  const formatTime = useCallback((dateTime: Date | Timestamp | string | any) => {
    let date: Date;
    if (dateTime instanceof Date) date = dateTime;
    else if (dateTime && typeof dateTime === 'object' && 'toDate' in dateTime) date = dateTime.toDate();
    else if (dateTime && typeof dateTime === 'object' && 'seconds' in dateTime) date = new Date(dateTime.seconds * 1000);
    else if (typeof dateTime === 'string') date = new Date(dateTime);
    else return 'Invalid Time';
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }, []);

  const formatDate = useCallback((dateTime: Date | Timestamp | string | any) => {
    let date: Date;
    if (dateTime instanceof Date) date = dateTime;
    else if (dateTime && typeof dateTime === 'object' && 'toDate' in dateTime) date = dateTime.toDate();
    else if (dateTime && typeof dateTime === 'object' && 'seconds' in dateTime) date = new Date(dateTime.seconds * 1000);
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
      case 'mobile_money':
        return { Icon: Smartphone, label: 'Mobile Money', description: 'Airtel Money, TNM Mpamba', logo: '/PayChangu Logo-06.png' };
      case 'card':
      case 'credit_card':
        return { Icon: CreditCard, label: 'Card Payment', description: 'Visa, Mastercard', logo: '/stripe_5968382.png' };
      default:
        return { Icon: CreditCard, label: 'Secure Payment', description: 'Safe & secure', logo: '/images/payment-default.png' };
    }
  }, []);

  function isBookingExpired(booking: BookingWithDetails): boolean {
    const now = new Date();
    const arrivalDate = booking.schedule.arrivalDateTime instanceof Timestamp
      ? booking.schedule.arrivalDateTime.toDate()
      : new Date(booking.schedule.arrivalDateTime);
    const isTripPast = arrivalDate < now;
    const isIncomplete = booking.bookingStatus !== 'completed' && booking.bookingStatus !== 'cancelled' &&
      !(booking.bookingStatus === 'confirmed' && booking.paymentStatus === 'paid');
    return isTripPast && isIncomplete;
  }

  const fetchBookings = useCallback(async (retryCount = 0) => {
    if (!user) return;

    setLoading(true);
    setError('');

    try {
      const bookingsQuery = query(
        collection(db, 'bookings'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        firestoreLimit(50)
      );
      
        const bookingsSnapshot = await getDocs(bookingsQuery);

      const bookingsData = bookingsSnapshot.docs.map((doc) => ({
        id: doc.id,
        bookingReference: doc.data().bookingReference || doc.id,
        ...doc.data(),
        bookingDate: doc.data().bookingDate instanceof Timestamp ? doc.data().bookingDate.toDate() : new Date(doc.data().bookingDate),
        createdAt: doc.data().createdAt instanceof Timestamp ? doc.data().createdAt.toDate() : new Date(doc.data().createdAt),
        updatedAt: doc.data().updatedAt instanceof Timestamp ? doc.data().updatedAt.toDate() : new Date(doc.data().updatedAt),
      })) as unknown as Booking[]; // FIX: Added 'unknown' for safer type conversion

      const bookingsWithDetails: BookingWithDetails[] = [];
      const errors: string[] = [];

      const batchSize = 5;
      for (let i = 0; i < bookingsData.length; i += batchSize) {
        const batch = bookingsData.slice(i, i + batchSize);
        const batchPromises = batch.map(async (booking) => {
          try {
            if (!booking.scheduleId || !booking.companyId) {
              errors.push(`Booking ${booking.id} missing scheduleId or companyId`);
              return null;
            }
            if (!booking.seatNumbers || !booking.passengerDetails) {
              errors.push(`Booking ${booking.id} missing seat or passenger data`);
              return null;
            }

            const [scheduleDoc, companyDoc] = await Promise.all([
              getDoc(doc(db, 'schedules', booking.scheduleId)),
              getDoc(doc(db, 'companies', booking.companyId)),
            ]);

            if (!scheduleDoc.exists() || !companyDoc.exists()) {
              errors.push(`Missing schedule or company for booking ${booking.id}`);
              return null;
            }

            const scheduleData = scheduleDoc.data();
            const companyData = companyDoc.data();

            const schedule = {
              id: scheduleDoc.id,
              ...scheduleData,
              departureDateTime: scheduleData.departureDateTime,
              arrivalDateTime: scheduleData.arrivalDateTime,
            } as Schedule;

            const company = { id: companyDoc.id, ...companyData } as Company;

            if (!schedule.busId || !schedule.routeId) {
              errors.push(`Schedule ${schedule.id} missing busId or routeId`);
              return null;
            }

            const [busDoc, routeDoc] = await Promise.all([
              getDoc(doc(db, 'buses', schedule.busId)),
              getDoc(doc(db, 'routes', schedule.routeId)),
            ]);

            if (!busDoc.exists() || !routeDoc.exists()) {
              errors.push(`Missing bus or route for schedule ${schedule.id}`);
              return null;
            }

            const bus = { id: busDoc.id, ...busDoc.data() } as Bus;
            const route = { id: routeDoc.id, ...routeDoc.data() } as Route;

            return { ...booking, schedule, bus, route, company } as BookingWithDetails;
          } catch (error) {
            errors.push(`Error fetching details for booking ${booking.id}: ${error}`);
            return null;
          }
        });
        const batchResults = await Promise.allSettled(batchPromises);
        batchResults.forEach((result) => {
          if (result.status === 'fulfilled' && result.value) {
            bookingsWithDetails.push(result.value);
          }
        });
      }

      // REMOVED: Automatic deletion
      
      // If you want to inform users about expired bookings, you can do this:
      

      const validBookings = bookingsWithDetails.filter((b) => !isBookingExpired(b));
      setBookings(validBookings);
      applyFilters(validBookings);
      const expiredCount = bookingsWithDetails.length - validBookings.length;
      if (expiredCount > 0) {
        console.log(`${expiredCount} expired bookings hidden from view`);
        // Optionally show a message to the user about expired bookings
      }


      if (bookingsWithDetails.length === 0 && bookingsData.length > 0) {
        setError('Some bookings could not be loaded due to missing data. Please try refreshing or contact support.');
      } else if (errors.length > 0 && errors.length < bookingsData.length) {
        console.warn('Partial fetch errors:', errors);
      } else if (errors.length === bookingsData.length) {
        setError('Failed to load booking details. Please try again or contact support.');
      }
    } catch (error: any) {
      if (retryCount < 2) {
        console.warn(`Retrying fetchBookings (attempt ${retryCount + 1})...`);
        setTimeout(() => fetchBookings(retryCount + 1), 1000 * Math.pow(2, retryCount));
        return;
      }
      setError('Failed to load bookings. Please check your connection and try again.');
      console.error('Fetch bookings error:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const handleCancelBooking = useCallback(async (bookingId: string, scheduleId: string, seatNumbers: string[]) => {
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) {
      setError('Booking not found');
      return;
    }
    if (!booking.seatNumbers?.length || !booking.passengerDetails?.length) {
      setError('Invalid booking data. Cannot cancel - please contact support.');
      return;
    }
    const departureDate = booking.schedule.departureDateTime instanceof Timestamp
      ? booking.schedule.departureDateTime.toDate()
      : new Date(booking.schedule.departureDateTime);
    if (departureDate < new Date()) {
      setError('Cannot cancel a booking for a past departure.');
      return;
    }

    let isCancellationRequest = false;
    if (booking.paymentStatus === 'paid') {
      const confirmCancel = window.confirm('This booking has been paid for. Cancelling may affect your refund eligibility. Continue?');
      if (!confirmCancel) return;
      isCancellationRequest = true;
    }

    setActionLoading(bookingId);
    setError('');

    try {
      const batch = writeBatch(db);

      const bookingUpdates: { [key: string]: any } = {
        updatedAt: serverTimestamp(),
      };

      if (!isCancellationRequest) {
        bookingUpdates.bookingStatus = 'cancelled';
        bookingUpdates.cancellationDate = serverTimestamp();
        bookingUpdates.cancellationReason = 'Customer initiated';
        sendNotification({
        userId: booking.userId,
        ...NotificationTemplates.bookingConfirmed(booking.id, `${booking.route.origin} → ${booking.route.destination}`), // Reuse template with adjusted message
        message: `Your booking ${bookingId.slice(-8)} has been cancelled. Seats released.`,
      });
    } else {
      bookingUpdates.cancellationRequested = true;
      bookingUpdates.cancellationReason = 'Customer requested';
      sendNotification({
        userId: booking.userId,
        type: 'cancellation_requested',
        title: 'Cancellation Requested',
        message: `Your cancellation request for booking ${bookingId.slice(-8)} is under review.`,
        data: { bookingId, url: `/bookings` },
      });
    }

    batch.update(doc(db, 'bookings', bookingId), bookingUpdates);

    if (!isCancellationRequest) {
      batch.update(doc(db, 'schedules', scheduleId), {
        availableSeats: increment(seatNumbers.length),
        bookedSeats: arrayRemove(...seatNumbers),
        updatedAt: serverTimestamp(),
      });
    }

      await batch.commit();
    fetchBookings();
      const successMessage = isCancellationRequest
        ? 'Cancellation requested. An admin will review your request.'
        : 'Booking cancelled successfully. Seats have been released.';
      setSuccess(successMessage);
      setTimeout(() => setSuccess(''), 5000);

      fetchBookings();
    } catch (err: any) {
      console.error('Cancellation error:', err);
      setError(`Failed to cancel booking: ${err.message || 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  }, [bookings, fetchBookings]);

  const handleDeleteBooking = useCallback(async (bookingId: string) => {
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking || booking.bookingStatus !== 'cancelled') {
      setError('Only canceled bookings can be deleted.');
      return;
    }

    const confirmDelete = window.confirm('Are you sure you want to permanently delete this canceled booking?');
    if (!confirmDelete) return;

    setActionLoading(bookingId);
    setError('');

    try {
      await deleteDoc(doc(db, 'bookings', bookingId));

      setSuccess('Booking deleted successfully.');
      setTimeout(() => setSuccess(''), 5000);

      fetchBookings();
    } catch (err: any) {
      console.error('Delete error:', err);
      setError(`Failed to delete booking: ${err.message || 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  }, [bookings, fetchBookings]);

   const applyFilters = useCallback((bookingsToFilter: BookingWithDetails[] = bookings) => {
      let filtered = [...bookingsToFilter];
  
      if (activeFilter !== 'all') {
        switch (activeFilter) {
          case 'confirmed':
            filtered = filtered.filter((b) => b.bookingStatus === 'confirmed' && b.paymentStatus === 'paid');
            break;
          case 'pending':
            filtered = filtered.filter((b) => b.bookingStatus === 'pending' || (b.bookingStatus === 'confirmed' && b.paymentStatus === 'pending'));
            break;
          case 'cancelled':
            filtered = filtered.filter((b) => b.bookingStatus === 'cancelled');
            break;
          case 'upcoming':
            const now = new Date();
            filtered = filtered.filter((b) => {
              // Ensure schedule and departureDateTime exist before accessing
              if (!b.schedule || !b.schedule.departureDateTime) return false;

              const departureDate = b.schedule.departureDateTime instanceof Timestamp
                ? b.schedule.departureDateTime.toDate()
                : new Date(b.schedule.departureDateTime);
              return departureDate > now && b.bookingStatus === 'confirmed' && b.paymentStatus === 'paid';
            });
            break;
        }
      }
  
      if (filters.busType) {
        // FIX: Check if busType is included in the array of filters
        const busTypesToFilter = Array.isArray(filters.busType) ? filters.busType : [filters.busType];
        filtered = filtered.filter((b) => b.bus?.busType && busTypesToFilter.includes(b.bus.busType));
      }
  
      if (filters.priceRange) {
        // Ensure schedule and price exist before accessing
        filtered = filtered.filter(
          (b) => b.schedule?.price !== undefined && 
                 b.schedule.price >= (filters.priceRange?.min || 0) && 
                 b.schedule.price <= (filters.priceRange?.max || Infinity)
        );
      }
  
      if (filters.company) {
        // Ensure company and name exist before accessing
        filtered = filtered.filter((b) => b.company?.name === filters.company);
      }
  
      setFilteredBookings(filtered);
      setCurrentPage(1);
    }, [bookings, activeFilter, filters]);
  
    const bookingStats = useMemo(() => {
      const all = bookings.length;
      const confirmed = bookings.filter((b) => b.bookingStatus === 'confirmed' && b.paymentStatus === 'paid').length;
      const pending = bookings.filter((b) => b.bookingStatus === 'pending' || (b.bookingStatus === 'confirmed' && b.paymentStatus === 'pending')).length;
      const cancelled = bookings.filter((b) => b.bookingStatus === 'cancelled').length;
      const upcoming = bookings.filter((b) => {
        // Ensure schedule and departureDateTime exist before accessing
        if (!b.schedule || !b.schedule.departureDateTime) return false;
        
        const departureDate = b.schedule.departureDateTime instanceof Timestamp
          ? b.schedule.departureDateTime.toDate()
          : new Date(b.schedule.departureDateTime);
        return departureDate > new Date() && b.bookingStatus === 'confirmed' && b.paymentStatus === 'paid';
      }).length;
      return { all, confirmed, pending, cancelled, upcoming };
    }, [bookings]);
  
    const paginatedBookings = useMemo(() => {
      return filteredBookings.slice((currentPage - 1) * bookingsPerPage, currentPage * bookingsPerPage);
    }, [filteredBookings, currentPage, bookingsPerPage]);
  
    const totalPages = useMemo(() => Math.ceil(filteredBookings.length / bookingsPerPage), [filteredBookings.length, bookingsPerPage]);
  
    const handleFilterChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      let newFilters = { ...filters };
  
      if (name === 'priceRangeMin' || name === 'priceRangeMax') {
        newFilters.priceRange = { ...newFilters.priceRange, [name === 'priceRangeMin' ? 'min' : 'max']: value ? Number(value) : undefined };
      } else {
        newFilters[name] = value || undefined;
      }
  
      setFilters(newFilters);
    }, [filters]);
  
    const handleStatusFilter = useCallback((status: string) => {
      setActiveFilter(status);
    }, []);

  const handleDownloadTicket = useCallback(async (booking: BookingWithDetails, includeQR: boolean) => {
    setActionLoading(`download_${booking.id}`);
    try {
      const [{ default: PDF }, { default: QR }] = await Promise.all([import('jspdf'), import('qrcode')]);
      const pdf = new PDF();
      let yPos = 30;
      const lineHeight = 8;

      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Bus Ticket', 20, 20);

      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');

      const addText = (label: string, value: string, x = 20, bold = false) => {
        if (bold) pdf.setFont('helvetica', 'bold');
        pdf.text(`${label}: ${value}`, x, yPos);
        if (bold) pdf.setFont('helvetica', 'normal');
        yPos += lineHeight;
      };

      addText('Booking Reference', booking.bookingReference || booking.id.slice(-8), 20, true);
      addText('Company', booking.company.name);
      addText('Route', `${booking.route.origin} → ${booking.route.destination}`);
      addText('Date', formatDate(booking.schedule.departureDateTime));
      addText('Departure', formatTime(booking.schedule.departureDateTime));
      addText('Arrival', formatTime(booking.schedule.arrivalDateTime));
      addText('Bus', `${booking.bus.busType} (${booking.bus.licensePlate || 'N/A'})`);
      addText('Seats', booking.seatNumbers.join(', '));

      yPos += 5;
      pdf.text('Passengers:', 20, yPos);
      yPos += lineHeight;

      booking.passengerDetails.forEach((p) => {
        pdf.text(`• ${p.name} (Age: ${p.age}, Seat: ${p.seatNumber})`, 25, yPos);
        yPos += lineHeight;
      });

      yPos += 5;
      addText('Total Amount', `MWK ${booking.totalAmount.toLocaleString()}`, 20, true);
      addText('Payment Status', booking.paymentStatus.charAt(0).toUpperCase() + booking.paymentStatus.slice(1));

      if (includeQR && booking.bookingStatus === 'confirmed' && booking.paymentStatus === 'paid') {
        const qrData = JSON.stringify({
          bookingId: booking.id,
          bookingReference: booking.bookingReference,
          seats: booking.seatNumbers,
          passengers: booking.passengerDetails.length,
          amount: booking.totalAmount,
        });

        const qrCode = await QR.toDataURL(qrData, { width: 200 });
        pdf.addImage(qrCode, 'PNG', 140, 30, 50, 50);
        pdf.setFontSize(8);
        pdf.text('Scan for verification', 150, 85);
      }

      pdf.save(`ticket_${booking.bookingReference || booking.id.slice(-8)}.pdf`);
      setSuccess('Ticket downloaded successfully!');
    } catch (error) {
      console.error('PDF generation error:', error);
      setError('Failed to generate ticket PDF. Please try again.');
    } finally {
      setActionLoading(null);
    }
  }, [formatDate, formatTime]);

 const handleConfirmDetails = useCallback((booking: BookingWithDetails) => {
  if (!booking.seatNumbers?.length || !booking.passengerDetails?.length) {
    setError('Invalid booking data. Cannot proceed with payment.');
    return;
  }
  // Use the first passenger's name as the default
  const primaryPassenger = booking.passengerDetails[0];
  setSelectedBooking(booking);
  setUserDetails({
    name: primaryPassenger.name || `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim() || '',
    email: userProfile?.email || '',
    phone: userProfile?.phone || '+265',
  });
  setPaymentMethodModalOpen(true);
}, [userProfile]);

  const handlePaymentMethodSelect = useCallback((method: string) => {
    setSelectedPaymentMethod(method);
    setPaymentMethodModalOpen(false);
    setConfirmModalOpen(true);
  }, []);

  const handleConfirmSubmit = useCallback((e: FormEvent) => {
    e.preventDefault();
    if (!userDetails.name || userDetails.name.trim().length < 2) {
      setError('Please provide a valid full name (at least 2 characters)');
      return;
    }
    if (!userDetails.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userDetails.email)) {
      setError('Please provide a valid email address');
      return;
    }
    if (!userDetails.phone || !/^\+?\d{10,15}$/.test(userDetails.phone.replace(/\s/g, ''))) {
      setError('Please provide a valid phone number (10-15 digits)');
      return;
    }
    setConfirmModalOpen(false);
    setPaymentModalOpen(true);
  }, [userDetails]);

  const generateTxRef = useCallback(() => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `TX${timestamp}${random}`.toUpperCase();
  }, []);

const handlePayment = useCallback(async (e: FormEvent) => {
  e.preventDefault();

  if (!selectedBooking || !selectedPaymentMethod) {
    setError('Please select a booking and payment method');
    return;
  }
  if (!userDetails.name?.trim() || userDetails.name.trim().length < 2) {
    setError('Please provide a valid full name (at least 2 characters)');
    return;
  }
  if (!userDetails.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userDetails.email)) {
    setError('Please provide a valid email address');
    return;
  }
  if (!userDetails.phone || !/^\+?\d{10,15}$/.test(userDetails.phone.replace(/\s/g, ''))) {
    setError('Please provide a valid phone number (10-15 digits)');
    return;
  }

  setActionLoading(selectedBooking.id);
  setError('');

  try {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const idToken = await user.getIdToken();

    const paymentPayload = {
      bookingId: selectedBooking.id,
      paymentProvider: selectedPaymentMethod === 'card' ? 'stripe' : 'paychangu',
      customerDetails: {
        email: userDetails.email.toLowerCase().trim(),
        name: userDetails.name.trim(), // This now reflects the passenger name
        phone: userDetails.phone.trim(),
      },
      metadata: {
        route: `${selectedBooking.route.origin}-${selectedBooking.route.destination}`,
        departure: selectedBooking.schedule.departureDateTime instanceof Timestamp
          ? selectedBooking.schedule.departureDateTime.toDate().toISOString()
          : new Date(selectedBooking.schedule.departureDateTime).toISOString(),
        passengerCount: selectedBooking.passengerDetails.length.toString(),
        seatNumbers: selectedBooking.seatNumbers.join(','),
      },
    };

    const response = await fetch('/api/payments/initiate', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(paymentPayload),
    });

    const result = await response.json();
    sendNotification({
      userId: user.uid,
      type: 'payment_initiated',
      title: 'Payment Initiated',
      message: `Payment process started for booking ${selectedBooking?.id.slice(-8)}. Redirecting to ${selectedPaymentMethod === 'card' ? 'Stripe' : 'PayChangu'}.`,
      data: { bookingId: selectedBooking?.id, url: result.checkoutUrl },
    });

    if (!response.ok) {
      throw new Error(result.error || result.message || 'Failed to create payment session');
    }

    if (result.success && result.checkoutUrl) {
      setPaymentModalOpen(false);
      setConfirmModalOpen(false);
      setSuccess(`Redirecting to ${selectedPaymentMethod === 'card' ? 'Stripe' : 'PayChangu'} payment gateway...`);
      setTimeout(() => { window.location.href = result.checkoutUrl; }, 1500);
    } else {
      throw new Error(result.error || 'Invalid response from server');
    }
  } catch (err: any) {
    console.error('Payment error:', err);
    setError(`Payment failed: ${err.message}`);
  } finally {
    setActionLoading(null);
  }
}, [selectedBooking, selectedPaymentMethod, userDetails]);

  const verifyPaymentStatus = useCallback(async (provider: string, identifier: string) => {
    if (!provider || !identifier) {
      setError('Missing payment verification parameters');
      return;
    }

    setActionLoading(`verify_${identifier}`);

    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const idToken = await user.getIdToken();
      
      const params = new URLSearchParams({ provider });
      if (provider === 'stripe') params.append('session_id', identifier);
      else if (provider === 'paychangu') params.append('tx_ref', identifier);

      const response = await fetch(`/api/payments/verify?${params.toString()}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${idToken}`, 'Accept': 'application/json' },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Verification failed');
      }

      if (result.success && result.status === 'paid') {
        setSuccess('Payment verified and confirmed successfully!');
        fetchBookings(); // Auto-reload after successful payment
      } else if (result.success === false) {
        if (result.status === 'failed') setError(`Payment failed: ${result.message || 'Unknown error'}`);
        else setError(`Payment status: ${result.status}. ${result.message || ''}`);
      } else {
        setError('Payment verification returned unclear status. Please contact support.');
      }
    } catch (error: any) {
      console.error('Payment verification error:', error);
      setError(`Failed to verify payment: ${error.message || 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  }, [fetchBookings]);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    const urlParams = searchParams;
    const paymentVerify = urlParams.get('payment_verify');
    const provider = urlParams.get('provider');
    const success = urlParams.get('success');
    const cancelled = urlParams.get('cancelled');
    const sessionId = urlParams.get('session_id');
    const txRef = urlParams.get('tx_ref');

    if (success === 'true' && !paymentVerify) {
      setSuccess('Action completed successfully!');
      setTimeout(() => setSuccess(''), 5000);
      fetchBookings(); // Auto-reload on general success
    }

    if (cancelled === 'true') {
      setError('Payment was cancelled. You can try again anytime.');
      setTimeout(() => setError(''), 5000);
    }

    if (paymentVerify === 'true' && provider) {
      if (provider === 'stripe' && sessionId) verifyPaymentStatus('stripe', sessionId);
      else if (provider === 'paychangu' && txRef) verifyPaymentStatus('paychangu', txRef);
      else setError('Invalid payment verification parameters');

      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('payment_verify');
      cleanUrl.searchParams.delete('provider');
      cleanUrl.searchParams.delete('session_id');
      cleanUrl.searchParams.delete('tx_ref');
      cleanUrl.searchParams.delete('cancelled');
      cleanUrl.searchParams.delete('success');
      window.history.replaceState({}, '', cleanUrl.toString());
    }

    fetchBookings();

    return () => cleanupFunctions.forEach((cleanup) => cleanup());
  }, [user, router, searchParams, verifyPaymentStatus, fetchBookings, cleanupFunctions]);

   useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'bookings'), where('userId', '==', user.uid), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Populate initial map on first snapshot without notifying
      if (initialSnapshotRef.current) {
        snapshot.docs.forEach((d) => {
          const data = d.data() || {};
         statusesMapRef.current.set(d.id, {
            bookingStatus: data.bookingStatus || '',
            paymentStatus: data.paymentStatus || '',
          });
        });
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

        // Booking status changed (e.g., processed by admin -> confirmed/cancelled)
        if (prev.bookingStatus !== newBookingStatus) {
          const ref = newData.bookingReference || id.slice(-8);
          const byCompany = (newData.company && newData.company.name) || newData.companyName || 'the company';
          const message =
            newBookingStatus === 'confirmed'
              ? `Your booking ${ref} has been approved by ${byCompany}.`
              : `Your booking ${ref} status changed to "${newBookingStatus}".`;

          setNotifications((prev) => [message, ...prev]);
         setSuccess(message);
          setTimeout(() => setSuccess(''), 6000);
        }
        // Payment status changed (e.g., admin marked as paid/refund processed)
        if (prev.paymentStatus !== newPaymentStatus) {
          const ref = newData.bookingReference || id.slice(-8);
          const pmessage =
            newPaymentStatus === 'paid'
              ? `Payment received for booking ${ref}. Thank you!`
              : `Payment status for booking ${ref} updated to "${newPaymentStatus}".`;

          setNotifications((prev) => [pmessage, ...prev]);
          setSuccess(pmessage);
          setTimeout(() => setSuccess(''), 6000);
        }

        // update map
        statusesMapRef.current.set(id, { bookingStatus: newBookingStatus, paymentStatus: newPaymentStatus });
      });
    }, (err) => {
      console.error('Realtime bookings listener error:', err);
    });

    cleanupFunctions.add(unsubscribe);
    return () => {
      unsubscribe();
      cleanupFunctions.delete(unsubscribe);
    };
  }, [user, cleanupFunctions]);

  useEffect(() => {
    applyFilters();
  }, [activeFilter, filters, applyFilters]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-6">
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="bg-gray-100 rounded-xl p-4">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            </div>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm p-6">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  <div className="lg:col-span-2 space-y-4">
                    <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-full"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-8 bg-gray-200 rounded w-full"></div>
                    <div className="h-8 bg-gray-200 rounded w-full"></div>
                  </div>
                </div>
              </div>
            ))}
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
                <div
                  key={index}
                  className="bg-emerald-500 text-white p-4 rounded-lg shadow-lg max-w-sm flex items-start gap-3 animate-in slide-in-from-right duration-300"
                >
                  <Bell className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Booking Approved!</p>
                    <p className="text-xs opacity-90 mt-1">{notification}</p>
                  </div>
                  <button
                    onClick={() => setNotifications((prev) => prev.filter((_, i) => i !== index))}
                    className="ml-auto text-white/80 hover:text-white"
                    aria-label="Close notification"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {success && <div className="mb-6"><AlertMessage type="success" message={success} onClose={() => setSuccess('')} /></div>}
          {error && <div className="mb-6"><AlertMessage type="error" message={error} onClose={() => setError('')} /></div>}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">My Bookings</h1>
                <p className="text-gray-600">Manage and track your bus ticket bookings</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => fetchBookings()}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                  aria-label="Refresh bookings"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <button
                  onClick={() => router.push('/search')}
                  className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:scale-105 shadow-lg"
                  aria-label="Book new ticket"
                >
                  <Search className="w-4 h-4" />
                  Book New Ticket
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
              {[
                { label: 'All Bookings', value: bookingStats.all, key: 'all', icon: BusIcon, color: 'bg-gray-50 text-gray-700' },
                { label: 'Confirmed', value: bookingStats.confirmed, key: 'confirmed', icon: CheckCircle, color: 'bg-emerald-50 text-emerald-700' },
                { label: 'Pending', value: bookingStats.pending, key: 'pending', icon: Clock, color: 'bg-amber-50 text-amber-700' },
                { label: 'Cancelled', value: bookingStats.cancelled, key: 'cancelled', icon: XCircle, color: 'bg-red-50 text-red-700' },
                { label: 'Upcoming', value: bookingStats.upcoming, key: 'upcoming', icon: Calendar, color: 'bg-blue-50 text-blue-700' },
              ].map(({ label, value, key, icon: Icon, color }) => (
                <button
                  key={key}
                  onClick={() => handleStatusFilter(key)}
                  className={`p-4 rounded-xl transition-all transform hover:scale-105 border-2 ${
                    activeFilter === key ? 'border-blue-200 bg-blue-50 shadow-md' : 'border-transparent bg-white hover:border-gray-200 shadow-sm'
                  }`}
                  aria-label={`Filter by ${label}`}
                >
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Icon className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">{value}</p>
                    <p className="text-sm text-gray-600 mt-1">{label}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                aria-label={showFilters ? 'Hide filters' : 'Show filters'}
              >
                <Filter className="w-4 h-4" />
                {showFilters ? 'Hide Filters' : 'Show Filters'}
              </button>
              <p className="text-sm text-gray-600">Showing {filteredBookings.length} of {bookings.length} bookings</p>
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bus Type</label>
                  <select
                    name="busType"
                    value={filters.busType || ''}
                    onChange={handleFilterChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    aria-label="Select bus type"
                  >
                    <option value="">All Types</option>
                    <option value="AC">AC</option>
                    <option value="Non-AC">Non-AC</option>
                    <option value="Sleeper">Sleeper</option>
                    <option value="Semi-Sleeper">Semi-Sleeper</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
                  <select
                    name="company"
                    value={filters.company || ''}
                    onChange={handleFilterChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    aria-label="Select company"
                  >
                    <option value="">All Companies</option>
                    {[...new Set(bookings.map((b) => b.company.name))].map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Price Range</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      name="priceRangeMin"
                      placeholder="Min"
                      value={filters.priceRange?.min || ''}
                      onChange={handleFilterChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      aria-label="Minimum price"
                    />
                    <input
                      type="number"
                      name="priceRangeMax"
                      placeholder="Max"
                      value={filters.priceRange?.max || ''}
                      onChange={handleFilterChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      aria-label="Maximum price"
                    />
                  </div>
                </div>
                <div className="md:col-span-3">
                  <button
                    onClick={() => { setFilters({}); setActiveFilter('all'); }}
                    className="w-full md:w-auto px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                    aria-label="Clear all filters"
                  >
                    <XCircle className="w-4 h-4" />
                    Clear Filters
                  </button>
                </div>
              </div>
            )}
          </div>

          {filteredBookings.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
              <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                {activeFilter === 'all' ? <BusIcon className="w-10 h-10 text-gray-400" /> : activeFilter === 'confirmed' ? <CheckCircle className="w-10 h-10 text-gray-400" /> : activeFilter === 'pending' ? <Clock className="w-10 h-10 text-gray-400" /> : activeFilter === 'cancelled' ? <XCircle className="w-10 h-10 text-gray-400" /> : <Calendar className="w-10 h-10 text-gray-400" />}
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No {activeFilter === 'all' ? '' : activeFilter} bookings found</h3>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">{activeFilter === 'all' ? 'You haven\'t made any bus bookings yet. Start planning your journey!' : `You don't have any ${activeFilter} bookings at the moment.`}</p>
              <button
                onClick={() => router.push('/search')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:scale-105 shadow-lg"
                aria-label="Search for buses"
              >
                <Search className="w-5 h-5" />
                Search for Buses
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {paginatedBookings.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  onCancel={handleCancelBooking}
                  onDelete={handleDeleteBooking}
                  onDownload={handleDownloadTicket}
                  onPayment={handleConfirmDetails}
                  actionLoading={actionLoading}
                  formatTime={formatTime}
                  formatDate={formatDate}
                  getStatusColor={getStatusColor}
                  getPaymentStatusColor={getPaymentStatusColor}
                  getPaymentMethodIcon={getPaymentMethodIcon}
                />
              ))}
              {filteredBookings.length > bookingsPerPage && (
                <div className="flex items-center justify-between mt-6">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors"
                    aria-label="Previous page"
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Page {currentPage} of {totalPages}</span>
                    <span className="text-xs text-gray-500">({filteredBookings.length} total)</span>
                  </div>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors"
                    aria-label="Next page"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}

          <Modal isOpen={paymentMethodModalOpen} onClose={() => setPaymentMethodModalOpen(false)} title="Choose Payment Method">
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-600" />
                  Secure Payment Options
                </h3>
                {selectedBooking && (
                  <div className="space-y-1 text-sm text-blue-700">
                    <p><strong>Route:</strong> {selectedBooking.route.origin} → {selectedBooking.route.destination}</p>
                    <p><strong>Amount:</strong> MWK {selectedBooking.totalAmount.toLocaleString()}</p>
                    <p><strong>Passengers:</strong> {selectedBooking.passengerDetails.length}</p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <button
                  onClick={() => handlePaymentMethodSelect('mobile_money')}
                  disabled={actionLoading === selectedBooking?.id}
                  className="w-full flex items-center justify-between p-4 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-all border-2 border-emerald-200 group hover:shadow-md transform hover:-translate-y-0.5 disabled:opacity-50"
                  aria-label="Select Mobile Money payment"
                >
                  <div className="flex items-center gap-3">
                    <img src="/images/mobile-money.png" alt="Mobile Money logo" className="w-8 h-8" />
                    <div>
                      <p className="font-medium">Mobile Money</p>
                      <p className="text-xs text-emerald-600">Airtel Money, TNM Mpamba</p>
                    </div>
                  </div>
                  {actionLoading === selectedBooking?.id ? (
                    <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                  ) : (
                    <ArrowRight className="w-5 h-5 text-emerald-600 group-hover:text-emerald-800" />
                  )}
                </button>

                <button
                  onClick={() => handlePaymentMethodSelect('card')}
                  disabled={actionLoading === selectedBooking?.id}
                  className="w-full flex items-center justify-between p-4 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-all border-2 border-blue-200 group hover:shadow-md transform hover:-translate-y-0.5 disabled:opacity-50"
                  aria-label="Select Card payment"
                >
                  <div className="flex items-center gap-3">
                    <img src="/images/credit-card.png" alt="Card logo" className="w-8 h-8" />
                    <div>
                      <p className="font-medium">Card Payment</p>
                      <p className="text-xs text-blue-600">Visa, Mastercard</p>
                    </div>
                  </div>
                  {actionLoading === selectedBooking?.id ? (
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  ) : (
                    <ArrowRight className="w-5 h-5 text-blue-600 group-hover:text-blue-800" />
                  )}
                </button>
              </div>
            </div>
          </Modal>
    <Modal isOpen={confirmModalOpen} onClose={() => setConfirmModalOpen(false)} title="Confirm Payment Details">
      <form onSubmit={handleConfirmSubmit} className="space-y-6">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            Booking Summary
          </h3>
          {selectedBooking && (
            <div className="space-y-1 text-sm text-blue-700">
              <p><strong>Route:</strong> {selectedBooking.route.origin} → {selectedBooking.route.destination}</p>
              <p><strong>Departure:</strong> {formatDate(selectedBooking.schedule.departureDateTime)} {formatTime(selectedBooking.schedule.departureDateTime)}</p>
              <p><strong>Amount:</strong> MWK {selectedBooking.totalAmount.toLocaleString()}</p>
              <p><strong>Payment Method:</strong> {getPaymentMethodIcon(selectedPaymentMethod || '').label}</p>
              <p><strong>Name:</strong> {userDetails.name} {/* This now shows passenger name */}</p>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
          <input
            type="text"
            value={userDetails.name}
            onChange={(e) => setUserDetails({ ...userDetails, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter your full name"
            required
            aria-label="Full name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={userDetails.email}
            onChange={(e) => setUserDetails({ ...userDetails, email: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter your email"
            required
            aria-label="Email"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
          <input
            type="tel"
            value={userDetails.phone}
            onChange={(e) => setUserDetails({ ...userDetails, phone: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="+265123456789"
            required
            aria-label="Phone number"
          />
        </div>

        <button
          type="submit"
          disabled={actionLoading === selectedBooking?.id}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-all transform hover:scale-105 shadow-lg disabled:opacity-50"
          aria-label="Confirm payment details"
        >
          {actionLoading === selectedBooking?.id ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Zap className="w-4 h-4" />
              <span className="font-medium">Confirm & Pay</span>
            </>
          )}
        </button>
      </form>
    </Modal>

    <Modal isOpen={paymentModalOpen} onClose={() => setPaymentModalOpen(false)} title="Complete Your Payment">
      <form onSubmit={handlePayment} className="space-y-6">
        <div className="bg-gradient-to-r from-emerald-50 to-blue-50 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-600" />
            Payment Details
          </h3>
          {selectedBooking && (
            <div className="space-y-1 text-sm text-emerald-700">
              <p><strong>Route:</strong> {selectedBooking.route.origin} → {selectedBooking.route.destination}</p>
              <p><strong>Departure:</strong> {formatDate(selectedBooking.schedule.departureDateTime)} {formatTime(selectedBooking.schedule.departureDateTime)}</p>
              <p><strong>Amount:</strong> MWK {selectedBooking.totalAmount.toLocaleString()}</p>
              <p><strong>Method:</strong> {getPaymentMethodIcon(selectedPaymentMethod || '').label}</p>
              <p><strong>Name:</strong> {userDetails.name} {/* Updated to passenger name */}</p>
              <p><strong>Email:</strong> {userDetails.email}</p>
              <p><strong>Phone:</strong> {userDetails.phone}</p>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={actionLoading === selectedBooking?.id}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-all transform hover:scale-105 shadow-lg disabled:opacity-50"
          aria-label="Proceed to payment"
        >
          {actionLoading === selectedBooking?.id ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Zap className="w-4 h-4" />
              <span className="font-medium">Proceed to Pay</span>
            </>
          )}
        </button>
        </form>
    </Modal>
    </div>
    </div>
    </ErrorBoundary>
  );
};

export default BookingsPage;