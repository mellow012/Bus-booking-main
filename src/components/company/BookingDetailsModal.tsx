import React, { useEffect, useState } from 'react';
import { Booking } from '@/types';
import { X, Check, Loader2, Bell, MapPin, Calendar, Clock, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const toDate = (v: any): Date => {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  return new Date(v);
};

interface BookingDetailsModalProps {
  booking: Booking;
  routeLabel: string;
  departureTime: Date | null;
  busLabel: string;
  seatLabel: string;
  actionLoading: string | null;
  reminderLoading: string | null;
  onClose: () => void;
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
  onSendReminder: (booking: Booking) => void;
}

export default function BookingDetailsModal({
  booking,
  routeLabel,
  departureTime,
  busLabel,
  seatLabel,
  actionLoading,
  reminderLoading,
  onClose,
  onConfirm,
  onCancel,
  onSendReminder,
}: BookingDetailsModalProps) {
  const [segments, setSegments] = useState<any[]>([]);
  const [loadingSegs, setLoadingSegs] = useState(true);

  useEffect(() => {
    const fetchSegments = async () => {
      try {
        const { data, error } = await supabase
          .from('BookingSegment')
          .select('*, schedule:Schedule(*, route:Route(*), bus:Bus(*))')
          .eq('bookingId', booking.id)
          .order('segmentIndex', { ascending: true });
        if (!error && data) {
          setSegments(data);
        }
      } catch (err) {
        console.error("Error loading segments:", err);
      } finally {
        setLoadingSegs(false);
      }
    };
    fetchSegments();
  }, [booking.id]);

  const fmtDate = (d: Date) => d.toLocaleDateString("en-MW", { day: "numeric", month: "short", year: "numeric" });
  const fmtTime = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl rounded-3xl bg-white border border-gray-200 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-600">Booking Details</p>
            <h3 className="mt-2 text-xl font-bold text-gray-900">{booking.bookingReference}</h3>
            <p className="text-sm text-gray-500 mt-1">Passenger: {booking.passengerDetails?.[0]?.name || 'Unknown'}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid gap-6 p-6 md:grid-cols-2 max-h-[70vh] overflow-y-auto">
          {/* Trip Info & Segments */}
          <div className="space-y-4">
            <p className="text-sm font-bold text-gray-900">Journey Legs</p>
            {loadingSegs ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              </div>
            ) : segments.length > 0 ? (
              segments.map((seg, idx) => {
                const segDep = seg.schedule?.departureDateTime ? new Date(seg.schedule.departureDateTime) : null;
                const isReturnSeg = idx > 0;
                return (
                  <div key={seg.id} className={`p-4 rounded-2xl border ${isReturnSeg ? 'bg-amber-50/40 border-amber-100' : 'bg-indigo-50/50 border-indigo-100'}`}>
                    <p className={`text-[9px] font-bold uppercase tracking-widest mb-2 ${isReturnSeg ? 'text-amber-600' : 'text-indigo-600'}`}>
                      {isReturnSeg ? '↩ RETURN LEG' : '✈ OUTBOUND LEG'}
                    </p>
                    <div className="flex items-center gap-2 font-bold text-gray-950 text-xs uppercase">
                      <MapPin className={`w-3.5 h-3.5 shrink-0 ${isReturnSeg ? 'text-amber-500' : 'text-indigo-600'}`} />
                      {seg.schedule?.route?.origin || 'Unknown'}
                      <ArrowRight className="w-3 h-3 text-gray-300 shrink-0" />
                      {seg.schedule?.route?.destination || 'Unknown'}
                    </div>

                    {segDep && (
                      <div className="mt-3 flex items-center gap-4 text-xs font-semibold text-gray-700">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" /> {fmtDate(segDep)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-gray-400" /> {fmtTime(segDep)}
                        </span>
                      </div>
                    )}

                    <div className="mt-2 text-xs text-gray-600 flex flex-wrap gap-x-4">
                      <span>Bus: {seg.schedule?.bus?.licensePlate || 'N/A'} ({seg.schedule?.bus?.busType || 'Class'})</span>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Seats:</span>
                      <div className="flex flex-wrap gap-1">
                        {(Array.isArray(seg.seatNumbers) ? seg.seatNumbers : []).map((s: string) => (
                          <span key={s} className={`px-2 py-0.5 text-[10px] font-bold rounded-lg ${isReturnSeg ? 'bg-amber-600 text-white' : 'bg-indigo-600 text-white'}`}>
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              /* Fallback single trip card */
              <div className="space-y-4">
                <div className="rounded-3xl border border-indigo-100 bg-indigo-50/50 p-4">
                  <p className="text-[9px] font-bold uppercase tracking-widest mb-2 text-indigo-600">✈ OUTBOUND LEG</p>
                  <p className="text-sm font-bold text-gray-955 uppercase">{routeLabel}</p>
                  <p className="text-xs text-gray-700 mt-2">
                    {departureTime ? departureTime.toLocaleString() : 'Departure not available'}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">Bus: {busLabel}</p>
                  <p className="text-xs text-gray-600 mt-1">Seat(s): {seatLabel}</p>
                </div>

                {/* Legacy Return Trip Leg Fallback */}
                {((booking as any).returnDate || (booking as any).metadata?.returnDate) && (() => {
                  const retDate = toDate((booking as any).returnDate || (booking as any).metadata?.returnDate);
                  const revRoute = routeLabel.split('→').map(s => s.trim()).reverse().join(' → ');
                  const retSeats = (booking as any).metadata?.returnSeatNumbers || booking.seatNumbers || [];
                  return (
                    <div className="rounded-3xl border border-amber-100 bg-amber-50/40 p-4">
                      <p className="text-[9px] font-bold uppercase tracking-widest mb-2 text-amber-600">↩ RETURN LEG</p>
                      <p className="text-sm font-bold text-gray-955 uppercase">{revRoute}</p>
                      <p className="text-xs text-gray-700 mt-2">
                        {retDate ? retDate.toLocaleDateString("en-MW", { day: "numeric", month: "short", year: "numeric" }) : 'Return date not available'}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">Bus: {busLabel} (Return)</p>
                      <p className="text-xs text-gray-600 mt-1">
                        Seat(s): {Array.isArray(retSeats) ? retSeats.join(', ') : String(retSeats)}
                      </p>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Customer Contact Card */}
            <div className="rounded-3xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-500">Customer</p>
              <p className="mt-3 text-sm font-semibold text-gray-900">{booking.passengerDetails?.[0]?.name || 'Guest'}</p>
              <p className="text-sm text-gray-500">{booking.contactEmail || 'No email'}</p>
              <p className="text-sm text-gray-500">{booking.contactPhone || 'No phone'}</p>
            </div>
          </div>

          {/* Booking & Passenger Status */}
          <div className="space-y-4">
            <div className="rounded-3xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-500">Booking status</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">{booking.bookingStatus}</span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${booking.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {booking.paymentStatus}
                </span>
              </div>
              <p className="mt-3 text-sm text-gray-500">Total Seats: {booking.seatNumbers?.join(', ') || 'Auto assigned'}</p>
              <p className="mt-2 text-sm text-gray-500">Amount: MWK {booking.totalAmount?.toLocaleString()}</p>
            </div>
            <div className="rounded-3xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-500">Passenger details</p>
              <div className="mt-3 space-y-3 text-sm text-gray-700 max-h-40 overflow-y-auto">
                {booking.passengerDetails?.map((passenger, index) => (
                  <div key={index} className="rounded-2xl bg-white p-3 border border-gray-100">
                    <p className="font-semibold text-gray-900">{passenger.name}</p>
                    <p className="text-xs text-gray-500">Seat: {passenger.seatNumber || 'N/A'}</p>
                    {passenger.contactNumber && <p className="text-xs text-gray-500">Phone: {passenger.contactNumber}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 p-6 border-t border-gray-100 bg-gray-50 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-900">Actions</p>
            <p className="text-sm text-gray-500">Use the controls below to confirm, cancel, or remind the passenger.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            {booking.bookingStatus === 'pending' && (
              <button
                type="button"
                onClick={() => onConfirm(booking.id)}
                disabled={actionLoading === booking.id}
                className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {actionLoading === booking.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Confirm
              </button>
            )}
            {(booking.bookingStatus === 'pending' || booking.bookingStatus === 'confirmed') && (
              <button
                type="button"
                onClick={() => onCancel(booking.id)}
                disabled={actionLoading === booking.id}
                className="inline-flex items-center justify-center rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {actionLoading === booking.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                Cancel
              </button>
            )}
            {booking.paymentStatus !== 'paid' && (
              <button
                type="button"
                onClick={() => onSendReminder(booking)}
                disabled={reminderLoading === booking.id}
                className="inline-flex items-center justify-center rounded-2xl border border-indigo-200 bg-white px-5 py-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
              >
                {reminderLoading === booking.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}
                Send Reminder
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

