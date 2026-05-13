"use client";

import React, { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  Search, MapPin, Calendar, Users, Navigation, Clock, CheckCircle, Bus as BusIcon,
  Filter, AlertCircle, RefreshCw, Zap, TrendingUp, Loader2, ArrowRight, User, Star,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LocationAutocomplete } from "@/components/LocationAutocomplete";
import { MALAWI_CITIES, getScheduleCategory } from "@/utils/homeHelpers";
import { useNotifications } from "@/contexts/NotificationContext";
import { useAppToast } from "@/contexts/ToastContext";

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



export default function SchedulesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userProfile } = useAuth();
  const { unreadCount } = useNotifications();
  const toast = useAppToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Data state
  const [schedules, setSchedules] = useState<EnhancedSchedule[]>([]);
  const [companies, setCompanies] = useState<{ id: string, name: string }[]>([]);

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

  const [popularRoutes, setPopularRoutes] = useState<any[]>([]);

  // Auth protection - only redirect if trying to access private parts
  // Removed strict page-level redirect as /schedules is public


  // Fetch initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      setError("");
      try {
        // 1. Fetch companies for the filter
        const companiesRes = await fetch('/api/companies');
        if (companiesRes.ok) {
          const { data } = await companiesRes.json();
          setCompanies(data);
        }

        // 2. Fetch upcoming schedules (next 7 days)
        const startOfWeek = new Date();
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);
        endOfWeek.setHours(23, 59, 59, 999);

        const queryParams = new URLSearchParams({
          startDate: startOfWeek.toISOString(),
          endDate: endOfWeek.toISOString(),
          sortBy: 'departureDateTime',
        });

        if (searchFrom) queryParams.append('from', searchFrom);
        if (searchTo) queryParams.append('to', searchTo);
        if (searchDate) queryParams.append('date', searchDate);

        const schedulesRes = await fetch(`/api/schedules?${queryParams}`);
        if (!schedulesRes.ok) throw new Error("Failed to load schedules");
        const { data: apiSchedules } = await schedulesRes.json();

        const enhancedSchedules: EnhancedSchedule[] = apiSchedules
          .filter((s: any) => new Date(s.arrivalDateTime) >= new Date())
          .map((schedule: any) => ({
            id: schedule.id,
            companyName: schedule.companyName || 'Unknown',
            busNumber: schedule.busNumber || 'N/A',
            busType: schedule.busType || 'Standard',
            origin: schedule.origin || 'N/A',
            destination: schedule.destination || 'N/A',
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

      } catch (err: any) {
        console.error("Dashboard fetch error:", err);
        setError("Unable to load dashboard data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  const handleSearch = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const queryParams = new URLSearchParams();
      if (searchFrom) queryParams.append('from', searchFrom);
      if (searchTo) queryParams.append('to', searchTo);
      if (searchDate) queryParams.append('date', searchDate);
      queryParams.append('sortBy', 'departureDateTime');

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
      setLoading(false);
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

  const handleBooking = (scheduleId: string, companyId: string, routeId: string) => {
    if (!user) {
      toast.warning('Login Required', 'Please sign in to book a bus ticket.');
      router.push(`/login?redirect=/book/${scheduleId}`);
      return;
    }
    toast.info('Loading Booking', 'Preparing your booking page...');
    router.push(`/book/${scheduleId}?companyId=${companyId}&routeId=${routeId}&passengers=${passengers}`);
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
  }, [schedules, searchFrom, searchTo, searchDate, activeFilter, sortBy, selectedCompany, selectedTimeSlot]);

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
              <p className="text-blue-200 mt-2 text-lg">Browse available bus schedules and book instantly.</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-4 sm:p-6 w-full max-w-5xl mx-auto transform translate-y-12">
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
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="date" value={searchDate} onChange={e => setSearchDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900" placeholder="Any date" />
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
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold flex items-center justify-center transition-colors shadow-lg shadow-blue-200"
                >
                  <Search className="w-5 h-5 mr-2" /> Search
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 pt-4">
        {/* ─── Main Feed: Filters & Schedules ───────────────────────────── */}
        <div className="lg:col-span-4 space-y-6">

          {/* Advanced Filters */}
          <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-bold text-gray-900">Filters:</span>
            </div>

            <select
              value={selectedCompany}
              onChange={e => setSelectedCompany(e.target.value)}
              className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Companies</option>
              {companies.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>

            <select
              value={selectedTimeSlot}
              onChange={e => setSelectedTimeSlot(e.target.value)}
              className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Any Time</option>
              <option value="morning">Morning (5 AM - 12 PM)</option>
              <option value="afternoon">Afternoon (12 PM - 5 PM)</option>
              <option value="evening">Evening (5 PM - 9 PM)</option>
            </select>

            <select
              value={selectedTerminal}
              onChange={e => setSelectedTerminal(e.target.value)}
              className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
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

          {/* Popular Routes Section */}
          {popularRoutes.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-orange-500" /> Popular Routes
                </h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Swipe to explore</p>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none px-1">
                {popularRoutes.map((route, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setSearchFrom(route.from);
                      setSearchTo(route.to);
                      // Trigger a slight delay to ensure UI updates before focus
                      setTimeout(() => handleSearch(), 50);
                    }}
                    className="flex-shrink-0 w-64 bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all text-left group"
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
          )}

          {/* Terminals Section Removed */}

          {/* Category Quick Filter Tabs */}
          <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <span className="text-sm font-bold text-gray-900 mr-2">Time Slot:</span>
            {['All', 'Boarding Now', 'Morning', 'Afternoon', 'Evening'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat === 'All' ? null : cat)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${(cat === 'All' && !selectedCategory) || selectedCategory === cat
                    ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                    : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>

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
          {filteredSchedules.length === 0 && !loading && !error ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <BusIcon className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">No buses found</h3>
              <p className="text-gray-500">Try adjusting your filters or search criteria.</p>
              <button onClick={() => { setSearchFrom(""); setSearchTo(""); setActiveFilter("all"); }} className="mt-6 text-blue-600 font-bold hover:underline">Clear all filters</button>
            </div>
          ) : (
            <div className="space-y-12">
              {['Boarding Now', 'Morning', 'Afternoon', 'Evening'].map((cat) => {
                const items = filteredSchedules.filter(s => getScheduleCategory(s as any) === cat);
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
                        <div key={schedule.id} className="bg-white rounded-[2.5rem] p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all flex flex-col group relative overflow-hidden">
                          {/* Category Badge - Repositioned to bottom left */}
                          {/* Status Badges */}
                          <div className="absolute top-0 right-0 p-4 flex gap-2">
                            <span className="text-[9px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 px-2 py-1 rounded-lg border border-blue-100">
                              {schedule.busType}
                            </span>
                          </div>

                          {/* Company Header */}
                          <div className="flex items-center gap-4 mb-6">
                            {schedule.companyLogo ? (
                              <img src={schedule.companyLogo} alt={schedule.companyName} className="w-12 h-12 rounded-2xl object-cover border border-gray-100 shadow-sm" />
                            ) : (
                              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-black text-xl shadow-md">
                                {schedule.companyName.charAt(0)}
                              </div>
                            )}
                            <div>
                              <h4 className="font-black text-gray-900 leading-tight group-hover:text-blue-600 transition-colors">{schedule.companyName}</h4>
                              <div className="flex items-center gap-1.5 mt-1">
                                <div className="flex text-yellow-400">
                                  {[...Array(5)].map((_, i) => <Star key={i} className="w-2.5 h-2.5 fill-current" />)}
                                </div>
                                <span className="text-[10px] font-bold text-gray-400">4.8 (120 reviews)</span>
                              </div>
                            </div>
                          </div>

                          {/* Route & Terminals */}
                          <div className="bg-gray-50/50 rounded-[2rem] p-5 mb-6 relative">
                            <div className="flex justify-between items-start relative z-10">
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Departure</p>
                                <h5 className="text-lg font-black text-gray-900 truncate mb-1">{schedule.origin}</h5>
                                <button
                                  onClick={() => setSelectedTerminal(schedule.departureLocation || "")}
                                  className="flex items-center gap-1 text-[11px] font-bold text-gray-500 truncate hover:text-blue-600 transition-colors"
                                >
                                  <MapPin className="w-3 h-3 text-indigo-400 shrink-0" />
                                  <span className="truncate underline decoration-dotted">{schedule.departureLocation || 'Main Terminal'}</span>
                                </button>
                                <div className="mt-3 flex items-center gap-2">
                                  <div className="px-2 py-1 bg-white rounded-lg border border-gray-100 shadow-sm">
                                    <span className="text-sm font-black text-gray-900">{schedule.departureTime}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-col items-center justify-center px-4 pt-8">
                                <div className="w-px h-12 bg-gradient-to-b from-blue-200 via-indigo-200 to-transparent relative">
                                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full flex items-center justify-center border border-gray-100 shadow-sm">
                                    <ArrowRight className="w-3 h-3 text-blue-600" />
                                  </div>
                                </div>
                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter mt-2">{Math.floor(schedule.duration / 60)}h {schedule.duration % 60}m</span>
                              </div>

                              <div className="flex-1 min-w-0 text-right">
                                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Arrival</p>
                                <h5 className="text-lg font-black text-gray-900 truncate mb-1">{schedule.destination}</h5>
                                <div className="flex items-center justify-end gap-1 text-[11px] font-bold text-gray-500 truncate">
                                  <span className="truncate">{schedule.arrivalLocation || 'Main Terminal'}</span>
                                  <MapPin className="w-3 h-3 text-blue-400 shrink-0" />
                                </div>
                                <div className="mt-3 flex items-center justify-end gap-2">
                                  <div className="px-2 py-1 bg-white rounded-lg border border-gray-100 shadow-sm">
                                    <span className="text-sm font-black text-gray-900">{schedule.arrivalTime}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Details Bar */}
                          <div className="grid grid-cols-2 gap-3 mb-6">
                            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50/50 rounded-xl border border-blue-100/50">
                              <Calendar className="w-4 h-4 text-blue-600" />
                              <div>
                                <p className="text-[9px] font-black text-blue-400 uppercase leading-none mb-1">Travel Date</p>
                                <p className="text-[11px] font-black text-gray-900 leading-none">
                                  {new Date(schedule.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50/50 rounded-xl border border-indigo-100/50">
                              <Users className="w-4 h-4 text-indigo-600" />
                              <div>
                                <p className="text-[9px] font-black text-indigo-400 uppercase leading-none mb-1">Availability</p>
                                <p className={`text-[11px] font-black leading-none ${schedule.availableSeats > 10 ? 'text-green-600' : 'text-orange-600'}`}>
                                  {schedule.availableSeats} Seats Left
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Action Area */}
                          <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between gap-4">
                            <div>
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Ticket Price</p>
                              <p className="text-xl font-black text-blue-700">MWK {schedule.price.toLocaleString()}</p>
                            </div>
                            <Button
                              onClick={() => handleBooking(schedule.id, schedule.companyId, schedule.routeId)}
                              className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-6 py-6 shadow-lg shadow-blue-200 transition-all active:scale-95 font-black text-sm flex items-center gap-2 group/btn"
                            >
                              Book Now
                              <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>




      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600&display=swap');
        .font-display { font-family: 'Plus Jakarta Sans', sans-serif; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
      `}</style>
    </div>
  );
}

