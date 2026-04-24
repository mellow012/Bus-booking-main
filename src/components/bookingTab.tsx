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
  ArrowRight, Bell, Info, Download, CheckSquare, Activity,
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

  if (bs === "cancelled")
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-rose-50 text-rose-700 border border-rose-100"><X className="w-3 h-3" />Cancelled</span>;

  if (bs === "confirmed" && ps === "paid")
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-100"><Check className="w-3 h-3" />Confirmed · Paid</span>;

  if (bs === "confirmed" && ps !== "paid")
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-50 text-amber-700 border border-amber-100"><AlertTriangle className="w-3 h-3" />Confirmed · Unpaid</span>;

  if (bs === "pending" && ps === "paid")
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-700 border border-indigo-100"><Clock className="w-3 h-3" />Pending · Paid</span>;

  return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-50 text-amber-700 border border-amber-100"><Clock className="w-3 h-3" />Pending</span>;
};

const PaymentMethodBadge: FC<{ booking: Booking }> = ({ booking }) => {
  const b = booking as any;
  if (b.paymentMethod === "cash_on_boarding")
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-100"><Wallet className="w-3 h-3" />Cash</span>;
  if (booking.paymentStatus === "paid") {
    const provider = b.paymentProvider || b.paymentMethod || "Online";
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-700 border border-indigo-100"><CreditCard className="w-3 h-3" />{provider}</span>;
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
    <div className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden text-left h-full flex flex-col">
      <div className="p-5 sm:p-6 border-b bg-gray-50/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl shadow-md shadow-indigo-100"><BusIcon className="w-4 h-4 text-white" /></div>
            <div>
              <p className="font-black text-gray-900 text-sm tracking-tight uppercase">{bus.licensePlate}</p>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{bus.busType} · {capacity} seats</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-black text-gray-900 text-sm tracking-tight">{fmtTime(toDate(schedule.departureDateTime))}</p>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{fmtDate(toDate(schedule.departureDateTime))}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: "Booked",  value: booked,            color: "text-rose-600"   },
            { label: "Free",    value: capacity - booked, color: "text-emerald-600" },
            { label: "Fill %",  value: `${fill.toFixed(0)}%`, color: "text-indigo-600" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl p-2.5 text-center border border-gray-100 shadow-sm">
              <p className={`text-base sm:text-lg font-black ${color} tracking-tighter`}>{value}</p>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
            </div>
          ))}
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-1000 ${fill > 75 ? "bg-rose-500" : fill > 50 ? "bg-amber-400" : "bg-emerald-500"}`}
            style={{ width: `${fill}%` }} />
        </div>
      </div>

      <div className="p-5 sm:p-6 flex-1 overflow-y-auto max-h-[500px]">
        <div className="flex justify-center mb-6">
          <span className="px-5 py-1.5 bg-gray-900 rounded-xl text-white text-[10px] font-black uppercase tracking-widest shadow-lg">🚌 Driver</span>
        </div>
        <div className="max-w-[280px] mx-auto space-y-2">
          {rows.map((row, ri) => (
            <div key={ri} className="flex justify-center gap-2">
              {row.map((seat, ci) => {
                if (!seat) return <div key={ci} className="w-10 h-10 sm:w-12 sm:h-12" />;
                const booking = seatMap.get(seat);
                const pax = booking?.passengerDetails?.find((p: any) => p.seatNumber === seat);
                const seg = booking ? passengerSegment(booking, route) : null;
                return (
                  <button key={ci}
                    disabled={!booking}
                    onClick={() => booking && onSeatClick(booking)}
                    title={seg ? `${pax?.name ?? "Passenger"} · ${seg.from} → ${seg.to}` : "Available"}
                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl text-xs font-black border-2 transition-all duration-300 ${
                      booking
                        ? "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 hover:scale-110 cursor-pointer shadow-sm"
                        : "bg-gray-50 border-gray-100 text-gray-300 cursor-default"
                    }`}>
                    {seat}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-8 mt-8 text-[10px] font-black uppercase tracking-widest text-gray-400">
          <span className="flex items-center gap-2"><span className="w-4 h-4 rounded-lg border-2 border-gray-100 bg-gray-50 inline-block" />Free</span>
          <span className="flex items-center gap-2"><span className="w-4 h-4 rounded-lg border-2 border-rose-200 bg-rose-50 inline-block" />Booked</span>
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
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-[2.5rem] rounded-t-[2.5rem] max-h-[90vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom-10 duration-500 text-left">
        <div className="flex justify-center pt-4 sm:hidden">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="p-6 sm:p-8 border-b border-gray-50 flex items-start justify-between">
          <div>
            <p className="text-xl font-black text-gray-900 tracking-tight uppercase">{name}</p>
            <p className="text-[10px] font-black text-gray-400 tracking-widest mt-1">REF: {booking.bookingReference ?? booking.id.slice(0, 8)}</p>
            <div className="flex gap-2 mt-4 flex-wrap">
              <BookingStatusBadge booking={booking} />
              <PaymentMethodBadge booking={booking} />
              {partial && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-widest rounded-full border border-amber-100 shadow-sm">
                  <ArrowRight className="w-3 h-3" />Segment
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 bg-gray-50 hover:bg-gray-100 rounded-2xl text-gray-400 transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          {/* Journey */}
          <div className="p-5 bg-indigo-50/50 rounded-[2rem] border border-indigo-100">
            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-3">JOURNAL PATH</p>
            <div className="flex items-center gap-3 font-black text-gray-900 text-sm tracking-tight uppercase">
              <MapPin className="w-4 h-4 text-indigo-600 shrink-0" />
              {seg.from}
              <ArrowRight className="w-4 h-4 text-gray-300 shrink-0" />
              {seg.to}
            </div>
            {partial && route && (
              <p className="text-[10px] font-bold text-gray-400 mt-2 uppercase tracking-widest italic">Route Bound: {route.origin} → {route.destination}</p>
            )}
            {dep && (
              <div className="mt-4 flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-indigo-300" />
                  <span className="text-[10px] font-black text-gray-700 uppercase tracking-widest">{fmtDate(dep)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-indigo-300" />
                  <span className="text-[10px] font-black text-gray-700 uppercase tracking-widest">{fmtTime(dep)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Passengers */}
          <div>
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-4">MANIFEST ({booking.passengerDetails?.length ?? 0})</p>
            <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
              {booking.passengerDetails?.map((pax: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100 group hover:bg-white hover:border-indigo-100 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center text-[11px] font-black text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      {pax.seatNumber?.substring(0, 1)}
                    </div>
                    <div>
                      <p className="font-black text-gray-900 text-xs uppercase tracking-tight">{pax.name}</p>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                        {pax.gender || pax.sex || "Pax"} · {pax.contactNumber || "No Contact"}
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-black rounded-xl shadow-md shadow-indigo-100">{pax.seatNumber}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Payment summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-5 bg-gray-50/50 rounded-[1.5rem] border border-gray-100">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">EQUITY</p>
              <p className="text-xl font-black text-gray-900 tracking-tight">MWK {fmt(booking.totalAmount ?? 0)}</p>
            </div>
            <div className="p-5 bg-gray-50/50 rounded-[1.5rem] border border-gray-100">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">CHANNEL</p>
              <PaymentMethodBadge booking={booking} />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 sm:p-8 border-t border-gray-50 flex gap-3 flex-wrap">
          {booking.bookingStatus === "pending" && (
            <button onClick={() => { onConfirm(booking.id); onClose(); }} disabled={actionLoading === booking.id}
              className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-emerald-100 transition-all active:scale-95 disabled:opacity-50">
              {actionLoading === booking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Approve
            </button>
          )}
          {booking.paymentStatus === "pending" && booking.bookingStatus !== "cancelled" && (
            <button onClick={() => { onReminder(booking); onClose(); }} disabled={reminderLoading === booking.id}
              className="flex-1 flex items-center justify-center gap-3 px-6 py-4 border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50">
              {reminderLoading === booking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
              Alert
            </button>
          )}
          {(booking.bookingStatus === "pending" || booking.bookingStatus === "confirmed") && (
            <button onClick={() => { onCancel(booking.id); onClose(); }} disabled={actionLoading === booking.id}
              className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-rose-100 transition-all active:scale-95 disabled:opacity-50">
              {actionLoading === booking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
              Nullify
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
        .select('*, Payment(*)')
        .eq('companyId', companyId);
        
      if (!isAdmin && activeIds.length > 0) {
        queryBuilder = queryBuilder.in('scheduleId', activeIds);
      }
      
      const { data, error: fetchError } = await queryBuilder.order('createdAt', { ascending: false });
      
      if (!fetchError && data) {
        setBookings(data.map(d => ({
          ...d,
          paymentMethod: (d as any).Payment?.[0]?.paymentType || (d as any).Payment?.[0]?.provider || (d as any).paymentMethod || (d.paymentStatus === 'paid' ? 'cash' : 'Not specified'),
          transactionId: (d as any).Payment?.[0]?.transactionId || (d as any).transactionId,
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

  const bySchedule = useMemo(() => {
    const map = new Map<string, Booking[]>();
    filteredBookings.forEach(b => {
      if (!map.has(b.scheduleId)) map.set(b.scheduleId, []);
      map.get(b.scheduleId)!.push(b);
    });
    return map;
  }, [filteredBookings]);

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
      success("Approved", `${name}'s booking has been authorized.`);
    } catch (e: any) { error("Error", e.message); }
    finally { setActionLoading(null); }
  }, [bookings, success, error]);

  const handleCancel = useCallback(async (bookingId: string) => {
    if(!confirm("Nullify this transaction?")) return;
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
      success("Nullified", `${name}'s booking has been revoked.`);
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
      
      success("Reminder Dispatched", `Payment prompt sent to ${name}`);
    } catch (e: any) { error("Error", e.message); }
    finally { setReminderLoading(null); }
  }, [success, error]);

  const handleBulkConfirm = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    let confirmedCount = 0;
    for (const id of selectedIds) {
      try {
        const res = await dbActions.updateBooking(id, {
          bookingStatus: "confirmed", confirmedDate: new Date(), updatedAt: new Date(),
        });
        if(res.success) confirmedCount++;
      } catch { /* continue */ }
    }
    success("Batch Authorized", `${confirmedCount} transactions approved.`);
    setSelectedIds(new Set());
    setBulkLoading(false);
  }, [selectedIds, success]);

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
    success("Manifest Dispatched", `${filteredBookings.length} records exported.`);
  }, [filteredBookings, schedules, routes, selectedDate, success]);

  if (loadingBookings) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Synchronizing Manifests…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 px-2 sm:px-0">

      {/* ── KPI Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
         {([
          { key: "all",       label: "AGGREGATE BOOKINGS",   value: String(stats.total),     icon: Users, iconColor: "text-indigo-600", iconBg: "bg-indigo-50" },
          { key: "confirmed", label: "AUTHORIZED", value: String(stats.confirmed), icon: CheckSquare, iconColor: "text-emerald-600", iconBg: "bg-emerald-50" },
          { key: "pending",   label: "PENDING SYNC",   value: String(stats.pending),   icon: Clock, iconColor: "text-amber-600", iconBg: "bg-amber-50" },
         ] as const).map(({ key, label, value, icon: Icon, iconColor, iconBg }) => (
          <button key={label} onClick={() => key && setStatusFilter(key as FilterStatus)}
            className={`bg-white rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-6 relative overflow-hidden flex flex-col justify-between min-h-[140px] border transition-all duration-300 text-left group ${
              statusFilter === key ? "border-indigo-600 ring-4 ring-indigo-50" : "border-gray-100 hover:shadow-xl hover:border-indigo-100"
            }`}>
             <div className="flex justify-between items-start mb-4">
                <div className={`p-2.5 rounded-xl ${iconBg} group-hover:scale-110 transition-transform`}>
                   <Icon className={`w-5 h-5 ${iconColor}`} />
                </div>
             </div>
             <div>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">{label}</p>
                <p className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tighter leading-none">{value}</p>
             </div>
          </button>
         ))}

         <div className="bg-indigo-900 rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-6 text-white shadow-2xl shadow-indigo-200 relative overflow-hidden flex flex-col justify-between min-h-[140px] text-left">
            <div className="relative z-10 flex justify-between items-start mb-2">
               <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md border border-white/10">
                 <Wallet className="w-5 h-5 text-indigo-100" />
               </div>
               <span className="text-[9px] font-black px-2.5 py-1 rounded-lg bg-emerald-500 text-white flex items-center gap-1 uppercase tracking-widest shadow-lg shadow-emerald-500/20">YIELD PROJ</span>
            </div>
            <div className="relative z-10">
               <p className="text-[9px] font-black text-indigo-300/80 uppercase tracking-widest mb-1.5">PROJECTED EQUITY</p>
               <p className="text-xl sm:text-2xl font-black tracking-tighter leading-none">MWK {fmt(stats.revenue + (stats.pending * 5000))}</p>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-10">
              <Activity className="w-24 h-24 sm:w-32 sm:h-32" />
            </div>
         </div>
      </div>

      {/* ── Search & Filters Bar ── */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto flex-1 max-w-4xl">
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
              className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-black text-gray-700 outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all uppercase tracking-widest shrink-0" />
            
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Search manifest (Reference, Passenger, Corridor)..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 focus:bg-white outline-none text-xs font-bold text-gray-700 transition-all" />
            </div>
          </div>
          
          <div className="flex items-center gap-2 w-full lg:w-auto">
            {selectedDate && (
              <button onClick={() => setSelectedDate("")}
                className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-3 text-[10px] font-black text-rose-600 bg-rose-50 hover:bg-rose-600 hover:text-white rounded-2xl border border-rose-100 transition-all uppercase tracking-widest active:scale-95">
                <X className="w-3.5 h-3.5" /> Reset
              </button>
            )}
            
            {selectedIds.size > 0 && (
              <button onClick={handleBulkConfirm} disabled={bulkLoading}
                className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-emerald-100 transition-all active:scale-95 disabled:opacity-50">
                {bulkLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckSquare className="w-3.5 h-3.5" />}
                Authorize {selectedIds.size}
              </button>
            )}
            
            <button onClick={handleExport}
              className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-3 text-[10px] font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-600 hover:text-white rounded-2xl border border-indigo-100 transition-all uppercase tracking-widest active:scale-95">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            
            <div className="hidden sm:flex gap-1 bg-gray-50 p-1.5 rounded-2xl border border-gray-100 ml-2">
              <button onClick={() => setViewMode("list")}
                className={`p-2 rounded-xl transition-all duration-300 ${viewMode === "list" ? "bg-white shadow-md text-indigo-600" : "text-gray-400 hover:text-gray-600"}`}>
                <ListIcon className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode("seats")}
                className={`p-2 rounded-xl transition-all duration-300 ${viewMode === "seats" ? "bg-white shadow-md text-indigo-600" : "text-gray-400 hover:text-gray-600"}`}>
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── LIST VIEW ── */}
      {viewMode === "list" && filteredBookings.length > 0 && (
        <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden text-left animate-in fade-in duration-500">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left">
              <thead>
                <tr className="border-b border-gray-50 bg-gray-50/30">
                  {isAdmin && (
                    <th className="px-8 py-5 w-10">
                      <input type="checkbox"
                        checked={selectedIds.size === pendingOnPage.length && pendingOnPage.length > 0}
                        onChange={e => setSelectedIds(e.target.checked ? new Set(pendingOnPage.map(b => b.id)) : new Set())}
                        className="rounded-lg border-gray-200 text-indigo-600 focus:ring-indigo-600 w-4 h-4" />
                    </th>
                  )}
                  {["Manifest ID", "Passenger", "Segment Path", "Vessel Config", "Authorized Yield", "Status", "Control"].map(h => (
                    <th key={h} className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginatedRows.map(booking => {
                  const sc      = schedules.find(s => s.id === booking.scheduleId);
                  const route   = routes.find(r => r.id === sc?.routeId);
                  const seg     = passengerSegment(booking, route);
                  const busy    = actionLoading === booking.id;
                  const isPending = booking.bookingStatus === "pending";
                  const isSelected = selectedIds.has(booking.id);

                  return (
                    <tr key={booking.id} className={`transition-all duration-300 group ${isSelected ? "bg-indigo-50/50" : "hover:bg-gray-50/50"}`}>
                      {isAdmin && (
                        <td className="px-8 py-6">
                          {isPending && (
                            <input type="checkbox" checked={isSelected}
                              onChange={e => {
                                const next = new Set(selectedIds);
                                e.target.checked ? next.add(booking.id) : next.delete(booking.id);
                                setSelectedIds(next);
                              }}
                              className="rounded-lg border-gray-200 text-indigo-600 w-4 h-4" />
                          )}
                        </td>
                      )}

                      <td className="px-8 py-6">
                        <span className="font-mono text-[10px] font-black text-gray-400 bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all">
                          #{booking.bookingReference ?? booking.id.slice(0, 8)}
                        </span>
                      </td>

                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center text-[10px] font-black text-indigo-600 border border-indigo-100 group-hover:scale-110 transition-transform">
                            {passengerName(booking).substring(0, 1)}
                          </div>
                          <div>
                            <p className="font-black text-gray-900 text-xs uppercase tracking-tight">{passengerName(booking)}</p>
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{booking.passengerDetails?.[0]?.contactNumber || "No Contact"}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-8 py-6">
                         <div className="flex items-center gap-2 text-xs font-black text-gray-700 uppercase tracking-tight">
                            {seg.from} <ArrowRight className="w-3 h-3 text-gray-300" /> {seg.to}
                         </div>
                      </td>

                      <td className="px-8 py-6">
                        <div className="flex flex-col gap-1">
                          <span className="px-2.5 py-1 bg-gray-50 text-gray-600 text-[10px] font-black uppercase tracking-widest rounded-lg border border-gray-100 w-fit">
                            {booking.seatNumbers?.join(", ") || "No Seat"}
                          </span>
                        </div>
                      </td>

                      <td className="px-8 py-6">
                        <p className="text-sm font-black text-gray-900 tracking-tighter">MWK {fmt(booking.totalAmount ?? 0)}</p>
                      </td>

                      <td className="px-8 py-6">
                        <BookingStatusBadge booking={booking} />
                      </td>

                      <td className="px-8 py-6">
                        <button onClick={() => setSelectedBooking(booking)}
                          className="p-2.5 bg-gray-50 hover:bg-indigo-600 hover:text-white rounded-xl text-gray-400 transition-all active:scale-95 border border-gray-100 hover:border-indigo-600">
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-6 sm:p-8 bg-gray-50/50 border-t border-gray-50 flex items-center justify-between">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Page {pageIndex + 1} of {totalPages}</p>
              <div className="flex gap-2">
                <button disabled={pageIndex === 0} onClick={() => setPageIndex(p => p - 1)}
                  className="p-2 bg-white rounded-xl border border-gray-200 text-gray-400 hover:text-indigo-600 disabled:opacity-30 transition-all">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button disabled={pageIndex >= totalPages - 1} onClick={() => setPageIndex(p => p + 1)}
                  className="p-2 bg-white rounded-xl border border-gray-200 text-gray-400 hover:text-indigo-600 disabled:opacity-30 transition-all">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SEAT VIEW ── */}
      {viewMode === "seats" && filteredBookings.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8 animate-in fade-in duration-500">
          {Array.from(bySchedule.entries()).map(([sid, sb]: [string, Booking[]]) => {
            const sc  = schedules.find(s => s.id === sid);
            const bus = buses.find(b => b.id === sc?.busId);
            const rt  = routes.find(r => r.id === sc?.routeId);
            if (!sc || !bus) return null;
            return (
              <SeatMap key={sid} bus={bus} schedule={sc} bookings={sb} route={rt} onSeatClick={setSelectedBooking} />
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selectedBooking && (
        <BookingDetailModal 
          booking={selectedBooking} 
          schedule={schedules.find(s => s.id === selectedBooking.scheduleId)}
          route={routes.find(r => r.id === schedules.find(s => s.id === selectedBooking.scheduleId)?.routeId)}
          isAdmin={isAdmin}
          actionLoading={actionLoading}
          reminderLoading={reminderLoading}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          onReminder={handleReminder}
          onClose={() => setSelectedBooking(null)} />
      )}
    </div>
  );
};

export default BookingsTab;
