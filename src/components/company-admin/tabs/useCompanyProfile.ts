
import { useQuery } from '@tanstack/react-query';

const MOCK_COMPANY_PROFILE = {
    name: 'Quantum Bus Services',
    email: 'contact@quantum.bus',
    phone: '+265 1 234 567',
    address: '123 Quantum Lane, Lilongwe, Malawi',
    operatingHours: 'Mon-Fri: 8am - 5pm, Sat: 9am - 1pm',
    branches: [
        { id: '1', name: 'Lilongwe' },
        { id: '2', name: 'Blantyre' },
        { id: '3', name: 'Mzuzu' },
    ],
};

const fetchCompanyProfile = async (companyId: string) => {
    console.log(`Fetching company profile for company ${companyId}`);
    await new Promise(resolve => setTimeout(resolve, 500));
    return MOCK_COMPANY_PROFILE;
};

export const useCompanyProfile = (companyId: string) => {
    const { data, isLoading, error } = useQuery({
        queryKey: ['companyProfile', companyId],
        queryFn: () => fetchCompanyProfile(companyId),
        enabled: !!companyId,
    });

    return { profile: data, isLoading, error };
};
