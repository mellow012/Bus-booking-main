'use client';

import React, { useState } from 'react';
import DashboardHeader from './DashboardHeader';
import DashboardSubNav from './DashboardSubNav';
import { Company } from '@/types';
import { CATEGORIES, CategoryType, TabType, TabObject } from '../_lib/constants';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import DashboardSidebar from './DashboardSidebar';

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

  const categoryLabel = CATEGORIES.find((category) => category.id === activeCategory)?.label || 'Dashboard';

  const handleHelpClick = () => {
    const tour = driver({
      showProgress: true,
      steps: [
        { 
          element: '#tour-overview', 
          popover: { 
            title: '📊 Operations Overview', 
            description: 'Monitor live status updates across your fleet. View active bus tracks, total ticket sales, pending operator check-ins, and aggregate daily performance analytics.', 
            side: 'right' 
          } 
        },
        { 
          element: '#tour-team', 
          popover: { 
            title: '👥 Staff & Operators', 
            description: 'Invite and manage system operators, drivers, and conductors. Assign them to operational regions and check their signup and invitation progress.', 
            side: 'right' 
          } 
        },
        { 
          element: '#tour-regions', 
          popover: { 
            title: '🌿 Branches & Locations', 
            description: 'Manage branches, operational hubs, and route stops. Add new physical branches and coordinate regional schedules and local timetables.', 
            side: 'right' 
          } 
        },
        { 
          element: '#tour-sales', 
          popover: { 
            title: '🎟️ Booking & Manifest Manager', 
            description: 'View real-time booking lists and passenger transaction details. Confirm cash collections, process ticket cancellations, and inspect passenger seat maps.', 
            side: 'right' 
          } 
        },
        { 
          element: '#tour-revenue', 
          popover: { 
            title: '💰 Financial Analytics', 
            description: 'Track daily and monthly revenue records. Review payment channels, payout reports, and general financial performance metrics across your company.', 
            side: 'right' 
          } 
        },
        { 
          element: '#tour-config', 
          popover: { 
            title: '⚙️ Company Profile & Setup', 
            description: 'Configure company branding settings, configure bank credentials for online tickets, adjust operating hours, and manage service settings.', 
            side: 'right' 
          } 
        },
        { 
          element: '#tour-help-btn', 
          popover: { 
            title: '❓ Tour Guide', 
            description: 'Need to rerun this walk-through later? Click here at any time to reopen this interactive dashboard introduction.', 
            side: 'left' 
          } 
        },
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
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isCollapsed ? 'lg:pl-[72px]' : 'lg:pl-72'
          }`}
      >
        <DashboardHeader
          title={categoryLabel}
          onMenuClick={() => setIsMobileOpen(true)}
          user={user}
          userProfile={userProfile}
          company={company}
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
