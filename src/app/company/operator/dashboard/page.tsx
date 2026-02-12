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
    onSnapshot, 
    orderBy, 
    limit,
    addDoc,           // Add this
    serverTimestamp,  // Add this
    Timestamp         // Add this 
  } from "firebase/firestore";
  import { db } from "@/lib/firebaseConfig";
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
    AlertTriangle
  } from "lucide-react";
  import AlertMessage from "@/components/AlertMessage";
  import SchedulesTab from "@/components/scheduleTab";
  import BookingsTab from "@/components/bookingTab";
  import PaymentsTab from "@/components/PaymentTab";

  const TABS = [
    { id: "schedules" as const, label: "Schedules", icon: Calendar },
    { id: "bookings" as const, label: "Bookings", icon: Users },
    { id: "payments" as const, label: "Payments", icon: DollarSign }
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

  const Sidebar = ({ activeSection, setActiveSection, isMobileOpen, setIsMobileOpen, company, operatorName, pendingCount }: any) => {
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
                  <p className="text-xs text-gray-500">Operator Panel</p>
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
              {TABS.map((item) => {
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
                  <p className="text-sm font-medium text-gray-900 truncate">{operatorName || 'Operator'}</p>
                  <p className="text-xs text-gray-500 truncate">Operations Team</p>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </>
    );
  };

  export default function OperatorDashboard() {
    const { user, userProfile, loading: authLoading } = useAuth();
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
        const bookingDate = convertFirestoreDate(b.createdAt);
        return bookingDate >= today;
      });

      const totalRevenue = bookings
        .filter(b => b.paymentStatus === "paid")
        .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

      return {
        totalRevenue,
        totalBookings: bookings.length,
        todayBookings: todayBookings.length,
        activeSchedules: schedules.filter((s) => s.isActive).length,
        pendingBookings: bookings.filter(b => b.bookingStatus === "pending").length,
        confirmedBookings: bookings.filter(b => b.bookingStatus === "confirmed").length,
      };
    }, [dashboardData.schedules, dashboardData.bookings]);
    const fetchCollectionData = useCallback(async <T extends { id: string }>(
  collectionName: string, 
  companyId: string
): Promise<T[]> => {
  if (!companyId) {
    console.warn(`Invalid companyId for ${collectionName} query. Skipping fetch.`);
    return [];
  }

  try {
    console.log(`Fetching ${collectionName} for companyId: "${companyId}"`);
    
    let q;
    
    // CRITICAL: Operators must filter schedules by createdBy
    if (collectionName === "schedules" && userProfile?.role === "operator") {
      q = query(
        collection(db, collectionName), 
        where("companyId", "==", companyId),
        where("createdBy", "==", user?.uid) // REQUIRED for operators
      );
    } 
    // For bookings, operators need to fetch their schedules first, then filter
    else if (collectionName === "bookings" && userProfile?.role === "operator") {
      // First, get operator's schedule IDs
      const schedulesQuery = query(
        collection(db, "schedules"),
        where("companyId", "==", companyId),
        where("createdBy", "==", user?.uid)
      );
      const schedulesSnap = await getDocs(schedulesQuery);
      const scheduleIds = schedulesSnap.docs.map(doc => doc.id);
      
      if (scheduleIds.length === 0) {
        console.log("Operator has no schedules, returning empty bookings");
        return [] as T[];
      }
      
      // Firestore 'in' queries support max 30 items, so chunk if needed
      const bookingsResults: T[] = [];
      const chunks = [];
      for (let i = 0; i < scheduleIds.length; i += 30) {
        chunks.push(scheduleIds.slice(i, i + 30));
      }
      
      for (const chunk of chunks) {
        const bookingsQuery = query(
          collection(db, "bookings"),
          where("companyId", "==", companyId),
          where("scheduleId", "in", chunk)
        );
        const bookingsSnap = await getDocs(bookingsQuery);
        bookingsSnap.docs.forEach(doc => {
          const data = doc.data();
          bookingsResults.push({
            id: doc.id,
            ...data,
            createdAt: data.createdAt ? convertFirestoreDate(data.createdAt) : new Date(),
            updatedAt: data.updatedAt ? convertFirestoreDate(data.updatedAt) : new Date(),
            bookingDate: data.bookingDate ? convertFirestoreDate(data.bookingDate) : new Date(),
          } as unknown as T); // FIX: Cast through unknown
        });
      }
      
      console.log(`Found ${bookingsResults.length} bookings for operator's schedules`);
      return bookingsResults;
    }
    // For other collections, standard query
    else {
      q = query(collection(db, collectionName), where("companyId", "==", companyId));
    }

    const snapshot = await getDocs(q);
    console.log(`Found ${snapshot.docs.length} documents in ${collectionName}`);

    return snapshot.docs.map((document) => {
      const data = document.data();

      // Handle Schedules specifically for date conversion
      if (collectionName === "schedules") {
        const scheduleData = {
          id: document.id,
          ...data,
          departureDateTime: convertFirestoreDate(data.departureDateTime),
          arrivalDateTime: convertFirestoreDate(data.arrivalDateTime),
          createdAt: convertFirestoreDate(data.createdAt),
          updatedAt: convertFirestoreDate(data.updatedAt),
        };
        return scheduleData as unknown as T; // FIX: Cast through unknown
      }

      // Handle all other collections
      const genericData = {
        id: document.id,
        ...data,
        createdAt: data.createdAt ? convertFirestoreDate(data.createdAt) : new Date(),
        updatedAt: data.updatedAt ? convertFirestoreDate(data.updatedAt) : new Date(),
      };
      
      return genericData as unknown as T; // FIX: Cast through unknown
    });
  } catch (error: any) {
    console.error(`Error fetching ${collectionName}:`, error);
    throw error;
  }
}, [user, userProfile]);

    const fetchInitialData = useCallback(async () => {
      if (!companyId || authLoading) return;

      try {
        setLoading(true);
        console.log("Starting initial data fetch for companyId:", companyId);

        const companyDoc = await getDoc(doc(db, "companies", companyId));

        if (!companyDoc.exists()) {
          showAlert("error", "Company not found. Please contact your administrator.");
          router.push("/login");
          return;
        }

        const companyData = { 
          id: companyDoc.id, 
          ...companyDoc.data(),
          createdAt: convertFirestoreDate(companyDoc.data()?.createdAt),
          updatedAt: convertFirestoreDate(companyDoc.data()?.updatedAt)
        } as Company;
        
        console.log("Company data loaded:", companyData.name);

        const [schedules, routes, buses, bookings] = await Promise.all([
          fetchCollectionData<Schedule>("schedules", companyId),
          fetchCollectionData<Route>("routes", companyId),
          fetchCollectionData<Bus>("buses", companyId),
          fetchCollectionData<Booking>("bookings", companyId),
        ]);

        console.log("Initial data fetch complete:", {
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
        console.error("Fetch error:", error);
        showAlert("error", error.message || "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }, [companyId, authLoading, showAlert, router, fetchCollectionData]);

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
                      departureDateTime: s.departureDateTime instanceof Date ? s.departureDateTime : new Date(s.departureDateTime),
                      arrivalDateTime: s.arrivalDateTime instanceof Date ? s.arrivalDateTime : new Date(s.arrivalDateTime),
                    }))
                  : schedules;
                setDashboardData(prev => ({ ...prev, schedules: updatedSchedules }));
              }}
              routes={routes}
              buses={buses}
              addSchedule={async (data) => {
  try {
    const schedulesRef = collection(db, "schedules");
    
    const firestoreData = {
      ...data,
      departureDateTime: Timestamp.fromDate(new Date(data.departureDateTime)),
      arrivalDateTime: Timestamp.fromDate(new Date(data.arrivalDateTime)),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      companyId: companyId, 
      createdBy: user?.uid  // CRITICAL: Must be set!
    };

    const docRef = await addDoc(schedulesRef, firestoreData);
    return docRef.id;
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
          const isCompany = (item: Company | null | undefined): item is Company => !!item;
          return (
            <BookingsTab
              bookings={bookings}
              user={user}
              userProfile={userProfile}
              setBookings={(newBookings) => {
                if (typeof newBookings === "function") {
                  setDashboardData(prev => ({ ...prev, bookings: newBookings(prev.bookings) }));
                } else {
                  setDashboardData(prev => ({ ...prev, bookings: newBookings }));
                }
              }}
              schedules={schedules}
              routes={routes}
              companyId={companyId}
              role="operator"
              companies={[company].filter(isCompany)} 
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
              {...commonProps}
            />
          ) : (
            <div className="text-center py-12 bg-white rounded-xl shadow-sm border">
              <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
              <p className="text-gray-600">No payment gateway configured.</p>
              <p className="text-sm text-gray-500 mt-2">Contact your administrator to set up payments.</p>
            </div>
          );

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
            <p className="text-gray-600 mb-6">Please contact your administrator for assistance.</p>
            <button
              onClick={() => router.push("/login")}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Login
            </button>
          </div>
        </div>
      );
    }

    const { company } = dashboardData;
    const operatorName = `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim();

    return (
      <div className="min-h-screen bg-gray-50 flex">
        <Sidebar 
          activeSection={activeTab}
          setActiveSection={setActiveTab}
          isMobileOpen={isMobileOpen}
          setIsMobileOpen={setIsMobileOpen}
          company={company}
          operatorName={operatorName}
          pendingCount={statistics.pendingBookings}
        />

        <div className="flex-1 flex flex-col min-h-screen lg:ml-0">
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
                    <p className="text-sm text-gray-500">Manage {activeTab} for {company.name}</p>
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
                </div>
              </div>
            </div>
          </header>

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