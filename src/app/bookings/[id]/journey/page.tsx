'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import BackButton from '@/components/BackButton';
import JourneyMap from '@/app/bookings/JourneyMap';
import { useJourneyTracker } from '@/app/bookings/useJourneyTracker';
import { BookingWithDetails, resolveStopName } from '@/app/bookings/useBookingsList';
import {
  Navigation, MapPin, Clock, Bus as BusIcon, Shield,
  AlertCircle, Loader2, ArrowLeft, RefreshCw, Armchair, Zap, User, Calendar
} from 'lucide-react';

export default function DedicatedJourneyPage() {
  const router = useRouter();
  const params = useParams();
  const bookingId = params?.id as string;
  const { user } = useAuth();

  const [booking, setBooking] = useState<BookingWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBooking = async () => {
    if (!bookingId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}`);
      if (res.status === 401 || res.status === 403) {
        setError('Access denied. You can only view tracking for your own bookings.');
        setLoading(false);
        return;
      }
      if (res.status === 404) {
        setError('Booking not found.');
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError('Failed to load journey details.');
        setLoading(false);
        return;
      }
      const payload = await res.json();
      const raw = payload.data || payload;
      if (raw) {
        const routeObj = raw.route || raw.schedule?.route;
        const busObj = raw.bus || raw.schedule?.bus;
        const companyObj = raw.company || raw.schedule?.company;

        setBooking({
          ...raw,
          route: routeObj,
          bus: busObj,
          company: companyObj,
        });
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred loading the trip.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooking();
  }, [bookingId]);

  // Automatically enable location tracking when user enters the dedicated full-page journey view
  useEffect(() => {
    if (booking && !journey.locationConsent) {
      journey.setLocationConsent(true);
    }
  }, [booking]);

  const outboundCompleted = useMemo(() => {
    if (!booking) return false;
    return (
      booking.schedule.tripStatus === 'completed' ||
      (booking.schedule.tripStatus !== 'in_transit' && new Date() >= new Date(booking.schedule.arrivalDateTime))
    );
  }, [booking]);

  const activeSegment = useMemo(() => {
    if (!booking) return null;
    return outboundCompleted && booking.returnSegment ? booking.returnSegment : null;
  }, [booking, outboundCompleted]);

  const journey = useJourneyTracker({
    bookingId: booking?.id || '',
    scheduleId: activeSegment ? activeSegment.scheduleId : booking?.scheduleId || '',
    departureDateTime: activeSegment ? activeSegment.schedule.departureDateTime : booking?.schedule.departureDateTime || new Date(),
    arrivalDateTime: activeSegment ? activeSegment.schedule.arrivalDateTime : booking?.schedule.arrivalDateTime || new Date(),
    tripStatus: activeSegment ? activeSegment.schedule.tripStatus : booking?.schedule.tripStatus,
    bookingStatus: booking?.bookingStatus || 'pending',
    paymentStatus: booking?.paymentStatus || 'pending',
    reviewRating: (booking as any)?.reviewRating,
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600 mx-auto" />
          <p className="text-sm font-medium text-gray-600">Loading Live Journey View...</p>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-sm border border-gray-200 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Unable to View Journey</h2>
          <p className="text-sm text-gray-600">{error || 'Booking not found.'}</p>
          <button
            onClick={() => router.push('/bookings')}
            className="w-full py-2.5 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to My Bookings
          </button>
        </div>
      </div>
    );
  }

  const originName = resolveStopName(booking.originStopId, booking.originStopName, booking.route, booking.route?.origin || 'Origin');
  const destinationName = resolveStopName(booking.destinationStopId, booking.destinationStopName, booking.route, booking.route?.destination || 'Destination');

  // Derive intermediate stop details if available on route model
  const intermediateStops = (booking.route?.stops as any[]) || [];
  const nextStopName = intermediateStops.length > 0 ? intermediateStops[0]?.name : destinationName;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Navigation Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/bookings')}
              className="p-2 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors"
              title="Back to Bookings"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                <span>{originName}</span>
                <span className="text-gray-400">→</span>
                <span>{destinationName}</span>
              </h1>
              <p className="text-xs text-gray-500">Ref: {booking.bookingReference || booking.id.slice(-8)} · {booking.company?.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl">
              <Navigation className="w-4 h-4 text-brand-600" />
              <span className="text-xs font-semibold text-gray-700 hidden sm:inline">Location Sharing</span>
              <button
                onClick={() => journey.setLocationConsent(!journey.locationConsent)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${journey.locationConsent ? 'bg-brand-600' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${journey.locationConsent ? 'translate-x-4' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Expanded View */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Full Viewport Map (2/3 width on large screens) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[60vh] lg:h-[calc(100vh-140px)] relative">
          <JourneyMap
            origin={activeSegment ? (activeSegment.route?.origin || '') : (booking.route?.origin || '')}
            destination={activeSegment ? (activeSegment.route?.destination || '') : (booking.route?.destination || '')}
            progress={journey.progress}
            livePosition={journey.livePosition}
            className="w-full h-full relative"
          />
        </div>

        {/* Journey Details Sidebar (1/3 width) */}
        <div className="space-y-4">
          {/* Status & Countdown Card */}
          <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Live Journey Status</span>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${journey.state === 'in_transit' ? 'bg-brand-50 text-brand-700 border-brand-200 animate-pulse' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                {journey.state === 'in_transit' ? 'In Transit' : 'Completed'}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500">Estimated Arrival / ETA</p>
                <p className="text-xl font-bold text-brand-700 mt-0.5">
                  {journey.countdownText || 'En route'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-gray-50 p-3 rounded-xl">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Current Point</p>
                  <p className="text-sm font-semibold text-gray-900 truncate mt-0.5">{originName}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Next Stop</p>
                  <p className="text-sm font-semibold text-gray-900 truncate mt-0.5">{nextStopName}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Bus & Passenger Metadata Card */}
          <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 pb-2">Trip & Bus Information</h3>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 flex items-center gap-2"><BusIcon className="w-4 h-4 text-brand-600" /> Carrier</span>
              <span className="font-semibold text-gray-900">{booking.company?.name}</span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 flex items-center gap-2"><Armchair className="w-4 h-4 text-brand-600" /> Assigned Seats</span>
              <span className="font-semibold text-gray-900">
                {Array.isArray(booking.seatNumbers) && booking.seatNumbers.length > 0 ? booking.seatNumbers.join(', ') : 'Unassigned'}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 flex items-center gap-2"><Clock className="w-4 h-4 text-brand-600" /> Departure Time</span>
              <span className="font-semibold text-gray-900">
                {new Date(booking.schedule.departureDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 flex items-center gap-2"><Calendar className="w-4 h-4 text-brand-600" /> Date</span>
              <span className="font-semibold text-gray-900">
                {new Date(booking.schedule.departureDateTime).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
