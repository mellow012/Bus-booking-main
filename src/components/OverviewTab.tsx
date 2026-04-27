"use client";
import { useMemo } from "react";
import {
  DollarSign, Bus as BusIcon, TrendingUp, AlertTriangle, CheckCircle, MapPin, Ticket, RefreshCcw, Bell, Wallet, UserPlus, CreditCard
} from "lucide-react";
import { Company, Schedule, Route, Bus, Booking } from "@/types";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

type TabType = "overview" | "schedules" | "routes" | "buses" | "bookings" | "operators" | "profile" | "settings" | "payments";

interface OverviewTabProps {
  dashboardData: {
    company: Company | null;
    schedules: Schedule[];
    routes: Route[];
    buses: Bus[];
    bookings: Booking[];
  };
  realtimeStatus: {
    isConnected: boolean;
  };
  setActiveTab: (tab: TabType) => void;
}

const toDate = (date: any): Date => {
  if (!date) return new Date();
  if (date instanceof Date) return date;
  return new Date(date);
};

const fmt = (n: number) => n.toLocaleString("en-MW");

function AdminStatCard({ title, value, icon: Icon, trend }: { title: string; value: string; icon: any; trend?: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col justify-center min-h-[120px]">
      <div className="flex justify-between items-center mb-3">
        <p className="text-xs font-semibold text-gray-500">{title}</p>
        <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100">
          <Icon className="w-4 h-4 text-gray-600" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
        {trend && (
           <p className={`text-[10px] font-bold mt-2 ${trend.startsWith('+') ? 'text-emerald-600' : 'text-rose-600'}`}>
             {trend.startsWith('+') ? '▲' : '▼'} {trend.substring(1)} vs last week
           </p>
        )}
      </div>
    </div>
  );
}

export default function OverviewTab({ dashboardData, realtimeStatus, setActiveTab }: OverviewTabProps) {
  const { company, schedules, routes, buses, bookings } = dashboardData;

  const stats = useMemo(() => {
    const paid = bookings.filter(b => b.paymentStatus === "paid");
    const totalRev = paid.reduce((s, b) => s + (b.totalAmount || 0), 0);
    const failedOrRefunds = bookings.filter(b => b.paymentStatus === "failed" || b.bookingStatus === "cancelled").length;
    
    // Calculate weekly growth (crude estimation)
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastWeekBookings = bookings.filter(b => toDate(b.createdAt) < oneWeekAgo).length;
    const thisWeekBookings = bookings.filter(b => toDate(b.createdAt) >= oneWeekAgo).length;
    const bookingGrowth = lastWeekBookings > 0 ? ((thisWeekBookings - lastWeekBookings) / lastWeekBookings * 100).toFixed(1) : "0";

    return {
      totalRevenue: totalRev,
      totalBookings: bookings.length,
      totalPayments: paid.length, 
      refundsProcessed: failedOrRefunds * 15000, 
      failedPayments: failedOrRefunds,
      activeBuses: buses.filter(b => b.status === "active").length,
      activeRoutes: routes.filter(r => r.status === "active").length,
      bookingGrowth: (parseFloat(bookingGrowth) >= 0 ? "+" : "") + bookingGrowth + "%"
    };
  }, [bookings, buses, routes]);

  const recentActivity = useMemo(() =>
    [...bookings]
      .sort((a, b) => toDate(b.updatedAt).getTime() - toDate(a.updatedAt).getTime())
      .slice(0, 5),
    [bookings]
  );

  const topRoutes = useMemo(() => {
    const routeRevenue: Record<string, number> = {};
    bookings.forEach(b => {
      if (b.paymentStatus === 'paid') {
        routeRevenue[b.routeId] = (routeRevenue[b.routeId] || 0) + (b.totalAmount || 0);
      }
    });
    return Object.entries(routeRevenue)
      .map(([id, rev]) => ({
        id,
        name: routes.find(r => r.id === id)?.name || "Unknown Route",
        rev
      }))
      .sort((a, b) => b.rev - a.rev)
      .slice(0, 5);
  }, [bookings, routes]);

  const chartData = useMemo(() => {
    // Generate last 7 days of real data
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const label = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      const dayBookings = bookings.filter(b => toDate(b.createdAt).toDateString() === date.toDateString());
      const dayRevenue = dayBookings.reduce((s, b) => s + (b.paymentStatus === 'paid' ? b.totalAmount : 0), 0);
      days.push({ name: label, bookings: dayBookings.length, revenue: dayRevenue });
    }
    return days;
  }, [bookings]);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12 font-sans">
      
      {/* ── Page Header Area ── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Admin Overview</h1>
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mt-1">Live Operational Intelligence</p>
        </div>
        <div className="flex items-center gap-4">
           <div className="bg-white border border-gray-100 text-gray-500 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 shadow-sm">
             <span>📅</span> Last 7 Days <span>⌄</span>
           </div>
           <div className="relative p-2.5 bg-white border border-gray-100 rounded-xl cursor-pointer shadow-sm hover:bg-gray-50 transition-colors">
              <Bell className="w-5 h-5 text-gray-400" />
              <div className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white" />
           </div>
        </div>
      </div>

      {/* ── Top 6 KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <AdminStatCard title="Total Bookings" value={String(stats.totalBookings)} icon={Ticket} trend={stats.bookingGrowth} />
        <AdminStatCard title="Total Revenue" value={`MK ${fmt(stats.totalRevenue)}`} icon={DollarSign} trend="+0.0%" />
        <AdminStatCard title="Total Payments" value={String(stats.totalPayments)} icon={Wallet} trend="+0.0%" />
        <AdminStatCard title="Refunds Value" value={`MK ${fmt(stats.refundsProcessed)}`} icon={RefreshCcw} trend="0.0%" />
        <AdminStatCard title="Active Fleet" value={String(stats.activeBuses)} icon={BusIcon} trend="+0.0%" />
        <AdminStatCard title="Live Routes" value={String(stats.activeRoutes)} icon={MapPin} trend="+0.0%" />
      </div>

      {/* ── Middle Section: Charts & Lists ── */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
         
         {/* Combined Performance Chart */}
         <div className="xl:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm p-8 flex flex-col min-h-[400px]">
            <div className="flex justify-between items-center mb-8">
               <div>
                  <h3 className="font-black text-gray-900 text-sm uppercase tracking-tight">Performance Trend</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Bookings vs Revenue (Last 7 Days)</p>
               </div>
               <div className="flex gap-4">
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500" /><span className="text-[10px] font-bold text-gray-500 uppercase">Bookings</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-indigo-200" /><span className="text-[10px] font-bold text-gray-500 uppercase">Revenue</span></div>
               </div>
            </div>
            <div className="flex-1">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 'bold' }} dy={10} />
                    <YAxis hide />
                    <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '16px' }} />
                    <Bar dataKey="revenue" fill="#e0e7ff" radius={[6, 6, 0, 0]} maxBarSize={30} />
                    <Bar dataKey="bookings" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={30} />
                  </BarChart>
               </ResponsiveContainer>
            </div>
         </div>

         {/* Lists Container (Spans 2 cols) */}
         <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 flex flex-col">
               <div className="flex justify-between items-center mb-8">
                  <h3 className="font-black text-gray-900 text-sm uppercase tracking-tight">Top Routes</h3>
                  <button onClick={() => setActiveTab('routes')} className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest hover:underline">View all</button>
               </div>
               <div className="space-y-6 flex-1">
                  {topRoutes.length > 0 ? topRoutes.map((route, idx) => (
                     <div key={route.id} className="flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                           <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-[11px] font-black text-gray-400 border border-gray-100 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all">{idx + 1}</div>
                           <p className="text-[13px] font-bold text-gray-700 tracking-tight">{route.name}</p>
                        </div>
                        <p className="text-[13px] font-black text-gray-900">MK {fmt(route.rev)}</p>
                     </div>
                  )) : (
                    <div className="flex flex-col items-center justify-center h-full opacity-30">
                       <MapPin className="w-10 h-10 mb-2" />
                       <p className="text-[11px] font-bold uppercase">No data yet</p>
                    </div>
                  )}
               </div>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 flex flex-col">
               <div className="flex justify-between items-center mb-8">
                  <h3 className="font-black text-gray-900 text-sm uppercase tracking-tight">Live Activity</h3>
                  <button onClick={() => setActiveTab('bookings')} className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest hover:underline">View all</button>
               </div>
               <div className="space-y-6 flex-1 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                  {recentActivity.length > 0 ? recentActivity.map(booking => (
                    <div key={booking.id} className="flex gap-4 group">
                       <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex flex-shrink-0 items-center justify-center border border-indigo-100 group-hover:bg-indigo-600 transition-colors">
                          <CheckCircle className="w-5 h-5 text-indigo-600 group-hover:text-white" />
                       </div>
                       <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-bold text-gray-800 leading-snug">
                             {booking.passengerDetails?.[0]?.name || "New Booking"} confirmed for {routes.find(r => r.id === booking.routeId)?.name || "Trip"}
                          </p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                             {new Date(booking.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • MK {fmt(booking.totalAmount)}
                          </p>
                       </div>
                    </div>
                  )) : (
                    <div className="flex flex-col items-center justify-center h-full opacity-30">
                       <RefreshCcw className="w-10 h-10 mb-2" />
                       <p className="text-[11px] font-bold uppercase">No activity</p>
                    </div>
                  )}
               </div>
            </div>

         </div>
      </div>

      {/* ── Bottom Alerts Bar ── */}
      <div className="bg-[#1e293b] rounded-3xl p-6 flex flex-wrap gap-12 items-center shadow-xl">
         <div className="flex items-center gap-4 pr-12 border-r border-slate-700">
            <div className="w-12 h-12 bg-rose-500/10 rounded-2xl flex items-center justify-center border border-rose-500/20"><AlertTriangle className="w-6 h-6 text-rose-500"/></div>
            <div>
               <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">System Alerts</p>
               <p className="text-sm font-bold text-white mt-0.5">Attention Required</p>
            </div>
         </div>
         
         <div className="flex flex-col">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Failed Payments</p>
            <p className="text-sm font-black text-white mt-1">{stats.failedPayments} Incidents</p>
         </div>
         
         <div className="flex flex-col border-l border-slate-700 pl-12">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Operational Delay</p>
            <p className="text-sm font-black text-white mt-1">
              {schedules.filter(s => s.status === 'active' && s.tripStatus === 'delayed').length} Active Trips
            </p>
         </div>

         <div className="flex flex-col border-l border-slate-700 pl-12">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Refund Status</p>
            <p className="text-sm font-black text-white mt-1">3 Pending Requests</p>
         </div>
      </div>

    </div>
  );
}
