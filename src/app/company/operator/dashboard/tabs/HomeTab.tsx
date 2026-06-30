'use client';

import React from 'react';
import { Schedule, Booking, Route, Bus } from '@/types';
import { Calendar, Users, QrCode, Bus as BusIcon, TrendingUp } from 'lucide-react';

interface HomeTabProps {
  dashboard: any;
}

export default function HomeTab({ dashboard }: HomeTabProps) {
  const { schedules, bookings, assignedRoutes: routes, buses } = dashboard;

  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);
  const todayEnd = new Date();
  todayEnd.setHours(23,59,59,999);

  const todaysSchedules = schedules.filter((s: Schedule) => {
    const d = new Date(s.departureDateTime);
    return d >= todayStart && d <= todayEnd;
  });

  const todaysBookings = bookings.filter((b: Booking) => {
    const d = new Date(b.createdAt);
    return d >= todayStart && d <= todayEnd;
  });

  const generatedRevenue = todaysBookings
    .filter((b:Booking) => b.paymentStatus === 'paid')
    .reduce((acc:number, b:Booking) => acc + (b.totalAmount || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900">Operator Home</h2>
          <p className="mt-1 text-sm text-gray-500">Your daily tasks and quick stats.</p>
        </div>
        <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors">
          <QrCode className="w-4 h-4" /> Quick Scanner
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-500">Today's Schedules</div>
            <div className="text-2xl font-bold text-gray-900">{todaysSchedules.length}</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-500">Tickets Generated</div>
            <div className="text-2xl font-bold text-gray-900">{todaysBookings.length}</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-green-600">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-500">Today's Generated Revenue</div>
            <div className="text-2xl font-bold text-gray-900">MWK {generatedRevenue.toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Active Trips</h3>
        {todaysSchedules.length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            No active schedules for today.
          </div>
        ) : (
          <div className="space-y-4">
            {todaysSchedules.map((schedule: Schedule) => {
              const route = routes.find((r:Route) => r.id === schedule.routeId);
              const bus = buses.find((b:Bus) => b.id === schedule.busId);
              return (
                <div key={schedule.id} className="p-4 border border-gray-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="font-bold text-gray-900">{route?.name || 'Unknown Route'}</div>
                    <div className="flex gap-4 text-xs text-gray-500 mt-1">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/> {new Date(schedule.departureDateTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                      <span className="flex items-center gap-1"><BusIcon className="w-3 h-3"/> {bus?.licensePlate || 'TBA'}</span>
                    </div>
                  </div>
                  <div>
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide ${
                      schedule.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {schedule.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
