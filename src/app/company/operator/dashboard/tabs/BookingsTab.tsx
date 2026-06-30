'use client';

import React, { useState } from 'react';
import { Users, FileText, Bus as BusIcon, Calendar, Download, Clock } from 'lucide-react';
import { Booking, Schedule, Route, Bus } from '@/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface BookingsTabProps {
  dashboard: any;
}

export default function BookingsTab({ dashboard }: BookingsTabProps) {
  const { schedules, bookings, assignedRoutes: routes, buses } = dashboard;
  const searchQuery = dashboard.searchQuery?.toLowerCase() || '';

  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);

  const allActiveSchedules = schedules
    .filter((s: Schedule) => new Date(s.departureDateTime) >= todayStart)
    .sort((a: Schedule, b: Schedule) => new Date(a.departureDateTime).getTime() - new Date(b.departureDateTime).getTime());

  // Apply search filter
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
          My Assigned Trips & Bookings
        </h2>
        <p className="mt-1 text-sm text-gray-500">Manage bookings and print pdf manifests for your assigned upcoming trips.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* Left Column: List of Schedules */}
        <div className="lg:w-1/3 space-y-4">
          <h3 className="font-bold text-gray-900">Today's & Upcoming Trips</h3>
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
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected ? 'bg-indigo-50 border-indigo-200 shadow-sm ring-1 ring-indigo-500' : 'bg-white border-gray-200 hover:border-indigo-300'
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
              .filter((b: Booking) => b.scheduleId === selectedScheduleId && b.bookingStatus !== 'cancelled')
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
                  <h4 className="font-bold text-gray-900 mb-4">{tripBookings.length} Passengers</h4>
                  {tripBookings.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      No bookings for this trip.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {tripBookings.map((booking: Booking, idx: number) => (
                        <div key={booking.id} className="p-4 rounded-xl border border-gray-100 flex justify-between items-center">
                          <div className="flex gap-4 items-center">
                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600">{idx + 1}</div>
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
    </div>
  );
}
