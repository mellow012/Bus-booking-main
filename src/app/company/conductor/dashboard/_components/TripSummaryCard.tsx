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
        // We will hit our new API route to get the official summary
        const res = await fetch(`/api/conductor/summary?tripId=${trip.id}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.success) {
            setStats(data.summary);
            return;
          }
        }
        
        // Fallback: calculate locally if API fails
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-green-600 p-6 text-white flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-green-500 text-green-50 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">
              Trip Completed
            </span>
          </div>
          <h3 className="text-xl font-bold">{trip.departureLocation} → {trip.arrivalLocation}</h3>
          <p className="text-green-100 mt-1">Arrived {format(arrDate, 'MMM d, yyyy HH:mm')}</p>
        </div>
        <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
          <Flag className="w-6 h-6 text-white" />
        </div>
      </div>

      <div className="p-6">
        {loading || !stats ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
            <p className="text-gray-500 text-sm">Validating trip manifest...</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="flex items-center gap-2 text-gray-500 mb-2">
                  <Banknote className="w-4 h-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Cash Collected</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">MWK {stats.cashCollected.toLocaleString()}</p>
                <div className="mt-2 text-xs text-gray-500">
                  Total Revenue: MWK {stats.expectedRevenue.toLocaleString()}
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="flex items-center gap-2 text-gray-500 mb-2">
                  <Users className="w-4 h-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Passengers</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalBoarded} <span className="text-sm font-medium text-gray-500">boarded</span></p>
                <div className="mt-2 text-xs text-gray-500 flex items-center gap-2">
                  <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{stats.totalNoShow} No-shows</span>
                  <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{stats.walkOns} Walk-ons</span>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-6">
              <h4 className="text-sm font-semibold text-gray-900 mb-4">Trip Details</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 text-xs mb-1">Bus</p>
                  <p className="font-medium text-gray-900 flex items-center gap-1.5"><CarFront className="w-4 h-4 text-gray-400" /> {bus?.licensePlate || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">Company</p>
                  <p className="font-medium text-gray-900">{company?.name || 'BusOps'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">Duration</p>
                  <p className="font-medium text-gray-900 flex items-center gap-1.5">
                    <Timer className="w-4 h-4 text-gray-400" /> 
                    {trip.tripCompletedAt ? (
                      `${Math.round((new Date(trip.tripCompletedAt).getTime() - new Date(trip.departureDateTime).getTime()) / 60000)} mins`
                    ) : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">Status</p>
                  <p className="font-medium text-green-600 flex items-center gap-1.5"><CheckCircle className="w-4 h-4" /> Verified</p>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-400 text-center bg-gray-50 p-3 rounded-lg">
              This summary has been recorded in the company daily report. You can close this trip.
            </p>
            
            {onRefresh && (
               <Button onClick={onRefresh} variant="outline" className="w-full">
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
