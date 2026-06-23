'use client';

import React from 'react';
import { 
  X, LogOut, LayoutDashboard, Calendar, Users, MapPin, Bus, FileText, DollarSign, Menu 
} from 'lucide-react';

export const TABS = [
  { id: 'overview' as const, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'routes' as const, label: 'My Routes', icon: MapPin },
  { id: 'schedules' as const, label: 'Schedules', icon: Calendar },
  { id: 'buses' as const, label: 'Buses', icon: Bus },
  { id: 'bookings' as const, label: 'Bookings', icon: Users },
  { id: 'payments' as const, label: 'Payments', icon: DollarSign },
] as const;

export type TabType = typeof TABS[number]['id'];

interface OperatorSidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  companyName: string;
  onSignOut: () => void;
}

export default function OperatorSidebar({
  activeTab,
  setActiveTab,
  isMobileOpen,
  setIsMobileOpen,
  companyName,
  onSignOut,
}: OperatorSidebarProps) {
  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-[60] lg:hidden backdrop-blur-sm animate-in fade-in duration-300"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar Panel */}
      <aside className={`
        fixed lg:sticky top-0 left-0 z-[70] w-64 bg-white border-r border-gray-100 flex flex-col h-screen overflow-hidden shadow-sm transition-all duration-500 ease-in-out
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 border-b border-gray-50 flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100 text-white font-bold text-lg">
            {companyName?.[0] || 'O'}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold tracking-tight uppercase text-sm truncate">{companyName || 'Platform'}</h1>
            <p className="text-[10px] text-indigo-500 font-bold tracking-widest uppercase">Operator Console</p>
          </div>
          <button onClick={() => setIsMobileOpen(false)} className="lg:hidden p-2 text-gray-400 hover:bg-gray-50 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 px-3">Main Navigation</div>
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setIsMobileOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold text-sm ${
                  isSelected 
                    ? 'bg-indigo-50 text-indigo-700 shadow-sm' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className={`w-5 h-5 ${isSelected ? 'text-indigo-600' : ''}`} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-50">
          <button 
            onClick={onSignOut} 
            className="w-full flex items-center gap-3 px-4 py-3 text-red-500 font-semibold hover:bg-red-50 rounded-xl transition-all text-sm"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
