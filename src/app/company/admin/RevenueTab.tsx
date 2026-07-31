'use client';

import React, { useState, useMemo } from 'react';
import { DollarSign, Download, TrendingUp, PieChart, AlertCircle, FileText, Calendar, Star } from 'lucide-react';
import { Booking, Route, Schedule } from '@/types';
import { 
  useCompanySchedules, 
  useCompanyRoutes, 
  useCompanyRegions 
} from './_hooks/useDashboardQueries';

interface RevenueTabProps {
  dashboard: any;
}

export default function RevenueTab({ dashboard }: RevenueTabProps) {
  const companyId = dashboard.dashboardData.company?.id;
  const { bookings } = dashboard.dashboardData;
  const { data: routes = [] } = useCompanyRoutes(companyId || '');
  const { data: schedules = [] } = useCompanySchedules(companyId || '');
  const { data: branches = [] } = useCompanyRegions(companyId || '');
  const searchQuery = dashboard.searchQuery?.toLowerCase() || '';

  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | '60_days' | 'all'>('month');

  // Filter bookings by date range
  const now = new Date();
  const startDate = new Date();
  if (dateRange === 'today') startDate.setHours(0,0,0,0);
  else if (dateRange === 'week') startDate.setDate(now.getDate() - 7);
  else if (dateRange === 'month') startDate.setDate(now.getDate() - 30);
  else if (dateRange === '60_days') startDate.setDate(now.getDate() - 60);
  else startDate.setFullYear(2000); // 'all' — effectively no filter

  const filteredBookings = bookings.filter((b: Booking) => new Date(b.createdAt) >= startDate);
  const paidBookings = filteredBookings.filter((b: Booking) => b.paymentStatus === 'paid');
  
  const totalRevenue = paidBookings.reduce((acc: number, b: Booking) => acc + (b.totalAmount || 0), 0);
  const totalDiscountsGiven = paidBookings.reduce((acc: number, b: any) => acc + (b.discountAmount || b.metadata?.discountAmount || 0), 0);
  const grossRevenue = totalRevenue + totalDiscountsGiven;
  const totalBookingsCount = filteredBookings.length;
  const paidBookingsCount = paidBookings.length;

  // Group revenue by branch using route -> regionId mapping
  const revenueByBranch = useMemo(() => {
    const map: Record<string, { name: string; revenue: number; bookings: number }> = {};
    branches.forEach((branch: any) => {
      map[branch.id] = { name: branch.name, revenue: 0, bookings: 0 };
    });
    map['unassigned'] = { name: 'Unassigned', revenue: 0, bookings: 0 };

    paidBookings.forEach((b: Booking) => {
      const route = routes.find((r: Route) => r.id === b.routeId);
      const branchId = route?.regionId || 'unassigned';
      if (!map[branchId]) map[branchId] = { name: branchId, revenue: 0, bookings: 0 };
      map[branchId].revenue += (b.totalAmount || 0);
      map[branchId].bookings += 1;
    });

    // Remove empty 'unassigned' if nothing there
    if (map['unassigned'].bookings === 0) delete map['unassigned'];

    return Object.entries(map).sort((a, b) => b[1].revenue - a[1].revenue);
  }, [branches, paidBookings, routes]);

  // Route performance table data (with review ratings & counts)
  const routePerformance = useMemo(() => {
    return routes.map((route: Route) => {
      const routePaid = paidBookings.filter((b: Booking) => b.routeId === route.id);
      const routeRev = routePaid.reduce((acc: number, b: Booking) => acc + (b.totalAmount || 0), 0);
      const branch = branches.find((br: any) => br.id === route.regionId);
      const routeSchedules = schedules.filter((s: Schedule) => s.routeId === route.id);
      
      const routeReviews = bookings.filter((b: Booking) => b.routeId === route.id && (b as any).reviewRating != null && (b as any).reviewRating > 0);
      const totalRating = routeReviews.reduce((sum: number, b: any) => sum + Number(b.reviewRating), 0);
      const reviewCount = routeReviews.length;
      const avgRating = reviewCount > 0 ? (totalRating / reviewCount).toFixed(1) : null;

      return {
        id: route.id,
        name: route.name,
        origin: route.origin,
        destination: route.destination,
        branchName: branch?.name || 'Unassigned',
        bookings: routePaid.length,
        schedules: routeSchedules.length,
        revenue: routeRev,
        avgRating,
        reviewCount,
      };
    }).filter((r: any) => r.bookings > 0 || r.schedules > 0)
      .filter((r: any) => !searchQuery || r.name?.toLowerCase().includes(searchQuery) || r.branchName?.toLowerCase().includes(searchQuery) || r.origin?.toLowerCase().includes(searchQuery) || r.destination?.toLowerCase().includes(searchQuery))
      .sort((a: any, b: any) => b.revenue - a.revenue);
  }, [routes, paidBookings, bookings, branches, schedules, searchQuery]);

  const handleGenerateCSV = () => {
    try {
      const header = ['Route', 'Branch', 'Schedules', 'Paid Bookings', 'Revenue (MWK)', 'Avg Rating', 'Total Reviews'];
      const rows = routePerformance.map((r: any) => [
        r.name,
        r.branchName,
        r.schedules,
        r.bookings,
        r.revenue,
        r.avgRating ? `${r.avgRating} / 5` : 'No reviews',
        r.reviewCount
      ]);
      const csvContent = [header, ...rows].map(row => row.join(',')).join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `revenue_report_${dateRange}_${new Date().toISOString().slice(0,10)}.csv`;
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
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Revenue & Performance Reports</h2>
          <p className="text-sm text-gray-500 mt-1">Financial analytics, route revenue, and customer rating summaries</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-1 flex items-center gap-1 text-xs">
            {(['today', 'week', 'month', '60_days', 'all'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`px-3 py-1.5 rounded-lg capitalize font-semibold transition-all ${
                  dateRange === r ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {r === '60_days' ? '60 Days' : r}
              </button>
            ))}
          </div>

          <button
            onClick={handleGenerateCSV}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-sm"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Net Revenue</p>
            <p className="text-2xl font-black text-indigo-600 mt-1">MWK {totalRevenue.toLocaleString()}</p>
            <p className="text-xs text-emerald-600 font-semibold mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Paid bookings: {paidBookingsCount}
            </p>
          </div>
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Gross Revenue</p>
            <p className="text-2xl font-black text-gray-900 mt-1">MWK {grossRevenue.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">Before discounts applied</p>
          </div>
          <div className="w-12 h-12 bg-gray-50 text-gray-600 rounded-xl flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Discounts Given</p>
            <p className="text-2xl font-black text-amber-600 mt-1">MWK {totalDiscountsGiven.toLocaleString()}</p>
            <p className="text-xs text-amber-600 font-semibold mt-1">Return trip discounts</p>
          </div>
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Total Bookings</p>
            <p className="text-2xl font-black text-gray-900 mt-1">{totalBookingsCount}</p>
            <p className="text-xs text-gray-500 mt-1">{paidBookingsCount} paid, {totalBookingsCount - paidBookingsCount} unpaid</p>
          </div>
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
            <PieChart className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Revenue by Branch */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <PieChart className="w-4 h-4 text-indigo-500" />
          Revenue by Branch
        </h3>
        {revenueByBranch.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>No revenue data for this period.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {revenueByBranch.map(([branchId, data]) => {
              const percentage = totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0;
              return (
                <div key={branchId}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold text-gray-700">{data.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">{data.bookings} bookings</span>
                      <span className="font-bold text-gray-900">MWK {data.revenue.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div 
                      className="bg-indigo-600 h-2 rounded-full transition-all duration-500" 
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Route Breakdown */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-gray-400" />
          Route Performance & Ratings
        </h3>
        {routePerformance.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>No route data for this period. Revenue will appear once bookings are paid.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Route</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Branch</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Schedules</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paid Bookings</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.branchName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.schedules}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.bookings}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {row.avgRating ? (
                        <div className="flex items-center gap-1 text-amber-600 font-semibold">
                          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                          <span>{row.avgRating}</span>
                          <span className="text-xs text-gray-400 font-normal">({row.reviewCount})</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">No reviews</span>
                      )}
                    </td>
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