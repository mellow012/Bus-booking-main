"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs, orderBy, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { 
  Bus as BusIcon, 
  MapPin, 
  Clock, 
  Users, 
  Currency, 
  Loader2, 
  ArrowRight,
  CheckCircle,
  Search,
  Filter,
  Calendar,
  MapPinIcon,
  SlidersHorizontal,
  Zap,
  Star,
  ChevronDown,
  RefreshCw,
  TrendingUp,
  Timer,
  Navigation,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Company {
  id: string;
  name: string;
  phone?: string;
  status: string;
}

interface Bus {
  id: string;
  licensePlate: string;
  busType: string;
  capacity: number;
  totalSeats: number;
  amenities: string[];
  companyId: string;
  status: string;
}

interface Route {
  id: string;
  origin: string;
  destination: string;
  duration: number;
  distance: number;
  companyId: string;
  isActive: boolean;
}

interface Schedule {
  id: string;
  companyId: string;
  busId: string;
  routeId: string;
  departureDateTime: Timestamp;
  arrivalDateTime: Timestamp;
  price: number;
  availableSeats: number;
  status: string;
}

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
}

// Custom Toggle Switch Component
const ToggleSwitch = ({ 
  checked, 
  onChange, 
  disabled = false, 
  size = "md" 
}: { 
  checked: boolean; 
  onChange: (checked: boolean) => void; 
  disabled?: boolean; 
  size?: "sm" | "md" | "lg";
}) => {
  const sizeClasses = {
    sm: "w-8 h-5",
    md: "w-11 h-6",
    lg: "w-14 h-8"
  };
  
  const thumbSizeClasses = {
    sm: "w-3 h-3",
    md: "w-4 h-4", 
    lg: "w-6 h-6"
  };

  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`
        ${sizeClasses[size]} 
        ${checked ? 'bg-gradient-to-r from-blue-500 to-indigo-600' : 'bg-gray-200'} 
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-md'}
        relative inline-flex items-center rounded-full border-2 border-transparent 
        transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 
        focus:ring-blue-500 focus:ring-offset-2 shadow-sm
      `}
    >
      <span
        className={`
          ${thumbSizeClasses[size]} 
          ${checked ? `translate-x-${size === 'sm' ? '3' : size === 'md' ? '5' : '6'}` : 'translate-x-0.5'}
          bg-white rounded-full shadow-lg transform transition-transform duration-200 ease-in-out
          flex items-center justify-center
        `}
      >
        {checked && (
          <CheckCircle2 className={`${size === 'sm' ? 'w-2 h-2' : size === 'md' ? 'w-2.5 h-2.5' : 'w-3 h-3'} text-blue-600`} />
        )}
      </span>
    </button>
  );
};

const SchedulesPage = () => {
  const router = useRouter();
  const [schedules, setSchedules] = useState<EnhancedSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date()); // Use current date
  const [selectedOrigin, setSelectedOrigin] = useState("");
  const [selectedDestination, setSelectedDestination] = useState("");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000000]);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid');
  const [sortBy, setSortBy] = useState<'time' | 'price' | 'company'>('time');
  const [useLocation, setUseLocation] = useState(false);
  const [userLocation, setUserLocation] = useState<string>("");
  const [locationError, setLocationError] = useState<string>("");
  const [locationLoading, setLocationLoading] = useState(false);

  // Calculate 2-week range dynamically from today
  const today = new Date(); // Current date: September 17, 2025
  const maxDate = new Date(today);
  maxDate.setDate(today.getDate() + 13); // 2 weeks (14 days total)

  const handleLocationToggle = useCallback((enabled: boolean) => {
    setUseLocation(enabled);
    setLocationError("");
    
    if (enabled) {
      setLocationLoading(true);
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setUserLocation(`${pos.coords.latitude},${pos.coords.longitude}`);
            setLocationError("");
            setLocationLoading(false);
          },
          (err) => {
            setLocationError("Unable to access your location. Please enter it manually.");
            setLocationLoading(false);
          },
          { timeout: 10000, enableHighAccuracy: true }
        );
      } else {
        setLocationError("Geolocation is not supported by your browser.");
        setLocationLoading(false);
      }
    } else {
      setUserLocation("");
      setLocationLoading(false);
    }
  }, []);

  const fetchData = useCallback(async (targetDate: Date) => {
    setLoading(true);
    setError("");

    try {
      // Calculate the start and end of the week (Monday to Sunday) for the target date
      const startOfWeek = new Date(targetDate);
      const dayOfWeek = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
      startOfWeek.setDate(diff);
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6); // End on Sunday
      endOfWeek.setHours(23, 59, 59, 999);

      const startTimestamp = Timestamp.fromDate(startOfWeek);
      const endTimestamp = Timestamp.fromDate(endOfWeek);

      console.log("Fetching data for week range:", { startOfWeek, endOfWeek });

      const [companiesSnapshot, busesSnapshot, routesSnapshot, schedulesSnapshot] = await Promise.all([
        getDocs(query(collection(db, "companies"), where("status", "==", "active"))),
        getDocs(query(collection(db, "buses"), where("status", "==", "active"))),
        getDocs(query(collection(db, "routes"), where("isActive", "==", true))),
        getDocs(query(
          collection(db, "schedules"),
          where("status", "==", "active"),
          where("departureDateTime", ">=", startTimestamp),
          where("departureDateTime", "<=", endTimestamp),
          orderBy("departureDateTime")
        )),
      ]);

      console.log("Raw schedules count:", schedulesSnapshot.size);
      const companiesMap = new Map<string, Company>();
      companiesSnapshot.forEach((doc) => companiesMap.set(doc.id, { id: doc.id, ...doc.data() } as Company));

      const busesMap = new Map<string, Bus>();
      busesSnapshot.forEach((doc) => busesMap.set(doc.id, { id: doc.id, ...doc.data() } as Bus));

      const routesMap = new Map<string, Route>();
      routesSnapshot.forEach((doc) => routesMap.set(doc.id, { id: doc.id, ...doc.data() } as Route));

      const enhancedSchedules: EnhancedSchedule[] = [];
      schedulesSnapshot.forEach((doc) => {
        const schedule = { id: doc.id, ...doc.data() } as Schedule;
        const company = companiesMap.get(schedule.companyId);
        const bus = busesMap.get(schedule.busId);
        const route = routesMap.get(schedule.routeId);

        if (company && bus && route) {
          const departureDateTime = schedule.departureDateTime.toDate();
          const arrivalDateTime = schedule.arrivalDateTime.toDate();
          const departureTime = departureDateTime.toTimeString().slice(0, 5);
          const arrivalTime = arrivalDateTime.toTimeString().slice(0, 5);

          enhancedSchedules.push({
            id: schedule.id,
            companyName: company.name,
            busNumber: bus.licensePlate,
            busType: bus.busType || "Standard",
            origin: route.origin,
            destination: route.destination,
            departureTime,
            arrivalTime,
            availableSeats: schedule.availableSeats,
            price: schedule.price,
            duration: route.duration,
            date: departureDateTime.toDateString(),
          });
        }
      });

      setSchedules(enhancedSchedules);
    } catch (err: any) {
      console.error("Error fetching schedules:", err);
      setError("Unable to load schedules. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(selectedDate);
  }, [fetchData, selectedDate]);
  const { origins, destinations } = useMemo(() => {
    const origins = [...new Set(schedules.map(s => s.origin))];
    const destinations = [...new Set(schedules.map(s => s.destination))];
    return { origins, destinations };
  }, [schedules]);

  const filteredSchedules = useMemo(() => {
    let filtered = schedules.filter(schedule => {
      const priceInMWK = schedule.price * 1700;
      const matchesSearch = !searchTerm || 
        schedule.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        schedule.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
        schedule.destination.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPrice = priceInMWK >= priceRange[0] * 1000 && priceInMWK <= priceRange[1] * 1000;
      const matchesOrigin = !selectedOrigin || schedule.origin === selectedOrigin;
      const matchesDest = !selectedDestination || schedule.destination === selectedDestination;
      
      let matchesLocation = true;
      if (useLocation && userLocation) {
        matchesLocation = schedule.origin.toLowerCase().includes(userLocation.toLowerCase()) ||
          schedule.destination.toLowerCase().includes(userLocation.toLowerCase());
      }
      
      return matchesSearch && matchesPrice && matchesOrigin && matchesDest && matchesLocation;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price':
          return a.price - b.price;
        case 'company':
          return a.companyName.localeCompare(b.companyName);
        case 'time':
        default:
          return a.departureTime.localeCompare(b.departureTime);
      }
    });

    return filtered;
  }, [schedules, searchTerm, priceRange, selectedOrigin, selectedDestination, sortBy, useLocation, userLocation]);

  const handleBooking = useCallback((scheduleId: string) => {
    router.push(`/book/${scheduleId}?passengers=1`);
  }, [router]);

  const formatDate = (date: Date) => {
    const today = new Date("2025-08-24");
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const groupedSchedules = useMemo(() => {
    const grouped: { [key: string]: EnhancedSchedule[] } = {};
    filteredSchedules.forEach(schedule => {
      const timeSlot = parseInt(schedule.departureTime.split(':')[0]);
      let period: string;
      
      if (timeSlot < 6) period = "Dawn (00:00 - 05:59)";
      else if (timeSlot < 12) period = "Morning (06:00 - 11:59)";
      else if (timeSlot < 17) period = "Afternoon (12:00 - 16:59)";
      else period = "Evening (17:00 - 23:59)";
      
      if (!grouped[period]) grouped[period] = [];
      grouped[period].push(schedule);
    });
    return grouped;
  }, [filteredSchedules]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Smart Schedule Explorer
          </h1>
          <p className="text-lg text-gray-600 mb-6">
            Discover, compare, and book bus schedules across Malawi
          </p>
          
          {/* Quick Stats */}
          <div className="flex justify-center items-center space-x-8 mb-8">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{filteredSchedules.length}</div>
              <div className="text-sm text-gray-500">Available Trips</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{origins.length}</div>
              <div className="text-sm text-gray-500">Routes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{[...new Set(schedules.map(s => s.companyName))].length}</div>
              <div className="text-sm text-gray-500">Companies</div>
            </div>
          </div>
        </div>

        {/* Enhanced Location Toggle Section */}
        <div className="bg-white rounded-3xl shadow-lg p-6 mb-6 border border-gray-100">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                  <Navigation className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <label className="font-semibold text-gray-800">Location-Based Search</label>
                    <ToggleSwitch
                      checked={useLocation}
                      onChange={handleLocationToggle}
                      disabled={locationLoading}
                    />
                  </div>
                  <p className="text-sm text-gray-600">
                    Find routes from your current location
                  </p>
                </div>
              </div>
              
              {locationLoading && (
                <div className="flex items-center gap-2 text-blue-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Getting location...</span>
                </div>
              )}
            </div>

            {useLocation && (
              <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={userLocation}
                    onChange={(e) => setUserLocation(e.target.value)}
                    placeholder="Enter your location or city"
                    className="px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm min-w-[200px]"
                  />
                </div>
                {locationError && (
                  <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">{locationError}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-3xl shadow-lg p-6 mb-8 border border-gray-100">
          {/* Date Selection with Picker */}
          <div className="flex flex-wrap gap-2 mb-6 items-center">
            <label className="text-sm font-medium text-gray-700 mr-2">Select Date:</label>
            <div className="relative flex-1 max-w-xs">
              <input
                type="date"
                value={selectedDate.toISOString().split('T')[0]}
                onChange={(e) => {
                  const date = new Date(e.target.value);
                  if (date <= maxDate) setSelectedDate(date);
                }}
                min={today.toISOString().split('T')[0]}
                max={maxDate.toISOString().split('T')[0]}
                className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            </div>
            <div className="text-sm text-gray-600 bg-blue-50 px-3 py-2 rounded-lg">
              {formatDate(selectedDate)}
            </div>
          </div>

          {/* Search Bar and Controls */}
          <div className="flex flex-col lg:flex-row gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search companies, routes, or destinations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
            
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={() => setShowFilters(!showFilters)}
                variant="outline"
                className={`rounded-2xl border-gray-200 transition-all ${showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : ''}`}
              >
                <SlidersHorizontal className="w-4 h-4 mr-2" />
                Filters
                {(selectedOrigin || selectedDestination || priceRange[0] > 0 || priceRange[1] < 100) && (
                  <div className="ml-2 w-2 h-2 bg-blue-500 rounded-full"></div>
                )}
              </Button>
              
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'time' | 'price' | 'company')}
                className="px-4 py-3 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="time">Sort by Time</option>
                <option value="price">Sort by Price</option>
                <option value="company">Sort by Company</option>
              </select>
              
              <Button
                onClick={() => setViewMode(viewMode === 'grid' ? 'timeline' : 'grid')}
                variant="outline"
                className="rounded-2xl border-gray-200"
                title={`Switch to ${viewMode === 'grid' ? 'timeline' : 'grid'} view`}
              >
                {viewMode === 'grid' ? <Timer className="w-4 h-4" /> : <div className="w-4 h-4 grid grid-cols-2 gap-0.5"><div className="bg-current"></div><div className="bg-current"></div><div className="bg-current"></div><div className="bg-current"></div></div>}
              </Button>
            </div>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-2xl border border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Origin</label>
                <select
                  value={selectedOrigin}
                  onChange={(e) => setSelectedOrigin(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">All Origins</option>
                  {origins.map((origin) => (
                    <option key={origin} value={origin}>{origin}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Destination</label>
                <select
                  value={selectedDestination}
                  onChange={(e) => setSelectedDestination(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">All Destinations</option>
                  {destinations.map((destination) => (
                    <option key={destination} value={destination}>{destination}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price Range (MWK {priceRange[0]}K - {priceRange[1]}K)
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={priceRange[0]}
                    onChange={(e) => setPriceRange([parseInt(e.target.value), priceRange[1]])}
                    className="flex-1"
                  />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={priceRange[1]}
                    onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-6"}>
            {Array(6).fill(0).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-3xl shadow-lg p-6 animate-pulse border border-gray-100"
              >
                <div className="h-6 bg-gray-200 rounded mb-4"></div>
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-12 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600">{error}</p>
            <Button
              onClick={() => fetchData(selectedDate)}
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        ) : viewMode === 'timeline' ? (
          <div className="space-y-8">
            {Object.entries(groupedSchedules).map(([period, periodSchedules]) => (
              <div key={period} className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4">
                  <h3 className="text-lg font-bold">{period}</h3>
                  <p className="text-blue-100">{periodSchedules.length} trips available</p>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    {periodSchedules.map((schedule, index) => (
                      <div
                        key={schedule.id}
                        className="group relative bg-gradient-to-br from-gray-50 to-white rounded-2xl p-4 border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-300"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-sm">
                              {schedule.companyName.charAt(0)}
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900 text-sm">{schedule.companyName}</h4>
                              <p className="text-xs text-gray-600">{schedule.busType}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-blue-600">
                              MWK {(schedule.price * 1700).toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-500">{schedule.availableSeats} seats</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-center">
                            <div className="text-sm font-bold text-gray-900">{schedule.origin}</div>
                            <div className="text-xs text-blue-600 font-medium">{schedule.departureTime}</div>
                          </div>
                          <div className="flex-1 mx-3 relative">
                            <div className="h-px bg-gradient-to-r from-blue-300 to-indigo-300"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="bg-white border-2 border-blue-300 rounded-full p-1">
                                <ArrowRight className="w-3 h-3 text-blue-600" />
                              </div>
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm font-bold text-gray-900">{schedule.destination}</div>
                            <div className="text-xs text-gray-600">{schedule.arrivalTime}</div>
                          </div>
                        </div>
                        
                        <Button
                          onClick={() => handleBooking(schedule.id)}
                          size="sm"
                          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl"
                        >
                          Book Now
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSchedules.map((schedule, index) => (
              <div
                key={schedule.id}
                className="group bg-white rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100 hover:border-blue-200 transform hover:-translate-y-1"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="p-6 pb-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div className="relative">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
                          {schedule.companyName.charAt(0)}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white flex items-center justify-center shadow-md">
                          <CheckCircle className="w-3 h-3 text-white" />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                          {schedule.companyName}
                        </h3>
                        <div className="flex items-center space-x-2">
                          <p className="text-sm text-gray-600">{schedule.busType}</p>
                          <div className="flex items-center">
                            <Star className="w-3 h-3 text-yellow-400 fill-current" />
                            <span className="text-xs text-gray-500 ml-1">4.5</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        MWK {(schedule.price * 1700).toLocaleString()}
                      </div>
                      <p className="text-xs text-gray-500">per person</p>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-2xl p-4 mb-4 border border-blue-100">
                    <div className="flex items-center justify-between">
                      <div className="text-center">
                        <div className="text-sm font-bold text-gray-900">{schedule.origin}</div>
                        <div className="text-xs text-gray-600 mt-1">Departure</div>
                        <div className="text-sm font-bold text-blue-600 mt-1">{schedule.departureTime}</div>
                      </div>
                      <div className="flex-1 relative mx-4">
                        <div className="h-px bg-gradient-to-r from-blue-300 via-indigo-300 to-purple-300" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="bg-white rounded-full p-2 border border-blue-200 shadow-sm group-hover:scale-110 transition-transform">
                            <ArrowRight className="w-4 h-4 text-blue-600" />
                          </div>
                        </div>
                        <div className="text-center mt-2">
                          <span className="text-xs text-gray-500">{schedule.duration}h journey</span>
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-bold text-gray-900">{schedule.destination}</div>
                        <div className="text-xs text-gray-600 mt-1">Arrival</div>
                        <div className="text-sm font-bold text-indigo-600 mt-1">{schedule.arrivalTime}</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="flex items-center space-x-2 p-2 rounded-lg bg-gray-50">
                      <Users className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-700">
                        {schedule.availableSeats} seats
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 p-2 rounded-lg bg-gray-50">
                      <Zap className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-700">Fast Route</span>
                    </div>
                  </div>
                </div>

                <div className="px-6 pb-6">
                  <Button
                    onClick={() => handleBooking(schedule.id)}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 rounded-2xl transition-all duration-200 group-hover:shadow-lg transform active:scale-95"
                  >
                    Book Now
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && filteredSchedules.length === 0 && (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BusIcon className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No schedules found</h3>
            <p className="text-gray-600 mb-6">
              Try adjusting your search criteria or selecting a different date
            </p>
            <Button
              onClick={() => {
                setSearchTerm("");
                setSelectedOrigin("");
                setSelectedDestination("");
                setPriceRange([0, 100]);
                setUseLocation(false);
              }}
              variant="outline"
              className="rounded-2xl"
            >
              Clear Filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SchedulesPage;