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
  // new
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
  'standard': { seatsPerRow: 4, aislePosition: 2, seatLabels: ['A', 'B', 'C', 'D'] },
  'luxury': { seatsPerRow: 3, aislePosition: 1, seatLabels: ['A', 'B', 'C'] },
  'express': { seatsPerRow: 4, aislePosition: 2, seatLabels: ['A', 'B', 'C', 'D'] },
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

  // Memoized seat layout configuration
  const layoutConfig = useMemo(() => {
    const busType = bus.busType?.toLowerCase() || 'standard';
    return SEAT_LAYOUT_CONFIGS[busType] || SEAT_LAYOUT_CONFIGS.standard;
  }, [bus.busType]);

  // Memoized seat layout generation
  const seatLayout = useMemo(() => {
    const totalSeats = bus.capacity || 40;
    const { seatsPerRow, seatLabels } = layoutConfig;
    const rows = Math.ceil(totalSeats / seatsPerRow);
    const seats = [];
    let seatCounter = 1;
    
    for (let row = 1; row <= rows; row++) {
      const rowSeats = [];
      for (let col = 0; col < seatsPerRow && seatCounter <= totalSeats; col++) {
        const seatLetter = seatLabels[col];
        const seatNumber = `${row}${seatLetter}`;
        rowSeats.push(seatNumber);
        seatCounter++;
      }
      
      // Fill incomplete rows with null for proper spacing
      while (rowSeats.length < seatsPerRow) {
        rowSeats.push(null);
      }
      
      seats.push(rowSeats);
    }
    return seats;
  }, [bus.capacity, layoutConfig]);

  // new: get segment range
  const segmentRange = useMemo(() => {
    if (!route?.stops || !originStopId || !destinationStopId) return [];
    const originIdx = route.stops.findIndex(s => s.id === originStopId);
    const destIdx = route.stops.findIndex(s => s.id === destinationStopId);
    if (originIdx < 0 || destIdx < 0 || originIdx >= destIdx) return [];
    // segments are between stops, so range is originIdx to destIdx-1
    return Array.from({ length: destIdx - originIdx }, (_, i) => `${originIdx + i}-${originIdx + i + 1}`);
  }, [route, originStopId, destinationStopId]);

  // Memoized booked seats
  const bookedSeats = useMemo(() => new Set(schedule.bookedSeats || []), [schedule.bookedSeats]);

  // updated: is seat available for the segment range? for now, check if booked at all (full-trip)
  // future: if u add schedule.segmentBookedSeats: map<segmentKey, string[]>, check !segmentBookedSeats[seg].includes(seat) for all seg in range
  const isSeatBooked = useCallback((seat: string | null) => {
    if (!seat) return true;  // spacer
    if (segmentRange.length === 0) return true;  // invalid range
    return bookedSeats.has(seat);  // simple full-trip check
  }, [bookedSeats, segmentRange]);

  // Sync external selectedSeats changes
  useEffect(() => {
    setInternalSelectedSeats(selectedSeats);
  }, [selectedSeats]);

  // Handle seat selection with comprehensive validation
  const handleSeatClick = useCallback((seat: string) => {
    if (disabled || isSeatBooked(seat)) return;

    setInternalSelectedSeats((prev) => {
      let newSelection: string[];
      
      if (prev.includes(seat)) {
        // Deselect seat
        newSelection = prev.filter(s => s !== seat);
        setError('');
      } else {
        if (prev.length >= passengers) {
          // Replace oldest selection or show error
          if (passengers === 1) {
            newSelection = [seat];
          } else {
            setError(`You can only select ${passengers} seat${passengers > 1 ? 's' : ''}. Deselect a seat first.`);
            return prev;
          }
        } else {
          // Add new seat
          newSelection = [...prev, seat];
          setError('');
        }
      }
      
      return newSelection;
    });
  }, [disabled, isSeatBooked, passengers]);

  // Trigger callback when selection is complete
  useEffect(() => {
    if (internalSelectedSeats.length === passengers && internalSelectedSeats.length > 0) {
      onSeatSelection(internalSelectedSeats);
    } else if (internalSelectedSeats.length === 0) {
      onSeatSelection([]);
    }
  }, [internalSelectedSeats, passengers, onSeatSelection]);

  // Get seat status for styling and accessibility
  const getSeatStatus = useCallback((seat: string | null) => {
    if (!seat) return 'empty';
    if (isSeatBooked(seat)) return 'booked';
    if (internalSelectedSeats.includes(seat)) return 'selected';
    if (hoveredSeat === seat) return 'hovered';
    return 'available';
  }, [isSeatBooked, internalSelectedSeats, hoveredSeat]);

  // Get seat className based on status
  const getSeatClassName = useCallback((status: string) => {
    const baseClasses = 'w-10 h-10 rounded-xl text-xs font-semibold transition-all duration-200 border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2';
    
    switch (status) {
      case 'booked':
        return `${baseClasses} bg-gray-200 text-gray-500 border-gray-300 cursor-not-allowed opacity-75`;
      case 'selected':
        return `${baseClasses} bg-gradient-to-br from-blue-500 to-blue-600 text-white border-blue-600 shadow-lg transform scale-105`;
      case 'hovered':
        return `${baseClasses} bg-blue-100 text-blue-700 border-blue-300 cursor-pointer transform scale-105 shadow-md`;
      case 'available':
        return `${baseClasses} bg-white text-blue-600 border-blue-200 cursor-pointer hover:bg-blue-50 hover:border-blue-300 hover:shadow-md`;
      default:
        return 'invisible';
    }
  }, []);

  // Get accessibility label for seat
  const getSeatAriaLabel = useCallback((seat: string | null, status: string) => {
    if (!seat) return undefined;
    
    const statusText = {
      'booked': 'unavailable',
      'selected': 'selected',
      'available': 'available for selection'
    }[status] || 'unknown';
    
    return `Seat ${seat}, ${statusText}`;
  }, []);

  // Auto-clear error messages
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const selectionProgress = Math.min((internalSelectedSeats.length / passengers) * 100, 100);

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
            {bus.busType || 'Standard'} Bus • {bus.capacity || 40} seats
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
      
      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg" role="alert">
          <p className="text-red-700 text-sm font-medium">{error}</p>
        </div>
      )}
      
      {/* Selected Seats Display */}
      {internalSelectedSeats.length > 0 && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-900 mb-1">Selected Seats</p>
              <p className="text-blue-800 font-semibold">
                {internalSelectedSeats.sort().join(', ')}
              </p>
            </div>
            {internalSelectedSeats.length === passengers && (
              <div className="text-green-600">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bus Orientation */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center px-4 py-2 bg-gray-100 rounded-full border">
          <div className="w-4 h-4 mr-2 bg-gray-400 rounded-full"></div>
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
                
                {/* Left side seats */}
                <div className="flex gap-1">
                  {row.slice(0, aislePosition).map((seat, colIndex) => {
                    if (!seat) {
                      return <div key={`spacer-left-${rowIndex}-${colIndex}`} className="w-10 h-10" />;
                    }
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
                  <div className="w-px h-6 bg-gradient-to-b from-gray-200 via-gray-300 to-gray-200"></div>
                </div>

                {/* Right side seats */}
                <div className="flex gap-1">
                 {row.slice(aislePosition).map((seat, colIndex) => {
                    if (!seat) {
                      return <div key={`spacer-right-${rowIndex}-${colIndex}`} className="w-10 h-10" />;
                    }
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
      <div className="flex items-center justify-center space-x-6 mb-4">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-white border-2 border-blue-200 rounded-md"></div>
          <span className="text-sm text-gray-600">Available</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-md"></div>
          <span className="text-sm text-gray-600">Selected</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-gray-200 border-2 border-gray-300 rounded-md"></div>
          <span className="text-sm text-gray-600">Booked</span>
        </div>
      </div>

      {/* Footer Stats */}
      <div className="flex items-center justify-between text-sm text-gray-500 pt-4 border-t">
        <span>
          {seatLayout.flat().filter(Boolean).length - bookedSeats.size} seats available
        </span>
        <span>
          {bookedSeats.size} seats booked
        </span>
      </div>
    </section>
  );
};

export default SeatSelection;