"use client";
import { useMemo } from "react";
import {
  DollarSign,
  Users,
  Calendar,
  Truck,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  Bell,
  MapPin,
  ArrowRight,
  User,
  UserCircle,
  Navigation,
  ChevronRight,
} from "lucide-react";
import { Company, Schedule, Route, Bus, Booking } from "@/types";

// Type definition for TabType
type TabType = "overview" | "schedules" | "routes" | "buses" | "bookings" | "operators" | "profile" | "settings" | "payments";

interface OverviewTabProps {
  dashboardData: {
    company: Company | null;
    schedules: Schedule[];
    routes: Route[];
    buses: Bus[];
    bookings: Booking[];
  };
  realtimeStatus: {
    isConnected: boolean;
    lastUpdate: Date | null;
    pendingUpdates: number;
  };
  setActiveTab: (tab: TabType) => void;
  handleStatusToggle: () => void;
}

interface SystemNotice {
  type: "error" | "warning" | "info";
  message: string;
  action: () => void;
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

export default function OverviewTab({
  dashboardData,
  realtimeStatus,
  setActiveTab,
  handleStatusToggle,
}: OverviewTabProps) {
  const { company, schedules, routes, buses, bookings } = dashboardData;

  // Calculate statistics
  const statistics = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    
    const todayBookings = bookings.filter(b => {
      const bookingDate = convertFirestoreDate(b.createdAt);
      return bookingDate >= today && bookingDate < tomorrow;
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

    // Today's schedules
    const todaySchedules = schedules.filter(s => {
      const departureDate = convertFirestoreDate(s.departureDateTime);
      return departureDate >= today && departureDate < tomorrow && s.isActive;
    });

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
      todaySchedules: todaySchedules.length,
      fleetSize: buses.length,
      activeBuses: buses.filter(b => b.status === "active").length,
      maintenanceBuses: buses.filter(b => b.status === "maintenance").length,
      inactiveBuses: buses.filter(b => b.status === "inactive").length,
      pendingBookings: bookings.filter(b => b.bookingStatus === "pending").length,
      confirmedBookings: bookings.filter(b => b.bookingStatus === "confirmed").length,
      cancelledBookings: bookings.filter(b => b.bookingStatus === "cancelled").length,
      outstandingPayments: bookings
        .filter(b => b.paymentStatus === "pending" && b.bookingStatus !== "cancelled")
        .reduce((sum, b) => sum + (b.totalAmount || 0), 0),
      activeRoutes: routes.filter(r => r.isActive).length,
    };
  }, [bookings, schedules, buses, routes]);

  // Get recent bookings
  const recentBookings = useMemo(() => {
    return bookings
      .sort((a, b) => convertFirestoreDate(b.createdAt).getTime() - convertFirestoreDate(a.createdAt).getTime())
      .slice(0, 5);
  }, [bookings]);

  // Get today's schedules
  const todaySchedules = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return schedules
      .filter((s) => {
        const departureDate = convertFirestoreDate(s.departureDateTime);
        return s.isActive && departureDate >= today && departureDate < tomorrow;
      })
      .sort((a, b) => convertFirestoreDate(a.departureDateTime).getTime() - convertFirestoreDate(b.departureDateTime).getTime());
  }, [schedules]);

  // Get fleet status with operators
  const fleetStatus = useMemo(() => {
    return buses
      .slice(0, 5)
      .map(bus => ({
        ...bus,
        // Find today's schedule for this bus to get operator info
        currentSchedule: todaySchedules.find(s => s.busId === bus.id)
      }));
  }, [buses, todaySchedules]);

  // Get active routes with operators
  const activeRoutesWithOperators = useMemo(() => {
    return routes
      .filter(r => r.isActive)
      .slice(0, 5)
      .map(route => {
        // Find schedules for this route today
        const routeSchedules = todaySchedules.filter(s => s.routeId === route.id);
        return {
          ...route,
          schedulesCount: routeSchedules.length,
          operators: routeSchedules.map(s => ({
            driver: s.driver,
            conductor: s.conductor,
            busId: s.busId
          }))
        };
      });
  }, [routes, todaySchedules]);

  // System notices
  const systemNotices = useMemo((): SystemNotice[] => {
    const notices: SystemNotice[] = [];
    
    if (!company?.paymentSettings?.gateways?.paychangu && !company?.paymentSettings?.gateways?.stripe) {
      notices.push({
        type: "warning",
        message: "No payment gateway connected. Connect PayChangu or Stripe to receive payments.",
        action: () => setActiveTab("settings")
      });
    }
    
    if (company?.status !== "active") {
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
  }, [company, statistics, handleStatusToggle, setActiveTab]);

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

      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 border shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">MWK {statistics.totalRevenue.toLocaleString("en-MW")}</p>
              <div className="flex items-center mt-3">
                {statistics.revenueChange >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                )}
                <span className={`text-sm font-medium ${statistics.revenueChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
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

        <div className="bg-white rounded-xl p-6 border shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Bookings</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{statistics.totalBookings}</p>
              <div className="flex items-center mt-3">
                <span className="text-sm text-blue-600 font-medium">{statistics.todayBookings} today</span>
                <span className="text-xs text-gray-400 ml-2">• {statistics.pendingBookings} pending</span>
              </div>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Today's Schedules</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{statistics.todaySchedules}</p>
              <div className="flex items-center mt-3">
                <span className="text-sm text-purple-600 font-medium">{statistics.activeSchedules} total active</span>
              </div>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Fleet Status</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{statistics.fleetSize}</p>
              <div className="flex items-center mt-3 space-x-3">
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                  <span className="text-xs text-gray-600">{statistics.activeBuses}</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full mr-1"></div>
                  <span className="text-xs text-gray-600">{statistics.maintenanceBuses}</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-gray-400 rounded-full mr-1"></div>
                  <span className="text-xs text-gray-600">{statistics.inactiveBuses}</span>
                </div>
              </div>
            </div>
            <div className="p-3 bg-orange-100 rounded-full">
              <Truck className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Schedules Card */}
        <div className="bg-white rounded-xl border shadow-sm hover:shadow-md transition-shadow">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Calendar className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Today's Schedules</h3>
                  <p className="text-sm text-gray-500">{todaySchedules.length} departures scheduled</p>
                </div>
              </div>
              <button 
                onClick={() => setActiveTab("schedules")}
                className="flex items-center gap-2 text-purple-600 hover:text-purple-700 text-sm font-medium transition-colors"
              >
                View All
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="p-6">
            {todaySchedules.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No schedules for today</p>
                <button 
                  onClick={() => setActiveTab("schedules")}
                  className="mt-4 text-purple-600 hover:text-purple-700 text-sm font-medium"
                >
                  Create Schedule
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {(() => {
                  const schedule = todaySchedules[0];
                  const route = routes.find(r => r.id === schedule.routeId);
                  const bus = buses.find(b => b.id === schedule.busId);
                  const departureTime = convertFirestoreDate(schedule.departureDateTime);
                  const isPast = departureTime < new Date();
                  
                  return (
                    <div className={`p-4 rounded-lg border transition-all ${isPast ? 'bg-gray-50 opacity-60' : 'bg-blue-50 border-blue-100'}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <MapPin className="w-4 h-4 text-gray-500" />
                            <p className="font-semibold text-gray-900">
                              {route ? `${route.origin} → ${route.destination}` : "Unknown Route"}
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-gray-500 text-xs">Departure</p>
                              <p className="font-medium text-gray-900">{departureTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs">Bus</p>
                              <p className="font-medium text-gray-900">{bus?.licensePlate || "N/A"}</p>
                            </div>
                            {schedule.driver && (
                              <div>
                                <p className="text-gray-500 text-xs">Driver</p>
                                <p className="font-medium text-gray-900">{schedule.driver}</p>
                              </div>
                            )}
                            {schedule.conductor && (
                              <div>
                                <p className="text-gray-500 text-xs">Conductor</p>
                                <p className="font-medium text-gray-900">{schedule.conductor}</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="ml-4">
                          <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                            isPast ? 'bg-gray-200 text-gray-600' : 'bg-green-100 text-green-700'
                          }`}>
                            {isPast ? 'Departed' : 'Scheduled'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                {todaySchedules.length > 1 && (
                  <button 
                    onClick={() => setActiveTab("schedules")}
                    className="w-full py-3 text-purple-600 hover:text-purple-700 text-sm font-medium border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <span>View All {todaySchedules.length} Schedules</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Fleet Status Card */}
        <div className="bg-white rounded-xl border shadow-sm hover:shadow-md transition-shadow">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Truck className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Fleet Status</h3>
                  <p className="text-sm text-gray-500">{statistics.activeBuses} of {statistics.fleetSize} buses active</p>
                </div>
              </div>
              <button 
                onClick={() => setActiveTab("buses")}
                className="flex items-center gap-2 text-orange-600 hover:text-orange-700 text-sm font-medium transition-colors"
              >
                View All
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="p-6">
            {fleetStatus.length === 0 ? (
              <div className="text-center py-8">
                <Truck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No buses registered</p>
                <button 
                  onClick={() => setActiveTab("buses")}
                  className="mt-4 text-orange-600 hover:text-orange-700 text-sm font-medium"
                >
                  Add Bus
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {(() => {
                  const bus = fleetStatus[0];
                  const schedule = bus.currentSchedule;
                  
                  return (
                    <div className="p-4 rounded-lg border hover:border-orange-200 transition-all">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            bus.status === 'active' ? 'bg-green-100' :
                            bus.status === 'maintenance' ? 'bg-yellow-100' :
                            'bg-gray-100'
                          }`}>
                            <Truck className={`w-5 h-5 ${
                              bus.status === 'active' ? 'text-green-600' :
                              bus.status === 'maintenance' ? 'text-yellow-600' :
                              'text-gray-600'
                            }`} />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{bus.licensePlate}</p>
                            <p className="text-xs text-gray-500">{bus.busType} • {bus.capacity} seats</p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          bus.status === 'active' ? 'bg-green-100 text-green-700' :
                          bus.status === 'maintenance' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {bus.status}
                        </span>
                      </div>
                      
                      {schedule ? (
                        <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                          <p className="text-xs font-medium text-gray-600">Current Assignment</p>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {schedule.driver && (
                              <div className="flex items-center gap-2">
                                <UserCircle className="w-4 h-4 text-gray-400" />
                                <div>
                                  <p className="text-xs text-gray-500">Driver</p>
                                  <p className="font-medium text-gray-900">{schedule.driver}</p>
                                </div>
                              </div>
                            )}
                            {schedule.conductor && (
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-gray-400" />
                                <div>
                                  <p className="text-xs text-gray-500">Conductor</p>
                                  <p className="font-medium text-gray-900">{schedule.conductor}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-500 text-center">No active assignment today</p>
                        </div>
                      )}
                    </div>
                  );
                })()}
                {fleetStatus.length > 1 && (
                  <button 
                    onClick={() => setActiveTab("buses")}
                    className="w-full py-3 text-orange-600 hover:text-orange-700 text-sm font-medium border border-orange-200 rounded-lg hover:bg-orange-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <span>View All {buses.length} Buses</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Active Routes Card */}
        <div className="bg-white rounded-xl border shadow-sm hover:shadow-md transition-shadow">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <MapPin className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Active Routes</h3>
                  <p className="text-sm text-gray-500">{statistics.activeRoutes} routes operational</p>
                </div>
              </div>
              <button 
                onClick={() => setActiveTab("routes")}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors"
              >
                View All
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="p-6">
            {activeRoutesWithOperators.length === 0 ? (
              <div className="text-center py-8">
                <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No active routes</p>
                <button 
                  onClick={() => setActiveTab("routes")}
                  className="mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Add Route
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {(() => {
                  const route = activeRoutesWithOperators[0];
                  return (
                    <div className="p-4 rounded-lg border hover:border-blue-200 transition-all">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Navigation className="w-4 h-4 text-blue-600" />
                            <p className="font-semibold text-gray-900">{route.origin} → {route.destination}</p>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>{route.distance} km</span>
                            <span>•</span>
                            <span>{route.duration}</span>
                            <span>•</span>
                            <span>MWK {route.baseFare?.toLocaleString()}</span>
                          </div>
                        </div>
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {route.schedulesCount || 0} today
                        </span>
                      </div>
                      
                      {route.operators && route.operators.length > 0 ? (
                        <div className="bg-blue-50 rounded-lg p-3">
                          <p className="text-xs font-medium text-gray-600 mb-2">Assigned Operators Today</p>
                          <div className="space-y-2">
                            {route.operators.slice(0, 1).map((operator, idx) => {
                              const bus = buses.find(b => b.id === operator.busId);
                              return (
                                <div key={idx} className="flex items-center gap-3 text-sm">
                                  <div className="flex items-center gap-2 flex-1">
                                    <UserCircle className="w-4 h-4 text-gray-400" />
                                    <span className="text-gray-700">{operator.driver || 'N/A'}</span>
                                  </div>
                                  <div className="flex items-center gap-2 flex-1">
                                    <User className="w-4 h-4 text-gray-400" />
                                    <span className="text-gray-700">{operator.conductor || 'N/A'}</span>
                                  </div>
                                  {bus && (
                                    <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded">
                                      {bus.licensePlate}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                            {route.operators.length > 1 && (
                              <p className="text-xs text-gray-500 text-center pt-1">
                                +{route.operators.length - 1} more assignments
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-500 text-center">No operators assigned today</p>
                        </div>
                      )}
                    </div>
                  );
                })()}
                {activeRoutesWithOperators.length > 1 && (
                  <button 
                    onClick={() => setActiveTab("routes")}
                    className="w-full py-3 text-blue-600 hover:text-blue-700 text-sm font-medium border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <span>View All {routes.filter(r => r.isActive).length} Routes</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Recent Bookings Card */}
        <div className="bg-white rounded-xl border shadow-sm hover:shadow-md transition-shadow">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Users className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Recent Bookings</h3>
                  <p className="text-sm text-gray-500">{statistics.todayBookings} bookings today</p>
                </div>
              </div>
              <button 
                onClick={() => setActiveTab("bookings")}
                className="flex items-center gap-2 text-green-600 hover:text-green-700 text-sm font-medium transition-colors"
              >
                View All
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="p-6">
            {recentBookings.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No recent bookings</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(() => {
                  const booking = recentBookings[0];
                  const route = routes.find(r => r.id === schedules.find(s => s.id === booking.scheduleId)?.routeId);
                  const bookingTime = convertFirestoreDate(booking.createdAt);
                  
                  return (
                    <div className="p-4 rounded-lg border hover:border-green-200 transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              {booking.passengerDetails?.[0]?.name || "Unknown"}
                            </p>
                            <p className="text-xs text-gray-500">{formatRelativeTime(bookingTime)}</p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          booking.bookingStatus === "pending" ? "bg-yellow-100 text-yellow-700" :
                          booking.bookingStatus === "confirmed" ? "bg-green-100 text-green-700" :
                          "bg-red-100 text-red-700"
                        }`}>
                          {booking.bookingStatus}
                        </span>
                      </div>
                      <div className="ml-13 space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="w-3 h-3 text-gray-400" />
                          <p className="text-gray-600">
                            {route ? `${route.origin} → ${route.destination}` : "Unknown Route"}
                          </p>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">{booking.seatNumbers} seat(s)</span>
                          <span className="font-semibold text-gray-900">
                            MWK {booking.totalAmount?.toLocaleString() || "0"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                {recentBookings.length > 1 && (
                  <button 
                    onClick={() => setActiveTab("bookings")}
                    className="w-full py-3 text-green-600 hover:text-green-700 text-sm font-medium border border-green-200 rounded-lg hover:bg-green-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <span>View All {bookings.length} Bookings</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-5 rounded-xl border border-yellow-200">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-5 h-5 text-yellow-600" />
            <span className="text-xs font-medium text-yellow-700 bg-yellow-200 px-2 py-1 rounded-full">
              Pending
            </span>
          </div>
          <p className="text-2xl font-bold text-yellow-900">{statistics.pendingBookings}</p>
          <p className="text-sm text-yellow-700 mt-1">Awaiting Confirmation</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 p-5 rounded-xl border border-green-200">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-xs font-medium text-green-700 bg-green-200 px-2 py-1 rounded-full">
              Confirmed
            </span>
          </div>
          <p className="text-2xl font-bold text-green-900">{statistics.confirmedBookings}</p>
          <p className="text-sm text-green-700 mt-1">Active Bookings</p>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 p-5 rounded-xl border border-red-200">
          <div className="flex items-center justify-between mb-2">
            <XCircle className="w-5 h-5 text-red-600" />
            <span className="text-xs font-medium text-red-700 bg-red-200 px-2 py-1 rounded-full">
              Cancelled
            </span>
          </div>
          <p className="text-2xl font-bold text-red-900">{statistics.cancelledBookings}</p>
          <p className="text-sm text-red-700 mt-1">Cancelled Bookings</p>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-5 rounded-xl border border-orange-200">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-5 h-5 text-orange-600" />
            <span className="text-xs font-medium text-orange-700 bg-orange-200 px-2 py-1 rounded-full">
              Outstanding
            </span>
          </div>
          <p className="text-xl font-bold text-orange-900">MWK {statistics.outstandingPayments.toLocaleString()}</p>
          <p className="text-sm text-orange-700 mt-1">Pending Payments</p>
        </div>
      </div>
    </div>
  );
}