'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, description }) => {
  return (
    <div className="bg-white shadow-sm rounded-lg p-5 border border-gray-200/50">
      <div className="flex items-center">
        <div className="flex-shrink-0 bg-indigo-500 rounded-md p-3">
          <Icon className="h-6 w-6 text-white" aria-hidden="true" />
        </div>
        <div className="ml-5 w-0 flex-1">
          <dl>
            <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
            <dd>
              <div className="text-2xl font-bold text-gray-900">{value}</div>
              {description && <div className="text-sm text-gray-500">{description}</div>}
            </dd>
          </dl>
        </div>
      </div>
    </div>
  );
};

export default StatCard;