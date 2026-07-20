'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Users, FileText, Bus as BusIcon, Calendar, Download, Clock, Bell } from 'lucide-react';
import { Booking, Schedule, Route, Bus } from '@/types';
import { bookingMatchesSchedule } from '@/lib/booking-utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as dbActions from '@/lib/actions/db.actions';
import BookingDetailsModal from '@/components/company/BookingDetailsModal';
import { useAppToast } from '@/contexts/ToastContext';

interface BookingsTabProps {
  dashboard: any;
  defaultScheduleId?: string | null;
}

export default function BookingsTab({ dashboard, defaultScheduleId }: BookingsTabProps) {
  const { schedules, bookings, assignedRoutes: routes, buses } = dashboard;
  const searchQuery = dashboard.searchQuery?.toLowerCase() || '';
  const todayStr = new Date().toISOString().split('T')[0];
  const toast = useAppToast();
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [paymentFilter, setPaymentFilter] = useState('all');

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [reminderLoading, setReminderLoading] = useState<string | null>(null);

  const handleOpenBooking = (booking: Booking) => setSelectedBooking(booking);
  const handleCloseBooking = () => setSelectedBooking(null);

  const handleConfirmBooking = async (bookingId: string) => {
    setActionLoading(bookingId);
    try {
      const result = await dbActions.updateBooking(bookingId, {
        bookingStatus: 'confirmed',
        confirmedDate: new Date(),
      });
      if (!result.success) throw new Error(result.error || 'Failed to confirm booking');
      
      dashboard.showAlert('success', 'Booking confirmed successfully.');
      if (selectedBooking?.id === bookingId) {
        setSelectedBooking({ ...selectedBooking, bookingStatus: 'confirmed', confirmedDate: new Date() });
      }
    } catch (err: any) {
      console.error('Confirm booking error:', err);
      dashboard.showAlert('error', err.message || 'Failed to confirm booking.');
    } finally {
      setActionLoading(null);
    }
  };

  const confirmCancelBooking = async (bookingId: string) => {
    setActionLoading(bookingId);
    try {
      const result = await dbActions.updateBooking(bookingId, {
        bookingStatus: 'cancelled',
        cancellationDate: new Date(),
      });
      if (!result.success) throw new Error(result.error || 'Failed to cancel booking');
      
      dashboard.showAlert('success', 'Booking cancelled successfully.');
      if (selectedBooking?.id === bookingId) {
        setSelectedBooking({ ...selectedBooking, bookingStatus: 'cancelled', cancellationDate: new Date() });
      }
    } catch (err: any) {
      console.error('Cancel booking error:', err);
      dashboard.showAlert('error', err.message || 'Failed to cancel booking.');
    } finally {
      setActionLoading(null);
    }
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
      if (!booking.userId || !booking.contactEmail) {
        throw new Error('Missing user contact information.');
      }
      
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: booking.userId,
          title: 'Payment Reminder',
          message: 'Please complete payment for your booking to confirm your seat.',
          data: { bookingId: booking.id },
          companyId: dashboard.userProfile?.companyId
        })
      });
      
      await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientIds: [booking.userId],
          title: 'Payment Reminder',
          body: `Your booking ${booking.bookingReference} is awaiting payment. Please complete payment to confirm your seat.`,
          data: { bookingId: booking.id, type: 'payment_reminder' },
          clickAction: '/bookings',
          companyId: dashboard.userProfile?.companyId
        })
      });

      dashboard.showAlert('success', 'Reminder sent successfully.');
    } catch (err: any) {
      console.error('Send reminder error:', err);
      dashboard.showAlert('error', err.message || 'Failed to send reminder.');
    } finally {
      setReminderLoading(null);
    }
  };

  const selectedBookingSchedule = selectedBooking
    ? schedules.find((schedule: Schedule) => schedule.id === selectedBooking.scheduleId)
    : null;
  const selectedBookingRoute = selectedBookingSchedule
    ? routes.find((route: Route) => route.id === selectedBookingSchedule.routeId)
    : selectedBooking
    ? routes.find((route: Route) => route.id === selectedBooking.routeId)
    : null;
  const selectedBookingBus = selectedBookingSchedule
    ? buses.find((bus: Bus) => bus.id === selectedBookingSchedule.busId)
    : null;
  const selectedBookingRouteLabel = selectedBookingRoute ? `${selectedBookingRoute.origin} to ${selectedBookingRoute.destination}` : 'Unknown Route';
  const selectedBookingDepartureTime = selectedBookingSchedule?.departureDateTime ? new Date(selectedBookingSchedule.departureDateTime) : null;
  const selectedBookingBusLabel = selectedBookingBus ? selectedBookingBus.licensePlate : 'Unassigned';
  const selectedBookingSeatLabel = selectedBooking?.seatNumbers?.length ? selectedBooking.seatNumbers.join(', ') : 'Auto-assigned';

  const futureBookingsSummary = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const futureDatesMap: Record<string, { dateStr: string; count: number; scheduleId: string }> = {};

    bookings.forEach((b: Booking) => {
      if (b.bookingStatus === 'cancelled') return;

      const schedule = schedules.find((s: Schedule) => 
        bookingMatchesSchedule(b, s.id) && 
        s.status !== 'completed' && 
        s.status !== 'cancelled'
      );
      if (!schedule) return;

      const depDate = new Date(schedule.departureDateTime);
      depDate.setHours(0, 0, 0, 0);

      if (depDate.getTime() > today.getTime()) {
        const year = depDate.getFullYear();
        const month = String(depDate.getMonth() + 1).padStart(2, '0');
        const day = String(depDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        if (dateStr === selectedDate) return;

        if (!futureDatesMap[dateStr]) {
          futureDatesMap[dateStr] = {
            dateStr,
            count: 0,
            scheduleId: schedule.id,
          };
        }
        futureDatesMap[dateStr].count += 1;
      }
    });

    return Object.values(futureDatesMap)
      .filter((item) => item.count > 0)
      .sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [bookings, schedules, selectedDate]);

  const scheduleMatchesDate = (schedule: Schedule) => {
    if (!selectedDate) return true;
    const selected = new Date(selectedDate);
    selected.setHours(0, 0, 0, 0);
    const departure = new Date(schedule.departureDateTime);
    departure.setHours(0, 0, 0, 0);
    return departure.getTime() === selected.getTime();
  };

  const allActiveSchedules = schedules
    .filter((s: Schedule) => scheduleMatchesDate(s))
    .sort((a: Schedule, b: Schedule) => new Date(a.departureDateTime).getTime() - new Date(b.departureDateTime).getTime());

  // Apply search filter
  const activeSchedules = allActiveSchedules.filter((s: Schedule) => {
    if (!searchQuery) return true;
    const route = routes.find((r: Route) => r.id === s.routeId);
    const bus = buses.find((b: Bus) => b.id === s.busId);
    const tripBookings = bookings.filter((b: Booking) => bookingMatchesSchedule(b, s.id));
    return (
      route?.name?.toLowerCase().includes(searchQuery) ||
      route?.origin?.toLowerCase().includes(searchQuery) ||
      route?.destination?.toLowerCase().includes(searchQuery) ||
      bus?.licensePlate?.toLowerCase().includes(searchQuery) ||
      tripBookings.some((b: Booking) => b.passengerDetails?.[0]?.name?.toLowerCase().includes(searchQuery) || b.bookingReference?.toLowerCase().includes(searchQuery))
    );
  });

  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(
    defaultScheduleId ?? (activeSchedules.length > 0 ? activeSchedules[0].id : null)
  );

  // If a defaultScheduleId arrives from outside (e.g. HomeTab navigation), apply it once
  useEffect(() => {
    if (defaultScheduleId) setSelectedScheduleId(defaultScheduleId);
  }, [defaultScheduleId]);

  useEffect(() => {
    if (!activeSchedules.some((s: Schedule) => s.id === selectedScheduleId)) {
      setSelectedScheduleId(activeSchedules.length > 0 ? activeSchedules[0].id : null);
    }
  }, [activeSchedules, selectedScheduleId]);

  const handleGenerateManifest = (scheduleId: string) => {
    try {
      const schedule = activeSchedules.find((s: Schedule) => s.id === scheduleId);
      if (!schedule) return;

      const route = routes.find((r: Route) => r.id === schedule.routeId);
      const bus = buses.find((b: Bus) => b.id === schedule.busId);
      const tripBookings = bookings.filter((b: Booking) => bookingMatchesSchedule(b, scheduleId) && b.bookingStatus !== 'cancelled');

      const doc = new jsPDF();
      
      // Title
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Trip Manifest', 14, 22);
      
      // Trip details
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Route: ${route?.name || 'Unknown'}`, 14, 32);
      doc.text(`${route?.origin || '?'} → ${route?.destination || '?'}`, 14, 38);
      doc.text(`Date: ${new Date(schedule.departureDateTime).toLocaleDateString()}`, 14, 44);
      doc.text(`Departure: ${new Date(schedule.departureDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, 14, 50);
      doc.text(`Bus: ${bus?.licensePlate || 'TBA'} (${bus?.busType || ''}, ${bus?.capacity || '?'} seats)`, 14, 56);
      doc.text(`Total Passengers: ${tripBookings.length}`, 14, 62);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 68);

      // Line separator
      doc.setLineWidth(0.5);
      doc.line(14, 72, 196, 72);

      // Passenger table
      const tableData = tripBookings.map((b: Booking, i: number) => {
        const passenger = b.passengerDetails?.[0];
        return [
          (i + 1).toString(),
          passenger?.name || 'N/A',
          b.seatNumbers?.join(', ') || 'Auto',
          b.bookingReference,
          b.contactPhone || passenger?.contactNumber || '—',
          b.paymentStatus === 'paid' ? 'PAID' : 'PENDING',
        ];
      });

      autoTable(doc, {
        startY: 76,
        head: [['#', 'Passenger Name', 'Seat(s)', 'Ref', 'Phone', 'Payment']],
        body: tableData,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 245, 250] },
        theme: 'striped',
      });

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${pageCount} — Manifest for ${route?.name || 'Trip'}`, 14, doc.internal.pageSize.height - 10);
      }

      doc.save(`manifest_${route?.name?.replace(/\s+/g, '_') || 'trip'}_${new Date(schedule.departureDateTime).toISOString().slice(0,10)}.pdf`);
      dashboard.showAlert('success', 'Trip manifest downloaded as PDF.');
    } catch (err: any) {
      console.error('PDF generation error:', err);
      dashboard.showAlert('error', 'Failed to generate manifest PDF.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
          <Users className="w-6 h-6 text-brand-700" />
          My Assigned Trips & Bookings
        </h2>
        <p className="mt-1 text-sm text-gray-500">Manage bookings and print pdf manifests for your assigned upcoming trips.</p>
      </div>

      {futureBookingsSummary.length > 0 && (
        <div className="p-4 bg-brand-50 border border-brand-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-brand-700 animate-bounce" />
            <div>
              <p className="text-sm font-bold text-brand-950">Upcoming Bookings Notice</p>
              <p className="text-xs text-brand-700 font-medium">There are active bookings on future dates that are not currently displayed.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {futureBookingsSummary.map((item) => (
              <button
                key={item.dateStr}
                onClick={() => {
                  setSelectedDate(item.dateStr);
                  setSelectedScheduleId(item.scheduleId);
                }}
                className="px-3 py-1.5 text-xs font-semibold bg-white border border-brand-200 hover:border-brand-600 hover:bg-brand-50 rounded-xl text-brand-800 transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
              >
                <span>{new Date(item.dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                <span className="bg-coral-500 text-white rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                  {item.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* Left Column: List of Schedules */}
        <div className="lg:w-1/3 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="font-bold text-gray-900">Trips on {new Date(selectedDate).toLocaleDateString()}</h3>
              <p className="text-sm text-gray-500">Showing today's schedules by default. Pick another date to view different trips.</p>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="operator-date-filter" className="sr-only">Filter by date</label>
              <input
                id="operator-date-filter"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              {selectedDate !== todayStr && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayStr)}
                  className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Today
                </button>
              )}
            </div>
          </div>
          {activeSchedules.length === 0 ? (
            <div className="p-4 bg-white rounded-xl border border-gray-200 text-center text-gray-500 text-sm">
              No active schedules found.
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {activeSchedules.map((schedule: Schedule) => {
                const route = routes.find((r: Route) => r.id === schedule.routeId);
                const bus = buses.find((b: Bus) => b.id === schedule.busId);
                const isSelected = selectedScheduleId === schedule.id;
                const isToday = (() => {
                  const dep = new Date(schedule.departureDateTime);
                  const today = new Date();
                  return dep.toDateString() === today.toDateString();
                })();
                
                return (
                  <div 
                    key={schedule.id}
                    onClick={() => setSelectedScheduleId(schedule.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                      isSelected ? 'bg-indigo-50 border-indigo-200 shadow-sm ring-1 ring-indigo-500' : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-md hover:bg-indigo-50/50'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold text-gray-900 line-clamp-1">{route?.name || 'Unknown Route'}</div>
                      <div className="flex gap-1.5">
                        {isToday && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-indigo-100 text-indigo-700">
                            Today
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                          schedule.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {schedule.tripStatus || schedule.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Calendar className="w-3 h-3" />
                      {new Date(schedule.departureDateTime).toLocaleDateString()}
                      <span className="mx-1">•</span>
                      <Clock className="w-3 h-3" />
                      {new Date(schedule.departureDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      <span className="mx-1">•</span>
                      <BusIcon className="w-3 h-3" />
                      {bus?.licensePlate || 'TBA'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Bookings details & Manifest generation */}
        <div className="lg:w-2/3">
          {selectedScheduleId ? (() => {
            const schedule = activeSchedules.find((s: Schedule) => s.id === selectedScheduleId);
            const route = routes.find((r: Route) => r.id === schedule?.routeId);
            const bus = buses.find((b: Bus) => b.id === schedule?.busId);
            const tripBookings = bookings
              .filter((b: Booking) => bookingMatchesSchedule(b, selectedScheduleId) && b.bookingStatus !== 'cancelled')
              .filter((b: Booking) => paymentFilter === 'all' || b.paymentStatus === paymentFilter)
              .sort((a: Booking, b: Booking) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            return (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full min-h-[500px]">
                <div className="p-6 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{route?.name}</h3>
                    <div className="text-sm text-gray-500 mt-1 flex gap-3">
                      <span>{new Date(schedule?.departureDateTime || '').toLocaleString([], { dateStyle:'short', timeStyle: 'short' })}</span>
                      <span>Bus: {bus?.licensePlate || 'Unassigned'}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleGenerateManifest(selectedScheduleId)}
                    disabled={tripBookings.length === 0}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download className="w-4 h-4" /> Manifest PDF
                  </button>
                </div>

                <div className="flex-1 p-6 overflow-y-auto">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-gray-900">{tripBookings.length} Passenger{tripBookings.length !== 1 ? 's' : ''}</h4>
                    <select
                      value={paymentFilter}
                      onChange={(e) => setPaymentFilter(e.target.value)}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="all">All Payments</option>
                      <option value="paid">Paid</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>
                  {tripBookings.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      No bookings for this trip.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {tripBookings.map((booking: Booking, idx: number) => (
                        <div 
                          key={booking.id} 
                          onClick={() => handleOpenBooking(booking)}
                          className="p-4 rounded-xl border border-gray-100 bg-white flex justify-between items-center transition-all duration-200 hover:border-indigo-200 hover:shadow-md hover:bg-indigo-50/50 cursor-pointer group"
                        >
                          <div className="flex gap-4 items-center">
                            <div className="w-8 h-8 rounded-full bg-gray-50 group-hover:bg-indigo-100 group-hover:text-indigo-700 transition-colors flex items-center justify-center text-sm font-bold text-gray-600">{idx + 1}</div>
                            <div>
                              <div className="font-bold text-gray-900">{booking.passengerDetails?.[0]?.name || 'Unknown'}</div>
                              <div className="text-xs text-gray-500 mt-1">Ref: {booking.bookingReference} • Seats: {booking.seatNumbers?.join(', ')}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${booking.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                              {booking.paymentStatus.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })() : (
            <div className="bg-white rounded-2xl border border-gray-200 border-dashed h-full min-h-[500px] flex items-center justify-center flex-col text-gray-400">
              <FileText className="w-12 h-12 mb-3" />
              <p className="font-medium">Select a trip to view bookings.</p>
            </div>
          )}
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
