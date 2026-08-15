'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

export type JourneyState = 'upcoming' | 'in_transit' | 'delayed' | 'arrived' | 'completed' | 'past';

export interface StopWithStage {
  id: string;
  name: string;
  coords: [number, number] | null;
  stage: 'passed' | 'current' | 'upcoming';
}

export interface JourneyInfo {
  state: JourneyState;
  /** 0-1 progress between departure and arrival */
  progress: number;
  /** Minutes remaining until arrival (negative if past) */
  minutesRemaining: number;
  /** Formatted countdown string like "2h 15m" or "Delayed • Running Late" */
  countdownText: string;
  /** Completed at timestamp */
  completedAt: Date | null;
  /** Stop stages (passed, current, upcoming) */
  stopStages: StopWithStage[];
  /** Whether the user has opted in to share location */
  locationConsent: boolean;
  /** Live position from API (if available) */
  livePosition: { latitude: number; longitude: number } | null;
  /** Whether a review has been submitted */
  hasReview: boolean;
  /** Review submission state */
  reviewSubmitting: boolean;
  /** Toggle location consent */
  setLocationConsent: (v: boolean) => void;
  /** Submit a review */
  submitReview: (rating: number, text: string, leg?: 'outbound' | 'return') => Promise<boolean>;
}

interface UseJourneyTrackerArgs {
  bookingId: string;
  scheduleId: string;
  departureDateTime: Date;
  arrivalDateTime: Date;
  tripStatus?: string;
  bookingStatus: string;
  paymentStatus: string;
  paymentMethod?: string;
  reviewRating?: number | null;
  destinationCity?: string;
  destinationCoords?: [number, number];
  stops?: Array<{ id: string; name: string; coords?: [number, number] }>;
  currentStopIndex?: number;
}

const CITY_COORDS: Record<string, [number, number]> = {
  lilongwe: [-13.9626, 33.7741],
  blantyre: [-15.7861, 35.0058],
  mzuzu: [-11.4656, 34.0207],
  zomba: [-15.3854, 35.3188],
  kasungu: [-13.0344, 33.4845],
  salima: [-13.7804, 34.4587],
  mangochi: [-14.4784, 35.2645],
  karonga: [-9.9325, 33.9400],
  nkhotakota: [-12.9264, 34.2990],
  dedza: [-14.3789, 34.3334],
  ntcheu: [-14.8198, 34.6357],
  balaka: [-14.9789, 34.9559],
  machinga: [-15.1667, 35.3000],
  thyolo: [-16.0667, 35.1333],
  mulanje: [-15.9333, 35.5000],
  chiradzulu: [-15.6833, 35.1500],
  phalombe: [-15.8000, 35.6500],
  nsanje: [-16.9167, 35.2500],
  chikwawa: [-16.0333, 34.8000],
  neno: [-15.4000, 34.6500],
  mwanza: [-15.6000, 34.5167],
  dowa: [-13.6554, 33.9373],
  mchinji: [-13.7958, 32.8888],
  ntchisi: [-13.5283, 33.9178],
  nkhatabay: [-11.6000, 34.3000],
  rumphi: [-10.8500, 33.8500],
  chitipa: [-9.7000, 33.2667],
  likoma: [-12.0600, 34.7300],
};

function normalizeCityInput(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s*(route|to|→|-|–)\s*.*/i, '')
    .replace(/[^a-z\s]/g, '')
    .trim();
}

function resolveCoords(cityName: string | null | undefined): [number, number] | null {
  if (!cityName || typeof cityName !== 'string') return null;
  const cleaned = normalizeCityInput(cityName);
  if (!cleaned) return null;
  if (CITY_COORDS[cleaned]) return CITY_COORDS[cleaned];
  const rawLower = cityName.toLowerCase();
  for (const [k, v] of Object.entries(CITY_COORDS)) {
    const re = new RegExp(`\\b${k}\\b`);
    if (re.test(rawLower)) return v;
  }
  for (const [k, v] of Object.entries(CITY_COORDS)) {
    if (rawLower.includes(k)) return v;
  }
  return null;
}

function haversineM(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const φ1 = (a[0] * Math.PI) / 180;
  const φ2 = (b[0] * Math.PI) / 180;
  const Δφ = ((b[0] - a[0]) * Math.PI) / 180;
  const Δλ = ((b[1] - a[1]) * Math.PI) / 180;
  const s =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function isWithinMalawiBounds(lat: number, lng: number): boolean {
  return lat >= -17.5 && lat <= -9.0 && lng >= 32.5 && lng <= 36.0;
}

/**
 * Resolves the journey state for a single booking based on current time,
 * live GPS signals, and trip metadata.
 */
export function useJourneyTracker({
  bookingId,
  scheduleId,
  departureDateTime,
  arrivalDateTime,
  tripStatus,
  bookingStatus,
  paymentStatus,
  paymentMethod,
  reviewRating,
  destinationCity,
  destinationCoords,
  stops = [],
  currentStopIndex,
}: UseJourneyTrackerArgs): JourneyInfo {
  const [locationConsent, setLocationConsent] = useState(false);
  const [livePosition, setLivePosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [hasReview, setHasReview] = useState(!!reviewRating);
  const [now, setNow] = useState(() => new Date());
  const watchIdRef = useRef<number | null>(null);
  const reportIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Synchronize hasReview if reviewRating prop changes
  useEffect(() => {
    if (reviewRating) {
      setHasReview(true);
    }
  }, [reviewRating]);

  // Update clock every 30 seconds for countdown accuracy
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  // Resolve journey state
  const state = useMemo((): JourneyState => {
    if (bookingStatus === 'cancelled') return 'past';
    if (bookingStatus !== 'confirmed') return 'upcoming';

    const isPaid = paymentStatus === 'paid';
    const isCash = paymentMethod === 'cash' || paymentMethod === 'cash_on_boarding';

    if (!isPaid && !isCash) return 'upcoming';

    const dep = departureDateTime instanceof Date ? departureDateTime : new Date(departureDateTime);
    const arr = arrivalDateTime instanceof Date ? arrivalDateTime : new Date(arrivalDateTime);

    if (tripStatus === 'completed') return 'completed';
    if (now < dep) return 'upcoming';

    // Destination coordinates resolution
    const destCoords = destinationCoords || (destinationCity ? resolveCoords(destinationCity) : null);

    const isPositionUsable =
      livePosition &&
      typeof livePosition.latitude === 'number' &&
      typeof livePosition.longitude === 'number' &&
      Number.isFinite(livePosition.latitude) &&
      Number.isFinite(livePosition.longitude) &&
      isWithinMalawiBounds(livePosition.latitude, livePosition.longitude);

    let isNearDestination = false;
    if (isPositionUsable && destCoords) {
      const dist = haversineM([livePosition!.latitude, livePosition!.longitude], destCoords);
      if (dist <= 5000) { // 5km proximity threshold
        isNearDestination = true;
      }
    }

    // 1. Arrival signal (GPS proximity OR explicit database tripStatus === 'arrived')
    if (isNearDestination || tripStatus === 'arrived') {
      if (reviewRating) return 'completed';
      return 'arrived';
    }

    // 2. Usable live GPS signal exists, but bus is NOT near destination (>5km)
    if (isPositionUsable) {
      if (now.getTime() > arr.getTime() + 5 * 60 * 60 * 1000) {
        return 'completed';
      }
      if (now >= arr) {
        // Clock passed arrival time, but live GPS indicates bus is still en route -> DELAYED
        return 'delayed';
      }
      return 'in_transit';
    }

    // 3. No live GPS position available
    // Has 5 hours passed since arrival?
    if (now.getTime() > arr.getTime() + 5 * 60 * 60 * 1000) {
      return 'completed';
    }
    
    // Are we in the arrival window? (arr - 15m up to arr + 5h)
    if (now.getTime() >= arr.getTime() - 15 * 60 * 1000) {
      if (reviewRating) return 'completed';
      return 'arrived';
    }

    // (now < dep is already handled above)
    return 'in_transit';
  }, [now, departureDateTime, arrivalDateTime, tripStatus, bookingStatus, paymentStatus, paymentMethod, reviewRating, livePosition, destinationCity, destinationCoords]);

  // Calculate progress and countdown
  const { progress, minutesRemaining, countdownText, completedAt } = useMemo(() => {
    const dep = departureDateTime instanceof Date ? departureDateTime : new Date(departureDateTime);
    const arr = arrivalDateTime instanceof Date ? arrivalDateTime : new Date(arrivalDateTime);
    const totalMs = arr.getTime() - dep.getTime();
    const elapsedMs = now.getTime() - dep.getTime();

    let prog = 0;
    if (totalMs > 0) {
      prog = Math.max(0, Math.min(1, elapsedMs / totalMs));
    }

    const remainMs = arr.getTime() - now.getTime();
    const remainMin = Math.max(0, Math.ceil(remainMs / 60_000));
    const hours = Math.floor(remainMin / 60);
    const mins = remainMin % 60;
    const isValidDep = !isNaN(dep.getTime());
    const isValidArr = !isNaN(arr.getTime());

    let countdown = '';
    if (isValidDep && state === 'upcoming') {
      const depRemainMs = dep.getTime() - now.getTime();
      const depRemainMin = Math.max(0, Math.ceil(depRemainMs / 60_000));
      const dh = Math.floor(depRemainMin / 60);
      const dm = depRemainMin % 60;
      countdown = dh > 0 ? `${dh}h ${dm}m to departure` : `${dm}m to departure`;
    } else if (isValidArr && state === 'in_transit') {
      countdown = hours > 0 ? `${hours}h ${mins}m to arrival` : `${mins}m to arrival`;
    } else if (state === 'delayed') {
      countdown = 'Delayed • Running Late';
    } else if (isValidArr && (state === 'arrived' || state === 'completed')) {
      // Return arrival time formatted as HH:mm
      const hh = arr.getHours().toString().padStart(2, '0');
      const mm = arr.getMinutes().toString().padStart(2, '0');
      countdown = `Arrived at ${hh}:${mm}`;
    } else {
      countdown = '';
    }

    let completedAt: Date | null = null;
    if (state === 'completed' || state === 'arrived') {
      completedAt = arr; 
    }

    return { progress: prog, minutesRemaining: remainMin, countdownText: countdown, completedAt };
  }, [now, departureDateTime, arrivalDateTime, state]);

  // Derive stop stages
  const stopStages = useMemo((): StopWithStage[] => {
    if (!stops || stops.length === 0) return [];

    let currentIndex = 0;
    
    // If DB provides explicit stop index, use it
    if (typeof currentStopIndex === 'number' && currentStopIndex >= 0) {
      currentIndex = currentStopIndex;
    } else if (livePosition) {
      // Fallback: estimate from live GPS via proximity
      let nearestDist = Infinity;
      let nearestIdx = 0;
      
      stops.forEach((stop, idx) => {
        const c = stop.coords || resolveCoords(stop.name);
        if (c) {
          const dist = haversineM([livePosition.latitude, livePosition.longitude], c);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestIdx = idx;
          }
        }
      });
      
      // If we are somewhat close to a stop, consider it current, else whatever the nearest was.
      currentIndex = nearestIdx;
    }

    if (state === 'upcoming') {
      currentIndex = -1; // All upcoming
    } else if (state === 'completed' || state === 'past' || state === 'arrived') {
      currentIndex = stops.length; // All passed
    }

    return stops.map((stop, i) => {
      let stage: 'passed' | 'current' | 'upcoming' = 'upcoming';
      if (i < currentIndex) stage = 'passed';
      else if (i === currentIndex) stage = 'current';
      
      return {
        id: stop.id,
        name: stop.name,
        coords: stop.coords || resolveCoords(stop.name),
        stage
      };
    });
  }, [stops, currentStopIndex, livePosition, state]);

  // Location reporting when in transit or delayed and consent is given
  useEffect(() => {
    if ((state !== 'in_transit' && state !== 'delayed') || !locationConsent) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (reportIntervalRef.current) {
        clearInterval(reportIntervalRef.current);
        reportIntervalRef.current = null;
      }
      return;
    }

    if (!navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setLivePosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      (err) => {
        if (err.code !== err.TIMEOUT) {
          console.warn('Geolocation error:', err.message);
        }
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 30_000 }
    );

    reportIntervalRef.current = setInterval(async () => {
      if (!livePosition) return;
      try {
        await fetch(`/api/trips/${scheduleId}/position`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            latitude: livePosition.latitude,
            longitude: livePosition.longitude,
            source: 'rider',
          }),
        });
      } catch (err) {
        // Silent fail
      }
    }, 60_000);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (reportIntervalRef.current) {
        clearInterval(reportIntervalRef.current);
        reportIntervalRef.current = null;
      }
    };
  }, [state, locationConsent, scheduleId, livePosition]);

  // Fetch live position from API when in transit or delayed (keeps monitoring during delays!)
  useEffect(() => {
    if ((state !== 'in_transit' && state !== 'delayed') || !scheduleId) return;

    let cancelled = false;
    const fetchPosition = async () => {
      try {
        const res = await fetch(`/api/trips/${scheduleId}/position`);
        if (!res.ok) return;
        const text = await res.text();
        if (!text) return;
        const data = JSON.parse(text);
        if (!cancelled && data.available && data.position) {
          setLivePosition({
            latitude: data.position.latitude,
            longitude: data.position.longitude,
          });
        }
      } catch {
        // Silent fail
      }
    };

    fetchPosition();
    const interval = setInterval(fetchPosition, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [state, scheduleId]);

  // Review submission
  const submitReview = useCallback(async (rating: number, text: string, leg?: 'outbound' | 'return'): Promise<boolean> => {
    setReviewSubmitting(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, reviewText: text, leg }),
      });
      if (res.ok) {
        setHasReview(true);
        return true;
      }
      const data = await res.json().catch(() => ({}));
      const isAlreadyReviewed = data.error && typeof data.error === 'string' && data.error.includes('already reviewed');
      if (isAlreadyReviewed) {
        setHasReview(true);
        console.info('Booking has already been reviewed.');
      } else {
        console.error('Review submission failed:', data.error || res.statusText);
      }
      return false;
    } catch (err) {
      console.error('Review submission error:', err);
      return false;
    } finally {
      setReviewSubmitting(false);
    }
  }, [bookingId]);

  return {
    state,
    progress,
    minutesRemaining,
    countdownText,
    completedAt,
    stopStages,
    locationConsent,
    livePosition,
    hasReview,
    reviewSubmitting,
    setLocationConsent,
    submitReview,
  };
}

