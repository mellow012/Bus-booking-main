'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  collection, addDoc, serverTimestamp, Timestamp,
  getDocs, query, where, writeBatch, doc, deleteDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import {
  Database, Trash2, Play, CheckCircle, XCircle,
  Loader2, ChevronDown, ChevronRight, Bus, MapPin,
  Calendar, Users, Building2, AlertTriangle, RefreshCw,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────
type LogLevel = 'info' | 'success' | 'error' | 'warn' | 'section';
interface LogEntry { id: number; level: LogLevel; msg: string; ts: string }
interface SeedResult { companies: number; buses: number; routes: number; schedules: number }

// ─── Seed Data ─────────────────────────────────────────────────────────────────

const COMPANIES = [
  {
    name: 'Shire Bus Lines',
    phone: '+265 1 822 400',
    email: 'info@shirebuslines.mw',
    address: 'Ginnery Corner, Blantyre',
    description: 'Established in 1994. Serving the Southern Region since independence.',
    status: 'active',
    logoUrl: null,
  },
  {
    name: 'AXA Coaches',
    phone: '+265 1 754 900',
    email: 'bookings@axacoaches.mw',
    address: 'Kamuzu Procession Road, Lilongwe',
    description: 'Premium inter-city coach service connecting Malawi\'s major cities.',
    status: 'active',
    logoUrl: null,
  },
  {
    name: 'Transcom Express',
    phone: '+265 1 332 155',
    email: 'support@transcomexpress.mw',
    address: 'Orton Chirwa Avenue, Mzuzu',
    description: 'Northern Region specialists. Fast, reliable, affordable.',
    status: 'active',
    logoUrl: null,
  },
];

// buses[companyIndex][]
const BUSES_BY_COMPANY = [
  // Shire Bus Lines (index 0)
  [
    { licensePlate: 'MV 2341', busType: 'AC', capacity: 44, totalSeats: 44, amenities: ['AC', 'WiFi', 'Charging', 'Reclining Seats'], status: 'active' },
    { licensePlate: 'MV 2342', busType: 'Standard', capacity: 50, totalSeats: 50, amenities: ['AC'], status: 'active' },
    { licensePlate: 'MV 2343', busType: 'Semi-Sleeper', capacity: 36, totalSeats: 36, amenities: ['AC', 'Entertainment', 'Reclining Seats'], status: 'active' },
  ],
  // AXA Coaches (index 1)
  [
    { licensePlate: 'BT 1190', busType: 'AC', capacity: 48, totalSeats: 48, amenities: ['AC', 'WiFi', 'Coffee', 'Charging'], status: 'active' },
    { licensePlate: 'BT 1191', busType: 'Sleeper', capacity: 30, totalSeats: 30, amenities: ['AC', 'WiFi', 'Entertainment', 'Coffee', 'Reclining Seats'], status: 'active' },
  ],
  // Transcom Express (index 2)
  [
    { licensePlate: 'MZ 0045', busType: 'Standard', capacity: 52, totalSeats: 52, amenities: ['AC'], status: 'active' },
    { licensePlate: 'MZ 0046', busType: 'AC', capacity: 44, totalSeats: 44, amenities: ['AC', 'Charging'], status: 'active' },
  ],
];

// Routes: [origin, destination, distanceKm, durationMins, baseFare, stops?]
const ROUTE_TEMPLATES: {
  origin: string; destination: string; distance: number; duration: number;
  baseFare: number; pricePerKm: number;
  stops?: { name: string; distanceFromOrigin: number; order: number }[];
}[] = [
  {
    origin: 'Blantyre', destination: 'Lilongwe',
    distance: 312, duration: 270, baseFare: 3500, pricePerKm: 12,
    stops: [
      { name: 'Zalewa', distanceFromOrigin: 45, order: 0 },
      { name: 'Balaka', distanceFromOrigin: 110, order: 1 },
      { name: 'Liwonde', distanceFromOrigin: 145, order: 2 },
      { name: 'Ntcheu', distanceFromOrigin: 210, order: 3 },
      { name: 'Dedza', distanceFromOrigin: 265, order: 4 },
    ],
  },
  {
    origin: 'Lilongwe', destination: 'Blantyre',
    distance: 312, duration: 270, baseFare: 3500, pricePerKm: 12,
    stops: [
      { name: 'Dedza', distanceFromOrigin: 47, order: 0 },
      { name: 'Ntcheu', distanceFromOrigin: 102, order: 1 },
      { name: 'Liwonde', distanceFromOrigin: 167, order: 2 },
      { name: 'Balaka', distanceFromOrigin: 202, order: 3 },
      { name: 'Zalewa', distanceFromOrigin: 267, order: 4 },
    ],
  },
  {
    origin: 'Lilongwe', destination: 'Mzuzu',
    distance: 358, duration: 300, baseFare: 4200, pricePerKm: 13,
    stops: [
      { name: 'Kasungu', distanceFromOrigin: 120, order: 0 },
      { name: 'Mchinji Junction', distanceFromOrigin: 165, order: 1 },
      { name: 'Nkhotakota', distanceFromOrigin: 230, order: 2 },
      { name: 'Nkhata Bay Turnoff', distanceFromOrigin: 310, order: 3 },
    ],
  },
  {
    origin: 'Mzuzu', destination: 'Lilongwe',
    distance: 358, duration: 300, baseFare: 4200, pricePerKm: 13,
    stops: [
      { name: 'Nkhata Bay Turnoff', distanceFromOrigin: 48, order: 0 },
      { name: 'Nkhotakota', distanceFromOrigin: 128, order: 1 },
      { name: 'Kasungu', distanceFromOrigin: 238, order: 2 },
    ],
  },
  {
    origin: 'Blantyre', destination: 'Zomba',
    distance: 67, duration: 75, baseFare: 1200, pricePerKm: 10,
    stops: [
      { name: 'Limbe', distanceFromOrigin: 10, order: 0 },
      { name: 'Chiradzulu', distanceFromOrigin: 38, order: 1 },
    ],
  },
  {
    origin: 'Lilongwe', destination: 'Salima',
    distance: 105, duration: 90, baseFare: 1500, pricePerKm: 11,
    stops: [
      { name: 'Malingunde', distanceFromOrigin: 35, order: 0 },
      { name: 'Chipoka', distanceFromOrigin: 80, order: 1 },
    ],
  },
  {
    origin: 'Mzuzu', destination: 'Karonga',
    distance: 234, duration: 210, baseFare: 3000, pricePerKm: 12,
    stops: [
      { name: 'Rumphi', distanceFromOrigin: 75, order: 0 },
      { name: 'Chitipa Turnoff', distanceFromOrigin: 155, order: 1 },
    ],
  },
  {
    origin: 'Blantyre', destination: 'Mangochi',
    distance: 148, duration: 150, baseFare: 2000, pricePerKm: 11,
    stops: [
      { name: 'Zomba', distanceFromOrigin: 67, order: 0 },
      { name: 'Liwonde', distanceFromOrigin: 112, order: 1 },
    ],
  },
];

// Which company operates which routes (by route template index)
// and which buses they use
const ROUTE_ASSIGNMENTS: { routeIdx: number; companyIdx: number; busIdx: number }[] = [
  { routeIdx: 0, companyIdx: 0, busIdx: 0 }, // Blantyre→Lilongwe: Shire AC
  { routeIdx: 0, companyIdx: 1, busIdx: 0 }, // Blantyre→Lilongwe: AXA AC
  { routeIdx: 1, companyIdx: 0, busIdx: 1 }, // Lilongwe→Blantyre: Shire Standard
  { routeIdx: 1, companyIdx: 1, busIdx: 1 }, // Lilongwe→Blantyre: AXA Sleeper
  { routeIdx: 2, companyIdx: 1, busIdx: 0 }, // Lilongwe→Mzuzu: AXA AC
  { routeIdx: 2, companyIdx: 2, busIdx: 1 }, // Lilongwe→Mzuzu: Transcom AC
  { routeIdx: 3, companyIdx: 2, busIdx: 0 }, // Mzuzu→Lilongwe: Transcom Standard
  { routeIdx: 4, companyIdx: 0, busIdx: 2 }, // Blantyre→Zomba: Shire Semi-Sleeper
  { routeIdx: 5, companyIdx: 1, busIdx: 0 }, // Lilongwe→Salima: AXA AC
  { routeIdx: 6, companyIdx: 2, busIdx: 1 }, // Mzuzu→Karonga: Transcom AC
  { routeIdx: 7, companyIdx: 0, busIdx: 0 }, // Blantyre→Mangochi: Shire AC
];

// Departure times for each route assignment (hour, minute)
const DEPARTURE_TIMES = [
  [{ h: 6, m: 0 }, { h: 8, m: 30 }, { h: 13, m: 0 }, { h: 15, m: 30 }],
  [{ h: 7, m: 0 }, { h: 11, m: 0 }, { h: 14, m: 0 }],
  [{ h: 6, m: 30 }, { h: 9, m: 0 }, { h: 14, m: 30 }],
  [{ h: 7, m: 30 }, { h: 12, m: 0 }],
  [{ h: 8, m: 0 }, { h: 13, m: 30 }],
  [{ h: 6, m: 0 }, { h: 10, m: 0 }, { h: 15, m: 0 }],
  [{ h: 7, m: 0 }, { h: 11, m: 30 }],
  [{ h: 8, m: 30 }, { h: 12, m: 0 }, { h: 16, m: 0 }],
  [{ h: 9, m: 0 }, { h: 14, m: 0 }],
  [{ h: 7, m: 0 }, { h: 13, m: 0 }],
  [{ h: 8, m: 0 }, { h: 14, m: 30 }],
];

// How many days of schedules to generate (spread across today+7)
const SCHEDULE_DAYS = [0, 1, 2, 3, 5, 7]; // today, tomorrow, +2, +3, +5, +7

// ─── Helpers ───────────────────────────────────────────────────────────────────

function makeDepArr(baseDateMs: number, hour: number, minute: number, durationMins: number) {
  const dep = new Date(baseDateMs);
  dep.setHours(hour, minute, 0, 0);
  const arr = new Date(dep.getTime() + durationMins * 60 * 1000);
  return { dep: Timestamp.fromDate(dep), arr: Timestamp.fromDate(arr) };
}

function randomSeats(total: number, booked: number): string[] {
  const all = Array.from({ length: total }, (_, i) => String(i + 1));
  const shuffled = all.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, booked);
}

function baseDate(daysFromNow: number): number {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.getTime();
}

// ─── Main component ─────────────────────────────────────────────────────────────

export default function SeedPage() {
  const { user, userProfile } = useAuth();
  const router = useRouter();

  const [logs,       setLogs]       = useState<LogEntry[]>([]);
  const [running,    setRunning]    = useState(false);
  const [clearing,   setClearing]   = useState(false);
  const [done,       setDone]       = useState(false);
  const [result,     setResult]     = useState<SeedResult | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState({
    includeTodayOnly: false,
    partialBookings: true,   // pre-book some seats on some schedules
    daysAhead: 7,
  });

  const logIdRef = useRef(0);
  const logEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((level: LogLevel, msg: string) => {
    const entry: LogEntry = {
      id: ++logIdRef.current,
      level,
      msg,
      ts: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    setLogs(prev => [...prev, entry]);
    setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  // ── Guard ───────────────────────────────────────────────────────────────────
  const normalizedRole = String(userProfile?.role ?? '').trim().toLowerCase();
  const isSuperAdmin   = normalizedRole === 'superadmin';

  if (!user || !isSuperAdmin) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-800">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400 mb-6 text-sm">Superadmin account required.</p>
          <button onClick={() => router.push('/')} className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm hover:bg-gray-700 transition-colors">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // ── Clear all seed data ─────────────────────────────────────────────────────
  const clearSeedData = async () => {
    if (!window.confirm('⚠️  Delete ALL companies, buses, routes, and schedules from Firestore? This cannot be undone.')) return;
    setClearing(true);
    setLogs([]);
    setDone(false);
    setResult(null);

    try {
      addLog('section', '🗑  CLEARING SEED DATA');
      const colls = ['schedules', 'routes', 'buses', 'companies'];
      for (const c of colls) {
        addLog('info', `Deleting ${c}…`);
        const snap = await getDocs(collection(db, c));
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
        addLog('success', `Deleted ${snap.docs.length} ${c}`);
      }
      addLog('success', 'All seed data cleared ✓');
    } catch (e: any) {
      addLog('error', `Clear failed: ${e.message}`);
    } finally {
      setClearing(false);
    }
  };

  // ── Seed ────────────────────────────────────────────────────────────────────
  const runSeed = async () => {
    setRunning(true);
    setDone(false);
    setResult(null);
    setLogs([]);

    const counts: SeedResult = { companies: 0, buses: 0, routes: 0, schedules: 0 };

    try {
      // ── 1. Companies ────────────────────────────────────────────────────────
      addLog('section', '🏢  STEP 1 — COMPANIES');
      const companyIds: string[] = [];

      for (const co of COMPANIES) {
        const ref = await addDoc(collection(db, 'companies'), {
          ...co,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        companyIds.push(ref.id);
        counts.companies++;
        addLog('success', `Created company: ${co.name} (${ref.id.slice(0, 8)}…)`);
      }

      // ── 2. Buses ────────────────────────────────────────────────────────────
      addLog('section', '🚌  STEP 2 — BUSES');
      const busIdsByCompany: string[][] = [[], [], []];

      for (let ci = 0; ci < BUSES_BY_COMPANY.length; ci++) {
        for (const bus of BUSES_BY_COMPANY[ci]) {
          const ref = await addDoc(collection(db, 'buses'), {
            ...bus,
            companyId: companyIds[ci],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          busIdsByCompany[ci].push(ref.id);
          counts.buses++;
          addLog('success', `  ${COMPANIES[ci].name} → ${bus.licensePlate} (${bus.busType}, ${bus.capacity} seats)`);
        }
      }

      // ── 3. Routes ───────────────────────────────────────────────────────────
      addLog('section', '🗺   STEP 3 — ROUTES');
      const routeIds: string[] = new Array(ROUTE_TEMPLATES.length).fill('');

      // Create one canonical route doc per template per company pair
      // (some routes are shared by multiple companies — Firestore routes are linked by routeId on schedule)
      const routeKeyMap: Map<string, string> = new Map(); // "origin-dest-companyIdx" → routeId

      for (const asgn of ROUTE_ASSIGNMENTS) {
        const tmpl = ROUTE_TEMPLATES[asgn.routeIdx];
        const key  = `${tmpl.origin}-${tmpl.destination}-${asgn.companyIdx}`;
        if (routeKeyMap.has(key)) continue; // already created for this company

        const ref = await addDoc(collection(db, 'routes'), {
          origin:      tmpl.origin,
          destination: tmpl.destination,
          distance:    tmpl.distance,
          duration:    tmpl.duration,
          baseFare:    tmpl.baseFare,
          pricePerKm:  tmpl.pricePerKm,
          companyId:   companyIds[asgn.companyIdx],
          isActive:    true,
          stops:       tmpl.stops ?? [],
          createdAt:   serverTimestamp(),
          updatedAt:   serverTimestamp(),
        });
        routeKeyMap.set(key, ref.id);
        counts.routes++;
        addLog('success', `  ${tmpl.origin} → ${tmpl.destination} for ${COMPANIES[asgn.companyIdx].name} (${tmpl.distance}km, ${Math.floor(tmpl.duration/60)}h${tmpl.duration%60}m)`);
      }

      // ── 4. Schedules ─────────────────────────────────────────────────────────
      addLog('section', '📅  STEP 4 — SCHEDULES');

      const days = config.includeTodayOnly ? [0] : SCHEDULE_DAYS;

      for (let ai = 0; ai < ROUTE_ASSIGNMENTS.length; ai++) {
        const asgn   = ROUTE_ASSIGNMENTS[ai];
        const tmpl   = ROUTE_TEMPLATES[asgn.routeIdx];
        const key    = `${tmpl.origin}-${tmpl.destination}-${asgn.companyIdx}`;
        const routeId = routeKeyMap.get(key)!;
        const busId   = busIdsByCompany[asgn.companyIdx][asgn.busIdx];
        const busData = BUSES_BY_COMPANY[asgn.companyIdx][asgn.busIdx];
        const times   = DEPARTURE_TIMES[ai] ?? [{ h: 8, m: 0 }];

        for (const day of days) {
          for (const time of times) {
            const { dep, arr } = makeDepArr(baseDate(day), time.h, time.m, tmpl.duration);

            // Skip past departures (for day 0, times already gone)
            if (dep.toDate() < new Date()) continue;

            // Partially pre-book some schedules to look realistic
            let bookedSeats: string[] = [];
            let availableSeats = busData.capacity;

            if (config.partialBookings && Math.random() > 0.4) {
              const bookedCount = Math.floor(Math.random() * busData.capacity * 0.6);
              bookedSeats    = randomSeats(busData.capacity, bookedCount);
              availableSeats = busData.capacity - bookedCount;
            }

            await addDoc(collection(db, 'schedules'), {
              busId,
              routeId,
              companyId:     companyIds[asgn.companyIdx],
              departureDateTime: dep,
              arrivalDateTime:   arr,
              price:         tmpl.baseFare,
              availableSeats,
              bookedSeats,
              totalSeats:    busData.capacity,
              status:        'active',
              createdAt:     serverTimestamp(),
              updatedAt:     serverTimestamp(),
            });
            counts.schedules++;
          }
        }

        addLog('info', `  ${tmpl.origin}→${tmpl.destination} (${COMPANIES[asgn.companyIdx].name}): scheduled`);
      }

      addLog('section', '✅  SEED COMPLETE');
      addLog('success', `Companies: ${counts.companies}`);
      addLog('success', `Buses:     ${counts.buses}`);
      addLog('success', `Routes:    ${counts.routes}`);
      addLog('success', `Schedules: ${counts.schedules}`);

      setResult(counts);
      setDone(true);

    } catch (e: any) {
      addLog('error', `Seed failed: ${e.message}`);
      console.error(e);
    } finally {
      setRunning(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;700;800&display=swap');
        .font-display { font-family: 'Plus Jakarta Sans', sans-serif; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        .cursor { animation: blink 1s step-end infinite; }
        @keyframes slideIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .log-entry { animation: slideIn .15s ease-out both; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #111827; }
        ::-webkit-scrollbar-thumb { background: #374151; border-radius: 3px; }
      `}</style>

      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/60 backdrop-blur">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-500/20 border border-emerald-500/30 rounded-xl flex items-center justify-center">
              <Database className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="font-display font-bold text-white text-sm leading-none">Seed Manager</p>
              <p className="text-[11px] text-gray-500 mt-0.5">TibhukeBus · Firestore</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-900/30 border border-emerald-800/50 rounded-lg">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] text-emerald-400 font-medium">SUPERADMIN</span>
            </div>
            <button onClick={() => router.push('/')} className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-800">
              ← Home
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* What will be seeded */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Building2, label: 'Companies', value: '3', sub: 'Shire, AXA, Transcom', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-800/40' },
            { icon: Bus,       label: 'Buses',     value: '7', sub: '2–3 per company',      color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-800/40' },
            { icon: MapPin,    label: 'Routes',    value: '8', sub: '8 corridors',           color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-800/40' },
            { icon: Calendar,  label: 'Schedules', value: '~70', sub: 'Next 7 days',        color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-800/40' },
          ].map(({ icon: Icon, label, value, sub, color, bg }) => (
            <div key={label} className={`rounded-xl border p-4 ${bg}`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${color}`} />
                <span className="text-xs text-gray-400 font-display font-medium">{label}</span>
              </div>
              <p className={`text-2xl font-bold font-display ${color}`}>{value}</p>
              <p className="text-[11px] text-gray-600 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        {/* Config toggle */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/40 overflow-hidden">
          <button onClick={() => setShowConfig(!showConfig)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-sm text-gray-300 hover:bg-gray-800/30 transition-colors">
            <span className="font-medium">⚙ Seed Options</span>
            {showConfig ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          {showConfig && (
            <div className="px-5 py-4 border-t border-gray-800 space-y-4">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" checked={config.partialBookings}
                  onChange={e => setConfig(p => ({ ...p, partialBookings: e.target.checked }))}
                  className="w-4 h-4 accent-emerald-500" />
                <div>
                  <p className="text-sm text-gray-200 group-hover:text-white transition-colors">Pre-book random seats</p>
                  <p className="text-xs text-gray-500">Fills 0–60% of seats on some schedules so the UI looks realistic</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" checked={config.includeTodayOnly}
                  onChange={e => setConfig(p => ({ ...p, includeTodayOnly: e.target.checked }))}
                  className="w-4 h-4 accent-emerald-500" />
                <div>
                  <p className="text-sm text-gray-200 group-hover:text-white transition-colors">Today only (faster seed)</p>
                  <p className="text-xs text-gray-500">Only generates schedules for today instead of 7 days ahead</p>
                </div>
              </label>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={runSeed} disabled={running || clearing}
            className="flex-1 flex items-center justify-center gap-2.5 py-3.5 px-6 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-display font-bold rounded-xl transition-all active:scale-[.98] shadow-lg shadow-emerald-900/40 text-sm">
            {running
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Seeding…</>
              : done
              ? <><RefreshCw className="w-4 h-4" /> Seed Again</>
              : <><Play className="w-4 h-4" /> Run Seed</>}
          </button>
          <button onClick={clearSeedData} disabled={running || clearing}
            className="flex items-center justify-center gap-2 py-3.5 px-5 bg-gray-800 hover:bg-red-900/40 hover:border-red-800 disabled:opacity-40 text-gray-300 hover:text-red-300 font-medium rounded-xl border border-gray-700 transition-all text-sm">
            {clearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {clearing ? 'Clearing…' : 'Clear All Seed Data'}
          </button>
        </div>

        {/* Success summary */}
        {done && result && (
          <div className="rounded-xl border border-emerald-800/60 bg-emerald-900/20 p-5">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <span className="font-display font-bold text-emerald-300 text-sm">Seed complete — Firestore is ready</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(result).map(([key, val]) => (
                <div key={key} className="bg-emerald-900/30 rounded-lg px-4 py-3 text-center">
                  <p className="text-2xl font-bold text-emerald-300 font-display">{val}</p>
                  <p className="text-xs text-emerald-600 capitalize mt-0.5">{key}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => router.push('/')} className="text-xs px-3 py-1.5 bg-emerald-800/40 hover:bg-emerald-700/40 text-emerald-300 rounded-lg transition-colors">
                → Test Home Page
              </button>
              <button onClick={() => router.push('/search')} className="text-xs px-3 py-1.5 bg-emerald-800/40 hover:bg-emerald-700/40 text-emerald-300 rounded-lg transition-colors">
                → Test Search
              </button>
              <button onClick={() => router.push('/schedules')} className="text-xs px-3 py-1.5 bg-emerald-800/40 hover:bg-emerald-700/40 text-emerald-300 rounded-lg transition-colors">
                → Browse Schedules
              </button>
            </div>
          </div>
        )}

        {/* Terminal log */}
        {logs.length > 0 && (
          <div className="rounded-xl border border-gray-800 bg-gray-950 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-800 bg-gray-900/60">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <div className="w-3 h-3 rounded-full bg-green-500/70" />
              </div>
              <span className="text-xs text-gray-500 ml-2 font-medium">seed.log</span>
              <span className="ml-auto text-[10px] text-gray-600">{logs.length} entries</span>
            </div>
            <div className="p-4 h-80 overflow-y-auto text-xs leading-relaxed space-y-0.5">
              {logs.map(entry => (
                <div key={entry.id} className="log-entry flex gap-3">
                  <span className="text-gray-600 shrink-0 select-none">{entry.ts}</span>
                  <span className={
                    entry.level === 'section'  ? 'text-yellow-400 font-semibold' :
                    entry.level === 'success'  ? 'text-emerald-400' :
                    entry.level === 'error'    ? 'text-red-400' :
                    entry.level === 'warn'     ? 'text-amber-400' :
                    'text-gray-300'
                  }>
                    {entry.level === 'section' ? '' : entry.level === 'success' ? '✓ ' : entry.level === 'error' ? '✗ ' : '  '}
                    {entry.msg}
                  </span>
                </div>
              ))}
              {running && (
                <div className="flex gap-3 text-gray-500">
                  <span className="shrink-0">       </span>
                  <span>▋ <span className="cursor">_</span></span>
                </div>
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        )}

        {/* Data preview */}
        <details className="rounded-xl border border-gray-800 bg-gray-900/30 overflow-hidden group">
          <summary className="px-5 py-3.5 text-sm text-gray-400 hover:text-gray-200 cursor-pointer transition-colors select-none flex items-center gap-2">
            <ChevronRight className="w-4 h-4 group-open:rotate-90 transition-transform" />
            Preview seed data (companies + routes)
          </summary>
          <div className="border-t border-gray-800 p-5 space-y-4 text-xs">
            <div>
              <p className="text-gray-500 font-semibold uppercase tracking-widest text-[10px] mb-2">Companies</p>
              {COMPANIES.map(c => (
                <div key={c.name} className="flex gap-3 py-1.5 border-b border-gray-800/50 last:border-0">
                  <span className="text-blue-400 w-36 shrink-0">{c.name}</span>
                  <span className="text-gray-500">{c.address}</span>
                  <span className="text-gray-600 ml-auto">{c.phone}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="text-gray-500 font-semibold uppercase tracking-widest text-[10px] mb-2">Routes ({ROUTE_TEMPLATES.length})</p>
              {ROUTE_TEMPLATES.map((r, i) => (
                <div key={i} className="flex gap-3 py-1.5 border-b border-gray-800/50 last:border-0">
                  <span className="text-amber-400 w-52 shrink-0">{r.origin} → {r.destination}</span>
                  <span className="text-gray-500">{r.distance}km</span>
                  <span className="text-gray-500">{Math.floor(r.duration/60)}h{r.duration%60 > 0 ? `${r.duration%60}m` : ''}</span>
                  <span className="text-emerald-600 ml-auto">MWK {r.baseFare.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="text-gray-500 font-semibold uppercase tracking-widest text-[10px] mb-2">Buses</p>
              {BUSES_BY_COMPANY.flatMap((busArr, ci) =>
                busArr.map(b => (
                  <div key={b.licensePlate} className="flex gap-3 py-1.5 border-b border-gray-800/50 last:border-0">
                    <span className="text-purple-400 w-20 shrink-0">{b.licensePlate}</span>
                    <span className="text-gray-500 w-24 shrink-0">{b.busType}</span>
                    <span className="text-gray-600">{b.capacity} seats</span>
                    <span className="text-gray-600 ml-auto truncate max-w-xs">{b.amenities.join(', ')}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </details>

        {/* Warning */}
        <div className="flex items-start gap-3 px-4 py-3 bg-amber-900/20 border border-amber-800/40 rounded-xl text-xs text-amber-400/80">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>This page is only accessible to superadmin accounts. Running the seed multiple times will create duplicate documents. Use <strong className="text-amber-300">Clear All Seed Data</strong> first if you need a clean slate.</p>
        </div>

      </div>
    </div>
  );
}