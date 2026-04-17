"use client";

import { FC, useState, useMemo, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import * as dbActions from "@/lib/actions/db.actions";
import { useAppToast } from "@/contexts/ToastContext";
import { Booking, Schedule, Bus, Route } from "@/types";
import {
  Search, Check, X, Clock, Users, MapPin, Calendar,
  Eye, AlertTriangle, Bus as BusIcon,
  List as ListIcon, LayoutGrid, Loader2, ChevronLeft,
  ChevronRight, User, RotateCcw, Wallet, CreditCard,
  ArrowRight, Bell, Info, Download, CheckSquare,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BookingsTabProps {
  schedules:   Schedule[];
  routes:      Route[];
  buses:       Bus[];
  companyId:   string;
  user:        any;
  userProfile: any;
  isAdmin?:    boolean;
}

type ViewMode     = "list" | "seats";
type FilterStatus = "all" | "confirmed" | "pending" | "cancelled";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toDate = (v: any): Date => {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  return new Date(v);
};

const todayStr = () => new Date().toISOString().split("T")[0];
const fmtTime  = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const fmtDate  = (d: Date) => d.toLocaleDateString("en-MW", { day: "numeric", month: "short", year: "numeric" });
const fmt      = (n: number) => n.toLocaleString("en-MW");

const passengerName = (b: Booking) => b.passengerDetails?.[0]?.name ?? "Passenger";

function passengerSegment(booking: Booking, route?: Route) {
  const b = booking as any;
  if (b.originStopName && b.destinationStopName)
    return { from: b.originStopName as string, to: b.destinationStopName as string };
  if (b.originStopId && b.destinationStopId && route?.stops) {
    const name = (id: string) => {
      if (id === "__origin__")      return route.origin;
      if (id === "__destination__") return route.destination;
      return route.stops?.find((s: any) => s.id === id)?.name ?? "?";
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

// ─── Seat layout ──────────────────────────────────────────────────────────────

const SEAT_CONFIGS: Record<string, { cols: number; labels: string[] }> = {
  standard: { cols: 4, labels: ["A","B","C","D"] },
  luxury:   { cols: 3, labels: ["A","B","C"]     },
  sleeper:  { cols: 3, labels: ["A","B","C"]     },
  express:  { cols: 4, labels: ["A","B","C","D"] },
  minibus:  { cols: 3, labels: ["A","B","C"]     },
  economy:  { cols: 4, labels: ["A","B","C","D"] },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const BookingStatusBadge: FC<{ booking: Booking }> = ({ booking }) => {
  const bs = booking.bookingStatus;
  const ps = booking.paymentStatus;

  // Combine booking + payment into one clear label
  if (bs === "cancelled")
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700"><X className="w-3 h-3" />Cancelled</span>;

  if (bs === "confirmed" && ps === "paid")
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700"><Check className="w-3 h-3" />Confirmed · Paid</span>;

  if (bs === "confirmed" && ps !== "paid")
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700"><AlertTriangle className="w-3 h-3" />Confirmed · Unpaid</span>;

  if (bs === "pending" && ps === "paid")
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700"><Clock className="w-3 h-3" />Pending · Paid</span>;

  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700"><Clock className="w-3 h-3" />Pending</span>;
};

const PaymentMethodBadge: FC<{ booking: Booking }> = ({ booking }) => {
  const b = booking as any;
  if (b.paymentMethod === "cash_on_boarding")
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-600 text-xs rounded-full border border-green-200"><Wallet className="w-3 h-3" />Cash</span>;
  if (booking.paymentStatus === "paid") {
    const provider = b.paymentProvider || b.paymentMethod || "Online";
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full border border-blue-200 capitalize"><CreditCard className="w-3 h-3" />{provider}</span>;
  }
  return null;
};

// ─── Seat Map ─────────────────────────────────────────────────────────────────

const SeatMap: FC<{
  bus: Bus; schedule: Schedule; bookings: Booking[]; route?: Route;
  onSeatClick: (b: Booking) => void;
}> = ({ bus, schedule, bookings, route, onSeatClick }) => {
  const cfg      = SEAT_CONFIGS[bus.busType?.toLowerCase() ?? "standard"] ?? SEAT_CONFIGS.standard;
  const capacity = bus.capacity ?? 40;
  const booked   = bookings.reduce((n, b) => n + (b.seatNumbers?.length ?? 0), 0);
  const fill     = capacity > 0 ? (booked / capacity) * 100 : 0;

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
    <div className="bg-white rounded-2xl border overflow-hidden">
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-xl"><BusIcon className="w-4 h-4 text-white" /></div>
            <div>
              <p className="font-bold text-gray-900 text-sm">{bus.licensePlate}</p>
              <p className="text-xs text-gray-500 capitalize">{bus.busType} · {capacity} seats</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-semibold text-gray-900 text-sm">{fmtTime(toDate(schedule.departureDateTime))}</p>
            <p className="text-xs text-gray-400">{fmtDate(toDate(schedule.departureDateTime))}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: "Booked",  value: booked,            color: "text-red-600"   },
            { label: "Free",    value: capacity - booked, color: "text-green-600" },
            { label: "Fill %",  value: `${fill.toFixed(0)}%`, color: "text-blue-600" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl p-2 text-center border">
              <p className={`text-lg font-bold ${color}`}>{value}</p>
              <p className="text-[10px] text-gray-400">{label}</p>
            </div>
          ))}
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5">
          <div className={`h-1.5 rounded-full transition-all ${fill > 75 ? "bg-red-500" : fill > 50 ? "bg-amber-400" : "bg-green-500"}`}
            style={{ width: `${fill}%` }} />
        </div>
      </div>

      <div className="p-4">
        <div className="flex justify-center mb-4">
          <span className="px-4 py-1 bg-gray-800 rounded-full text-white text-xs font-medium">🚌 Driver</span>
        </div>
        <div className="max-w-xs mx-auto space-y-1.5">
          {rows.map((row, ri) => (
            <div key={ri} className="flex justify-center gap-1.5">
              {row.map((seat, ci) => {
                if (!seat) return <div key={ci} className="w-10 h-10" />;
                const booking = seatMap.get(seat);
                const pax = booking?.passengerDetails?.find((p: any) => p.seatNumber === seat);
                const seg = booking ? passengerSegment(booking, route) : null;
                return (
                  <button key={ci}
                    disabled={!booking}
                    onClick={() => booking && onSeatClick(booking)}
                    title={seg ? `${pax?.name ?? "Passenger"} · ${seg.from} → ${seg.to}` : "Available"}
                    className={`w-10 h-10 rounded-lg text-[11px] font-bold border-2 transition-all ${
                      booking
                        ? "bg-red-50 border-red-400 text-red-700 hover:bg-red-100 hover:scale-105 cursor-pointer"
                        : "bg-gray-50 border-gray-200 text-gray-300 cursor-default"
                    }`}>
                    {seat}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-6 mt-5 text-xs text-gray-400">
          <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-md border-2 border-gray-200 bg-gray-50 inline-block" />Available</span>
          <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-md border-2 border-red-400 bg-red-50 inline-block" />Booked</span>
        </div>
      </div>
    </div>
  );
};

// ─── Detail Modal ─────────────────────────────────────────────────────────────

const BookingDetailModal: FC<{
  booking: Booking; schedule?: Schedule; route?: Route; isAdmin: boolean;
  actionLoading: string | null; reminderLoading: string | null;
  onConfirm: (id: string) => void; onCancel: (id: string) => void;
  onReminder: (b: Booking) => void; onClose: () => void;
}> = ({ booking, schedule, route, isAdmin, actionLoading, reminderLoading, onConfirm, onCancel, onReminder, onClose }) => {
  const seg     = passengerSegment(booking, route);
  const partial = isSegmentBooking(booking, route);
  const dep     = schedule ? toDate(schedule.departureDateTime) : null;
  const name    = passengerName(booking);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="p-5 border-b flex items-start justify-between">
          <div>
            <p className="font-bold text-gray-900">{name}</p>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{booking.bookingReference ?? booking.id.slice(0, 8)}</p>
            <div className="flex gap-2 mt-2 flex-wrap">
              <BookingStatusBadge booking={booking} />
              <PaymentMethodBadge booking={booking} />
              {partial && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">
                  <ArrowRight className="w-3 h-3" />Segment
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Journey */}
          <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Journey</p>
            <div className="flex items-center gap-2 font-semibold text-gray-900 text-sm">
              <MapPin className="w-4 h-4 text-blue-500 shrink-0" />
              {seg.from}
              <ArrowRight className="w-4 h-4 text-gray-300 shrink-0" />
              {seg.to}
            </div>
            {partial && route && (
              <p className="text-xs text-gray-400 mt-1">Full route: {route.origin} → {route.destination}</p>
            )}
            {dep && (
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" />{fmtDate(dep)} at {fmtTime(dep)}
              </p>
            )}
          </div>

          {/* Passengers */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Passengers ({booking.passengerDetails?.length ?? 0})
            </p>
            <div className="space-y-2 max-h-44 overflow-y-auto">
              {booking.passengerDetails?.map((pax: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{pax.name}</p>
                    <p className="text-xs text-gray-400">
                      Age {pax.age}{(pax.gender || pax.sex) ? ` · ${pax.gender ?? pax.sex}` : ""}
                      {pax.contactNumber && ` · ${pax.contactNumber}`}
                    </p>
                  </div>
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-mono rounded-lg">{pax.seatNumber}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Payment summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gray-50 rounded-xl">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Amount</p>
              <p className="text-xl font-bold text-gray-900">MWK {fmt(booking.totalAmount ?? 0)}</p>
              {partial && (booking as any).pricePerPerson && (
                <p className="text-xs text-gray-400">MWK {fmt((booking as any).pricePerPerson)} × {booking.passengerDetails?.length ?? 1}</p>
              )}
            </div>
            <div className="p-3 bg-gray-50 rounded-xl">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Method</p>
              <PaymentMethodBadge booking={booking} />
              {booking.paymentStatus !== "paid" && (
                <span className="text-xs text-amber-600 font-medium mt-1 block">Unpaid</span>
              )}
            </div>
          </div>

          {/* Refund notice */}
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
            <button onClick={() => { onConfirm(booking.id); onClose(); }} disabled={actionLoading === booking.id}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors">
              {actionLoading === booking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Confirm Booking
            </button>
          )}
          {booking.paymentStatus === "pending" && booking.bookingStatus !== "cancelled" && (
            <button onClick={() => { onReminder(booking); onClose(); }} disabled={reminderLoading === booking.id}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors">
              {reminderLoading === booking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
              Send Reminder
            </button>
          )}
          {(booking.bookingStatus === "pending" || booking.bookingStatus === "confirmed") && (
            <button onClick={() => { onCancel(booking.id); onClose(); }} disabled={actionLoading === booking.id}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors">
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

const BookingsTab: FC<BookingsTabProps> = ({ schedules, routes, buses, companyId, user, userProfile, isAdmin: isAdminProp }) => {
  const { success, error } = useAppToast();
  const isAdmin = isAdminProp ?? (userProfile?.role === "company_admin" || userProfile?.role === "super_admin" || userProfile?.role === "admin");

  const [bookings,        setBookings]        = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [selectedDate,    setSelectedDate]    = useState<string>("");
  const [statusFilter,    setStatusFilter]    = useState<FilterStatus>("all");
  const [search,          setSearch]          = useState("");
  const [viewMode,        setViewMode]        = useState<ViewMode>("list");
  const [pageIndex,       setPageIndex]       = useState(0);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [actionLoading,   setActionLoading]   = useState<string | null>(null);
  const [reminderLoading, setReminderLoading] = useState<string | null>(null);
  const [selectedIds,     setSelectedIds]     = useState<Set<string>>(new Set());
  const [bulkLoading,     setBulkLoading]     = useState(false);

  const PAGE_SIZE = 12;

  // ── Operator scope ────────────────────────────────────────────────────────
  const scopedScheduleIds = useMemo(() => {
    if (isAdmin) return null;
    return schedules.filter(s => s.createdBy === user?.id && s.status !== "archived").map(s => s.id);
  }, [schedules, user?.id, isAdmin]);

  // ── Realtime listener ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!companyId) return;
    setLoadingBookings(true);

    const activeIds = isAdmin
      ? schedules.filter(s => s.status !== "archived").map(s => s.id)
      : scopedScheduleIds ?? [];

    const fetchBookings = async () => {
      let queryBuilder = supabase
        .from('Booking')
        .select('*')
        .eq('companyId', companyId);
        
      if (!isAdmin && activeIds.length > 0) {
        queryBuilder = queryBuilder.in('scheduleId', activeIds);
      }
      
      const { data, error: fetchError } = await queryBuilder.order('createdAt', { ascending: false });
      
      if (!fetchError && data) {
        setBookings(data.map(d => ({
          ...d,
          createdAt: new Date(d.createdAt),
          updatedAt: new Date(d.updatedAt),
        })) as Booking[]);
      }
      setLoadingBookings(false);
    };

    fetchBookings();

    const channel = supabase
      .channel('bookings-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Booking', filter: `companyId=eq.${companyId}` }, () => {
        fetchBookings();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [companyId, isAdmin, JSON.stringify(scopedScheduleIds), schedules]);

  // ── Date → schedule ids ───────────────────────────────────────────────────
  const schedulesByDate = useMemo(() => {
    const map = new Map<string, Set<string>>();
    schedules.forEach(s => {
      if (s.status === "archived") return;
      const ds = toDate(s.departureDateTime).toISOString().split("T")[0];
      if (!map.has(ds)) map.set(ds, new Set());
      map.get(ds)!.add(s.id);
    });
    return map;
  }, [schedules]);

  const scheduleIdsForDate = useMemo(
    () => schedulesByDate.get(selectedDate) ?? new Set<string>(),
    [schedulesByDate, selectedDate],
  );

  // ── Filtered bookings ─────────────────────────────────────────────────────
  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      if (!b) return false;
      if (selectedDate && !scheduleIdsForDate.has(b.scheduleId)) return false;
      if (statusFilter === "confirmed" && !(b.bookingStatus === "confirmed" && b.paymentStatus === "paid")) return false;
      if (statusFilter === "pending"   && !(b.bookingStatus === "pending" || b.paymentStatus === "pending")) return false;
      if (statusFilter === "cancelled" && b.bookingStatus !== "cancelled") return false;
      if (search.trim()) {
        const q  = search.toLowerCase();
        const sc = schedules.find(s => s.id === b.scheduleId);
        const rt = routes.find(r => r.id === sc?.routeId);
        const sg = passengerSegment(b, rt);
        const hit =
          b.bookingReference?.toLowerCase().includes(q) ||
          b.passengerDetails?.some((p: any) => p.name?.toLowerCase().includes(q) || p.contactNumber?.includes(q)) ||
          sg.from.toLowerCase().includes(q) || sg.to.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    }).sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime());
  }, [bookings, scheduleIdsForDate, statusFilter, search, schedules, routes]);

  useEffect(() => { setPageIndex(0); setSelectedIds(new Set()); }, [selectedDate, statusFilter, search]);

  const totalPages    = Math.max(1, Math.ceil(filteredBookings.length / PAGE_SIZE));
  const paginatedRows = filteredBookings.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:     filteredBookings.length,
    confirmed: filteredBookings.filter(b => b.bookingStatus === "confirmed" && b.paymentStatus === "paid").length,
    pending:   filteredBookings.filter(b => b.bookingStatus === "pending" || b.paymentStatus === "pending").length,
    cancelled: filteredBookings.filter(b => b.bookingStatus === "cancelled").length,
    revenue:   filteredBookings.filter(b => b.paymentStatus === "paid").reduce((n, b) => n + (b.totalAmount ?? 0), 0),
  }), [filteredBookings]);

  const bySchedule = useMemo(() => {
    const map = new Map<string, Booking[]>();
    filteredBookings.forEach(b => {
      if (!map.has(b.scheduleId)) map.set(b.scheduleId, []);
      map.get(b.scheduleId)!.push(b);
    });
    return map;
  }, [filteredBookings]);

  // Pending bookings on current page that can be confirmed
  const pendingOnPage = paginatedRows.filter(b => b.bookingStatus === "pending");

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleConfirm = useCallback(async (bookingId: string) => {
    setActionLoading(bookingId);
    const booking = bookings.find(b => b.id === bookingId);
    const name    = booking ? passengerName(booking) : "Booking";
    try {
      const result = await dbActions.updateBooking(bookingId, { 
        bookingStatus: "confirmed", 
        confirmedDate: new Date(), 
        updatedAt: new Date() 
      });
      if (!result.success) throw new Error(result.error);
      
      setBookings(prev => prev.map(b => b.id === bookingId ? result.data as unknown as Booking : b));
      success("Confirmed", `${name}'s booking confirmed`);
    } catch (e: any) { error("Error", e.message); }
    finally { setActionLoading(null); }
  }, [bookings, success, error]);

  const handleCancel = useCallback(async (bookingId: string) => {
    setActionLoading(bookingId);
    const booking = bookings.find(b => b.id === bookingId);
    const name    = booking ? passengerName(booking) : "Booking";
    try {
      const result = await dbActions.updateBooking(bookingId, { 
        bookingStatus: "cancelled", 
        cancellationDate: new Date(), 
        updatedAt: new Date() 
      });
      if (!result.success) throw new Error(result.error);

      setBookings(prev => prev.map(b => b.id === bookingId ? result.data as unknown as Booking : b));
      success("Cancelled", `${name}'s booking cancelled`);
    } catch (e: any) { error("Error", e.message); }
    finally { setActionLoading(null); }
  }, [bookings, success, error]);

  const handleReminder = useCallback(async (booking: Booking) => {
    setReminderLoading(booking.id);
    const name = passengerName(booking);
    try {
      const result = await dbActions.createNotification({
        userId: (booking as any).userId || 'system',
        title: "Payment Reminder",
        message: `Hi ${name}, please complete your payment for booking ${booking.bookingReference || booking.id.slice(0,8)}.`,
        type: "booking",
        data: {
          companyId: booking.companyId,
          read: false,
        }
      });
      if (!result.success) throw new Error(result.error);
      
      success("Reminder sent", `Payment reminder queued for ${name}`);
    } catch (e: any) { error("Error", e.message); }
    finally { setReminderLoading(null); }
  }, [user, success, error]);

  // ── Bulk confirm ───────────────────────────────────────────────────────────
  const handleBulkConfirm = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    let confirmed = 0;
    for (const id of selectedIds) {
      try {
        await dbActions.updateBooking(id, {
          bookingStatus: "confirmed", confirmedDate: new Date(), updatedAt: new Date(),
        });
      } catch { /* continue */ }
    }
    success("Bulk confirmed", `${confirmed} booking${confirmed !== 1 ? "s" : ""} confirmed`);
    setSelectedIds(new Set());
    setBulkLoading(false);
  }, [selectedIds, success]);

  // ── CSV export ─────────────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    const rows = filteredBookings.map(b => {
      const sc  = schedules.find(s => s.id === b.scheduleId);
      const rt  = routes.find(r => r.id === sc?.routeId);
      const seg = passengerSegment(b, rt);
      return [
        b.bookingReference ?? b.id.slice(0, 8),
        passengerName(b),
        b.passengerDetails?.[0]?.contactNumber ?? "",
        seg.from, seg.to,
        b.seatNumbers?.join(";") ?? "",
        b.totalAmount ?? 0,
        b.bookingStatus,
        b.paymentStatus,
        toDate(b.createdAt).toISOString(),
      ].join(",");
    });
    const csv  = ["Ref,Name,Phone,From,To,Seats,Amount,Booking Status,Payment Status,Created", ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `bookings-${selectedDate || 'latest'}.csv`; a.click();
    URL.revokeObjectURL(url);
    success("Export ready", `${filteredBookings.length} bookings exported`);
  }, [filteredBookings, schedules, routes, selectedDate, success]);

  // ─── RENDER ───────────────────────────────────────────────────────────────

  if (loadingBookings) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Loading bookings…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── Search + Controls Bar ── */}
      <div className="bg-white rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-gray-100 py-3 px-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex gap-4 w-full lg:w-auto flex-1 max-w-2xl">
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            className="border-none bg-gray-50 rounded-md px-3 py-2 text-sm font-bold text-gray-700 outline-none focus:ring-1 focus:ring-indigo-900 shrink-0" />
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search by name, reference or stop…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border-none bg-gray-50 rounded-md focus:ring-1 focus:ring-indigo-900 outline-none text-sm font-medium placeholder-gray-400" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedDate && (
            <button onClick={() => setSelectedDate("")}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors whitespace-nowrap">
              <X className="w-3.5 h-3.5" /> Clear Date
            </button>
          )}
          
          {/* Bulk confirm */}
          {selectedIds.size > 0 && (
            <button onClick={handleBulkConfirm} disabled={bulkLoading}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-xs font-bold disabled:opacity-50 transition-colors">
              {bulkLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckSquare className="w-3.5 h-3.5" />}
              Confirm {selectedIds.size}
            </button>
          )}
          {/* Select all pending */}
          {pendingOnPage.length > 0 && selectedIds.size === 0 && (
            <button onClick={() => setSelectedIds(new Set(pendingOnPage.map(b => b.id)))}
              className="flex items-center gap-1.5 px-3 py-2 text-[11px] uppercase tracking-wider font-bold text-gray-500 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors">
              <CheckSquare className="w-3 h-3" />
              Select Pending
            </button>
          )}
          
          <button onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors whitespace-nowrap">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          
          {/* View toggle */}
          <div className="flex gap-1 bg-gray-50 p-1 rounded-md border border-gray-100 ml-2">
            <button onClick={() => setViewMode("list")}
              className={`p-1.5 rounded transition-colors ${viewMode === "list" ? "bg-white shadow-sm text-indigo-900" : "text-gray-400 hover:text-gray-600"}`}>
              <ListIcon className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode("seats")}
              className={`p-1.5 rounded transition-colors ${viewMode === "seats" ? "bg-white shadow-sm text-indigo-900" : "text-gray-400 hover:text-gray-600"}`}>
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI & Revenue Forecast Area ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
         {/* Stats Cards */}
         {([
          { key: "all",       label: "TOTAL BOOKINGS",   value: String(stats.total),     icon: Users, iconColor: "text-indigo-900", iconBg: "bg-indigo-50" },
          { key: "confirmed", label: "CONFIRMED", value: String(stats.confirmed), icon: CheckSquare, iconColor: "text-green-700", iconBg: "bg-green-50" },
          { key: "pending",   label: "PENDING ASSIGNMENT",   value: String(stats.pending),   icon: Clock, iconColor: "text-amber-600", iconBg: "bg-amber-50" },
         ] as const).map(({ key, label, value, icon: Icon, iconColor, iconBg }) => (
          <button key={label} onClick={() => key && setStatusFilter(key as FilterStatus)} disabled={!key}
            className={`bg-white rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] p-5 relative overflow-hidden flex flex-col justify-between min-h-[140px] border transition-all text-left ${
              key && statusFilter === key ? "border-indigo-500 ring-1 ring-indigo-500/20" : "border-gray-100 hover:border-gray-200"
            }`}>
             <div className="flex justify-between items-start mb-3">
                <div className={`p-2 rounded-lg ${iconBg}`}>
                   <Icon className={`w-5 h-5 ${iconColor}`} />
                </div>
             </div>
             <div className="mt-auto">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
                <p className="text-2xl font-extrabold text-gray-900 leading-none">{value}</p>
             </div>
          </button>
         ))}

         {/* Revenue Forecast Card */}
         <div className="bg-gradient-to-br from-indigo-900 to-[#1e1b4b] rounded-xl p-5 text-white shadow-[0_8px_20px_-4px_rgba(49,46,129,0.4)] relative overflow-hidden flex flex-col justify-between min-h-[140px]">
            <div className="relative z-10 flex justify-between items-start mb-2">
               <div className="p-2 bg-white/10 rounded-lg backdrop-blur">
                 <Wallet className="w-5 h-5 text-indigo-200" />
               </div>
               <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-green-500/20 text-green-400 flex items-center gap-1"><ArrowRight className="w-3 h-3 -rotate-45"/> PROJ</span>
            </div>
            <div className="relative z-10 mt-auto">
               <p className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider mb-1">REVENUE FORECAST</p>
               <p className="text-2xl font-extrabold leading-none">MWK {fmt(stats.revenue + (stats.pending * 5000))}</p>
               <p className="text-xs font-medium text-indigo-400 mt-1.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span> Realized: MWK {fmt(stats.revenue)}
               </p>
            </div>
            {/* Background design */}
            <div className="absolute -right-4 -bottom-4 opacity-10">
              <Wallet className="w-32 h-32 shrink-0" />
            </div>
         </div>
      </div>

      {/* ── No bookings notice ── */}
      {filteredBookings.length === 0 && !loadingBookings && (
        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
          <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">
            {selectedDate 
              ? `No bookings found for the selected date.`
              : `No bookings found.`}
            Completed trips are in the <strong>Reports</strong> tab on the Schedules page.
          </p>
        </div>
      )}

      {/* ─── LIST VIEW ─────────────────────────────────────────────────── */}
      {viewMode === "list" && filteredBookings.length > 0 && (
        <div className="bg-white rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  {isAdmin && (
                    <th className="px-5 py-3 w-10">
                      <input type="checkbox"
                        checked={selectedIds.size === pendingOnPage.length && pendingOnPage.length > 0}
                        onChange={e => setSelectedIds(e.target.checked ? new Set(pendingOnPage.map(b => b.id)) : new Set())}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-600" />
                    </th>
                  )}
                  {["Ref", "Passenger", "Journey", "Seats", "Amount", "Status", "Actions"].map(h => (
                    <th key={h} className={`px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider ${["Journey","Amount"].includes(h) ? "hidden md:table-cell" : ""}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 8 : 7} className="px-4 py-14 text-center text-gray-300 text-sm">
                      No bookings match your filters
                    </td>
                  </tr>
                ) : paginatedRows.map(booking => {
                  const sc      = schedules.find(s => s.id === booking.scheduleId);
                  const route   = routes.find(r => r.id === sc?.routeId);
                  const seg     = passengerSegment(booking, route);
                  const partial = isSegmentBooking(booking, route);
                  const busy    = actionLoading === booking.id;
                  const isPending = booking.bookingStatus === "pending";
                  const isSelected = selectedIds.has(booking.id);

                  return (
                    <tr key={booking.id} className={`transition-colors ${isSelected ? "bg-blue-50" : "hover:bg-gray-50/50"}`}>
                      {/* Checkbox — pending only */}
                      {isAdmin && (
                        <td className="px-4 py-3">
                          {isPending && (
                            <input type="checkbox" checked={isSelected}
                              onChange={e => {
                                const next = new Set(selectedIds);
                                e.target.checked ? next.add(booking.id) : next.delete(booking.id);
                                setSelectedIds(next);
                              }}
                              className="rounded border-gray-300" />
                          )}
                        </td>
                      )}

                      {/* Ref */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-bold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
                          {booking.bookingReference ?? booking.id.slice(0, 8)}
                        </span>
                      </td>

                      {/* Passenger */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                            <User className="w-3.5 h-3.5 text-blue-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 truncate text-sm">{passengerName(booking)}</p>
                            {booking.passengerDetails?.[0]?.contactNumber && (
                              <p className="text-xs text-gray-400">{booking.passengerDetails[0].contactNumber}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Journey */}
                      <td className="hidden md:table-cell px-4 py-3">
                        <div className="flex items-center gap-1 text-sm text-gray-700">
                          <span className="truncate max-w-[80px]">{seg.from}</span>
                          <ArrowRight className="w-3 h-3 text-gray-300 shrink-0" />
                          <span className="truncate max-w-[80px]">{seg.to}</span>
                          {partial && <span className="ml-1 px-1 py-0.5 bg-orange-100 text-orange-600 text-[10px] rounded font-medium">seg</span>}
                        </div>
                        {sc && (
                          <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-400">
                            <Calendar className="w-3 h-3" />
                            <span>{fmtDate(toDate(sc.departureDateTime))} · {fmtTime(toDate(sc.departureDateTime))}</span>
                          </div>
                        )}
                      </td>

                      {/* Seats */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {booking.seatNumbers?.slice(0, 3).map((s: string, i: number) => (
                            <span key={i} className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-mono rounded-md">{s}</span>
                          ))}
                          {(booking.seatNumbers?.length ?? 0) > 3 && (
                            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-400 text-xs rounded-md">+{booking.seatNumbers!.length - 3}</span>
                          )}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="hidden md:table-cell px-4 py-3 font-semibold text-gray-900 text-sm whitespace-nowrap">
                        MWK {fmt(booking.totalAmount ?? 0)}
                      </td>

                      {/* Status — single combined badge */}
                      <td className="px-4 py-3">
                        <BookingStatusBadge booking={booking} />
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          {isPending && (
                            <button onClick={() => handleConfirm(booking.id)} disabled={busy} title="Confirm"
                              className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 transition-colors">
                              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          {booking.paymentStatus === "pending" && booking.bookingStatus !== "cancelled" && (
                            <button onClick={() => handleReminder(booking)} disabled={reminderLoading === booking.id} title="Send reminder"
                              className="p-1.5 border border-amber-200 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg disabled:opacity-50 transition-colors">
                              {reminderLoading === booking.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          {(isPending || booking.bookingStatus === "confirmed") && (
                            <button onClick={() => handleCancel(booking.id)} disabled={busy} title="Cancel"
                              className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 transition-colors">
                              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          <button onClick={() => setSelectedBooking(booking)} title="View details"
                            className="p-1.5 border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600 rounded-lg transition-colors">
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
            <div className="px-4 py-3 border-t bg-gray-50/50 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                {pageIndex * PAGE_SIZE + 1}–{Math.min((pageIndex + 1) * PAGE_SIZE, filteredBookings.length)} of {filteredBookings.length}
              </p>
              <div className="flex gap-1">
                <button onClick={() => setPageIndex(p => Math.max(0, p - 1))} disabled={pageIndex === 0}
                  className="p-1.5 hover:bg-gray-200 rounded-lg disabled:opacity-30 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const startPg = totalPages <= 5 ? 0 : Math.max(0, Math.min(pageIndex - 2, totalPages - 5));
                  const pg = startPg + i;
                  return (
                    <button key={pg} onClick={() => setPageIndex(pg)}
                      className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                        pageIndex === pg ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}>{pg + 1}</button>
                  );
                })}
                <button onClick={() => setPageIndex(p => Math.min(totalPages - 1, p + 1))} disabled={pageIndex === totalPages - 1}
                  className="p-1.5 hover:bg-gray-200 rounded-lg disabled:opacity-30 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── SEAT MAP VIEW ──────────────────────────────────────────────── */}
      {viewMode === "seats" && (
        <div className="space-y-6">
          {bySchedule.size === 0 ? (
            <div className="bg-white rounded-2xl border p-16 text-center">
              <LayoutGrid className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No bookings to display</p>
            </div>
          ) : Array.from(bySchedule.entries()).map(([scheduleId, schBookings]) => {
            const sc    = schedules.find(s => s.id === scheduleId);
            const bus   = buses.find(b => b.id === sc?.busId);
            const route = routes.find(r => r.id === sc?.routeId);
            if (!sc || !bus) return null;
            const segCount = schBookings.filter(b => isSegmentBooking(b, route)).length;
            return (
              <div key={scheduleId} className="space-y-3">
                <div>
                  <h3 className="font-bold text-gray-900">{route?.origin ?? "?"} → {route?.destination ?? "?"}</h3>
                  <p className="text-xs text-gray-400">{schBookings.length} booking{schBookings.length !== 1 ? "s" : ""}{segCount > 0 && ` · ${segCount} partial segment${segCount !== 1 ? "s" : ""}`}</p>
                </div>
                <SeatMap bus={bus} schedule={sc} bookings={schBookings} route={route} onSeatClick={setSelectedBooking} />
              </div>
            );
          })}
        </div>
      )}

      {/* ─── DETAIL MODAL ───────────────────────────────────────────────── */}
      {selectedBooking && (() => {
        const sc    = schedules.find(s => s.id === selectedBooking.scheduleId);
        const route = routes.find(r => r.id === sc?.routeId);
        return (
          <BookingDetailModal
            booking={selectedBooking} schedule={sc} route={route} isAdmin={isAdmin}
            actionLoading={actionLoading} reminderLoading={reminderLoading}
            onConfirm={handleConfirm} onCancel={handleCancel}
            onReminder={handleReminder} onClose={() => setSelectedBooking(null)}
          />
        );
      })()}
    </div>
  );
};

export default BookingsTab;
