import React from 'react';

type StatNode = { label: string; value: number; key: string; Icon?: React.ComponentType<any> };

export const BookingStatsGrid: React.FC<{ cards: StatNode[] }> = ({ cards }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-4">
      {cards.map((c) => (
        <div key={c.key} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white">
            {c.Icon ? <c.Icon className="w-6 h-6" /> : <span className="font-bold">{String(c.label).charAt(0)}</span>}
          </div>
          <div className="min-w-0">
            <div className="text-sm text-gray-500">{c.label}</div>
            <div className="text-lg font-bold text-gray-900">{c.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default BookingStatsGrid;
