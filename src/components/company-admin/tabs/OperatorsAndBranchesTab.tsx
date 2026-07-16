
import React, { useMemo, useState } from 'react';
import { useOperators } from './useOperators';
import { useRegions } from './useRegions';
import { Loader2, AlertTriangle, PlusCircle, Filter } from 'lucide-react';

// A placeholder companyId. This will be replaced with the actual companyId from the user's session.
const FAKE_COMPANY_ID = 'clxjh8v2n000008l3fcz2c4ga';

const OperatorsAndBranchesTab = () => {
    const { operators, isLoadingOperators, operatorsError } = useOperators(FAKE_COMPANY_ID);
    const { regions } = useRegions(FAKE_COMPANY_ID);
    const [filterRegion, setFilterRegion] = useState<string>('all');

    const filteredOperators = useMemo(() => {
        if (filterRegion === 'all') {
            return operators;
        }
        return operators?.filter(op => op.regionId === filterRegion);
    }, [operators, filterRegion]);

    if (isLoadingOperators) {
        return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin text-gray-500" /></div>;
    }

    if (operatorsError) {
        return <div className="p-8 text-red-600 bg-red-50 rounded-lg"><AlertTriangle className="h-8 w-8 mb-2" />Error loading operators.</div>;
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Operators</h2>
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Filter className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <select
                            value={filterRegion}
                            onChange={(e) => setFilterRegion(e.target.value)}
                            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
                        >
                            <option value="all">All Regions</option>
                            {regions?.map(region => (
                                <option key={region.id} value={region.id}>{region.name}</option>
                            ))}
                        </select>
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                        <PlusCircle className="h-5 w-5" /> Add Operator
                    </button>
                </div>
            </div>
            <div className="bg-white shadow-sm rounded-lg overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Region/Branch</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th scope="col" className="relative px-6 py-3"><span className="sr-only">Edit</span></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredOperators?.map((operator) => (
                            <tr key={operator.id}>
                                <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-900">{operator.name}</div><div className="text-sm text-gray-500">{operator.email}</div></td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{operator.regionName}</td>
                                <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${operator.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{operator.status}</span></td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"><a href="#" className="text-indigo-600 hover:text-indigo-900">Manage</a></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredOperators?.length === 0 && <div className="text-center p-8 text-gray-500">No operators found.</div>}
            </div>
        </div>
    );
};

export default OperatorsAndBranchesTab;
