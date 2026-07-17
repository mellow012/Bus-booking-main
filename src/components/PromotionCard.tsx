"use client";

import React, { useState } from "react";
import { TicketPercent, Calendar, Copy, CheckCircle2, Clock, Sparkles, Zap, ArrowRight } from "lucide-react";
import { Promotion } from "@/types/system";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

interface PromotionCardProps {
  promotion: Promotion;
}

export const PromotionCard: React.FC<PromotionCardProps> = ({ promotion }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(promotion.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isExpiringSoon = () => {
    const now = new Date();
    const expiry = new Date(promotion.endDate);
    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays > 0 && diffDays <= 3;
  };

  const getDiscountDisplay = () => {
    if (promotion.discountType === 'percentage') {
      return `${promotion.discountValue}% OFF`;
    }
    return `MWK ${promotion.discountValue.toLocaleString()} OFF`;
  };

  return (
    <article className="group relative bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-blue-200 transition-all duration-300 overflow-hidden flex flex-col">
      {/* Top Gradient Bar */}
      <div className={`h-[4px] w-full ${isExpiringSoon() ? "bg-gradient-to-r from-orange-400 to-rose-500" : "bg-gradient-to-r from-blue-500 to-indigo-600"}`} />

      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              isExpiringSoon() ? "bg-rose-50 text-rose-600" : "bg-blue-50 text-blue-600"
            }`}>
              <TicketPercent className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 group-hover:text-blue-700 transition-colors line-clamp-1">
                {promotion.title}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  isExpiringSoon() ? "bg-rose-100 text-rose-700" : "bg-blue-100 text-blue-700"
                }`}>
                  {getDiscountDisplay()}
                </span>
              </div>
            </div>
          </div>
          {isExpiringSoon() && (
            <div className="flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-lg animate-pulse">
              <Clock className="w-3 h-3" /> Ends Soon
            </div>
          )}
        </div>

        <p className="text-gray-500 text-sm leading-relaxed mb-4 line-clamp-2">
          {promotion.description}
        </p>

        <div className="mt-auto space-y-3">
          {/* Info Pills */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2.5 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="text-[11px] font-medium text-gray-600 truncate">
                Until {format(new Date(promotion.endDate), "dd MMM")}
              </span>
            </div>
            {promotion.minPurchase ? (
              <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2.5 py-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="text-[11px] font-medium text-gray-600 truncate">
                  Min MWK {promotion.minPurchase.toLocaleString()}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2.5 py-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span className="text-[11px] font-medium text-gray-600 truncate">
                  No Min. Spend
                </span>
              </div>
            )}
          </div>

          {/* Promo Code Box */}
          <div className="relative group/code">
            <div className="flex items-center justify-between gap-2 p-2 bg-slate-50 border border-dashed border-slate-300 rounded-xl group-hover/code:border-blue-400 group-hover/code:bg-blue-50 transition-all">
              <code className="text-sm font-bold text-slate-700 ml-2 tracking-wider">
                {promotion.code}
              </code>
              <Button 
                onClick={handleCopyCode}
                variant="ghost" 
                size="sm"
                className={`h-8 px-3 rounded-lg flex items-center gap-1.5 transition-all ${
                  copied ? "bg-emerald-500 text-white hover:bg-emerald-600" : "text-blue-600 hover:bg-blue-100"
                }`}
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-bold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-bold uppercase tracking-tight">Copy</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};
