import { type LucideIcon } from 'lucide-react';
import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'yellow' | 'teal' | 'indigo';
  trend?: {
    value: number;
    label: string;
  };
  subtitle?: string;
  onClick?: () => void;
}

const colorVariants = {
  blue: {
    bg: 'bg-blue-50',
    icon: 'text-blue-600',
    text: 'text-blue-600',
  },
  green: {
    bg: 'bg-green-50',
    icon: 'text-green-600',
    text: 'text-green-600',
  },
  purple: {
    bg: 'bg-purple-50',
    icon: 'text-purple-600',
    text: 'text-purple-600',
  },
  orange: {
    bg: 'bg-orange-50',
    icon: 'text-orange-600',
    text: 'text-orange-600',
  },
  red: {
    bg: 'bg-red-50',
    icon: 'text-red-600',
    text: 'text-red-600',
  },
  yellow: {
    bg: 'bg-yellow-50',
    icon: 'text-yellow-600',
    text: 'text-yellow-600',
  },
  teal: {
    bg: 'bg-teal-50',
    icon: 'text-teal-600',
    text: 'text-teal-600',
  },
  indigo: {
    bg: 'bg-indigo-50',
    icon: 'text-indigo-600',
    text: 'text-indigo-600',
  },
} as const;

const StatCard = ({ 
  title, 
  value, 
  icon: Icon, 
  color = 'blue',
  trend,
  subtitle,
  onClick
}: StatCardProps) => {
  const colors = colorVariants[color];

  return (
    <div 
      className={`bg-white p-6 shadow-sm rounded-xl border border-gray-100 transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:shadow-md hover:border-gray-200' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-2">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
          
          {trend && (
            <div className="flex items-center mt-2">
              <span className={`text-sm font-medium ${
                trend.value > 0 ? 'text-green-600' : trend.value < 0 ? 'text-red-600' : 'text-gray-600'
              }`}>
                {trend.value > 0 ? '↑' : trend.value < 0 ? '↓' : '→'} {Math.abs(trend.value)}%
              </span>
              <span className="text-sm text-gray-500 ml-2">{trend.label}</span>
            </div>
          )}
          
          {subtitle && !trend && (
            <p className={`text-sm font-medium mt-2 ${colors.text}`}>
              {subtitle}
            </p>
          )}
        </div>
        
        <div className={`p-4 ${colors.bg} rounded-full`}>
          <Icon className={`w-7 h-7 ${colors.icon}`} />
        </div>
      </div>
    </div>
  );
};

export default StatCard;