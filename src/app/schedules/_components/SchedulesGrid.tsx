"use client";

import React from "react";
import { Zap, Clock } from "lucide-react";
import { ScheduleCard } from "@/components/ScheduleCard";
import { getScheduleCategory } from "@/utils/homeHelpers";

const categories = ['Boarding Now', 'Morning', 'Afternoon', 'Evening'];

export default function SchedulesGrid({ regularSchedules, selectedCategory, setSelectedCategory, handleBooking, userCity }: any) {
  return (
    <>
      {categories.map((cat) => {
        const items = regularSchedules.filter((s: any) => getScheduleCategory(s as any) === cat);
        if (selectedCategory && selectedCategory !== cat) return null;
        if (items.length === 0) return null;

        return (
          <div key={cat} className="space-y-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${cat === 'Boarding Now' ? 'bg-orange-100 text-orange-600 animate-pulse' :
                cat === 'Morning' ? 'bg-brand-50 text-brand-700' :
                  cat === 'Afternoon' ? 'bg-amber-100 text-amber-600' :
                    'bg-coral-50 text-coral-600'
                }`}>
                {cat === 'Boarding Now' ? <Zap className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight">{cat}</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {items.length} {items.length === 1 ? 'Bus' : 'Buses'} Available
                </p>
              </div>
              <div className="h-px bg-gray-100 flex-1 ml-4" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((schedule: any) => (
                <div key={schedule.id} className="snap-start shrink-0">
                  <ScheduleCard 
                    s={schedule as any} 
                    userCity={userCity} 
                    onBook={() => handleBooking(schedule.id, schedule.companyId, schedule.routeId)} 
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
