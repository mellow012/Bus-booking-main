'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doc, getDoc, updateDoc, setDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { useAuth } from '@/contexts/AuthContext';
import { Schedule, Company, Bus, Route, Booking } from '@/types';
import { Map, Clock, Currency, Bus as BusIcon, Armchair, User, Loader2, AlertCircle } from 'lucide-react';
import Modal from '../../../components/Modals';
import AlertMessage from '../../../components/AlertMessage';
import { v4 as uuidv4 } from 'uuid';

interface BusScheduleWithDetails extends Schedule {
  company: Company;
  bus: Bus;
  route: Route;
}

const BusDetailsPage: React.FC = () => {
  const router = useRouter();
  const { scheduleId } = useParams();
  const { user, userProfile } = useAuth();
  const [schedule, setSchedule] = useState<BusScheduleWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [passengerDetails, setPassengerDetails] = useState<Array<{ name: string; age: number; gender: string; seatNumber: string }>>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    const fetchSchedule = async () => {
      setLoading(true);
      setError('');
      try {
        const scheduleDoc = await getDoc(doc(db, 'schedules', scheduleId as string));
        if (!scheduleDoc.exists()) {
          setError('Schedule not found');
          return;
        }
        const scheduleData = { id: scheduleDoc.id, ...scheduleDoc.data() } as Schedule;

        const companyDoc = await getDoc(doc(db, 'companies', scheduleData.companyId));
        if (!companyDoc.exists()) {
          setError('Company not found');
          return;
        }
        const company = { id: companyDoc.id, ...companyDoc.data() } as Company;

        const busDoc = await getDoc(doc(db, 'buses', scheduleData.busId));
        if (!busDoc.exists()) {
          setError('Bus not found');
          return;
        }
        const bus = { id: busDoc.id, ...busDoc.data() } as Bus;

        const routeDoc = await getDoc(doc(db, 'routes', scheduleData.routeId));
        if (!routeDoc.exists()) {
          setError('Route not found');
          return;
        }
        const route = { id: routeDoc.id, ...routeDoc.data() } as Route;

        setSchedule({ ...scheduleData, company, bus, route });
      } catch (err: any) {
        setError('Failed to load bus details. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, [user, scheduleId, router]);

  const handleSeatSelect = (seat: string) => {
    if (selectedSeats.includes(seat)) {
      setSelectedSeats(prev => prev.filter(s => s !== seat));
      setPassengerDetails(prev => prev.filter(p => p.seatNumber !== seat));
    } else if (selectedSeats.length < 4) { // Limit to 4 seats per booking
      setSelectedSeats(prev => [...prev, seat]);
      setPassengerDetails(prev => [
        ...prev,
        { name: '', age: 0, gender: 'male', seatNumber: seat },
      ]);
    }
  };

  const handlePassengerChange = (index: number, field: string, value: string | number) => {
    setPassengerDetails(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const handleBookNow = () => {
    if (selectedSeats.length === 0) {
      setError('Please select at least one seat');
      return;
    }
    setModalOpen(true);
  };

  const handleBookingSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!schedule || !user) return;

    if (passengerDetails.some(p => !p.name.trim() || p.age <= 0)) {
      setError('Please fill in all passenger details');
      return;
    }
    if (selectedSeats.length !== passengerDetails.length ||
        !selectedSeats.every(seat => passengerDetails.some(p => p.seatNumber === seat))) {
      setError('Passenger details must match selected seats');
      return;
    }

    setActionLoading(true);
    setError('');
    try {
      const scheduleDoc = await getDoc(doc(db, 'schedules', scheduleId as string));
      if (!scheduleDoc.exists() || scheduleDoc.data().availableSeats < selectedSeats.length) {
        setError('Selected seats are no longer available');
        setActionLoading(false);
        return;
      }

      const bookingId = uuidv4();
      const totalAmount = schedule.price * selectedSeats.length;
      const booking: Booking = {
        id: bookingId,
        userId: user.uid,
        scheduleId: schedule.id,
        companyId: schedule.companyId,
        passengerDetails,
        seatNumbers: selectedSeats,
        totalAmount,
        bookingStatus: 'pending',
        paymentStatus: 'pending',
        paymentService: null,
        transactionId: null,
        bookingDate: Timestamp.now(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      await setDoc(doc(db, 'bookings', bookingId), booking);
      await updateDoc(doc(db, 'schedules', scheduleId as string), {
        availableSeats: scheduleDoc.data().availableSeats - selectedSeats.length,
        bookedSeats: [...(scheduleDoc.data().bookedSeats || []), ...selectedSeats],
        updatedAt: Timestamp.now(),
      });

      router.push(`/bookings?success=true`);
    } catch (err: any) {
      setError(`Failed to create booking: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
      </div>
    );
  }

  if (error || !schedule) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <AlertMessage type="error" message={error || 'Bus schedule not found'} onClose={() => router.push('/')} />
      </div>
    );
  }

  // Generate seat layout (e.g., 50 seats, 2x2 layout)
  const totalSeats = schedule.bus.totalSeats;
  const bookedSeats = schedule.bookedSeats || [];
  const seatRows = Math.ceil(totalSeats / 4);
  const seats = Array.from({ length: totalSeats }, (_, i) => {
    const seatNumber = `${Math.floor(i / 4) + 1}${['A', 'B', 'C', 'D'][i % 4]}`;
    return { number: seatNumber, available: !bookedSeats.includes(seatNumber) };
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {error && <AlertMessage type="error" message={error} onClose={() => setError('')} />}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center space-x-4 mb-6">
            <img
              src={schedule.company.logo || 'https://placehold.co/100x100/e2e8f0/64748b?text=Logo'}
              alt={`${schedule.company.name} Logo`}
              className="h-16 w-16 rounded-full object-cover border-2 border-white shadow-sm"
            />
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{schedule.company.name}</h1>
              <p className="text-sm text-gray-600">{schedule.bus.busType} ({schedule.bus.busNumber})</p>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Trip Details</h2>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center space-x-2">
                  <Map className="w-5 h-5 text-red-600" />
                  <p>
                    {schedule.route.origin} to {schedule.route.destination}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-green-600" />
                  <p>Departs: {new Date(schedule.departureTime).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-green-600" />
                  <p>Arrives: {new Date(schedule.arrivalTime).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <Currency className="w-5 h-5 text-red-600" />
                  <p>Price: MWK {schedule.price.toLocaleString()} per seat</p>
                </div>
                <div className="flex items-center space-x-2">
                  <BusIcon className="w-5 h-5 text-black" />
                  <p>Seats Available: {schedule.availableSeats}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <BusIcon className="w-5 h-5 text-black" />
                  <p>Amenities: {schedule.bus.amenities.join(', ') || 'None'}</p>
                </div>
              </div>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Select Seats</h2>
              <div className="grid grid-cols-4 gap-2">
                {seats.map(seat => (
                  <button
                    key={seat.number}
                    className={`p-2 rounded-md text-sm ${
                      !seat.available
                        ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                        : selectedSeats.includes(seat.number)
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-800 hover:bg-green-100'
                    }`}
                    onClick={() => seat.available && handleSeatSelect(seat.number)}
                    disabled={!seat.available}
                  >
                    {seat.number}
                  </button>
                ))}
              </div>
              {selectedSeats.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Passenger Details</h3>
                  {selectedSeats.map((seat, index) => (
                    <div key={seat} className="mb-4 p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium text-gray-800">Seat {seat}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                        <div>
                          <label className="text-sm text-gray-600">Name</label>
                          <input
                            type="text"
                            value={passengerDetails[index]?.name || ''}
                            onChange={e => handlePassengerChange(index, 'name', e.target.value)}
                            className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="text-sm text-gray-600">Age</label>
                          <input
                            type="number"
                            value={passengerDetails[index]?.age || ''}
                            onChange={e => handlePassengerChange(index, 'age', parseInt(e.target.value) || 0)}
                            className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="text-sm text-gray-600">Gender</label>
                          <select
                            value={passengerDetails[index]?.gender || 'male'}
                            onChange={e => handlePassengerChange(index, 'gender', e.target.value)}
                            className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          >
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={handleBookNow}
                className="mt-4 w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 className="animate-spin w-5 h-5 mx-auto" /> : 'Book Now'}
              </button>
            </div>
          </div>
        </div>

        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Confirm Booking"
        >
          <form onSubmit={handleBookingSubmit} className="space-y-4">
            <p className="text-sm text-gray-600">Review your booking details before confirming.</p>
            <div className="text-sm text-gray-600">
              <p className="font-medium">Selected Seats: {selectedSeats.join(', ')}</p>
              <p>Passengers:</p>
              {passengerDetails.map((p, i) => (
                <p key={i} className="ml-2">• {p.name} (Seat: {p.seatNumber}, Age: {p.age}, Gender: {p.gender})</p>
              ))}
              <p className="font-medium mt-2">Total: MWK {(schedule.price * selectedSeats.length).toLocaleString()}</p>
            </div>
            {error && <AlertMessage type="error" message={error} onClose={() => setError('')} />}
            <button
              type="submit"
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
              disabled={actionLoading}
            >
              {actionLoading ? <Loader2 className="animate-spin w-5 h-5 mx-auto" /> : 'Confirm Booking'}
            </button>
          </form>
        </Modal>
      </div>
    </div>
  );
};

export default BusDetailsPage;