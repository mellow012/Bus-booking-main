'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bus as BusIcon, MapPin, Calendar, Clock, Phone,
  User, ShieldCheck, Share2, ArrowRight, Loader2, Info, X, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateSeatRows } from '@/lib/chatterSeatUtils';
import { toDate, isChatterScheduleExpired } from '@/lib/chatterHelpers';
import ChatterConfirmModal from './ChatterConfirmModal';
import { useAppToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { Label } from '@/components/ui/Label';

interface ChatterSchedule {
  id: string;
  busName: string;
  origin: string;
  destination: string;
  travelDate: Date | string;
  fare: number;
  totalSeats: number;
  contactPhone: string;
  pickupPoint?: string | null;
  dropoffPoint?: string | null;
  departureTime?: string;
  status?: string | null;
  images?: string[];
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
  const { success } = useAppToast();
  const { user, userProfile } = useAuth();

  const scheduleDateObj = toDate(schedule.travelDate);
  const hasDeparted = isChatterScheduleExpired(schedule.travelDate);

  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [phone, setPhone] = useState('');
  const [bookingForSelf, setBookingForSelf] = useState(true);

  const [passengers, setPassengers] = useState<Array<{
    firstName: string;
    lastName: string;
    age: string;
    gender: 'male' | 'female' | 'other' | '';
    seatNumber: string;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  // Auto-fill phone on profile load if empty
  React.useEffect(() => {
    if (!phone && (userProfile?.phone || (user as any)?.phone)) {
      setPhone(userProfile?.phone || (user as any)?.phone || '');
    }
  }, [userProfile, user, phone]);

  // Profile names extraction helper
  const getProfileNames = React.useCallback(() => {
    const fn = userProfile?.firstName || (user as any)?.user_metadata?.first_name || '';
    const ln = userProfile?.lastName || (user as any)?.user_metadata?.last_name || '';
    const sex = (userProfile?.sex?.toLowerCase() as 'male' | 'female' | 'other') || '';
    return { firstName: fn, lastName: ln, gender: sex };
  }, [userProfile, user]);

  // Sync passenger 1 when profile finishes loading if bookingForSelf is true
  React.useEffect(() => {
    if (!bookingForSelf || passengers.length === 0) return;
    const { firstName, lastName, gender } = getProfileNames();
    if (!firstName && !lastName) return;

    setPassengers((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      if (next[0] && (!next[0].firstName || !next[0].lastName || next[0].firstName !== firstName)) {
        next[0] = {
          ...next[0],
          firstName: firstName || next[0].firstName,
          lastName: lastName || next[0].lastName,
          gender: gender || next[0].gender || '',
        };
        return next;
      }
      return prev;
    });
  }, [userProfile, bookingForSelf, getProfileNames, passengers.length]);

  const toggleBookingForSelf = (val: boolean) => {
    setBookingForSelf(val);
    const { firstName, lastName, gender } = getProfileNames();

    setPassengers((prev) => {
      if (prev.length === 0) return prev;
      return prev.map((p, idx) => {
        if (idx !== 0) return p;
        return {
          ...p,
          firstName: val ? firstName : '',
          lastName: val ? lastName : '',
          gender: val ? (gender || p.gender) : p.gender,
        };
      });
    });

    if (val && !phone && (userProfile?.phone || (user as any)?.phone)) {
      setPhone(userProfile?.phone || (user as any)?.phone || '');
    }
  };

  React.useEffect(() => {
    const images = schedule.images;
    if (!lightboxOpen || !images) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxOpen(false);
      } else if (e.key === 'ArrowLeft' && images.length > 1) {
        setActiveImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
      } else if (e.key === 'ArrowRight' && images.length > 1) {
        setActiveImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, schedule.images]);

  const openLightbox = (index: number) => {
    setActiveImageIndex(index);
    setLightboxOpen(true);
  };

  const seatRows = generateSeatRows(schedule.totalSeats, 4);
  const bookedSeats = schedule.bookedSeats || [];

  const handleSeatClick = (seat: string) => {
    if (hasDeparted || (schedule.status && schedule.status !== 'active')) return;
    if (bookedSeats.includes(seat)) return;

    if (selectedSeats.includes(seat)) {
      const nextSeats = selectedSeats.filter(s => s !== seat);
      setSelectedSeats(nextSeats);
      setPassengers(prev => prev.filter(p => p.seatNumber !== seat));
    } else {
      const nextSeats = [...selectedSeats, seat].sort((a, b) => parseInt(a) - parseInt(b));
      setSelectedSeats(nextSeats);
      
      const isFirstSeat = selectedSeats.length === 0;
      const { firstName, lastName, gender } = getProfileNames();

      setPassengers(prev => [...prev, {
        firstName: isFirstSeat && bookingForSelf ? firstName : '',
        lastName: isFirstSeat && bookingForSelf ? lastName : '',
        age: isFirstSeat && bookingForSelf ? '18' : '',
        gender: isFirstSeat && bookingForSelf && gender ? gender : '',
        seatNumber: seat,
      }]);
    }
  };

  const handlePassengerChange = (seatNumber: string, field: 'firstName' | 'lastName' | 'age' | 'gender', value: string) => {
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
          text: `Book a seat on ${schedule.busName} leaving on ${scheduleDateObj ? scheduleDateObj.toLocaleDateString() : 'TBD'}`,
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

  const handleProceedToPayment = () => {
    if (hasDeparted) {
      setError('This trip has already departed and can no longer accept new bookings.');
      return;
    }
    if (schedule.status && schedule.status !== 'active') {
      setError('This schedule is no longer active for booking.');
      return;
    }
    if (selectedSeats.length === 0) {
      setError('Please select at least one seat.');
      return;
    }
    if (!phone) {
      setError('Contact phone is required.');
      return;
    }

    if (passengers.length !== selectedSeats.length) {
      setError(`Please provide details for all ${selectedSeats.length} passengers.`);
      return;
    }

    const incomplete = passengers.some(
      (p) => !p.firstName.trim() || !p.lastName.trim() || !p.age || !p.gender
    );
    if (incomplete) {
      setError('Please complete all passenger fields before proceeding.');
      return;
    }

    setError(null);
    setConfirmModalOpen(true);
  };

  const handleBookingSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Create booking
      const payloadPassengers = passengers.map((p) => ({
        ...p,
        age: Number(p.age),
      }));

      const bookRes = await fetch('/api/chatter/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatterScheduleId: schedule.id,
          seatNumbers: selectedSeats,
          passengerDetails: payloadPassengers,
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
        setConfirmModalOpen(false);
        success('Success', 'Redirecting to PayChangu…');
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
          {/* If schedule isn't active or has departed, show a clear alert */}
          {(schedule.status && schedule.status !== 'active') || hasDeparted ? (
            <div className="bg-amber-50 border border-amber-100 text-amber-800 rounded-2xl p-4">
              {hasDeparted ? (
                <div>
                  <p className="font-bold">This trip has departed</p>
                  <p className="text-sm">Departure was on {scheduleDateObj ? scheduleDateObj.toLocaleString() : 'Unknown'}.</p>
                </div>
              ) : (
                <div>
                  <p className="font-bold">This trip is not open for booking</p>
                  <p className="text-sm">Current status: {schedule.status}. If you think this is an error contact the representative.</p>
                </div>
              )}
            </div>
          ) : null}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="inline-block px-2.5 py-1 bg-brand-100 text-brand-700 text-xs font-semibold rounded-full tracking-wider mb-3">
                  GROUP BOOKING
                </span>
                <h1 className="text-2xl font-bold text-slate-800">{schedule.busName}</h1>
              </div>
              <Button
                variant="outline"
                size="sm" onClick={handleShare} className="rounded-xl font-semibold border-slate-200">
                <Share2 className="w-4 h-4 mr-2" /> Share Trip
              </Button>
            </div>

            <div className="flex flex-col gap-4 text-slate-700 py-3 border-y border-slate-50 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2">
                <MapPin className="w-5 h-5 text-coral-600 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase">Route</p>
                  <p className="font-bold flex items-center gap-1">
                    {schedule.origin} <ArrowRight className="w-3.5 h-3.5" /> {schedule.destination}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400 font-semibold uppercase">Fare</p>
                <p className="font-bold text-coral-700">MWK {schedule.fare.toLocaleString()}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm text-slate-600 pt-3">
              <div className="rounded-3xl bg-slate-50 p-3 border border-slate-100">
                <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400 font-semibold">Pickup point</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{schedule.pickupPoint || 'Not specified'}</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-3 border border-slate-100">
                <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400 font-semibold">Drop-off point</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{schedule.dropoffPoint || 'Not specified'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>{scheduleDateObj ? scheduleDateObj.toLocaleDateString() : 'TBD'}</span>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>{schedule.departureTime || '-'}</span>
              </div>
            </div>

            {schedule.rep && (
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center gap-3">
                <div className="w-10 h-10 bg-coral-100 rounded-full flex items-center justify-center text-coral-700 font-bold text-sm">
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

          {/* Vehicle Images */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Vehicle Photos</h2>
              <p className="text-xs text-slate-400 mt-1">Check out the bus for this trip</p>
            </div>

            {schedule.images && schedule.images.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {schedule.images.map((img, idx) => (
                  <div
                    key={idx}
                    className="aspect-square rounded-xl overflow-hidden border border-slate-100 shadow-sm relative group cursor-pointer"
                    onClick={() => openLightbox(idx)}
                  >
                    <img src={img} alt={`Bus image ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <BusIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500 font-semibold">No photos available</p>
                <p className="text-xs text-slate-400 mt-1">The representative hasn't uploaded any photos yet.</p>
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
                <div className="w-4 h-4 bg-coral-500 rounded-md"></div>
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

              <div className="space-y-3 pt-10">
                {seatRows.map((row, rowIndex) => (
                  <div key={`row-${rowIndex}`} className="flex items-center justify-between gap-3">
                    <div className="flex w-2/5 justify-end gap-3">
                      {row.slice(0, 2).map((seat) => {
                        const isBooked = bookedSeats.includes(seat);
                        const isSelected = selectedSeats.includes(seat);
                        return (
                          <button
                            key={seat}
                            type="button"
                            onClick={() => handleSeatClick(seat)}
                            disabled={isBooked}
                            className={`h-10 w-10 rounded-md flex items-center justify-center font-bold text-xs transition-all ${isBooked
                              ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                              : isSelected
                                ? 'bg-coral-500 text-white shadow-md shadow-coral-100 scale-105'
                                : 'bg-white border border-slate-200 text-slate-700 hover:border-coral-400'
                              }`}
                          >
                            {seat}
                          </button>
                        );
                      })}
                    </div>

                    <div className="w-1/5 text-center text-[7px] font-bold text-gray-300 uppercase tracking-widest">Aisle</div>

                    <div className="flex w-2/5 justify-start gap-3">
                      {row.slice(2).map((seat) => {
                        const isBooked = bookedSeats.includes(seat);
                        const isSelected = selectedSeats.includes(seat);
                        return (
                          <button
                            key={seat}
                            type="button"
                            onClick={() => handleSeatClick(seat)}
                            disabled={isBooked}
                            className={`h-10 w-10 rounded-md flex items-center justify-center font-bold text-xs transition-all ${isBooked
                              ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                              : isSelected
                                ? 'bg-coral-500 text-white shadow-md shadow-coral-100 scale-105'
                                : 'bg-white border border-slate-200 text-slate-700 hover:border-coral-400'
                              }`}
                          >
                            {seat}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Checkout Form */}
        <div className="md:col-span-5">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6 sticky top-28">
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
              <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
                {/* Opt-in Auto-fill Toggle */}
                <div className="flex items-center gap-2 p-3 bg-brand-50/60 rounded-xl border border-brand-100">
                  <input
                    type="checkbox"
                    id="chatterBookingForSelf"
                    checked={bookingForSelf}
                    onChange={(e) => toggleBookingForSelf(e.target.checked)}
                    className="w-4 h-4 accent-brand-700 border-gray-300 rounded focus:ring-brand-700 cursor-pointer"
                  />
                  <Label htmlFor="chatterBookingForSelf" className="text-xs font-semibold text-brand-900 cursor-pointer select-none">
                    I am travelling (Auto-fill my details)
                  </Label>
                </div>

                {passengers.map((p, idx) => (
                  <div key={p.seatNumber} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3 relative group">
                    <div className="flex justify-between items-center pr-8">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Passenger {idx + 1}
                      </span>
                      <span className="text-xs font-bold bg-coral-50 text-coral-600 px-2 py-0.5 rounded-full">
                        Seat {p.seatNumber}
                      </span>
                    </div>
                    {/* Remove passenger button */}
                    <button
                      type="button"
                      onClick={() => handleSeatClick(p.seatNumber)}
                      className="absolute top-2.5 right-3 w-7 h-7 rounded-full bg-white border border-slate-200 text-slate-400 flex items-center justify-center hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors shadow-sm"
                      title="Remove seat"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">First Name</label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                          <input
                            type="text"
                            required
                            placeholder="John"
                            className="w-full pl-9 pr-3 h-10 bg-white border border-slate-200 rounded-xl focus:border-coral-500 focus:ring-0 text-sm font-medium"
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
                            className="w-full pl-9 pr-3 h-10 bg-white border border-slate-200 rounded-xl focus:border-coral-500 focus:ring-0 text-sm font-medium"
                            value={p.lastName}
                            onChange={(e) => handlePassengerChange(p.seatNumber, 'lastName', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Gender</label>
                        <select
                          required
                          value={p.gender}
                          onChange={(e) => handlePassengerChange(p.seatNumber, 'gender', e.target.value)}
                          className="w-full h-10 bg-white border border-slate-200 rounded-xl pl-3 pr-10 text-sm font-medium focus:border-coral-500 focus:ring-0"
                        >
                          <option value="">Select gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Age</label>
                        <input
                          type="number"
                          required
                          min="1"
                          placeholder="Age"
                          className="w-full h-10 bg-white border border-slate-200 rounded-xl pl-3 pr-3 text-sm font-medium focus:border-coral-500 focus:ring-0"
                          value={p.age}
                          onChange={(e) => handlePassengerChange(p.seatNumber, 'age', e.target.value)}
                        />
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
                    className="w-full pl-9 pr-3 h-11 bg-slate-50/50 border border-slate-200 rounded-xl focus:border-coral-500 focus:ring-0 text-sm font-medium"
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
                <span className="text-coral-700">MWK {totalAmount.toLocaleString()}</span>
              </div>
            </div>

            <Button
              type="button"
              className="w-full bg-coral-500 hover:bg-coral-600 text-white font-bold h-12 rounded-2xl shadow-lg shadow-coral-100"
              onClick={handleProceedToPayment}
              disabled={loading || selectedSeats.length === 0}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <ShieldCheck className="w-5 h-5 mr-2" />
              )}
              Confirm Booking & Pay
            </Button>
          </div>
        </div>

      </div>

      <ChatterConfirmModal
        isOpen={confirmModalOpen}
        onClose={() => {
          if (!loading) setConfirmModalOpen(false);
        }}
        schedule={schedule}
        selectedSeats={selectedSeats}
        passengers={passengers}
        totalAmount={totalAmount}
        loading={loading}
        onConfirm={handleBookingSubmit}
      />

      {/* Lightbox Modal */}
      {lightboxOpen && schedule.images && schedule.images.length > 0 && (
        <div
          className="fixed inset-0 bg-black/95 backdrop-blur-md z-[150] flex flex-col items-center justify-center animate-in fade-in duration-200"
          onClick={() => setLightboxOpen(false)}
        >
          {/* Top Bar */}
          <div className="absolute top-0 inset-x-0 h-16 flex items-center justify-between px-6 bg-gradient-to-b from-black/60 to-transparent text-white z-10 select-none">
            <span className="text-sm font-medium text-gray-300">
              {activeImageIndex + 1} / {schedule.images.length}
            </span>
            <button
              onClick={() => setLightboxOpen(false)}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white focus:outline-none"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main Image Container */}
          <div className="relative w-full max-w-5xl px-4 flex items-center justify-center h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={schedule.images[activeImageIndex]}
              alt={`Bus view ${activeImageIndex + 1}`}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl select-none animate-in zoom-in-95 duration-200"
            />

            {/* Navigation Buttons */}
            {schedule.images.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImageIndex((prev) => (prev === 0 ? schedule.images!.length - 1 : prev - 1));
                  }}
                  className="absolute left-2 md:left-6 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 transition-all text-white border border-white/10 hover:scale-105 active:scale-95 focus:outline-none"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImageIndex((prev) => (prev === schedule.images!.length - 1 ? 0 : prev + 1));
                  }}
                  className="absolute right-2 md:right-6 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 transition-all text-white border border-white/10 hover:scale-105 active:scale-95 focus:outline-none"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
