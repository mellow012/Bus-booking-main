"use client";

import React, { useState, useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import useFilterStore from '@/lib/stores/filterStore';
import { Loader2, TrendingUp } from 'lucide-react';
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';

type Props = { companyId?: string };

const columnHelper = createColumnHelper<any>();

const columns = [
  columnHelper.accessor('paymentId', { header: 'Payment ID', cell: info => info.getValue()?.slice(0, 10) }),
  columnHelper.accessor(row => row.booking?.bookingReference ?? row.bookingId, { id: 'bookingRef', header: 'Booking Ref' }),
  columnHelper.accessor(row => row.booking?.company?.name ?? row.booking?.companyId, { id: 'company', header: 'Company' }),
  columnHelper.accessor(row => row.booking?.schedule?.bus?.registration ?? row.booking?.schedule?.busId ?? '—', { id: 'bus', header: 'Bus' }),
  columnHelper.accessor('amount', { header: 'Amount', cell: info => `MWK ${Number(info.getValue() ?? 0).toLocaleString()}` }),
  columnHelper.accessor('status', { header: 'Status' }),
  columnHelper.accessor('provider', { header: 'Provider' }),
  columnHelper.accessor('createdAt', { header: 'Created', cell: info => new Date(info.getValue()).toLocaleString() }),
];

export default function PaymentsTab({ companyId }: Props) {
  const { regionId, routeId, scheduleId, dateRange } = useFilterStore();
  const [page, setPage] = useState(1);
  const limit = 12;

  const { data, isLoading } = useQuery({
    queryKey: ['cooPayments', { companyId, regionId, routeId, scheduleId, page, limit, dateRange }],
    queryFn: async () => {
      const url = new URL('/api/admin/coo/payments', window.location.origin);
      if (companyId) url.searchParams.set('companyId', companyId);
      if (regionId) url.searchParams.set('regionId', regionId);
      if (routeId) url.searchParams.set('routeId', routeId);
      if (scheduleId) url.searchParams.set('scheduleId', scheduleId);
      url.searchParams.set('page', String(page));
      url.searchParams.set('limit', String(limit));
      if (dateRange?.from) url.searchParams.set('from', dateRange.from);
      if (dateRange?.to) url.searchParams.set('to', dateRange.to);
      const res = await fetch(url.toString(), { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to fetch payments');
      return res.json();
    },
    placeholderData: keepPreviousData,
  });

  const payments = ((data as any)?.payments || []) as any[];
  const total = (data as any)?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // Calculate daily revenue by company
  const dailyRevenueByCompany = useMemo(() => {
    const grouped: Record<string, Record<string, number>> = {};
    payments.forEach(p => {
      if (p.status === 'completed' || p.status === 'successful') {
        const date = new Date(p.createdAt).toLocaleDateString();
        const company = p.booking?.company?.name ?? p.booking?.companyId ?? 'Unknown';
        if (!grouped[date]) grouped[date] = {};
        grouped[date][company] = (grouped[date][company] || 0) + (p.amount || 0);
      }
    });
    return grouped;
  }, [payments]);

  const paymentStatusBreakdown = useMemo(() => {
    return payments.reduce((acc: Record<string, number>, p) => {
      const status = p.status ?? 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
  }, [payments]);

  const paymentProviderBreakdown = useMemo(() => {
    return payments.reduce((acc: Record<string, number>, p) => {
      const provider = p.provider ?? 'unknown';
      acc[provider] = (acc[provider] || 0) + 1;
      return acc;
    }, {});
  }, [payments]);

  const normalizeRegionGroup = (regionName?: string | null) => {
    const value = (regionName ?? '').trim().toLowerCase();
    if (!value) return 'Others';
    if (/north/.test(value)) return 'North';
    if (/central/.test(value)) return 'Central';
    if (/south/.test(value)) return 'South';
    return 'Others';
  };

  const companyPaymentReport = useMemo(() => {
    const report: Record<string, any> = {};

    payments.forEach((p) => {
      const companyIdKey = p.booking?.company?.id ?? p.booking?.companyId ?? 'unknown';
      const companyName = p.booking?.company?.name ?? companyIdKey;
      const route = p.booking?.schedule?.route ? `${p.booking.schedule.route.origin} → ${p.booking.schedule.route.destination}` : p.booking?.schedule?.routeId ?? 'Unknown route';
      const region = normalizeRegionGroup(p.booking?.schedule?.route?.region?.name ?? p.booking?.schedule?.route?.regionId ?? null);
      const status = p.status ?? 'unknown';
      const provider = p.provider ?? 'unknown';
      const amount = p.amount || 0;

      if (!report[companyIdKey]) {
        report[companyIdKey] = {
          companyId: companyIdKey,
          companyName,
          revenue: 0,
          count: 0,
          statuses: {} as Record<string, number>,
          providers: {} as Record<string, number>,
          routes: {} as Record<string, number>,
          regions: new Set<string>(),
        };
      }

      report[companyIdKey].revenue += amount;
      report[companyIdKey].count += 1;
      report[companyIdKey].statuses[status] = (report[companyIdKey].statuses[status] || 0) + 1;
      report[companyIdKey].providers[provider] = (report[companyIdKey].providers[provider] || 0) + 1;
      report[companyIdKey].routes[route] = (report[companyIdKey].routes[route] || 0) + amount;
      report[companyIdKey].regions.add(region);
    });

    return Object.values(report)
      .map((item: any) => ({
        ...item,
        topRoutes: Object.entries(item.routes).sort((a: any, b: any) => b[1] - a[1]).slice(0, 3),
        regionNames: Array.from(item.regions),
      }))
      .sort((a: any, b: any) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [payments]);

  // Calculate payment breakdown by bus
  const paymentByBus = useMemo(() => {
    const grouped: Record<string, number> = {};
    payments.forEach(p => {
      if (p.status === 'completed' || p.status === 'successful') {
        const bus = p.booking?.schedule?.bus?.registration ?? p.booking?.schedule?.busId ?? 'Unknown';
        grouped[bus] = (grouped[bus] || 0) + (p.amount || 0);
      }
    });
    return Object.entries(grouped)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [payments]);

  const totalRevenue = payments.filter(p => p.status === 'completed' || p.status === 'successful').reduce((sum, p) => sum + (p.amount || 0), 0);

  const table = useReactTable({ data: payments, columns, getCoreRowModel: getCoreRowModel() });

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-10 h-10 text-gray-400 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-xl border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Total Revenue</p>
          <p className="text-2xl font-bold text-gray-900">MWK {totalRevenue.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-white rounded-xl border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Total Payments</p>
          <p className="text-2xl font-bold text-gray-900">{payments.filter(p => p.status === 'completed' || p.status === 'successful').length}</p>
        </div>
        <div className="p-4 bg-white rounded-xl border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Pending Payments</p>
          <p className="text-2xl font-bold text-yellow-600">{payments.filter(p => p.status === 'pending' || p.status === 'processing').length}</p>
        </div>
      </div>

      {/* Payment categories by status and provider */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-4 bg-white rounded-xl border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-4">Payment Status Breakdown</h3>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(paymentStatusBreakdown).map(([status, count]) => (
              <div key={status} className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 uppercase tracking-wide">{status}</p>
                <p className="text-lg font-bold text-gray-900">{count}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-4">Provider Breakdown</h3>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(paymentProviderBreakdown).map(([provider, count]) => (
              <div key={provider} className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 uppercase tracking-wide">{provider}</p>
                <p className="text-lg font-bold text-gray-900">{count}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Company payment report */}
      {companyPaymentReport.length > 0 && (
        <div className="p-4 bg-white rounded-xl border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-4">Company Payment Report</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left font-bold text-gray-700 text-xs">Company</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-700 text-xs">Revenue</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-700 text-xs">Payments</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-700 text-xs">Top Route(s)</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-700 text-xs">Regions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {companyPaymentReport.map(report => (
                  <tr key={report.companyId}>
                    <td className="px-4 py-3 text-gray-700 font-semibold">{report.companyName}</td>
                    <td className="px-4 py-3 font-bold text-gray-900">MWK {report.revenue.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-700">{report.count}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {report.topRoutes.map(([routeName, amount]: any) => (
                        <div key={routeName} className="text-xs mb-1">
                          <span className="font-semibold">{routeName}</span>: MWK {amount.toLocaleString()}
                        </div>
                      ))}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {report.regionNames.join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Daily Revenue by Company */}
      {paymentByBus.length > 0 && (
        <div className="p-4 bg-white rounded-xl border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-4">Top Buses by Revenue</h3>
          <div className="space-y-2">
            {paymentByBus.map(([bus, amount]) => (
              <div key={bus} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-700 font-bold">{bus}</p>
                <div className="flex items-center gap-4">
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-600" style={{ width: `${(amount / (paymentByBus[0][1] || 1)) * 100}%` }} />
                  </div>
                  <p className="text-sm font-bold text-gray-900 w-24 text-right">MWK {amount.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment Details Table */}
      <div className="p-4 bg-white rounded-xl border border-gray-100">
        <h3 className="font-bold text-gray-900 mb-4">Payment Details</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th key={header.id} className="px-6 py-3 text-left font-bold text-gray-700 text-xs">{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-100">
              {table.getRowModel().rows.map(row => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-6 py-3 text-gray-700 text-xs">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</p>
        <div className="flex gap-2">
          <button onClick={() => setPage(Math.max(1, page - 1))} className="px-3 py-2 bg-gray-50 rounded-lg hover:bg-gray-100">Prev</button>
          <button onClick={() => setPage(Math.min(totalPages, page + 1))} className="px-3 py-2 bg-gray-50 rounded-lg hover:bg-gray-100">Next</button>
        </div>
      </div>
    </div>
  );
}
