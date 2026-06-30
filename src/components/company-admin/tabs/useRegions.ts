
import { useQuery } from '@tanstack/react-query';

// Mock data
const MOCK_REGIONS = [
  { id: '1', name: 'Lilongwe', code: 'LLW', routeCount: 5, operatorCount: 10, isActive: true },
  { id: '2', name: 'Blantyre', code: 'BLZ', routeCount: 8, operatorCount: 15, isActive: true },
  { id: '3', name: 'Mzuzu', code: 'ZZU', routeCount: 3, operatorCount: 5, isActive: false },
];

const MOCK_ROUTES = {
  '1': [
    { id: 'r1', name: 'Lilongwe - Blantyre', origin: 'Lilongwe', destination: 'Blantyre', busCount: 3, scheduleCount: 10, isActive: true },
    { id: 'r2', name: 'Lilongwe - Mzuzu', origin: 'Lilongwe', destination: 'Mzuzu', busCount: 2, scheduleCount: 5, isActive: true },
  ],
  '2': [
    { id: 'r3', name: 'Blantyre - Zomba', origin: 'Blantyre', destination: 'Zomba', busCount: 4, scheduleCount: 12, isActive: true },
  ],
  '3': [],
};

// Mock data fetching functions
const fetchRegions = async (companyId: string) => {
  console.log(`Fetching regions for company ${companyId}`);
  await new Promise(resolve => setTimeout(resolve, 500));
  return MOCK_REGIONS;
};

const fetchRoutesForRegion = async (regionId: string) => {
  console.log(`Fetching routes for region ${regionId}`);
  await new Promise(resolve => setTimeout(resolve, 500));
  return MOCK_ROUTES[regionId as keyof typeof MOCK_ROUTES] || [];
};

export const useRegions = (companyId: string) => {
  const { data: regions, isLoading: isLoadingRegions, error: regionsError } = useQuery({
    queryKey: ['regions', companyId],
    queryFn: () => fetchRegions(companyId),
    enabled: !!companyId,
  });

  return { regions, isLoadingRegions, regionsError };
};

export const useRoutesForRegion = (regionId: string | null) => {
    const { data: routes, isLoading: isLoadingRoutes, error: routesError } = useQuery({
        queryKey: ['routes', regionId],
        queryFn: () => fetchRoutesForRegion(regionId!),
        enabled: !!regionId,
    });

    return { routes, isLoadingRoutes, routesError };
}
