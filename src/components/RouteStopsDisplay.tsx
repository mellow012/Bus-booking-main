import React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';

export interface RouteStopDisplayItem {
  id?: string;
  name: string;
  stage?: 'passed' | 'current' | 'upcoming' | 'default';
  coords?: [number, number] | null;
}

export interface RouteStopsDisplayProps {
  stops: RouteStopDisplayItem[];
  onStopClick?: (stop: RouteStopDisplayItem) => void;
  className?: string;
}

export function RouteStopsDisplay({ stops, onStopClick, className = '' }: RouteStopsDisplayProps) {
  if (!stops || stops.length === 0) return null;

  return (
    <div className={`w-full overflow-x-auto scrollbar-hide ${className}`}>
      <div className="mx-auto flex min-w-max items-start justify-center px-4 py-4">
        {stops.map((stop, i) => {
          const isLast = i === stops.length - 1;
          return (
            <div
              key={stop.id || stop.name || i}
              className={`relative flex w-32 shrink-0 justify-center ${onStopClick ? 'group cursor-pointer' : ''}`}
              onClick={() => onStopClick && onStopClick(stop)}
            >
              <div className="flex w-full flex-col items-center">
                <div className="relative z-10 bg-white">
                {stop.stage === 'passed' ? (
                  <CheckCircle2 className="w-5 h-5 text-gray-400" />
                ) : stop.stage === 'current' ? (
                  <div className="relative">
                    <Circle className="w-5 h-5 text-brand-600 fill-brand-600 relative z-10" />
                    <div className="absolute inset-0 bg-brand-600 rounded-full animate-ping opacity-30"></div>
                  </div>
                ) : stop.stage === 'default' ? (
                  <div className="w-5 h-5 flex items-center justify-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-brand-600" />
                  </div>
                ) : (
                  <Circle className="w-5 h-5 text-gray-300" />
                )}
                </div>
                <div className="mt-1 flex flex-col items-center">
                  <p className={`w-28 break-words text-center text-xs leading-tight ${
                    stop.stage === 'current'
                      ? 'font-bold text-brand-700'
                      : stop.stage === 'passed'
                        ? 'font-medium text-gray-500'
                        : stop.stage === 'default'
                          ? (i === 0 || isLast ? 'font-bold text-gray-900' : 'font-medium text-gray-700')
                          : 'font-medium text-gray-700'
                  }`}>
                    {stop.name}
                  </p>
                  {stop.stage === 'default' && i === 0 && (
                    <span className="mt-1 rounded-md border border-green-200 bg-green-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase leading-none tracking-wider text-green-600">Pick-up</span>
                  )}
                  {stop.stage === 'default' && isLast && (
                    <span className="mt-1 rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase leading-none tracking-wider text-red-600">Drop-off</span>
                  )}
                </div>
              </div>
              {!isLast && (
                <div className={`absolute left-1/2 top-[25px] h-[3px] w-32 rounded-full ${stop.stage === 'passed' ? 'bg-gray-300' : 'bg-gray-200'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
