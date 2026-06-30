'use client';

import { X, ChevronRight, ChevronLeft, LogOut, Bus as BusIcon, Eye } from 'lucide-react';
import Link from 'next/link';
import { Company } from '@/types';
import { CATEGORIES, CategoryType } from '../_lib/constants';

interface SidebarProps {
  activeCategory:    CategoryType;
  setActiveCategory: (cat: CategoryType) => void;
  isMobileOpen:      boolean;
  setIsMobileOpen:   (open: boolean) => void;
  company:           Company | null;
  onSignOut:         () => void;
  isCollapsed:       boolean;
  onToggleCollapse:  () => void;
  statistics:        {
    pendingBookings:  number;
    missedSchedules:  number;
    newPayments:      number;
    pendingReports:   number;
  };
}

export default function DashboardSidebar({
  activeCategory, setActiveCategory,
  isMobileOpen, setIsMobileOpen,
  company, onSignOut,
  isCollapsed, onToggleCollapse,
  statistics,
}: SidebarProps) {
  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden backdrop-blur-sm animate-in fade-in duration-300"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed left-0 z-50 bg-white border-r border-gray-100 transition-all duration-500 ease-in-out top-0 h-screen overflow-hidden flex flex-col shadow-premium
          ${isMobileOpen ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0'}
          ${!isMobileOpen && (isCollapsed ? 'lg:w-[72px]' : 'lg:w-72')}`}
      >
        {/* Header */}
        <div className={`flex items-center p-6 mb-2 ${isCollapsed && !isMobileOpen ? 'justify-center border-b border-gray-50' : 'justify-between'}`}>
          {(!isCollapsed || isMobileOpen) ? (
            <div className="flex items-center space-x-3 overflow-hidden animate-in fade-in duration-300">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-100">
                <BusIcon className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="font-bold text-indigo-900 text-[15px] leading-tight truncate">
                  {company?.name || 'Kinetic Admin'}
                </h1>
                <p className="text-[10px] text-gray-400 font-bold tracking-wider uppercase">Platform</p>
              </div>
            </div>
          ) : (
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-100 animate-in zoom-in duration-300">
              <BusIcon className="w-5 h-5 text-white" />
            </div>
          )}

          <button
            onClick={onToggleCollapse}
            id="tour-sidebar-toggle"
            className={`hidden lg:flex p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors ${isCollapsed ? 'absolute -right-3 top-12 bg-white border border-gray-100 shadow-sm z-10' : ''}`}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          <button onClick={() => setIsMobileOpen(false)} className="lg:hidden p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto pt-2 space-y-1 px-3">
          {CATEGORIES.map((cat) => {
            const Icon       = cat.icon;
            const isActive   = activeCategory === cat.id;
            const showLabel  = !isCollapsed || isMobileOpen;

            return (
              <button
                key={cat.id}
                id={`tour-${cat.id}`}
                onClick={() => { setActiveCategory(cat.id); setIsMobileOpen(false); }}
                className={`w-full flex items-center group transition-all duration-200 relative rounded-2xl h-12
                  ${isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-[1.02]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}
                  ${isCollapsed && !isMobileOpen ? 'justify-center px-0' : 'px-4 space-x-3'}`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'group-hover:text-indigo-600 text-gray-400'}`} />

                {showLabel && (
                  <span className="text-[13px] font-bold flex-1 text-left truncate animate-in slide-in-from-left-2 duration-300">
                    {cat.label}
                  </span>
                )}

                {showLabel && cat.id === 'sales' && (statistics.pendingBookings > 0 || statistics.newPayments > 0) && (
                  <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full border-2 border-white">
                    {statistics.pendingBookings + statistics.newPayments}
                  </span>
                )}

                {showLabel && cat.id === 'regions' && statistics.missedSchedules > 0 && (
                  <span className="bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full border-2 border-white">
                    {statistics.missedSchedules}
                  </span>
                )}

                {showLabel && cat.id === 'sales' && statistics.pendingReports > 0 && (
                  <span className="absolute -right-1 -top-1 w-2 h-2 bg-indigo-400 rounded-full border border-white" />
                )}

                {/* Tooltip for collapsed state */}
                {isCollapsed && !isMobileOpen && (
                  <div className="absolute left-[72px] top-1/2 -translate-y-1/2 bg-gray-900 text-white text-[11px] font-bold py-1.5 px-3 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                    {cat.label}
                    <div className="absolute left-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 bg-gray-900 rotate-45" />
                  </div>
                )}
              </button>
            );
          })}

          {/* Operator View */}
          <div className="pt-3 mt-3 border-t border-gray-50">
            <Link
              href="/company/operator/dashboard"
              className={`w-full flex items-center group transition-all duration-200 relative rounded-xl h-11 text-indigo-600 hover:bg-indigo-50
                ${isCollapsed && !isMobileOpen ? 'justify-center px-0' : 'px-4 space-x-3'}`}
            >
              <Eye className="w-5 h-5 flex-shrink-0 group-hover:scale-110 transition-transform" />
              {(!isCollapsed || isMobileOpen) && (
                <span className="text-[13px] font-bold animate-in slide-in-from-left-2 duration-300">Operator View</span>
              )}
              {isCollapsed && !isMobileOpen && (
                <div className="absolute left-[72px] top-1/2 -translate-y-1/2 bg-indigo-600 text-white text-[11px] font-bold py-1.5 px-3 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                  Operator View
                  <div className="absolute left-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 bg-indigo-600 rotate-45" />
                </div>
              )}
            </Link>
          </div>

          {/* Sign Out */}
          <div className="pt-4 mt-4 border-t border-gray-50 flex flex-col gap-1">
            <button
              onClick={onSignOut}
              className={`w-full flex items-center group transition-all duration-200 relative rounded-xl h-11 text-red-500 hover:bg-red-50
                ${isCollapsed && !isMobileOpen ? 'justify-center px-0' : 'px-4 space-x-3'}`}
            >
              <LogOut className="w-5 h-5 flex-shrink-0 group-hover:scale-110 transition-transform" />
              {(!isCollapsed || isMobileOpen) && (
                <span className="text-[13px] font-bold animate-in slide-in-from-left-2 duration-300">Sign Out</span>
              )}
              {isCollapsed && !isMobileOpen && (
                <div className="absolute left-[72px] top-1/2 -translate-y-1/2 bg-red-600 text-white text-[11px] font-bold py-1.5 px-3 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                  Sign Out
                  <div className="absolute left-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 bg-red-600 rotate-45" />
                </div>
              )}
            </button>
          </div>
        </nav>

        {/* Mini Profile */}
        {(!isCollapsed || isMobileOpen) && (
          <div className="p-4 bg-gray-50/50 m-3 rounded-2xl animate-in fade-in duration-500">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-[11px] font-black text-white">
                {company?.name?.[0] || 'K'}
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-gray-900 truncate">V.1.0 Stable</p>
                <div className="flex items-center gap-1 justify-between w-full">
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <p className="text-[10px] font-bold text-gray-500">Live</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
