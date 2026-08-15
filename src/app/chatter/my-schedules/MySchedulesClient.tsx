'use client';

import React, { useState } from 'react';
import {
  Calendar, MapPin, Users, Share2, Download,
  ArrowRight, Check, X, Megaphone, Loader2, Info, Plus, Bus, Building2
} from 'lucide-react';
import { format } from 'date-fns';
import { toDate } from '@/lib/chatterHelpers';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { exportBookingsAsCsv } from '@/lib/exportCsv';
import { deleteChatterSchedule } from '@/lib/actions/chatter.actions';

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

export default function MySchedulesClient({ initialSchedules, initialRequests }: MySchedulesClientProps) {
  const router = useRouter();
  const [schedules, setSchedules] = useState<ChatterSchedule[]>(initialSchedules);
  const [requests] = useState<ChatterRequest[]>(initialRequests);
  const [activeTab, setActiveTab] = useState<'schedules' | 'requests'>('schedules');

  // Bookings list state
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const totalSeatsAcrossSchedules = schedules.reduce((sum, schedule) => sum + schedule.totalSeats, 0);

  

  const handleShare = async (id: string, busName: string, origin: string, destination: string) => {
    const shareUrl = `${window.location.origin}/chatter/${id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Book seats: ${origin} to ${destination}`,
          text: `Check out this group booking trip for ${busName}!`,
          url: shareUrl,
        });
      } catch (err) {
        console.error('Share failed', err);
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      alert('Link copied to clipboard!');
    }
  };

  const handleViewBookings = async (id: string) => {
    setSelectedScheduleId(id);
    setBookingsLoading(true);
    setBookingError(null);
    try {
      const res = await fetch(`/api/chatter/schedules/${id}/bookings`);
      const json = await res.json();
      if (json.success) {
        setBookings(json.data || []);
      } else {
        setBookingError(json.error || 'Failed to load bookings.');
      }
    } catch (err: any) {
      setBookingError(err.message || 'Something went wrong.');
    } finally {
      setBookingsLoading(false);
    }
  };

  const handleDownloadManifest = (schedule: ChatterSchedule) => {
    const manifestBookings = bookings.map((b) => ({
      bookingReference: b.bookingReference,
      passengerName: b.passengerDetails?.[0]?.name || b.user?.firstName || 'Passenger',
      contactPhone: b.contactPhone || '',
      seat: b.seatNumbers?.[0] || 'N/A',
      paymentStatus: b.paymentStatus || 'pending',
      createdAt: b.bookingDate || b.createdAt,
    }));
    exportBookingsAsCsv(manifestBookings, `${schedule.busName}_manifest_${schedule.id.slice(0, 8)}.csv`);
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this schedule?')) return;
    try {
      const res = await deleteChatterSchedule(id);
      if (res.success) {
        setSchedules(prev => prev.filter(s => s.id !== id));
        router.refresh();
      } else {
        alert(res.error || 'Failed to delete schedule.');
      }
    } catch (err: any) {
      alert(err.message || 'Something went wrong.');
    }
  };

  // Helper to render Seat Map inside the Bookings Dialog
  const renderInteractiveSeatMap = (schedule: ChatterSchedule) => {
    const total = schedule.totalSeats;
    if (!total || total <= 0 || total > 100) return null;

    const seatsPerRow = 4;
    const rowsCount = Math.ceil(total / seatsPerRow);

    // Parse booked seats list
    const bookedSeatNumbers = new Set(
      bookings
        .filter(b => b.paymentStatus === 'paid')
        .flatMap(b => b.seatNumbers || [])
    );
    const pendingSeatNumbers = new Set(
      bookings
        .filter(b => b.paymentStatus !== 'paid')
        .flatMap(b => b.seatNumbers || [])
    );

    return (
      <div className="border border-gray-100 bg-slate-50/50 rounded-2xl p-4">
        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Live Seat Occupation Map</h4>
        <div className="flex flex-wrap gap-4 mb-4 pb-2 border-b border-gray-200/60 justify-center">
          <span className="flex items-center gap-1 text-[10px] font-bold text-gray-500 uppercase">
            <span className="w-2.5 h-2.5 bg-brand-500 rounded block"></span> Driver
          </span>
          <span className="flex items-center gap-1 text-[10px] font-bold text-gray-500 uppercase">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded block"></span> Paid
          </span>
          <span className="flex items-center gap-1 text-[10px] font-bold text-gray-500 uppercase">
            <span className="w-2.5 h-2.5 bg-amber-500 rounded block"></span> Pending
          </span>
          <span className="flex items-center gap-1 text-[10px] font-bold text-gray-500 uppercase">
            <span className="w-2.5 h-2.5 bg-white rounded border border-gray-300 block"></span> Empty
          </span>
        </div>

        {/* Bus shell grid */}
        <div className="max-w-[240px] mx-auto border-4 border-slate-300 rounded-t-3xl rounded-b-xl bg-white p-3.5 shadow-inner">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-3">
            <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center text-[9px] font-black text-white shadow-sm">
              steering
            </div>
            <div className="h-5 w-10 bg-slate-100 rounded border border-slate-200 text-[8px] uppercase tracking-wider text-slate-400 font-bold flex items-center justify-center">
              Door
            </div>
          </div>

          <div className="space-y-2.5">
            {Array.from({ length: rowsCount }).map((_, rowIndex) => {
              const rowStartIdx = rowIndex * seatsPerRow;
              const rowSeats = Array.from({ length: total }, (_, i) => String(i + 1)).slice(rowStartIdx, rowStartIdx + seatsPerRow);

              return (
                <div key={rowIndex} className="flex justify-between items-center gap-1.5">
                  {/* Left row (1 & 2) */}
                  <div className="flex gap-1.5 w-2/5 justify-end">
                    {rowSeats.slice(0, 2).map((seatNum) => {
                      const isPaid = bookedSeatNumbers.has(seatNum);
                      const isPending = pendingSeatNumbers.has(seatNum);
                      let seatBg = 'bg-white text-slate-700 border-gray-300';
                      if (isPaid) seatBg = 'bg-emerald-500 text-white border-emerald-600';
                      else if (isPending) seatBg = 'bg-amber-500 text-white border-amber-600';

                      return (
                        <div
                          key={seatNum}
                          className={`w-7 h-7 rounded-md border flex items-center justify-center text-[9px] font-bold shadow-sm transition-all ${seatBg}`}
                          title={`Seat ${seatNum} - ${isPaid ? 'Paid' : isPending ? 'Pending' : 'Available'}`}
                        >
                          {seatNum}
                        </div>
                      );
                    })}
                  </div>

                  <div className="w-1/5 text-center text-[7px] font-bold text-gray-300 uppercase tracking-widest">
                    Aisle
                  </div>

                  {/* Right row (3 & 4) */}
                  <div className="flex gap-1.5 w-2/5 justify-start">
                    {rowSeats.slice(2, 4).map((seatNum) => {
                      const isPaid = bookedSeatNumbers.has(seatNum);
                      const isPending = pendingSeatNumbers.has(seatNum);
                      let seatBg = 'bg-white text-slate-700 border-gray-300';
                      if (isPaid) seatBg = 'bg-emerald-500 text-white border-emerald-600';
                      else if (isPending) seatBg = 'bg-amber-500 text-white border-amber-600';

                      return (
                        <div
                          key={seatNum}
                          className={`w-7 h-7 rounded-md border flex items-center justify-center text-[9px] font-bold shadow-sm transition-all ${seatBg}`}
                          title={`Seat ${seatNum} - ${isPaid ? 'Paid' : isPending ? 'Pending' : 'Available'}`}
                        >
                          {seatNum}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">

      <div className="rounded-[2rem] border border-brand-100 bg-brand-50/80 p-6 lg:p-8 shadow-2xl shadow-brand-500/10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-700">Chatter Control Centre</p>
            <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Manage your group schedules with confidence</h1>
            <p className="mt-3 text-sm text-slate-500 max-w-2xl">Every active trip can be shared, managed, and reviewed from a single premium dashboard. Expand any schedule to inspect its live seat layout, trip stats, and comms details.</p>
          </div>
          <Link href="/chatter/request" className="inline-flex items-center justify-center rounded-3xl bg-coral-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-coral-500/25 hover:bg-coral-600 transition-colors">
            <Plus className="w-4 h-4 mr-2" /> Request a trip
          </Link>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-brand-100 bg-white p-5 shadow-sm">
            <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400 font-bold">Active schedules</div>
            <div className="mt-4 text-4xl font-extrabold text-slate-900">{schedules.length}</div>
            <p className="mt-2 text-sm text-slate-500">Direct group routes ready for sharing.</p>
          </div>
          <div className="rounded-3xl border border-brand-100 bg-white p-5 shadow-sm">
            <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400 font-bold">Open requests</div>
            <div className="mt-4 text-4xl font-extrabold text-slate-900">{requests.length}</div>
            <p className="mt-2 text-sm text-slate-500">Company trip requests pending operator matching.</p>
          </div>
          <div className="rounded-3xl border border-brand-100 bg-white p-5 shadow-sm">
            <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400 font-bold">Total seats</div>
            <div className="mt-4 text-4xl font-extrabold text-slate-900">{totalSeatsAcrossSchedules}</div>
            <p className="mt-2 text-sm text-slate-500">Capacity across all published trips.</p>
          </div>
        </div>
      </div>

      <div className="flex gap-1.5">
        <button
          onClick={() => setActiveTab('schedules')}
          className={`flex-1 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest py-3 rounded-xl border transition-all duration-200 ${activeTab === 'schedules'
              ? 'bg-brand-700 text-white border-brand-700 shadow-md shadow-brand-50'
              : 'bg-gray-50 text-gray-500 border-gray-100 hover:border-brand-100 hover:text-brand-700 hover:bg-white'
            }`}
        >
          <Bus className="w-3.5 h-3.5" />
          My Direct Schedules
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`flex-1 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest py-3 rounded-xl border transition-all duration-200 ${activeTab === 'requests'
              ? 'bg-brand-700 text-white border-brand-700 shadow-md shadow-brand-50'
              : 'bg-gray-50 text-gray-500 border-gray-100 hover:border-brand-100 hover:text-brand-700 hover:bg-white'
            }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          Company Trip Requests
        </button>
      </div>

      {activeTab === 'schedules' ? (
        <div className="grid gap-6">
          {schedules.map((schedule) => {
            const isExpanded = selectedScheduleId === schedule.id;
            const isExpired = schedule.travelDate ? new Date(schedule.travelDate) < new Date() : false;
            const paidBookings = bookings.filter(b => b.paymentStatus === 'paid').length;
            const pendingBookings = bookings.filter(b => b.paymentStatus !== 'paid').length;
            const occupancyLabel = bookings.length > 0 ? `${bookings.length}/${schedule.totalSeats} seats` : 'Tap to view live bookings';
            const displayStatus = isExpired ? 'Expired' : schedule.status;
            const statusClasses = isExpired
              ? 'bg-rose-50 text-rose-700 border border-rose-200'
              : schedule.status === 'confirmed'
                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                : schedule.status === 'pending'
                  ? 'bg-amber-50 text-amber-800 border border-amber-100'
                  : 'bg-slate-100 text-slate-700 border border-slate-200';

            return (
              <div key={schedule.id} className={`relative overflow-hidden rounded-[2rem] border ${isExpanded ? 'border-brand-200 bg-brand-50/80 shadow-2xl shadow-brand-500/10' : 'border-gray-100 bg-white shadow-xl'} transition-all hover:-translate-y-0.5 ${isExpired ? 'opacity-85' : ''}`}>
                <div className={`absolute inset-x-0 top-0 h-1 ${isExpired ? 'bg-slate-300' : 'bg-gradient-to-r from-brand-600 via-brand-700 to-brand-800'}`}></div>
                <div className="relative p-6 lg:p-8 space-y-6">
                  <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
                    <div className="flex-1 space-y-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="px-3 py-1.5 rounded-full bg-brand-50 text-brand-700 text-[10px] font-semibold uppercase tracking-[0.2em]">Direct Schedule</span>
                        <span className={`px-3 py-1.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.2em] ${statusClasses}`}>{displayStatus}</span>
                      </div>
                      <div className="space-y-3">
                        <h3 className="text-2xl font-extrabold text-slate-900">{schedule.busName}</h3>
                        <p className="text-sm text-slate-500 max-w-2xl">Premium group travel route for your booked passengers, designed for easy sharing and smooth operations.</p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        <div className="rounded-3xl border border-gray-100 bg-slate-50 p-4">
                          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400 font-bold">Route</p>
                          <p className="mt-3 text-sm font-semibold text-slate-900 flex items-center gap-2"><MapPin className="w-4 h-4 text-brand-600" />{schedule.origin} <ArrowRight className="w-3 h-3 inline" /> {schedule.destination}</p>
                        </div>
                        <div className="rounded-3xl border border-gray-100 bg-slate-50 p-4">
                          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400 font-bold">Departure</p>
                          {(() => {
                            const d = toDate(schedule.travelDate);
                            return (
                              <p className="mt-3 text-sm font-semibold text-slate-900 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-brand-600" />
                                {d ? format(d, 'EEE, MMM d') : 'TBD'}
                              </p>
                            );
                          })()}
                        </div>
                        <div className="rounded-3xl border border-gray-100 bg-slate-50 p-4">
                          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400 font-bold">Fare</p>
                          <p className="mt-3 text-sm font-semibold text-slate-900">MK {schedule.fare.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>

                    <div className="w-full xl:w-[340px] space-y-4">
                      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between text-slate-500 text-xs uppercase tracking-[0.25em] font-bold">Trip snapshot</div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-3xl bg-slate-50 p-4">
                            <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400 font-semibold">Capacity</p>
                            <p className="mt-2 text-2xl font-bold text-slate-900">{schedule.totalSeats}</p>
                          </div>
                          <div className="rounded-3xl bg-slate-50 p-4">
                            <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400 font-semibold">Live occupancy</p>
                            <p className="mt-2 text-2xl font-bold text-slate-900">{occupancyLabel}</p>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                        <div className="flex items-center justify-between text-slate-500 text-xs uppercase tracking-[0.25em] font-bold">Seat preview</div>
                        <div className="mt-4 grid grid-cols-4 gap-2">
                          {Array.from({ length: 8 }).map((_, index) => (
                            <div key={index} className="h-10 rounded-2xl border border-slate-200 bg-white flex items-center justify-center text-xs font-bold text-slate-500">
                              {index + 1}
                            </div>
                          ))}
                        </div>
                        <p className="mt-3 text-xs text-slate-500">Open a schedule to render the full seat layout and passenger details.</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <button
                      onClick={() => isExpanded ? setSelectedScheduleId(null) : handleViewBookings(schedule.id)}
                      className="flex items-center justify-center gap-2 rounded-3xl border border-brand-200 bg-brand-700 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/10 hover:bg-brand-800 transition-colors"
                    >
                      {isExpanded ? 'Hide details' : 'View bookings'}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleShare(schedule.id, schedule.busName, schedule.origin, schedule.destination)}
                      className="flex items-center justify-center gap-2 rounded-3xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <Share2 className="w-4 h-4 text-brand-700" /> Share link
                    </button>
                    <button
                      onClick={() => handleDeleteSchedule(schedule.id)}
                      className="flex items-center justify-center gap-2 rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors"
                    >
                      <X className="w-4 h-4" /> Delete
                    </button>
                    {isExpanded && bookings.length > 0 && (
                      <button
                        onClick={() => handleDownloadManifest(schedule)}
                        className="flex items-center justify-center gap-2 rounded-3xl border border-brand-200 bg-coral-500 px-4 py-3 text-sm font-semibold text-white hover:bg-coral-600 transition-colors"
                      >
                        <Download className="w-4 h-4" /> Download manifest
                      </button>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="rounded-[2rem] border border-brand-100 bg-white p-6 shadow-sm">
                      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                        <div className="space-y-5">
                          <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400 font-semibold">About this bus</p>
                                <h4 className="mt-3 text-lg font-bold text-slate-900">Premium rider experience</h4>
                              </div>
                              <span className={`rounded-2xl px-3 py-1 text-xs font-semibold ${statusClasses}`}>{schedule.status}</span>
                            </div>
                            <div className="mt-5 grid gap-3 sm:grid-cols-2">
                              <div className="rounded-3xl bg-white p-4 border border-slate-100">
                                <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400 font-bold">Operator contact</p>
                                <p className="mt-2 text-sm font-semibold text-slate-900">{schedule.contactPhone}</p>
                              </div>
                              <div className="rounded-3xl bg-white p-4 border border-slate-100">
                                <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400 font-bold">Created</p>
                                {(() => {
                                  const d = toDate(schedule.createdAt);
                                  return <p className="mt-2 text-sm font-semibold text-slate-900">{d ? format(d, 'MMM d, yyyy') : 'Unknown'}</p>;
                                })()}
                              </div>
                              <div className="rounded-3xl bg-white p-4 border border-slate-100">
                                <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400 font-bold">Estimated passengers</p>
                                <p className="mt-2 text-sm font-semibold text-slate-900">{bookings.length || '—'}</p>
                              </div>
                              <div className="rounded-3xl bg-white p-4 border border-slate-100">
                                <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400 font-bold">Trip revenue</p>
                                <p className="mt-2 text-sm font-semibold text-slate-900">MK {((paidBookings + pendingBookings) * schedule.fare).toLocaleString()}</p>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-3xl border border-slate-100 bg-white p-5">
                            <div className="flex items-center gap-3 text-slate-900 font-semibold">
                              <Info className="w-4 h-4 text-brand-600" />
                              <span>Trip details</span>
                            </div>
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              <div className="rounded-3xl bg-brand-50 p-4">
                                <p className="text-[10px] uppercase tracking-[0.3em] text-brand-700 font-semibold">Seats paid</p>
                                <p className="mt-2 text-2xl font-bold text-slate-900">{paidBookings}</p>
                              </div>
                              <div className="rounded-3xl bg-amber-50 p-4">
                                <p className="text-[10px] uppercase tracking-[0.3em] text-amber-700 font-semibold">Seats pending</p>
                                <p className="mt-2 text-2xl font-bold text-slate-900">{pendingBookings}</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-5">
                          <div className="rounded-3xl bg-brand-950 p-5 text-white shadow-xl">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-[10px] uppercase tracking-[0.3em] text-brand-300 font-semibold">Live manifest</p>
                                <h4 className="mt-3 text-xl font-bold">Booking flow</h4>
                              </div>
                              <div className="rounded-3xl bg-brand-800 px-3 py-2 text-xs uppercase tracking-[0.3em] text-brand-100">Updated live</div>
                            </div>
                            <div className="mt-6 grid gap-3">
                              <div className="rounded-3xl bg-brand-900/90 p-4">
                                <p className="text-[10px] uppercase tracking-[0.3em] text-brand-300">Paid seats</p>
                                <p className="mt-2 text-3xl font-bold">{paidBookings}</p>
                              </div>
                              <div className="rounded-3xl bg-white/10 p-4">
                                <p className="text-[10px] uppercase tracking-[0.3em] text-brand-200">Pending seats</p>
                                <p className="mt-2 text-3xl font-bold text-white">{pendingBookings}</p>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                            {bookingsLoading ? (
                              <div className="flex flex-col items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 text-brand-700 animate-spin mb-3" />
                                <p className="text-xs text-slate-500 font-medium">Loading passenger manifest…</p>
                              </div>
                            ) : bookingError ? (
                              <div className="rounded-3xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                                {bookingError}
                              </div>
                            ) : (
                              renderInteractiveSeatMap(schedule)
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {schedules.length === 0 && (
            <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-gray-200">
              <Megaphone className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">No direct schedules yet</p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">Create a direct group booking schedule if you are running your own bus.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {requests.map((req) => (
            <div key={req.id} className="bg-slate-50/50 rounded-2xl p-5 border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all hover:bg-slate-50">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-extrabold tracking-widest text-brand-700 uppercase bg-brand-50 border border-brand-100/50 px-2.5 py-1 rounded-full">
                    Requested Trip
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${req.status === 'pending'
                      ? 'text-amber-600 bg-amber-50'
                      : req.status === 'confirmed'
                        ? 'text-emerald-600 bg-emerald-50'
                        : 'text-red-600 bg-red-50'
                    }`}>
                    {req.status}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-800 pt-1">
                  {req.company?.name || 'Platform Company'}
                </h3>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-gray-400" />
                    <span>{req.origin} <ArrowRight className="w-3 h-3 inline mx-0.5" /> {req.destination}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    <span>{(() => { const d = toDate(req.departureDate); return d ? format(d, 'MMM d, yyyy') : 'TBD'; })()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-gray-400" />
                    <span>{req.seatsRequested || req.estimatedPax} Seats</span>
                  </div>
                </div>
              </div>

              {req.status === 'confirmed' && req.resultingScheduleId && (
                <Link href={`/book/${req.resultingScheduleId}`} className="w-full md:w-auto">
                  <button className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md w-full">
                    Book Tickets
                  </button>
                </Link>
              )}
            </div>
          ))}

          {requests.length === 0 && (
            <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-gray-200">
              <Megaphone className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">No requests yet</p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">Submit a trip request to operators if you want to book seats on platform buses.</p>
            </div>
          )}
        </div>
      )}

      {/* Bookings Modal / Live Seat Map Drawer */}
      {selectedScheduleId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-slate-100">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-slate-800">Passenger Bookings & Live Map</h3>
                <p className="text-xs text-slate-400">View passengers and current seat occupancies</p>
              </div>
              <button
                onClick={() => setSelectedScheduleId(null)}
                className="w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 text-xs font-bold transition-all"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-grow space-y-5">
              {bookingsLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-brand-700 animate-spin mb-3" />
                  <p className="text-xs text-slate-400 font-medium">Fetching manifest bookings...</p>
                </div>
              ) : bookingError ? (
                <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-xs text-red-600">
                  {bookingError}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Left Column: List and Manifest Download */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Passenger List</span>
                      {bookings.length > 0 && (
                        <button
                          onClick={() => handleDownloadManifest(schedules.find(s => s.id === selectedScheduleId)!)}
                          className="h-8 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" /> Manifest CSV
                        </button>
                      )}
                    </div>

                    {bookings.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 text-xs border border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                        No bookings found for this schedule.
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-slate-100 rounded-xl bg-white shadow-sm max-h-[300px] overflow-y-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-500 font-bold uppercase tracking-wider">
                              <th className="py-2.5 px-3">Seat</th>
                              <th className="py-2.5 px-3">Ref</th>
                              <th className="py-2.5 px-3">Name</th>
                              <th className="py-2.5 px-3">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bookings.map((b) => (
                              <tr key={b.id} className="border-b border-slate-50 text-slate-700 font-medium last:border-b-0 hover:bg-slate-50/50">
                                <td className="py-2.5 px-3 font-bold text-brand-700">
                                  {b.seatNumbers?.[0] || 'N/A'}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[10px] text-gray-500">{b.bookingReference}</td>
                                <td className="py-2.5 px-3 truncate max-w-[100px]">{b.passengerDetails?.[0]?.name || b.user?.firstName || 'Passenger'}</td>
                                <td className="py-2.5 px-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider ${b.paymentStatus === 'paid'
                                      ? 'text-emerald-600 bg-emerald-50'
                                      : 'text-amber-600 bg-amber-50'
                                    }`}>
                                    {b.paymentStatus}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Seat Map Grid */}
                  <div>
                    {renderInteractiveSeatMap(schedules.find(s => s.id === selectedScheduleId)!)}
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
