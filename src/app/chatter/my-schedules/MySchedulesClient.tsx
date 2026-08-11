'use client';

import React, { useState } from 'react';
import {
  Calendar, MapPin, Users, Share2, Download,
  ArrowRight, Megaphone, Loader2, Plus, Bus, Building2,
  Phone, Armchair, BadgeDollarSign, ChevronDown,
  ChevronUp, X, Clock, Eye, ChevronLeft,
} from 'lucide-react';
import { format, isPast, differenceInDays } from 'date-fns';
import Link from 'next/link';
import { exportBookingsAsPdf } from '@/lib/exportCsv';

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
}

interface ChatterRequest {
  id: string;
  origin: string;
  destination: string;
  departureDate: string;
  status: string;
  estimatedPax: number;
  seatsRequested: number | null;
  proposedFare: number | null;
  confirmedPrice: number | null;
  resultingScheduleId: string | null;
  company?: {
    name: string;
  } | null;
}

interface MySchedulesClientProps {
  initialSchedules: ChatterSchedule[];
  initialRequests: ChatterRequest[];
}

/* ─── Seat Map component ─── */
function SeatMap({
  totalSeats,
  bookedSeats = new Set(),
  pendingSeats = new Set(),
  compact = false,
}: {
  totalSeats: number;
  bookedSeats?: Set<string>;
  pendingSeats?: Set<string>;
  compact?: boolean;
}) {
  if (!totalSeats || totalSeats <= 0 || totalSeats > 100) return null;
  const perRow = 4;
  const rows = Math.ceil(totalSeats / perRow);
  const sz = compact ? 'w-6 h-6 text-[8px]' : 'w-8 h-8 text-[10px]';

  const seatCls = (n: string) => {
    if (bookedSeats.has(n)) return 'bg-emerald-500 text-white border-emerald-600 shadow-emerald-200';
    if (pendingSeats.has(n)) return 'bg-amber-400 text-white border-amber-500 shadow-amber-200';
    return 'bg-white text-slate-600 border-gray-200 hover:border-brand-400';
  };

  return (
    <div className={`mx-auto border-[3px] border-slate-300 rounded-t-[2rem] rounded-b-xl bg-white shadow-inner ${compact ? 'max-w-[200px] p-2.5' : 'max-w-[240px] p-3.5'}`}>
      {/* Driver row */}
      <div className="flex justify-between items-center border-b-2 border-dashed border-slate-200 pb-2.5 mb-2.5">
        <div className={`${compact ? 'w-5 h-5 text-[7px]' : 'w-7 h-7 text-[8px]'} rounded-full bg-brand-600 flex items-center justify-center font-black text-white`}>D</div>
        <div className={`${compact ? 'h-3.5 w-7 text-[5px]' : 'h-4 w-9 text-[6px]'} bg-slate-100 rounded border border-slate-200 uppercase tracking-wider text-slate-400 font-bold flex items-center justify-center`}>Door</div>
      </div>
      <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
        {Array.from({ length: rows }).map((_, ri) => {
          const start = ri * perRow;
          const rowSeats = Array.from({ length: Math.min(perRow, totalSeats - start) }, (_, i) => String(start + i + 1));
          return (
            <div key={ri} className="flex items-center gap-0.5">
              <div className="flex gap-0.5 flex-1 justify-end">
                {rowSeats.slice(0, 2).map((n) => (
                  <div key={n} className={`${sz} rounded-md border flex items-center justify-center font-bold shadow-sm transition-all ${seatCls(n)}`}>{n}</div>
                ))}
                {rowSeats.length < 2 && <div className={`${sz} opacity-0`} />}
              </div>
              <div className="w-4 shrink-0" />
              <div className="flex gap-0.5 flex-1">
                {rowSeats.slice(2).map((n) => (
                  <div key={n} className={`${sz} rounded-md border flex items-center justify-center font-bold shadow-sm transition-all ${seatCls(n)}`}>{n}</div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MySchedulesClient({ initialSchedules, initialRequests }: MySchedulesClientProps) {
  const [schedules] = useState<ChatterSchedule[]>(initialSchedules);
  const [requests] = useState<ChatterRequest[]>(initialRequests);
  const [activeTab, setActiveTab] = useState<'schedules' | 'requests'>('schedules');

  const [expandedId, setExpandedId] = useState<string | null>(null);

  /* bookings modal state */
  const [modalScheduleId, setModalScheduleId] = useState<string | null>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const totalSeatsAll = schedules.reduce((s, sc) => s + sc.totalSeats, 0);
  const pendingReqs = requests.filter((r) => r.status === 'pending').length;

  /* ── handlers ── */
  const handleShare = async (id: string, busName: string, origin: string, destination: string) => {
    const shareUrl = `${window.location.origin}/chatter/${id}`;
    if (navigator.share) {
      try { await navigator.share({ title: `Book seats: ${origin} → ${destination}`, text: `Check out this trip on ${busName}!`, url: shareUrl }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      alert('Link copied!');
    }
  };

  const openBookingsModal = async (id: string) => {
    setModalScheduleId(id);
    setBookingsLoading(true);
    setBookingError(null);
    try {
      const res = await fetch(`/api/chatter/schedules/${id}/bookings`);
      const json = await res.json();
      if (json.success) setBookings(json.data || []);
      else setBookingError(json.error || 'Failed to load bookings.');
    } catch (err: any) {
      setBookingError(err.message || 'Something went wrong.');
    } finally {
      setBookingsLoading(false);
    }
  };

  const handleDownloadManifest = (schedule: ChatterSchedule) => {
    exportBookingsAsPdf(
      bookings.map((b) => ({
        bookingReference: b.bookingReference,
        passengerName: b.passengerDetails?.[0]?.name || b.user?.firstName || 'Passenger',
        contactPhone: b.contactPhone || '',
        seat: b.seatNumbers?.[0] || 'N/A',
        paymentStatus: b.paymentStatus || 'pending',
        createdAt: b.bookingDate || b.createdAt,
      })),
      {
        busName: schedule.busName,
        origin: schedule.origin,
        destination: schedule.destination,
        travelDate: schedule.travelDate,
        totalSeats: schedule.totalSeats,
        fare: schedule.fare,
      },
      `${schedule.busName}_manifest_${schedule.id.slice(0, 8)}.pdf`,
    );
  };

  /* ════════════════ RENDER ════════════════ */
  return (
    <div className="space-y-6">

      {/* Back button & title */}
      <div className="flex items-center gap-2">
        <Link href="/" className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors border border-gray-200">
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">My Schedules</span>
      </div>

      {/* ── Quick stats row ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Schedules', value: schedules.length, icon: Bus, accent: 'text-brand-700' },
          { label: 'Total Seats', value: totalSeatsAll, icon: Armchair, accent: 'text-slate-700' },
          { label: 'Pending Req', value: pendingReqs, icon: Clock, accent: 'text-amber-600' },
        ].map((s) => (
          <div key={s.label} className="bg-slate-50 rounded-2xl border border-gray-100 px-4 py-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center shadow-sm">
              <s.icon className={`w-4 h-4 ${s.accent}`} />
            </div>
            <div>
              <p className={`text-xl font-extrabold leading-none ${s.accent}`}>{s.value}</p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Header row ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800 tracking-tight">Manage Trips</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Direct schedules & company trip requests.</p>
        </div>
        <Link href="/chatter/request">
          <button className="flex items-center gap-1.5 px-4 h-9 bg-coral-500 hover:bg-coral-600 text-white font-bold text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95">
            <Plus className="w-3.5 h-3.5" /> New Trip
          </button>
        </Link>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1.5">
        {[
          { key: 'schedules' as const, label: 'My Direct Schedules', icon: Bus, count: schedules.length },
          { key: 'requests' as const, label: 'Company Trip Requests', icon: Building2, count: requests.length },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest py-3 rounded-xl border transition-all duration-200 ${
              activeTab === t.key
                ? 'bg-brand-700 text-white border-brand-700 shadow-md'
                : 'bg-gray-50 text-gray-500 border-gray-100 hover:border-brand-100 hover:text-brand-700 hover:bg-white'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
            {t.count > 0 && (
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-black ${
                activeTab === t.key ? 'bg-white/20' : 'bg-brand-100 text-brand-700'
              }`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ════════════ SCHEDULES TAB ════════════ */}
      {activeTab === 'schedules' ? (
        <div className="space-y-4">
          {schedules.map((sc) => {
            const isOpen = expandedId === sc.id;
            const travelDate = new Date(sc.travelDate);
            const past = isPast(travelDate);
            const daysLeft = differenceInDays(travelDate, new Date());

            return (
              <div key={sc.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden">
                {/* Colour strip */}
                <div className={`h-1 ${past ? 'bg-gray-300' : daysLeft <= 2 ? 'bg-coral-500' : 'bg-brand-500'}`} />

                <div className="p-5">
                  {/* Top row: icon + name + badges + actions */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center shrink-0">
                        <Bus className="w-5 h-5 text-brand-700" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-slate-800 truncate">{sc.busName}</h3>
                          <span className="text-[8px] font-extrabold tracking-widest text-brand-700 uppercase bg-brand-50 border border-brand-100/50 px-2 py-0.5 rounded-full">Direct</span>
                          {past && <span className="text-[8px] font-extrabold tracking-widest text-gray-500 uppercase bg-gray-100 px-2 py-0.5 rounded-full">Past</span>}
                          {!past && daysLeft <= 2 && (
                            <span className="text-[8px] font-extrabold tracking-widest text-coral-600 uppercase bg-coral-50 px-2 py-0.5 rounded-full animate-pulse">
                              {daysLeft === 0 ? 'Today' : `${daysLeft}d left`}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">Created {format(new Date(sc.createdAt), 'MMM d, yyyy')}</p>
                      </div>
                    </div>

                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => handleShare(sc.id, sc.busName, sc.origin, sc.destination)}
                        className="h-8 w-8 border border-gray-200 text-slate-500 rounded-lg bg-white hover:bg-slate-50 flex items-center justify-center transition-all"
                        title="Share"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openBookingsModal(sc.id)}
                        className="h-8 px-3 bg-coral-500 hover:bg-coral-600 text-white font-bold text-[9px] uppercase tracking-wider rounded-lg flex items-center gap-1 transition-all active:scale-95"
                      >
                        <Eye className="w-3 h-3" /> Bookings
                      </button>
                    </div>
                  </div>

                  {/* Route / date / seats / fare — compact info bar */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                    <div className="bg-slate-50 rounded-xl px-3 py-2 border border-gray-100/60">
                      <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Route</p>
                      <p className="text-[11px] font-bold text-slate-700 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-brand-500 shrink-0" />
                        <span className="truncate">{sc.origin}</span>
                        <ArrowRight className="w-2.5 h-2.5 text-gray-300 shrink-0" />
                        <span className="truncate">{sc.destination}</span>
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-xl px-3 py-2 border border-gray-100/60">
                      <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Date</p>
                      <p className="text-[11px] font-bold text-slate-700 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3 text-brand-500 shrink-0" />
                        {format(travelDate, 'EEE, MMM d')}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-xl px-3 py-2 border border-gray-100/60">
                      <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Seats</p>
                      <p className="text-[11px] font-bold text-slate-700 flex items-center gap-1 mt-0.5">
                        <Armchair className="w-3 h-3 text-brand-500 shrink-0" />
                        {sc.totalSeats} total
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-xl px-3 py-2 border border-gray-100/60">
                      <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Fare</p>
                      <p className="text-[11px] font-bold text-slate-700 flex items-center gap-1 mt-0.5">
                        <BadgeDollarSign className="w-3 h-3 text-brand-500 shrink-0" />
                        MWK {sc.fare?.toLocaleString() || '—'}
                      </p>
                    </div>
                  </div>

                  {/* Expand toggle */}
                  <button
                    onClick={() => setExpandedId(isOpen ? null : sc.id)}
                    className="w-full flex items-center justify-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-brand-600 hover:text-brand-800 bg-brand-50/50 hover:bg-brand-50 rounded-xl py-2 transition-all border border-brand-100/40"
                  >
                    {isOpen ? <><ChevronUp className="w-3 h-3" /> Hide Details</> : <><ChevronDown className="w-3 h-3" /> Bus Details &amp; Seat Map</>}
                  </button>

                  {/* ── Expanded: About Bus + Seat Map ── */}
                  {isOpen && (
                    <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-5 gap-4">

                      {/* About This Bus — 3 col */}
                      <div className="md:col-span-3 space-y-3">
                        <h4 className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                          <Bus className="w-3.5 h-3.5 text-brand-500" /> About This Bus
                        </h4>
                        <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl border border-gray-100 p-4 space-y-3">
                          {/* Bus identity */}
                          <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                            <div className="w-10 h-10 rounded-xl bg-brand-100/50 flex items-center justify-center">
                              <Bus className="w-5 h-5 text-brand-700" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-800">{sc.busName}</p>
                              <p className="text-[10px] text-gray-400">Direct group schedule</p>
                            </div>
                            <span className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-bold uppercase ${past ? 'bg-gray-100 text-gray-500' : 'bg-emerald-50 text-emerald-600'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${past ? 'bg-gray-400' : 'bg-emerald-500'}`} />
                              {past ? 'Completed' : 'Active'}
                            </span>
                          </div>

                          {/* Detail grid */}
                          <div className="grid grid-cols-2 gap-2.5">
                            <div className="bg-white rounded-lg border border-gray-100 p-3">
                              <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Capacity</p>
                              <p className="text-sm font-bold text-slate-700 mt-1">{sc.totalSeats} seats</p>
                            </div>
                            <div className="bg-white rounded-lg border border-gray-100 p-3">
                              <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Fare / Seat</p>
                              <p className="text-sm font-bold text-slate-700 mt-1">MWK {sc.fare?.toLocaleString() || '—'}</p>
                            </div>
                            <div className="bg-white rounded-lg border border-gray-100 p-3">
                              <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Contact</p>
                              <p className="text-sm font-bold text-slate-700 mt-1 flex items-center gap-1">
                                <Phone className="w-3 h-3 text-gray-400" /> {sc.contactPhone || 'N/A'}
                              </p>
                            </div>
                            <div className="bg-white rounded-lg border border-gray-100 p-3">
                              <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Travel Date</p>
                              <p className="text-sm font-bold text-slate-700 mt-1">{format(travelDate, 'EEEE, MMM d')}</p>
                            </div>
                          </div>

                          {/* Route line */}
                          <div className="flex items-center gap-2 bg-brand-50/50 rounded-lg px-3 py-2 border border-brand-100/50">
                            <MapPin className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                            <span className="text-xs font-semibold text-slate-700">{sc.origin}</span>
                            <div className="flex-1 border-t border-dashed border-brand-200 mx-1" />
                            <ArrowRight className="w-3 h-3 text-brand-400 shrink-0" />
                            <div className="flex-1 border-t border-dashed border-brand-200 mx-1" />
                            <span className="text-xs font-semibold text-slate-700">{sc.destination}</span>
                            <MapPin className="w-3.5 h-3.5 text-coral-500 shrink-0" />
                          </div>
                        </div>
                      </div>

                      {/* Seat Map — 2 col */}
                      <div className="md:col-span-2">
                        <h4 className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                          <Armchair className="w-3.5 h-3.5 text-brand-500" /> Seat Layout
                        </h4>
                        <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl border border-gray-100 p-4">
                          {/* Legend */}
                          <div className="flex justify-center gap-3 mb-3 pb-2 border-b border-gray-100">
                            <span className="flex items-center gap-1 text-[8px] font-bold text-gray-500 uppercase">
                              <span className="w-2 h-2 bg-brand-600 rounded block" /> Driver
                            </span>
                            <span className="flex items-center gap-1 text-[8px] font-bold text-gray-500 uppercase">
                              <span className="w-2 h-2 bg-white rounded border border-gray-300 block" /> Available
                            </span>
                          </div>

                          <SeatMap totalSeats={sc.totalSeats} />

                          <p className="text-center text-[9px] text-gray-400 mt-3">
                            {sc.totalSeats} seats · {Math.ceil(sc.totalSeats / 4)} rows
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {schedules.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
                <Megaphone className="w-6 h-6 text-gray-300" />
              </div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">No direct schedules yet</p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">Create a group booking schedule if you&apos;re running your own bus.</p>
              <Link href="/chatter/request">
                <button className="mt-4 h-8 px-4 bg-brand-700 hover:bg-brand-800 text-white font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all">
                  <Plus className="w-3 h-3 inline mr-1" /> Create Schedule
                </button>
              </Link>
            </div>
          )}
        </div>

      ) : (
        /* ════════════ REQUESTS TAB ════════════ */
        <div className="space-y-4">
          {requests.map((req) => {
            const statusStyle: Record<string, string> = {
              pending: 'text-amber-600 bg-amber-50 border-amber-100',
              confirmed: 'text-emerald-600 bg-emerald-50 border-emerald-100',
              rejected: 'text-red-600 bg-red-50 border-red-100',
            };
            const stripColor: Record<string, string> = { pending: 'bg-amber-400', confirmed: 'bg-emerald-500', rejected: 'bg-red-400' };

            return (
              <div key={req.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden">
                <div className={`h-1 ${stripColor[req.status] || 'bg-gray-300'}`} />
                <div className="p-5">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 border border-gray-100 flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5 text-slate-500" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-slate-800 truncate">{req.company?.name || 'Platform Company'}</h3>
                          <span className={`text-[8px] font-extrabold tracking-widest uppercase px-2 py-0.5 rounded-full border ${statusStyle[req.status] || 'text-gray-500 bg-gray-50 border-gray-100'}`}>
                            {req.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">Trip Request</p>
                      </div>
                    </div>

                    {req.status === 'confirmed' && req.resultingScheduleId && (
                      <Link href={`/book/${req.resultingScheduleId}`}>
                        <button className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[9px] uppercase tracking-wider rounded-lg transition-all active:scale-95">
                          Book Tickets
                        </button>
                      </Link>
                    )}
                  </div>

                  {/* Info bar */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="bg-slate-50 rounded-xl px-3 py-2 border border-gray-100/60">
                      <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Route</p>
                      <p className="text-[11px] font-bold text-slate-700 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-brand-500 shrink-0" />
                        <span className="truncate">{req.origin}</span>
                        <ArrowRight className="w-2.5 h-2.5 text-gray-300 shrink-0" />
                        <span className="truncate">{req.destination}</span>
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-xl px-3 py-2 border border-gray-100/60">
                      <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Date</p>
                      <p className="text-[11px] font-bold text-slate-700 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3 text-brand-500 shrink-0" />
                        {format(new Date(req.departureDate), 'EEE, MMM d')}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-xl px-3 py-2 border border-gray-100/60">
                      <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Pax</p>
                      <p className="text-[11px] font-bold text-slate-700 flex items-center gap-1 mt-0.5">
                        <Users className="w-3 h-3 text-brand-500 shrink-0" />
                        {req.seatsRequested || req.estimatedPax} seats
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-xl px-3 py-2 border border-gray-100/60">
                      <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Fare</p>
                      <p className="text-[11px] font-bold text-slate-700 flex items-center gap-1 mt-0.5">
                        <BadgeDollarSign className="w-3 h-3 text-brand-500 shrink-0" />
                        {req.confirmedPrice ? `MWK ${req.confirmedPrice.toLocaleString()}` : req.proposedFare ? `MWK ${req.proposedFare.toLocaleString()}` : 'TBD'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {requests.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
                <Building2 className="w-6 h-6 text-gray-300" />
              </div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">No requests yet</p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">Submit a trip request for platform buses.</p>
              <Link href="/chatter/request">
                <button className="mt-4 h-8 px-4 bg-brand-700 hover:bg-brand-800 text-white font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all">
                  <Plus className="w-3 h-3 inline mr-1" /> Request Trip
                </button>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ════════════ BOOKINGS MODAL ════════════ */}
      {modalScheduleId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setModalScheduleId(null)}>
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-gray-100" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Passenger Bookings & Live Map</h3>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {schedules.find((s) => s.id === modalScheduleId)?.busName} · {bookings.length} booking{bookings.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button onClick={() => setModalScheduleId(null)} className="w-7 h-7 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto flex-grow">
              {bookingsLoading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="w-7 h-7 text-brand-700 animate-spin mb-3" />
                  <p className="text-xs text-slate-400">Loading bookings…</p>
                </div>
              ) : bookingError ? (
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-xs text-red-600">{bookingError}</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
                  {/* Passenger list — 3 col */}
                  <div className="md:col-span-3 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Passenger List</span>
                      {bookings.length > 0 && (
                        <button
                          onClick={() => handleDownloadManifest(schedules.find((s) => s.id === modalScheduleId)!)}
                          className="h-7 px-2.5 bg-coral-500 hover:bg-coral-600 text-white font-bold text-[9px] uppercase tracking-wider rounded-lg transition-all flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" /> PDF
                        </button>
                      )}
                    </div>

                    {bookings.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 text-xs border border-dashed border-gray-100 rounded-xl bg-slate-50/50">
                        No bookings found for this schedule.
                      </div>
                    ) : (
                      <div className="border border-gray-100 rounded-xl overflow-hidden max-h-[400px] overflow-y-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-gray-100 bg-slate-50/50 text-[8px] text-gray-500 font-bold uppercase tracking-wider">
                              <th className="py-2 px-3">Seat</th>
                              <th className="py-2 px-3">Ref</th>
                              <th className="py-2 px-3">Name</th>
                              <th className="py-2 px-3">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bookings.map((b) => (
                              <tr key={b.id} className="border-b border-gray-50 text-slate-700 font-medium last:border-0 hover:bg-slate-50/50">
                                <td className="py-2 px-3 font-bold text-brand-700">{b.seatNumbers?.[0] || '—'}</td>
                                <td className="py-2 px-3 font-mono text-[9px] text-gray-500">{b.bookingReference}</td>
                                <td className="py-2 px-3 truncate max-w-[120px]">{b.passengerDetails?.[0]?.name || b.user?.firstName || 'Passenger'}</td>
                                <td className="py-2 px-3">
                                  <span className={`px-1.5 py-0.5 rounded-full text-[7px] font-bold uppercase ${
                                    b.paymentStatus === 'paid' ? 'text-emerald-600 bg-emerald-50' : 'text-amber-600 bg-amber-50'
                                  }`}>{b.paymentStatus}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Live seat map — 2 col */}
                  <div className="md:col-span-2">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-3">Live Seat Map</span>
                    <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl border border-gray-100 p-4">
                      <div className="flex justify-center gap-3 mb-3 pb-2 border-b border-gray-100">
                        <span className="flex items-center gap-1 text-[8px] font-bold text-gray-500 uppercase">
                          <span className="w-2 h-2 bg-emerald-500 rounded block" /> Paid
                        </span>
                        <span className="flex items-center gap-1 text-[8px] font-bold text-gray-500 uppercase">
                          <span className="w-2 h-2 bg-amber-400 rounded block" /> Pending
                        </span>
                        <span className="flex items-center gap-1 text-[8px] font-bold text-gray-500 uppercase">
                          <span className="w-2 h-2 bg-white rounded border border-gray-300 block" /> Empty
                        </span>
                      </div>
                      {(() => {
                        const sch = schedules.find((s) => s.id === modalScheduleId);
                        if (!sch) return null;
                        const paid = new Set(bookings.filter((b) => b.paymentStatus === 'paid').flatMap((b) => b.seatNumbers || []));
                        const pending = new Set(bookings.filter((b) => b.paymentStatus !== 'paid').flatMap((b) => b.seatNumbers || []));
                        return <SeatMap totalSeats={sch.totalSeats} bookedSeats={paid} pendingSeats={pending} compact />;
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
