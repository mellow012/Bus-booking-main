"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  MapPin, Loader2, ChevronDown, Flame, Coffee, Sun, Moon, ArrowUpDown, RefreshCw, ArrowRight, ChevronLeft
} from "lucide-react";
import { ScheduleCard } from "@/components/ScheduleCard";
import AlertMessage from "@/components/AlertMessage";
import { EnhancedSchedule, isToday, getScheduleCategory, GeoStatus, cityMatch, nearestCity } from "@/utils/homeHelpers";
import { CityPickerModal } from "@/components/CityPickerModal";

const LS_CITY_KEY = "tb_user_city";

const SORT_OPTIONS = [
  { value: "time", label: "Earliest Departure" },
  { value: "price_asc", label: "Lowest Price" },
  { value: "price_desc", label: "Highest Price" },
  { value: "seats", label: "Most Seats" },
];

const PAGE_SIZE = 4;

const CardSkeleton = () => <div className="h-48 bg-gray-100 rounded-2xl animate-pulse" />;

export default function HomeSchedules() {
  const router = useRouter();
  const { user } = useAuth();

  const [schedules, setSchedules] = useState<EnhancedSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [userCity, setUserCity] = useState<string|null>(null);
  const [sortKey, setSortKey] = useState("time");
  const [showSort, setShowSort] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const [currentPage, setCurrentPage] = useState(1);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSchedules = useCallback(async (refresh = false, silent = false) => {
    if (!silent) {
      refresh ? setRefreshing(true) : setLoading(true);
    }
    setError("");

    try {
      const cityQuery = userCity ? `&from=${encodeURIComponent(userCity)}` : '';
      const response = await fetch(`/api/schedules?limit=30&sortBy=time${cityQuery}`);
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const { data, success } = await response.json();
      if (success) setSchedules(data);
    } catch (err) {
      console.error('Failed to fetch schedules:', err);
      setError("Failed to load schedules.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userCity]);

  useEffect(() => {
    fetchSchedules();
    pollingIntervalRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') fetchSchedules(false, true);
    }, 45000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchSchedules(false, true);
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchSchedules]);

  useEffect(() => {
    const saved = localStorage.getItem(LS_CITY_KEY);
    if (saved) setUserCity(saved);
  }, []);

  const handleSelectCity = (city: string) => {
    if (city) {
      setUserCity(city);
      localStorage.setItem(LS_CITY_KEY, city);
    } else {
      setUserCity(null);
      localStorage.removeItem(LS_CITY_KEY);
    }
    setCurrentPage(1); // Reset page on city change
    setShowCityPicker(false);
  };

  const requestGeolocation = () => {
    if (!("geolocation" in navigator)) { setGeoStatus("unavailable"); return; }
    setGeoStatus("detecting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const city = nearestCity(pos.coords.latitude, pos.coords.longitude);
        setUserCity(city);
        localStorage.setItem(LS_CITY_KEY, city);
        setCurrentPage(1);
        setGeoStatus("granted");
        setShowCityPicker(false);
      },
      () => setGeoStatus("denied")
    );
  };

  const handleBooking = (id: string) => {
    if (!user) { router.push("/login"); return; }
    router.push(`/book/${id}`);
  };

  const filtered = useMemo(() => {
    // Apply city filter if selected
    let pool = schedules;
    if (userCity) {
      pool = schedules.filter(s => cityMatch(s, userCity));
    }

    // 1. Try Today's trips from the pool
    let results = pool.filter(s => isToday(s.date));
    
    // 2. Fallback to Tomorrow if Today is empty
    if (results.length === 0) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      results = pool.filter(s => s.date === tomorrowStr);
    }

    // 3. Fallback to any Upcoming if Tomorrow is also empty
    if (results.length === 0) {
      const now = new Date();
      results = pool.filter(s => new Date(s.date) > now);
    }

    return [...results].sort((a, b) => {
      // Prioritize active trips (In Transit, Boarding, Arrived)
      const aActive = (a.status === 'en_route' || a.status === 'boarding' || a.status === 'arrived');
      const bActive = (b.status === 'en_route' || b.status === 'boarding' || b.status === 'arrived');
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;

      if (sortKey === "price_asc") return a.price - b.price;
      if (sortKey === "price_desc") return b.price - a.price;
      if (sortKey === "seats") return b.availableSeats - a.availableSeats;
      return new Date(`${a.date}T${a.departureTime}`).getTime() - new Date(`${b.date}T${b.departureTime}`).getTime();
    });
  }, [schedules, sortKey, userCity]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  
  const currentSchedules = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  const groups = useMemo(() => {
    return [
      { label: 'Boarding Now', icon: Flame, items: currentSchedules.filter(s => getScheduleCategory(s) === 'Boarding Now') },
      { label: 'Morning', icon: Coffee, items: currentSchedules.filter(s => getScheduleCategory(s) === 'Morning') },
      { label: 'Afternoon', icon: Sun, items: currentSchedules.filter(s => getScheduleCategory(s) === 'Afternoon') },
      { label: 'Evening', icon: Moon, items: currentSchedules.filter(s => getScheduleCategory(s) === 'Evening') },
    ].filter(g => g.items.length > 0);
  }, [currentSchedules]);

  return (
    <section id="schedules-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-1">Live Availability</p>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-gray-900">
            {userCity ? `Featured Routes in ${userCity}` : "Featured Routes"}
          </h2>
          <p className="text-gray-500 text-sm mt-1">{userCity ? `Showing buses for ${userCity}` : "Real-time seats across Malawi"}</p>
        </div>
        <button onClick={()=>router.push("/schedules")} className="group flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors">
          View all routes <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform"/>
        </button>
      </div>

      {error && <AlertMessage type="error" message={error} onClose={() => setError('')} />}

      {!loading && (
        <div className="flex flex-col gap-3 mb-5">
          <div className="flex items-center justify-between gap-2">
            <div className="relative">
              <button onClick={() => setShowSort(s => !s)} className="flex items-center gap-2 px-3.5 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:border-blue-300 transition-all shadow-sm">
                <ArrowUpDown className="w-4 h-4"/>
                <span>{SORT_OPTIONS.find(o => o.value === sortKey)?.label}</span>
              </button>
              {showSort && (
                <div className="absolute left-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-30 py-1.5 min-w-[180px]">
                  {SORT_OPTIONS.map(o => (
                    <button key={o.value} onClick={() => { setSortKey(o.value); setShowSort(false); }} className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${sortKey === o.value ? "bg-blue-50 text-blue-700 font-semibold" : "text-gray-700 hover:bg-gray-50"}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button 
              onClick={() => setShowCityPicker(true)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-all hover:shadow-md active:scale-95 ${userCity ? "bg-teal-50 border-teal-200 text-teal-700" : "bg-white border-gray-200 text-gray-500"}`}
            >
              <MapPin className="w-3.5 h-3.5"/> {userCity ?? "Malawi"}
              <ChevronDown className="w-3 h-3 opacity-50" />
            </button>
          </div>
        </div>
      )}

      {showCityPicker && (
        <CityPickerModal 
          onSelect={handleSelectCity} 
          onClose={() => setShowCityPicker(false)}
          geoStatus={geoStatus} 
          onRequestGeo={requestGeolocation} 
          current={userCity}
        />
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
          {Array(6).fill(0).map((_,i)=><CardSkeleton key={i}/>)}
        </div>
      ) : groups.length > 0 ? (
        <div className="flex flex-col lg:flex-row gap-10 lg:gap-6 xl:gap-8 mb-10 overflow-x-auto pb-4 items-start">
          {groups.map(group => (
            <div key={group.label} className="w-full lg:flex-1 lg:min-w-[320px]">
              <div className="flex items-center gap-2 mb-4 sticky top-0 bg-gray-50/95 backdrop-blur-sm z-10 py-2">
                <group.icon className={`w-5 h-5 ${group.label === 'Boarding Now' ? 'text-orange-500 animate-pulse' : 'text-blue-500'}`} />
                <h3 className="font-display text-lg font-extrabold text-gray-900">{group.label}</h3>
                <span className="ml-auto text-[10px] font-bold text-gray-500 bg-gray-200 px-2.5 py-1 rounded-full">{group.items.length}</span>
              </div>
              <div className={`flex flex-row overflow-x-auto pb-6 px-4 -mx-4 lg:mx-0 lg:px-0 lg:overflow-x-visible lg:pb-0 gap-5 ${
                groups.length === 1 
                  ? "lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:flex-none" 
                  : "lg:flex-col"
              }`}>
                {group.items.map(s => (
                  <div key={s.id} className={`shrink-0 ${
                    groups.length === 1 
                      ? "min-w-[85vw] sm:min-w-[340px] lg:min-w-0" 
                      : "min-w-[85vw] sm:min-w-[340px] lg:min-w-0 lg:w-full"
                  }`}>
                    <ScheduleCard s={s} userCity={userCity} onBook={()=>handleBooking(s.id)}/>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 p-10 sm:p-16 text-center mb-8 shadow-sm flex flex-col items-center">
          <img 
            src="/Bus stop-rafiki.svg" 
            alt="No schedules" 
            className="w-full max-w-[240px] h-auto mb-6 opacity-80"
            style={{ filter: "hue-rotate(10deg)" }}
          />
          <h3 className="font-display text-xl font-extrabold text-gray-900 mb-2">No upcoming buses found</h3>
          <p className="text-gray-500 text-sm max-w-xs mx-auto mb-8">We couldn't find any active or upcoming schedules. Try refreshing or check back later.</p>
          <button onClick={()=>fetchSchedules(true)} disabled={refreshing} className="flex items-center gap-2 mx-auto text-sm font-bold bg-gray-50 border border-gray-200 rounded-xl px-6 py-3 text-gray-700 hover:bg-gray-100 transition-colors">
            {refreshing?<Loader2 className="w-4 h-4 animate-spin"/>:<RefreshCw className="w-4 h-4"/>} Refresh Live Data
          </button>
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-8 pb-4">
          <button 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            className="p-2 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-blue-300 disabled:opacity-40 disabled:hover:bg-white disabled:hover:border-gray-200 transition-all shadow-sm active:scale-95"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalPages }).map((_, i) => {
              const page = i + 1;
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${
                    currentPage === page 
                      ? "bg-blue-600 text-white shadow-md shadow-blue-200 scale-105" 
                      : "bg-white border border-gray-100 text-gray-400 hover:border-blue-200 hover:text-blue-500"
                  }`}
                >
                  {page}
                </button>
              );
            })}
          </div>

          <button 
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            className="p-2 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-blue-300 disabled:opacity-40 disabled:hover:bg-white disabled:hover:border-gray-200 transition-all shadow-sm active:scale-95"
            aria-label="Next page"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </section>
  );
}
