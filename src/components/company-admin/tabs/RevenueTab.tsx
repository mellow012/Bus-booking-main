
import React from 'react';
import { useDashboardFilters } from '@/stores/dashboard-filters.store';
import { useRevenueByBranch, useRevenueByRoute } from './useRevenue';
import { Loader2, AlertTriangle, ChevronRight, ArrowLeft, Download } from 'lucide-react';

// A placeholder companyId. This will be replaced with the actual companyId from the user's session.
const FAKE_COMPANY_ID = 'clxjh8v2n000008l3fcz2c4ga';

const RevenueTab = () => {
    const { regionId } = useDashboardFilters();
  
    if (regionId) {
      return <RevenueForRegion regionId={regionId} />;
    }
  
    return <RevenueByBranchList />;
};

const RevenueByBranchList = () => {
    const { setRegionId } = useDashboardFilters();
    const { revenueByBranch, isLoading, error } = useRevenueByBranch(FAKE_COMPANY_ID);

    if (isLoading) {
        return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin text-gray-500" /></div>;
    }

    if (error) {
        return <div className="p-8 text-red-600 bg-red-50 rounded-lg"><AlertTriangle className="h-8 w-8 mb-2" />Error loading revenue data.</div>;
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Revenue by Branch</h2>
                <button className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">
                    <Download className="h-5 w-5" /> Export Overall Report
                </button>
            </div>
            <div className="bg-white shadow-sm rounded-lg">
                <ul role="list" className="divide-y divide-gray-200">
                    {revenueByBranch?.map((item) => (
                        <li key={item.regionId} onClick={() => setRegionId(item.regionId)} className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50">
                            <div>
                                <p className="font-semibold">{item.regionName}</p>
                                <p className="text-sm text-gray-500">{item.bookings} Bookings</p>
                            </div>
                            <div className="flex items-center gap-4">
                               <p className="font-semibold text-lg">MWK {item.totalRevenue.toLocaleString()}</p>
                                <ChevronRight className="h-5 w-5 text-gray-400" />
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

const RevenueForRegion = ({ regionId }: { regionId: string }) => {
    const { setRegionId } = useDashboardFilters();
    const { revenueByRoute, isLoading, error } = useRevenueByRoute(regionId);
    
    const regionName = "Branch Revenue"; // Placeholder

    if (isLoading) {
        return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin text-gray-500" /></div>;
    }
    
    if (error) {
        return <div className="p-8 text-red-600 bg-red-50 rounded-lg"><AlertTriangle className="h-8 w-8 mb-2" />Error loading revenue data for the region.</div>;
    }

    return (
        <div>
            <button onClick={() => setRegionId(null)} className="flex items-center gap-2 mb-4 text-sm text-gray-500 hover:text-gray-700">
                <ArrowLeft className="h-4 w-4" /> Back to All Branches
            </button>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">{regionName}</h2>
                <button className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">
                    <Download className="h-5 w-5" /> Export Branch Report
                </button>
            </div>
            <div className="bg-white shadow-sm rounded-lg overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Route</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bookings</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Revenue</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {revenueByRoute?.map((route) => (
                            <tr key={route.routeId}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{route.routeName}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{route.bookings}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">MWK {route.totalRevenue.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {revenueByRoute?.length === 0 && <div className="text-center p-8 text-gray-500">No revenue data found for this branch.</div>}
            </div>
        </div>
    );
}


export default RevenueTab;
