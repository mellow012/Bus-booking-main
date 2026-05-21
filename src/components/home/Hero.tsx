import React from "react";
import { Zap, CheckCircle, Shield, Users, Search, Play, Bus as BusIcon, Navigation } from "lucide-react";
import Image from "next/image";
import { TourButton } from "./TourButton";

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

      <div className="relative max-w-7xl mx-auto p-container pt-16 sm:pt-20 lg:pt-24 pb-16 sm:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-10 items-center">
          {/* Left: copy */}
          <div className="anim-fade-up text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 border border-blue-400/30 text-blue-300 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-4">
              <Zap className="w-3 h-3"/> Malawi&apos;s #1 Platform
            </div>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-[1.1] tracking-tight mb-4 sm:mb-5">
              Travel Anywhere<br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">
                in Malawi
              </span>
            </h1>
            <p className="text-slate-400 text-sm sm:text-base leading-relaxed mb-6 sm:mb-8 max-w-md mx-auto lg:mx-0">
              Find, compare and book bus seats instantly. Real-time availability, secure payments, and routes across the entire country.
            </p>
            {/* Trust badges */}
            <div className="flex justify-center lg:justify-start flex-wrap gap-3 sm:gap-5 mb-6 sm:mb-8">
              {[
                { icon: CheckCircle, label: "Instant Booking", col: "text-emerald-400" },
                { icon: Shield,      label: "Secure Payment",  col: "text-blue-400" },
                { icon: Users,       label: "24/7 Support",    col: "text-indigo-400" },
              ].map(({ icon: Icon, label, col }) => (
                <div key={label} className="flex items-center gap-1.5 sm:gap-2 text-slate-400">
                  <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${col}`}/>
                  <span className="text-xs sm:text-sm font-medium">{label}</span>
                </div>
              ))}
            </div>
            {/* CTA buttons */}
            <div className="flex flex-col xs:flex-row justify-center lg:justify-start gap-3">
              <a href="#schedules-section"
                className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-blue-900/40 text-sm sm:text-base">
                <Search className="w-4 h-4"/> Find Your Journey
              </a>
              <TourButton />
            </div>
          </div>

          {/* Right: illustration */}
          <div className="relative flex justify-center anim-fade-up delay-200">
            <div className="relative w-full max-w-[280px] sm:max-w-sm lg:max-w-md">
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
      </div>
    </section>
  );
}
