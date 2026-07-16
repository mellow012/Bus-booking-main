
import React from 'react';
import { useDashboardFilters } from '@/stores/dashboard-filters.store';
import { useRegions, useRoutesForRegion } from './useRegions';
import { Loader2, AlertTriangle, ChevronRight, PlusCircle, ArrowLeft } from 'lucide-react';

// A placeholder companyId. This will be replaced with the actual companyId from the user's session.
const FAKE_COMPANY_ID = 'clxjh8v2n000008l3fcz2c4ga';

const RegionsTab = () => {
  const { regionId, setRegionId, setRouteId } = useDashboardFilters();
  
  if (regionId) {
    return <RegionDetail regionId={regionId} />;
  }

  return <RegionsList />;
};

const RegionsList = () => {
    const { setRegionId } = useDashboardFilters();
    const { regions, isLoadingRegions, regionsError } = useRegions(FAKE_COMPANY_ID);

    if (isLoadingRegions) {
        return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin text-gray-500" /></div>;
    }

    if (regionsError) {
        return <div className="p-8 text-red-600 bg-red-50 rounded-lg"><AlertTriangle className="h-8 w-8 mb-2" />Error loading regions.</div>;
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Regions / Branches</h2>
                <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                    <PlusCircle className="h-5 w-5" /> Add Region
                </button>
            </div>
            <div className="bg-white shadow-sm rounded-lg">
                <ul role="list" className="divide-y divide-gray-200">
                    {regions?.map((region) => (
                        <li key={region.id} onClick={() => setRegionId(region.id)} className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50">
                            <div className="flex items-center gap-4">
                                <div className={`h-2 w-2 rounded-full ${region.isActive ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                                <div>
                                    <p className="font-semibold">{region.name} <span className="text-gray-500 font-normal">({region.code})</span></p>
                                    <p className="text-sm text-gray-500">{region.routeCount} Routes · {region.operatorCount} Operators</p>
                                </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-gray-400" />
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

const RegionDetail = ({ regionId }: { regionId: string }) => {
    const { setRegionId } = useDashboardFilters();
    const { routes, isLoadingRoutes, routesError } = useRoutesForRegion(regionId);
    
    // In a real implementation, we would fetch region details as well
    const regionName = "Region Details"; // Placeholder

    if (isLoadingRoutes) {
        return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin text-gray-500" /></div>;
    }
    
    if (routesError) {
        return <div className="p-8 text-red-600 bg-red-50 rounded-lg"><AlertTriangle className="h-8 w-8 mb-2" />Error loading routes.</div>;
    }

    return (
        <div>
            <button onClick={() => setRegionId(null)} className="flex items-center gap-2 mb-4 text-sm text-gray-500 hover:text-gray-700">
                <ArrowLeft className="h-4 w-4" /> Back to Regions
            </button>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">{regionName}</h2>
                <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                    <PlusCircle className="h-5 w-5" /> Add Route
                </button>
            </div>
            <div className="bg-white shadow-sm rounded-lg overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Route</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Buses</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Schedules</th>
                            <th scope="col" className="relative px-6 py-3"><span className="sr-only">Edit</span></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {routes?.map((route) => (
                            <tr key={route.id}>
                                <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-900">{route.name}</div><div className="text-sm text-gray-500">{route.origin} to {route.destination}</div></td>
                                <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${route.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{route.isActive ? 'Active' : 'Inactive'}</span></td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{route.busCount}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{route.scheduleCount}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"><a href="#" className="text-indigo-600 hover:text-indigo-900">Manage</a></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {routes?.length === 0 && <div className="text-center p-8 text-gray-500">No routes found for this region.</div>}
            </div>
        </div>
    );
}

export default RegionsTab;
