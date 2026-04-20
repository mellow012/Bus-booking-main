"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import * as dbActions from "@/lib/actions/db.actions";
import { useAuth } from "@/contexts/AuthContext";
import { Company, Schedule, Route, Bus, Booking } from "@/types";
import { 
  Building2, 
  Loader2, 
  Calendar, 
  Users, 
  DollarSign,
  User,
  Menu,
  X,
  ChevronRight,
  Bell,
  AlertTriangle,
  LogOut,
  MapPin,
  Truck,
  FileText,
  Activity
} from "lucide-react";
import AlertMessage from "@/components/AlertMessage";
import SchedulesTab from "@/components/scheduleTab";
import BookingsTab from "@/components/bookingTab";
import PaymentsTab from "@/components/PaymentTab";
import NotificationsManagementTab from "@/components/NotificationsManagementTab";
import RoutesTab from "@/components/routesTab";
import BusesTab from "@/components/busesTab";
import ReportsTab from "@/components/ReportsTab";
import OperatorProfileTab from "@/components/OperatorProfileTab";

// ─── Constants ────────────────────────────────────────────────────────────────
const TABS = [
  { id: "schedules" as const, label: "Schedules", icon: Calendar },
  { id: "bookings" as const,  label: "Bookings",  icon: Users },
  { id: "payments" as const,  label: "Payments",  icon: DollarSign },
  { id: "routes" as const,    label: "My Routes", icon: MapPin },
  { id: "buses" as const,     label: "Fleet",    icon: Truck },
  { id: "reports" as const,   label: "Reports",  icon: FileText },
  { id: "notifications" as const, label: "Notifications", icon: Bell },
  { id: "activity" as const,  label: "Activity", icon: Activity },
  { id: "profile" as const,   label: "Profile",  icon: User }
] as const;

type TabType = typeof TABS[number]["id"];
type AlertType = { type: "error" | "success" | "warning" | "info"; message: string } | null;

interface DashboardData {
  company: Company | null;
  schedules: Schedule[];
  routes: Route[];
  buses: Bus[];
  bookings: Booking[];
}

const convertDate = (date: any): Date => {
  if (!date) return new Date();
  if (date instanceof Date) return date;
  return new Date(date);
};

const useAlert = () => {
  const [alert, setAlert] = useState<AlertType>(null);
  
  const showAlert = useCallback((type: "error" | "success" | "warning" | "info", message: string) => {
    setAlert({ type, message });
  }, []);

  const clearAlert = useCallback(() => {
    setAlert(null);
  }, []);

  useEffect(() => {
    if (alert) {
      const timer = setTimeout(clearAlert, alert.type === "error" ? 7000 : 5000);
      return () => clearTimeout(timer);
    }
  }, [alert, clearAlert]);

  return { alert, showAlert, clearAlert };
};

export default function OperatorDashboard() {
  const { user, userProfile, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { alert, showAlert, clearAlert } = useAlert();

  const [activeTab, setActiveTab] = useState<TabType>("schedules");
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    company: null,
    schedules: [],
    routes: [],
    buses: [],
    bookings: [],
  });
  const [loading, setLoading] = useState(true);

  const companyId = userProfile?.companyId?.trim() || "";

  const isValidUser = useMemo(() => {
    return user && userProfile?.role === "operator" && userProfile.companyId;
  }, [user, userProfile]);

  const statistics = useMemo(() => {
    const { schedules, bookings } = dashboardData;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const todayBookings = bookings.filter(b => {
      const bookingDate = convertDate(b.createdAt);
      return bookingDate >= today;
    });

    const totalRevenue = bookings
      .filter(b => b.paymentStatus === "paid")
      .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

    return {
      totalRevenue,
      totalBookings: bookings.length,
      todayBookings: todayBookings.length,
      activeSchedules: (schedules || []).filter((s) => s.status === 'active').length,
      pendingBookings: bookings.filter(b => b.bookingStatus === "pending").length,
    };
  }, [dashboardData.schedules, dashboardData.bookings]);

  const operatorRoutes = useMemo(() => {
    return (dashboardData.routes || []).filter(r => 
      r.assignedOperatorIds?.includes(user?.id || '')
    );
  }, [dashboardData.routes, user?.id]);

  const operatorBuses = useMemo(() => {
    const routeIds = operatorRoutes.map(r => r.id);
    const busIds = new Set(
      dashboardData.schedules
        .filter(s => routeIds.includes(s.routeId))
        .map(s => s.busId)
    );
    return dashboardData.buses.filter(b => busIds.has(b.id));
  }, [dashboardData.schedules, dashboardData.buses, operatorRoutes]);


  const fetchInitialData = useCallback(async () => {
    if (!companyId || authLoading) return;

    try {
      setLoading(true);
      
      // Fetch Company
      const { data: companyData, error: companyError } = await supabase
        .from('Company')
        .select('*')
        .eq('id', companyId)
        .single();

      if (companyError || !companyData) {
        showAlert("error", "Company not found.");
        return;
      }

      // Fetch Schedules (Operators see only their own)
      const { data: schedules, error: schedError } = await supabase
        .from('Schedule')
        .select('*')
        .eq('companyId', companyId)
        .eq('createdBy', user?.id);

      // Fetch Routes
      const { data: routes, error: routeError } = await supabase
        .from('Route')
        .select('*')
        .eq('companyId', companyId);

      // Fetch Buses
      const { data: buses, error: busError } = await supabase
        .from('Bus')
        .select('*')
        .eq('companyId', companyId);

      // Fetch Bookings (linked to operator's schedules)
      const scheduleIds = (schedules || []).map(s => s.id);
      let bookings: Booking[] = [];
      if (scheduleIds.length > 0) {
        const { data: bookingsData } = await supabase
          .from('Booking')
          .select('*')
          .eq('companyId', companyId)
          .in('scheduleId', scheduleIds);
        bookings = (bookingsData || []) as Booking[];
      }

      setDashboardData({
        company: companyData as Company,
        schedules: (schedules || []).map(s => ({
          ...s,
          departureDateTime: new Date(s.departureDateTime),
          arrivalDateTime: new Date(s.arrivalDateTime),
          createdAt: new Date(s.createdAt),
          updatedAt: new Date(s.updatedAt),
        })) as Schedule[],
        routes: (routes || []) as Route[],
        buses: (buses || []) as Bus[],
        bookings: bookings.map(b => ({
          ...b,
          createdAt: new Date(b.createdAt),
        })) as Booking[],
      });
    } catch (error: any) {
      console.error("Fetch error:", error);
      showAlert("error", "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [companyId, authLoading, user?.id, showAlert]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push("/login");
      return;
    }

    if (!userProfile) {
      showAlert("warning", "Loading user profile...");
      return;
    }

    if (userProfile.role !== "operator") {
      showAlert("error", "Access denied. Operator role required.");
      router.push("/");
      return;
    }

    if (!userProfile.companyId) {
      showAlert("error", "No company associated with your account. Please contact support.");
      router.push("/login");
      return;
    }

    const urlCompanyId = searchParams.get("companyId");
    if (urlCompanyId && urlCompanyId !== userProfile.companyId) {
      showAlert("error", "Invalid company ID in URL");
      router.push("/login");
      return;
    }

    fetchInitialData();
  }, [user, userProfile, authLoading, router, searchParams, fetchInitialData, showAlert]);

  const renderActiveTab = () => {
    const { company, schedules, routes, buses, bookings } = dashboardData;

    const commonProps = {
      setError: (msg: string) => showAlert("error", msg),
      setSuccess: (msg: string) => showAlert("success", msg),
    };

    if (loading) {
      return (
        <div className="space-y-4">
          <div className="h-8 bg-gray-200 animate-pulse rounded"></div>
          <div className="h-96 bg-gray-200 animate-pulse rounded"></div>
        </div>
      );
    }

    switch (activeTab) {
      case "schedules":
        return (
          <SchedulesTab
            companyId={companyId}
            schedules={schedules}
            user={user}
            userProfile={userProfile}
            setSchedules={(newSchedules) => {
              const updatedSchedules = Array.isArray(newSchedules)
                ? newSchedules.map((s) => ({
                    ...s,
                    departureDateTime: s.departureDateTime instanceof Date ? s.departureDateTime : new Date(s.departureDateTime ?? 0),
                    arrivalDateTime:   s.arrivalDateTime   instanceof Date ? s.arrivalDateTime   : new Date(s.arrivalDateTime   ?? 0),
                    createdAt:         s.createdAt         instanceof Date ? s.createdAt         : new Date((s.createdAt as any)?.toDate?.() ?? s.createdAt ?? 0),
                    updatedAt:         s.updatedAt         instanceof Date ? s.updatedAt         : new Date((s.updatedAt as any)?.toDate?.() ?? s.updatedAt ?? 0),
                  }))
                : schedules;
              setDashboardData(prev => ({ ...prev, schedules: updatedSchedules }));
            }}
            routes={routes}
            buses={buses}
            addSchedule={async (data) => {
              try {
                const result = await dbActions.createSchedule({
                  ...data,
                  companyId: companyId,
                  createdBy: user?.id
                });
                
                if (!result.success) throw new Error(result.error);
                
                // Refresh data manually or rely on revalidation
                fetchInitialData();
                return result.data!.id;
              } catch (error: any) {
                console.error("Error in addSchedule:", error);
                showAlert("error", `Failed to save schedule: ${error.message}`);
                throw error;
              }
            }}
            {...commonProps}
          />
        );

      case "bookings":
        return (
          <BookingsTab
            schedules={schedules}
            routes={routes}
            buses={buses}
            companyId={companyId}
            user={user}
            userProfile={userProfile}
          />
        );
      case "profile":
        return (
          <OperatorProfileTab
            userProfile={userProfile}
            companyName={company?.name || ''}
            companyBranches={company?.branches || []}
            {...commonProps}
          />
        );

      case "payments":
        const paymentSettings = company?.paymentSettings;
        return company && paymentSettings ? (
          <PaymentsTab
            company={company}
            paymentSettings={paymentSettings}
            bookings={bookings}
            buses={buses}
            {...commonProps}
          />
        ) : (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm border">
            <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <p className="text-gray-600">No payment gateway configured.</p>
            <p className="text-sm text-gray-500 mt-2">Contact your administrator to set up payments.</p>
          </div>
        );

      case "routes":
        return (
          <RoutesTab
            routes={operatorRoutes}
            setRoutes={(updatedRoutes) => {
               // Update global routes with changes from the tab if needed
               // For now we assume view/assigned management
            }}
            companyId={companyId}
            addRoute={async (data) => ""} // Restricted for operators?
            setError={(msg) => showAlert("error", msg)}
            setSuccess={(msg) => showAlert("success", msg)}
          />
        );

      case "buses":
        return (
          <BusesTab
            buses={operatorBuses}
            setBuses={() => {}}
            companyId={companyId}
            setError={(msg) => showAlert("error", msg)}
            setSuccess={(msg) => showAlert("success", msg)}
            subscriptionTier="premium" // Defaulting for dashboard visibility
            schedules={dashboardData.schedules}
            bookings={dashboardData.bookings}
          />
        );

      case "reports":
        return (
          <ReportsTab
            schedules={dashboardData.schedules}
            bookings={dashboardData.bookings}
            buses={dashboardData.buses}
            routes={dashboardData.routes}
            companyId={companyId}
            user={user}
            userProfile={userProfile}
            setError={(msg) => showAlert("error", msg)}
            setSuccess={(msg) => showAlert("success", msg)}
          />
        );

      case "activity":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
               <div>
                  <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                     <Activity className="w-5 h-5 text-indigo-600 animate-pulse" /> Operational Activity
                  </h2>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Real-time route & schedule intelligence</p>
               </div>
            </div>
            
            <div className="space-y-4">
               {dashboardData.schedules.slice(0, 5).map((s, i) => (
                  <div key={i} className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 flex items-center justify-between group hover:bg-white hover:shadow-xl transition-all duration-500">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                           <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                           <p className="text-sm font-black text-gray-900 uppercase">New Schedule Published</p>
                           <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                              ID: {s.id.substring(0, 8)} • Route: {operatorRoutes.find(r => r.id === s.routeId)?.name || 'Internal Corridor'}
                           </p>
                        </div>
                     </div>
                     <div className="text-right">
                        <p className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-widest border border-indigo-100">Live Sync</p>
                     </div>
                  </div>
               ))}
               
               {dashboardData.schedules.length === 0 && (
                  <div className="text-center py-20 bg-gray-50 rounded-[3rem] border border-dashed border-gray-200">
                     <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                     <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">No Operational Telemetry Detected</p>
                  </div>
               )}
            </div>
          </div>
        );

      case "notifications":
        return (
          <NotificationsManagementTab
            userId={user?.id || ""}
            companyId={companyId}
            setError={(msg) => showAlert("error", msg)}
            setSuccess={(msg) => showAlert("success", msg)}
          />
        );

      default:
        return (
          <div className="text-center py-12">
            <p className="text-gray-500">Tab not found</p>
          </div>
        );
    }
  };

  // ── Sidebar Item Component ──────────────────────────────────────────────────
  const SidebarItem = ({ icon: Icon, label, active, onClick, badge }: any) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-300 group
        ${active 
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 translate-x-1' 
          : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 hover:translate-x-1'}`}
    >
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`} />
        <span className="font-semibold tracking-tight">{label}</span>
      </div>
      {badge && (
        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold shadow-sm ${badge.className}`}>
          {badge.text}
        </span>
      )}
    </button>
  );

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
          </div>
          <p className="text-gray-900 font-bold tracking-tight">Syncing Dashboard Data...</p>
          <p className="text-gray-400 text-xs mt-1 font-medium italic">Kinetic Engine v1.0</p>
        </div>
      </div>
    );
  }

  if (!isValidUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center bg-white p-10 rounded-3xl shadow-2xl shadow-gray-200 max-w-md border border-gray-100">
          <div className="w-20 h-20 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">Access Restricted</h2>
          <p className="text-gray-500 mb-8 leading-relaxed font-medium">Your credentials does not have the permissions required to access the Kinetic Operator Console.</p>
          <button
            onClick={() => router.push("/login")}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg hover:shadow-xl active:scale-[0.98]"
          >
            Return to Terminal
          </button>
        </div>
      </div>
    );
  }

  const { company } = dashboardData;

  return (
    <div className="min-h-screen bg-[#fafafa] flex font-sans selection:bg-indigo-100 selection:text-indigo-900 overflow-hidden">
      {/* ── SIDEBAR ── */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-gray-100 h-screen sticky top-0 flex flex-col z-50">
        <div className="p-6 border-b border-gray-100/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <Building2 className="w-6 h-6 text-white" strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-gray-900 tracking-tight leading-none truncate text-sm uppercase">{company?.name || 'BusOps'}</h1>
              <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest leading-none mt-1 inline-block italic">Operator Console</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-hide">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">Operational Context</div>
          {TABS.map(tab => (
            <SidebarItem 
              key={tab.id}
              icon={tab.icon} 
              label={tab.label} 
              active={activeTab === tab.id} 
              onClick={() => setActiveTab(tab.id as TabType)}
              badge={tab.id === 'bookings' && statistics.pendingBookings > 0 ? { text: `${statistics.pendingBookings} NEW`, className: 'bg-amber-100 text-amber-700' } : undefined}
            />
          ))}
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
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center justify-between px-8 sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-gray-900 border-l-4 border-indigo-600 pl-4 capitalize tracking-tight">
              {activeTab} Management
            </h2>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Status</span>
              <div className="flex items-center gap-1.5 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-tight">Active duty</p>
              </div>
            </div>
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 font-extrabold text-xs shadow-sm border border-indigo-100 ring-4 ring-indigo-50/50">
              {userProfile?.firstName?.[0] || 'O'}
            </div>
          </div>
        </header>

        <main className="flex-1 p-8 overflow-y-auto">
          {alert && (
            <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
              <AlertMessage type={alert.type} message={alert.message} onClose={clearAlert} />
            </div>
          )}

          <div className="max-w-7xl mx-auto">
            <div className="bg-white rounded-[2rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden">
              <div className="p-8">
                {renderActiveTab()}
              </div>
            </div>
          </div>
        </main>
      </div>

      <style jsx global>{`
        @keyframes kinetic-slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .kinetic-animate {
          animation: kinetic-slide-up 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
