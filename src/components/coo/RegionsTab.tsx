"use client";

import React, { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import useFilterStore from '@/lib/stores/filterStore';
import { Loader2 } from 'lucide-react';

type Props = { companyId?: string };

export default function RegionsTab({ companyId }: Props) {
  const { regionId, setRegion, dateRange } = useFilterStore();
  const [page, setPage] = useState(1);
  const limit = 12;

  const { data, isLoading } = useQuery({
    queryKey: ['cooRegions', { companyId, page, limit, dateRange }],
    queryFn: async () => {
      const url = new URL('/api/admin/coo/regions', window.location.origin);
      if (companyId) url.searchParams.set('companyId', companyId);
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
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {regions.map(r => (
          <button key={r.id} onClick={() => setRegion(r.id)}
            className={`text-left p-4 rounded-xl border ${regionId === r.id ? 'border-indigo-600 bg-indigo-50' : 'border-gray-100 bg-white'} hover:shadow-sm`}
          >
            <p className="font-bold text-sm text-gray-900 truncate">{r.name}</p>
            <p className="text-xs text-gray-400 mt-1">{r.company?.name || 'Platform'}</p>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</p>
        <div className="flex gap-2">
          <button onClick={() => setPage(Math.max(1, page - 1))} className="px-3 py-2 bg-gray-50 rounded-lg">Prev</button>
          <button onClick={() => setPage(Math.min(totalPages, page + 1))} className="px-3 py-2 bg-gray-50 rounded-lg">Next</button>
        </div>
      </div>

      {regions.length === 0 && <p className="text-sm text-gray-500">No regions found.</p>}
    </div>
  );
}
