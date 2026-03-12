"use client";
import { useMemo } from "react";
import {
  DollarSign, Users, Calendar, Truck, TrendingUp, TrendingDown,
  Clock, AlertTriangle, CheckCircle, XCircle, Activity, MapPin,
  ArrowRight, User, Navigation, ChevronRight, Zap, RefreshCw,
  CreditCard, BusIcon, UserCheck, AlertCircle, ArrowUpRight,
} from "lucide-react";
import { Company, Schedule, Route, Bus, Booking } from "@/types";

type TabType = "overview" | "schedules" | "routes" | "buses" | "bookings" | "operators" | "profile" | "settings" | "payments";

interface OverviewTabProps {
  dashboardData: {
    company: Company | null;
    schedules: Schedule[];
    routes: Route[];
    buses: Bus[];
    bookings: Booking[];
    // Add these for name resolution — pass from parent
    operatorNames?: Record<string, string>;   // { [uid]: "Trevor Taulo" }
    conductorNames?: Record<string, string>;  // { [uid]: "Patrick" }
  };
  realtimeStatus: {
    isConnected: boolean;
    lastUpdate: Date | null;
    pendingUpdates: number;
  };
  setActiveTab: (tab: TabType) => void;
  handleStatusToggle: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toDate = (date: any): Date => {
  if (!date) return new Date();
  if (date instanceof Date) return date;
  if (date?.toDate) { try { return date.toDate(); } catch { return new Date(); } }
  if (typeof date === "string" || typeof date === "number") return new Date(date);
  if (date?.seconds) return new Date(date.seconds * 1000);
  return new Date();
};

const relativeTime = (date: Date): string => {
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
};

const fmt = (n: number) => n.toLocaleString("en-MW");
const fmtTime = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// ─── Sub-components ────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, icon: Icon, color, onClick,
}: {
  label: string; value: string; sub: React.ReactNode;
  icon: any; color: string; onClick?: () => void;
}) {
  const colors: Record<string, string> = {
    green:  "bg-green-50  border-green-100  text-green-600",
    blue:   "bg-blue-50   border-blue-100   text-blue-600",
    purple: "bg-purple-50 border-purple-100 text-purple-600",
    orange: "bg-orange-50 border-orange-100 text-orange-600",
  };
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl p-5 border shadow-sm hover:shadow-md transition-all ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-900 leading-tight truncate">{value}</p>
          <div className="mt-2 text-xs text-gray-500">{sub}</div>
        </div>
        <div className={`p-2.5 rounded-xl border ${colors[color]} flex-shrink-0 ml-3`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, subtitle, icon: Icon, iconBg, linkColor, onViewAll, children }: {
  title: string; subtitle: string; icon: any; iconBg: string; linkColor: string;
  onViewAll: () => void; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50/50">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${iconBg}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{title}</p>
            <p className="text-xs text-gray-400">{subtitle}</p>
          </div>
        </div>
        <button onClick={onViewAll} className={`flex items-center gap-1 text-xs font-semibold ${linkColor} hover:opacity-70 transition-opacity`}>
          View All <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function EmptyState({ icon: Icon, message, action, actionLabel }: {
  icon: any; message: string; action?: () => void; actionLabel?: string;
}) {
  return (
    <div className="text-center py-8">
      <Icon className="w-10 h-10 text-gray-200 mx-auto mb-2" />
      <p className="text-sm text-gray-400">{message}</p>
      {action && (
        <button onClick={action} className="mt-3 text-xs font-semibold text-blue-600 hover:underline">
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function OverviewTab({ dashboardData, realtimeStatus, setActiveTab, handleStatusToggle }: OverviewTabProps) {
  const { company, schedules, routes, buses, bookings, operatorNames = {}, conductorNames = {} } = dashboardData;

  const resolveName = (id: string, map: Record<string, string>, fallback = "Unassigned") =>
    map[id] || fallback;

  // ── Statistics ───────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const inRange = (date: any, from: Date, to: Date) => { const d = toDate(date); return d >= from && d < to; };

    const paid       = bookings.filter(b => b.paymentStatus === "paid");
    const thisMonthP = paid.filter(b => inRange(b.createdAt, thisMonth, now));
    const lastMonthP = paid.filter(b => inRange(b.createdAt, lastMonth, thisMonth));
    const totalRev   = paid.reduce((s, b) => s + (b.totalAmount || 0), 0);
    const thisRev    = thisMonthP.reduce((s, b) => s + (b.totalAmount || 0), 0);
    const lastRev    = lastMonthP.reduce((s, b) => s + (b.totalAmount || 0), 0);
    const revChange  = lastRev > 0 ? ((thisRev - lastRev) / lastRev) * 100 : thisRev > 0 ? 100 : 0;

    const todayBookings = bookings.filter(b => inRange(b.createdAt, today, tomorrow));

    const todaySched = schedules.filter(s => {
      const d = toDate(s.departureDateTime);
      return s.isActive && d >= today && d < tomorrow;
    });

    return {
      totalRevenue: totalRev,
      revChange,
      totalBookings: bookings.length,
      todayBookings: todayBookings.length,
      pendingBookings: bookings.filter(b => b.bookingStatus === "pending").length,
      confirmedBookings: bookings.filter(b => b.bookingStatus === "confirmed").length,
      cancelledBookings: bookings.filter(b => b.bookingStatus === "cancelled").length,
      outstandingPayments: bookings
        .filter(b => b.paymentStatus === "pending" && b.bookingStatus !== "cancelled")
        .reduce((s, b) => s + (b.totalAmount || 0), 0),
      todaySchedules: todaySched.length,
      activeSchedules: schedules.filter(s => s.isActive).length,
      fleetSize: buses.length,
      activeBuses: buses.filter(b => b.status === "active").length,
      maintenanceBuses: buses.filter(b => b.status === "maintenance").length,
      inactiveBuses: buses.filter(b => b.status === "inactive").length,
      activeRoutes: routes.filter(r => r.isActive).length,
    };
  }, [bookings, schedules, buses, routes]);

  // ── Derived lists ────────────────────────────────────────────────────────────
  const todayScheduleList = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    return schedules
      .filter(s => { const d = toDate(s.departureDateTime); return s.isActive && d >= today && d < tomorrow; })
      .sort((a, b) => toDate(a.departureDateTime).getTime() - toDate(b.departureDateTime).getTime());
  }, [schedules]);

  const recentBookings = useMemo(() =>
    [...bookings].sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime()).slice(0, 5),
  [bookings]);

  // ── Alerts (compact, no heading duplication) ─────────────────────────────────
  const alerts = useMemo(() => {
    const list: { type: "error"|"warning"|"info"; msg: string; tab?: TabType; action?: () => void }[] = [];
    if (!company?.paymentSettings?.paychanguEnabled && !company?.paymentSettings?.stripeEnabled)
      list.push({ type: "warning", msg: "No payment gateway connected.", tab: "settings" });
    if (company?.status !== "active")
      list.push({ type: "error", msg: "Company is paused — activate to receive bookings.", action: handleStatusToggle });
    if (stats.pendingBookings > 0)
      list.push({ type: "info", msg: `${stats.pendingBookings} bookings awaiting confirmation.`, tab: "bookings" });
    if (stats.outstandingPayments > 0)
      list.push({ type: "warning", msg: `MWK ${fmt(stats.outstandingPayments)} in outstanding payments.`, tab: "payments" });
    return list;
  }, [company, stats, handleStatusToggle]);

  return (
    <div className="space-y-5">

      {/* ── Top bar: live status + alerts (compact) ── */}
      <div className="space-y-2">
        {/* Live pill */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
              realtimeStatus.isConnected
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-red-50 text-red-700 border-red-200"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${realtimeStatus.isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
              {realtimeStatus.isConnected ? "Live" : "Offline"}
            </span>
            {realtimeStatus.lastUpdate && (
              <span className="text-xs text-gray-400">
                Updated {relativeTime(realtimeStatus.lastUpdate)}
              </span>
            )}
          </div>
          {realtimeStatus.pendingUpdates > 0 && (
            <span className="flex items-center gap-1 text-xs text-blue-600 font-medium">
              <RefreshCw className="w-3 h-3 animate-spin" />
              {realtimeStatus.pendingUpdates} syncing
            </span>
          )}
        </div>

        {/* Inline alert banners */}
        {alerts.map((a, i) => (
          <button
            key={i}
            onClick={() => a.tab ? setActiveTab(a.tab) : a.action?.()}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border text-left transition-all hover:opacity-80 ${
              a.type === "error"   ? "bg-red-50 border-red-200 text-red-800" :
              a.type === "warning" ? "bg-amber-50 border-amber-200 text-amber-800" :
                                     "bg-blue-50 border-blue-200 text-blue-800"
            }`}
          >
            {a.type === "error"   ? <XCircle className="w-4 h-4 flex-shrink-0" /> :
             a.type === "warning" ? <AlertTriangle className="w-4 h-4 flex-shrink-0" /> :
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            <span className="text-xs font-medium flex-1">{a.msg}</span>
            <ArrowRight className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
          </button>
        ))}
      </div>

      {/* ── Key metrics ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Revenue"
          value={`MWK ${fmt(stats.totalRevenue)}`}
          icon={DollarSign}
          color="green"
          onClick={() => setActiveTab("payments")}
          sub={
            <span className={`flex items-center gap-1 font-semibold ${stats.revChange >= 0 ? "text-green-600" : "text-red-500"}`}>
              {stats.revChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(stats.revChange).toFixed(1)}% vs last month
            </span>
          }
        />
        <StatCard
          label="Total Bookings"
          value={String(stats.totalBookings)}
          icon={Users}
          color="blue"
          onClick={() => setActiveTab("bookings")}
          sub={
            <span>
              <span className="text-blue-600 font-semibold">{stats.todayBookings} today</span>
              {stats.pendingBookings > 0 && (
                <span className="ml-2 text-amber-600 font-semibold">{stats.pendingBookings} pending</span>
              )}
            </span>
          }
        />
        <StatCard
          label="Today's Schedules"
          value={String(stats.todaySchedules)}
          icon={Calendar}
          color="purple"
          onClick={() => setActiveTab("schedules")}
          sub={<span>{stats.activeSchedules} total active schedules</span>}
        />
        <StatCard
          label="Fleet"
          value={String(stats.fleetSize)}
          icon={Truck}
          color="orange"
          onClick={() => setActiveTab("buses")}
          sub={
            <span className="flex items-center gap-2">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />{stats.activeBuses} active</span>
              {stats.maintenanceBuses > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-yellow-400 rounded-full inline-block" />{stats.maintenanceBuses} maintenance</span>}
            </span>
          }
        />
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Today's Schedules */}
        <SectionCard
          title="Today's Schedules"
          subtitle={`${stats.todaySchedules} departure${stats.todaySchedules !== 1 ? "s" : ""}`}
          icon={Calendar}
          iconBg="bg-purple-100 text-purple-600"
          linkColor="text-purple-600"
          onViewAll={() => setActiveTab("schedules")}
        >
          {todayScheduleList.length === 0 ? (
            <EmptyState icon={Calendar} message="No schedules today" action={() => setActiveTab("schedules")} actionLabel="Create Schedule" />
          ) : (
            <div className="space-y-2">
              {todayScheduleList.slice(0, 3).map((s, i) => {
                const route = routes.find(r => r.id === s.routeId);
                const bus   = buses.find(b => b.id === s.busId);
                const dep   = toDate(s.departureDateTime);
                const past  = dep < new Date();
                const opName = s.assignedOperatorIds?.[0]
                  ? resolveName(s.assignedOperatorIds[0], operatorNames, "Operator")
                  : null;
                const coName = s.assignedConductorIds?.[0]
                  ? resolveName(s.assignedConductorIds[0], conductorNames, "Conductor")
                  : null;
                return (
                  <div key={s.id || i} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${past ? "opacity-50 bg-gray-50" : "bg-white hover:border-purple-200"}`}>
                    <div className="text-center w-14 flex-shrink-0">
                      <p className={`text-sm font-bold ${past ? "text-gray-400" : "text-purple-700"}`}>{fmtTime(dep)}</p>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${past ? "bg-gray-100 text-gray-500" : "bg-green-100 text-green-700"}`}>
                        {past ? "Departed" : "Active"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {route ? `${route.origin} → ${route.destination}` : "—"}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {bus?.licensePlate || "No bus"}
                        {opName && ` · ${opName}`}
                        {coName && ` · ${coName}`}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-semibold text-gray-700">{s.availableSeats ?? "—"}</p>
                      <p className="text-[10px] text-gray-400">seats left</p>
                    </div>
                  </div>
                );
              })}
              {todayScheduleList.length > 3 && (
                <button onClick={() => setActiveTab("schedules")} className="w-full py-2 text-xs font-semibold text-purple-600 border border-purple-100 rounded-xl hover:bg-purple-50 transition-colors flex items-center justify-center gap-1">
                  +{todayScheduleList.length - 3} more schedules <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </SectionCard>

        {/* Recent Bookings */}
        <SectionCard
          title="Recent Bookings"
          subtitle={`${stats.todayBookings} today · ${stats.pendingBookings} pending`}
          icon={Users}
          iconBg="bg-green-100 text-green-600"
          linkColor="text-green-600"
          onViewAll={() => setActiveTab("bookings")}
        >
          {recentBookings.length === 0 ? (
            <EmptyState icon={Users} message="No bookings yet" />
          ) : (
            <div className="space-y-2">
              {recentBookings.slice(0, 4).map((b, i) => {
                const schedule = schedules.find(s => s.id === b.scheduleId);
                const route = routes.find(r => r.id === schedule?.routeId);
                const name = b.passengerDetails?.[0]?.name || "Passenger";
                const seats = Array.isArray(b.seatNumbers) ? b.seatNumbers.join(", ") : b.seatNumbers;
                return (
                  <div key={b.id || i} className="flex items-center gap-3 p-3 rounded-xl border hover:border-green-200 transition-all bg-white">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {route ? `${route.origin} → ${route.destination}` : "—"}
                        {seats ? ` · Seat ${seats}` : ""}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold text-gray-900">MWK {fmt(b.totalAmount || 0)}</p>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        b.bookingStatus === "confirmed" ? "bg-green-100 text-green-700" :
                        b.bookingStatus === "pending"   ? "bg-amber-100 text-amber-700" :
                                                          "bg-red-100 text-red-700"
                      }`}>
                        {b.bookingStatus}
                        {b.paymentStatus === "pending" && b.bookingStatus !== "cancelled" && (
                          <span className="ml-1 text-amber-500">· unpaid</span>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* Fleet */}
        <SectionCard
          title="Fleet Status"
          subtitle={`${stats.activeBuses} of ${stats.fleetSize} active`}
          icon={Truck}
          iconBg="bg-orange-100 text-orange-600"
          linkColor="text-orange-600"
          onViewAll={() => setActiveTab("buses")}
        >
          {buses.length === 0 ? (
            <EmptyState icon={BusIcon} message="No buses registered" action={() => setActiveTab("buses")} actionLabel="Add Bus" />
          ) : (
            <div className="space-y-2">
              {buses.slice(0, 3).map((bus, i) => {
                const todaySched = todayScheduleList.find(s => s.busId === bus.id);
                const route = todaySched ? routes.find(r => r.id === todaySched.routeId) : null;
                const opId = todaySched?.assignedOperatorIds?.[0];
                const opName = opId ? resolveName(opId, operatorNames, "Operator") : null;
                return (
                  <div key={bus.id || i} className="flex items-center gap-3 p-3 rounded-xl border hover:border-orange-200 transition-all bg-white">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      bus.status === "active"      ? "bg-green-100" :
                      bus.status === "maintenance" ? "bg-yellow-100" : "bg-gray-100"
                    }`}>
                      <Truck className={`w-4 h-4 ${
                        bus.status === "active"      ? "text-green-600" :
                        bus.status === "maintenance" ? "text-yellow-600" : "text-gray-500"
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{bus.licensePlate}</p>
                      <p className="text-xs text-gray-400">
                        {bus.busType} · {bus.capacity} seats
                        {route ? ` · ${route.origin} → ${route.destination}` : " · No trip today"}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        bus.status === "active"      ? "bg-green-100 text-green-700" :
                        bus.status === "maintenance" ? "bg-yellow-100 text-yellow-700" :
                                                       "bg-gray-100 text-gray-600"
                      }`}>{bus.status}</span>
                      {opName && <p className="text-[10px] text-gray-400 mt-0.5">{opName}</p>}
                    </div>
                  </div>
                );
              })}
              {buses.length > 3 && (
                <button onClick={() => setActiveTab("buses")} className="w-full py-2 text-xs font-semibold text-orange-600 border border-orange-100 rounded-xl hover:bg-orange-50 transition-colors flex items-center justify-center gap-1">
                  +{buses.length - 3} more buses <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </SectionCard>

        {/* Active Routes */}
        <SectionCard
          title="Active Routes"
          subtitle={`${stats.activeRoutes} operational`}
          icon={Navigation}
          iconBg="bg-blue-100 text-blue-600"
          linkColor="text-blue-600"
          onViewAll={() => setActiveTab("routes")}
        >
          {routes.filter(r => r.isActive).length === 0 ? (
            <EmptyState icon={MapPin} message="No active routes" action={() => setActiveTab("routes")} actionLabel="Add Route" />
          ) : (
            <div className="space-y-2">
              {routes.filter(r => r.isActive).slice(0, 3).map((route, i) => {
                const todayCount = todayScheduleList.filter(s => s.routeId === route.id).length;
                return (
                  <div key={route.id || i} className="flex items-center gap-3 p-3 rounded-xl border hover:border-blue-200 transition-all bg-white">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Navigation className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{route.origin} → {route.destination}</p>
                      <p className="text-xs text-gray-400">
                        {route.distance} km
                        {route.baseFare ? ` · MWK ${fmt(route.baseFare)}` : " · Fare not set"}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold text-gray-900">{todayCount}</p>
                      <p className="text-[10px] text-gray-400">trips today</p>
                    </div>
                  </div>
                );
              })}
              {routes.filter(r => r.isActive).length > 3 && (
                <button onClick={() => setActiveTab("routes")} className="w-full py-2 text-xs font-semibold text-blue-600 border border-blue-100 rounded-xl hover:bg-blue-50 transition-colors flex items-center justify-center gap-1">
                  +{routes.filter(r => r.isActive).length - 3} more routes <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Quick stats summary ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Awaiting Confirmation", value: stats.pendingBookings, color: "amber",   icon: Clock,        sub: "Pending" },
          { label: "Active Bookings",        value: stats.confirmedBookings, color: "green", icon: CheckCircle,  sub: "Confirmed" },
          { label: "Cancelled Bookings",     value: stats.cancelledBookings, color: "red",   icon: XCircle,      sub: "Cancelled" },
          { label: "Outstanding Payments",   value: `MWK ${fmt(stats.outstandingPayments)}`, color: "orange", icon: CreditCard, sub: "Unpaid" },
        ].map(({ label, value, color, icon: Icon, sub }) => {
          const palette: Record<string, string> = {
            amber:  "from-amber-50  to-amber-100/60  border-amber-200  text-amber-900  text-amber-700  bg-amber-200",
            green:  "from-green-50  to-green-100/60  border-green-200  text-green-900  text-green-700  bg-green-200",
            red:    "from-red-50    to-red-100/60    border-red-200    text-red-900    text-red-700    bg-red-200",
            orange: "from-orange-50 to-orange-100/60 border-orange-200 text-orange-900 text-orange-700 bg-orange-200",
          };
          const [from, to, border, textMain, textSub, badgeBg] = palette[color].split("  ");
          return (
            <button
              key={label}
              onClick={() => setActiveTab(color === "orange" ? "payments" : "bookings")}
              className={`bg-gradient-to-br ${from} ${to} p-4 rounded-2xl border ${border} text-left hover:opacity-90 transition-opacity`}
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className={`w-4 h-4 ${textSub}`} />
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeBg} ${textSub}`}>{sub}</span>
              </div>
              <p className={`text-xl font-bold ${textMain}`}>{value}</p>
              <p className={`text-xs mt-0.5 ${textSub}`}>{label}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}