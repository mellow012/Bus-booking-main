"use client";

import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import BackButton from "@/components/BackButton";

interface FAQItem {
  question: string;
  answer: React.ReactNode;
}

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs: FAQItem[] = [
    {
      question: "How do I search and book a bus ticket?",
      answer: (
        <p>
          Head to the{" "}
          <Link href="/schedules" className="text-brand-700 font-semibold hover:underline">
            Bus Schedules
          </Link>{" "}
          page, enter your origin, destination, and date, then compare available trips. Once you find your preferred bus, select seats, fill in passenger details, and complete payment instantly via mobile money.
        </p>
      ),
    },
    {
      question: "What is the cancellation and refund policy?",
      answer: (
        <p>
          You can cancel and receive a full refund up to{" "}
          <strong>2 hours before departure</strong>. Cancellations within 2 hours of
          departure are non-refundable. For full details, read our{" "}
          <Link href="/refund-policy" className="text-brand-700 font-semibold hover:underline">
            Refund & Cancellation Policy
          </Link>
          .
        </p>
      ),
    },
    {
      question: "Can I choose my own seat?",
      answer: (
        <p>
          Yes! When booking, you are shown a live interactive seat map of the bus. Available,
          reserved, and occupied seats are colour-coded so you can pick exactly where you want
          to sit — window, aisle, front, or rear.
        </p>
      ),
    },
    {
      question: "How does live journey tracking work?",
      answer: (
        <p>
          Once your trip departs, conductors update the bus position via their dashboard. You
          can follow the live map directly from your{" "}
          <Link href="/bookings" className="text-brand-700 font-semibold hover:underline">
            My Bookings
          </Link>{" "}
          page — no separate app required.
        </p>
      ),
    },
    {
      question: "What should I do on the day of travel?",
      answer: (
        <p>
          Arrive at the boarding point at least <strong>15 – 30 minutes</strong> before
          departure. Show the conductor your digital e-ticket (the Booking Reference / PNR
          shown in My Bookings) for boarding verification.
        </p>
      ),
    },
    {
      question: "How do I view or download my e-ticket?",
      answer: (
        <p>
          After payment is confirmed, your e-ticket is immediately available under{" "}
          <Link href="/bookings" className="text-brand-700 font-semibold hover:underline">
            My Bookings
          </Link>
          . You can share or screenshot the ticket directly from your phone — no printing
          required.
        </p>
      ),
    },
  ];

  const toggleOpen = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-brand-50/30 to-gray-50 pt-28 sm:pt-32 lg:pt-36">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Back */}
        <div className="mb-5">
          <BackButton iconOnly hideOnMobile={false} className="border-slate-200 shadow-sm bg-white" />
        </div>

        {/* Header */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 border border-brand-100 text-xs font-bold text-brand-700 uppercase tracking-wider mb-3">
            <HelpCircle className="w-3.5 h-3.5" /> FAQ
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Frequently Asked Questions
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Quick answers to common questions about bookings, payments, seats, and travel.
          </p>
        </div>

        {/* Accordion */}
        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${
                  isOpen ? "border-brand-200 shadow-md" : "border-slate-100 shadow-sm hover:border-slate-200"
                }`}
              >
                <button
                  onClick={() => toggleOpen(idx)}
                  className="w-full flex items-center justify-between gap-4 p-5 text-left cursor-pointer focus:outline-none"
                >
                  <span className={`font-bold text-sm sm:text-base leading-snug transition-colors ${isOpen ? "text-brand-700" : "text-slate-800"}`}>
                    {faq.question}
                  </span>
                  <span className={`shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition-all ${isOpen ? "bg-brand-50 text-brand-700" : "bg-slate-50 text-slate-400"}`}>
                    {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </span>
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-sm text-slate-600 leading-relaxed border-t border-slate-50">
                    <div className="pt-4">{faq.answer}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="mt-8 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-bold text-slate-900 text-sm">Still have questions?</p>
            <p className="text-slate-500 text-xs mt-0.5">Our support team is available 24 hours a day, 7 days a week.</p>
          </div>
          <Link
            href="/contact"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-coral-500 hover:bg-coral-600 text-white font-bold text-sm shadow-sm transition-all active:scale-95 shrink-0"
          >
            Contact Support <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
