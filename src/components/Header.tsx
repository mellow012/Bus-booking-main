'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Menu, X, User, LogOut, Search, Calendar,
  Shield, ChevronDown, HomeIcon, BusIcon,
} from 'lucide-react';
import { NotificationBell } from '@/contexts/NotificationContext';
import Image from 'next/image';
import LanguageSwitcher from './LanguageSwitcher';

const UserAvatar = ({ user, userProfile }: { user: any; userProfile: any }) => {
  if (userProfile?.avatar) {
    return <img src={userProfile.avatar} alt="Profile" className="w-8 h-8 rounded-full object-cover border-2 border-blue-200" />;
  }
  const initial = userProfile?.firstName?.[0] || user?.email?.[0] || 'U';
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm">
      {initial.toUpperCase()}
    </div>
  );
};

const UserSkeleton = () => (
  <div className="flex items-center space-x-3">
    <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
    <div className="hidden md:block"><div className="h-4 bg-gray-200 rounded w-20 animate-pulse" /></div>
  </div>
);

const Header: React.FC = () => {
  const { user, userProfile, signOut, loading } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();
  const t        = useTranslations('nav');

  const [isMenuOpen,     setIsMenuOpen]     = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isScrolled,     setIsScrolled]     = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // ── navigation items use translations ──────────────────────────────────────
  const navigationItems = [
    { href: '/',          label: t('home'),        icon: HomeIcon },
    { href: '/search',    label: t('searchBuses'), icon: Search   },
    { href: '/schedules', label: t('schedules'),   icon: Calendar },
  ];

  const isAdminPage =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/company/admin') ||
    pathname.startsWith('/company/operator') ||
    pathname.startsWith('/company/conductor');

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node))
        setIsUserMenuOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => setIsMenuOpen(false), [pathname]);

  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setIsMenuOpen(false); setIsUserMenuOpen(false); }
    };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? 'hidden' : 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isMenuOpen]);

  const handleLogout = async () => {
    try { await signOut(); setIsUserMenuOpen(false); router.push('/'); }
    catch (err) { console.error('Sign-out error:', err); }
  };

  const isActivePage = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  const normalizedRole = String(userProfile?.role ?? '').trim().toLowerCase();
  const isSuperAdmin   = normalizedRole === 'superadmin';
  const isCompanyAdmin = normalizedRole === 'company_admin' || normalizedRole === 'admin' || normalizedRole.includes('companyadmin');
  const isOperator     = normalizedRole === 'operator';
  const isConductor    = ['conductor','driver','crew','bus driver','bus conductor'].some(r => normalizedRole.includes(r));
  const isCustomer     = user && userProfile && !isSuperAdmin && !isCompanyAdmin && !isOperator && !isConductor;

  const adminRoute = isSuperAdmin ? '/admin' : isCompanyAdmin ? '/company/admin' : isOperator ? '/company/operator/dashboard' : null;
  const adminLabel = isOperator ? t('operatorPanel') : t('adminPanel');

  const displayName = (() => {
    const fn = userProfile?.firstName?.trim();
    const ln = userProfile?.lastName?.trim();
    if (fn || ln) return [fn, ln].filter(Boolean).join(' ');
    if (userProfile?.name) return String(userProfile.name);
    if (user?.email) return user.email.split('@')[0];
    return 'User';
  })();

  const notificationUserId: string | undefined =
    userProfile?.id ?? userProfile?.uid ?? user?.uid;

  useEffect(() => {
    if (!user || process.env.NODE_ENV !== 'development') return;
    console.log('[Header] Role info:', { role: userProfile?.role, normalizedRole, isConductor, isOperator, isCompanyAdmin, isSuperAdmin, isCustomer, displayName });
  }, [user, userProfile?.role, normalizedRole, isConductor, isOperator, isCompanyAdmin, isSuperAdmin, isCustomer, displayName]);

  if (isAdminPage) return null;

  return (
    <header className={`fixed top-0 left-0 right-0 z-30 transition-all duration-300 ${
      isScrolled ? 'bg-white/95 backdrop-blur-lg shadow-lg border-b border-gray-200/50' : 'bg-white/80 backdrop-blur-sm'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-6">
        <div className="flex justify-between items-center py-4">

          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2.5 group">
            <div className="relative shrink-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center transition-all duration-300 group-hover:scale-105">
                <Image
                  src="/tibhukebus_logo_transparent.png"
                  alt="TibhukeBus Logo"
                  width={48}
                  height={48}
                  className="object-contain"
                  priority
                />
              </div>
            </div>
            <div>
              <span className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent group-hover:from-blue-600 group-hover:to-indigo-600 transition-all duration-300">TibhukeBus</span>
              <div className="hidden sm:block text-xs text-gray-500 -mt-1">{t('smartTravel')}</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center space-x-1">
            {navigationItems.map(item => {
              const active = isActivePage(item.href);
              return (
                <Link key={item.href} href={item.href}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition-all duration-200 ${active ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'}`}>
                  <item.icon className="w-4 h-4" /><span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Actions */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {user && notificationUserId && (
              <NotificationBell userId={notificationUserId} className="relative" />
            )}
            <LanguageSwitcher />

            {user && (
              <div className="relative" ref={userMenuRef}>
                <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center space-x-3 p-2 rounded-xl hover:bg-gray-100 transition-all duration-200 group">
                  <UserAvatar user={user} userProfile={userProfile} />
                  <div className="hidden md:block text-left">
                    <div className="text-sm font-semibold text-gray-900 group-hover:text-blue-600">{displayName}</div>
                    <div className="text-xs text-gray-500 capitalize">{userProfile?.role || t('member')}</div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-200 py-2 z-50 animate-in fade-in slide-in-from-top-5 duration-200">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <div className="flex items-center space-x-3">
                        <UserAvatar user={user} userProfile={userProfile} />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-gray-900 truncate">{displayName}</div>
                          <div className="text-sm text-gray-500 truncate">{user?.email}</div>
                        </div>
                      </div>
                    </div>
                    <div className="py-2">
                      {isCustomer && (
                        <Link href="/bookings" onClick={() => setIsUserMenuOpen(false)} className="flex items-center space-x-3 px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors duration-200">
                          <Calendar className="w-4 h-4" /><span>{t('myBookings')}</span>
                        </Link>
                      )}
                      {(isCustomer || isOperator) && (
                        <Link href="/profile" onClick={() => setIsUserMenuOpen(false)} className="flex items-center space-x-3 px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors duration-200">
                          <User className="w-4 h-4" /><span>{t('profile')}</span>
                        </Link>
                      )}
                      {isConductor ? (
                        <Link href="/company/conductor/dashboard" onClick={() => setIsUserMenuOpen(false)} className="flex items-center space-x-3 px-4 py-2 text-blue-700 font-medium hover:bg-blue-50 transition-colors duration-200">
                          <BusIcon className="w-4 h-4" /><span>{t('conductorDashboard')}</span>
                        </Link>
                      ) : (isSuperAdmin || isCompanyAdmin || isOperator) && adminRoute ? (
                        <Link href={adminRoute} onClick={() => setIsUserMenuOpen(false)} className="flex items-center space-x-3 px-4 py-2 text-purple-700 font-medium hover:bg-purple-50 transition-colors duration-200">
                          <Shield className="w-4 h-4" /><span>{adminLabel}</span>
                        </Link>
                      ) : null}
                    </div>
                    <div className="border-t border-gray-100 py-2">
                      <button onClick={handleLogout} className="flex items-center space-x-3 w-full px-4 py-2 text-red-600 hover:bg-red-50 transition-colors duration-200">
                        <LogOut className="w-4 h-4" /><span>{t('signOut')}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!loading && !user && (
              <div className="hidden md:flex items-center space-x-3">
                <Link href="/login" className="px-4 py-2 text-gray-700 hover:text-blue-600 font-medium transition-colors duration-200">{t('signIn')}</Link>
                <Link href="/register" className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200">{t('getStarted')}</Link>
              </div>
            )}

            <button className="md:hidden p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all duration-200" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden fixed inset-x-0 top-full bg-white/95 backdrop-blur-lg border-t border-gray-200/50 z-40 max-h-[calc(100vh-80px)] overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
            <nav className="space-y-2">
              {navigationItems.map(item => {
                const active = isActivePage(item.href);
                return (
                  <Link key={item.href} href={item.href} onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center space-x-3 p-3 rounded-xl font-medium transition-all duration-200 ${active ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                    <item.icon className="w-5 h-5" /><span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            {loading ? (
              <div className="pt-4 border-t border-gray-200"><UserSkeleton /></div>
            ) : user ? (
              <div className="pt-4 border-t border-gray-200 space-y-3">
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl">
                  <UserAvatar user={user} userProfile={userProfile} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-gray-900 truncate">{displayName}</div>
                    <div className="text-sm text-gray-500 truncate">{user?.email}</div>
                  </div>
                </div>
                {isConductor ? (
                  <Link href="/company/conductor/dashboard" onClick={() => setIsMenuOpen(false)} className="flex items-center space-x-3 p-3 bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 rounded-xl font-medium">
                    <BusIcon className="w-5 h-5" /><span>{t('conductorDashboard')}</span>
                  </Link>
                ) : (
                  <>
                    {adminRoute && (
                      <Link href={adminRoute} onClick={() => setIsMenuOpen(false)} className="flex items-center space-x-3 p-3 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 rounded-xl font-medium">
                        <Shield className="w-5 h-5" /><span>{adminLabel}</span>
                      </Link>
                    )}
                    {isCustomer && (
                      <Link href="/bookings" onClick={() => setIsMenuOpen(false)} className="flex items-center space-x-3 p-3 text-gray-700 hover:bg-gray-100 rounded-xl">
                        <Calendar className="w-5 h-5" /><span>{t('myBookings')}</span>
                      </Link>
                    )}
                    {(isCustomer || isOperator) && (
                      <Link href="/profile" onClick={() => setIsMenuOpen(false)} className="flex items-center space-x-3 p-3 text-gray-700 hover:bg-gray-100 rounded-xl">
                        <User className="w-5 h-5" /><span>{t('profile')}</span>
                      </Link>
                    )}
                  </>
                )}
                <button onClick={handleLogout} className="flex items-center space-x-3 w-full p-3 text-red-600 hover:bg-red-50 rounded-xl">
                  <LogOut className="w-5 h-5" /><span>{t('signOut')}</span>
                </button>
              </div>
            ) : (
              <div className="pt-4 border-t border-gray-200 space-y-3">
                <Link href="/login" onClick={() => setIsMenuOpen(false)} className="flex items-center justify-center p-3 text-gray-700 hover:bg-gray-100 rounded-xl font-medium">{t('signIn')}</Link>
                <Link href="/register" onClick={() => setIsMenuOpen(false)} className="flex items-center justify-center p-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium shadow-lg">{t('getStarted')}</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;