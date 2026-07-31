'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Bus, Navigation } from 'lucide-react';
import type { LatLngTuple } from 'leaflet';

// ─────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────
export interface StopLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  passengerCount?: number;
  isCompleted?: boolean;
}

export interface BusPosition {
  lat: number;
  lng: number;
  heading?: number; // 0 - 360 degrees
  speedKmh?: number;
  lastUpdated?: string;
}

export interface LiveBusMapProps {
  busPosition: BusPosition;
  routePath: [number, number][]; // Array of [lat, lng]
  stops: StopLocation[];
  nextStopName?: string;
  etaMinutes?: number;
  busRegistration?: string;
  className?: string;
}

// ─────────────────────────────────────────────
// Smooth Lerp / Interpolation Hook
// Glides marker smoothly between GPS pings
// ─────────────────────────────────────────────
function useInterpolatedPosition(
  targetLat: number,
  targetLng: number,
  targetHeading = 0,
  durationMs = 1200
) {
  const [currentPos, setCurrentPos] = useState<[number, number]>([targetLat, targetLng]);
  const [currentHeading, setCurrentHeading] = useState(targetHeading);

  const prevPosRef = useRef<[number, number]>([targetLat, targetLng]);
  const prevHeadingRef = useRef(targetHeading);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const startPos = prevPosRef.current;
    const startHeading = prevHeadingRef.current;
    const startTime = performance.now();

    // Shortest path angle interpolation (-180 to 180)
    let headingDiff = (targetHeading - startHeading) % 360;
    if (headingDiff > 180) headingDiff -= 360;
    if (headingDiff < -180) headingDiff += 360;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);

      // Smooth ease-out curve for natural vehicle acceleration
      const ease = 1 - Math.pow(1 - progress, 3);

      const nextLat = startPos[0] + (targetLat - startPos[0]) * ease;
      const nextLng = startPos[1] + (targetLng - startPos[1]) * ease;
      const nextHeading = startHeading + headingDiff * ease;

      setCurrentPos([nextLat, nextLng]);
      setCurrentHeading(nextHeading);

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        prevPosRef.current = [targetLat, targetLng];
        prevHeadingRef.current = targetHeading;
      }
    };

    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [targetLat, targetLng, targetHeading, durationMs]);

  return { position: currentPos, heading: currentHeading };
}

// Dynamically import the real Leaflet inner component client-side (no SSR)
const LeafletInnerMap = dynamic(() => import('./LeafletInnerMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-slate-100 flex flex-col items-center justify-center gap-3 animate-pulse">
      <Bus className="w-8 h-8 text-brand-700 animate-bounce" />
      <span className="text-sm font-medium text-slate-500 font-sans">Loading Live Map…</span>
    </div>
  ),
});

// ─────────────────────────────────────────────
// Public Wrapper Component
// ─────────────────────────────────────────────
export default function LiveBusMap(props: LiveBusMapProps) {
  const { className = 'h-[500px] w-full rounded-2xl shadow-lg border border-slate-200 overflow-hidden relative' } = props;

  return (
    <div className={className}>
      <LeafletInnerMap {...props} />
    </div>
  );
}
export { useInterpolatedPosition };
