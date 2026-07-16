'use client';

import { AlertCircle } from 'lucide-react';
import { Route } from '@/types';

interface UnassignedRoutesPanelProps {
  routes: Route[];
}

export default function UnassignedRoutesPanel({ routes }: UnassignedRoutesPanelProps) {
  if (routes.length === 0) return null;

  return (
    <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
      <h3 className="font-bold text-amber-900 mb-2 flex items-center gap-2">
        <AlertCircle className="w-5 h-5" /> Unassigned Routes
      </h3>
      <p className="text-sm text-amber-700 mb-3">These routes are not assigned to any branch.</p>
      <div className="space-y-2">
        {routes.map((route: Route) => (
          <div key={route.id} className="bg-white p-3 rounded-lg border border-amber-100 flex justify-between items-center">
            <div>
              <span className="font-medium text-gray-900">{route.name}</span>
              <span className="text-xs text-gray-500 ml-2">
                {route.origin} → {route.destination}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}