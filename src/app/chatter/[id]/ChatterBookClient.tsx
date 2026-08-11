'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Bus as BusIcon, MapPin, Calendar, Clock, Phone, 
  User, ShieldCheck, Share2, ArrowRight, Loader2, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatterSchedule {
  id: string;
  busName: string;
  origin: string;
  destination: string;
  travelDate: Date | string;
  fare: number;
  totalSeats: number;
  contactPhone: string;
  availableSeats: number;
  bookedSeatsCount: number;
  bookedSeats?: string[];
  rep?: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  };
}

interface ChatterBookClientProps {
  schedule: ChatterSchedule;
}

export default function ChatterBookClient({ schedule }: ChatterBookClientProps) {
  const router = useRouter();
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [phone, setPhone] = useState('');
  const [passengers, setPassengers] = useState<Array<{ firstName: string; lastName: string; seatNumber: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate 40 seats for layout
  const seatLayout = Array.from({ length: 40 }, (_, i) => String(i + 1));
  const bookedSeats = schedule.bookedSeats || [];

  const handleSeatClick = (seat: string) => {
    if (bookedSeats.includes(seat)) return;

    if (selectedSeats.includes(seat)) {
      setSelectedSeats(prev => prev.filter(s => s !== seat));
      setPassengers(prev => prev.filter(p => p.seatNumber !== seat));
    } else {
      setSelectedSeats(prev => [...prev, seat].sort((a, b) => parseInt(a) - parseInt(b)));
      setPassengers(prev => [...prev, { firstName: '', lastName: '', seatNumber: seat }]);
    }
  };

  const handlePassengerChange = (seatNumber: string, field: 'firstName' | 'lastName', value: string) => {
    setPassengers(prev =>
      prev.map(p => (p.seatNumber === seatNumber ? { ...p, [field]: value } : p))
    );
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join our trip: ${schedule.origin} to ${schedule.destination}`,
          text: `Book a seat on ${schedule.busName} leaving on ${new Date(schedule.travelDate).toLocaleDateString()}`,
          url: shareUrl,
        });
      } catch (err) {
        console.error('Share failed', err);
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      alert('Link copied to clipboard!');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSeats.length === 0) {
      setError('Please select at least one seat.');
      return;
    }
    if (!phone) {
      setError('Contact phone is required.');
      return;
    }

    const invalidPassenger = passengers.some(p => !p.firstName || !p.lastName);
    if (invalidPassenger) {
      setError('Please fill in first name and last name for all selected seats.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 1. Create booking
      const bookRes = await fetch('/api/chatter/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatterScheduleId: schedule.id,
          seatNumbers: selectedSeats,
          passengerDetails: passengers,
          contactPhone: phone,
        }),
      });

      const bookJson = await bookRes.json();
      if (!bookJson.success) {
        setError(bookJson.error || 'Failed to create booking.');
        return;
      }

      const bookingId = bookJson.data.id;

      // 2. Initiate PayChangu charge
      const paymentRes = await fetch('/api/payments/paychangu/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          customerDetails: {
            email: bookJson.data.contactEmail || 'chatter@tibhukebus.com',
            name: `${passengers[0].firstName} ${passengers[0].lastName}`,
          },
          metadata: {
            subMethod: 'chatter',
          },
        }),
      });

      const paymentJson = await paymentRes.json();
      if (!paymentJson.success) {
        setError(paymentJson.error || 'Failed to initiate payment.');
        return;
      }

      // Redirect to checkout URL
      if (paymentJson.checkoutUrl) {
        window.location.href = paymentJson.checkoutUrl;
      } else {
        setError('Payment link not received.');
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = selectedSeats.length * schedule.fare;

  return (
    <div className="max-w-5xl mx-auto px-4">
      <div className="grid md:grid-cols-12 gap-8">
        
        {/* Left Column: Trip Info & Seat Map */}
        <div className="md:col-span-7 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold tracking-widest text-indigo-600 uppercase bg-indigo-50 px-2.5 py-1 rounded-full">
                  Group Booking
                </span>
                <h1 className="text-2xl font-bold text-slate-800 mt-2">{schedule.busName}</h1>
              </div>
              <Button variant="outline" size="sm" onClick={handleShare} className="rounded-xl font-semibold border-slate-200">
                <Share2 className="w-4 h-4 mr-2" /> Share Trip
              </Button>
            </div>

            <div className="flex items-center justify-between text-slate-700 py-3 border-y border-slate-50">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-indigo-500" />
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase">Route</p>
                  <p className="font-bold flex items-center gap-1">
                    {schedule.origin} <ArrowRight className="w-3.5 h-3.5" /> {schedule.destination}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400 font-semibold uppercase">Fare</p>
                <p className="font-bold text-indigo-600">MWK {schedule.fare.toLocaleString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>{new Date(schedule.travelDate).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>{new Date(schedule.travelDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>

            {schedule.rep && (
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-sm">
                  {schedule.rep.firstName?.[0] || 'R'}
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase">Representative</p>
                  <p className="text-sm font-bold text-slate-700">
                    {schedule.rep.firstName} {schedule.rep.lastName}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Seat Map */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Select Seats</h2>
              <p className="text-xs text-slate-400 mt-1">Pick your preferred seats from the map below</p>
            </div>

            <div className="flex justify-center gap-6 text-xs font-semibold py-2 border-b border-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-slate-100 border border-slate-200 rounded-md"></div>
                <span>Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-indigo-600 rounded-md"></div>
                <span>Selected</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-slate-300 rounded-md"></div>
                <span>Booked</span>
              </div>
            </div>

            {/* Bus Grid */}
            <div className="max-w-xs mx-auto border-4 border-slate-200 rounded-3xl p-4 relative bg-slate-50/50">
              {/* Steering wheel */}
              <div className="absolute top-2 right-4 w-6 h-6 border-2 border-slate-400 rounded-full flex items-center justify-center text-slate-400 font-bold text-[8px]">
                W
              </div>
              
              <div className="grid grid-cols-4 gap-3 pt-10">
                {seatLayout.map((seat, index) => {
                  const isBooked = bookedSeats.includes(seat);
                  const isSelected = selectedSeats.includes(seat);
                  
                  // Aisle between column 2 and 3
                  const isAisle = index % 4 === 2;

                  return (
                    <React.Fragment key={seat}>
                      {isAisle && <div className="col-span-1"></div>}
                      <button
                        type="button"
                        onClick={() => handleSeatClick(seat)}
                        disabled={isBooked}
                        className={`h-9 rounded-md flex items-center justify-center font-bold text-xs transition-all ${
                          isBooked 
                            ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                            : isSelected
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100 scale-105'
                            : 'bg-white border border-slate-200 text-slate-700 hover:border-indigo-400'
                        }`}
                      >
                        {seat}
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Checkout Form */}
        <div className="md:col-span-5">
          <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6 sticky top-28">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Booking Summary</h2>
              <p className="text-xs text-slate-400 mt-1">Provide passenger details to secure tickets</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex gap-2 text-xs text-red-600">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Passenger Forms */}
            {selectedSeats.length > 0 ? (
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                {passengers.map((p, idx) => (
                  <div key={p.seatNumber} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Passenger {idx + 1}
                      </span>
                      <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                        Seat {p.seatNumber}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">First Name</label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                          <input
                            type="text"
                            required
                            placeholder="John"
                            className="w-full pl-9 pr-3 h-10 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-0 text-sm font-medium"
                            value={p.firstName}
                            onChange={(e) => handlePassengerChange(p.seatNumber, 'firstName', e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Last Name</label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                          <input
                            type="text"
                            required
                            placeholder="Doe"
                            className="w-full pl-9 pr-3 h-10 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-0 text-sm font-medium"
                            value={p.lastName}
                            onChange={(e) => handlePassengerChange(p.seatNumber, 'lastName', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <BusIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-medium">Select seats to proceed</p>
              </div>
            )}

            <div className="space-y-3 pt-4 border-t border-slate-50">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Contact Phone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                  <input
                    type="tel"
                    required
                    placeholder="+265 999 123 456"
                    className="w-full pl-9 pr-3 h-11 bg-slate-50/50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-0 text-sm font-medium"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-sm text-slate-500">
                <span>Seats Selected</span>
                <span className="font-bold text-slate-700">{selectedSeats.length}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-slate-800">
                <span>Total Amount</span>
                <span className="text-indigo-600">MWK {totalAmount.toLocaleString()}</span>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-12 rounded-2xl shadow-lg shadow-indigo-100"
              disabled={loading || selectedSeats.length === 0}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <ShieldCheck className="w-5 h-5 mr-2" />
              )}
              Confirm Booking & Pay
            </Button>
          </form>
        </div>
        
      </div>
    </div>
  );
}
