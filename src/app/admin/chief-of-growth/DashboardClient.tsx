"use client";

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import useChiefGrowth from './_hooks/useChiefGrowth';

function InnerDashboard({ initialData, initialMeta }: any) {
  const { users, meta, loading, query, setQuery, refresh, next, prev } = useChiefGrowth(initialData, initialMeta);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <input className="border px-3 py-2 rounded flex-1" placeholder="Search users..." value={query} onChange={e => setQuery(e.target.value)} />
        <button className="bg-white border px-3 py-2 rounded" onClick={() => { navigator.clipboard.writeText(window.location.href); fetch('/api/admin/users/share', { method: 'POST', body: JSON.stringify({ url: window.location.href }), credentials: 'same-origin' }); }}>Share</button>
        <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={async () => {
          try {
            const res = await fetch('/api/admin/users/export', { method: 'POST', body: JSON.stringify({ q: query }), credentials: 'same-origin' });
            const json = await res.json();
            if (json.url) {
              window.open(json.url, '_blank');
            } else {
              alert(json.error || 'Export failed');
            }
          } catch (e) {
            console.error('Export failed', e);
            alert('Export failed');
          }
        }}>Export</button>
        <button className="bg-gray-50 border px-3 py-2 rounded" onClick={() => refresh()}>Refresh</button>
      </div>

      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">Role</th>
              <th className="p-3 text-left">Company</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="p-6 text-center">Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={4} className="p-6 text-center">No users</td></tr>
            ) : users.map((u: any) => (
              <tr key={u.id} className="border-t">
                <td className="p-3">{u.firstName} {u.lastName}</td>
                <td className="p-3">{u.email}</td>
                <td className="p-3">{u.role}</td>
                <td className="p-3">{u.companyId || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div />
        <div className="flex gap-2">
          <button className="px-3 py-1 border rounded" onClick={() => prev()}>Prev</button>
          <button className="px-3 py-1 border rounded" onClick={() => next()}>Next</button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardClient({ initialData, initialMeta }: any) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <InnerDashboard initialData={initialData} initialMeta={initialMeta} />
    </QueryClientProvider>
  );
}
