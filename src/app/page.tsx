"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  collection, query, where, orderBy, limit,
  Timestamp, onSnapshot, getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import {
  Bus as BusIcon, MapPin, Clock, Loader2, Calendar, Users,
  Star, ArrowRight, Zap, Shield, CheckCircle, RefreshCw,
  Award, Navigation, Wifi, AirVent, Search, Play, Music,
  Coffee, Flame, ArrowUpDown, ChevronLeft, ChevronRight,
  LocateFixed, X, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import TourModal from "@/components/TourModal";
import PromoBanner from "@/components/PromoBanner";
import PopularRoutesCarousel from "@/components/PopularRouteCarousal";
import HowItWorks from "@/components/HowItWorks";
import Partners from "@/components/Partners";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SearchCriteria { from: string; to: string; date: string; passengers: number }
interface Schedule { id: string; companyId: string; busId: string; routeId: string; departureDateTime: Timestamp; arrivalDateTime: Timestamp; price: number; availableSeats: number; status: string }
interface Company  { id: string; name: string; phone?: string; status: string; logoUrl?: string; logo?: string }
interface Bus      { id: string; licensePlate: string; busType: string; capacity: number; totalSeats: number; amenities: string[]; companyId: string; status: string }
interface Route    { id: string; origin: string; destination: string; duration: number; distance: number; companyId: string; isActive: boolean }

interface EnhancedSchedule {
  id: string; companyLogo?: string; companyId: string; busId: string; routeId: string;
  price: number; availableSeats: number; totalSeats: number; status: string;
  date: string; departureTime: string; arrivalTime: string;
  companyName: string; origin: string; destination: string;
  duration: number; distance: number; busNumber: string; busType: string; amenities: string[];
}

type TabKey    = "nearby" | "today" | "week" | "all";
type SortKey   = "time" | "price_asc" | "price_desc" | "seats";
type GeoStatus = "idle" | "detecting" | "granted" | "denied" | "unavailable";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE        = 6;
const LS_CITY_KEY      = "tibhuke_user_city";
const LS_GEO_ASKED_KEY = "tibhuke_geo_asked";

const MALAWI_CITIES = [
  "Blantyre","Lilongwe","Mzuzu","Zomba","Kasungu","Mangochi","Salima",
  "Karonga","Nkhata Bay","Liwonde","Balaka","Ntchisi","Dedza",
  "Monkey Bay","Chipoka","Nkhotakota","Rumphi","Chitipa","Mulanje","Thyolo",
];

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  "Blantyre":   { lat: -15.79, lng: 35.00 }, "Lilongwe":   { lat: -13.96, lng: 33.79 },
  "Mzuzu":      { lat: -11.46, lng: 34.02 }, "Zomba":      { lat: -15.38, lng: 35.32 },
  "Kasungu":    { lat: -13.02, lng: 33.48 }, "Mangochi":   { lat: -14.48, lng: 35.27 },
  "Salima":     { lat: -13.78, lng: 34.46 }, "Karonga":    { lat:  -9.93, lng: 33.93 },
  "Nkhata Bay": { lat: -11.60, lng: 34.29 }, "Liwonde":    { lat: -15.07, lng: 35.23 },
  "Balaka":     { lat: -14.99, lng: 34.96 }, "Ntchisi":    { lat: -13.38, lng: 33.63 },
  "Dedza":      { lat: -14.37, lng: 34.33 }, "Monkey Bay": { lat: -14.08, lng: 34.92 },
  "Chipoka":    { lat: -13.93, lng: 34.49 }, "Nkhotakota": { lat: -12.92, lng: 34.30 },
  "Rumphi":     { lat: -11.01, lng: 33.87 }, "Chitipa":    { lat:  -9.70, lng: 33.27 },
  "Mulanje":    { lat: -15.93, lng: 35.52 }, "Thyolo":     { lat: -16.07, lng: 35.15 },
};

const AMENITY_ICONS: Record<string, React.ElementType> = {
  "WiFi": Wifi, "AC": AirVent, "Coffee": Coffee,
  "Entertainment": Music, "Charging": Zap, "Reclining Seats": Users,
};

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "time",       label: "Departure Time"    },
  { key: "price_asc",  label: "Price: Low → High" },
  { key: "price_desc", label: "Price: High → Low" },
  { key: "seats",      label: "Most Seats"         },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

class SmartCache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  set(key: string, data: any, ttl = 300000) { this.cache.set(key, { data, timestamp: Date.now(), ttl }); }
  get(key: string) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() - item.timestamp > item.ttl) { this.cache.delete(key); return null; }
    return item.data;
  }
}
const cache = new SmartCache();

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371, dLat = ((lat2-lat1)*Math.PI)/180, dLng = ((lng2-lng1)*Math.PI)/180;
  const a = Math.sin(dLat/2)**2 + Math.cos((lat1*Math.PI)/180)*Math.cos((lat2*Math.PI)/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function nearestCity(lat: number, lng: number): string {
  let best = "Lilongwe", bestDist = Infinity;
  for (const [city, c] of Object.entries(CITY_COORDS)) {
    const d = haversineKm(lat, lng, c.lat, c.lng);
    if (d < bestDist) { bestDist = d; best = city; }
  }
  return best;
}

const isToday = (d: string) => { const a = new Date(d), n = new Date(); return a.getFullYear()===n.getFullYear()&&a.getMonth()===n.getMonth()&&a.getDate()===n.getDate(); };
const isThisWeek = (d: string) => { const t = new Date(d).getTime(), now = Date.now(); return t >= now && t <= now + 7*86_400_000; };
const cityMatch  = (s: EnhancedSchedule, city: string) => { const q = city.toLowerCase(); return s.origin.toLowerCase().includes(q)||s.destination.toLowerCase().includes(q); };
const formatDuration = (m: number) => { const h=Math.floor(m/60),mn=m%60; return h>0?(mn>0?`${h}h ${mn}m`:`${h}h`):`${mn}m`; };
const seatColor  = (a: number, t: number) => { const p=(a/t)*100; return p>50?"text-emerald-600":p>20?"text-amber-500":"text-rose-500"; };
const fillingFast = (a: number, t: number) => t>0&&a/t<=0.2&&a>0;

// ─────────────────────────────────────────────────────────────────────────────
// Skeletons
// ─────────────────────────────────────────────────────────────────────────────

const StatSkeleton = () => (
  <div className="bg-white/80 rounded-2xl p-6 text-center shadow border border-white/20 animate-pulse">
    <div className="w-10 h-10 bg-gray-200 rounded-xl mx-auto mb-3" />
    <div className="h-7 bg-gray-200 rounded w-14 mx-auto mb-2" />
    <div className="h-3 bg-gray-200 rounded w-20 mx-auto" />
  </div>
);

const CardSkeleton = () => (
  <div className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
    <div className="flex gap-3 mb-5">
      <div className="w-11 h-11 bg-gray-200 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2"><div className="h-4 bg-gray-200 rounded w-28"/><div className="h-3 bg-gray-200 rounded w-20"/></div>
      <div className="h-6 bg-gray-200 rounded w-20" />
    </div>
    <div className="h-16 bg-gray-100 rounded-xl mb-4" />
    <div className="grid grid-cols-2 gap-2 mb-4">{[1,2,3,4].map(i=><div key={i} className="h-8 bg-gray-100 rounded-lg"/>)}</div>
    <div className="h-10 bg-gray-200 rounded-xl" />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// City Picker Modal
// ─────────────────────────────────────────────────────────────────────────────

const CityPickerModal = ({ onSelect, onClose, geoStatus, onRequestGeo, current }: {
  onSelect: (c: string) => void; onClose: () => void;
  geoStatus: GeoStatus; onRequestGeo: () => void; current: string | null;
}) => {
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const filtered = MALAWI_CITIES.filter(c => c.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Your City</p>
              <p className="text-xs text-gray-400">See routes near you first</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Geo button */}
          <button onClick={onRequestGeo}
            disabled={geoStatus==="detecting"||geoStatus==="unavailable"}
            className="w-full flex items-center gap-3 px-4 py-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors disabled:opacity-50">
            {geoStatus==="detecting"
              ? <Loader2 className="w-5 h-5 text-blue-600 animate-spin shrink-0"/>
              : <LocateFixed className="w-5 h-5 text-blue-600 shrink-0"/>}
            <div className="text-left">
              <p className="text-sm font-semibold text-blue-800">
                {geoStatus==="detecting"?"Detecting location…":geoStatus==="denied"?"Location access denied":geoStatus==="unavailable"?"Not available":"Use my current location"}
              </p>
              {geoStatus==="denied"&&<p className="text-xs text-blue-500 mt-0.5">Enable location in browser settings</p>}
            </div>
          </button>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
            <input ref={ref} type="text" placeholder="Search city…" value={query}
              onChange={e=>setQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          </div>

          {/* Grid */}
          <div className="max-h-56 overflow-y-auto">
            <div className="grid grid-cols-2 gap-1.5">
              {filtered.map(city=>(
                <button key={city} onClick={()=>onSelect(city)}
                  className={`text-left px-3 py-2.5 rounded-xl text-sm transition-colors ${
                    current===city?"bg-blue-600 text-white font-semibold":"bg-gray-50 text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                  }`}>
                  {city}{current===city&&<span className="ml-1 opacity-70">✓</span>}
                </button>
              ))}
              {!filtered.length&&<p className="col-span-2 text-center text-sm text-gray-400 py-4">No cities found</p>}
            </div>
          </div>

          {current&&(
            <button onClick={()=>onSelect("")}
              className="w-full text-xs text-gray-400 hover:text-rose-500 transition-colors py-1">
              Clear location filter
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Schedule Card
// ─────────────────────────────────────────────────────────────────────────────

const ScheduleCard = React.memo(({ s, onBook, userCity }: {
  s: EnhancedSchedule; onBook: () => void; userCity: string | null;
}) => {
  const filling = fillingFast(s.availableSeats, s.totalSeats);
  const seatCls = seatColor(s.availableSeats, s.totalSeats);
  const isLocal = userCity ? cityMatch(s, userCity) : false;

  return (
    <article className="group bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg hover:border-blue-100 transition-all duration-300 overflow-hidden flex flex-col">
      <div className={`h-[3px] w-full ${filling?"bg-gradient-to-r from-rose-400 to-orange-400":isLocal?"bg-gradient-to-r from-teal-400 to-emerald-500":"bg-gradient-to-r from-blue-500 to-indigo-500"}`}/>

      <div className="p-5 flex flex-col flex-1">
        {/* Company + price */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            {s.companyLogo?(
              <div className="w-11 h-11 rounded-xl overflow-hidden border border-gray-100 shrink-0">
                <img src={s.companyLogo} alt={s.companyName} className="w-full h-full object-cover" loading="lazy"/>
              </div>
            ):(
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-base shrink-0">
                {s.companyName.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm truncate group-hover:text-blue-700 transition-colors">{s.companyName}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{s.busType}</span>
                <span className="flex items-center gap-0.5 text-[11px] text-gray-500">
                  <Star className="w-3 h-3 text-yellow-400 fill-yellow-400"/>4.6
                </span>
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-bold text-blue-700">MWK {s.price.toLocaleString()}</p>
            <p className="text-[11px] text-gray-400">per person</p>
          </div>
        </div>

        {/* Route strip */}
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 mb-3">
          <div className="flex items-center">
            <div className="text-center min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900 truncate">{s.origin}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{s.departureTime}</p>
            </div>
            <div className="flex flex-col items-center gap-0.5 px-3 shrink-0">
              <div className="flex items-center gap-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-300"/>
                <div className="w-7 h-px bg-blue-200"/>
                <ArrowRight className="w-3 h-3 text-blue-500"/>
                <div className="w-7 h-px bg-blue-200"/>
                <div className="w-1.5 h-1.5 rounded-full bg-blue-300"/>
              </div>
              <span className="text-[10px] text-gray-400">{formatDuration(s.duration)}</span>
            </div>
            <div className="text-center min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900 truncate">{s.destination}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{s.arrivalTime}</p>
            </div>
          </div>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 gap-1.5 mb-3">
          {[
            { icon: Calendar, label: new Date(s.date).toLocaleDateString("en-GB",{day:"numeric",month:"short"}), cls: "text-blue-500" },
            { icon: Users,    label: `${s.availableSeats} seats`, cls: seatCls, labelCls: seatCls },
            { icon: MapPin,   label: `${s.distance} km`, cls: "text-blue-500" },
            { icon: BusIcon,  label: s.busNumber, cls: "text-blue-500" },
          ].map(({ icon: Icon, label, cls, labelCls }, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2.5 py-1.5">
              <Icon className={`w-3.5 h-3.5 shrink-0 ${cls}`}/>
              <span className={`text-xs font-medium truncate ${labelCls||"text-gray-700"}`}>{label}</span>
            </div>
          ))}
        </div>

        {/* Amenities */}
        {s.amenities?.length>0&&(
          <div className="flex flex-wrap gap-1 mb-3">
            {s.amenities.slice(0,3).map((a,i)=>{ const Icon=AMENITY_ICONS[a]||Shield; return (
              <span key={i} className="flex items-center gap-1 text-[11px] px-2 py-1 bg-blue-50 text-blue-700 rounded-full">
                <Icon className="w-3 h-3"/>{a}
              </span>
            );})}
            {s.amenities.length>3&&<span className="text-[11px] px-2 py-1 bg-gray-100 text-gray-500 rounded-full">+{s.amenities.length-3}</span>}
          </div>
        )}

        {/* Badges */}
        <div className="flex flex-wrap gap-1 mb-3 min-h-[20px]">
          {filling&&<span className="flex items-center gap-1 text-[11px] px-2 py-1 bg-rose-50 text-rose-600 rounded-full border border-rose-100 font-semibold"><Flame className="w-3 h-3"/>Filling Fast</span>}
          {isToday(s.date)&&<span className="flex items-center gap-1 text-[11px] px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100 font-semibold"><CheckCircle className="w-3 h-3"/>Today</span>}
          {isLocal&&<span className="flex items-center gap-1 text-[11px] px-2 py-1 bg-teal-50 text-teal-700 rounded-full border border-teal-100 font-semibold"><MapPin className="w-3 h-3"/>Near You</span>}
        </div>

        {/* CTA */}
        <button onClick={onBook} disabled={s.availableSeats<=0}
          className="mt-auto w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-100 disabled:text-gray-400 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 group/btn">
          {s.availableSeats<=0?"Fully Booked":<>Book Journey <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform"/></>}
        </button>
      </div>
    </article>
  );
});
ScheduleCard.displayName = "ScheduleCard";

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();

  // ── Search ──────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState<SearchCriteria>({ from:"", to:"", date:"", passengers:1 });

  // ── Schedules ───────────────────────────────────────────────────────────────
  const [schedules, setSchedules]   = useState<EnhancedSchedule[]>([]);
  const [loading,   setLoading]     = useState(true);
  const [error,     setError]       = useState("");
  const [refreshing,setRefreshing]  = useState(false);
  const [isTourOpen,setIsTourOpen]  = useState(false);

  // ── Location ─────────────────────────────────────────────────────────────────
  const [userCity,       setUserCity]       = useState<string|null>(null);
  const [geoStatus,      setGeoStatus]      = useState<GeoStatus>("idle");
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [cityResolved,   setCityResolved]   = useState(false);

  // ── Schedule tabs / sort / pagination ────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabKey>("nearby");
  const [sortKey,   setSortKey]   = useState<SortKey>("time");
  const [page,      setPage]      = useState(1);
  const [showSort,  setShowSort]  = useState(false);

  const stats = useMemo(()=>({ totalRoutes:20, totalCompanies:5, totalBookings:100, avgRating:4.6 }),[]);

  // ── Fetch schedules ──────────────────────────────────────────────────────────
  const fetchSchedules = useCallback(async (refresh=false) => {
    const cacheKey = "home-schedules";
    if (!refresh) { const c = cache.get(cacheKey); if (c) { setSchedules(c); setLoading(false); return; } }
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const now   = new Date();
      const today = Timestamp.fromDate(new Date(now.getFullYear(),now.getMonth(),now.getDate()));
      const schQ  = query(collection(db,"schedules"),where("status","==","active"),where("departureDateTime",">=",today),orderBy("departureDateTime"),limit(30));
      const [compSnap,busSnap,routeSnap] = await Promise.all([
        getDocs(query(collection(db,"companies"),where("status","==","active"))),
        getDocs(query(collection(db,"buses"),where("status","==","active"))),
        getDocs(query(collection(db,"routes"),where("isActive","==",true))),
      ]);
      const cMap = new Map<string,Company>(); compSnap.forEach(d=>cMap.set(d.id,{id:d.id,...d.data()} as Company));
      const bMap = new Map<string,Bus>();     busSnap.forEach(d=>bMap.set(d.id,{id:d.id,...d.data()} as Bus));
      const rMap = new Map<string,Route>();   routeSnap.forEach(d=>rMap.set(d.id,{id:d.id,...d.data()} as Route));

      onSnapshot(schQ,(snap)=>{
        const result: EnhancedSchedule[] = [];
        snap.forEach(d=>{
          const sch = {id:d.id,...d.data()} as Schedule;
          if (sch.availableSeats<=0||sch.departureDateTime.toDate()<new Date()) return;
          const co = cMap.get(sch.companyId), bu = bMap.get(sch.busId), ro = rMap.get(sch.routeId);
          if (!co||!bu||!ro) return;
          const dep = sch.departureDateTime.toDate(), arr = sch.arrivalDateTime.toDate();
          result.push({
            id: sch.id, companyId: sch.companyId, busId: sch.busId, routeId: sch.routeId,
            price: sch.price, availableSeats: sch.availableSeats, totalSeats: bu.capacity||bu.totalSeats||40,
            status: sch.status, date: dep.toISOString().split("T")[0],
            departureTime: dep.toTimeString().slice(0,5), arrivalTime: arr.toTimeString().slice(0,5),
            companyName: co.name, companyLogo: co.logo||co.logoUrl||undefined,
            origin: ro.origin, destination: ro.destination,
            duration: ro.duration, distance: ro.distance,
            busNumber: bu.licensePlate, busType: bu.busType||"Standard",
            amenities: bu.amenities||[],
          });
        });
        result.sort((a,b)=>new Date(`${a.date}T${a.departureTime}`).getTime()-new Date(`${b.date}T${b.departureTime}`).getTime());
        cache.set(cacheKey,result,180000);
        setSchedules(result); setLoading(false); setRefreshing(false);
      },(err)=>{ setError("Failed to load schedules. Check your connection."); setLoading(false); setRefreshing(false); });
    } catch { setError("Failed to load schedules. Please try again."); setLoading(false); setRefreshing(false); }
  },[]);

  useEffect(()=>{ fetchSchedules(); },[fetchSchedules]);

  // ── Init location ────────────────────────────────────────────────────────────
  useEffect(()=>{
    const saved = localStorage.getItem(LS_CITY_KEY);
    if (saved) { setUserCity(saved); setCityResolved(true); return; }
    const asked = localStorage.getItem(LS_GEO_ASKED_KEY);
    if (!asked && "geolocation" in navigator) requestGeolocation();
    else setShowCityPicker(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // ── Auto-select best tab after city+schedules ready ──────────────────────────
  useEffect(()=>{
    if (!cityResolved||loading) return;
    if (userCity) {
      const hasLocal = schedules.some(s=>cityMatch(s,userCity));
      setActiveTab(hasLocal?"nearby":"today");
    } else setActiveTab("today");
  },[cityResolved,loading,userCity,schedules]);

  const requestGeolocation = useCallback(()=>{
    if (!("geolocation" in navigator)) { setGeoStatus("unavailable"); setShowCityPicker(true); return; }
    setGeoStatus("detecting"); localStorage.setItem(LS_GEO_ASKED_KEY,"1");
    navigator.geolocation.getCurrentPosition(
      (pos)=>{ const city=nearestCity(pos.coords.latitude,pos.coords.longitude); setUserCity(city); localStorage.setItem(LS_CITY_KEY,city); setGeoStatus("granted"); setCityResolved(true); setShowCityPicker(false); },
      ()=>{ setGeoStatus("denied"); setCityResolved(true); setShowCityPicker(true); },
      {timeout:8000,maximumAge:600_000}
    );
  },[]);

  const handleSelectCity = useCallback((city: string)=>{
    if (city) { setUserCity(city); localStorage.setItem(LS_CITY_KEY,city); }
    else       { setUserCity(null); localStorage.removeItem(LS_CITY_KEY); }
    setShowCityPicker(false); setCityResolved(true); setPage(1);
  },[]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleSearch = useCallback(()=>{
    const p = new URLSearchParams({ from:search.from.trim(), to:search.to.trim(), date:search.date, passengers:String(Math.max(1,search.passengers)) } as any);
    router.push(`/search?${p}`);
  },[router,search]);

  const handleBooking = useCallback((id: string)=>{
    if (!user) { router.push("/login"); return; }
    router.push(`/book/${id}?passengers=${search.passengers||1}`);
  },[router,search.passengers,user]);

  // ── Derived schedule data ────────────────────────────────────────────────────
  const nearby = useMemo(()=>userCity?schedules.filter(s=>cityMatch(s,userCity)):[], [schedules,userCity]);

  const tabCounts = useMemo(()=>({
    nearby: nearby.length,
    today:  schedules.filter(s=>isToday(s.date)).length,
    week:   schedules.filter(s=>isThisWeek(s.date)).length,
    all:    schedules.length,
  }),[schedules,nearby]);

  const filtered = useMemo(()=>{
    let list = activeTab==="nearby"?nearby:activeTab==="today"?schedules.filter(s=>isToday(s.date)):activeTab==="week"?schedules.filter(s=>isThisWeek(s.date)):schedules;
    return [...list].sort((a,b)=>{
      if (sortKey==="price_asc")  return a.price-b.price;
      if (sortKey==="price_desc") return b.price-a.price;
      if (sortKey==="seats")      return b.availableSeats-a.availableSeats;
      return new Date(`${a.date}T${a.departureTime}`).getTime()-new Date(`${b.date}T${b.departureTime}`).getTime();
    });
  },[schedules,nearby,activeTab,sortKey]);

  const totalPages = Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  const paged      = filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);

  const changeTab  = useCallback((t:TabKey)=>{ setActiveTab(t); setPage(1); },[]);
  const changePage = useCallback((p:number)=>{ setPage(p); document.getElementById("schedules-section")?.scrollIntoView({behavior:"smooth",block:"start"}); },[]);

  const TABS = [
    { key:"nearby" as TabKey, label:"Near You",  icon:Navigation, onlyCity:true },
    { key:"today"  as TabKey, label:"Today",     icon:Flame },
    { key:"week"   as TabKey, label:"This Week", icon:Calendar },
    { key:"all"    as TabKey, label:"All",       icon:BusIcon },
  ].filter(t=>!(t.onlyCity&&!userCity));

  const emptyMsg: Record<TabKey,{title:string;body:string;cta?:{label:string;fn:()=>void}}> = {
    nearby: { title:`No routes near ${userCity}`,    body:"No schedules from your city right now.", cta:{label:"Browse all →",fn:()=>changeTab("all")} },
    today:  { title:"No departures today",           body:"Try This Week to see upcoming trips.",   cta:{label:"View this week →",fn:()=>changeTab("week")} },
    week:   { title:"No departures this week",       body:"Browse all available schedules.",        cta:{label:"View all →",fn:()=>changeTab("all")} },
    all:    { title:"No schedules available",        body:"Check back soon or refresh." },
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Global styles */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600&display=swap');
        body { font-family: 'DM Sans', sans-serif; }
        .font-display { font-family: 'Plus Jakarta Sans', sans-serif; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes scaleIn { from{opacity:0;transform:scale(.95)} to{opacity:1;transform:scale(1)} }
        .anim-fade-up  { animation: fadeUp  .7s ease-out both }
        .anim-scale-in { animation: scaleIn .5s ease-out both }
        .delay-100{animation-delay:.1s} .delay-200{animation-delay:.2s}
        .delay-300{animation-delay:.3s} .delay-400{animation-delay:.4s}
      `}</style>

      {showCityPicker&&(
        <CityPickerModal onSelect={handleSelectCity} onClose={()=>{setShowCityPicker(false);setCityResolved(true);}}
          geoStatus={geoStatus} onRequestGeo={requestGeolocation} current={userCity}/>
      )}

      {/* ── HERO ──────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-blue-500/10 blur-3xl"/>
          <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] rounded-full bg-indigo-500/10 blur-3xl"/>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-blue-600/5 blur-3xl"/>
          {/* Grid lines */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)"/>
          </svg>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: copy */}
            <div className="anim-fade-up">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-400/30 text-blue-300 rounded-full text-sm font-medium mb-6">
                <Zap className="w-3.5 h-3.5"/> Malawi's #1 Bus Booking Platform
              </div>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.08] tracking-tight mb-6">
                Travel Anywhere<br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">
                  in Malawi
                </span>
              </h1>
              <p className="text-slate-400 text-lg leading-relaxed mb-8 max-w-lg">
                Find, compare and book bus seats instantly. Real-time availability, secure payments, and routes across the entire country.
              </p>
              <div className="flex flex-wrap gap-5 mb-8">
                {[
                  { icon: CheckCircle, label: "Instant Booking",  col: "text-emerald-400" },
                  { icon: Shield,      label: "Secure Payment",   col: "text-blue-400" },
                  { icon: Users,       label: "24/7 Support",     col: "text-indigo-400" },
                ].map(({ icon: Icon, label, col })=>(
                  <div key={label} className="flex items-center gap-2 text-slate-400">
                    <Icon className={`w-4 h-4 ${col}`}/><span className="text-sm font-medium">{label}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <button onClick={handleSearch}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-blue-900/40">
                  <Search className="w-4 h-4"/> Find Your Journey
                </button>
                <button onClick={()=>setIsTourOpen(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-medium rounded-xl transition-colors">
                  <Play className="w-4 h-4"/> Take a Tour
                </button>
              </div>
            </div>

            {/* Right: illustration */}
            <div className="relative flex justify-center anim-fade-up delay-200">
              <div className="relative w-full max-w-md">
                <img src="/Bus driver-rafiki.svg" alt="Bus illustration"
                  className="w-full h-auto drop-shadow-2xl"
                  style={{ filter:"hue-rotate(15deg) saturate(1.1) brightness(1.05)" }} loading="lazy"/>
                {/* Floating badges */}
                <div className="absolute top-4 -right-4 bg-white rounded-2xl shadow-xl px-4 py-3 flex items-center gap-2.5 anim-scale-in delay-300">
                  <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-emerald-600"/>
                  </div>
                  <div><p className="text-xs text-gray-500">Instant confirm</p><p className="text-sm font-bold text-gray-900">Booked!</p></div>
                </div>
                <div className="absolute -bottom-2 -left-4 bg-white rounded-2xl shadow-xl px-4 py-3 flex items-center gap-2.5 anim-scale-in delay-400">
                  <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
                    <BusIcon className="w-4 h-4 text-blue-600"/>
                  </div>
                  <div><p className="text-xs text-gray-500">Routes available</p><p className="text-sm font-bold text-gray-900">20+ Routes</p></div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Search box ──────────────────────────────────────────────────────── */}
          <div className="mt-12 bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl p-6 anim-fade-up delay-300">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">From</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                  <input type="text" placeholder="Departure city" value={search.from}
                    onChange={e=>setSearch(p=>({...p,from:e.target.value}))}
                    className="w-full pl-9 pr-3 h-11 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"/>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">To</label>
                <div className="relative">
                  <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                  <input type="text" placeholder="Destination city" value={search.to}
                    onChange={e=>setSearch(p=>({...p,to:e.target.value}))}
                    className="w-full pl-9 pr-3 h-11 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"/>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                  <input type="date" value={search.date}
                    onChange={e=>setSearch(p=>({...p,date:e.target.value}))}
                    className="w-full pl-9 pr-3 h-11 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"/>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Passengers</label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                  <input type="number" min="1" value={search.passengers}
                    onChange={e=>setSearch(p=>({...p,passengers:Math.max(1,parseInt(e.target.value)||1)}))}
                    className="w-full pl-9 pr-3 h-11 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"/>
                </div>
              </div>
              <div className="flex items-end">
                <button onClick={handleSearch}
                  className="w-full h-11 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-md shadow-blue-200">
                  <Search className="w-4 h-4"/> Search Buses
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ─────────────────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-1 py-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? Array(4).fill(0).map((_,i)=><StatSkeleton key={i}/>) : (
            [
              { icon: Navigation, label:"Active Routes",     value: stats.totalRoutes,                  gradient:"from-blue-500 to-cyan-500" },
              { icon: BusIcon,    label:"Partner Companies", value: stats.totalCompanies,               gradient:"from-violet-500 to-indigo-500" },
              { icon: Users,      label:"Happy Travellers",  value: `${stats.totalBookings}+`,          gradient:"from-emerald-500 to-teal-500" },
              { icon: Award,      label:"Customer Rating",   value: stats.avgRating.toFixed(1),         gradient:"from-amber-500 to-orange-500" },
            ].map(({ icon: Icon, label, value, gradient },i)=>(
              <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0`}>
                  <Icon className="w-6 h-6 text-white"/>
                </div>
                <div>
                  <p className="text-2xl font-display font-extrabold text-gray-900">{value}</p>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">{label}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <PromoBanner onCtaClick={()=>router.push("/promotions")}/>

      {/* ── FEATURED SCHEDULES ────────────────────────────────────────────────── */}
      <section id="schedules-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-1">Live Availability</p>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-gray-900">Featured Routes</h2>
            <p className="text-gray-500 text-sm mt-1">Real-time seats across Malawi</p>
          </div>
          <button onClick={()=>router.push("/schedules")}
            className="group flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors shrink-0">
            View all routes <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform"/>
          </button>
        </div>

        {/* Error */}
        {error&&(
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-6 flex items-center justify-between gap-4">
            <p className="text-red-700 text-sm font-medium">{error}</p>
            <button onClick={()=>fetchSchedules(true)} disabled={refreshing}
              className="flex items-center gap-1.5 text-sm text-red-700 font-semibold border border-red-200 rounded-xl px-3 py-1.5 hover:bg-red-50 disabled:opacity-50 shrink-0">
              {refreshing?<Loader2 className="w-4 h-4 animate-spin"/>:<RefreshCw className="w-4 h-4"/>} Retry
            </button>
          </div>
        )}

        {/* Controls */}
        {!loading&&(
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Tabs */}
              <div className="flex items-center bg-white border border-gray-200 rounded-xl p-1 gap-0.5 shadow-sm">
                {TABS.map(({ key, label, icon: Icon })=>(
                  <button key={key} onClick={()=>changeTab(key)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                      activeTab===key
                        ? key==="nearby"?"bg-teal-600 text-white shadow-sm":"bg-blue-600 text-white shadow-sm"
                        : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                    }`}>
                    <Icon className="w-3.5 h-3.5"/>
                    {label}
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                      activeTab===key?"bg-white/25 text-white":"bg-gray-100 text-gray-500"
                    }`}>{tabCounts[key]}</span>
                  </button>
                ))}
              </div>

              {/* Location pill */}
              <button onClick={()=>setShowCityPicker(true)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                  userCity?"bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100":"bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}>
                {geoStatus==="detecting"?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:<MapPin className="w-3.5 h-3.5"/>}
                {userCity??"Set location"}
                <ChevronDown className="w-3 h-3 opacity-50"/>
              </button>
            </div>

            {/* Sort */}
            <div className="relative shrink-0">
              <button onClick={()=>setShowSort(s=>!s)}
                className="flex items-center gap-2 px-3.5 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:text-blue-700 transition-colors font-medium shadow-sm whitespace-nowrap">
                <ArrowUpDown className="w-4 h-4"/>
                {SORT_OPTIONS.find(o=>o.key===sortKey)?.label}
              </button>
              {showSort&&(
                <div className="absolute right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-20 py-1.5 min-w-[180px]">
                  {SORT_OPTIONS.map(o=>(
                    <button key={o.key} onClick={()=>{setSortKey(o.key);setShowSort(false);setPage(1);}}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                        sortKey===o.key?"bg-blue-50 text-blue-700 font-semibold":"text-gray-700 hover:bg-gray-50"
                      }`}>
                      {sortKey===o.key&&<span className="mr-1.5 text-blue-500">✓</span>}{o.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Near you banner */}
        {!loading&&activeTab==="nearby"&&userCity&&tabCounts.nearby>0&&(
          <div className="flex items-center gap-3 bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 mb-5">
            <Navigation className="w-4 h-4 text-teal-600 shrink-0"/>
            <p className="text-sm text-teal-800">
              Showing <span className="font-semibold">{tabCounts.nearby}</span> route{tabCounts.nearby!==1?"s":""} from or to <span className="font-semibold">{userCity}</span>
            </p>
            <button onClick={()=>setShowCityPicker(true)}
              className="ml-auto text-xs text-teal-600 hover:text-teal-800 font-semibold underline underline-offset-2 shrink-0">
              Change
            </button>
          </div>
        )}

        {/* Grid */}
        {loading?(
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
            {Array(6).fill(0).map((_,i)=><CardSkeleton key={i}/>)}
          </div>
        ):paged.length>0?(
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
            {paged.map(s=><ScheduleCard key={s.id} s={s} userCity={userCity} onBook={()=>handleBooking(s.id)}/>)}
          </div>
        ):(
          <div className="bg-white rounded-2xl border border-gray-100 p-14 text-center mb-8 shadow-sm">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              {activeTab==="nearby"?<MapPin className="w-8 h-8 text-gray-300"/>:<BusIcon className="w-8 h-8 text-gray-300"/>}
            </div>
            <h3 className="font-display text-lg font-bold text-gray-800 mb-2">{emptyMsg[activeTab].title}</h3>
            <p className="text-gray-500 text-sm mb-5 max-w-xs mx-auto">{emptyMsg[activeTab].body}</p>
            {emptyMsg[activeTab].cta?(
              <button onClick={emptyMsg[activeTab].cta!.fn} className="text-sm text-blue-600 hover:underline font-semibold">
                {emptyMsg[activeTab].cta!.label}
              </button>
            ):(
              <button onClick={()=>fetchSchedules(true)} disabled={refreshing}
                className="flex items-center gap-2 mx-auto text-sm border border-gray-200 rounded-xl px-4 py-2 text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                {refreshing?<Loader2 className="w-4 h-4 animate-spin"/>:<RefreshCw className="w-4 h-4"/>} Refresh
              </button>
            )}
          </div>
        )}

        {/* Pagination */}
        {!loading&&totalPages>1&&(
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border border-gray-100 rounded-2xl px-5 py-3.5 shadow-sm">
            <p className="text-sm text-gray-500">
              Showing <span className="font-semibold text-gray-800">{(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,filtered.length)}</span> of <span className="font-semibold text-gray-800">{filtered.length}</span> schedules
            </p>
            <div className="flex items-center gap-1.5">
              <button onClick={()=>changePage(page-1)} disabled={page===1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                <ChevronLeft className="w-4 h-4"/>
              </button>
              {Array.from({length:totalPages},(_,i)=>i+1).map(p=>(
                <button key={p} onClick={()=>changePage(p)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                    p===page?"bg-blue-600 text-white":"border border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}>{p}</button>
              ))}
              <button onClick={()=>changePage(page+1)} disabled={page===totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                <ChevronRight className="w-4 h-4"/>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── HOW IT WORKS + REST ────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <HowItWorks/>
      </div>

      <TourModal open={isTourOpen} onClose={()=>setIsTourOpen(false)}/>
    </div>
  );
}