'use client';

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Maximize2, Minimize2, Crosshair } from 'lucide-react';
import type { StopWithStage } from './useJourneyTracker';

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

// Create stop icons
const getStopIcon = (type: 'origin' | 'destination' | 'passed' | 'current' | 'upcoming') => {
  let html = '';
  switch (type) {
    case 'origin':
      html = `<div style="width: 16px; height: 16px; background-color: #22c55e; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.3);"></div>`;
      break;
    case 'destination':
      html = `<div style="width: 16px; height: 16px; background-color: #ef4444; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.3);"></div>`;
      break;
    case 'passed':
      html = `<div style="width: 12px; height: 12px; background-color: #9ca3af; opacity: 0.5; border-radius: 50%; border: 2px solid #fff;"></div>`;
      break;
    case 'upcoming':
      html = `<div style="width: 12px; height: 12px; border: 2px solid #d1d5db; background-color: #fff; border-radius: 50%;"></div>`;
      break;
    case 'current':
      html = `<div style="position: relative; width: 16px; height: 16px;">
                <div style="position: absolute; inset: 0; background-color: #005A5B; border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite; opacity: 0.5;"></div>
                <div style="position: absolute; inset: 0; background-color: #005A5B; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.3);"></div>
              </div>`;
      break;
  }
  return L.divIcon({ html, className: '', iconSize: [16, 16], iconAnchor: [8, 8] });
};

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

// ─── Haversine distance between two lat/lng points (in metres) ───
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

/**
 * Given a route polyline and a fractional progress (0–1), return the sub-array
 * of points from the start up to (and including) the interpolated split point.
 */
function splitRouteAtProgress(
  routePoints: [number, number][],
  progress: number
): [number, number][] {
  if (!routePoints || routePoints.length < 2) return [];
  const t = Math.min(Math.max(progress, 0), 1);
  if (t === 0) return [routePoints[0]];
  if (t === 1) return [...routePoints];

  let totalLen = 0;
  const cumulative: number[] = [0];
  for (let i = 1; i < routePoints.length; i++) {
    totalLen += haversineM(routePoints[i - 1], routePoints[i]);
    cumulative.push(totalLen);
  }
  if (totalLen === 0) return [routePoints[0]];

  const target = t * totalLen;
  const traveled: [number, number][] = [routePoints[0]];

  for (let i = 1; i < routePoints.length; i++) {
    if (cumulative[i] >= target) {
      const segLen = cumulative[i] - cumulative[i - 1];
      if (segLen === 0) {
        traveled.push(routePoints[i]);
      } else {
        const segT = (target - cumulative[i - 1]) / segLen;
        const a = routePoints[i - 1];
        const b = routePoints[i];
        traveled.push([
          a[0] + (b[0] - a[0]) * segT,
          a[1] + (b[1] - a[1]) * segT,
        ]);
      }
      break;
    }
    traveled.push(routePoints[i]);
  }
  return traveled;
}

/**
 * Interpolate a position along a polyline at a given fractional progress (0–1).
 * Walks the polyline by cumulative Haversine distance so the result sits exactly
 * on the road geometry rather than cutting across it.
 *
 * Falls back to straight-line interpolation between origin and destination
 * when routePoints is null or has fewer than 2 points.
 */
function interpolateAlongPolyline(
  routePoints: [number, number][] | null,
  originCoords: [number, number],
  destCoords: [number, number],
  progress: number  // 0..1
): [number, number] | null {
  // Clamp progress
  const t = Math.min(Math.max(progress, 0), 1);

  // Use road polyline if available
  if (routePoints && routePoints.length >= 2) {
    // Build cumulative distance array
    let totalLen = 0;
    const cumulative: number[] = [0];
    for (let i = 1; i < routePoints.length; i++) {
      totalLen += haversineM(routePoints[i - 1], routePoints[i]);
      cumulative.push(totalLen);
    }

    if (totalLen === 0) return routePoints[0];

    const target = t * totalLen;

    // Find the segment where the target distance lies
    for (let i = 1; i < routePoints.length; i++) {
      if (cumulative[i] >= target) {
        const segLen = cumulative[i] - cumulative[i - 1];
        if (segLen === 0) return routePoints[i];
        const segT = (target - cumulative[i - 1]) / segLen;
        const a = routePoints[i - 1];
        const b = routePoints[i];
        return [
          a[0] + (b[0] - a[0]) * segT,
          a[1] + (b[1] - a[1]) * segT,
        ];
      }
    }

    // Progress >= 1 — return last point
    return routePoints[routePoints.length - 1];
  }

  // Fallback: straight-line interpolation
  const lat = originCoords[0] + (destCoords[0] - originCoords[0]) * t;
  const lng = originCoords[1] + (destCoords[1] - originCoords[1]) * t;
  return isValidLatLng(lat, lng) ? [lat, lng] : null;
}

// ─── Snap a GPS position onto the nearest point along a polyline ───
// Returns { snapped: [lat, lng], progress: 0..1 } so the bus icon always sits on the road.
function snapToPolyline(
  routePoints: [number, number][],
  position: [number, number]
): { snapped: [number, number]; progress: number } {
  if (!routePoints || routePoints.length < 2) {
    return { snapped: position, progress: 0 };
  }

  // Build cumulative distance array
  let totalLen = 0;
  const cumulative: number[] = [0];
  for (let i = 1; i < routePoints.length; i++) {
    totalLen += haversineM(routePoints[i - 1], routePoints[i]);
    cumulative.push(totalLen);
  }
  if (totalLen === 0) return { snapped: routePoints[0], progress: 0 };

  let bestDist = Infinity;
  let bestPoint: [number, number] = routePoints[0];
  let bestDistAlong = 0;

  for (let i = 1; i < routePoints.length; i++) {
    const a = routePoints[i - 1];
    const b = routePoints[i];
    const p = position;

    // Project p onto segment a→b using simple lat/lng arithmetic (accurate enough at this scale)
    const ax = a[1], ay = a[0];
    const bx = b[1], by = b[0];
    const px = p[1], py = p[0];

    const dx = bx - ax, dy = by - ay;
    const segLenSq = dx * dx + dy * dy;
    let t = 0;
    if (segLenSq > 0) {
      t = ((px - ax) * dx + (py - ay) * dy) / segLenSq;
      t = Math.min(Math.max(t, 0), 1);
    }
    const closestX = ax + t * dx;
    const closestY = ay + t * dy;
    const closest: [number, number] = [closestY, closestX];
    const dist = haversineM(p, closest);

    if (dist < bestDist) {
      bestDist = dist;
      bestPoint = closest;
      const segDistAlong = haversineM(a, closest);
      bestDistAlong = cumulative[i - 1] + segDistAlong;
    }
  }

  return { snapped: bestPoint, progress: bestDistAlong / totalLen };
}

// ─── Project position onto polyline to get progress (0-1) (kept for fallback) ───
function getProgressFromPosition(routePoints: [number, number][], position: [number, number]): number {
  return snapToPolyline(routePoints, position).progress;
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
  followBus?: boolean;
  onFollowChange?: (follow: boolean) => void;
  stopStages?: StopWithStage[];
  onMapReady?: (map: L.Map) => void;
}

const STALE_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes

// ─── routePoints state meanings ───
// undefined  = not yet fetched / fetch in flight
// null       = fallback (fetch failed or no route found) → use straight dashed line
// [...]      = road-following polyline with ≥ 2 points

const JourneyMap: React.FC<JourneyMapProps> = ({
  origin,
  destination,
  progress,
  livePosition,
  livePositionAgeMs = null,
  isActive = true,
  className = "w-full h-48 rounded-xl overflow-hidden border border-gray-200 shadow-inner relative",
  onClick,
  followBus,
  onFollowChange,
  stopStages = [],
  onMapReady,
}) => {
  const [mounted, setMounted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // undefined = loading, null = fallback, array = road route
  const [routePoints, setRoutePoints] = useState<[number, number][] | null | undefined>(undefined);

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

  // ─── Fetch road-following route from server-side proxy ───
  useEffect(() => {
    if (!origin || !destination) return;

    // Reset to "loading" on route change
    setRoutePoints(undefined);

    let cancelled = false;

    const fetchRoute = async () => {
      try {
        const params = new URLSearchParams({ origin, destination });
        const res = await fetch(`/api/routing?${params.toString()}`);
        if (cancelled) return;

        if (!res.ok) {
          setRoutePoints(null); // fallback
          return;
        }

        const data = await res.json() as {
          points?: [number, number][] | null;
          fallback?: boolean;
        };

        if (cancelled) return;

        if (data.fallback || !data.points || data.points.length < 2) {
          setRoutePoints(null); // fallback to straight line
        } else {
          setRoutePoints(data.points);
        }
      } catch {
        if (!cancelled) setRoutePoints(null); // network error → fallback
      }
    };

    fetchRoute();
    return () => { cancelled = true; };
  }, [origin, destination]);

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
  let displayProgress = safeProgress;

  if (isLivePositionUsable && livePosition) {
    const rawPos: [number, number] = [livePosition.latitude, livePosition.longitude];

    if (routePoints && routePoints.length >= 2) {
      // Snap live GPS onto the road polyline so the icon always sits on the road
      const { snapped, progress } = snapToPolyline(routePoints, rawPos);
      busPosition = snapped;
      displayProgress = progress;
    } else if (originCoords && destCoords) {
      // No road polyline yet — place bus on the straight-line segment nearest to GPS
      busPosition = interpolateAlongPolyline(null, originCoords, destCoords, safeProgress ?? 0);
      const total = haversineM(originCoords, destCoords);
      if (total > 0) {
        const fromOrigin = haversineM(originCoords, rawPos);
        displayProgress = Math.min(Math.max(fromOrigin / total, 0), 1);
      }
    } else {
      // Last resort: use raw GPS
      busPosition = rawPos;
    }
  } else if (safeProgress !== null && originCoords && destCoords) {
    // No live GPS — place bus based on time-based progress along the road
    if (routePoints !== undefined) {
      busPosition = interpolateAlongPolyline(routePoints, originCoords, destCoords, safeProgress);
    }
  }

  const showBusMarker = isActive && busPosition !== null;

  const mapRef = useRef<L.Map | null>(null);
  const busMarkerRef = useRef<L.Marker | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const traveledLayerRef = useRef<L.Polyline | null>(null);
  const stopMarkersRef = useRef<L.Marker[]>([]);

  // Stable callback to update/replace route polyline without destroying the map
  const updateRouteLayer = useCallback(
    (map: L.Map, pts: [number, number][] | null | undefined) => {
      // Remove old route layer
      if (routeLayerRef.current) {
        routeLayerRef.current.remove();
        routeLayerRef.current = null;
      }
      // Remove old traveled overlay
      if (traveledLayerRef.current) {
        traveledLayerRef.current.remove();
        traveledLayerRef.current = null;
      }

      if (!originCoords || !destCoords) return;

      if (pts && pts.length >= 2) {
        // Base route — dark teal for "remaining" road
        routeLayerRef.current = L.polyline(pts, {
          color: '#005A5B',
          weight: 4,
          opacity: 0.6,
        }).addTo(map);
      } else if (pts === null) {
        // Fallback: dashed straight line between origin and destination
        routeLayerRef.current = L.polyline([originCoords, destCoords], {
          color: '#005A5B',
          weight: 3,
          opacity: 0.6,
        }).addTo(map);
      }
      // If pts === undefined (loading), draw nothing — keeps the map clean during fetch
    },
    [originCoords, destCoords]
  );

  // Effect 1: Initialize map instance, static layers (markers, attribution), fit bounds ONCE per route
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
      attributionControl: true,
    });
    mapRef.current = map;

    map.attributionControl.setPrefix(
      '<a href="https://www.graphhopper.com" target="_blank" rel="noopener">Routing © GraphHopper</a>'
    );

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    try {
      const bounds = L.latLngBounds(originCoords, destCoords);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    } catch {
      // Ignore fitBounds errors on degenerate coordinates
    }

    // Handle manual pan to turn off follow mode
    map.on('dragstart', () => {
      if (onFollowChange) onFollowChange(false);
    });

    if (onMapReady) {
      onMapReady(map);
    }

    // Draw initial route state (may be loading/fallback/road)
    updateRouteLayer(map, routePoints);

    return () => {
      if (busMarkerRef.current) {
        busMarkerRef.current.remove();
        busMarkerRef.current = null;
      }
      if (routeLayerRef.current) {
        routeLayerRef.current.remove();
        routeLayerRef.current = null;
      }
      if (traveledLayerRef.current) {
        traveledLayerRef.current.remove();
        traveledLayerRef.current = null;
      }
      stopMarkersRef.current.forEach(m => m.remove());
      stopMarkersRef.current = [];
      map.remove();
      mapRef.current = null;
      if ((el as any)._leaflet_id) {
        (el as any)._leaflet_id = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, origin, destination]);

  // Effect 2: Update route polyline when routePoints changes (after fetch resolves)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    updateRouteLayer(map, routePoints);
  }, [routePoints, updateRouteLayer]);

  // Effect 3: Render stops based on stopStages
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !originCoords || !destCoords) return;

    // Clear old stops
    stopMarkersRef.current.forEach(m => m.remove());
    stopMarkersRef.current = [];

    if (stopStages && stopStages.length > 0) {
      // Draw all stops from stopStages
      stopStages.forEach((stop, i) => {
        if (!stop.coords) return;
        let type: 'origin' | 'destination' | 'passed' | 'current' | 'upcoming' = stop.stage;
        if (i === 0) type = 'origin';
        if (i === stopStages.length - 1) type = 'destination';
        
        const marker = L.marker(stop.coords, { icon: getStopIcon(type) }).addTo(map);
        stopMarkersRef.current.push(marker);
      });
    } else {
      // Fallback if no stopStages provided
      stopMarkersRef.current.push(L.marker(originCoords, { icon: getStopIcon('origin') }).addTo(map));
      stopMarkersRef.current.push(L.marker(destCoords, { icon: getStopIcon('destination') }).addTo(map));
    }
  }, [stopStages, originCoords, destCoords]);

  // Effect 4: Dynamically update or add/remove ONLY the bus marker when position changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (showBusMarker && busPosition) {
      if (busMarkerRef.current) {
        busMarkerRef.current.setLatLng(busPosition);
      } else {
        busMarkerRef.current = L.marker(busPosition, { icon: busIcon, zIndexOffset: 1000 }).addTo(map);
      }
      
      // Handle following
      if (followBus) {
        map.panTo(busPosition, { animate: true });
      }
    } else if (busMarkerRef.current) {
      busMarkerRef.current.remove();
      busMarkerRef.current = null;
    }
  }, [showBusMarker, busPosition?.[0], busPosition?.[1], followBus]);

  // Effect 5: Update traveled-road overlay when progress changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old traveled overlay
    if (traveledLayerRef.current) {
      traveledLayerRef.current.remove();
      traveledLayerRef.current = null;
    }

    if (displayProgress === null || displayProgress <= 0) return;
    if (!originCoords || !destCoords) return;

    if (routePoints && routePoints.length >= 2) {
      const traveledPts = splitRouteAtProgress(routePoints, displayProgress);
      if (traveledPts.length >= 2) {
        traveledLayerRef.current = L.polyline(traveledPts, {
          color: '#FF6B6B',
          weight: 5,
          opacity: 0.9,
        }).addTo(map);
      }
    } else if (routePoints === null) {
      // Fallback straight line — show traveled portion
      const lat = originCoords[0] + (destCoords[0] - originCoords[0]) * displayProgress;
      const lng = originCoords[1] + (destCoords[1] - originCoords[1]) * displayProgress;
      traveledLayerRef.current = L.polyline([originCoords, [lat, lng]], {
        color: '#FF6B6B',
        weight: 4,
        opacity: 0.9,
      }).addTo(map);
    }
  }, [displayProgress, routePoints, originCoords, destCoords]);

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
        {onFollowChange && showBusMarker && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onFollowChange(true);
              if (busPosition && mapRef.current) {
                mapRef.current.panTo(busPosition, { animate: true });
              }
            }}
            title={followBus ? 'Following Bus' : 'Find Bus'}
            className={`bg-white/90 hover:bg-white p-1.5 rounded-lg shadow border transition-colors flex items-center justify-center ${followBus ? 'text-brand-700 border-brand-200' : 'text-gray-500 border-gray-200/80 hover:text-brand-700'}`}
          >
            <Crosshair className={`w-3.5 h-3.5 ${followBus ? 'fill-current' : ''}`} />
          </button>
        )}
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