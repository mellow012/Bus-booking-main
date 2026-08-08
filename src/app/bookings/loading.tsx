import React from 'react';

export default function BookingsLoading() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-brand-50 via-gray-50 to-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-8 w-full">
        {/* BackButton placeholder */}
        <div className="mb-4 hidden md:block">
          <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
        </div>

        {/* Header / Search Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6 animate-pulse">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
              <div>
                <div className="h-8 w-48 bg-gray-200 rounded-lg mb-2" />
                <div className="h-4 w-64 bg-gray-100 rounded-md" />
              </div>
            </div>
            <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto">
              <div className="flex-1 sm:flex-none h-10 w-28 bg-gray-200 rounded-xl" />
              <div className="flex-1 sm:flex-none h-10 w-32 bg-coral-200 rounded-xl" />
            </div>
          </div>
          <div className="mt-3">
            <div className="h-12 w-full bg-gray-100 rounded-xl" />
          </div>
        </div>

        <div className="space-y-6">
          {/* BookingStatsGrid skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 mb-6 animate-pulse">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-2">
                <div className="w-8 h-8 rounded-full bg-gray-100" />
                <div className="h-6 w-12 bg-gray-200 rounded-md" />
                <div className="h-4 w-20 bg-gray-100 rounded-md" />
              </div>
            ))}
          </div>

          {/* BookingCards Skeleton */}
          {[1, 2].map((idx) => (
            <div key={idx} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-pulse">
              <div className="p-4 sm:p-6">
                {/* Card Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gray-200 rounded-xl shrink-0" />
                    <div className="space-y-2">
                      <div className="h-5 bg-gray-200 rounded w-32" />
                      <div className="h-4 bg-gray-100 rounded w-24" />
                    </div>
                  </div>
                  <div className="h-6 bg-gray-100 rounded-full w-24" />
                </div>

                {/* Route timeline */}
                <div className="flex flex-col sm:flex-row items-center gap-4 p-3 bg-gray-50 rounded-xl mb-4">
                  <div className="text-center min-w-[80px]">
                    <div className="h-6 w-16 bg-gray-200 rounded mx-auto mb-1" />
                    <div className="h-4 w-20 bg-gray-100 rounded mx-auto" />
                  </div>
                  <div className="flex-1 mx-2 hidden sm:block">
                    <div className="h-0.5 w-full bg-gray-200 rounded" />
                  </div>
                  <div className="text-center min-w-[80px]">
                    <div className="h-6 w-16 bg-gray-200 rounded mx-auto mb-1" />
                    <div className="h-4 w-20 bg-gray-100 rounded mx-auto" />
                  </div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="md:col-span-2 space-y-2">
                    <div className="h-4 w-3/4 bg-gray-100 rounded" />
                    <div className="h-4 w-1/2 bg-gray-100 rounded" />
                    <div className="h-4 w-2/3 bg-gray-100 rounded" />
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 md:p-4">
                    <div className="h-5 w-24 bg-gray-200 rounded mb-2" />
                    <div className="h-4 w-full bg-gray-100 rounded" />
                  </div>
                  <div className="flex flex-col justify-between">
                    <div className="text-right space-y-2">
                      <div className="h-8 w-32 bg-gray-200 rounded ml-auto" />
                      <div className="h-4 w-20 bg-gray-100 rounded ml-auto" />
                    </div>
                    <div className="mt-4">
                      <div className="h-10 w-full bg-gray-200 rounded-lg" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
