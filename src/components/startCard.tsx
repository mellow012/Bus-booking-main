import { type LucideIcon } from 'lucide-react';
import React from 'react';

// Define the props for the component
interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon; // Pass the actual icon component (e.g., Building2)
  color?: string;   // Optional color prop for customization
}

const StatCard = ({ title, value, icon: Icon, color = 'blue' }: StatCardProps) => {
  // 'Icon' is the component passed via props, rendered directly
  return (
    <div className="bg-white p-5 shadow-sm rounded-xl border border-gray-100">
      <div className="flex items-center justify-between">
        <div>
          <p className="mb-1 text-sm font-medium text-gray-500 truncate">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
        </div>
        <div className={`p-3 rounded-full bg-${color}-50`}>
          <Icon className={`w-6 h-6 text-${color}-600`} />
        </div>
      </div>
    </div>
  );
};

export default StatCard;