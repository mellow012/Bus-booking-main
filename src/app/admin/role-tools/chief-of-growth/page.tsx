"use client";

import React, { useState } from 'react';

export default function SetChiefGrowthPage() {
  const [targetId, setTargetId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleClick = async () => {
    if (!targetId) return alert('Enter user id');
    if (!confirm(`Set user ${targetId} to Chief of Growth?`)) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(targetId)}/set-chief-of-growth`, { method: 'POST', credentials: 'include' });
      const json = await res.json();
      if (res.ok) setResult('Success');
      else setResult(json.error || 'Failed');
    } catch (err) {
      console.error(err);
      setResult('Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Temporary: Set Chief of Growth</h2>
      <div className="mb-3">
        <input className="border px-3 py-2 w-full" placeholder="Target user id" value={targetId} onChange={e => setTargetId(e.target.value)} />
      </div>
      <div className="flex items-center gap-2">
        <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={handleClick} disabled={loading}>{loading ? 'Working...' : 'Set Chief of Growth'}</button>
        <button className="px-3 py-2 border rounded" onClick={() => { setTargetId(''); setResult(null); }}>Clear</button>
      </div>
      {result && <div className="mt-4">Result: {result}</div>}
    </div>
  );
}
