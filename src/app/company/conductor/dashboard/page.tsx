'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Company, Schedule, Route, Bus, Booking, TripStop, TripStatus } from '@/types';
import * as dbActions from '@/lib/actions/db.actions';

import {
  Loader2, LogOut, Radio, Navigation, Bell, Search, MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';

import TripBuckets from './_components/TripBuckets';
import TripControlPanel from './_components/TripControlPanel';
import PassengerManifest from './_components/PassengerManifest';
import WalkOnBookingModal, { WalkOnFormData } from './_components/WalkOnBookingModal';
import CashCollectionModal from './_components/CashCollectionModal';
import TripSummaryCard from './_components/TripSummaryCard';
import NextStopPassengerAlert from './_components/NextStopPassengerAlert';

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
      await dbActions.createBooking({
        bookingReference: ref,
        scheduleId: selectedTrip.id,
        companyId,
        routeId: selectedTrip.routeId,
        userId: user?.id ?? '', // Conductor's ID
        totalAmount: selectedTrip.price,
        currency: 'MWK',
        bookingStatus: 'confirmed', // Automatically boarded
        paymentStatus: 'paid', // Cash walk on
        paymentMethod: 'cash',
        isWalkOn: true,
        bookedBy: 'conductor',
        originStopId: form.originStopId,
        destinationStopId: form.destinationStopId,
        passengerDetails: [{ name: `${form.firstName} ${form.lastName}`, age: form.age, sex: form.sex }],
        contactPhone: form.phone,
        seatNumbers: [seatNumber],
        paidAt: new Date() as any,
      } as any);
      
      // Update seats locally
      const nb = [...(selectedTrip.bookedSeats || []), seatNumber];
      await dbActions.updateSchedule(selectedTrip.id, { bookedSeats: nb as any });
      updateTripOptimistically({ bookedSeats: nb });
    } finally {
      setActionLoadingId(null);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center"><Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" /><p className="text-gray-500">Loading your assignment workspace...</p></div>
      </div>
    );
  }

  const activeBus = selectedTrip ? buses.find(b => b.id === selectedTrip.busId) || null : null;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20 sm:pb-0">
      {/* HEADER */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 shadow-indigo-500/10 shadow-lg">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {selectedTrip ? (
              <Button variant="ghost" size="sm" onClick={() => setSelectedTrip(null)} className="text-slate-300 hover:text-white px-2 transition-colors">
                ← Back
              </Button>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-inner">
                <Navigation className="w-5 h-5 text-white" />
              </div>
            )}
            <div>
               <h1 className="text-white font-bold text-[15px] sm:text-base leading-tight">
                 {selectedTrip ? 'Active Trip Workspace' : 'Conductor Dashboard'}
               </h1>
               <p className="text-indigo-300 font-medium text-[11px] uppercase tracking-wider">
                 {userProfile?.firstName} {userProfile?.lastName}
               </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} className="text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-full transition-colors">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {globalError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm font-medium">{globalError}</div>
        )}

        {!selectedTrip ? (
          <TripBuckets trips={trips} buses={buses} onSelect={setSelectedTrip} />
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {selectedTrip.tripStatus === 'completed' ? (
              <TripSummaryCard trip={selectedTrip} bus={activeBus} bookings={tripBookings} company={company} onRefresh={() => setSelectedTrip(null)} />
            ) : (
              <>
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

                <div className="pt-4 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent flex items-center gap-2">
                       <Radio className="w-5 h-5 text-indigo-500" /> Live Manifest
                    </h2>
                    <Button onClick={() => setWalkOnModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all shrink-0">
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
        )}
      </main>

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
