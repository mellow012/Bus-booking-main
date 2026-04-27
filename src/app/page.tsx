import React from "react";
import { Hero } from "@/components/home/Hero";
import { Stats } from "@/components/home/Stats";
import HomeSearch from "@/components/home/HomeSearch";
import HomeSchedules from "@/components/home/HomeSchedules";
import GroupBookingSection from "@/components/home/GroupBookingSection";
import HowItWorks from "@/components/HowItWorks";
import Partners from "@/components/Partners";
import PromoBanner from "@/components/PromoBanner";
import { prisma } from "@/lib/prisma";
import { TicketPercent, TrendingUp, Award, Gift } from "lucide-react";
import { PromotionCard } from "@/components/PromotionCard";

// This is now a Server Component
export default async function HomePage() {
  // Server-side data fetching
  const promotions = await prisma.promotion.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
    take: 6
  });

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <style dangerouslySetInnerHTML={{
        __html: `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600&display=swap');
        body { font-family: 'DM Sans', sans-serif; }
        .font-display { font-family: 'Plus Jakarta Sans', sans-serif; }
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

      {/* 4. Promo (if available) */}
      {promotions.length > 0 && (
        <div className="py-12">
          <PromoBanner promotions={promotions as any} />
        </div>
      )}

      {/* 5. Schedules/Trips */}
      <HomeSchedules />

      {/* 6. Group Bookings */}
      <GroupBookingSection />


      {/* Promotions Detail Section */}
      {promotions.length > 0 && (
        <section id="promotions-section" className="max-w-7xl mx-auto p-container mb-24">
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-premium p-8 sm:p-12">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 mb-1">Exclusive Deals</p>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-gray-900">Current Promotions</h2>
              <p className="text-gray-500 text-sm mt-1">Redeem these codes at checkout for instant savings</p>
            </div>
            <div className="hidden md:flex items-center gap-2 text-xs font-medium text-gray-400">
              <TicketPercent className="w-4 h-4" /> Valid for limited time
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {promotions.map((p) => (
              <PromotionCard key={p.id} promotion={p as any} />
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12 pt-12 border-t border-gray-50">
            {[
              { icon: TrendingUp, label: "Flash Sales", desc: "Up to 50% discount", col: "text-blue-600 bg-blue-50" },
              { icon: Award, label: "Loyalty Rewards", desc: "Earn as you travel", col: "text-indigo-600 bg-indigo-50" },
              { icon: Gift, label: "New User Bonus", desc: "First booking special", col: "text-emerald-600 bg-emerald-50" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-50 transition-colors">
                <div className={`w-10 h-10 rounded-xl ${item.col} flex items-center justify-center shrink-0`}>
                  <item.icon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">{item.label}</h4>
                  <p className="text-[10px] text-gray-500 font-medium">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
          </div>
        </section>
      )}

      {/* 7. How It Works */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <HowItWorks />
      </div>

    </div>
  );
}
