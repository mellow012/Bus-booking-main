"use client";

import React, { useMemo, useState, useCallback } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import useFilterStore from '@/lib/stores/filterStore';
import * as dbActions from '@/lib/actions/db.actions';
import { Loader2, Check, X, Send, Eye, ArrowLeft } from 'lucide-react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';

type Props = { companyId?: string };

const columnHelper = createColumnHelper<any>();

export default function BookingsTab({ companyId }: Props) {
  const { regionId, routeId, scheduleId, dateRange, setBooking } = useFilterStore();
  const [q, setQ] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['cooBookings', { companyId, regionId, routeId, scheduleId, dateRange }],
    queryFn: async () => {
      const url = new URL('/api/admin/coo/bookings', window.location.origin);
      if (companyId) url.searchParams.set('companyId', companyId);
      if (regionId) url.searchParams.set('regionId', regionId);
      if (routeId) url.searchParams.set('routeId', routeId);
      if (scheduleId) url.searchParams.set('scheduleId', scheduleId);
      if (dateRange?.from) url.searchParams.set('from', dateRange.from);
      if (dateRange?.to) url.searchParams.set('to', dateRange.to);
      url.searchParams.set('limit', '200');
      const res = await fetch(url.toString(), { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to fetch bookings');
      return res.json();
    },
    placeholderData: keepPreviousData,
  });

  const bookings = ((data as any)?.bookings || []) as any[];

  const filtered = useMemo(() => {
    if (!q) return bookings;
    return bookings.filter(b => (b.bookingReference || '').toLowerCase().includes(q.toLowerCase()) || (b.user?.email || '').toLowerCase().includes(q.toLowerCase()));
  }, [bookings, q]);

  const handleConfirm = useCallback(async (bookingId: string) => {
    setActionLoading(bookingId);
    try {
      const result = await dbActions.updateBooking(bookingId, { bookingStatus: 'confirmed', confirmedDate: new Date() });
      if (result.success) refetch();
    } catch (err: any) {
      alert(err.message || 'Failed to confirm booking');
    } finally {
      setActionLoading(null);
    }
  }, [refetch]);

  const handleCancel = useCallback(async (bookingId: string) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;
    setActionLoading(bookingId);
    try {
      const result = await dbActions.updateBooking(bookingId, { bookingStatus: 'cancelled', cancellationDate: new Date() });
      if (result.success) refetch();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel booking');
    } finally {
      setActionLoading(null);
    }
  }, [refetch]);

  const handleSendReminder = useCallback(async (bookingId: string, userId: string, userEmail?: string) => {
    if (!userEmail) { alert('No email on file for this booking'); return; }
    setActionLoading(bookingId);
    try {
      // 1. Persist in-app notification record
      await dbActions.createNotification({
        userId,
        type: 'payment_reminder',
        title: 'Payment Reminder',
        message: 'Please complete payment for your booking.',
        data: { bookingId, email: userEmail },
      });
      // 2. Send real email via Resend (uses /api/notifications/send → email-service.ts)
      const emailRes = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          recipientIds: [userId],
          title: 'Payment Reminder — TibhukeBus',
          body: 'Your booking is awaiting payment. Please log in and complete your payment to confirm your seat.',
          data: { bookingId, type: 'payment_reminder' },
          clickAction: '/bookings',
        }),
      });
      if (emailRes.ok) {
        alert('Reminder sent successfully!');
      } else {
        // Notification DB record already saved — email may have failed
        alert('In-app notification saved, but email delivery may have failed. Check your RESEND_API_KEY env variable.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to send reminder');
    } finally {
      setActionLoading(null);
    }
  }, []);

  const formatSeatNumbers = useCallback((seatNumbers: any) => {
    if (!seatNumbers) return 'N/A';
    if (Array.isArray(seatNumbers)) return seatNumbers.join(', ');
    if (typeof seatNumbers === 'string') return seatNumbers;
    try {
      return JSON.stringify(seatNumbers);
    } catch {
      return String(seatNumbers);
    }
  }, []);

  const formatPassengerDetails = useCallback((details: any) => {
    if (!details) return 'N/A';
    if (Array.isArray(details)) return details.map((passenger, index) => (
      <div key={index} className="space-y-1">
        <div className="text-sm font-medium">Passenger {index + 1}</div>
        <div className="text-xs text-gray-600">{Object.entries(passenger).map(([key, value]) => (
          <div key={key} className="flex gap-2">
            <span className="font-semibold">{key}:</span>
            <span>{String(value)}</span>
          </div>
        ))}</div>
      </div>
    ));
    if (typeof details === 'object') {
      return Object.entries(details).map(([key, value]) => (
        <div key={key} className="flex gap-2 text-sm">
          <span className="font-semibold">{key}:</span>
          <span>{String(value)}</span>
        </div>
      ));
    }
    return String(details);
  }, []);

  const columns = useMemo(() => [
    columnHelper.accessor('bookingReference', { header: 'Ref', cell: info => <span className="font-mono font-bold text-gray-700">{info.getValue()}</span> }),
    columnHelper.accessor(row => {
      const fullName = [row.user?.firstName, row.user?.lastName].filter(Boolean).join(' ');
      return fullName || row.user?.email || 'Passenger';
    }, { id: 'passenger', header: 'Passenger' }),
    columnHelper.accessor(row => row.company?.name || row.companyId, { id: 'company', header: 'Company' }),
    columnHelper.accessor(row => row.schedule?.route ? `${row.schedule.route.origin} → ${row.schedule.route.destination}` : row.routeId, { id: 'route', header: 'Route' }),
    columnHelper.accessor('createdAt', { header: 'Booking Date', cell: info => new Date(info.getValue()).toLocaleDateString() }),
    columnHelper.accessor('bookingStatus', {
      header: 'Status',
      cell: info => {
        const status = (info.getValue() || '') as string;
        const lower = status.toLowerCase();
        const config: Record<string, { bg: string; text: string }> = {
          confirmed: { bg: 'bg-green-100 text-green-800', text: 'Confirmed' },
          pending: { bg: 'bg-yellow-100 text-yellow-800', text: 'Pending' },
          completed: { bg: 'bg-blue-100 text-blue-800', text: 'Completed' },
          cancelled: { bg: 'bg-red-100 text-red-800', text: 'Cancelled' },
        };
        const cfg = config[lower] || { bg: 'bg-gray-100 text-gray-800', text: status };
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${cfg.bg}`}>
            {cfg.text}
          </span>
        );
      }
    }),
    columnHelper.accessor('totalAmount', { header: 'Amount', cell: info => `MWK ${Number(info.getValue() ?? 0).toLocaleString()}` }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: (info) => (
        <div className="inline-flex gap-1.5" onClick={e => e.stopPropagation()}>
          <button onClick={() => setSelectedBooking(info.row.original)} className="p-1.5 hover:bg-gray-100 text-gray-600 rounded text-xs" title="View details">
            <Eye className="w-3.5 h-3.5" />
          </button>
          {info.row.original.bookingStatus !== 'confirmed' && (
            <button onClick={() => handleConfirm(info.row.original.id)} disabled={actionLoading === info.row.original.id} className="p-1.5 hover:bg-green-100 text-green-600 rounded text-xs" title="Confirm booking">
              {actionLoading === info.row.original.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            </button>
          )}
          {info.row.original.bookingStatus !== 'cancelled' && (
            <button onClick={() => handleCancel(info.row.original.id)} disabled={actionLoading === info.row.original.id} className="p-1.5 hover:bg-red-100 text-red-600 rounded text-xs" title="Cancel booking">
              {actionLoading === info.row.original.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
            </button>
          )}
          <button onClick={() => handleSendReminder(info.row.original.id, info.row.original.userId, info.row.original.user?.email)} disabled={actionLoading === info.row.original.id} className="p-1.5 hover:bg-blue-100 text-blue-600 rounded text-xs" title="Send payment reminder">
            {actionLoading === info.row.original.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
      ),
    }),
  ], [actionLoading, handleConfirm, handleCancel, handleSendReminder, setSelectedBooking]);

  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-10 h-10 text-gray-400 animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search bookings..." className="flex-1 border rounded-lg px-3 py-2" />
        <button onClick={() => setQ('')} className="px-3 py-2 bg-gray-50 rounded-lg">Clear</button>
      </div>

      <div className="overflow-auto bg-white rounded-xl border border-gray-100">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-gray-500 bg-gray-50">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th key={header.id} className="px-4 py-3">{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr key={row.id} onClick={() => {
                setSelectedBooking(row.original);
                setBooking({ id: row.original.id, scheduleId: row.original.scheduleId, routeId: row.original.routeId, companyId: row.original.companyId, regionId: row.original.schedule?.route?.regionId });
              }} className="hover:bg-gray-50 cursor-pointer">
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-4 py-3">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && <p className="text-sm text-gray-500">No bookings found.</p>}

      {/* Booking Details Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 relative border border-gray-100 animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-4 mb-6">
              <div>
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Booking Information</span>
                <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2 mt-1">
                  {selectedBooking.bookingReference || 'No Reference'}
                </h2>
              </div>
              <button onClick={() => setSelectedBooking(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Trip & Schedule Card */}
              <div className="bg-indigo-50/40 border border-indigo-100 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Trip & Schedule</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
                  <div>
                    <span className="block text-xs text-gray-400 font-medium">Route</span>
                    <span className="font-bold text-gray-900">
                      {selectedBooking.schedule?.route
                        ? `${selectedBooking.schedule.route.origin} → ${selectedBooking.schedule.route.destination}`
                        : selectedBooking.routeId || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-gray-400 font-medium">Company / Operator</span>
                    <span className="font-bold text-gray-900">
                      {selectedBooking.company?.name || selectedBooking.companyId || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-gray-400 font-medium">Departure Date & Time</span>
                    <span className="font-semibold text-gray-900">
                      {selectedBooking.schedule?.departureDateTime
                        ? new Date(selectedBooking.schedule.departureDateTime).toLocaleString()
                        : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-gray-400 font-medium">Bus Plate / Model</span>
                    <span className="font-semibold text-gray-900">
                      {selectedBooking.schedule?.bus?.licensePlate || selectedBooking.schedule?.bus?.registration || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Grid: Contact Info & Seats/Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-gray-100 rounded-xl p-4 bg-white shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Contact Info</h3>
                  <div className="space-y-2 text-sm text-gray-700">
                    <div>
                      <span className="block text-xs text-gray-400 font-medium">Primary Contact Email</span>
                      <span className="font-semibold">{selectedBooking.contactEmail || selectedBooking.user?.email || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="block text-xs text-gray-400 font-medium">Primary Contact Phone</span>
                      <span className="font-semibold">{selectedBooking.contactPhone || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="block text-xs text-gray-400 font-medium">Account Holder</span>
                      <span className="font-semibold">
                        {selectedBooking.user
                          ? `${selectedBooking.user.firstName || ''} ${selectedBooking.user.lastName || ''} (${selectedBooking.user.email})`
                          : 'Walk-on (No account)'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border border-gray-100 rounded-xl p-4 bg-white shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Status & Metadata</h3>
                  <div className="space-y-2 text-sm text-gray-700">
                    <div>
                      <span className="block text-xs text-gray-400 font-medium mb-1">Seats Reserved</span>
                      <span className="inline-block bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs px-2.5 py-0.5 rounded-full font-bold">
                        {formatSeatNumbers(selectedBooking.seatNumbers)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs text-gray-400 font-medium">Booking Type</span>
                      <span className="font-semibold">
                        {selectedBooking.isWalkOn ? 'Walk-on Booking (Conductor)' : 'Online / Customer Booking'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs text-gray-400 font-medium">Booking Date</span>
                      <span className="font-semibold">
                        {new Date(selectedBooking.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Passenger Details */}
              <div className="border border-gray-100 rounded-xl p-4 bg-white shadow-sm space-y-3">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Passenger Details</h3>
                <div className="divide-y divide-gray-100 max-h-[200px] overflow-y-auto pr-1">
                  {formatPassengerDetails(selectedBooking.passengerDetails)}
                </div>
              </div>

              {/* Payment Summary */}
              <div className="bg-emerald-50/30 border border-emerald-100 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">Payment Status</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    selectedBooking.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {selectedBooking.paymentStatus ? selectedBooking.paymentStatus.toUpperCase() : 'PENDING'}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
                  <div>
                    <span className="block text-xs text-gray-400 font-medium">Total Amount Due</span>
                    <span className="font-black text-emerald-600 text-lg">
                      MWK {Number(selectedBooking.totalAmount ?? 0).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-gray-400 font-medium">Paid At</span>
                    <span className="font-semibold">
                      {selectedBooking.paidAt ? new Date(selectedBooking.paidAt).toLocaleString() : 'Not Paid'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Transaction List */}
              {selectedBooking.payments && selectedBooking.payments.length > 0 && (
                <div className="border border-gray-100 rounded-xl p-4 bg-white shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Transaction History</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="text-gray-400 bg-gray-50 uppercase font-semibold">
                        <tr>
                          <th className="px-3 py-2">Payment ID</th>
                          <th className="px-3 py-2">Amount</th>
                          <th className="px-3 py-2">Method</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selectedBooking.payments.map((p: any) => (
                          <tr key={p.id || p.paymentId}>
                            <td className="px-3 py-2 font-mono font-bold text-gray-700">{p.paymentId || p.txRef || '—'}</td>
                            <td className="px-3 py-2 font-semibold">MWK {Number(p.amount ?? 0).toLocaleString()}</td>
                            <td className="px-3 py-2 capitalize">{p.paymentType || p.provider || '—'}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                p.status === 'paid' || p.status === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {p.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-500">
                              {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="mt-6 flex justify-end gap-3 border-t pt-4">
              <button
                onClick={() => setSelectedBooking(null)}
                className="px-4 py-2 bg-gray-100 text-gray-900 hover:bg-gray-200 rounded-xl font-bold text-sm transition-colors"
              >
                Close
              </button>
              {selectedBooking.bookingStatus !== 'confirmed' && (
                <button
                  onClick={async () => {
                    await handleConfirm(selectedBooking.id);
                    setSelectedBooking((prev: any) => prev ? { ...prev, bookingStatus: 'confirmed' } : null);
                  }}
                  disabled={actionLoading === selectedBooking.id}
                  className="px-4 py-2 bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 rounded-xl font-bold text-sm flex items-center gap-1.5 transition-colors"
                >
                  {actionLoading === selectedBooking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Confirm Booking
                </button>
              )}
              {selectedBooking.bookingStatus !== 'cancelled' && (
                <button
                  onClick={async () => {
                    await handleCancel(selectedBooking.id);
                    setSelectedBooking((prev: any) => prev ? { ...prev, bookingStatus: 'cancelled' } : null);
                  }}
                  disabled={actionLoading === selectedBooking.id}
                  className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 rounded-xl font-bold text-sm flex items-center gap-1.5 transition-colors"
                >
                  {actionLoading === selectedBooking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                  Cancel Booking
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
