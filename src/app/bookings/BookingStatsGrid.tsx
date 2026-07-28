import React, { useRef, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type StatNode = { label: string; value: number; key: string; Icon?: React.ComponentType<any> };

interface BookingStatsGridProps {
  cards: StatNode[];
  activeFilter?: string;
  onCardClick?: (key: string) => void;
}

export const BookingStatsGrid: React.FC<BookingStatsGridProps> = ({ cards, activeFilter, onCardClick }) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScrollState = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft: sl, scrollWidth: sw, clientWidth: cw } = scrollRef.current;
    setCanScrollLeft(sl > 5);
    setCanScrollRight(sl + cw < sw - 5);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsMouseDown(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleMouseLeaveOrUp = () => {
    setIsMouseDown(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    scrollRef.current.scrollLeft = scrollLeft - walk;
    updateScrollState();
  };

  const scrollByAmount = (amount: number) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    setTimeout(updateScrollState, 300);
  };

  return (
    <div className="relative w-full group">
      {/* Scroll indicator chevrons (desktop hover) */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollByAmount(-200)}
          className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/90 shadow-md border border-gray-200 items-center justify-center text-gray-600 hover:text-brand-700 hover:scale-105 transition"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollByAmount(200)}
          className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/90 shadow-md border border-gray-200 items-center justify-center text-gray-600 hover:text-brand-700 hover:scale-105 transition"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Slidable Pill Track */}
      <div
        ref={scrollRef}
        onScroll={updateScrollState}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeaveOrUp}
        onMouseUp={handleMouseLeaveOrUp}
        onMouseMove={handleMouseMove}
        className={`w-full overflow-x-auto scrollbar-none py-2 px-1 flex items-center gap-2.5 touch-pan-x snap-x snap-mandatory scroll-smooth ${
          isMouseDown ? 'cursor-grabbing select-none' : 'cursor-grab'
        }`}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {cards.map((c) => {
          const isActive = activeFilter === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => onCardClick?.(c.key)}
              className={`snap-start shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 select-none whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-brand-700/40 active:scale-95 ${
                isActive
                  ? 'bg-brand-700 text-white shadow-md ring-1 ring-brand-800 scale-[1.02]'
                  : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 shadow-sm'
              }`}
            >
              {c.Icon && (
                <c.Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${isActive ? 'text-white' : 'text-gray-500'}`} />
              )}
              <span>{c.label}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                  isActive ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {c.value}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BookingStatsGrid;
