"use client";

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface BottomNavTab {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: boolean;
}

interface DashboardBottomNavProps {
  tabs: readonly BottomNavTab[] | BottomNavTab[];
  activeTab: string;
  onTabChange: (id: any) => void;
  className?: string;
}

const DashboardBottomNav: React.FC<DashboardBottomNavProps> = ({
  tabs,
  activeTab,
  onTabChange,
  className = ""
}) => {
  return (
    <div className={`lg:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-gray-100 px-2 pb-safe-area-inset-bottom z-40 transition-all duration-300 ${className}`}>
      <div className="flex items-center justify-around h-16 max-w-md mx-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center justify-center h-full relative group rounded-2xl transition-colors ${
                isActive ? 'bg-brand-50/80' : 'hover:bg-gray-50/80'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all duration-300 ${
                isActive ? 'bg-brand-100 text-brand-700' : 'text-gray-400 group-hover:text-gray-600'
              }`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className={`text-[9px] font-bold mt-1 uppercase tracking-widest transition-colors duration-300 ${
                isActive ? 'text-brand-700' : 'text-gray-400'
              }`}>
                {tab.label}
              </span>
              
              {isActive && (
                <div className="absolute bottom-1 left-1/2 h-1 w-5 -translate-x-1/2 rounded-full bg-brand-600" />
              )}

              {tab.badge && !isActive && (
                <div className="absolute top-2 right-1/4 w-2 h-2 bg-red-500 rounded-full border border-white shadow-sm" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DashboardBottomNav;
