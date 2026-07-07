"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import * as dbActions from '@/lib/actions/db.actions';
import { useAuth } from '@/contexts/AuthContext';
import { Company, Schedule, Route, Bus, Booking } from '@/types';
import { useAlert, useRealtimeBookings } from './useDashboard';
import { getAvailableTabs, CATEGORIES } from '../_lib/constants';

export function useAdminDashboard() {
  const { user, userProfile, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { alert, showAlert, clearAlert } = useAlert();

  const [activeTab, setActiveTab] = useState<string>('overview');
  const [activeCategory, setActiveCategory] = useState<string>('overview');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleCategoryChange = useCallback((cat: string) => {
    setActiveCategory(cat);
    const category = CATEGORIES.find(c => c.id === cat);
    if (category && category.subTabs.length > 0) {
      setActiveTab(category.subTabs[0]);
    }
  }, []);
  const [dashboardData, setDashboardData] = useState<{ company: Company | null; schedules: Schedule[]; routes: Route[]; buses: Bus[]; bookings: Booking[]; reports: any[]; operators: any[]; regions: any[] }>({
    company: null, schedules: [], routes: [], buses: [], bookings: [], reports: [], operators: [], regions: [],
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
  const isValidUser = useMemo(() => !!(user && (userProfile?.role === 'company_admin' || userProfile?.role === 'superadmin') && userProfile.companyId), [user, userProfile]);

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
      console.log("[useAdminDashboard] Fetching Company with ID:", companyId);
      const { data: companyData, error: companyError } = await supabase
        .from('Company').select('*').eq('id', companyId).single();
      
      console.log("[useAdminDashboard] Company Fetch Result:", { companyData, companyError });
      
      if (companyError || !companyData) { 
        console.error("[useAdminDashboard] ERROR fetching company:", companyError);
        showAlert('error', `Company not found: ${companyError?.message || 'No data'}`); 
        return; 
      }
      
      const [schedules, routes, buses, reports, regions, operatorsRes, operatorAssignmentsRes] = await Promise.all([
        fetchCollectionData('Schedule', companyId),
        fetchCollectionData('Route', companyId),
        fetchCollectionData('Bus', companyId),
        fetchCollectionData('DailyReport', companyId),
        fetchCollectionData('Region', companyId),
        supabase.from('User').select('*').eq('companyId', companyId).in('role', ['operator', 'conductor']).order('createdAt', { ascending: false }),
        supabase.from('Operator').select('id, uid, regionId').eq('companyId', companyId),
      ]);
      const operatorAssignments = (operatorAssignmentsRes.data || []) as Array<{ id: string; uid?: string | null; regionId?: string | null }>;
      const assignmentByKey = new Map<string, { regionId?: string | null }>();
      operatorAssignments.forEach((assignment) => {
        if (assignment.id) assignmentByKey.set(assignment.id, assignment);
        if (assignment.uid) assignmentByKey.set(assignment.uid, assignment);
      });

      const operators = (operatorsRes.data || []).map((op: any) => {
        const assignment = assignmentByKey.get(op.id) || assignmentByKey.get(op.uid);
        return {
          ...op,
          regionId: op.regionId || assignment?.regionId || null,
        };
      });
      setDashboardData(prev => ({
        ...prev,
        company: { ...companyData, createdAt: new Date(companyData.createdAt), updatedAt: new Date(companyData.updatedAt) } as Company,
        schedules, routes, buses, reports, regions, operators,
      }));
    } catch (err: any) { showAlert('error', err.message || 'Failed to load dashboard data'); }
    finally { setLoading(false); }
  }, [companyId, authLoading, showAlert, fetchCollectionData]);

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
      if (table === 'Schedule') result = await dbActions.createSchedule(processed);
      else if (table === 'Route') result = await dbActions.createRoute(processed);
      else if (table === 'Bus') { result = await dbActions.createBus(processed); }
      else throw new Error(`Unsupported table: ${table}`);
      if (!result.success) throw new Error(result.error);
      showAlert('success', `${table} added successfully`);
      await fetchInitialData();
      return result.data!.id;
    } catch (err: any) {
      showAlert('error', err.message || `Failed to add ${table}`);
      return null;
    } finally {
      setIsBusy(false);
    }
  }, [companyId, showAlert, fetchInitialData]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    if (!userProfile) return;
    if (!(userProfile.role === 'company_admin' || userProfile.role === 'superadmin')) { showAlert('error', 'Access denied.'); router.push('/'); return; }
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
    // global activity
    isBusy, setIsBusy,
    // alerts
    alert, showAlert, clearAlert,
  } as const;
}

export default useAdminDashboard;
