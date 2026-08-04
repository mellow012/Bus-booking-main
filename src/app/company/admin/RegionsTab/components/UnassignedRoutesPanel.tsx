'use client';

import { AlertCircle, PlusCircle, CheckCircle2 } from 'lucide-react';
import { Route } from '@/types';
import { useState } from 'react';

interface UnassignedRoutesPanelProps {
  routes: Route[];
  branches: any[];
  onAssignRoute: (routeId: string, branchId: string) => Promise<void>;
  onCreateBranch: () => void;
}

export default function UnassignedRoutesPanel({ routes, branches, onAssignRoute, onCreateBranch }: UnassignedRoutesPanelProps) {
  const [assigningRouteId, setAssigningRouteId] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  if (routes.length === 0) return null;

  const handleAssign = async (routeId: string) => {
    if (!selectedBranchId) return;
    setAssigningRouteId(routeId);
    await onAssignRoute(routeId, selectedBranchId);
    setAssigningRouteId(null);
    setSelectedBranchId('');
  };

  return (
    <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="font-bold text-amber-900 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" /> Unassigned Routes
          </h3>
          <p className="text-sm text-amber-700 mt-1">These routes are not assigned to any branch. They won't show up in branch filters.</p>
        </div>
        <button
          onClick={onCreateBranch}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-100 rounded-lg hover:bg-amber-200 transition-colors shrink-0"
        >
          <PlusCircle className="w-3.5 h-3.5" /> Create New Branch
        </button>
      </div>

      <div className="space-y-2">
        {routes.map((route: Route) => (
          <div key={route.id} className="bg-white p-3.5 rounded-xl border border-amber-100 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <span className="font-semibold text-gray-900">{route.name}</span>
              <div className="text-xs font-medium text-gray-500 mt-0.5">
                {route.origin} → {route.destination}
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <select 
                className="text-sm border-gray-300 rounded-lg py-1.5 px-3 focus:ring-amber-500 focus:border-amber-500 flex-1 sm:flex-none max-w-[200px]"
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
              >
                <option value="">Select branch...</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              
              <button
                onClick={() => handleAssign(route.id)}
                disabled={assigningRouteId === route.id || !selectedBranchId}
                className="inline-flex items-center justify-center px-4 py-1.5 text-sm font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {assigningRouteId === route.id ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Assign'
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}