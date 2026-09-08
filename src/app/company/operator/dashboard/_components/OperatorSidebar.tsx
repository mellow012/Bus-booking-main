'use client';

import React from 'react';
import { X, LogOut, ExternalLink } from 'lucide-react';
import { OperatorCategory } from '../_lib/constants';

interface OperatorSidebarProps {
  tabs: OperatorCategory[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  companyName: string;
  companyLogo?: string;
  onSignOut: () => void;
}

export default function OperatorSidebar({
  tabs,
  activeTab,
  setActiveTab,
  isMobileOpen,
  setIsMobileOpen,
  companyName,
  companyLogo,
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
      <aside className={
        `fixed lg:sticky top-0 left-0 z-[70] w-72 max-w-[85vw] bg-white border-r border-gray-100 flex flex-col h-screen overflow-hidden shadow-lg transition-all duration-500 ease-in-out
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`
      }>
        <div className="p-6 border-b border-gray-50 flex items-center gap-3">
          {companyLogo ? (
            <img src={companyLogo} alt={companyName} className="w-10 h-10 rounded-xl object-contain shadow-sm border border-gray-100" />
          ) : (
            <div className="w-10 h-10 bg-brand-700 rounded-xl flex items-center justify-center shadow-lg shadow-brand-100 text-white font-bold text-lg shrink-0">
              {companyName?.[0] || 'O'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-bold tracking-tight uppercase text-sm truncate">{companyName || 'Platform'}</h1>
            <p className="text-[10px] text-brand-700 font-bold tracking-widest uppercase">Operator Console</p>
          </div>
          <button onClick={() => setIsMobileOpen(false)} className="lg:hidden p-2 text-gray-400 hover:bg-gray-50 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto flex flex-col">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 px-3">Main Navigation</div>

          <div className="flex-1 space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`tour-${tab.id}`}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setIsMobileOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold text-sm ${
                    isSelected
                      ? 'bg-brand-50 text-brand-700 shadow-sm'
                      : 'text-gray-500 hover:bg-brand-50 hover:text-brand-800'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isSelected ? 'text-brand-700' : 'text-gray-400'}`} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="pt-4 mt-4 border-t border-gray-100 space-y-1">
            {/* Back to Client Site */}
            <a
              href="/"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold text-sm text-brand-700 hover:bg-brand-50 border border-brand-100/50 bg-brand-50/50"
            >
              <ExternalLink className="w-5 h-5 text-brand-600" />
              Booking Portal
            </a>

            <button
              onClick={onSignOut}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-500 font-semibold hover:bg-red-50 rounded-xl transition-all text-sm"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        </nav>
      </aside>
    </>
  );
}
