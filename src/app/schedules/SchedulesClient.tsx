"use client";

import React, { useState, useEffect, useCallback, useMemo, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  Search, MapPin, Calendar, Users, Navigation, Clock, CheckCircle, Bus as BusIcon,
  Filter, AlertCircle, RefreshCw, Zap, TrendingUp, Loader2, ArrowRight, User, Star, X, ChevronLeft, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import BackButton from "@/components/BackButton";
import { LocationAutocomplete } from "@/components/LocationAutocomplete";
import { MALAWI_CITIES, getScheduleCategory } from "@/utils/homeHelpers";
import { useNotifications } from "@/contexts/NotificationContext";
import { useAppToast } from "@/contexts/ToastContext";
import Image from "next/image";
import { ScheduleCard } from "@/components/ScheduleCard";

interface EnhancedSchedule {
  id: string;
  companyName: string;
  busNumber: string;
  busType: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  availableSeats: number;
  price: number;
  duration: number;
  date: string;
  companyLogo?: string | null;
  companyId: string;
  routeId: string;
  departureLocation?: string;
  arrivalLocation?: string;
}



export default function SchedulesClient({
  initialSchedules,
  initialCompanies
}: {
  initialSchedules: EnhancedSchedule[];
  initialCompanies: { id: string, name: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userProfile } = useAuth();
  const { unreadCount } = useNotifications();
  const toast = useAppToast();

  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  // Data state
  const [schedules, setSchedules] = useState<EnhancedSchedule[]>(initialSchedules);
  const [companies, setCompanies] = useState<{ id: string, name: string }[]>(initialCompanies);

  // Search/Filter state
  const [searchFrom, setSearchFrom] = useState(searchParams.get('from') || "");
  const [searchTo, setSearchTo] = useState(searchParams.get('to') || "");
  const [searchDate, setSearchDate] = useState(searchParams.get('date') || "");
  const [passengers, setPassengers] = useState(parseInt(searchParams.get('passengers') || "1"));

  const [activeFilter, setActiveFilter] = useState("all");
  const [sortBy, setSortBy] = useState<'price' | 'time' | 'company'>('price');

  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("");
  const [selectedTerminal, setSelectedTerminal] = useState(searchParams.get('terminal') || "");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  const [popularRoutes, setPopularRoutes] = useState<any[]>([]);
  const [userCity, setUserCity] = useState<string | null>(null);
  const todayDate = new Date().toISOString().split('T')[0];
  const tomorrowDateStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);
  const isFutureDateSearch = Boolean(searchDate && searchDate > todayDate);
  const hasActiveSearch = Boolean(searchFrom || searchTo || searchDate);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("tb_user_city");
      if (saved) {
        setUserCity(saved);
      }
      
      const handleCityChange = (e: Event) => {
        const customEvent = e as CustomEvent<string | null>;
        setUserCity(customEvent.detail);
      };
      window.addEventListener("tb-user-city-changed", handleCityChange);
      return () => {
        window.removeEventListener("tb-user-city-changed", handleCityChange);
      };
    }
  }, []);

  // Reset page when any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchFrom, searchTo, searchDate, activeFilter, sortBy, selectedCompany, selectedTimeSlot, selectedTerminal, selectedCategory]);

  // Auth protection - only redirect if trying to access private parts
  // Removed strict page-level redirect as /schedules is public




  const handleSearch = useCallback(async () => {
    setSearching(true);
    setError("");
    try {
      const queryParams = new URLSearchParams();
      if (searchFrom) queryParams.append('from', searchFrom);
      if (searchTo) queryParams.append('to', searchTo);
      if (searchDate) queryParams.append('date', searchDate);
      queryParams.append('sortBy', 'departureDateTime');
      queryParams.append('limit', '150');

      const schedulesRes = await fetch(`/api/schedules?${queryParams}`);
      if (!schedulesRes.ok) throw new Error("Failed to load schedules");
      const { data: apiSchedules } = await schedulesRes.json();

      const enhancedSchedules: EnhancedSchedule[] = apiSchedules
        .map((schedule: any) => ({
          id: schedule.id,
          companyName: schedule.companyName,
          busNumber: schedule.busNumber,
          busType: schedule.busType,
          origin: schedule.origin,
          destination: schedule.destination,
          departureTime: new Date(schedule.departureDateTime).toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', hour12: false
          }),
          arrivalTime: new Date(schedule.arrivalDateTime).toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', hour12: false
          }),
          availableSeats: schedule.availableSeats,
          price: schedule.price,
          duration: schedule.duration || 0,
          date: new Date(schedule.departureDateTime).toISOString().split('T')[0],
          companyLogo: schedule.companyLogo || null,
          companyId: schedule.companyId,
          routeId: schedule.routeId,
          departureLocation: schedule.departureLocation,
          arrivalLocation: schedule.arrivalLocation
        }));

      setSchedules(enhancedSchedules);

      // Update URL search parameters without full page reload
      const newParams = new URLSearchParams();
      if (searchFrom) newParams.set('from', searchFrom);
      if (searchTo) newParams.set('to', searchTo);
      if (searchDate) newParams.set('date', searchDate);
      newParams.set('passengers', passengers.toString());
      router.replace(`/schedules?${newParams.toString()}`, { scroll: false });

    } catch (err: any) {
      console.error("Search error:", err);
      setError("Unable to find schedules. Please try again.");
    } finally {
      setSearching(false);
    }
  }, [searchFrom, searchTo, searchDate]);

  useEffect(() => {
    if (schedules.length > 0) {
      // Extract unique routes
      const routesMap = new Map();
      schedules.forEach(s => {
        const key = `${s.origin}-${s.destination}`;
        if (!routesMap.has(key)) {
          routesMap.set(key, {
            id: s.id,
            from: s.origin,
            to: s.destination,
            price: s.price,
            busType: s.busType
          });
        }
      });
      setPopularRoutes(Array.from(routesMap.values()).slice(0, 8));
    }
  }, [schedules]);

  const popularRoutesScrollRef = useRef<HTMLDivElement>(null);

  const handlePopularRoutesScroll = (direction: 'left' | 'right') => {
    if (popularRoutesScrollRef.current) {
      const container = popularRoutesScrollRef.current;
      const scrollAmount = container.clientWidth * 0.75;
      const targetScroll = container.scrollLeft + (direction === 'left' ? -scrollAmount : scrollAmount);
      container.scrollTo({
        left: targetScroll,
        behavior: 'smooth'
      });
    }
  };

  const terminals = useMemo(() => {
    const termMap = new Map();
    schedules.forEach(s => {
      if (s.departureLocation) {
        const key = s.departureLocation;
        if (!termMap.has(key)) {
          termMap.set(key, {
            name: key,
            count: 0,
            city: s.origin
          });
        }
        termMap.get(key).count++;
      }
    });
    return Array.from(termMap.values()).sort((a, b) => b.count - a.count);
  }, [schedules]);

  const handleGoBack = () => {
    const canGoBack = typeof window !== 'undefined' && window.history.state && typeof window.history.state.idx === 'number' && window.history.state.idx > 0;
    if (canGoBack) {
      router.back();
    } else {
      router.push('/');
    }
  };

  const handleBooking = (scheduleId: string, companyId: string, routeId: string) => {
    const bookingUrl = `/book/${scheduleId}?companyId=${companyId}&routeId=${routeId}&passengers=${passengers}`;
    
    if (!user) {
      toast.warning('Login Required', 'Please sign in to book a bus ticket.');
      router.push(`/login?redirect=${encodeURIComponent(bookingUrl)}`);
      return;
    }
    
    toast.info('Loading Booking', 'Preparing your booking page...');
    router.push(bookingUrl);
  };

  const filteredSchedules = useMemo(() => {
    let filtered = schedules;

    // Apply Search
    if (searchFrom) {
      filtered = filtered.filter(s => s.origin.toLowerCase().includes(searchFrom.toLowerCase()));
    }
    if (searchTo) {
      filtered = filtered.filter(s => s.destination.toLowerCase().includes(searchTo.toLowerCase()));
    }
    if (searchDate) {
      filtered = filtered.filter(s => s.date === searchDate);
    }

    // Limit to today and tomorrow by default if no active search input
    if (!searchFrom && !searchTo && !searchDate) {
      const todayStr = new Date().toISOString().split('T')[0];
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      filtered = filtered.filter(s => s.date === todayStr || s.date === tomorrowStr);
    }

    // Apply Quick Filters
    if (activeFilter === 'today') {
      const todayStr = new Date().toISOString().split('T')[0];
      filtered = filtered.filter(s => s.date === todayStr);
    } else if (activeFilter === 'morning') {
      filtered = filtered.filter(s => parseInt(s.departureTime.split(':')[0]) < 12);
    } else if (activeFilter === 'economy') {
      filtered = filtered.filter(s => s.busType.toLowerCase().includes('economy'));
    } else if (activeFilter === 'luxury') {
      filtered = filtered.filter(s => s.busType.toLowerCase().includes('luxury') || s.busType.toLowerCase().includes('vip'));
    }

    // Apply New Filters
    if (selectedCompany) {
      filtered = filtered.filter(s => s.companyName === selectedCompany);
    }
    if (selectedTimeSlot) {
      if (selectedTimeSlot === 'morning') {
        filtered = filtered.filter(s => {
          const h = parseInt(s.departureTime.split(':')[0]);
          return h >= 5 && h < 12;
        });
      } else if (selectedTimeSlot === 'afternoon') {
        filtered = filtered.filter(s => {
          const h = parseInt(s.departureTime.split(':')[0]);
          return h >= 12 && h < 17;
        });
      } else if (selectedTimeSlot === 'evening') {
        filtered = filtered.filter(s => {
          const h = parseInt(s.departureTime.split(':')[0]);
          return h >= 17 && h < 21;
        });
      }
    }

    // Apply Terminal Filter
    if (selectedTerminal) {
      filtered = filtered.filter(s => s.departureLocation === selectedTerminal);
    }

    // Apply Selected Category Filter
    if (selectedCategory) {
      filtered = filtered.filter(s => getScheduleCategory(s as any) === selectedCategory);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price': return a.price - b.price;
        case 'time': return a.departureTime.localeCompare(b.departureTime);
        case 'company': return a.companyName.localeCompare(b.companyName);
        default: return 0;
      }
    });

    return filtered;
  }, [schedules, searchFrom, searchTo, searchDate, activeFilter, sortBy, selectedCompany, selectedTimeSlot, selectedTerminal, selectedCategory]);

  const paginatedSchedules = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredSchedules.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredSchedules, currentPage]);

  const recommendedSchedules = useMemo(() => {
    if (!userCity || searchFrom) return [];
    return paginatedSchedules.filter(s => s.origin.toLowerCase() === userCity.toLowerCase());
  }, [paginatedSchedules, userCity, searchFrom]);

  const regularSchedules = useMemo(() => {
    if (recommendedSchedules.length === 0) return paginatedSchedules;
    const recommendedIds = new Set(recommendedSchedules.map(s => s.id));
    return paginatedSchedules.filter(s => !recommendedIds.has(s.id));
  }, [paginatedSchedules, recommendedSchedules]);

  const totalPages = Math.ceil(filteredSchedules.length / itemsPerPage);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
          <p className="text-gray-500 font-medium">Loading schedules...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">

      {/* ─── Hero / Quick Search Bar ────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900 text-white pt-16 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-8 gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold font-display tracking-tight">
                Find Your Next Journey
              </h1>
            </div>
          </div>
          <div className="mt-4 flex items-start">
            <BackButton onClick={handleGoBack} iconOnly className="border-white/25 text-white hover:bg-white/15" />
          </div>

          <div className="max-w-7xl mx-auto mt-4">
            <div className="text-sm text-blue-100 text-center">
              {!searchDate ? (
                <span>Select a date and route to discover available departures.</span>
              ) : (
                <span>Showing schedules for <strong>{new Date(searchDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</strong>.</span>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-4 sm:p-6 w-full max-w-5xl mx-auto mt-12">
            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4">
              <div className="col-span-1 md:col-span-2 lg:col-span-1">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">From</label>
                <LocationAutocomplete
                  value={searchFrom}
                  onChange={setSearchFrom}
                  onSelect={setSearchFrom}
                  placeholder="Leaving from..."
                  icon={MapPin}
                  cities={MALAWI_CITIES}
                  exclude={searchTo}
                />
              </div>
              <div className="col-span-1 md:col-span-2 lg:col-span-1">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">To</label>
                <LocationAutocomplete
                  value={searchTo}
                  onChange={setSearchTo}
                  onSelect={setSearchTo}
                  placeholder="Going to..."
                  icon={MapPin}
                  cities={MALAWI_CITIES}
                  exclude={searchFrom}
                />
              </div>
              <div className="col-span-1 lg:col-span-1">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Date</label>
                <div className="space-y-2">
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input type="date" value={searchDate} onChange={e => setSearchDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900" placeholder="Any date" />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSearchDate(todayDate)}
                      className={`flex-1 text-[10px] font-black uppercase tracking-widest py-2.5 rounded-xl border transition-all duration-200 ${
                        searchDate === todayDate
                          ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100"
                          : "bg-gray-50 text-gray-500 border-gray-100 hover:border-blue-200 hover:text-blue-600 hover:bg-white"
                      }`}
                    >
                      Today
                    </button>
                    <button
                      onClick={() => setSearchDate(tomorrowDateStr)}
                      className={`flex-1 text-[10px] font-black uppercase tracking-widest py-2.5 rounded-xl border transition-all duration-200 ${
                        searchDate === tomorrowDateStr
                          ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100"
                          : "bg-gray-50 text-gray-500 border-gray-100 hover:border-blue-200 hover:text-blue-600 hover:bg-white"
                      }`}
                    >
                      Tomorrow
                    </button>
                  </div>
                </div>
              </div>
              <div className="col-span-1 lg:col-span-1">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Passengers</label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="number" min="1" value={passengers} onChange={e => setPassengers(parseInt(e.target.value) || 1)} className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900" />
                </div>
              </div>
              <div className="col-span-1 md:col-span-4 lg:col-span-1 flex items-end">
                <button
                  onClick={handleSearch}
                  className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] active:shadow-inner active:bg-blue-800 text-white py-3 rounded-xl font-bold flex items-center justify-center transition duration-150 shadow-lg shadow-blue-200"
                >
                  <Search className="w-5 h-5 mr-2" /> Search
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-8">
        {/* ─── Main Feed: Filters & Schedules ───────────────────────────── */}
        <div className="lg:col-span-4 space-y-6">

          {/* Advanced Filters */}
          {hasActiveSearch && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-semibold text-gray-700">Showing {filteredSchedules.length} results</span>
              <button
                onClick={() => setShowFilters(prev => !prev)}
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition"
              >
                <Filter className="w-4 h-4" />
                {showFilters ? 'Hide filters' : 'Show filters'}
              </button>
            </div>
          )}

          {(!hasActiveSearch || showFilters) && (
            <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl shadow-sm border border-gray-100 min-w-0">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-bold text-gray-900">Filters:</span>
              </div>

              <select
                value={selectedCompany}
                onChange={e => setSelectedCompany(e.target.value)}
                className="w-full max-w-[220px] sm:w-auto min-w-0 text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Companies</option>
                {companies.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>

              <select
                value={selectedTimeSlot}
                onChange={e => setSelectedTimeSlot(e.target.value)}
                className="w-full max-w-[220px] sm:w-auto min-w-0 text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Any Time</option>
                <option value="morning">Morning (5 AM - 12 PM)</option>
                <option value="afternoon">Afternoon (12 PM - 5 PM)</option>
                <option value="evening">Evening (5 PM - 9 PM)</option>
              </select>

              <select
                value={selectedTerminal}
                onChange={e => setSelectedTerminal(e.target.value)}
                className="w-full max-w-[220px] sm:w-auto min-w-0 text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Terminals</option>
                {terminals.map(t => (
                  <option key={t.name} value={t.name}>{t.name} ({t.city})</option>
                ))}
              </select>

              <div className="h-6 w-px bg-gray-200 mx-2 hidden sm:block" />

              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'today', label: 'Today' },
                  { id: 'economy', label: 'Economy' },
                  { id: 'luxury', label: 'Luxury/VIP' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setActiveFilter(f.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${activeFilter === f.id
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Popular Routes Section */}
          {popularRoutes.length > 0 && !searchFrom && !searchTo && (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-orange-500" /> Popular Routes
                </h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Swipe to explore</p>
              </div>
              <div className="relative group/swiper">
                {/* Left Arrow Button */}
                <button 
                  onClick={() => handlePopularRoutesScroll('left')}
                  className="absolute -left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 shadow-xl border border-gray-100 flex items-center justify-center text-gray-700 hover:bg-white hover:text-blue-600 hover:scale-105 active:scale-95 transition-all z-20 opacity-0 group-hover/swiper:opacity-100 hidden md:flex"
                  aria-label="Scroll left"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                {/* Right Arrow Button */}
                <button 
                  onClick={() => handlePopularRoutesScroll('right')}
                  className="absolute -right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 shadow-xl border border-gray-100 flex items-center justify-center text-gray-700 hover:bg-white hover:text-blue-600 hover:scale-105 active:scale-95 transition-all z-20 opacity-0 group-hover/swiper:opacity-100 hidden md:flex"
                  aria-label="Scroll right"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>

                <div 
                  ref={popularRoutesScrollRef}
                  className="flex gap-4 overflow-x-auto pb-4 scrollbar-none px-1 snap-x snap-mandatory scroll-smooth"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                >
                  {popularRoutes.map((route, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setSearchFrom(route.from);
                        setSearchTo(route.to);
                        // Trigger a slight delay to ensure UI updates before focus
                        setTimeout(() => handleSearch(), 50);
                      }}
                      className="snap-start flex-shrink-0 w-64 bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all text-left group"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          <Navigation className="w-5 h-5" />
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Starting from</p>
                          <p className="text-sm font-black text-blue-600">MWK {route.price.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                          <p className="text-sm font-bold text-gray-900 truncate">{route.from}</p>
                        </div>
                        <div className="w-px h-3 bg-gray-200 ml-[2.5px]" />
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                          <p className="text-sm font-bold text-gray-900 truncate">{route.to}</p>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
                        <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded-lg uppercase tracking-widest">{route.busType}</span>
                        <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Terminals Section Removed */}



          {/* Sorting Header */}
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <span className="text-sm font-bold text-gray-900">{filteredSchedules.length} schedules found</span>
              {selectedTerminal && (
                <button
                  onClick={() => setSelectedTerminal("")}
                  className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-bold flex items-center gap-1 hover:bg-blue-100 transition-colors"
                >
                  Terminal: {selectedTerminal} <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">Sort by:</span>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium">
                <option value="price">Cheapest</option>
                <option value="time">Earliest</option>
                <option value="company">Company</option>
              </select>
            </div>
          </div>

          {/* Error state */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5" /> {error}
              </div>
              <button
                onClick={handleSearch}
                className="flex items-center gap-1 text-sm font-bold bg-white px-3 py-1.5 rounded-lg border border-red-100 hover:bg-red-50 transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> Retry
              </button>
            </div>
          )}

          {/* Schedules Grid */}
          {searching ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array(6).fill(0).map((_, i) => (
                <div key={i} className="bg-white rounded-[2.5rem] p-6 border border-gray-100 shadow-sm h-[340px] animate-pulse flex flex-col justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gray-100" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-100 rounded w-1/2" />
                      <div className="h-3 bg-gray-100 rounded w-1/3" />
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-[2rem] p-5 h-28" />
                  <div className="h-10 bg-gray-100 rounded-xl" />
                </div>
              ))}
            </div>
          ) : filteredSchedules.length === 0 && !loading && !error ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <BusIcon className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">No buses found</h3>
              <p className="text-gray-500">
                {isFutureDateSearch
                  ? `No schedules are available for ${new Date(searchDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}.`
                  : 'Try adjusting your filters or search criteria.'}
              </p>
              <button onClick={() => { setSearchFrom(""); setSearchTo(""); setSearchDate(""); setActiveFilter("all"); }} className="mt-6 text-blue-600 font-bold hover:underline">Clear all filters</button>
            </div>
          ) : (
            <div className="space-y-12">
              {/* Recommended Schedules Horizontal List */}
              {recommendedSchedules.length > 0 && !loading && !searching && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-teal-100 text-teal-600">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-gray-900 tracking-tight">Recommended for You</h3>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        Departing from {userCity}
                      </p>
                    </div>
                    <div className="h-px bg-gray-100 flex-1 ml-4" />
                  </div>

                  <div className="flex gap-6 overflow-x-auto pb-6 px-1 snap-x snap-mandatory scroll-smooth scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
                    {recommendedSchedules.map((schedule) => (
                      <div key={`rec-${schedule.id}`} className="snap-start shrink-0 w-[85vw] sm:w-[350px] md:w-[400px]">
                        <ScheduleCard 
                          s={schedule as any} 
                          userCity={userCity} 
                          onBook={() => handleBooking(schedule.id, schedule.companyId, schedule.routeId)} 
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {['Boarding Now', 'Morning', 'Afternoon', 'Evening'].map((cat) => {
                const items = regularSchedules.filter(s => getScheduleCategory(s as any) === cat);
                // If we have a specific category selected, only show that section
                if (selectedCategory && selectedCategory !== cat) return null;
                if (items.length === 0) return null;

                return (
                  <div key={cat} className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${cat === 'Boarding Now' ? 'bg-orange-100 text-orange-600 animate-pulse' :
                        cat === 'Morning' ? 'bg-blue-100 text-blue-600' :
                          cat === 'Afternoon' ? 'bg-amber-100 text-amber-600' :
                            'bg-indigo-100 text-indigo-600'
                        }`}>
                        {cat === 'Boarding Now' ? <Zap className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-gray-900 tracking-tight">{cat}</h3>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          {items.length} {items.length === 1 ? 'Bus' : 'Buses'} Available
                        </p>
                      </div>
                      <div className="h-px bg-gray-100 flex-1 ml-4" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {items.map((schedule) => (
                        <div key={schedule.id} className="snap-start shrink-0">
                          <ScheduleCard 
                            s={schedule as any} 
                            userCity={userCity} 
                            onBook={() => handleBooking(schedule.id, schedule.companyId, schedule.routeId)} 
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Premium Pagination Control */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between pt-8 border-t border-gray-100 gap-4 mt-8">
                  <p className="text-sm font-bold text-gray-500 font-display">
                    Showing <span className="text-gray-900 font-extrabold">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-gray-900 font-extrabold">{Math.min(currentPage * itemsPerPage, filteredSchedules.length)}</span> of <span className="text-gray-900 font-extrabold">{filteredSchedules.length}</span> schedules
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className={`px-4 py-2.5 rounded-xl font-extrabold text-xs transition-all flex items-center gap-1.5 active:scale-95 ${
                        currentPage === 1
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 shadow-sm"
                      }`}
                    >
                      ← Prev
                    </button>
                    
                    {Array.from({ length: totalPages }).map((_, index) => {
                      const pageNum = index + 1;
                      const shouldShow = pageNum === 1 || pageNum === totalPages || Math.abs(pageNum - currentPage) <= 1;
                      if (!shouldShow) {
                        if (pageNum === 2 || pageNum === totalPages - 1) {
                          return <span key={pageNum} className="text-gray-400 font-bold px-1.5 select-none">...</span>;
                        }
                        return null;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-9 h-9 rounded-xl font-black text-xs transition-all active:scale-95 flex items-center justify-center ${
                            currentPage === pageNum
                              ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                              : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 shadow-sm"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className={`px-4 py-2.5 rounded-xl font-extrabold text-xs transition-all flex items-center gap-1.5 active:scale-95 ${
                        currentPage === totalPages
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 shadow-sm"
                      }`}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>




      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
      `}</style>
    </div>
  );
}
