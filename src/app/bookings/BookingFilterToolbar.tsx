import React from 'react';
import { Bus as BusIcon, Clock, CheckCircle, XCircle, Calendar } from 'lucide-react';

export type FilterToolbarProps = {
  activeFilter: string;
  onStatusChange: (s: string) => void;
  counts: { all: number; pending: number; confirmed: number; cancelled: number; upcoming: number };
};

export const BookingFilterToolbar: React.FC<FilterToolbarProps> = ({ activeFilter, onStatusChange, counts }) => {
  const nodes = [
    { key: 'all', label: 'All', Icon: BusIcon, count: counts.all },
    { key: 'pending', label: 'Pending', Icon: Clock, count: counts.pending },
    { key: 'confirmed', label: 'Confirmed', Icon: CheckCircle, count: counts.confirmed },
    { key: 'upcoming', label: 'Upcoming', Icon: Calendar, count: counts.upcoming },
    { key: 'cancelled', label: 'Cancelled', Icon: XCircle, count: counts.cancelled },
  ];

  return (
    <div className="flex gap-1 p-1 bg-gray-100 rounded-xl overflow-x-auto w-full">
      {nodes.map(({ key, label, Icon, count }) => (
        <button
          key={key}
          onClick={() => onStatusChange(key)}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap ${activeFilter === key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <span>{label}</span>
          {count > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeFilter === key ? 'bg-gray-100' : 'bg-gray-200 text-gray-500'}`}>{count}</span>}
        </button>
      ))}
    </div>
  );
};

export default BookingFilterToolbar;
