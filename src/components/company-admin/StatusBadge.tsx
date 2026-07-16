import React from 'react';

type StatusBadgeProps = {
  status?: string | null;
};

const statusStyles: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  suspended: 'bg-red-100 text-red-800',
  invited: 'bg-yellow-100 text-yellow-800',
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const safeStatus = (status || 'active').toLowerCase();
  const label = safeStatus.charAt(0).toUpperCase() + safeStatus.slice(1);

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[safeStatus] || statusStyles.inactive}`}
    >
      {label}
    </span>
  );
}
