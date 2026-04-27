"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Calendar, Users, Search, Navigation } from "lucide-react";
import { LocationAutocomplete } from "@/components/LocationAutocomplete";
import { CityPickerModal } from "@/components/CityPickerModal";
import { GeoStatus, MALAWI_CITIES } from "@/utils/homeHelpers";

const LS_CITY_KEY = "tb_user_city";
const LS_GEO_ASKED_KEY = "tb_geo_asked";

const CITY_COORDS: Record<string, { lat: number, lng: number }> = {
  "Blantyre": { lat: -15.7861, lng: 35.0058 },
  "Lilongwe": { lat: -13.9626, lng: 33.7741 },
  "Mzuzu": { lat: -11.4656, lng: 34.0207 },
  "Zomba": { lat: -15.3850, lng: 35.3181 },
  "Kasungu": { lat: -13.0333, lng: 33.4833 },
  "Mangochi": { lat: -14.4782, lng: 35.2645 },
  "Salima": { lat: -13.7804, lng: 34.4587 },
  "Karonga": { lat: -9.9333, lng: 33.9333 },
  "Nkhata Bay": { lat: -11.6066, lng: 34.2907 },
  "Dedza": { lat: -14.3778, lng: 34.3333 },
};

const nearestCity = (lat: number, lng: number) => {
  let closest = "Blantyre";
  let minDiff = Infinity;
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    const diff = Math.pow(coords.lat - lat, 2) + Math.pow(coords.lng - lng, 2);
    if (diff < minDiff) { minDiff = diff; closest = city; }
  }
  return closest;
};

export default function HomeSearch() {
  const router = useRouter();
  const [search, setSearch] = useState({ from:"", to:"", date:"", passengers:1 });
  const [userCity, setUserCity] = useState<string|null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const [showCityPicker, setShowCityPicker] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(LS_CITY_KEY);
    if (saved) { setUserCity(saved); return; }
    const asked = localStorage.getItem(LS_GEO_ASKED_KEY);
    if (!asked && "geolocation" in navigator) requestGeolocation();
    else setShowCityPicker(true);
  }, []);

  const requestGeolocation = useCallback(() => {
    if (!("geolocation" in navigator)) { setShowCityPicker(true); return; }
    setGeoStatus("detecting"); localStorage.setItem(LS_GEO_ASKED_KEY,"1");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const city = nearestCity(pos.coords.latitude, pos.coords.longitude);
        setUserCity(city); localStorage.setItem(LS_CITY_KEY, city);
        setGeoStatus("granted"); setShowCityPicker(false);
      },
      () => { setGeoStatus("denied"); setShowCityPicker(true); },
      { timeout: 8000 }
    );
  }, []);

  const handleSelectCity = useCallback((city: string) => {
    if (city) { setUserCity(city); localStorage.setItem(LS_CITY_KEY, city); }
    else { setUserCity(null); localStorage.removeItem(LS_CITY_KEY); }
    setShowCityPicker(false);
  }, []);

  const handleSearch = () => {
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
              <label htmlFor="departure-input" className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">From</label>
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
