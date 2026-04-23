import React, { useState, useEffect } from "react";
import { ArrowRight, TicketPercent, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Promotion } from "@/types/system";

interface PromoBannerProps {
  onCtaClick?: () => void;
  promotions?: Promotion[];
}

const PromoBanner: React.FC<PromoBannerProps> = ({ onCtaClick, promotions = [] }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (promotions.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % promotions.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [promotions.length]);

  if (!promotions.length) return null;

  const promotion = promotions[currentIndex];
  const discountText = promotion.discountType === 'percentage' 
    ? `${promotion.discountValue}%` 
    : `MWK ${promotion.discountValue.toLocaleString()}`;

  const minSpend = promotion.minPurchase ?? 0;

  const nextPromo = () => setCurrentIndex((prev) => (prev + 1) % promotions.length);
  const prevPromo = () => setCurrentIndex((prev) => (prev - 1 + promotions.length) % promotions.length);

  return (
    <section aria-labelledby="promo-heading" className="px-4 sm:px-6 lg:px-8 mt-8">
      <div className="max-w-7xl mx-auto relative group">
        <article className="relative overflow-hidden rounded-3xl border border-blue-200 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg transition-all duration-700">
          {/* Animated Background Decoration */}
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-white/20 blur-3xl animate-pulse" />
            <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-indigo-400/30 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          </div>

          <div className="relative p-6 sm:p-10 grid md:grid-cols-5 gap-6 items-center min-h-[280px]">
            <div className="md:col-span-3 transition-all duration-500 transform">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-xs font-bold uppercase tracking-widest mb-3">
                <Sparkles className="w-3 h-3" /> Special Offer {promotions.length > 1 && `(${currentIndex + 1}/${promotions.length})`}
              </div>
              <h2 id="promo-heading" className="text-2xl sm:text-4xl font-black leading-tight tracking-tight">
                Save {discountText} on {promotion.title || "Your Next Trip"}
              </h2>
              <p className="mt-2 text-white/90 font-medium line-clamp-2">
                {promotion.description || `Use code at checkout to redeem your discount.`} 
                Use code <span className="bg-white text-blue-600 px-2 py-0.5 rounded font-black tracking-widest ml-1">{promotion.code}</span>
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-4 text-xs font-bold uppercase tracking-widest text-white/80">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center">
                    <TicketPercent className="h-3.5 w-3.5" />
                  </div>
                  <span>Instant Discount</span>
                </div>
                {minSpend > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center">
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                    <span>Min Spend: MWK {minSpend.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="md:col-span-2 flex md:justify-end">
              <Button onClick={onCtaClick} className="bg-white text-blue-600 hover:bg-blue-50 h-14 px-8 rounded-2xl font-black text-lg shadow-xl shadow-blue-900/20 group">
                REDEEM NOW
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>

          {/* Dots Indicator */}
          {promotions.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
              {promotions.map((_, i) => (
                <button 
                  key={i} 
                  onClick={() => setCurrentIndex(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentIndex ? 'bg-white w-4' : 'bg-white/40 hover:bg-white/60'}`}
                />
              ))}
            </div>
          )}
        </article>

        {/* Carousel Controls */}
        {promotions.length > 1 && (
          <>
            <button 
              onClick={prevPromo}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
            <button 
              onClick={nextPromo}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronRight className="w-6 h-6 text-white" />
            </button>
          </>
        )}
      </div>
    </section>
  );
};

export default PromoBanner;
