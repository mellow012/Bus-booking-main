'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useOperatorDashboard } from './_hooks/useOperatorDashboard';
import OperatorLayout from './_components/OperatorLayout';
import OperatorSubNav from './_components/OperatorSubNav';
import { OPERATOR_CATEGORIES } from './_lib/constants';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { NotificationBell } from '@/contexts/NotificationContext';

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
  const queryTab = searchParams?.get('tab');
  const [activeTab, setActiveTab] = useState(queryTab || 'home');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const currentTab = searchParams?.get('tab') || 'home';
    if (currentTab && currentTab !== activeTab) {
      setActiveTab(currentTab);
    }
  }, [searchParams, activeTab]);

  const updateTab = (tabId: string) => {
    setActiveTab(tabId);
    const params = new URLSearchParams();
    params.set('tab', tabId);

    if (dashboard.operatorInfo?.id) {
      params.set('operatorId', dashboard.operatorInfo.id);
    }

    router.replace(`/company/operator/dashboard?${params.toString()}`);
  };

  // Augment dashboard with searchQuery so tabs can access it
  const dashboardWithSearch = { ...dashboard, searchQuery };

  if (dashboard.isLoading) {
    return <LoadingSpinner className="text-indigo-600" label="Loading your dashboard..." fullScreen />;
  }

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'home':
        return <HomeTab dashboard={dashboardWithSearch} />;
      case 'routes':
        return <RoutesTab dashboard={dashboardWithSearch} />;
      case 'bookings':
        return <BookingsTab dashboard={dashboardWithSearch} />;
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
      NotificationBellComponent={NotificationBell}
    >
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Inline alerts */}
        {dashboard.globalError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium animate-in slide-in-from-top-2 duration-200">
            {dashboard.globalError}
          </div>
        )}
        {dashboard.successMessage && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm font-medium animate-in slide-in-from-top-2 duration-200">
            {dashboard.successMessage}
          </div>
        )}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {dashboard.operatorInfo && dashboard.userProfile?.role === 'company_admin' && (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
              Viewing operator dashboard for <span className="font-semibold">{dashboard.operatorInfo.name || dashboard.operatorInfo.email}</span>.
            </div>
          )}
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>

        <OperatorSubNav
          tabs={OPERATOR_CATEGORIES}
          activeTab={activeTab}
          onTabChange={updateTab}
        />
        <div className="mt-8">
          {renderActiveTab()}
        </div>
      </div>
    </OperatorLayout>
  );
}
