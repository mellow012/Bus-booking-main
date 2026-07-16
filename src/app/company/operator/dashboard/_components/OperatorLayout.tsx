'use client';

import React from 'react';
import OperatorHeader from './OperatorHeader';
import OperatorSidebar from './OperatorSidebar';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { OperatorCategory } from '../_lib/constants';

interface OperatorLayoutProps {
  children: React.ReactNode;
  title?: string;
  user?: any;
  userProfile?: any;
  searchQuery?: string;
  setSearchQuery?: (q: string) => void;
  NotificationBellComponent?: React.ComponentType<{ userId: string; className?: string }>;
  sidebarTabs: OperatorCategory[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  companyName: string;
  companyLogo?: string;
  onSignOut: () => void;
}

export default function OperatorLayout({
  children,
  title = 'Operator Dashboard',
  user,
  userProfile,
  searchQuery = '',
  setSearchQuery = () => {},
  NotificationBellComponent,
  sidebarTabs,
  activeTab,
  setActiveTab,
  isMobileOpen,
  setIsMobileOpen,
  companyName,
  companyLogo,
  onSignOut,
}: OperatorLayoutProps) {
  const handleHelpClick = () => {
    const tour = driver({
      showProgress: true,
      steps: [
        { 
          element: '#tour-home', 
          popover: { 
            title: '🏠 Console Home', 
            description: 'Get a snapshot of today\'s operations. Track total departures, passenger bookings, pending confirmation actions, and today\'s real-time fare revenues at a glance.', 
            side: 'bottom' 
          } 
        },
        { 
          element: '#tour-routes', 
          popover: { 
            title: '🛣️ Routes & Schedules', 
            description: 'Monitor your assigned routes and departure timetables. View vehicle assignments, check seat capacities, and keep track of actual departure statuses.', 
            side: 'bottom' 
          } 
        },
        { 
          element: '#tour-bookings', 
          popover: { 
            title: '🎟️ Bookings & Manifests', 
            description: 'Manage passenger details, issue boarding tickets, and confirm booking status. Generate complete passenger manifests with seat layouts for each trip.', 
            side: 'bottom' 
          } 
        },
        { 
          element: '#tour-revenue', 
          popover: { 
            title: '💰 Revenue Tracking', 
            description: 'Analyze financial reports and transaction histories. Review cash versus online collections and monitor booking payouts directly.', 
            side: 'bottom' 
          } 
        },
        { 
          element: '#tour-profile', 
          popover: { 
            title: '👤 Operator Profile', 
            description: 'Manage your contact details, view permission levels, and update password settings to keep your operator account secure.', 
            side: 'bottom' 
          } 
        },
        { 
          element: '#tour-help-btn-op', 
          popover: { 
            title: '❓ Need Help?', 
            description: 'Whenever you want to run through this walkthrough again to familiarize yourself with the console, just click this Help icon.', 
            side: 'left' 
          } 
        },
      ]
    });
    tour.drive();
  };

  return (
    <div className="min-h-screen bg-gray-50 lg:flex">
      <OperatorSidebar
        tabs={sidebarTabs}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        companyName={companyName}
        companyLogo={companyLogo}
        onSignOut={onSignOut}
      />

      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
        <OperatorHeader
          title={title}
          user={user}
          userProfile={userProfile}
          companyLogo={companyLogo}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onHelpClick={handleHelpClick}
          onMenuClick={() => setIsMobileOpen(true)}
          NotificationBellComponent={NotificationBellComponent}
        />

        <main className="flex-1 overflow-x-hidden px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1600px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
