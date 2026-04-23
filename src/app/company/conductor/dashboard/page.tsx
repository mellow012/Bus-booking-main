'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Company, Schedule, Route, Bus, Booking, TripStop, TripStatus } from '@/types';
import * as dbActions from '@/lib/actions/db.actions';

import {
  Loader2, LogOut, Radio, Navigation, Bell, Search, MapPin, 
  Calendar, LayoutDashboard, User, AlertTriangle, X, UserPlus 
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
      const res = await dbActions.getBookingsForSchedule(selectedTrip.id);
      if (res.success && res.data) {
        setTripBookings(res.data as Booking[]);
      } else {
        console.error('Error fetching bookings:', res.error);
        setTripBookings([]);
      }
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
      const firstStop = stopSequence[0];
      await dbActions.updateSchedule(selectedTrip.id, {
        tripStatus: 'boarding',
        currentStopIndex: 0,
        currentStopId: firstStop.id,
        departedStops: [],
        tripStartedAt: now,
      });
      updateTripOptimistically({ 
        tripStatus: 'boarding', 
        currentStopIndex: 0, 
        currentStopId: firstStop.id,
        departedStops: [], 
        tripStartedAt: now 
      });
      await broadcastTripStatus(selectedTrip.id, 'boarding', { currentStopIndex: 0, currentStopId: firstStop.id });
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
        currentStopId: currentStop.id,
      });
      updateTripOptimistically({ tripStatus: 'in_transit', departedStops: deps, currentStopId: currentStop.id });
      await broadcastTripStatus(selectedTrip.id, 'in_transit', { 
        departedStops: deps, 
        departedStopName: currentStop.name,
        currentStopId: currentStop.id 
      });
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
      const nextStop = stopSequence[nextIdx];
      
      if (nextIdx >= stopSequence.length - 1) {
        // Final Stop
        const now = new Date();
        await dbActions.updateSchedule(selectedTrip.id, {
          tripStatus: 'completed',
          currentStopIndex: nextIdx,
          currentStopId: nextStop.id,
          tripCompletedAt: now,
        } as any);
        updateTripOptimistically({ tripStatus: 'completed', currentStopIndex: nextIdx, currentStopId: nextStop.id, tripCompletedAt: now });
        await broadcastTripStatus(selectedTrip.id, 'completed', { completedAt: now, currentStopId: nextStop.id });
      } else {
        // Intermediate Stop
        await dbActions.updateSchedule(selectedTrip.id, {
          tripStatus: 'arrived', // Updated to 'arrived' state
          currentStopIndex: nextIdx,
          currentStopId: nextStop.id,
        });
        updateTripOptimistically({ tripStatus: 'arrived', currentStopIndex: nextIdx, currentStopId: nextStop.id });
        await broadcastTripStatus(selectedTrip.id, 'arrived', { 
          currentStopIndex: nextIdx, 
          arrivedStopName: nextStop.name,
          currentStopId: nextStop.id 
        });
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenBoarding = async () => {
    if (!selectedTrip) return;
    setActionLoadingId('trip-control');
    try {
      await dbActions.updateSchedule(selectedTrip.id, { tripStatus: 'boarding' });
      updateTripOptimistically({ tripStatus: 'boarding' });
      await broadcastTripStatus(selectedTrip.id, 'boarding', {});
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMarkDelayed = async (reason: string) => {
    if (!selectedTrip) return;
    setActionLoadingId('trip-control');
    try {
      await dbActions.updateSchedule(selectedTrip.id, { 
        tripStatus: 'delayed',
        tripNotes: reason 
      });
      updateTripOptimistically({ tripStatus: 'delayed', tripNotes: reason });
      await broadcastTripStatus(selectedTrip.id, 'delayed', { reason });
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
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Stats — horizontal scroll on mobile */}
      <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar sm:grid sm:grid-cols-3 sm:overflow-visible">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group min-w-[140px] shrink-0 sm:min-w-0">
          <Radio className="w-5 h-5 text-indigo-600 mb-2 relative" />
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1 relative">Live Now</p>
          <p className="text-2xl font-black text-gray-900 relative">{stats.liveCount}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group min-w-[140px] shrink-0 sm:min-w-0">
          <Calendar className="w-5 h-5 text-emerald-600 mb-2 relative" />
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1 relative">Today</p>
          <p className="text-2xl font-black text-gray-900 relative">{stats.totalToday}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group min-w-[140px] shrink-0 sm:min-w-0">
          <Navigation className="w-5 h-5 text-amber-600 mb-2 relative" />
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1 relative">Remaining</p>
          <p className="text-2xl font-black text-gray-900 relative">{stats.pendingToday}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Radio className="w-4 h-4 text-indigo-600 animate-pulse" /> System Status
          </h3>
          <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2.5 py-1 rounded-full uppercase tracking-widest">Connected</span>
        </div>
        {stats.liveCount > 0 ? (
          <button
            onClick={() => setActiveTab('trips')}
            className="w-full bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex items-center gap-3 text-left active:bg-indigo-100 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-indigo-900 font-bold text-sm">You have active trips</p>
              <p className="text-indigo-600/70 text-xs">Tap to manage your live console</p>
            </div>
            <span className="text-indigo-600 font-bold text-xs shrink-0">Go →</span>
          </button>
        ) : (
          <div className="bg-gray-50 p-8 rounded-xl text-center border border-dashed border-gray-200">
            <Navigation className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 font-bold text-xs uppercase tracking-wide">Awaiting assignments...</p>
          </div>
        )}
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
            <TripBuckets trips={trips} buses={buses} routes={routes} onSelect={setSelectedTrip} />
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              {selectedTrip.tripStatus === 'completed' ? (
                <TripSummaryCard trip={selectedTrip} bus={activeBus} bookings={tripBookings} company={company} onRefresh={() => setSelectedTrip(null)} />
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <button onClick={() => setSelectedTrip(null)} className="flex items-center gap-2 text-indigo-600 font-bold text-sm bg-indigo-50 px-4 py-2.5 rounded-xl border border-indigo-100 active:bg-indigo-100 transition-all">
                      <span>← Back</span>
                    </button>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hidden sm:block">Live</span>
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
                    onOpenBoarding={handleOpenBoarding}
                    onMarkDelayed={handleMarkDelayed}
                    loading={actionLoadingId === 'trip-control'}
                  />

                  <div className="pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                         <Radio className="w-4 h-4 text-indigo-500 animate-pulse" /> Manifest
                      </h2>
                      <Button onClick={() => setWalkOnModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg transition-all rounded-xl font-bold h-10 sm:h-auto hidden sm:flex">
                        <UserPlus className="w-4 h-4 mr-1.5" /> Walk-on
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

                  {/* Mobile FAB for Walk-on */}
                  <button
                    onClick={() => setWalkOnModalOpen(true)}
                    className="sm:hidden fixed bottom-20 right-4 w-14 h-14 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-300 flex items-center justify-center z-40 active:scale-95 transition-transform"
                  >
                    <UserPlus className="w-6 h-6" />
                  </button>
                </>
              )}
            </div>
          )
        );
      case 'profile':
        return (
          <div className="bg-white p-5 sm:p-8 rounded-2xl border border-gray-100 shadow-sm max-w-2xl mx-auto">
            <div className="flex items-center gap-4 sm:gap-6 mb-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 text-2xl sm:text-3xl font-bold border border-indigo-100">
                {userProfile?.firstName?.[0] || 'C'}
              </div>
              <div className="min-w-0">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight truncate">{userProfile?.firstName} {userProfile?.lastName}</h3>
                <p className="text-indigo-500 font-bold uppercase tracking-widest text-[10px] mt-1">Conductor • Fleet Operations</p>
              </div>
            </div>
            <div className="space-y-3">
               <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Email</span>
                  <span className="font-semibold text-gray-700 text-sm break-all">{userProfile?.email}</span>
               </div>
               <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Phone</span>
                  <span className="font-semibold text-gray-700 text-sm">{userProfile?.phone || 'Not set'}</span>
               </div>
               <button
                 onClick={signOut}
                 className="w-full flex items-center justify-center gap-2 px-4 py-3 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-all font-bold text-sm lg:hidden"
               >
                 <LogOut className="w-4 h-4" /> Sign Out
               </button>
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
      <aside className="hidden lg:flex w-64 bg-white border-r border-gray-100 h-screen sticky top-0 flex-col z-50 overflow-hidden">
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
        <header className="h-14 sm:h-16 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-40">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 border-l-3 border-indigo-600 pl-3 capitalize tracking-tight">
            {activeTab === 'trips' ? (selectedTrip ? 'Trip Workspace' : 'My Trips') : activeTab}
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[10px] font-bold text-emerald-600 uppercase hidden sm:block">Active</p>
            </div>
            <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 font-bold text-sm border border-indigo-100">
              {userProfile?.firstName?.[0] || 'C'}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-y-auto pb-24 lg:pb-8">
          {globalError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl mb-4 text-sm font-bold flex items-center gap-3 animate-in fade-in duration-300">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span className="flex-1">{globalError}</span>
              <button onClick={() => setGlobalError('')} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-100 shrink-0">
                <X className="w-4 h-4" />
              </button>
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

      {/* ── MOBILE BOTTOM BAR ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 flex items-center justify-around px-2 pt-2 z-50 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        {[
          { tab: 'overview' as const, icon: LayoutDashboard, label: 'Home' },
          { tab: 'trips' as const, icon: MapPin, label: 'Trips' },
          { tab: 'notifications' as const, icon: Bell, label: 'Alerts' },
          { tab: 'profile' as const, icon: User, label: 'Profile' },
        ].map(({ tab, icon: Icon, label }) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex flex-col items-center gap-0.5 min-w-[60px] min-h-[48px] justify-center rounded-xl transition-all ${activeTab === tab ? 'text-indigo-600' : 'text-gray-400 active:text-gray-600'}`}
          >
            <Icon className="w-6 h-6" />
            <span className="text-[10px] font-bold">{label}</span>
            {activeTab === tab && <div className="w-5 h-1 rounded-full bg-indigo-600 mt-0.5" />}
          </button>
        ))}
      </nav>
    </div>
  );
}
