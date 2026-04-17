import React, { useState, useRef, useEffect } from "react";
import { MapPin, X, Loader2, LocateFixed, Search } from "lucide-react";
import { GeoStatus, MALAWI_CITIES } from "@/utils/homeHelpers";

export const CityPickerModal = ({ onSelect, onClose, geoStatus, onRequestGeo, current }: {
  onSelect: (c: string) => void; onClose: () => void;
  geoStatus: GeoStatus; onRequestGeo: () => void; current: string | null;
}) => {
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const filtered = MALAWI_CITIES.filter(c => c.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Your City</p>
              <p className="text-xs text-gray-400">See routes near you first</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <button onClick={onRequestGeo}
            disabled={geoStatus==="detecting"||geoStatus==="unavailable"}
            className="w-full flex items-center gap-3 px-4 py-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors disabled:opacity-50">
            {geoStatus==="detecting"
              ? <Loader2 className="w-5 h-5 text-blue-600 animate-spin shrink-0"/>
              : <LocateFixed className="w-5 h-5 text-blue-600 shrink-0"/>}
            <div className="text-left">
              <p className="text-sm font-semibold text-blue-800">
                {geoStatus==="detecting"?"Detecting location…":geoStatus==="denied"?"Location access denied":geoStatus==="unavailable"?"Not available":"Use my current location"}
              </p>
              {geoStatus==="denied"&&<p className="text-xs text-blue-500 mt-0.5">Enable location in browser settings</p>}
            </div>
          </button>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
            <input ref={ref} type="text" placeholder="Search city…" value={query}
              onChange={e=>setQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          </div>

          <div className="max-h-56 overflow-y-auto">
            <div className="grid grid-cols-2 gap-1.5">
              {filtered.map(city=>(
                <button key={city} onClick={()=>onSelect(city)}
                  className={`text-left px-3 py-2.5 rounded-xl text-sm transition-colors ${
                    current===city?"bg-blue-600 text-white font-semibold":"bg-gray-50 text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                  }`}>
                  {city}{current===city&&<span className="ml-1 opacity-70">✓</span>}
                </button>
              ))}
              {!filtered.length&&<p className="col-span-2 text-center text-sm text-gray-400 py-4">No cities found</p>}
            </div>
          </div>

          {current&&(
            <button onClick={()=>onSelect("")}
              className="w-full text-xs text-gray-400 hover:text-rose-500 transition-colors py-1">
              Clear location filter
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
