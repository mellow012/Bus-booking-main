
import { useQuery } from '@tanstack/react-query';

const MOCK_REVENUE_BY_BRANCH = [
    { regionId: '1', regionName: 'Lilongwe', totalRevenue: 300000, bookings: 150 },
    { regionId: '2', regionName: 'Blantyre', totalRevenue: 450000, bookings: 225 },
    { regionId: '3', regionName: 'Mzuzu', totalRevenue: 200000, bookings: 100 },
];

const MOCK_REVENUE_BY_ROUTE = {
    '1': [
        { routeId: 'r1', routeName: 'Lilongwe - Blantyre', totalRevenue: 200000, bookings: 100 },
        { routeId: 'r2', routeName: 'Lilongwe - Mzuzu', totalRevenue: 100000, bookings: 50 },
    ],
    '2': [
        { routeId: 'r3', routeName: 'Blantyre - Zomba', totalRevenue: 450000, bookings: 225 },
    ],
    '3': [],
}

const fetchRevenueByBranch = async (companyId: string) => {
    console.log(`Fetching revenue by branch for company ${companyId}`);
    await new Promise(resolve => setTimeout(resolve, 500));
    return MOCK_REVENUE_BY_BRANCH;
};

const fetchRevenueByRoute = async (regionId: string) => {
    console.log(`Fetching revenue by route for region ${regionId}`);
    await new Promise(resolve => setTimeout(resolve, 500));
    return MOCK_REVENUE_BY_ROUTE[regionId as keyof typeof MOCK_REVENUE_BY_ROUTE] || [];
}

export const useRevenueByBranch = (companyId: string) => {
    const { data, isLoading, error } = useQuery({
        queryKey: ['revenueByBranch', companyId],
        queryFn: () => fetchRevenueByBranch(companyId),
        enabled: !!companyId,
    });

    return { revenueByBranch: data, isLoading, error };
};

export const useRevenueByRoute = (regionId: string | null) => {
    const { data, isLoading, error } = useQuery({
        queryKey: ['revenueByRoute', regionId],
        queryFn: () => fetchRevenueByRoute(regionId!),
        enabled: !!regionId,
    });

    return { revenueByRoute: data, isLoading, error };
}
