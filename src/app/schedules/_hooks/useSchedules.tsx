"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { useAppToast } from "@/contexts/ToastContext";
import { MALAWI_CITIES, getScheduleCategory } from "@/utils/homeHelpers";

export default function useSchedules(initialSchedules: any[], initialCompanies: any[]) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userProfile } = useAuth();
  const { unreadCount } = useNotifications();
  const toast = useAppToast();

  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  // Data state
  const [schedules, setSchedules] = useState<any[]>(initialSchedules || []);
  const [companies, setCompanies] = useState<any[]>(initialCompanies || []);

  // Search/Filter state
  const [searchFrom, setSearchFrom] = useState(searchParams?.get('from') || "");
  const [searchTo, setSearchTo] = useState(searchParams?.get('to') || "");
  const [searchDate, setSearchDate] = useState(searchParams?.get('date') || "");
  const [passengers, setPassengers] = useState(parseInt(searchParams?.get('passengers') || "1"));

  const [activeFilter, setActiveFilter] = useState("all");
  const [sortBy, setSortBy] = useState<'price' | 'time' | 'company'>('price');

  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("");
  const [selectedTerminal, setSelectedTerminal] = useState(searchParams?.get('terminal') || "");
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
      return () => window.removeEventListener("tb-user-city-changed", handleCityChange);
    }
  }, []);

  // Reset page when any filter changes
  useEffect(() => { setCurrentPage(1); }, [searchFrom, searchTo, searchDate, activeFilter, sortBy, selectedCompany, selectedTimeSlot, selectedTerminal, selectedCategory]);

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

      const enhancedSchedules: any[] = apiSchedules.map((schedule: any) => ({
        id: schedule.id,
        companyName: schedule.companyName,
        busNumber: schedule.busNumber,
        busType: schedule.busType,
        origin: schedule.origin,
        destination: schedule.destination,
        departureTime: new Date(schedule.departureDateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
        arrivalTime: new Date(schedule.arrivalDateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
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
      // Error already surfaced to UI via setError
      setError("Unable to find schedules. Please try again.");
    } finally { setSearching(false); }
  }, [searchFrom, searchTo, searchDate, passengers, router]);

  useEffect(() => {
    if (schedules.length > 0) {
      const routesMap = new Map();
      schedules.forEach(s => {
        const key = `${s.origin}-${s.destination}`;
        if (!routesMap.has(key)) {
          routesMap.set(key, { id: s.id, from: s.origin, to: s.destination, price: s.price, busType: s.busType });
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
      container.scrollTo({ left: targetScroll, behavior: 'smooth' });
    }
  };

  const terminals = useMemo(() => {
    const termMap = new Map();
    schedules.forEach(s => {
      if (s.departureLocation) {
        const key = s.departureLocation;
        if (!termMap.has(key)) {
          termMap.set(key, { name: key, count: 0, city: s.origin });
        }
        termMap.get(key).count++;
      }
    });
    return Array.from(termMap.values()).sort((a, b) => b.count - a.count);
  }, [schedules]);

  const handleGoBack = () => {
    const canGoBack = typeof window !== 'undefined' && window.history.state && typeof window.history.state.idx === 'number' && window.history.state.idx > 0;
    if (canGoBack) router.back(); else router.push('/');
  };

  const handleBooking = (scheduleId: string, companyId: string, routeId: string) => {
    const bookingUrl = `/book/${scheduleId}?companyId=${companyId}&routeId=${routeId}&passengers=${passengers}`;
    if (!user) { toast.warning('Login Required', 'Please sign in to book a bus ticket.'); router.push(`/login?redirect=${encodeURIComponent(bookingUrl)}`); return; }
    toast.info('Loading Booking', 'Preparing your booking page...');
    router.push(bookingUrl);
  };

  const filteredSchedules = useMemo(() => {
    let filtered = schedules;
    if (searchFrom) filtered = filtered.filter(s => s.origin.toLowerCase().includes(searchFrom.toLowerCase()));
    if (searchTo) filtered = filtered.filter(s => s.destination.toLowerCase().includes(searchTo.toLowerCase()));
    if (searchDate) filtered = filtered.filter(s => s.date === searchDate);
    if (!searchFrom && !searchTo && !searchDate) {
      const todayStr = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      filtered = filtered.filter(s => s.date === todayStr || s.date === tomorrowStr);
    }
    if (activeFilter === 'today') {
      const todayStr = new Date().toISOString().split('T')[0]; filtered = filtered.filter(s => s.date === todayStr);
    } else if (activeFilter === 'morning') filtered = filtered.filter(s => parseInt(s.departureTime.split(':')[0]) < 12);
    else if (activeFilter === 'economy') filtered = filtered.filter(s => s.busType.toLowerCase().includes('economy'));
    else if (activeFilter === 'luxury') filtered = filtered.filter(s => s.busType.toLowerCase().includes('luxury') || s.busType.toLowerCase().includes('vip'));
    if (selectedCompany) filtered = filtered.filter(s => s.companyName === selectedCompany);
    if (selectedTimeSlot) {
      if (selectedTimeSlot === 'morning') filtered = filtered.filter(s => { const h = parseInt(s.departureTime.split(':')[0]); return h >= 5 && h < 12; });
      else if (selectedTimeSlot === 'afternoon') filtered = filtered.filter(s => { const h = parseInt(s.departureTime.split(':')[0]); return h >= 12 && h < 17; });
      else if (selectedTimeSlot === 'evening') filtered = filtered.filter(s => { const h = parseInt(s.departureTime.split(':')[0]); return h >= 17 && h < 21; });
    }
    if (selectedTerminal) filtered = filtered.filter(s => s.departureLocation === selectedTerminal);
    if (selectedCategory) filtered = filtered.filter(s => getScheduleCategory(s as any) === selectedCategory);
    filtered.sort((a, b) => { switch (sortBy) { case 'price': return a.price - b.price; case 'time': return a.departureTime.localeCompare(b.departureTime); case 'company': return a.companyName.localeCompare(b.companyName); default: return 0; } });
    return filtered;
  }, [schedules, searchFrom, searchTo, searchDate, activeFilter, sortBy, selectedCompany, selectedTimeSlot, selectedTerminal, selectedCategory]);

  const paginatedSchedules = useMemo(() => { const startIndex = (currentPage - 1) * itemsPerPage; return filteredSchedules.slice(startIndex, startIndex + itemsPerPage); }, [filteredSchedules, currentPage]);

  const recommendedSchedules = useMemo(() => { if (!userCity || searchFrom) return []; return paginatedSchedules.filter(s => s.origin.toLowerCase() === userCity.toLowerCase()); }, [paginatedSchedules, userCity, searchFrom]);

  const regularSchedules = useMemo(() => { if (recommendedSchedules.length === 0) return paginatedSchedules; const recommendedIds = new Set(recommendedSchedules.map(s => s.id)); return paginatedSchedules.filter(s => !recommendedIds.has(s.id)); }, [paginatedSchedules, recommendedSchedules]);

  const totalPages = Math.ceil(filteredSchedules.length / itemsPerPage);

  return {
    // contexts
    router,
    // state
    loading, searching, error, setError,
    schedules, setSchedules, companies, setCompanies,
    // search/filter state
    searchFrom, setSearchFrom, searchTo, setSearchTo, searchDate, setSearchDate, passengers, setPassengers,
    activeFilter, setActiveFilter, sortBy, setSortBy,
    selectedCompany, setSelectedCompany, selectedTimeSlot, setSelectedTimeSlot, selectedTerminal, setSelectedTerminal,
    selectedCategory, setSelectedCategory, showFilters, setShowFilters,
    // pagination
    currentPage, setCurrentPage, itemsPerPage,
    // helpers
    popularRoutes, popularRoutesScrollRef, handlePopularRoutesScroll, terminals,
    handleGoBack, handleBooking, handleSearch,
    filteredSchedules, paginatedSchedules, recommendedSchedules, regularSchedules, totalPages,
    userCity, todayDate, tomorrowDateStr, isFutureDateSearch, hasActiveSearch,
  } as const;
}
