'use client';

import React from 'react';
import { Bell, User, Search, HelpCircle } from 'lucide-react';

interface OperatorHeaderProps {
  title: string;
  user: any;
  userProfile: any;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onHelpClick?: () => void;
  NotificationBellComponent?: React.ComponentType<{ userId: string; className?: string }>;
}

export default function OperatorHeader({
  title,
  user,
  userProfile,
  searchQuery,
  setSearchQuery,
  onHelpClick,
  NotificationBellComponent,
}: OperatorHeaderProps) {
  // Safe Fallback rendering of notification bell
  const renderNotificationBell = () => {
    if (NotificationBellComponent && user?.id) {
      return <NotificationBellComponent userId={user.id} />;
    }
    return (
      <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-all border border-transparent">
        <Bell className="w-5 h-5" />
      </button>
    );
  };

  return (
    <header className="h-20 bg-white border-b border-gray-100 px-6 sm:px-8 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-gray-900 capitalize flex items-center gap-2">
          {title}
        </h2>
      </div>

      <div className="flex items-center gap-4">
        {/* Live Ops Indicator */}
        <div className="hidden md:flex bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full items-center gap-2 text-xs font-bold uppercase tracking-wider">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> 
          Live Ops
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {/* Global Fuzzy Search */}
          <div className="relative flex-1 max-w-md hidden sm:block">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
              placeholder="Search dashboard..."
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
            id="tour-help-btn-op"
            onClick={onHelpClick}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-all"
            title="Help & Tour"
          >
            <HelpCircle className="w-5 h-5" />
          </button>

          {renderNotificationBell()}
          
          <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center font-bold text-indigo-700 border border-indigo-100 shadow-sm uppercase ml-2">
            {userProfile?.firstName?.[0] || user?.email?.[0] || 'U'}
          </div>
        </div>
      </div>
    </header>
  );
}
