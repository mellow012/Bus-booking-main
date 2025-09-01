"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, query, where, getDocs, doc, getDoc, updateDoc, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { useAuth } from "@/contexts/AuthContext";
import { Company, Schedule, Route, Bus, Booking } from "@/types";
import { Building2, Loader2, DollarSign, Users, Calendar, Truck, BarChart3, MapPin, User, Settings, } from "lucide-react";
import AlertMessage from "@/components/AlertMessage";
import TabButton from "@/components/tabButton";
import SchedulesTab from "@/components/scheduleTab";
import RoutesTab from "@/components/routesTab";
import BusesTab from "@/components/busesTab";
import BookingsTab from "@/components/bookingTab";
import StatCard from "@/components/startCard";
import CompanyProfileTab from "@/components/company-Profile";
import SettingsTab from "@/components/SettingsTab";
import PaymentsTab from "@/components/PaymentTab";

// Types
type TabType = "overview" | "schedules" | "routes" | "buses" | "bookings" | "profile" | "settings" | "payments";
type AlertType = { type: "error" | "success"; message: string } | null;

interface DashboardData {
  company: Company | null;
  schedules: Schedule[];
  routes: Route[];
  buses: Bus[];
  bookings: Booking[];
}

// Constants
const TABS: Array<{ id: TabType; label: string; icon: any }> = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "schedules", label: "Schedules", icon: Calendar },
  { id: "routes", label: "Routes", icon: MapPin },
  { id: "buses", label: "Buses", icon: Truck },
  { id: "bookings", label: "Bookings", icon: Users },
  { id: "profile", label: "Profile", icon: User },
  { id: "settings", label: "Settings", icon: Settings },
];

// Payments tab is conditionally added based on paymentSettings
const getAvailableTabs = (paymentSettings: Company["paymentSettings"] | undefined): Array<{ id: TabType; label: string; icon: any }> => {
  const baseTabs = [...TABS];
  if (paymentSettings && Object.keys(paymentSettings).length > 0 && (paymentSettings.gateways?.paychangu || paymentSettings.gateways?.stripe)) {
    baseTabs.push({ id: "payments", label: "Payments", icon: DollarSign });
  }
  return baseTabs;
};

const BUS_TYPES = ["AC", "Non-AC", "Sleeper", "Semi-Sleeper", "Luxury", "Economy", "Minibus"] as const;
const BUS_STATUSES = ["active", "inactive", "maintenance"] as const;
const CAPACITY_LIMITS = { min: 10, max: 100 } as const;

// Helper function to handle Firestore date conversion
const convertFirestoreDate = (date: any): Date => {
  if (!date) return new Date();
  if (date instanceof Date) return date;
  if (date.toDate && typeof date.toDate === "function") {
    return date.toDate();
  }
  if (typeof date === "string" || typeof date === "number") {
    return new Date(date);
  }
  return new Date();
};

// Custom hooks
const useAlert = () => {
  const [alert, setAlert] = useState<AlertType>(null);

  const showAlert = useCallback((type: "error" | "success", message: string) => {
    setAlert({ type, message });
  }, []);

  const clearAlert = useCallback(() => {
    setAlert(null);
  }, []);

  useEffect(() => {
    if (alert) {
      const timer = setTimeout(clearAlert, 5000);
      return () => clearTimeout(timer);
    }
  }, [alert, clearAlert]);

  return { alert, showAlert, clearAlert };
};

// Validation functions
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

export default function AdminDashboard() {
  // Hooks
  const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { alert, showAlert, clearAlert } = useAlert();

  // State
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    company: null,
    schedules: [],
    routes: [],
    buses: [],
    bookings: [],
  });
  const [loading, setLoading] = useState(true);

  // Memoized values
  const statistics = useMemo(() => {
    const { bookings, schedules, buses } = dashboardData;
    return {
      totalRevenue: bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0),
      totalBookings: bookings.length,
      activeSchedules: schedules.filter((s) => s.isActive).length,
      fleetSize: buses.length,
    };
  }, [dashboardData]);

  const isValidUser = useMemo(() => {
    return user && userProfile?.role === "company_admin" && userProfile.companyId;
  }, [user, userProfile]);

  const paymentSettings = dashboardData.company?.paymentSettings;
  const availableTabs = useMemo(() => getAvailableTabs(paymentSettings), [paymentSettings]);

  // Data fetching with improved error handling and date conversion
  const fetchCollectionData = useCallback(async <T>(collectionName: string, companyId: string): Promise<T[]> => {
    if (!companyId) {
      console.warn(`⚠️ Invalid companyId (${companyId}) for ${collectionName} query. Skipping fetch.`);
      return [];
    }

    console.log(`🔍 Fetching ${collectionName} for companyId: "${companyId}"`);

    const q = query(collection(db, collectionName), where("companyId", "==", companyId));
    const snapshot = await getDocs(q);

    console.log(`📊 Found ${snapshot.docs.length} documents in ${collectionName}`);

    if (snapshot.docs.length === 0 && collectionName === "schedules") {
      console.warn("⚠️ No schedules found. Checking all schedules in collection...");
      try {
        const allSchedulesQuery = query(collection(db, "schedules"));
        const allSchedulesSnapshot = await getDocs(allSchedulesQuery);
        console.log("📋 All schedules companyIds found:", allSchedulesSnapshot.docs.map((doc) => ({
          id: doc.id,
          companyId: doc.data().companyId,
          companyIdType: typeof doc.data().companyId,
          companyIdLength: doc.data().companyId?.length,
        })));
        console.log("🔍 Looking for companyId:", { companyId, type: typeof companyId, length: companyId.length });
      } catch (debugError) {
        console.warn("Debug query failed:", debugError);
      }
    }

    return snapshot.docs.map((doc) => {
      const data = doc.data();

      if (collectionName === "schedules") {
        return {
          id: doc.id,
          ...data,
          departureDateTime: convertFirestoreDate(data.departureDateTime),
          arrivalDateTime: convertFirestoreDate(data.arrivalDateTime),
          createdAt: convertFirestoreDate(data.createdAt),
          updatedAt: convertFirestoreDate(data.updatedAt),
        } as T;
      }

      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt ? convertFirestoreDate(data.createdAt) : new Date(),
        updatedAt: data.updatedAt ? convertFirestoreDate(data.updatedAt) : new Date(),
      } as T;
    });
  }, []);

  const fetchData = useCallback(async () => {
    if (!userProfile?.companyId || authLoading) return;

    const companyId = userProfile.companyId.trim();

    if (!companyId) {
      showAlert("error", "Invalid company ID");
      router.push("/login");
      return;
    }

    try {
      setLoading(true);

      console.log("🚀 Starting data fetch for companyId:", companyId);

      const companyDoc = await getDoc(doc(db, "companies", companyId));

      if (!companyDoc.exists()) {
        showAlert("error", "Company not found. Please complete setup or contact support.");
        router.push("/company/setup");
        return;
      }

      const companyData = { id: companyDoc.id, ...companyDoc.data() } as Company;
      console.log("✅ Company data loaded:", companyData.name);

      const [schedules, routes, buses, bookings] = await Promise.all([
        fetchCollectionData<Schedule>("schedules", companyId),
        fetchCollectionData<Route>("routes", companyId),
        fetchCollectionData<Bus>("buses", companyId),
        fetchCollectionData<Booking>("bookings", companyId),
      ]);

      console.log("📊 Data fetch complete:", {
        schedules: schedules.length,
        routes: routes.length,
        buses: buses.length,
        bookings: bookings.length,
      });

      setDashboardData({
        company: companyData,
        schedules,
        routes,
        buses,
        bookings,
      });
    } catch (error: any) {
      console.error("❌ Fetch error:", error);
      showAlert("error", error.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [userProfile?.companyId, authLoading, showAlert, router, fetchCollectionData]);

  // CRUD operations
  const addItem = useCallback(async (collectionName: string, data: any): Promise<string | null> => {
    try {
      const processedData = {
        ...data,
        companyId: userProfile?.companyId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (collectionName === "buses") {
        validateBusData(processedData);
      }

      console.log(`➕ Adding ${collectionName.slice(0, -1)}:`, processedData);
      const docRef = await addDoc(collection(db, collectionName), processedData);
      showAlert("success", `${collectionName.slice(0, -1)} added successfully`);

      await fetchData();

      return docRef.id;
    } catch (error: any) {
      console.error("❌ Add error:", error);
      showAlert("error", error.message || `Failed to add ${collectionName.slice(0, -1)}`);
      return null;
    }
  }, [userProfile?.companyId, showAlert, fetchData]);

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
      console.error("❌ Status toggle error:", error);
      showAlert("error", "Failed to update company status");
    }
  }, [dashboardData.company, showAlert]);

  useEffect(() => {
    console.log("🔍 Dashboard Data State Updated:", {
      schedulesCount: dashboardData.schedules.length,
      routesCount: dashboardData.routes.length,
      busesCount: dashboardData.buses.length,
      companyId: userProfile?.companyId,
      hasCompany: !!dashboardData.company,
      companyName: dashboardData.company?.name,
      firstSchedule: dashboardData.schedules[0],
      firstRoute: dashboardData.routes[0],
      firstBus: dashboardData.buses[0],
    });
  }, [dashboardData, userProfile?.companyId]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push("/login");
      return;
    }

    if (!userProfile) return;

    if (userProfile.role !== "company_admin") {
      router.push("/");
      return;
    }

    if (!userProfile.companyId) {
      router.push("/company/create-company");
      return;
    }

    const urlCompanyId = searchParams.get("companyId");
    if (urlCompanyId && urlCompanyId !== userProfile.companyId) {
      showAlert("error", "Invalid company ID in URL");
      router.push("/login");
      return;
    }

    fetchData();
  }, [user, userProfile, authLoading, router, searchParams, fetchData, showAlert]);

  const renderOverviewTab = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {loading ? (
        Array(4)
          .fill(0)
          .map((_, index) => (
            <div key={index} className="bg-gray-200 animate-pulse rounded-lg p-4 h-32"></div>
          ))
      ) : (
        <>
          <StatCard icon={DollarSign} title="Total Revenue" value={`MWK ${statistics.totalRevenue.toLocaleString("en-MW")}`} color="green" />
          <StatCard icon={Users} title="Total Bookings" value={statistics.totalBookings} color="blue" />
          <StatCard icon={Calendar} title="Active Schedules" value={statistics.activeSchedules} color="purple" />
          <StatCard icon={Truck} title="Fleet Size" value={statistics.fleetSize} color="orange" />
        </>
      )}
    </div>
  );

  const updateDashboardData = useCallback(<T extends keyof DashboardData>(key: T, value: DashboardData[T]) => {
    console.log(`🔄 Updating ${key}:`, Array.isArray(value) ? value.length : value);
    setDashboardData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const renderActiveTab = () => {
    const { company, schedules, routes, buses, bookings } = dashboardData;
    const companyId = userProfile?.companyId || "";

    const commonProps = {
      companyId,
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
            setBuses={(newBuses) => {
              if (typeof newBuses === "function") {
                updateDashboardData("buses", newBuses(buses));
              } else {
                updateDashboardData("buses", newBuses);
              }
            }}
            addBus={(data) => addItem("buses", data)}
            {...commonProps}
          />
        );

      case "bookings":
        return (
          <BookingsTab
            bookings={bookings}
            setBookings={(newBookings) => {
              if (typeof newBookings === "function") {
                updateDashboardData("bookings", newBookings(bookings));
              } else {
                updateDashboardData("bookings", newBookings);
              }
            }}
            schedules={schedules}
            routes={routes}
            companyId={companyId}
            role="company_admin"
            companies={[dashboardData.company].filter(Boolean)}
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
            setCompany={(newCompany) => updateDashboardData("company", newCompany as Company)}
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
        return null;
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto" />
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!dashboardData.company) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white border-b sticky top-0 z-40 shadow-sm backdrop-blur-sm transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="relative">
              {company.logo ? (
                <img
                  src={company.logo}
                  alt={`${company.name} logo`}
                  className="h-12 w-12 rounded-xl object-cover shadow-md"
                />
              ) : (
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-md">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
              )}
              <div
                className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                  company.status === "active" ? "bg-green-500" : "bg-gray-400"
                }`}
              />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{company.name}</h1>
              <p className="text-sm text-gray-500">Admin Dashboard</p>
            </div>
          </div>

          <button
            onClick={handleStatusToggle}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${
              company.status === "active"
                ? "bg-amber-500 hover:bg-amber-600 text-white shadow-lg hover:shadow-amber-500/25"
                : "bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-green-600/25"
            }`}
          >
            {company.status === "active" ? "Pause Company" : "Activate Company"}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {alert && (
          <div className="mb-6">
            <AlertMessage type={alert.type} message={alert.message} onClose={clearAlert} />
          </div>
        )}

        <div className="mb-8">
          <div className="bg-white p-2 rounded-2xl shadow-sm border overflow-x-auto">
            <div className="flex space-x-1 min-w-max">
              {availableTabs.map(({ id, label, icon }) => (
                <TabButton
                  key={id}
                  id={id}
                  label={label}
                  icon={icon}
                  isActive={activeTab === id}
                  onClick={() => setActiveTab(id)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-6 min-h-[500px]">
          {renderActiveTab()}
        </div>
      </main>
    </div>
  );
}