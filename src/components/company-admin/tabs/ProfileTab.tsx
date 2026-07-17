
import React from 'react';
import { useCompanyProfile } from './useCompanyProfile';
import { Loader2, AlertTriangle, Building, Mail, Phone, MapPin, Clock, GitBranch } from 'lucide-react';

// A placeholder companyId. This will be replaced with the actual companyId from the user's session.
const FAKE_COMPANY_ID = 'clxjh8v2n000008l3fcz2c4ga';

const ProfileTab = () => {
    const { profile, isLoading, error } = useCompanyProfile(FAKE_COMPANY_ID);

    if (isLoading) {
        return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin text-gray-500" /></div>;
    }

    if (error) {
        return <div className="p-8 text-red-600 bg-red-50 rounded-lg"><AlertTriangle className="h-8 w-8 mb-2" />Error loading company profile.</div>;
    }

    if (!profile) {
        return <div className="text-center p-8">No profile data available.</div>;
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Company Profile</h2>
                <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                    Edit Profile
                </button>
            </div>
            <div className="bg-white shadow-sm rounded-lg p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InfoField icon={Building} label="Company Name" value={profile.name} />
                    <InfoField icon={Mail} label="Contact Email" value={profile.email} />
                    <InfoField icon={Phone} label="Contact Phone" value={profile.phone} />
                    <InfoField icon={MapPin} label="Address" value={profile.address} />
                    <InfoField icon={Clock} label="Operating Hours" value={profile.operatingHours} />
                    <div className="md:col-span-2">
                        <h3 className="text-lg font-medium text-gray-900 mb-2 flex items-center gap-2"><GitBranch className="h-5 w-5 text-gray-500" /> Branches</h3>
                        <ul className="list-disc list-inside">
                            {profile.branches.map(branch => (
                                <li key={branch.id} className="text-gray-700">{branch.name}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface InfoFieldProps {
    icon: React.ElementType;
    label: string;
    value: string;
}

const InfoField: React.FC<InfoFieldProps> = ({ icon: Icon, label, value }) => (
    <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2 flex items-center gap-2">
            <Icon className="h-5 w-5 text-gray-500" /> {label}
        </h3>
        <p className="text-gray-700">{value}</p>
    </div>
);

export default ProfileTab;
