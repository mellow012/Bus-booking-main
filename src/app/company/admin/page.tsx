'use client';
import { useRef } from 'react';
import {
  Building2, Loader2, DollarSign, Users, Calendar, MapPin, X, User,
  Settings, AlertTriangle, Bell, Menu, LayoutDashboard, Search, HelpCircle,
  PieChart, Bus as BusIcon, MessageSquare,
} from 'lucide-react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import Fuse from 'fuse.js';
import AlertMessage from '@/components/AlertMessage';
import SchedulesTab from '@/components/scheduleTab';
import RoutesTab from '@/components/routesTab';
import BusesTab from '@/components/busesTab';
import BookingsTab from '@/components/bookingTab';
import CompanyProfileTab from '@/components/company-Profile';
import SettingsTab from '@/components/SettingsTab';
import PaymentsTab from '@/components/PaymentTab';
import TeamManagementTab from '@/components/OperatorsTab';
import OverviewTab from '@/components/OverviewTab';
import DailyReportsTab from '@/components/ReportsTab';
import NotificationsManagementTab from '@/components/NotificationsManagementTab';
import TeamMessagingTab from '@/components/TeamMessagingTab';
import ChartersTab from '@/components/ChartersTab';
import DashboardBottomNav from '@/components/DashboardBottomNav';
import Image from 'next/image';

// ── Extracted sub-components & hooks ─────────────────────────────────────────
import DashboardSidebar from './_components/DashboardSidebar';
import DashboardSubNav from './_components/DashboardSubNav';
import useAdminDashboard from './_hooks/useAdminDashboard';
import {
  TABS, CATEGORIES, BUS_TYPES, BUS_STATUSES, CAPACITY_LIMITS,
  TabType, CategoryType, DashboardData, TabObject,
  validateBusData, getAvailableTabs,
} from './_lib/constants';

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const {
    user, userProfile, authLoading, signOut,
    activeTab, setActiveTab, activeCategory, setActiveCategory, categorySubTabs, setCategorySubTabs,
    isMobileOpen, setIsMobileOpen, isCollapsed, setIsCollapsed,
    dashboardData, setDashboardData, loading, searchQuery, setSearchQuery, searchFocused, setSearchFocused, searchRef,
    bookings, setBookings, realtimeStatus,
    statistics, paymentSettings, availableTabs, isValidUser,
    fetchInitialData, fetchCollectionData, updateDashboardData, addItem,
    alert, showAlert, clearAlert,
  } = useAdminDashboard();

  const companyId = userProfile?.companyId?.trim() || '';

  const startTour = () => {
    const driverObj = driver({
      showProgress: true,
      steps: [
        { element: '#tour-sidebar-toggle', popover: { title: 'Collapse Sidebar', description: 'Collapse to a mini-rail for more screen space.', side: 'bottom' } },
        { element: '#tour-overview', popover: { title: 'Overview Dashboard', description: 'Snapshot of company performance.', side: 'bottom' } },
        { element: '#tour-fleet', popover: { title: 'Fleet & Operations', description: 'Manage Schedules, Routes, and Buses.', side: 'bottom' } },
        { element: '#tour-sales', popover: { title: 'Sales & Revenue', description: 'Access Bookings, Reports, and Payments.', side: 'bottom' } },
        { element: '#tour-team', popover: { title: 'Team Management', description: 'Control staff access.', side: 'bottom' } },
        { element: '.tour-search-container', popover: { title: 'Quick Search', description: 'Find any route, bus, or schedule instantly.', side: 'bottom' } },
      ]
    });
    driverObj.drive();
  };

  const renderActiveTab = () => {
    const { company, schedules, routes, buses } = dashboardData;
    const commonProps = {
      setError:   (msg: string) => showAlert('error'   as const, msg),
      setSuccess: (msg: string) => showAlert('success' as const, msg),
    } as const;
    if (loading) return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 animate-pulse rounded" />
        <div className="h-96 bg-gray-200 animate-pulse rounded" />
      </div>
    );
    switch (activeTab) {
      case 'overview': return <OverviewTab dashboardData={dashboardData} realtimeStatus={realtimeStatus} setActiveTab={setActiveTab} />;
      case 'schedules': return (
        <SchedulesTab companyId={companyId} schedules={schedules} user={user} userProfile={userProfile}
          setSchedules={(ns) => updateDashboardData('schedules', Array.isArray(ns) ? ns : schedules)}
          routes={routes} buses={buses}
          addSchedule={async (data) => addItem('Schedule', { ...data, departureDateTime: new Date(data.departureDateTime), arrivalDateTime: new Date(data.arrivalDateTime) })}
          isAdmin={userProfile?.role === 'company_admin' || userProfile?.role === 'superadmin'}
          {...commonProps} />
      );
      case 'charters': return <ChartersTab companyId={companyId} setError={(m) => showAlert('error', m)} setSuccess={(m) => showAlert('success', m)} />;
      case 'routes': return (
        <RoutesTab companyId={companyId} routes={routes}
          setRoutes={(nr) => updateDashboardData('routes', typeof nr === 'function' ? nr(routes) : nr)}
          {...commonProps} />
      );
      case 'buses': return (
        <BusesTab buses={buses} companyId={companyId}
          setBuses={(nb) => updateDashboardData('buses', typeof nb === 'function' ? nb(buses) : nb)}
          {...commonProps} />
      );
      case 'bookings': return (
        <BookingsTab schedules={schedules} routes={routes} buses={buses} companyId={companyId}
          user={user} userProfile={userProfile}
          isAdmin={userProfile?.role === 'company_admin' || userProfile?.role === 'superadmin'} />
      );
      case 'profile': return company ? (
        <CompanyProfileTab company={company} schedules={schedules} routes={routes}
          setCompany={(c) => updateDashboardData('company', c as any)} {...commonProps} />
      ) : null;
      case 'settings': return company ? (
        <SettingsTab company={company} setCompany={(c) => updateDashboardData('company', c as any)} {...commonProps} />
      ) : null;
      case 'operators': return company ? <TeamManagementTab companyId={companyId} {...commonProps} /> : null;
      case 'payments': return company ? (
        <PaymentsTab company={company} paymentSettings={paymentSettings as unknown as Record<string, unknown> ?? {}}
          bookings={bookings} buses={buses} {...commonProps} />
      ) : null;
      case 'reports': return (
        <DailyReportsTab schedules={schedules} bookings={bookings} buses={buses} routes={routes}
          companyId={companyId} user={user} userProfile={userProfile} {...commonProps} />
      );
      case 'notifications': return (
        <NotificationsManagementTab userId={userProfile?.id || userProfile?.uid || user?.id || ''} companyId={companyId} {...commonProps} />
      );
      case 'messages': return (
        <TeamMessagingTab companyId={companyId} setError={(m) => showAlert('error', m)} setSuccess={(m) => showAlert('success', m)} />
      );
      default: return <div className="text-center py-12"><p className="text-gray-500">Tab not found</p></div>;
    }
  };

  if (loading || authLoading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center"><Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto" /><p className="mt-4 text-gray-600">Loading dashboard...</p></div>
    </div>
  );
  if (!isValidUser) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center bg-white p-8 rounded-2xl shadow-lg max-w-md">
        <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Access Denied</h2>
        <p className="text-gray-600 mb-6">You don&apos;t have permission to access this dashboard.</p>
        <button onClick={() => (window.location.href = '/login')} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">Go to Login</button>
      </div>
    </div>
  );
  if (!dashboardData.company) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center bg-white p-8 rounded-2xl shadow-lg max-w-md">
        <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Company Not Found</h2>
        <p className="text-gray-600 mb-6">Please ensure your company is set up correctly.</p>
        <button onClick={() => (window.location.href = '/support')} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">Contact Support</button>
      </div>
    </div>
  );

  const { company } = dashboardData;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <DashboardSidebar
        activeCategory={activeCategory as CategoryType}
        setActiveCategory={(cat) => { setActiveCategory(cat); setActiveTab(categorySubTabs[cat]); }}
        isMobileOpen={isMobileOpen} setIsMobileOpen={setIsMobileOpen}
        company={company} onSignOut={signOut}
        isCollapsed={isCollapsed} onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        statistics={statistics}
      />

      <div className={`flex-1 flex flex-col min-h-screen relative transition-all duration-300 ease-in-out ${isCollapsed ? 'lg:pl-[72px]' : 'lg:pl-64'}`}>
        <header className="bg-white border-b border-gray-100 sticky top-0 z-30 shadow-sm">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center space-x-4 flex-1">
              <button onClick={() => setIsMobileOpen(true)} className="lg:hidden p-2 hover:bg-gray-100 rounded-lg">
                <Menu className="w-5 h-5" />
              </button>
              {/* Fuzzy Search */}
              <div ref={searchRef} className="hidden md:block relative max-w-md w-full tour-search-container">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2 z-10" />
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)} onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                  placeholder="Search routes, buses, or schedules…"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-800 placeholder-gray-400 font-medium transition-all"
                />
                {searchFocused && searchQuery.trim().length > 0 && (() => {
                  const q = searchQuery.trim();
                  const routeFuse    = new Fuse(dashboardData.routes,    { keys: ['origin', 'destination'], threshold: 0.3 });
                  const busFuse      = new Fuse(dashboardData.buses,     { keys: ['licensePlate', 'busType'], threshold: 0.3 });
                  const scheduleFuse = new Fuse(dashboardData.schedules, {
                    keys: [
                      { name: 'route.origin',       getFn: (s) => dashboardData.routes.find(r => r.id === s.routeId)?.origin || '' },
                      { name: 'route.destination',  getFn: (s) => dashboardData.routes.find(r => r.id === s.routeId)?.destination || '' },
                      { name: 'bus.licensePlate',   getFn: (s) => dashboardData.buses.find(b  => b.id === s.busId)?.licensePlate  || '' },
                    ], threshold: 0.3,
                  });
                  const matchedRoutes    = routeFuse.search(q).map(r => r.item).slice(0, 3);
                  const matchedBuses     = busFuse.search(q).map(b => b.item).slice(0, 3);
                  const matchedSchedules = scheduleFuse.search(q).map(s => s.item).slice(0, 3);
                  const hasResults = matchedRoutes.length > 0 || matchedBuses.length > 0 || matchedSchedules.length > 0;
                  return hasResults ? (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50 max-h-80 overflow-y-auto">
                      {matchedRoutes.length > 0 && <div>
                        <p className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50">Routes</p>
                        {matchedRoutes.map(r => (
                          <button key={r.id} onClick={() => { setActiveTab('routes'); setSearchQuery(''); }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 transition-colors text-left">
                            <MapPin className="w-4 h-4 text-indigo-500 shrink-0" />
                            <div><p className="text-sm font-semibold text-gray-900">{r.origin} → {r.destination}</p><p className="text-xs text-gray-400">{r.isActive ? 'Active' : 'Inactive'}</p></div>
                          </button>
                        ))}
                      </div>}
                      {matchedBuses.length > 0 && <div>
                        <p className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50">Buses</p>
                        {matchedBuses.map(b => (
                          <button key={b.id} onClick={() => { setActiveTab('buses'); setSearchQuery(''); }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 transition-colors text-left">
                            <BusIcon className="w-4 h-4 text-green-500 shrink-0" />
                            <div><p className="text-sm font-semibold text-gray-900">{b.licensePlate}</p><p className="text-xs text-gray-400">{b.busType} · {b.capacity} seats · {b.status}</p></div>
                          </button>
                        ))}
                      </div>}
                      {matchedSchedules.length > 0 && <div>
                        <p className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50">Schedules</p>
                        {matchedSchedules.map(s => {
                          const route = dashboardData.routes.find(r => r.id === s.routeId);
                          return (
                            <button key={s.id} onClick={() => { setActiveTab('schedules'); setSearchQuery(''); }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 transition-colors text-left">
                              <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
                              <div><p className="text-sm font-semibold text-gray-900">{route ? `${route.origin} → ${route.destination}` : 'Schedule'}</p><p className="text-xs text-gray-400">{s.status}</p></div>
                            </button>
                          );
                        })}
                      </div>}
                    </div>
                  ) : (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-6 text-center">
                      <Search className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No results for &quot;{searchQuery}&quot;</p>
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setActiveTab('notifications')}
                className="relative p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors tour-bell"
                title={statistics.pendingBookings > 0 ? `${statistics.pendingBookings} pending` : 'No pending bookings'}>
                <Bell className="w-5 h-5" />
                {statistics.pendingBookings > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white">
                    {statistics.pendingBookings > 9 ? '9+' : statistics.pendingBookings}
                  </span>
                )}
              </button>
              <button onClick={startTour} className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors" title="Tour Dashboard">
                <HelpCircle className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3 border-l border-gray-200 pl-4">
                <button onClick={() => setActiveTab('profile')} className="flex items-center gap-3 hover:bg-gray-50 rounded-lg px-2 py-1.5 transition-colors">
                  <div className="text-right hidden sm:block">
                    <p className="text-[13px] font-bold text-gray-900 leading-tight">
                      {userProfile?.firstName && userProfile?.lastName ? `${userProfile.firstName} ${userProfile.lastName}` : user?.email?.split('@')[0] || 'Admin'}
                    </p>
                    <p className="text-[10px] font-medium text-gray-400 capitalize">{userProfile?.role?.replace('_', ' ') || 'Admin'}</p>
                  </div>
                  <div className="w-9 h-9 rounded-full bg-indigo-900 border-2 border-indigo-200 shadow-sm overflow-hidden flex items-center justify-center text-white text-sm font-bold">
                    {company?.logo ? <Image src={company.logo} alt="Company logo" width={36} height={36} className="w-full h-full object-cover" /> : (userProfile?.firstName?.[0] || 'A').toUpperCase()}
                  </div>
                </button>
              </div>
            </div>
          </div>
        </header>

        <DashboardSubNav
          activeTab={activeTab as TabType}
          setActiveTab={(tab) => { setActiveTab(tab); setCategorySubTabs(prev => ({ ...prev, [activeCategory]: tab })); }}
          subTabs={CATEGORIES.find(c => c.id === activeCategory)?.subTabs || [] as any}
          availableTabs={availableTabs}
          statistics={statistics}
        />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8 pb-32 lg:pb-8">
          <div className="max-w-[1600px] mx-auto">
            {company.status !== 'active' && (
              <div className={`mb-6 p-4 rounded-xl border flex items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-500 ${company.status === 'inactive' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
                <AlertTriangle className={`w-5 h-5 shrink-0 ${company.status === 'inactive' ? 'text-amber-600' : 'text-blue-600'}`} />
                <div>
                  <p className="font-bold text-sm">{company.status === 'inactive' ? 'Company Operations are Paused' : 'Company in Setup Mode'}</p>
                  <p className="text-xs opacity-90">{company.status === 'inactive' ? 'Your routes and schedules are currently hidden from customers.' : 'Your company is in setup mode and not yet visible to customers.'}</p>
                </div>
              </div>
            )}
            {alert && <div className="mb-6"><AlertMessage type={alert.type} message={alert.message} onClose={clearAlert} /></div>}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">{renderActiveTab()}</div>
          </div>
        </main>

        <DashboardBottomNav
          activeTab={activeTab as TabType}
          onTabChange={(tabId) => {
            setActiveTab(tabId as TabType);
            const category = CATEGORIES.find(c => (c.subTabs as readonly string[]).includes(tabId))?.id;
            if (category) setActiveCategory(category);
          }}
          tabs={[
            { id: 'overview',   label: 'Home',  icon: LayoutDashboard },
            { id: 'schedules',  label: 'Trips', icon: Calendar },
            { id: 'bookings',   label: 'Sales', icon: DollarSign, badge: statistics.pendingBookings > 0 },
            { id: 'operators',  label: 'Team',  icon: Users },
            { id: 'buses',      label: 'Fleet', icon: BusIcon },
          ]}
        />
      </div>
    </div>
  );
}
