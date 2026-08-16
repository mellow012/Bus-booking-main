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
  ChevronRight, Building2, Wallet, Star, Navigation, Archive, Phone,
} from 'lucide-react';
import nextDynamic from 'next/dynamic';

import Modal from '../../components/Modals';
import AlertMessage from '../../components/AlertMessage';
import { useAppToast } from '@/contexts/ToastContext';
import useBookingsList, { BookingWithDetails, SearchFilters, resolveStopName, getEstimatedDuration } from './useBookingsList';
import { parseUtcDate } from '@/lib/timezone';
import { deriveBookingStatus, getDisplayStatusUI } from '@/lib/booking-utils';
import { isChatterScheduleExpired } from '@/lib/chatterHelpers';
import BookingCheckoutDrawer from './BookingCheckoutFlow';
import BookingStatsGrid from './BookingStatsGrid';
import { useJourneyTracker } from './useJourneyTracker';
import { RouteStopsDisplay } from '@/components/RouteStopsDisplay';
import BookingsLoading from './loading';

const JourneyMap = nextDynamic(() => import('./JourneyMap'), { ssr: false, loading: () => <div className="w-full h-48 bg-gray-100 rounded-xl animate-pulse flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div> });

// ─── BookingCard ──────────────────────────────────────────────────────────────
const BookingCard = memo<{
  booking: BookingWithDetails;
  onCancel: (bookingId: string, scheduleId: string, seatNumbers: string[]) => Promise<void>;
  onDelete: (bookingId: string) => Promise<void>;
  onDownload: (booking: BookingWithDetails, includeQR: boolean) => Promise<void>;
  onPayment: (booking: BookingWithDetails) => void;
  onReviewSubmitted?: () => void;
  actionLoading: string | null;
  formatTime: (dateTime: unknown) => string;
  formatDate: (dateTime: unknown) => string;
  router: ReturnType<typeof useRouter>;
}>(({ booking, onCancel, onDelete, onDownload, onPayment, onReviewSubmitted, actionLoading,
  formatTime, formatDate, router }) => {

  const handleCancel = useCallback(() => onCancel(booking.id, booking.scheduleId, booking.seatNumbers), [booking.id, booking.scheduleId, booking.seatNumbers, onCancel]);
  const handleDelete = useCallback(() => onDelete(booking.id), [booking.id, onDelete]);
  const handleDLWithQR = useCallback(() => onDownload(booking, true), [booking, onDownload]);
  const handleDLOnly = useCallback(() => onDownload(booking, false), [booking, onDownload]);
  const handlePayment = useCallback(() => onPayment(booking), [booking, onPayment]);

  const rawSchedule: any = booking.schedule ?? (booking as any).chatterSchedule;
  const rawRoute: any = booking.route ?? (booking as any).chatterSchedule;
  
  const bookingSchedule: any = rawSchedule ? (() => {
    const dep = rawSchedule.departureDateTime ?? rawSchedule.travelDate;
    let arr = rawSchedule.arrivalDateTime;

    if (!arr && (rawRoute?.origin || rawRoute?.destination)) {
      const depDate = dep instanceof Date ? dep : parseUtcDate(dep);
      if (!isNaN(depDate.getTime())) {
        const durMinutes = getEstimatedDuration(
          rawRoute?.origin || '',
          rawRoute?.destination || '',
          rawRoute?.duration,
          rawRoute?.distance
        );
        arr = new Date(depDate.getTime() + durMinutes * 60 * 1000);
      }
    }

    return {
      ...rawSchedule,
      departureDateTime: dep,
      arrivalDateTime: arr ?? dep,
    };
  })() : null;
  const bookingRoute: any = booking.route ?? (booking as any).chatterSchedule;
  const outboundCompleted =
    bookingSchedule?.tripStatus === 'completed' ||
    (bookingSchedule?.tripStatus !== 'in_transit' && new Date() >= parseUtcDate(bookingSchedule?.arrivalDateTime));

  const activeSegment = (outboundCompleted && booking.returnSegment) ? booking.returnSegment : null;

  const displaySchedule = activeSegment ? activeSegment.schedule : bookingSchedule;
  const displayRoute = activeSegment ? activeSegment.route : bookingRoute;
  const displayOriginStopId = activeSegment ? activeSegment.originStopId : booking.originStopId;
  const displayDestinationStopId = activeSegment ? activeSegment.destinationStopId : booking.destinationStopId;

  const displayOriginName = resolveStopName(displayOriginStopId, activeSegment ? undefined : booking.originStopName, displayRoute, displayRoute?.origin || 'N/A');
  const displayAlightName = resolveStopName(displayDestinationStopId, activeSegment ? undefined : booking.destinationStopName, displayRoute, displayRoute?.destination || 'N/A');

  const originName = resolveStopName(booking.originStopId, booking.originStopName, bookingRoute as any, bookingRoute?.origin || 'N/A');
  const alightName = resolveStopName(booking.destinationStopId, booking.destinationStopName, bookingRoute as any, bookingRoute?.destination || 'N/A');
  const isSegment = originName !== (bookingRoute?.origin || '') || alightName !== (bookingRoute?.destination || '');
  const isCash = (booking as any).paymentMethod === 'cash_on_boarding';
  const hasSecuredSeat = booking.bookingStatus === 'confirmed' &&
    (booking.paymentStatus === 'paid' || isCash);

  const activeLegReviewRating = activeSegment
    ? ((booking as any).metadata?.returnReview?.rating ?? null)
    : ((booking as any).metadata?.outboundReview?.rating ?? (booking as any).reviewRating ?? null);

  const journey = useJourneyTracker({
    bookingId: booking.id,
    scheduleId: activeSegment ? activeSegment.scheduleId : booking.scheduleId,
    departureDateTime: parseUtcDate(activeSegment ? activeSegment.schedule.departureDateTime : (bookingSchedule?.departureDateTime ?? bookingSchedule?.travelDate)),
    arrivalDateTime: parseUtcDate(activeSegment ? activeSegment.schedule.arrivalDateTime : (bookingSchedule?.arrivalDateTime ?? bookingSchedule?.travelDate)),
    tripStatus: activeSegment ? activeSegment.schedule.tripStatus : (bookingSchedule?.tripStatus ?? 'scheduled'),
    bookingStatus: booking.bookingStatus,
    paymentStatus: booking.paymentStatus,
    paymentMethod: (booking as any).paymentMethod || booking.paymentProvider,
    reviewRating: activeLegReviewRating,
    destinationCity: activeSegment ? (activeSegment.route?.destination || '') : (bookingRoute?.destination || ''),
  });

  const [reviewForm, setReviewForm] = useState({ rating: 0, hover: 0, text: '' });

  const rawDeparture = activeSegment ? activeSegment.schedule.departureDateTime : (bookingSchedule?.departureDateTime ?? bookingSchedule?.travelDate);
  const parsedDeparture = parseUtcDate(rawDeparture);

  const derivedStatus = deriveBookingStatus({
    bookingStatus: booking.bookingStatus,
    paymentStatus: booking.paymentStatus,
    paymentMethod: (booking as any).paymentMethod || booking.paymentProvider,
    tripStatus: activeSegment ? activeSegment.schedule.tripStatus : (bookingSchedule?.tripStatus ?? 'scheduled'),
    departureTime: parsedDeparture,
    arrivalTime: parseUtcDate(activeSegment ? activeSegment.schedule.arrivalDateTime : (bookingSchedule?.arrivalDateTime ?? bookingSchedule?.travelDate))
  });
  const statusUI = getDisplayStatusUI(derivedStatus);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all duration-300">
      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-4">
          <div className="flex items-center gap-3">
            {booking.company.logo ? (
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden border border-gray-100 shrink-0 relative">
                <img src={booking.company.logo} alt={booking.company.name} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-brand-700 to-brand-600 rounded-xl flex items-center justify-center shadow-lg shrink-0">
                <span className="text-white font-bold text-lg">{booking.company.name?.charAt(0) || 'C'}</span>
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{booking.company.name}</h3>
              <div className="flex items-center gap-3 text-sm text-gray-600 truncate flex-wrap">
                <span>Ref: {booking.bookingReference || booking.id.slice(-8)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusUI.colorClass} flex items-center gap-1 ${statusUI.isPulsing ? 'animate-pulse' : ''}`}>
              {derivedStatus === 'in_transit' && <Navigation className="w-3 h-3" />}
              {derivedStatus === 'delayed' && <Clock className="w-3 h-3" />}
              {(derivedStatus === 'reserved_cash' || isCash) && <Wallet className="w-3 h-3" />}
              {statusUI.label}
            </span>
            {isSegment && (
              <span className="px-3 py-1 rounded-full text-xs font-medium border bg-orange-50 text-orange-700 border-orange-200">Segment</span>
            )}
          </div>
        </div>

        {/* Route timeline */}
        <div className="flex flex-col sm:flex-row items-center gap-4 p-3 bg-gray-50 rounded-xl mb-4">
          <div className="text-center min-w-[80px]">
            <div className="text-lg sm:text-xl font-bold text-gray-900">{formatTime(displaySchedule?.departureDateTime ?? displaySchedule?.travelDate)}</div>
            <div className="text-sm text-gray-600 flex items-center justify-center gap-1"><MapPin className="w-3 h-3" /><span className="truncate">{displayOriginName}</span></div>
            {((booking as any).chatterSchedule?.pickupPoint || (booking as any).metadata?.pickupPoint) && (
              <div className="text-[11px] font-medium text-brand-700 mt-0.5 truncate max-w-[140px] mx-auto">
                Pickup: {(booking as any).chatterSchedule?.pickupPoint || (booking as any).metadata?.pickupPoint}
              </div>
            )}
            <div className="text-xs text-gray-500 mt-1">
              {formatDate(displaySchedule?.departureDateTime ?? displaySchedule?.travelDate)}
            </div>
          </div>
          <div className="flex-1 mx-2 hidden sm:block">
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t-2 border-dashed border-gray-300" /></div>
              
              {(journey.state === 'in_transit' || journey.state === 'arrived' || journey.state === 'completed') && (
                <div className="absolute inset-0 flex items-center">
                  <div className="h-0.5 bg-brand-600 transition-all duration-1000" style={{ width: `${journey.progress * 100}%` }} />
                </div>
              )}

              <div className="relative flex justify-center">
                <div className={`px-3 py-1 rounded-full border transition-colors ${journey.state === 'in_transit' ? 'bg-brand-50 border-brand-200' : 'bg-white border-gray-200'}`}>
                  <BusIcon className={`w-4 h-4 ${journey.state === 'in_transit' ? 'text-brand-600 animate-pulse' : 'text-gray-500'}`} />
                </div>
              </div>
            </div>
            
            {(() => {
              const rawDep = displaySchedule?.departureDateTime ?? displaySchedule?.travelDate;
              const rawArr = displaySchedule?.arrivalDateTime ?? displaySchedule?.travelDate;
              const depTime = rawDep ? parseUtcDate(rawDep).getTime() : 0;
              const arrTime = rawArr ? parseUtcDate(rawArr).getTime() : 0;
              const calcMinutes = (arrTime && depTime && arrTime > depTime)
                ? Math.round((arrTime - depTime) / (1000 * 60))
                : getEstimatedDuration(displayOriginName, displayAlightName, displayRoute?.duration, displayRoute?.distance);
              const durationHrs = Math.floor(calcMinutes / 60);
              const durationMins = calcMinutes % 60;
              return (
                <div className="text-center mt-2 flex justify-center gap-2">
                  <span className="text-xs text-gray-500">{durationHrs}h {durationMins}m</span>
                  {journey.countdownText && (
                    <span className={`text-xs font-medium ${journey.state === 'in_transit' ? 'text-brand-600' : 'text-gray-600'}`}>
                      • {journey.countdownText}
                    </span>
                  )}
                </div>
              );
            })()}
          </div>
          <div className="text-center min-w-[80px]">
            <div className="text-lg sm:text-xl font-bold text-gray-900">{formatTime(displaySchedule?.arrivalDateTime ?? displaySchedule?.travelDate)}</div>
            <div className="text-sm text-gray-600 flex items-center justify-center gap-1"><MapPin className="w-3 h-3" /><span className="truncate">{displayAlightName}</span></div>
            {((booking as any).chatterSchedule?.dropoffPoint || (booking as any).metadata?.dropoffPoint) && (
              <div className="text-[11px] font-medium text-slate-600 mt-0.5 truncate max-w-[140px] mx-auto">
                Dropoff: {(booking as any).chatterSchedule?.dropoffPoint || (booking as any).metadata?.dropoffPoint}
              </div>
            )}
            <div className="text-xs text-gray-500 mt-1">{formatDate(displaySchedule?.arrivalDateTime ?? displaySchedule?.travelDate)}</div>
          </div>
        </div>

        {isSegment && (
          <div className="mb-4 px-3 py-2 bg-orange-50 border border-orange-100 rounded-lg text-xs text-orange-700">
            Full route: {bookingRoute?.origin} → {bookingRoute?.destination}
          </div>
        )}

        {journey.stopStages && journey.stopStages.length > 2 && (
          <div className="mb-4">
            <details className="group [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-center justify-between gap-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors p-3 text-gray-900 border border-gray-100">
                <h2 className="font-medium text-xs text-gray-600 flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5" />
                  View full itinerary ({journey.stopStages.length} stops)
                </h2>
                <ChevronRight className="w-4 h-4 text-gray-500 transition duration-300 group-open:rotate-90" />
              </summary>
              <div className="mt-2 bg-white border border-gray-100 rounded-lg p-4 shadow-inner max-h-60 overflow-y-auto">
                <RouteStopsDisplay stops={journey.stopStages} />
              </div>
            </details>
          </div>
        )}

        {/* Journey Map & Tracker */}
        {journey.state === 'in_transit' && hasSecuredSeat && (
          <div className="mb-6 space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${journey.locationConsent ? 'bg-brand-100 text-brand-600' : 'bg-gray-200 text-gray-500'}`}>
                  <Navigation className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">Live Journey Tracking</h4>
                  <p className="text-xs text-gray-500">Enable location to track your exact position</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => journey.setLocationConsent(!journey.locationConsent)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${journey.locationConsent ? 'bg-brand-600' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${journey.locationConsent ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            {journey.locationConsent && (
              <JourneyMap 
                key={`map-${booking.id}`}
                origin={activeSegment ? (activeSegment.route?.origin || '') : (bookingRoute?.origin || '')}
                destination={activeSegment ? (activeSegment.route?.destination || '') : (bookingRoute?.destination || '')}
                progress={journey.progress}
                livePosition={journey.livePosition}
                onClick={() => router.push(`/bookings/${booking.id}/journey`)}
              />
            )}
          </div>
        )}

        {/* Return Trip Details */}
        {booking.returnSegment ? (
          <div className="mb-6 p-4 bg-brand-50 border border-brand-100 rounded-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-brand-800">Return trip</p>
                <p className="text-xs text-brand-600">{resolveStopName(booking.returnSegment.originStopId, undefined, booking.returnSegment.route, booking.returnSegment.route.origin || 'N/A')} → {resolveStopName(booking.returnSegment.destinationStopId, undefined, booking.returnSegment.route, booking.returnSegment.route.destination || 'N/A')}</p>
              </div>
              <div className="text-right text-sm text-brand-700">{formatDate(booking.returnSegment.schedule.departureDateTime)}</div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3 text-sm text-gray-700">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400">Departs</div>
                <div className="font-semibold">{formatTime(booking.returnSegment.schedule.departureDateTime)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400">Arrives</div>
                <div className="font-semibold">{formatTime(booking.returnSegment.schedule.arrivalDateTime)}</div>
              </div>
            </div>
          </div>
        ) : booking.returnDate ? (
          <div className="mb-6 px-4 py-3 bg-brand-50 border border-brand-100 rounded-lg text-sm text-brand-800">
            <div className="font-semibold">Return trip booked</div>
            <div className="mt-1 text-sm">Return date: {formatDate(booking.returnDate)}</div>
          </div>
        ) : null}

        {/* Review Section */}
        {journey.state === 'arrived' && !journey.hasReview && (
          <div className="mb-6 p-4 bg-brand-50 border border-brand-100 rounded-xl">
            <h4 className="text-sm font-semibold text-brand-800 mb-1">How was your trip?</h4>
            <p className="text-xs text-brand-600 mb-4">Rate your journey with {booking.company.name}</p>
            
            <div className="flex gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setReviewForm(p => ({ ...p, rating: star }))}
                  onMouseEnter={() => setReviewForm(p => ({ ...p, hover: star }))}
                  onMouseLeave={() => setReviewForm(p => ({ ...p, hover: 0 }))}
                  className="focus:outline-none transition-transform hover:scale-110"
                >
                  <Star className={`w-8 h-8 ${(reviewForm.hover || reviewForm.rating) >= star ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
                </button>
              ))}
            </div>

            {reviewForm.rating > 0 && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <textarea
                  value={reviewForm.text}
                  onChange={(e) => setReviewForm(p => ({ ...p, text: e.target.value }))}
                  placeholder="Share details about your experience (optional)"
                  className="w-full p-3 text-sm bg-white border border-brand-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
                  rows={2}
                />
                <button
                  onClick={async () => {
                    const ok = await journey.submitReview(reviewForm.rating, reviewForm.text, activeSegment ? 'return' : 'outbound');
                    if (ok) {
                      setReviewForm({ rating: 0, hover: 0, text: '' });
                      onReviewSubmitted?.();
                    }
                  }}
                  disabled={journey.reviewSubmitting}
                  className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2 transition-colors shadow-sm"
                >
                  {journey.reviewSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Submit Review
                </button>
              </div>
            )}
          </div>
        )}

        {/* Existing rating display */}
        {journey.hasReview && (
          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-xl flex items-start gap-4">
            <div className="flex gap-1 mt-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-4 h-4 ${booking.reviewRating && star <= booking.reviewRating ? 'text-amber-400 fill-amber-400' : (booking.reviewRating ? 'text-gray-300' : 'text-amber-400 fill-amber-400')}`}
                />
              ))}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {booking.reviewRating ? 'You reviewed this trip' : 'You have already reviewed this trip'}
              </p>
              {booking.reviewText && (
                <p className="text-sm text-gray-600 mt-1">"{booking.reviewText}"</p>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <div className="mb-3">
              <div className="flex items-center gap-2 text-sm text-gray-900 font-medium">
                <BusIcon className="w-4 h-4 text-gray-500 shrink-0" />
                <span className="truncate">
                  {booking.bus?.busType && booking.bus?.licensePlate && booking.bus?.licensePlate !== 'N/A'
                    ? `${booking.bus.busType} · ${booking.bus.licensePlate}`
                    : (booking.bus?.busType || (booking as any).chatterSchedule?.busName || 'Standard Bus')}
                </span>
              </div>
              {((booking as any).chatterSchedule?.contactPhone || (booking.company as any)?.phone || bookingSchedule?.operatorPhone) && (
                <div className="flex items-center gap-2 text-sm text-gray-600 mt-1 pl-6">
                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                  <a href={`tel:${(booking as any).chatterSchedule?.contactPhone || (booking.company as any)?.phone || bookingSchedule?.operatorPhone}`} className="hover:underline hover:text-brand-600 transition-colors">
                    {(booking as any).chatterSchedule?.contactPhone || (booking.company as any)?.phone || bookingSchedule?.operatorPhone}
                  </a>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-600">
              <div className="flex items-center gap-2"><Users className="w-4 h-4 text-gray-400 shrink-0" /><span>{booking.passengerDetails?.length || 0} passenger{(booking.passengerDetails?.length || 0) > 1 ? 's' : ''}</span></div>
              <div className="flex items-center gap-2"><Armchair className="w-4 h-4 text-gray-400 shrink-0" /><span className="truncate">Seats: {booking.seatNumbers.join(', ')}</span></div>
              <div className="flex items-center gap-2 sm:col-span-2"><Clock className="w-4 h-4 text-gray-400 shrink-0" /><span className="truncate">Booked: {formatDate(booking.createdAt)}</span></div>
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
              {(derivedStatus === 'payment_incomplete' || derivedStatus === 'payment_failed') && (() => {
                const isChatter = !!(booking as any).chatterScheduleId || !!(booking as any).chatterSchedule;
                let isScheduleInvalid = false;

                if (isChatter) {
                  const cs = (booking as any).chatterSchedule;
                  const isCancelled = cs?.status === 'cancelled';
                  const isArchived = cs?.isArchived === true;
                  const isExpired = isChatterScheduleExpired(cs?.travelDate);
                  isScheduleInvalid = isCancelled || isArchived || isExpired;
                } else {
                  const s = booking.schedule;
                  const isCancelled = s?.tripStatus === 'cancelled';
                  const depDate = s?.departureDateTime instanceof Date ? s.departureDateTime : (s?.departureDateTime ? parseUtcDate(s.departureDateTime) : null);
                  const isDeparted = depDate ? depDate.getTime() < Date.now() : false;
                  isScheduleInvalid = isCancelled || isDeparted;
                }

                if (isScheduleInvalid) {
                  return (
                    <div className="space-y-1.5">
                      <button
                        disabled
                        className="w-full px-3 py-2 bg-slate-100 text-slate-400 rounded-lg cursor-not-allowed border border-slate-200 flex items-center justify-center gap-2 text-xs font-semibold"
                      >
                        <Zap className="w-4 h-4 opacity-50" />
                        <span>Pay Unavailable</span>
                      </button>
                      <p className="text-[11px] font-medium text-amber-700 text-center">
                        This trip is no longer available
                      </p>
                    </div>
                  );
                }

                return (
                  <button onClick={handlePayment} disabled={actionLoading === booking.id}
                    className="w-full px-3 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-md flex items-center justify-center gap-2">
                    {actionLoading === booking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Zap className="w-4 h-4" /><span className="font-medium">Retry Payment</span></>}
                  </button>
                );
              })()}
              {booking.paymentStatus === 'paid' && (
                <button onClick={handleDLOnly} disabled={actionLoading === `download_${booking.id}`}
                  className="w-full px-3 py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 flex items-center justify-center gap-2">
                  <Download className="w-4 h-4" /><span>Ticket Only</span>
                </button>
              )}
              {isCash && derivedStatus !== 'payment_incomplete' && derivedStatus !== 'cancelled' && (
                <button onClick={handleDLWithQR} disabled={actionLoading === `download_${booking.id}`}
                  className="w-full px-3 py-2 bg-brand-50 text-brand-700 rounded-lg hover:bg-brand-100 transition-colors border border-brand-100 flex items-center justify-center gap-2">
                  {actionLoading === `download_${booking.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Download className="w-4 h-4" /><span>Boarding Pass</span></>}
                </button>
              )}
              {(() => {
                if (derivedStatus !== 'payment_incomplete' && derivedStatus !== 'confirmed' && derivedStatus !== 'reserved_cash') return null;
                
                const departureTime = parseUtcDate(displaySchedule.departureDateTime).getTime();
                const twoHoursInMs = 2 * 60 * 60 * 1000;
                const canCancel = departureTime - Date.now() > twoHoursInMs;

                if (derivedStatus === 'payment_incomplete' || canCancel) {
                  const isRefund = booking.paymentStatus === 'paid';
                  return (
                    <button onClick={handleCancel} disabled={actionLoading === booking.id}
                      className={`w-full px-3 py-2 rounded-lg transition-colors border flex items-center justify-center gap-2 ${isRefund ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200' : 'bg-red-50 text-red-700 hover:bg-red-100 border-red-200'}`}>
                      {actionLoading === booking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : isRefund ? <><AlertTriangle className="w-4 h-4" /><span>Request Refund</span></> : <><XCircle className="w-4 h-4" /><span>Cancel Booking</span></>}
                    </button>
                  );
                }
                return null;
              })()}
              {(() => {
                const arrRaw = displaySchedule?.arrivalDateTime;
                const depRaw = displaySchedule?.departureDateTime;
                const arr = arrRaw ? (arrRaw instanceof Date ? arrRaw : parseUtcDate(arrRaw)) : null;
                const dep = depRaw ? (depRaw instanceof Date ? depRaw : parseUtcDate(depRaw)) : null;
                const tripTime = (arr && !isNaN(arr.getTime())) ? arr.getTime() : (dep && !isNaN(dep.getTime())) ? dep.getTime() : null;
                const isPast48Hours = tripTime !== null && Date.now() > tripTime + (48 * 60 * 60 * 1000);

                const isDeletable = 
                  derivedStatus === 'cancelled' || 
                  derivedStatus === 'expired' || 
                  (derivedStatus === 'archived' && (booking.bookingStatus === 'cancelled' || booking.bookingStatus === 'expired' || isPast48Hours)) ||
                  isPast48Hours;

                if (!isDeletable) return null;

                return (
                  <button onClick={handleDelete} disabled={actionLoading === booking.id}
                    className="w-full px-3 py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 flex items-center justify-center gap-2">
                    {actionLoading === booking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-4 h-4" /><span>Delete</span></>}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {derivedStatus === 'payment_incomplete' && !isCash && (
        <div className="bg-gradient-to-r from-amber-50 to-brand-50 border-t border-amber-200 p-3 sm:p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-amber-800">Payment wasn't completed</p>
              <p className="text-xs text-amber-700">Re-initiate PayChangu checkout or cancel your booking.</p>
            </div>
            <Shield className="w-5 h-5 text-amber-600 ml-auto" />
          </div>
        </div>
      )}

      {derivedStatus === 'reserved_cash' && (
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

export default function BookingsClient() {
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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, setCurrentPage]);

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
    const gatewayStatus = searchParams?.get('status');
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

    if (cancelled === 'true' || gatewayStatus === 'cancelled') {
      setError('Payment was cancelled. You can try again anytime.');
      setTimeout(() => setError(''), 6000);
    }

    if (pv === 'true' && provider) {
      if (txRef) {
        verifyPaymentStatus(provider, txRef, transactionId);
      }

      const clean = new URL(window.location.href);
      ['payment_verify', 'provider', 'tx_ref', 'transaction_id', 'status', 'cancelled', 'success', 'error']
        .forEach((k) => clean.searchParams.delete(k));
      window.history.replaceState({}, '', clean.toString());
    }

    fetchBookings();
    return;
  }, [user, router, searchParams, fetchBookings, verifyPaymentStatus]);

  if (loading) return <BookingsLoading />;

  const statCards = [
    { label: 'All Active', value: bookingStats.all, key: 'all', Icon: BusIcon },
    { label: 'Confirmed', value: bookingStats.confirmed, key: 'confirmed', Icon: CheckCircle },
    { label: 'Pending', value: bookingStats.pending, key: 'pending', Icon: Clock },
    { label: 'Upcoming', value: bookingStats.upcoming, key: 'upcoming', Icon: Calendar },
    { label: 'In Transit', value: (bookingStats as any).in_transit ?? 0, key: 'in_transit', Icon: Navigation },
    { label: 'Archived / Past', value: bookingStats.archived, key: 'archived', Icon: Archive },
    { label: 'Cancelled', value: bookingStats.cancelled, key: 'cancelled', Icon: XCircle },
  ];

  return (
      <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-brand-50 via-gray-50 to-gray-50">
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
                  className="flex-1 sm:flex-none flex justify-center items-center gap-2 px-5 py-2 bg-coral-500 text-white rounded-xl hover:bg-coral-600 transition-all shadow-md text-sm font-semibold whitespace-nowrap">
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
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-700/40 focus:border-brand-700 transition-all duration-200 text-gray-900 placeholder-gray-500"
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
              <button onClick={() => router.push('/schedules')} className="inline-flex items-center gap-2 px-6 py-3 bg-coral-500 text-white rounded-lg hover:bg-coral-600 transition-all hover:scale-105 shadow-lg">
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
                      onDownload={handleDownloadTicket} onPayment={handleProcessPayment} onReviewSubmitted={fetchBookings} actionLoading={actionLoading}
                      formatTime={formatTime} formatDate={formatDate}
                      router={router}
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
}
