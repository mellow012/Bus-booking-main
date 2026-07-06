'use client';

import { RouteWithScheduleInfo } from '../types';

interface RouteTabStripProps {
  routes: RouteWithScheduleInfo[];
  selectedRouteId: string | null;
  onSelectRoute: (routeId: string) => void;
}

export default function RouteTabStrip({ routes, selectedRouteId, onSelectRoute }: RouteTabStripProps) {
  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-center gap-7 border-b border-gray-200 min-w-full">
        {routes.map(({ route, activeCount, scheduleCount }) => {
          const isSelected = selectedRouteId === route.id;
          const dotColor = activeCount > 0 ? 'bg-emerald-500' : scheduleCount > 0 ? 'bg-gray-300' : 'bg-gray-200';
          const statusText =
            activeCount > 0 ? (
              <span className="text-[11px] font-medium text-emerald-600">Active</span>
            ) : scheduleCount > 0 ? (
              <span className="text-[11px] font-medium text-gray-400">
                {scheduleCount} {scheduleCount === 1 ? 'trip' : 'trips'}
              </span>
            ) : null;

          return (
            <button
              key={route.id}
              type="button"
              onClick={() => onSelectRoute(route.id)}
              className={`flex items-center gap-2 pb-3 whitespace-nowrap border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded-t-sm ${
                isSelected ? 'border-indigo-600' : 'border-transparent'
              }`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor} ${activeCount > 0 ? 'ring-4 ring-emerald-100' : ''}`} />
              <span className={`text-sm ${isSelected ? 'font-semibold text-gray-900' : 'font-medium text-gray-500 hover:text-gray-700'}`}>
                {route.name || `${route.origin} → ${route.destination}`}
              </span>
              {statusText}
            </button>
          );
        })}
      </div>
    </div>
  );
}