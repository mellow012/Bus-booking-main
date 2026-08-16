'use client';

import React, { useState, useCallback } from 'react';
import {
  Calendar,
  MapPin,
  Share2,
  ArrowRight,
  Loader2,
  Plus,
  Bus,
  Building2,
  Phone,
  LayoutList,
  Grid3X3,
  FileDown,
  X,
  Trash2,
  AlertTriangle,
  Megaphone,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';
import { toDate, isChatterScheduleExpired } from '@/lib/chatterHelpers';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  deleteChatterSchedule,
  hardDeleteChatterSchedule,
} from '@/lib/actions/chatter.actions';
import {
  exportBookingsAsPdf,
  ManifestPdfOptions,
  ManifestBookingRow,
} from '@/lib/exportCsv';
import ChatterSeatMap from './ChatterSeatMap';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatterSchedule {
  id: string;
  busName: string;
  origin: string;
  destination: string;
  travelDate: string;
  fare: number;
  totalSeats: number;
  contactPhone: string;
  status: string;
  createdAt: string;
  bookings?: Array<{
    seatNumbers?: unknown;
    paymentStatus?: string;
  }>;
}

interface ChatterRequest {
  id: string;
  origin: string;
  destination: string;
  departureDate: string;
  status: string;
  estimatedPax: number;
  seatsRequested?: number | null;
  proposedFare?: number | null;
  confirmedPrice?: number | null;
  resultingScheduleId?: string | null;
  company?: { name: string } | null;
}

interface MySchedulesClientProps {
  initialSchedules: ChatterSchedule[];
  initialRequests: ChatterRequest[];
  initialStats: { totalBooked: number; totalPaid: number };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SCHEDULES_PER_PAGE = 6;
const REQUESTS_PER_PAGE  = 8;

const PAYMENT_BADGE: Record<string, string> = {
  paid:    'bg-emerald-50 text-emerald-700 border border-emerald-200',
  pending: 'bg-amber-50   text-amber-700   border border-amber-200',
  failed:  'bg-rose-50    text-rose-700    border border-rose-200',
};

function getStatusBadge(status: string, isExpired: boolean) {
  if (isExpired)              return { label: 'Expired',   cls: 'bg-rose-50 text-rose-700 border border-rose-200' };
  if (status === 'active')    return { label: 'Active',    cls: 'bg-brand-50 text-brand-700 border border-brand-200' };
  if (status === 'cancelled') return { label: 'Cancelled', cls: 'bg-slate-100 text-slate-600 border border-slate-200' };
  return { label: status, cls: 'bg-slate-100 text-slate-600 border border-slate-200' };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MySchedulesClient({
  initialSchedules,
  initialRequests,
  initialStats,
}: MySchedulesClientProps) {
  const router = useRouter();

  // ── Core data ──────────────────────────────────────────────────────────────
  const [schedules, setSchedules] = useState<ChatterSchedule[]>(initialSchedules);
  const [requests]                = useState<ChatterRequest[]>(initialRequests);
  const [activeTab, setActiveTab] = useState<'schedules' | 'requests'>('schedules');

  // ── Stats scoping — null = all schedules ──────────────────────────────────
  const [statsScheduleId, setStatsScheduleId] = useState<string | null>(null);

  // ── Lazy bookings cache ────────────────────────────────────────────────────
  const [bookingsCache, setBookingsCache] = useState<Record<string, any[]>>({});
  const [loadingMap,    setLoadingMap]    = useState<Record<string, boolean>>({});
  const [errorMap,      setErrorMap]      = useState<Record<string, string | null>>({});

  // ── Inline expanded card ───────────────────────────────────────────────────
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Per-card view mode ─────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<Record<string, 'list' | 'map'>>({});

  // ── Inline delete error ────────────────────────────────────────────────────
  const [deleteError, setDeleteError] = useState<{ id: string; msg: string } | null>(null);

  // ── Action loading states ──────────────────────────────────────────────────
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [deletingId,   setDeletingId]   = useState<string | null>(null);
  const [sharingId,    setSharingId]    = useState<string | null>(null);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);

  // ── Pagination ─────────────────────────────────────────────────────────────
  const [schedPage, setSchedPage] = useState(1);
  const [reqPage,   setReqPage]   = useState(1);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const scopeSchedule = statsScheduleId ? schedules.find(s => s.id === statsScheduleId) ?? null : null;
  const scopeBookings = statsScheduleId ? (bookingsCache[statsScheduleId] ?? null) : null;

  const stats = statsScheduleId
    ? {
        scheduleCount: 1,
        totalSeats:    scopeSchedule?.totalSeats ?? 0,
        booked: scopeBookings !== null ? scopeBookings.length                                          : null,
        paid:   scopeBookings !== null ? scopeBookings.filter((b: any) => b.paymentStatus === 'paid').length : null,
      }
    : {
        scheduleCount: schedules.length,
        totalSeats:    schedules.reduce((sum, s) => sum + s.totalSeats, 0),
        booked:        initialStats.totalBooked,
        paid:          initialStats.totalPaid,
      };

  // ── Pagination slices ──────────────────────────────────────────────────────
  const schedTotalPages = Math.max(1, Math.ceil(schedules.length / SCHEDULES_PER_PAGE));
  const pagedSchedules  = schedules.slice((schedPage - 1) * SCHEDULES_PER_PAGE, schedPage * SCHEDULES_PER_PAGE);
  const reqTotalPages   = Math.max(1, Math.ceil(requests.length / REQUESTS_PER_PAGE));
  const pagedRequests   = requests.slice((reqPage - 1) * REQUESTS_PER_PAGE, reqPage * REQUESTS_PER_PAGE);

  // ── Bookings fetch (lazy, cached) ──────────────────────────────────────────
  const fetchBookings = useCallback(
    async (id: string) => {
      if (id in bookingsCache) return; // already in cache
      setLoadingMap(prev => ({ ...prev, [id]: true }));
      setErrorMap(prev   => ({ ...prev, [id]: null  }));
      try {
        const res  = await fetch(`/api/chatter/schedules/${id}/bookings`);
        const json = await res.json();
        if (json.success) {
          setBookingsCache(prev => ({ ...prev, [id]: json.data || [] }));
        } else {
          setErrorMap(prev      => ({ ...prev, [id]: json.error || 'Failed to load bookings.' }));
          setBookingsCache(prev => ({ ...prev, [id]: [] }));
        }
      } catch (err: any) {
        setErrorMap(prev      => ({ ...prev, [id]: err.message || 'Something went wrong.' }));
        setBookingsCache(prev => ({ ...prev, [id]: [] }));
      } finally {
        setLoadingMap(prev => ({ ...prev, [id]: false }));
      }
    },
    [bookingsCache],
  );

  // ── Card click: toggle stats scope + expand ────────────────────────────────
  const handleCardClick = (id: string) => {
    setDeleteError(null);
    if (statsScheduleId === id) {
      setStatsScheduleId(null);
      setExpandedId(null);
    } else {
      setStatsScheduleId(id);
      setExpandedId(id);
      fetchBookings(id);
    }
  };

  // ── List / map icon toggle ─────────────────────────────────────────────────
  const handleViewToggle = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setViewMode(prev => ({ ...prev, [id]: prev[id] === 'map' ? 'list' : 'map' }));
    if (expandedId !== id) {
      setExpandedId(id);
      fetchBookings(id);
    }
  };

  // ── Share link ─────────────────────────────────────────────────────────────
  const handleShare = async (e: React.MouseEvent, s: ChatterSchedule) => {
    e.stopPropagation();
    setSharingId(s.id);
    const url = `${window.location.origin}/chatter/${s.id}`;
    try {
      if (navigator.share) {
        try { await navigator.share({ title: `Book seats: ${s.origin} → ${s.destination}`, url }); }
        catch { /* user cancelled */ }
      } else {
        await navigator.clipboard.writeText(url);
        alert('Share link copied to clipboard!');
      }
    } finally {
      setTimeout(() => setSharingId(null), 400);
    }
  };

  // ── Manifest PDF ───────────────────────────────────────────────────────────
  const handleManifestPdf = async (e: React.MouseEvent, s: ChatterSchedule) => {
    e.stopPropagation();
    setPdfLoadingId(s.id);
    try {
      let bk = bookingsCache[s.id];
      if (!bk) {
        const res = await fetch(`/api/chatter/schedules/${s.id}/bookings`);
        const json = await res.json();
        if (json.success) {
          bk = json.data || [];
          setBookingsCache(prev => ({ ...prev, [s.id]: bk }));
        } else {
          bk = [];
        }
      }
      const rows: ManifestBookingRow[] = (bk || []).map((b: any) => ({
        bookingReference: b.bookingReference || '',
        passengerName:    b.passengerDetails?.[0]?.name || b.user?.firstName || 'Passenger',
        contactPhone:     b.contactPhone || '',
        seat:             Array.isArray(b.seatNumbers) ? (b.seatNumbers[0] ?? 'N/A') : 'N/A',
        paymentStatus:    b.paymentStatus || 'pending',
        createdAt:        b.bookingDate || b.createdAt || new Date().toISOString(),
      }));
      const opts: ManifestPdfOptions = {
        busName:     s.busName,
        origin:      s.origin,
        destination: s.destination,
        travelDate:  s.travelDate,
        totalSeats:  s.totalSeats,
        fare:        s.fare,
      };
      exportBookingsAsPdf(rows, opts, `${s.busName}_manifest_${s.id.slice(0, 8)}.pdf`);
    } catch (err: any) {
      console.error('PDF error:', err);
    } finally {
      setPdfLoadingId(null);
    }
  };

  // ── Soft-cancel (active → cancelled) ──────────────────────────────────────
  const handleSoftDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteError(null);
    if (!window.confirm(
      'Cancel this schedule? It will be marked as cancelled and hidden from new bookings. You can permanently delete it afterwards if needed.',
    )) return;
    
    setCancellingId(id);
    try {
      const res = await deleteChatterSchedule(id);
      if (res.success) {
        setSchedules(prev => prev.filter(s => s.id !== id));
        if (statsScheduleId === id) setStatsScheduleId(null);
        if (expandedId       === id) setExpandedId(null);
      } else {
        setDeleteError({ id, msg: (res as any).error || 'Failed to cancel schedule.' });
      }
    } finally {
      setCancellingId(null);
    }
  };

  // ── Hard-delete (cancelled schedules, blocked if paid/pending bookings) ────
  const handleHardDelete = async (e: React.MouseEvent, s: ChatterSchedule) => {
    e.stopPropagation();
    setDeleteError(null);
    if (!window.confirm(
      `Permanently delete "${s.busName}"?\n\nThis cannot be undone. Booking records with status "failed" will also be removed.`,
    )) return;

    setDeletingId(s.id);
    try {
      const res = await hardDeleteChatterSchedule(s.id);
      if (res.success) {
        setSchedules(prev => prev.filter(sch => sch.id !== s.id));
        if (statsScheduleId === s.id) setStatsScheduleId(null);
        if (expandedId       === s.id) setExpandedId(null);
      } else {
        setDeleteError({ id: s.id, msg: (res as any).error || 'Failed to delete schedule.' });
      }
    } finally {
      setDeletingId(null);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ═══════════════════════════════════════════════════════════════════════
          HEADER + STATS (Flat, unboxed design)
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="space-y-6 pt-2">
        {/* Title + Action */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold text-brand-700 tracking-normal">
              Chatter
            </p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Your group schedules
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Click a schedule to see its numbers and bookings.
            </p>
          </div>
          <Link
            href="/chatter/request"
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-coral-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-coral-600 active:scale-98 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            Request a trip
          </Link>
        </div>

        {/* ── Stats bar (4 flat tiles) ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              { label: 'Schedules',   value: stats.scheduleCount },
              { label: 'Total seats', value: stats.totalSeats    },
              { label: 'Booked',      value: stats.booked ?? '–' },
              { label: 'Paid',        value: stats.paid   ?? '–' },
            ] as const
          ).map(({ label, value }) => (
            <div
              key={label}
              className="flex flex-col justify-between rounded-xl bg-slate-100/70 p-4 transition-colors"
            >
              <span className="text-xs font-semibold text-slate-500">{label}</span>
              <span className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{value}</span>
            </div>
          ))}
        </div>

        {/* ── Scope filter chip ────────────────────────────────────────────── */}
        {statsScheduleId && scopeSchedule && (
          <div className="flex items-center gap-2.5 flex-wrap pt-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200/80 px-3 py-1 text-xs font-medium text-brand-900">
              <span>{scopeSchedule.busName}</span>
              <button
                onClick={() => { setStatsScheduleId(null); setExpandedId(null); }}
                className="rounded-full p-0.5 text-brand-600 hover:bg-brand-100 hover:text-brand-900 transition-colors"
                title="Clear filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
            <button
              onClick={() => { setStatsScheduleId(null); setExpandedId(null); }}
              className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
            >
              Reset to all schedules
            </button>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB SELECTOR
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="flex gap-2">
        {(
          [
            { key: 'schedules', Icon: Bus,       label: 'Direct Schedules' },
            { key: 'requests',  Icon: Building2, label: 'Company Trip Requests' },
          ] as const
        ).map(({ key, Icon, label }) => (
          <button
            key={key}
            onClick={() => {
              setActiveTab(key);
              if (key === 'schedules') setSchedPage(1);
              else setReqPage(1);
            }}
            className={`flex flex-1 items-center justify-center gap-2 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all duration-200 ${
              activeTab === key
                ? 'bg-brand-700 text-white border-brand-700 shadow-md shadow-brand-700/20'
                : 'bg-gray-50 text-gray-500 border-gray-100 hover:border-brand-100 hover:text-brand-700 hover:bg-white'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SCHEDULES TAB
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'schedules' && (
        <div className="space-y-4">
          {pagedSchedules.map(schedule => {
            const travelDt     = toDate(schedule.travelDate);
            const isExpired    = isChatterScheduleExpired(schedule.travelDate);
            const { label: statusLabel, cls: statusCls } = getStatusBadge(schedule.status, isExpired);
            const isSelected   = statsScheduleId === schedule.id;
            const isExpanded   = expandedId       === schedule.id;
            const curViewMode  = viewMode[schedule.id] ?? 'list';
            const bk           = bookingsCache[schedule.id];
            const isLoading    = !!loadingMap[schedule.id];
            const loadError    = errorMap[schedule.id] ?? null;
            const hasBk        = bk !== undefined && bk.length > 0;
            const travelStr    = travelDt ? format(travelDt, 'EEE, MMM d yyyy') : 'TBD';

            const currentBookings = bk ?? schedule.bookings ?? [];
            const bookedSeatsCount = currentBookings.reduce((acc: number, b: any) => {
              if (Array.isArray(b.seatNumbers)) return acc + b.seatNumbers.length;
              if (typeof b.seatNumbers === 'string') {
                try {
                  const p = JSON.parse(b.seatNumbers);
                  if (Array.isArray(p)) return acc + p.length;
                } catch {
                  return acc + 1;
                }
              }
              return acc + 1;
            }, 0);
            const seatsLeft = Math.max(0, schedule.totalSeats - bookedSeatsCount);

            return (
              <div
                key={schedule.id}
                onClick={() => handleCardClick(schedule.id)}
                className={`relative overflow-hidden rounded-[1.75rem] border cursor-pointer transition-all duration-200 group ${
                  isSelected
                    ? 'border-brand-300 bg-brand-50/30 shadow-2xl shadow-brand-500/10 ring-1 ring-brand-200'
                    : 'border-gray-100 bg-white shadow-lg hover:shadow-xl hover:-translate-y-0.5'
                } ${isExpired ? 'opacity-80' : ''}`}
              >
                {/* Accent strip */}
                <div
                  className={`absolute inset-x-0 top-0 h-[3px] transition-all ${
                    isExpired    ? 'bg-slate-300'
                    : isSelected ? 'bg-gradient-to-r from-brand-500 via-brand-600 to-brand-700'
                    :              'bg-gradient-to-r from-brand-600 via-brand-700 to-brand-800 opacity-60 group-hover:opacity-100'
                  }`}
                />

                <div className="relative p-5 lg:p-6 space-y-4 pt-6">

                  {/* ── HEADER ────────────────────────────────────────────── */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="text-xl font-extrabold text-slate-900 truncate leading-tight">
                          {schedule.busName}
                        </h3>
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${statusCls}`}>
                          {statusLabel}
                        </span>
                      </div>
                      <p className="flex items-center gap-1.5 text-sm text-slate-500">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {schedule.contactPhone}
                      </p>
                    </div>

                    {/* Actions: View Toggle + Dismiss X when selected */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* List / Map toggle */}
                      <button
                        onClick={e => handleViewToggle(e, schedule.id)}
                        title={curViewMode === 'map' ? 'Switch to list view' : 'Switch to seat map'}
                        className="p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 transition-all"
                      >
                        {curViewMode === 'map'
                          ? <LayoutList className="w-4 h-4" />
                          : <Grid3X3   className="w-4 h-4" />}
                      </button>

                      {/* Close / Unscope button when card is active */}
                      {isSelected && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setStatsScheduleId(null);
                            setExpandedId(null);
                          }}
                          title="Close details & reset stats"
                          className="p-2 rounded-xl border border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 hover:text-brand-900 transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ── TRIP INFO ROW ──────────────────────────────────────── */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-slate-600">
                    <span className="flex items-center gap-1.5 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                      {schedule.origin}
                      <ArrowRight className="w-3 h-3 text-slate-400 mx-0.5" />
                      {schedule.destination}
                    </span>
                    <span className="text-slate-200 hidden sm:block">│</span>
                    <span className="flex items-center gap-1.5 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                      {travelStr}
                    </span>
                    <span className="text-slate-200 hidden sm:block">│</span>
                    <span className="font-bold text-slate-800">MK {schedule.fare.toLocaleString()}</span>
                    <span className="text-slate-300 hidden sm:block">│</span>
                    <span className="text-slate-500 text-xs font-medium">
                      <span className={seatsLeft === 0 ? 'text-rose-600 font-bold' : seatsLeft <= 3 ? 'text-amber-600 font-bold' : 'text-slate-700 font-bold'}>
                        {seatsLeft}/{schedule.totalSeats}
                      </span>{' '}
                      seats left
                    </span>
                  </div>

                  {/* ── INLINE CONTENT (list or seat map) ─────────────────── */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 pt-4">
                      {isLoading ? (
                        <div className="flex items-center justify-center gap-2.5 py-8 text-slate-400 text-sm">
                          <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
                          Loading bookings…
                        </div>
                      ) : loadError ? (
                        <div className="rounded-2xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-700">
                          {loadError}
                        </div>
                      ) : curViewMode === 'map' ? (
                        <ChatterSeatMap totalSeats={schedule.totalSeats} bookings={bk ?? []} />
                      ) : bk && bk.length > 0 ? (
                        /* List view */
                        <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white shadow-sm">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-slate-100 bg-slate-50/60">
                                <th className="py-2.5 px-3 text-[9px] font-extrabold uppercase tracking-widest text-slate-400">Seat</th>
                                <th className="py-2.5 px-3 text-[9px] font-extrabold uppercase tracking-widest text-slate-400">Passenger</th>
                                <th className="py-2.5 px-3 text-[9px] font-extrabold uppercase tracking-widest text-slate-400">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {bk.map((b: any) => (
                                <tr
                                  key={b.id}
                                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors"
                                >
                                  <td className="py-2.5 px-3 font-bold text-brand-700">
                                    {Array.isArray(b.seatNumbers) ? (b.seatNumbers[0] ?? 'N/A') : 'N/A'}
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-700 truncate max-w-[140px]">
                                    {b.passengerDetails?.[0]?.name || b.user?.firstName || 'Passenger'}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${
                                        PAYMENT_BADGE[b.paymentStatus] ?? 'bg-slate-50 text-slate-600'
                                      }`}
                                    >
                                      {b.paymentStatus}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="py-6 text-center text-sm text-slate-400">
                          No bookings yet for this schedule.
                        </p>
                      )}
                    </div>
                  )}

                  {/* ── INLINE DELETE ERROR ───────────────────────────────── */}
                  {deleteError?.id === schedule.id && (
                    <div className="flex items-start gap-2 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>{deleteError.msg}</span>
                    </div>
                  )}

                  {/* ── ACTIONS ROW ───────────────────────────────────────── */}
                  <div
                    className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3"
                    onClick={e => e.stopPropagation()}
                  >
                    {/* Manifest PDF — enabled only when bookings are loaded */}
                    <button
                      onClick={e => handleManifestPdf(e, schedule)}
                      disabled={isLoading || pdfLoadingId === schedule.id}
                      title={hasBk ? 'Download passenger manifest PDF' : 'Expand to load bookings first'}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-semibold transition-all ${
                        hasBk
                          ? 'bg-coral-500 text-white border border-coral-400/30 hover:bg-coral-600 shadow-sm shadow-coral-500/20 active:scale-95'
                          : 'bg-slate-50 text-slate-400 border border-slate-200 cursor-default'
                      } ${pdfLoadingId === schedule.id ? 'opacity-80 cursor-wait' : ''}`}
                    >
                      {pdfLoadingId === schedule.id || isLoading
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <FileDown className="w-3.5 h-3.5" />}
                      {pdfLoadingId === schedule.id ? 'Generating...' : 'Manifest PDF'}
                    </button>

                    {/* Share link — disabled when expired */}
                    <button
                      onClick={e => { if (!isExpired && sharingId !== schedule.id) handleShare(e, schedule); else e.stopPropagation(); }}
                      disabled={isExpired || sharingId === schedule.id}
                      title={isExpired ? 'Sharing disabled for expired schedules' : 'Copy shareable booking link'}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border text-xs font-semibold transition-all ${
                        isExpired
                          ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                          : 'border-gray-200 bg-white text-slate-700 hover:bg-slate-50 active:scale-95'
                      }`}
                    >
                      {sharingId === schedule.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-500" />
                      ) : (
                        <Share2 className={`w-3.5 h-3.5 ${isExpired ? 'text-gray-300' : 'text-brand-500'}`} />
                      )}
                      {sharingId === schedule.id ? 'Sharing...' : 'Share link'}
                    </button>

                    {/* Delete — soft-cancel (active) or hard-delete (cancelled) */}
                    {schedule.status === 'active' && (
                      <button
                        onClick={e => handleSoftDelete(e, schedule.id)}
                        disabled={cancellingId === schedule.id}
                        className="ml-auto flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border border-red-200 bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {cancellingId === schedule.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />
                        ) : (
                          <X className="w-3.5 h-3.5" />
                        )}
                        {cancellingId === schedule.id ? 'Cancelling...' : 'Cancel schedule'}
                      </button>
                    )}
                    {schedule.status === 'cancelled' && (
                      <button
                        onClick={e => handleHardDelete(e, schedule)}
                        disabled={deletingId === schedule.id}
                        className="ml-auto flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border border-red-300 bg-red-600 text-white text-xs font-bold hover:bg-red-700 active:scale-95 transition-all shadow-sm shadow-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {deletingId === schedule.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        {deletingId === schedule.id ? 'Deleting...' : 'Delete permanently'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* ── Empty state ────────────────────────────────────────────────── */}
          {schedules.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-4 rounded-3xl border border-dashed border-gray-200 bg-white text-center">
              <div className="w-12 h-12 rounded-2xl bg-coral-50 flex items-center justify-center mb-3 text-coral-500">
                <Bus className="w-6 h-6" />
              </div>
              <p className="text-sm font-extrabold text-slate-800 tracking-tight">
                No direct schedules yet
              </p>
              <p className="mt-1 text-xs text-slate-500 max-w-sm">
                Create a custom schedule for your own bus and share the booking link directly with your group.
              </p>
              <Link
                href="/chatter/request?tab=own"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-coral-500 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-coral-500/20 hover:bg-coral-600 active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" />
                Create My Bus Schedule
              </Link>
            </div>
          )}

          {/* ── Pagination ────────────────────────────────────────────────── */}
          {schedules.length > SCHEDULES_PER_PAGE && (
            <div className="flex flex-col sm:flex-row items-center justify-between mt-2 gap-3">
              <button
                onClick={() => setSchedPage(p => Math.max(p - 1, 1))}
                disabled={schedPage === 1}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-200 w-full sm:w-auto transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">
                Page {schedPage} of {schedTotalPages} ({schedules.length} total)
              </span>
              <button
                onClick={() => setSchedPage(p => Math.min(p + 1, schedTotalPages))}
                disabled={schedPage === schedTotalPages}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-200 w-full sm:w-auto transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          REQUESTS TAB
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'requests' && (
        <div className="space-y-3">
          {pagedRequests.map(req => {
            const depDt    = toDate(req.departureDate);
            const depStr   = depDt ? format(depDt, 'MMM d, yyyy') : 'TBD';
            const seats    = req.seatsRequested ?? req.estimatedPax ?? 0;

            return (
              <div
                key={req.id}
                className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md hover:border-brand-100 transition-all"
              >
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-block px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-100 text-[9px] font-extrabold uppercase tracking-widest">
                      Requested Trip
                    </span>
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${
                      req.status === 'pending'   ? 'bg-amber-50 text-amber-700'
                      : req.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-rose-50 text-rose-700'
                    }`}>
                      {req.status}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-800 text-base truncate">
                    {req.company?.name || 'Platform Company'}
                  </h3>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {req.origin} <ArrowRight className="w-3 h-3 mx-0.5" /> {req.destination}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {depStr}
                    </span>
                    {seats > 0 && (
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {seats} seats
                      </span>
                    )}
                  </div>
                </div>

                {req.status === 'confirmed' && req.resultingScheduleId && (
                  <Link href={`/book/${req.resultingScheduleId}`} className="w-full md:w-auto shrink-0">
                    <button className="w-full h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-sm shadow-emerald-500/20">
                      Book tickets
                    </button>
                  </Link>
                )}
              </div>
            );
          })}

          {/* ── Empty state ────────────────────────────────────────────────── */}
          {requests.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-4 rounded-3xl border border-dashed border-gray-200 bg-white text-center">
              <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center mb-3 text-brand-700">
                <Building2 className="w-6 h-6" />
              </div>
              <p className="text-sm font-extrabold text-slate-800 tracking-tight">
                No company trip requests yet
              </p>
              <p className="mt-1 text-xs text-slate-500 max-w-sm">
                Submit a group booking request to platform bus operators to arrange charter transport.
              </p>
              <Link
                href="/chatter/request?tab=platform"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-brand-700/20 hover:bg-brand-800 active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" />
                Request Platform Bus
              </Link>
            </div>
          )}

          {/* ── Pagination ────────────────────────────────────────────────── */}
          {requests.length > REQUESTS_PER_PAGE && (
            <div className="flex flex-col sm:flex-row items-center justify-between mt-2 gap-3">
              <button
                onClick={() => setReqPage(p => Math.max(p - 1, 1))}
                disabled={reqPage === 1}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-200 w-full sm:w-auto transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">
                Page {reqPage} of {reqTotalPages} ({requests.length} total)
              </span>
              <button
                onClick={() => setReqPage(p => Math.min(p + 1, reqTotalPages))}
                disabled={reqPage === reqTotalPages}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-200 w-full sm:w-auto transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
