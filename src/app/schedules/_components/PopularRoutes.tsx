"use client";

import React from "react";
import { ChevronLeft, ChevronRight, Navigation, TrendingUp, ArrowRight } from "lucide-react";

export default function PopularRoutes({ popularRoutes, handlePopularRoutesScroll, setSearchFrom, setSearchTo, handleSearch }: any) {
  if (!popularRoutes || popularRoutes.length === 0) return null;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-orange-500" /> Popular Routes
        </h3>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Swipe to explore</p>
      </div>
      <div className="relative group/swiper">
        <button 
          onClick={() => handlePopularRoutesScroll('left')}
          className="absolute -left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 shadow-xl border border-gray-100 flex items-center justify-center text-gray-700 hover:bg-white hover:text-blue-600 hover:scale-105 active:scale-95 transition-all z-20 opacity-0 group-hover/swiper:opacity-100 hidden md:flex"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button 
          onClick={() => handlePopularRoutesScroll('right')}
          className="absolute -right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 shadow-xl border border-gray-100 flex items-center justify-center text-gray-700 hover:bg-white hover:text-blue-600 hover:scale-105 active:scale-95 transition-all z-20 opacity-0 group-hover/swiper:opacity-100 hidden md:flex"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        <div 
          className="flex gap-4 overflow-x-auto pb-4 scrollbar-none px-1 snap-x snap-mandatory scroll-smooth"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {popularRoutes.map((route: any, i: number) => (
            <button
              key={i}
              onClick={() => {
                setSearchFrom(route.from);
                setSearchTo(route.to);
                setTimeout(() => handleSearch(), 50);
              }}
              className="snap-start flex-shrink-0 w-64 bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all text-left group"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Navigation className="w-5 h-5" />
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Starting from</p>
                  <p className="text-sm font-black text-blue-600">MWK {route.price.toLocaleString()}</p>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <p className="text-sm font-bold text-gray-900 truncate">{route.from}</p>
                </div>
                <div className="w-px h-3 bg-gray-200 ml-[2.5px]" />
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                  <p className="text-sm font-bold text-gray-900 truncate">{route.to}</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
                <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded-lg uppercase tracking-widest">{route.busType}</span>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
