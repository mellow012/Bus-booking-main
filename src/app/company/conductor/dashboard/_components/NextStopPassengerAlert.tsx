'use client';

import React, { FC, useState, useEffect } from 'react';
import { Booking, TripStop } from '@/types';
import { MapPin, Users, UserPlus, Navigation, X, ChevronDown, ChevronUp } from 'lucide-react';

interface NextStopPassengerAlertProps {
  /** Bookings for the current trip */
  tripBookings: Booking[];
  /** Full stop sequence for this trip */
  stopSequence: TripStop[];
  /** The stop the bus is currently AT (boarding mode) */
  currentStop: TripStop | null;
  /** Is the trip in "boarding" status? Alert only makes sense then */
  isBoardingStatus: boolean;
}

/**
 * Shows a dismissible alert when the bus arrives at a stop (boarding mode):
 *  - Passengers GETTING OFF here (destinationStopId matches current stop)
 *  - Passengers who BOARDED here (walk-ons with originStopId matching current stop)
 *
 * Also shows a real-time GPS position tracker if the browser supports geolocation.
 */
const NextStopPassengerAlert: FC<NextStopPassengerAlertProps> = ({
  tripBookings, stopSequence, currentStop, isBoardingStatus,
}) => {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState(false);

  // Reset dismissed state every time we move to a new stop
  useEffect(() => {
    setDismissed(false);
    setExpanded(true);
  }, [currentStop?.id]);

  // GPS tracking
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

  // Passengers whose destination IS this stop — they're getting off
  const gettingOff = tripBookings.filter(b => {
    const destId = (b as any).destinationStopId;
    return b.bookingStatus !== 'cancelled' && destId === currentStop.id;
  });

  // Walk-on passengers who boarded AT this stop
  const boardedHere = tripBookings.filter(b => {
    const originId = (b as any).originStopId;
    const isWalkOn = (b as any).isWalkOn || (b as any).bookedBy === 'conductor';
    return b.bookingStatus !== 'cancelled' && isWalkOn && originId === currentStop.id;
  });

  const hasActivity = gettingOff.length > 0 || boardedHere.length > 0;

  return (
    <div className="rounded-xl border-2 border-indigo-300 bg-gradient-to-br from-indigo-50 to-blue-50 shadow-md overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-indigo-600">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-white" />
          <span className="text-white font-bold text-sm">Arrived at {currentStop.name}</span>
          {currentStop.order >= 0 && (
            <span className="text-indigo-200 text-xs">
              (Stop {stopSequence.findIndex(s => s.id === currentStop.id) + 1} of {stopSequence.length})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* GPS indicator */}
          {gpsCoords && !gpsError && (
            <a
              href={`https://maps.google.com/?q=${gpsCoords.lat},${gpsCoords.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-indigo-100 hover:text-white transition-colors"
              title="Open in Google Maps"
            >
              <Navigation className="w-3.5 h-3.5 animate-pulse" />
              <span className="hidden sm:inline">GPS Active</span>
            </a>
          )}
          <button onClick={() => setExpanded(e => !e)} className="text-indigo-200 hover:text-white transition-colors">
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
          <button onClick={() => setDismissed(true)} className="text-indigo-200 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 py-3 space-y-3">
          {!hasActivity && (
            <p className="text-sm text-indigo-700 text-center py-2">No passengers assigned to alight or board at this stop.</p>
          )}

          {/* Passengers getting off */}
          {gettingOff.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center">
                  <Users className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-sm font-bold text-orange-800">
                  {gettingOff.length} passenger{gettingOff.length !== 1 ? 's' : ''} getting off here
                </span>
              </div>
              <div className="space-y-1 pl-8">
                {gettingOff.map(b => {
                  const pax = b.passengerDetails?.[0];
                  return (
                    <div key={b.id} className="flex items-center gap-2 text-sm text-orange-900 bg-orange-50 rounded-lg px-3 py-1.5 border border-orange-200">
                      <span className="w-7 h-7 rounded-lg bg-orange-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {b.seatNumbers?.[0] || '?'}
                      </span>
                      <span className="font-medium">{pax?.name || 'Passenger'}</span>
                      <span className="text-orange-600 text-xs ml-auto">{b.contactPhone || ''}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Walk-ons who boarded here */}
          {boardedHere.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                  <UserPlus className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-sm font-bold text-green-800">
                  {boardedHere.length} walk-on{boardedHere.length !== 1 ? 's' : ''} boarded here
                </span>
              </div>
              <div className="space-y-1 pl-8">
                {boardedHere.map(b => {
                  const pax = b.passengerDetails?.[0];
                  const destName = (b as any).destinationStopName;
                  return (
                    <div key={b.id} className="flex items-center gap-2 text-sm text-green-900 bg-green-50 rounded-lg px-3 py-1.5 border border-green-200">
                      <span className="w-7 h-7 rounded-lg bg-green-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {b.seatNumbers?.[0] || '?'}
                      </span>
                      <span className="font-medium">{pax?.name || 'Passenger'}</span>
                      {destName && (
                        <span className="text-green-600 text-xs ml-auto flex items-center gap-0.5">
                          <MapPin className="w-3 h-3" /> {destName}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* GPS coordinates small badge */}
          {gpsCoords && (
            <div className="flex items-center gap-1.5 text-xs text-indigo-500 pt-1 border-t border-indigo-100">
              <Navigation className="w-3 h-3" />
              <span>{gpsCoords.lat.toFixed(5)}, {gpsCoords.lng.toFixed(5)}</span>
              <span className="text-indigo-300">— tap GPS Active to open in Maps</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NextStopPassengerAlert;
