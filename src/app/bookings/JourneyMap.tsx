'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Maximize2, Minimize2 } from 'lucide-react';

// Fix Leaflet's default icon path issue in Next.js/webpack bundling
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom bus marker icon (teal circle with bus emoji)
const busIcon = L.divIcon({
  html: `<div style="
    width: 32px; height: 32px;
    background: linear-gradient(135deg, #005A5B, #008080);
    border-radius: 50%;
    border: 3px solid #fff;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    display: flex; align-items: center; justify-content: center;
    font-size: 16px;
  ">🚌</div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

// Malawian city coordinate database
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

const MALAWI_BOUNDS = {
  latMin: -17.5,
  latMax: -9.0,
  lngMin: 32.5,
  lngMax: 36.0,
};

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function isValidLatLng(lat: unknown, lng: unknown): lat is number {
  return (
    isFiniteNumber(lat) &&
    isFiniteNumber(lng) &&
    (lat as number) >= -90 &&
    (lat as number) <= 90 &&
    (lng as number) >= -180 &&
    (lng as number) <= 180
  );
}

function isWithinMalawiBounds(lat: number, lng: number): boolean {
  return (
    lat >= MALAWI_BOUNDS.latMin &&
    lat <= MALAWI_BOUNDS.latMax &&
    lng >= MALAWI_BOUNDS.lngMin &&
    lng <= MALAWI_BOUNDS.lngMax
  );
}

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

export interface JourneyMapProps {
  origin: string;
  destination: string;
  progress: number;
  livePosition?: { latitude: number; longitude: number } | null;
  livePositionAgeMs?: number | null;
  isActive?: boolean;
  className?: string;
  onClick?: () => void;
}

const STALE_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes

const JourneyMap: React.FC<JourneyMapProps> = ({
  origin,
  destination,
  progress,
  livePosition,
  livePositionAgeMs = null,
  isActive = true,
  className = "w-full h-48 rounded-xl overflow-hidden border border-gray-200 shadow-inner relative",
  onClick,
}) => {
  const [mounted, setMounted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const originCoords = useMemo(() => resolveCoords(origin), [origin]);
  const destCoords = useMemo(() => resolveCoords(destination), [destination]);

  const safeProgress = isFiniteNumber(progress)
    ? Math.min(Math.max(progress, 0), 1)
    : null;

  const isLivePositionUsable = useMemo(() => {
    if (!livePosition) return false;
    const { latitude, longitude } = livePosition;
    if (!isValidLatLng(latitude, longitude)) return false;
    if (!isWithinMalawiBounds(latitude, longitude)) return false;
    if (isFiniteNumber(livePositionAgeMs) && (livePositionAgeMs as number) > STALE_THRESHOLD_MS) {
      return false;
    }
    return true;
  }, [livePosition, livePositionAgeMs]);

  let busPosition: [number, number] | null = null;
  if (isLivePositionUsable && livePosition) {
    busPosition = [livePosition.latitude, livePosition.longitude];
  } else if (safeProgress !== null && safeProgress > 0 && safeProgress < 1 && originCoords && destCoords) {
    const lat = originCoords[0] + (destCoords[0] - originCoords[0]) * safeProgress;
    const lng = originCoords[1] + (destCoords[1] - originCoords[1]) * safeProgress;
    if (isValidLatLng(lat, lng)) {
      busPosition = [lat, lng];
    }
  }

  const showBusMarker = isActive && busPosition !== null;

  const mapRef = useRef<L.Map | null>(null);
  const busMarkerRef = useRef<L.Marker | null>(null);

  // Effect 1: Initialize map instance, static layers, and fit initial route bounds ONCE per route
  useEffect(() => {
    if (!mounted || !containerRef.current || !originCoords || !destCoords) return;

    const el = containerRef.current;

    // Clear any residual Leaflet state on the DOM element
    if ((el as any)._leaflet_id) {
      (el as any)._leaflet_id = null;
    }

    const map = L.map(el, {
      center: originCoords,
      zoom: 8,
      scrollWheelZoom: false,
      dragging: true,
      zoomControl: false,
      attributionControl: false,
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    L.polyline([originCoords, destCoords], {
      color: '#005A5B',
      weight: 3,
      opacity: 0.7,
      dashArray: '8, 6',
    }).addTo(map);

    L.marker(originCoords).addTo(map);
    L.marker(destCoords).addTo(map);

    try {
      const bounds = L.latLngBounds(originCoords, destCoords);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    } catch {
      // Ignore fitBounds errors on degenerate coordinates
    }

    return () => {
      if (busMarkerRef.current) {
        busMarkerRef.current.remove();
        busMarkerRef.current = null;
      }
      map.remove();
      mapRef.current = null;
      if ((el as any)._leaflet_id) {
        (el as any)._leaflet_id = null;
      }
    };
  }, [mounted, origin, destination]);

  // Effect 2: Dynamically update or add/remove ONLY the bus marker when position changes without recreating the map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (showBusMarker && busPosition) {
      if (busMarkerRef.current) {
        busMarkerRef.current.setLatLng(busPosition);
      } else {
        busMarkerRef.current = L.marker(busPosition, { icon: busIcon }).addTo(map);
      }
    } else if (busMarkerRef.current) {
      busMarkerRef.current.remove();
      busMarkerRef.current = null;
    }
  }, [showBusMarker, busPosition?.[0], busPosition?.[1]]);

  if (!mounted) {
    return (
      <div className="w-full h-48 bg-gray-100 rounded-xl flex items-center justify-center text-sm text-gray-500">
        <div className="text-center">
          <div className="text-2xl mb-1">🗺️</div>
          <p>Map loading...</p>
        </div>
      </div>
    );
  }

  if (!originCoords || !destCoords) {
    return (
      <div className="w-full h-48 bg-gray-100 rounded-xl flex items-center justify-center text-sm text-gray-500">
        <div className="text-center">
          <div className="text-2xl mb-1">📍</div>
          <p>Map unavailable for this route</p>
          <p className="text-xs text-gray-400 mt-1">
            {origin || 'Unknown'} → {destination || 'Unknown'}
          </p>
        </div>
      </div>
    );
  }

  const toggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    const parentEl = containerRef.current?.parentElement;
    if (!parentEl) return;

    if (!document.fullscreenElement) {
      parentEl.requestFullscreen().then(() => setIsFullscreen(true)).catch((err) => {
        console.error('Failed to enter fullscreen:', err);
      });
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div className={`${className} ${onClick ? 'cursor-pointer' : ''}`} onClick={onClick}>
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute top-2 right-2 flex items-center gap-1.5 z-[1000]">
        {isLivePositionUsable && (
          <div className="bg-white/90 rounded-full px-2 py-0.5 text-[10px] font-medium text-teal-700 shadow">
            Live
          </div>
        )}
        {!isLivePositionUsable && showBusMarker && (
          <div className="bg-white/90 rounded-full px-2 py-0.5 text-[10px] font-medium text-gray-500 shadow">
            Estimated
          </div>
        )}
        <button
          type="button"
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Full View'}
          className="bg-white/90 hover:bg-white text-gray-700 hover:text-brand-700 p-1.5 rounded-lg shadow border border-gray-200/80 transition-colors flex items-center justify-center"
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
};

export default JourneyMap;