"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import * as dbActions from '@/lib/actions/db.actions';
import { useAuth } from '@/contexts/AuthContext';
import { Company, Schedule, Route, Bus, Booking } from '@/types';
import { useAlert, useRealtimeBookings } from './useDashboard';
import { getAvailableTabs } from '../_lib/constants';

export function useAdminDashboard() {
  const { user, userProfile, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { alert, showAlert, clearAlert } = useAlert();

  const [activeTab, setActiveTab] = useState<string>('overview');
  const [activeCategory, setActiveCategory] = useState<string>('overview');
  const [categorySubTabs, setCategorySubTabs] = useState<Record<string, string>>({
    overview: 'overview', fleet: 'schedules', sales: 'bookings',
    team: 'operators', payments: 'payments', reports: 'reports', config: 'profile',
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [dashboardData, setDashboardData] = useState<{ company: Company | null; schedules: Schedule[]; routes: Route[]; buses: Bus[]; bookings: Booking[]; reports: any[] }>({
    company: null, schedules: [], routes: [], buses: [], bookings: [], reports: [],
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const companyId = userProfile?.companyId?.trim() || '';
  const { bookings, setBookings, realtimeStatus } = useRealtimeBookings(companyId, showAlert, activeTab as any);

  useEffect(() => { setDashboardData(prev => ({ ...prev, bookings })); }, [bookings]);

  const statistics = useMemo(() => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    return {
      pendingBookings: bookings.filter(b => b.bookingStatus === 'pending').length,
      missedSchedules: dashboardData.schedules.filter(s => {
        const dep = new Date(s.departureDateTime);
        return dep < now && s.status === 'active' && s.tripStatus === 'scheduled';
      }).length,
      newPayments: bookings.filter(b => {
        if (b.paymentStatus !== 'paid' || !b.paidAt) return false;
        return new Date(b.paidAt) > yesterday;
      }).length,
      pendingReports: (dashboardData.reports || []).length === 0 && bookings.some(b => b.paymentStatus === 'paid') ? 1 : 0,
    };
  }, [bookings, dashboardData.schedules, dashboardData.reports]);

  const paymentSettings = dashboardData.company?.paymentSettings;
  const availableTabs = useMemo(() => getAvailableTabs(paymentSettings), [paymentSettings]);
  const isValidUser = useMemo(() => !!(user && userProfile?.role === 'company_admin' && userProfile.companyId), [user, userProfile]);

  const fetchCollectionData = useCallback(async (table: string, cId: string): Promise<any[]> => {
    if (!cId) return [];
    try {
      const { data, error } = await supabase.from(table).select('*').eq('companyId', cId);
      if (error) throw error;
      return (data || []).map(d => ({
        ...d,
        departureDateTime: d.departureDateTime ? new Date(d.departureDateTime) : undefined,
        arrivalDateTime:   d.arrivalDateTime   ? new Date(d.arrivalDateTime)   : undefined,
        createdAt: new Date(d.createdAt),
        updatedAt: new Date(d.updatedAt),
      }));
    } catch (err: any) { console.error(`Error fetching ${table}:`, err); throw err; }
  }, []);

  const fetchInitialData = useCallback(async () => {
    if (!companyId || authLoading) return;
    try {
      setLoading(true);
      const { data: companyData, error: companyError } = await supabase
        .from('Company').select('*').eq('id', companyId).single();
      if (companyError || !companyData) { showAlert('error', 'Company not found.'); return; }
      const [schedules, routes, buses, reports] = await Promise.all([
        fetchCollectionData('Schedule', companyId),
        fetchCollectionData('Route', companyId),
        fetchCollectionData('Bus', companyId),
        fetchCollectionData('DailyReport', companyId),
      ]);
      setDashboardData(prev => ({
        ...prev,
        company: { ...companyData, createdAt: new Date(companyData.createdAt), updatedAt: new Date(companyData.updatedAt) } as Company,
        schedules, routes, buses, reports,
      }));
    } catch (err: any) { showAlert('error', err.message || 'Failed to load dashboard data'); }
    finally { setLoading(false); }
  }, [companyId, authLoading, showAlert, fetchCollectionData]);

  const updateDashboardData = useCallback(
    <T extends keyof typeof dashboardData>(key: T, value: any) =>
      setDashboardData(prev => ({ ...prev, [key]: value })), []);

  const addItem = useCallback(async (table: string, data: any): Promise<string | null> => {
    try {
      const processed = { ...data, companyId };
      let result: any;
      if (table === 'Schedule') result = await dbActions.createSchedule(processed);
      else if (table === 'Route') result = await dbActions.createRoute(processed);
      else if (table === 'Bus') { result = await dbActions.createBus(processed); }
      else throw new Error(`Unsupported table: ${table}`);
      if (!result.success) throw new Error(result.error);
      showAlert('success', `${table} added successfully`);
      await fetchInitialData();
      return result.data!.id;
    } catch (err: any) { showAlert('error', err.message || `Failed to add ${table}`); return null; }
  }, [companyId, showAlert, fetchInitialData]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    if (!userProfile) return;
    if (userProfile.role !== 'company_admin') { showAlert('error', 'Access denied.'); router.push('/'); return; }
    if (!userProfile.companyId) { showAlert('info', 'Please finish setting up your company.'); router.push('/company/setup'); return; }
    const urlCompanyId = searchParams?.get('companyId');
    if (urlCompanyId && urlCompanyId !== userProfile.companyId) {
      showAlert('error', 'Restricted access: URL company mismatch.');
      router.push(`/company/admin?companyId=${userProfile.companyId}`);
      return;
    }
    fetchInitialData();
  }, [user, userProfile, authLoading, router, searchParams, fetchInitialData, showAlert]);

  return {
    // auth & user
    user, userProfile, authLoading, signOut,
    // UI state
    activeTab, setActiveTab, activeCategory, setActiveCategory, categorySubTabs, setCategorySubTabs,
    isMobileOpen, setIsMobileOpen, isCollapsed, setIsCollapsed,
    // data
    dashboardData, setDashboardData, loading, searchQuery, setSearchQuery, searchFocused, setSearchFocused, searchRef,
    // realtime/bookings
    bookings, setBookings, realtimeStatus,
    // helpers
    statistics, paymentSettings, availableTabs, isValidUser,
    // actions
    fetchInitialData, fetchCollectionData, updateDashboardData, addItem,
    // alerts
    alert, showAlert, clearAlert,
  } as const;
}

export default useAdminDashboard;
