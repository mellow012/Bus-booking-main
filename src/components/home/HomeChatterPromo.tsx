import React from 'react';
import Link from 'next/link';
import { Bus, CalendarClock, ArrowRight, ClipboardList } from 'lucide-react';

export default function HomeChatterPromo() {
  return (
    <section className="bg-slate-50 py-16 sm:py-24 overflow-hidden relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div
          className="rounded-[2rem] overflow-hidden shadow-xl lg:flex"
          style={{ background: 'linear-gradient(135deg, #005A5B 0%, #007B7C 50%, #009091 100%)' }}
        >
          {/* Left side: Information and Copy */}
          <div className="p-8 sm:p-12 lg:w-1/2 flex flex-col justify-center"
            style={{ background: 'transparent' }}
          >
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4 leading-tight">
              Booking for a group? <br className="hidden sm:block"/> Try TibhukeBus Chatter
            </h2>
            <p className="text-brand-100 text-base sm:text-lg mb-8 max-w-xl leading-relaxed">
              Skip the hassle of coordinating payments and seats. Request a custom bus for your organization, event, or group trip. We match you with top-rated operators, and your passengers can easily book their own seats via a private link.
            </p>
            
            <div className="space-y-5">
              <div className="flex items-start">
                <div className="flex-shrink-0 mt-1">
                  <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-brand-800 text-brand-100 shadow-inner">
                    <Bus className="h-5 w-5" />
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-white font-bold text-sm sm:text-base">Custom Buses</h3>
                  <p className="text-brand-100 text-xs sm:text-sm mt-0.5">Get an entire bus dedicated to your route and schedule.</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0 mt-1">
                  <div className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-xl bg-brand-800 text-brand-100 shadow-inner">
                    <CalendarClock className="h-5 w-5" />
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-white font-bold text-sm sm:text-base">Flexible & Easy</h3>
                  <p className="text-brand-100 text-xs sm:text-sm mt-0.5">You set the terms, passengers pay individually. No more collecting cash.</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right side: Prominent Actions (Replaces old mockup card with clean solid buttons) */}
          <div className="lg:w-1/2 p-8 sm:p-12 flex flex-col justify-center gap-5 border-t lg:border-t-0 lg:border-l" style={{ background: 'rgba(0,0,0,0.12)', borderColor: 'rgba(255,255,255,0.12)' }}>
            <div>
              <span className="text-[10px] font-black text-coral-400 uppercase tracking-[0.25em] block mb-2">Get Started Now</span>
              <h3 className="text-lg font-bold text-white uppercase tracking-wider mb-2">Select Your Action</h3>
            </div>

            {/* Action 1: Request a Bus */}
            <Link 
              href="/chatter/request" 
              className="group relative bg-white hover:bg-brand-50 rounded-2xl p-5 shadow-md transition-all duration-200 flex items-center gap-4 active:scale-[0.99] text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-coral-50 hover:bg-coral-100 flex items-center justify-center text-coral-500 shrink-0">
                <Bus className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">Request a Bus</h4>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-coral-500 transition-all duration-200 group-hover:translate-x-1" />
                </div>
                <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed truncate">
                  Get quotes from platform operators.
                </p>
              </div>
            </Link>

            {/* Action 2: Manage Groups */}
            <Link 
              href="/chatter/my-schedules" 
              className="group relative rounded-2xl p-5 shadow-md transition-all duration-200 flex items-center gap-4 active:scale-[0.99] text-left" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: 'rgba(255,255,255,0.15)' }}>
                <ClipboardList className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-extrabold text-white uppercase tracking-wider">Manage Groups</h4>
                  <ArrowRight className="w-4 h-4 text-brand-400 group-hover:text-white transition-all duration-200 group-hover:translate-x-1" />
                </div>
                <p className="text-brand-200 text-[11px] mt-0.5 leading-relaxed truncate">
                  Track manifests, manifest downloads, and booking links.
                </p>
              </div>
            </Link>
          </div>

        </div>
      </div>
    </section>
  );
}
