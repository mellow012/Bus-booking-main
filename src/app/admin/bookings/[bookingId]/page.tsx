// src/app/admin/bookings/[bookingId]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { useAuth } from '@/contexts/AuthContext';
import { Booking, Schedule, Bus, Route, Company, PassengerDetail } from '@/types';
import { CheckCircle, XCircle, Loader2, Download } from 'lucide-react';
import AlertMessage from '@/components/AlertMessage';

interface BookingDetails extends Booking {
  schedule: Schedule;
  bus: Bus;
  route: Route;
  company: Company;
}

export default function BookingRequest() {
  const { bookingId } = useParams() as { bookingId: string };
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!userProfile || userProfile.role !== 'company_admin') {
      router.push('/login');
      return;
    }

    fetchBooking();
  }, [bookingId, userProfile, router]);

  const fetchBooking = async () => {
    setLoading(true);
    try {
      const bookingDoc = await getDoc(doc(db, 'bookings', bookingId));
      if (!bookingDoc.exists()) throw new Error('Booking not found');

      const bookingData = { id: bookingDoc.id, ...bookingDoc.data() } as Booking;
      const [scheduleDoc, companyDoc] = await Promise.all([
        getDoc(doc(db, 'schedules', bookingData.scheduleId)),
        getDoc(doc(db, 'companies', bookingData.companyId)),
      ]);

      if (!scheduleDoc.exists() || !companyDoc.exists()) throw new Error('Related data missing');

      const schedule = { id: scheduleDoc.id, ...scheduleDoc.data() } as Schedule;
      const company = { id: companyDoc.id, ...companyDoc.data() } as Company;
      const [busDoc, routeDoc] = await Promise.all([
        getDoc(doc(db, 'buses', schedule.busId)),
        getDoc(doc(db, 'routes', schedule.routeId)),
      ]);

      if (!busDoc.exists() || !routeDoc.exists()) throw new Error('Related data missing');

      const bus = { id: busDoc.id, ...busDoc.data() } as Bus;
      const route = { id: routeDoc.id, ...routeDoc.data() } as Route;

      setBooking({
        ...bookingData,
        schedule,
        bus,
        route,
        company,
      });
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!booking) return;
    setActionLoading(newStatus);
    try {
      await updateDoc(doc(db, 'bookings', bookingId), {
        bookingStatus: newStatus,
        updatedAt: new Date(),
      });
      setBooking({ ...booking, bookingStatus: newStatus });
      setSuccess(`Booking ${newStatus} successfully`);
    } catch (error: any) {
      setError(`Failed to update status: ${error.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadTicket = async () => {
    if (!booking) return;
    setActionLoading('download');
    try {
      const pdf = new jsPDF();
      let yPos = 20;
      pdf.text(`Booking ID: ${booking.id.slice(-8)}`, 20, yPos);
      yPos += 10;
      pdf.text(`Status: ${booking.bookingStatus}`, 20, yPos);
      yPos += 10;
      pdf.text(`Route: ${booking.route.origin} → ${booking.route.destination}`, 20, yPos);
      // Add more details as needed
      pdf.save(`booking_${booking.id.slice(-8)}.pdf`);
      setSuccess('Ticket downloaded');
    } catch (error) {
      setError('Failed to generate ticket');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div className="flex justify-center"><Loader2 className="animate-spin" /></div>;
  if (!booking) return <div>Booking not found</div>;

  return (
    <div className="p-6">
      {error && <AlertMessage type="error" message={error} onClose={() => setError('')} />}
      {success && <AlertMessage type="success" message={success} onClose={() => setSuccess('')} />}
      <h1 className="text-2xl font-bold">Booking Request #{booking.id.slice(-8)}</h1>
      <div className="mt-4">
        <p>Status: {booking.bookingStatus}</p>
        <p>Route: {booking.route.origin} → {booking.route.destination}</p>
        <p>Seats: {booking.seatNumbers.join(', ')}</p>
        <p>Total: MWK {booking.totalAmount.toLocaleString()}</p>
        {booking.passengerDetails.map((p, i) => (
          <div key={i}>
            <p>Passenger {i + 1}: {p.name}, Seat {p.seatNumber}</p>
          </div>
        ))}
        <div className="mt-4">
          {booking.bookingStatus === 'pending' && (
            <>
              <button onClick={() => handleUpdateStatus('confirmed')} disabled={actionLoading === 'confirmed'}>
                <CheckCircle /> Confirm
              </button>
              <button onClick={() => handleUpdateStatus('cancelled')} disabled={actionLoading === 'cancelled'}>
                <XCircle /> Cancel
              </button>
            </>
          )}
          <button onClick={handleDownloadTicket} disabled={actionLoading === 'download'}>
            <Download /> Download Ticket
          </button>
        </div>
      </div>
    </div>
  );
};
