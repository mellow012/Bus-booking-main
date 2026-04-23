'use client';

import React, { FC, useState, useEffect } from 'react';
import { Schedule, Bus, Booking, Company } from '@/types';
import { Flag, Banknote, Users, CheckCircle, CarFront, Timer, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';

interface TripSummaryCardProps {
  trip: Schedule;
  bus: Bus | null;
  bookings: Booking[];
  company: Company | null;
  onRefresh?: () => void;
}

const TripSummaryCard: FC<TripSummaryCardProps> = ({ trip, bus, bookings, company, onRefresh }) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{
    expectedRevenue: number;
    cashCollected: number;
    totalBoarded: number;
    totalNoShow: number;
    walkOns: number;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchOrCalculateStats = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/conductor/summary?tripId=${trip.id}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.success) {
            setStats(data.summary);
            return;
          }
        }
        
        if (!isMounted) return;
        const validBookings = bookings.filter(b => b.bookingStatus !== 'cancelled');
        const boarded = validBookings.filter(b => b.bookingStatus === 'confirmed' || b.bookingStatus === 'completed');
        const noShow = validBookings.filter(b => b.bookingStatus === 'no-show');
        const walkOns = validBookings.filter(b => (b as any).isWalkOn || (b as any).bookedBy === 'conductor');
        
        const cashBookings = boarded.filter(b => b.paymentStatus === 'paid' && b.paymentMethod === 'cash');
        const expected = validBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
        const cash = cashBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);

        setStats({
          expectedRevenue: expected,
          cashCollected: cash,
          totalBoarded: boarded.length,
          totalNoShow: noShow.length,
          walkOns: walkOns.length,
        });

      } catch (err) {
        console.error('Failed to get summary:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchOrCalculateStats();
    return () => { isMounted = false; };
  }, [trip.id, bookings]);

  const arrDate = trip.tripCompletedAt ? new Date(trip.tripCompletedAt) : new Date(trip.arrivalDateTime);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-green-600 p-5 sm:p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <span className="bg-green-500 text-green-50 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider inline-block mb-2">
              Trip Completed
            </span>
            <h3 className="text-lg sm:text-xl font-bold truncate">{trip.departureLocation} → {trip.arrivalLocation}</h3>
            <p className="text-green-100 mt-1 text-sm">Arrived {format(arrDate, 'MMM d, yyyy HH:mm')}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-green-500 flex items-center justify-center shrink-0 ml-3">
            <Flag className="w-6 h-6 text-white" />
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {loading || !stats ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
            <p className="text-gray-500 text-sm">Validating trip manifest...</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="flex items-center gap-2 text-gray-500 mb-2">
                  <Banknote className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Cash Collected</span>
                </div>
                <p className="text-xl sm:text-2xl font-black text-gray-900">MWK {stats.cashCollected.toLocaleString()}</p>
                <p className="mt-1.5 text-[11px] text-gray-500">
                  Total: MWK {stats.expectedRevenue.toLocaleString()}
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="flex items-center gap-2 text-gray-500 mb-2">
                  <Users className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Passengers</span>
                </div>
                <p className="text-xl sm:text-2xl font-black text-gray-900">{stats.totalBoarded} <span className="text-sm font-medium text-gray-500">boarded</span></p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[10px] font-bold">{stats.totalNoShow} No-shows</span>
                  <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-bold">{stats.walkOns} Walk-ons</span>
                </div>
              </div>
            </div>

            {/* Trip Details */}
            <div className="border-t border-gray-100 pt-4">
              <h4 className="text-sm font-bold text-gray-900 mb-3">Trip Details</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-0.5">Bus</p>
                  <p className="font-semibold text-gray-900 flex items-center gap-1.5"><CarFront className="w-4 h-4 text-gray-400" /> {bus?.licensePlate || 'N/A'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-0.5">Company</p>
                  <p className="font-semibold text-gray-900 truncate">{company?.name || 'BusOps'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-0.5">Duration</p>
                  <p className="font-semibold text-gray-900 flex items-center gap-1.5">
                    <Timer className="w-4 h-4 text-gray-400" /> 
                    {trip.tripCompletedAt ? (
                      `${Math.round((new Date(trip.tripCompletedAt).getTime() - new Date(trip.departureDateTime).getTime()) / 60000)} mins`
                    ) : 'N/A'}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-0.5">Status</p>
                  <p className="font-semibold text-green-600 flex items-center gap-1.5"><CheckCircle className="w-4 h-4" /> Verified</p>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-400 text-center bg-gray-50 p-3 rounded-xl">
              This summary has been recorded. You can close this trip.
            </p>
            
            {onRefresh && (
               <Button onClick={onRefresh} variant="outline" className="w-full h-12 rounded-xl font-bold">
                 Back to Active Trips
               </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TripSummaryCard;
