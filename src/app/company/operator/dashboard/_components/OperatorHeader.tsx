'use client';

import React from 'react';
import { NotificationBell } from '@/contexts/NotificationContext';
import { Menu as MenuIcon, Bell, User } from 'lucide-react';

interface OperatorHeaderProps {
  title: string;
  onMenuClick: () => void;
  user: any;
  userProfile: any;
  NotificationBellComponent?: React.ComponentType<{ userId: string; className?: string }>;
}

export default function OperatorHeader({
  title,
  onMenuClick,
  user,
  userProfile,
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
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2.5 hover:bg-gray-50 rounded-xl transition-colors border border-gray-100"
        >
          <MenuIcon className="w-6 h-6 text-gray-600" />
        </button>
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

        <div className="flex items-center gap-2">
          {renderNotificationBell()}
          
          <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center font-bold text-indigo-700 border border-indigo-100 shadow-sm uppercase">
            {userProfile?.firstName?.[0] || user?.email?.[0] || 'U'}
          </div>
        </div>
      </div>
    </header>
  );
}
