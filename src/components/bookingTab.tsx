"use client";

import { FC, useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  doc, getDoc, updateDoc, collection, query, where,
  onSnapshot, getDocs, orderBy, limit, serverTimestamp, addDoc
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { useAppToast } from "@/contexts/ToastContext";
import { Booking, Schedule, Bus, Route, Company, UserProfile } from "@/types/core";
import {
  Search, Check, X, Clock, Users, MapPin, Calendar, Eye,
  CreditCard, Download, DollarSign, AlertTriangle,
  Phone, Bus as BusIcon, List as ListIcon, LayoutGrid, Loader2,
  ChevronLeft, ChevronRight, User, RotateCcw, Wallet,
  CreditCard as CreditCardIcon, Filter, ArrowRight, Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Modal from "@/components/Modals";

// ─── Constants ────────────────────────────────────────────────────────────────
const SEAT_LAYOUT_CONFIGS = {
  standard: { seatsPerRow: 4, seatLabels: ["A", "B", "C", "D"] },
  luxury:   { seatsPerRow: 3, seatLabels: ["A", "B", "C"] },
  express:  { seatsPerRow: 4, seatLabels: ["A", "B", "C", "D"] },
  minibus:  { seatsPerRow: 3, seatLabels: ["A", "B", "C"] },
};

const SNAPSHOT_LIMIT = 100;

// ─── Segment helpers ──────────────────────────────────────────────────────────
function getPassengerSegment(booking: Booking, route?: Route) {
  const b = booking as any;
  if (b.originStopName && b.destinationStopName) {
    return { origin: b.originStopName as string, destination: b.destinationStopName as string };
  }
  if (b.originStopId && b.destinationStopId && route?.stops) {
    const findName = (id: string) => {
      if (id === "__origin__")      return route.origin;
      if (id === "__destination__") return route.destination;
      return route.stops?.find(s => s.id === id)?.name ?? "Unknown";
    };
    return { origin: findName(b.originStopId), destination: findName(b.destinationStopId) };
  }
  return { origin: route?.origin ?? "Unknown", destination: route?.destination ?? "Unknown" };
}

function isPartialSegment(booking: Booking, route?: Route): boolean {
  if (!route) return false;
  const b = booking as any;
  const hasInfo = b.originStopId || b.destinationStopId || b.originStopName || b.destinationStopName;
  if (!hasInfo) return false;
  if (b.originStopId === "__origin__" && b.destinationStopId === "__destination__") return false;
  const { origin, destination } = getPassengerSegment(booking, route);
  const norm = (s: string) => s.trim().toLowerCase();
  return norm(origin) !== norm(route.origin) || norm(destination) !== norm(route.destination);
}

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface SeatSelectionViewProps {
  bus:          Bus;
  schedule:     Schedule;
  bookings:     Booking[];
  route?:       Route;
  onSeatClick?: (booking: Booking) => void;
  className?:   string;
}

interface BookingsTabProps {
  bookings:    Booking[];
  setBookings: (bookings: Booking[] | ((prev: Booking[]) => Booking[])) => void;
  schedules:   Schedule[];
  routes:      Route[];
  companyId?:  string;
  user:        any;
  userProfile: any;
  role?:       "company_admin" | "operator" | "user";
  companies?:  Company[];
  buses?:      Bus[];
}

interface BookingFilters { date: string; status: string; search: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toDate = (v: any): Date => {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  if (v?.toDate) return v.toDate();
  if (v?.seconds) return new Date(v.seconds * 1000);
  return new Date(v);
};

const statusBadgeClass = (status: string) => {
  const base = "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium";
  return (
    { confirmed: `${base} bg-green-100 text-green-800`, pending: `${base} bg-yellow-100 text-yellow-800`, cancelled: `${base} bg-red-100 text-red-800` }[status]
    ?? `${base} bg-gray-100 text-gray-800`
  );
};

// ─── Payment Method Badge ─────────────────────────────────────────────────────
const PaymentMethodBadge: FC<{ paymentMethod?: string; paymentProvider?: string; paymentStatus?: string }> = ({
  paymentMethod, paymentProvider, paymentStatus,
}) => {
  if (paymentStatus !== "paid")
    return <div className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full"><Clock className="w-3 h-3" /><span>Pending</span></div>;
  if (paymentMethod === "cash_on_boarding")
    return <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full"><Wallet className="w-3 h-3" /><span>Cash Collected</span></div>;
  if (paymentProvider === "stripe" || paymentMethod === "stripe")
    return <div className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"><CreditCardIcon className="w-3 h-3" /><span>Stripe</span></div>;
  if (paymentProvider || paymentMethod)
    return <div className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full"><CreditCardIcon className="w-3 h-3" /><span>{paymentProvider || paymentMethod}</span></div>;
  return <div className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"><DollarSign className="w-3 h-3" /><span>Not Paid</span></div>;
};

// ─── Segment Badge ────────────────────────────────────────────────────────────
const SegmentBadge: FC<{ booking: Booking; route?: Route }> = ({ booking, route }) => {
  if (!isPartialSegment(booking, route)) return null;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[10px] rounded-full font-medium whitespace-nowrap">
      <ArrowRight className="w-2.5 h-2.5" />Segment
    </span>
  );
};

// ─── Seat Selection View ──────────────────────────────────────────────────────
const SeatSelectionView: FC<SeatSelectionViewProps> = ({
  bus, schedule, bookings, route, onSeatClick, className = "",
}) => {
  const busTypeKey = (bus?.busType?.toLowerCase() || "standard") as keyof typeof SEAT_LAYOUT_CONFIGS;
  const layoutCfg  = SEAT_LAYOUT_CONFIGS[busTypeKey] || SEAT_LAYOUT_CONFIGS.standard;

  const seatLayout = useMemo(() => {
    const total = bus?.capacity || 40;
    const { seatsPerRow, seatLabels } = layoutCfg;
    const rows: (string | null)[][] = [];
    let counter = 1;
    for (let r = 1; r <= Math.ceil(total / seatsPerRow); r++) {
      const row: (string | null)[] = [];
      for (let c = 0; c < seatsPerRow && counter <= total; c++) { row.push(`${r}${seatLabels[c]}`); counter++; }
      while (row.length < seatsPerRow) row.push(null);
      rows.push(row);
    }
    return rows;
  }, [bus?.capacity, layoutCfg]);

  const seatToBooking = useMemo(() => {
    const m = new Map<string, Booking>();
    bookings.forEach(b => b.seatNumbers?.forEach((s: any) => m.set(String(s), b)));
    return m;
  }, [bookings]);

  const bookedSeats    = bookings.reduce((s, b) => s + (b.seatNumbers?.length || 0), 0);
  const availableSeats = (bus?.capacity || 0) - bookedSeats;
  const occupancyRate  = bus?.capacity ? (bookedSeats / bus.capacity) * 100 : 0;

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden ${className}`}>
      <div className="p-4 sm:p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-b">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-3 bg-blue-600 rounded-xl"><BusIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" /></div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900">{bus?.licensePlate || "Bus"}</h3>
              <p className="text-xs sm:text-sm text-gray-600">{bus?.busType} · {bus?.capacity || "?"} seats</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs sm:text-sm text-gray-600">Departure</p>
            <p className="font-semibold text-gray-900 text-sm sm:text-base">
              {schedule?.departureDateTime ? toDate(schedule.departureDateTime).toLocaleDateString() : "N/A"}
            </p>
            <p className="text-xs sm:text-sm text-gray-600">
              {schedule?.departureDateTime ? toDate(schedule.departureDateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {[
            { label: "Booked",    value: bookedSeats,               color: "red"   },
            { label: "Available", value: availableSeats,            color: "green" },
            { label: "Occupancy", value: `${occupancyRate.toFixed(0)}%`, color: "blue" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-lg p-2 sm:p-3 text-center shadow-sm">
              <p className={`text-xl sm:text-2xl font-bold text-${color}-600`}>{value}</p>
              <p className="text-xs text-gray-600">{label}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${occupancyRate > 75 ? "bg-red-500" : occupancyRate > 50 ? "bg-yellow-500" : "bg-green-500"}`}
            style={{ width: `${occupancyRate}%` }}
          />
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-center mb-6">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-full">
            <div className="w-6 h-6 bg-gray-800 rounded text-white flex items-center justify-center text-xs font-bold">👨</div>
            <span className="text-xs sm:text-sm font-medium text-gray-700">Driver</span>
          </div>
        </div>
        <div className="max-w-sm mx-auto space-y-2">
          {seatLayout.map((row, ri) => (
            <div key={ri} className="flex justify-center gap-1 sm:gap-2">
              {row.map((seat, si) => {
                if (!seat) return <div key={si} className="w-12 h-12" />;
                const booking = seatToBooking.get(seat);
                const status  = booking ? "booked" : "available";
                const pax     = booking?.passengerDetails?.find((p: any) => p.seatNumber === seat);
                const seg     = booking ? getPassengerSegment(booking, route) : null;
                const base    = "w-12 h-12 rounded-lg text-xs font-bold border-2 transition-all flex items-center justify-center";
                const cls     = status === "booked"
                  ? `${base} bg-red-50 border-red-400 text-red-700 cursor-pointer hover:bg-red-100 hover:scale-105 hover:shadow-md`
                  : `${base} bg-gray-100 border-gray-300 text-gray-500 cursor-default`;
                return (
                  <div key={si} className={cls}
                    onClick={() => status === "booked" && booking && onSeatClick?.(booking)}
                    title={seg ? `${pax?.name || "Passenger"} · ${seg.origin} → ${seg.destination}` : "Available"}>
                    {seat}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-6 text-xs sm:text-sm text-gray-600 mt-8">
          <div className="flex items-center gap-2"><div className="w-4 h-4 bg-gray-100 border-2 border-gray-300 rounded" /><span>Available</span></div>
          <div className="flex items-center gap-2"><div className="w-4 h-4 bg-red-50 border-2 border-red-400 rounded" /><span>Booked</span></div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const BookingsTab: FC<BookingsTabProps> = ({
  bookings, setBookings, schedules, routes, companyId,
  role = "company_admin", companies = [], buses = [], user, userProfile,
}) => {
  const { success, error } = useAppToast();

  const [filters,         setFilters]         = useState<BookingFilters>({ date: new Date().toISOString().split("T")[0], status: "all", search: "" });
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [currentPage,     setCurrentPage]     = useState(1);
  const [pageSize,        setPageSize]        = useState(10);
  const [viewMode,        setViewMode]        = useState<"list" | "seats">("list");
  const [actionLoading,   setActionLoading]   = useState<string | null>(null);
  const [reminderLoading, setReminderLoading] = useState<string | null>(null);
  const [showFilters,     setShowFilters]     = useState(false);

  // Whether schedules prop has been populated at least once.
  // Prevents the operator path from firing an early-exit before schedules arrive.
  const [schedulesReady,  setSchedulesReady]  = useState(false);

  const scheduleCache = useRef<Map<string, { routeId: string; createdBy?: string }>>(new Map());
  const [enrichTick,  setEnrichTick]  = useState(0);

  // Seed cache + mark ready when schedules prop arrives
  useEffect(() => {
    if (schedules.length > 0) {
      schedules.forEach(s => {
        if (!scheduleCache.current.has(s.id))
          scheduleCache.current.set(s.id, { routeId: s.routeId || "", createdBy: s.createdBy });
      });
      setSchedulesReady(true);
    }
  }, [schedules]);

  // ── Realtime listener ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!companyId) return;

    // ── Operator path ─────────────────────────────────────────────────────
    if (userProfile?.role === "operator") {
      // Wait until schedules have been passed in from the parent.
      // Without this guard, schedules is [] on the first render and we'd
      // return early — showing an empty list even though data is coming.
      if (!schedulesReady) return;

      const opScheduleIds = schedules
        .filter(s => s.createdBy === user?.uid)
        .map(s => s.id);

      // Operator is authenticated but genuinely has no schedules yet — show empty, no error.
      if (opScheduleIds.length === 0) {
        setBookings([]);
        return;
      }

      const chunks: string[][] = [];
      for (let i = 0; i < opScheduleIds.length; i += 30)
        chunks.push(opScheduleIds.slice(i, i + 30));

      const chunkResults = new Map<string, Booking[]>();
      const listeners = chunks.map((chunk, ci) => {
        const q = query(
          collection(db, "bookings"),
          where("companyId", "==", companyId),
          where("scheduleId", "in", chunk),
          orderBy("createdAt", "desc"),
          limit(SNAPSHOT_LIMIT),
        );
        return onSnapshot(
          q,
          snap => {
            chunkResults.set(String(ci), snap.docs.map(d => ({
              id: d.id, ...d.data(),
              createdAt: toDate(d.data().createdAt),
              updatedAt: toDate(d.data().updatedAt),
            } as Booking)));
            setBookings(Array.from(chunkResults.values()).flat());
            setEnrichTick(t => t + 1);
          },
          // Don't show an error banner — log quietly and let the UI show empty
          err => console.warn("[BookingsTab] operator snapshot error:", err),
        );
      });

      return () => listeners.forEach(u => u());
    }

    // ── Admin / super-admin path ──────────────────────────────────────────
    const q = query(
      collection(db, "bookings"),
      where("companyId", "==", companyId),
      orderBy("createdAt", "desc"),
      limit(SNAPSHOT_LIMIT),
    );
    const unsub = onSnapshot(
      q,
      snap => {
        setBookings(snap.docs.map(d => ({
          id: d.id, ...d.data(),
          createdAt: toDate(d.data().createdAt),
          updatedAt: toDate(d.data().updatedAt),
        } as Booking)));
        setEnrichTick(t => t + 1);
      },
      err => console.warn("[BookingsTab] admin snapshot error:", err),
    );

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, userProfile?.role, user?.uid, schedulesReady]);
  // ↑ schedulesReady added so the operator path re-runs once schedules arrive

  // ── Filtering ─────────────────────────────────────────────────────────────
  const getBookingDateStr = (b: Booking): string => {
    try { return toDate((b as any).bookingDate || b.createdAt).toISOString().split("T")[0]; }
    catch { return ""; }
  };

  const filteredBookings = useMemo(() => {
    const arr = bookings.filter(b => {
      if (!b) return false;
      if (role === "company_admin" && b.companyId !== companyId) return false;
      if (userProfile?.role === "operator") {
        const ids = schedules.filter(s => s.createdBy === user?.uid).map(s => s.id);
        if (!ids.includes(b.scheduleId)) return false;
      }
      if (getBookingDateStr(b) !== filters.date) return false;
      if (filters.status !== "all") {
        if (filters.status === "confirmed" && !(b.bookingStatus === "confirmed" && b.paymentStatus === "paid")) return false;
        if (filters.status === "pending"   && !(b.bookingStatus === "pending" || (b.bookingStatus === "confirmed" && b.paymentStatus === "pending"))) return false;
        if (filters.status !== "confirmed" && filters.status !== "pending" && b.bookingStatus !== filters.status) return false;
      }
      if (filters.search) {
        const q   = filters.search.toLowerCase();
        const sc  = scheduleCache.current.get(b.scheduleId);
        const rt  = routes.find(r => r.id === sc?.routeId);
        const seg = getPassengerSegment(b, rt);
        if (!(
          b.bookingReference?.toLowerCase().includes(q) ||
          b.passengerDetails?.some((p: any) => p.name?.toLowerCase().includes(q)) ||
          seg.origin.toLowerCase().includes(q) ||
          seg.destination.toLowerCase().includes(q)
        )) return false;
      }
      return true;
    });
    return arr.sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings, enrichTick, filters, companyId, role, userProfile, schedules, routes, user]);

  useEffect(() => { setCurrentPage(1); }, [filters.date, filters.status, filters.search, pageSize]);

  const stats = useMemo(() => ({
    total:     filteredBookings.length,
    confirmed: filteredBookings.filter(b => b.bookingStatus === "confirmed" && b.paymentStatus === "paid").length,
    pending:   filteredBookings.filter(b => b.bookingStatus === "pending" || (b.bookingStatus === "confirmed" && b.paymentStatus === "pending")).length,
    cancelled: filteredBookings.filter(b => b.bookingStatus === "cancelled").length,
  }), [filteredBookings]);

  const totalPages    = Math.max(1, Math.ceil(filteredBookings.length / pageSize));
  const paginatedRows = filteredBookings.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const bookingsBySchedule = useMemo(() => {
    const map = new Map<string, Booking[]>();
    filteredBookings.forEach(b => {
      if (!b.scheduleId) return;
      if (!map.has(b.scheduleId)) map.set(b.scheduleId, []);
      map.get(b.scheduleId)!.push(b);
    });
    return map;
  }, [filteredBookings]);

  const getPaginationPages = useCallback(() => {
    const maxVisible = 5;
    const pages: number[] = [];
    const start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    const end   = Math.min(totalPages, start + maxVisible - 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [currentPage, totalPages]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleUpdateStatus = useCallback(async (bookingId: string, newStatus: "confirmed" | "cancelled", reason?: string) => {
    setActionLoading(bookingId);
    try {
      const patch = {
        bookingStatus: newStatus,
        updatedAt: new Date(),
        ...(newStatus === "confirmed"
          ? { confirmedDate: new Date() }
          : { cancellationDate: new Date(), ...(reason && { cancellationReason: reason }) }),
      };
      await updateDoc(doc(db, "bookings", bookingId), patch);
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, ...patch } as Booking : b));
      success(`Booking ${newStatus === "confirmed" ? "Confirmed" : "Cancelled"}`, `Booking has been ${newStatus} successfully`);
    } catch (err: any) {
      error("Failed to update booking", err.message);
    } finally { setActionLoading(null); }
  }, [setBookings, success, error]);

  const handleSendReminder = useCallback(async (booking: Booking) => {
    setReminderLoading(booking.id);
    try {
      await addDoc(collection(db, "reminders"), {
        bookingId:        booking.id,
        bookingReference: booking.bookingReference || booking.id,
        companyId:        booking.companyId,
        userId:           (booking as any).userId || null,
        passengerEmail:   booking.passengerDetails?.[0]?.email || null,
        contactPhone:     (booking as any).contactPhone || null,
        sentAt:           serverTimestamp(),
        sentBy:           user?.uid || "admin",
        type:             "payment_reminder",
        status:           "queued",
      });
      success("Reminder Queued", `Payment reminder queued for ${booking.bookingReference || booking.id.slice(0, 8)}`);
    } catch (err: any) {
      error("Failed to send reminder", err.message);
    } finally { setReminderLoading(null); }
  }, [user, success, error]);

  // ── Loading state — shown while operator waits for schedules ──────────────
  // This is the key UX fix: instead of showing nothing (or an error banner),
  // we show a spinner until we know whether the operator has schedules.
  if (userProfile?.role === "operator" && !schedulesReady) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading your schedules…</p>
        </div>
      </div>
    );
  }

  // ── Access guard ──────────────────────────────────────────────────────────
  if (!companyId && role === "company_admin") {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 sm:p-6 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-red-900">Access Error</h3>
          <p className="text-xs sm:text-sm text-red-700 mt-1">Company ID is required</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 sm:space-y-6">

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        {([
          { key: "total",     label: "Total",     count: stats.total     },
          { key: "confirmed", label: "Confirmed", count: stats.confirmed },
          { key: "pending",   label: "Pending",   count: stats.pending   },
          { key: "cancelled", label: "Cancelled", count: stats.cancelled },
        ] as const).map(stat => (
          <button key={stat.key}
            onClick={() => setFilters(prev => ({ ...prev, status: stat.key }))}
            className={`p-3 sm:p-4 rounded-xl border-2 transition-all text-center ${filters.status === stat.key ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"}`}>
            <p className="text-lg sm:text-2xl font-bold text-gray-900">{stat.count}</p>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">{stat.label}</p>
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm border p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Search by name, reference or stop…" value={filters.search}
              onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))} className="pl-10 text-sm" />
          </div>
          <input type="date" value={filters.date}
            onChange={e => setFilters(prev => ({ ...prev, date: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 flex-wrap">
          <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} className="border rounded-lg px-3 py-2 text-sm">
            {[5, 10, 20, 50].map(n => <option key={n} value={n}>{n} per page</option>)}
          </select>
          <div className="flex gap-1 border rounded-lg p-1">
            <Button variant={viewMode === "list"  ? "default" : "ghost"} size="sm" onClick={() => setViewMode("list")}  className="px-2 sm:px-3"><ListIcon   className="w-4 h-4" /></Button>
            <Button variant={viewMode === "seats" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("seats")} className="px-2 sm:px-3"><LayoutGrid className="w-4 h-4" /></Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(f => !f)} className="text-xs sm:text-sm">
            <Filter className="w-4 h-4 mr-1" />{showFilters ? "Hide" : "Show"} Filters
          </Button>
        </div>
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={filters.status} onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full border rounded-lg px-2 py-1 text-xs sm:text-sm">
                <option value="all">All Statuses</option>
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button variant="outline" size="sm"
                onClick={() => setFilters({ date: new Date().toISOString().split("T")[0], status: "all", search: "" })}
                className="w-full text-xs sm:text-sm">
                <RotateCcw className="w-3 h-3 mr-1" />Reset Filters
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Capped-results notice */}
      {bookings.length >= SNAPSHOT_LIMIT && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Showing the {SNAPSHOT_LIMIT} most recent bookings. Use date filters to find older entries.
        </div>
      )}

      {/* ─── LIST VIEW ─── */}
      {viewMode === "list" ? (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-left font-medium text-gray-700">Ref</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-left font-medium text-gray-700">Passenger</th>
                  <th className="hidden sm:table-cell px-4 py-3 text-left font-medium text-gray-700">Journey</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-left font-medium text-gray-700">Seats</th>
                  <th className="hidden md:table-cell px-4 py-3 text-left font-medium text-gray-700">Amount</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-left font-medium text-gray-700">Status</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-left font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500 text-xs sm:text-sm">
                      No bookings for {new Date(filters.date + "T00:00:00").toLocaleDateString()}
                    </td>
                  </tr>
                ) : paginatedRows.map(booking => {
                  const sc      = scheduleCache.current.get(booking.scheduleId);
                  const route   = routes.find(r => r.id === sc?.routeId);
                  const segment = getPassengerSegment(booking, route);
                  const partial = isPartialSegment(booking, route);

                  return (
                    <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 sm:px-4 py-2 sm:py-3">
                        <span className="font-mono font-medium text-gray-900">{booking.bookingReference || booking.id?.slice(0, 8)}</span>
                      </td>
                      <td className="px-3 sm:px-4 py-2 sm:py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <User className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900 truncate">{booking.passengerDetails?.[0]?.name || "N/A"}</div>
                            {booking.passengerDetails?.[0]?.contactNumber && (
                              <div className="text-xs text-gray-500 truncate">
                                <Phone className="w-3 h-3 inline mr-0.5" />{booking.passengerDetails[0].contactNumber}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="hidden sm:table-cell px-4 py-3">
                        <div className="flex items-center gap-1.5 text-sm flex-wrap">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="font-medium text-gray-900">{segment.origin}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="font-medium text-gray-900">{segment.destination}</span>
                          {partial && (
                            <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[10px] rounded-full font-medium">segment</span>
                          )}
                        </div>
                        {partial && route && (
                          <div className="text-[10px] text-gray-400 mt-0.5 pl-5">
                            Full route: {route.origin} → {route.destination}
                          </div>
                        )}
                      </td>

                      <td className="px-3 sm:px-4 py-2 sm:py-3">
                        <div className="flex flex-wrap gap-1">
                          {booking.seatNumbers?.slice(0, 2).map((s: string, i: number) => (
                            <span key={i} className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">{s}</span>
                          ))}
                          {(booking.seatNumbers?.length || 0) > 2 && (
                            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">+{booking.seatNumbers!.length - 2}</span>
                          )}
                        </div>
                      </td>

                      <td className="hidden md:table-cell px-4 py-3">
                        <span className="font-medium text-gray-900">MWK {booking.totalAmount?.toLocaleString() || "0"}</span>
                      </td>

                      <td className="px-3 sm:px-4 py-2 sm:py-3">
                        <div className="flex flex-col gap-1">
                          <span className={statusBadgeClass(booking.bookingStatus)}>
                            {booking.bookingStatus === "confirmed" && <Check className="w-3 h-3" />}
                            <span className="text-xs">{booking.bookingStatus}</span>
                          </span>
                          {partial && <SegmentBadge booking={booking} route={route} />}
                        </div>
                      </td>

                      <td className="px-3 sm:px-4 py-2 sm:py-3">
                        <div className="flex gap-1 flex-wrap">
                          {booking.bookingStatus === "pending" && (
                            <Button size="sm" onClick={() => handleUpdateStatus(booking.id, "confirmed")}
                              disabled={actionLoading === booking.id}
                              className="bg-green-600 hover:bg-green-700 px-1.5 py-1 h-7" title="Confirm">
                              {actionLoading === booking.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            </Button>
                          )}
                          {booking.paymentStatus === "pending" && (
                            <Button size="sm" variant="outline" onClick={() => handleSendReminder(booking)}
                              disabled={reminderLoading === booking.id}
                              className="px-1.5 py-1 h-7 text-amber-600 border-amber-300 hover:bg-amber-50" title="Send reminder">
                              {reminderLoading === booking.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bell className="w-3 h-3" />}
                            </Button>
                          )}
                          {(booking.bookingStatus === "pending" || booking.bookingStatus === "confirmed") && (
                            <Button size="sm" variant="destructive" onClick={() => handleUpdateStatus(booking.id, "cancelled")}
                              disabled={actionLoading === booking.id}
                              className="px-1.5 py-1 h-7" title="Cancel">
                              {actionLoading === booking.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => setSelectedBooking(booking)}
                            className="px-1.5 py-1 h-7" title="View details">
                            <Eye className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-3 sm:px-4 py-3 sm:py-4 border-t bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
              <div className="text-gray-600">
                Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredBookings.length)} of {filteredBookings.length}
              </div>
              <div className="flex items-center gap-1 flex-wrap justify-center">
                <Button size="sm" variant="outline" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} className="px-2 py-1 h-8">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                {getPaginationPages().map(page => (
                  <Button key={page} size="sm" variant={currentPage === page ? "default" : "outline"}
                    onClick={() => setCurrentPage(page)} className="px-2 py-1 h-8 text-xs">{page}</Button>
                ))}
                <Button size="sm" variant="outline" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="px-2 py-1 h-8">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

      ) : (
        /* ─── SEAT VIEW ─── */
        <div className="space-y-4 sm:space-y-6">
          {Array.from(bookingsBySchedule.entries()).map(([scheduleId, schedBookings]) => {
            const schedule     = schedules.find(s => s.id === scheduleId);
            const bus          = buses.find(b => b.id === schedule?.busId);
            const route        = routes.find(r => r.id === schedule?.routeId);
            if (!schedule || !bus) return null;
            const partialCount = schedBookings.filter(b => isPartialSegment(b, route)).length;

            return (
              <div key={scheduleId}>
                <div className="mb-3 sm:mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                      {route?.origin ?? "?"} → {route?.destination ?? "?"}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-500">Hover a seat to see each passenger's boarding segment</p>
                    <p className="text-xs sm:text-sm text-gray-600">
                      {schedule.departureDateTime ? toDate(schedule.departureDateTime).toLocaleDateString() : "—"}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-900">
                      {schedBookings.length} booking{schedBookings.length !== 1 ? "s" : ""}
                    </p>
                    {partialCount > 0 && (
                      <p className="text-xs text-orange-600">{partialCount} partial segment{partialCount !== 1 ? "s" : ""}</p>
                    )}
                  </div>
                </div>
                <SeatSelectionView
                  bus={bus} schedule={schedule} bookings={schedBookings}
                  route={route} onSeatClick={setSelectedBooking}
                />
              </div>
            );
          })}
          {bookingsBySchedule.size === 0 && (
            <div className="bg-white rounded-xl shadow-sm border p-8 sm:p-12 text-center">
              <LayoutGrid className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No bookings for this date</h3>
              <p className="text-xs sm:text-sm text-gray-500">Select a different date to view bookings</p>
            </div>
          )}
        </div>
      )}

      {/* ─── DETAIL MODAL ─── */}
      {selectedBooking && (
        <Modal isOpen={!!selectedBooking} onClose={() => setSelectedBooking(null)}
          title={`Booking: ${selectedBooking.bookingReference || selectedBooking.id?.slice(0, 8)}`}>
          <div className="space-y-5">
            <div className="flex gap-2 flex-wrap">
              <span className={statusBadgeClass(selectedBooking.bookingStatus)}>{selectedBooking.bookingStatus}</span>
              <PaymentMethodBadge
                paymentMethod={(selectedBooking as any).paymentMethod}
                paymentProvider={(selectedBooking as any).paymentProvider}
                paymentStatus={selectedBooking.paymentStatus}
              />
              {(() => {
                const sc = scheduleCache.current.get(selectedBooking.scheduleId);
                return <SegmentBadge booking={selectedBooking} route={routes.find(r => r.id === sc?.routeId)} />;
              })()}
            </div>

            {(() => {
              const sc       = scheduleCache.current.get(selectedBooking.scheduleId);
              const schedule = schedules.find(s => s.id === selectedBooking.scheduleId);
              const route    = routes.find(r => r.id === sc?.routeId);
              const segment  = getPassengerSegment(selectedBooking, route);
              const partial  = isPartialSegment(selectedBooking, route);
              return (
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">Passenger's Journey</p>
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                      <MapPin className="w-4 h-4 text-blue-500 shrink-0" />
                      <span>{segment.origin}</span>
                      <ArrowRight className="w-4 h-4 text-gray-400 shrink-0" />
                      <span>{segment.destination}</span>
                    </div>
                    {partial && route && (
                      <p className="text-xs text-gray-500 mt-1">Full route: {route.origin} → {route.destination}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Departure</p>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <p className="font-medium text-sm">
                          {schedule?.departureDateTime ? toDate(schedule.departureDateTime).toLocaleString() : "N/A"}
                        </p>
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Amount</p>
                      <p className="text-lg font-bold text-gray-900">MWK {selectedBooking.totalAmount?.toLocaleString() || "0"}</p>
                      {partial && (selectedBooking as any).pricePerPerson && (
                        <p className="text-xs text-gray-500">
                          MWK {(selectedBooking as any).pricePerPerson.toLocaleString()} × {selectedBooking.passengerDetails?.length || 1} pax
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Passengers ({selectedBooking.passengerDetails?.length || 0})</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedBooking.passengerDetails?.map((pax: any, i: number) => (
                  <div key={i} className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm text-gray-900">{pax.name}</p>
                      <p className="text-xs text-gray-600">Age {pax.age} · {pax.gender || pax.sex}</p>
                    </div>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">Seat {pax.seatNumber}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Payment</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Total Amount</p>
                  <p className="text-lg font-bold text-gray-900">MWK {selectedBooking.totalAmount?.toLocaleString() || "0"}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Method</p>
                  <p className="font-medium text-sm text-gray-900">
                    {(selectedBooking as any).paymentMethod === "cash_on_boarding"
                      ? "Cash (on boarding)"
                      : (selectedBooking as any).paymentProvider || "Not paid"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2 border-t flex-wrap">
              {selectedBooking.bookingStatus === "pending" && (
                <Button onClick={() => { handleUpdateStatus(selectedBooking.id, "confirmed"); setSelectedBooking(null); }}
                  disabled={actionLoading === selectedBooking.id}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" />Confirm
                </Button>
              )}
              {selectedBooking.paymentStatus === "pending" && (
                <Button onClick={() => { handleSendReminder(selectedBooking); setSelectedBooking(null); }}
                  disabled={reminderLoading === selectedBooking.id}
                  variant="outline"
                  className="flex-1 text-amber-600 border-amber-300 hover:bg-amber-50 flex items-center justify-center gap-2">
                  <Bell className="w-4 h-4" />Send Reminder
                </Button>
              )}
              {(selectedBooking.bookingStatus === "pending" || selectedBooking.bookingStatus === "confirmed") && (
                <Button onClick={() => { handleUpdateStatus(selectedBooking.id, "cancelled"); setSelectedBooking(null); }}
                  disabled={actionLoading === selectedBooking.id} variant="destructive"
                  className="flex-1 flex items-center justify-center gap-2">
                  <X className="w-4 h-4" />Cancel
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default BookingsTab;