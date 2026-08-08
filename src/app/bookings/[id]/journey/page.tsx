'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import BackButton from '@/components/BackButton';
import JourneyMap from '@/app/bookings/JourneyMap';
import { useJourneyTracker } from '@/app/bookings/useJourneyTracker';
import { BookingWithDetails, resolveStopName } from '@/app/bookings/useBookingsList';
import { deriveBookingStatus, getDisplayStatusUI } from '@/lib/booking-utils';
import { RouteStopsDisplay } from '@/components/RouteStopsDisplay';
import {
  Navigation, MapPin, Clock, Bus as BusIcon, Shield,
  AlertCircle, Loader2, ArrowLeft, RefreshCw, Armchair, Zap, User, Calendar, CheckCircle2, Circle
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

        const isCash = (raw as any).paymentMethod === 'cash_on_boarding';
        const hasSecuredSeat = raw.bookingStatus === 'confirmed' &&
          (raw.paymentStatus === 'paid' || isCash);

        if (!hasSecuredSeat) {
          setError('Live tracking is restricted to confirmed and paid bookings or cash-on-boarding reservations.');
          setLoading(false);
          return;
        }

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

  const mapRef = useRef<any>(null);
  const [followBus, setFollowBus] = useState(true);

  const originName = resolveStopName(booking?.originStopId, booking?.originStopName, booking?.route, booking?.route?.origin || 'Origin');
  const destinationName = resolveStopName(booking?.destinationStopId, booking?.destinationStopName, booking?.route, booking?.route?.destination || 'Destination');
  const intermediateStops = (booking?.route?.stops as any[]) || [];

  const allStops = useMemo(() => {
    if (!booking) return [];
    return [
      { id: booking.originStopId || 'origin', name: originName },
      ...intermediateStops,
      { id: booking.destinationStopId || 'dest', name: destinationName },
    ];
  }, [booking, originName, destinationName, intermediateStops]);

  const journey = useJourneyTracker({
    bookingId: booking?.id || '',
    scheduleId: activeSegment ? activeSegment.scheduleId : booking?.scheduleId || '',
    departureDateTime: activeSegment ? activeSegment.schedule.departureDateTime : booking?.schedule.departureDateTime || new Date(),
    arrivalDateTime: activeSegment ? activeSegment.schedule.arrivalDateTime : booking?.schedule.arrivalDateTime || new Date(),
    tripStatus: activeSegment ? activeSegment.schedule.tripStatus : booking?.schedule.tripStatus,
    bookingStatus: booking?.bookingStatus || 'pending',
    paymentStatus: booking?.paymentStatus || 'pending',
    paymentMethod: (booking as any)?.paymentMethod || booking?.paymentProvider,
    reviewRating: activeSegment
      ? ((booking as any)?.metadata?.returnReview?.rating ?? null)
      : ((booking as any)?.metadata?.outboundReview?.rating ?? (booking as any)?.reviewRating ?? null),
    destinationCity: activeSegment ? (activeSegment.route?.destination || '') : (booking?.route?.destination || ''),
    stops: allStops,
    currentStopIndex: activeSegment ? activeSegment.schedule.currentStopIndex : booking?.schedule.currentStopIndex,
  });

  // ─── Reverse geocoding: "Currently near" label ───────────────────────────
  // nearbyName: null = not yet resolved, string = resolved area name
  const [nearbyName, setNearbyName] = useState<string | null>(null);
  // lastGeoKey tracks the last rounded-coordinate key we fetched, so we only
  // call /api/geocode when the bus has moved >5.5 km (0.05° grid cell change).
  // This is a useRef equality gate — NOT a setTimeout debounce.
  const lastGeoKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const pos = journey.livePosition;
    if (!pos) return;

    // Round to 0.05° grid (≈5.5 km) — same rounding the server applies
    const STEP = 0.05;
    const rlat = Math.round(pos.latitude / STEP) * STEP;
    const rlng = Math.round(pos.longitude / STEP) * STEP;
    const key = `${rlat.toFixed(2)}|${rlng.toFixed(2)}`;

    // Gate: skip fetch if position hasn't moved to a new grid cell
    if (key === lastGeoKeyRef.current) return;
    lastGeoKeyRef.current = key;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/geocode?lat=${pos.latitude.toFixed(5)}&lng=${pos.longitude.toFixed(5)}`
        );
        if (cancelled || !res.ok) return;
        const data = await res.json() as { name: string; source: string };
        if (!cancelled && data.name) setNearbyName(data.name);
      } catch {
        // Silent fail — nearbyName stays at its last known value
      }
    })();
    return () => { cancelled = true; };
  }, [journey.livePosition?.latitude, journey.livePosition?.longitude]);

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

  const currentStop = journey.stopStages.find(s => s.stage === 'current');
  const upcomingStops = journey.stopStages.filter(s => s.stage === 'upcoming');
  let nextStopName = upcomingStops.length > 0 ? upcomingStops[0].name : destinationName;
  if (journey.state === 'completed') nextStopName = destinationName;

  const derivedStatus = deriveBookingStatus({
    bookingStatus: booking.bookingStatus,
    paymentStatus: booking.paymentStatus,
    paymentMethod: (booking as any).paymentMethod || booking.paymentProvider,
    tripStatus: activeSegment ? activeSegment.schedule.tripStatus : booking.schedule.tripStatus,
    departureTime: activeSegment ? activeSegment.schedule.departureDateTime : booking.schedule.departureDateTime,
    arrivalTime: activeSegment ? activeSegment.schedule.arrivalDateTime : booking.schedule.arrivalDateTime
  });
  const statusUI = getDisplayStatusUI(derivedStatus);

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
        {/* Main Content Area (2/3 width on large screens) */}
        <div className="lg:col-span-2 flex flex-col gap-4 h-[60vh] lg:h-[calc(100vh-140px)]">
          {/* Full Viewport Map */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex-1 relative">
            <JourneyMap
              origin={activeSegment ? (activeSegment.route?.origin || '') : (booking.route?.origin || '')}
              destination={activeSegment ? (activeSegment.route?.destination || '') : (booking.route?.destination || '')}
              progress={journey.progress}
              livePosition={journey.livePosition}
              className="w-full h-full relative"
              followBus={followBus}
              onFollowChange={setFollowBus}
              stopStages={journey.stopStages}
              onMapReady={(map) => { mapRef.current = map; }}
            />
          </div>

          {/* Stops Horizontal List */}
          {journey.stopStages.length > 0 && (
            <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm overflow-x-auto hide-scrollbar shrink-0">
              <RouteStopsDisplay 
                stops={journey.stopStages} 
                onStopClick={(stop) => {
                  if (stop.coords && mapRef.current) {
                    mapRef.current.panTo(stop.coords, { animate: true });
                    setFollowBus(false);
                  }
                }}
              />
            </div>
          )}
        </div>

        {/* Journey Details Sidebar (1/3 width) */}
        <div className="space-y-4">
          {/* Status & Countdown Card */}
          <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Live Journey Status</span>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusUI.colorClass} ${statusUI.isPulsing ? 'animate-pulse' : ''}`}>
                {statusUI.label}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500">Estimated Arrival / ETA</p>
                <p className={`text-xl font-bold mt-0.5 ${journey.state === 'delayed' ? 'text-amber-600' : 'text-brand-700'}`}>
                  {journey.countdownText}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-gray-50 p-3 rounded-xl">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    {journey.state === 'completed' || journey.state === 'arrived' ? 'Destination' : 'Currently At'}
                  </p>
                  <p className="text-sm font-semibold text-gray-900 truncate mt-0.5">
                    {journey.state === 'completed' || journey.state === 'arrived'
                      ? destinationName
                      : (currentStop?.name ?? originName)}
                  </p>
                  {/* Geocoded area name as soft subtitle when live GPS is active */}
                  {nearbyName && currentStop && nearbyName !== currentStop.name && journey.state !== 'completed' && (
                    <p className="text-[10px] text-gray-400 mt-0.5 truncate">near {nearbyName}</p>
                  )}
                </div>
                <div className="bg-gray-50 p-3 rounded-xl">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    {journey.state === 'completed' || journey.state === 'arrived' ? 'Trip Finished' : 'Next Stop'}
                  </p>
                  <p className="text-sm font-semibold text-gray-900 truncate mt-0.5">
                    {journey.state === 'completed' || journey.state === 'arrived' ? destinationName : nextStopName}
                  </p>
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
