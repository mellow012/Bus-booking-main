"use client";

import React, { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  Search, MapPin, Calendar, Users, Navigation, Clock, CheckCircle, Bus as BusIcon,
  Filter, AlertCircle, RefreshCw, Zap, TrendingUp, Loader2, ArrowRight, User, Star
} from "lucide-react";
import { Button } from "@/components/ui/button";

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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Data state
  const [schedules, setSchedules] = useState<EnhancedSchedule[]>([]);

  // Search/Filter state
  const [searchFrom, setSearchFrom] = useState(searchParams.get('from') || "");
  const [searchTo, setSearchTo] = useState(searchParams.get('to') || "");
  const [searchDate, setSearchDate] = useState(searchParams.get('date') || "");
  const [passengers, setPassengers] = useState(parseInt(searchParams.get('passengers') || "1"));
  
  const [activeFilter, setActiveFilter] = useState("all");
  const [sortBy, setSortBy] = useState<'price' | 'time' | 'company'>('price');
  
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("");
  
  const [popularBuses, setPopularBuses] = useState<any[]>([]);

  // Auth protection
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Fetch initial data
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchDashboardData = async () => {
      setLoading(true);
      setError("");
      try {
        // 1. Fetch upcoming schedules (next 7 days)
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
            routeId: schedule.routeId
          }));

        setSchedules(enhancedSchedules);

      } catch (err: any) {
        console.error("Dashboard fetch error:", err);
        setError("Unable to load dashboard data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);
  
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
          routeId: schedule.routeId
        }));

      setSchedules(enhancedSchedules);
    } catch (err: any) {
      console.error("Search error:", err);
      setError("Unable to find schedules. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [searchFrom, searchTo, searchDate]);

  useEffect(() => {
    if (schedules.length > 0) {
      // Mock popular buses for now
      const popular = schedules.slice(0, 4).map(s => ({
        id: s.id,
        name: s.companyName,
        logo: s.companyLogo,
        rating: 4.8,
        price: s.price,
        type: s.busType
      }));
      setPopularBuses(popular);
    }
  }, [schedules]);

  const handleBooking = (scheduleId: string, companyId: string, routeId: string) => {
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
      const hour = parseInt(selectedTimeSlot.split(':')[0]);
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

  if (loading || !user) {
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
              <div className="col-span-1 md:col-span-2 lg:col-span-1 relative">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">From</label>
                <div className="relative flex items-center">
                  <MapPin className="absolute left-3 w-5 h-5 text-gray-400" />
                  <input type="text" value={searchFrom} onChange={e => setSearchFrom(e.target.value)} placeholder="Leaving from..." className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900" />

                </div>
              </div>
              <div className="col-span-1 md:col-span-2 lg:col-span-1">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">To</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="text" value={searchTo} onChange={e => setSearchTo(e.target.value)} placeholder="Going to..." className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900" />
                </div>
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
                {Array.from(new Set(schedules.map(s => s.companyName))).map(c => (
                  <option key={c} value={c}>{c}</option>
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                      activeFilter === f.id 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Popular Buses Section */}
            {popularBuses.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-orange-500" /> Popular Buses
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {popularBuses.map((bus) => (
                    <div key={bus.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                          {bus.logo ? <img src={bus.logo} alt={bus.name} className="w-full h-full rounded-full object-cover" /> : bus.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{bus.name}</p>
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                            <span className="text-[10px] font-bold text-gray-600">{bus.rating}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-between items-end">
                        <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{bus.type}</span>
                        <p className="text-sm font-bold text-blue-600">MWK {bus.price.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sorting Header */}
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
              <span className="text-sm font-bold text-gray-900">{filteredSchedules.length} schedules found</span>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredSchedules.map((schedule) => (
                  <div key={schedule.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all flex flex-col group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        {schedule.companyLogo ? (
                          <img src={schedule.companyLogo} alt={schedule.companyName} className="w-10 h-10 rounded-full object-cover border border-gray-200" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">{schedule.companyName.charAt(0)}</div>
                        )}
                        <div>
                          <h4 className="font-bold text-gray-900 leading-tight">{schedule.companyName}</h4>
                          <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded-md">{schedule.busType}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-blue-600">MWK {(schedule.price).toLocaleString()}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-4 bg-gray-50 p-3 rounded-xl relative">
                      <div className="text-center w-1/3">
                        <div className="text-lg font-bold text-gray-900">{schedule.departureTime}</div>
                        <div className="text-xs font-semibold text-gray-600 truncate">{schedule.origin}</div>
                      </div>
                      <div className="flex-1 flex flex-col items-center justify-center relative">
                        <span className="text-[10px] text-gray-400 font-medium mb-1">{schedule.duration}h</span>
                        <div className="w-full h-px bg-gray-300 relative">
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-full p-1 border border-gray-200">
                            <ArrowRight className="w-3 h-3 text-blue-600" />
                          </div>
                        </div>
                      </div>
                      <div className="text-center w-1/3">
                        <div className="text-lg font-bold text-gray-900">{schedule.arrivalTime}</div>
                        <div className="text-xs font-semibold text-gray-600 truncate">{schedule.destination}</div>
                      </div>
                    </div>

                    <div className="mt-auto flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${schedule.availableSeats > 10 ? 'bg-green-500' : 'bg-orange-500'}`} />
                        <span className="text-xs font-medium text-gray-600">{schedule.availableSeats} seats left</span>
                      </div>
                      <Button onClick={() => handleBooking(schedule.id, schedule.companyId, schedule.routeId)} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition-transform active:scale-95 group-hover:shadow-blue-200">
                        Book
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>


      {/* ─── Mobile Bottom Navigation ─────────────────────────────────────── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center p-3 z-50 pb-safe">
        <button onClick={() => router.push('/schedules')} className="flex flex-col items-center text-blue-600">
          <Search className="w-6 h-6" />
          <span className="text-[10px] font-bold mt-1">Search</span>
        </button>
        <button onClick={() => router.push('/bookings')} className="flex flex-col items-center text-gray-400 hover:text-gray-900">
          <BusIcon className="w-6 h-6" />
          <span className="text-[10px] font-medium mt-1">Bookings</span>
        </button>
        <button onClick={() => router.push('/notifications')} className="flex flex-col items-center text-gray-400 hover:text-gray-900 relative">
          <AlertCircle className="w-6 h-6" />
          <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
          <span className="text-[10px] font-medium mt-1">Alerts</span>
        </button>
        <button onClick={() => router.push('/profile')} className="flex flex-col items-center text-gray-400 hover:text-gray-900">
          <User className="w-6 h-6" />
          <span className="text-[10px] font-medium mt-1">Profile</span>
        </button>
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
