"use client";

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  CheckCircle, 
  Download, 
  Share, 
  Calendar, 
  MapPin, 
  Users, 
  Clock,
  Bus,
  CreditCard,
  Smartphone,
  Building,
  Mail,
  MessageCircle,
  ArrowRight,
  Star,
  Shield
} from 'lucide-react';

export default function BookingConfirmation() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const bookingRef = searchParams.get('bookingRef');
  
  const [booking, setBooking] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [route, setRoute] = useState(null);
  const [bus, setBus] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!bookingRef || !user) {
      router.push('/');
      return;
    }
    fetchBookingDetails();
  }, [bookingRef, user]);

  const fetchBookingDetails = async () => {
    try {
      // Find booking by booking reference
      const bookingsQuery = query(
        collection(db, 'bookings'),
        where('bookingReference', '==', bookingRef),
        where('userId', '==', user.uid)
      );
      
      const querySnapshot = await getDocs(bookingsQuery);
      
      if (querySnapshot.empty) {
        throw new Error('Booking not found');
      }

      const bookingDoc = querySnapshot.docs[0];
      const bookingData = { id: bookingDoc.id, ...bookingDoc.data() };
      setBooking(bookingData);

      // Fetch related data
      const promises = [];
      
      // Fetch schedule
      if (bookingData.scheduleId) {
        promises.push(getDoc(doc(db, 'schedules', bookingData.scheduleId)));
      } else {
        promises.push(Promise.resolve({ exists: () => false }));
      }
      
      // Fetch route
      if (bookingData.routeId) {
        promises.push(getDoc(doc(db, 'routes', bookingData.routeId)));
      } else {
        promises.push(Promise.resolve({ exists: () => false }));
      }
      
      // Fetch bus
      if (bookingData.busId) {
        promises.push(getDoc(doc(db, 'buses', bookingData.busId)));
      } else {
        promises.push(Promise.resolve({ exists: () => false }));
      }
      
      // Fetch company
      if (bookingData.companyId) {
        promises.push(getDoc(doc(db, 'companies', bookingData.companyId)));
      } else {
        promises.push(Promise.resolve({ exists: () => false }));
      }

      const [scheduleDoc, routeDoc, busDoc, companyDoc] = await Promise.all(promises);

      if (scheduleDoc.exists()) {
        const scheduleData = { id: scheduleDoc.id, ...scheduleDoc.data() };
        setSchedule(scheduleData);

        // Get route and bus from schedule if not directly available in booking
        if (!bookingData.routeId && scheduleData.routeId) {
          try {
            const routeDocFromSchedule = await getDoc(doc(db, 'routes', scheduleData.routeId));
            if (routeDocFromSchedule.exists()) {
              setRoute({ id: routeDocFromSchedule.id, ...routeDocFromSchedule.data() });
            }
          } catch (err) {
            console.warn('Could not fetch route from schedule:', err);
          }
        }

        if (!bookingData.busId && scheduleData.busId) {
          try {
            const busDocFromSchedule = await getDoc(doc(db, 'buses', scheduleData.busId));
            if (busDocFromSchedule.exists()) {
              setBus({ id: busDocFromSchedule.id, ...busDocFromSchedule.data() });
            }
          } catch (err) {
            console.warn('Could not fetch bus from schedule:', err);
          }
        }
      }

      if (routeDoc.exists()) {
        setRoute({ id: routeDoc.id, ...routeDoc.data() });
      }

      if (busDoc.exists()) {
        setBus({ id: busDoc.id, ...busDoc.data() });
      }

      if (companyDoc.exists()) {
        setCompany({ id: companyDoc.id, ...companyDoc.data() });
      }

    } catch (error) {
      console.error('Error fetching booking details:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-GB", {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getPaymentMethodIcon = (method) => {
    switch (method) {
      case 'mobile_money': return Smartphone;
      case 'credit_card': return CreditCard;
      case 'bank_transfer': return Building;
      default: return CreditCard;
    }
  };

  const handleDownloadTicket = () => {
    // Implement PDF generation or redirect to ticket download
    console.log('Downloading ticket for booking:', booking.bookingReference);
    // You can integrate with a PDF library or redirect to a ticket generation endpoint
    alert('Ticket download feature will be implemented here');
  };

  const handleShareBooking = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Bus Booking Confirmation',
        text: `My bus booking confirmation: ${booking.bookingReference}`,
        url: window.location.href,
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href).then(() => {
        alert('Booking link copied to clipboard!');
      }).catch(() => {
        alert('Could not copy to clipboard');
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Loading Booking Details</h2>
            <p className="text-gray-600">Please wait while we fetch your booking information...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-red-600 text-2xl">⚠️</span>
            </div>
            <h2 className="text-2xl font-bold text-red-600 mb-4">Booking Not Found</h2>
            <p className="text-gray-600 mb-6">
              {error || 'We couldn\'t find your booking. Please check your booking reference.'}
            </p>
            <div className="space-y-3">
              <Button 
                onClick={() => router.push('/bookings')}
                className="w-full"
              >
                View My Bookings
              </Button>
              <Button 
                variant="outline"
                onClick={() => router.push('/search')}
                className="w-full"
              >
                Search New Journey
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const PaymentMethodIcon = getPaymentMethodIcon(booking.paymentMethod);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Success Header */}
        <Card className="mb-8 shadow-xl border-0 bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-4xl font-bold mb-4">Booking Confirmed!</h1>
            <p className="text-xl text-green-100 mb-6">
              Your bus journey has been successfully booked
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                onClick={handleDownloadTicket}
                className="bg-white text-green-600 hover:bg-green-50 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download E-Ticket
              </Button>
              <Button 
                onClick={handleShareBooking}
                variant="outline"
                className="border-white text-white hover:bg-white/10 flex items-center gap-2"
              >
                <Share className="w-4 h-4" />
                Share Booking
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Booking Details */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Trip Information */}
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bus className="w-5 h-5 text-blue-600" />
                  Journey Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* Route Info */}
                <div className="flex items-center justify-between">
                  <div className="text-center flex-1">
                    <p className="text-2xl font-bold text-gray-900">{formatTime(schedule?.departureDateTime)}</p>
                    <p className="text-gray-600 flex items-center justify-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {route?.origin || 'Origin'}
                    </p>
                  </div>
                  <div className="flex-1 max-w-32 relative">
                    <div className="border-t-2 border-blue-300"></div>
                    <ArrowRight className="w-4 h-4 text-blue-600 absolute -top-2 left-1/2 transform -translate-x-1/2 bg-white" />
                    <p className="text-xs text-gray-500 mt-1 text-center">
                      {route?.duration ? `${Math.floor(route.duration / 60)}h ${route.duration % 60}m` : ''}
                    </p>
                  </div>
                  <div className="text-center flex-1">
                    <p className="text-2xl font-bold text-gray-900">{formatTime(schedule?.arrivalDateTime)}</p>
                    <p className="text-gray-600 flex items-center justify-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {route?.destination || 'Destination'}
                    </p>
                  </div>
                </div>

                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDate(schedule?.departureDateTime)}</span>
                  </div>
                </div>

                <Separator />

                {/* Company & Bus Info */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <span className="text-blue-600 font-bold">{company?.name?.charAt(0) || 'B'}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{company?.name || 'Bus Company'}</p>
                      <p className="text-sm text-gray-600">{bus?.licensePlate} • {bus?.busType}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      <span className="text-sm font-medium">4.5</span>
                    </div>
                    <p className="text-xs text-gray-500">120 reviews</p>
                  </div>
                </div>

                {/* Amenities */}
                {bus?.amenities?.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Bus Amenities</h4>
                    <div className="flex flex-wrap gap-2">
                      {bus.amenities.slice(0, 4).map((amenity, index) => (
                        <Badge key={index} variant="secondary">{amenity}</Badge>
                      ))}
                      {bus.amenities.length > 4 && (
                        <Badge variant="outline">+{bus.amenities.length - 4} more</Badge>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Passenger Information */}
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  Passenger Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {booking.passengerDetails?.map((passenger, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-semibold text-gray-900">{passenger.name}</p>
                        <p className="text-sm text-gray-600">
                          {passenger.age} years • {passenger.gender} • Seat {passenger.seatNumber}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline">Seat {passenger.seatNumber}</Badge>
                      </div>
                    </div>
                  )) || (
                    <p className="text-gray-500">No passenger details available</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Important Information */}
            <Card className="shadow-lg border-0 border-l-4 border-l-orange-500">
              <CardHeader>
                <CardTitle className="text-orange-700">Important Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">Arrive Early</p>
                    <p className="text-sm text-gray-600">Please arrive at the departure point at least 30 minutes before departure time.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">Bring Valid ID</p>
                    <p className="text-sm text-gray-600">A valid government-issued ID is required for boarding.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Download className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">Keep Your Ticket</p>
                    <p className="text-sm text-gray-600">Download and keep your e-ticket for boarding reference.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            
            {/* Booking Summary */}
            <Card className="shadow-lg border-0 sticky top-6">
              <CardHeader>
                <CardTitle>Booking Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Booking Reference:</span>
                    <span className="font-mono font-medium bg-blue-50 px-2 py-1 rounded text-blue-800">
                      {booking.bookingReference}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      {booking.bookingStatus || 'Confirmed'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payment:</span>
                    <div className="flex items-center gap-2">
                      <PaymentMethodIcon className="w-4 h-4" />
                      <Badge variant="outline" className="bg-green-50 border-green-200">
                        {booking.paymentStatus || 'Paid'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Seats:</span>
                    <span className="font-medium">{booking.seatNumbers?.join(', ') || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Passengers:</span>
                    <span className="font-medium">{booking.passengerDetails?.length || 0}</span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal:</span>
                    <span>MWK {booking.totalAmount?.toLocaleString() || '0'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Service Fee:</span>
                    <span>MWK 0</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-2 border-t">
                    <span>Total Paid:</span>
                    <span className="text-green-600">MWK {booking.totalAmount?.toLocaleString() || '0'}</span>
                  </div>
                </div>

                <div className="pt-4 space-y-3">
                  <Button onClick={handleDownloadTicket} className="w-full">
                    <Download className="w-4 h-4 mr-2" />
                    Download E-Ticket
                  </Button>
                  <Button variant="outline" onClick={() => router.push('/bookings')} className="w-full">
                    View All Bookings
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Support Card */}
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="text-lg">Need Help?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">Email Support</p>
                    <p className="text-sm text-gray-600">support@busapp.com</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MessageCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">Live Chat</p>
                    <p className="text-sm text-gray-600">Available 24/7</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full">
                  Contact Support
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}