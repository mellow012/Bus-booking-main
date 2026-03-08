"use client";

import { FC, useState, useMemo, useCallback, useEffect } from "react";
import {
  doc, updateDoc, collection, query, where,
  onSnapshot, orderBy, serverTimestamp, addDoc, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { useAppToast } from "@/contexts/ToastContext";
import { Booking, Schedule, Bus, Route, Company } from "@/types/core";
import {
  Search, Check, X, Clock, Users, MapPin, Calendar,
  Eye, DollarSign, AlertTriangle, Phone, Bus as BusIcon,
  List as ListIcon, LayoutGrid, Loader2, ChevronLeft,
  ChevronRight, User, RotateCcw, Wallet, CreditCard,
  ArrowRight, Bell, Info, Filter,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BookingsTabProps {
  schedules:   Schedule[];
  routes:      Route[];
  buses:       Bus[];
  companyId:   string;
  user:        any;
  userProfile: any;
}

type ViewMode = "list" | "seats";
type FilterStatus = "all" | "confirmed" | "pending" | "cancelled";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toDate = (v: any): Date => {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  if (typeof v?.toDate === "function") return v.toDate();
  if (v?.seconds) return new Date(v.seconds * 1000);
  return new Date(v);
};

const todayStr = () => new Date().toISOString().split("T")[0];

const fmtTime = (d: Date) =>
  d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-MW", { day: "numeric", month: "short", year: "numeric" });

// Returns the passenger's boarding segment (may differ from full route)
function passengerSegment(booking: Booking, route?: Route) {
  const b = booking as any;
  if (b.originStopName && b.destinationStopName)
    return { from: b.originStopName as string, to: b.destinationStopName as string };
  if (b.originStopId && b.destinationStopId && route?.stops) {
    const name = (id: string) => {
      if (id === "__origin__")      return route.origin;
      if (id === "__destination__") return route.destination;
      return route.stops?.find(s => s.id === id)?.name ?? "?";
    };
    return { from: name(b.originStopId), to: name(b.destinationStopId) };
  }
  return { from: route?.origin ?? "?", to: route?.destination ?? "?" };
}

function isSegmentBooking(booking: Booking, route?: Route): boolean {
  if (!route) return false;
  const b = booking as any;
  if (!b.originStopId && !b.destinationStopId && !b.originStopName && !b.destinationStopName) return false;
  if (b.originStopId === "__origin__" && b.destinationStopId === "__destination__") return false;
  const seg  = passengerSegment(booking, route);
  const norm = (s: string) => s.trim().toLowerCase();
  return norm(seg.from) !== norm(route.origin) || norm(seg.to) !== norm(route.destination);
}

// ─── Seat layout constants ────────────────────────────────────────────────────

const SEAT_CONFIGS: Record<string, { cols: number; labels: string[] }> = {
  standard: { cols: 4, labels: ["A", "B", "C", "D"] },
  luxury:   { cols: 3, labels: ["A", "B", "C"]       },
  express:  { cols: 4, labels: ["A", "B", "C", "D"] },
  minibus:  { cols: 3, labels: ["A", "B", "C"]       },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusBadge: FC<{ status: string }> = ({ status }) => {
  const cls: Record<string, string> = {
    confirmed: "bg-green-100 text-green-800",
    pending:   "bg-yellow-100 text-yellow-800",
    cancelled: "bg-red-100 text-red-800",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cls[status] ?? "bg-gray-100 text-gray-700"}`}>
      {status === "confirmed" && <Check className="w-3 h-3" />}
      {status === "cancelled" && <X    className="w-3 h-3" />}
      {status === "pending"   && <Clock className="w-3 h-3" />}
      {status}
    </span>
  );
};

const PaymentBadge: FC<{ booking: Booking }> = ({ booking }) => {
  const b = booking as any;
  if (booking.paymentStatus !== "paid")
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full"><Clock className="w-3 h-3" />Pending</span>;
  if (b.paymentMethod === "cash_on_boarding")
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full"><Wallet className="w-3 h-3" />Cash</span>;
  const provider = b.paymentProvider || b.paymentMethod || "Card";
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full capitalize"><CreditCard className="w-3 h-3" />{provider}</span>;
};

// ─── Seat Map ─────────────────────────────────────────────────────────────────

const SeatMap: FC<{
  bus:      Bus;
  schedule: Schedule;
  bookings: Booking[];
  route?:   Route;
  onSeatClick: (b: Booking) => void;
}> = ({ bus, schedule, bookings, route, onSeatClick }) => {
  const cfg      = SEAT_CONFIGS[(bus.busType?.toLowerCase() ?? "standard")] ?? SEAT_CONFIGS.standard;
  const capacity = bus.capacity ?? 40;
  const booked   = bookings.reduce((n, b) => n + (b.seatNumbers?.length ?? 0), 0);
  const fill     = capacity > 0 ? (booked / capacity) * 100 : 0;

  // Build seat grid
  const rows = useMemo(() => {
    const grid: (string | null)[][] = [];
    let n = 1;
    while (n <= capacity) {
      const row: (string | null)[] = [];
      for (let c = 0; c < cfg.cols && n <= capacity; c++) {
        row.push(`${Math.ceil(n / cfg.cols)}${cfg.labels[c]}`);
        n++;
      }
      while (row.length < cfg.cols) row.push(null);
      grid.push(row);
    }
    return grid;
  }, [capacity, cfg]);

  const seatMap = useMemo(() => {
    const m = new Map<string, Booking>();
    bookings.forEach(b => b.seatNumbers?.forEach((s: string) => m.set(s, b)));
    return m;
  }, [bookings]);

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-slate-50 to-blue-50 border-b">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg"><BusIcon className="w-5 h-5 text-white" /></div>
            <div>
              <p className="font-bold text-gray-900">{bus.licensePlate}</p>
              <p className="text-xs text-gray-500 capitalize">{bus.busType} · {capacity} seats</p>
            </div>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold text-gray-900">{fmtTime(toDate(schedule.departureDateTime))}</p>
            <p className="text-xs text-gray-500">{fmtDate(toDate(schedule.departureDateTime))}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: "Booked",    value: booked,            cls: "text-red-600"   },
            { label: "Free",      value: capacity - booked, cls: "text-green-600" },
            { label: "Fill rate", value: `${fill.toFixed(0)}%`, cls: "text-blue-600" },
          ].map(({ label, value, cls }) => (
            <div key={label} className="bg-white rounded-lg p-2 text-center border">
              <p className={`text-xl font-bold ${cls}`}>{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5">
          <div className={`h-1.5 rounded-full transition-all ${fill > 75 ? "bg-red-500" : fill > 50 ? "bg-amber-400" : "bg-green-500"}`}
            style={{ width: `${fill}%` }} />
        </div>
      </div>

      {/* Grid */}
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-center mb-5">
          <div className="px-4 py-1.5 bg-gray-800 rounded-full text-white text-xs font-medium">
            🚗 Driver
          </div>
        </div>
        <div className="max-w-xs mx-auto space-y-1.5">
          {rows.map((row, ri) => (
            <div key={ri} className="flex justify-center gap-1.5">
              {row.map((seat, ci) => {
                if (!seat) return <div key={ci} className="w-11 h-11" />;
                const booking = seatMap.get(seat);
                const pax     = booking?.passengerDetails?.find((p: any) => p.seatNumber === seat);
                const seg     = booking ? passengerSegment(booking, route) : null;
                return (
                  <button key={ci}
                    disabled={!booking}
                    onClick={() => booking && onSeatClick(booking)}
                    title={seg ? `${pax?.name ?? "Passenger"} · ${seg.from} → ${seg.to}` : "Available"}
                    className={`w-11 h-11 rounded-lg text-xs font-bold border-2 transition-all ${
                      booking
                        ? "bg-red-50 border-red-400 text-red-700 hover:bg-red-100 hover:scale-105 cursor-pointer"
                        : "bg-gray-50 border-gray-200 text-gray-400 cursor-default"
                    }`}>
                    {seat}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-6 mt-6 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-gray-50 border-2 border-gray-200 inline-block" />Available</span>
          <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-red-50 border-2 border-red-400 inline-block" />Booked</span>
        </div>
      </div>
    </div>
  );
};

// ─── Booking Detail Modal ─────────────────────────────────────────────────────

const BookingDetailModal: FC<{
  booking:     Booking;
  schedule?:   Schedule;
  route?:      Route;
  isAdmin:     boolean;
  actionLoading: string | null;
  reminderLoading: string | null;
  onConfirm:   (id: string) => void;
  onCancel:    (id: string) => void;
  onReminder:  (b: Booking) => void;
  onClose:     () => void;
}> = ({ booking, schedule, route, isAdmin, actionLoading, reminderLoading, onConfirm, onCancel, onReminder, onClose }) => {
  const seg     = passengerSegment(booking, route);
  const partial = isSegmentBooking(booking, route);
  const dep     = schedule ? toDate(schedule.departureDateTime) : null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
        {/* Handle */}
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        <div className="p-5 border-b flex items-start justify-between">
          <div>
            <p className="font-bold text-gray-900 text-lg">{booking.bookingReference ?? booking.id.slice(0, 8)}</p>
            <div className="flex gap-2 mt-1 flex-wrap">
              <StatusBadge status={booking.bookingStatus} />
              <PaymentBadge booking={booking} />
              {partial && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">
                  <ArrowRight className="w-3 h-3" />Segment
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Journey */}
          <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Journey</p>
            <div className="flex items-center gap-2 font-semibold text-gray-900">
              <MapPin className="w-4 h-4 text-blue-500 shrink-0" />
              {seg.from}
              <ArrowRight className="w-4 h-4 text-gray-400 shrink-0" />
              {seg.to}
            </div>
            {partial && route && (
              <p className="text-xs text-gray-400 mt-1">Full route: {route.origin} → {route.destination}</p>
            )}
            {dep && (
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {fmtDate(dep)} at {fmtTime(dep)}
              </p>
            )}
          </div>

          {/* Passengers */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">
              Passengers ({booking.passengerDetails?.length ?? 0})
            </p>
            <div className="space-y-2 max-h-44 overflow-y-auto">
              {booking.passengerDetails?.map((pax: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm text-gray-900">{pax.name}</p>
                    <p className="text-xs text-gray-500">
                      Age {pax.age}{pax.gender || pax.sex ? ` · ${pax.gender ?? pax.sex}` : ""}
                      {pax.contactNumber && ` · ${pax.contactNumber}`}
                    </p>
                  </div>
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-mono rounded">
                    {pax.seatNumber}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Payment */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-500 mb-1">Amount</p>
              <p className="text-xl font-bold text-gray-900">MWK {booking.totalAmount?.toLocaleString() ?? "0"}</p>
              {partial && (booking as any).pricePerPerson && (
                <p className="text-xs text-gray-400">
                  MWK {(booking as any).pricePerPerson.toLocaleString()} × {booking.passengerDetails?.length ?? 1}
                </p>
              )}
            </div>
            <div className="p-3 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-500 mb-1">Payment</p>
              <PaymentBadge booking={booking} />
            </div>
          </div>

          {/* Refund notice — admin only */}
          {isAdmin && booking.bookingStatus === "cancelled" && booking.paymentStatus === "paid" && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800">
                <p className="font-semibold">Refund required</p>
                <p>This booking was cancelled after payment. Initiate a refund from your payment provider dashboard.</p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-5 border-t flex gap-2 flex-wrap">
          {booking.bookingStatus === "pending" && (
            <button
              onClick={() => { onConfirm(booking.id); onClose(); }}
              disabled={actionLoading === booking.id}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium disabled:opacity-50">
              {actionLoading === booking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Confirm
            </button>
          )}
          {booking.paymentStatus === "pending" && (
            <button
              onClick={() => { onReminder(booking); onClose(); }}
              disabled={reminderLoading === booking.id}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl text-sm font-medium disabled:opacity-50">
              {reminderLoading === booking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
              Remind
            </button>
          )}
          {(booking.bookingStatus === "pending" || booking.bookingStatus === "confirmed") && (
            <button
              onClick={() => { onCancel(booking.id); onClose(); }}
              disabled={actionLoading === booking.id}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium disabled:opacity-50">
              {actionLoading === booking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const BookingsTab: FC<BookingsTabProps> = ({
  schedules, routes, buses, companyId, user, userProfile,
}) => {
  const { success, error } = useAppToast();
  const isAdmin = userProfile?.role === "company_admin" || userProfile?.role === "super_admin";

  const [bookings,        setBookings]        = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [selectedDate,    setSelectedDate]    = useState(todayStr());
  const [statusFilter,    setStatusFilter]    = useState<FilterStatus>("all");
  const [search,          setSearch]          = useState("");
  const [viewMode,        setViewMode]        = useState<ViewMode>("list");
  const [pageIndex,       setPageIndex]       = useState(0);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [actionLoading,   setActionLoading]   = useState<string | null>(null);
  const [reminderLoading, setReminderLoading] = useState<string | null>(null);

  const PAGE_SIZE = 12;

  // ── Operator scope: only schedules this operator created ─────────────────
  const scopedScheduleIds = useMemo(() => {
    if (isAdmin) return null; // null = all schedules for the company
    return schedules
      .filter(s => s.createdBy === user?.uid && s.status !== "archived")
      .map(s => s.id);
  }, [schedules, user?.uid, isAdmin]);

  // ── Realtime bookings listener ────────────────────────────────────────────
  // Only listens to bookings for active (non-archived) schedules.
  // When a schedule archives, its bookings drop out naturally.
  useEffect(() => {
    if (!companyId) return;

    // Operator with no schedules yet — nothing to listen to
    if (!isAdmin && scopedScheduleIds !== null && scopedScheduleIds.length === 0) {
      setBookings([]);
      setLoadingBookings(false);
      return;
    }

    setLoadingBookings(true);

    const activeScheduleIds = isAdmin
      ? schedules.filter(s => s.status !== "archived").map(s => s.id)
      : scopedScheduleIds ?? [];

    // Firestore `in` max is 30 — chunk if needed
    if (activeScheduleIds.length === 0) {
      setBookings([]);
      setLoadingBookings(false);
      return;
    }

    const chunks: string[][] = [];
    for (let i = 0; i < activeScheduleIds.length; i += 30)
      chunks.push(activeScheduleIds.slice(i, i + 30));

    const combined = new Map<string, Booking[]>();
    const unsubs = chunks.map((chunk, ci) => {
      const q = query(
        collection(db, "bookings"),
        where("companyId",  "==", companyId),
        where("scheduleId", "in", chunk),
        orderBy("createdAt", "desc"),
      );
      return onSnapshot(q, snap => {
        combined.set(String(ci), snap.docs.map(d => ({
          id: d.id,
          ...d.data(),
          createdAt: toDate(d.data().createdAt),
          updatedAt: toDate(d.data().updatedAt),
        } as Booking)));
        setBookings(Array.from(combined.values()).flat());
        setLoadingBookings(false);
      }, err => {
        console.warn("[BookingsTab] snapshot error:", err.message);
        setLoadingBookings(false);
      });
    });

    return () => unsubs.forEach(u => u());
  // scopedScheduleIds is derived from schedules — re-run when schedules change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, isAdmin, JSON.stringify(scopedScheduleIds)]);

  // ── Date-filtered bookings (the core view) ────────────────────────────────
  // A booking belongs to a date based on the departure date of its schedule.
  const schedulesByDate = useMemo(() => {
    const map = new Map<string, Set<string>>(); // date-str → Set<scheduleId>
    schedules.forEach(s => {
      if (s.status === "archived") return;
      const dateStr = toDate(s.departureDateTime).toISOString().split("T")[0];
      if (!map.has(dateStr)) map.set(dateStr, new Set());
      map.get(dateStr)!.add(s.id);
    });
    return map;
  }, [schedules]);

  const scheduleIdsForDate = useMemo(
    () => schedulesByDate.get(selectedDate) ?? new Set<string>(),
    [schedulesByDate, selectedDate],
  );

  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      if (!b || !scheduleIdsForDate.has(b.scheduleId)) return false;

      if (statusFilter === "confirmed" && !(b.bookingStatus === "confirmed" && b.paymentStatus === "paid"))   return false;
      if (statusFilter === "pending"   && !(b.bookingStatus === "pending"   || b.paymentStatus === "pending")) return false;
      if (statusFilter === "cancelled" && b.bookingStatus !== "cancelled")                                     return false;

      if (search.trim()) {
        const q   = search.toLowerCase();
        const sc  = schedules.find(s => s.id === b.scheduleId);
        const rt  = routes.find(r => r.id === sc?.routeId);
        const seg = passengerSegment(b, rt);
        const hit =
          b.bookingReference?.toLowerCase().includes(q) ||
          b.passengerDetails?.some((p: any) => p.name?.toLowerCase().includes(q) || p.contactNumber?.includes(q)) ||
          seg.from.toLowerCase().includes(q) ||
          seg.to.toLowerCase().includes(q);
        if (!hit) return false;
      }

      return true;
    }).sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime());
  }, [bookings, scheduleIdsForDate, statusFilter, search, schedules, routes]);

  // Reset page when filters change
  useEffect(() => { setPageIndex(0); }, [selectedDate, statusFilter, search]);

  const totalPages    = Math.max(1, Math.ceil(filteredBookings.length / PAGE_SIZE));
  const paginatedRows = filteredBookings.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE);

  // Stats — for the selected date
  const stats = useMemo(() => ({
    total:     filteredBookings.length,
    confirmed: filteredBookings.filter(b => b.bookingStatus === "confirmed" && b.paymentStatus === "paid").length,
    pending:   filteredBookings.filter(b => b.bookingStatus === "pending" || b.paymentStatus === "pending").length,
    cancelled: filteredBookings.filter(b => b.bookingStatus === "cancelled").length,
    revenue:   filteredBookings.filter(b => b.paymentStatus === "paid").reduce((n, b) => n + (b.totalAmount ?? 0), 0),
  }), [filteredBookings]);

  // Grouped by schedule for seat view
  const bySchedule = useMemo(() => {
    const map = new Map<string, Booking[]>();
    filteredBookings.forEach(b => {
      if (!map.has(b.scheduleId)) map.set(b.scheduleId, []);
      map.get(b.scheduleId)!.push(b);
    });
    return map;
  }, [filteredBookings]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleConfirm = useCallback(async (bookingId: string) => {
    setActionLoading(bookingId);
    try {
      const patch = { bookingStatus: "confirmed", confirmedDate: new Date(), updatedAt: new Date() };
      await updateDoc(doc(db, "bookings", bookingId), patch);
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, ...patch } as Booking : b));
      success("Confirmed", "Booking confirmed successfully");
    } catch (e: any) { error("Error", e.message); }
    finally { setActionLoading(null); }
  }, [success, error]);

  const handleCancel = useCallback(async (bookingId: string) => {
    setActionLoading(bookingId);
    try {
      const patch = { bookingStatus: "cancelled", cancellationDate: new Date(), updatedAt: new Date() };
      await updateDoc(doc(db, "bookings", bookingId), patch);
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, ...patch } as Booking : b));
      success("Cancelled", "Booking cancelled");
    } catch (e: any) { error("Error", e.message); }
    finally { setActionLoading(null); }
  }, [success, error]);

  const handleReminder = useCallback(async (booking: Booking) => {
    setReminderLoading(booking.id);
    try {
      await addDoc(collection(db, "reminders"), {
        bookingId:        booking.id,
        bookingReference: booking.bookingReference ?? booking.id,
        companyId:        booking.companyId,
        userId:           (booking as any).userId ?? null,
        passengerEmail:   booking.passengerDetails?.[0]?.email ?? null,
        contactPhone:     (booking as any).contactPhone ?? null,
        type:             "payment_reminder",
        status:           "queued",
        sentBy:           user?.uid ?? "system",
        sentAt:           serverTimestamp(),
      });
      success("Reminder queued", `Sent for ${booking.bookingReference ?? booking.id.slice(0, 8)}`);
    } catch (e: any) { error("Error", e.message); }
    finally { setReminderLoading(null); }
  }, [user, success, error]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  if (loadingBookings) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading bookings…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Date + search bar */}
      <div className="bg-white rounded-xl border shadow-sm p-4 flex flex-col sm:flex-row gap-3">
        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, reference or stop…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        {selectedDate !== todayStr() && (
          <button
            onClick={() => setSelectedDate(todayStr())}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
            <RotateCcw className="w-4 h-4" />Today
          </button>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {([
          { key: "all",       label: "Total",     value: stats.total,     cls: "text-gray-900"   },
          { key: "confirmed", label: "Confirmed", value: stats.confirmed, cls: "text-green-600"  },
          { key: "pending",   label: "Pending",   value: stats.pending,   cls: "text-yellow-600" },
          { key: "cancelled", label: "Cancelled", value: stats.cancelled, cls: "text-red-600"    },
          { key: null,        label: "Revenue",   value: `MWK ${(stats.revenue / 1000).toFixed(1)}k`, cls: "text-blue-700" },
        ] as const).map(({ key, label, value, cls }) => (
          <button
            key={label}
            onClick={() => key && setStatusFilter(key as FilterStatus)}
            disabled={!key}
            className={`p-3 sm:p-4 bg-white rounded-xl border-2 transition-all text-center ${
              key && statusFilter === key
                ? "border-blue-500 bg-blue-50"
                : key ? "border-gray-200 hover:border-gray-300" : "border-gray-100 cursor-default"
            }`}>
            <p className={`text-xl sm:text-2xl font-bold ${cls}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between gap-3">
        {/* Status filter pills */}
        <div className="flex gap-1.5 flex-wrap">
          {(["all", "confirmed", "pending", "cancelled"] as const).map(f => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                statusFilter === f ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}>
              {f}
            </button>
          ))}
        </div>
        {/* View toggle */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg shrink-0">
          <button onClick={() => setViewMode("list")}
            className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-white shadow text-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
            <ListIcon className="w-4 h-4" />
          </button>
          <button onClick={() => setViewMode("seats")}
            className={`p-1.5 rounded-md transition-colors ${viewMode === "seats" ? "bg-white shadow text-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Info: past-schedule bookings live in reports */}
      {scheduleIdsForDate.size === 0 && (
        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">
            No active schedules on {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-MW", { weekday: "long", day: "numeric", month: "long" })}.
            Completed trip summaries are in the <strong>Reports</strong> tab on the Schedules page.
          </p>
        </div>
      )}

      {/* ─── LIST VIEW ───────────────────────────────────────────────────── */}
      {viewMode === "list" && scheduleIdsForDate.size > 0 && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {["Ref", "Passenger", "Journey", "Seats", "Amount", "Status", "Actions"].map(h => (
                    <th key={h} className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide ${["Journey", "Amount"].includes(h) ? "hidden md:table-cell" : ""}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">
                      No bookings match your filters
                    </td>
                  </tr>
                ) : paginatedRows.map(booking => {
                  const sc      = schedules.find(s => s.id === booking.scheduleId);
                  const route   = routes.find(r => r.id === sc?.routeId);
                  const seg     = passengerSegment(booking, route);
                  const partial = isSegmentBooking(booking, route);
                  const busy    = actionLoading === booking.id;

                  return (
                    <tr key={booking.id} className="hover:bg-gray-50/50 transition-colors">
                      {/* Ref */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold text-gray-800 bg-gray-100 px-1.5 py-0.5 rounded">
                          {booking.bookingReference ?? booking.id.slice(0, 8)}
                        </span>
                      </td>

                      {/* Passenger */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate text-sm">
                              {booking.passengerDetails?.[0]?.name ?? "N/A"}
                            </p>
                            {booking.passengerDetails?.[0]?.contactNumber && (
                              <p className="text-xs text-gray-400 truncate">
                                {booking.passengerDetails[0].contactNumber}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Journey */}
                      <td className="hidden md:table-cell px-4 py-3">
                        <div className="flex items-center gap-1 text-sm text-gray-700">
                          <span>{seg.from}</span>
                          <ArrowRight className="w-3 h-3 text-gray-400 shrink-0" />
                          <span>{seg.to}</span>
                          {partial && (
                            <span className="ml-1 px-1.5 py-0.5 bg-orange-100 text-orange-600 text-[10px] rounded-full font-medium">seg</span>
                          )}
                        </div>
                        {sc && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {fmtTime(toDate(sc.departureDateTime))}
                          </p>
                        )}
                      </td>

                      {/* Seats */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {booking.seatNumbers?.slice(0, 3).map((s: string, i: number) => (
                            <span key={i} className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-mono rounded">{s}</span>
                          ))}
                          {(booking.seatNumbers?.length ?? 0) > 3 && (
                            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">+{booking.seatNumbers!.length - 3}</span>
                          )}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="hidden md:table-cell px-4 py-3 font-medium text-gray-900 text-sm">
                        MWK {booking.totalAmount?.toLocaleString() ?? "0"}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <StatusBadge status={booking.bookingStatus} />
                          <PaymentBadge booking={booking} />
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          {booking.bookingStatus === "pending" && (
                            <button onClick={() => handleConfirm(booking.id)} disabled={busy} title="Confirm"
                              className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 transition-colors">
                              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          {booking.paymentStatus === "pending" && (
                            <button onClick={() => handleReminder(booking)} disabled={reminderLoading === booking.id} title="Send reminder"
                              className="p-1.5 border border-amber-300 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg disabled:opacity-50 transition-colors">
                              {reminderLoading === booking.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          {(booking.bookingStatus === "pending" || booking.bookingStatus === "confirmed") && (
                            <button onClick={() => handleCancel(booking.id)} disabled={busy} title="Cancel"
                              className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 transition-colors">
                              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          <button onClick={() => setSelectedBooking(booking)} title="View details"
                            className="p-1.5 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t bg-gray-50 flex items-center justify-between text-sm">
              <p className="text-gray-500 text-xs">
                {pageIndex * PAGE_SIZE + 1}–{Math.min((pageIndex + 1) * PAGE_SIZE, filteredBookings.length)} of {filteredBookings.length}
              </p>
              <div className="flex gap-1">
                <button onClick={() => setPageIndex(p => Math.max(0, p - 1))} disabled={pageIndex === 0}
                  className="p-1.5 hover:bg-gray-200 rounded-lg disabled:opacity-40">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pg = Math.max(0, Math.min(pageIndex - 2 + i, totalPages - 5 + i));
                  return (
                    <button key={pg} onClick={() => setPageIndex(pg)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium ${pageIndex === pg ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                      {pg + 1}
                    </button>
                  );
                })}
                <button onClick={() => setPageIndex(p => Math.min(totalPages - 1, p + 1))} disabled={pageIndex === totalPages - 1}
                  className="p-1.5 hover:bg-gray-200 rounded-lg disabled:opacity-40">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── SEAT MAP VIEW ───────────────────────────────────────────────── */}
      {viewMode === "seats" && (
        <div className="space-y-6">
          {bySchedule.size === 0 ? (
            <div className="bg-white rounded-xl border p-12 text-center">
              <LayoutGrid className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-sm">No bookings to display for this date</p>
            </div>
          ) : Array.from(bySchedule.entries()).map(([scheduleId, schBookings]) => {
            const sc    = schedules.find(s => s.id === scheduleId);
            const bus   = buses.find(b => b.id === sc?.busId);
            const route = routes.find(r => r.id === sc?.routeId);
            if (!sc || !bus) return null;
            const segCount = schBookings.filter(b => isSegmentBooking(b, route)).length;
            return (
              <div key={scheduleId} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {route?.origin ?? "?"} → {route?.destination ?? "?"}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {schBookings.length} booking{schBookings.length !== 1 ? "s" : ""}
                      {segCount > 0 && ` · ${segCount} partial segment${segCount !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                </div>
                <SeatMap
                  bus={bus} schedule={sc} bookings={schBookings}
                  route={route} onSeatClick={setSelectedBooking}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* ─── DETAIL MODAL ────────────────────────────────────────────────── */}
      {selectedBooking && (() => {
        const sc    = schedules.find(s => s.id === selectedBooking.scheduleId);
        const route = routes.find(r => r.id === sc?.routeId);
        return (
          <BookingDetailModal
            booking={selectedBooking}
            schedule={sc}
            route={route}
            isAdmin={isAdmin}
            actionLoading={actionLoading}
            reminderLoading={reminderLoading}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            onReminder={handleReminder}
            onClose={() => setSelectedBooking(null)}
          />
        );
      })()}
    </div>
  );
};

export default BookingsTab;