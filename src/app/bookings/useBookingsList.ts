import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sendNotification, useNotifications } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAppToast } from '@/contexts/ToastContext';
import { Booking, Schedule, Bus, Route, Company, UserProfile } from '@/types';

// PaymentProvider type
export type PaymentProvider = 'flutterwave' | 'paychangu' | 'cash' | 'local_bank';

// BookingWithDetails mirrors the shape used by the UI layer
export interface BookingWithDetails extends Booking {
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

export interface SearchFilters {
  busType?: string | string[];
  priceRange?: { min?: number; max?: number };
  company?: string;
  [key: string]: unknown;
}

export function resolveStopName(
  stopId: string | undefined,
  savedName: string | undefined,
  route: Route,
  fallback: string,
): string {
  if (savedName) return savedName;
  if (stopId === '__origin__') return route.origin || fallback;
  if (stopId === '__destination__') return route.destination || fallback;
  if (stopId && route.stops) {
    const f = route.stops.find((s) => s.id === stopId);
    if (f) return f.name;
  }
  return fallback;
}

export const useBookingsList = () => {
  const { user, userProfile } = useAuth();
  const toast = useAppToast();
  const { notifications: ctxNotifications } = useNotifications();

  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<BookingWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [activeFilter, setActiveFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [toastNotifications, setToastNotifications] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const bookingsPerPage = 5;

  const [methodModalOpen, setMethodModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingWithDetails | null>(null);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedSubId, setSelectedSubId] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');
  const [userDetails, setUserDetails] = useState({ name: '', email: '', phone: '+265' });

  const cleanupFunctions = useRef<Set<() => void>>(new Set());
  const lastNotificationIdsRef = useRef<Set<string>>(new Set());

  // Formatters
  const formatTime = useCallback((dateTime: unknown): string => {
    let d: Date;
    if (dateTime instanceof Date) d = dateTime;
    else if (typeof dateTime === 'string') d = new Date(dateTime);
    else if ((dateTime as any)?.seconds) d = new Date((dateTime as any).seconds * 1000);
    else return 'N/A';
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }, []);

  const formatDate = useCallback((dateTime: unknown): string => {
    let d: Date;
    if (dateTime instanceof Date) d = dateTime;
    else if (typeof dateTime === 'string') d = new Date(dateTime);
    else if ((dateTime as any)?.seconds) d = new Date((dateTime as any).seconds * 1000);
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
    const arr = b.schedule?.arrivalDateTime instanceof Date
      ? b.schedule.arrivalDateTime
      : new Date(b.schedule?.arrivalDateTime as unknown as string);
    return arr < new Date()
      && b.bookingStatus !== 'completed'
      && b.bookingStatus !== 'cancelled'
      && !(b.bookingStatus === 'confirmed' && b.paymentStatus === 'paid')
      && !((b as any).paymentMethod === 'cash_on_boarding' && b.bookingStatus === 'confirmed');
  }, []);

  const applyFiltersLogic = useCallback((src: BookingWithDetails[], af: string, cf: SearchFilters) => {
    let f = [...src];
    const now = new Date();
    if (af === 'confirmed') f = f.filter((b) => b.bookingStatus === 'confirmed' && (b.paymentStatus === 'paid' || (b as any).paymentMethod === 'cash_on_boarding'));
    else if (af === 'pending') f = f.filter((b) => b.bookingStatus === 'pending' || (b.bookingStatus === 'confirmed' && b.paymentStatus === 'pending' && (b as any).paymentMethod !== 'cash_on_boarding'));
    else if (af === 'cancelled') f = f.filter((b) => b.bookingStatus === 'cancelled');
    else if (af === 'upcoming') f = f.filter((b) => {
      const d = b.schedule?.departureDateTime instanceof Date ? b.schedule.departureDateTime : new Date(b.schedule?.departureDateTime as unknown as string);
      return d > now && b.bookingStatus === 'confirmed' && (b.paymentStatus === 'paid' || (b as any).paymentMethod === 'cash_on_boarding');
    });
    if (cf.busType) { const t = Array.isArray(cf.busType) ? cf.busType : [cf.busType]; f = f.filter((b) => b.bus?.busType && t.includes(b.bus.busType)); }
    if (cf.priceRange) { f = f.filter((b) => b.schedule?.price !== undefined && b.schedule.price >= ((cf.priceRange as any)?.min ?? 0) && b.schedule.price <= ((cf.priceRange as any)?.max ?? Infinity)); }
    if (cf.company) f = f.filter((b) => b.company?.name === cf.company);
    setFilteredBookings(f);
    setCurrentPage(1);
  }, []);

  // Fetch bookings from API
  const fetchBookings = useCallback(async () => {
    if (!user?.id) return;
    if (bookings.length === 0) setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/bookings?page=1&limit=100');
      let json: any = null;
      try { json = await response.json(); } catch (e) {
        // ignore JSON parse errors
      }
      if (!response.ok) {
        console.error('fetch /api/bookings failed', response.status, json);
        throw new Error(json?.error || json?.message || `HTTP ${response.status}`);
      }
      const { data: apiBookings } = json || {};

      const details: BookingWithDetails[] = apiBookings.map((b: any) => ({
        id: b.id,
        bookingReference: b.bookingReference,
        userId: b.userId,
        scheduleId: b.scheduleId,
        companyId: b.schedule?.company?.id || b.companyId,
        numberOfSeats: Array.isArray(b.passengerDetails) ? b.passengerDetails.length : 0,
        totalAmount: b.totalAmount,
        bookingStatus: b.bookingStatus,
        paymentStatus: b.paymentStatus,
        createdAt: new Date(b.createdAt),
        updatedAt: new Date(b.updatedAt),
        seatNumbers: b.seatNumbers || [],
        passengerDetails: b.passengerDetails || [],
        originStopId: b.originStopId,
        destinationStopId: b.destinationStopId,
        originStopName: b.originStopName,
        destinationStopName: b.destinationStopName,
        schedule: {
          id: b.scheduleId,
          departureDateTime: new Date(b.schedule?.departureDateTime),
          arrivalDateTime: new Date(b.schedule?.arrivalDateTime),
          price: b.totalAmount && Array.isArray(b.passengerDetails) && b.passengerDetails.length > 0 ? Math.floor(b.totalAmount / b.passengerDetails.length) : 0,
          availableSeats: b.schedule?.availableSeats || 0,
          date: b.schedule?.departureDateTime,
        } as any,
        route: {
          id: b.schedule?.route?.id || '',
          origin: b.schedule?.route?.origin || 'Unknown',
          destination: b.schedule?.route?.destination || 'Unknown',
          distance: b.schedule?.route?.distance || 0,
          stops: b.schedule?.route?.stops || [],
        } as any,
        bus: {
          id: b.schedule?.bus?.id || '',
          busNumber: b.schedule?.bus?.licensePlate || 'N/A',
          busType: b.schedule?.bus?.busType || 'N/A',
          licensePlate: b.schedule?.bus?.licensePlate || 'N/A',
        } as any,
        company: {
          id: b.schedule?.company?.id || '',
          name: b.schedule?.company?.name || 'Unknown',
        } as any,
      }));

      const valid = details.filter((b) => !isBookingExpired(b));
      setBookings(valid);
      setActiveFilter((current) => { applyFiltersLogic(valid, current, {}); return current; });
    } catch (err: unknown) {
      console.error('fetchBookings error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg ? `Failed to load bookings: ${msg}` : 'Failed to load bookings. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  }, [user?.id, isBookingExpired, applyFiltersLogic, bookings.length]);

  const handleCancelBooking = useCallback(async (bookingId: string, scheduleId: string, seatNumbers: string[]) => {
    const b = bookings.find((x) => x.id === bookingId);
    if (!b) { setError('Booking not found'); return; }
    const dep = b.schedule.departureDateTime instanceof Date
      ? b.schedule.departureDateTime
      : new Date(b.schedule?.departureDateTime as unknown as string);
    if (dep < new Date()) { setError('Cannot cancel a past departure.'); return; }
    const isPaid = b.paymentStatus === 'paid';
    if (isPaid && !window.confirm('This booking has been paid for. Cancelling may affect your refund eligibility. Continue?')) return;
    setActionLoading(bookingId);
    setError('');
    try {
      const response = await fetch(`/api/bookings/${bookingId}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (!response.ok) throw new Error('Failed to cancel booking');

      const notificationMessage = isPaid
        ? `Cancellation for booking ${bookingId.slice(-8)} is under review.`
        : `Your booking ${bookingId.slice(-8)} (${b.route.origin} → ${b.route.destination}) has been cancelled.`;

      sendNotification({
        userId: b.userId,
        type: isPaid ? 'cancellation_requested' : 'cancellation',
        title: isPaid ? 'Cancellation Requested' : 'Booking Cancelled',
        message: notificationMessage,
        data: { bookingId, url: '/bookings' },
      });

      setSuccess(isPaid ? 'Cancellation requested. An admin will review.' : 'Booking cancelled successfully.');
      toast.success(
        isPaid ? 'Cancellation Requested' : 'Booking Cancelled',
        isPaid ? 'An admin will review your cancellation request.' : `Booking ${bookingId.slice(-8)} has been cancelled.`
      );
      setTimeout(() => setSuccess(''), 5000);
      fetchBookings();
    } catch (err: unknown) {
      setError(`Failed to cancel: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setActionLoading(null);
    }
  }, [bookings, fetchBookings, toast]);

  const handleDeleteBooking = useCallback(async (bookingId: string) => {
    const b = bookings.find((x) => x.id === bookingId);
    if (!b || b.bookingStatus !== 'cancelled') { setError('Only cancelled bookings can be deleted.'); return; }
    if (!window.confirm('Permanently delete this cancelled booking?')) return;
    setActionLoading(bookingId);
    try {
      const response = await fetch(`/api/bookings/${bookingId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete booking');
      setSuccess('Booking deleted.');
      toast.info('Booking Removed', 'The cancelled booking has been deleted.');
      setTimeout(() => setSuccess(''), 5000);
      fetchBookings();
    }
    catch (err: unknown) { setError(`Failed to delete: ${err instanceof Error ? err.message : String(err)}`); }
    finally { setActionLoading(null); }
  }, [bookings, fetchBookings, toast]);

  const handleDownloadTicket = useCallback(async (booking: BookingWithDetails, includeQR: boolean) => {
    setActionLoading(`download_${booking.id}`);
    try {
      const [{ default: PDF }, { default: QR }] = await Promise.all([import('jspdf'), import('qrcode')]);
      const pdf = new PDF(); let y = 30; const lh = 8;
      const boarding = resolveStopName(booking.originStopId, booking.originStopName, booking.route, booking.route.origin);
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
      toast.success('Ticket Downloaded', 'Your bus ticket has been saved as a PDF.');
    } catch { setError('Failed to generate PDF.'); }
    finally { setActionLoading(null); }
  }, [formatDate, formatTime, toast]);

  const handleProcessPayment = useCallback((booking: BookingWithDetails) => {
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

  const handleConfirmAndPay = useCallback(async (e: any, extra?: { transactionId?: string }) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (!selectedBooking || !selectedProvider) { setError('Missing booking or payment method'); return; }
    const isCash = selectedProvider === 'cash';
    if (!isCash) {
      if (userDetails.name.trim().length < 2) { setError('Please provide a valid full name'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userDetails.email)) { setError('Please provide a valid email'); return; }
      if (!/^\+?\d{10,15}$/.test(userDetails.phone.replace(/\s/g, ''))) { setError('Please provide a valid phone number'); return; }
    }
    setActionLoading(selectedBooking.id); setError('');
    try {
      if (isCash) {
        const response = await fetch(`/api/bookings/${selectedBooking.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentMethod: 'cash_on_boarding', paymentStatus: 'pending', paymentProvider: 'cash' }),
        });
        if (!response.ok) throw new Error('Failed to confirm cash booking');
        await sendNotification({ userId: user!.id, type: 'booking', title: 'Booking Reserved (Cash)', message: `Your booking for ${selectedBooking.route.origin} → ${selectedBooking.route.destination} is reserved. Please pay MWK ${selectedBooking.totalAmount.toLocaleString()} when you board.`, actionUrl: '/bookings', priority: 'high' });
        setConfirmModalOpen(false); setSuccess('Booking confirmed — please pay the conductor when you board.');
        toast.success('Booking Reserved', `Have MWK ${selectedBooking.totalAmount.toLocaleString()} ready when you board.`);
        setTimeout(() => setSuccess(''), 6000); fetchBookings(); return;
      }

      const apiRoute = selectedProvider === 'paychangu' ? '/api/payments/paychangu/charge' : '/api/payments/flutterwave/charge';
      const res = await fetch(apiRoute, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: selectedBooking.id, paymentProvider: selectedProvider, customerDetails: { email: userDetails.email.toLowerCase().trim(), name: userDetails.name.trim(), phone: userDetails.phone.trim() }, metadata: { route: `${selectedBooking.route.origin}-${selectedBooking.route.destination}`, departure: selectedBooking.schedule.departureDateTime instanceof Date ? selectedBooking.schedule.departureDateTime.toISOString() : new Date(selectedBooking.schedule.departureDateTime as unknown as string).toISOString(), passengerCount: String(selectedBooking.passengerDetails.length), seatNumbers: selectedBooking.seatNumbers.join(','), subMethod: selectedSubId } }),
      });
      const result = await res.json(); if (!res.ok) throw new Error(result.error || result.message || 'Payment session failed');
      if (result.success && result.checkoutUrl) {
        setConfirmModalOpen(false); const providerName = selectedProvider === 'paychangu' ? 'PayChangu' : 'Flutterwave';
        setSuccess(`Redirecting to ${providerName}…`); toast.loading('Redirecting', `Taking you to ${providerName} for secure payment…`);
        setTimeout(() => { window.location.href = result.checkoutUrl; }, 1200);
      } else throw new Error(result.error || 'Invalid server response');
    } catch (err: unknown) { setError(`Payment failed: ${err instanceof Error ? err.message : String(err)}`); }
    finally { setActionLoading(null); }
  }, [selectedBooking, selectedProvider, selectedSubId, userDetails, user, fetchBookings, toast]);

  const verifyPaymentStatus = useCallback(async (provider: string, txRef: string, transactionId?: string) => {
    setActionLoading(`verify_${txRef}`);
    try {
      let res: Response;
      if (provider === 'paychangu') {
        const params = new URLSearchParams({ provider, tx_ref: txRef });
        res = await fetch(`/api/payments/paychangu/verify?${params}`);
      } else if (provider === 'flutterwave') {
        const params = new URLSearchParams({ tx_ref: txRef });
        if (transactionId) params.append('transaction_id', transactionId);
        res = await fetch(`/api/payments/flutterwave/verify?${params}`);
      } else { setError('Unknown payment provider'); return; }

      const result = await res.json(); if (!res.ok) throw new Error(result.error || 'Verification failed');
      if (result.success && result.status === 'paid') {
        setSuccess('Payment verified! Your booking is confirmed.');
        await sendNotification({ userId: user!.id, type: 'payment', title: 'Payment Confirmed! ✅', message: `We've successfully verified your payment for the booking to ${txRef.slice(-8)}. Happy traveling!`, actionUrl: '/bookings', priority: 'high' });
        fetchBookings();
      } else { setError(`Payment status: ${result.status || 'unknown'}. Please contact support if you were charged.`); }
    } catch (err: unknown) { setError(`Verification failed: ${err instanceof Error ? err.message : String(err)}`); }
    finally { setActionLoading(null); }
  }, [fetchBookings, user]);

  useEffect(() => {
    if (!ctxNotifications) return;
    const newNotifications = ctxNotifications.filter((n) => !lastNotificationIdsRef.current.has(n.id));
    lastNotificationIdsRef.current = new Set(ctxNotifications.map((n) => n.id));
    if (newNotifications.length === 0) return;
    const relevantTypes = new Set([ 'booking', 'payment', 'trip_update', 'cancellation', 'cancellation_requested' ]);
    const relevant = newNotifications.some((n) => relevantTypes.has(n.type as string));
    if (relevant) fetchBookings();
  }, [ctxNotifications, fetchBookings]);

  const bookingStats = useMemo(() => {
    const now = new Date();
    return {
      all: bookings.length,
      confirmed: bookings.filter((b) => b.bookingStatus === 'confirmed' && (b.paymentStatus === 'paid' || (b as any).paymentMethod === 'cash_on_boarding')).length,
      pending: bookings.filter((b) => b.bookingStatus === 'pending' || (b.bookingStatus === 'confirmed' && b.paymentStatus === 'pending' && (b as any).paymentMethod !== 'cash_on_boarding')).length,
      cancelled: bookings.filter((b) => b.bookingStatus === 'cancelled').length,
      upcoming: bookings.filter((b) => {
        const d = b.schedule?.departureDateTime instanceof Date ? b.schedule.departureDateTime : new Date(b.schedule?.departureDateTime as unknown as string);
        return d > now && b.bookingStatus === 'confirmed' && (b.paymentStatus === 'paid' || (b as any).paymentMethod === 'cash_on_boarding');
      }).length,
    };
  }, [bookings]);

  const paginatedBookings = useMemo(() => filteredBookings.slice((currentPage - 1) * bookingsPerPage, currentPage * bookingsPerPage), [filteredBookings, currentPage]);
  const totalPages = useMemo(() => Math.ceil(filteredBookings.length / bookingsPerPage), [filteredBookings.length]);

  const handleFilterChange = useCallback((e: any) => {
    const { name, value } = e.target;
    setFilters((prev) => {
      const next = { ...prev } as any;
      if (name === 'priceRangeMin' || name === 'priceRangeMax') next.priceRange = { ...(next.priceRange as object), [name === 'priceRangeMin' ? 'min' : 'max']: value ? Number(value) : undefined };
      else next[name] = value || undefined;
      return next;
    });
  }, []);

  const handleStatusFilter = useCallback((s: string) => { setActiveFilter(s); applyFiltersLogic(bookings, s, filters); }, [bookings, filters, applyFiltersLogic]);

  // Expose everything the UI needs
  return {
    bookings,
    filteredBookings,
    paginatedBookings,
    bookingStats,
    loading,
    actionLoading,
    error,
    success,
    filters,
    activeFilter,
    showFilters,
    toastNotifications,
    currentPage,
    totalPages,
    bookingsPerPage,
    methodModalOpen,
    confirmModalOpen,
    selectedBooking,
    selectedProvider,
    selectedSubId,
    selectedLabel,
    userDetails,
    formatTime,
    formatDate,
    getStatusColor,
    getPaymentStatusColor,
    fetchBookings,
    handleCancelBooking,
    handleDeleteBooking,
    handleDownloadTicket,
    handleProcessPayment,
    handleMethodSelect,
    handleConfirmAndPay,
    verifyPaymentStatus,
    handleFilterChange,
    handleStatusFilter,
    setFilters,
    setActiveFilter,
    setShowFilters,
    setCurrentPage,
    setMethodModalOpen,
    setConfirmModalOpen,
    setSelectedBooking,
    setUserDetails,
    setToastNotifications,
    setSuccess,
    setError,
  } as const;
};

export default useBookingsList;
