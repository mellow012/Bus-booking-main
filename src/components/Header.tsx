'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import {
  Menu, X, User, LogOut, Search, Calendar,
  Shield, ChevronDown, HomeIcon, BusIcon, MapPin,
} from 'lucide-react';
import { NotificationBell } from '../contexts/NotificationContext';

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

const UserAvatar = ({ user, userProfile }: { user: any; userProfile: any }) => {
  if (userProfile?.avatar) {
    return (
      <img src={userProfile.avatar} alt="Profile"
        className="w-8 h-8 rounded-full object-cover ring-2 ring-blue-200"/>
    );
  }
  const initial = userProfile?.firstName?.[0] || user?.email?.[0] || 'U';
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
      {initial.toUpperCase()}
    </div>
  );
};

const UserSkeleton = () => (
  <div className="flex items-center gap-3">
    <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse shrink-0"/>
    <div className="hidden md:block h-4 bg-gray-200 rounded w-20 animate-pulse"/>
  </div>
);

const navigationItems = [
  { href: '/',          label: 'Home',         icon: HomeIcon  },
  { href: '/search',    label: 'Search Buses',  icon: Search    },
  { href: '/schedules', label: 'Schedules',     icon: Calendar  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────────────────

const Header: React.FC = () => {
  const { user, userProfile, signOut, loading } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();

  const [isMenuOpen,     setIsMenuOpen]     = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isScrolled,     setIsScrolled]     = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const isAdminPage = pathname.startsWith('/admin') ||
    pathname.startsWith('/company/admin') ||
    pathname.startsWith('/company/operator') ||
    pathname.startsWith('/company/conductor');

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node))
        setIsUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { setIsMenuOpen(false); }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setIsMenuOpen(false); setIsUserMenuOpen(false); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? 'hidden' : 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isMenuOpen]);

  // ── Role detection ─────────────────────────────────────────────────────────

  const normalizedRole = String(userProfile?.role ?? '').trim().toLowerCase();
  const isSuperAdmin   = normalizedRole === 'superadmin';
  const isCompanyAdmin = normalizedRole === 'company_admin' || normalizedRole === 'admin' || normalizedRole.includes('companyadmin');
  const isOperator     = normalizedRole === 'operator';
  const isConductor    = normalizedRole.includes('conductor') || normalizedRole === 'driver' || normalizedRole.includes('conduct') || normalizedRole === 'crew' || normalizedRole === 'bus driver';
  const isCustomer     = user && userProfile && !isSuperAdmin && !isCompanyAdmin && !isOperator && !isConductor;

  const adminRoute = isSuperAdmin ? '/admin' : isCompanyAdmin ? '/company/admin' : isOperator ? '/company/operator/dashboard' : null;
  const adminLabel = isOperator ? 'Operator Panel' : 'Admin Panel';

  const displayName = (() => {
    const fn = userProfile?.firstName?.trim();
    const ln = userProfile?.lastName?.trim();
    if (fn || ln) return `${fn || ''}${fn && ln ? ' ' : ''}${ln || ''}`.trim();
    if (userProfile?.name) return String(userProfile.name);
    if (user?.email) return user.email.split('@')[0];
    return 'User';
  })();

  const isActivePage = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href);

  const handleLogout = async () => {
    try { await signOut(); setIsUserMenuOpen(false); router.push('/'); }
    catch (e) { console.error('Logout error:', e); }
  };

  if (isAdminPage) return null;

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <>
      <header className={`fixed top-0 left-0 right-0 z-30 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/95 backdrop-blur-lg shadow-lg border-b border-gray-200/50'
          : 'bg-white/80 backdrop-blur-sm'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* ── Logo ──────────────────────────────────────────────────────── */}
            <Link href="/" className="flex items-center gap-2.5 group shrink-0">
              {/* Icon */}
              <div className="relative">
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all duration-200">
                  <BusIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white"/>
                </div>
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white animate-pulse"/>
              </div>
              {/* Name — always visible, adapts to scrolled vs hero state */}
              <div>
                <span className={`text-lg sm:text-xl font-extrabold leading-none transition-all duration-300 ${
                  isScrolled
                    ? 'text-gray-900 group-hover:text-blue-600'
                    : 'text-white drop-shadow-sm group-hover:text-blue-200'
                }`}>
                  TibhukeBus
                </span>
                <p className={`hidden sm:block text-[10px] leading-none mt-0.5 font-medium tracking-wide transition-all duration-300 ${
                  isScrolled ? 'text-gray-400' : 'text-blue-200/80'
                }`}>
                  Smart Travel
                </p>
              </div>
            </Link>

            {/* ── Desktop nav ───────────────────────────────────────────────── */}
            <nav className="hidden lg:flex items-center gap-1">
              {navigationItems.map(item => {
                const active = isActivePage(item.href);
                return (
                  <Link key={item.href} href={item.href}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                      active
                        ? 'bg-blue-600/20 text-white shadow-sm ring-1 ring-white/20'
                        : isScrolled
                          ? 'text-gray-600 hover:bg-gray-100 hover:text-blue-600'
                          : 'text-white/80 hover:bg-white/10 hover:text-white'
                    }`}>
                    <item.icon className="w-4 h-4"/>{item.label}
                  </Link>
                );
              })}
            </nav>

            {/* ── Right side actions ────────────────────────────────────────── */}
            <div className="flex items-center gap-2 sm:gap-3">

              {/* Notification bell */}
              {user && userProfile?.id && (
                <NotificationBell userId={userProfile.id} className="relative"/>
              )}

              {/* Auth loading */}
              {loading && <UserSkeleton/>}

              {/* Logged-in user dropdown */}
              {!loading && user && (
                <div className="relative" ref={userMenuRef}>
                  <button onClick={() => setIsUserMenuOpen(v => !v)}
                    className="flex items-center gap-2 p-1.5 sm:p-2 rounded-xl hover:bg-white/10 transition-all duration-200 group">
                    <UserAvatar user={user} userProfile={userProfile}/>
                    {/* Name: md+ only */}
                    <div className="hidden md:block text-left">
                      <p className={`text-sm font-semibold leading-tight max-w-[120px] truncate transition-colors ${
                        isScrolled ? 'text-gray-900 group-hover:text-blue-600' : 'text-white'
                      }`}>{displayName}</p>
                      <p className={`text-[11px] capitalize leading-tight transition-colors ${
                        isScrolled ? 'text-gray-400' : 'text-blue-200/80'
                      }`}>{userProfile?.role || 'Member'}</p>
                    </div>
                    <ChevronDown className={`w-4 h-4 transition-all duration-200 ${isUserMenuOpen ? 'rotate-180' : ''} ${isScrolled ? 'text-gray-400' : 'text-white/60'}`}/>
                  </button>

                  {/* Dropdown */}
                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      {/* User info header */}
                      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                        <UserAvatar user={user} userProfile={userProfile}/>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
                          <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                        </div>
                      </div>

                      <div className="py-1.5">
                        {isCustomer && (
                          <Link href="/bookings" onClick={() => setIsUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                            <Calendar className="w-4 h-4 shrink-0"/>My Bookings
                          </Link>
                        )}
                        {(isCustomer || isOperator) && (
                          <Link href="/profile" onClick={() => setIsUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                            <User className="w-4 h-4 shrink-0"/>Profile
                          </Link>
                        )}
                        {isConductor ? (
                          <Link href="/company/conductor/dashboard" onClick={() => setIsUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-blue-700 font-medium hover:bg-blue-50 transition-colors">
                            <BusIcon className="w-4 h-4 shrink-0"/>Conductor Dashboard
                          </Link>
                        ) : (isSuperAdmin || isCompanyAdmin || isOperator) && adminRoute && (
                          <Link href={adminRoute} onClick={() => setIsUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-purple-700 font-medium hover:bg-purple-50 transition-colors">
                            <Shield className="w-4 h-4 shrink-0"/>{adminLabel}
                          </Link>
                        )}
                      </div>

                      <div className="border-t border-gray-100 pt-1.5">
                        <button onClick={handleLogout}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition-colors">
                          <LogOut className="w-4 h-4 shrink-0"/>Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Not logged in — desktop */}
              {!loading && !user && (
                <div className="hidden md:flex items-center gap-2">
                  <Link href="/login"
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      isScrolled ? 'text-gray-700 hover:text-blue-600' : 'text-white/80 hover:text-white'
                    }`}>
                    Sign In
                  </Link>
                  <Link href="/register"
                    className={`px-4 py-2 text-sm font-semibold rounded-xl shadow-md hover:shadow-lg hover:opacity-90 transition-all duration-200 ${
                      isScrolled
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                        : 'bg-white text-blue-700 hover:bg-blue-50'
                    }`}>
                    Get Started
                  </Link>
                </div>
              )}

              {/* Hamburger — mobile only */}
              <button onClick={() => setIsMenuOpen(v => !v)}
                className={`lg:hidden p-2 rounded-xl transition-all duration-200 ${
                  isScrolled
                    ? 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                    : 'text-white hover:bg-white/10'
                }`}
                aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}>
                {isMenuOpen ? <X className="w-5 h-5"/> : <Menu className="w-5 h-5"/>}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Mobile drawer ──────────────────────────────────────────────────── */}
      {isMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-20 flex">
          {/* Scrim */}
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)}/>

          {/* Panel — slides in from right */}
          <div className="relative ml-auto w-[min(320px,90vw)] h-full bg-white shadow-2xl flex flex-col overflow-y-auto">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                  <BusIcon className="w-4 h-4 text-white"/>
                </div>
                <span className="font-extrabold text-gray-900 text-base">TibhukeBus</span>
              </div>
              <button onClick={() => setIsMenuOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-gray-500"/>
              </button>
            </div>

            <div className="flex-1 px-4 py-4 space-y-1">
              {/* Nav links */}
              {navigationItems.map(item => {
                const active = isActivePage(item.href);
                return (
                  <Link key={item.href} href={item.href} onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                      active ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'
                    }`}>
                    <item.icon className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-gray-400'}`}/>
                    {item.label}
                    {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600"/>}
                  </Link>
                );
              })}
            </div>

            {/* Auth section at bottom */}
            <div className="px-4 pb-6 pt-3 border-t border-gray-100 space-y-3">
              {loading ? (
                <UserSkeleton/>
              ) : user ? (
                <>
                  {/* User info card */}
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
                    <UserAvatar user={user} userProfile={userProfile}/>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
                      <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                    </div>
                  </div>

                  {/* Role-based links */}
                  {isConductor ? (
                    <Link href="/company/conductor/dashboard" onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-3 bg-blue-50 text-blue-700 rounded-xl text-sm font-semibold">
                      <BusIcon className="w-5 h-5"/>Conductor Dashboard
                    </Link>
                  ) : (
                    <>
                      {adminRoute && (
                        <Link href={adminRoute} onClick={() => setIsMenuOpen(false)}
                          className="flex items-center gap-3 px-3 py-3 bg-purple-50 text-purple-700 rounded-xl text-sm font-semibold">
                          <Shield className="w-5 h-5"/>{adminLabel}
                        </Link>
                      )}
                      {isCustomer && (
                        <Link href="/bookings" onClick={() => setIsMenuOpen(false)}
                          className="flex items-center gap-3 px-3 py-3 text-gray-700 hover:bg-gray-100 rounded-xl text-sm transition-colors">
                          <Calendar className="w-5 h-5 text-gray-400"/>My Bookings
                        </Link>
                      )}
                      {(isCustomer || isOperator) && (
                        <Link href="/profile" onClick={() => setIsMenuOpen(false)}
                          className="flex items-center gap-3 px-3 py-3 text-gray-700 hover:bg-gray-100 rounded-xl text-sm transition-colors">
                          <User className="w-5 h-5 text-gray-400"/>Profile
                        </Link>
                      )}
                    </>
                  )}

                  <button onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-3 py-3 text-rose-600 hover:bg-rose-50 rounded-xl text-sm font-medium transition-colors">
                    <LogOut className="w-5 h-5"/>Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={() => setIsMenuOpen(false)}
                    className="flex items-center justify-center py-3 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
                    Sign In
                  </Link>
                  <Link href="/register" onClick={() => setIsMenuOpen(false)}
                    className="flex items-center justify-center py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-semibold shadow-md">
                    Get Started →
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;