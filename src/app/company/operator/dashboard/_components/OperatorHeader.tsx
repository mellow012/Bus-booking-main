'use client';

import React, { useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, User, Search, HelpCircle, Menu } from 'lucide-react';

interface OperatorHeaderProps {
  title: string;
  user: any;
  userProfile: any;
  companyLogo?: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onHelpClick?: () => void;
  onMenuClick?: () => void;
  NotificationBellComponent?: React.ComponentType<{ userId: string; className?: string }>;
}

export default function OperatorHeader({
  title,
  user,
  userProfile,
  companyLogo,
  searchQuery,
  setSearchQuery,
  onHelpClick,
  onMenuClick,
  NotificationBellComponent,
}: OperatorHeaderProps) {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const notificationUserId = userProfile?.id ?? user?.id;

  const profileInitial =
    (userProfile && userProfile.firstName && userProfile.firstName[0]) ||
    (user && user.email && user.email[0]) ||
    'U';

  // Safe Fallback rendering of notification bell
  const renderNotificationBell = () => {
    if (NotificationBellComponent && notificationUserId) {
      return <NotificationBellComponent userId={notificationUserId} />;
    }
    return (
      <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-all border border-transparent">
        <Bell className="w-5 h-5" />
      </button>
    );
  };

  return (
    <header className="sticky top-0 z-40 border-b border-gray-100 bg-white px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="lg:hidden p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-all"
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        {companyLogo && (
          <img src={companyLogo} alt="Company Logo" className="w-8 h-8 rounded-lg object-contain hidden sm:block lg:hidden" />
        )}
        <h2 className="truncate text-lg font-extrabold tracking-tight text-gray-900 sm:text-xl lg:text-2xl">
          {title}
        </h2>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Global Fuzzy Search */}
          <div className="relative flex-1 max-w-md hidden sm:block">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
              placeholder="Search dashboard... (Ctrl+K)"
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

          <button
            type="button"
            onClick={() => router.push('/profile')}
            className="ml-1 flex h-10 w-10 items-center justify-center rounded-full border border-indigo-100 bg-indigo-50 font-bold uppercase text-indigo-700 shadow-sm transition hover:bg-indigo-100"
            aria-label="View profile"
          >
              {profileInitial}
          </button>
        </div>
      </div>
      </div>
    </header>
  );
}
