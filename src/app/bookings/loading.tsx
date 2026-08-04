import React from 'react';

export default function BookingsLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pt-24 sm:pt-28 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto w-full space-y-6">
        
        {/* Header Title & Button Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-8 bg-gray-200 rounded-lg w-48 animate-pulse" />
            <div className="h-4 bg-gray-100 rounded-md w-64 animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 bg-gray-200 rounded-lg w-32 animate-pulse" />
            <div className="h-10 bg-brand-600/50 rounded-lg w-36 animate-pulse" />
          </div>
        </div>

        {/* Filters/Tabs Skeleton */}
        <div className="flex flex-wrap gap-2 mb-4">
          {[1, 2, 3, 4].map(i => (
             <div key={i} className="h-10 w-24 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((idx) => (
            <div key={idx} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 animate-pulse">
              <div className="w-12 h-12 rounded-xl bg-gray-100" />
              <div className="space-y-2">
                 <div className="h-4 bg-gray-200 rounded w-20" />
                 <div className="h-6 bg-gray-300 rounded w-16" />
              </div>
            </div>
          ))}
        </div>

        {/* Booking Card Placeholders */}
        <div className="space-y-4 pt-4">
          {[1, 2, 3].map((idx) => (
            <div key={idx} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 animate-pulse">
              
              {/* Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gray-200 rounded-xl shrink-0" />
                  <div className="space-y-2">
                    <div className="h-5 bg-gray-200 rounded w-32" />
                    <div className="h-4 bg-gray-100 rounded w-24" />
                  </div>
                </div>
                <div className="flex flex-col items-start sm:items-end gap-2">
                  <div className="h-8 bg-emerald-50 rounded-lg w-28" />
                  <div className="h-6 bg-amber-50 rounded-md w-24" />
                </div>
              </div>

              {/* Status Tracker */}
              <div className="py-4 my-4 border-y border-gray-50 flex items-center justify-between px-4 sm:px-12 relative">
                 <div className="w-full h-1 bg-gray-100 absolute left-0 top-1/2 -translate-y-1/2 z-0" />
                 {[1, 2, 3, 4].map(step => (
                   <div key={step} className="flex flex-col items-center gap-2 z-10 bg-white px-2">
                     <div className="w-6 h-6 rounded-full bg-gray-200" />
                     <div className="h-3 w-16 bg-gray-100 rounded hidden sm:block" />
                   </div>
                 ))}
              </div>

              {/* Bottom Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-xl">
                 {[1, 2, 3, 4].map(cell => (
                   <div key={cell} className="space-y-2">
                     <div className="h-3 bg-gray-200 rounded w-16" />
                     <div className="h-4 bg-gray-300 rounded w-24" />
                   </div>
                 ))}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 mt-4 justify-end">
                <div className="h-9 w-28 bg-gray-200 rounded-lg" />
                <div className="h-9 w-28 bg-gray-200 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
