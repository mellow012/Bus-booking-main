'use client';
import React, { useState } from "react";
import { Play } from "lucide-react";
import TourModal from "@/components/TourModal";

export function TourButton() {
  const [isTourOpen, setIsTourOpen] = useState(false);

  return (
    <>
      <button 
        onClick={() => setIsTourOpen(true)}
        className="flex items-center justify-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-medium rounded-xl transition-colors text-sm sm:text-base"
      >
        <Play className="w-4 h-4"/> Take a Tour
      </button>
      <TourModal open={isTourOpen} onClose={() => setIsTourOpen(false)} />
    </>
  );
}
