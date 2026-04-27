'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Company, Schedule, Route, Bus, Booking } from '@/types';
import * as dbActions from '@/lib/actions/db.actions';

import {
  Loader2, LogOut, Navigation, MapPin, Calendar, LayoutDashboard, User, AlertTriangle, X, Users, Bus as BusIcon, TrendingUp, Clock, PlusCircle, Edit3, Settings, FileText, DollarSign, Activity, CheckCircle, XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';

import SchedulesTab from '@/components/scheduleTab';
import RoutesTab from '@/components/routesTab';
import BusesTab from '@/components/busesTab';
import BookingsTab from '@/components/bookingTab';
import DailyReportsTab from '@/components/ReportsTab';
import OperatorProfileTab from '@/components/OperatorProfileTab';

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
  
  const [dashboardData, setDashboardData] = useState<{ company: Company | null, schedules: Schedule[], routes: Route[], buses: Bus[], bookings: Booking[] }>({
    company: null, schedules: [], routes: [], buses: [], bookings: [],
  });

  const companyId = userProfile?.companyId?.trim() || '';

  const fetchInitialData = useCallback(async (silent = false) => {
    if (!companyId || authLoading) return;
    try {
      if (!silent) setLoading(true);
      const { data: companyData } = await supabase.from('Company').select('*').eq('id', companyId).single();
      
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

      setDashboardData({
        company: companyData as Company,
        schedules,
        routes: (routesRes.data || []) as Route[],
        buses: (busesRes.data || []) as Bus[],
        bookings: bookings.map(b => ({ ...b, paymentMethod: (b as any).Payment?.[0]?.paymentType || (b.paymentStatus === 'paid' ? 'cash' : 'Not specified'), createdAt: new Date(b.createdAt) })) as Booking[],
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
      else if (table === "Route")   result = await dbActions.createRoute(processed);
      else if (table === "Bus")     result = await dbActions.createBus(processed);
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
    ];
    const pollInterval = setInterval(() => fetchInitialData(true), 30000);
    return () => { channels.forEach(c => supabase.removeChannel(c)); clearInterval(pollInterval); };
  }, [companyId, fetchInitialData]);

  // Stats for Operator "Daily Snapshot"
  const stats = useMemo(() => {
    const { schedules, bookings } = dashboardData;
    const startOfToday = new Date(); startOfToday.setHours(0,0,0,0);
    const endOfToday = new Date(); endOfToday.setHours(23,59,59,999);

    const todayTrips = schedules.filter(s => s.status === 'active' && s.departureDateTime >= startOfToday && s.departureDateTime <= endOfToday);
    const todayTripIds = todayTrips.map(t => t.id);
    const todayBookings = bookings.filter(b => b.bookingStatus !== 'cancelled' && todayTripIds.includes(b.scheduleId));
    
    const revenueToday = todayBookings.filter(b => b.paymentStatus === 'paid').reduce((acc, b) => acc + (b.totalAmount || 0), 0);
    const seatsBooked = todayBookings.reduce((acc, b) => acc + (b.seatNumbers?.length || 1), 0);
    
    const totalCapacity = todayTrips.reduce((acc, trip) => {
        const bus = dashboardData.buses.find(b => b.id === trip.busId);
        return acc + (bus?.capacity || 0);
    }, 0);
    
    const occupancyRate = totalCapacity > 0 ? Math.round((seatsBooked / totalCapacity) * 100) : 0;

    return { todayTripsCount: todayTrips.length, seatsBooked, revenueToday, occupancyRate, upcomingTrips: todayTrips.filter(t => t.departureDateTime > new Date()).sort((a,b) => a.departureDateTime.getTime() - b.departureDateTime.getTime()).slice(0, 5) };
  }, [dashboardData]);

  if (loading || authLoading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 className="w-10 h-10 text-indigo-600 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans text-gray-900 selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* MINIMAL SIDEBAR */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-gray-100 flex-col sticky top-0 h-screen overflow-hidden shadow-sm z-50">
        <div className="p-6 border-b border-gray-50 flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100 text-white font-bold text-lg">
             {dashboardData.company?.name?.[0] || 'O'}
          </div>
          <div>
            <h1 className="font-bold tracking-tight uppercase text-sm truncate">{dashboardData.company?.name || 'Platform'}</h1>
            <p className="text-[10px] text-indigo-500 font-bold tracking-widest uppercase">Operator Console</p>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
           <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 px-3">Main</div>
           {TABS.map(tab => {
             const Icon = tab.icon;
             return (
               <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold ${activeTab === tab.id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}>
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
        <header className="h-20 bg-white border-b border-gray-100 px-8 flex items-center justify-between sticky top-0 z-40">
           <h2 className="text-2xl font-extrabold tracking-tight text-gray-900 capitalize flex items-center gap-2">
             {activeTab === 'overview' ? 'Daily Snapshot' : activeTab.replace('-', ' ')}
           </h2>
           <div className="flex items-center gap-4">
             <div className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
               <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live Ops
             </div>
             <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center font-bold text-indigo-700">
               {userProfile?.firstName?.[0] || 'U'}
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
             <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                
                {/* 1. TOP SNAPSHOT METRICS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
                     <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><Calendar className="w-5 h-5 text-blue-600" /></div>
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Today's Trips</p>
                     </div>
                     <p className="text-3xl font-black text-gray-900">{stats.todayTripsCount}</p>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
                     <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center"><Users className="w-5 h-5 text-indigo-600" /></div>
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Seats Booked</p>
                     </div>
                     <p className="text-3xl font-black text-gray-900">{stats.seatsBooked}</p>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
                     <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center"><DollarSign className="w-5 h-5 text-emerald-600" /></div>
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Revenue Today</p>
                     </div>
                     <p className="text-3xl font-black text-emerald-600">MWK {stats.revenueToday.toLocaleString()}</p>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
                     <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-amber-600" /></div>
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Occupancy Rate</p>
                     </div>
                     <div className="flex items-end gap-2">
                        <p className="text-3xl font-black text-gray-900">{stats.occupancyRate}%</p>
                     </div>
                  </div>
                </div>

                {/* KEY ACTIONS (The Obvious Buttons) */}
                <div className="flex gap-4 mb-2">
                   <Button onClick={() => setActiveTab('schedules')} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl h-14 font-bold shadow-md shadow-indigo-100 text-base">
                     <PlusCircle className="w-5 h-5 mr-2" /> Create Trip
                   </Button>
                   <Button onClick={() => setActiveTab('routes')} variant="outline" className="flex-1 bg-white hover:bg-gray-50 text-gray-700 rounded-2xl h-14 font-bold shadow-sm border-gray-200 text-base">
                     <Edit3 className="w-5 h-5 mr-2" /> Manage Routes
                   </Button>
                   <Button onClick={() => setActiveTab('buses')} variant="outline" className="flex-1 bg-white hover:bg-gray-50 text-gray-700 rounded-2xl h-14 font-bold shadow-sm border-gray-200 text-base">
                     <BusIcon className="w-5 h-5 mr-2 text-indigo-600" /> Fleet Status
                   </Button>
                </div>

                {/* 2. MIDDLE (Upcoming Trips & Status) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                   {/* Upcoming Trips (2 columns wide) */}
                   <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2"><Clock className="w-5 h-5 text-indigo-500" /> Upcoming Departures</h3>
                        <Button variant="link" onClick={() => setActiveTab('schedules')} className="text-indigo-600 font-bold p-0">View all</Button>
                      </div>
                      
                      <div className="space-y-3">
                        {stats.upcomingTrips.length === 0 ? (
                           <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                             <CheckCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                             <p className="text-gray-500 font-medium">No more trips scheduled for today.</p>
                           </div>
                        ) : (
                           stats.upcomingTrips.map(trip => {
                             const route = dashboardData.routes.find(r => r.id === trip.routeId);
                             const bus = dashboardData.buses.find(b => b.id === trip.busId);
                             return (
                               <div key={trip.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-indigo-200 transition-colors">
                                 <div className="flex items-center gap-4">
                                   <div className="w-14 h-14 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
                                      <span className="text-[10px] text-gray-400 font-bold uppercase">{trip.departureDateTime.toLocaleDateString([], { month: 'short'})}</span>
                                      <span className="text-lg font-black text-indigo-900 leading-none">{trip.departureDateTime.getDate()}</span>
                                   </div>
                                   <div>
                                      <p className="font-bold text-gray-900 text-lg">{route?.origin || trip.departureLocation} → {route?.destination || trip.arrivalLocation}</p>
                                      <p className="text-sm font-medium text-gray-500 flex items-center gap-2 mt-0.5">
                                        <Clock className="w-3.5 h-3.5" /> {trip.departureDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'})}
                                        <span className="w-1 h-1 rounded-full bg-gray-300" />
                                        <BusIcon className="w-3.5 h-3.5" /> {bus?.licensePlate || 'Unassigned'}
                                      </p>
                                   </div>
                                 </div>
                                 <div className="text-right">
                                   <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${trip.tripStatus === 'boarding' ? 'bg-green-100 text-green-700' : trip.tripStatus === 'delayed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                                     {trip.tripStatus || 'Scheduled'}
                                   </span>
                                   <p className="text-xs font-bold text-gray-400 mt-2">{trip.availableSeats} seats left</p>
                                 </div>
                               </div>
                             )
                           })
                        )}
                      </div>
                   </div>

                   {/* Fleet Status Summary */}
                   <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                      <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2 mb-6"><Activity className="w-5 h-5 text-emerald-500" /> Fleet Status</h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl">
                          <div className="flex items-center gap-3">
                            <CheckCircle className="w-5 h-5 text-emerald-600" />
                            <span className="font-bold text-emerald-900">Active</span>
                          </div>
                          <span className="text-xl font-black text-emerald-700">{dashboardData.buses.filter(b => b.status === 'active').length}</span>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-amber-50 rounded-2xl">
                          <div className="flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-600" />
                            <span className="font-bold text-amber-900">Maintenance</span>
                          </div>
                          <span className="text-xl font-black text-amber-700">{dashboardData.buses.filter(b => b.status === 'maintenance').length}</span>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-red-50 rounded-2xl">
                          <div className="flex items-center gap-3">
                            <XCircle className="w-5 h-5 text-red-600" />
                            <span className="font-bold text-red-900">Inactive</span>
                          </div>
                          <span className="text-xl font-black text-red-700">{dashboardData.buses.filter(b => b.status === 'inactive').length}</span>
                        </div>
                      </div>
                   </div>
                </div>

                {/* 3. BOTTOM (Recent Bookings Snapshot) */}
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 overflow-hidden">
                   <div className="flex items-center justify-between mb-6">
                      <h3 className="font-bold text-gray-900 text-lg">Recent Bookings</h3>
                      <Button variant="link" onClick={() => setActiveTab('bookings')} className="text-indigo-600 font-bold p-0">View all</Button>
                   </div>
                   <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-gray-100 text-xs uppercase tracking-widest text-gray-400 font-bold">
                            <th className="pb-3 px-4">Booking Ref</th>
                            <th className="pb-3 px-4">Passenger</th>
                            <th className="pb-3 px-4">Trip</th>
                            <th className="pb-3 px-4">Amount</th>
                            <th className="pb-3 px-4">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashboardData.bookings.slice(0, 5).map(booking => {
                            const trip = dashboardData.schedules.find(s => s.id === booking.scheduleId);
                            const isPaid = booking.paymentStatus === 'paid';
                            return (
                              <tr key={booking.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                <td className="py-4 px-4 font-mono text-sm text-gray-600">{booking.bookingReference}</td>
                                <td className="py-4 px-4 font-bold text-gray-900">{booking.passengerDetails?.[0]?.name || 'N/A'}</td>
                                <td className="py-4 px-4 text-sm text-gray-500">{trip?.departureLocation} → {trip?.arrivalLocation}</td>
                                <td className="py-4 px-4 font-bold text-gray-900">MWK {booking.totalAmount?.toLocaleString()}</td>
                                <td className="py-4 px-4">
                                   <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${isPaid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                     {booking.paymentStatus}
                                   </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {dashboardData.bookings.length === 0 && (
                        <p className="text-center text-gray-500 py-6 text-sm font-medium">No recent bookings found.</p>
                      )}
                   </div>
                </div>

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
                    arrivalDateTime:   s.arrivalDateTime instanceof Date ? s.arrivalDateTime : new Date(s.arrivalDateTime),
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
