'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Search, User, Home, Bus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export const MobileBottomNav = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { userProfile } = useAuth();

  const needsProfileAttention = Boolean(
    userProfile &&
    userProfile.role === 'customer' &&
    (!userProfile.setupCompleted || !userProfile.firstName?.trim() || !userProfile.lastName?.trim() || !userProfile.phone?.trim())
  );

  const navItems = [
    { label: 'Home', icon: Home, path: '/' },
    { label: 'Search', icon: Search, path: '/schedules' },
    ...(userProfile?.role === 'customer'
      ? [{ label: 'Bookings', icon: Bus, path: '/bookings' }]
      : []),
    { label: 'Profile', icon: User, path: '/profile', attention: needsProfileAttention },
  ];

  // Don't show on admin/company pages
  const isAdminPage =
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/company/admin') ||
    pathname?.startsWith('/company/operator') ||
    pathname?.startsWith('/company/conductor');

  if (isAdminPage) return null;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 flex justify-around items-center p-3 z-50 pb-safe shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
      {navItems.map((item) => {
        const isActive = pathname === item.path || (item.path !== '/' && pathname?.startsWith(item.path));
        const Icon = item.icon;
        
        return (
          <button
            key={item.path}
            onClick={() => router.push(item.path)}
            className={`relative flex flex-col items-center transition-all duration-300 ${
              isActive ? 'text-blue-600 scale-110' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-[2px]'}`} />
            <span className={`text-[10px] mt-1 font-bold tracking-tight ${isActive ? 'opacity-100' : 'opacity-80'}`}>
              {item.label}
            </span>
            {item.attention && (
              <span className="absolute top-0 right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-white" />
            )}
            {isActive && (
              <span className="absolute -bottom-1 w-1 h-1 bg-blue-600 rounded-full" />
            )}
          </button>
        );
      })}
      
      <style jsx>{`
        .pb-safe {
          padding-bottom: calc(0.75rem + env(safe-area-inset-bottom));
        }
      `}</style>
    </div>
  );
};
