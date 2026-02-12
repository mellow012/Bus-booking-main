'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { useAuth } from '@/contexts/AuthContext';
import { Booking, Schedule, Bus, Route, Company, PassengerDetails } from '@/types';
import { CheckCircle, XCircle, Loader2, Download } from 'lucide-react';
import AlertMessage from '@/components/AlertMessage';
import jsPDF from 'jspdf';
import 'jspdf-autotable'; // For better table layouts in PDF

// --- Type Definitions for Clarity ---
interface BookingDetails extends Booking {
  schedule: Schedule;
  bus: Bus;
  route: Route;
  company: Company;
}

// Define a more specific type for booking status
type BookingStatus = 'completed' | 'cancelled' | 'pending' | 'confirmed' | 'no-show';

// --- Helper Function for Firebase Data ---
function docData<T>(docSnap: DocumentData): T {
  if (!docSnap.exists()) {
    throw new Error('Document not found');
  }
  return { id: docSnap.id, ...docSnap.data() } as T;
}

export default function BookingRequest() {
  const { bookingId } = useParams() as { bookingId: string };
  const router = useRouter();
  const { userProfile } = useAuth();

  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchBooking = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    setError('');

    try {
      // 1. Fetch the primary booking document
      const bookingDoc = await getDoc(doc(db, 'bookings', bookingId));
      const bookingData = docData<Booking>(bookingDoc);

      // 2. Fetch related documents in parallel for efficiency
      const [scheduleDoc, companyDoc] = await Promise.all([
        getDoc(doc(db, 'schedules', bookingData.scheduleId)),
        getDoc(doc(db, 'companies', bookingData.companyId)),
      ]);

      const scheduleData = docData<Schedule>(scheduleDoc);
      const companyData = docData<Company>(companyDoc);

      // Ensure schedule has the necessary IDs before fetching further
      if (!scheduleData.busId || !scheduleData.routeId) {
        throw new Error('Schedule is missing bus or route information.');
      }

      // 3. Fetch nested related documents
      const [busDoc, routeDoc] = await Promise.all([
        getDoc(doc(db, 'buses', scheduleData.busId)),
        getDoc(doc(db, 'routes', scheduleData.routeId)),
      ]);

      const busData = docData<Bus>(busDoc);
      const routeData = docData<Route>(routeDoc);

      // 4. Assemble the complete booking details object
      setBooking({
        ...bookingData,
        schedule: scheduleData,
        company: companyData,
        bus: busData,
        route: routeData,
      });

    } catch (err: any) {
      console.error("Failed to fetch booking details:", err);
      setError(err.message || 'An unknown error occurred while fetching booking details.');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    // Redirect if user profile is not loaded or user is not a company admin
    if (userProfile && userProfile.role !== 'company_admin') {
      router.push('/unauthorized'); // Redirect to a dedicated unauthorized page
      return;
    }
    // Fetch data only if we have a valid profile
    if (userProfile) {
        fetchBooking();
    }
  }, [bookingId, userProfile, router, fetchBooking]);


  const handleUpdateStatus = async (newStatus: BookingStatus) => {
    if (!booking) return;

    setActionLoading(newStatus);
    setError('');
    setSuccess('');

    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        bookingStatus: newStatus,
        updatedAt: new Date(),
      });
      setBooking(prevBooking => prevBooking ? { ...prevBooking, bookingStatus: newStatus } : null);
      setSuccess(`Booking status successfully updated to ${newStatus}.`);
    } catch (err: any) {
      console.error("Failed to update status:", err);
      setError(`Failed to update status: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadTicket = () => {
    if (!booking) return;

    setActionLoading('download');
    try {
      const pdf = new jsPDF();
      
      // Header
      pdf.setFontSize(20);
      pdf.text(`${booking.company.name} - E-Ticket`, 105, 20, { align: 'center' });
      
      // Booking Info
      pdf.setFontSize(12);
      pdf.text(`Booking ID: ${booking.id.slice(-8)}`, 14, 35);
      pdf.text(`Status: ${booking.bookingStatus.toUpperCase()}`, 14, 42);
      
      // Route Details
      pdf.setFontSize(16);
      pdf.text(`${booking.route.origin} → ${booking.route.destination}`, 14, 60);
      
      pdf.setFontSize(10);
      pdf.text(`Departure: ${new Date(booking.schedule.departureDateTime).toLocaleString()}`, 14, 68);
      pdf.text(`Arrival: ${new Date(booking.schedule.arrivalDateTime).toLocaleString()}`, 14, 75);
      pdf.text(`Bus: ${booking.bus.busType} ${booking.bus.status} (${booking.bus.licensePlate})`, 14, 82);
      
      // Passenger Details Table
      const passengerTableBody = booking.passengerDetails.map(p => [p.name, p.seatNumber]);
      (pdf as any).autoTable({
        startY: 90,
        head: [['Passenger Name', 'Seat Number']],
        body: passengerTableBody,
        theme: 'striped',
      });
      
      // Footer
      const finalY = (pdf as any).lastAutoTable.finalY || 120;
      pdf.setFontSize(10);
      pdf.text(`Total Amount Paid: MWK ${booking.totalAmount.toLocaleString()}`, 14, finalY + 10);
      pdf.text('Thank you for choosing us!', 105, finalY + 20, { align: 'center' });
      
      pdf.save(`Ticket-${booking.id.slice(-8)}.pdf`);
      setSuccess('Ticket downloaded successfully.');

    } catch (err) {
      setError('Failed to generate PDF ticket.');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-red-600">Error</h1>
        <p className="mt-2">{error || 'Booking not found or could not be loaded.'}</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {error && <AlertMessage type="error" message={error} onClose={() => setError('')} />}
      {success && <AlertMessage type="success" message={success} onClose={() => setSuccess('')} />}
      
      <div className="bg-white shadow-lg rounded-lg p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">
          Booking Request #{booking.id.slice(-8)}
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Trip Details</h2>
            <p><strong>Route:</strong> {booking.route.origin} → {booking.route.destination}</p>
            <p><strong>Departure:</strong> {new Date(booking.schedule.departureDateTime).toLocaleString()}</p>
            <p><strong>Bus:</strong> {booking.bus.busType} ({booking.bus.licensePlate})</p>
            <p><strong>Status:</strong> 
              <span className={`px-2 py-1 text-sm font-semibold rounded-full ml-2 ${
                booking.bookingStatus === 'confirmed' ? 'bg-green-100 text-green-800' :
                booking.bookingStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {booking.bookingStatus}
              </span>
            </p>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Payment & Seats</h2>
            <p><strong>Total Amount:</strong> MWK {booking.totalAmount.toLocaleString()}</p>
            <p><strong>Seats Booked:</strong> {booking.seatNumbers.length}</p>
            <p><strong>Seat Numbers:</strong> {booking.seatNumbers.join(', ')}</p>
          </div>
        </div>
        
        <div className="mt-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Passenger Details</h2>
          <ul className="list-disc list-inside">
            {booking.passengerDetails.map((passenger) => (
              <li key={`${passenger.seatNumber}-${passenger.name}`}>
                <strong>{passenger.name}</strong> (Seat {passenger.seatNumber})
              </li>
            ))}
          </ul>
        </div>
        
        <div className="mt-8 pt-4 border-t flex flex-wrap gap-3">
          {booking.bookingStatus === 'pending' && (
            <>
              <button
                onClick={() => handleUpdateStatus('confirmed')}
                disabled={!!actionLoading}
                className="flex items-center justify-center px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-400 transition-colors"
              >
                {actionLoading === 'confirmed' ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle className="mr-2 h-5 w-5" />}
                Confirm Booking
              </button>
              <button
                onClick={() => handleUpdateStatus('cancelled')}
                disabled={!!actionLoading}
                className="flex items-center justify-center px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:bg-gray-400 transition-colors"
              >
                {actionLoading === 'cancelled' ? <Loader2 className="animate-spin mr-2" /> : <XCircle className="mr-2 h-5 w-5" />}
                Cancel Booking
              </button>
            </>
          )}
          <button
            onClick={handleDownloadTicket}
            disabled={!!actionLoading}
            className="flex items-center justify-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 transition-colors"
          >
            {actionLoading === 'download' ? <Loader2 className="animate-spin mr-2" /> : <Download className="mr-2 h-5 w-5" />}
            Download Ticket
          </button>
        </div>
      </div>
    </div>
  );
}