'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
  LogOut,
  ChevronDown,
  Home,
  User,
} from 'lucide-react';
import Image from 'next/image';

const UserAvatar = ({ user, userProfile }: { user: any; userProfile: any }) => {
  if (userProfile?.avatar) {
    return (
      <Image
        src={userProfile.avatar}
        alt="Profile"
        width={32}
        height={32}
        className="w-8 h-8 rounded-full object-cover border-2 border-indigo-200"
      />
    );
  }
  const initial = userProfile?.firstName?.[0] || user?.email?.[0] || 'U';
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 flex items-center justify-center text-white font-semibold text-sm">
      {initial.toUpperCase()}
    </div>
  );
};

export default function CoGTopBar() {
  const { user, userProfile, signOut } = useAuth();
  const router = useRouter();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
      setIsUserMenuOpen(false);
      router.push('/');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const displayName = (() => {
    const fn = userProfile?.firstName?.trim();
    const ln = userProfile?.lastName?.trim();
    if (fn || ln) return [fn, ln].filter(Boolean).join(' ');
    if (userProfile?.name) return String(userProfile.name);
    if (user?.email) return user.email.split('@')[0];
    return 'Chief of Growth';
  })();

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-100 z-50 flex items-center justify-between px-6 shadow-sm">
      {/* Left side: Logo only */}
      <Link href="/" className="flex items-center">
        <img
          src="/tibhukebus_logo_transparent.png"
          alt="TibhukeBus Logo"
          className="h-9 w-auto object-contain"
        />
      </Link>

      {/* Right side: User Profile */}
      <div className="flex items-center space-x-4">
        {user && (
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center space-x-3 p-1.5 rounded-xl hover:bg-slate-50 transition-all duration-200"
            >
              <UserAvatar user={user} userProfile={userProfile} />
              <div className="hidden md:block text-left">
                <div className="text-xs font-semibold text-slate-900">{displayName}</div>
                <div className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider">Chief of Growth</div>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-4 py-2 border-b border-slate-50">
                  <div className="font-semibold text-slate-900 text-xs truncate">{displayName}</div>
                  <div className="text-[10px] text-slate-400 truncate">{user?.email}</div>
                </div>
                
                <div className="py-1">
                  <Link
                    href="/"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center space-x-2.5 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <Home className="w-3.5 h-3.5 text-slate-400" />
                    <span>Go to Website</span>
                  </Link>
                  <Link
                    href="/profile"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center space-x-2.5 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>My Profile</span>
                  </Link>
                </div>

                <div className="border-t border-slate-50 pt-1 mt-1">
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-2.5 w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors font-semibold"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
