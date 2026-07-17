'use client';

import { Route, Schedule } from '@/types';
import BranchCard from './BranchesCard';
import { getBranchTripSummary } from '../utils/schedule';

interface BranchesGridProps {
  branches: any[];
  routes: Route[];
  operators: any[];
  schedules: Schedule[];
  selectedBranchId: string | null;
  onSelectBranch: (id: string) => void;
}

export default function BranchesGrid({ branches, routes, operators, schedules, selectedBranchId, onSelectBranch }: BranchesGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {branches.map((branch: any) => {
        const branchRoutes = routes.filter((r: Route) => r.regionId === branch.id);
        const branchOperators = operators.filter((o: any) => o.regionId === branch.id);
        const tripSummary = getBranchTripSummary(branch.id, routes, schedules);

        return (
          <BranchCard
            key={branch.id}
            branch={branch}
            routeCount={branchRoutes.length}
            operatorCount={branchOperators.length}
            tripSummary={tripSummary}
            isSelected={selectedBranchId === branch.id}
            onSelect={() => onSelectBranch(branch.id)}
          />
        );
      })}
    </div>
  );
}