'use client';

import React, { useState } from 'react';
import DashboardSidebar from './DashboardSidebar';
import DashboardHeader from './DashboardHeader';
import DashboardSubNav from './DashboardSubNav';
import { Company } from '@/types';
import { CategoryType, TabType, TabObject } from '../_lib/constants';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

interface AdminLayoutProps {
  children: React.ReactNode;
  user: any;
  userProfile: any;
  company: Company | null;
  onSignOut: () => void;
  // State from hook
  activeCategory: CategoryType;
  setActiveCategory: (cat: CategoryType) => void;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  subTabs: readonly TabType[];
  availableTabs: TabObject[];
  statistics: any;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isBusy?: boolean;
  NotificationBellComponent?: React.ComponentType<{ userId: string; className?: string }>;
}

export default function AdminLayout({
  children,
  user,
  userProfile,
  company,
  onSignOut,
  activeCategory,
  setActiveCategory,
  activeTab,
  setActiveTab,
  subTabs,
  availableTabs,
  statistics,
  searchQuery,
  setSearchQuery,
  isBusy,
  NotificationBellComponent
}: AdminLayoutProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Find active category label for header title
  const categoryLabel = activeCategory 
    ? activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1) 
    : 'Dashboard';

  const handleHelpClick = () => {
    const tour = driver({
      showProgress: true,
      steps: [
        { element: '#tour-overview', popover: { title: 'Overview', description: 'See a high-level summary of your operations.', side: 'right' } },
        { element: '#tour-team', popover: { title: 'Operators & Branches', description: 'Manage your staff and company branches.', side: 'right' } },
        { element: '#tour-regions', popover: { title: 'Regions', description: 'View the cascade of branches, routes, and schedules.', side: 'right' } },
        { element: '#tour-sales', popover: { title: 'Bookings', description: 'Manage and track all customer bookings.', side: 'right' } },
        { element: '#tour-revenue', popover: { title: 'Revenue', description: 'View financial performance.', side: 'right' } },
        { element: '#tour-config', popover: { title: 'Profile', description: 'Configure company settings and preferences.', side: 'right' } },
        { element: '#tour-help-btn', popover: { title: 'Help', description: 'Click here anytime to replay this tour.', side: 'left' } },
      ]
    });
    tour.drive();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <DashboardSidebar
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        company={company}
        onSignOut={onSignOut}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        statistics={statistics}
      />

      <div 
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          isCollapsed ? 'lg:pl-[72px]' : 'lg:pl-72'
        }`}
      >
        <DashboardHeader
          title={categoryLabel}
          onMenuClick={() => setIsMobileOpen(true)}
          user={user}
          userProfile={userProfile}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onHelpClick={handleHelpClick}
          isBusy={isBusy}
          NotificationBellComponent={NotificationBellComponent}
        />

        <DashboardSubNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          subTabs={subTabs}
          availableTabs={availableTabs}
          statistics={statistics}
        />

        <main className="flex-1 overflow-x-hidden p-6 sm:p-8">
          <div className="max-w-[1600px] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
