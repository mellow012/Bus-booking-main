"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Calendar, Users, Search, Navigation } from "lucide-react";
import { LocationAutocomplete } from "@/components/LocationAutocomplete";
import { CityPickerModal } from "@/components/CityPickerModal";
import { GeoStatus, MALAWI_CITIES, nearestCity } from "@/utils/homeHelpers";
import { storePendingSearch } from "@/lib/searchStorage";

const LS_CITY_KEY = "tb_user_city";
const LS_GEO_ASKED_KEY = "tb_geo_asked";

export default function HomeSearch() {
  const router = useRouter();
  const [search, setSearch] = useState({ from:"", to:"", date:"", passengers:1 });
  const [userCity, setUserCity] = useState<string|null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const [showCityPicker, setShowCityPicker] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);

  // Sync with general city preference changes from other components
  useEffect(() => {
    const handleCityChange = (e: Event) => {
      const customEvent = e as CustomEvent<string | null>;
      const city = customEvent.detail;
      setUserCity(city);
      if (city) {
        setSearch(p => ({ ...p, from: city }));
      }
    };
    window.addEventListener("tb-user-city-changed", handleCityChange);
    return () => {
      window.removeEventListener("tb-user-city-changed", handleCityChange);
    };
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(LS_CITY_KEY);
    if (saved) {
      setUserCity(saved);
      setSearch(p => ({ ...p, from: saved }));
      return;
    }
    const asked = localStorage.getItem(LS_GEO_ASKED_KEY);
    if (!asked && "geolocation" in navigator) {
      requestGeolocation();
    }
    // We removed the 'else setShowCityPicker(true)' to prevent the annoying auto-popup loop!
  }, []);

  const requestGeolocation = useCallback(() => {
    if (!("geolocation" in navigator)) { return; }
    setGeoStatus("detecting"); 
    localStorage.setItem(LS_GEO_ASKED_KEY, "1");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const city = nearestCity(pos.coords.latitude, pos.coords.longitude);
        setUserCity(city); 
        localStorage.setItem(LS_CITY_KEY, city);
        setSearch(p => ({ ...p, from: city }));
        setGeoStatus("granted"); 
        setShowCityPicker(false);
        window.dispatchEvent(new CustomEvent("tb-user-city-changed", { detail: city }));
      },
      () => { 
        setGeoStatus("denied"); 
        setShowCityPicker(true); 
      },
      { timeout: 8000 }
    );
  }, []);

  const handleSelectCity = useCallback((city: string) => {
    if (city) { 
      setUserCity(city); 
      localStorage.setItem(LS_CITY_KEY, city); 
      setSearch(p => ({ ...p, from: city }));
    } else { 
      setUserCity(null); 
      localStorage.removeItem(LS_CITY_KEY); 
    }
    setShowCityPicker(false);
    window.dispatchEvent(new CustomEvent("tb-user-city-changed", { detail: city }));
  }, []);

  const handleSearch = () => {
    // Store search criteria for potential redirect after login/profile completion
    storePendingSearch({
      from: search.from,
      to: search.to,
      date: search.date,
      passengers: search.passengers,
    });

    const p = new URLSearchParams({ 
      from: search.from, 
      to: search.to, 
      date: search.date, 
      passengers: String(search.passengers) 
    });
    router.push(`/schedules?${p}`);
  };

  return (
    <>
      {showCityPicker && (
        <CityPickerModal 
          onSelect={handleSelectCity} 
          onClose={() => setShowCityPicker(false)}
          geoStatus={geoStatus} 
          onRequestGeo={requestGeolocation} 
          current={userCity}
        />
      )}

      <div className="relative max-w-7xl mx-auto p-container -mt-12 sm:-mt-16 z-20">
        <div className="bg-white/95 glass rounded-[2rem] shadow-premium p-5 sm:p-8 anim-fade-up border-white/40">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            <div className="col-span-1">
              <div className="flex items-center justify-between mb-1.5 ml-1 mr-1">
                <label htmlFor="departure-input" className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">From</label>
                <button
                  type="button"
                  onClick={() => setShowCityPicker(true)}
                  className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700 transition-colors uppercase tracking-wider"
                >
                  <Navigation className="w-2.5 h-2.5 rotate-45 shrink-0" />
                  <span>{userCity || "Set City"}</span>
                </button>
              </div>
              <LocationAutocomplete 
                value={search.from} 
                onChange={v => setSearch(p => ({ ...p, from: v }))} 
                onSelect={v => setSearch(p => ({ ...p, from: v }))} 
                placeholder="Departure" 
                icon={MapPin} 
                cities={MALAWI_CITIES} 
                exclude={search.to}
              />
            </div>
            <div className="col-span-1">
              <label htmlFor="destination-input" className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">To</label>
              <LocationAutocomplete 
                value={search.to} 
                onChange={v => setSearch(p => ({ ...p, to: v }))} 
                onSelect={v => setSearch(p => ({ ...p, to: v }))} 
                placeholder="Destination" 
                icon={Navigation} 
                cities={MALAWI_CITIES} 
                exclude={search.from}
              />
            </div>
            <div className="col-span-1">
              <label htmlFor="date-input" className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Date</label>
              <div className="space-y-2">
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                  <input 
                    type="date" 
                    id="date-input"
                    value={search.date} 
                    onChange={e => setSearch(p => ({ ...p, date: e.target.value }))} 
                    className="w-full pl-9 pr-3 h-11 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSearch(p => ({ ...p, date: todayStr }))}
                    className={`flex-1 text-[10px] font-black uppercase tracking-widest py-2.5 rounded-xl border transition-all duration-200 ${
                      search.date === todayStr
                        ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100"
                        : "bg-gray-50 text-gray-500 border-gray-100 hover:border-blue-200 hover:text-blue-600 hover:bg-white"
                    }`}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearch(p => ({ ...p, date: tomorrowStr }))}
                    className={`flex-1 text-[10px] font-black uppercase tracking-widest py-2.5 rounded-xl border transition-all duration-200 ${
                      search.date === tomorrowStr
                        ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100"
                        : "bg-gray-50 text-gray-500 border-gray-100 hover:border-blue-200 hover:text-blue-600 hover:bg-white"
                    }`}
                  >
                    Tomorrow
                  </button>
                </div>
              </div>
            </div>
            <div className="col-span-1">
              <label htmlFor="passengers-input" className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Passengers</label>
              <div className="relative">
                <Users className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                <input 
                  type="number" 
                  id="passengers-input"
                  min="1" 
                  value={search.passengers} 
                  onChange={e => setSearch(p => ({ ...p, passengers: parseInt(e.target.value) || 1 }))} 
                  className="w-full pl-9 pr-3 h-11 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="col-span-2 lg:col-span-1 flex items-end">
              <button 
                onClick={handleSearch} 
                className="w-full h-11 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-lg active:scale-95"
                aria-label="Search bus schedules"
              >
                <Search className="w-4 h-4"/> Search
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
