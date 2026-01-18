"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc, 
  addDoc, 
  onSnapshot, 
  orderBy, 
  limit 
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { useAuth } from "@/contexts/AuthContext";
import { Company, Schedule, Route, Bus, Booking } from "@/types";
import { 
  Building2, 
  Loader2, 
  DollarSign, 
  Users, 
  Calendar, 
  Truck, 
  BarChart3, 
  MapPin, 
  User, 
  Settings,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  Bell,
  Menu,
  X,
  ChevronRight,
  LayoutDashboard
} from "lucide-react";
import AlertMessage from "@/components/AlertMessage";
import SchedulesTab from "@/components/scheduleTab";
import RoutesTab from "@/components/routesTab";
import BusesTab from "@/components/busesTab";
import BookingsTab from "@/components/bookingTab";
import CompanyProfileTab from "@/components/company-Profile";
import SettingsTab from "@/components/SettingsTab";
import PaymentsTab from "@/components/PaymentTab";
import OperatorsTab from "@/components/OperatorsTab";

// Constants
const TABS = [
  { id: "overview" as const, label: "Overview", icon: LayoutDashboard },
  { id: "schedules" as const, label: "Schedules", icon: Calendar },
  { id: "routes" as const, label: "Routes", icon: MapPin },
  { id: "buses" as const, label: "Buses", icon: Truck },
  { id: "bookings" as const, label: "Bookings", icon: Users },
  { id: "operators" as const, label: "Operators", icon: Users },
  { id: "profile" as const, label: "Profile", icon: User },
  { id: "settings" as const, label: "Settings", icon: Settings },
  { id: "payments" as const, label: "Payments", icon: DollarSign }
] as const;

const BUS_TYPES = ["AC", "Non-AC", "Sleeper", "Semi-Sleeper", "Luxury", "Economy", "Minibus"] as const;
const BUS_STATUSES = ["active", "inactive", "maintenance"] as const;
const CAPACITY_LIMITS = { min: 10, max: 100 } as const;
const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000;
const MAX_RECONNECT_ATTEMPTS = 3;

type TabType = typeof TABS[number]["id"] | "payments";
type AlertType = { type: "error" | "success" | "warning" | "info"; message: string } | null;

interface DashboardData {
  company: Company | null;
  schedules: Schedule[];
  routes: Route[];
  buses: Bus[];
  bookings: Booking[];
}

interface RealtimeStatus {
  isConnected: boolean;
  lastUpdate: Date | null;
  pendingUpdates: number;
}

interface SystemNotice {
  type: "error" | "warning" | "info";
  message: string;
  action: () => void;
}

interface TabObject {
  id: TabType;
  label: string;
  icon: typeof TABS[number]["icon"]; 
}

// Utility Functions
const convertFirestoreDate = (date: any): Date => {
  if (!date) return new Date();
  if (date instanceof Date) return date;
  if (date.toDate && typeof date.toDate === "function") {
    try {
      return date.toDate();
    } catch (error) {
      console.warn('Date conversion error:', error);
      return new Date();
    }
  }
  if (typeof date === "string" || typeof date === "number") return new Date(date);
  if (date.seconds && typeof date.seconds === "number") return new Date(date.seconds * 1000);
  return new Date();
};

const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
};

const validateBusData = (data: any): void => {
  const requiredFields = ["licensePlate", "busType", "capacity", "status"];
  const missingFields = requiredFields.filter((field) => !data[field]);

  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(", ")}`);
  }

  if (data.capacity < CAPACITY_LIMITS.min || data.capacity > CAPACITY_LIMITS.max) {
    throw new Error(`Capacity must be between ${CAPACITY_LIMITS.min} and ${CAPACITY_LIMITS.max}`);
  }

  if (!BUS_TYPES.includes(data.busType)) {
    throw new Error("Invalid bus type");
  }

  if (!BUS_STATUSES.includes(data.status)) {
    throw new Error("Invalid status");
  }
};

const baseTabs: TabObject[] = [...TABS] as unknown as TabObject[];

const getAvailableTabs = (paymentSettings: Company["paymentSettings"] | undefined): TabObject[] => {
  const baseTabs: TabObject[] = [...TABS];

  if (paymentSettings && Object.keys(paymentSettings).length > 0 && 
      (paymentSettings.gateways?.paychangu || paymentSettings.gateways?.stripe)) {
    const hasPayments = baseTabs.some(tab => tab.id === "payments");
    if (!hasPayments) {
      baseTabs.push({ id: "payments" as const, label: "Payments", icon: DollarSign });
    }
  }

  return baseTabs;
};

// Custom Hooks
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

const useRealtimeBookings = (companyId: string | undefined, showAlert: (type: "error" | "success" | "warning" | "info", message: string) => void, activeTab: TabType) => {
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>({
    isConnected: false,
    lastUpdate: null,
    pendingUpdates: 0
  });

  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    if (!companyId?.trim()) return;

    const q = query(
      collection(db, "bookings"), 
      where("companyId", "==", companyId.trim()), 
      orderBy("updatedAt", "desc"),
      limit(50)
    );

    let reconnectAttempts = 0;

    const createListener = () => {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        try {
          setRealtimeStatus(prev => ({
            ...prev,
            isConnected: true,
            lastUpdate: new Date(),
            pendingUpdates: 0
          }));

          let hasChanges = false;
          const updatedBookings: Booking[] = [];

          snapshot.docChanges().forEach((change) => {
            if (change.type === "added" || change.type === "modified") {
              hasChanges = true;
              const docData = change.doc.data();
              const bookingData = {
                id: change.doc.id,
                ...docData,
                createdAt: convertFirestoreDate(docData.createdAt),
                updatedAt: convertFirestoreDate(docData.updatedAt),
                cancellationDate: docData.cancellationDate ? convertFirestoreDate(docData.cancellationDate) : undefined,
                bookingDate: docData.bookingDate ? convertFirestoreDate(docData.bookingDate) : undefined,
                confirmedDate: docData.confirmedDate ? convertFirestoreDate(docData.confirmedDate) : undefined,
                refundDate: docData.refundDate ? convertFirestoreDate(docData.refundDate) : undefined,
              } as Booking;

              updatedBookings.push(bookingData);

              if (change.type === "added" && activeTab === "bookings") {
                showAlert("info", `New booking received from ${bookingData.passengerDetails?.[0]?.name || 'customer'}`);
              }
            }
          });

          if (hasChanges) {
            setBookings(prevBookings => {
              const updatedBookingsList = [
                ...prevBookings.filter(b => !updatedBookings.some(ub => ub.id === b.id)),
                ...updatedBookings
              ];

              return updatedBookingsList;
            });

            setRealtimeStatus(prev => ({
              ...prev,
              pendingUpdates: prev.pendingUpdates + updatedBookings.length
            }));

            setTimeout(() => {
              setRealtimeStatus(prev => ({ ...prev, pendingUpdates: 0 }));
            }, 3000);
          }

          reconnectAttempts = 0;
        } catch (error) {
          console.error("Error processing booking updates:", error);
          showAlert("error", "Failed to update bookings data");
        }
      }, (error) => {
        console.error("Firebase snapshot error:", error);
        setRealtimeStatus(prev => ({
          ...prev,
          isConnected: false,
          lastUpdate: prev.lastUpdate
        }));
        
        showAlert("warning", "Connection to real-time updates lost");

        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          console.log(`Attempting to reconnect... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
          setTimeout(() => {
            createListener();
          }, Math.pow(2, reconnectAttempts) * 1000);
        } else {
          showAlert("error", "Unable to establish real-time connection. Please refresh the page.");
        }
      });

      return unsubscribe;
    };

    const unsubscribe = createListener();
    return () => unsubscribe?.();
  }, [companyId, showAlert, activeTab]);

  return { bookings, setBookings, realtimeStatus };
};

// Sidebar Component
const Sidebar = ({ activeSection, setActiveSection, isMobileOpen, setIsMobileOpen, company, availableTabs, pendingCount }: any) => {
  return (
    <>
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside className={`
        fixed top-0 left-0 z-50 h-screen w-64 bg-white border-r border-gray-200
        transform transition-transform duration-300 ease-in-out
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static
      `}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              {company?.logo ? (
                <img src={company.logo} alt="Logo" className="w-10 h-10 rounded-xl object-cover" />
              ) : (
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
              )}
              <div>
                <h1 className="font-bold text-gray-900 text-sm">{company?.name || 'BusOps'}</h1>
                <p className="text-xs text-gray-500">Admin Panel</p>
              </div>
            </div>
            <button 
              onClick={() => setIsMobileOpen(false)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {availableTabs.map((item: TabObject) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveSection(item.id);
                    setIsMobileOpen(false);
                  }}
                  className={`
                    w-full flex items-center space-x-3 px-4 py-3 rounded-xl
                    transition-all duration-200 group relative
                    ${isActive 
                      ? 'bg-blue-50 text-blue-700' 
                      : 'text-gray-700 hover:bg-gray-50'
                    }
                  `}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-blue-700' : 'text-gray-400 group-hover:text-gray-600'}`} />
                  <span className="font-medium flex-1 text-left">{item.label}</span>
                  {item.id === 'bookings' && pendingCount > 0 && (
                    <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {pendingCount}
                    </span>
                  )}
                  {isActive && <ChevronRight className="w-4 h-4" />}
                </button>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center space-x-3 px-4 py-3 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">Admin</p>
                <p className="text-xs text-gray-500 truncate">{company?.email || 'admin@busops.com'}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

// Main Dashboard Component
export default function AdminDashboard() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { alert, showAlert, clearAlert } = useAlert();

  const [activeTab, setActiveTab] = useState<TabType>("overview");
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
  const { bookings, setBookings, realtimeStatus } = useRealtimeBookings(companyId, showAlert, activeTab);

  useEffect(() => {
    setDashboardData(prev => ({ ...prev, bookings }));
  }, [bookings]);

  const statistics = useMemo(() => {
    const { schedules, buses } = dashboardData;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    
    const todayBookings = bookings.filter(b => {
      const bookingDate = convertFirestoreDate(b.createdAt);
      return bookingDate >= today;
    });

    const thisMonthBookings = bookings.filter(b => {
      const bookingDate = convertFirestoreDate(b.createdAt);
      return bookingDate >= thisMonth;
    });

    const lastMonthBookings = bookings.filter(b => {
      const bookingDate = convertFirestoreDate(b.createdAt);
      return bookingDate >= lastMonth && bookingDate < thisMonth;
    });

    const totalRevenue = bookings
      .filter(b => b.paymentStatus === "paid")
      .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

    const thisMonthRevenue = thisMonthBookings
      .filter(b => b.paymentStatus === "paid")
      .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

    const lastMonthRevenue = lastMonthBookings
      .filter(b => b.paymentStatus === "paid")
      .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

    const revenueChange = lastMonthRevenue > 0 
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
      : thisMonthRevenue > 0 ? 100 : 0;

    return {
      totalRevenue,
      thisMonthRevenue,
      revenueChange,
      totalBookings: bookings.length,
      todayBookings: todayBookings.length,
      thisMonthBookings: thisMonthBookings.length,
      bookingsChange: lastMonthBookings.length > 0 
        ? ((thisMonthBookings.length - lastMonthBookings.length) / lastMonthBookings.length) * 100 
        : thisMonthBookings.length > 0 ? 100 : 0,
      activeSchedules: schedules.filter((s) => s.isActive).length,
      fleetSize: buses.length,
      activeBuses: buses.filter(b => b.status === "active").length,
      pendingBookings: bookings.filter(b => b.bookingStatus === "pending").length,
      confirmedBookings: bookings.filter(b => b.bookingStatus === "confirmed").length,
      cancelledBookings: bookings.filter(b => b.bookingStatus === "cancelled").length,
      outstandingPayments: bookings
        .filter(b => b.paymentStatus === "pending" && b.bookingStatus !== "cancelled")
        .reduce((sum, b) => sum + (b.totalAmount || 0), 0),
    };
  }, [bookings, dashboardData.schedules, dashboardData.buses]);

  const recentBookings = useMemo(() => {
    return bookings
      .sort((a, b) => convertFirestoreDate(b.createdAt).getTime() - convertFirestoreDate(a.createdAt).getTime())
      .slice(0, 5);
  }, [bookings]);

  const upcomingSchedules = useMemo(() => {
    const now = new Date();
    return dashboardData.schedules
      .filter((s) => s.isActive && convertFirestoreDate(s.departureDateTime) > now)
      .sort((a, b) => convertFirestoreDate(a.departureDateTime).getTime() - convertFirestoreDate(b.departureDateTime).getTime())
      .slice(0, 5);
  }, [dashboardData.schedules]);

  const paymentSettings = dashboardData.company?.paymentSettings;
  const availableTabs = useMemo(() => getAvailableTabs(paymentSettings), [paymentSettings]);

  const isValidUser = useMemo(() => {
    return user && userProfile?.role === "company_admin" && userProfile.companyId;
  }, [user, userProfile]);

  const handleStatusToggle = useCallback(async () => {
    if (!dashboardData.company) return;

    const newStatus = dashboardData.company.status === "active" ? "inactive" : "active";

    try {
      await updateDoc(doc(db, "companies", dashboardData.company.id), {
        status: newStatus,
        updatedAt: new Date(),
      });

      setDashboardData((prev) => ({
        ...prev,
        company: prev.company ? { ...prev.company, status: newStatus } : null,
      }));

      showAlert("success", `Company status updated to ${newStatus}`);
    } catch (error) {
      console.error("Status toggle error:", error);
      showAlert("error", "Failed to update company status");
    }
  }, [dashboardData.company, showAlert]);

  const fetchCollectionData = useCallback(async <T extends { id: string, createdAt?: any, updatedAt?: any }>(
    collectionName: string, 
    companyId: string
  ): Promise<T[]> => {
    if (!companyId) {
      console.warn(`Invalid companyId for ${collectionName} query. Skipping fetch.`);
      return [];
    }

    try {
      console.log(`Fetching ${collectionName} for companyId: "${companyId}"`);
      const q = query(collection(db, collectionName), where("companyId", "==", companyId));
      const snapshot = await getDocs(q);
      
      console.log(`Found ${snapshot.docs.length} documents in ${collectionName}`);

      return snapshot.docs.map((document) => {
        const data = document.data();

        if (collectionName === "schedules") {
          return {
            id: document.id,
            ...data,
            departureDateTime: convertFirestoreDate(data.departureDateTime),
            arrivalDateTime: convertFirestoreDate(data.arrivalDateTime),
            createdAt: convertFirestoreDate(data.createdAt),
            updatedAt: convertFirestoreDate(data.updatedAt),
          } as unknown as T;
        }
        return {
          id: document.id,
          ...data,
          createdAt: data.createdAt ? convertFirestoreDate(data.createdAt) : new Date(),
          updatedAt: data.updatedAt ? convertFirestoreDate(data.updatedAt) : new Date(),
        } as T;
      });
    } catch (error) {
      console.error(`Error fetching ${collectionName}:`, error);
      throw error;
    }
  }, []);

  const fetchInitialData = useCallback(async () => {
    if (!companyId || authLoading) return;

    try {
      setLoading(true);
      console.log("Starting initial data fetch for companyId:", companyId);

      const companyDoc = await getDoc(doc(db, "companies", companyId));

      if (!companyDoc.exists()) {
        showAlert("error", "Company not found. Please complete setup or contact support.");
        router.push("/company/setup");
        return;
      }

      const companyData = { 
        id: companyDoc.id, 
        ...companyDoc.data(),
        createdAt: convertFirestoreDate(companyDoc.data()?.createdAt),
        updatedAt: convertFirestoreDate(companyDoc.data()?.updatedAt)
      } as Company;
      
      console.log("Company data loaded:", companyData.name);

      const [schedules, routes, buses] = await Promise.all([
        fetchCollectionData<Schedule>("schedules", companyId),
        fetchCollectionData<Route>("routes", companyId),
        fetchCollectionData<Bus>("buses", companyId),
      ]);

      console.log("Initial data fetch complete:", {
        schedules: schedules.length,
        routes: routes.length,
        buses: buses.length,
      });

      setDashboardData((prev) => ({
        ...prev,
        company: companyData,
        schedules,
        routes,
        buses,
      }));
    } catch (error: any) {
      console.error("Fetch error:", error);
      showAlert("error", error.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [companyId, authLoading, showAlert, router, fetchCollectionData]);

  const addItem = useCallback(async (collectionName: string, data: any): Promise<string | null> => {
    try {
      const processedData = {
        ...data,
        companyId: companyId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (collectionName === "buses") {
        validateBusData(processedData);
      }

      console.log(`Adding ${collectionName.slice(0, -1)}:`, processedData);
      const docRef = await addDoc(collection(db, collectionName), processedData);
      showAlert("success", `${collectionName.slice(0, -1)} added successfully`);

      if (collectionName !== "bookings") {
        await fetchInitialData();
      }

      return docRef.id;
    } catch (error: any) {
      console.error("Add error:", error);
      showAlert("error", error.message || `Failed to add ${collectionName.slice(0, -1)}`);
      return null;
    }
  }, [companyId, showAlert, fetchInitialData]);

  const updateDashboardData = useCallback(
    <T extends keyof DashboardData>(key: T, value: DashboardData[T]) => {
      console.log(`Updating ${key}:`, Array.isArray(value) ? value.length : value);
      setDashboardData((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const systemNotices = useMemo((): SystemNotice[] => {
    const notices: SystemNotice[] = [];
    if (!dashboardData.company?.paymentSettings?.gateways?.paychangu && !dashboardData.company?.paymentSettings?.gateways?.stripe) {
      notices.push({
        type: "warning",
        message: "No payment gateway connected. Connect PayChangu or Stripe to receive payments.",
        action: () => setActiveTab("settings")
      });
    }
    if (dashboardData.company?.status !== "active") {
      notices.push({
        type: "error",
        message: "Your company is currently paused. Activate to receive bookings.",
        action: handleStatusToggle
      });
    }
    if (statistics.pendingBookings > 5) {
      notices.push({
        type: "info",
        message: `You have ${statistics.pendingBookings} pending bookings that need attention.`,
        action: () => setActiveTab("bookings")
      });
    }
    if (statistics.outstandingPayments > 0) {
      notices.push({
        type: "warning",
        message: `MWK ${statistics.outstandingPayments.toLocaleString()} in outstanding payments.`,
        action: () => setActiveTab("bookings")
      });
    }
    return notices;
  }, [dashboardData.company, statistics, handleStatusToggle]);

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

    if (userProfile.role !== "company_admin") {
      showAlert("error", "Access denied. Company admin role required.");
      router.push("/");
      return;
    }

    if (!userProfile.companyId) {
      showAlert("info", "Please complete company setup to continue.");
      router.push("/company/create-company");
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

  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading && companyId) {
        console.log("Auto-refreshing dashboard data...");
        fetchInitialData();
      }
    }, AUTO_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [loading, companyId, fetchInitialData]);

  const renderOverviewTab = () => {
    const { company } = dashboardData;
    
    return (
      <div className="space-y-6">
        {/* Real-time Status */}
        <div className="flex items-center justify-between bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${realtimeStatus.isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm font-medium">
              {realtimeStatus.isConnected ? 'Live Updates Active' : 'Connection Lost'}
            </span>
            {realtimeStatus.lastUpdate && (
              <span className="text-xs text-gray-500">
                Last update: {formatRelativeTime(realtimeStatus.lastUpdate)}
              </span>
            )}
          </div>
          {realtimeStatus.pendingUpdates > 0 && (
            <div className="flex items-center space-x-2 text-blue-600">
              <Activity className="w-4 h-4" />
              <span className="text-sm font-medium">{realtimeStatus.pendingUpdates} new updates</span>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl p-6 border shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-3xl font-bold text-gray-900">MWK {statistics.totalRevenue.toLocaleString("en-MW")}</p>
                <div className="flex items-center mt-2">
                  {statistics.revenueChange > 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                  )}
                  <span className={`text-sm font-medium ${statistics.revenueChange > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {Math.abs(statistics.revenueChange).toFixed(1)}%
                  </span>
                  <span className="text-sm text-gray-500 ml-1">vs last month</span>
                </div>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Bookings</p>
                <p className="text-3xl font-bold text-gray-900">{statistics.totalBookings}</p>
                <div className="flex items-center mt-2">
                  <span className="text-sm text-blue-600 font-medium">{statistics.todayBookings} today</span>
                </div>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Schedules</p>
                <p className="text-3xl font-bold text-gray-900">{statistics.activeSchedules}</p>
                <div className="flex items-center mt-2">
                  <span className="text-sm text-purple-600 font-medium">{upcomingSchedules.length} upcoming</span>
                </div>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <Calendar className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Fleet Status</p>
                <p className="text-3xl font-bold text-gray-900">{statistics.fleetSize}</p>
                <div className="flex items-center mt-2">
                  <span className="text-sm text-orange-600 font-medium">{statistics.activeBuses} active</span>
                </div>
              </div>
              <div className="p-3 bg-orange-100 rounded-full">
                <Truck className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* System Notices */}
        {systemNotices.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Bell className="w-5 h-5" />
              System Notifications
            </h3>
            {systemNotices.map((notice, idx) => (
              <div 
                key={idx} 
                className={`p-4 rounded-lg border-l-4 cursor-pointer hover:bg-opacity-80 transition-colors ${
                  notice.type === "error" ? "bg-red-50 border-red-400" :
                  notice.type === "warning" ? "bg-yellow-50 border-yellow-400" :
                  "bg-blue-50 border-blue-400"
                }`}
                onClick={notice.action}
              >
                <div className="flex items-center">
                  {notice.type === "error" ? <XCircle className="w-5 h-5 text-red-600 mr-3" /> :
                   notice.type === "warning" ? <AlertTriangle className="w-5 h-5 text-yellow-600 mr-3" /> :
                   <CheckCircle className="w-5 h-5 text-blue-600 mr-3" />}
                  <p className={`font-medium ${
                    notice.type === "error" ? "text-red-800" :
                    notice.type === "warning" ? "text-yellow-800" :
                    "text-blue-800"
                  }`}>
                    {notice.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border text-center">
            <div className="flex items-center justify-center mb-2">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{statistics.pendingBookings}</p>
            <p className="text-sm text-gray-600">Pending Bookings</p>
          </div>
          <div className="bg-white p-4 rounded-lg border text-center">
            <div className="flex items-center justify-center mb-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{statistics.confirmedBookings}</p>
            <p className="text-sm text-gray-600">Confirmed</p>
          </div>
          <div className="bg-white p-4 rounded-lg border text-center">
            <div className="flex items-center justify-center mb-2">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{statistics.cancelledBookings}</p>
            <p className="text-sm text-gray-600">Cancelled</p>
          </div>
          <div className="bg-white p-4 rounded-lg border text-center">
            <div className="flex items-center justify-center mb-2">
              <DollarSign className="w-5 h-5 text-orange-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">MWK {statistics.outstandingPayments.toLocaleString()}</p>
            <p className="text-sm text-gray-600">Outstanding</p>
          </div>
        </div>

        {/* Activity Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl p-6 border shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Recent Bookings
              </h3>
              <button 
                onClick={() => setActiveTab("bookings")}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                View All
              </button>
            </div>
            <div className="space-y-3">
              {recentBookings.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No recent bookings</p>
              ) : (
                recentBookings.map(booking => {
                  const route = dashboardData.routes.find(r => r.id === dashboardData.schedules.find(s => s.id === booking.scheduleId)?.routeId);
                  return (
                    <div key={booking.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {booking.passengerDetails?.[0]?.name || "Unknown"}
                        </p>
                        <p className="text-sm text-gray-600">
                          {route ? `${route.origin} → ${route.destination}` : "Unknown Route"}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          booking.bookingStatus === "pending" ? "bg-yellow-100 text-yellow-800" :
                          booking.bookingStatus === "confirmed" ? "bg-green-100 text-green-800" :
                          "bg-red-100 text-red-800"
                        }`}>
                          {booking.bookingStatus}
                        </span>
                        <p className="text-sm font-medium text-gray-900 mt-1">
                          MWK {booking.totalAmount?.toLocaleString() || "0"}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-600" />
                Upcoming Departures
              </h3>
              <button 
                onClick={() => setActiveTab("schedules")}
                className="text-purple-600 hover:text-purple-700 text-sm font-medium"
              >
                View All
              </button>
            </div>
            <div className="space-y-3">
              {upcomingSchedules.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No upcoming departures</p>
              ) : (
                upcomingSchedules.map(schedule => {
                  const route = dashboardData.routes.find(r => r.id === schedule.routeId);
                  const bus = dashboardData.buses.find(b => b.id === schedule.busId);
                  const departureTime = convertFirestoreDate(schedule.departureDateTime);
                  return (
                    <div key={schedule.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {route ? `${route.origin} → ${route.destination}` : "Unknown Route"}
                        </p>
                        <p className="text-sm text-gray-600">
                          {bus?.licensePlate || "Unknown Bus"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {departureTime.toLocaleDateString()} at {departureTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          Active
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderActiveTab = () => {
    const { company, schedules, routes, buses } = dashboardData;

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
      case "overview":
        return renderOverviewTab();

      case "schedules":
        return (
          <SchedulesTab
            companyId={companyId}
            schedules={schedules}
            setSchedules={(newSchedules) => {
              const updatedSchedules = Array.isArray(newSchedules)
                ? newSchedules.map((s) => ({
                    ...s,
                    departureDateTime: s.departureDateTime instanceof Date ? s.departureDateTime : new Date(s.departureDateTime),
                    arrivalDateTime: s.arrivalDateTime instanceof Date ? s.arrivalDateTime : new Date(s.arrivalDateTime),
                  }))
                : schedules;
              updateDashboardData("schedules", updatedSchedules);
            }}
            routes={routes}
            buses={buses}
            addSchedule={async (data) => {
              const processedData = {
                ...data,
                departureDateTime: new Date(data.departureDateTime),
                arrivalDateTime: new Date(data.arrivalDateTime),
                createdAt: new Date(),
                updatedAt: new Date(),
              };
              return addItem("schedules", processedData);
            }}
            {...commonProps}
          />
        );

      case "routes":
        return (
          <RoutesTab
            companyId={companyId}
            routes={routes}
            setRoutes={(newRoutes) => {
              if (typeof newRoutes === "function") {
                updateDashboardData("routes", newRoutes(routes));
              } else {
                updateDashboardData("routes", newRoutes);
              }
            }}
            addRoute={(data) => addItem("routes", data)}
            {...commonProps}
          />
        );

      case "buses":
        return (
          <BusesTab
            buses={buses}
            companyId={companyId}
            setBuses={(newBuses) => {
              if (typeof newBuses === "function") {
                updateDashboardData("buses", newBuses(buses));
              } else {
                updateDashboardData("buses", newBuses);
              }
            }}
            {...commonProps}
          />
        );

      case "bookings":
        const isCompany = (item: Company | null | undefined): item is Company => !!item;
        return (
          <BookingsTab
            bookings={bookings}
            setBookings={setBookings}
            schedules={schedules}
            routes={routes}
            companyId={companyId}
            role="company_admin"
            companies={[dashboardData.company].filter(isCompany)} 
            {...commonProps}
          />
        );

      case "profile":
        return company ? (
          <CompanyProfileTab
            company={company}
            setCompany={(newCompany) => updateDashboardData("company", newCompany as Company)}
            {...commonProps}
          />
        ) : null;

      case "settings":
        return company ? (
          <SettingsTab
            company={company}
            setCompany={(company) => updateDashboardData("company", company as Company)}
            {...commonProps}
          />
        ) : null;

      case "operators":
        return company ? (
          <OperatorsTab
            companyId={companyId}
            {...commonProps}
          />
        ) : null;

      case "payments":
        return company && paymentSettings ? (
          <PaymentsTab
            company={company}
            paymentSettings={paymentSettings}
            bookings={bookings}
            {...commonProps}
          />
        ) : null;

      default:
        return (
          <div className="text-center py-12">
            <p className="text-gray-500">Tab not found</p>
          </div>
        );
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto" />
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isValidUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-2xl shadow-lg max-w-md">
          <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">You don't have permission to access this dashboard.</p>
          <button
            onClick={() => router.push("/login")}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (!dashboardData.company) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-2xl shadow-lg max-w-md">
          <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Company Not Found</h2>
          <p className="text-gray-600 mb-6">Please ensure your company is set up correctly or contact support.</p>
          <button
            onClick={() => router.push("/support")}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Contact Support
          </button>
        </div>
      </div>
    );
  }

  const { company } = dashboardData;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <Sidebar 
        activeSection={activeTab}
        setActiveSection={setActiveTab}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        company={company}
        availableTabs={availableTabs}
        pendingCount={statistics.pendingBookings}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-0">
        {/* Top Bar */}
        <header className="bg-white border-b sticky top-0 z-30 shadow-sm">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button 
                  onClick={() => setIsMobileOpen(true)}
                  className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
                >
                  <Menu className="w-6 h-6" />
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {TABS.find(t => t.id === activeTab)?.label || 'Dashboard'}
                  </h1>
                  <p className="text-sm text-gray-500">Welcome back, manage your operations</p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                {statistics.pendingBookings > 0 && (
                  <div 
                    className="flex items-center space-x-2 px-3 py-2 bg-yellow-100 text-yellow-800 rounded-lg cursor-pointer hover:bg-yellow-200 transition-colors"
                    onClick={() => setActiveTab("bookings")}
                  >
                    <Bell className="w-4 h-4" />
                    <span className="text-sm font-medium">{statistics.pendingBookings} pending</span>
                  </div>
                )}
                
                <button
                  onClick={handleStatusToggle}
                  className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${
                    company?.status === "active"
                      ? "bg-amber-500 hover:bg-amber-600 text-white shadow-lg hover:shadow-amber-500/25"
                      : "bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-green-600/25"
                  }`}
                >
                  {company?.status === "active" ? "Pause Company" : "Activate Company"}
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
          {alert && (
            <div className="mb-6">
              <AlertMessage type={alert?.type} message={alert?.message} onClose={clearAlert} />
            </div>
          )}

          <div className="max-w-7xl mx-auto">
            {renderActiveTab()}
          </div>
        </main>
      </div>
    </div>
  );
}