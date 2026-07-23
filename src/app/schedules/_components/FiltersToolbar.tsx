"use client";

import React from "react";
import { Filter, X } from "lucide-react";

export default function FiltersToolbar({
  showFilters,
  setShowFilters,
  companies,
  selectedCompany,
  setSelectedCompany,
  selectedTimeSlot,
  setSelectedTimeSlot,
  terminals,
  selectedTerminal,
  setSelectedTerminal,
  activeFilter,
  setActiveFilter,
}: any) {
  if (!showFilters) return null;

  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 min-w-0 transition-all duration-200 animate-in fade-in slide-in-from-top-2">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-brand-700" />
          <span className="text-sm font-bold text-gray-900">Filter Schedules</span>
        </div>
        <button
          onClick={() => setShowFilters(false)}
          className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Close filters"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedCompany}
          onChange={(e) => setSelectedCompany(e.target.value)}
          className="w-full max-w-[220px] sm:w-auto min-w-0 text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-700"
        >
          <option value="">All Companies</option>
          {companies.map((c: any) => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>

        <select
          value={selectedTimeSlot}
          onChange={(e) => setSelectedTimeSlot(e.target.value)}
          className="w-full max-w-[220px] sm:w-auto min-w-0 text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-700"
        >
          <option value="">Any Time</option>
          <option value="morning">Morning (5 AM - 12 PM)</option>
          <option value="afternoon">Afternoon (12 PM - 5 PM)</option>
          <option value="evening">Evening (5 PM - 9 PM)</option>
        </select>

        <select
          value={selectedTerminal}
          onChange={(e) => setSelectedTerminal(e.target.value)}
          className="w-full max-w-[220px] sm:w-auto min-w-0 text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-700"
        >
          <option value="">All Terminals</option>
          {terminals.map((t: any) => (
            <option key={t.name} value={t.name}>{t.name} ({t.city})</option>
          ))}
        </select>

        <div className="h-6 w-px bg-gray-200 mx-1 hidden sm:block" />

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: 'All' },
            { id: 'today', label: 'Today' },
            { id: 'economy', label: 'Economy' },
            { id: 'luxury', label: 'Luxury/VIP' }
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${activeFilter === f.id
                ? 'bg-brand-700 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
