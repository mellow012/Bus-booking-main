
import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useDashboardFilters } from '@/stores/dashboard-filters.store';

const Breadcrumb = () => {
  const { regionId, routeId } = useDashboardFilters();

  // This is a placeholder. We will fetch the actual names later.
  const regionName = regionId ? `Region ${regionId.substring(0, 4)}` : null;
  const routeName = routeId ? `Route ${routeId.substring(0, 4)}` : null;

  return (
    <nav className="flex" aria-label="Breadcrumb">
      <ol role="list" className="flex items-center space-x-2">
        <li>
          <div>
            <a href="/company/admin" className="text-gray-400 hover:text-gray-500">
              <span className="text-sm font-medium">Dashboard</span>
            </a>
          </div>
        </li>
        {regionName && (
          <li>
            <div className="flex items-center">
              <ChevronRight className="h-5 w-5 flex-shrink-0 text-gray-400" />
              <a href="#" className="ml-2 text-sm font-medium text-gray-500 hover:text-gray-700">
                {regionName}
              </a>
            </div>
          </li>
        )}
        {routeName && (
           <li>
            <div className="flex items-center">
              <ChevronRight className="h-5 w-5 flex-shrink-0 text-gray-400" />
              <a href="#" className="ml-2 text-sm font-medium text-gray-500 hover:text-gray-700">
                {routeName}
              </a>
            </div>
          </li>
        )}
      </ol>
    </nav>
  );
};

export default Breadcrumb;
