'use client';

import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  orderBy, 
  updateDoc, 
  increment, 
  arrayRemove, 
  Timestamp, 
  writeBatch, 
  onSnapshot,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { useAuth } from '@/contexts/AuthContext';
import { Booking, Schedule, Bus, Route, Company, SearchFilters, UserProfile } from '@/types';
import { 
  Bus as BusIcon, 
  MapPin, 
  Clock, 
  Currency, 
  Download, 
  XCircle, 
  CheckCircle, 
  Loader2, 
  Search, 
  CreditCard, 
  User, 
  Mail, 
  Phone, 
  Armchair, 
  MapIcon,
  Bell,
  AlertTriangle,
  Calendar,
  Users,
  Filter,
  RefreshCw,
  Eye,
  Zap,
  Shield,
  Smartphone,
  Building,
  Star,
  ArrowRight
} from 'lucide-react';
import Modal from '../../components/Modals';
import AlertMessage from '../../components/AlertMessage';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { getAuth } from 'firebase/auth'; // Added for token
import { v4 as uuidv4 } from 'uuid';

interface BookingWithDetails extends Booking {
  schedule: Schedule;
  bus: Bus;
  route: Route;
  company: Company;
}

const BookingsPage: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userProfile } = useAuth();
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<BookingWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [paymentMethodModalOpen, setPaymentMethodModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingWithDetails | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [userDetails, setUserDetails] = useState({
    name: `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim() || '',
    email: userProfile?.email || '',
    phone: userProfile?.phone || '+265',
  });
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const bookingsPerPage = 10;

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (searchParams.get('success') === 'true') {
      setSuccess('Booking confirmed successfully!');
      setTimeout(() => setSuccess(''), 5000);
    }

    const txRef = searchParams.get('tx_ref');
    if (txRef) verifyPaymentStatus(txRef);

    const sessionId = searchParams.get('session_id');
    if (sessionId) verifyStripePayment(sessionId);

    const bookingsQuery = query(
      collection(db, 'bookings'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(bookingsQuery, (snapshot) => {
      const changes = snapshot.docChanges();
      changes.forEach((change) => {
        if (change.type === 'modified') {
          const bookingData = change.doc.data();
          if (bookingData.bookingStatus === 'confirmed' && bookingData.paymentStatus === 'pending') {
            setNotifications((prev) => [
              ...prev,
              `Your booking ${change.doc.id.slice(-8)} has been approved! You can now proceed with payment.`,
            ]);
            setTimeout(() => {
              setNotifications((prev) => prev.filter((n) => !n.includes(change.doc.id.slice(-8))));
            }, 10000);
          }
        }
      });
      fetchBookings();
    });

    fetchBookings();

    return () => unsubscribe();
  }, [user, router, searchParams, userProfile]);

  const fetchBookings = async (retryCount = 0) => {
    if (!user) return;

    setLoading(true);
    setError('');
    try {
      const bookingsQuery = query(
        collection(db, 'bookings'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const bookingsSnapshot = await getDocs(bookingsQuery);

      const bookingsData = bookingsSnapshot.docs.map((doc) => ({
        id: doc.id,
        bookingReference: doc.data().bookingReference || doc.id,
        ...doc.data(),
        bookingDate: doc.data().bookingDate instanceof Timestamp
          ? doc.data().bookingDate.toDate()
          : doc.data().bookingDate
          ? new Date(doc.data().bookingDate)
          : new Date(),
        createdAt: doc.data().createdAt instanceof Timestamp
          ? doc.data().createdAt.toDate()
          : doc.data().createdAt
          ? new Date(doc.data().createdAt)
          : new Date(),
        updatedAt: doc.data().updatedAt instanceof Timestamp
          ? doc.data().updatedAt.toDate()
          : doc.data().updatedAt
          ? new Date(doc.data().updatedAt)
          : new Date(),
      })) as Booking[];

      const bookingsWithDetails: BookingWithDetails[] = [];
      const errors: string[] = [];

      for (const booking of bookingsData) {
        try {
          if (!booking.scheduleId || !booking.companyId) {
            errors.push(`Booking ${booking.id} missing scheduleId or companyId`);
            continue;
          }
          if (!booking.seatNumbers || !booking.passengerDetails) {
            errors.push(`Booking ${booking.id} missing seat or passenger data`);
            continue;
          }

          const [scheduleDoc, companyDoc] = await Promise.all([
            getDoc(doc(db, 'schedules', booking.scheduleId)),
            getDoc(doc(db, 'companies', booking.companyId)),
          ]);

          if (!scheduleDoc.exists() || !companyDoc.exists()) {
            errors.push(`Missing schedule or company for booking ${booking.id}`);
            continue;
          }

          const scheduleData = scheduleDoc.data();
          const companyData = companyDoc.data();

          const schedule = {
            id: scheduleDoc.id,
            ...scheduleData,
            departureDateTime: scheduleData.departureDateTime,
            arrivalDateTime: scheduleData.arrivalDateTime,
          } as Schedule;

          const company = { id: companyDoc.id, ...companyData } as Company;

          if (!schedule.busId || !schedule.routeId) {
            errors.push(`Schedule ${schedule.id} missing busId or routeId`);
            continue;
          }

          const [busDoc, routeDoc] = await Promise.all([
            getDoc(doc(db, 'buses', schedule.busId)),
            getDoc(doc(db, 'routes', schedule.routeId)),
          ]);

          if (!busDoc.exists() || !routeDoc.exists()) {
            errors.push(`Missing bus or route for schedule ${schedule.id}`);
            continue;
          }

          const bus = { id: busDoc.id, ...busDoc.data() } as Bus;
          const route = { id: routeDoc.id, ...routeDoc.data() } as Route;

          bookingsWithDetails.push({
            ...booking,
            schedule,
            bus,
            route,
            company,
          });
        } catch (error) {
          errors.push(`Error fetching details for booking ${booking.id}: ${error}`);
        }
      }

      setBookings(bookingsWithDetails);
      applyFilters(bookingsWithDetails);

      if (bookingsWithDetails.length === 0 && bookingsData.length > 0) {
        setError('Some bookings could not be loaded due to missing data. Please try refreshing or contact support.');
      } else if (errors.length > 0) {
        setError('Some bookings could not be loaded. Please try again or contact support.');
        console.warn('Partial fetch errors:', errors);
      }
    } catch (error: any) {
      if (retryCount < 2) {
        console.warn(`Retrying fetchBookings (attempt ${retryCount + 1})...`);
        setTimeout(() => fetchBookings(retryCount + 1), 1000);
        return;
      }
      setError('Failed to load bookings. Please check your connection and try again.');
      console.error('Fetch bookings error:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (bookingsToFilter: BookingWithDetails[] = bookings) => {
    let filtered = [...bookingsToFilter];

    if (activeFilter !== 'all') {
      switch (activeFilter) {
        case 'confirmed':
          filtered = filtered.filter((b) => b.bookingStatus === 'confirmed' && b.paymentStatus === 'paid');
          break;
        case 'pending':
          filtered = filtered.filter(
            (b) => b.bookingStatus === 'pending' || (b.bookingStatus === 'confirmed' && b.paymentStatus === 'pending')
          );
          break;
        case 'cancelled':
          filtered = filtered.filter((b) => b.bookingStatus === 'cancelled');
          break;
        case 'upcoming':
          const now = new Date();
          filtered = filtered.filter((b) => {
            const departureDate = b.schedule.departureDateTime instanceof Timestamp
              ? b.schedule.departureDateTime.toDate()
              : new Date(b.schedule.departureDateTime);
            return departureDate > now && b.bookingStatus === 'confirmed' && b.paymentStatus === 'paid';
          });
          break;
      }
    }

    if (filters.busType) {
      filtered = filtered.filter((b) => b.bus.busType === filters.busType);
    }

    if (filters.priceRange) {
      filtered = filtered.filter(
        (b) =>
          b.schedule.price >= (filters.priceRange?.min || 0) &&
          b.schedule.price <= (filters.priceRange?.max || Infinity)
      );
    }

    if (filters.company) {
      filtered = filtered.filter((b) => b.company.name === filters.company);
    }

    setFilteredBookings(filtered);
    setCurrentPage(1);
  };

  const handleFilterChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let newFilters = { ...filters };

    if (name === 'priceRangeMin' || name === 'priceRangeMax') {
      newFilters.priceRange = {
        ...newFilters.priceRange,
        [name === 'priceRangeMin' ? 'min' : 'max']: value ? Number(value) : undefined,
      };
    } else {
      newFilters[name] = value || undefined;
    }

    setFilters(newFilters);
    applyFilters();
  };

  const handleStatusFilter = (status: string) => {
    setActiveFilter(status);
    applyFilters();
  };

  const handleCancelBooking = async (bookingId: string, scheduleId: string, seatNumbers: string[]) => {
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) {
      setError('Booking not found');
      return;
    }

    let isCancellationRequest = false;
    if (booking.paymentStatus === 'paid') {
      const confirmCancel = window.confirm(
        'This booking has been paid for. Cancelling may affect your refund eligibility. Continue?'
      );
      if (!confirmCancel) return;
      isCancellationRequest = true;
    }

    setActionLoading(bookingId);
    setError('');

    try {
      const batch = writeBatch(db);

      const bookingUpdates: { [key: string]: any } = {
        updatedAt: serverTimestamp(),
      };

      if (!isCancellationRequest) {
        bookingUpdates.bookingStatus = 'cancelled';
        bookingUpdates.cancellationDate = serverTimestamp();
        bookingUpdates.cancellationReason = 'Customer initiated';
      } else {
        bookingUpdates.cancellationRequested = true;
        bookingUpdates.cancellationReason = 'Customer requested';
      }

      batch.update(doc(db, 'bookings', bookingId), bookingUpdates);

      if (!isCancellationRequest) {
        batch.update(doc(db, 'schedules', scheduleId), {
          availableSeats: increment(seatNumbers.length),
          bookedSeats: arrayRemove(...seatNumbers),
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();

      const successMessage = isCancellationRequest
        ? 'Cancellation requested. An admin will review your request.'
        : 'Booking cancelled successfully. Seats have been released.';
      setSuccess(successMessage);
      setTimeout(() => setSuccess(''), 5000);

      fetchBookings();
    } catch (err: any) {
      console.error('Cancellation error:', err);
      setError(`Failed to cancel booking: ${err.message || 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadTicket = async (booking: BookingWithDetails, includeQR: boolean) => {
    setActionLoading(`download_${booking.id}`);
    try {
      const pdf = new jsPDF();
      let yPos = 30;
      const lineHeight = 8;

      pdf.setFontSize(20);
      pdf.setFont(undefined, 'bold');
      pdf.text('Bus Ticket', 20, 20);

      pdf.setFontSize(12);
      pdf.setFont(undefined, 'normal');

      const addText = (label: string, value: string, x = 20, bold = false) => {
        if (bold) pdf.setFont(undefined, 'bold');
        pdf.text(`${label}: ${value}`, x, yPos);
        if (bold) pdf.setFont(undefined, 'normal');
        yPos += lineHeight;
      };

      addText('Booking Reference', booking.bookingReference || booking.id.slice(-8), 20, true);
      addText('Company', booking.company.name);
      addText('Route', `${booking.route.origin} → ${booking.route.destination}`);
      addText('Date', formatDate(booking.schedule.departureDateTime));
      addText('Departure', formatTime(booking.schedule.departureDateTime));
      addText('Arrival', formatTime(booking.schedule.arrivalDateTime));
      addText('Bus', `${booking.bus.busType} (${booking.bus.licensePlate || 'N/A'})`);
      addText('Seats', booking.seatNumbers.join(', '));

      yPos += 5;
      pdf.text('Passengers:', 20, yPos);
      yPos += lineHeight;

      booking.passengerDetails.forEach((p) => {
        pdf.text(`• ${p.name} (Age: ${p.age}, Seat: ${p.seatNumber})`, 25, yPos);
        yPos += lineHeight;
      });

      yPos += 5;
      addText('Total Amount', `MWK ${booking.totalAmount.toLocaleString()}`, 20, true);
      addText('Payment Status', booking.paymentStatus.charAt(0).toUpperCase() + booking.paymentStatus.slice(1));

      if (includeQR && booking.bookingStatus === 'confirmed' && booking.paymentStatus === 'paid') {
        const qrData = JSON.stringify({
          bookingId: booking.id,
          bookingReference: booking.bookingReference,
          seats: booking.seatNumbers,
          passengers: booking.passengerDetails.length,
          amount: booking.totalAmount,
        });

        const qrCode = await QRCode.toDataURL(qrData, { width: 200 });
        pdf.addImage(qrCode, 'PNG', 140, 30, 50, 50);
        pdf.setFontSize(8);
        pdf.text('Scan for verification', 150, 85);
      }

      pdf.save(`ticket_${booking.bookingReference || booking.id.slice(-8)}.pdf`);
      setSuccess('Ticket downloaded successfully!');
    } catch (error) {
      setError('Failed to generate ticket PDF. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmDetails = (booking: BookingWithDetails) => {
    if (!booking.seatNumbers?.length || !booking.passengerDetails?.length) {
      setError('Invalid booking data. Cannot proceed with payment.');
      return;
    }
    setSelectedBooking(booking);
    setUserDetails({
      name: `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim() || '',
      email: userProfile?.email || '',
      phone: userProfile?.phone || '+265',
    });
    setPaymentMethodModalOpen(true);
  };

  const handlePaymentMethodSelect = (method: string) => {
    setSelectedPaymentMethod(method);
    setPaymentMethodModalOpen(false);
    setConfirmModalOpen(true);
  };

  const handleConfirmSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!userDetails.name || userDetails.name.trim().length < 2) {
      setError('Please provide a valid full name (at least 2 characters)');
      return;
    }
    if (!userDetails.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userDetails.email)) {
      setError('Please provide a valid email address');
      return;
    }
    if (!userDetails.phone || !/^\+?\d{10,15}$/.test(userDetails.phone.replace(/\s/g, ''))) {
      setError('Please provide a valid phone number (10-15 digits)');
      return;
    }
    setConfirmModalOpen(false);
    setPaymentModalOpen(true);
  };

  const generateTxRef = () => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `TX${timestamp}${random}`.toUpperCase();
  };

  const handlePayment = async (e: FormEvent) => {
    e.preventDefault();
    console.log('handlePayment triggered', { selectedBooking, selectedPaymentMethod });

    if (!selectedBooking || !selectedPaymentMethod) {
      setError('Please select a booking and payment method');
      return;
    }

    if (!userDetails.name?.trim() || userDetails.name.trim().length < 2) {
      setError('Please provide a valid full name (at least 2 characters)');
      return;
    }
    if (!userDetails.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userDetails.email)) {
      setError('Please provide a valid email address');
      return;
    }
    if (!userDetails.phone || !/^\+?\d{10,15}$/.test(userDetails.phone.replace(/\s/g, ''))) {
      setError('Please provide a valid phone number (10-15 digits)');
      return;
    }

    setActionLoading(selectedBooking.id);
    setError('');

    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const idToken = await user.getIdToken(); // Fetch Firebase ID token

      if (selectedPaymentMethod === 'card') {
        await handleStripePayment(idToken);
      } else {
        await handlePayChanguPayment(idToken);
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      setError(`Payment failed: ${err.message || 'Unknown error occurred'}`);
    } finally {
      setActionLoading(null);
      setPaymentModalOpen(false);
    }
  };

  const handleStripePayment = async (idToken: string) => {
    const metadata = {
      bookingId: selectedBooking!.id,
      userId: user?.uid || '',
      companyId: selectedBooking!.company.id,
      scheduleId: selectedBooking!.schedule.id,
      routeId: selectedBooking!.route.id,
      seatNumbers: selectedBooking!.seatNumbers.join(','),
      passengerCount: selectedBooking!.passengerDetails.length,
      bookingDate: selectedBooking!.bookingDate.toISOString(),
      departureDate:
        selectedBooking!.schedule.departureDateTime instanceof Timestamp
          ? selectedBooking!.schedule.departureDateTime.toDate().toISOString()
          : new Date(selectedBooking!.schedule.departureDateTime).toISOString(),
      route: `${selectedBooking!.route.origin}-${selectedBooking!.route.destination}`,
    };
    console.log('Creating Stripe checkout session...');

    const response = await fetch('/api/payments/stripe-api/create-checkout-session', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`, // Add Firebase token
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bookingId: selectedBooking!.id,
        amount: selectedBooking!.totalAmount,
        currency: 'usd', // Adjust as needed
        customerDetails: {
          name: userDetails.name.trim(),
          email: userDetails.email.toLowerCase().trim(),
          phone: userDetails.phone.trim(),
        },
        metadata,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to create payment session');
    }

    if (result.success && result.checkoutUrl) {
      console.log('Stripe checkout created successfully, redirecting...');
      window.location.href = result.checkoutUrl;
    } else {
      throw new Error(result.error || 'Invalid payment response');
    }
  };

  const handlePayChanguPayment = async (idToken: string) => {
    const txRef = generateTxRef();
    const bookingTxRef = `${txRef}_${selectedBooking!.id}`;

    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/paychangu-api/callback`;
    const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/bookings`;

    const metadata = {
      bookingId: selectedBooking!.id,
      userId: user?.uid || '',
      companyId: selectedBooking!.company.id,
      scheduleId: selectedBooking!.schedule.id,
      routeId: selectedBooking!.route.id,
      seatNumbers: selectedBooking!.seatNumbers,
      passengerCount: selectedBooking!.passengerDetails.length,
      bookingDate: selectedBooking!.bookingDate.toISOString(),
      departureDate:
        selectedBooking!.schedule.departureDateTime instanceof Timestamp
          ? selectedBooking!.schedule.departureDateTime.toDate().toISOString()
          : new Date(selectedBooking!.schedule.departureDateTime).toISOString(),
      route: `${selectedBooking!.route.origin}-${selectedBooking!.route.destination}`,
    };

    console.log('Payment initiation data:', {
      bookingId: selectedBooking!.id,
      txRef: bookingTxRef,
      amount: selectedBooking!.totalAmount,
      paymentMethod: selectedPaymentMethod,
    });

    await updateDoc(doc(db, 'bookings', selectedBooking!.id), {
      paymentStatus: 'processing',
      transactionReference: bookingTxRef,
      updatedAt: serverTimestamp(),
      paymentProvider: 'paychangu',
      paymentMethod: selectedPaymentMethod,
      paymentInitiatedAt: serverTimestamp(),
      metadata,
      customerDetails: {
        name: userDetails.name.trim(),
        email: userDetails.email.toLowerCase().trim(),
        phone: userDetails.phone.trim(),
      },
    });

    const paymentPayload = {
      amount: selectedBooking!.totalAmount,
      currency: 'MWK',
      email: userDetails.email.toLowerCase().trim(),
      first_name: userDetails.name.split(' ')[0] || 'Customer',
      last_name: userDetails.name.split(' ').slice(1).join(' ') || 'Name',
      phone_number: userDetails.phone.trim(),
      tx_ref: bookingTxRef,
      description: `Bus Booking - ${selectedBooking!.passengerDetails.length} passenger(s) - ${selectedBooking!.route.origin} to ${selectedBooking!.route.destination}`,
      callback_url: callbackUrl,
      return_url: returnUrl,
      payment_type: selectedPaymentMethod,
      metadata,
    };

    console.log('Sending payment initiation request...', {
      ...paymentPayload,
      email: '***masked***',
      phone_number: '***masked***',
    });

    const response = await fetch('/api/payments/paychangu-api/payment', { // Corrected endpoint
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`, // Add Firebase token
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(paymentPayload),
    });

    const responseText = await response.text();
    console.log('Raw server response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseText || '<empty>',
    });

    if (!response.ok) {
      let errorMessage = 'Payment initiation failed';
      try {
        const errorData = JSON.parse(responseText || '{}');
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch (e) {
        errorMessage = `Server returned invalid JSON (${response.status}): ${responseText || 'No response body'}`;
      }
      throw new Error(errorMessage);
    }

    let result;
    try {
      result = JSON.parse(responseText);
      if (!result || typeof result !== 'object') {
        throw new Error('Invalid response structure');
      }
    } catch (parseError) {
      console.error('Error parsing response:', parseError, 'Raw response:', responseText);
      throw new Error('Invalid JSON response from server');
    }

    console.log('Parsed Server Response:', result);

    if (result.success && result.checkoutUrl) {
      console.log('Payment initiated successfully, redirecting to:', result.checkoutUrl);

      await updateDoc(doc(db, 'bookings', selectedBooking!.id), {
        checkoutUrl: result.checkoutUrl,
        paymentId: result.paymentId || bookingTxRef,
        paymentStatus: 'redirected',
        updatedAt: serverTimestamp(),
      });

      setPaymentModalOpen(false);

      const checkoutWindow = window.open(
        result.checkoutUrl,
        'paychangu_checkout',
        'width=600,height=800,scrollbars=yes,resizable=yes,status=yes'
      );

      if (!checkoutWindow) {
        throw new Error('Payment window was blocked. Please allow popups and try again.');
      }

      setSuccess('Redirecting to payment gateway... Complete your payment in the new window.');

      const unsubscribe = onSnapshot(doc(db, 'bookings', selectedBooking!.id), (docSnap) => {
        const data = docSnap.data();
        if (!data) return;

        if (data.paymentStatus === 'paid') {
          unsubscribe();
          setSuccess('Payment completed successfully!');
          fetchBookings();
          if (checkoutWindow && !checkoutWindow.closed) checkoutWindow.close();
          router.push(`/bookings?success=true&tx_ref=${bookingTxRef}`);
        } else if (data.paymentStatus === 'failed') {
          unsubscribe();
          setError('Payment failed. Please try again.');
          if (checkoutWindow && !checkoutWindow.closed) checkoutWindow.close();
        } else if (checkoutWindow.closed) {
          unsubscribe();
          setError('Payment window was closed. If you completed the payment, it may take a few minutes to reflect.');
          setTimeout(() => verifyPaymentStatus(bookingTxRef), 3000);
        }
      }, (error) => {
        console.error('onSnapshot error:', error);
        setError('Error monitoring payment status. Please try again.');
      });

      const timeoutId = setTimeout(() => {
        unsubscribe();
        setError('Payment status check timed out. Please refresh or contact support.');
        if (checkoutWindow && !checkoutWindow.closed) checkoutWindow.close();
      }, 15 * 60 * 1000);

      return () => {
        clearTimeout(timeoutId);
        unsubscribe();
      };
    } else {
      throw new Error(result.error || `Invalid payment response: ${JSON.stringify(result)}`);
    }
  };

  const verifyPaymentStatus = async (txRef: string) => {
    console.log('Verifying payment status for:', txRef);
    setActionLoading(`verify_${txRef}`);

    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const idToken = await user.getIdToken(); // Fetch Firebase ID token

      const response = await fetch(`/api/payments/paychangu-api/verify?tx_ref=${encodeURIComponent(txRef)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`, // Add Firebase token
          'Accept': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Verification failed');
      }

      console.log('Payment verification result:', result);

      if (result.success && result.data?.data) {
        const paymentData = result.data.data;
        const [_, bookingId] = txRef.split('_');

        if (!bookingId) {
          throw new Error('Invalid transaction reference format');
        }

        const bookingRef = doc(db, 'bookings', bookingId);
        const bookingDoc = await getDoc(bookingRef);

        if (!bookingDoc.exists()) {
          throw new Error('Booking not found');
        }

        const currentStatus = bookingDoc.data()?.paymentStatus;
        let newStatus: string;

        switch (paymentData.status.toLowerCase()) {
          case 'success':
          case 'completed':
            newStatus = 'paid';
            if (currentStatus !== 'paid') {
              await updateDoc(bookingRef, {
                paymentStatus: newStatus,
                transactionId: paymentData.transaction_id || txRef,
                paymentConfirmedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });

              const scheduleRef = doc(db, 'schedules', bookingDoc.data()?.scheduleId);
              await updateDoc(scheduleRef, {
                availableSeats: increment(-bookingDoc.data()?.seatNumbers.length),
                bookedSeats: arrayUnion(...bookingDoc.data()?.seatNumbers),
                updatedAt: serverTimestamp(),
              });

              setSuccess('Payment verified and confirmed successfully!');
              fetchBookings();
            } else {
              setSuccess('Payment already confirmed.');
            }
            break;
          case 'failed':
          case 'cancelled':
            newStatus = 'failed';
            if (currentStatus !== 'failed') {
              await updateDoc(bookingRef, {
                paymentStatus: newStatus,
                paymentFailureReason: paymentData.reason || 'Payment failed',
                updatedAt: serverTimestamp(),
              });
              setError('Payment verification failed. Please try again or contact support.');
            } else {
              setError('Payment already marked as failed.');
            }
            break;
          default:
            setError('Payment status unclear. Please contact support with your transaction reference.');
            return;
        }
      } else {
        throw new Error('Invalid verification response');
      }
    } catch (error: any) {
      console.error('Payment verification error:', error);
      setError(`Failed to verify payment status: ${error.message || 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const verifyStripePayment = async (sessionId: string) => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const idToken = await user.getIdToken(); // Fetch Firebase ID token

      const response = await fetch(`/api/payments/stripe-api/verify?session_id=${sessionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`, // Add Firebase token
          'Accept': 'application/json',
        },
      });
      const result = await response.json();

      if (result.success) {
        setSuccess('Payment completed successfully!');
        fetchBookings();
      } else {
        setError('Payment verification failed');
      }
    } catch (error) {
      console.error('Stripe payment verification error:', error);
      setError('Failed to verify payment');
    }
  };

  const formatTime = (dateTime: Date | Timestamp | string | any) => {
    let date: Date;

    if (dateTime instanceof Date) {
      date = dateTime;
    } else if (dateTime && typeof dateTime === 'object' && 'toDate' in dateTime) {
      date = dateTime.toDate();
    } else if (dateTime && typeof dateTime === 'object' && 'seconds' in dateTime) {
      date = new Date(dateTime.seconds * 1000);
    } else if (typeof dateTime === 'string') {
      date = new Date(dateTime);
    } else {
      return 'Invalid Time';
    }

    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateTime: Date | Timestamp | string | any) => {
    let date: Date;

    if (dateTime instanceof Date) {
      date = dateTime;
    } else if (dateTime && typeof dateTime === 'object' && 'toDate' in dateTime) {
      date = dateTime.toDate();
    } else if (dateTime && typeof dateTime === 'object' && 'seconds' in dateTime) {
      date = new Date(dateTime.seconds * 1000);
    } else if (typeof dateTime === 'string') {
      date = new Date(dateTime);
    } else {
      return 'Invalid Date';
    }

    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'pending':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'pending':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'mobile_money':
        return { Icon: Smartphone, label: 'Mobile Money', description: 'Airtel Money, TNM Mpamba' };
      case 'card':
      case 'credit_card':
        return { Icon: CreditCard, label: 'Credit/Debit Card', description: 'Visa, Mastercard' };
      case 'bank_transfer':
        return { Icon: Building, label: 'Bank Transfer', description: 'Direct bank transfer' };
      default:
        return { Icon: CreditCard, label: 'Card Payment', description: 'Secure payment' };
    }
  };

  const getBookingStats = () => {
    const all = bookings.length;
    const confirmed = bookings.filter((b) => b.bookingStatus === 'confirmed' && b.paymentStatus === 'paid').length;
    const pending = bookings.filter(
      (b) => b.bookingStatus === 'pending' || (b.bookingStatus === 'confirmed' && b.paymentStatus === 'pending')
    ).length;
    const cancelled = bookings.filter((b) => b.bookingStatus === 'cancelled').length;
    const upcoming = bookings.filter((b) => {
      const departureDate = b.schedule.departureDateTime instanceof Timestamp
        ? b.schedule.departureDateTime.toDate()
        : new Date(b.schedule.departureDateTime);
      return departureDate > new Date() && b.bookingStatus === 'confirmed' && b.paymentStatus === 'paid';
    }).length;

    return { all, confirmed, pending, cancelled, upcoming };
  };

  const stats = getBookingStats();
  const paginatedBookings = filteredBookings.slice(
    (currentPage - 1) * bookingsPerPage,
    currentPage * bookingsPerPage
  );
  const totalPages = Math.ceil(filteredBookings.length / bookingsPerPage);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-6">
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="bg-gray-100 rounded-xl p-4">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            </div>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm p-6">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  <div className="lg:col-span-2 space-y-4">
                    <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-full"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-8 bg-gray-200 rounded w-full"></div>
                    <div className="h-8 bg-gray-200 rounded w-full"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {notifications.length > 0 && (
          <div className="fixed top-4 right-4 z-50 space-y-2">
            {notifications.map((notification, index) => (
              <div
                key={index}
                className="bg-emerald-500 text-white p-4 rounded-lg shadow-lg max-w-sm flex items-start gap-3 animate-in slide-in-from-right duration-300"
              >
                <Bell className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">Booking Approved!</p>
                  <p className="text-xs opacity-90 mt-1">{notification}</p>
                </div>
                <button
                  onClick={() => setNotifications((prev) => prev.filter((_, i) => i !== index))}
                  className="ml-auto text-white/80 hover:text-white"
                  aria-label="Close notification"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {success && <div className="mb-6"><AlertMessage type="success" message={success} onClose={() => setSuccess('')} /></div>}
        {error && <div className="mb-6"><AlertMessage type="error" message={error} onClose={() => setError('')} /></div>}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">My Bookings</h1>
              <p className="text-gray-600">Manage and track your bus ticket bookings</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => fetchBookings()}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                aria-label="Refresh bookings"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={() => router.push('/search')}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:scale-105 shadow-lg"
                aria-label="Book new ticket"
              >
                <Search className="w-4 h-4" />
                Book New Ticket
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
            {[
              { label: 'All Bookings', value: stats.all, key: 'all', icon: BusIcon, color: 'bg-gray-50 text-gray-700' },
              { label: 'Confirmed', value: stats.confirmed, key: 'confirmed', icon: CheckCircle, color: 'bg-emerald-50 text-emerald-700' },
              { label: 'Pending', value: stats.pending, key: 'pending', icon: Clock, color: 'bg-amber-50 text-amber-700' },
              { label: 'Cancelled', value: stats.cancelled, key: 'cancelled', icon: XCircle, color: 'bg-red-50 text-red-700' },
              { label: 'Upcoming', value: stats.upcoming, key: 'upcoming', icon: Calendar, color: 'bg-blue-50 text-blue-700' },
            ].map(({ label, value, key, icon: Icon, color }) => (
              <button
                key={key}
                onClick={() => handleStatusFilter(key)}
                className={`p-4 rounded-xl transition-all transform hover:scale-105 border-2 ${
                  activeFilter === key
                    ? 'border-blue-200 bg-blue-50 shadow-md'
                    : 'border-transparent bg-white hover:border-gray-200 shadow-sm'
                }`}
                aria-label={`Filter by ${label}`}
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Icon className="w-5 h-5 text-gray-600" />
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{value}</p>
                  <p className="text-sm text-gray-600 mt-1">{label}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              aria-label={showFilters ? 'Hide filters' : 'Show filters'}
            >
              <Filter className="w-4 h-4" />
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </button>
            <p className="text-sm text-gray-600">Showing {filteredBookings.length} of {bookings.length} bookings</p>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bus Type</label>
                <select
                  name="busType"
                  value={filters.busType || ''}
                  onChange={handleFilterChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  aria-label="Select bus type"
                >
                  <option value="">All Types</option>
                  <option value="AC">AC</option>
                  <option value="Non-AC">Non-AC</option>
                  <option value="Sleeper">Sleeper</option>
                  <option value="Semi-Sleeper">Semi-Sleeper</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
                <select
                  name="company"
                  value={filters.company || ''}
                  onChange={handleFilterChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  aria-label="Select company"
                >
                  <option value="">All Companies</option>
                  {[...new Set(bookings.map((b) => b.company.name))].map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Price Range</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    name="priceRangeMin"
                    placeholder="Min"
                    value={filters.priceRange?.min || ''}
                    onChange={handleFilterChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    aria-label="Minimum price"
                  />
                  <input
                    type="number"
                    name="priceRangeMax"
                    placeholder="Max"
                    value={filters.priceRange?.max || ''}
                    onChange={handleFilterChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    aria-label="Maximum price"
                  />
                </div>
              </div>
              <div className="md:col-span-3">
                <button
                  onClick={() => {
                    setFilters({});
                    setActiveFilter('all');
                    applyFilters(bookings);
                  }}
                  className="w-full md:w-auto px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                  aria-label="Clear all filters"
                >
                  <XCircle className="w-4 h-4" />
                  Clear Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {filteredBookings.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
              {activeFilter === 'all' ? (
                <BusIcon className="w-10 h-10 text-gray-400" />
              ) : activeFilter === 'confirmed' ? (
                <CheckCircle className="w-10 h-10 text-gray-400" />
              ) : activeFilter === 'pending' ? (
                <Clock className="w-10 h-10 text-gray-400" />
              ) : activeFilter === 'cancelled' ? (
                <XCircle className="w-10 h-10 text-gray-400" />
              ) : (
                <Calendar className="w-10 h-10 text-gray-400" />
              )}
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No {activeFilter === 'all' ? '' : activeFilter} bookings found
            </h3>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              {activeFilter === 'all'
                ? 'You haven’t made any bus bookings yet. Start planning your journey!'
                : `You don’t have any ${activeFilter} bookings at the moment.`}
            </p>
            <button
              onClick={() => router.push('/search')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:scale-105 shadow-lg"
              aria-label="Search for buses"
            >
              <Search className="w-5 h-5" />
              Search for Buses
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {paginatedBookings.map((booking) => (
              <div
                key={booking.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all duration-300 group"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                        <span className="text-white font-bold text-lg">{booking.company.name.charAt(0)}</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{booking.company.name}</h3>
                        <p className="text-sm text-gray-600">Booking: {booking.bookingReference || booking.id.slice(-8)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(booking.bookingStatus)}`}>
                        {booking.bookingStatus.charAt(0).toUpperCase() + booking.bookingStatus.slice(1)}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPaymentStatusColor(booking.paymentStatus)}`}>
                        {booking.paymentStatus.charAt(0).toUpperCase() + booking.paymentStatus.slice(1)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <div className="lg:col-span-2">
                      <div className="flex items-center justify-between mb-6 p-4 bg-gray-50 rounded-xl">
                        <div className="text-center">
                          <div className="text-xl font-bold text-gray-900">{formatTime(booking.schedule.departureDateTime)}</div>
                          <div className="text-sm text-gray-600 flex items-center justify-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {booking.route.origin}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">{formatDate(booking.schedule.departureDateTime)}</div>
                        </div>
                        <div className="flex-1 mx-6">
                          <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                              <div className="w-full border-t-2 border-dashed border-gray-300"></div>
                            </div>
                            <div className="relative flex justify-center">
                              <div className="bg-white px-3 py-1 rounded-full border border-gray-200">
                                <BusIcon className="w-4 h-4 text-gray-500" />
                              </div>
                            </div>
                          </div>
                          <div className="text-center mt-2">
                            <span className="text-xs text-gray-500">{Math.round(booking.route.duration / 60)}h {booking.route.duration % 60}m</span>
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xl font-bold text-gray-900">{formatTime(booking.schedule.arrivalDateTime)}</div>
                          <div className="text-sm text-gray-600 flex items-center justify-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {booking.route.destination}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">{formatDate(booking.schedule.arrivalDateTime)}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <BusIcon className="w-4 h-4 text-gray-400" />
                          <span>{booking.bus.busType} • {booking.bus.licensePlate || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-gray-400" />
                          <span>{booking.passengerDetails.length} passenger{booking.passengerDetails.length > 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Armchair className="w-4 h-4 text-gray-400" />
                          <span>Seats: {booking.seatNumbers.join(', ')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span>Booked: {formatDate(booking.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-4">
                      <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Passengers
                      </h4>
                      <div className="space-y-2">
                        {booking.passengerDetails.map((passenger, index) => (
                          <div key={index} className="text-sm">
                            <p className="font-medium text-gray-800">{passenger.name}</p>
                            <p className="text-gray-600">Age: {passenger.age} • {passenger.gender} • Seat: {passenger.seatNumber}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col justify-between">
                      <div className="mb-4">
                        <div className="text-right mb-2">
                          <div className="text-2xl font-bold text-gray-900">MWK {booking.totalAmount.toLocaleString()}</div>
                          <div className="text-sm text-gray-600">Total Amount</div>
                        </div>

                        {booking.paymentProvider && (
                          <div className="text-right text-xs text-gray-500">
                            via {booking.paymentProvider}
                            {booking.transactionReference && <div>Ref: {booking.transactionReference}</div>}
                          </div>
                        )}

                        {booking.paymentMethod && (
                          <div className="text-right text-xs text-gray-500 mt-1">{getPaymentMethodIcon(booking.paymentMethod).label}</div>
                        )}
                      </div>

                      <div className="space-y-2">
                        {booking.bookingStatus === 'confirmed' && booking.paymentStatus === 'pending' && (
                          <button
                            onClick={() => handleConfirmDetails(booking)}
                            disabled={actionLoading === booking.id}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-all transform hover:scale-105 shadow-lg animate-pulse"
                            aria-label={`Pay for booking ${booking.bookingReference || booking.id.slice(-8)}`}
                          >
                            {actionLoading === booking.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Zap className="w-4 h-4" />
                                <span className="font-medium">Pay Now</span>
                              </>
                            )}
                          </button>
                        )}

                        {booking.bookingStatus === 'confirmed' && booking.paymentStatus === 'paid' && (
                          <>
                            <button
                              onClick={() => handleDownloadTicket(booking, true)}
                              disabled={actionLoading === `download_${booking.id}`}
                              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200"
                              aria-label={`Download ticket with QR for booking ${booking.bookingReference || booking.id.slice(-8)}`}
                            >
                              {actionLoading === `download_${booking.id}` ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Download className="w-4 h-4" />
                                  <span>Ticket + QR</span>
                                </>
                              )}
                            </button>

                            <button
                              onClick={() => handleDownloadTicket(booking, false)}
                              disabled={actionLoading === `download_${booking.id}`}
                              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
                              aria-label={`Download ticket without QR for booking ${booking.bookingReference || booking.id.slice(-8)}`}
                            >
                              <Download className="w-4 h-4" />
                              <span>Ticket Only</span>
                            </button>
                          </>
                        )}

                        {(booking.bookingStatus === 'pending' ||
                          (booking.bookingStatus === 'confirmed' && booking.paymentStatus === 'pending')) && (
                          <button
                            onClick={() => handleCancelBooking(booking.id, booking.scheduleId, booking.seatNumbers)}
                            disabled={actionLoading === booking.id}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors border border-red-200"
                            aria-label={`Cancel booking ${booking.bookingReference || booking.id.slice(-8)}`}
                          >
                            {actionLoading === booking.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <XCircle className="w-4 h-4" />
                                <span>Cancel</span>
                              </>
                            )}
                          </button>
                        )}

                        {booking.bookingStatus === 'confirmed' && booking.paymentStatus === 'paid' && (
                          <button
                            onClick={() => handleCancelBooking(booking.id, booking.scheduleId, booking.seatNumbers)}
                            disabled={actionLoading === booking.id}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors border border-amber-200"
                            aria-label={`Request refund for booking ${booking.bookingReference || booking.id.slice(-8)}`}
                          >
                            {actionLoading === booking.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <AlertTriangle className="w-4 h-4" />
                                <span>Request Refund</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {booking.bookingStatus === 'confirmed' && booking.paymentStatus === 'pending' && (
                  <div className="bg-gradient-to-r from-emerald-50 to-blue-50 border-t border-emerald-200 p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-emerald-800">Booking Approved - Payment Required</p>
                        <p className="text-xs text-emerald-700">
                          Your booking has been confirmed by the admin. Complete payment to secure your seats.
                        </p>
                      </div>
                      <div className="ml-auto">
                        <Shield className="w-5 h-5 text-emerald-600" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {filteredBookings.length > bookingsPerPage && (
              <div className="flex items-center justify-between mt-6">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors"
                  aria-label="Previous page"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">Page {currentPage} of {totalPages}</span>
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors"
                  aria-label="Next page"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        <Modal isOpen={paymentMethodModalOpen} onClose={() => setPaymentMethodModalOpen(false)} title="Choose Payment Method">
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                Secure Payment Options
              </h3>
              {selectedBooking && (
                <div className="space-y-1 text-sm text-blue-700">
                  <p><strong>Route:</strong> {selectedBooking.route.origin} → {selectedBooking.route.destination}</p>
                  <p><strong>Amount:</strong> MWK {selectedBooking.totalAmount.toLocaleString()}</p>
                  <p><strong>Passengers:</strong> {selectedBooking.passengerDetails.length}</p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <button
                onClick={() => handlePaymentMethodSelect('mobile_money')}
                className="w-full flex items-center justify-between p-4 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-all border-2 border-emerald-200 group hover:shadow-md transform hover:-translate-y-0.5"
                aria-label="Select mobile money payment"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-lg">Mobile Money</p>
                    <p className="text-sm text-emerald-600">Airtel Money, TNM Mpamba</p>
                    <p className="text-xs text-emerald-500 mt-1">Fast & Secure • Instant confirmation</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex space-x-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3 h-3 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <ArrowRight className="w-5 h-5 text-emerald-500 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>

              <button
                onClick={() => handlePaymentMethodSelect('card')}
                className="w-full flex items-center justify-between p-4 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-all border-2 border-blue-200 group hover:shadow-md transform hover:-translate-y-0.5"
                aria-label="Select credit or debit card payment"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-lg">Credit/Debit Card</p>
                    <p className="text-sm text-blue-600">Visa, Mastercard, American Express</p>
                    <p className="text-xs text-blue-500 mt-1">Secure encryption • International cards accepted</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex space-x-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3 h-3 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <ArrowRight className="w-5 h-5 text-blue-500 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>

              <button
                onClick={() => handlePaymentMethodSelect('bank_transfer')}
                className="w-full flex items-center justify-between p-4 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-all border-2 border-purple-200 group hover:shadow-md transform hover:-translate-y-0.5"
                aria-label="Select bank transfer payment"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                    <Building className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-lg">Bank Transfer</p>
                    <p className="text-sm text-purple-600">Direct bank transfer</p>
                    <p className="text-xs text-purple-500 mt-1">Secure • Processing may take 1-3 business days</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex space-x-1">
                    {[...Array(4)].map((_, i) => (
                      <Star key={i} className="w-3 h-3 text-yellow-400 fill-current" />
                    ))}
                    <Star className="w-3 h-3 text-gray-300" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-purple-500 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-gray-600">
                  <p className="font-medium mb-1">Your payment is protected</p>
                  <p>All transactions are encrypted and processed through secure payment gateways. Your financial information is never stored on our servers.</p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setPaymentMethodModalOpen(false)}
              className="w-full px-4 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              aria-label="Cancel payment method selection"
            >
              Cancel
            </button>
          </div>
        </Modal>

        <Modal isOpen={confirmModalOpen} onClose={() => setConfirmModalOpen(false)} title="Confirm Payment Details">
          <form onSubmit={handleConfirmSubmit} className="space-y-6">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-blue-600" />
                <p className="font-semibold text-blue-800">Booking Approved - Complete Payment</p>
              </div>
              {selectedBooking && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-blue-600">Route:</span>
                      <span className="font-medium text-blue-800">{selectedBooking.route.origin} → {selectedBooking.route.destination}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-600">Date:</span>
                      <span className="font-medium text-blue-800">{formatDate(selectedBooking.schedule.departureDateTime)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-600">Time:</span>
                      <span className="font-medium text-blue-800">{formatTime(selectedBooking.schedule.departureDateTime)}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-blue-600">Seats:</span>
                      <span className="font-medium text-blue-800">{selectedBooking.seatNumbers.join(', ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-600">Passengers:</span>
                      <span className="font-medium text-blue-800">{selectedBooking.passengerDetails.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-600">Payment:</span>
                      <span className="font-medium text-blue-800 flex items-center gap-1">
                        {selectedPaymentMethod && (() => {
                          const { Icon, label } = getPaymentMethodIcon(selectedPaymentMethod);
                          return (
                            <>
                              <Icon className="w-3 h-3" />
                              {label}
                            </>
                          );
                        })()}
                      </span>
                    </div>
                  </div>
                  <div className="md:col-span-2 border-t pt-3 mt-3">
                    <div className="flex justify-between text-lg font-bold">
                      <span className="text-blue-800">Total Amount:</span>
                      <span className="text-blue-600">MWK {selectedBooking.totalAmount.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <User className="w-4 h-4 inline mr-2" />
                  Full Name
                </label>
                <input
                  type="text"
                  value={userDetails.name}
                  onChange={(e) => setUserDetails({ ...userDetails, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  required
                  placeholder="Enter your full name"
                  aria-label="Full name"
                />
                <p className="text-xs text-gray-500 mt-1">Name as it appears on your ID</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Mail className="w-4 h-4 inline mr-2" />
                  Email Address
                </label>
                <input
                  type="email"
                  value={userDetails.email}
                  onChange={(e) => setUserDetails({ ...userDetails, email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  required
                  placeholder="your@email.com"
                  aria-label="Email address"
                />
                <p className="text-xs text-gray-500 mt-1">We’ll send your payment confirmation here</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Phone className="w-4 h-4 inline mr-2" />
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={userDetails.phone}
                  onChange={(e) => setUserDetails({ ...userDetails, phone: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  required
                  placeholder="+265 999 123 456"
                  aria-label="Phone number"
                />
                <p className="text-xs text-gray-500 mt-1">For payment verification and support</p>
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="px-6 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                aria-label="Cancel payment confirmation"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading === selectedBooking?.id}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-all transform hover:scale-105 shadow-lg"
                aria-label="Confirm payment details"
              >
                {actionLoading === selectedBooking?.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>Confirm & Pay</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>

        <Modal isOpen={paymentModalOpen} onClose={() => setPaymentModalOpen(false)} title="Complete Your Payment">
          <form onSubmit={handlePayment} className="space-y-6">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-5 h-5 text-blue-600" />
                <p className="font-semibold text-blue-800">Secure Payment</p>
              </div>
              {selectedBooking && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-blue-600">Route:</span>
                      <span className="font-medium text-blue-800">{selectedBooking.route.origin} → {selectedBooking.route.destination}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-600">Date:</span>
                      <span className="font-medium text-blue-800">{formatDate(selectedBooking.schedule.departureDateTime)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-600">Time:</span>
                      <span className="font-medium text-blue-800">{formatTime(selectedBooking.schedule.departureDateTime)}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-blue-600">Seats:</span>
                      <span className="font-medium text-blue-800">{selectedBooking.seatNumbers.join(', ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-600">Passengers:</span>
                      <span className="font-medium text-blue-800">{selectedBooking.passengerDetails.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-600">Method:</span>
                      <span className="font-medium text-blue-800 flex items-center gap-1">
                        {selectedPaymentMethod && (() => {
                          const { Icon, label } = getPaymentMethodIcon(selectedPaymentMethod);
                          return (
                            <>
                              <Icon className="w-3 h-3" />
                              {label}
                            </>
                          );
                        })()}
                      </span>
                    </div>
                  </div>
                  <div className="md:col-span-2 border-t pt-3 mt-3">
                    <div className="flex justify-between text-lg font-bold">
                      <span className="text-blue-800">Total Amount:</span>
                      <span className="text-blue-600">MWK {selectedBooking.totalAmount.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <User className="w-4 h-4 inline mr-2" />
                  Full Name
                </label>
                <input
                  type="text"
                  value={userDetails.name}
                  onChange={(e) => setUserDetails({ ...userDetails, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  required
                  placeholder="Enter your full name"
                  aria-label="Full name"
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Mail className="w-4 h-4 inline mr-2" />
                  Email Address
                </label>
                <input
                  type="email"
                  value={userDetails.email}
                  onChange={(e) => setUserDetails({ ...userDetails, email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  required
                  placeholder="your@email.com"
                  aria-label="Email address"
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Phone className="w-4 h-4 inline mr-2" />
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={userDetails.phone}
                  onChange={(e) => setUserDetails({ ...userDetails, phone: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  required
                  placeholder="+265 999 123 456"
                  aria-label="Phone number"
                  disabled
                />
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="px-6 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                aria-label="Cancel payment"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading === selectedBooking?.id}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-all transform hover:scale-105 shadow-lg"
                aria-label="Complete payment"
              >
                {actionLoading === selectedBooking?.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Currency className="w-4 h-4" />
                    <span>Pay Now</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  );
};

export default BookingsPage;