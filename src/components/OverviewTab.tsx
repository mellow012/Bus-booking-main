"use client";
import { useState, useMemo } from "react";
import {
  DollarSign, Bus as BusIcon, TrendingUp, AlertTriangle, CheckCircle, MapPin, Ticket, RefreshCcw, Bell, Wallet, CreditCard, Navigation, Globe, UserCog, ChevronDown, ChevronRight
} from "lucide-react";
import { Company, Schedule, Route, Bus, Booking } from "@/types";

type TabType = "overview" | "schedules" | "routes" | "buses" | "bookings" | "operators" | "profile" | "settings" | "payments";

interface OverviewTabProps {
  dashboardData: {
    company: Company | null;
    schedules: Schedule[];
    routes: Route[];
    buses: Bus[];
    bookings: Booking[];
    operators?: any[];
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
const fmtTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const parseBranches = (data: any): string[] => {
  if (!data) return [];
  if (Array.isArray(data)) return data.filter(b => typeof b === 'string').map(b => b.trim());
  if (typeof data === 'string') return data.split(',').map(b => b.trim()).filter(Boolean);
  return [];
};

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
  const { company, schedules, routes, buses, bookings, operators = [] } = dashboardData;

  const [activeCard, setActiveCard] = useState<'regions' | 'operators' | 'bookings' | 'payments' | null>(null);
  const [expandedRegionId, setExpandedRegionId] = useState<string | null>(null);
  
  const regionsList = useMemo(() => parseBranches(company?.branches), [company?.branches]);

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
  
  const liveTrip = useMemo(() => {
    const current = schedules.find(s => s.tripStatus === 'in_transit' || s.tripStatus === 'boarding');
    if (current) return current;
    
    const upcoming = [...schedules]
      .filter(s => s.tripStatus === 'scheduled' || !s.tripStatus)
      .sort((a,b) => toDate(a.departureDateTime).getTime() - toDate(b.departureDateTime).getTime());
    
    return upcoming[0] || null;
  }, [schedules]);

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
      </div>

      {/* ── Live Trip Insight ── */}
      {liveTrip && (
        <div className="bg-indigo-900 rounded-[32px] p-8 mb-8 text-white relative overflow-hidden group shadow-2xl border border-indigo-800">
          <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:scale-110 transition-transform duration-700">
             <BusIcon className="w-48 h-48" />
          </div>
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center border border-white/20 backdrop-blur-md shadow-inner">
                <Navigation className={`w-10 h-10 ${liveTrip.tripStatus === 'in_transit' ? 'text-emerald-400 animate-pulse' : 'text-indigo-300'}`} />
              </div>
              <div className="text-center sm:text-left">
                <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-2 flex items-center justify-center sm:justify-start gap-2">
                  <span className={`w-2 h-2 rounded-full ${liveTrip.tripStatus === 'in_transit' ? 'bg-emerald-400' : 'bg-indigo-400'}`} />
                  {liveTrip.tripStatus === 'in_transit' ? 'Currently In Transit' : 
                   liveTrip.tripStatus === 'boarding' ? 'Vessel Boarding' : 'Next Strategic Deployment'}
                </p>
                <h2 className="text-3xl font-black tracking-tighter uppercase leading-none mb-3">
                  {routes.find(r => r.id === liveTrip.routeId)?.name || 'Direct Corridor'}
                </h2>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                  <span className="text-[10px] font-black text-white uppercase tracking-widest bg-indigo-800/50 border border-indigo-700/50 px-4 py-2 rounded-xl">
                    {new Date(liveTrip.departureDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} Departure
                  </span>
                  <span className="text-[10px] font-black text-white uppercase tracking-widest bg-indigo-800/50 border border-indigo-700/50 px-4 py-2 rounded-xl">
                    Bus {buses.find(b => b.id === liveTrip.busId)?.licensePlate || 'N/A'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-center lg:justify-end gap-10">
              <div className="text-center lg:text-right border-l lg:border-l-0 lg:border-r border-white/10 px-8">
                <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest mb-1">Saturation</p>
                <p className="text-4xl font-black tracking-tighter">
                  {((bookings.filter(b => b.scheduleId === liveTrip.id).length / (buses.find(b => b.id === liveTrip.busId)?.capacity || 1)) * 100).toFixed(0)}%
                </p>
              </div>
              <button onClick={() => setActiveTab('schedules')} className="bg-white text-indigo-900 px-10 py-5 rounded-[24px] text-[11px] font-black uppercase tracking-widest shadow-2xl hover:bg-indigo-50 transition-all active:scale-95 hover:shadow-indigo-500/20">
                Optimize Operations
              </button>
            </div>
          </div>
        </div>
      )}



      {/* ── Interactive Metric Cards Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { 
            id: 'regions', 
            icon: Globe, 
            color: 'text-indigo-400', 
            label: 'Active Regions', 
            value: regionsList.length || '—' 
          },
          { 
            id: 'operators', 
            icon: UserCog, 
            color: 'text-blue-400', 
            label: 'Total Operators', 
            value: operators.length 
          },
          { 
            id: 'bookings', 
            icon: Ticket, 
            color: 'text-emerald-400', 
            label: 'Total Bookings', 
            value: bookings.length 
          },
          { 
            id: 'payments', 
            icon: Wallet, 
            color: 'text-amber-400', 
            label: 'Total Payments', 
            value: `MK ${fmt(bookings.filter(b => b.paymentStatus === "paid").reduce((s, b) => s + (b.totalAmount || 0), 0))}` 
          },
        ].map((card) => (
          <div 
            key={card.id}
            onClick={() => {
              setActiveCard(prev => prev === card.id ? null : card.id as any);
              setExpandedRegionId(null);
            }}
            className={`cursor-pointer rounded-2xl border transition-all duration-300 p-5 flex flex-col gap-2 
              ${activeCard === card.id ? 'bg-indigo-50 border-indigo-200 shadow-md scale-[1.02]' : 'bg-white border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200'}`}
          >
            <card.icon className={`w-5 h-5 ${card.color}`} />
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{card.label}</p>
            <p className="text-2xl font-black text-gray-900">{card.value}</p>
          </div>
        ))}
      </div>

      {/* ── Expanded View Container ── */}
      {activeCard && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 animate-in slide-in-from-top-4 fade-in duration-300">
          
          {activeCard === 'regions' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-black text-gray-900 text-lg uppercase tracking-tight">Active Regions Overview</h3>
              </div>
              
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Left Side: Regions List */}
                <div className="w-full lg:w-1/3 space-y-3">
                  {regionsList.length > 0 ? 
                    regionsList.map(regionId => {
                    const regionRoutes = routes.filter(r => r.regionId === regionId || r.origin === regionId || r.destination === regionId);
                    const isExpanded = expandedRegionId === regionId;
                    
                    return (
                      <div 
                        key={regionId} 
                        onClick={() => setExpandedRegionId(isExpanded ? null : regionId)}
                        className={`p-4 flex items-center justify-between cursor-pointer rounded-2xl transition-colors border ${
                          isExpanded ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-gray-50 text-gray-800 border-gray-100 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Globe className={`w-5 h-5 ${isExpanded ? 'text-indigo-200' : 'text-indigo-500'}`} />
                          <span className="font-bold">{regionId}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${
                            isExpanded ? 'bg-indigo-500/50 text-white' : 'bg-indigo-100 text-indigo-700'
                          }`}>
                            {regionRoutes.length} Routes
                          </span>
                          <ChevronRight className={`w-4 h-4 ${isExpanded ? 'text-indigo-200' : 'text-gray-400'}`} />
                        </div>
                      </div>
                    );
                  }) : (
                    <p className="text-sm text-gray-500">No active regions found.</p>
                  )}
                </div>

                {/* Right Side: Schedules, Bookings, Operators */}
                <div className="w-full lg:w-2/3">
                  {expandedRegionId ? (() => {
                    const regionRoutes = routes.filter(r => r.regionId === expandedRegionId || r.origin === expandedRegionId || r.destination === expandedRegionId);
                    const regionSchedules = schedules.filter(s => regionRoutes.some(r => r.id === s.routeId) && s.status === 'active');

                    return (
                      <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 h-full">
                        <h4 className="text-sm font-black text-gray-900 uppercase tracking-tight mb-4 flex items-center gap-2">
                          <Navigation className="w-4 h-4 text-indigo-500" />
                          Live Schedules for {expandedRegionId}
                        </h4>
                        
                        {regionSchedules.length > 0 ? (
                          <div className="space-y-3">
                            {regionSchedules.map(sch => {
                              const routeName = regionRoutes.find(r => r.id === sch.routeId)?.name || 'Unknown Route';
                              const scheduleBookings = bookings.filter(b => b.scheduleId === sch.id).length;
                              // Find operator from schedule or fallback to route
                              const assignedOpId = sch.assignedOperatorIds?.[0] || regionRoutes.find(r => r.id === sch.routeId)?.assignedOperatorIds?.[0];
                              const operatorName = operators.find(op => op.id === assignedOpId || op.uid === assignedOpId)?.name || 'Unassigned';

                              return (
                                <div key={sch.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-indigo-200 transition-colors">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <p className="font-bold text-sm text-gray-900">{routeName}</p>
                                      <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${sch.tripStatus === 'in_transit' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {sch.tripStatus?.replace('_', ' ') || 'Scheduled'}
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                                      <Bell className="w-3 h-3" />
                                      {new Date(sch.departureDateTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                    </p>
                                  </div>
                                  
                                  <div className="flex items-center gap-6 sm:border-l border-gray-100 sm:pl-6">
                                    <div className="text-center">
                                      <p className="text-xl font-black text-emerald-600">{scheduleBookings}</p>
                                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Bookings</p>
                                    </div>
                                    
                                    <div className="w-px h-8 bg-gray-100 hidden sm:block"></div>
                                    
                                    <div className="flex items-center gap-2 min-w-[120px]">
                                      <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0">
                                        {operatorName.charAt(0).toUpperCase()}
                                      </div>
                                      <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Operator</p>
                                        <p className="text-xs font-bold text-gray-800 line-clamp-1">{operatorName}</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-40 opacity-50">
                            <Navigation className="w-8 h-8 mb-2 text-gray-400" />
                            <p className="text-sm font-medium text-gray-500 italic">No active schedules in {expandedRegionId}</p>
                          </div>
                        )}
                      </div>
                    );
                  })() : (
                    <div className="bg-gray-50 rounded-2xl border border-gray-100 border-dashed h-full min-h-[200px] flex flex-col items-center justify-center opacity-50 p-6 text-center">
                      <Globe className="w-10 h-10 mb-3 text-gray-400" />
                      <p className="font-bold text-gray-500 text-sm">Select a region to view detailed schedules</p>
                      <p className="text-xs text-gray-400 mt-1">Schedules, bookings, and operator assignments will appear here</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeCard === 'operators' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-black text-gray-900 text-lg uppercase tracking-tight">Platform Operators</h3>
                  <p className="text-xs text-gray-400 mt-1">{operators.length} team member{operators.length !== 1 ? 's' : ''} active</p>
                </div>
                <button onClick={() => setActiveTab('operators')} className="text-xs font-bold text-indigo-600 hover:underline uppercase tracking-widest border border-indigo-100 bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-colors">Manage Team</button>
              </div>
              
              {operators.length > 0 ? (
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Left: Operator list */}
                  <div className="w-full lg:w-1/3 space-y-2">
                    {operators.map((op: any) => {
                      const opRoutes = routes.filter(r => r.assignedOperatorIds?.includes(op.id) || r.assignedOperatorIds?.includes(op.uid));
                      const opSchedules = schedules.filter(s => opRoutes.some(r => r.id === s.routeId) && s.status === 'active');
                      return (
                        <div key={op.id} className="p-4 border border-gray-100 rounded-2xl flex items-center gap-4 hover:border-blue-200 hover:bg-blue-50/30 transition-all">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                            {(op.name || op.firstName || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-900 text-sm truncate">{op.name || `${op.firstName} ${op.lastName}`.trim() || 'Unnamed'}</p>
                            <p className="text-xs text-gray-500 truncate">{op.email}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-black text-indigo-700">{opSchedules.length}</p>
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Schedules</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Right: Summary stats */}
                  <div className="w-full lg:w-2/3 bg-gray-50 rounded-2xl border border-gray-100 p-6">
                    <h4 className="text-sm font-black text-gray-900 uppercase tracking-tight mb-4">Operator Coverage by Region</h4>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {regionsList.map(regionId => {
                        const regionOps = operators.filter((op: any) => {
                          const opRegion = op.region || (Array.isArray(op.branch) ? op.branch[0] : op.branch);
                          return opRegion === regionId;
                        });
                        const regionRoutes = routes.filter(r => r.regionId === regionId || r.origin === regionId || r.destination === regionId);
                        return (
                          <div key={regionId} className="bg-white p-4 rounded-xl border border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Globe className="w-4 h-4 text-indigo-400" />
                              <div>
                                <p className="font-bold text-sm text-gray-800">{regionId}</p>
                                <p className="text-[10px] text-gray-400 font-medium">{regionRoutes.length} routes</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex -space-x-2">
                                {regionOps.slice(0, 3).map((op: any) => (
                                  <div key={op.id} className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white font-bold text-[10px] border-2 border-white">
                                    {(op.name || op.firstName || '?').charAt(0).toUpperCase()}
                                  </div>
                                ))}
                              </div>
                              <span className="text-sm font-black text-blue-600">{regionOps.length}</span>
                            </div>
                          </div>
                        );
                      })}
                      {regionsList.length === 0 && (
                        <p className="text-sm text-gray-400 col-span-full text-center italic">No regions configured yet</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 opacity-50">
                  <UserCog className="w-12 h-12 mb-3 text-gray-400" />
                  <p className="font-bold text-gray-500">No operators found</p>
                  <p className="text-sm text-gray-400 mt-1">Add operators in the Team section</p>
                </div>
              )}
            </div>
          )}

          {activeCard === 'bookings' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-black text-gray-900 text-lg uppercase tracking-tight">Bookings by Region</h3>
                  <p className="text-xs text-gray-400 mt-1">{bookings.length} total bookings across all regions</p>
                </div>
                <button onClick={() => setActiveTab('bookings')} className="text-xs font-bold text-indigo-600 uppercase tracking-widest border border-indigo-100 bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-colors">View All Bookings</button>
              </div>
              
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Left: Region booking summary */}
                <div className="w-full lg:w-1/3 space-y-2">
                  {regionsList.length > 0 ? regionsList.map(regionId => {
                    const regionRoutes = routes.filter(r => r.regionId === regionId || r.origin === regionId || r.destination === regionId);
                    const regionBookings = bookings.filter(b => regionRoutes.some(r => r.id === b.routeId));
                    const paidCount = regionBookings.filter(b => b.paymentStatus === 'paid').length;
                    return (
                      <div key={regionId} className="p-4 border border-gray-100 rounded-2xl bg-white hover:border-emerald-200 transition-all">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-emerald-500" />
                            <span className="font-bold text-gray-800 text-sm">{regionId}</span>
                          </div>
                          <span className="text-xl font-black text-emerald-700">{regionBookings.length}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                          <div 
                            className="bg-emerald-500 h-1.5 rounded-full transition-all"
                            style={{ width: bookings.length > 0 ? `${(regionBookings.length / bookings.length) * 100}%` : '0%' }}
                          />
                        </div>
                        <div className="flex justify-between mt-1.5">
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{paidCount} Paid</p>
                          <p className="text-[9px] font-bold text-gray-400">{bookings.length > 0 ? ((regionBookings.length / bookings.length) * 100).toFixed(0) : 0}% of total</p>
                        </div>
                      </div>
                    );
                  }) : (
                    <p className="text-sm text-gray-500">No regions configured.</p>
                  )}
                </div>

                {/* Right: Recent bookings feed */}
                <div className="w-full lg:w-2/3 bg-gray-50 rounded-2xl border border-gray-100 p-6">
                  <h4 className="text-sm font-black text-gray-900 uppercase tracking-tight mb-4">Recent Bookings Feed</h4>
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {[...bookings]
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .slice(0, 10)
                      .map(booking => {
                        const route = routes.find(r => r.id === booking.routeId);
                        const routeName = route?.name || 'Unknown Route';
                        const region = route?.regionId || '—';
                        return (
                          <div key={booking.id} className="bg-white p-3 rounded-xl border border-gray-100 flex items-center justify-between gap-4 hover:border-emerald-100 transition-colors">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                booking.paymentStatus === 'paid' ? 'bg-emerald-400' :
                                booking.paymentStatus === 'pending' ? 'bg-amber-400' : 'bg-rose-400'
                              }`} />
                              <div className="min-w-0">
                                <p className="font-bold text-xs text-gray-800 truncate">{booking.passengerDetails?.[0]?.name || 'Customer'}</p>
                                <p className="text-[10px] text-gray-400 truncate">{routeName}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 shrink-0">
                              <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">{region}</span>
                              <p className="font-black text-sm text-gray-900">MK {fmt(booking.totalAmount || 0)}</p>
                            </div>
                          </div>
                        );
                    })}
                    {bookings.length === 0 && <p className="text-sm text-gray-400 text-center italic py-8">No bookings yet</p>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeCard === 'payments' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-black text-gray-900 text-lg uppercase tracking-tight">Payments Overview</h3>
                  <p className="text-xs text-gray-400 mt-1">
                    MK {fmt(bookings.filter(b => b.paymentStatus === 'paid').reduce((s, b) => s + (b.totalAmount || 0), 0))} total collected
                  </p>
                </div>
                <button onClick={() => setActiveTab('payments')} className="text-xs font-bold text-indigo-600 uppercase tracking-widest border border-indigo-100 bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-colors">View All Payments</button>
              </div>

              <div className="flex flex-col lg:flex-row gap-6">
                {/* Left: Payment status breakdown */}
                <div className="w-full lg:w-1/3 space-y-3">
                  {([
                    { label: 'Paid', key: 'paid', colorClass: 'bg-emerald-50 border-emerald-100', textClass: 'text-emerald-700', barClass: 'bg-emerald-500', icon: CheckCircle, iconClass: 'text-emerald-500' },
                    { label: 'Pending', key: 'pending', colorClass: 'bg-amber-50 border-amber-100', textClass: 'text-amber-700', barClass: 'bg-amber-500', icon: RefreshCcw, iconClass: 'text-amber-500' },
                    { label: 'Failed / Refunded', key: 'failed', colorClass: 'bg-rose-50 border-rose-100', textClass: 'text-rose-700', barClass: 'bg-rose-500', icon: AlertTriangle, iconClass: 'text-rose-500' },
                  ] as const).map(({ label, key, colorClass, textClass, barClass, icon: Icon, iconClass }) => {
                    const count = key === 'failed'
                      ? bookings.filter(b => b.paymentStatus === 'failed' || b.paymentStatus === 'refunded').length
                      : bookings.filter(b => b.paymentStatus === key).length;
                    const revenue = bookings.filter(b => b.paymentStatus === key).reduce((s, b) => s + (b.totalAmount || 0), 0);
                    return (
                      <div key={key} className={`p-4 rounded-2xl border ${colorClass}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Icon className={`w-4 h-4 ${iconClass}`} />
                            <span className={`text-xs font-bold ${textClass}`}>{label}</span>
                          </div>
                          <span className={`text-xl font-black ${textClass}`}>{count}</span>
                        </div>
                        {key === 'paid' && revenue > 0 && (
                          <p className="text-[10px] font-bold text-emerald-600">MK {fmt(revenue)} collected</p>
                        )}
                        <div className="w-full bg-white/70 rounded-full h-1.5 mt-2">
                          <div 
                            className={`${barClass} h-1.5 rounded-full`}
                            style={{ width: bookings.length > 0 ? `${(count / bookings.length) * 100}%` : '0%' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Right: Recent paid transactions */}
                <div className="w-full lg:w-2/3 bg-gray-50 rounded-2xl border border-gray-100 p-6">
                  <h4 className="text-sm font-black text-gray-900 uppercase tracking-tight mb-4">Recent Transactions</h4>
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {[...bookings]
                      .filter(b => b.paymentStatus === 'paid')
                      .sort((a, b) => new Date(b.paidAt || b.updatedAt).getTime() - new Date(a.paidAt || a.updatedAt).getTime())
                      .slice(0, 10)
                      .map(booking => {
                        const routeName = routes.find(r => r.id === booking.routeId)?.name || 'Route';
                        return (
                          <div key={booking.id} className="bg-white p-3 rounded-xl border border-gray-100 flex items-center justify-between gap-4 hover:border-amber-100 transition-colors">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                                <Wallet className="w-4 h-4 text-amber-500" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-xs text-gray-800 truncate">{booking.passengerDetails?.[0]?.name || 'Customer'}</p>
                                <p className="text-[10px] text-gray-400 truncate">{routeName} • {new Date(booking.paidAt || booking.updatedAt).toLocaleDateString()}</p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-black text-sm text-gray-900">MK {fmt(booking.totalAmount || 0)}</p>
                              <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Paid</p>
                            </div>
                          </div>
                        );
                    })}
                    {bookings.filter(b => b.paymentStatus === 'paid').length === 0 && (
                      <p className="text-sm text-gray-400 text-center italic py-8">No completed payments yet</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          
        </div>
      )}

    </div>
  );
}
