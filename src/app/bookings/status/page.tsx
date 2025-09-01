"use client";

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  CreditCard, 
  Smartphone, 
  Building,
  ArrowRight,
  Download,
  MessageCircle
} from 'lucide-react';

export default function PaymentStatus() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const txRef = searchParams.get('tx_ref');
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    if (!txRef) {
      router.push('/');
      return;
    }

    let countdownInterval;

    const unsubscribe = onSnapshot(
      doc(db, 'bookings', txRef),
      (doc) => {
        if (doc.exists()) {
          const bookingData = doc.data();
          setBooking(bookingData);
          setLoading(false);

          // Redirect based on status
          if (bookingData.paymentStatus === 'completed') {
            clearInterval(countdownInterval);
            setTimeout(() => {
              router.push(`/bookings/confirmed?bookingRef=${bookingData.bookingReference}`);
            }, 3000);
          } else if (bookingData.paymentStatus === 'failed') {
            clearInterval(countdownInterval);
            // Don't auto-redirect on failure, let user decide
          }
        } else {
          setLoading(false);
        }
      },
      (error) => {
        console.error('Error listening to booking updates:', error);
        setLoading(false);
      }
    );

    // Countdown for pending payments
    countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      unsubscribe();
      if (countdownInterval) clearInterval(countdownInterval);
    };
  }, [txRef, router]);

  const getPaymentMethodIcon = (method) => {
    switch (method) {
      case 'mobile_money': return Smartphone;
      case 'credit_card': return CreditCard;
      case 'bank_transfer': return Building;
      default: return CreditCard;
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Checking Payment Status</h2>
            <p className="text-gray-600">Please wait while we verify your payment...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-red-600 mb-4">Booking Not Found</h2>
            <p className="text-gray-600 mb-6">
              The booking reference could not be found. Please check your transaction reference.
            </p>
            <Button 
              onClick={() => router.push('/search')}
              className="w-full"
            >
              Search New Journey
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const PaymentMethodIcon = getPaymentMethodIcon(booking.paymentMethod);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Main Status Card */}
        <Card className="mb-6 shadow-lg border-0">
          <CardContent className="p-8 text-center">
            
            {/* Pending Status */}
            {booking.paymentStatus === 'pending' && (
              <>
                <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                  <Clock className="w-10 h-10 text-yellow-600" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-4">Payment Processing</h1>
                <p className="text-gray-600 mb-6 text-lg">
                  We're waiting for your payment confirmation. This usually takes a few moments.
                </p>
                
                {booking.paymentMethod === 'mobile_money' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center justify-center mb-3">
                      <PaymentMethodIcon className="w-5 h-5 text-blue-600 mr-2" />
                      <span className="font-medium text-blue-900">Mobile Money Payment</span>
                    </div>
                    <p className="text-blue-800 text-sm">
                      Please complete the payment on your mobile device using your mobile money service 
                      (Airtel Money or TNM Mpamba). You should have received a payment prompt.
                    </p>
                  </div>
                )}

                {countdown > 0 && (
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                    <Clock className="w-4 h-4" />
                    <span>Auto-refresh in {countdown} seconds</span>
                  </div>
                )}
              </>
            )}
            
            {/* Success Status */}
            {booking.paymentStatus === 'completed' && (
              <>
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h1 className="text-3xl font-bold text-green-600 mb-4">Payment Successful!</h1>
                <p className="text-gray-600 mb-6 text-lg">
                  Your booking has been confirmed. You'll be redirected to your booking details shortly.
                </p>
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <span>Redirecting to booking confirmation</span>
                  <ArrowRight className="w-4 h-4 animate-pulse" />
                </div>
              </>
            )}
            
            {/* Failed Status */}
            {booking.paymentStatus === 'failed' && (
              <>
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <AlertCircle className="w-10 h-10 text-red-600" />
                </div>
                <h1 className="text-3xl font-bold text-red-600 mb-4">Payment Failed</h1>
                <p className="text-gray-600 mb-6 text-lg">
                  Unfortunately, your payment could not be processed. Please try again with a different payment method.
                </p>
                <div className="space-y-3">
                  <Button
                    onClick={() => router.push('/search')}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    Search New Journey
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => router.back()}
                    className="w-full"
                  >
                    Try Different Payment Method
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Booking Details Card */}
        <Card className="mb-6 shadow-md border-0">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Booking Details</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Booking Reference:</span>
                <span className="font-mono font-medium bg-gray-100 px-2 py-1 rounded">
                  {booking.bookingReference}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Transaction ID:</span>
                <span className="font-mono text-sm text-gray-800">{booking.transactionReference}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Amount:</span>
                <span className="font-semibold text-lg">MWK {booking.totalAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Payment Method:</span>
                <div className="flex items-center gap-2">
                  <PaymentMethodIcon className="w-4 h-4" />
                  <span className="capitalize">{booking.paymentMethod.replace('_', ' ')}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Passengers:</span>
                <span>{booking.passengerDetails.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Seats:</span>
                <span>{booking.seatNumbers.join(', ')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Booking Time:</span>
                <span className="text-sm">{formatTime(booking.createdAt)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Help Card */}
        <Card className="shadow-md border-0">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Need Help?</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <MessageCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">Payment Issues</p>
                  <p className="text-sm text-gray-600">
                    If your payment is taking longer than expected, please contact our support team.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" size="sm" className="flex-1">
                  Live Chat
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  Call Support
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}