"use client";

import React from "react";
import { MapPin } from "lucide-react";
import { ScheduleCard } from "@/components/ScheduleCard";

export default function RecommendedSchedules({ recommendedSchedules, userCity, handleBooking }: any) {
  if (!recommendedSchedules || recommendedSchedules.length === 0) return null;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-teal-100 text-teal-600">
          <MapPin className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-xl font-black text-gray-900 tracking-tight">Recommended for You</h3>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            Departing from {userCity}
          </p>
        </div>
        <div className="h-px bg-gray-100 flex-1 ml-4" />
      </div>

      <div className="flex gap-6 overflow-x-auto pb-6 px-1 snap-x snap-mandatory scroll-smooth scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
        {recommendedSchedules.map((schedule: any) => (
          <div key={`rec-${schedule.id}`} className="snap-start shrink-0 w-[85vw] sm:w-[350px] md:w-[400px]">
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
}
