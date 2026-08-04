'use client';

import React, { Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import useAdminDashboard from './_hooks/useAdminDashboard';
import AdminLayout from './_components/AdminLayout';

// Tabs
import OverviewTab from './OverviewTab';
import OperatorsAndBranchesTab from './OperatorsAndBranchesTab';
import RegionsTab from './RegionsTab';
import RevenueTab from './RevenueTab';
import ProfileTab from './ProfileTab';
import BookingsTab from './BookingsTab';
import BusesTab from './BusesTab';

import AlertMessage from '@/components/AlertMessage';
import { NotificationBell } from '@/contexts/NotificationContext';
import { CATEGORIES } from './_lib/constants';

const queryClient = new QueryClient();

/**
 * Inner shell — this is the component that calls useSearchParams() (via
 * useAdminDashboard → useSearchParams). By keeping it inside its own
 * <Suspense> boundary we prevent the *entire* page from suspending (and
 * re-showing loading.tsx / the full-screen spinner) every time a URL
 * param like ?tab=bookings changes.
 */
function AdminDashboardInner() {
  const dashboard = useAdminDashboard(queryClient);

  // Only show the full-screen spinner during the very first auth/data load
  // (when we have no data yet). After that, isBusy can show a lighter indicator.
  if (dashboard.authLoading || (dashboard.loading && !dashboard.dashboardData.company)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!dashboard.user) {
    return null;
  }

  const renderActiveTab = () => {
    switch (dashboard.activeTab) {
      case 'overview':
        return <OverviewTab dashboard={dashboard} />;
      case 'operators':
        return <OperatorsAndBranchesTab dashboard={dashboard} />;
      case 'regions':
        return <RegionsTab dashboard={dashboard} />;
      case 'revenue':
        return <RevenueTab dashboard={dashboard} />;
      case 'profile':
        return <ProfileTab dashboard={dashboard} />;
      case 'buses':
        return <BusesTab dashboard={dashboard} />;
      case 'bookings':
        return <BookingsTab dashboard={dashboard} />;
      default:
        return (
          <div className="p-8 text-center bg-white rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Select a Tab</h2>
            <p className="text-gray-500">This section is currently under construction.</p>
          </div>
        );
    }
  };

  return (
    <AdminLayout
      user={dashboard.user}
      userProfile={dashboard.userProfile}
      company={dashboard.dashboardData?.company || null}
      onSignOut={dashboard.signOut}
      activeCategory={dashboard.activeCategory as any}
      setActiveCategory={dashboard.setActiveCategory as any}
      activeTab={dashboard.activeTab as any}
      setActiveTab={dashboard.setActiveTab as any}
      subTabs={CATEGORIES.find(c => c.id === dashboard.activeCategory)?.subTabs || []}
      availableTabs={dashboard.availableTabs}
      statistics={dashboard.statistics}
      searchQuery={dashboard.searchQuery}
      setSearchQuery={dashboard.setSearchQuery}
      isBusy={dashboard.isBusy}
      NotificationBellComponent={NotificationBell}
    >
      {dashboard.alert && (
        <AlertMessage
          type={dashboard.alert.type}
          message={dashboard.alert.message}
          onClose={dashboard.clearAlert}
          className="mx-auto max-w-7xl"
          scrollIntoView
        />
      )}
      {renderActiveTab()}
    </AdminLayout>
  );
}

/**
 * Outer shell — provides QueryClient + Suspense boundary.
 * loading.tsx only fires if this outer shell itself suspends, which it
 * never does since AdminDashboardInner owns all the useSearchParams calls.
 */
export default function CompanyAdminClient() {
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      }>
        <AdminDashboardInner />
      </Suspense>
    </QueryClientProvider>
  );
}
