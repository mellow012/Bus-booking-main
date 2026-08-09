"use client";

import React from 'react';
import { BookOpen, Search, Armchair, CreditCard, CheckCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import BackButton from "@/components/BackButton";

export default function BookingGuidePage() {
  const steps = [
    {
      icon: Search,
      title: "1. Search & Compare Schedules",
      desc: "Enter your starting point, destination, and preferred travel date on our search engine. Compare departure times, fares, bus types (standard vs. luxury), available amenities, and operator ratings to find the ride that fits your plans."
    },
    {
      icon: Armchair,
      title: "2. Pick Your Seat & Boarding Stops",
      desc: "Use our interactive seat layout to select your preferred seats in real-time. Choose your specific pick-up and drop-off points along the corridor route to ensure the conductor knows exactly where to find you."
    },
    {
      icon: CreditCard,
      title: "3. Enter Details & Pay Instantly",
      desc: "Provide the names and roles of the passengers traveling. Complete payment securely via mobile money (Airtel Money or TNM Mpamba) through our payment gate. You will immediately receive a digital e-ticket containing your Booking Reference (PNR)."
    }
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8 pt-28 sm:pt-32">
      {/* Back Button above the page card */}
      <div className="mb-4">
        <BackButton href="/" iconOnly hideOnMobile={false} className="border-slate-200 shadow-sm bg-white text-slate-600 hover:text-slate-900" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 sm:p-12">
        <div className="mb-10 border-b pb-6 text-center sm:text-left">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 text-xs font-semibold text-brand-700 mb-3">
            <BookOpen className="w-3.5 h-3.5" /> Ticketing Guide
          </span>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight sm:text-4xl font-display">
            How to Book Your Journey
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            A simple step-by-step walkthrough to reserving seats, selecting boarding points, and paying for tickets online.
          </p>
        </div>

        {/* Step Cards */}
        <div className="space-y-8">
          {steps.map((step, idx) => (
            <div key={idx} className="flex gap-4 sm:gap-6 items-start">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-brand-55/10 border border-brand-100/50 flex items-center justify-center text-brand-700 shrink-0 shadow-xs">
                <step.icon className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 leading-tight">
                  {step.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Boarding advice block */}
        <div className="mt-12 bg-slate-50 border border-slate-100 rounded-2xl p-5 sm:p-6 space-y-3">
          <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            Boarding Check
          </h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Please arrive at the terminal <strong>15 to 30 minutes</strong> before departure. Present the digital copy of your e-ticket or write down the Booking Reference (PNR) code for the conductor. Once boarding validation completes, you are ready to depart!
          </p>
        </div>

        <div className="mt-8 text-center sm:text-right">
          <Link
            href="/schedules"
            className="inline-flex items-center gap-1.5 px-5 py-3 rounded-xl bg-brand-700 hover:bg-brand-850 text-white font-bold text-sm shadow-md transition-all cursor-pointer"
          >
            Find a Bus Schedule <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
