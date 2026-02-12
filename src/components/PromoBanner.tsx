// components/PromoBanner.tsx
import React from "react";
import { ArrowRight, TicketPercent, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PromoBannerProps {
  onCtaClick?: () => void;
}

const PromoBanner: React.FC<PromoBannerProps> = ({ onCtaClick }) => {
  return (
    <section aria-labelledby="promo-heading" className="px-4 sm:px-6 lg:px-8 mt-8">
      <div className="max-w-7xl mx-auto">
        <article className="relative overflow-hidden rounded-3xl border border-blue-200 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg">
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-white/20 blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-indigo-400/30 blur-3xl" />
          </div>

          <div className="relative p-6 sm:p-10 grid md:grid-cols-5 gap-6 items-center">
            <div className="md:col-span-3">
              <h2 id="promo-heading" className="text-2xl sm:text-3xl font-bold leading-tight">
                Save 15% on your first booking
              </h2>
              <p className="mt-2 text-white/90">
                Limited-time offer for new travelers. Use code <span className="font-semibold">WELCOME15</span> at checkout.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-white/90">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1">
                  <Sparkles className="h-4 w-4" /> No hidden fees
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1">
                  <TicketPercent className="h-4 w-4" /> Secure checkout
                </div>
              </div>
            </div>
            <div className="md:col-span-2 flex md:justify-end">
              <Button onClick={onCtaClick} className="btn-hero w-full md:w-auto">
                Apply Discount
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
};

export default PromoBanner;