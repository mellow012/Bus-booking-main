"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { collection, query, where, orderBy, limit, Timestamp, onSnapshot, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { 
  Bus as BusIcon, 
  MapPin, 
  Clock, 
  Loader2, 
  Calendar,
  Users,
  Star,
  ArrowRight,
  Zap,
  Shield,
  CheckCircle,
  RefreshCw,
  Award,
  Navigation,
  Wifi,
  AirVent,
  Search,
  Play,
  Music,
  Coffee,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import PromoBanner from "@/components/PromoBanner";
import PopularRoutesCarousel from "@/components/PopularRouteCarousal";
import HowItWorks from "@/components/HowItWorks";
import Partners from "@/components/Partners";

interface SearchCriteria {
  from: string;
  to: string;
  date: string;
  passengers: number;
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

interface Company {
  id: string;
  name: string;
  phone?: string;
  status: string;
  logoUrl?: string;
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

interface EnhancedSchedule {
  id: string;
  companyLogo?: string;
  companyId: string;
  busId: string;
  routeId: string;
  price: number;
  availableSeats: number;
  status: string;
  date: string;
  departureDateTime: string; // Changed to string
  arrivalDate: string;
  arrivalTime: string;
  companyName: string;
  companyPhone?: string;
  origin: string;
  destination: string;
  duration: number;
  distance: number;
  busNumber: string;
  busType: string;
  totalSeats: number;
  amenities: string[];
}

class SmartCache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  
  set(key: string, data: any, ttl = 300000) {
    this.cache.set(key, { data, timestamp: Date.now(), ttl });
  }
  
  get(key: string) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }
    return item.data;
  }
  
  clear() {
    this.cache.clear();
  }
}

const cache = new SmartCache();

const StatsCardSkeleton = () => (
  <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 text-center shadow-lg border border-white/20 animate-pulse" aria-hidden="true">
    <div className="w-8 h-8 bg-gray-200 rounded-full mx-auto mb-3"></div>
    <div className="h-8 bg-gray-200 rounded w-16 mx-auto mb-2"></div>
    <div className="h-4 bg-gray-200 rounded w-20 mx-auto"></div>
  </div>
);

const ScheduleCardSkeleton = () => (
  <div className="bg-white rounded-3xl shadow-lg p-6 animate-pulse border border-gray-100" aria-hidden="true">
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center space-x-4">
        <div className="w-14 h-14 bg-gray-200 rounded-2xl"></div>
        <div className="flex-1">
          <div className="h-5 bg-gray-200 rounded mb-2 w-32"></div>
          <div className="h-4 bg-gray-200 rounded w-24"></div>
        </div>
      </div>
      <div className="text-right">
        <div className="h-6 bg-gray-200 rounded w-20 mb-1"></div>
        <div className="h-3 bg-gray-200 rounded w-16"></div>
      </div>
    </div>
    <div className="bg-gray-100 rounded-2xl p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="text-center">
          <div className="h-4 bg-gray-200 rounded w-16 mb-1"></div>
          <div className="h-3 bg-gray-200 rounded w-12"></div>
        </div>
        <div className="flex-1 relative mx-4">
          <div className="h-px bg-gray-200"></div>
        </div>
        <div className="text-center">
          <div className="h-4 bg-gray-200 rounded w-16 mb-1"></div>
          <div className="h-3 bg-gray-200 rounded w-12"></div>
        </div>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-4 mb-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded flex-1"></div>
        </div>
      ))}
    </div>
    <div className="flex gap-2 mb-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-6 bg-gray-200 rounded-full w-16"></div>
      ))}
    </div>
    <div className="h-12 bg-gray-200 rounded-2xl"></div>
  </div>
);

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [searchCriteria, setSearchCriteria] = useState<SearchCriteria>({
    from: "",
    to: "",
    date: "",
    passengers: 1,
  });
  
  const [featuredSchedules, setFeaturedSchedules] = useState<EnhancedSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const stats = useMemo(() => ({
    totalRoutes: 20,
    totalCompanies: 5,
    totalBookings: 100,
    avgRating: 4.6,
  }), []);

  const amenityIcons: { [key: string]: any } = {
    "WiFi": Wifi,
    "AC": AirVent,
    "Coffee": Coffee,
    "Entertainment": Music,
    "Charging": Zap,
    "Reclining Seats": Users,
  };

  const fetchSchedulesWithDetails = useCallback(async (refresh = false) => {
    const cacheKey = "featured-schedules";
    if (!refresh) {
      const cached = cache.get(cacheKey);
      if (cached) {
        setFeaturedSchedules(cached);
        setLoading(false);
        return;
      }
    }

    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    setError("");

    try {
      const now = new Date();
      const today = Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()));

      const schedulesQuery = query(
        collection(db, "schedules"),
        where("status", "==", "active"),
        where("departureDateTime", ">=", today),
        orderBy("departureDateTime"),
        limit(5)
      );

      const [companiesSnapshot, busesSnapshot, routesSnapshot] = await Promise.all([
        getDocs(query(collection(db, "companies"), where("status", "==", "active"))),
        getDocs(query(collection(db, "buses"), where("status", "==", "active"))),
        getDocs(query(collection(db, "routes"), where("isActive", "==", true))),
      ]);

      const companiesMap = new Map();
      companiesSnapshot.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() } as Company;
        companiesMap.set(doc.id, data);
      });

      const busesMap = new Map();
      busesSnapshot.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() } as Bus;
        busesMap.set(doc.id, data);
      });

      const routesMap = new Map();
      routesSnapshot.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() } as Route;
        routesMap.set(doc.id, data);
      });

      const enhanceSchedule = (schedule: Schedule) => {
        if (schedule.availableSeats <= 0 || schedule.departureDateTime.toDate() < new Date()) return null;

        const company = companiesMap.get(schedule.companyId);
        const bus = busesMap.get(schedule.busId);
        const route = routesMap.get(schedule.routeId);

        if (company && bus && route) {
          const departureDateTime = schedule.departureDateTime.toDate();
          const arrivalDateTime = schedule.arrivalDateTime.toDate();
          const date = departureDateTime.toISOString().split("T")[0];
          const departureTime = departureDateTime.toTimeString().slice(0, 5);
          const arrivalDate = arrivalDateTime.toISOString().split("T")[0];
          const arrivalTime = arrivalDateTime.toTimeString().slice(0, 5);

          return {
            id: schedule.id,
            companyId: schedule.companyId,
            busId: schedule.busId,
            routeId: schedule.routeId,
            price: schedule.price,
            availableSeats: schedule.availableSeats,
            status: schedule.status,
            date,
            departureDateTime: departureTime,
            arrivalDate,
            arrivalTime,
            companyName: company.name,
            companyPhone: company.phone,
      
            companyLogo: company.logo || company.logoUrl || null,
            origin: route.origin,
            destination: route.destination,
            duration: route.duration,
            distance: route.distance,
            busNumber: bus.licensePlate,
            busType: bus.busType || "Standard",
            totalSeats: bus.capacity || bus.totalSeats || 40,
            amenities: bus.amenities || [],
          } as EnhancedSchedule;
        }
        return null;
      };

      onSnapshot(schedulesQuery, (snapshot) => {
        const enhancedSchedules: EnhancedSchedule[] = [];
        snapshot.forEach((doc) => {
          const schedule = { id: doc.id, ...doc.data() } as Schedule;
          const enhanced = enhanceSchedule(schedule);
          if (enhanced) enhancedSchedules.push(enhanced);
        });

        const sortedSchedules = enhancedSchedules.sort((a, b) =>
          new Date(a.date + "T" + a.departureDateTime).getTime() - new Date(b.date + "T" + b.departureDateTime).getTime()
        );

        cache.set(cacheKey, sortedSchedules, 180000);
        setFeaturedSchedules(sortedSchedules);
        setLoading(false);
        setRefreshing(false);
      }, (error) => {
        console.error("Snapshot error:", error.message);
        setError("Failed to load schedules. Check your internet connection.");
        setLoading(false);
        setRefreshing(false);
      });
    } catch (err: any) {
      console.error("Fetch error:", err.message);
      setError("Failed to load schedules. Please try again later.");
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedulesWithDetails();
    return () => {
      // Cleanup subscription if component unmounts
    };
  }, [fetchSchedulesWithDetails]);

  const handleSearch = useCallback((newCriteria: SearchCriteria) => {
    const sanitizedCriteria = {
      from: newCriteria.from.trim(),
      to: newCriteria.to.trim(),
      date: newCriteria.date,
      passengers: Math.max(1, newCriteria.passengers),
    };
    const urlParams = new URLSearchParams(sanitizedCriteria as any);
    router.push(`/search?${urlParams.toString()}`);
  }, [router]);

  const handleBooking = useCallback((scheduleId: string) => {
    if (!user) {
      router.push("/login");
      return;
    }
    router.push(`/book/${scheduleId}?passengers=${searchCriteria.passengers || 1}`);
  }, [router, searchCriteria.passengers, user]);

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? (mins > 0 ? `${hours}h ${mins}m` : `${hours}h`) : `${mins}m`;
  };

  const getSeatAvailabilityColor = (available: number, total: number) => {
    const percentage = (available / total) * 100;
    return percentage > 50 ? "text-green-600" : percentage > 25 ? "text-yellow-600" : "text-red-600";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 overflow-hidden">
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fadeIn 0.8s ease-out; }
        img { transition: opacity 0.3s ease; }
        img:not([src]) { opacity: 0; }
      `}</style>
      
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-indigo-600/5 to-purple-600/10" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-400/20 to-indigo-600/20 rounded-full blur-3xl transform translate-x-32 -translate-y-32" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-indigo-400/20 to-blue-600/20 rounded-full blur-3xl transform -translate-x-16 translate-y-16" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center mb-12">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium mb-6 animate-pulse" role="alert">
                <Zap className="w-4 h-4 mr-2" />
                Malawi's #1 Bus Booking Platform
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Travel Smart with{' '}
                <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  BooknPay
                </span>
              </h1>
              <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto lg:mx-0 leading-relaxed mb-8">
                Book your journey across Malawi with confidence. Fast, secure, and reliable bus bookings at your fingertips.
              </p>
              
              <div className="flex flex-wrap gap-6 justify-center lg:justify-start">
                <div className="flex items-center space-x-2 text-gray-600" aria-label="Instant Booking">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-sm font-medium">Instant Booking</span>
                </div>
                <div className="flex items-center space-x-2 text-gray-600" aria-label="Secure Payment">
                  <Shield className="w-5 h-5 text-blue-500" />
                  <span className="text-sm font-medium">Secure Payment</span>
                </div>
                <div className="flex items-center space-x-2 text-gray-600" aria-label="24/7 Support">
                  <Users className="w-5 h-5 text-purple-500" />
                  <span className="text-sm font-medium">24/7 Support</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mt-6">
                <Button onClick={() => handleSearch(searchCriteria)} className="btn-hero" aria-label="Find Your Journey">
                  <Search className="w-5 h-5 mr-2" />
                  Find Your Journey
                </Button>
                <Button variant="outline" className="group border-primary/20 text-primary hover:bg-primary/5" aria-label="Watch Demo">
                  <Play className="w-4 h-4 mr-2" />
                  Watch Demo
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </div>
            
            <div className="relative">
              <div className="relative z-10">
                <div className="w-full max-w-lg mx-auto">
                  <img 
                    src="/Bus driver-rafiki.svg" 
                    alt="Bus Transportation Illustration"
                    className="w-full h-auto animate-fade-in"
                    style={{ filter: "hue-rotate(15deg) saturate(1.1)" }}
                    loading="lazy"
                  />
                </div>
              </div>
              
              <div className="absolute -top-4 -right-4 w-16 h-16 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center shadow-xl animate-pulse">
                <CheckCircle className="w-8 h-8 text-white drop-shadow-sm" />
              </div>
              
              <div className="absolute -bottom-4 -left-4 w-14 h-14 bg-gradient-to-r from-purple-400 to-pink-500 rounded-full flex items-center justify-center shadow-xl animate-bounce" style={{animationDelay: "1s"}}>
                <Zap className="w-7 h-7 text-white drop-shadow-sm" />
              </div>
              
              <div className="absolute top-8 left-8 w-8 h-8 bg-yellow-400 rounded-full opacity-80 animate-pulse" style={{animationDelay: "0.5s"}}></div>
              <div className="absolute bottom-12 right-12 w-6 h-6 bg-pink-400 rounded-full opacity-70 animate-bounce" style={{animationDelay: "2s"}}></div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-12">
            {loading ? (
              Array(4).fill(0).map((_, i) => <StatsCardSkeleton key={i} />)
            ) : (
              [
                { icon: Navigation, label: "Active Routes", value: stats.totalRoutes, gradient: "from-blue-500 to-cyan-500", pattern: "M0,0 L20,20 M20,0 L0,20" },
                { icon: BusIcon, label: "Partner Companies", value: stats.totalCompanies, gradient: "from-green-500 to-emerald-500", pattern: "M0,10 L20,10 M10,0 L10,20" },
                { icon: Users, label: "Happy Travelers", value: stats.totalBookings, gradient: "from-purple-500 to-pink-500", pattern: "M5,5 L15,15 M15,5 L5,15 M10,0 L10,20 M0,10 L20,10" },
                { icon: Award, label: "Customer Rating", value: stats.avgRating, isRating: true, gradient: "from-yellow-500 to-orange-500", pattern: "M0,0 Q10,5 20,0 Q10,15 0,20" },
              ].map((stat, index) => (
                <div key={index} className="group bg-white/80 backdrop-blur-sm rounded-2xl p-6 text-center shadow-lg border border-white/20 hover:shadow-xl hover:bg-white/90 transition-all duration-300 relative overflow-hidden">
                  <div className="absolute inset-0 opacity-5">
                    <svg className="w-full h-full">
                      <defs>
                        <pattern id={`pattern-${index}`} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                          <path d={stat.pattern} stroke="#3B82F6" strokeWidth="1" fill="none"/>
                        </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill={`url(#pattern-${index})`} />
                    </svg>
                  </div>
                  
                  <div className={`w-12 h-12 bg-gradient-to-r ${stat.gradient} rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300 relative z-10`}>
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-2xl lg:text-3xl font-bold text-gray-900 mb-1 relative z-10">
                    {stat.isRating ? stat.value.toFixed(1) : stat.value.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600 font-medium relative z-10">{stat.label}</div>
                </div>
              ))
            )}
          </div>

          <div className="bg-white/90 backdrop-blur-lg rounded-3xl shadow-2xl p-6 lg:p-8 border border-white/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-100/50 to-indigo-100/50 rounded-full blur-2xl transform translate-x-16 -translate-y-16" />
            <div className="relative">
              <div className="flex items-center mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <Calendar className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Find Your Journey</h3>
                    <p className="text-gray-600">Search and compare bus schedules across Malawi</p>
                  </div>
                </div>
              </div>
              {loading ? (
                <div className="animate-pulse" aria-live="polite">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <div className="h-4 bg-gray-200 rounded w-16 mb-2"></div>
                      <div className="h-12 bg-gray-200 rounded-lg"></div>
                    </div>
                    <div>
                      <div className="h-4 bg-gray-200 rounded w-12 mb-2"></div>
                      <div className="h-12 bg-gray-200 rounded-lg"></div>
                    </div>
                    <div>
                      <div className="h-4 bg-gray-200 rounded w-10 mb-2"></div>
                      <div className="h-12 bg-gray-200 rounded-lg"></div>
                    </div>
                    <div>
                      <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
                      <div className="h-12 bg-gray-200 rounded-lg"></div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="h-12 bg-gray-200 rounded-lg w-full"></div>
                  </div>
                </div>
              ) : (
                <div className="grid md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2" htmlFor="from">From</label>
                    <input
                      id="from"
                      type="text"
                      placeholder="Departure city"
                      value={searchCriteria.from}
                      onChange={(e) => setSearchCriteria((prev) => ({ ...prev, from: e.target.value.trim() }))}
                      className="h-12 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      aria-required="true"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2" htmlFor="to">To</label>
                    <input
                      id="to"
                      type="text"
                      placeholder="Destination city"
                      value={searchCriteria.to}
                      onChange={(e) => setSearchCriteria((prev) => ({ ...prev, to: e.target.value.trim() }))}
                      className="h-12 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      aria-required="true"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2" htmlFor="date">Date</label>
                    <input
                      id="date"
                      type="date"
                      value={searchCriteria.date}
                      onChange={(e) => setSearchCriteria((prev) => ({ ...prev, date: e.target.value }))}
                      className="h-12 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      aria-required="true"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2" htmlFor="passengers">Passengers</label>
                    <input
                      id="passengers"
                      type="number"
                      min="1"
                      value={searchCriteria.passengers}
                      onChange={(e) => setSearchCriteria((prev) => ({ ...prev, passengers: Math.max(1, parseInt(e.target.value) || 1) }))}
                      className="h-12 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      aria-required="true"
                    />
                  </div>
                  <div className="mt-6">
                    <Button
                      onClick={() => handleSearch(searchCriteria)}
                      className="btn-hero w-full"
                      aria-label="Search Buses"
                    >
                      <Search className="w-4 h-4 mr-2" />
                      Search Buses
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <PromoBanner onCtaClick={() => router.push("/promotions")} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
              <BusIcon className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Featured Routes</h2>
              <p className="text-gray-600">Popular destinations departing soon</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push("/schedules")}
            className="group border-primary/20 text-primary hover:bg-primary/5"
            aria-label="View All Routes"
          >
            View All Routes
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-8 animate-slide-down" role="alert">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-red-800 font-semibold mb-1">Unable to load schedules</h3>
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              </div>
              <Button
                onClick={() => fetchSchedulesWithDetails(true)}
                variant="outline"
                size="sm"
                className="border-red-200 text-red-700 hover:bg-red-50"
                disabled={refreshing}
                aria-label="Retry Loading Schedules"
              >
                {refreshing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Retry
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12" aria-live="polite">
            {Array(5).fill(0).map((_, i) => <ScheduleCardSkeleton key={i} />)}
          </div>
        ) : featuredSchedules.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {featuredSchedules.map((schedule, index) => (
              <div
                key={schedule.id}
                className="card-elevated card-glow group hover:scale-105 transition-all duration-300"
                style={{ animationDelay: `${index * 100}ms` }}
                role="article"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div className="relative">
                        {schedule.companyLogo ? (
                          <div className="w-16 h-16 bg-gray-100 rounded-2xl overflow-hidden flex items-center justify-center shadow-lg">
                          <img
                            src={schedule.companyLogo}
                            alt={schedule.companyName}
                            className="absolute inset-0 w-full h-full object-cover rounded-2xl"
                            loading="lazy"
                          />
                          </div>
                        ) : (
                          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
                            {schedule.companyName.charAt(0)}
                          </div>
                        )}
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-success rounded-full border-2 border-background flex items-center justify-center shadow-md">
                          <CheckCircle className="w-3 h-3 text-white" />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                          {schedule.companyName}
                        </h3>
                        <div className="flex items-center space-x-3">
                          <span className="text-sm text-gray-600 px-2 py-1 bg-gray-100 rounded-lg font-medium">
                            {schedule.busType}
                          </span>
                          <div className="flex items-center">
                            <Star className="w-4 h-4 text-yellow-400 fill-current" />
                            <span className="text-sm text-gray-600 ml-1 font-medium">4.6</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gradient-primary">
                        MWK {(schedule.price * 1700).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-600">per person</div>
                    </div>
                  </div>

                  <div className="bg-gray-100 rounded-2xl p-4 mb-4 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="text-center">
                        <div className="text-sm font-bold text-gray-900">{schedule.origin}</div>
                        <div className="text-xs text-gray-600 mt-1">Origin</div>
                      </div>
                      <div className="flex-1 relative mx-4">
                        <div className="h-px bg-gradient-to-r from-blue-500/30 via-indigo-600 to-blue-500/30" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="bg-white rounded-full p-2 border border-blue-200/50 shadow-sm group-hover:scale-110 transition-transform">
                            <ArrowRight className="w-4 h-4 text-blue-600" />
                          </div>
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-bold text-gray-900">{schedule.destination}</div>
                        <div className="text-xs text-gray-600 mt-1">Destination</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="flex items-center space-x-2 p-2 rounded-lg bg-gray-50">
                      <Calendar className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-900">
                        {new Date(schedule.date).toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 p-2 rounded-lg bg-gray-50">
                      <Clock className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-900">{schedule.departureDateTime}</span>
                    </div>
                    <div className="flex items-center space-x-2 p-2 rounded-lg bg-gray-50">
                      <Users className={`w-4 h-4 flex-shrink-0 ${getSeatAvailabilityColor(schedule.availableSeats, schedule.totalSeats)}`} />
                      <span className={`text-sm font-medium ${getSeatAvailabilityColor(schedule.availableSeats, schedule.totalSeats)}`}>
                        {schedule.availableSeats} seats left
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 p-2 rounded-lg bg-gray-50">
                      <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-900">{formatDuration(schedule.duration)}</span>
                    </div>
                  </div>

                  {schedule.amenities && schedule.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {schedule.amenities.slice(0, 4).map((amenity, index) => {
                        const IconComponent = amenityIcons[amenity] || Shield;
                        return (
                          <div
                            key={index}
                            className="flex items-center space-x-1 text-xs px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full font-medium"
                            aria-label={amenity}
                          >
                            <IconComponent className="w-3 h-3" />
                            <span>{amenity}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <Button
                    onClick={() => handleBooking(schedule.id)}
                    className={`btn-hero w-full ${schedule.availableSeats <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={schedule.availableSeats <= 0}
                    aria-label={`Book journey to ${schedule.destination}`}
                  >
                    Book Journey
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 mb-12" role="alert">
            <div className="bg-white rounded-3xl shadow-lg p-12 max-w-lg mx-auto relative overflow-hidden">
              <div className="relative z-10 mb-8">
                <div className="w-48 h-36 mx-auto mb-6">
                  <img 
                    src="/Bus Stop-rafiki.svg" 
                    alt="https://storyset.com/bus"
                    className="w-full h-full object-contain opacity-80"
                    style={{ filter: "hue-rotate(200deg) saturate(0.8)" }}
                    loading="lazy"
                  />
                </div>
              </div>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">No Schedules Available</h3>
              <p className="text-gray-600 mb-6">
                No bus schedules are currently available. Please check back later.
              </p>
              <Button
                onClick={() => fetchSchedulesWithDetails(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                disabled={refreshing}
                aria-label="Refresh Schedules"
              >
                {refreshing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Refresh
              </Button>
              
              <div className="absolute -top-3 -right-3 w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-500 rounded-full flex items-center justify-center shadow-lg opacity-80">
                <BusIcon className="w-4 h-4 text-white" />
              </div>
              <div className="absolute -bottom-3 -left-3 w-6 h-6 bg-gradient-to-br from-purple-400 to-purple-500 rounded-full flex items-center justify-center shadow-md opacity-70">
                <MapPin className="w-3 h-3 text-white" />
              </div>
              <div className="absolute top-8 left-8 w-4 h-4 bg-yellow-400 rounded-full opacity-60 animate-pulse"></div>
              <div className="absolute bottom-16 right-8 w-3 h-3 bg-pink-400 rounded-full opacity-50 animate-bounce" style={{ animationDelay: "1s" }}></div>
            </div>
          </div>
          
        )}
        <HowItWorks />
      </div>
    </div>
  );
}