'use client';

import React, { FC } from 'react';
import { Schedule, TripStop } from '@/types';
import {
  Navigation, Users, ArrowRightCircle, Flag, Bus as BusIcon,
  MapPin, PlayCircle, Loader2, CheckCircle, AlertTriangle, Clock,
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
  onOpenBoarding: () => Promise<void>;
  onMarkDelayed: (reason: string) => Promise<void>;
  loading: boolean;
}

const toDate = (v: unknown): Date => {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  if (v && typeof v === 'object' && 'toDate' in v && typeof (v as any).toDate === 'function') return (v as any).toDate();
  return new Date(v as string | number);
};

const vibrate = () => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(50);
  }
};

const DELAY_PRESETS = ['Traffic jam', 'Mechanical issue', 'Weather delay', 'Waiting for passengers', 'Road closure'];

const TripControlPanel: FC<TripControlPanelProps> = ({
  trip, stopSequence, onStartTrip, onDepart, onArriveAtNext, onOpenBoarding, onMarkDelayed, loading,
}) => {
  const tripStatus = (trip.tripStatus as string) || 'scheduled';
  const currentIdx = trip.currentStopIndex ?? 0;
  const currentStop = stopSequence[currentIdx];
  const nextStop = stopSequence[currentIdx + 1] ?? null;
  const isLastStop = currentIdx >= stopSequence.length - 1;
  const isFinalApproach = nextStop && currentIdx === stopSequence.length - 2;

  const [delayReason, setDelayReason] = React.useState('');
  const [showDelayInput, setShowDelayInput] = React.useState(false);

  const handleAction = (fn: () => Promise<void>) => {
    vibrate();
    fn();
  };

  if (tripStatus === 'scheduled') {
    return (
      <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50 border border-blue-200 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
            <Navigation className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-blue-900 text-base">Trip not started</p>
            <p className="text-sm text-blue-700 truncate">{trip.departureLocation} → {trip.arrivalLocation}</p>
          </div>
          <button 
            onClick={() => setShowDelayInput(!showDelayInput)} 
            className="flex items-center gap-1.5 px-3 py-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-xl transition-all text-sm font-semibold touch-highlight"
          >
            <AlertTriangle className="w-4 h-4" /> Delay
          </button>
        </div>

        {showDelayInput && (
          <div className="mb-4 space-y-3 bg-orange-50 rounded-xl p-3 border border-orange-100">
            <p className="text-xs font-bold text-orange-700 uppercase tracking-wide">Select a reason:</p>
            <div className="flex flex-wrap gap-2">
              {DELAY_PRESETS.map(preset => (
                <button 
                  key={preset}
                  onClick={() => setDelayReason(preset)}
                  className={`px-3 py-2 rounded-xl text-sm font-medium transition-all touch-highlight ${
                    delayReason === preset 
                      ? 'bg-orange-600 text-white shadow-md' 
                      : 'bg-white text-orange-700 border border-orange-200 hover:bg-orange-100'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <input 
              className="w-full px-3 py-2.5 text-sm border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none bg-white"
              placeholder="Or type custom reason..."
              value={DELAY_PRESETS.includes(delayReason) ? '' : delayReason}
              onChange={(e) => setDelayReason(e.target.value)}
            />
            <Button 
              className="w-full bg-orange-600 hover:bg-orange-700 conductor-action-btn text-white font-bold rounded-xl" 
              onClick={() => handleAction(() => onMarkDelayed(delayReason))} 
              disabled={loading || !delayReason.trim()}
            >
              Mark as Delayed
            </Button>
          </div>
        )}

        <div className="mb-4">
          <StopProgressBar stopSequence={stopSequence} currentIdx={0} departedStops={[]} />
        </div>

        <Button 
          className="w-full bg-blue-600 hover:bg-blue-700 text-white conductor-action-btn text-base font-bold rounded-xl shadow-lg shadow-blue-200"
          onClick={() => handleAction(onStartTrip)} disabled={loading}
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <PlayCircle className="w-5 h-5 mr-2" />}
          Start Trip from {stopSequence[0]?.name}
        </Button>
      </div>
    );
  }

  if (tripStatus === 'delayed') {
    return (
      <div className="bg-gradient-to-br from-orange-50 via-amber-50 to-orange-50 border border-orange-200 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-orange-600 flex items-center justify-center shadow-lg shadow-orange-200">
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-orange-900 text-base">Trip Delayed</p>
            <p className="text-sm text-orange-700 line-clamp-1">{trip.tripNotes || "Waiting for clearance..."}</p>
          </div>
          <Clock className="w-6 h-6 text-orange-400 animate-pulse" />
        </div>
        <Button 
          className="w-full bg-orange-600 hover:bg-orange-700 text-white conductor-action-btn text-base font-bold rounded-xl shadow-lg shadow-orange-200"
          onClick={() => handleAction(onStartTrip)} disabled={loading}
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <PlayCircle className="w-5 h-5 mr-2" />}
          Resume / Start Trip
        </Button>
      </div>
    );
  }

  if (tripStatus === 'completed') {
    return (
      <div className="bg-gradient-to-br from-green-50 via-emerald-50 to-green-50 border border-green-200 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-green-600 flex items-center justify-center shadow-lg shadow-green-200">
            <Flag className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-green-900 text-base">Trip completed</p>
            <p className="text-sm text-green-700">
              Arrived at {trip.arrivalLocation}
              {trip.tripCompletedAt && ` · ${format(toDate(trip.tripCompletedAt), 'HH:mm')}`}
            </p>
          </div>
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
      </div>
    );
  }

  if (tripStatus === 'boarding') {
    return (
      <div className="bg-gradient-to-br from-green-50 via-teal-50 to-green-50 border border-green-200 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-green-600 flex items-center justify-center animate-pulse shadow-lg shadow-green-200">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
              <p className="font-bold text-green-900 text-base">Boarding open</p>
            </div>
            <p className="text-sm text-green-700 font-medium">At: <strong>{currentStop?.name}</strong></p>
          </div>
        </div>

        <StopProgressBar stopSequence={stopSequence} currentIdx={currentIdx} departedStops={trip.departedStops ?? []} />

        {nextStop && (
          <p className="text-xs text-gray-500 mt-3 mb-4 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            Next stop: <strong>{nextStop.name}</strong>
            {isFinalApproach && <span className="text-orange-600 font-bold ml-1">(final destination)</span>}
          </p>
        )}

        <Button
          className={`w-full conductor-action-btn text-base font-bold text-white rounded-xl shadow-lg ${
            isFinalApproach 
              ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-200' 
              : 'bg-teal-600 hover:bg-teal-700 shadow-teal-200'
          }`}
          onClick={() => handleAction(onDepart)} disabled={loading}
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <ArrowRightCircle className="w-5 h-5 mr-2" />}
          Depart {currentStop?.name}{isFinalApproach && ' → Final stop'}
        </Button>
      </div>
    );
  }

  if (tripStatus === 'arrived') {
    return (
      <div className="bg-gradient-to-br from-indigo-50 via-blue-50 to-indigo-50 border border-indigo-200 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
            <MapPin className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-indigo-900 text-base">Arrived at Stop</p>
            <p className="text-sm text-indigo-700 font-medium">Station: <strong>{currentStop?.name}</strong></p>
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-4 bg-indigo-50 rounded-xl p-3 border border-indigo-100">
          Passengers are disembarking/boarding. Open boarding when ready to check new tickets.
        </p>

        <Button
          className="w-full conductor-action-btn text-base font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-200"
          onClick={() => handleAction(onOpenBoarding)} disabled={loading}
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Users className="w-5 h-5 mr-2" />}
          Open Boarding for {currentStop?.name}
        </Button>
      </div>
    );
  }

  if (tripStatus === 'in_transit') {
    return (
      <div className="bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-50 border border-blue-200 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
            <BusIcon className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-blue-900 text-base flex items-center gap-2">
              🚌 In Transit
            </p>
            <p className="text-sm text-blue-700">Heading to: <strong>{nextStop?.name ?? trip.arrivalLocation}</strong></p>
          </div>
        </div>

        <StopProgressBar stopSequence={stopSequence} currentIdx={currentIdx} departedStops={trip.departedStops ?? []} inTransit />

        <Button
          className={`w-full mt-4 conductor-action-btn text-base font-bold text-white rounded-xl shadow-lg ${
            isLastStop || !nextStop 
              ? 'bg-green-700 hover:bg-green-800 shadow-green-200' 
              : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
          }`}
          onClick={() => handleAction(onArriveAtNext)} disabled={loading || !nextStop}
        >
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
