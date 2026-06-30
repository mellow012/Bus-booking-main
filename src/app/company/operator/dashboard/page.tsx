'use client';

import React, { useState } from 'react';
import { useOperatorDashboard } from './_hooks/useOperatorDashboard';
import OperatorLayout from './_components/OperatorLayout';
import OperatorSubNav from './_components/OperatorSubNav';
import { Loader2 } from 'lucide-react';
import { OPERATOR_CATEGORIES } from './_lib/constants';
import { NotificationBell } from '@/contexts/NotificationContext';

// Tabs
import HomeTab from './tabs/HomeTab';
import RoutesTab from './tabs/RoutesTab';
import BookingsTab from './tabs/BookingsTab';
import RevenueTab from './tabs/RevenueTab';
import ProfileTab from './tabs/ProfileTab';

export default function OperatorDashboardPage() {
  const dashboard = useOperatorDashboard();
  const [activeTab, setActiveTab] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');

  // Augment dashboard with searchQuery so tabs can access it
  const dashboardWithSearch = { ...dashboard, searchQuery };

  if (dashboard.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
        <p className="text-gray-500 font-medium">Loading your dashboard...</p>
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
        return <BookingsTab dashboard={dashboardWithSearch} />;
      case 'revenue':
        return <RevenueTab dashboard={dashboardWithSearch} />;
      case 'profile':
        return <ProfileTab dashboard={dashboardWithSearch} />;
      default:
        return <HomeTab dashboard={dashboardWithSearch} />;
    }
  };

  return (
    <OperatorLayout
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
        {dashboard.operatorInfo && dashboard.userProfile?.role === 'company_admin' && (
          <div className="mb-4 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
            Viewing operator dashboard for <span className="font-semibold">{dashboard.operatorInfo.name || dashboard.operatorInfo.email}</span>.
          </div>
        )}

        <OperatorSubNav
          tabs={OPERATOR_CATEGORIES}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
        <div className="mt-8">
          {renderActiveTab()}
        </div>
      </div>
    </OperatorLayout>
  );
}
