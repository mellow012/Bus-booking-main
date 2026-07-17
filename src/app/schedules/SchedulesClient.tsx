"use client";

import React, { Suspense } from "react";
import {
  Search, MapPin, Calendar, Users, Navigation, Clock, CheckCircle, Bus as BusIcon,
  Filter, AlertCircle, RefreshCw, Zap, TrendingUp, ArrowRight, User, Star, X, ChevronLeft, ChevronRight
} from "lucide-react";
import BackButton from "@/components/BackButton";
import { LocationAutocomplete } from "@/components/LocationAutocomplete";
import { MALAWI_CITIES, getScheduleCategory } from "@/utils/homeHelpers";
import useSchedules from './_hooks/useSchedules';
import FiltersToolbar from './_components/FiltersToolbar';
import PopularRoutes from './_components/PopularRoutes';
import RecommendedSchedules from './_components/RecommendedSchedules';
import SchedulesGrid from './_components/SchedulesGrid';
import Pagination from './_components/Pagination';
import Image from "next/image";
import { ScheduleCard } from "@/components/ScheduleCard";
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

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

export default function SchedulesClient({ initialSchedules, initialCompanies }: { initialSchedules: EnhancedSchedule[]; initialCompanies: { id: string, name: string }[]; }) {
  const {
    // state
    loading, searching, error, setError,
    schedules, setSchedules, companies, setCompanies,
    // search
    searchFrom, setSearchFrom, searchTo, setSearchTo, searchDate, setSearchDate, returnDate, setReturnDate, passengers, setPassengers,
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
  } = useSchedules(initialSchedules, initialCompanies as any);

  if (loading) {
    return <LoadingSpinner className="text-brand-700" label="Loading schedules..." fullScreen />;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">

      {/* ─── Hero / Quick Search Bar ────────────────────────────────────────── */}
      {/* brand-900 → brand-800 → brand-700 | white text = 12:1 → 7.8:1 (AAA) ✓ */}
      <div className="bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 text-white pt-16 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-8 gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl py-4 font-extrabold font-display tracking-tight">
                Find Your Next Journey
              </h1>
            </div>
          </div>
          <div className="mt-4 flex items-start">
            <BackButton onClick={handleGoBack} iconOnly className="border-white/25 text-white hover:bg-white/15" />
          </div>

          <div className="max-w-7xl mx-auto mt-4">
            {/* brand-100 on dark teal bg = 9.6:1 (AAA) ✓ */}
            <div className="text-sm text-brand-100 text-center">
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
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Depart</label>
                <div className="space-y-2">
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    {/* focus:ring-brand-700 on white = visible teal ring */}
                    <input type="date" value={searchDate} onChange={e => setSearchDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-700 outline-none text-gray-900 accent-brand-700" placeholder="Depart date" />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSearchDate(todayDate)}
                      className={`flex-1 text-[10px] font-black uppercase tracking-widest py-2.5 rounded-xl border transition-all duration-200 ${
                        searchDate === todayDate
                          ? "bg-brand-700 text-white border-brand-700 shadow-md shadow-brand-50"
                          : "bg-gray-50 text-gray-500 border-gray-100 hover:border-brand-100 hover:text-brand-700 hover:bg-white"
                      }`}
                    >
                      Today
                    </button>
                    <button
                      onClick={() => setSearchDate(tomorrowDateStr)}
                      className={`flex-1 text-[10px] font-black uppercase tracking-widest py-2.5 rounded-xl border transition-all duration-200 ${
                        searchDate === tomorrowDateStr
                          ? "bg-brand-700 text-white border-brand-700 shadow-md shadow-brand-50"
                          : "bg-gray-50 text-gray-500 border-gray-100 hover:border-brand-100 hover:text-brand-700 hover:bg-white"
                      }`}
                    >
                      Tomorrow
                    </button>
                  </div>
                </div>
              </div>
              <div className="col-span-1 lg:col-span-1">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Return</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-700 outline-none text-gray-900 accent-brand-700" placeholder="Return date" />
                </div>
              </div>
              <div className="col-span-1 lg:col-span-1">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Passengers</label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="number" min="1" value={passengers} onChange={e => setPassengers(parseInt(e.target.value) || 1)} className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-700 outline-none text-gray-900" />
                </div>
              </div>
              <div className="col-span-1 md:col-span-4 lg:col-span-1 flex items-end">
                {/* coral-500 | white bold text = 3.4:1 (large-text AA ✓) */}
                <button
                  onClick={handleSearch}
                  className="w-full bg-coral-500 hover:bg-coral-600 active:scale-[0.98] active:shadow-inner text-white py-3 rounded-xl font-bold flex items-center justify-center transition duration-150 shadow-lg shadow-coral-100"
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
          <FiltersToolbar
            hasActiveSearch={hasActiveSearch}
            showFilters={showFilters}
            setShowFilters={setShowFilters}
            companies={companies}
            selectedCompany={selectedCompany}
            setSelectedCompany={setSelectedCompany}
            selectedTimeSlot={selectedTimeSlot}
            setSelectedTimeSlot={setSelectedTimeSlot}
            terminals={terminals}
            selectedTerminal={selectedTerminal}
            setSelectedTerminal={setSelectedTerminal}
            activeFilter={activeFilter}
            setActiveFilter={setActiveFilter}
          />
          <PopularRoutes
            popularRoutes={popularRoutes}
            handlePopularRoutesScroll={handlePopularRoutesScroll}
            setSearchFrom={setSearchFrom}
            setSearchTo={setSearchTo}
            handleSearch={handleSearch}
          />
          {/* Sorting Header */}
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <span className="text-sm font-bold text-gray-900">{filteredSchedules.length} schedules found</span>
              {selectedTerminal && (
                <button
                  onClick={() => setSelectedTerminal("")}
                  className="text-xs bg-brand-50 text-brand-700 px-3 py-1 rounded-full font-bold flex items-center gap-1 hover:bg-brand-100 transition-colors"
                >
                  Terminal: {selectedTerminal} <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">Sort by:</span>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-700 font-medium">
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
              <button onClick={() => { setSearchFrom(""); setSearchTo(""); setSearchDate(""); setActiveFilter("all"); }} className="mt-6 text-brand-700 font-bold hover:underline">Clear all filters</button>
            </div>
          ) : (
            <div className="space-y-12">
              <RecommendedSchedules recommendedSchedules={recommendedSchedules} userCity={userCity} handleBooking={handleBooking} />

              <SchedulesGrid regularSchedules={regularSchedules} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} handleBooking={handleBooking} userCity={userCity} />

              <Pagination currentPage={currentPage} totalPages={totalPages} setCurrentPage={setCurrentPage} itemsPerPage={itemsPerPage} filteredCount={filteredSchedules.length} />
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
