'use client';

import React from 'react';
import { LogOut, User } from 'lucide-react';

interface OperatorLayoutProps {
  children: React.ReactNode;
}

export default function OperatorLayout({ children }: OperatorLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex items-center">
              <span className="font-bold text-lg text-gray-900">Operator Dashboard</span>
            </div>
            <div className="flex items-center">
              <button className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-600">
                <LogOut className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="py-8"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div></main>
    </div>
  );
}