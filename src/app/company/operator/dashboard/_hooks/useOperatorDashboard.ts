'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Company, Schedule, Route, Bus, Booking, Operator } from '@/types';

export function useOperatorDashboard() {
  const { user, userProfile, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const operatorIdParam = searchParams?.get('operatorId') || undefined;

  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [operatorInfo, setOperatorInfo] = useState<any | null>(null);
  const [assignedRoutes, setAssignedRoutes] = useState<Route[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [liveLocation, setLiveLocation] = useState<any | null>(null);

  const companyId = userProfile?.companyId?.trim() || '';

  const fetchInitialData = useCallback(async (silent = false) => {
    if (!user || !companyId || authLoading) return;
    try {
      if (!silent) setLoading(true);

      // 1. Fetch Operator record to get assigned routes.
      // Company admins can view a specific operator's dashboard via ?operatorId=...
      const opQuery = supabase
        .from('Operator')
        .select('*, routes(*)');

      const operatorQuery = userProfile?.role === 'company_admin' && operatorIdParam
        ? opQuery.eq('id', operatorIdParam)
        : opQuery.eq('uid', user.id);

      const { data: opData, error: opError } = await operatorQuery.maybeSingle();

      if (opError) throw opError;
      if (userProfile?.role === 'company_admin' && operatorIdParam && !opData) {
        throw new Error('Selected operator not found.');
      }

      let routesList: Route[] = [];
      let routeIds: string[] = [];

      if (opData) {
        setOperatorInfo(opData);
        routesList = (opData.routes || []) as Route[];
        routeIds = routesList.map(r => r.id);
        setAssignedRoutes(routesList);
      } else {
        // Fallback: If no Operator record exists yet, fetch routes by company and region matching User table
        const { data: companyRoutes, error: routesError } = await supabase
          .from('Route')
          .select('*')
          .eq('companyId', companyId);

        if (routesError) throw routesError;

        routesList = (companyRoutes || []) as Route[];
        // Filter by user's region if specified
        if (userProfile && 'region' in userProfile && (userProfile as any).region) {
          routesList = routesList.filter(r => r.name?.toLowerCase().includes(((userProfile as any).region as string).toLowerCase()));
        }
        routeIds = routesList.map(r => r.id);
        setAssignedRoutes(routesList);
      }

      // 2. Auto-archive completed/finished trips after 3 hours on the company side.
      const archiveCutoff = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      await supabase.from('Schedule')
        .update({ isArchived: true })
        .eq('companyId', companyId)
        .eq('isArchived', false)
        .or(`tripCompletedAt.lt.${archiveCutoff},arrivalDateTime.lt.${archiveCutoff}`);

      // 3. Fetch schedules scoped to these routes
      let schedulesList: Schedule[] = [];
      if (routeIds.length > 0) {
        const { data: schedulesData, error: schedulesError } = await supabase
          .from('Schedule')
          .select('*')
          .in('routeId', routeIds)
          .eq('isArchived', false);

        if (schedulesError) throw schedulesError;
        schedulesList = (schedulesData || []).map(s => ({
          ...s,
          departureDateTime: new Date(s.departureDateTime),
          arrivalDateTime: new Date(s.arrivalDateTime)
        })) as Schedule[];
      }
      setSchedules(schedulesList);

      // 4. Fetch assigned buses (buses belonging to the company)
      const { data: busesData, error: busesError } = await supabase
        .from('Bus')
        .select('*')
        .eq('companyId', companyId);

      if (busesError) throw busesError;
      setBuses((busesData || []) as Bus[]);

      // 5. Fetch bookings scoped to operator's schedules
      const scheduleIds = schedulesList.map(s => s.id);
      let bookingsList: Booking[] = [];
      if (scheduleIds.length > 0) {
        const { data: bookingsData, error: bookingsError } = await supabase
          .from('Booking')
          .select('*, Payment(*)')
          .in('scheduleId', scheduleIds);

        if (bookingsError) throw bookingsError;
        bookingsList = (bookingsData || []).map(b => ({
          ...b,
          paymentMethod: (b as any).Payment?.[0]?.paymentType || (b.paymentStatus === 'paid' ? 'cash' : 'Not specified'),
          createdAt: new Date(b.createdAt)
        })) as Booking[];
      }
      setBookings(bookingsList);

      // 6. Fetch live operational location logs for any active trip
      const liveTrip = schedulesList.find(s => ['boarding', 'in_transit', 'arrived'].includes(s.tripStatus || ''));
      if (liveTrip) {
        const { data: logData } = await supabase
          .from('ActivityLog')
          .select('metadata')
          .eq('scheduleId', liveTrip.id)
          .eq('action', 'LOCATION_SYNC')
          .order('createdAt', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (logData?.metadata) {
          const lat = (logData.metadata as any).latitude;
          const lng = (logData.metadata as any).longitude;
          const updatedAt = (logData.metadata as any).syncedAt;
          setLiveLocation({ lat, lng, updatedAt });
        }
      } else {
        setLiveLocation(null);
      }

    } catch (err: any) {
      if (err?.message) {
        console.error('Fetch error in useOperatorDashboard:', err.message, err);
      } else {
        console.error('Fetch error in useOperatorDashboard:', err);
      }
      if (!silent) setGlobalError('Operational sync interrupted.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user, companyId, authLoading, userProfile, operatorIdParam]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || (userProfile?.role !== 'operator' && userProfile?.role !== 'company_admin')) {
      router.push('/login');
      return;
    }
    fetchInitialData();
  }, [user, userProfile, authLoading, router, fetchInitialData]);

  // Real-time Subscriptions
  useEffect(() => {
    if (!companyId) return;

    const silentRefresh = () => {
      if (document.visibilityState === 'visible') fetchInitialData(true);
    };

    const channels = [
      supabase.channel('ops-schedules-sub').on('postgres_changes', { event: '*', schema: 'public', table: 'Schedule', filter: `companyId=eq.${companyId}` }, silentRefresh).subscribe(),
      supabase.channel('ops-bookings-sub').on('postgres_changes', { event: '*', schema: 'public', table: 'Booking', filter: `companyId=eq.${companyId}` }, silentRefresh).subscribe(),
      supabase.channel('ops-location-sub').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ActivityLog', filter: `companyId=eq.${companyId}` }, (payload) => {
        if ((payload.new as any).action === 'LOCATION_SYNC') silentRefresh();
      }).subscribe(),
    ];

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchInitialData(true);
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      channels.forEach(c => supabase.removeChannel(c));
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [companyId, fetchInitialData]);

  // Compute snapshot stats
  const stats = useMemo(() => {
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
      const bus = buses.find(b => b.id === trip.busId);
      return acc + (bus?.capacity || 0);
    }, 0);

    const occupancyRate = totalCapacity > 0 ? Math.round((seatsBooked / totalCapacity) * 100) : 0;

    const liveTrip = schedules.find(s => ['boarding', 'in_transit', 'arrived'].includes(s.tripStatus || '')) ||
      todayTrips.filter(t => t.departureDateTime > new Date()).sort((a, b) => a.departureDateTime.getTime() - b.departureDateTime.getTime())[0];

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
  }, [schedules, bookings, buses]);

  const showAlert = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    if (type === 'error') {
      setGlobalError(message);
      setTimeout(() => setGlobalError(''), 4000);
    } else {
      setSuccessMessage(message);
      setTimeout(() => setSuccessMessage(''), 4000);
    }
  }, []);

  return {
    user,
    userProfile,
    authLoading,
    signOut,
    loading,
    isLoading: loading,
    globalError,
    setGlobalError,
    successMessage,
    setSuccessMessage,
    operatorInfo,
    assignedRoutes,
    schedules,
    buses,
    bookings,
    liveLocation,
    stats,
    fetchInitialData,
    showAlert,
  };
}

export default useOperatorDashboard;
