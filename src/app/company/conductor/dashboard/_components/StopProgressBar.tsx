'use client';

import React, { FC, useRef, useEffect } from 'react';
import { TripStop } from '@/types';

interface StopProgressBarProps {
  stopSequence: TripStop[];
  currentIdx: number;
  departedStops: string[];
  inTransit?: boolean;
}

const StopProgressBar: FC<StopProgressBarProps> = ({
  stopSequence, currentIdx, departedStops, inTransit = false,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the current stop
  useEffect(() => {
    if (currentRef.current && scrollRef.current) {
      currentRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [currentIdx]);

  return (
    <div ref={scrollRef} className="flex items-center gap-1.5 overflow-x-auto pb-2 hide-scrollbar">
      {stopSequence.map((stop, i) => {
        const departed = departedStops.includes(stop.id);
        const isCurrent = i === currentIdx;
        return (
          <div 
            key={stop.id} 
            className="flex items-center gap-1.5 shrink-0"
            ref={isCurrent ? currentRef : undefined}
          >
            <div className="flex flex-col items-center gap-1">
              <div className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${
                departed
                  ? 'bg-green-500 border-green-600'
                  : isCurrent && !inTransit
                    ? 'bg-blue-500 border-blue-600 scale-125 ring-4 ring-blue-100'
                    : isCurrent && inTransit
                      ? 'bg-blue-300 border-blue-400 animate-pulse'
                      : 'bg-gray-200 border-gray-300'
              }`} />
              <p className={`text-[11px] max-w-[64px] text-center leading-tight font-medium ${
                departed ? 'text-green-700' : isCurrent ? 'text-blue-700 font-bold' : 'text-gray-400'
              }`}>
                {stop.name}
              </p>
            </div>
            {i < stopSequence.length - 1 && (
              <div className={`w-8 h-1 rounded-full mb-5 transition-all ${departed ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default StopProgressBar;
