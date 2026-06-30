'use client';

import React, { useState } from 'react';
import { Users, FileText, Bus as BusIcon, Calendar, Clock, Download, ChevronRight, AlertCircle, Printer } from 'lucide-react';
import { Booking, Schedule, Bus, Route } from '@/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface BookingsTabProps {
  dashboard: any;
}

export default function BookingsTab({ dashboard }: BookingsTabProps) {
  const { dashboardData } = dashboard;
  const { schedules, bookings, buses, routes } = dashboardData;
  const searchQuery = dashboard.searchQuery?.toLowerCase() || '';

  // Filter schedules to only those happening today or in the future
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const allActiveSchedules = schedules
    .filter((s: Schedule) => new Date(s.departureDateTime) >= todayStart)
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
      tripBookings.some((b: Booking) => b.passengerDetails?.[0]?.name?.toLowerCase().includes(searchQuery) || b.bookingReference?.toLowerCase().includes(searchQuery))
    );
  });

  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(
    activeSchedules.length > 0 ? activeSchedules[0].id : null
  );

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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
          <Users className="w-6 h-6 text-indigo-600" />
          Bookings &amp; Trip Manifests
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Manage daily bookings grouped by active trips. Select a schedule to view its passengers and generate a manifest.
        </p>
      </div>

      {activeSchedules.length === 0 && bookings.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-gray-200">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-900 mb-1">No Active Trips</h3>
          <p className="text-gray-500 max-w-md mx-auto">There are no upcoming schedules or bookings. Create a schedule in the Regions tab to start receiving bookings.</p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* Left Column: List of Schedules */}
          <div className="lg:w-1/3 space-y-4">
            <h3 className="font-bold text-gray-900">Active &amp; Upcoming Trips</h3>
            {activeSchedules.length === 0 ? (
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
                        {tripBookings.map((booking: Booking, idx: number) => (
                          <div key={booking.id} className="p-4 rounded-xl border border-gray-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all flex items-center justify-between">
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
                            <div className="text-right">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                booking.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                              }`}>
                                {booking.paymentStatus.toUpperCase()}
                              </span>
                              <div className="text-xs text-gray-400 mt-1">
                                MWK {booking.totalAmount?.toLocaleString()}
                              </div>
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
                <p className="font-medium">Select a trip to view bookings</p>
                <p className="text-sm mt-1">and generate a downloadable manifest.</p>
              </div>
            )}
          </div>
          
        </div>
      )}
    </div>
  );
}
