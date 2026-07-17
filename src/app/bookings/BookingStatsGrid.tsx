import React from 'react';

type StatNode = { label: string; value: number; key: string; Icon?: React.ComponentType<any> };

interface BookingStatsGridProps {
  cards: StatNode[];
  activeFilter?: string;
  onCardClick?: (key: string) => void;
}

export const BookingStatsGrid: React.FC<BookingStatsGridProps> = ({ cards, activeFilter, onCardClick }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
      {cards.map((c) => {
        const isActive = activeFilter === c.key;
        return (
          <button
            key={c.key}
            onClick={() => onCardClick?.(c.key)}
            className={`text-left rounded-2xl p-4 shadow-sm border transition-all duration-300 flex items-center gap-3 w-full hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-brand-700/40 ${
              isActive
                ? 'bg-gradient-to-br from-brand-700/10 to-brand-800/10 border-brand-700/30 ring-2 ring-brand-700/20 shadow-md'
                : 'bg-white border-gray-100 hover:border-gray-300 hover:shadow-md'
            }`}
          >
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm transition-all duration-300 ${
                isActive
                  ? 'bg-gradient-to-br from-brand-700 to-brand-800 scale-105'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {c.Icon ? (
                <c.Icon className="w-6 h-6" />
              ) : (
                <span className="font-bold text-lg">{String(c.label).charAt(0)}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider truncate">{c.label}</div>
              <div className="text-2xl font-bold text-gray-900 mt-0.5 leading-none">{c.value}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default BookingStatsGrid;
