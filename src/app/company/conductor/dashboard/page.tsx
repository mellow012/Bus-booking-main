'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Company, Schedule, Route, Bus, Booking, TripStop, TripStatus } from '@/types';
import * as dbActions from '@/lib/actions/db.actions';

import {
  Loader2, LogOut, Radio, Navigation, Bell, Search, MapPin, 
  Calendar, LayoutDashboard, User, AlertTriangle 
} from 'lucide-react';
import { Button } from '@/components/ui/button';

import TripBuckets from './_components/TripBuckets';
import TripControlPanel from './_components/TripControlPanel';
import PassengerManifest from './_components/PassengerManifest';
import WalkOnBookingModal, { WalkOnFormData } from './_components/WalkOnBookingModal';
import CashCollectionModal from './_components/CashCollectionModal';
import TripSummaryCard from './_components/TripSummaryCard';
import NextStopPassengerAlert from './_components/NextStopPassengerAlert';
import NotificationsManagementTab from "@/components/NotificationsManagementTab";

// Utils
const buildTripStopSequence = (trip: Schedule, route: Route): TripStop[] => {
  const origin = { id: '__origin__', name: trip.departureLocation || route.origin, order: -1 };
  const dest = { id: '__destination__', name: trip.arrivalLocation || route.destination, order: 999 };
  const midStops = (route.stops || []).map((s, i) => ({ id: s.id, name: s.name, order: i }));
  const sortedStops = [...midStops].sort((a, b) => a.order - b.order);
  return [origin, ...sortedStops, dest];
};

export default function ConductorDashboard() {
  const { user, userProfile, loading: authLoading, signOut } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<Schedule[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [company, setCompany] = useState<Company | null>(null);

  // Active Context
  const [selectedTrip, setSelectedTrip] = useState<Schedule | null>(null);
  const [tripBookings, setTripBookings] = useState<Booking[]>([]);

  // Modals
  const [cashModalOpen, setCashModalOpen] = useState(false);
  const [activeBookingForCash, setActiveBookingForCash] = useState<Booking | null>(null);
  const [walkOnModalOpen, setWalkOnModalOpen] = useState(false);

  // State
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState('');

  const companyId = userProfile?.companyId;

  const fetchInitialData = useCallback(async () => {
    if (!companyId || !user) return;
    try {
      setLoading(true);
      const uid = userProfile?.uid || user.id;

      // Ensure we only see buses assigned to this conductor
      const { data: allBuses } = await supabase.from('Bus').select('*').eq('companyId', companyId);
      const myBuses = (allBuses || []).filter(b => {
        const cIds = b.conductorIds as string[] | undefined;
        return cIds && Array.isArray(cIds) && cIds.includes(uid);
      });
      setBuses(myBuses as Bus[]);

      const myBusIds = myBuses.map(b => b.id);

      if (myBusIds.length > 0) {
        const [{ data: sData }, { data: rData }, { data: cData }] = await Promise.all([
          supabase.from('Schedule').select('*').eq('companyId', companyId).in('busId', myBusIds),
          supabase.from('Route').select('*').eq('companyId', companyId),
          supabase.from('Company').select('*').eq('id', companyId).single()
        ]);
        
        const activeTrips = (sData as any[] || []).filter(t => t.status === 'active' && !t.isArchived)
          .map(t => ({...t, departureDateTime: new Date(t.departureDateTime), arrivalDateTime: new Date(t.arrivalDateTime)}));
        
        setTrips(activeTrips as Schedule[]);
        setRoutes(rData as Route[]);
        setCompany(cData as Company);
      } else {
        setTrips([]);
        setRoutes([]);
      }
    } catch (err) {
      console.error(err);
      setGlobalError('Failed to load trips.');
    } finally {
      setLoading(false);
    }
  }, [companyId, user, userProfile]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || userProfile?.role !== 'conductor') {
      router.push('/login');
    } else {
      fetchInitialData();
    }
  }, [user, userProfile, authLoading, fetchInitialData, router]);

  // Load bookings when a trip is selected
  useEffect(() => {
    const fetchBookings = async () => {
      if (!selectedTrip) return;
      const { data } = await supabase.from('Booking').select('*').eq('scheduleId', selectedTrip.id);
      setTripBookings(data as Booking[] || []);
    };
    fetchBookings();
    
    // Set up realtime listener for this trip's bookings
    if (selectedTrip) {
      const channel = supabase.channel(`trip-${selectedTrip.id}-bookings`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'Booking', filter: `scheduleId=eq.${selectedTrip.id}` }, () => {
          fetchBookings();
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [selectedTrip?.id]);

  const updateTripOptimistically = (updates: Partial<Schedule>) => {
    if (!selectedTrip) return;
    const nt = { ...selectedTrip, ...updates };
    setSelectedTrip(nt);
    setTrips(p => p.map(t => t.id === nt.id ? nt : t));
  };

  const broadcastTripStatus = async (tripId: string, status: TripStatus, data: any) => {
    try {
      await supabase.rpc('broadcast_trip_update', { p_schedule_id: tripId, p_status: status, p_data: data });
    } catch (e) {
      // Ignore broadcast errors
    }
  };

  const handleStartTrip = async () => {
    if (!selectedTrip) return;
    setActionLoadingId('trip-control');
    try {
      const now = new Date();
      await dbActions.updateSchedule(selectedTrip.id, {
        tripStatus: 'boarding',
        currentStopIndex: 0,
        departedStops: [],
        tripStartedAt: now,
      });
      updateTripOptimistically({ tripStatus: 'boarding', currentStopIndex: 0, departedStops: [], tripStartedAt: now });
      await broadcastTripStatus(selectedTrip.id, 'boarding', { currentStopIndex: 0 });
    } catch (err) {
      setGlobalError('Failed to start trip.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const activeRoute = useMemo(() => selectedTrip ? routes.find(r => r.id === selectedTrip.routeId) : null, [selectedTrip, routes]);
  const stopSequence = useMemo(() => selectedTrip && activeRoute ? buildTripStopSequence(selectedTrip, activeRoute) : [], [selectedTrip, activeRoute]);

  const handleDepartStop = async () => {
    if (!selectedTrip) return;
    setActionLoadingId('trip-control');
    try {
      const currentIdx = selectedTrip.currentStopIndex ?? 0;
      const currentStop = stopSequence[currentIdx];
      const deps = [...(selectedTrip.departedStops ?? []), currentStop.id];
      await dbActions.updateSchedule(selectedTrip.id, {
        tripStatus: 'in_transit',
        departedStops: deps as any,
      });
      updateTripOptimistically({ tripStatus: 'in_transit', departedStops: deps });
      await broadcastTripStatus(selectedTrip.id, 'in_transit', { departedStops: deps, departedStopName: currentStop.name });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleArriveNextStop = async () => {
    if (!selectedTrip) return;
    setActionLoadingId('trip-control');
    try {
      const currentIdx = selectedTrip.currentStopIndex ?? 0;
      const nextIdx = currentIdx + 1;
      
      if (nextIdx >= stopSequence.length - 1) {
        // Final Stop
        const now = new Date();
        await dbActions.updateSchedule(selectedTrip.id, {
          tripStatus: 'completed',
          currentStopIndex: nextIdx,
          tripCompletedAt: now,
        } as any);
        updateTripOptimistically({ tripStatus: 'completed', currentStopIndex: nextIdx, tripCompletedAt: now });
        await broadcastTripStatus(selectedTrip.id, 'completed', { completedAt: now });
      } else {
        // Intermediate Stop
        await dbActions.updateSchedule(selectedTrip.id, {
          tripStatus: 'boarding',
          currentStopIndex: nextIdx,
        });
        updateTripOptimistically({ tripStatus: 'boarding', currentStopIndex: nextIdx });
        await broadcastTripStatus(selectedTrip.id, 'boarding', { currentStopIndex: nextIdx, arrivedStopName: stopSequence[nextIdx].name });
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCashCollection = async (bookingId: string, amount: number) => {
    setActionLoadingId(bookingId);
    try {
      await dbActions.updateBooking(bookingId, {
        paymentStatus: 'paid',
        paymentMethod: 'cash',
        paidAt: new Date() as any,
      });
      // Will auto-update via realtime
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMarkBoarded = async (bookingId: string, isBoarded: boolean) => {
    setActionLoadingId(bookingId);
    try {
      if (isBoarded) {
        // Need to ensure cash is paid if they are boarding and haven't paid? We assume Conductor validated it.
        await dbActions.updateBooking(bookingId, { bookingStatus: 'confirmed' });
      } else {
        await dbActions.updateBooking(bookingId, { bookingStatus: 'pending' });
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMarkNoShow = async (bookingId: string, isNoShow: boolean) => {
    setActionLoadingId(bookingId);
    try {
      await dbActions.updateBooking(bookingId, { bookingStatus: isNoShow ? 'no-show' : 'pending' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleWalkOnBooking = async (seatNumber: string, form: WalkOnFormData, amount: number) => {
    if (!selectedTrip || !companyId) return;
    setActionLoadingId('walk-on');
    try {
      const ref = `W-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const bookingResult = await dbActions.createBooking({
        bookingReference: ref,
        scheduleId: selectedTrip.id,
        companyId,
        routeId: selectedTrip.routeId,
        userId: user?.id ?? '', // Conductor's ID
        totalAmount: selectedTrip.price,
        currency: 'MWK',
        bookingStatus: 'confirmed', // Automatically boarded
        paymentStatus: 'paid', // Cash walk on
        passengerDetails: [{ name: `${form.firstName} ${form.lastName}`, age: form.age, sex: form.sex }],
        contactPhone: form.phone,
        seatNumbers: [seatNumber],
        paidAt: new Date() as any,
      } as any);

      if (!bookingResult.success) {
        throw new Error(bookingResult.error || 'Failed to create booking record');
      }
      
      // Update seats in the database
      const nb = [...(selectedTrip.bookedSeats || []), seatNumber];
      const newAvailable = Math.max(0, (selectedTrip.availableSeats ?? 0) - 1);
      
      const schedResult = await dbActions.updateSchedule(selectedTrip.id, { 
        bookedSeats: nb as any,
        availableSeats: newAvailable
      });

      if (!schedResult.success) {
        throw new Error(schedResult.error || 'Booking saved, but seat inventory update failed');
      }

      updateTripOptimistically({ bookedSeats: nb, availableSeats: newAvailable });
      setWalkOnModalOpen(false);
    } catch (err: any) {
      setGlobalError(`Walk-on booking failed: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const [activeTab, setActiveTab] = useState<'overview' | 'trips' | 'profile' | 'notifications'>('overview');

  const stats = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const todayTrips = trips.filter(t => {
      const depDate = new Date(t.departureDateTime);
      return depDate >= startOfToday && depDate < endOfToday;
    });

    return {
      liveCount: trips.filter(t => t.tripStatus === 'boarding' || t.tripStatus === 'in_transit').length,
      totalToday: todayTrips.length,
      pendingToday: todayTrips.filter(t => t.tripStatus === 'scheduled' || !t.tripStatus).length,
    };
  }, [trips]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center"><Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" /><p className="text-gray-500">Loading your assignment workspace...</p></div>
      </div>
    );
  }

  const activeBus = selectedTrip ? buses.find(b => b.id === selectedTrip.busId) || null : null;

// Sidebar Item Component used throughout the dashboard
  const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group
        ${active 
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
          : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'}`}
    >
      <Icon className={`w-5 h-5 transition-transform ${active ? 'scale-110' : 'group-hover:scale-110'}`} />
      <span className="font-semibold tracking-tight">{label}</span>
    </button>
  );

  const renderOverview = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
          <Radio className="w-6 h-6 text-indigo-600 mb-4 relative" />
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1 relative">Live Now</p>
          <p className="text-3xl font-extrabold text-gray-900 relative">{stats.liveCount}</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
          <Calendar className="w-6 h-6 text-emerald-600 mb-4 relative" />
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1 relative">Today's Total</p>
          <p className="text-3xl font-extrabold text-gray-900 relative">{stats.totalToday}</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
          <Navigation className="w-6 h-6 text-amber-600 mb-4 relative" />
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1 relative">Remaining Today</p>
          <p className="text-3xl font-extrabold text-gray-900 relative">{stats.pendingToday}</p>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-xl shadow-gray-200/50">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Radio className="w-5 h-5 text-indigo-600 animate-pulse" /> Current System Status
          </h3>
          <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-widest">Connected</span>
        </div>
        <div className="space-y-4">
           {stats.liveCount > 0 ? (
             <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100 flex items-center justify-between">
                <div>
                  <p className="text-indigo-900 font-bold">You have active trips</p>
                  <p className="text-indigo-600/70 text-sm font-medium">Head to the "My Trips" console to manage manifest.</p>
                </div>
                <button onClick={() => setActiveTab('trips')} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-black transition-all">Go to Live Console</button>
             </div>
           ) : (
             <div className="bg-gray-50 p-10 rounded-[2rem] text-center border border-dashed border-gray-200">
                <Navigation className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-400 font-bold italic tracking-tight uppercase text-xs">Awaiting assignments or trip start...</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview();
      case 'trips':
        return (
          !selectedTrip ? (
            <TripBuckets trips={trips} buses={buses} onSelect={setSelectedTrip} />
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              {selectedTrip.tripStatus === 'completed' ? (
                <TripSummaryCard trip={selectedTrip} bus={activeBus} bookings={tripBookings} company={company} onRefresh={() => setSelectedTrip(null)} />
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <button onClick={() => setSelectedTrip(null)} className="flex items-center gap-2 text-indigo-600 font-bold text-sm bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 hover:bg-indigo-100 transition-all">
                      <span>← All Trips</span>
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Active Workspace</span>
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                  </div>
                  <NextStopPassengerAlert 
                    tripBookings={tripBookings}
                    stopSequence={stopSequence}
                    currentStop={stopSequence[selectedTrip.currentStopIndex ?? 0]}
                    isBoardingStatus={selectedTrip.tripStatus === 'boarding'}
                  />

                  <TripControlPanel 
                    trip={selectedTrip}
                    stopSequence={stopSequence}
                    onStartTrip={handleStartTrip}
                    onDepart={handleDepartStop}
                    onArriveAtNext={handleArriveNextStop}
                    loading={actionLoadingId === 'trip-control'}
                  />

                  <div className="pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                         <Radio className="w-5 h-5 text-indigo-500 animate-pulse" /> Live Manifest
                      </h2>
                      <Button onClick={() => setWalkOnModalOpen(true)} className="bg-indigo-600 hover:bg-black text-white shadow-lg transition-all rounded-xl font-bold">
                        Walk-on Booking
                      </Button>
                    </div>

                    <PassengerManifest 
                      bookings={tripBookings}
                      tripStatus={selectedTrip.tripStatus ?? 'scheduled'}
                      onOpenCashModal={(b) => { setActiveBookingForCash(b); setCashModalOpen(true); }}
                      onMarkBoarded={handleMarkBoarded}
                      onMarkNoShow={handleMarkNoShow}
                      loadingActionId={actionLoadingId}
                    />
                  </div>
                </>
              )}
            </div>
          )
        );
      case 'profile':
        return (
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm max-w-2xl mx-auto">
            <div className="flex items-center gap-6 mb-8">
              <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 text-3xl font-bold border border-indigo-100 ring-8 ring-indigo-50/50">
                {userProfile?.firstName?.[0] || 'C'}
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900 tracking-tight">{userProfile?.firstName} {userProfile?.lastName}</h3>
                <p className="text-indigo-500 font-bold uppercase tracking-widest text-[11px] mt-1 italic">Conductor Level 4 • Fleet Operations</p>
              </div>
            </div>
            <div className="space-y-4">
               <div className="p-4 bg-gray-50 rounded-2xl flex items-center justify-between border border-gray-100">
                  <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Email Address</span>
                  <span className="font-semibold text-gray-700">{userProfile?.email}</span>
               </div>
               <div className="p-4 bg-gray-50 rounded-2xl flex items-center justify-between border border-gray-100">
                  <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Phone Number</span>
                  <span className="font-semibold text-gray-700">{userProfile?.phone || 'Not Managed'}</span>
               </div>
            </div>
          </div>
        );
      case 'notifications':
        return (
          <NotificationsManagementTab
            userId={user?.id || ""}
            companyId={userProfile?.companyId || ""}
            setError={(msg) => setGlobalError(msg)}
            setSuccess={(msg) => {}}
          />
        );
      default:
        return renderOverview();
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* ── SIDEBAR ── */}
      <aside className="w-64 bg-white border-r border-gray-100 h-screen sticky top-0 flex flex-col z-50 overflow-hidden">
        <div className="p-6 border-b border-gray-100/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <Navigation className="w-6 h-6 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="font-bold text-gray-900 tracking-tight leading-none uppercase text-sm italic">{company?.name || 'BusOps'}</h1>
              <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest leading-none mt-1 inline-block">Fleet Conductor</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-hide">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">Operational Console</div>
          <SidebarItem icon={LayoutDashboard} label="Overview" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
          <SidebarItem icon={MapPin} label="My Trips" active={activeTab === 'trips'} onClick={() => setActiveTab('trips')} />
          <SidebarItem icon={Bell} label="Notifications" active={activeTab === 'notifications'} onClick={() => setActiveTab('notifications')} />
          
          <div className="pt-6 pb-2">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">Account</div>
            <SidebarItem icon={User} label="My Profile" active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
          </div>
        </nav>

        <div className="p-4 border-t border-gray-100/50">
          <button 
            onClick={signOut} 
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-300 font-medium group"
          >
            <LogOut className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            <span>Terminate Shift</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center justify-between px-8 sticky top-0 z-40 transition-all duration-300">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-gray-900 border-l-4 border-indigo-600 pl-4 capitalize tracking-tight italic">
              {activeTab === 'trips' ? (selectedTrip ? 'Trip Workspace' : 'My Schedule') : activeTab}
            </h2>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Status</span>
              <div className="flex items-center gap-1.5 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-tight">Active Duty</p>
              </div>
            </div>
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 font-bold text-xs shadow-sm border border-indigo-100 ring-4 ring-indigo-50/50">
              {userProfile?.firstName?.[0] || 'C'}
            </div>
          </div>
        </header>

        <main className="flex-1 p-8 overflow-y-auto">
          {globalError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-3xl mb-6 text-sm font-bold flex items-center gap-3 animate-in fade-in zoom-in duration-300 shadow-lg shadow-red-100">
              <AlertTriangle className="w-5 h-5" />
              {globalError}
            </div>
          )}

          {renderActiveTab()}
        </main>
      </div>

      {/* Modals */}
      <CashCollectionModal 
        isOpen={cashModalOpen} 
        onClose={() => { setCashModalOpen(false); setActiveBookingForCash(null); }} 
        booking={activeBookingForCash}
        onConfirm={handleCashCollection}
        loading={actionLoadingId === activeBookingForCash?.id}
      />
      
      <WalkOnBookingModal 
        isOpen={walkOnModalOpen}
        onClose={() => setWalkOnModalOpen(false)}
        trip={selectedTrip}
        bus={activeBus}
        existingBookings={tripBookings}
        stopSequence={stopSequence}
        currentStopIndex={selectedTrip?.currentStopIndex ?? 0}
        onConfirm={handleWalkOnBooking}
        loading={actionLoadingId === 'walk-on'}
      />
    </div>
  );
}
