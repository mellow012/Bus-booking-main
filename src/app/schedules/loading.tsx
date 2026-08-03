import React from 'react';

export default function SchedulesLoading() {
  return (
    <div className="min-h-screen bg-gray-50 pb-20 animate-pulse">
      {/* Search Header Skeleton */}
      <div className="bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 pt-28 sm:pt-32 lg:pt-36 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="h-8 bg-brand-700/60 rounded-xl w-64 mx-auto sm:mx-0" />
          <div className="bg-white/10 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-white/20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="h-12 bg-white/20 rounded-xl" />
            <div className="h-12 bg-white/20 rounded-xl" />
            <div className="h-12 bg-white/20 rounded-xl" />
            <div className="h-12 bg-brand-500/60 rounded-xl" />
          </div>
        </div>
      </div>

      {/* Main Content Area Skeleton */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 space-y-6">
        {/* Filters Toolbar Skeleton */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-wrap justify-between items-center gap-4">
          <div className="h-6 bg-gray-200 rounded w-36" />
          <div className="flex gap-2">
            <div className="h-9 bg-gray-200 rounded-lg w-28" />
            <div className="h-9 bg-gray-200 rounded-lg w-28" />
          </div>
        </div>

        {/* Schedule Cards Skeleton List */}
        <div className="space-y-4">
          {[1, 2, 3, 4].map((idx) => (
            <div key={idx} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
              <div className="flex justify-between items-center border-b border-gray-50 pb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200" />
                  <div className="space-y-1">
                    <div className="h-4 bg-gray-200 rounded w-32" />
                    <div className="h-3 bg-gray-100 rounded w-20" />
                  </div>
                </div>
                <div className="h-6 bg-emerald-100 rounded-full w-24" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <div className="space-y-1">
                  <div className="h-5 bg-gray-200 rounded w-24" />
                  <div className="h-4 bg-gray-100 rounded w-36" />
                </div>
                <div className="flex flex-col items-center space-y-1">
                  <div className="h-3 bg-gray-100 rounded w-16" />
                  <div className="w-full h-1 bg-gray-200 rounded-full" />
                </div>
                <div className="space-y-1 md:text-right">
                  <div className="h-5 bg-gray-200 rounded w-24 md:ml-auto" />
                  <div className="h-4 bg-gray-100 rounded w-36 md:ml-auto" />
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                <div className="h-4 bg-gray-200 rounded w-28" />
                <div className="h-10 bg-brand-200 rounded-xl w-32" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
