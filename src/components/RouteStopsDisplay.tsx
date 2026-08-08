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

  const currentStopIndex = stops.findIndex((s) => s.stage === 'current');
  const hasCurrent = currentStopIndex !== -1;

  return (
    <div className={`w-full overflow-x-auto scrollbar-hide ${className}`}>
      <div className="flex items-start justify-start min-w-max px-2 py-4 mx-auto gap-0">
      {/* "Current" pill — first item in the row, before the origin stop */}
      {hasCurrent && (
        <>
          <div className="flex flex-col items-center mr-1">
            <span className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-brand-600 text-white leading-none whitespace-nowrap">
              Current
            </span>
          </div>
          {/* Connector from tag to first stop */}
          <div className="w-4 h-[2px] bg-brand-200 shrink-0" />
        </>
      )}

      {stops.map((stop, i) => {
        const isLast = i === stops.length - 1;
        return (
          <div 
            key={stop.id || stop.name || i} 
            className={`flex items-center ${onStopClick ? 'group cursor-pointer' : ''}`}
            onClick={() => onStopClick && onStopClick(stop)}
          >
            <div className="flex flex-col items-center relative">
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
              <div className="flex flex-col items-center mt-1">
                <p className={`text-xs text-center w-24 break-words leading-tight ${
                  stop.stage === 'current' 
                    ? 'font-bold text-brand-700' 
                    : stop.stage === 'passed' 
                      ? 'text-gray-500 font-medium' 
                      : stop.stage === 'default' 
                        ? (i === 0 || isLast ? 'font-bold text-gray-900' : 'font-medium text-gray-700')
                        : 'text-gray-700 font-medium'
                }`}>
                  {stop.name}
                </p>
                {stop.stage === 'default' && i === 0 && (
                  <span className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-md leading-none">Pick-up</span>
                )}
                {stop.stage === 'default' && isLast && (
                  <span className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-md leading-none">Drop-off</span>
                )}
              </div>
            </div>
            {!isLast && (
              <div className={`w-12 sm:w-16 h-[2px] mx-1 -translate-y-[10px] ${stop.stage === 'passed' ? 'bg-gray-300' : 'bg-gray-100'}`} />
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}
