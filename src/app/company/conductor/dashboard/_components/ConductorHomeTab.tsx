'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Bus as BusIcon, Clock3, Flag, Loader2, MapPin, Navigation, Play, QrCode, Search, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RouteStopsDisplay, RouteStopDisplayItem } from '@/components/RouteStopsDisplay';
import { Booking, Bus, Route, Schedule, buildTripStopSequence } from '@/types';
import { formatTime12 } from '@/lib/timezone';

interface ConductorHomeTabProps {
  selectedTrip: Schedule | null;
  routes: Route[];
  buses: Bus[];
  bookings: Booking[];
  onWalkOn: () => void;
  onScan: () => void;
  onRefresh: () => void;
  onUpdateTripStatus: (status: 'boarding' | 'in_transit' | 'arrived' | 'completed', extra?: Record<string, unknown>) => Promise<void>;
  statusLoading: boolean;
}

const fuzzyMatch = (value: string, query: string) => {
  let cursor = 0;
  for (const char of value.toLowerCase()) {
    if (char === query.toLowerCase()[cursor]) cursor += 1;
  }
  return cursor === query.length;
};

export default function ConductorHomeTab({
  selectedTrip, routes, buses, bookings, onWalkOn, onScan, onRefresh,
  onUpdateTripStatus, statusLoading,
}: ConductorHomeTabProps) {
  const [query, setQuery] = useState('');
  const [showBack, setShowBack] = useState(false);
  const route = selectedTrip ? routes.find((item) => item.id === selectedTrip.routeId) : null;
  const bus = selectedTrip ? buses.find((item) => item.id === selectedTrip.busId) : null;

  useEffect(() => {
    setShowBack(false);
  }, [selectedTrip?.tripStatus]);

  const stops = useMemo<RouteStopDisplayItem[]>(() => {
    if (!selectedTrip) return [];
    const current = selectedTrip.currentStopIndex ?? 0;
    return buildTripStopSequence(selectedTrip, route).map((stop, index) => ({
      id: stop.id,
      name: stop.name,
      stage: index < current ? 'passed' : index === current ? 'current' : 'upcoming',
    }));
  }, [selectedTrip, route]);

  const filteredBookings = useMemo(() => {
    const active = bookings.filter((booking) => booking.bookingStatus !== 'cancelled');
    if (!query.trim()) return active.slice(0, 5);
    return active.filter((booking) => fuzzyMatch(
      `${booking.passengerDetails?.[0]?.name ?? ''} ${booking.seatNumbers?.join(' ') ?? ''}`,
      query.trim(),
    )).slice(0, 5);
  }, [bookings, query]);

  if (!selectedTrip) {
    return (
      <div className="rounded-3xl bg-white p-8 text-center shadow-sm border">
        <BusIcon className="mx-auto mb-3 h-10 w-10 text-brand-300" />
        <h2 className="text-lg font-black text-brand-900">No trip assigned</h2>
        <p className="mt-1 text-sm text-gray-500">Your assigned trips will appear here.</p>
        <Button onClick={onRefresh} className="mt-5 bg-brand-700 text-white">Refresh schedule</Button>
      </div>
    );
  }

  const isLive = selectedTrip.tripStatus === 'boarding' || selectedTrip.tripStatus === 'in_transit' || selectedTrip.tripStatus === 'arrived';
  const paid = bookings.filter((booking) => booking.paymentStatus === 'paid').length;
  const booked = bookings.filter((booking) => booking.bookingStatus !== 'cancelled').length;
  const status = selectedTrip.tripStatus?.replace('_', ' ') || 'scheduled';
  const stopSequence = buildTripStopSequence(selectedTrip, route);
  const currentStopIndex = selectedTrip.currentStopIndex ?? 0;
  const nextStop = stopSequence[currentStopIndex + 1];
  const statusAction = selectedTrip.tripStatus === 'scheduled' || !selectedTrip.tripStatus
    ? {
        label: 'Start boarding',
        icon: Play,
        className: 'bg-emerald-600 hover:bg-emerald-700',
        onClick: () => onUpdateTripStatus('boarding'),
      }
    : selectedTrip.tripStatus === 'boarding'
      ? {
          label: 'Depart origin',
          icon: Navigation,
          className: 'bg-brand-700 hover:bg-brand-800',
          onClick: () => onUpdateTripStatus('in_transit', { currentStopIndex: 0, currentStopId: '__origin__' }),
        }
      : selectedTrip.tripStatus === 'in_transit'
        ? {
            label: nextStop?.id === '__destination__' ? 'Complete trip' : `Next stop${nextStop ? `: ${nextStop.name}` : ''}`,
            icon: nextStop?.id === '__destination__' ? Flag : ArrowRight,
            className: 'bg-brand-700 hover:bg-brand-800',
            onClick: () => nextStop && onUpdateTripStatus(
              nextStop.id === '__destination__' ? 'completed' : 'arrived',
              { currentStopIndex: currentStopIndex + 1, currentStopId: nextStop.id },
            ),
          }
        : selectedTrip.tripStatus === 'arrived'
          ? {
              label: `Resume${nextStop ? ` from ${stopSequence[currentStopIndex]?.name || 'stop'}` : ''}`,
              icon: Navigation,
              className: 'bg-emerald-600 hover:bg-emerald-700',
              onClick: () => onUpdateTripStatus('in_transit'),
            }
          : null;
  const StatusIcon = statusAction?.icon;

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-4">
      <section className="rounded-3xl bg-brand-900 p-5 text-white shadow-lg">
        <div className="text-center">
          <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase ${isLive ? 'bg-coral-600 text-white' : 'bg-white/15 text-brand-100'}`}>
            {status}
          </span>
          <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-200">Current trip</p>
          <h2 className="mt-2 text-2xl font-black">
            {route?.origin || selectedTrip.departureLocation}
            <span className="mx-2 text-coral-400">→</span>
            {route?.destination || selectedTrip.arrivalLocation}
          </h2>
          <p className="mt-2 text-sm text-brand-100">Bus {bus?.licensePlate || 'Unavailable'}</p>
        </div>

        <div className="mt-5 flex items-center justify-center gap-5 border-t border-white/15 pt-4 text-sm">
          <span className="flex items-center gap-2 text-brand-100"><Clock3 className="h-4 w-4" /> {formatTime12(selectedTrip.departureDateTime)}</span>
          <span className="flex items-center gap-2 text-brand-100"><MapPin className="h-4 w-4" /> Location unavailable</span>
        </div>
        {statusAction && StatusIcon && (
          <Button
            onClick={() => {
              if (selectedTrip.tripStatus === 'boarding' && !window.confirm('Confirm departure from origin?')) return;
              if (selectedTrip.tripStatus === 'in_transit' && nextStop && !window.confirm(
                nextStop.id === '__destination__' ? 'Confirm arrival at final destination? This will complete the trip.' : `Confirm arrival at ${nextStop.name}?`,
              )) return;
              statusAction.onClick();
            }}
            disabled={statusLoading || (selectedTrip.tripStatus === 'in_transit' && !nextStop)}
            className={`mx-auto mt-4 h-10 w-full px-5 text-xs font-black text-white ${statusAction.className}`}
          >
            {statusLoading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <StatusIcon className="mr-1.5 h-4 w-4" />}
            {statusAction.label}
          </Button>
        )}
      </section>

      <section className="rounded-3xl bg-white p-4 shadow-sm border">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 className="font-black text-brand-900">Route progress</h3>
          <span className="rounded-full bg-brand-50 px-2.5 py-1 text-right text-[10px] font-bold uppercase tracking-wide text-brand-700">
            {selectedTrip.currentStopId || 'Not departed'}
          </span>
        </div>
        <div className="flex justify-center overflow-x-auto">
          <RouteStopsDisplay stops={stops} />
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2">
        {[
          ['Available', selectedTrip.availableSeats ?? 0],
          ['Booked', booked],
          ['Paid', paid],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-white p-3 text-center shadow-sm border">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
            <p className="mt-1 text-xl font-black text-brand-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          onClick={onWalkOn}
          disabled={!bus}
          title={bus ? 'Create a walk-in booking' : 'Walk-in unavailable until the trip bus is loaded'}
          className="h-12 rounded-2xl bg-coral-600 text-sm font-black text-white shadow-md shadow-coral-900/10 transition-all hover:bg-coral-700 hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <UserPlus className="mr-2 h-4 w-4" /> {bus ? 'Walk-in' : 'Walk-in unavailable'}
        </Button>
        <Button
          onClick={onScan}
          className="h-12 rounded-2xl bg-coral-600 text-sm font-black text-white shadow-md shadow-coral-900/10 transition-all hover:bg-coral-700 hover:shadow-lg active:scale-[0.98]"
        >
          <QrCode className="mr-2 h-4 w-4" /> Scan QR
        </Button>
      </div>

      <section className="rounded-3xl bg-white p-4 shadow-sm border [perspective:1000px]">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{showBack ? 'Next stop passengers' : 'Latest bookings'}</p>
            <h3 className="font-black text-brand-900">{showBack ? 'Prepare to board' : `${booked} passengers`}</h3>
          </div>
          <button onClick={() => setShowBack((value) => !value)} className="rounded-full p-2 text-brand-700 hover:bg-brand-50" aria-label="Flip trip card"><ArrowRight className="h-4 w-4" /></button>
        </div>
        <div className="mb-3 relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or seat" className="w-full rounded-xl border bg-gray-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand-600" />
        </div>
        <div className="space-y-2">
          {filteredBookings.length === 0 ? <p className="py-4 text-center text-sm text-gray-400">No matching passengers.</p> : filteredBookings.map((booking) => (
            <div key={booking.id} className="flex items-center justify-between rounded-xl bg-brand-50/60 px-3 py-2">
              <span className="flex items-center gap-2 text-sm font-bold text-gray-800"><Users className="h-4 w-4 text-brand-700" />{booking.passengerDetails?.[0]?.name || 'Passenger'}</span>
              <span className="text-xs font-black text-brand-700">Seat {booking.seatNumbers?.join(', ')}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
