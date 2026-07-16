"use client";

import React from "react";
import { Users, CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function GroupBookingSection() {
  return (
    <section className="max-w-7xl mx-auto p-container m-section">
      <div className="relative bg-gradient-to-br from-brand-950 via-slate-900 to-brand-900 rounded-[2.5rem] overflow-hidden shadow-premium">
        {/* Background Patterns */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white rounded-full blur-3xl -mr-24 -mt-24" />
        </div>

        <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-8 items-center p-6 sm:p-10 lg:p-12">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 border border-white/20 text-white rounded-full text-[10px] font-bold uppercase tracking-widest mb-4">
              <Users className="w-3 h-3" /> Group Travel
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white leading-tight mb-4">
              Planning a trip for <span className="text-brand-300">your team?</span>
            </h2>
            <p className="text-brand-100/70 text-sm mb-6 leading-relaxed max-w-md">
              Whether it's a school trip, corporate event, or family gathering, we provide customized bus hire services across Malawi.
            </p>
            
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
              {[
                "Private Bus Hire",
                "Group Discounts",
                "Custom Pickups",
                "24/7 Support"
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-white/90 text-xs font-semibold">
                  <CheckCircle className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>

            <Link href="/groups">
              <Button className="h-11 px-6 bg-white text-brand-900 hover:bg-brand-50 font-bold rounded-xl text-sm shadow-lg group">
                Request Quote <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>

          <div className="relative hidden sm:block">
            <div className="aspect-video rounded-3xl overflow-hidden shadow-2xl">
               <img 
                 src="https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80&w=1000" 
                 alt="Group travel" 
                 className="w-full h-full object-cover"
               />
            </div>
            
            {/* Floating Stats */}
            <div className="absolute -bottom-4 -right-4 bg-white px-4 py-3 rounded-xl shadow-xl">
               <p className="text-[9px] font-black text-brand-700 uppercase tracking-widest mb-0.5">Groups Served</p>
               <p className="text-lg font-black text-gray-900 leading-none">500+</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
