import React from 'react';

export default function CompanyAdminLoading() {
  return (
    <div className="min-h-screen bg-slate-50 pt-24 sm:pt-28 pb-16 px-4 sm:px-6 lg:px-8 animate-pulse">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Skeleton */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-200" />
            <div className="space-y-2">
              <div className="h-6 bg-slate-200 rounded w-48" />
              <div className="h-4 bg-slate-100 rounded w-32" />
            </div>
          </div>
          <div className="h-12 bg-brand-200 rounded-2xl w-40" />
        </div>

        {/* Navigation Tabs Skeleton */}
        <div className="bg-white p-2 rounded-2xl border border-slate-200/80 shadow-sm flex gap-2 overflow-x-auto">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-10 bg-slate-200 rounded-xl w-28 shrink-0" />
          ))}
        </div>

        {/* Dashboard Cards Skeleton Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
              <div className="h-4 bg-slate-200 rounded w-24" />
              <div className="h-8 bg-slate-300 rounded w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
