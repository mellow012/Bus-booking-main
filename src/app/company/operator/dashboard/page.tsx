'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Company, Schedule, Route, Bus, Booking } from '@/types';
import * as dbActions from '@/lib/actions/db.actions';

import {
  Loader2, LogOut, Navigation, MapPin, Calendar, LayoutDashboard, Menu, User, AlertTriangle, X, Users, Bus as BusIcon, TrendingUp, Clock, PlusCircle, Edit3, Settings, FileText, DollarSign, Activity, CheckCircle, XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';

import SchedulesTab from '@/components/scheduleTab';
import RoutesTab from '@/components/routesTab';
import BusesTab from '@/components/busesTab';
import BookingsTab from '@/components/bookingTab';
import DailyReportsTab from '@/components/ReportsTab';
import OperatorProfileTab from '@/components/OperatorProfileTab';
// import OverviewTab from '@/components/OverviewTab';
import { NotificationBell } from '@/contexts/NotificationContext';

const TABS = [
  { id: 'overview' as const, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'schedules' as const, label: 'Trips & Schedules', icon: Calendar },
  { id: 'bookings' as const, label: 'Bookings', icon: Users },
  { id: 'routes' as const, label: 'Routes', icon: MapPin },
  { id: 'buses' as const, label: 'Buses', icon: BusIcon },
  { id: 'reports' as const, label: 'Reports', icon: FileText },
  { id: 'profile' as const, label: 'Profile', icon: User }
] as const;

type TabType = typeof TABS[number]['id'];

export default function OperatorDashboard() {
  const { user, userProfile, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [dashboardData, setDashboardData] = useState<{ 
    company: Company | null, 
    schedules: Schedule[], 
    routes: Route[], 
    buses: Bus[], 
    bookings: Booking[],
    liveLocation: { lat: number, lng: number, updatedAt: string, address?: string } | null 
  }>({
    company: null, schedules: [], routes: [], buses: [], bookings: [], liveLocation: null
  });

  const companyId = userProfile?.companyId?.trim() || '';

  const fetchInitialData = useCallback(async (silent = false) => {
    if (!companyId || authLoading) return;
    try {
      if (!silent) setLoading(true);
      const { data: companyData } = await supabase.from('Company').select('*').eq('id', companyId).single();

      // Auto-archive: mark schedules older than 24h as archived
      const archiveCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      await supabase.from('Schedule')
        .update({ isArchived: true, status: 'completed' })
        .eq('companyId', companyId)
        .eq('isArchived', false)
        .lt('departureDateTime', archiveCutoff)
        .not('tripStatus', 'in', '("boarding","in_transit")');

      const [schedulesRes, routesRes, busesRes] = await Promise.all([
        supabase.from('Schedule').select('*').eq('companyId', companyId),
        supabase.from('Route').select('*').eq('companyId', companyId),
        supabase.from('Bus').select('*').eq('companyId', companyId)
      ]);

      if (schedulesRes.error) throw schedulesRes.error;
      if (routesRes.error) throw routesRes.error;
      if (busesRes.error) throw busesRes.error;

      const schedules = (schedulesRes.data || []).map(s => ({
        ...s,
        departureDateTime: new Date(s.departureDateTime),
        arrivalDateTime: new Date(s.arrivalDateTime)
      })) as Schedule[];

      const scheduleIds = schedules.map(s => s.id);
      let bookings: Booking[] = [];
      if (scheduleIds.length > 0) {
        const { data: bookingsData } = await supabase.from('Booking').select('*, Payment(*)').eq('companyId', companyId).in('scheduleId', scheduleIds);
        bookings = (bookingsData || []) as Booking[];
      }

      const liveTrip = schedules.find(s => ['boarding', 'in_transit', 'arrived'].includes(s.tripStatus || ''));
      let liveLocation = null;
      if (liveTrip) {
        const { data: logData } = await supabase.from('ActivityLog')
          .select('metadata')
          .eq('scheduleId', liveTrip.id)
          .eq('action', 'LOCATION_SYNC')
          .order('createdAt', { ascending: false })
          .limit(1)
          .single();
        if (logData?.metadata) {
          const lat = (logData.metadata as any).latitude;
          const lng = (logData.metadata as any).longitude;
          const updatedAt = (logData.metadata as any).syncedAt;
          
          let address = undefined;
          const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
          if (token && lat && lng) {
            try {
              const geoRes = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&limit=1&types=poi,address,place,neighborhood`);
              const geoData = await geoRes.json();
              address = geoData.features?.[0]?.place_name?.split(',')[0] || geoData.features?.[0]?.text;
            } catch (err) {
              console.warn("Mapbox geocoding failed:", err);
            }
          }

          // Fallback to Nominatim (OpenStreetMap) if Mapbox fails or token is missing
          if (!address && lat && lng) {
            try {
              const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`, {
                headers: { 'User-Agent': 'TibhukeBus-App' }
              });
              const geoData = await geoRes.json();
              address = geoData.display_name?.split(',')[0] || geoData.name || geoData.address?.suburb || geoData.address?.city;
            } catch (err) {
              console.warn("Nominatim geocoding failed:", err);
            }
          }

          liveLocation = { lat, lng, updatedAt, address };
        }
      }

      setDashboardData({
        company: companyData as Company,
        schedules,
        routes: (routesRes.data || []) as Route[],
        buses: (busesRes.data || []) as Bus[],
        bookings: bookings.map(b => ({ ...b, paymentMethod: (b as any).Payment?.[0]?.paymentType || (b.paymentStatus === 'paid' ? 'cash' : 'Not specified'), createdAt: new Date(b.createdAt) })) as Booking[],
        liveLocation
      });
    } catch (error: any) {
      console.error("Fetch error:", error);
      if (!silent) setGlobalError("Operational sync interrupted.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [companyId, authLoading]);

  const addItem = useCallback(async (table: string, data: any): Promise<string | null> => {
    try {
      const processed = { ...data, companyId };
      let result;

      if (table === "Schedule") result = await dbActions.createSchedule(processed);
      else if (table === "Route") result = await dbActions.createRoute(processed);
      else if (table === "Bus") result = await dbActions.createBus(processed);
      else throw new Error(`Unsupported table: ${table}`);

      if (!result.success) throw new Error(result.error);

      setGlobalError(''); // Clear error on success
      await fetchInitialData(true);
      return result.data!.id;
    } catch (err: any) {
      setGlobalError(err.message || `Failed to add ${table}`);
      return null;
    }
  }, [companyId, fetchInitialData]);

  const updateData = useCallback(<T extends keyof typeof dashboardData>(key: T, value: any) => {
    setDashboardData(prev => ({
      ...prev,
      [key]: typeof value === 'function' ? value(prev[key]) : value
    }));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user || userProfile?.role !== 'operator') { router.push('/login'); return; }
    fetchInitialData();
  }, [user, userProfile, authLoading, router, fetchInitialData]);

  // Real-time Subscriptions
  useEffect(() => {
    if (!companyId) return;
    const channels = [
      supabase.channel('ops-schedules').on('postgres_changes', { event: '*', schema: 'public', table: 'Schedule', filter: `companyId=eq.${companyId}` }, () => fetchInitialData(true)).subscribe(),
      supabase.channel('ops-bookings').on('postgres_changes', { event: '*', schema: 'public', table: 'Booking', filter: `companyId=eq.${companyId}` }, () => fetchInitialData(true)).subscribe(),
      supabase.channel('ops-location').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ActivityLog', filter: `companyId=eq.${companyId}` }, (payload) => {
        if ((payload.new as any).action === 'LOCATION_SYNC') {
           fetchInitialData(true);
        }
      }).subscribe(),
    ];
    const pollInterval = setInterval(() => fetchInitialData(true), 30000);
    return () => { channels.forEach(c => supabase.removeChannel(c)); clearInterval(pollInterval); };
  }, [companyId, fetchInitialData]);

  // Stats for Operator "Daily Snapshot"
  const stats = useMemo(() => {
    const { schedules, bookings } = dashboardData;
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);

    const todayTrips = schedules.filter(s => 
      s.status === 'active' && (
        (s.departureDateTime >= startOfToday && s.departureDateTime <= endOfToday) ||
        (['boarding', 'in_transit', 'arrived'].includes(s.tripStatus || ''))
      )
    );
    const todayTripIds = todayTrips.map(t => t.id);
    const todayBookings = bookings.filter(b => b.bookingStatus !== 'cancelled' && todayTripIds.includes(b.scheduleId));

    const revenueToday = todayBookings.filter(b => b.paymentStatus === 'paid').reduce((acc, b) => acc + (b.totalAmount || 0), 0);
    const seatsBooked = todayBookings.reduce((acc, b) => acc + (b.seatNumbers?.length || 1), 0);

    const totalCapacity = todayTrips.reduce((acc, trip) => {
      const bus = dashboardData.buses.find(b => b.id === trip.busId);
      return acc + (bus?.capacity || 0);
    }, 0);

    const occupancyRate = totalCapacity > 0 ? Math.round((seatsBooked / totalCapacity) * 100) : 0;

    const liveTrip = schedules.find(s => ['boarding', 'in_transit', 'arrived'].includes(s.tripStatus || '')) || todayTrips.filter(t => t.departureDateTime > new Date()).sort((a, b) => a.departureDateTime.getTime() - b.departureDateTime.getTime())[0];
    const liveTripBookings = liveTrip ? bookings.filter(b => b.scheduleId === liveTrip.id && b.bookingStatus !== 'cancelled') : [];

    return { 
      todayTripsCount: todayTrips.length, 
      seatsBooked, 
      revenueToday, 
      occupancyRate, 
      upcomingTrips: todayTrips.filter(t => t.departureDateTime > new Date()).sort((a, b) => a.departureDateTime.getTime() - b.departureDateTime.getTime()).slice(0, 5),
      liveTrip,
      liveTripBookings
    };
  }, [dashboardData]);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (loading || authLoading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 className="w-10 h-10 text-indigo-600 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans text-gray-900 selection:bg-indigo-100 selection:text-indigo-900 relative">

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-[60] lg:hidden backdrop-blur-sm animate-in fade-in duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside className={`
        fixed lg:sticky top-0 left-0 z-[70] w-64 bg-white border-r border-gray-100 flex flex-col h-screen overflow-hidden shadow-sm transition-all duration-500 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 border-b border-gray-50 flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100 text-white font-bold text-lg">
            {dashboardData.company?.name?.[0] || 'O'}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold tracking-tight uppercase text-sm truncate">{dashboardData.company?.name || 'Platform'}</h1>
            <p className="text-[10px] text-indigo-500 font-bold tracking-widest uppercase">Operator Console</p>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden p-2 text-gray-400 hover:bg-gray-50 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 px-3">Main</div>
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold ${activeTab === tab.id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}>
                <Icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-indigo-600' : ''}`} /> {tab.label}
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-gray-50">
          <button onClick={signOut} className="w-full flex items-center gap-3 px-4 py-3 text-red-500 font-semibold hover:bg-red-50 rounded-xl transition-all">
            <LogOut className="w-5 h-5" /> Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* HEADER */}
        <header className="h-20 bg-white border-b border-gray-100 px-6 sm:px-8 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2.5 hover:bg-gray-50 rounded-xl transition-colors border border-gray-100"
            >
              <Menu className="w-6 h-6 text-gray-600" />
            </button>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-gray-900 capitalize flex items-center gap-2">
              {activeTab === 'overview' ? 'Daily Snapshot' : activeTab.replace('-', ' ')}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full items-center gap-2 text-xs font-bold uppercase tracking-wider">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live Ops
            </div>
            <div className="flex items-center gap-2">
              {user && <NotificationBell userId={user.id} />}
              <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center font-bold text-indigo-700">
                {userProfile?.firstName?.[0] || 'U'}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-8 overflow-y-auto">
          {globalError && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between mb-6 border border-red-100">
              <span className="font-bold text-sm">{globalError}</span>
              <button onClick={() => setGlobalError('')}><X className="w-4 h-4" /></button>
            </div>
          )}

          {successMessage && (
            <div className="bg-emerald-50 text-emerald-700 px-4 py-3 rounded-xl flex items-center justify-between mb-6 border border-emerald-100">
              <span className="font-bold text-sm">{successMessage}</span>
          <button onClick={() => setSuccessMessage('')}><X className="w-4 h-4" /></button>
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Spotlight Section */}
              {stats.upcomingTrips.length > 0 || dashboardData.schedules.some(s => s.tripStatus === 'in_transit' || s.tripStatus === 'boarding' || s.tripStatus === 'arrived') ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2">
                    {(() => {
                      const liveTrip = dashboardData.schedules.find(s => s.tripStatus === 'in_transit' || s.tripStatus === 'boarding' || s.tripStatus === 'arrived') || stats.upcomingTrips[0];
                      if (!liveTrip) return null;
                      const route = dashboardData.routes.find(r => r.id === liveTrip.routeId) || null;
                      const bus = dashboardData.buses.find(b => b.id === liveTrip.busId) || null;
                      const bCount = dashboardData.bookings.filter(b => b.scheduleId === liveTrip.id).length;
                      
                      return (
                        <div className="bg-indigo-600 rounded-3xl p-8 text-white relative overflow-hidden shadow-xl shadow-indigo-100 h-full flex flex-col justify-center">
                          <div className="absolute right-0 top-0 p-8 opacity-10">
                            <BusIcon className="w-32 h-32" />
                          </div>
                          <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-4">
                              <div className={`w-2 h-2 rounded-full ${liveTrip.tripStatus === 'in_transit' ? 'bg-emerald-400 animate-pulse' : 'bg-white/50'}`} />
                              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">
                                {liveTrip.tripStatus === 'in_transit' ? 'Live Operations' : 
                                 liveTrip.tripStatus === 'boarding' ? 'Boarding Active' : 
                                 liveTrip.tripStatus === 'arrived' ? 'At Station' : 'Next Strategic Departure'}
                              </span>
                            </div>
                            <h3 className="text-3xl font-black uppercase tracking-tight mb-2">
                              {route ? `${route.origin} → ${route.destination}` : 'Route Corridor'}
                            </h3>
                            <div className="flex flex-wrap gap-4 mt-8">
                              <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10">
                                <p className="text-[8px] font-bold uppercase opacity-60 mb-1">Departure</p>
                                <p className="text-sm font-black">{new Date(liveTrip.departureDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                              </div>
                              <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10">
                                <p className="text-[8px] font-bold uppercase opacity-60 mb-1">Vessel</p>
                                <p className="text-sm font-black">{bus?.licensePlate || 'N/A'}</p>
                              </div>
                              <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10">
                                <p className="text-[8px] font-bold uppercase opacity-60 mb-1">Saturation</p>
                                <p className="text-sm font-black">{bCount} / {bus?.capacity || '?'} Units</p>
                              </div>
                            </div>

                            {/* Status & Location Sub-section */}
                            <div className="mt-8 pt-8 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div>
                                <p className="text-[10px] font-bold uppercase opacity-60 mb-2 tracking-widest">Operational Status</p>
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                                    <Activity className="w-5 h-5 text-emerald-400" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-black capitalize">{liveTrip.tripStatus?.replace('_', ' ') || 'In Operations'}</p>
                                    <p className="text-[10px] opacity-60 font-bold uppercase">
                                      {liveTrip.tripStatus === 'boarding' ? `At ${liveTrip.departureLocation}` : 
                                       liveTrip.tripStatus === 'in_transit' ? 'En Route to Destination' : 
                                       liveTrip.tripStatus === 'arrived' ? 'Stopped at Station' : 'Lifecycle Active'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              
                              <div>
                                <p className="text-[10px] font-bold uppercase opacity-60 mb-2 tracking-widest">Live GPS Coordinates</p>
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                                    <MapPin className="w-5 h-5 text-rose-400" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-black">
                                      {dashboardData.liveLocation?.address || (dashboardData.liveLocation ? `${dashboardData.liveLocation.lat.toFixed(4)}, ${dashboardData.liveLocation.lng.toFixed(4)}` : 'Awaiting Signal...')}
                                    </p>
                                    <p className="text-[10px] opacity-60 font-bold uppercase">
                                      {dashboardData.liveLocation ? `Last Sync: ${new Date(dashboardData.liveLocation.updatedAt).toLocaleTimeString()}${dashboardData.liveLocation.address ? ` (${dashboardData.liveLocation.lat.toFixed(2)}, ${dashboardData.liveLocation.lng.toFixed(2)})` : ''}` : 'Syncing with vessel'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Secondary stats or simple action cards */}
                  <div className="space-y-4">
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm h-full flex flex-col justify-center">
                       <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Quick Stats</p>
                       <div className="space-y-6">
                          <div className="flex items-center justify-between">
                             <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center"><DollarSign className="w-5 h-5 text-emerald-600" /></div>
                                <span className="text-[11px] font-bold text-gray-600 uppercase">Revenue Today</span>
                             </div>
                             <span className="text-sm font-black text-gray-900">MWK {stats.revenueToday.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between">
                             <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center"><Users className="w-5 h-5 text-blue-600" /></div>
                                <span className="text-[11px] font-bold text-gray-600 uppercase">Seats Sold</span>
                             </div>
                             <span className="text-sm font-black text-gray-900">{stats.seatsBooked} Units</span>
                          </div>
                          <div className="flex items-center justify-between">
                             <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center"><Activity className="w-5 h-5 text-amber-600" /></div>
                                <span className="text-[11px] font-bold text-gray-600 uppercase">Avg Occupancy</span>
                             </div>
                             <span className="text-sm font-black text-gray-900">{stats.occupancyRate}%</span>
                          </div>
                       </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-3xl p-12 border border-dashed border-gray-200 text-center">
                   <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                      <Calendar className="w-10 h-10 text-gray-200" />
                   </div>
                   <h3 className="text-xl font-bold text-gray-900 uppercase">No Active Operations</h3>
                   <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-2">Initialize your fleet schedules to see live data</p>
                </div>
              )}

              {/* Live Manifest Section */}
              {stats.liveTrip && (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
                   <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
                      <div>
                        <h3 className="font-bold text-gray-900 text-sm uppercase tracking-tight">Live Passenger Manifest</h3>
                        <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest mt-0.5">Current Vessel: {dashboardData.buses.find(b => b.id === stats.liveTrip?.busId)?.licensePlate || 'N/A'}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-gray-400 uppercase">Boarded</p>
                          <p className="text-xs font-black text-emerald-600">{stats.liveTripBookings.filter(b => b.bookingStatus === 'confirmed' || b.bookingStatus === 'completed').length} / {stats.liveTripBookings.length}</p>
                        </div>
                      </div>
                   </div>
                   
                   {stats.liveTripBookings.length > 0 ? (
                     <div className="overflow-x-auto">
                        <table className="w-full">
                           <thead className="bg-gray-50/50">
                              <tr>
                                 <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Passenger</th>
                                 <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Seat</th>
                                 <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                                 <th className="px-6 py-4 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">PNR</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-gray-50">
                              {stats.liveTripBookings.map(booking => (
                                <tr key={booking.id} className="hover:bg-gray-50/50 transition-colors">
                                   <td className="px-6 py-4">
                                      <p className="text-sm font-bold text-gray-900 uppercase tracking-tight">{booking.passengerDetails?.[0]?.name || 'Unknown'}</p>
                                      <p className="text-[10px] text-gray-400 font-medium">{booking.contactPhone || 'No contact'}</p>
                                   </td>
                                   <td className="px-6 py-4">
                                      <span className="inline-flex items-center justify-center w-8 h-8 bg-gray-50 rounded-lg text-xs font-black text-gray-700 border border-gray-100">
                                        {booking.seatNumbers?.[0] || '?'}
                                      </span>
                                   </td>
                                   <td className="px-6 py-4">
                                      <div className="flex items-center gap-2">
                                        <div className={`w-1.5 h-1.5 rounded-full ${
                                          booking.bookingStatus === 'confirmed' || booking.bookingStatus === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'
                                        }`} />
                                        <span className={`text-[10px] font-bold uppercase tracking-wider ${
                                          booking.bookingStatus === 'confirmed' || booking.bookingStatus === 'completed' ? 'text-emerald-600' : 'text-amber-600'
                                        }`}>
                                          {booking.bookingStatus === 'confirmed' || booking.bookingStatus === 'completed' ? 'On Board' : 'Pending'}
                                        </span>
                                      </div>
                                   </td>
                                   <td className="px-6 py-4 text-right">
                                      <p className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">{booking.bookingReference}</p>
                                   </td>
                                </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                   ) : (
                     <div className="p-12 text-center">
                        <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-dashed border-gray-200">
                           <Users className="w-8 h-8 text-gray-300" />
                        </div>
                        <h4 className="text-sm font-bold text-gray-900 uppercase">No Passengers Registered</h4>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">This trip currently has no confirmed bookings.</p>
                     </div>
                   )}
                </div>
              )}

              {/* Today's Manifest */}
              {stats.upcomingTrips.length > 0 && (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                   <div className="p-6 border-b border-gray-50 flex justify-between items-center">
                      <h3 className="font-bold text-gray-900 text-sm uppercase tracking-tight">Today&apos;s Manifest</h3>
                      <button onClick={() => setActiveTab('schedules')} className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest hover:underline">View all</button>
                   </div>
                   <div className="overflow-x-auto">
                      <table className="w-full">
                         <thead className="bg-gray-50/50">
                            <tr>
                               <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Route</th>
                               <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Departure</th>
                               <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Vessel</th>
                               <th className="px-6 py-4 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">Saturation</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-gray-50">
                            {stats.upcomingTrips.map(trip => {
                               const route = dashboardData.routes.find(r => r.id === trip.routeId);
                               const bus = dashboardData.buses.find(b => b.id === trip.busId);
                               const bCount = dashboardData.bookings.filter(b => b.scheduleId === trip.id).length;
                               const saturation = bus?.capacity ? Math.round((bCount / bus.capacity) * 100) : 0;
                               
                               return (
                                 <tr key={trip.id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="px-6 py-4">
                                       <p className="text-sm font-bold text-gray-900 uppercase tracking-tight">{route?.name || 'Unknown'}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                       <p className="text-xs font-bold text-gray-600">{new Date(trip.departureDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                       <p className="text-xs font-bold text-gray-500">{bus?.licensePlate || 'N/A'}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                       <div className="flex items-center gap-3 justify-center">
                                          <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                             <div className={`h-full transition-all duration-1000 ${saturation > 80 ? 'bg-rose-500' : 'bg-indigo-600'}`} style={{ width: `${saturation}%` }} />
                                          </div>
                                          <span className="text-[10px] font-bold text-gray-400 w-8">{saturation}%</span>
                                       </div>
                                    </td>
                                 </tr>
                               );
                            })}
                         </tbody>
                      </table>
                   </div>
                </div>
              )}
            </div>
          )}

          {/* Rendering Other Tabs if clicked */}
          {activeTab === 'schedules' && (
            <SchedulesTab
              companyId={companyId}
              schedules={dashboardData.schedules}
              routes={dashboardData.routes}
              buses={dashboardData.buses}
              setSchedules={(newSchedules) => {
                const updated = typeof newSchedules === 'function' ? newSchedules(dashboardData.schedules) : newSchedules;
                const withDates = updated.map(s => ({
                  ...s,
                  departureDateTime: s.departureDateTime instanceof Date ? s.departureDateTime : new Date(s.departureDateTime),
                  arrivalDateTime: s.arrivalDateTime instanceof Date ? s.arrivalDateTime : new Date(s.arrivalDateTime),
                }));
                updateData('schedules', withDates);
              }}
              addSchedule={(data) => addItem("Schedule", data)}
              setError={setGlobalError}
              setSuccess={(msg) => { setGlobalError(''); setSuccessMessage(msg); }}
              isAdmin={true}
              user={user}
              userProfile={userProfile}
            />
          )}
          {activeTab === 'bookings' && <BookingsTab schedules={dashboardData.schedules} routes={dashboardData.routes} buses={dashboardData.buses} companyId={companyId} user={user} userProfile={userProfile} />}
          {activeTab === 'routes' && <RoutesTab routes={dashboardData.routes} setRoutes={(val) => updateData('routes', val)} companyId={companyId} setError={setGlobalError} setSuccess={(msg) => { setGlobalError(''); setSuccessMessage(msg); }} />}
          {activeTab === 'buses' && <BusesTab buses={dashboardData.buses} setBuses={(val) => updateData('buses', val)} companyId={companyId} setError={setGlobalError} setSuccess={(msg) => { setGlobalError(''); setSuccessMessage(msg); }} subscriptionTier="premium" schedules={dashboardData.schedules} bookings={dashboardData.bookings} />}
          {activeTab === 'reports' && (
            <DailyReportsTab
              schedules={dashboardData.schedules}
              bookings={dashboardData.bookings}
              buses={dashboardData.buses}
              routes={dashboardData.routes}
              companyId={companyId}
              user={user}
              userProfile={userProfile}
              setError={setGlobalError}
              setSuccess={(msg) => { setGlobalError(''); setSuccessMessage(msg); }}
            />
          )}
          {activeTab === 'profile' && (
            <OperatorProfileTab
              userProfile={userProfile}
              companyName={dashboardData.company?.name}
              setError={setGlobalError}
              setSuccess={(msg) => { setGlobalError(''); setSuccessMessage(msg); }}
            />
          )}

        </main>
      </div>
    </div>
  );
}
