"use client";

import React from "react";
import { Filter } from "lucide-react";

export default function FiltersToolbar({
  hasActiveSearch,
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
  return (
    <>
      {hasActiveSearch && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-semibold text-gray-700">Showing results</span>
          <button
            onClick={() => setShowFilters((prev: boolean) => !prev)}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition"
          >
            <Filter className="w-4 h-4" />
            {showFilters ? 'Hide filters' : 'Show filters'}
          </button>
        </div>
      )}

      {(!hasActiveSearch || showFilters) && (
        <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl shadow-sm border border-gray-100 min-w-0">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-bold text-gray-900">Filters:</span>
          </div>

          <select
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
            className="w-full max-w-[220px] sm:w-auto min-w-0 text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Companies</option>
            {companies.map((c: any) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>

          <select
            value={selectedTimeSlot}
            onChange={(e) => setSelectedTimeSlot(e.target.value)}
            className="w-full max-w-[220px] sm:w-auto min-w-0 text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Any Time</option>
            <option value="morning">Morning (5 AM - 12 PM)</option>
            <option value="afternoon">Afternoon (12 PM - 5 PM)</option>
            <option value="evening">Evening (5 PM - 9 PM)</option>
          </select>

          <select
            value={selectedTerminal}
            onChange={(e) => setSelectedTerminal(e.target.value)}
            className="w-full max-w-[220px] sm:w-auto min-w-0 text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Terminals</option>
            {terminals.map((t: any) => (
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
            ].map((f) => (
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
      )}
    </>
  );
}
