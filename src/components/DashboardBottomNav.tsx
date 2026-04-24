"use client";

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface BottomNavTab {
  id: string;
  label: string;
  icon: LucideIcon;
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
              className="flex flex-col items-center justify-center flex-1 h-full relative group transition-all"
            >
              <div className={`p-1.5 rounded-xl transition-all duration-300 ${
                isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 -translate-y-1' : 'text-gray-400 group-hover:text-gray-600'
              }`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className={`text-[9px] font-bold mt-1 uppercase tracking-widest transition-colors duration-300 ${
                isActive ? 'text-indigo-600' : 'text-gray-400'
              }`}>
                {tab.label}
              </span>
              
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-indigo-600 rounded-b-full shadow-[0_1px_4px_rgba(79,70,229,0.4)] animate-in fade-in zoom-in duration-300" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DashboardBottomNav;
