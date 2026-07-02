'use client';

import React, { useState, useEffect, useCallback, useMemo, memo, ChangeEvent, FormEvent, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { sendNotification, useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import BackButton from '@/components/BackButton';
import { Booking, Schedule, Bus, Route, Company, UserProfile, NotificationType } from '@/types';
import {
  Bus as BusIcon, MapPin, Clock, Download, XCircle, CheckCircle, Loader2,
  Search, CreditCard, Armchair, Bell, AlertTriangle, Calendar, Users,
  RefreshCw, Zap, Shield, Smartphone, ArrowRight, ArrowLeft, Trash2,
  ChevronRight, Building2, Wallet,
} from 'lucide-react';

import Modal from '../../components/Modals';
import AlertMessage from '../../components/AlertMessage';
import { useAppToast } from '@/contexts/ToastContext';
import useBookingsList, { BookingWithDetails, SearchFilters, resolveStopName } from './useBookingsList';
import BookingCheckoutDrawer from './BookingCheckoutFlow';
import BookingStatsGrid from './BookingStatsGrid';

// ─── BookingCard ──────────────────────────────────────────────────────────────
const BookingCard = memo<{
  booking: BookingWithDetails;
  onCancel: (bookingId: string, scheduleId: string, seatNumbers: string[]) => Promise<void>;
  onDelete: (bookingId: string) => Promise<void>;
  onDownload: (booking: BookingWithDetails, includeQR: boolean) => Promise<void>;
  onPayment: (booking: BookingWithDetails) => void;
  actionLoading: string | null;
  formatTime: (dateTime: unknown) => string;
  formatDate: (dateTime: unknown) => string;
  getStatusColor: (status: string) => string;
  getPaymentStatusColor: (status: string) => string;
}>(({ booking, onCancel, onDelete, onDownload, onPayment, actionLoading,
  formatTime, formatDate, getStatusColor, getPaymentStatusColor }) => {

  const handleCancel = useCallback(() => onCancel(booking.id, booking.scheduleId, booking.seatNumbers), [booking.id, booking.scheduleId, booking.seatNumbers, onCancel]);
  const handleDelete = useCallback(() => onDelete(booking.id), [booking.id, onDelete]);
  const handleDLWithQR = useCallback(() => onDownload(booking, true), [booking, onDownload]);
  const handleDLOnly = useCallback(() => onDownload(booking, false), [booking, onDownload]);
  const handlePayment = useCallback(() => onPayment(booking), [booking, onPayment]);

  const originName = resolveStopName(booking.originStopId, booking.originStopName, booking.route, booking.route?.origin || 'N/A');
  const alightName = resolveStopName(booking.destinationStopId, booking.destinationStopName, booking.route, booking.route?.destination || 'N/A');
  const isSegment = originName !== (booking.route?.origin || '') || alightName !== (booking.route?.destination || '');
  const isCash = (booking as any).paymentMethod === 'cash_on_boarding';

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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-600">
              <div className="flex items-center gap-2"><BusIcon className="w-4 h-4 text-gray-400 shrink-0" /><span className="truncate">{booking.bus?.busType || 'N/A'} · {booking.bus?.licensePlate || 'N/A'}</span></div>
              <div className="flex items-center gap-2"><Users className="w-4 h-4 text-gray-400 shrink-0" /><span>{booking.passengerDetails?.length || 0} passenger{(booking.passengerDetails?.length || 0) > 1 ? 's' : ''}</span></div>
              <div className="flex items-center gap-2"><Armchair className="w-4 h-4 text-gray-400 shrink-0" /><span className="truncate">Seats: {booking.seatNumbers.join(', ')}</span></div>
              <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-gray-400 shrink-0" /><span className="truncate">Booked: {formatDate(booking.createdAt)}</span></div>
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
              <p className="text-xs text-emerald-700">Complete payment via PayChangu (mobile money) to secure your seats.</p>
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userProfile } = useAuth();
  const toast = useAppToast();
  const {
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
  } = useBookingsList();

  const [searchQuery, setSearchQuery] = useState('');

  // Reset page when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, setCurrentPage]);

  // Client-side fuzzy search on top of status-filtered bookings
  const searchedBookings = useMemo(() => {
    if (!searchQuery.trim()) return filteredBookings;
    const query = searchQuery.toLowerCase().trim();
    return filteredBookings.filter((b) => {
      const ref = (b.bookingReference || b.id.slice(-8)).toLowerCase();
      const company = (b.company?.name || '').toLowerCase();
      const origin = (b.route?.origin || '').toLowerCase();
      const destination = (b.route?.destination || '').toLowerCase();
      const originStop = resolveStopName(b.originStopId, b.originStopName, b.route, b.route?.origin || '').toLowerCase();
      const destinationStop = resolveStopName(b.destinationStopId, b.destinationStopName, b.route, b.route?.destination || '').toLowerCase();
      const passengerMatch = b.passengerDetails?.some((p) => p.name.toLowerCase().includes(query)) || false;
      const status = b.bookingStatus.toLowerCase();
      const pStatus = b.paymentStatus.toLowerCase();

      return (
        ref.includes(query) ||
        company.includes(query) ||
        origin.includes(query) ||
        destination.includes(query) ||
        originStop.includes(query) ||
        destinationStop.includes(query) ||
        passengerMatch ||
        status.includes(query) ||
        pStatus.includes(query)
      );
    });
  }, [filteredBookings, searchQuery]);

  // Adjust pagination for search results
  const pageBookings = useMemo(() => {
    return searchedBookings.slice((currentPage - 1) * bookingsPerPage, currentPage * bookingsPerPage);
  }, [searchedBookings, currentPage, bookingsPerPage]);

  const searchTotalPages = useMemo(() => {
    return Math.ceil(searchedBookings.length / bookingsPerPage);
  }, [searchedBookings.length, bookingsPerPage]);


  const handlePageBack = useCallback(() => {
    const canGoBack = typeof window !== 'undefined' && window.history.state && typeof window.history.state.idx === 'number' && window.history.state.idx > 0;
    if (canGoBack) {
      router.back();
    } else {
      router.push('/schedules');
    }
  }, [router]);

  const { notifications: ctxNotifications } = useNotifications();
  const lastNotificationIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!ctxNotifications) return;

    const relevantTypes = new Set([
      'booking', 'payment', 'trip_update', 'cancellation', 'cancellation_requested',
    ]);

    const newNotifications = ctxNotifications.filter((n) => !lastNotificationIdsRef.current.has(n.id));
    lastNotificationIdsRef.current = new Set(ctxNotifications.map((n) => n.id));

    if (newNotifications.length === 0) return;
    const relevant = newNotifications.some((n) => relevantTypes.has(n.type as string));
    if (relevant) fetchBookings();
  }, [ctxNotifications, fetchBookings]);

  

  useEffect(() => {
    if (!user) { router.push('/login'); return; }

    const pv = searchParams?.get('payment_verify');
    const provider = searchParams?.get('provider');
    const txRef = searchParams?.get('tx_ref');
    const transactionId = searchParams?.get('transaction_id') ?? undefined;
    const flwStatus = searchParams?.get('status');
    const successP = searchParams?.get('success');
    const cancelled = searchParams?.get('cancelled');
    const errorCode = searchParams?.get('error');

    const errorMessages: Record<string, string> = {
      payment_failed: 'Payment failed. Please try again or contact support.',
      verification_failed: 'Payment verification failed. Please try again later.',
      booking_not_found: 'Payment completed but booking could not be located. Contact support.',
      server_error: 'Server error while verifying payment. Please try again.',
    };

    if (errorCode) {
      setError(errorMessages[errorCode] || `Payment error: ${errorCode}`);
      setTimeout(() => setError(''), 8000);
    }

    if (successP === 'true' && !pv) {
      setSuccess('Action completed!');
      setTimeout(() => setSuccess(''), 5000);
    }

    if (cancelled === 'true' || flwStatus === 'cancelled') {
      setError('Payment was cancelled. You can try again anytime.');
      setTimeout(() => setError(''), 6000);
    }

    if (pv === 'true' && provider) {
      if (txRef) {
        if (flwStatus !== 'cancelled') {
          verifyPaymentStatus(provider, txRef, transactionId);
        }
      } else if (flwStatus === 'success') {
        setSuccess('Payment successfully completed.');
        setTimeout(() => setSuccess(''), 6000);
      }

      const clean = new URL(window.location.href);
      ['payment_verify', 'provider', 'tx_ref', 'transaction_id', 'status', 'cancelled', 'success', 'error']
        .forEach((k) => clean.searchParams.delete(k));
      window.history.replaceState({}, '', clean.toString());
    }

    fetchBookings();
    return;
  }, [user, router, searchParams, fetchBookings, verifyPaymentStatus]);

  // NOTE: Tab switching is now purely client-side via handleStatusFilter.
  // No useEffect needed here — avoids redundant re-renders.

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse space-y-6">
        <div className="bg-white rounded-2xl shadow-sm p-6"><div className="h-8 bg-gray-200 rounded w-1/4 mb-4" /><div className="grid grid-cols-1 md:grid-cols-5 gap-4">{[...Array(5)].map((_, i) => (<div key={i} className="bg-gray-100 rounded-xl p-4"><div className="h-4 bg-gray-200 rounded w-3/4 mb-2" /><div className="h-6 bg-gray-200 rounded w-1/2" /></div>))}</div></div>
        {[...Array(3)].map((_, i) => (<div key={i} className="bg-white rounded-2xl shadow-sm p-6"><div className="h-24 bg-gray-200 rounded" /></div>))}
      </div>
    </div>
  );

  const statCards = [
    { label: 'All Bookings', value: bookingStats.all, key: 'all', Icon: BusIcon },
    { label: 'Confirmed', value: bookingStats.confirmed, key: 'confirmed', Icon: CheckCircle },
    { label: 'Pending', value: bookingStats.pending, key: 'pending', Icon: Clock },
    { label: 'Cancelled', value: bookingStats.cancelled, key: 'cancelled', Icon: XCircle },
    { label: 'Upcoming', value: bookingStats.upcoming, key: 'upcoming', Icon: Calendar },
  ];

  return (
      <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-8 w-full">

          {toastNotifications.length > 0 && (
            <div className="fixed top-4 right-4 left-4 sm:left-auto z-50 space-y-2">
              {toastNotifications.map((n, i) => (
                <div key={i} className="bg-emerald-500 text-white p-4 rounded-lg shadow-lg w-full sm:w-auto sm:max-w-sm flex items-start gap-3">
                  <Bell className="w-5 h-5 mt-0.5 shrink-0" />
                  <div><p className="font-medium text-sm">Booking Update</p><p className="text-xs opacity-90 mt-1">{n}</p></div>
                  <button onClick={() => setToastNotifications((p) => p.filter((_, j) => j !== i))} className="ml-auto text-white/80 hover:text-white"><XCircle className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}

          {success && <div className="mb-6"><AlertMessage type="success" message={success} onClose={() => setSuccess('')} /></div>}
          {error && <div className="mb-6"><AlertMessage type="error" message={error} onClose={() => setError('')} /></div>}

          <div className="mb-4 hidden md:block">
            <BackButton
              onClick={handlePageBack}
              iconOnly
              className="border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900"
            />
          </div>

          {/* ── Header ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-0.5">My Bookings</h1>
                  <p className="text-sm text-gray-500">Manage and track your bus ticket bookings</p>
                </div>
              </div>
              <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto">
                <button onClick={() => fetchBookings()} disabled={loading}
                  className="flex-1 sm:flex-none flex justify-center items-center gap-2 px-4 py-2 text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 disabled:opacity-50 text-sm font-medium">
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Refresh
                </button>
                <button onClick={() => router.push('/schedules')}
                  className="flex-1 sm:flex-none flex justify-center items-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md text-sm font-semibold whitespace-nowrap">
                  <Search className="w-4 h-4" />Book Ticket
                </button>
              </div>
            </div>

            <div className="mt-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search bookings by reference, company, route, passenger name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all duration-200 text-gray-900 placeholder-gray-500"
                />
                <Search className="w-5 h-5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {bookings.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
              <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6"><BusIcon className="w-10 h-10 text-gray-400" /></div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No bookings found</h3>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">You haven't made any bus bookings yet.</p>
              <button onClick={() => router.push('/schedules')} className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all hover:scale-105 shadow-lg">
                <Search className="w-5 h-5" />Search for Buses
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <BookingStatsGrid cards={statCards} activeFilter={activeFilter} onCardClick={handleStatusFilter} />
              
              {searchedBookings.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                  <div className="mx-auto w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4"><Search className="w-8 h-8 text-gray-400" /></div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">No bookings match your search</h3>
                  <p className="text-sm text-gray-600 max-w-md mx-auto">We couldn't find any bookings matching "{searchQuery}" under the "{activeFilter}" filter.</p>
                </div>
              ) : (
                <>
                  {pageBookings.map((b) => (
                    <BookingCard key={b.id} booking={b} onCancel={handleCancelBooking} onDelete={handleDeleteBooking}
                      onDownload={handleDownloadTicket} onPayment={handleProcessPayment} actionLoading={actionLoading}
                      formatTime={formatTime} formatDate={formatDate} getStatusColor={getStatusColor} getPaymentStatusColor={getPaymentStatusColor}
                    />
                  ))}
                  {searchedBookings.length > bookingsPerPage && (
                    <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-3">
                      <button onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} disabled={currentPage === 1} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg disabled:opacity-50 hover:bg-gray-200 w-full sm:w-auto">Previous</button>
                      <span className="text-sm text-gray-600">Page {currentPage} of {searchTotalPages} ({searchedBookings.length} total)</span>
                      <button onClick={() => setCurrentPage((p) => Math.min(p + 1, searchTotalPages))} disabled={currentPage === searchTotalPages} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg disabled:opacity-50 hover:bg-gray-200 w-full sm:w-auto">Next</button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <Modal isOpen={methodModalOpen || confirmModalOpen} onClose={() => { setMethodModalOpen(false); setConfirmModalOpen(false); }} title="Payment">
            {selectedBooking && (
              <BookingCheckoutDrawer
                booking={selectedBooking}
                initialStep={confirmModalOpen ? 'confirm' : 'select'}
                onClose={() => { setMethodModalOpen(false); setConfirmModalOpen(false); }}
                onSelect={handleMethodSelect}
                onConfirm={handleConfirmAndPay}
                loading={actionLoading === selectedBooking.id}
                userDetails={userDetails}
                setUserDetails={setUserDetails}
                formatDate={formatDate}
                formatTime={formatTime}
                providerLabel={selectedLabel}
              />
            )}
          </Modal>
        </div>
      </div>
  );
};

export default BookingsPage;
