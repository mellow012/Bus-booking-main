'use client';

import React, { useState } from 'react';
import { 
  Building2, MapPin, DollarSign, Users, 
  Bus as BusIcon, CalendarDays, ChevronRight, AlertCircle, X, Rocket, Clock, TrendingUp
} from 'lucide-react';
import { Company, Schedule, Route, Booking } from '@/types';
import EmptyState from '@/components/ui/EmptyState';

interface OverviewTabProps {
  dashboard: any;
}

export default function OverviewTab({ dashboard }: OverviewTabProps) {
  const { dashboardData, statistics } = dashboard;
  const { company, routes, schedules, bookings, operators, buses } = dashboardData;
  const branches = dashboardData.regions || [];

  const [activeModal, setActiveModal] = useState<'branches' | 'routes' | 'revenue' | 'bookings' | null>(null);

  // Stats calculation
  const paidBookings = bookings.filter((b: Booking) => b.paymentStatus === 'paid');
  const totalRevenue = paidBookings.reduce((acc: number, b: Booking) => acc + (b.totalAmount || 0), 0);

  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);
  
  const todayBookings = bookings.filter((b: Booking) => {
    const d = new Date(b.createdAt);
    return d >= todayStart && d <= todayEnd;
  });

  const closeModal = () => setActiveModal(null);

  // Newly boarded: if nothing exists, show onboarding prompt
  const isNewlyBoarded = branches.length === 0 && routes.length === 0 && bookings.length === 0;

  if (isNewlyBoarded) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <EmptyState
          icon={Rocket}
          title="Welcome to your Dashboard!"
          description="You're all set up. Start by adding a branch, then create your first route and schedule to begin accepting bookings."
          actionLabel="Get Started — Add a Branch"
          onAction={() => dashboard.setActiveCategory('team')}
        />
      </div>
    );
  }

  // Helper: get branch name by regionId
  const getBranchName = (regionId: string | null | undefined) => {
    if (!regionId) return 'Unassigned';
    const branch = branches.find((b: any) => b.id === regionId);
    return branch?.name || 'Unknown';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        
        {/* Branches Card */}
        <div 
          onClick={() => setActiveModal('branches')}
          className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <Building2 className="w-16 h-16 text-indigo-600" />
          </div>
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              <Building2 className="w-6 h-6" />
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-600 transition-colors" />
          </div>
          <h3 className="text-gray-500 font-medium mb-1">Branches</h3>
          <div className="text-3xl font-bold text-gray-900">{branches.length}</div>
          <p className="text-sm text-gray-500 mt-2">{operators.length} operators assigned</p>
        </div>

        {/* Routes Card */}
        <div 
          onClick={() => setActiveModal('routes')}
          className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <MapPin className="w-16 h-16 text-emerald-600" />
          </div>
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
              <MapPin className="w-6 h-6" />
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-emerald-600 transition-colors" />
          </div>
          <h3 className="text-gray-500 font-medium mb-1">Active Routes</h3>
          <div className="text-3xl font-bold text-gray-900">{routes.filter((r: Route) => r.isActive).length}</div>
          <p className="text-sm text-gray-500 mt-2">{schedules.filter((s: Schedule) => s.isActive).length} active schedules</p>
        </div>

        {/* Revenue Card */}
        <div 
          onClick={() => setActiveModal('revenue')}
          className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <DollarSign className="w-16 h-16 text-blue-600" />
          </div>
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
              <DollarSign className="w-6 h-6" />
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-600 transition-colors" />
          </div>
          <h3 className="text-gray-500 font-medium mb-1">Total Revenue</h3>
          <div className="text-3xl font-bold text-gray-900">MWK {totalRevenue.toLocaleString()}</div>
          <p className="text-sm text-green-600 mt-2 font-medium flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> View Branch Breakdown
          </p>
        </div>

        {/* Bookings Card */}
        <div 
          onClick={() => setActiveModal('bookings')}
          className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <Users className="w-16 h-16 text-amber-600" />
          </div>
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
              <Users className="w-6 h-6" />
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-amber-600 transition-colors" />
          </div>
          <h3 className="text-gray-500 font-medium mb-1">Today&apos;s Bookings</h3>
          <div className="text-3xl font-bold text-gray-900">{todayBookings.length}</div>
          <p className="text-sm text-gray-500 mt-2">{statistics.pendingBookings} pending approval</p>
        </div>

      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <BusIcon className="w-4 h-4" /> Buses
          </div>
          <div className="text-2xl font-bold text-gray-900">{buses?.length || 0}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <CalendarDays className="w-4 h-4" /> Schedules Today
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {schedules.filter((s: Schedule) => {
              const dep = new Date(s.departureDateTime);
              return dep >= todayStart && dep <= todayEnd;
            }).length}
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Users className="w-4 h-4" /> Operators
          </div>
          <div className="text-2xl font-bold text-gray-900">{operators.length}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-amber-600 mb-1">
            <Clock className="w-4 h-4" /> Missed Schedules
          </div>
          <div className="text-2xl font-bold text-amber-600">{statistics.missedSchedules}</div>
        </div>
      </div>

      {/* Snapshot / Latest Bookings Feed */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Latest Bookings</h3>
        {bookings.length === 0 ? (
          <div className="py-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">No bookings yet. Once customers book trips, they&apos;ll appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ref</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Passenger</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {bookings.slice(0, 5).map((b: Booking) => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{b.bookingReference}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{b.passengerDetails?.[0]?.name || '—'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(b.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">MWK {b.totalAmount?.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        b.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {b.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals for Card clicks */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={closeModal}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900 capitalize">{activeModal} Details</h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              {activeModal === 'branches' && (
                <div className="space-y-4">
                  {branches.length === 0 ? (
                    <div className="py-6 text-center text-gray-500">
                      <Building2 className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                      <p>No branches added yet. Go to Operators &amp; Branches to create one.</p>
                    </div>
                  ) : (
                    branches.map((branch: any) => {
                      const branchOps = operators.filter((o: any) => o.regionId === branch.id || o.branch?.includes(branch.name));
                      const branchRoutes = routes.filter((r: Route) => r.regionId === branch.id);
                      return (
                        <div key={branch.id} className="p-4 rounded-xl border border-gray-100 bg-gray-50">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-gray-800 text-lg">{branch.name}</span>
                            {branch.code && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">{branch.code}</span>}
                          </div>
                          <div className="flex gap-4 text-sm text-gray-500">
                            <span>{branchOps.length} Operators</span>
                            <span>{branchRoutes.length} Routes</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
              {activeModal === 'routes' && (
                <div className="space-y-4">
                  {routes.length === 0 ? (
                    <div className="py-6 text-center text-gray-500">
                      <MapPin className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                      <p>No routes created yet. Add routes in the Regions tab.</p>
                    </div>
                  ) : (
                    routes.map((route: Route) => {
                      const routeSchedules = schedules.filter((s: Schedule) => s.routeId === route.id);
                      const routeBookings = bookings.filter((b: Booking) => b.routeId === route.id);
                      return (
                        <div key={route.id} className="p-4 rounded-xl border border-gray-100 bg-gray-50">
                          <div className="font-bold text-gray-800">{route.name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{route.origin} → {route.destination}</div>
                          <div className="text-sm text-gray-500 mt-2 flex gap-4">
                            <span>{routeSchedules.length} Schedules</span>
                            <span>{routeBookings.length} Bookings</span>
                            <span className="text-green-600 font-medium">MWK {routeBookings.filter((b: Booking) => b.paymentStatus === 'paid').reduce((acc: number, b: Booking) => acc + (b.totalAmount || 0), 0).toLocaleString()}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
              {activeModal === 'revenue' && (
                <div className="space-y-4">
                  {branches.length === 0 ? (
                    <div className="py-6 text-center text-gray-500">
                      <DollarSign className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                      <p>Add branches first to see revenue breakdown.</p>
                    </div>
                  ) : (
                    branches.map((branch: any) => {
                      const branchRouteIds = routes.filter((r: Route) => r.regionId === branch.id).map((r: Route) => r.id);
                      const branchRevenue = paidBookings
                        .filter((b: Booking) => branchRouteIds.includes(b.routeId || ''))
                        .reduce((acc: number, b: Booking) => acc + (b.totalAmount || 0), 0);
                      return (
                        <div key={branch.id} className="p-4 rounded-xl border border-gray-100 bg-gray-50 flex justify-between items-center">
                          <span className="font-medium text-gray-800">{branch.name}</span>
                          <span className="font-bold text-green-600">MWK {branchRevenue.toLocaleString()}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
              {activeModal === 'bookings' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-indigo-50 rounded-xl text-center">
                      <div className="text-2xl font-bold text-indigo-600">{todayBookings.length}</div>
                      <div className="text-sm font-medium text-indigo-900 mt-1">Total Today</div>
                    </div>
                    <div className="p-4 bg-green-50 rounded-xl text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {todayBookings.filter((b: Booking) => b.paymentStatus === 'paid').length}
                      </div>
                      <div className="text-sm font-medium text-green-900 mt-1">Paid</div>
                    </div>
                  </div>
                  {todayBookings.length === 0 && (
                    <div className="py-4 text-center text-gray-500 text-sm">No bookings recorded today yet.</div>
                  )}
                  {todayBookings.length > 0 && (
                    <div className="space-y-2 mt-4">
                      <h4 className="text-sm font-bold text-gray-700">Recent</h4>
                      {todayBookings.slice(0, 5).map((b: Booking) => (
                        <div key={b.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100 text-sm">
                          <div>
                            <span className="font-medium text-gray-900">{b.passengerDetails?.[0]?.name || b.bookingReference}</span>
                            <span className="text-gray-400 ml-2 text-xs">{b.seatNumbers?.join(', ')}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            b.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {b.paymentStatus}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 text-right">
              <button onClick={closeModal} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}