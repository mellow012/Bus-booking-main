"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import * as dbActions from "@/lib/actions/db.actions";
import { useAuth } from "@/contexts/AuthContext";
import { Company, Schedule, Route, Bus, Booking } from "@/types";
import {
  Building2,
  Loader2,
  DollarSign,
  Users,
  Calendar,
  Truck,
  MapPin,
  X,
  User,
  Settings,
  AlertTriangle,
  Bell,
  Menu,
  ChevronRight,
  ChevronLeft,
  LayoutDashboard,
  LogOut,
  Search,
  HelpCircle,
  BarChart3,
  PieChart,
  Bus as BusIcon,
} from "lucide-react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import Fuse from "fuse.js";
import AlertMessage from "@/components/AlertMessage";
import SchedulesTab from "@/components/scheduleTab";
import RoutesTab from "@/components/routesTab";
import BusesTab from "@/components/busesTab";
import BookingsTab from "@/components/bookingTab";
import CompanyProfileTab from "@/components/company-Profile";
import SettingsTab from "@/components/SettingsTab";
import PaymentsTab from "@/components/PaymentTab";
import TeamManagementTab from "@/components/OperatorsTab";
import OverviewTab from "@/components/OverviewTab";
import DailyReportsTab from "@/components/ReportsTab";
import NotificationsManagementTab from "@/components/NotificationsManagementTab";

// ── Constants ────────────────────────────────────────────────────────────────
const TABS = [
  { id: "overview"      as const, label: "Overview",      icon: LayoutDashboard },
  { id: "schedules"     as const, label: "Schedules",     icon: Calendar },
  { id: "routes"        as const, label: "Routes",        icon: MapPin },
  { id: "buses"         as const, label: "Buses",         icon: Truck },
  { id: "bookings"      as const, label: "Bookings",      icon: Users },
  { id: "operators"     as const, label: "Team",          icon: Users },
  { id: "reports"       as const, label: "Reports",       icon: PieChart },
  { id: "profile"       as const, label: "Profile",       icon: User },
  { id: "settings"      as const, label: "Settings",      icon: Settings },
  { id: "payments"      as const, label: "Payments",      icon: DollarSign },
  { id: "notifications" as const, label: "Notifications", icon: Bell },
] as const;

const CATEGORIES = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, subTabs: ["overview"] },
  { id: "fleet",    label: "Fleet & Ops", icon: Truck, subTabs: ["schedules", "routes", "buses"] },
  { id: "sales",    label: "Sales & Rev", icon: DollarSign, subTabs: ["bookings", "reports", "payments"] },
  { id: "team",     label: "Team Management", icon: Users, subTabs: ["operators"] },
  { id: "config",   label: "Configuration", icon: Settings, subTabs: ["profile", "settings", "notifications"] },
] as const;

const BUS_TYPES     = ["AC", "Non-AC", "Sleeper", "Semi-Sleeper", "Luxury", "Economy", "Minibus"] as const;
const BUS_STATUSES  = ["active", "inactive", "maintenance"] as const;
const CAPACITY_LIMITS = { min: 10, max: 100 } as const;
const MAX_RECONNECT_ATTEMPTS = 3;
// Removed AUTO_REFRESH_INTERVAL — we rely on realtime listeners instead

type TabType  = typeof TABS[number]["id"];
type CategoryType = typeof CATEGORIES[number]["id"];
type AlertType = { type: "error" | "success" | "warning" | "info"; message: string } | null;

interface DashboardData {
  company:   Company | null;
  schedules: Schedule[];
  routes:    Route[];
  buses:     Bus[];
  bookings:  Booking[];
  reports:   any[];
}

interface RealtimeStatus {
  isConnected:    boolean;
  lastUpdate:     Date | null;
  pendingUpdates: number;
}

interface TabObject {
  id:    TabType;
  label: string;
  icon:  typeof TABS[number]["icon"];
}

// ── Utilities ────────────────────────────────────────────────────────────────
const convertDate = (date: any): Date => {
  if (!date) return new Date();
  if (date instanceof Date) return date;
  return new Date(date);
};

const validateBusData = (data: any): void => {
  const missing = ["licensePlate", "busType", "capacity", "status"].filter(f => !data[f]);
  if (missing.length) throw new Error(`Missing required fields: ${missing.join(", ")}`);
  if (data.capacity < CAPACITY_LIMITS.min || data.capacity > CAPACITY_LIMITS.max)
    throw new Error(`Capacity must be between ${CAPACITY_LIMITS.min} and ${CAPACITY_LIMITS.max}`);
  if (!BUS_TYPES.includes(data.busType))    throw new Error("Invalid bus type");
  if (!BUS_STATUSES.includes(data.status))  throw new Error("Invalid status");
};

const getAvailableTabs = (paymentSettings: Company["paymentSettings"] | undefined): TabObject[] => {
  const base: TabObject[] = [...TABS] as unknown as TabObject[];
  if (
    paymentSettings &&
    Object.keys(paymentSettings).length > 0 &&
    (paymentSettings.paychanguEnabled)
  ) {
    if (!base.some(t => t.id === "payments"))
      base.push({ id: "payments" as const, label: "Payments", icon: DollarSign });
  }
  return base;
};

// ── Custom hooks ─────────────────────────────────────────────────────────────
const useAlert = () => {
  const [alert, setAlert] = useState<AlertType>(null);

  const showAlert = useCallback(
    <T extends "error" | "success" | "warning" | "info">(
      type: T,
      message: string
    ) => {
      setAlert({ type, message });
    },
    []
  );

  const clearAlert = useCallback(() => setAlert(null), []);

  useEffect(() => {
    if (!alert) return;
    const t = setTimeout(clearAlert, alert.type === "error" ? 7000 : 5000);
    return () => clearTimeout(t);
  }, [alert, clearAlert]);

  return { alert, showAlert, clearAlert };
};

// ── OPTIMIZED realtime bookings hook ────────────────────────────────────────
// Changes vs original:
//   1. Added limit(100) to cap reads per snapshot.
//   2. Tracks ALL docs in the snapshot, not just changes, so the local state
//      is always a complete view — avoids stale state bugs.
//   3. Removed reconnect loop that created duplicate listeners.
const useRealtimeBookings = (
  companyId: string | undefined,
  showAlert: (type: "error" | "success" | "warning" | "info", message: string) => void,
  activeTab: TabType
) => {
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>({
    isConnected: false, lastUpdate: null, pendingUpdates: 0,
  });
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    if (!companyId?.trim()) return;

    let reconnectAttempts = 0;

    const subscribe = () => {
      const fetchBookings = async () => {
        const { data, error } = await supabase
          .from('Booking')
          .select('*, Payment(*)')
          .eq('companyId', companyId.trim())
          .order('updatedAt', { ascending: false })
          .limit(100);
          
        if (!error && data) {
          const processed = data.map(d => ({
            ...d,
            paymentMethod: (d as any).Payment?.[0]?.paymentType || (d as any).Payment?.[0]?.provider || (d as any).paymentMethod || (d.paymentStatus === 'paid' ? 'cash' : 'Not specified'),
            transactionId: (d as any).Payment?.[0]?.transactionId || (d as any).transactionId,
            createdAt: new Date(d.createdAt),
            updatedAt: new Date(d.updatedAt),
          })) as Booking[];
          
          if (bookings.length > 0 && processed.length > bookings.length && activeTab === "bookings") {
            const newB = processed.find(b => !bookings.some(old => old.id === b.id));
            if (newB) showAlert("info", `New booking received from ${newB.passengerDetails?.[0]?.name || 'customer'}`);
          }
          
          setBookings(processed);
          setRealtimeStatus({ isConnected: true, lastUpdate: new Date(), pendingUpdates: 0 });
        } else if (error) {
           console.error("Supabase booking fetch error:", error);
           setRealtimeStatus(prev => ({ ...prev, isConnected: false }));
        }
      };

      fetchBookings();

      const channel = supabase
        .channel('admin-bookings-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'Booking', filter: `companyId=eq.${companyId.trim()}` }, () => {
          fetchBookings();
        })
        .subscribe();
        
      return () => { supabase.removeChannel(channel); };
    };

    const unsub = subscribe();
    return () => unsub?.();
  }, [companyId, showAlert, activeTab]);

  return { bookings, setBookings, realtimeStatus };
};

// ── Sidebar ──────────────────────────────────────────────────────────────────
const Sidebar = ({
  activeCategory, setActiveCategory, isMobileOpen, setIsMobileOpen,
  company, onSignOut, isCollapsed, onToggleCollapse, statistics
}: {
  activeCategory: CategoryType;
  setActiveCategory: (cat: CategoryType) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  company: Company | null;
  onSignOut: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  statistics: any;
}) => (
  <>
    {isMobileOpen && (
      <div className="fixed inset-0 bg-black bg-opacity-40 z-40 lg:hidden backdrop-blur-sm" onClick={() => setIsMobileOpen(false)} />
    )}
    <aside className={`fixed left-0 z-50 bg-white border-r border-gray-100 transition-all duration-300 ease-in-out top-0 h-screen overflow-hidden flex flex-col ${
      isMobileOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
    } ${!isMobileOpen && (isCollapsed ? 'lg:w-[72px]' : 'lg:w-64')}`}>
      
      {/* Sidebar Header with Toggle */}
      <div className={`flex items-center p-6 mb-2 ${isCollapsed && !isMobileOpen ? 'justify-center border-b border-gray-50' : 'justify-between'}`}>
        {(!isCollapsed || isMobileOpen) ? (
          <div className="flex items-center space-x-3 overflow-hidden animate-in fade-in duration-300">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-100">
              <BusIcon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-indigo-900 text-[15px] leading-tight truncate">{company?.name || 'Kinetic Admin'}</h1>
              <p className="text-[10px] text-gray-400 font-bold tracking-wider uppercase">Platform</p>
            </div>
          </div>
        ) : (
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-100 animate-in zoom-in duration-300">
            <BusIcon className="w-5 h-5 text-white" />
          </div>
        )}
        
        <button 
          onClick={onToggleCollapse} 
          id="tour-sidebar-toggle"
          className={`hidden lg:flex p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors ${isCollapsed ? 'absolute -right-3 top-12 bg-white border border-gray-100 shadow-sm z-10' : ''}`}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        <button onClick={() => setIsMobileOpen(false)} className="lg:hidden p-2 hover:bg-gray-100 rounded-lg">
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto pt-2 space-y-1 px-3">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          const showLabel = !isCollapsed || isMobileOpen;

          return (
            <button key={cat.id} 
              id={`tour-${cat.id}`}
              onClick={() => { setActiveCategory(cat.id); setIsMobileOpen(false); }}
              className={`w-full flex items-center group transition-all duration-200 relative rounded-xl h-11 ${
                isActive ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              } ${isCollapsed && !isMobileOpen ? 'justify-center px-0' : 'px-4 space-x-3'}`}
            >
              
              <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'group-hover:text-indigo-600 text-gray-400'}`} />
              
              {showLabel && (
                <span className="text-[13px] font-bold flex-1 text-left truncate animate-in slide-in-from-left-2 duration-300">
                  {cat.label}
                </span>
              )}
              
              {showLabel && cat.id === 'sales' && (statistics.pendingBookings > 0 || statistics.newPayments > 0) && (
                <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full border-2 border-white">
                  {statistics.pendingBookings + statistics.newPayments}
                </span>
              )}

              {showLabel && cat.id === 'fleet' && statistics.missedSchedules > 0 && (
                <span className="bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full border-2 border-white">
                  {statistics.missedSchedules}
                </span>
              )}

              {showLabel && cat.id === 'sales' && statistics.pendingReports > 0 && (
                <span className="absolute -right-1 -top-1 w-2 h-2 bg-indigo-400 rounded-full border border-white" />
              )}

              {/* Tooltip for collapsed state */}
              {isCollapsed && !isMobileOpen && (
                <div className="absolute left-[72px] top-1/2 -translate-y-1/2 bg-gray-900 text-white text-[11px] font-bold py-1.5 px-3 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                  {cat.label}
                  <div className="absolute left-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 bg-gray-900 rotate-45" />
                </div>
              )}
            </button>
          );
        })}

        {/* Sign Out Button - Stabilized near Configuration */}
        <div className={`pt-4 mt-4 border-t border-gray-50 flex flex-col gap-1`}>
          <button
            onClick={onSignOut}
            className={`w-full flex items-center group transition-all duration-200 relative rounded-xl h-11 text-red-500 hover:bg-red-50 ${
              isCollapsed && !isMobileOpen ? 'justify-center px-0' : 'px-4 space-x-3'
            }`}
          >
            <LogOut className="w-5 h-5 flex-shrink-0 group-hover:scale-110 transition-transform" />
            {(!isCollapsed || isMobileOpen) && (
              <span className="text-[13px] font-bold animate-in slide-in-from-left-2 duration-300">Sign Out</span>
            )}
            
            {isCollapsed && !isMobileOpen && (
              <div className="absolute left-[72px] top-1/2 -translate-y-1/2 bg-red-600 text-white text-[11px] font-bold py-1.5 px-3 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                Sign Out
                <div className="absolute left-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 bg-red-600 rotate-45" />
              </div>
            )}
          </button>
        </div>
      </nav>

      {/* Mini Profile / Bottom area */}
      {(!isCollapsed || isMobileOpen) && (
        <div className="p-4 bg-gray-50/50 m-3 rounded-2xl animate-in fade-in duration-500">
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-[11px] font-black text-white">
                {company?.name?.[0] || 'K'}
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-gray-900 truncate">V.1.0 Stable</p>
                <div className="flex items-center gap-1 justify-between w-full">
                  <div className="flex items-center gap-1">
                     <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                     <p className="text-[10px] font-bold text-gray-500">Live</p>
                  </div>
                  <button onClick={() => setActiveCategory("sales")} className="text-[9px] font-bold bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-1.5 py-0.5 rounded transition-colors ml-1">
                    Bookings
                  </button>
                </div>
              </div>
           </div>
        </div>
      )}
    </aside>
  </>
);

// ── Sub Navigation ────────────────────────────────────────────────────────────
const SubNav = ({
  activeTab, setActiveTab, subTabs, availableTabs, statistics,
}: {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  subTabs: readonly TabType[];
  availableTabs: TabObject[];
  statistics: any;
}) => {
  const filteredTabs = availableTabs.filter(t => subTabs.includes(t.id));
  
  if (filteredTabs.length <= 1) return null;

  return (
    <div className="bg-white border-b border-gray-100 px-6 py-1 sticky top-[61px] z-20">
      <nav className="flex items-center space-x-8">
        {filteredTabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 text-[13px] font-bold border-b-2 transition-all relative ${
                isActive 
                  ? 'border-brand-primary text-brand-primary' 
                  : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200'
              }`}
              style={isActive ? { borderColor: 'var(--brand-primary)', color: 'var(--brand-primary)' } : {}}
            >
              <div className="flex items-center gap-1.5">
                {tab.label}
                {tab.id === 'bookings' && statistics.pendingBookings > 0 && (
                  <span className="w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                    {statistics.pendingBookings}
                  </span>
                )}
                {tab.id === 'payments' && statistics.newPayments > 0 && (
                  <span className="w-4 h-4 bg-green-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                    {statistics.newPayments}
                  </span>
                )}
                {tab.id === 'reports' && statistics.pendingReports > 0 && (
                  <span className="w-2 h-2 bg-indigo-400 rounded-full" />
                )}
              </div>
              {isActive && (
                 <span className="absolute -bottom-[2px] left-0 right-0 h-[2px] bg-brand-primary rounded-full" style={{ backgroundColor: 'var(--brand-primary)' }} />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { user, userProfile, loading: authLoading, signOut } = useAuth();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { alert, showAlert, clearAlert } = useAlert();

  const [activeTab,      setActiveTab]      = useState<TabType>("overview");
  const [activeCategory, setActiveCategory] = useState<CategoryType>("overview");
  const [categorySubTabs, setCategorySubTabs] = useState<Record<CategoryType, TabType>>({
    overview: "overview",
    fleet: "schedules",
    sales: "bookings",
    team: "operators",
    config: "profile",
  });
  const [isMobileOpen,  setIsMobileOpen]  = useState(false);
  const [isCollapsed,   setIsCollapsed]   = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    company: null, schedules: [], routes: [], buses: [], bookings: [], reports: [],
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery,   setSearchQuery]   = useState("");
  const [searchFocused,  setSearchFocused]  = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const startTour = useCallback(() => {
    const driverObj = driver({
      showProgress: true,
      steps: [
        { element: '.lg\\:static', popover: { title: 'Navigation Sidebar', description: 'Access all your management tools from here. We have grouped 11 modules into 5 smart categories.', side: "left", align: 'start' }},
        { element: '#tour-sidebar-toggle', popover: { title: 'Draw In/Out', description: 'Collapse the sidebar to a "mini-rail" to get more screen space for your data, or draw it out for full labels.', side: "bottom" }},
        { element: '#tour-overview', popover: { title: 'Overview Dashboard', description: 'Get a snapshot of company performance, live statistics, and recent activity.', side: "bottom" }},
        { element: '#tour-fleet', popover: { title: 'Fleet & Operations', description: 'Manage your Schedules, Routes, and Buses all in one place.', side: "bottom" }},
        { element: '#tour-sales', popover: { title: 'Sales & Revenue', description: 'Access Bookings, detailed Daily Reports, and Payment gateways.', side: "bottom" }},
        { element: '#tour-team', popover: { title: 'Team Management', description: 'Control staff access and manage your operators/conductors.', side: "bottom" }},
        { element: '#tour-config', popover: { title: 'Configuration', description: 'Manage your Company Profile, system Settings, and Notifications.', side: "bottom" }},
        { element: '.tour-search-container', popover: { title: 'Quick Search', description: 'Instantly find any route, bus, or schedule across your entire system.', side: "bottom" }},
        { element: '.tour-bell', popover: { title: 'Stay Updated', description: 'Access your notifications here. Stay informed about new bookings and system alerts.', side: "bottom" }},
      ]
    });
    driverObj.drive();
  }, []);

  const companyId = userProfile?.companyId?.trim() || "";
  const { bookings, setBookings, realtimeStatus } = useRealtimeBookings(companyId, showAlert, activeTab);

  // Keep dashboardData.bookings in sync with the realtime slice
  useEffect(() => {
    setDashboardData(prev => ({ ...prev, bookings }));
  }, [bookings]);

  const statistics = useMemo(() => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0,0,0,0);

    return {
      pendingBookings: bookings.filter(b => b.bookingStatus === "pending").length,
      missedSchedules: dashboardData.schedules.filter(s => {
        const dep = new Date(s.departureDateTime);
        return dep < now && s.status === "active" && s.tripStatus === "scheduled";
      }).length,
      newPayments: bookings.filter(b => {
        if (b.paymentStatus !== "paid" || !b.paidAt) return false;
        const paidAt = new Date(b.paidAt);
        return paidAt > yesterday;
      }).length,
      pendingReports: (dashboardData.reports || []).length === 0 && bookings.some(b => b.paymentStatus === "paid") ? 1 : 0,
    };
  }, [bookings, dashboardData.schedules, dashboardData.reports]);

  const paymentSettings = dashboardData.company?.paymentSettings;
  const availableTabs   = useMemo(() => getAvailableTabs(paymentSettings), [paymentSettings]);

  const isValidUser = useMemo(() =>
    !!(user && userProfile?.role === "company_admin" && userProfile.companyId),
    [user, userProfile]
  );

  const handleStatusToggle = useCallback(async () => {
    if (!dashboardData.company) return;
    const newStatus = dashboardData.company.status === "active" ? "inactive" : "active";
    try {
      const result = await dbActions.updateCompany(dashboardData.company.id, { status: newStatus });
      if (!result.success) throw new Error(result.error);
      
      setDashboardData(prev => ({ ...prev, company: prev.company ? { ...prev.company, status: newStatus } : null }));
      showAlert("success", `Company status updated to ${newStatus}`);
    } catch {
      showAlert("error", "Failed to update company status");
    }
  }, [dashboardData.company, showAlert]);

  // ─── OPTIMIZED fetchCollectionData ─────────────────────────────────────────
  // Schedules, routes, buses are fetched once on mount and only re-fetched
  // when the user explicitly triggers an action (add/edit/delete).
  // Bookings are handled by the realtime listener above.
  const fetchCollectionData = useCallback(async (
    table: string,
    companyId: string,
  ): Promise<any[]> => {
    if (!companyId) return [];
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('companyId', companyId);
        
      if (error) throw error;
      
      return (data || []).map(d => ({
        ...d,
        departureDateTime: d.departureDateTime ? new Date(d.departureDateTime) : undefined,
        arrivalDateTime:   d.arrivalDateTime   ? new Date(d.arrivalDateTime)   : undefined,
        createdAt:         new Date(d.createdAt),
        updatedAt:         new Date(d.updatedAt),
      }));
    } catch (err: any) {
      console.error(`Error fetching ${table}:`, err);
      throw err;
    }
  }, []);

  const fetchInitialData = useCallback(async () => {
    if (!companyId || authLoading) return;
    try {
      setLoading(true);
      
      const { data: companyData, error: companyError } = await supabase
        .from('Company')
        .select('*')
        .eq('id', companyId)
        .single();

      if (companyError || !companyData) {
        showAlert("error", "Company not found.");
        return;
      }

      const [schedules, routes, buses, reports] = await Promise.all([
        fetchCollectionData("Schedule", companyId),
        fetchCollectionData("Route",    companyId),
        fetchCollectionData("Bus",      companyId),
        fetchCollectionData("DailyReport", companyId),
      ]);

      setDashboardData(prev => ({ 
        ...prev, 
        company: {
          ...companyData,
          createdAt: new Date(companyData.createdAt),
          updatedAt: new Date(companyData.updatedAt),
        } as Company, 
        schedules, 
        routes, 
        buses,
        reports
      }));
    } catch (err: any) {
      showAlert("error", err.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [companyId, authLoading, showAlert, fetchCollectionData]);

  const addItem = useCallback(async (table: string, data: any): Promise<string | null> => {
    try {
      const processed = { ...data, companyId };
      let result;
      
      if (table === "Schedule") result = await dbActions.createSchedule(processed);
      else if (table === "Route")   result = await dbActions.createRoute(processed);
      else if (table === "Bus") {
         validateBusData(processed);
         result = await dbActions.createBus(processed);
      }
      else throw new Error(`Unsupported table: ${table}`);

      if (!result.success) throw new Error(result.error);
      
      showAlert("success", `${table} added successfully`);
      await fetchInitialData();
      return result.data!.id;
    } catch (err: any) {
      showAlert("error", err.message || `Failed to add ${table}`);
      return null;
    }
  }, [companyId, showAlert, fetchInitialData]);

  const updateDashboardData = useCallback(
    <T extends keyof DashboardData>(key: T, value: DashboardData[T]) =>
      setDashboardData(prev => ({ ...prev, [key]: value })),
    []
  );

  // ── Auth & Data Sync Guard ────────────────────────────────────────────────
  useEffect(() => {
    // 1. Wait for auth to initialize
    if (authLoading) return;
    
    // 2. Ensure user is logged in
    if (!user) {
      router.push("/login");
      return;
    }
    
    // 3. Wait for profile to load (avoid flickering)
    if (!userProfile) return;

    // 4. Role authorization
    if (userProfile.role !== "company_admin") {
      showAlert("error", "Access denied — you are not a company administrator.");
      router.push("/");
      return;
    }

    // 5. Company context check
    if (!userProfile.companyId) {
      showAlert("info", "Welcome! Please finish setting up your company profile.");
      router.push("/company/setup");
      return;
    }

    // 6. Multi-company security: Validate URL param matches profile
    const urlCompanyId = searchParams.get("companyId");
    if (urlCompanyId && urlCompanyId !== userProfile.companyId) {
       showAlert("error", "Restricted access: URL company mismatch.");
       setActiveTab("overview");
       router.push(`/company/admin?companyId=${userProfile.companyId}`);
       return;
    }

    // 7. Success: Trigger initial data fetch
    fetchInitialData();
  }, [user, userProfile, authLoading, router, searchParams, fetchInitialData, showAlert]);

  // ── Render active tab ──────────────────────────────────────────────────────
  const renderActiveTab = () => {
    const { company, schedules, routes, buses } = dashboardData;
    const commonProps = {
  setError:   (msg: string) => showAlert("error"   as const, msg),
  setSuccess: (msg: string) => showAlert("success" as const, msg),
  // If you ever add these:
  // setWarning: (msg: string) => showAlert("warning" as const, msg),
  // setInfo:    (msg: string) => showAlert("info"    as const, msg),
} as const;   // ← this helps TS infer everything perfectly

    if (loading) return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 animate-pulse rounded"></div>
        <div className="h-96 bg-gray-200 animate-pulse rounded"></div>
      </div>
    );

    switch (activeTab) {
      case "overview":
        return <OverviewTab dashboardData={dashboardData} realtimeStatus={realtimeStatus} setActiveTab={setActiveTab} handleStatusToggle={handleStatusToggle} paymentSettings={paymentSettings as Record<string, any>} />;

      case "schedules":
        return (
          <SchedulesTab
            companyId={companyId}
            schedules={schedules}
            user={user}
            userProfile={userProfile}
            // ✅ After
setSchedules={(newSchedules) => {
  const updated = Array.isArray(newSchedules)
    ? newSchedules.map(s => ({
        ...s,
        departureDateTime: s.departureDateTime instanceof Date ? s.departureDateTime : ((d: any) => d?.toDate?.() ?? new Date(d))(s.departureDateTime),
        arrivalDateTime:   s.arrivalDateTime   instanceof Date ? s.arrivalDateTime   : ((d: any) => d?.toDate?.() ?? new Date(d))(s.arrivalDateTime),
      }))
    : schedules;
  updateDashboardData("schedules", updated);
}}
            routes={routes}
            buses={buses}
            addSchedule={async (data) => addItem("Schedule", {
              ...data,
              departureDateTime: new Date(data.departureDateTime),
              arrivalDateTime:   new Date(data.arrivalDateTime),
            })}
            isAdmin={userProfile?.role === "company_admin" || userProfile?.role === "superadmin"}
            {...commonProps}
          />
        );

      case "routes":
        return (
          <RoutesTab
            companyId={companyId}
            routes={routes}
            setRoutes={(newRoutes) => updateDashboardData("routes", typeof newRoutes === "function" ? newRoutes(routes) : newRoutes)}
            addRoute={(data) => addItem("Route", data)}
            {...commonProps}
          />
        );

      case "buses":
        return (
          <BusesTab
            buses={buses}
            companyId={companyId}
            setBuses={(newBuses) => updateDashboardData("buses", typeof newBuses === "function" ? newBuses(buses) : newBuses)}
            {...commonProps}
          />
        );

      case "bookings": {
        return (
        <BookingsTab
          schedules={schedules}
          routes={routes}
          buses={buses}
          companyId={companyId}
          user={user}
          userProfile={userProfile}
          isAdmin={userProfile?.role === "company_admin" || userProfile?.role === "superadmin"}
        />
        );
      }

      case "profile":
        return company ? (
          <CompanyProfileTab
            company={company}
            schedules={schedules}
            routes={routes}
            setCompany={(c) => updateDashboardData("company", c as Company)}
            {...commonProps}
          />
        ) : null;

      case "settings":
        return company ? (
          <SettingsTab
            company={company}
            setCompany={(c) => updateDashboardData("company", c as Company)}
            {...commonProps}
          />
        ) : null;

      case "operators":
        return company ? <TeamManagementTab companyId={companyId} {...commonProps} /> : null;

      case "payments":
        return company ? (
          <PaymentsTab company={company} paymentSettings={paymentSettings as unknown as Record<string, unknown> ?? {}} bookings={bookings} buses={buses} {...commonProps} />
        ) : null;

      case "reports":
        return (
          <DailyReportsTab 
            schedules={schedules} 
            bookings={bookings} 
            buses={buses} 
            routes={routes} 
            companyId={companyId} 
            user={user} 
            userProfile={userProfile} 
            {...commonProps} 
          />
        );

      case "notifications":
        return (
          <NotificationsManagementTab 
            userId={userProfile?.id || userProfile?.uid || user?.id || ""} 
            companyId={companyId} 
            {...commonProps} 
          />
        );

      default:
        return <div className="text-center py-12"><p className="text-gray-500">Tab not found</p></div>;
    }
  };

  if (loading || authLoading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto" />
        <p className="mt-4 text-gray-600">Loading dashboard...</p>
      </div>
    </div>
  );

  if (!isValidUser) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center bg-white p-8 rounded-2xl shadow-lg max-w-md">
        <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Access Denied</h2>
        <p className="text-gray-600 mb-6">You don't have permission to access this dashboard.</p>
        <button onClick={() => router.push("/login")} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          Go to Login
        </button>
      </div>
    </div>
  );

  if (!dashboardData.company) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center bg-white p-8 rounded-2xl shadow-lg max-w-md">
        <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Company Not Found</h2>
        <p className="text-gray-600 mb-6">Please ensure your company is set up correctly or contact support.</p>
        <button onClick={() => router.push("/support")} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          Contact Support
        </button>
      </div>
    </div>
  );

  const { company } = dashboardData;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar
        activeCategory={activeCategory}
        setActiveCategory={(cat) => {
          setActiveCategory(cat);
          setActiveTab(categorySubTabs[cat]);
        }}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        company={company}
        onSignOut={signOut}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        statistics={statistics}
      />

      <div className={`flex-1 flex flex-col min-h-screen relative transition-all duration-300 ease-in-out ${isCollapsed ? 'lg:pl-[72px]' : 'lg:pl-64'}`}>
        <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center space-x-4 flex-1">
              <button onClick={() => setIsMobileOpen(true)} className="lg:hidden p-2 hover:bg-gray-100 rounded-lg">
                <Menu className="w-5 h-5" />
              </button>
              {/* Fuzzy Search Bar */}
              <div ref={searchRef} className="hidden md:block relative max-w-md w-full tour-search-container">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2 z-10" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                  placeholder="Search routes, buses, or schedules…"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-800 placeholder-gray-400 font-medium transition-all"
                />
                {/* Search Results Dropdown */}
                {searchFocused && searchQuery.trim().length > 0 && (() => {
                  const q = searchQuery.trim();
                  
                  // Initialize Fuse instances
                  const routeFuse = new Fuse(dashboardData.routes, {
                    keys: ["origin", "destination"],
                    threshold: 0.3,
                  });
                  const busFuse = new Fuse(dashboardData.buses, {
                    keys: ["licensePlate", "busType"],
                    threshold: 0.3,
                  });
                  const scheduleFuse = new Fuse(dashboardData.schedules, {
                    keys: [
                      { name: "route.origin", getFn: (s) => dashboardData.routes.find(r => r.id === s.routeId)?.origin || "" },
                      { name: "route.destination", getFn: (s) => dashboardData.routes.find(r => r.id === s.routeId)?.destination || "" },
                      { name: "bus.licensePlate", getFn: (s) => dashboardData.buses.find(b => b.id === s.busId)?.licensePlate || "" },
                    ],
                    threshold: 0.3,
                  });

                  const matchedRoutes = routeFuse.search(q).map(r => r.item).slice(0, 3);
                  const matchedBuses = busFuse.search(q).map(b => b.item).slice(0, 3);
                  const matchedSchedules = scheduleFuse.search(q).map(s => s.item).slice(0, 3);
                  
                  const hasResults = matchedRoutes.length > 0 || matchedBuses.length > 0 || matchedSchedules.length > 0;

                  return hasResults ? (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50 max-h-80 overflow-y-auto">
                      {matchedRoutes.length > 0 && (
                        <div>
                          <p className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50">Routes</p>
                          {matchedRoutes.map(r => (
                            <button key={r.id} onClick={() => { setActiveTab('routes'); setSearchQuery(''); }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 transition-colors text-left">
                              <MapPin className="w-4 h-4 text-indigo-500 shrink-0" />
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{r.origin} → {r.destination}</p>
                                <p className="text-xs text-gray-400">{r.isActive ? 'Active' : 'Inactive'}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {matchedBuses.length > 0 && (
                        <div>
                          <p className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50">Buses</p>
                          {matchedBuses.map(b => (
                            <button key={b.id} onClick={() => { setActiveTab('buses'); setSearchQuery(''); }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 transition-colors text-left">
                              <Truck className="w-4 h-4 text-green-500 shrink-0" />
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{b.licensePlate}</p>
                                <p className="text-xs text-gray-400">{b.busType} · {b.capacity} seats · {b.status}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {matchedSchedules.length > 0 && (
                        <div>
                          <p className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50">Schedules</p>
                          {matchedSchedules.map(s => {
                            const route = dashboardData.routes.find(r => r.id === s.routeId);
                            return (
                              <button key={s.id} onClick={() => { setActiveTab('schedules'); setSearchQuery(''); }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 transition-colors text-left">
                                <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
                                <div>
                                  <p className="text-sm font-semibold text-gray-900">{route ? `${route.origin} → ${route.destination}` : 'Schedule'}</p>
                                  <p className="text-xs text-gray-400">{s.status}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-6 text-center">
                      <Search className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No results for &quot;{searchQuery}&quot;</p>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Notification Bell — functional */}
              <button
                onClick={() => setActiveTab('notifications')}
                className="relative p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors tour-bell"
                title={statistics.pendingBookings > 0 ? `${statistics.pendingBookings} pending bookings` : 'No pending bookings'}
              >
                <Bell className="w-5 h-5" />
                {statistics.pendingBookings > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white">
                    {statistics.pendingBookings > 9 ? '9+' : statistics.pendingBookings}
                  </span>
                )}
              </button>

              <button onClick={startTour} className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors" title="Tour Dashboard">
                <HelpCircle className="w-5 h-5" />
              </button>

              {/* Profile — functional */}
              <div className="flex items-center gap-3 border-l border-gray-200 pl-4">
                <button onClick={() => setActiveTab('profile')} className="flex items-center gap-3 hover:bg-gray-50 rounded-lg px-2 py-1.5 transition-colors">
                  <div className="text-right hidden sm:block">
                    <p className="text-[13px] font-bold text-gray-900 leading-tight">
                      {userProfile?.firstName && userProfile?.lastName
                        ? `${userProfile.firstName} ${userProfile.lastName}`
                        : user?.email?.split('@')[0] || 'Admin'}
                    </p>
                    <p className="text-[10px] font-medium text-gray-400 capitalize">{userProfile?.role?.replace('_', ' ') || 'Admin'}</p>
                  </div>
                  <div className="w-9 h-9 rounded-full bg-indigo-900 border-2 border-indigo-200 shadow-sm overflow-hidden flex items-center justify-center text-white text-sm font-bold">
                    {company?.logo
                      ? <img src={company.logo} className="w-full h-full object-cover" alt="" />
                      : (userProfile?.firstName?.[0] || 'A').toUpperCase()}
                  </div>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Global Sub Navigation for Grouped Categories */}
        <SubNav 
          activeTab={activeTab} 
          setActiveTab={(tab) => {
            setActiveTab(tab);
            setCategorySubTabs(prev => ({ ...prev, [activeCategory]: tab }));
          }} 
          subTabs={CATEGORIES.find(c => c.id === activeCategory)?.subTabs || []}
          availableTabs={availableTabs}
          statistics={statistics}
        />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-[1600px] mx-auto">
            {/* Operational Status Banner */}
            {company.status !== 'active' && (
              <div className={`mb-6 p-4 rounded-xl border flex items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-500 ${
                company.status === 'inactive' 
                  ? 'bg-amber-50 border-amber-200 text-amber-800' 
                  : 'bg-blue-50 border-blue-200 text-blue-800'
              }`}>
                <AlertTriangle className={`w-5 h-5 shrink-0 ${company.status === 'inactive' ? 'text-amber-600' : 'text-blue-600'}`} />
                <div>
                  <p className="font-bold text-sm">
                    {company.status === 'inactive' ? 'Company Operations are Paused' : 'Company in Setup Mode'}
                  </p>
                  <p className="text-xs opacity-90">
                    {company.status === 'inactive' 
                      ? 'Your routes and schedules are currently hidden from customers. Contact a superadmin to reactivate your operations.' 
                      : 'Your company is currently in setup mode. You can manage your fleet and routes, but they will not be visible to customers until your account is activated by a superadmin. Contact a superadmin for activation once setup is complete.'}
                  </p>
                </div>
              </div>
            )}

            {alert && (
              <div className="mb-6">
                <AlertMessage type={alert.type} message={alert.message} onClose={clearAlert} />
              </div>
            )}
            
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              {renderActiveTab()}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
