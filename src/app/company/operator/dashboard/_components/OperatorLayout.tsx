'use client';

import React from 'react';
import OperatorHeader from './OperatorHeader';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

interface OperatorLayoutProps {
  children: React.ReactNode;
  user?: any;
  userProfile?: any;
  searchQuery?: string;
  setSearchQuery?: (q: string) => void;
  NotificationBellComponent?: React.ComponentType<{ userId: string; className?: string }>;
}

export default function OperatorLayout({ 
  children, user, userProfile, searchQuery = '', setSearchQuery = () => {}, NotificationBellComponent
}: OperatorLayoutProps) {
  const handleHelpClick = () => {
    const tour = driver({
      showProgress: true,
      steps: [
        { element: '#tour-home', popover: { title: 'Home', description: 'See a high-level summary of your branches and assigned routes.', side: 'bottom' } },
        { element: '#tour-routes', popover: { title: 'Routes', description: 'Manage schedules and assigned vehicles.', side: 'bottom' } },
        { element: '#tour-bookings', popover: { title: 'Bookings', description: 'Manage and track customer bookings and generate passenger manifests.', side: 'bottom' } },
        { element: '#tour-revenue', popover: { title: 'Revenue', description: 'View financial performance for your branches.', side: 'bottom' } },
        { element: '#tour-profile', popover: { title: 'Profile', description: 'Configure your operator settings.', side: 'bottom' } },
        { element: '#tour-help-btn-op', popover: { title: 'Help', description: 'Click here anytime to replay this tour.', side: 'left' } },
      ]
    });
    tour.drive();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <OperatorHeader 
        title="Operator Dashboard"
        onMenuClick={() => {}}
        user={user}
        userProfile={userProfile}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onHelpClick={handleHelpClick}
        NotificationBellComponent={NotificationBellComponent}
      />
      <main className="flex-1 w-full relative z-0 overflow-y-auto focus:outline-none">
        {children}
      </main>
    </div>
  );
}
