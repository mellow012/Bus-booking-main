'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Booking, Route, Schedule } from '@/types';
import PassengerVerificationModal from './PassengerVerificationModal';

interface ConductorBookingsTabProps {
  bookings: Booking[];
  selectedTrip: Schedule | null;
  route?: Route | null;
  onScan: () => void;
  onMarkAlighted: (id: string, isAlighted: boolean) => Promise<void>;
  onMarkBoarded: (id: string) => Promise<void>;
  loadingActionId: string | null;
}

const fuzzyMatch = (value: string, query: string) => {
  let cursor = 0;
  for (const char of value.toLowerCase()) if (char === query.toLowerCase()[cursor]) cursor += 1;
  return cursor === query.length;
};

export default function ConductorBookingsTab({ bookings, selectedTrip, route, onScan, onMarkAlighted, onMarkBoarded, loadingActionId }: ConductorBookingsTabProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'booked' | 'paid' | 'boarded' | 'off'>('all');
  const [selected, setSelected] = useState<Booking | null>(null);
  const valid = bookings.filter((booking) => booking.bookingStatus !== 'cancelled');
  const stats = [
    ['Booked', valid.length, 'booked'],
    ['Paid', valid.filter((booking) => booking.paymentStatus === 'paid').length, 'paid'],
    ['Boarded', valid.filter((booking) => ['confirmed', 'completed'].includes(booking.bookingStatus)).length, 'boarded'],
  ] as const;
  const filtered = useMemo(() => valid.filter((booking) => {
    const matchesFilter = filter === 'all' || filter === 'booked' || filter === 'paid' && booking.paymentStatus === 'paid' ||
      filter === 'boarded' && ['confirmed', 'completed'].includes(booking.bookingStatus) || filter === 'off' && booking.bookingStatus === 'alighted';
    const text = `${booking.bookingReference} ${booking.passengerDetails?.[0]?.name || ''} ${booking.seatNumbers?.join(' ') || ''}`;
    return matchesFilter && (!query || fuzzyMatch(text, query));
  }), [valid, filter, query]);

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-4">
      <div className="grid grid-cols-3 gap-2">
        {stats.map(([label, value, key]) => <button key={key} onClick={() => setFilter(key)} className={`rounded-2xl border p-3 text-center shadow-sm ${filter === key ? 'border-brand-600 bg-brand-50' : 'bg-white'}`}><p className="text-[10px] font-bold uppercase text-gray-400">{label}</p><p className="text-xl font-black text-brand-900">{value}</p></button>)}
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ref, name, or seat" className="w-full rounded-xl border bg-white py-3 pl-9 pr-3 text-sm outline-none focus:border-brand-600" /></div>
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {(['all', 'booked', 'paid', 'boarded', 'off'] as const).map((key) => <button key={key} onClick={() => setFilter(key)} className={`rounded-full px-3 py-2 text-xs font-bold capitalize ${filter === key ? 'bg-brand-700 text-white' : 'bg-white text-gray-500 border'}`}>{key}</button>)}
      </div>
      <div className="space-y-2">
        {filtered.map((booking) => {
          const off = booking.bookingStatus === 'alighted';
          const boarded = ['confirmed', 'completed'].includes(booking.bookingStatus);
          return <button key={booking.id} onClick={() => setSelected(booking)} className="flex w-full items-center justify-between rounded-2xl border bg-white p-4 text-left shadow-sm">
            <span><span className="block font-black text-gray-900">{booking.passengerDetails?.[0]?.name || 'Passenger'}</span><span className="text-xs text-gray-500">Seat {booking.seatNumbers?.join(', ')} · {booking.bookingReference}</span></span>
            <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${off ? 'bg-blue-100 text-blue-700' : boarded ? 'bg-green-100 text-green-700' : booking.paymentStatus === 'paid' ? 'bg-brand-100 text-brand-800' : 'bg-amber-100 text-amber-800'}`}>{off ? 'Off' : boarded ? 'Boarded' : booking.paymentStatus === 'paid' ? 'Paid' : 'Booked'}</span>
          </button>;
        })}
      </div>
      {selected && (
        <PassengerVerificationModal
          booking={selected}
          selectedTrip={selectedTrip}
          route={route}
          onClose={() => setSelected(null)}
          onScan={() => { setSelected(null); onScan(); }}
          onConfirm={selectedTrip?.currentStopId && (selected.bookingStatus === 'alighted' || ['confirmed', 'completed'].includes(selected.bookingStatus))
            ? () => onMarkAlighted(selected.id, selected.bookingStatus !== 'alighted')
            : selected.bookingStatus === 'pending'
              ? () => onMarkBoarded(selected.id)
            : undefined}
          loading={loadingActionId === selected.id}
          confirmLabel={selected.bookingStatus === 'alighted' ? 'Undo Off' : selected.bookingStatus === 'pending' ? 'Confirm passenger and board' : 'Mark Off'}
          requirePayment={selected.bookingStatus === 'pending'}
          requireVerification={selected.bookingStatus === 'pending'}
        />
      )}
    </div>
  );
}
