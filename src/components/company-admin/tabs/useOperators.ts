
import { useQuery } from '@tanstack/react-query';

const MOCK_OPERATORS = [
    { id: 'o1', name: 'John Doe', regionId: '1', regionName: 'Lilongwe', status: 'active', email: 'john.doe@example.com' },
    { id: 'o2', name: 'Jane Smith', regionId: '1', regionName: 'Lilongwe', status: 'active', email: 'jane.smith@example.com' },
    { id: 'o3', name: 'Peter Jones', regionId: '2', regionName: 'Blantyre', status: 'active', email: 'peter.jones@example.com' },
    { id: 'o4', name: 'Mary Williams', regionId: '2', regionName: 'Blantyre', status: 'inactive', email: 'mary.williams@example.com' },
    { id: 'o5', name: 'David Brown', regionId: '3', regionName: 'Mzuzu', status: 'active', email: 'david.brown@example.com' },
];

const fetchOperators = async (companyId: string) => {
    console.log(`Fetching operators for company ${companyId}`);
    await new Promise(resolve => setTimeout(resolve, 500));
    return MOCK_OPERATORS;
};

export const useOperators = (companyId: string) => {
    const { data: operators, isLoading: isLoadingOperators, error: operatorsError } = useQuery({
        queryKey: ['operators', companyId],
        queryFn: () => fetchOperators(companyId),
        enabled: !!companyId,
    });

    return { operators, isLoadingOperators, operatorsError };
};
