'use client';

import React, { useEffect, useState } from 'react';
import { Users, FileText, Bus as BusIcon, Calendar, Clock, Download, ChevronRight, AlertCircle, Printer, Loader2, Check, X, Bell, Eye } from 'lucide-react';
import { Booking, Schedule, Bus, Route } from '@/types';
import * as dbActions from '@/lib/actions/db.actions';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface BookingsTabProps {
  dashboard: any;
}

export default function BookingsTab({ dashboard }: BookingsTabProps) {
  const { dashboardData } = dashboard;
  const { schedules, bookings, buses, routes } = dashboardData;
  const searchQuery = dashboard.searchQuery?.toLowerCase() || '';
  const [selectedDate, setSelectedDate] = useState('');
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
      dashboard.fetchInitialData?.();
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

  const handleCancelBooking = async (bookingId: string) => {
    if (!window.confirm('Cancel this booking?')) return;
    setActionLoading(bookingId);
    try {
      const result = await dbActions.updateBooking(bookingId, {
        bookingStatus: 'cancelled',
        cancellationDate: new Date(),
      });
      if (!result.success) throw new Error(result.error || 'Failed to cancel booking');
      dashboard.fetchInitialData?.();
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

  const handleSendReminder = async (booking: Booking) => {
    setReminderLoading(booking.id);
    try {
      if (!booking.userId || !booking.contactEmail) {
        dashboard.showAlert('warning', 'No email available to send reminder.');
        return;
      }
      await dbActions.createNotification({
        userId: booking.userId,
        type: 'payment_reminder',
        title: 'Payment Reminder',
        message: 'Please complete payment for your booking to confirm your seat.',
        data: { bookingId: booking.id },
      });
      const emailRes = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          recipientIds: [booking.userId],
          title: 'Payment Reminder — TibhukeBus',
          body: `Your booking ${booking.bookingReference} is awaiting payment. Please complete payment to confirm your seat.`,
          data: { bookingId: booking.id, type: 'payment_reminder' },
          clickAction: '/bookings',
        }),
      });
      if (!emailRes.ok) throw new Error('Failed to send email reminder');
      dashboard.showAlert('success', 'Payment reminder sent successfully.');
    } catch (err: any) {
      console.error('Reminder error:', err);
      dashboard.showAlert('error', err.message || 'Failed to send reminder');
    } finally {
      setReminderLoading(null);
    }
  };

  // Filter schedules to only those happening today or in the future by default.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const scheduleMatchesDate = (schedule: Schedule) => {
    if (!selectedDate) return true;
    const selected = new Date(selectedDate);
    selected.setHours(0, 0, 0, 0);
    const departure = new Date(schedule.departureDateTime);
    departure.setHours(0, 0, 0, 0);
    return departure.getTime() === selected.getTime();
  };

  const allActiveSchedules = schedules
    .filter((s: Schedule) => {
      if (selectedDate) return scheduleMatchesDate(s);
      return new Date(s.departureDateTime) >= todayStart && s.status !== 'completed';
    })
    .sort((a: Schedule, b: Schedule) => new Date(a.departureDateTime).getTime() - new Date(b.departureDateTime).getTime());

  // Apply search filter to schedules
  const activeSchedules = allActiveSchedules.filter((s: Schedule) => {
    if (!searchQuery) return true;
    const route = routes.find((r: Route) => r.id === s.routeId);
    const bus = buses.find((b: Bus) => b.id === s.busId);
    const tripBookings = bookings.filter((b: Booking) => b.scheduleId === s.id);
    return (
      route?.name?.toLowerCase().includes(searchQuery) ||
      route?.origin?.toLowerCase().includes(searchQuery) ||
      route?.destination?.toLowerCase().includes(searchQuery) ||
      bus?.licensePlate?.toLowerCase().includes(searchQuery) ||
      tripBookings.some((b: Booking) => {
        const passengerName = b.passengerDetails?.[0]?.name?.toLowerCase();
        const reference = b.bookingReference?.toLowerCase();
        return (passengerName?.includes(searchQuery) ?? false) || (reference?.includes(searchQuery) ?? false);
      })
    );
  });

  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(
    allActiveSchedules.length > 0 ? allActiveSchedules[0].id : null
  );

  useEffect(() => {
    if (!allActiveSchedules.some((s: Schedule) => s.id === selectedScheduleId)) {
      setSelectedScheduleId(allActiveSchedules.length > 0 ? allActiveSchedules[0].id : null);
    }
  }, [allActiveSchedules, selectedScheduleId]);

  const selectedBookingSchedule = selectedBooking
    ? schedules.find((schedule: Schedule) => schedule.id === selectedBooking.scheduleId)
    : undefined;
  const selectedBookingRoute = selectedBookingSchedule
    ? routes.find((route: Route) => route.id === selectedBookingSchedule.routeId)
    : selectedBooking
    ? routes.find((route: Route) => route.id === selectedBooking.routeId)
    : undefined;
  const selectedBookingBus = selectedBookingSchedule
    ? buses.find((bus: Bus) => bus.id === selectedBookingSchedule.busId)
    : undefined;
  const selectedBookingDepartureTime = selectedBookingSchedule?.departureDateTime
    ? new Date(selectedBookingSchedule.departureDateTime)
    : undefined;
  const selectedBookingRouteLabel = selectedBookingRoute
    ? `${selectedBookingRoute.origin} → ${selectedBookingRoute.destination}`
    : selectedBookingSchedule
    ? `${selectedBookingSchedule.departureLocation} → ${selectedBookingSchedule.arrivalLocation}`
    : selectedBooking?.routeId || 'N/A';
  const selectedBookingBusLabel = selectedBookingBus
    ? `${selectedBookingBus.licensePlate}${selectedBookingBus.busType ? ` (${selectedBookingBus.busType})` : ''}`
    : 'Unassigned';
  const selectedBookingSeatLabel = selectedBooking?.seatNumbers?.length
    ? selectedBooking.seatNumbers.join(', ')
    : selectedBooking?.passengerDetails?.map((p) => p.seatNumber).filter(Boolean).join(', ') || 'Auto assigned';

  const handleGenerateManifest = (scheduleId: string) => {
    try {
      const schedule = activeSchedules.find((s: Schedule) => s.id === scheduleId);
      if (!schedule) return;

      const route = routes.find((r: Route) => r.id === schedule.routeId);
      const bus = buses.find((b: Bus) => b.id === schedule.busId);
      const tripBookings = bookings.filter((b: Booking) => b.scheduleId === scheduleId && b.bookingStatus !== 'cancelled');

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

  const scheduleLabel = selectedDate
    ? `Trips on ${new Date(selectedDate).toLocaleDateString()}`
    : 'Active & Upcoming Trips';

  const scheduleHelpText = selectedDate
    ? 'Showing trips for the selected date. Archived completed trips are only visible when filtering by a specific date.'
    : 'Default showing upcoming trips only. Completed trips are archived and not shown by default.';

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
          <Users className="w-6 h-6 text-indigo-600" />
          Bookings &amp; Trip Manifests
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Manage bookings by upcoming trips and search by date. Use the date filter to locate archived trips on a specific day.
        </p>
      </div>

      {activeSchedules.length === 0 && bookings.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-gray-200">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-900 mb-1">No Active Trips</h3>
          <p className="text-gray-500 max-w-md mx-auto">There are no upcoming schedules or bookings. Create a schedule in the Branches tab to start receiving bookings.</p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* Left Column: List of Schedules */}
          <div className="lg:w-1/3 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-bold text-gray-900">{scheduleLabel}</h3>
                <p className="text-sm text-gray-500">{scheduleHelpText}</p>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="date-filter" className="sr-only">Filter by date</label>
                <input
                  id="date-filter"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full sm:w-auto rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
                {selectedDate && (
                  <button
                    type="button"
                    onClick={() => setSelectedDate('')}
                    className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            {allActiveSchedules.length === 0 ? (
              <div className="p-4 bg-white rounded-xl border border-gray-200 text-center text-gray-500 text-sm">
                <AlertCircle className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                No active schedules found for today or upcoming.
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                {activeSchedules.map((schedule: Schedule) => {
                  const route = routes.find((r: Route) => r.id === schedule.routeId);
                  const bus = buses.find((b: Bus) => b.id === schedule.busId);
                  const tripBookings = bookings.filter((b: Booking) => b.scheduleId === schedule.id && b.bookingStatus !== 'cancelled');
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
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        isSelected 
                          ? 'bg-indigo-50 border-indigo-200 shadow-sm ring-1 ring-indigo-500' 
                          : 'bg-white border-gray-200 hover:border-indigo-300'
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
                      
                      <div className="flex items-center gap-2 text-xs text-gray-600 mb-3">
                        <Calendar className="w-3 h-3" />
                        {new Date(schedule.departureDateTime).toLocaleDateString()} at{' '}
                        {new Date(schedule.departureDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        <span className="mx-1">•</span>
                        <BusIcon className="w-3 h-3" />
                        {bus?.licensePlate || 'TBA'}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex -space-x-2 overflow-hidden">
                          {tripBookings.slice(0, 4).map((b: Booking, i: number) => (
                            <div key={i} className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-gray-200 flex items-center justify-center text-[8px] font-bold text-gray-600">
                              {b.passengerDetails?.[0]?.name?.[0] || 'P'}
                            </div>
                          ))}
                          {tripBookings.length > 4 && (
                            <div className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-gray-100 flex items-center justify-center text-[10px] font-medium text-gray-600">
                              +{tripBookings.length - 4}
                            </div>
                          )}
                        </div>
                        <div className="text-xs font-semibold text-gray-900">
                          {tripBookings.length} / {bus?.capacity || '?'} Seats
                        </div>
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
                .filter((b: Booking) => b.scheduleId === selectedScheduleId && b.bookingStatus !== 'cancelled')
                .sort((a: Booking, b: Booking) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

              const paidCount = tripBookings.filter((b: Booking) => b.paymentStatus === 'paid').length;
              const tripRevenue = tripBookings.filter((b: Booking) => b.paymentStatus === 'paid').reduce((acc: number, b: Booking) => acc + (b.totalAmount || 0), 0);

              return (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full min-h-[500px]">
                  {/* Header */}
                  <div className="p-6 border-b border-gray-100 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{route?.name}</h3>
                        <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                          <div className="flex items-center gap-1"><Calendar className="w-4 h-4"/> {new Date(schedule?.departureDateTime || '').toLocaleDateString()}</div>
                          <div className="flex items-center gap-1"><Clock className="w-4 h-4"/> {new Date(schedule?.departureDateTime || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          <div className="flex items-center gap-1"><BusIcon className="w-4 h-4"/> {bus?.licensePlate || 'Unassigned'}</div>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleGenerateManifest(selectedScheduleId)}
                        disabled={tripBookings.length === 0}
                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Download className="w-4 h-4" />
                        Download Manifest
                      </button>
                    </div>

                    {/* Quick stats */}
                    <div className="flex gap-4">
                      <div className="bg-white px-3 py-1.5 rounded-lg border border-gray-100 text-xs">
                        <span className="text-gray-500">Passengers:</span> <span className="font-bold text-gray-900">{tripBookings.length}</span>
                      </div>
                      <div className="bg-white px-3 py-1.5 rounded-lg border border-gray-100 text-xs">
                        <span className="text-gray-500">Paid:</span> <span className="font-bold text-green-600">{paidCount}</span>
                      </div>
                      <div className="bg-white px-3 py-1.5 rounded-lg border border-gray-100 text-xs">
                        <span className="text-gray-500">Revenue:</span> <span className="font-bold text-green-600">MWK {tripRevenue.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bookings List */}
                  <div className="flex-1 p-6 overflow-y-auto">
                    <h4 className="font-bold text-gray-900 mb-4 flex items-center justify-between">
                      Passenger List
                      <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-md">{tripBookings.length} Passengers</span>
                    </h4>

                    {tripBookings.length === 0 ? (
                      <div className="text-center py-12">
                        <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">No bookings for this trip yet.</p>
                        <p className="text-gray-400 text-sm mt-1">Passengers will appear here once they book.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {tripBookings.map((booking: Booking, idx: number) => {
                          const isSelectedBooking = selectedBooking?.id === booking.id;
                          return (
                            <div
                              key={booking.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => handleOpenBooking(booking)}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOpenBooking(booking); }}
                              className={`p-4 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                                isSelectedBooking ? 'border-indigo-300 bg-indigo-50/60 shadow-sm' : 'border-gray-100 hover:border-indigo-100 hover:bg-indigo-50/30'
                              }`}
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-600 text-sm">
                                  {idx + 1}
                                </div>
                                <div>
                                  <div className="font-bold text-gray-900">{booking.passengerDetails?.[0]?.name || 'Unknown'}</div>
                                  <div className="text-xs text-gray-500 flex gap-2">
                                    <span>Ref: {booking.bookingReference}</span>
                                    <span>•</span>
                                    <span>Seats: {booking.seatNumbers?.join(', ') || 'Auto'}</span>
                                    {booking.contactPhone && <><span>•</span><span>{booking.contactPhone}</span></>}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right space-y-1">
                                <div className={`inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-1 ${booking.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                  {booking.paymentStatus.toUpperCase()}
                                </div>
                                <div className="text-xs text-gray-400">
                                  MWK {booking.totalAmount?.toLocaleString()}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })() : (
              <div className="bg-white rounded-2xl border border-gray-200 border-dashed h-full min-h-[500px] flex items-center justify-center flex-col text-gray-400">
                <FileText className="w-12 h-12 mb-3" />
                <p className="font-medium">Select a trip to view bookings</p>
                <p className="text-sm mt-1">and generate a downloadable manifest.</p>
              </div>
            )}
          </div>
          
        </div>
      )}

      {selectedBooking && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl rounded-3xl bg-white border border-gray-200 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-600">Booking Details</p>
                <h3 className="mt-2 text-xl font-bold text-gray-900">{selectedBooking.bookingReference}</h3>
                <p className="text-sm text-gray-500 mt-1">Passenger: {selectedBooking.passengerDetails?.[0]?.name || 'Unknown'}</p>
              </div>
              <button onClick={handleCloseBooking} className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid gap-4 p-6 md:grid-cols-2">
              <div className="space-y-4">
                <div className="rounded-3xl border border-gray-100 bg-gray-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-500">Trip</p>
                  <p className="mt-3 text-sm font-semibold text-gray-900">{selectedBookingRouteLabel}</p>
                  <p className="text-sm text-gray-500 mt-2">
                    {selectedBookingDepartureTime
                      ? selectedBookingDepartureTime.toLocaleString()
                      : 'Departure not available'}
                  </p>
                  <p className="text-sm text-gray-500">
                    Bus: {selectedBookingBusLabel}
                  </p>
                  <p className="mt-2 text-sm text-gray-500">Seat(s): {selectedBookingSeatLabel}</p>
                </div>
                <div className="rounded-3xl border border-gray-100 bg-gray-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-500">Customer</p>
                  <p className="mt-3 text-sm font-semibold text-gray-900">{selectedBooking.passengerDetails?.[0]?.name || 'Guest'}</p>
                  <p className="text-sm text-gray-500">{selectedBooking.contactEmail || 'No email'}</p>
                  <p className="text-sm text-gray-500">{selectedBooking.contactPhone || 'No phone'}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-3xl border border-gray-100 bg-gray-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-500">Booking status</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">{selectedBooking.bookingStatus}</span>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${selectedBooking.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {selectedBooking.paymentStatus}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-gray-500">Seats: {selectedBooking.seatNumbers?.join(', ') || 'Auto assigned'}</p>
                  <p className="mt-2 text-sm text-gray-500">Amount: MWK {selectedBooking.totalAmount?.toLocaleString()}</p>
                </div>
                <div className="rounded-3xl border border-gray-100 bg-gray-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-500">Passenger details</p>
                  <div className="mt-3 space-y-3 text-sm text-gray-700">
                    {selectedBooking.passengerDetails?.map((passenger, index) => (
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
                {selectedBooking.bookingStatus === 'pending' && (
                  <button
                    type="button"
                    onClick={() => handleConfirmBooking(selectedBooking.id)}
                    disabled={actionLoading === selectedBooking.id}
                    className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {actionLoading === selectedBooking.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                    Confirm
                  </button>
                )}
                {(selectedBooking.bookingStatus === 'pending' || selectedBooking.bookingStatus === 'confirmed') && (
                  <button
                    type="button"
                    onClick={() => handleCancelBooking(selectedBooking.id)}
                    disabled={actionLoading === selectedBooking.id}
                    className="inline-flex items-center justify-center rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                  >
                    {actionLoading === selectedBooking.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                    Cancel
                  </button>
                )}
                {selectedBooking.paymentStatus !== 'paid' && (
                  <button
                    type="button"
                    onClick={() => handleSendReminder(selectedBooking)}
                    disabled={reminderLoading === selectedBooking.id}
                    className="inline-flex items-center justify-center rounded-2xl border border-indigo-200 bg-white px-5 py-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                  >
                    {reminderLoading === selectedBooking.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}
                    Send Reminder
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
