import React from "react";
import { Hero } from "@/components/home/Hero";
import HomeSearch from "@/components/home/HomeSearch";
import HomeSchedules from "@/components/home/HomeSchedules";
import HowItWorks from "@/components/HowItWorks";
import Partners from "@/components/Partners";

// This is now a Server Component
export default async function HomePage() {

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">

      {/* 1. Hero */}
      <Hero />

      {/* 2. Search */}
      <HomeSearch />

      {/* 3. Schedules/Trips */}

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
