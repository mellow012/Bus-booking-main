
import React from 'react';
import { useCompanyOverview } from './useCompanyOverview';
import StatCard from '../StatCard';
import { Briefcase, Users, GitBranch, Route, Calendar, Bus, DollarSign, Settings, Loader2, AlertTriangle } from 'lucide-react';

// A placeholder companyId. This will be replaced with the actual companyId from the user's session.
const FAKE_COMPANY_ID = 'clxjh8v2n000008l3fcz2c4ga';

const OverviewTab = () => {
  const { stats, isLoading, error } = useCompanyOverview(FAKE_COMPANY_ID);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-red-600 bg-red-50 rounded-lg">
        <AlertTriangle className="h-8 w-8 mb-2" />
        <p>Error loading overview data.</p>
        <p className="text-sm text-gray-500">Please try refreshing the page.</p>
      </div>
    );
  }

  if (!stats) {
    return <div className="text-center p-8">No overview data available.</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      <StatCard
        title="Branches"
        value={stats.branches.total}
        icon={GitBranch}
        description={`${stats.branches.routesPerBranch} routes/branch`}
        onClick={() => console.log('Navigate to branches')}
      />
      <StatCard
        title="Operators"
        value={stats.operators.total}
        icon={Users}
        description={`${stats.operators.active} active`}
        onClick={() => console.log('Navigate to operators')}
      />
      <StatCard
        title="Routes"
        value={stats.routes.total}
        icon={Route}
        description="Total active routes"
        onClick={() => console.log('Navigate to routes')}
      />
      <StatCard
        title="Schedules"
        value={stats.schedules.total}
        icon={Calendar}
        description={`${stats.schedules.upcoming} upcoming`}
        onClick={() => console.log('Navigate to schedules')}
      />
      <StatCard
        title="Buses"
        value={stats.buses.total}
        icon={Bus}
        description={`${stats.buses.active} active`}
        onClick={() => console.log('Navigate to buses')}
      />
      <StatCard
        title="Overall Revenue"
        value={`MWK ${stats.revenue.overall.toLocaleString()}`}
        icon={DollarSign}
        description="This month"
        onClick={() => console.log('Navigate to revenue')}
      />
       <StatCard
        title="General Settings"
        value="View & Edit"
        icon={Settings}
        description="Company profile and settings"
        onClick={() => console.log('Navigate to settings')}
      />
    </div>
  );
};

export default OverviewTab;
