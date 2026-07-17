'use client';

import React, { FC, useState, useEffect } from 'react';
import { Booking, TripStop } from '@/types';
import { MapPin, Users, UserPlus, Navigation, X, ChevronDown, ChevronUp } from 'lucide-react';

interface NextStopPassengerAlertProps {
  tripBookings: Booking[];
  stopSequence: TripStop[];
  currentStop: TripStop | null;
  isBoardingStatus: boolean;
}

const NextStopPassengerAlert: FC<NextStopPassengerAlertProps> = ({
  tripBookings, stopSequence, currentStop, isBoardingStatus,
}) => {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState(false);

  useEffect(() => {
    setDismissed(false);
    setExpanded(true);
  }, [currentStop?.id]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGpsError(true),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 10_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  if (!isBoardingStatus || !currentStop || dismissed) return null;

  const gettingOff = tripBookings.filter(b => {
    const destId = (b as any).destinationStopId;
    return b.bookingStatus !== 'cancelled' && destId === currentStop.id;
  });

  const boardedHere = tripBookings.filter(b => {
    const originId = (b as any).originStopId;
    const isWalkOn = (b as any).isWalkOn || (b as any).bookedBy === 'conductor';
    return b.bookingStatus !== 'cancelled' && isWalkOn && originId === currentStop.id;
  });

  const hasActivity = gettingOff.length > 0 || boardedHere.length > 0;
  const stopIndex = stopSequence.findIndex(s => s.id === currentStop.id);

  return (
    <div className="rounded-2xl border-2 border-indigo-300 bg-gradient-to-br from-indigo-50 to-blue-50 shadow-md overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-indigo-600">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <span className="text-white font-bold text-sm block truncate">{currentStop.name}</span>
            {stopIndex >= 0 && (
              <span className="text-indigo-200 text-[11px]">
                Stop {stopIndex + 1} of {stopSequence.length}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {gpsCoords && !gpsError && (
            <a
              href={`https://maps.google.com/?q=${gpsCoords.lat},${gpsCoords.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-indigo-100 hover:text-white px-2 py-1.5 rounded-lg bg-indigo-500/50"
            >
              <Navigation className="w-3.5 h-3.5 animate-pulse" />
              <span className="hidden sm:inline">GPS</span>
            </a>
          )}
          <button onClick={() => setExpanded(e => !e)} className="w-8 h-8 flex items-center justify-center rounded-lg text-indigo-200 hover:text-white hover:bg-indigo-500/50 transition-colors">
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
          <button onClick={() => setDismissed(true)} className="w-8 h-8 flex items-center justify-center rounded-lg text-indigo-200 hover:text-white hover:bg-indigo-500/50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 py-3 space-y-3">
          {!hasActivity && (
            <p className="text-sm text-indigo-700 text-center py-2">No passengers assigned to alight or board at this stop.</p>
          )}

          {gettingOff.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center">
                  <Users className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-sm font-bold text-orange-800">
                  {gettingOff.length} getting off
                </span>
              </div>
              <div className="space-y-1.5 pl-9">
                {gettingOff.map(b => {
                  const pax = b.passengerDetails?.[0];
                  return (
                    <div key={b.id} className="flex items-center gap-2 text-sm text-orange-900 bg-orange-50 rounded-xl px-3 py-2 border border-orange-200">
                      <span className="w-8 h-8 rounded-lg bg-orange-500 text-white text-xs font-bold flex items-center justify-center shrink-0">
                        {b.seatNumbers?.[0] || '?'}
                      </span>
                      <span className="font-semibold truncate">{pax?.name || 'Passenger'}</span>
                      <span className="text-orange-600 text-xs ml-auto shrink-0">{b.contactPhone || ''}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {boardedHere.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-green-500 flex items-center justify-center">
                  <UserPlus className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-sm font-bold text-green-800">
                  {boardedHere.length} walk-on{boardedHere.length !== 1 ? 's' : ''} boarded
                </span>
              </div>
              <div className="space-y-1.5 pl-9">
                {boardedHere.map(b => {
                  const pax = b.passengerDetails?.[0];
                  const destName = (b as any).destinationStopName;
                  return (
                    <div key={b.id} className="flex items-center gap-2 text-sm text-green-900 bg-green-50 rounded-xl px-3 py-2 border border-green-200">
                      <span className="w-8 h-8 rounded-lg bg-green-500 text-white text-xs font-bold flex items-center justify-center shrink-0">
                        {b.seatNumbers?.[0] || '?'}
                      </span>
                      <span className="font-semibold truncate">{pax?.name || 'Passenger'}</span>
                      {destName && (
                        <span className="text-green-600 text-xs ml-auto shrink-0 flex items-center gap-0.5">
                          <MapPin className="w-3 h-3" /> {destName}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {gpsCoords && (
            <div className="flex items-center gap-1.5 text-xs text-indigo-500 pt-1 border-t border-indigo-100">
              <Navigation className="w-3 h-3" />
              <span>{gpsCoords.lat.toFixed(5)}, {gpsCoords.lng.toFixed(5)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NextStopPassengerAlert;
