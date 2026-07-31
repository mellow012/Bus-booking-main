'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import { Navigation } from 'lucide-react';
import type { LatLngTuple } from 'leaflet';
import { LiveBusMapProps, useInterpolatedPosition } from './LiveBusMap';

// ─────────────────────────────────────────────
// Map Camera Controller
// Handles initial fitBounds, camera panning, and auto-pausing on user drag
// ─────────────────────────────────────────────
function CameraController({
  busPosition,
  routePath,
  followBus,
  setFollowBus,
}: {
  busPosition: LatLngTuple;
  routePath: LatLngTuple[];
  followBus: boolean;
  setFollowBus: (val: boolean) => void;
}) {
  const map = useMap();
  const hasFitted = useRef(false);

  // 1. Auto-pause camera tracking whenever user manually drags or zooms the map canvas
  useMapEvents({
    dragstart: () => setFollowBus(false),
    zoomstart: () => setFollowBus(false),
    movestart: () => setFollowBus(false),
  });

  // 2. Fit whole route bounds once on initial mount
  useEffect(() => {
    if (!map || routePath.length < 2 || hasFitted.current) return;
    const bounds = routePath.map((p) => [p[0], p[1]] as LatLngTuple);
    map.fitBounds(bounds as any, { padding: [60, 60], maxZoom: 14 });
    hasFitted.current = true;
  }, [map, routePath]);

  // 3. Gently pan camera to live bus position when follow mode is active
  useEffect(() => {
    if (!map || !followBus || !busPosition[0] || !busPosition[1]) return;
    map.panTo(busPosition, { animate: true, duration: 0.8 });
  }, [map, busPosition, followBus]);

  return null;
}

// ─────────────────────────────────────────────
// Inner Synchronous Leaflet Map Implementation
// ─────────────────────────────────────────────
export default function LeafletInnerMap({
  busPosition,
  routePath,
  stops,
  nextStopName,
  etaMinutes,
  busRegistration = 'Bus #101',
}: LiveBusMapProps) {
  const [followBus, setFollowBus] = useState(true);

  // 1. Smoothly interpolate position & heading using requestAnimationFrame loop
  const { position: interpolatedPos, heading: interpolatedHeading } = useInterpolatedPosition(
    busPosition.lat,
    busPosition.lng,
    busPosition.heading ?? 0,
    1200
  );

  const busLatLng: LatLngTuple = [interpolatedPos[0], interpolatedPos[1]];

  // 2. Custom Bus Marker SVG with heading rotation + pulsing radar beacon
  const busIcon = useMemo(() => {
    return L.divIcon({
      className: 'custom-bus-marker',
      html: `
        <div style="position:relative;width:48px;height:48px;display:flex;align-items:center;justify-content:center;">
          <!-- Pulsing Radar Beacon -->
          <div style="position:absolute;inset:0;background:rgba(5,150,105,0.35);border-radius:9999px;animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
          
          <!-- Outer Circle Container -->
          <div style="position:absolute;inset:4px;background:rgba(255,255,255,0.95);border-radius:9999px;box-shadow:0 4px 14px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;">
            
            <!-- Smoothly Rotated Bus SVG -->
            <div style="transform:rotate(${interpolatedHeading}deg);transition:transform 0.3s ease-out;display:flex;align-items:center;justify-content:center;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#005A5B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 6v6"/>
                <path d="M16 6v6"/>
                <path d="M4 12h16"/>
                <path d="M2 17h20"/>
                <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/>
                <path d="M6 3h12a2 2 0 0 1 2 2v7H4V5a2 2 0 0 1 2-2z"/>
                <circle cx="7.5" cy="17.5" r="1.5" fill="#005A5B"/>
                <circle cx="16.5" cy="17.5" r="1.5" fill="#005A5B"/>
              </svg>
            </div>
          </div>
        </div>
      `,
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });
  }, [interpolatedHeading]);

  // 3. Custom Station Icons
  const completedIcon = useMemo(() => {
    return L.divIcon({
      className: 'custom-station-completed',
      html: `<div style="width:22px;height:22px;background:#94A3B8;border:3px solid white;border-radius:9999px;box-shadow:0 2px 6px rgba(0,0,0,0.2);"></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
  }, []);

  const activeIcon = useMemo(() => {
    return L.divIcon({
      className: 'custom-station-active',
      html: `<div style="width:28px;height:28px;background:#E8604C;border:3px solid white;border-radius:9999px;box-shadow:0 2px 8px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:11px;">•</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  }, []);

  // 4. Split Route Line (Solid Travelled vs Dashed Remaining)
  const { travelled, remaining } = useMemo(() => {
    if (routePath.length < 2) return { travelled: [], remaining: routePath };

    let closestIdx = 0;
    let minDist = Infinity;
    routePath.forEach((p, i) => {
      const d = Math.hypot(p[0] - interpolatedPos[0], p[1] - interpolatedPos[1]);
      if (d < minDist) {
        minDist = d;
        closestIdx = i;
      }
    });

    return {
      travelled: routePath.slice(0, closestIdx + 1),
      remaining: routePath.slice(closestIdx),
    };
  }, [routePath, interpolatedPos]);

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={busLatLng}
        zoom={14}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        {/* CARTO Voyager Tile Layer (Clean Modern Google Maps Aesthetic) */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />

        {/* Dynamic Camera Tracking & User Interaction Listener */}
        <CameraController
          busPosition={busLatLng}
          routePath={routePath as LatLngTuple[]}
          followBus={followBus}
          setFollowBus={setFollowBus}
        />

        {/* Travelled Portion — Solid Brand Teal Line */}
        {travelled.length > 1 && (
          <Polyline
            positions={travelled as LatLngTuple[]}
            pathOptions={{ color: '#005A5B', weight: 6, opacity: 0.9, lineCap: 'round' }}
          />
        )}

        {/* Remaining Portion — Dashed Lighter Line */}
        {remaining.length > 1 && (
          <Polyline
            positions={remaining as LatLngTuple[]}
            pathOptions={{
              color: '#005A5B',
              weight: 5,
              opacity: 0.45,
              dashArray: '10 8',
              lineCap: 'round',
            }}
          />
        )}

        {/* Station Stops */}
        {stops.map((stop) => (
          <Marker
            key={stop.id}
            position={[stop.lat, stop.lng]}
            icon={(stop.isCompleted ? completedIcon : activeIcon) || undefined}
          >
            <Popup>
              <div className="p-1 space-y-1">
                <div className="font-bold text-sm text-slate-900">{stop.name}</div>
                {stop.passengerCount ? (
                  <div className="text-xs text-brand-700 font-semibold">
                    👥 {stop.passengerCount} boarding
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">
                    {stop.isCompleted ? 'Completed' : 'Upcoming stop'}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Live Moving Bus Marker (Always on top with zIndexOffset=1000) */}
        {busIcon && (
          <Marker position={busLatLng} icon={busIcon} zIndexOffset={1000}>
            <Popup>
              <div className="text-center space-y-1 p-1">
                <div className="font-bold text-brand-900">{busRegistration}</div>
                <div className="text-xs font-semibold text-emerald-600">🟢 Live GPS Tracking</div>
                {busPosition.speedKmh !== undefined && (
                  <div className="text-xs text-slate-500">Speed: {busPosition.speedKmh} km/h</div>
                )}
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Floating Dashboard Card & Camera Recenter Toggle */}
      <div className="absolute top-4 left-4 right-4 sm:left-auto sm:right-4 z-[1000] max-w-sm bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-slate-200/80 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="font-bold text-slate-900 text-sm">{busRegistration}</span>
          </div>
          <span className="text-xs font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
            EN ROUTE
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-slate-400 block font-medium">NEXT STOP</span>
            <span className="font-bold text-slate-800 text-sm truncate block">
              {nextStopName || 'In Transit'}
            </span>
          </div>
          <div className="text-right">
            <span className="text-slate-400 block font-medium">ESTIMATED ETA</span>
            <span className="font-extrabold text-coral-600 text-sm block">
              {etaMinutes !== undefined ? `${etaMinutes} mins` : 'On Schedule'}
            </span>
          </div>
        </div>

        {busPosition.speedKmh !== undefined && (
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Navigation className="w-3.5 h-3.5 text-brand-700" /> {busPosition.speedKmh} km/h
            </span>
            <span>Updated {busPosition.lastUpdated || 'just now'}</span>
          </div>
        )}

        {/* Camera Tracking / Manual Drag Recenter Button */}
        <button
          onClick={() => setFollowBus((f) => !f)}
          className={`w-full text-xs font-semibold py-1.5 rounded-xl border transition flex items-center justify-center gap-1.5 ${
            followBus
              ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              : 'bg-brand-50 border-brand-200 text-brand-700 font-bold hover:bg-brand-100'
          }`}
        >
          {followBus ? '🔓 Free map movement' : '📍 Recenter on bus'}
        </button>
      </div>
    </div>
  );
}
