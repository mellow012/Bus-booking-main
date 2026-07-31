import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Bus, Schedule, Route } from '@/types';
import AlertMessage from './AlertMessage';
import { generateSeatGrid } from '@/lib/seatLayout';

interface SeatSelectionProps {
  bus: Bus;
  schedule: Schedule;
  passengers: number;
  onSeatSelection: (seats: string[]) => void;
  onSelectionChange?: (seats: string[]) => void;
  selectedSeats?: string[];
  reservedSeats?: string[];
  disabled?: boolean;
  hideContinue?: boolean;
  className?: string;
  originStopId: string;
  destinationStopId: string;
  route: Route;
}

const SeatSelection: React.FC<SeatSelectionProps> = ({
  bus,
  schedule,
  passengers,
  onSeatSelection,
  onSelectionChange,
  selectedSeats = [],
  reservedSeats = [],
  disabled = false,
  hideContinue = false,
  className = '',
  originStopId,
  destinationStopId,
  route,
}) => {
  const [internalSelectedSeats, setInternalSelectedSeats] = useState<string[]>(selectedSeats);
  const [error, setError] = useState('');
  const [hoveredSeat, setHoveredSeat] = useState<string | null>(null);

  // ── Layout & grid resolution ─────────────────────────────────────────────
  const { grid: seatLayout, rowMeta, preset: layoutConfig } = useMemo(() => {
    const customConfig =
      (bus?.registrationDetails as any)?.seatLayout ||
      (bus as any)?.seatLayout ||
      (bus as any)?.metadata?.seatLayout;

    let seatLayoutKey: string = 'coach';
    let firstRowSeats: number | undefined = undefined;
    let lastRowSeats: number | undefined = undefined;
    let rowOverrides: any[] | undefined = undefined;

    if (customConfig && typeof customConfig === 'object') {
      if (customConfig.preset) seatLayoutKey = customConfig.preset;
      else if (customConfig.key) seatLayoutKey = customConfig.key;
      else if (customConfig.type) seatLayoutKey = customConfig.type;

      if (Array.isArray(customConfig.rowOverrides)) rowOverrides = customConfig.rowOverrides;
      if (customConfig.firstRowSeats != null) firstRowSeats = Number(customConfig.firstRowSeats);
      if (customConfig.lastRowSeats != null) lastRowSeats = Number(customConfig.lastRowSeats);
    } else {
      // Fallback matching if legacy dataset
      const typeStr = (bus?.busType || '').toLowerCase();
      if (typeStr.includes('minibus')) seatLayoutKey = 'minibus';
      else if (typeStr.includes('coaster')) seatLayoutKey = 'coaster';
      else if (typeStr.includes('luxury') || typeStr.includes('vip')) seatLayoutKey = 'luxury';
      else seatLayoutKey = 'coach';
    }

    return generateSeatGrid({
      capacity: bus?.capacity || 40,
      seatLayoutKey,
      firstRowSeats,
      lastRowSeats,
      rowOverrides,
    });
  }, [bus]);

  function normalizeSeatArray(value: unknown): string[] {
    if (Array.isArray(value)) return value.filter((seat): seat is string => typeof seat === 'string');
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed.filter((seat): seat is string => typeof seat === 'string');
      } catch {
        return [];
      }
    }
    return [];
  }

  // ── Booked seats ───────────────────────────────────────────────────────────
  const bookedSeats = useMemo(
    () => new Set(normalizeSeatArray(schedule?.bookedSeats)),
    [schedule?.bookedSeats]
  );

  const reservedSeatsSet = useMemo(
    () => new Set(normalizeSeatArray(reservedSeats)),
    [reservedSeats]
  );

  const isSeatUnavailable = useCallback(
    (seat: string | null) => {
      if (!seat) return true;
      return bookedSeats.has(seat) || reservedSeatsSet.has(seat);
    },
    [bookedSeats, reservedSeatsSet]
  );

  // ── Sync external prop ─────────────────────────────────────────────────────
  useEffect(() => {
    setInternalSelectedSeats(selectedSeats);
  }, [selectedSeats]);

  // ── Notify parent of live selection (fires as seats are toggled) ───────────
  useEffect(() => {
    onSelectionChange?.(internalSelectedSeats);
  }, [internalSelectedSeats, onSelectionChange]);

  // ── Auto-clear errors ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(''), 4000);
    return () => clearTimeout(t);
  }, [error]);

  // ── Seat click ─────────────────────────────────────────────────────────────
  const handleSeatClick = useCallback(
    (seat: string) => {
      if (disabled || isSeatUnavailable(seat)) return;

      setInternalSelectedSeats((prev: string[]) => {
        if (prev.includes(seat)) {
          setError('');
          return prev.filter((s: string) => s !== seat);
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
    [disabled, isSeatUnavailable, passengers]
  );

  const handleContinue = () => {
    onSeatSelection(internalSelectedSeats);
  };

  // ── Seat styling ───────────────────────────────────────────────────────────
  const getSeatStatus = useCallback(
    (seat: string | null) => {
      if (!seat) return 'empty';
      if (bookedSeats.has(seat)) return 'booked';
      if (reservedSeatsSet.has(seat)) return 'reserved';
      if (internalSelectedSeats.includes(seat)) return 'selected';
      if (hoveredSeat === seat) return 'hovered';
      return 'available';
    },
    [bookedSeats, internalSelectedSeats, hoveredSeat, reservedSeatsSet]
  );

  const getSeatClassName = useCallback((status: string) => {
    const base =
      'w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-xl text-[10px] sm:text-xs lg:text-sm font-semibold transition-all duration-200 border-2 focus:outline-none focus:ring-2 focus:ring-brand-700 focus:ring-offset-2 flex items-center justify-center';
    switch (status) {
      case 'booked':
        return `${base} bg-gray-200 text-gray-500 border-gray-300 cursor-not-allowed opacity-75`;
      case 'reserved':
        return `${base} bg-amber-100 text-amber-700 border-amber-200 cursor-not-allowed opacity-90`;
      case 'selected':
        return `${base} bg-gradient-to-br from-brand-700 to-brand-800 text-white border-brand-800 shadow-lg transform scale-105`;
      case 'hovered':
        return `${base} bg-brand-50 text-brand-700 border-brand-200 cursor-pointer transform scale-105 shadow-md`;
      case 'available':
        return `${base} bg-white text-brand-700 border-brand-100 cursor-pointer hover:bg-brand-50 hover:border-brand-200 hover:shadow-md`;
      default:
        return 'invisible';
    }
  }, []);

  const getSeatAriaLabel = useCallback((seat: string | null, status: string) => {
    if (!seat) return undefined;
    const statusText =
      {
        booked: 'unavailable',
        reserved: 'temporarily reserved',
        selected: 'selected',
        available: 'available for selection',
      }[status] || 'unknown';
    return `Seat ${seat}, ${statusText}`;
  }, []);

  const reservedSeatsCount = reservedSeatsSet.size;
  const selectionProgress = Math.min((internalSelectedSeats.length / passengers) * 100, 100);
  const remaining = passengers - internalSelectedSeats.length;

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
            {bus?.busType || 'Standard'} Bus · {bus?.capacity || 40} seats
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
            className="h-2 bg-gradient-to-r from-brand-700 to-brand-800 rounded-full transition-all duration-500"
            style={{ width: `${selectionProgress}%` }}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <AlertMessage
          type="error"
          message={error}
          onClose={() => setError('')}
          autoClose={true}
          scrollIntoView={true}
          className="mb-4"
        />
      )}

      {/* Selected seats summary */}
      {internalSelectedSeats.length > 0 && (
        <div className="mb-6 p-4 bg-brand-50 border border-brand-100 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-brand-900 mb-1">Selected Seats</p>
              <p className="text-brand-800 font-semibold">
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
      <div className="max-w-full mx-auto mb-6 overflow-x-auto">
        <div className="mx-auto max-w-[34rem] rounded-[32px] border border-gray-200 bg-slate-50 p-4 shadow-sm">
          <div className="mb-4 flex justify-center">
            <div className="h-2.5 w-28 rounded-full bg-slate-200" />
          </div>
          <div className="space-y-3">
            {seatLayout.map((row: (string | null)[], rowIndex: number) => {
              const { seatsPerRow, aislePosition } = layoutConfig;
              const meta = rowMeta?.[rowIndex];

              // Trust the authoritative row type computed by generateSeatGrid —
              // do NOT fall back to positional heuristics (isLastRow /
              // validSeatsInRow > seatsPerRow). Those heuristics can misfire
              // (e.g. a 'block' or 'asymmetric' row that happens to be the last
              // generated row would incorrectly be force-rendered as a bench)
              // now that generateSeatGrid already returns a correct rowMeta for
              // every row.
              const isBenchRow = meta?.type === 'bench';

              return (
                <div key={rowIndex} className="flex items-center gap-2 min-w-max">
                  {/* Row number */}
                  <div className="w-8 text-xs text-gray-400 text-center font-medium flex-shrink-0">
                    {rowIndex + 1}
                  </div>

                  {/* Seating area */}
                  <div className="flex-1 flex justify-center">
                    {meta?.type === 'block' ? (
                      <div className="w-full max-w-[18rem] sm:max-w-[22rem] py-2 px-4 rounded-xl bg-slate-200/90 border border-slate-300 text-center text-xs font-bold text-slate-600 flex items-center justify-center gap-2 shadow-inner">
                        <span className="inline-block w-2 h-2 rounded-full bg-slate-400"></span>
                        <span>{meta.label || 'W/C'}</span>
                      </div>
                    ) : isBenchRow ? (
                      /* Rear Bench Layout — aligned with standard row grid columns */
                      (() => {
                        const benchSeats = row.filter(
                          (seat): seat is string => Boolean(seat)
                        );
                        const hasMiddleAisleSeat = benchSeats.length > seatsPerRow;
                        const leftSeats = benchSeats.slice(0, aislePosition);
                        const middleSeat = hasMiddleAisleSeat ? benchSeats[aislePosition] : null;
                        const rightSeats = hasMiddleAisleSeat
                          ? benchSeats.slice(aislePosition + 1)
                          : benchSeats.slice(aislePosition);

                        // Fill arrays to match exact column count
                        const leftItems: (string | null)[] = [...leftSeats];
                        while (leftItems.length < aislePosition) leftItems.push(null);

                        const rightCount = seatsPerRow - aislePosition;
                        const rightItems: (string | null)[] = [...rightSeats];
                        while (rightItems.length < rightCount) rightItems.push(null);

                        return (
                          <div
                            className="grid gap-1 justify-center items-center justify-items-center w-[18rem] sm:w-[22rem]"
                            style={{
                              gridTemplateColumns: `repeat(${aislePosition}, minmax(2rem, 3rem)) minmax(1.5rem, 2rem) repeat(${seatsPerRow - aislePosition}, minmax(2rem, 3rem))`,
                            }}
                          >
                            {/* Left bench seats */}
                            {leftItems.map((seat: string | null, colIndex: number) => {
                              if (!seat) return <div key={`bench-left-space-${colIndex}`} className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 pointer-events-none" />;
                              const status = getSeatStatus(seat);
                              return (
                                <button
                                  key={`${seat}-${colIndex}`}
                                  className={getSeatClassName(status)}
                                  onClick={() => handleSeatClick(seat)}
                                  onMouseEnter={() => setHoveredSeat(seat)}
                                  onMouseLeave={() => setHoveredSeat(null)}
                                  disabled={status === 'booked' || status === 'reserved' || disabled}
                                  aria-label={getSeatAriaLabel(seat, status)}
                                  aria-pressed={status === 'selected'}
                                >
                                  {seat}
                                </button>
                              );
                            })}

                            {/* Middle Aisle seat or spacer */}
                            {middleSeat ? (() => {
                              const status = getSeatStatus(middleSeat);
                              return (
                                <button
                                  key={`${middleSeat}-mid`}
                                  className={getSeatClassName(status)}
                                  onClick={() => handleSeatClick(middleSeat)}
                                  onMouseEnter={() => setHoveredSeat(middleSeat)}
                                  onMouseLeave={() => setHoveredSeat(null)}
                                  disabled={status === 'booked' || status === 'reserved' || disabled}
                                  aria-label={getSeatAriaLabel(middleSeat, status)}
                                  aria-pressed={status === 'selected'}
                                >
                                  {middleSeat}
                                </button>
                              );
                            })() : (
                              <div className="w-4 sm:w-6 h-8 sm:h-10 lg:h-12 pointer-events-none" />
                            )}

                            {/* Right bench seats */}
                            {rightItems.map((seat: string | null, colIndex: number) => {
                              if (!seat) return <div key={`bench-right-space-${colIndex}`} className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 pointer-events-none" />;
                              const status = getSeatStatus(seat);
                              return (
                                <button
                                  key={`${seat}-${colIndex}`}
                                  className={getSeatClassName(status)}
                                  onClick={() => handleSeatClick(seat)}
                                  onMouseEnter={() => setHoveredSeat(seat)}
                                  onMouseLeave={() => setHoveredSeat(null)}
                                  disabled={status === 'booked' || status === 'reserved' || disabled}
                                  aria-label={getSeatAriaLabel(seat, status)}
                                  aria-pressed={status === 'selected'}
                                >
                                  {seat}
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()
                    ) : (
                      /* Standard Row Layout (With Aisle Split) */
                      (() => {
                        const leftCount = aislePosition;
                        const rightCount = seatsPerRow - aislePosition;

                        const leftSeats = [...row.slice(0, leftCount)];
                        while (leftSeats.length < leftCount) leftSeats.push(null);

                        const rightSeats = [...row.slice(leftCount)];
                        while (rightSeats.length < rightCount) rightSeats.push(null);

                        return (
                          <div
                            className="grid gap-1 justify-center items-center justify-items-center w-[18rem] sm:w-[22rem]"
                            style={{
                              gridTemplateColumns: `repeat(${aislePosition}, minmax(2rem, 3rem)) minmax(1.5rem, 2rem) repeat(${seatsPerRow - aislePosition}, minmax(2rem, 3rem))`,
                            }}
                          >
                            {/* Left seats */}
                            {leftSeats.map((seat: string | null, colIndex: number) => {
                              if (!seat)
                                return (
                                  <div
                                    key={`spacer-left-${rowIndex}-${colIndex}`}
                                    className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 pointer-events-none"
                                  />
                                );
                              const status = getSeatStatus(seat);
                              return (
                                <button
                                  key={`${seat}-${colIndex}`}
                                  className={getSeatClassName(status)}
                                  onClick={() => handleSeatClick(seat)}
                                  onMouseEnter={() => setHoveredSeat(seat)}
                                  onMouseLeave={() => setHoveredSeat(null)}
                                  disabled={status === 'booked' || status === 'reserved' || disabled}
                                  aria-label={getSeatAriaLabel(seat, status)}
                                  aria-pressed={status === 'selected'}
                                >
                                  {seat}
                                </button>
                              );
                            })}

                            {/* Dedicated Aisle Column */}
                            <div className="flex justify-center items-center w-full h-full px-1" aria-hidden="true">
                              <div className="w-px h-8 sm:h-10 lg:h-12 bg-gradient-to-b from-gray-200 via-gray-300 to-gray-200" />
                            </div>

                            {/* Right seats */}
                            {rightSeats.map((seat: string | null, colIndex: number) => {
                              if (!seat)
                                return (
                                  <div
                                    key={`spacer-right-${rowIndex}-${colIndex}`}
                                    className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 pointer-events-none"
                                  />
                                );
                              const status = getSeatStatus(seat);
                              return (
                                <button
                                  key={`${seat}-${colIndex}`}
                                  className={getSeatClassName(status)}
                                  onClick={() => handleSeatClick(seat)}
                                  onMouseEnter={() => setHoveredSeat(seat)}
                                  onMouseLeave={() => setHoveredSeat(null)}
                                  disabled={status === 'booked' || status === 'reserved' || disabled}
                                  aria-label={getSeatAriaLabel(seat, status)}
                                  aria-pressed={status === 'selected'}
                                >
                                  {seat}
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex justify-center">
            <div className="h-1.5 w-20 rounded-full bg-slate-200" />
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center space-x-6 mb-6 flex-wrap">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-white border-2 border-brand-100 rounded-md" />
          <span className="text-sm text-gray-600">Available</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-gradient-to-br from-brand-700 to-brand-800 rounded-md" />
          <span className="text-sm text-gray-600">Selected</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-gray-200 border-2 border-gray-300 rounded-md" />
          <span className="text-sm text-gray-600">Booked</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-amber-100 border-2 border-amber-200 rounded-md" />
          <span className="text-sm text-gray-600">Reserved</span>
        </div>
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between text-sm text-gray-500 pb-4 border-b mb-6 flex-wrap gap-4">
        <span>{seatLayout.flat().filter(Boolean).length - bookedSeats.size - reservedSeatsCount} seats available</span>
        <span>{bookedSeats.size} seats booked</span>
        <span>{reservedSeatsCount} seats reserved</span>
      </div>

      {/* Continue button */}
      {!hideContinue && (
        <button
          onClick={handleContinue}
          disabled={internalSelectedSeats.length !== passengers || disabled}
          className="w-full py-3 px-6 bg-coral-500 text-white font-semibold rounded-xl
                     disabled:opacity-50 disabled:cursor-not-allowed
                     hover:bg-coral-600 active:bg-coral-700
                     transition-colors duration-200 text-sm"
        >
          {internalSelectedSeats.length === passengers
            ? `Continue with seat${passengers > 1 ? 's' : ''} ${[...internalSelectedSeats].sort().join(', ')}`
            : `Select ${remaining} more seat${remaining !== 1 ? 's' : ''} to continue`}
        </button>
      )}
    </section>
  );
};

export default SeatSelection;