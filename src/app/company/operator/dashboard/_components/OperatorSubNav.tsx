'use client';

import React from 'react';
import { OperatorCategory } from '../_lib/constants';

interface OperatorSubNavProps {
  tabs: OperatorCategory[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export default function OperatorSubNav({ tabs, activeTab, onTabChange }: OperatorSubNavProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
      <nav className="flex divide-x divide-gray-100">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              id={`tour-${tab.id}`}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 py-4 px-4 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
                isActive 
                  ? 'bg-indigo-50 text-indigo-700' 
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-gray-400'}`} />
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
