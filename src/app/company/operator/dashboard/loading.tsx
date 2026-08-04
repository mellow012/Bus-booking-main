import React from 'react';

export default function OperatorDashboardLoading() {
  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8 animate-pulse flex-1">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex justify-between items-center">
          <div className="space-y-2">
            <div className="h-6 bg-slate-200 rounded w-52" />
            <div className="h-4 bg-slate-100 rounded w-36" />
          </div>
          <div className="h-10 bg-brand-200 rounded-xl w-32" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
              <div className="h-4 bg-slate-200 rounded w-24" />
              <div className="h-8 bg-slate-300 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
