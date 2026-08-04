"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import * as dbActions from '@/lib/actions/db.actions';
import { useAuth } from '@/contexts/AuthContext';
import { QueryClient } from '@tanstack/react-query';
import { Company, Schedule, Route, Bus, Booking } from '@/types';
import { useAlert, useRealtimeBookings } from './useDashboard';
import { getAvailableTabs, CATEGORIES } from '../_lib/constants';
import { parseUtcDate } from '@/lib/timezone';

export function useAdminDashboard(queryClient: QueryClient) {
  const { user, userProfile, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { alert, showAlert, clearAlert } = useAlert();

  const [activeTab, setActiveTab] = useState<string>('overview');
  const [activeCategory, setActiveCategory] = useState<string>('overview');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const tabParam = searchParams?.get('tab');
    if (tabParam) {
      const cat = CATEGORIES.find(c => (c.subTabs as readonly string[]).includes(tabParam));
      if (cat) {
        setActiveCategory(cat.id);
        setActiveTab(tabParam);
      }
    }
  }, [searchParams]);

  const handleCategoryChange = useCallback((cat: string) => {
    setActiveCategory(cat);
    const category = CATEGORIES.find(c => c.id === cat);
    if (category && category.subTabs.length > 0) {
      setActiveTab(category.subTabs[0]);
    }
  }, []);

  const [dashboardData, setDashboardData] = useState<{ company: Company | null; schedules: Schedule[]; routes: Route[]; buses: Bus[]; bookings: Booking[]; reports: any[]; operators: any[]; regions: any[]; templates: any[] }>({
    company: null, schedules: [], routes: [], buses: [], bookings: [], reports: [], operators: [], regions: [], templates: [],
  });
  const [loading, setLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const companyId = userProfile?.companyId?.trim() || '';
  const { bookings, setBookings, realtimeStatus } = useRealtimeBookings(companyId, showAlert, activeTab as any);

  useEffect(() => { setDashboardData(prev => ({ ...prev, bookings })); }, [bookings]);

  const statistics = useMemo(() => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const MISSED_SCHEDULES_WINDOW_DAYS = 7;
    const missedWindowStart = new Date(now);
    missedWindowStart.setDate(missedWindowStart.getDate() - MISSED_SCHEDULES_WINDOW_DAYS);

    return {
      pendingBookings: bookings.filter(b => b.bookingStatus === 'pending').length,
      missedSchedules: dashboardData.schedules.filter(s => {
        const dep = parseUtcDate(s.departureDateTime as unknown as string);
        return dep >= missedWindowStart && dep < now && s.status === 'active' && s.tripStatus === 'scheduled';
      }).length,
      newPayments: bookings.filter(b => {
        if (b.paymentStatus !== 'paid' || !b.paidAt) return false;
        return parseUtcDate(b.paidAt as unknown as string) > yesterday;
      }).length,
      pendingReports: (dashboardData.reports || []).length === 0 && bookings.some(b => b.paymentStatus === 'paid') ? 1 : 0,
    };
  }, [bookings, dashboardData.schedules, dashboardData.reports]);

  const paymentSettings = dashboardData.company?.paymentSettings;
  const availableTabs = useMemo(() => getAvailableTabs(paymentSettings), [paymentSettings]);
  const isValidUser = useMemo(() => !!(user && (userProfile?.role === 'company_admin' || userProfile?.role === 'superadmin') && userProfile.companyId), [user, userProfile]);

  const fetchCollectionData = useCallback(async (table: string, cId: string): Promise<any[]> => {
    if (!cId) return [];
    try {
      const { data, error } = await supabase.from(table).select('*').eq('companyId', cId);
      if (error) throw error;
      return (data || []).map(d => ({
        ...d,
        departureDateTime: d.departureDateTime ? parseUtcDate(d.departureDateTime) : undefined,
        arrivalDateTime:   d.arrivalDateTime   ? parseUtcDate(d.arrivalDateTime)   : undefined,
        createdAt: parseUtcDate(d.createdAt),
        updatedAt: parseUtcDate(d.updatedAt),
      }));
    } catch (err: any) { console.error(`Error fetching ${table}:`, err); throw err; }
  }, []);

  // Stable ref for showAlert so fetchInitialData never gets a new reference from it
  const showAlertRef = useRef(showAlert);
  showAlertRef.current = showAlert;

  // Guard against duplicate fetches
  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);
  const hasLoadedOnceRef = useRef(false); // tracks whether first fetch completed

  const fetchInitialData = useCallback(async () => {
    if (!companyId || isFetchingRef.current) return;
    isFetchingRef.current = true;
    // Only show the full-screen loading state on the very first fetch.
    // Background refetches (after CRUD actions) update silently.
    try {
      if (!hasLoadedOnceRef.current) setLoading(true);
      const { data: companyData, error: companyError } = await supabase
        .from('Company').select('*').eq('id', companyId).single();
      
      if (companyError || !companyData) { 
        console.error("[useAdminDashboard] ERROR fetching company:", companyError);
        showAlertRef.current('error', `Company not found: ${companyError?.message || 'No data'}`); 
        return; 
      }
      
      const [reports, templates, schedules, routes, buses, regions, operators] = await Promise.all([
        fetchCollectionData('DailyReport', companyId),
        fetchCollectionData('ScheduleTemplate', companyId),
        fetchCollectionData('Schedule', companyId),
        fetchCollectionData('Route', companyId),
        fetchCollectionData('Bus', companyId),
        fetchCollectionData('Region', companyId),
        fetchCollectionData('Operator', companyId),
      ]);

      setDashboardData(prev => ({
        ...prev,
        company: { ...companyData, createdAt: new Date(companyData.createdAt), updatedAt: new Date(companyData.updatedAt) } as Company,
        schedules,
        routes,
        buses,
        reports,
        regions,
        operators,
        templates,
      }));

      // Globally invalidate all TanStack Query caches for this company
      // This ensures that any CRUD operation (which calls refreshData) instantly updates all UI components
      const keys = ['reports', 'templates', 'schedules', 'routes', 'buses', 'regions', 'operators'];
      keys.forEach(key => queryClient.invalidateQueries({ queryKey: [key, companyId] }));
      
    } catch (err: any) { showAlertRef.current('error', err.message || 'Failed to load dashboard data'); }
    finally { setLoading(false); hasLoadedOnceRef.current = true; isFetchingRef.current = false; }
  }, [companyId, fetchCollectionData, queryClient]);

  // Global search filtering
  const filteredDashboardData = useMemo(() => {
    if (!searchQuery.trim()) return dashboardData;
    const query = searchQuery.toLowerCase();
    
    return {
      ...dashboardData,
      schedules: dashboardData.schedules.filter(s => 
        s.departureLocation?.toLowerCase().includes(query) ||
        s.arrivalLocation?.toLowerCase().includes(query) ||
        s.tripNotes?.toLowerCase().includes(query)
      ),
      routes: dashboardData.routes.filter(r => 
        r.name?.toLowerCase().includes(query) ||
        r.origin?.toLowerCase().includes(query) ||
        r.destination?.toLowerCase().includes(query)
      ),
      buses: dashboardData.buses.filter(b => 
        b.licensePlate?.toLowerCase().includes(query) ||
        b.busType?.toLowerCase().includes(query)
      ),
      bookings: dashboardData.bookings.filter(b => 
        b.bookingReference?.toLowerCase().includes(query) ||
        b.contactEmail?.toLowerCase().includes(query) ||
        b.contactPhone?.toLowerCase().includes(query) ||
        (b.passengerDetails as any[])?.some(p => p.name?.toLowerCase().includes(query))
      ),
      operators: dashboardData.operators.filter(op => 
        op.firstName?.toLowerCase().includes(query) ||
        op.lastName?.toLowerCase().includes(query) ||
        op.email?.toLowerCase().includes(query) ||
        op.phone?.toLowerCase().includes(query)
      ),
      regions: dashboardData.regions.filter(reg => 
        reg.name?.toLowerCase().includes(query) ||
        reg.code?.toLowerCase().includes(query)
      )
    };
  }, [dashboardData, searchQuery]);

  const updateDashboardData = useCallback(
    <T extends keyof typeof dashboardData>(key: T, value: any) =>
      setDashboardData(prev => ({ ...prev, [key]: value })), []);

  const addItem = useCallback(async (table: string, data: any): Promise<string | null> => {
    setIsBusy(true);
    try {
      const processed = { ...data, companyId };
      let result: any;
      let queryKey = '';
      if (table === 'Schedule') { result = await dbActions.createSchedule(processed); queryKey = 'schedules'; }
      else if (table === 'Route') { result = await dbActions.createRoute(processed); queryKey = 'routes'; }
      else if (table === 'Bus') { result = await dbActions.createBus(processed); queryKey = 'buses'; }
      else throw new Error(`Unsupported table: ${table}`);
      if (!result.success) throw new Error(result.error);
      showAlertRef.current('success', `${table} added successfully`);
      
      // Invalidate the TanStack Query cache so the UI updates immediately
      if (queryKey) {
        queryClient.invalidateQueries({ queryKey: [queryKey, companyId] });
      }
      
      await fetchInitialData();
      return result.data!.id;
    } catch (err: any) {
      showAlertRef.current('error', err.message || `Failed to add ${table}`);
      return null;
    } finally {
      setIsBusy(false);
    }
  }, [companyId, fetchInitialData, queryClient]);

  // Main initialization effect — stable deps only
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    if (!userProfile) return;
    if (!(userProfile.role === 'company_admin' || userProfile.role === 'superadmin')) { router.push('/unauthorized'); return; }
    if (!userProfile.companyId) { showAlertRef.current('info', 'Please finish setting up your company.'); router.push('/company/setup'); return; }
    const urlCompanyId = searchParams?.get('companyId');
    if (urlCompanyId && urlCompanyId !== userProfile.companyId) {
      showAlertRef.current('error', 'Restricted access: URL company mismatch.');
      router.push(`/company/admin?companyId=${userProfile.companyId}`);
      return;
    }

    // Only fetch once per mount (or if companyId actually changes)
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchInitialData();
    }
  }, [user, userProfile, authLoading, router, companyId, fetchInitialData]);

  // Reset the fetch guard if companyId changes (e.g. superadmin switching companies)
  useEffect(() => {
    hasFetchedRef.current = false;
  }, [companyId]);

  return {
    // auth & user
    user, userProfile, authLoading, signOut, companyId,
    // UI state
    activeTab, setActiveTab, activeCategory, setActiveCategory: handleCategoryChange,
    isMobileOpen, setIsMobileOpen, isCollapsed, setIsCollapsed,
    // data
    dashboardData: filteredDashboardData, setDashboardData, loading, searchQuery, setSearchQuery,
    // realtime/bookings
    bookings, setBookings, realtimeStatus,
    // helpers
    statistics, paymentSettings, availableTabs, isValidUser,
    // actions
    fetchInitialData, fetchCollectionData, updateDashboardData, addItem,
    refreshData: fetchInitialData,
    // global activity
    isBusy, setIsBusy,
    // alerts
    alert, showAlert, clearAlert,
  } as const;
}

export default useAdminDashboard;
