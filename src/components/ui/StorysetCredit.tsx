'use client';

import React, { useState, useRef, useEffect } from 'react';

interface StorysetCreditProps {
  href: string;
  label: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export default function StorysetCredit({
  href,
  label,
  placement = 'top',
  className = '',
}: StorysetCreditProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setVisible(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [visible]);

  const placementClasses: Record<string, string> = {
    top:    'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full  left-1/2 -translate-x-1/2 mt-2',
    left:   'right-full top-1/2 -translate-y-1/2 mr-2',
    right:  'left-full  top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div ref={ref} className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        aria-label="Illustration attribution"
        aria-expanded={visible}
        onClick={() => setVisible(v => !v)}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        className="w-4 h-4 flex items-center justify-center rounded-full text-[10px] leading-none
                   text-gray-300 hover:text-gray-400 focus:outline-none
                   transition-colors duration-200 select-none cursor-pointer"
      >
        ⓘ
      </button>

      {visible && (
        <div
          role="tooltip"
          className={`absolute z-50 pointer-events-auto whitespace-nowrap
                      ${placementClasses[placement]}
                      bg-gray-800/80 backdrop-blur-sm text-white/80
                      text-[10px] rounded-md px-2.5 py-1.5 shadow-lg`}
        >
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-2 hover:underline hover:text-white transition-colors"
            onClick={e => e.stopPropagation()}
          >
            {label}
          </a>
        </div>
      )}
    </div>
  );
}
