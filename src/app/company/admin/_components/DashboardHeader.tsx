'use client';

import React from 'react';
import { Menu, Bell, User, Search, HelpCircle } from 'lucide-react';

interface DashboardHeaderProps {
  title: string;
  onMenuClick: () => void;
  user: any;
  userProfile: any;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onHelpClick?: () => void;
  NotificationBellComponent?: React.ComponentType<{ userId: string; className?: string }>;
}

export default function DashboardHeader({
  title,
  onMenuClick,
  user,
  userProfile,
  searchQuery,
  setSearchQuery,
  onHelpClick,
  NotificationBellComponent,
}: DashboardHeaderProps) {
  // Safe Fallback rendering of notification bell
  const renderNotificationBell = () => {
    if (NotificationBellComponent && user?.id) {
      return <NotificationBellComponent userId={user.id} />;
    }
    return (
      <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-all border border-transparent" aria-label="Notifications">
        <Bell className="w-5 h-5" />
      </button>
    );
  };

  return (
    <header className="h-[60px] bg-white border-b border-gray-100 px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-50 rounded-lg"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-bold text-gray-900 hidden sm:block">
          {title}
        </h2>
      </div>

      <div className="flex items-center gap-3 sm:gap-4 flex-1 justify-end">
        {/* Global Fuzzy Search */}
        <div className="relative flex-1 max-w-md hidden sm:block">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
            placeholder="Search dashboards..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Search Icon for mobile */}
        <button className="sm:hidden p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg">
          <Search className="w-5 h-5" />
        </button>

        {/* Help/Walkthrough Icon */}
        <button 
          onClick={onHelpClick}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-all"
          title="Help & Tour"
          id="tour-help-btn"
        >
          <HelpCircle className="w-5 h-5" />
        </button>

        {renderNotificationBell()}

        <div className="h-8 w-8 bg-indigo-100 rounded-full flex items-center justify-center border border-indigo-200 ml-2 shadow-sm">
          <span className="text-sm font-bold text-indigo-700 uppercase">
            {userProfile?.firstName?.[0] || user?.email?.[0] || 'A'}
          </span>
        </div>
      </div>
    </header>
  );
}
