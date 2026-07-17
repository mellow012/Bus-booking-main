
import { useQuery } from '@tanstack/react-query';

// Mock data fetching function
const fetchCompanyOverviewStats = async (companyId: string) => {
  console.log(`Fetching overview stats for company ${companyId}`);
  // In a real scenario, this would be an API call
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay

  return {
    branches: {
      total: 5,
      routesPerBranch: 2.5,
      operatorsPerBranch: 3,
    },
    operators: {
      total: 15,
      active: 12,
      inactive: 3,
    },
    routes: {
      total: 12,
    },
    schedules: {
      total: 56,
      upcoming: 20,
    },
    buses: {
      total: 25,
      active: 20,
      maintenance: 5,
    },
    revenue: {
      overall: 1250000,
      perBranch: [
        { branchId: '1', name: 'Lilongwe', revenue: 300000 },
        { branchId: '2', name: 'Blantyre', revenue: 450000 },
        { branchId: '3', name: 'Mzuzu', revenue: 200000 },
        { branchId: '4', name: 'Zomba', revenue: 150000 },
        { branchId: '5', name: 'Kasungu', revenue: 150000 },
      ],
    },
  };
};

export const useCompanyOverview = (companyId: string) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['companyOverview', companyId],
    queryFn: () => fetchCompanyOverviewStats(companyId),
    enabled: !!companyId,
  });

  return {
    stats: data,
    isLoading,
    error,
  };
};
