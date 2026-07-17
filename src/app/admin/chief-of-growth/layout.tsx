import React from 'react';
import CoGTopBar from './_components/CoGTopBar';

export default function ChiefOfGrowthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <CoGTopBar />
      <main className="pt-[64px]">
        {children}
      </main>
    </div>
  );
}
