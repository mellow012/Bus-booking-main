import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Bus, Schedule, Route } from '@/types';

interface SeatSelectionProps {
  bus: Bus;
  schedule: Schedule;
  passengers: number;
  onSeatSelection: (seats: string[]) => void;
  selectedSeats?: string[];
  disabled?: boolean;
  className?: string;
  originStopId: string;
  destinationStopId: string;
  route: Route;
}

interface SeatLayoutConfig {
  seatsPerRow: number;
  aislePosition: number;
  seatLabels: string[];
}

const SEAT_LAYOUT_CONFIGS: Record<string, SeatLayoutConfig> = {
  standard: { seatsPerRow: 4, aislePosition: 2, seatLabels: ['A', 'B', 'C', 'D'] },
  luxury:   { seatsPerRow: 3, aislePosition: 1, seatLabels: ['A', 'B', 'C'] },
  express:  { seatsPerRow: 4, aislePosition: 2, seatLabels: ['A', 'B', 'C', 'D'] },
};

const SeatSelection: React.FC<SeatSelectionProps> = ({
  bus,
  schedule,
  passengers,
  onSeatSelection,
  selectedSeats = [],
  disabled = false,
  className = '',
  originStopId,
  destinationStopId,
  route,
}) => {
  const [internalSelectedSeats, setInternalSelectedSeats] = useState<string[]>(selectedSeats);
  const [error, setError] = useState('');
  const [hoveredSeat, setHoveredSeat] = useState<string | null>(null);

  // ── Layout config ──────────────────────────────────────────────────────────
  const layoutConfig = useMemo(() => {
    const busType = bus.busType?.toLowerCase() || 'standard';
    return SEAT_LAYOUT_CONFIGS[busType] || SEAT_LAYOUT_CONFIGS.standard;
  }, [bus.busType]);

  // ── Seat grid ──────────────────────────────────────────────────────────────
  const seatLayout = useMemo(() => {
    const totalSeats = bus.capacity || 40;
    const { seatsPerRow, seatLabels } = layoutConfig;
    const rows = Math.ceil(totalSeats / seatsPerRow);
    const seats: (string | null)[][] = [];
    let counter = 1;

    for (let row = 1; row <= rows; row++) {
      const rowSeats: (string | null)[] = [];
      for (let col = 0; col < seatsPerRow && counter <= totalSeats; col++) {
        rowSeats.push(`${row}${seatLabels[col]}`);
        counter++;
      }
      while (rowSeats.length < seatsPerRow) rowSeats.push(null);
      seats.push(rowSeats);
    }
    return seats;
  }, [bus.capacity, layoutConfig]);

  // ── Booked seats ───────────────────────────────────────────────────────────
  const bookedSeats = useMemo(
    () => new Set(schedule.bookedSeats || []),
    [schedule.bookedSeats]
  );

  // FIX 1: Simple booked check — no segment range gate that was blocking all seats
  const isSeatBooked = useCallback(
    (seat: string | null) => {
      if (!seat) return true;
      return bookedSeats.has(seat);
    },
    [bookedSeats]
  );

  // ── Sync external prop ─────────────────────────────────────────────────────
  useEffect(() => {
    setInternalSelectedSeats(selectedSeats);
  }, [selectedSeats]);

  // ── Auto-clear errors ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(''), 4000);
    return () => clearTimeout(t);
  }, [error]);

  // ── Seat click ─────────────────────────────────────────────────────────────
  const handleSeatClick = useCallback(
    (seat: string) => {
      if (disabled || isSeatBooked(seat)) return;

      setInternalSelectedSeats((prev) => {
        if (prev.includes(seat)) {
          setError('');
          return prev.filter((s) => s !== seat);
        }

        if (prev.length >= passengers) {
          if (passengers === 1) {
            setError('');
            return [seat];
          }
          setError(
            `You can only select ${passengers} seat${passengers > 1 ? 's' : ''}. Deselect a seat first.`
          );
          return prev;
        }

        setError('');
        return [...prev, seat];
      });
    },
    [disabled, isSeatBooked, passengers]
  );

  // FIX 2: Removed the useEffect that was calling onSeatSelection reactively.
  // Selection is now submitted only when the user explicitly clicks "Continue".
  const handleContinue = () => {
    onSeatSelection(internalSelectedSeats);
  };

  // ── Seat styling ───────────────────────────────────────────────────────────
  const getSeatStatus = useCallback(
    (seat: string | null) => {
      if (!seat) return 'empty';
      if (isSeatBooked(seat)) return 'booked';
      if (internalSelectedSeats.includes(seat)) return 'selected';
      if (hoveredSeat === seat) return 'hovered';
      return 'available';
    },
    [isSeatBooked, internalSelectedSeats, hoveredSeat]
  );

  const getSeatClassName = useCallback((status: string) => {
    const base =
      'w-10 h-10 rounded-xl text-xs font-semibold transition-all duration-200 border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2';
    switch (status) {
      case 'booked':
        return `${base} bg-gray-200 text-gray-500 border-gray-300 cursor-not-allowed opacity-75`;
      case 'selected':
        return `${base} bg-gradient-to-br from-blue-500 to-blue-600 text-white border-blue-600 shadow-lg transform scale-105`;
      case 'hovered':
        return `${base} bg-blue-100 text-blue-700 border-blue-300 cursor-pointer transform scale-105 shadow-md`;
      case 'available':
        return `${base} bg-white text-blue-600 border-blue-200 cursor-pointer hover:bg-blue-50 hover:border-blue-300 hover:shadow-md`;
      default:
        return 'invisible';
    }
  }, []);

  const getSeatAriaLabel = useCallback((seat: string | null, status: string) => {
    if (!seat) return undefined;
    const statusText =
      { booked: 'unavailable', selected: 'selected', available: 'available for selection' }[
        status
      ] || 'unknown';
    return `Seat ${seat}, ${statusText}`;
  }, []);

  const selectionProgress = Math.min((internalSelectedSeats.length / passengers) * 100, 100);
  const remaining = passengers - internalSelectedSeats.length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <section
      className={`bg-white rounded-2xl shadow-lg border border-gray-100 p-6 ${className}`}
      aria-label="Seat Selection"
    >
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Select Your Seat{passengers > 1 ? 's' : ''}
        </h2>
        <div className="flex items-center justify-between">
          <p className="text-gray-600">
            Choose {passengers} seat{passengers > 1 ? 's' : ''} for your journey
          </p>
          <div className="text-sm text-gray-500">
            {bus.busType || 'Standard'} Bus · {bus.capacity || 40} seats
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Selection Progress</span>
          <span className="text-sm text-gray-500">
            {internalSelectedSeats.length} of {passengers} selected
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="h-2 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
            style={{ width: `${selectionProgress}%` }}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg" role="alert">
          <p className="text-red-700 text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Selected seats summary */}
      {internalSelectedSeats.length > 0 && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-900 mb-1">Selected Seats</p>
              <p className="text-blue-800 font-semibold">
                {[...internalSelectedSeats].sort().join(', ')}
              </p>
            </div>
            {internalSelectedSeats.length === passengers && (
              <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Front-of-bus marker */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center px-4 py-2 bg-gray-100 rounded-full border">
          <div className="w-4 h-4 mr-2 bg-gray-400 rounded-full" />
          <span className="text-sm font-medium text-gray-700">Front of Bus</span>
        </div>
      </div>

      {/* Seat Grid */}
      <div className="max-w-lg mx-auto mb-6">
        <div className="space-y-3">
          {seatLayout.map((row, rowIndex) => {
            const { aislePosition } = layoutConfig;
            return (
              <div key={rowIndex} className="flex items-center justify-center gap-2">
                {/* Row number */}
                <div className="w-8 text-xs text-gray-400 text-center font-medium">
                  {rowIndex + 1}
                </div>

                {/* Left seats */}
                <div className="flex gap-1">
                  {row.slice(0, aislePosition).map((seat, colIndex) => {
                    if (!seat)
                      return (
                        <div key={`spacer-left-${rowIndex}-${colIndex}`} className="w-10 h-10" />
                      );
                    const status = getSeatStatus(seat);
                    return (
                      <button
                        key={seat}
                        className={getSeatClassName(status)}
                        onClick={() => handleSeatClick(seat)}
                        onMouseEnter={() => setHoveredSeat(seat)}
                        onMouseLeave={() => setHoveredSeat(null)}
                        disabled={status === 'booked' || disabled}
                        aria-label={getSeatAriaLabel(seat, status)}
                        aria-pressed={status === 'selected'}
                      >
                        {seat}
                      </button>
                    );
                  })}
                </div>

                {/* Aisle */}
                <div className="w-8 flex justify-center" aria-hidden="true">
                  <div className="w-px h-6 bg-gradient-to-b from-gray-200 via-gray-300 to-gray-200" />
                </div>

                {/* Right seats */}
                <div className="flex gap-1">
                  {row.slice(aislePosition).map((seat, colIndex) => {
                    if (!seat)
                      return (
                        <div key={`spacer-right-${rowIndex}-${colIndex}`} className="w-10 h-10" />
                      );
                    const status = getSeatStatus(seat);
                    return (
                      <button
                        key={seat}
                        className={getSeatClassName(status)}
                        onClick={() => handleSeatClick(seat)}
                        onMouseEnter={() => setHoveredSeat(seat)}
                        onMouseLeave={() => setHoveredSeat(null)}
                        disabled={status === 'booked' || disabled}
                        aria-label={getSeatAriaLabel(seat, status)}
                        aria-pressed={status === 'selected'}
                      >
                        {seat}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center space-x-6 mb-6">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-white border-2 border-blue-200 rounded-md" />
          <span className="text-sm text-gray-600">Available</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-md" />
          <span className="text-sm text-gray-600">Selected</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-gray-200 border-2 border-gray-300 rounded-md" />
          <span className="text-sm text-gray-600">Booked</span>
        </div>
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between text-sm text-gray-500 pb-4 border-b mb-6">
        <span>{seatLayout.flat().filter(Boolean).length - bookedSeats.size} seats available</span>
        <span>{bookedSeats.size} seats booked</span>
      </div>

      {/* FIX 2: Explicit Continue button — onSeatSelection only fires here, not reactively */}
      <button
        onClick={handleContinue}
        disabled={internalSelectedSeats.length !== passengers || disabled}
        className="w-full py-3 px-6 bg-blue-600 text-white font-semibold rounded-xl
                   disabled:opacity-50 disabled:cursor-not-allowed
                   hover:bg-blue-700 active:bg-blue-800
                   transition-colors duration-200 text-sm"
      >
        {internalSelectedSeats.length === passengers
          ? `Continue with seat${passengers > 1 ? 's' : ''} ${[...internalSelectedSeats].sort().join(', ')}`
          : `Select ${remaining} more seat${remaining !== 1 ? 's' : ''} to continue`}
      </button>
    </section>
  );
};

export default SeatSelection; 