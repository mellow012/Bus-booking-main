import React from 'react';

export default function BookingsLoading() {
  return (
    <div className="min-h-screen bg-gray-50 pt-28 sm:pt-32 lg:pt-36 pb-20 px-4 sm:px-6 lg:px-8 animate-pulse">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Title Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-6">
          <div className="space-y-2">
            <div className="h-8 bg-gray-200 rounded-xl w-48" />
            <div className="h-4 bg-gray-100 rounded w-64" />
          </div>
          <div className="h-10 bg-brand-200 rounded-xl w-36" />
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((idx) => (
            <div key={idx} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                <div className="h-4 bg-gray-200 rounded w-24" />
                <div className="w-10 h-10 rounded-xl bg-gray-100" />
              </div>
              <div className="h-8 bg-gray-300 rounded-lg w-20" />
            </div>
          ))}
        </div>

        {/* Booking Card Placeholders */}
        <div className="space-y-4">
          {[1, 2, 3].map((idx) => (
            <div key={idx} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                <div className="space-y-1">
                  <div className="h-5 bg-gray-200 rounded w-40" />
                  <div className="h-3 bg-gray-100 rounded w-28" />
                </div>
                <div className="h-7 bg-emerald-100 rounded-full w-24" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="h-12 bg-gray-100 rounded-xl" />
                <div className="h-12 bg-gray-100 rounded-xl" />
                <div className="h-12 bg-gray-100 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
