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

  // Calculate live progress and countdown string
  const { progressPct, countdownText } = useMemo(() => {
    if (!activeJourney) return { progressPct: 0, countdownText: '' };

    const dep = new Date(activeJourney.departureDateTime);
    const arr = new Date(activeJourney.arrivalDateTime);
    const totalMs = arr.getTime() - dep.getTime();
    const elapsedMs = now.getTime() - dep.getTime();

    let pct = 0;
    if (totalMs > 0) {
      pct = Math.max(0, Math.min(100, (elapsedMs / totalMs) * 100));
    }

    const remainMs = arr.getTime() - now.getTime();
    const remainMin = Math.max(0, Math.ceil(remainMs / 60_000));
    const hours = Math.floor(remainMin / 60);
    const mins = remainMin % 60;

    let countdown = '';
    if (remainMin <= 0) {
      countdown = 'Arriving soon';
    } else if (hours > 0) {
      countdown = `${hours}h ${mins}m to arrival`;
    } else {
      countdown = `${mins}m to arrival`;
    }

    return { progressPct: pct, countdownText: countdown };
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
    <section className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 my-4 z-20">
      <div
        onClick={handleCardClick}
        className="bg-white/95 glass rounded-[2rem] shadow-premium px-5 py-4 sm:px-8 sm:py-5 border border-white/60 backdrop-blur-md hover:shadow-2xl transition-all duration-300 cursor-pointer relative group overflow-hidden"
        role="button"
        tabIndex={0}
        aria-label={`In transit trip from ${activeJourney.origin} to ${activeJourney.destination}. Click to view journey.`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleCardClick();
        }}
      >
        {/* Subtle glowing accent background blob */}
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-brand-400/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Row: Badge + Operator Logo + Dismiss X */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-3 py-0.5 rounded-full text-xs font-extrabold tracking-wider uppercase">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span>In Transit</span>
            </div>
            {countdownText && (
              <span className="text-xs font-semibold text-emerald-700 hidden sm:inline-block">
                • {countdownText}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 pr-8">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-full px-3 py-0.5">
              {activeJourney.companyLogo ? (
                <Image
                  src={activeJourney.companyLogo}
                  alt={activeJourney.companyName}
                  width={18}
                  height={18}
                  className="w-4 h-4 rounded-full object-contain bg-white"
                />
              ) : (
                <div className="w-4 h-4 rounded-full bg-brand-700 text-white flex items-center justify-center font-bold text-[8px]">
                  {activeJourney.companyName.charAt(0)}
                </div>
              )}
              <span className="text-xs font-semibold text-gray-800">
                {activeJourney.companyName}
              </span>
            </div>
          </div>

          {/* Dismiss Button */}
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors z-10"
            aria-label="Dismiss in-transit journey notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Middle Row: Route Timeline & Bus Marker */}
        <div className="grid grid-cols-12 items-center gap-2 sm:gap-6 my-2">
          {/* Departure */}
          <div className="col-span-3 text-left">
            <div className="text-base sm:text-xl font-display font-extrabold text-gray-900 leading-tight">
              {activeJourney.departureTime}
            </div>
            <div className="text-xs text-gray-500 font-semibold mt-0.5 truncate">
              {activeJourney.origin}
            </div>
          </div>

          {/* Progress Line */}
          <div className="col-span-6 px-1 sm:px-3">
            <div className="relative py-2">
              <div className="h-2 bg-gray-100 rounded-full w-full relative overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand-600 via-teal-500 to-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              {/* Bus Marker */}
              <div
                className="absolute top-1/2 -translate-y-1/2 transition-all duration-500"
                style={{ left: `${Math.min(96, Math.max(4, progressPct))}%`, transform: 'translate(-50%, -50%)' }}
              >
                <div className="w-7 h-7 rounded-full bg-brand-700 text-white flex items-center justify-center shadow-md ring-2 ring-white">
                  <BusIcon className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          </div>

          {/* Arrival */}
          <div className="col-span-3 text-right">
            <div className="text-base sm:text-xl font-display font-extrabold text-gray-900 leading-tight">
              {activeJourney.arrivalTime}
            </div>
            <div className="text-xs text-gray-500 font-semibold mt-0.5 truncate">
              {activeJourney.destination}
            </div>
          </div>
        </div>

        {/* Bottom Footer Row */}
        <div className="flex items-center justify-between border-t border-gray-100/80 pt-2.5 mt-2.5">
          <div className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5 sm:hidden">
            <span>{countdownText}</span>
          </div>
          <div className="hidden sm:block text-xs text-gray-400 font-medium">
            Live active journey
          </div>

          <div className="text-xs font-bold text-brand-700 group-hover:text-brand-800 flex items-center gap-1 transition-all group-hover:translate-x-1 ml-auto">
            <span>View journey</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </section>
  );
}
