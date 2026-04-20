"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  TicketPercent, 
  Sparkles, 
  Zap, 
  Clock, 
  Gift, 
  Search, 
  RefreshCw, 
  Loader2, 
  ArrowRight,
  TrendingUp,
  Award,
  ChevronRight
} from "lucide-react";
import { PromotionCard } from "@/components/PromotionCard";
import { Promotion } from "@/types/system";
import Link from "next/link";

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPromotions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/promotions');
      const result = await response.json();
      if (result.success) {
        setPromotions(result.data);
      } else {
        throw new Error(result.error || 'Failed to fetch promotions');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPromotions();
  }, [fetchPromotions]);

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600&display=swap');
        body { font-family: 'DM Sans', sans-serif; }
        .font-display { font-family: 'Plus Jakarta Sans', sans-serif; }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        .anim-fade-up { animation: fadeUp 0.7s ease-out both; }
        .delay-100 { animation-delay: 0.1s; }
        .delay-200 { animation-delay: 0.2s; }
      `}</style>

      {/* ── HERO SECTION ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-950 via-blue-950 to-slate-900 pt-20 pb-16 sm:pb-24">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-indigo-500/10 blur-3xl" />
          <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid-promo" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-promo)" />
          </svg>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto anim-fade-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-400/30 text-blue-300 rounded-full text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" /> Exclusive Travel Deals
            </div>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight tracking-tight mb-6">
              Unlock Savings for your <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">
                Next Journey
              </span>
            </h1>
            <p className="text-slate-400 text-lg sm:text-xl leading-relaxed mb-8 max-w-2xl mx-auto">
              Discover the latest offers, seasonal discounts, and early bird deals. Book your trip anywhere in Malawi and save more with TibhukeBus.
            </p>
          </div>
        </div>
      </section>

      {/* ── MAIN CONTENT ──────────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 pb-20 relative z-10">
        
        {/* Quick Stats / Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12 anim-fade-up delay-100">
          {[
            { icon: TrendingUp, label: "Flash Sales", desc: "Up to 50% discount", col: "from-blue-500 to-cyan-500" },
            { icon: Award, label: "Loyalty Rewards", desc: "Earn as you travel", col: "from-indigo-500 to-violet-500" },
            { icon: Gift, label: "New User Bonus", desc: "First booking special", col: "from-emerald-500 to-teal-500" },
          ].map((item, i) => (
            <div key={i} className="bg-white/90 backdrop-blur-md rounded-2xl p-5 shadow-xl shadow-slate-200/50 border border-white flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.col} flex items-center justify-center shrink-0 shadow-lg shadow-blue-200`}>
                <item.icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-gray-900">{item.label}</h4>
                <p className="text-xs text-gray-500 font-medium">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Promotions Grid */}
        <div className="mb-16 anim-fade-up delay-200">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="font-display text-2xl font-extrabold text-gray-900">Available Offers</h2>
              <p className="text-sm text-gray-500 font-medium">Redeem codes at checkout</p>
            </div>
            <button 
              onClick={fetchPromotions}
              disabled={loading}
              className="flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-64 bg-slate-200 animate-pulse rounded-2xl" />
              ))}
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-100 p-10 rounded-3xl text-center">
              <Zap className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h3 className="font-bold text-gray-900 mb-2">Oops! Something went wrong</h3>
              <p className="text-gray-500 text-sm mb-6">{error}</p>
              <button onClick={fetchPromotions} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition">
                Try Again
              </button>
            </div>
          ) : promotions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {promotions.map((p) => (
                <PromotionCard key={p.id} promotion={p} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-dashed border-gray-300 p-16 text-center shadow-sm">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <TicketPercent className="w-10 h-10 text-gray-300" />
              </div>
              <h3 className="font-display text-xl font-bold text-gray-800 mb-2">No active promotions right now</h3>
              <p className="text-gray-500 text-sm mb-8 max-w-xs mx-auto">
                We're currently preparing some exciting new deals for you. Check back soon for exclusive travel discounts!
              </p>
              <Link href="/" className="inline-flex items-center gap-2 text-blue-600 font-bold hover:underline">
                Browse popular routes <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>

        {/* FAQ / How it works */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center anim-fade-up delay-300">
          <div className="relative">
            <div className="absolute -top-10 -left-10 w-24 h-24 bg-blue-100 rounded-full blur-2xl opacity-50" />
            <h2 className="font-display text-3xl font-extrabold text-gray-900 mb-6">
              How to use your <br/>Promo Code
            </h2>
            <div className="space-y-6">
              {[
                { step: "01", title: "Select your trip", desc: "Browse available bus schedules and pick your preferred journey." },
                { step: "02", title: "Apply at checkout", desc: "Enter your promo code in the discount field during the booking process." },
                { step: "03", title: "Instant discount", desc: "The fare will be automatically adjusted based on the offer value." },
              ].map((s, i) => (
                <div key={i} className="flex gap-5">
                  <span className="text-3xl font-display font-black text-blue-100">{s.step}</span>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-1">{s.title}</h4>
                    <p className="text-sm text-gray-500">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 sm:p-10 text-white shadow-2xl shadow-blue-200">
            <h3 className="font-display text-2xl font-bold mb-4">Never miss a deal</h3>
            <p className="text-blue-100 text-sm mb-8 leading-relaxed">
              Subscribe to our newsletter and get notified about flash sales, seasonal offers, and holiday travel specials before anyone else.
            </p>
            <form className="flex flex-col sm:flex-row gap-3">
              <input 
                type="email" 
                placeholder="Enter your email" 
                className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-white/30 flex-1 placeholder:text-blue-200"
              />
              <button className="bg-white text-blue-600 px-6 py-3 rounded-xl font-bold hover:bg-blue-50 transition shadow-lg shrink-0">
                Join Now
              </button>
            </form>
            <p className="text-[10px] text-blue-200 mt-4 text-center sm:text-left">
              By subscribing, you agree to our privacy policy and terms of service.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
