'use client';

import { AlertCircle, MapPin, PlusCircle } from 'lucide-react';
import { Booking, Bus, Route, Schedule } from '@/types';
import { RouteWithScheduleInfo } from '../types';
import RouteTabStrip from './RouteTabStrip';
import RouteScheduleSection from './RouteScheduleSection';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import ConfirmDeleteModal from '../../ConfirmDeleteModal';
import { useAppToast } from '@/contexts/ToastContext';
import { deleteBranch } from '@/lib/actions/fleet.actions';

interface BranchDetailPanelProps {
  branch: any;
  branchRoutes: Route[];
  bookingsInBranch: number;
  routesWithScheduleInfo: RouteWithScheduleInfo[];
  selectedRoute: Route | null;
  selectedRouteId: string | null;
  onSelectRoute: (routeId: string) => void;
  onAddRoute: () => void;
  onAddSchedule: () => void;

  selectedRouteScheduleCount: number;
  selectedRouteRevenue: number;
  scheduleFilterDate: string;
  onFilterDateChange: (date: string) => void;
  pagedSchedules: Schedule[];
  currentAndUpcomingCount: number;
  completedSchedules: Schedule[];
  schedulePage: number;
  onPreviousPage: () => void;
  onNextPage: () => void;

  branchUpcomingTrips: Schedule[];
  routes: Route[];
  buses: Bus[];
  bookings: Booking[];
  templates: any[];
  companyId: string;
  onTripsGenerated?: () => void;
  onScheduleClick?: (scheduleId: string) => void;
}

export default function BranchDetailPanel({
  branch,
  branchRoutes,
  bookingsInBranch,
  routesWithScheduleInfo,
  selectedRoute,
  selectedRouteId,
  onSelectRoute,
  onAddRoute,
  onAddSchedule,
  selectedRouteScheduleCount,
  selectedRouteRevenue,
  scheduleFilterDate,
  onFilterDateChange,
  pagedSchedules,
  currentAndUpcomingCount,
  completedSchedules,
  schedulePage,
  onPreviousPage,
  onNextPage,
  branchUpcomingTrips,
  routes,
  buses,
  bookings,
  templates,
  companyId,
  onTripsGenerated,
  onScheduleClick,
}: BranchDetailPanelProps) {
  const toast = useAppToast();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteBranch = async () => {
    // Dependency check
    if (branchRoutes.length > 0) {
      toast.error('Cannot delete branch', `This branch has ${branchRoutes.length} active route(s). Reassign or delete them first.`);
      setIsDeleteModalOpen(false);
      return;
    }
    // Also check for operators? It's hard to check operators here unless passed in.
    // For now, checking routes is the main dependency.

    setIsDeleting(true);
    try {
      const res = await deleteBranch(branch.id);
      if (res.success) {
        toast.success('Branch deleted', `${branch.name} has been removed.`);
        // Note: the parent will need to handle re-fetching or state update. The server action revalidates.
      } else {
        toast.error('Failed to delete', res.error || 'Unknown error');
      }
    } catch (err: any) {
      toast.error('Error', err.message);
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="p-5 border-b border-gray-100 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between bg-gray-50/50">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">{branch.name}</h3>
            <p className="text-xs text-gray-500">{branchRoutes.length} routes in this branch</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => setIsDeleteModalOpen(true)}
            className="text-xs font-semibold text-red-600 hover:text-red-800 bg-red-50 px-3 py-1.5 rounded-lg flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" /> Delete Branch
          </button>
          <button onClick={onAddRoute} className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg flex items-center gap-1">
            <PlusCircle className="w-3 h-3" /> Add Route
          </button>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {branchRoutes.length === 0 ? (
          <div className="text-center py-6">
            <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No routes in this branch yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
              <span>{branchRoutes.length} routes</span>
              <span>•</span>
              <span>{bookingsInBranch} bookings</span>
            </div>

            <RouteTabStrip routes={routesWithScheduleInfo} selectedRouteId={selectedRouteId} onSelectRoute={onSelectRoute} />

            {selectedRoute && (
              <RouteScheduleSection
                route={selectedRoute}
                scheduleCount={selectedRouteScheduleCount}
                revenue={selectedRouteRevenue}
                filterDate={scheduleFilterDate}
                onFilterDateChange={onFilterDateChange}
                onAddSchedule={onAddSchedule}
                pagedSchedules={pagedSchedules}
                currentAndUpcomingCount={currentAndUpcomingCount}
                completedSchedules={completedSchedules}
                page={schedulePage}
                onPreviousPage={onPreviousPage}
                onNextPage={onNextPage}
                buses={buses}
                bookings={bookings}
                templates={templates}
                companyId={companyId}
                onTripsGenerated={onTripsGenerated}
              />
            )}
          </div>
        )}
      </div>

      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteBranch}
        isDeleting={isDeleting}
        title="Delete Branch"
        message={`Are you sure you want to delete ${branch.name}? This action cannot be undone.`}
      />
    </div>
  );
}