"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  MapPin, Loader2, ChevronDown, Flame, Coffee, Sun, Moon, ArrowUpDown, RefreshCw, ArrowRight, ChevronLeft, ChevronRight
} from "lucide-react";
import { ScheduleCard } from "@/components/ScheduleCard";
import AlertMessage from "@/components/AlertMessage";
import { EnhancedSchedule, isToday, getScheduleCategory, GeoStatus, cityMatch, nearestCity } from "@/utils/homeHelpers";
import { CityPickerModal } from "@/components/CityPickerModal";
import Image from "next/image";
import { createClient } from "@/utils/supabase/client";

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
  const [isReady, setIsReady] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Reset page on category changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory]);


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

  // Sync with general city preference changes from other components
  useEffect(() => {
    const handleCityChange = (e: Event) => {
      const customEvent = e as CustomEvent<string | null>;
      const city = customEvent.detail;
      setUserCity(city);
      setCurrentPage(1);
    };
    window.addEventListener("tb-user-city-changed", handleCityChange);
    return () => {
      window.removeEventListener("tb-user-city-changed", handleCityChange);
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;
    fetchSchedules();

    const supabase = createClient();
    const channel = supabase
      .channel("home-schedules")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "Schedule" },
        () => {
          if (document.visibilityState === "visible") fetchSchedules(false, true);
        }
      )
      .subscribe();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchSchedules(false, true);
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isReady, fetchSchedules]);

  useEffect(() => {
    const saved = localStorage.getItem(LS_CITY_KEY);
    if (saved) setUserCity(saved);
    setIsReady(true);
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
    window.dispatchEvent(new CustomEvent("tb-user-city-changed", { detail: city }));
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
        window.dispatchEvent(new CustomEvent("tb-user-city-changed", { detail: city }));
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

    // Show all schedules without restricting to just today or tomorrow
    let results = pool;

    // Apply time category filter if selected
    if (selectedCategory) {
      results = results.filter(s => getScheduleCategory(s) === selectedCategory);
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
  }, [schedules, sortKey, userCity, selectedCategory]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const handleScrollEvent = useCallback(() => {
    if (isScrollingRef.current) return;
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const scrollPos = container.scrollLeft;
      const cardWidth = container.scrollWidth / filtered.length;
      if (cardWidth > 0) {
        const activeCardIndex = Math.round(scrollPos / cardWidth);
        const computedPage = Math.floor(activeCardIndex / PAGE_SIZE) + 1;
        const boundedPage = Math.max(1, Math.min(totalPages, computedPage));
        if (boundedPage !== currentPage) {
          setCurrentPage(boundedPage);
        }
      }
    }
  }, [filtered.length, totalPages, currentPage]);

  const handlePageChange = (page: number) => {
    isScrollingRef.current = true;
    setCurrentPage(page);
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const cardWidth = container.scrollWidth / filtered.length;
      const targetScroll = (page - 1) * PAGE_SIZE * cardWidth;
      container.scrollTo({
        left: targetScroll,
        behavior: 'smooth'
      });
      setTimeout(() => {
        isScrollingRef.current = false;
      }, 500);
    } else {
      isScrollingRef.current = false;
    }
  };

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const scrollAmount = container.clientWidth * 0.75;
      const targetScroll = container.scrollLeft + (direction === 'left' ? -scrollAmount : scrollAmount);
      container.scrollTo({
        left: targetScroll,
        behavior: 'smooth'
      });
    }
  };

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
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Sorting and Location Controls */}
            <div className="flex items-center gap-3">
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

            {/* Time Slot Quick Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mr-1">Time:</span>
              {['All', 'Morning', 'Afternoon', 'Evening'].map((cat) => {
                const isSelected = (cat === 'All' && !selectedCategory) || selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat === 'All' ? null : cat)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 whitespace-nowrap ${
                      isSelected
                        ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                        : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
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
        <div className="flex gap-5 overflow-x-auto pb-6 px-4 -mx-4 sm:mx-0 sm:px-0">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="shrink-0 w-[85vw] sm:w-[350px] md:w-[380px] h-48 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="relative group/swiper mb-10">
          {/* Left Arrow Button */}
          <button 
            onClick={() => handleScroll('left')}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 shadow-xl border border-gray-100 flex items-center justify-center text-gray-700 hover:bg-white hover:text-blue-600 hover:scale-105 active:scale-95 transition-all z-20 opacity-0 group-hover/swiper:opacity-100 hidden md:flex"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          {/* Right Arrow Button */}
          <button 
            onClick={() => handleScroll('right')}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 shadow-xl border border-gray-100 flex items-center justify-center text-gray-700 hover:bg-white hover:text-blue-600 hover:scale-105 active:scale-95 transition-all z-20 opacity-0 group-hover/swiper:opacity-100 hidden md:flex"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          {/* Swipe Track Container */}
          <div 
            ref={scrollContainerRef}
            onScroll={handleScrollEvent}
            className="flex flex-row overflow-x-auto gap-5 pb-6 px-4 -mx-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scroll-smooth no-scrollbar scrollbar-thin scrollbar-thumb-gray-200"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {filtered.map((s) => (
              <div 
                key={s.id} 
                className="snap-start shrink-0 w-[85vw] sm:w-[350px] md:w-[380px]"
              >
                <ScheduleCard s={s} userCity={userCity} onBook={() => handleBooking(s.id)}/>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 p-10 sm:p-16 text-center mb-8 shadow-sm flex flex-col items-center">
          <Image 
            src="/Bus stop-rafiki.svg" 
            alt="No schedules" 
            width={300} height={300}
            className="w-full max-w-[240px] h-auto mb-6 opacity-80"
            style={{ filter: "hue-rotate(10deg)" }}
          />
          <h3 className="font-display text-xl font-extrabold text-gray-900 mb-2">No upcoming buses found</h3>
          <p className="text-gray-500 text-sm max-w-xs mx-auto mb-8">We couldn't find any active or upcoming schedules. Try refreshing or check back later.</p>
          <button onClick={() => fetchSchedules(true)} disabled={refreshing} className="flex items-center gap-2 mx-auto text-sm font-bold bg-gray-50 border border-gray-200 rounded-xl px-6 py-3 text-gray-700 hover:bg-gray-100 transition-colors">
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Refresh Live Data
          </button>
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-8 pb-4">
          <button 
            disabled={currentPage === 1}
            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
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
                  onClick={() => handlePageChange(page)}
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
            onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
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
