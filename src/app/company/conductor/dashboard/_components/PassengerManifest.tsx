'use client';

import React, { FC, useState, useMemo } from 'react';
import { Booking } from '@/types';
import { Search, MapPin, Phone, Users, Bus as BusIcon, CheckCircle, XCircle, Banknote, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type FilterTab = 'all' | 'needs_boarding' | 'cash_due' | 'boarded' | 'no_show';

interface PassengerManifestProps {
  bookings: Booking[];
  tripStatus: string;
  onOpenCashModal: (b: Booking) => void;
  onMarkBoarded: (id: string, isBoarded: boolean) => Promise<void>;
  onMarkNoShow: (id: string, isNoShow: boolean) => Promise<void>;
  loadingActionId: string | null;
}

const PassengerManifest: FC<PassengerManifestProps> = ({
  bookings, tripStatus, onOpenCashModal, onMarkBoarded, onMarkNoShow, loadingActionId,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  const validBookings = useMemo(() => bookings.filter(b => b.bookingStatus !== 'cancelled'), [bookings]);

  // Derived stats
  const stats = useMemo(() => {
    let cashList = 0; let pending = 0; let boarded = 0; let noshow = 0; let totalCashDue = 0;
    validBookings.forEach(b => {
      const isPaid = b.paymentStatus === 'paid';
      const isBoarded = b.bookingStatus === 'confirmed' || b.bookingStatus === 'completed';
      const isNoShow = b.bookingStatus === 'no-show';

      if (!isPaid) { cashList++; totalCashDue += (b.totalAmount || 0); }
      if (!isBoarded && !isNoShow) pending++;
      if (isBoarded) boarded++;
      if (isNoShow) noshow++;
    });
    return { cashList, pending, boarded, noshow, totalCashDue, total: validBookings.length };
  }, [validBookings]);

  // Filtering
  const filteredBookings = useMemo(() => {
    let f = validBookings;
    if (activeFilter === 'needs_boarding') f = f.filter(b => b.bookingStatus === 'pending');
    else if (activeFilter === 'cash_due') f = f.filter(b => b.paymentStatus !== 'paid');
    else if (activeFilter === 'boarded') f = f.filter(b => b.bookingStatus === 'confirmed' || b.bookingStatus === 'completed');
    else if (activeFilter === 'no_show') f = f.filter(b => b.bookingStatus === 'no-show');

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      f = f.filter(b => {
        const n = b.passengerDetails?.[0]?.name?.toLowerCase() || '';
        const p = b.contactPhone?.toLowerCase() || '';
        const s = b.seatNumbers?.join(', ') || '';
        return n.includes(q) || p.includes(q) || s.includes(q) || b.bookingReference?.toLowerCase().includes(q);
      });
    }

    // Sort by seat number
    f.sort((a, b) => {
      const sA = parseInt(a.seatNumbers?.[0] || '999');
      const sB = parseInt(b.seatNumbers?.[0] || '999');
      return sA - sB;
    });

    return f;
  }, [validBookings, activeFilter, searchTerm]);

  // Determine if interaction is allowed
  const isTripActive = tripStatus === 'boarding' || tripStatus === 'in_transit';

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border space-y-4">
        {/* Cash Banner */}
        {stats.cashList > 0 && isTripActive && (
          <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded-r-lg flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-800">
              <Banknote className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm">Cash collection pending</p>
                <p className="text-xs">Collect <strong className="font-bold">MWK {stats.totalCashDue.toLocaleString()}</strong> from {stats.cashList} passenger(s).</p>
              </div>
            </div>
            <Button size="sm" variant="outline" className="text-amber-700 border-amber-300 hover:bg-amber-100 h-8"
              onClick={() => setActiveFilter('cash_due')}>
              View Due
            </Button>
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" placeholder="Search by name, phone, or seat..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
        </div>

        <div className="flex overflow-x-auto gap-2 pb-1 hide-scrollbar">
          {(['all', 'needs_boarding', 'cash_due', 'boarded', 'no_show'] as FilterTab[]).map(tab => {
            let label = ''; let count = 0;
            if (tab === 'all') { label = 'All'; count = stats.total; }
            else if (tab === 'needs_boarding') { label = 'Needs Boarding'; count = stats.pending; }
            else if (tab === 'cash_due') { label = 'Cash Due'; count = stats.cashList; }
            else if (tab === 'boarded') { label = 'Boarded'; count = stats.boarded; }
            else if (tab === 'no_show') { label = 'No-Show'; count = stats.noshow; }

            const isActive = activeFilter === tab;
            let actCls = 'bg-gray-100 text-gray-600 border-transparent';
            if (isActive) {
              if (tab === 'cash_due') actCls = 'bg-amber-100 text-amber-800 border-amber-300';
              else if (tab === 'boarded') actCls = 'bg-green-100 text-green-800 border-green-300';
              else if (tab === 'no_show') actCls = 'bg-red-100 text-red-800 border-red-300';
              else actCls = 'bg-blue-100 text-blue-800 border-blue-300';
            }

            return (
              <button key={tab} onClick={() => setActiveFilter(tab)}
                className={`whitespace-nowrap px-4 py-2 text-sm font-medium rounded-full border transition-all ${actCls}`}>
                {label} <span className="ml-1.5 opacity-70">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Manifest List */}
      <div className="space-y-3">
        {filteredBookings.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-xl border border-dashed border-gray-300">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No passengers found for this filter.</p>
          </div>
        ) : (
          filteredBookings.map((b) => {
            const isBoarded = b.bookingStatus === 'confirmed' || b.bookingStatus === 'completed';
            const isNoShow = b.bookingStatus === 'no-show';
            const isPaid = b.paymentStatus === 'paid';
            const isCashDue = !isPaid;
            const pax = b.passengerDetails?.[0];
            const isWorking = loadingActionId === b.id;

            return (
              <div key={b.id} className={`bg-white rounded-xl border p-4 shadow-sm transition-all
                ${isBoarded ? 'border-l-4 border-l-green-500 opacity-75' :
                  isNoShow ? 'border-l-4 border-l-red-500 opacity-60' :
                    isCashDue ? 'border-l-4 border-l-amber-500' : 'border-l-4 border-l-blue-500'
                }`}>
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  {/* Info side */}
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0
                      bg-blue-50 text-blue-700 border border-blue-100">
                      {b.seatNumbers?.[0] || '?'}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-gray-900 truncate">{pax?.name || 'Passenger'}</p>
                        {isBoarded && <span className="bg-green-100 text-green-700 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded">Boarded</span>}
                        {isNoShow && <span className="bg-red-100 text-red-700 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded">No-Show</span>}
                        {isCashDue && <span className="bg-amber-100 text-amber-800 text-[10px] uppercase font-bold flex items-center gap-0.5 px-1.5 py-0.5 rounded">
                          <Banknote className="w-3 h-3" /> MWK {b.totalAmount} Due
                        </span>}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1 min-w-0"><Phone className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{b.contactPhone || 'No Phone'}</span></span>
                        <span className="flex items-center gap-1 min-w-0 font-medium"><MapPin className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{(b as any).destinationStopName || (b as any).schedule?.route?.destination || 'N/A'}</span></span>
                        <span className="flex items-center gap-1 font-mono">{b.bookingReference}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Side */}
                  {isTripActive && (
                    <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end pt-3 sm:pt-0 border-t sm:border-none mt-2 sm:mt-0">
                      {isCashDue ? (
                        <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white w-full sm:w-auto font-medium"
                          onClick={() => onOpenCashModal(b)} disabled={isWorking || isNoShow}>
                          Collect Mwk {b.totalAmount}
                        </Button>
                      ) : (
                        <>
                          <Button size="sm" variant={isBoarded ? 'outline' : 'default'}
                            className={`${isBoarded ? 'text-gray-500' : 'bg-green-600 hover:bg-green-700 text-white'} flex-1 sm:flex-none font-medium h-9`}
                            onClick={() => onMarkBoarded(b.id, !isBoarded)}
                            disabled={isWorking || isNoShow}>
                            {isBoarded ? <RefreshCw className="w-4 h-4 mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                            {isBoarded ? 'Undo Board' : 'Board'}
                          </Button>

                          <Button size="sm" variant="outline"
                            className={`flex-1 sm:flex-none font-medium h-9 ${isNoShow ? 'text-red-700 bg-red-50 border-red-200' : 'text-gray-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50'}`}
                            onClick={() => onMarkNoShow(b.id, !isNoShow)}
                            disabled={isWorking || isBoarded}>
                            {isNoShow ? <RefreshCw className="w-4 h-4 mr-1" /> : <XCircle className="w-4 h-4 mr-1" />}
                            {isNoShow ? 'Undo No-Show' : 'No-Show'}
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default PassengerManifest;
