"use client";

import React from 'react';
import { Map, Clock, Currency, Bus as BusIcon, Armchair, User, Loader2, AlertCircle } from 'lucide-react';
import Modal from '../../../components/Modals';
import AlertMessage from '../../../components/AlertMessage';
import useBusDetails from './useBusDetails';

const BusDetailsPage: React.FC = () => {
  const {
    schedule, loading, error,
    seats, selectedSeats, setSelectedSeats,
    passengerDetails, setPassengerDetails,
    modalOpen, setModalOpen, actionLoading,
    handleSeatSelect, handlePassengerChange, handleBookNow, handleBookingSubmit, setError
  } = useBusDetails();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
      </div>
    );
  }

  // `seats` is provided by the `useBusDetails` hook
  if (error || !schedule) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <AlertMessage type="error" message={error || 'Bus schedule not found'} onClose={() => setError('')} />
        <button onClick={() => (window.location.href = '/')} className="mt-4 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition">
            Go Back
        </button>
      </div>
    );
  }

  // `seats` is provided by the `useBusDetails` hook

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
              <p className="text-sm text-gray-600">{schedule.bus.busType} ({schedule.bus.licensePlate})</p>
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
                  <p>Departs: {((d => d?.toDate?.() ?? new Date(d as any))(schedule.departureDateTime as any)).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-green-600" />
                  <p>Arrives: {((d => d?.toDate?.() ?? new Date(d as any))(schedule.arrivalDateTime as any)).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>
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
                        <div className="sm:col-span-2">
                          <label className="text-sm text-gray-600">First Name</label>
                          <input
                            type="text"
                            value={passengerDetails[index]?.firstName || ''}
                            onChange={e => handlePassengerChange(index, 'firstName', e.target.value)}
                            className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            required
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-sm text-gray-600">Last Name</label>
                          <input
                            type="text"
                            value={passengerDetails[index]?.lastName || ''}
                            onChange={e => handlePassengerChange(index, 'lastName', e.target.value)}
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
          <form onSubmit={(e) => { e.preventDefault(); handleBookingSubmit(); }} className="space-y-4">
            <p className="text-sm text-gray-600">Review your booking details before confirming.</p>
            <div className="text-sm text-gray-600">
              <p className="font-medium">Selected Seats: {selectedSeats.join(', ')}</p>
              <p>Passengers:</p>
              {passengerDetails.map((p, i) => (
                <p key={i} className="ml-2">• {p.firstName} {p.lastName} (Seat: {p.seatNumber}, Age: {p.age}, Gender: {p.gender})</p>
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
