'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useOperatorDashboard } from './_hooks/useOperatorDashboard';
import OperatorLayout from './_components/OperatorLayout';
import { OPERATOR_CATEGORIES } from './_lib/constants';
import { Skeleton } from '@/components/ui/Skeleton';
import { NotificationBell } from '@/contexts/NotificationContext';
import { useAppToast } from '@/contexts/ToastContext';
// Tabs
import HomeTab from './tabs/HomeTab';
import RoutesTab from './tabs/RoutesTab';
import BookingsTab from './tabs/BookingsTab';
import RevenueTab from './tabs/RevenueTab';
import ProfileTab from './tabs/ProfileTab';

export default function OperatorDashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dashboard = useOperatorDashboard();
  const { error, success } = useAppToast();
  const queryTab = searchParams?.get('tab');
  const [activeTab, setActiveTab] = useState(queryTab || 'home');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [defaultScheduleId, setDefaultScheduleId] = useState<string | null>(null);

  useEffect(() => {
    const currentTab = searchParams?.get('tab') || 'home';
    if (currentTab && currentTab !== activeTab) {
      setActiveTab(currentTab);
    }
  }, [searchParams, activeTab]);

  useEffect(() => {
    if (dashboard.globalError) {
      error('Error', dashboard.globalError);
    }
  }, [dashboard.globalError, error]);

  useEffect(() => {
    if (dashboard.successMessage) {
      success('Success', dashboard.successMessage);
    }
  }, [dashboard.successMessage, success]);

  const updateTab = (tabId: string) => {
    setActiveTab(tabId);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.set('tab', tabId);

      if (dashboard.operatorInfo?.id) {
        params.set('operatorId', dashboard.operatorInfo.id);
      }

      window.history.pushState(null, '', `?${params.toString()}`);
    }
  };

  // Augment dashboard with searchQuery and navigation helpers so tabs can access it
  const navigateToBookings = (scheduleId?: string) => {
    if (scheduleId) setDefaultScheduleId(scheduleId);
    updateTab('bookings');
  };
  const dashboardWithSearch = { ...dashboard, searchQuery, navigateTo: updateTab, navigateToBookings };

  if (dashboard.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        <Skeleton className="w-64 h-screen rounded-none hidden lg:block" />
        <div className="flex-1 flex flex-col p-6 sm:p-8 gap-8">
          <Skeleton className="w-full h-16 rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
          <Skeleton className="h-[400px] w-full rounded-2xl mt-4" />
        </div>
      </div>
    );
  }

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'home':
        return <HomeTab dashboard={dashboardWithSearch} />;
      case 'routes':
        return <RoutesTab dashboard={dashboardWithSearch} />;
      case 'bookings':
        return <BookingsTab dashboard={dashboardWithSearch} defaultScheduleId={defaultScheduleId} />;
      case 'revenue':
        return <RevenueTab dashboard={dashboardWithSearch} />;
      case 'profile':
        return <ProfileTab dashboard={dashboardWithSearch} />;
      default:
        return <HomeTab dashboard={dashboardWithSearch} />;
    }
  };

  const activeTabLabel = OPERATOR_CATEGORIES.find((tab) => tab.id === activeTab)?.label || 'Operator Dashboard';

  return (
    <OperatorLayout
      title={activeTabLabel}
      user={dashboard.user}
      userProfile={dashboard.userProfile}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      sidebarTabs={OPERATOR_CATEGORIES}
      activeTab={activeTab}
      setActiveTab={updateTab}
      isMobileOpen={isMobileOpen}
      setIsMobileOpen={setIsMobileOpen}
      companyName={dashboard.operatorInfo?.companyName || (dashboard.userProfile as any)?.companyName || 'Operator'}
      companyLogo={dashboard.companyLogo}
      onSignOut={dashboard.signOut}
      NotificationBellComponent={NotificationBell}
    >
      {dashboard.operatorInfo && dashboard.userProfile?.role === 'company_admin' && (
        <div className="mb-6 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900 flex items-center justify-between">
          <span>Viewing operator dashboard for <span className="font-semibold">{dashboard.operatorInfo.name || dashboard.operatorInfo.email}</span>.</span>
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
        </div>
      )}
      {renderActiveTab()}
    </OperatorLayout>
  );
}
