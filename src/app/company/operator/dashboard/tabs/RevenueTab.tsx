'use client';

import React, { useState, useMemo } from 'react';
import { DollarSign, Download, TrendingUp, PieChart, AlertCircle, FileText, Calendar } from 'lucide-react';
import { Booking, Route, Schedule } from '@/types';

interface RevenueTabProps {
  dashboard: any;
}

export default function RevenueTab({ dashboard }: RevenueTabProps) {
  const { bookings, assignedRoutes: routes, schedules } = dashboard;
  const searchQuery = dashboard.searchQuery?.toLowerCase() || '';

  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('month');

  const now = new Date();
  const startDate = new Date();
  if (dateRange === 'today') startDate.setHours(0,0,0,0);
  else if (dateRange === 'week') startDate.setDate(now.getDate() - 7);
  else if (dateRange === 'month') startDate.setMonth(now.getMonth() - 1);
  else startDate.setFullYear(2000);

  const filteredBookings = bookings.filter((b: Booking) => new Date(b.createdAt) >= startDate);
  const paidBookings = filteredBookings.filter((b: Booking) => b.paymentStatus === 'paid');
  
  const totalRevenue = paidBookings.reduce((acc: number, b: Booking) => acc + (b.totalAmount || 0), 0);
  const totalBookingsCount = filteredBookings.length;
  const paidBookingsCount = paidBookings.length;

  const routePerformance = useMemo(() => {
    return routes.map((route: Route) => {
      const routePaid = paidBookings.filter((b: Booking) => b.routeId === route.id);
      const routeRev = routePaid.reduce((acc: number, b: Booking) => acc + (b.totalAmount || 0), 0);
      const routeSchedules = schedules.filter((s: Schedule) => s.routeId === route.id);
      return {
        id: route.id,
        name: route.name,
        origin: route.origin,
        destination: route.destination,
        bookings: routePaid.length,
        schedules: routeSchedules.length,
        revenue: routeRev,
      };
    }).filter((r: any) => r.bookings > 0 || r.schedules > 0)
      .filter((r: any) => !searchQuery || r.name?.toLowerCase().includes(searchQuery) || r.origin?.toLowerCase().includes(searchQuery) || r.destination?.toLowerCase().includes(searchQuery))
      .sort((a: any, b: any) => b.revenue - a.revenue);
  }, [routes, paidBookings, schedules]);

  const handleGenerateCSV = () => {
    try {
      const header = ['Route', 'Paid Bookings', 'Revenue (MWK)'];
      const rows = routePerformance.map((r: any) => [r.name, r.bookings, r.revenue]);
      const csvContent = [header, ...rows].map(row => row.join(',')).join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `my_revenue_report_${dateRange}_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      dashboard.showAlert('success', 'Revenue report downloaded successfully.');
    } catch {
      dashboard.showAlert('error', 'Failed to generate report.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-green-600" />
            My Revenue &amp; Analytics
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Performance of the routes assigned to you.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="block w-full rounded-lg border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm shadow-sm"
          >
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="all">All Time</option>
          </select>
          <button
            onClick={handleGenerateCSV}
            disabled={routePerformance.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-5">
            <DollarSign className="w-32 h-32" />
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            My Total Revenue
          </div>
          <div className="text-4xl font-black text-gray-900">
            MWK {totalRevenue.toLocaleString()}
          </div>
          <p className="text-sm text-gray-400 mt-1">{paidBookingsCount} paid bookings</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-2">
            <Calendar className="w-4 h-4 text-indigo-500" />
            My Bookings
          </div>
          <div className="text-4xl font-black text-gray-900">{totalBookingsCount}</div>
          <p className="text-sm text-gray-400 mt-1">{totalBookingsCount - paidBookingsCount} unpaid</p>
        </div>
        
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-2">
            <PieChart className="w-4 h-4 text-indigo-500" />
            Avg per Booking
          </div>
          <div className="text-4xl font-black text-gray-900">
            MWK {paidBookingsCount > 0 ? Math.round(totalRevenue / paidBookingsCount).toLocaleString() : '0'}
          </div>
        </div>
      </div>

      {/* Route Breakdown */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-gray-400" />
          My Assigned Route Performance
        </h3>
        {routePerformance.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>No route data for this period.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Route</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Schedules</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paid Bookings</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {routePerformance.map((row: any) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{row.name}</div>
                      <div className="text-xs text-gray-400">{row.origin} → {row.destination}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.schedules}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.bookings}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">MWK {row.revenue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
    </div>
  );
}
