'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

export type JourneyState = 'upcoming' | 'in_transit' | 'arrived' | 'completed' | 'past';

export interface JourneyInfo {
  state: JourneyState;
  /** 0-1 progress between departure and arrival */
  progress: number;
  /** Minutes remaining until arrival (negative if past) */
  minutesRemaining: number;
  /** Formatted countdown string like "2h 15m" */
  countdownText: string;
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
  submitReview: (rating: number, text: string) => Promise<boolean>;
}

interface UseJourneyTrackerArgs {
  bookingId: string;
  scheduleId: string;
  departureDateTime: Date;
  arrivalDateTime: Date;
  tripStatus?: string;
  bookingStatus: string;
  paymentStatus: string;
  reviewRating?: number | null;
}

/**
 * Resolves the journey state for a single booking based on current time
 * and trip metadata. Manages live coordinate reporting and countdown timers.
 */
export function useJourneyTracker({
  bookingId,
  scheduleId,
  departureDateTime,
  arrivalDateTime,
  tripStatus,
  bookingStatus,
  paymentStatus,
  reviewRating,
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
    // Allow cash bookings too
    const isCash = (paymentStatus as string) === 'pending'; // cash_on_boarding

    if (!isPaid && !isCash) return 'upcoming';

    const dep = departureDateTime instanceof Date ? departureDateTime : new Date(departureDateTime);
    const arr = arrivalDateTime instanceof Date ? arrivalDateTime : new Date(arrivalDateTime);

    if (tripStatus === 'completed') return 'completed';
    if (now < dep) return 'upcoming';
    if (now >= dep && now < arr && tripStatus !== 'completed') return 'in_transit';
    if (now >= arr || tripStatus === 'arrived') {
      // If review already submitted, show completed
      if (reviewRating) return 'completed';
      return 'arrived';
    }
    return 'past';
  }, [now, departureDateTime, arrivalDateTime, tripStatus, bookingStatus, paymentStatus, reviewRating]);

  // Calculate progress and countdown
  const { progress, minutesRemaining, countdownText } = useMemo(() => {
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
    let countdown = '';
    if (state === 'upcoming') {
      // Show time until departure
      const depRemainMs = dep.getTime() - now.getTime();
      const depRemainMin = Math.max(0, Math.ceil(depRemainMs / 60_000));
      const dh = Math.floor(depRemainMin / 60);
      const dm = depRemainMin % 60;
      countdown = dh > 0 ? `${dh}h ${dm}m to departure` : `${dm}m to departure`;
    } else if (state === 'in_transit') {
      countdown = hours > 0 ? `${hours}h ${mins}m to arrival` : `${mins}m to arrival`;
    } else if (state === 'arrived') {
      countdown = 'Arrived';
    } else {
      countdown = '';
    }

    return { progress: prog, minutesRemaining: remainMin, countdownText: countdown };
  }, [now, departureDateTime, arrivalDateTime, state]);

  // Location reporting when in transit and consent is given
  useEffect(() => {
    if (state !== 'in_transit' || !locationConsent) {
      // Cleanup any existing watchers
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

    // Start watching position
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setLivePosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      (err) => {
        // Log warning for permission errors or unavailable position, ignore harmless timeouts
        if (err.code !== err.TIMEOUT) {
          console.warn('Geolocation error:', err.message);
        }
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 30_000 }
    );

    // Report position to server every 60 seconds
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
        // Silent fail — position reporting is best-effort
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

  // Fetch live position from API when in transit (for other riders' data)
  useEffect(() => {
    if (state !== 'in_transit' || !scheduleId) return;

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
  const submitReview = useCallback(async (rating: number, text: string): Promise<boolean> => {
    setReviewSubmitting(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, reviewText: text }),
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
    locationConsent,
    livePosition,
    hasReview,
    reviewSubmitting,
    setLocationConsent,
    submitReview,
  };
}
