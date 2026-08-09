"use client";

import React from 'react';
import { BookOpen, Search, Armchair, Clock, CreditCard, CheckCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import BackButton from "@/components/BackButton";

export default function BookingGuidePage() {
  const steps = [
    {
      icon: Search,
      title: "1. Search & Compare Schedules",
      desc: "Enter your starting point, destination, and preferred travel date on our search engine. Compare departure times, fares, bus categories (standard vs. luxury), available amenities, and operator ratings to find the ride that fits your plans."
    },
    {
      icon: Armchair,
      title: "2. Pick Your Seat & Boarding Stops",
      desc: "Use our interactive seat layout to select your preferred seats in real-time. Choose your specific pick-up and drop-off points along the corridor route to ensure the conductor knows exactly where to find you."
    },
    {
      icon: Clock,
      title: "3. Create Booking & Wait for Confirmation",
      desc: "Provide the names of the passengers traveling. The system will create the booking request and temporarily lock your selected seats. Wait a few seconds for the system/operator connection to verify seat availability and confirm your reservation."
    },
    {
      icon: CreditCard,
      title: "4. Complete Payment & Get E-Ticket",
      desc: "Once your booking is confirmed, complete payment securely via mobile money (Airtel Money or TNM Mpamba) through our gateway. After payment processing, your digital ticket containing your Booking Reference (PNR) is instantly issued to your account for boarding."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-brand-50/30 to-gray-50 pt-28 sm:pt-32 lg:pt-36">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Back Button */}
        <div className="mb-5">
          <BackButton iconOnly hideOnMobile={false} className="border-slate-200 shadow-sm bg-white" />
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 border border-brand-100 text-xs font-bold text-brand-700 uppercase tracking-wider mb-3">
            <BookOpen className="w-3.5 h-3.5" /> Ticketing Guide
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            How to Book Your Journey
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            A simple step-by-step walkthrough to reserving seats, selecting boarding points, and paying for tickets online.
          </p>
        </div>

        {/* Step Cards */}
        <div className="bg-white rounded-2xl border border-slate-100 p-8 sm:p-10 shadow-sm space-y-8">
          <div className="space-y-8">
            {steps.map((step, idx) => (
              <div key={idx} className="flex gap-4 sm:gap-6 items-start">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-700 shrink-0 shadow-sm">
                  <step.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 leading-tight">
                    {step.title}
                  </h3>
                  <p className="text-sm text-slate-650 leading-relaxed">
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
              Boarding Verification
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Please arrive at the terminal <strong>15 to 30 minutes</strong> before departure. Present the digital copy of your e-ticket or write down the Booking Reference (PNR) code for the conductor. Once boarding validation completes, you are ready to depart!
            </p>
          </div>

          <div className="pt-6 text-center sm:text-right border-t border-slate-50">
            <Link
              href="/schedules"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-coral-500 hover:bg-coral-600 text-white font-bold text-sm shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              Find a Bus Schedule <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
