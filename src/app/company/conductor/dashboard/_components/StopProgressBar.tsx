'use client';

import React, { FC } from 'react';
import { TripStop } from '@/types';

interface StopProgressBarProps {
  stopSequence: TripStop[];
  currentIdx: number;
  departedStops: string[];
  inTransit?: boolean;
}

const StopProgressBar: FC<StopProgressBarProps> = ({
  stopSequence, currentIdx, departedStops, inTransit = false,
}) => (
  <div className="flex items-center gap-1 overflow-x-auto pb-1">
    {stopSequence.map((stop, i) => {
      const departed = departedStops.includes(stop.id);
      const isCurrent = i === currentIdx;
      return (
        <div key={stop.id} className="flex items-center gap-1 shrink-0">
          <div className="flex flex-col items-center gap-0.5">
            <div className={`w-3 h-3 rounded-full border-2 transition-all ${
              departed
                ? 'bg-green-500 border-green-600'
                : isCurrent && !inTransit
                  ? 'bg-blue-500 border-blue-600 scale-125'
                  : isCurrent && inTransit
                    ? 'bg-blue-300 border-blue-400'
                    : 'bg-gray-200 border-gray-300'
            }`} />
            <p className={`text-[9px] max-w-[52px] text-center leading-tight ${
              departed ? 'text-green-700 font-medium' : isCurrent ? 'text-blue-700 font-semibold' : 'text-gray-400'
            }`}>
              {stop.name}
            </p>
          </div>
          {i < stopSequence.length - 1 && (
            <div className={`w-5 h-0.5 mb-3 transition-all ${departed ? 'bg-green-400' : 'bg-gray-200'}`} />
          )}
        </div>
      );
    })}
  </div>
);

export default StopProgressBar;
