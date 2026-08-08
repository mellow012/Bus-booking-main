'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Bus as BusIcon, ArrowRight, X } from 'lucide-react';
import Image from 'next/image';

interface ActiveJourneyData {
  bookingId: string;
  scheduleId: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  departureDateTime: string;
  arrivalDateTime: string;
  companyName: string;
  companyLogo: string | null;
  tripStatus: string;
  bookingStatus: string;
  paymentStatus: string;
  isReturnSegment?: boolean;
}

const STORAGE_PREFIX = 'dismissed-journey-card:';

export default function ActiveJourneyCard() {
  const router = useRouter();
  const { user } = useAuth();

  const [activeJourney, setActiveJourney] = useState<ActiveJourneyData | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());

  // Periodically update clock every 30s for smooth countdown/progress updates
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const fetchActiveJourney = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/bookings/active-journey');
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      const journey: ActiveJourneyData | null = data.activeJourney;

      if (journey) {
        // Housekeeping: clean up stale localStorage dismissal keys for completed/past trips
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(STORAGE_PREFIX)) {
              const storedBookingId = key.replace(STORAGE_PREFIX, '');
              if (storedBookingId !== journey.bookingId) {
                localStorage.removeItem(key);
              }
            }
          }
        } catch {
          // Ignore storage errors
        }

        const isLocallyDismissed = localStorage.getItem(`${STORAGE_PREFIX}${journey.bookingId}`) === 'true';
        if (isLocallyDismissed) {
          setIsDismissed(true);
        } else {
          setActiveJourney(journey);
        }
      } else {
        try {
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(STORAGE_PREFIX)) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(k => localStorage.removeItem(k));
        } catch {
          // Ignore storage errors
        }
      }
    } catch {
      // Ignore network errors on home page load
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchActiveJourney();
  }, [fetchActiveJourney]);

  // Calculate live progress & status state
  const { progressPct, displayState } = useMemo(() => {
    if (!activeJourney) return { progressPct: 0, displayState: 'in_transit' as const };

    const dep = new Date(activeJourney.departureDateTime);
    const arr = new Date(activeJourney.arrivalDateTime);
    const totalMs = arr.getTime() - dep.getTime();
    const elapsedMs = now.getTime() - dep.getTime();

    let state: 'upcoming' | 'in_transit' | 'arrived' = 'in_transit';
    if (now < dep && activeJourney.tripStatus !== 'completed') {
      state = 'upcoming';
    } else if (now >= arr || activeJourney.tripStatus === 'completed') {
      state = 'arrived';
    } else {
      state = 'in_transit';
    }

    let pct = 0;
    if (state === 'upcoming') {
      pct = 0;
    } else if (state === 'arrived') {
      pct = 100;
    } else if (totalMs > 0) {
      pct = Math.max(0, Math.min(100, (elapsedMs / totalMs) * 100));
    }

    return { progressPct: pct, displayState: state };
  }, [activeJourney, now]);

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeJourney) return;
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${activeJourney.bookingId}`, 'true');
    } catch {
      // Ignore storage errors
    }
    setIsDismissed(true);
  };

  const handleCardClick = () => {
    if (!activeJourney) return;
    router.push(`/bookings/${activeJourney.bookingId}/journey`);
  };

  // Render nothing if loading, not logged in, no active trip, or dismissed
  if (loading || !user || !activeJourney || isDismissed) {
    return null;
  }

  return (
    <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 mb-8 z-20">
      <div
        onClick={handleCardClick}
        className="bg-white rounded-2xl border border-gray-200/80 shadow-sm hover:shadow-md px-4 py-3 sm:px-6 sm:py-3.5 transition-all duration-300 cursor-pointer group flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-6 relative overflow-hidden"
        role="button"
        tabIndex={0}
        aria-label={`Live journey from ${activeJourney.origin} to ${activeJourney.destination}. View details.`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleCardClick();
        }}
      >

        {/* Left: Status Badge & Origin */}
        <div className="flex flex-row-reverse sm:flex-row items-center gap-3 shrink-0 w-full sm:w-auto justify-between sm:justify-start">
          {displayState === 'upcoming' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200/60 text-[11px] font-bold uppercase tracking-wider">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              <span>Upcoming</span>
            </div>
          )}

          {displayState === 'in_transit' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[11px] font-bold uppercase tracking-wider">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>In Transit</span>
            </div>
          )}

          {displayState === 'arrived' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200/60 text-[11px] font-bold uppercase tracking-wider">
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500" />
              <span>Arrived</span>
            </div>
          )}

          <div className="flex items-baseline gap-1.5 text-xs sm:text-sm">
            <span className="font-bold text-gray-900 truncate max-w-[120px] sm:max-w-none">{activeJourney.origin}</span>
            <span className="text-[11px] font-medium text-gray-500">{activeJourney.departureTime}</span>
          </div>
        </div>

        {/* Center: Live Animated Transit Line */}
        <div className="flex-1 w-full sm:w-auto px-2 sm:px-4">
          <div className="relative py-1">
            <div className="h-1 bg-gray-100 rounded-full w-full relative overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-brand-600 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* Bus Marker matching JourneyMap styling */}
            <div
              className="absolute top-1/2 -translate-y-1/2 transition-all duration-500"
              style={{ left: `${Math.min(96, Math.max(4, progressPct))}%`, transform: 'translate(-50%, -50%)' }}
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-700 to-teal-600 text-white flex items-center justify-center shadow-md ring-2 ring-white text-xs leading-none select-none">
                🚌
              </div>
            </div>
          </div>
        </div>

        {/* Right: Destination, View Button, and Dismiss X */}
        <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-gray-100 pt-2 sm:pt-0">
          <div className="flex items-baseline gap-1.5 text-xs sm:text-sm">
            <span className="font-bold text-gray-900 truncate max-w-[120px] sm:max-w-none">{activeJourney.destination}</span>
            <span className="text-[11px] font-medium text-gray-500">{activeJourney.arrivalTime}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCardClick}
              className="px-4 py-1.5 bg-coral-500 hover:bg-coral-600 text-white rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-95"
            >
              View
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors shrink-0"
              aria-label="Dismiss journey notification"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
