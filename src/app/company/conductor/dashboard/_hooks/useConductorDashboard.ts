'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Company, Schedule, Route, Bus, Booking, TripStatus } from '@/types';
import * as dbActions from '@/lib/actions/db.actions';
import { WalkOnFormData } from '../_components/WalkOnBookingModal';

export function useConductorDashboard() {
  const { user, userProfile, loading: authLoading, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<Schedule[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [company, setCompany] = useState<Company | null>(null);

  // Active Context
  const [selectedTrip, setSelectedTrip] = useState<Schedule | null>(null);
  const [tripBookings, setTripBookings] = useState<Booking[]>([]);

  // Modals & State
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const companyId = userProfile?.companyId;

  const fetchInitialData = useCallback(async (isSilent = false) => {
    if (!companyId || !user) return;
    try {
      if (!isSilent) setLoading(true);
      const uid = userProfile?.uid || user.id;

      const { data: allBuses } = await supabase.from('Bus').select('*').eq('companyId', companyId);
      const myBuses = (allBuses || []).filter(b => {
        const cIds = b.conductorIds as string[] | undefined;
        return cIds && Array.isArray(cIds) && cIds.includes(uid);
      });
      setBuses(myBuses as Bus[]);

      const myBusIds = myBuses.map(b => b.id);

      if (myBusIds.length > 0) {
        const startOfToday = new Date();
        startOfToday.setHours(0,0,0,0);

        const [{ data: sData }, { data: rData }, { data: cData }] = await Promise.all([
          supabase.from('Schedule')
            .select('*')
            .eq('companyId', companyId)
            .in('busId', myBusIds)
            .or(`departureDateTime.gte.${startOfToday.toISOString()},tripStatus.in.(boarding,in_transit,arrived)`),
          supabase.from('Route').select('*').eq('companyId', companyId),
          supabase.from('Company').select('*').eq('id', companyId).single()
        ]);
        
        const activeTrips = (sData as any[] || []).filter(t => t.status === 'active' && !t.isArchived)
          .map(t => ({...t, departureDateTime: new Date(t.departureDateTime), arrivalDateTime: new Date(t.arrivalDateTime)}));
        
        setTrips(activeTrips as Schedule[]);
        setRoutes(rData as Route[]);
        setCompany(cData as Company);

        if (activeTrips.length > 0 && !selectedTrip && !isSilent) {
           const now = new Date();
           // Prioritize active trips first (any date)
           const currentlyActive = activeTrips.find(t => t.tripStatus === 'boarding' || t.tripStatus === 'in_transit' || t.tripStatus === 'arrived');
           
           if (currentlyActive) {
             setSelectedTrip(currentlyActive);
           } else {
             // Then look for upcoming today
             const todayTrips = activeTrips.filter(t => new Date(t.departureDateTime).toDateString() === now.toDateString());
             const nextTrip = todayTrips.filter(t => t.tripStatus === 'scheduled' || !t.tripStatus)
                                       .sort((a,b) => new Date(a.departureDateTime).getTime() - new Date(b.departureDateTime).getTime())[0];
             
             if (nextTrip) setSelectedTrip(nextTrip);
             else setSelectedTrip(activeTrips[0]);
           }
        }
      } else {
        setTrips([]);
        setRoutes([]);
      }
    } catch (err) {
      if (!isSilent) setGlobalError('Failed to load trips.');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [companyId, user, userProfile, selectedTrip]);

  useEffect(() => {
    if (authLoading) return;
    if (user && userProfile?.role === 'conductor') {
      const silentRefresh = () => {
        if (document.visibilityState === 'visible') fetchInitialData(true);
      };
      
      fetchInitialData(false);
      const intervalId = setInterval(silentRefresh, 30000);

      const handleVisibility = () => {
        if (document.visibilityState === 'visible') fetchInitialData(true);
      };
      document.addEventListener('visibilitychange', handleVisibility);

      return () => {
        clearInterval(intervalId);
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    }
  }, [user, userProfile, authLoading, fetchInitialData]);

  useEffect(() => {
    if (!selectedTrip || selectedTrip.tripStatus !== 'in_transit') return;
    if (typeof window === 'undefined' || !navigator.geolocation || !user) return;

    const syncLocation = () => {
      if (document.visibilityState !== 'visible') return;
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          await dbActions.syncBusLocation({
            busId: selectedTrip.busId,
            scheduleId: selectedTrip.id,
            userId: user.id,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            speed: pos.coords.speed || undefined,
            heading: pos.coords.heading || undefined,
          });
        },
        (err) => console.warn("Location sync failed:", err),
        { enableHighAccuracy: true }
      );
    };

    syncLocation();
    const id = setInterval(syncLocation, 60000); // Sync every minute
    return () => clearInterval(id);
  }, [selectedTrip?.id, selectedTrip?.tripStatus]);

  useEffect(() => {
    const fetchBookings = async () => {
      if (!selectedTrip || document.visibilityState !== 'visible') return;
      const res = await dbActions.getBookingsForSchedule(selectedTrip.id);
      if (res.success && res.data) setTripBookings(res.data as Booking[]);
      else setTripBookings([]);
    };
    fetchBookings();
    
    if (selectedTrip) {
      const channel = supabase.channel(`trip-${selectedTrip.id}-bookings`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'Booking', filter: `scheduleId=eq.${selectedTrip.id}` }, () => fetchBookings())
        .subscribe();
      
      const handleVisibility = () => {
        if (document.visibilityState === 'visible') fetchBookings();
      };
      document.addEventListener('visibilitychange', handleVisibility);

      return () => { 
        supabase.removeChannel(channel); 
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    }
  }, [selectedTrip?.id]);

  const tripStats = useMemo(() => {
    const validBookings = tripBookings.filter(b => b.bookingStatus !== 'cancelled');
    const cancelled = tripBookings.filter(b => b.bookingStatus === 'cancelled').length;
    let boarded = 0; let pending = 0;
    validBookings.forEach(b => {
      const isBoarded = b.bookingStatus === 'confirmed' || b.bookingStatus === 'completed';
      if (isBoarded) boarded++;
      if (!isBoarded && b.bookingStatus !== 'no-show') pending++;
    });
    return { totalPax: validBookings.length, boarded, pending, cancelled };
  }, [tripBookings]);

  const handleMarkBoarded = async (bookingId: string, isBoarded: boolean) => {
    setActionLoadingId(bookingId);
    try {
      const res = await dbActions.updateBooking(bookingId, { 
        bookingStatus: isBoarded ? 'confirmed' : 'pending' 
      });
      if (!res.success) throw new Error(res.error);
    } catch (err: any) {
      setGlobalError(err.message || 'Action failed');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMarkNoShow = async (bookingId: string, isNoShow: boolean) => {
    setActionLoadingId(bookingId);
    try {
      const res = await dbActions.updateBooking(bookingId, { 
        bookingStatus: isNoShow ? 'no-show' : 'pending' 
      });
      if (!res.success) throw new Error(res.error);
    } catch (err: any) {
      setGlobalError(err.message || 'Action failed');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUpdateTripStatus = async (newStatus: TripStatus, extra?: any) => {
    if (!selectedTrip || !user) return;
    try {
      const res = await dbActions.updateTripLifecycle({
        scheduleId: selectedTrip.id,
        newStatus,
        userId: user.id,
        ...extra
      });
      if (res.success) {
        setSelectedTrip(res.data as Schedule);
        setSuccessMessage(`Trip status updated to ${newStatus.replace('_', ' ')}`);
        setTimeout(() => setSuccessMessage(''), 5000);
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to update trip status');
    }
  };

  const handleWalkOnBooking = async (seatNumber: string, data: WalkOnFormData, amount: number) => {
    if (!selectedTrip || !companyId) return;
    setActionLoadingId('walk-on');
    try {
      const pnr = `WON-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      
      const res = await dbActions.createBooking({
        bookingReference: pnr,
        scheduleId: selectedTrip.id,
        companyId: companyId,
        routeId: selectedTrip.routeId,
        totalAmount: amount,
        passengerDetails: [{
          name: `${data.firstName} ${data.lastName}`,
          phone: data.phone,
          seatNumber: seatNumber,
          sex: data.sex,
          age: data.age
        }],
        seatNumbers: [seatNumber],
        contactPhone: data.phone,
        paymentStatus: 'paid',
        paymentMethod: 'cash' as any,
        bookingStatus: 'confirmed',
        isWalkOn: true,
        bookedBy: userProfile?.id || user?.id,
        originStopId: data.originStopId,
        destinationStopId: data.destinationStopId,
        paidAt: new Date()
      } as any);

      if (!res.success) throw new Error(res.error);

      await dbActions.updateSchedule(selectedTrip.id, {
        availableSeats: Math.max(0, (selectedTrip.availableSeats || 0) - 1)
      });

      setSuccessMessage('Walk-on passenger successfully boarded!');
      setTimeout(() => setSuccessMessage(''), 5000);
      return true;
    } catch (err: any) {
      setGlobalError(err.message || 'Walk-on booking failed');
      return false;
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleScan = async (decodedText: string) => {
    const booking = tripBookings.find(b => b.id === decodedText || b.bookingReference === decodedText);
    
    if (booking) {
      if (booking.bookingStatus === 'confirmed' || booking.bookingStatus === 'completed') {
        setGlobalError('This ticket has already been scanned and boarded.');
        return;
      }
      if (booking.bookingStatus === 'cancelled') {
        setGlobalError('This ticket is cancelled and invalid.');
        return;
      }
      
      await handleMarkBoarded(booking.id, true);
      setSuccessMessage(`Welcome aboard, ${booking.passengerDetails?.[0]?.name || 'Passenger'}!`);
      setTimeout(() => setSuccessMessage(''), 5000);
    } else {
      setGlobalError(`No matching booking found for "${decodedText}" on this trip.`);
    }
  };

  return {
    user, userProfile, authLoading, signOut,
    loading, trips, buses, routes, company,
    selectedTrip, setSelectedTrip, tripBookings,
    actionLoadingId, globalError, setGlobalError, successMessage, setSuccessMessage,
    tripStats, handleMarkBoarded, handleMarkNoShow, handleUpdateTripStatus, handleWalkOnBooking, handleScan,
    fetchInitialData
  };
}
