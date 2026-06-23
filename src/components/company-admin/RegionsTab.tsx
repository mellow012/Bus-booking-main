"use client";

import React, { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useCompanyAdminFilterStore } from '@/lib/stores/companyAdminFilterStore';
import { Loader2, Globe } from 'lucide-react';

export default function CompanyAdminRegionsTab() {
  const { regionId, setRegion, dateRange } = useCompanyAdminFilterStore();
  const [page, setPage] = useState(1);
  const limit = 12;

  const { data, isLoading } = useQuery({
    queryKey: ['companyRegions', { page, limit, dateRange }],
    queryFn: async () => {
      const url = new URL('/api/admin/coo/regions', window.location.origin);
      url.searchParams.set('page', String(page));
      url.searchParams.set('limit', String(limit));
      if (dateRange?.from) url.searchParams.set('from', dateRange.from);
      if (dateRange?.to) url.searchParams.set('to', dateRange.to);
      const res = await fetch(url.toString(), { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to fetch regions');
      return res.json();
    },
    placeholderData: keepPreviousData,
  });

  const regions = ((data as any)?.regions || []) as any[];
  const total = (data as any)?.total ?? 0;

  if (isLoading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-10 h-10 text-gray-400 animate-spin" />
    </div>
  );

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
        <div className="p-3 bg-indigo-50 rounded-xl">
          <Globe className="w-6 h-6 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Operational Regions</h2>
          <p className="text-sm text-gray-500">Select a region to filter your dashboard</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <button onClick={() => setRegion(null)}
          className={`text-left p-5 rounded-2xl border transition-all ${!regionId ? 'border-indigo-600 bg-indigo-50 shadow-md ring-2 ring-indigo-600 ring-opacity-20' : 'border-gray-100 bg-white hover:border-indigo-200 hover:shadow-sm'}`}
        >
          <p className="font-black text-lg text-gray-900">All Regions</p>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Global View</p>
        </button>

        {regions.map(r => (
          <button key={r.id} onClick={() => setRegion(r.id)}
            className={`text-left p-5 rounded-2xl border transition-all ${regionId === r.id ? 'border-indigo-600 bg-indigo-50 shadow-md ring-2 ring-indigo-600 ring-opacity-20' : 'border-gray-100 bg-white hover:border-indigo-200 hover:shadow-sm'}`}
          >
            <p className="font-black text-lg text-gray-900 truncate">{r.name}</p>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
              {r.isActive ? 'Active' : 'Inactive'}
            </p>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between pt-4">
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</p>
        <div className="flex gap-2">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-4 py-2 bg-white border border-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-50 disabled:opacity-50">Prev</button>
          <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="px-4 py-2 bg-white border border-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-50 disabled:opacity-50">Next</button>
        </div>
      </div>

      {regions.length === 0 && (
        <div className="text-center py-12">
          <Globe className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No regions defined.</p>
        </div>
      )}
    </div>
  );
}
