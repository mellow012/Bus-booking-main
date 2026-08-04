import React from 'react';

export default function SchedulesLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 1. Header (Search Banner) matching the actual SearchHeader */}
      <div className="bg-brand-900 pt-24 pb-12 sm:pt-28 sm:pb-16 px-4 w-full">
        <div className="max-w-5xl mx-auto">
          {/* Title skeleton */}
          <div className="h-8 w-64 bg-white/20 rounded-lg animate-pulse mb-8" />
          
          {/* Search Form Skeleton */}
          <div className="bg-white/10 p-4 rounded-xl flex flex-col md:flex-row gap-3">
            <div className="h-12 flex-1 bg-white/20 rounded-lg animate-pulse" />
            <div className="h-12 flex-1 bg-white/20 rounded-lg animate-pulse" />
            <div className="h-12 flex-1 bg-white/20 rounded-lg animate-pulse" />
            <div className="h-12 w-full md:w-32 bg-brand-500/50 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>

      {/* 2. Main Content Area (Filters & Schedule List) */}
      <div className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 flex flex-col lg:flex-row gap-8">
        
        {/* Filters Sidebar Skeleton (Desktop only) */}
        <div className="hidden lg:block w-72 space-y-6">
          <div className="h-6 w-32 bg-gray-200 rounded-md animate-pulse mb-4" />
          {/* Filter blocks */}
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
                <div className="h-5 w-24 bg-gray-200 rounded-md animate-pulse" />
                <div className="space-y-2">
                  <div className="h-4 w-full bg-gray-100 rounded-md animate-pulse" />
                  <div className="h-4 w-3/4 bg-gray-100 rounded-md animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Results List Skeleton */}
        <div className="flex-1 space-y-4">
          <div className="flex justify-between items-center mb-6">
            <div className="h-6 w-48 bg-gray-200 rounded-md animate-pulse" />
            <div className="h-10 w-32 bg-gray-200 rounded-lg animate-pulse" />
          </div>

          {[1, 2, 3].map((idx) => (
            <div key={idx} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-5 animate-pulse">
              
              {/* Header: Company & Price */}
              <div className="flex justify-between items-center border-b border-gray-50 pb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-xl bg-gray-200" />
                  <div className="space-y-2">
                    <div className="h-5 bg-gray-200 rounded w-32" />
                    <div className="h-4 bg-gray-100 rounded w-20" />
                  </div>
                </div>
                <div className="h-8 bg-emerald-50 rounded-xl w-28" />
              </div>

              {/* Middle: Route & Times */}
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-6 bg-gray-200 rounded w-24" />
                  <div className="h-4 bg-gray-100 rounded w-32" />
                </div>
                <div className="flex-1 px-8 hidden sm:block">
                  <div className="w-full h-0.5 bg-gray-200 rounded-full relative">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-2 bg-white">
                      <div className="h-4 bg-gray-100 rounded w-16" />
                    </div>
                  </div>
                </div>
                <div className="space-y-2 text-right">
                  <div className="h-6 bg-gray-200 rounded w-24 ml-auto" />
                  <div className="h-4 bg-gray-100 rounded w-32 ml-auto" />
                </div>
              </div>

              {/* Footer: Amenities & Button */}
              <div className="flex justify-between items-center pt-4 border-t border-gray-50">
                <div className="flex gap-2">
                  <div className="h-6 w-6 rounded-full bg-gray-100" />
                  <div className="h-6 w-6 rounded-full bg-gray-100" />
                  <div className="h-6 w-6 rounded-full bg-gray-100" />
                </div>
                <div className="h-10 bg-brand-200 rounded-lg w-32" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
