import React from 'react';

export default function BookBusLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-brand-50 to-gray-50 pt-28 sm:pt-32 lg:pt-36">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 animate-pulse">
        {/* Boarding & Alighting Stop Selector Skeleton */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4">
          <div className="space-y-2">
            <div className="h-5 bg-slate-200 rounded w-48" />
            <div className="h-4 bg-slate-100 rounded w-64" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="h-10 bg-slate-100 rounded-lg w-full" />
            <div className="h-10 bg-slate-100 rounded-lg w-full" />
          </div>
        </div>

        {/* Progress Steps Header Skeleton */}
        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200/80">
          <div className="flex items-center justify-center gap-4 sm:gap-8">
            {[
              { step: 1, label: 'Select Seats' },
              { step: 2, label: 'Passenger Details' },
              { step: 3, label: 'Confirm & Submit' },
            ].map(({ step, label }, idx) => (
              <div key={step} className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-200 flex items-center justify-center font-semibold text-slate-400 text-sm sm:text-base">
                  {step}
                </div>
                <div className="h-4 bg-slate-200 rounded w-24 hidden sm:block" />
                {idx < 2 && <div className="w-6 sm:w-10 h-px bg-slate-200 hidden sm:block" />}
              </div>
            ))}
          </div>
        </div>

        {/* Seat Layout Skeleton Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-slate-100">
            <div className="space-y-2">
              <div className="h-6 bg-slate-200 rounded w-44" />
              <div className="h-4 bg-slate-100 rounded w-32" />
            </div>
            <div className="h-8 bg-slate-100 rounded-xl w-28" />
          </div>

          {/* Driver Cabin */}
          <div className="w-full bg-slate-100 p-3 rounded-xl border border-slate-200 text-center max-w-sm mx-auto">
            <div className="h-4 bg-slate-200 rounded w-36 mx-auto" />
          </div>

          {/* Seat Grid Skeleton Rows */}
          <div className="space-y-3 py-4 max-w-sm mx-auto">
            {[1, 2, 3, 4, 5, 6, 7].map((row) => (
              <div key={row} className="flex justify-between items-center gap-4">
                <div className="flex gap-2">
                  <div className="w-10 h-10 rounded-lg bg-slate-200" />
                  <div className="w-10 h-10 rounded-lg bg-slate-200" />
                </div>
                <div className="w-6 h-10 bg-slate-100/50 rounded" />
                <div className="flex gap-2">
                  <div className="w-10 h-10 rounded-lg bg-slate-200" />
                  <div className="w-10 h-10 rounded-lg bg-slate-200" />
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Action Footer Skeleton */}
          <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
            <div className="space-y-1">
              <div className="h-3 bg-slate-200 rounded w-20" />
              <div className="h-5 bg-slate-300 rounded w-28" />
            </div>
            <div className="h-12 w-40 bg-slate-200 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
