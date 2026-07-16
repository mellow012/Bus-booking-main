"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Schedule, Company, Bus, Route } from '@/types';
import { createBookingFull } from '@/lib/actions/booking.actions';

export interface BusScheduleWithDetails extends Schedule {
  company: Company;
  bus: Bus;
  route: Route;
}

export interface PassengerDetails {
  id?: string;
  firstName: string;
  lastName: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  seatNumber: string;
  specialNeeds?: string;
  ticketType?: 'adult' | 'child' | 'senior' | 'infant';
  identification?: {
    type: 'passport' | 'national_id' | 'driver_license' | 'other';
    number: string;
  };
  contactNumber?: string;
  email?: string; 
}

export default function useBusDetails() {
  const router = useRouter();
  const { scheduleId } = useParams() as { scheduleId?: string };
  const { user } = useAuth();
  const [schedule, setSchedule] = useState<BusScheduleWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [passengerDetails, setPassengerDetails] = useState<PassengerDetails[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const fetchSchedule = async () => {
      if (!scheduleId) return;
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/schedules/${scheduleId}`, { method: 'GET' });
        if (!response.ok) { setError('Schedule not found'); setLoading(false); return; }
        const { data: scheduleData } = await response.json();
        setSchedule(scheduleData as BusScheduleWithDetails);
      } catch (err: any) {
        setError('Failed to load bus details. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchSchedule();
  }, [scheduleId]);

  const handleSeatSelect = (seat: string) => {
    if (selectedSeats.includes(seat)) {
      setSelectedSeats(prev => prev.filter(s => s !== seat));
      setPassengerDetails(prev => prev.filter(p => p.seatNumber !== seat));
    } else if (selectedSeats.length < 4) {
      setSelectedSeats(prev => [...prev, seat]);
      setPassengerDetails(prev => [
        ...prev,
        { firstName: '', lastName: '', age: 0, gender: 'male', seatNumber: seat } as PassengerDetails,
      ]);
    }
  };

  const handlePassengerChange = (index: number, field: string, value: string | number) => {
    setPassengerDetails(prev => prev.map((p, i) => i === index ? { 
      ...p, 
      [field]: field === 'gender' ? value as 'male' | 'female' | 'other' : value 
    } : p));
  };

  const handleBookNow = () => {
    if (!user) {
      const currentPath = window.location.pathname;
      router.push(`/login?from=${encodeURIComponent(currentPath)}`);
      return;
    }
    if (selectedSeats.length === 0) {
      setError('Please select at least one seat');
      return;
    }
    setModalOpen(true);
  };

  const handleBookingSubmit = async (payload?: { scheduleId?: string; passengerDetails?: PassengerDetails[]; seatNumbers?: string[] }) => {
    if (!schedule || !user) return;
    const seats = payload?.seatNumbers ?? selectedSeats;
    const passengers = payload?.passengerDetails ?? passengerDetails;

    if (passengers.some(p => !p.firstName.trim() || !p.lastName.trim() || p.age <= 0)) {
      setError('Please fill in all passenger details');
      return;
    }
    if (seats.length !== passengers.length || !seats.every(seat => passengers.some(p => p.seatNumber === seat))) {
      setError('Passenger details must match selected seats');
      return;
    }

    const bookingPayload = {
      scheduleId,
      routeId: schedule.route.id,
      companyId: schedule.companyId || schedule.company.id,
      seatNumbers: seats,
      segments: [{ scheduleId, seatNumbers: seats }],
      passengerDetails: passengers,
    };

    setActionLoading(true);
    setError('');
    try {
      const result = await createBookingFull(bookingPayload as any);

      if (result.error) {
        setError(result.error);
        setActionLoading(false);
        return;
      }

      router.push(`/bookings?success=true`);
    } catch (err: any) {
      setError(`Failed to create booking: ${err.message}`);
      setActionLoading(false);
    }
  };

  const totalSeats = schedule?.bus?.capacity ?? 0;
  const bookedSeats = schedule?.bookedSeats || [];
  const seats = Array.from({ length: totalSeats }, (_, i) => {
    const seatNumber = `${Math.floor(i / 4) + 1}${['A', 'B', 'C', 'D'][i % 4]}`;
    return { number: seatNumber, available: !bookedSeats.includes(seatNumber) };
  });

  return {
    schedule,
    loading,
    error,
    selectedSeats,
    setSelectedSeats,
    passengerDetails,
    setPassengerDetails,
    modalOpen,
    setModalOpen,
    actionLoading,
    setActionLoading,
    seats,
    handleSeatSelect,
    handlePassengerChange,
    handleBookNow,
    handleBookingSubmit,
    setError,
  } as const;
}
