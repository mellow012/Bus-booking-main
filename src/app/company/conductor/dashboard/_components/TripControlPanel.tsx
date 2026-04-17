'use client';

import React, { FC } from 'react';
import { Schedule, TripStop } from '@/types';
import {
  Navigation, Users, ArrowRightCircle, Flag, Bus as BusIcon,
  MapPin, PlayCircle, Loader2, CheckCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import StopProgressBar from './StopProgressBar';

interface TripControlPanelProps {
  trip: Schedule;
  stopSequence: TripStop[];
  onStartTrip: () => Promise<void>;
  onDepart: () => Promise<void>;
  onArriveAtNext: () => Promise<void>;
  loading: boolean;
}

const toDate = (v: unknown): Date => {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  if (v && typeof v === 'object' && 'toDate' in v && typeof (v as any).toDate === 'function') return (v as any).toDate();
  return new Date(v as string | number);
};

const TripControlPanel: FC<TripControlPanelProps> = ({
  trip, stopSequence, onStartTrip, onDepart, onArriveAtNext, loading,
}) => {
  const tripStatus = trip.tripStatus ?? 'scheduled';
  const currentIdx = trip.currentStopIndex ?? 0;
  const currentStop = stopSequence[currentIdx];
  const nextStop = stopSequence[currentIdx + 1] ?? null;
  const isLastStop = currentIdx >= stopSequence.length - 1;
  const isFinalApproach = nextStop && currentIdx === stopSequence.length - 2;

  if (tripStatus === 'scheduled') {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
            <Navigation className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-blue-900 text-base">Trip not started</p>
            <p className="text-sm text-blue-700">{trip.departureLocation} → {trip.arrivalLocation}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1">
          {stopSequence.map((stop, i) => (
            <div key={stop.id} className="flex items-center gap-1.5 shrink-0">
              <div className="flex flex-col items-center gap-0.5">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-300 border-2 border-gray-400" />
                <p className="text-[10px] text-gray-500 max-w-[60px] text-center leading-tight">{stop.name}</p>
              </div>
              {i < stopSequence.length - 1 && <div className="w-6 h-0.5 bg-gray-300 mb-3" />}
            </div>
          ))}
        </div>
        <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 text-base font-semibold"
          onClick={onStartTrip} disabled={loading}>
          {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <PlayCircle className="w-5 h-5 mr-2" />}
          Start Trip from {stopSequence[0]?.name}
        </Button>
      </div>
    );
  }

  if (tripStatus === 'completed') {
    return (
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center">
            <Flag className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-green-900 text-base">Trip completed</p>
            <p className="text-sm text-green-700">
              Arrived at {trip.arrivalLocation}
              {trip.tripCompletedAt && ` · ${format(toDate(trip.tripCompletedAt), 'HH:mm')}`}
            </p>
          </div>
          <CheckCircle className="w-7 h-7 text-green-600 ml-auto" />
        </div>
      </div>
    );
  }

  if (tripStatus === 'boarding') {
    return (
      <div className="bg-gradient-to-r from-green-50 to-teal-50 border border-green-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center animate-pulse">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <p className="font-semibold text-green-900 text-base">Boarding open</p>
            </div>
            <p className="text-sm text-green-700 font-medium">At: <strong>{currentStop?.name}</strong></p>
          </div>
        </div>
        <StopProgressBar stopSequence={stopSequence} currentIdx={currentIdx} departedStops={trip.departedStops ?? []} />
        {nextStop && (
          <p className="text-xs text-gray-500 mt-3 mb-4">
            Next stop: <strong>{nextStop.name}</strong>
            {isFinalApproach && ' (final destination)'}
          </p>
        )}
        <Button
          className={`w-full h-11 text-base font-semibold text-white ${isFinalApproach ? 'bg-orange-600 hover:bg-orange-700' : 'bg-teal-600 hover:bg-teal-700'}`}
          onClick={onDepart} disabled={loading}>
          {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <ArrowRightCircle className="w-5 h-5 mr-2" />}
          Depart {currentStop?.name}{isFinalApproach && ' → Final stop'}
        </Button>
      </div>
    );
  }

  if (tripStatus === 'in_transit') {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
            <BusIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-blue-900 text-base">🚌 In Transit</p>
            <p className="text-sm text-blue-700">Heading to: <strong>{nextStop?.name ?? trip.arrivalLocation}</strong></p>
          </div>
        </div>
        <StopProgressBar stopSequence={stopSequence} currentIdx={currentIdx} departedStops={trip.departedStops ?? []} inTransit />
        <Button
          className={`w-full mt-4 h-11 text-base font-semibold text-white ${
            isLastStop || !nextStop ? 'bg-green-700 hover:bg-green-800' : 'bg-blue-600 hover:bg-blue-700'
          }`}
          onClick={onArriveAtNext} disabled={loading || !nextStop}>
          {loading
            ? <Loader2 className="w-5 h-5 animate-spin mr-2" />
            : isLastStop || (nextStop && currentIdx === stopSequence.length - 2)
              ? <Flag className="w-5 h-5 mr-2" />
              : <MapPin className="w-5 h-5 mr-2" />}
          {nextStop
            ? currentIdx === stopSequence.length - 2
              ? `Arrived at ${nextStop.name} — Complete Trip`
              : `Arrived at ${nextStop.name}`
            : 'No more stops'}
        </Button>
      </div>
    );
  }

  return null;
};

export default TripControlPanel;
