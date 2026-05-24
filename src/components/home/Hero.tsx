import React from "react";
import Image from "next/image";
import { CheckCircle, Bus as BusIcon } from "lucide-react";
import { AutoTour } from "./AutoTour";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 pt-16">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-blue-500/10 blur-3xl"/>
        <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] rounded-full bg-indigo-500/10 blur-3xl"/>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-blue-600/5 blur-3xl"/>
        {/* Grid lines */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)"/>
        </svg>
      </div>

      <div className="relative max-w-7xl mx-auto p-container pt-12 sm:pt-16 lg:pt-20 pb-20 sm:pb-32 lg:pb-40 flex justify-center">
        {/* Illustration only */}
        <div className="relative flex justify-center anim-fade-up delay-200">
          <div className="relative w-full max-w-[420px] sm:max-w-lg lg:max-w-2xl">
            <Image src="/Bus driver-rafiki.svg" alt="Bus illustration"
              width={500} height={500}
              className="w-full h-auto drop-shadow-2xl"
              style={{ filter: "hue-rotate(15deg) saturate(1.1) brightness(1.05)" }} />
            {/* Floating badges */}
            <div className="absolute top-2 -right-2 sm:top-4 sm:-right-4 bg-white rounded-2xl shadow-xl px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-2 sm:gap-2.5 anim-scale-in delay-300">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600"/>
              </div>
              <div><p className="text-[10px] sm:text-xs text-gray-500">Instant confirm</p><p className="text-xs sm:text-sm font-bold text-gray-900">Booked!</p></div>
            </div>
            <div className="absolute -bottom-1 -left-2 sm:-bottom-2 sm:-left-4 bg-white rounded-2xl shadow-xl px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-2 sm:gap-2.5 anim-scale-in delay-400">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                <BusIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600"/>
              </div>
              <div><p className="text-[10px] sm:text-xs text-gray-500">Routes available</p><p className="text-xs sm:text-sm font-bold text-gray-900">20+ Routes</p></div>
            </div>
          </div>
        </div>
      </div>

      {/* Auto-trigger tour for new users */}
      <AutoTour />
    </section>
  );
}
