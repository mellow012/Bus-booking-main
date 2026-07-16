"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import * as dbActions from '@/lib/actions/db.actions';
import { Company, Booking, Schedule, Route, Bus, OperatorProfile, ConductorProfile, Promotion } from '@/types/index';

type LoadingStates = { companies: boolean; bookings: boolean; promotions: boolean; creating: boolean; updating: boolean; deleting: boolean; initializing: boolean };

export default function useAdminDashboard() {
  const router = useRouter();
  const { user, userProfile } = useAuth();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [operators, setOperators] = useState<(OperatorProfile | ConductorProfile)[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);

  const [stats, setStats] = useState<any>({});
  const [refreshCount, setRefreshCount] = useState(0);

  const [loadingStates, setLoadingStates] = useState<LoadingStates>({
    companies: true, bookings: true, promotions: true, creating: false, updating: false, deleting: false, initializing: true,
  });

  const setLoadingState = useCallback((key: keyof LoadingStates, value: boolean) => {
    setLoadingStates(prev => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    if (!user) return;
    if (!userProfile) return;
    if (userProfile.role !== 'superadmin') { router.push('/'); return; }

    setLoadingState('initializing', true);

    const fetchDashboardData = async () => {
      try {
        const res = await fetch('/api/admin/data');
        if (!res.ok) throw new Error('Failed to fetch dashboard data');
        const { data } = await res.json();

        setCompanies(data.companies);
        setBookings(data.bookings);
        setSchedules(data.schedules);
        setRoutes(data.routes);
        setBuses(data.buses);
        setOperators(data.operators);
        setStats(data.stats);

        setLoadingState('companies', false);
        setLoadingState('bookings', false);
      } catch (err) {
        // silently surface to page via setLoadingStates
        setLoadingState('companies', false);
        setLoadingState('bookings', false);
        console.error(err);
      } finally {
        setLoadingState('initializing', false);
      }
    };

    const fetchPromotions = async () => {
      try {
        const res = await fetch('/api/promotions');
        const data = await res.json();
        if (data.success) setPromotions(data.data);
      } catch (err) {
        console.error('Failed to fetch promotions:', err);
      } finally {
        setLoadingState('promotions', false);
      }
    };

    fetchDashboardData();
    fetchPromotions();
  }, [user, userProfile, refreshCount, router, setLoadingState]);

  return {
    companies, setCompanies,
    bookings, setBookings,
    schedules, setSchedules,
    routes, setRoutes,
    buses, setBuses,
    operators, setOperators,
    promotions, setPromotions,
    stats, setStats,
    refreshCount, setRefreshCount,
    loadingStates, setLoadingStates, setLoadingState,
  };
}
