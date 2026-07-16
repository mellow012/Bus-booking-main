'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Schedule, Booking, Route, Bus } from '@/types';
import {
  Calendar, Users, Bus as BusIcon, TrendingUp, AlertCircle,
  ArrowRight, MapPin, Clock, CheckCircle, XCircle, Loader2
} from 'lucide-react';
import * as dbActions from '@/lib/actions/db.actions';
import BookingDetailsModal from '@/components/company/BookingDetailsModal';
import { useAppToast } from '@/contexts/ToastContext';

interface HomeTabProps {
  dashboard: any;
}

export default function HomeTab({ dashboard }: HomeTabProps) {
  const { schedules, bookings, assignedRoutes: routes, buses, navigateTo, navigateToBookings } = dashboard;
  const toast = useAppToast();

  const now = new Date();
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);

  const todaysSchedules = useMemo(() =>
    schedules
      .filter((s: Schedule) => {
        const d = new Date(s.departureDateTime);
        return d >= todayStart && d <= todayEnd;
      })
      .sort((a: Schedule, b: Schedule) =>
        new Date(a.departureDateTime).getTime() - new Date(b.departureDateTime).getTime()
      ),
  [schedules]);

  const upcomingSchedules = useMemo(() =>
    schedules
      .filter((s: Schedule) => new Date(s.departureDateTime) > now)
      .sort((a: Schedule, b: Schedule) =>
        new Date(a.departureDateTime).getTime() - new Date(b.departureDateTime).getTime()
      )
      .slice(0, 3),
  [schedules]);

  const todaysBookings = useMemo(() =>
    bookings.filter((b: Booking) => {
      const d = new Date(b.createdAt);
      return d >= todayStart && d <= todayEnd;
    }),
  [bookings]);

  const paidRevenue = useMemo(() =>
    todaysBookings
      .filter((b: Booking) => b.paymentStatus === 'paid')
      .reduce((acc: number, b: Booking) => acc + (b.totalAmount || 0), 0),
  [todaysBookings]);

  const pendingBookings = useMemo(() =>
    bookings.filter((b: Booking) => b.bookingStatus === 'pending').slice(0, 6),
  [bookings]);

  const latestBookings = useMemo(() =>
    [...bookings]
      .sort((a: Booking, b: Booking) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8),
  [bookings]);

  const schedulesWithoutBuses = todaysSchedules.filter((s: Schedule) => !s.busId);

  // Booking modal state
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [reminderLoading, setReminderLoading] = useState<string | null>(null);

  const handleOpenBooking = (booking: Booking) => setSelectedBooking(booking);
  const handleCloseBooking = () => setSelectedBooking(null);

  const handleConfirmBooking = async (bookingId: string) => {
    setActionLoading(bookingId);
    try {
      const result = await dbActions.updateBooking(bookingId, { bookingStatus: 'confirmed', confirmedDate: new Date() });
      if (!result.success) throw new Error(result.error || 'Failed to confirm');
      dashboard.showAlert('success', 'Booking confirmed.');
      if (selectedBooking?.id === bookingId) setSelectedBooking({ ...selectedBooking, bookingStatus: 'confirmed' });
    } catch (err: any) {
      dashboard.showAlert('error', err.message || 'Failed to confirm.');
    } finally { setActionLoading(null); }
  };

  const confirmCancelBooking = async (bookingId: string) => {
    setActionLoading(bookingId);
    try {
      const result = await dbActions.updateBooking(bookingId, { bookingStatus: 'cancelled', cancellationDate: new Date() });
      if (!result.success) throw new Error(result.error || 'Failed to cancel');
      dashboard.showAlert('success', 'Booking cancelled.');
      if (selectedBooking?.id === bookingId) setSelectedBooking({ ...selectedBooking, bookingStatus: 'cancelled' });
    } catch (err: any) {
      dashboard.showAlert('error', err.message || 'Failed to cancel.');
    } finally { setActionLoading(null); }
  };

  const handleCancelBooking = (bookingId: string) => {
    let toastId = '';
    toastId = toast.addToast(
      'Confirm cancellation',
      'Cancel this booking? This cannot be undone.',
      'warning',
      0,
      {
        label: 'Confirm',
        onClick: async () => {
          toast.removeToast(toastId);
          await confirmCancelBooking(bookingId);
        },
      }
    );
  };

  const handleSendReminder = async (booking: Booking) => {
    setReminderLoading(booking.id);
    try {
      await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientIds: [booking.userId],
          title: 'Payment Reminder',
          body: `Your booking ${booking.bookingReference} is awaiting payment.`,
          data: { bookingId: booking.id, type: 'payment_reminder' },
        })
      });
      dashboard.showAlert('success', 'Reminder sent.');
    } catch (err: any) {
      dashboard.showAlert('error', err.message || 'Failed to send reminder.');
    } finally { setReminderLoading(null); }
  };

  const selectedBookingSchedule = selectedBooking ? schedules.find((s: Schedule) => s.id === selectedBooking.scheduleId) : null;
  const selectedBookingRoute = selectedBookingSchedule
    ? routes.find((r: Route) => r.id === selectedBookingSchedule.routeId)
    : selectedBooking ? routes.find((r: Route) => r.id === selectedBooking.routeId) : null;
  const selectedBookingBus = selectedBookingSchedule ? buses.find((b: Bus) => b.id === selectedBookingSchedule.busId) : null;
  const selectedBookingRouteLabel = selectedBookingRoute ? `${selectedBookingRoute.origin} → ${selectedBookingRoute.destination}` : 'Unknown Route';
  const selectedBookingDepartureTime = selectedBookingSchedule?.departureDateTime ? new Date(selectedBookingSchedule.departureDateTime) : null;
  const selectedBookingBusLabel = selectedBookingBus?.licensePlate || 'Unassigned';
  const selectedBookingSeatLabel = selectedBooking?.seatNumbers?.length ? selectedBooking.seatNumbers.join(', ') : 'Auto-assigned';

  const tripStatusConfig: Record<string, { label: string; color: string; dot: string }> = {
    scheduled: { label: 'Scheduled', color: 'bg-indigo-50 text-indigo-700', dot: 'bg-indigo-500' },
    boarding: { label: 'Boarding', color: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500 animate-pulse' },
    in_transit: { label: 'In Transit', color: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500 animate-pulse' },
    arrived: { label: 'Arrived', color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
    cancelled: { label: 'Cancelled', color: 'bg-red-50 text-red-600', dot: 'bg-red-400' },
    active: { label: 'Active', color: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* Alert Banner */}
      {schedulesWithoutBuses.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800 font-medium flex-1">
            <span className="font-bold">{schedulesWithoutBuses.length} schedule{schedulesWithoutBuses.length > 1 ? 's' : ''}</span> departing today without an assigned bus.
          </p>
          <button
            onClick={() => navigateTo?.('routes')}
            className="text-xs font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1 whitespace-nowrap"
          >
            Fix now <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Today's Trips", value: todaysSchedules.length, icon: Calendar, bg: 'bg-indigo-50', color: 'text-indigo-600' },
          { label: "Bookings Today", value: todaysBookings.length, icon: Users, bg: 'bg-violet-50', color: 'text-violet-600' },
          { label: "Pending Actions", value: pendingBookings.length, icon: Loader2, bg: 'bg-amber-50', color: 'text-amber-600' },
          { label: "Revenue Today", value: `MWK ${paidRevenue.toLocaleString()}`, icon: TrendingUp, bg: 'bg-emerald-50', color: 'text-emerald-600', wide: true },
        ].map(({ label, value, icon: Icon, bg, color, wide }) => (
          <div key={label} className={`bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4 transition-all hover:shadow-md hover:border-gray-200 ${wide ? 'col-span-2 lg:col-span-1' : ''}`}>
            <div className={`w-11 h-11 ${bg} rounded-xl flex items-center justify-center shrink-0`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider truncate">{label}</div>
              <div className="text-xl font-bold text-gray-900 mt-0.5 truncate">{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content — 2 col on large */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Bookings Feed — wider main column */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Recent Bookings</h3>
              <p className="text-xs text-gray-400 mt-0.5">{latestBookings.length} most recent across all trips</p>
            </div>
            <button
              onClick={() => navigateToBookings?.()}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 flex items-center gap-1"
            >
              All bookings <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {latestBookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-gray-400">
              <Users className="w-10 h-10 mb-3 text-gray-200" />
              <p className="text-sm font-medium">No bookings yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {latestBookings.map((booking: Booking) => {
                const schedule = schedules.find((s: Schedule) => s.id === booking.scheduleId);
                const route = schedule ? routes.find((r: Route) => r.id === schedule.routeId) : null;
                const statusColors: Record<string, string> = {
                  confirmed: 'bg-emerald-100 text-emerald-700',
                  pending: 'bg-amber-100 text-amber-700',
                  cancelled: 'bg-red-100 text-red-600',
                };
                const payColors: Record<string, string> = {
                  paid: 'bg-emerald-50 text-emerald-600',
                  pending: 'bg-amber-50 text-amber-600',
                  failed: 'bg-red-50 text-red-600',
                };
                const dep = schedule?.departureDateTime ? new Date(schedule.departureDateTime) : null;

                return (
                  <button
                    key={booking.id}
                    onClick={() => handleOpenBooking(booking)}
                    className="w-full px-6 py-4 text-left flex items-start gap-4 hover:bg-indigo-50/30 transition-colors group"
                  >
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-xl bg-gray-100 group-hover:bg-indigo-100 flex items-center justify-center shrink-0 transition-colors font-bold text-sm text-gray-500 group-hover:text-indigo-600 uppercase">
                      {booking.passengerDetails?.[0]?.name?.[0] || '?'}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {booking.passengerDetails?.[0]?.name || 'Unknown Passenger'}
                        </p>
                        <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${statusColors[booking.bookingStatus] || 'bg-gray-100 text-gray-600'}`}>
                          {booking.bookingStatus}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {route ? `${route.origin} → ${route.destination}` : booking.bookingReference}
                        {dep ? ` · ${dep.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${dep.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                      </p>
                    </div>

                    {/* Amount + payment */}
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold text-gray-900">MWK {(booking.totalAmount || 0).toLocaleString()}</p>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase ${payColors[booking.paymentStatus] || 'bg-gray-50 text-gray-500'}`}>
                        {booking.paymentStatus}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-5">

          {/* Today's Trips — compact, clickable */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Today's Trips</h3>
                <p className="text-xs text-gray-400 mt-0.5">{todaysSchedules.length} scheduled</p>
              </div>
              <button onClick={() => navigateTo?.('routes')} className="text-xs font-semibold text-indigo-600 hover:text-indigo-500">
                Routes
              </button>
            </div>
            {todaysSchedules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <Calendar className="w-8 h-8 mb-2 text-gray-200" />
                <p className="text-xs font-medium">No trips today</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {todaysSchedules.map((schedule: Schedule) => {
                  const route = routes.find((r: Route) => r.id === schedule.routeId);
                  const bus = buses.find((b: Bus) => b.id === schedule.busId);
                  const dep = new Date(schedule.departureDateTime);
                  const isPast = dep < now;
                  const statusKey = (schedule.tripStatus || schedule.status || 'scheduled') as string;
                  const statusCfg = tripStatusConfig[statusKey] || { label: statusKey, color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' };
                  const tripCount = bookings.filter((b: Booking) => b.scheduleId === schedule.id && b.bookingStatus !== 'cancelled').length;

                  return (
                    <button
                      key={schedule.id}
                      onClick={() => !isPast && navigateToBookings?.(schedule.id)}
                      className={`w-full px-5 py-3.5 text-left flex items-center gap-3 transition-colors ${
                        isPast ? 'opacity-40 cursor-default' : 'hover:bg-indigo-50/50 cursor-pointer'
                      }`}
                    >
                      <div className="text-center shrink-0 w-12">
                        <p className="text-xs font-bold text-gray-900">{dep.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        <p className="text-[10px] text-gray-400">{isPast ? 'past' : 'dep'}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900 truncate">
                          {route ? `${route.origin} → ${route.destination}` : 'Unknown'}
                        </p>
                        <p className="text-[10px] text-gray-400 truncate">
                          {bus?.licensePlate || <span className="text-amber-500">No bus</span>} · {tripCount} pax
                        </p>
                      </div>
                      <div className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusCfg.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                        {statusCfg.label}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {/* Needs Action */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">Needs Action</h3>
              {pendingBookings.length > 0 && (
                <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {pendingBookings.length} pending
                </span>
              )}
            </div>

            {pendingBookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <CheckCircle className="w-8 h-8 mb-2 text-emerald-300" />
                <p className="text-xs font-medium">All bookings are up to date</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {pendingBookings.map((booking: Booking) => {
                  const schedule = schedules.find((s: Schedule) => s.id === booking.scheduleId);
                  const route = schedule ? routes.find((r: Route) => r.id === schedule.routeId) : null;
                  return (
                    <button
                      key={booking.id}
                      onClick={() => handleOpenBooking(booking)}
                      className="w-full px-5 py-3.5 text-left flex items-center gap-3 hover:bg-amber-50/50 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4 text-amber-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900 truncate">
                          {booking.passengerDetails?.[0]?.name || 'Unknown'}
                        </p>
                        <p className="text-[10px] text-gray-400 truncate">
                          {route ? `${route.origin} → ${route.destination}` : booking.bookingReference}
                        </p>
                      </div>
                      <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${booking.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {booking.paymentStatus}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {bookings.filter((b: Booking) => b.bookingStatus === 'pending').length > 6 && (
              <div className="px-5 py-3 border-t border-gray-50">
                <button
                  onClick={() => navigateToBookings?.()}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 flex items-center gap-1"
                >
                  View all <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {selectedBooking && (
        <BookingDetailsModal
          booking={selectedBooking}
          routeLabel={selectedBookingRouteLabel}
          departureTime={selectedBookingDepartureTime}
          busLabel={selectedBookingBusLabel}
          seatLabel={selectedBookingSeatLabel}
          actionLoading={actionLoading}
          reminderLoading={reminderLoading}
          onClose={handleCloseBooking}
          onConfirm={handleConfirmBooking}
          onCancel={handleCancelBooking}
          onSendReminder={handleSendReminder}
        />
      )}
    </div>
  );
}
