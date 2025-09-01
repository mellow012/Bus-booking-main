'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { 
  Menu, 
  X, 
  User, 
  Settings, 
  LogOut, 
  Bell, 
  Search,
  BusIcon,
  Calendar,
  Shield,
  ChevronDown,
  MapPin,
  Clock,
  Zap
} from 'lucide-react';

// Avatar component for user profile
const UserAvatar = ({ user, userProfile }: { user: any, userProfile: any }) => {
  if (userProfile?.avatar) {
    return (
      <img 
        src={userProfile.avatar} 
        alt="Profile" 
        className="w-8 h-8 rounded-full object-cover border-2 border-blue-200"
      />
    );
  }
  
  const initial = userProfile?.firstName?.[0] || user?.email?.[0] || 'U';
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm">
      {initial.toUpperCase()}
    </div>
  );
};

// Skeleton for user profile loading
const UserSkeleton = () => (
  <div className="flex items-center space-x-3">
    <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse"></div>
    <div className="hidden md:block">
      <div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
    </div>
  </div>
);

// Navigation items configuration
const navigationItems = [
  { href: '/', label: 'Home', icon: MapPin },
  { href: '/search', label: 'Search Buses', icon: Search },
  { href: '/schedules', label: 'Schedules', icon: Calendar },
];

const userMenuItems = [
  { href: '/bookings', label: 'My Bookings', icon: Calendar },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const Header: React.FC = () => {
  const { user, userProfile, signOut, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [notifications, setNotifications] = useState(3); // Mock notifications
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await signOut();
      setIsUserMenuOpen(false);
      router.push('/');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const isActivePage = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const isAdmin = userProfile?.role === 'superadmin' || userProfile?.role === 'company_admin';

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? 'bg-white/95 backdrop-blur-lg shadow-lg border-b border-gray-200/50' 
          : 'bg-white/80 backdrop-blur-sm'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            {/* Enhanced Logo */}
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105">
                  <BusIcon className="w-5 h-5 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
              </div>
              <div className="hidden sm:block">
                <span className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent group-hover:from-blue-600 group-hover:to-indigo-600 transition-all duration-300">
                  BooknPay
                </span>
                <div className="text-xs text-gray-500 -mt-1">Smart Travel</div>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-1">
              {navigationItems.map((item) => {
                const isActive = isActivePage(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-blue-100 text-blue-700 shadow-sm'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Right Side Actions */}
            <div className="flex items-center space-x-4">
              {/* Notifications (for authenticated users) */}
              {user && (
                <button className="relative p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all duration-200">
                  <Bell className="w-5 h-5" />
                  {notifications > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium animate-pulse">
                      {notifications}
                    </span>
                  )}
                </button>
              )}

              {/* User Authentication */}
              <div className="hidden md:flex items-center space-x-3">
                {loading ? (
                  <UserSkeleton />
                ) : user ? (
                  <div className="flex items-center space-x-3">
                    {/* Admin Badge */}
                    {isAdmin && (
                      <Link
                        href="/admin"
                        className="flex items-center space-x-2 px-3 py-1.5 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 rounded-lg text-sm font-medium hover:from-purple-200 hover:to-pink-200 transition-all duration-200"
                      >
                        <Shield className="w-4 h-4" />
                        <span>Admin</span>
                      </Link>
                    )}

                    {/* User Menu */}
                    <div className="relative" ref={userMenuRef}>
                      <button
                        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                        className="flex items-center space-x-3 p-2 rounded-xl hover:bg-gray-100 transition-all duration-200 group"
                      >
                        <UserAvatar user={user} userProfile={userProfile} />
                        <div className="text-left">
                          <div className="text-sm font-semibold text-gray-900 group-hover:text-blue-600">
                            {userProfile?.firstName || 'User'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {userProfile?.role || 'Member'}
                          </div>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
                          isUserMenuOpen ? 'rotate-180' : ''
                        }`} />
                      </button>

                      {/* User Dropdown Menu */}
                      {isUserMenuOpen && (
                        <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-200 py-2 animate-in fade-in slide-in-from-top-5 duration-200">
                          <div className="px-4 py-3 border-b border-gray-100">
                            <div className="flex items-center space-x-3">
                              <UserAvatar user={user} userProfile={userProfile} />
                              <div>
                                <div className="font-semibold text-gray-900">
                                  {userProfile?.firstName} {userProfile?.lastName}
                                </div>
                                <div className="text-sm text-gray-500">{user.email}</div>
                              </div>
                            </div>
                          </div>

                          <div className="py-2">
                            {userMenuItems.map((item) => (
                              <Link
                                key={item.href}
                                href={item.href}
                                className="flex items-center space-x-3 px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors duration-200"
                                onClick={() => setIsUserMenuOpen(false)}
                              >
                                <item.icon className="w-4 h-4" />
                                <span>{item.label}</span>
                              </Link>
                            ))}
                          </div>

                          <div className="border-t border-gray-100 py-2">
                            <button
                              onClick={handleLogout}
                              className="flex items-center space-x-3 w-full px-4 py-2 text-red-600 hover:bg-red-50 transition-colors duration-200"
                            >
                              <LogOut className="w-4 h-4" />
                              <span>Sign Out</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center space-x-3">
                    <Link
                      href="/login"
                      className="text-gray-700 hover:text-blue-600 font-medium px-4 py-2 rounded-xl hover:bg-gray-100 transition-all duration-200"
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/register"
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-2 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                      Get Started
                    </Link>
                  </div>
                )}
              </div>

              {/* Mobile Menu Button */}
              <button
                className="md:hidden p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all duration-200"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-white/95 backdrop-blur-lg border-t border-gray-200/50">
            <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
              {/* Mobile Navigation */}
              <nav className="space-y-2">
                {navigationItems.map((item) => {
                  const isActive = isActivePage(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center space-x-3 p-3 rounded-xl font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <item.icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              {/* Mobile User Section */}
              {loading ? (
                <div className="pt-4 border-t border-gray-200">
                  <UserSkeleton />
                </div>
              ) : user ? (
                <div className="pt-4 border-t border-gray-200 space-y-3">
                  {/* User Info */}
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl">
                    <UserAvatar user={user} userProfile={userProfile} />
                    <div>
                      <div className="font-semibold text-gray-900">
                        {userProfile?.firstName} {userProfile?.lastName}
                      </div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </div>

                  {/* Admin Link */}
                  {isAdmin && (
                    <Link
                      href="/admin"
                      className="flex items-center space-x-3 p-3 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 rounded-xl font-medium"
                    >
                      <Shield className="w-5 h-5" />
                      <span>Admin Panel</span>
                    </Link>
                  )}

                  {/* User Menu Items */}
                  <div className="space-y-2">
                    {userMenuItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center space-x-3 p-3 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors duration-200"
                      >
                        <item.icon className="w-5 h-5" />
                        <span>{item.label}</span>
                      </Link>
                    ))}
                  </div>

                  {/* Logout Button */}
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-3 w-full p-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors duration-200"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              ) : (
                <div className="pt-4 border-t border-gray-200 space-y-3">
                  <Link
                    href="/login"
                    className="flex items-center justify-center p-3 text-gray-700 hover:bg-gray-100 rounded-xl font-medium transition-all duration-200"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    className="flex items-center justify-center p-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium shadow-lg"
                  >
                    Get Started
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Spacer to prevent content from going under fixed header */}
      <div className="h-20"></div>
    </>
  );
};

export default Header;