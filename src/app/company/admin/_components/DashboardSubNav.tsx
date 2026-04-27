'use client';

import { TABS, TabType, TabObject } from '../_lib/constants';

interface SubNavProps {
  activeTab:     TabType;
  setActiveTab:  (tab: TabType) => void;
  subTabs:       readonly TabType[];
  availableTabs: TabObject[];
  statistics: {
    pendingBookings: number;
    newPayments:     number;
    pendingReports:  number;
  };
}

export default function DashboardSubNav({
  activeTab, setActiveTab, subTabs, availableTabs, statistics,
}: SubNavProps) {
  const filteredTabs = availableTabs.filter(t => subTabs.includes(t.id));

  if (filteredTabs.length <= 1) return null;

  return (
    <div className="bg-white border-b border-gray-100 px-6 py-1 sticky top-[61px] z-20 overflow-x-auto no-scrollbar">
      <nav className="flex items-center space-x-6 sm:space-x-8 min-w-max">
        {filteredTabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 text-[13px] font-bold border-b-2 transition-all relative
                ${isActive
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200'}`}
              style={isActive ? { borderColor: 'var(--brand-primary)', color: 'var(--brand-primary)' } : {}}
            >
              <div className="flex items-center gap-1.5">
                {tab.label}
                {tab.id === 'bookings' && statistics.pendingBookings > 0 && (
                  <span className="w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                    {statistics.pendingBookings}
                  </span>
                )}
                {tab.id === 'payments' && statistics.newPayments > 0 && (
                  <span className="w-4 h-4 bg-green-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                    {statistics.newPayments}
                  </span>
                )}
                {tab.id === 'reports' && statistics.pendingReports > 0 && (
                  <span className="w-2 h-2 bg-indigo-400 rounded-full" />
                )}
              </div>
              {isActive && (
                <span
                  className="absolute -bottom-[2px] left-0 right-0 h-[2px] bg-brand-primary rounded-full"
                  style={{ backgroundColor: 'var(--brand-primary)' }}
                />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
