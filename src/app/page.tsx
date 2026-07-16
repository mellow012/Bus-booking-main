import React from "react";
import { Hero } from "@/components/home/Hero";
import { Stats } from "@/components/home/Stats";
import HomeSearch from "@/components/home/HomeSearch";
import HomeSchedules from "@/components/home/HomeSchedules";
import HowItWorks from "@/components/HowItWorks";
import Partners from "@/components/Partners";
import { prisma } from "@/lib/prisma";

// This is now a Server Component
export default async function HomePage() {

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes fadeUp  { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes scaleIn { from{opacity:0;transform:scale(.95)}       to{opacity:1;transform:scale(1)} }
        .anim-fade-up  { animation: fadeUp  .7s ease-out both }
        .anim-scale-in { animation: scaleIn .5s ease-out both }
        .delay-100{animation-delay:.1s} .delay-200{animation-delay:.2s}
        .delay-300{animation-delay:.3s} .delay-400{animation-delay:.4s}
        .scrollbar-none { -ms-overflow-style:none; scrollbar-width:none; }
        .scrollbar-none::-webkit-scrollbar { display:none; }
      `}} />

      {/* 1. Hero */}
      <Hero />

      {/* 2. Search */}
      <HomeSearch />

      {/* 3. Stats */}
      <Stats />

      {/* 4. Promo section temporarily hidden for next version */}

      {/* 5. Schedules/Trips */}
      <HomeSchedules />

      {/* 7. How It Works */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <HowItWorks />
      </div>

    </div>
  );
}
