"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  runTransaction,
  increment,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { useAuth } from "@/contexts/AuthContext";
import { Schedule, Bus, Route, Company, PassengerDetails } from "@/types";
import SeatSelection from "@/components/SeatSelection";
import PassengerForm from "@/components/PassengerForm";
import { Button } from "@/components/ui/button";
import Modal from "@/components/Modals";
import { Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, useStripe, useElements, CardElement } from "@stripe/react-stripe-js";
import {
  CreditCard,
  Smartphone,
  Building,
  CheckCircle,
  AlertCircle,
  Clock,
  MapPin,
  Users,
  Calendar,
  ArrowRight,
  Shield,
  Star,
  ArrowLeft
} from "lucide-react";

// ================================
// CONSTANTS
// ================================
const BOOKING_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled",
} as const;

const SEAT_HOLD_DURATION = 10 * 60 * 1000; // 10 minutes

// ================================
// INTERFACES
// ================================
interface SeatHold {
  seat: string;
  userId: string;
  expires: Date;
}

// ================================
// MAIN COMPONENT
// ================================
export default function BookBus() {
  // ================================
  // HOOKS
  // ================================
  const { id: scheduleId } = useParams() as { id: string };
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  
  // ================================
  // DERIVED VALUES
  // ================================
  const passengers = parseInt(searchParams.get("passengers") || "1", 10);

  // ================================
  // STATE MANAGEMENT
  // ================================
  // Core data state
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [bus, setBus] = useState<Bus | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  
  // Booking flow state
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [passengerDetails, setPassengerDetails] = useState<PassengerDetails[]>([]);
  const [currentStep, setCurrentStep] = useState<"seats" | "passengers" | "confirm">("seats");
  const [reservationId, setReservationId] = useState<string | null>(null);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  // ================================
  // UTILITY FUNCTIONS
  // ================================
  const generateTxRef = () => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `TX${timestamp}${random}`.toUpperCase();
  };

  const generateBookingReference = () => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `BK${timestamp}${random}`.toUpperCase();
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return "N/A";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      });
    } catch {
      return "N/A";
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString("en-GB", {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return "N/A";
    }
  };

  const formatDuration = (minutes: number) => {
    if (!minutes || minutes < 0) return "N/A";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  // ================================
  // SEAT RESERVATION FUNCTIONS
  // ================================
  const holdSeats = useCallback(async (seats: string[]) => {
    if (!schedule || !user) return;
    
    try {
      const newReservationId = `${schedule.id}_${user.uid}_${crypto.randomUUID()}`;
      const reservationRef = doc(db, "seatReservations", newReservationId);
      
      await setDoc(reservationRef, {
        scheduleId: schedule.id,
        customerId: user.uid,
        seatNumbers: seats,
        status: "reserved",
        expiresAt: Timestamp.fromDate(new Date(Date.now() + SEAT_HOLD_DURATION)),
        createdAt: serverTimestamp(),
      });
      
      setReservationId(newReservationId);
      console.log("Seats reserved successfully with ID:", newReservationId);
    } catch (err: any) {
      console.error("Reservation error:", err);
      throw new Error(err.message || "Failed to reserve seats");
    }
  }, [schedule, user]);

  const releaseSeats = useCallback(async () => {
    if (!reservationId) return;
    
    try {
      const reservationRef = doc(db, "seatReservations", reservationId);
      await updateDoc(reservationRef, {
        status: "released",
        updatedAt: serverTimestamp(),
      });
      setReservationId(null);
      console.log("Seats released for reservation:", reservationId);
    } catch (err: any) {
      console.error("Failed to release seats:", err);
      // Non-critical error, don't block user
    }
  }, [reservationId]);

  // ================================
  // DATA FETCHING FUNCTIONS
  // ================================
  const fetchBookingData = async () => {
    if (!scheduleId || typeof scheduleId !== 'string') {
      setError("Invalid schedule ID");
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      // Fetch schedule
      const scheduleDoc = await getDoc(doc(db, "schedules", scheduleId));
      if (!scheduleDoc.exists()) {
        throw new Error("Schedule not found");
      }
      
      const scheduleData = { id: scheduleDoc.id, ...scheduleDoc.data() } as Schedule;
      
      // Validate schedule data
      if (!scheduleData.busId || !scheduleData.routeId || !scheduleData.companyId) {
        throw new Error("Schedule data is incomplete");
      }
      
      // Check availability
      if ((scheduleData.availableSeats || 0) < passengers) {
        throw new Error(`Not enough available seats. Only ${scheduleData.availableSeats || 0} seats available.`);
      }
      
      // Check if schedule is in the past
       const departureTime = (scheduleData.departureDateTime as any)?.toDate ?
        (scheduleData.departureDateTime as any).toDate() :
        new Date(scheduleData.departureDateTime);
      
      if (departureTime < new Date()) {
        throw new Error("This schedule has already departed");
      }
      
      setSchedule(scheduleData);
      
      // Fetch related data in parallel
      const [busDoc, routeDoc, companyDoc] = await Promise.all([
        getDoc(doc(db, "buses", scheduleData.busId)),
        getDoc(doc(db, "routes", scheduleData.routeId)),
        getDoc(doc(db, "companies", scheduleData.companyId)),
      ]);
      
      // Validate and set bus data
      if (!busDoc.exists()) {
        throw new Error("Bus information not found");
      }
      setBus({ id: busDoc.id, ...busDoc.data() } as Bus);
      
      // Validate and set route data
      if (!routeDoc.exists()) {
        throw new Error("Route information not found");
      }
      setRoute({ id: routeDoc.id, ...routeDoc.data() } as Route);
      
      // Validate and set company data
      if (!companyDoc.exists()) {
        throw new Error("Company information not found");
      }
      setCompany({ id: companyDoc.id, ...companyDoc.data() } as Company);
      
    } catch (error: any) {
      console.error("Error fetching booking data:", error);
      setError(error.message || "Error loading booking information");
    } finally {
      setLoading(false);
    }
  };

  // ================================
  // BOOKING FLOW HANDLERS
  // ================================
  const handleSeatSelection = useCallback((seats: string[]) => {
    setError("");
    
    // Client-side validation
    if (seats.length !== passengers) {
      setError(`Please select exactly ${passengers} seat${passengers > 1 ? "s" : ""}.`);
      return;
    }

    if (new Set(seats).size !== seats.length) {
      setError("Duplicate seats selected. Please choose different seats.");
      return;
    }
    
    if (schedule?.bookedSeats?.some((seat) => seats.includes(seat))) {
      setError("One or more selected seats are already booked. Please choose different seats.");
      return;
    }
    
    // Reserve seats and proceed
    holdSeats(seats).then(() => {
      setSelectedSeats(seats);
      setCurrentStep("passengers");
      
      // Initialize passenger details with selected seats
      const initialDetails = seats.map((seat, index) => ({
        name: "",
        age: 18,
        gender: "male" as const,
        seatNumber: seat,
        ticketType: "adult" as const,
      }));
      setPassengerDetails(initialDetails);
    }).catch(err => {
      setError(err.message || "Failed to reserve seats. Please try again.");
    });
  }, [passengers, schedule?.bookedSeats, holdSeats]);

  const handlePassengerDetails = useCallback((details: PassengerDetails[]) => {
    setError("");
    
    // Validate passenger details
    if (details.length !== passengers) {
      setError(`Please provide details for exactly ${passengers} passenger${passengers > 1 ? "s" : ""}.`);
      return;
    }

    // Check for missing required fields
    const hasMissingFields = details.some(p => !p.name || !p.age || !p.gender || !p.seatNumber);
    if (hasMissingFields) {
      setError("Please fill in all required fields for every passenger.");
      return;
    }

    // Check for duplicate names (optional warning)
    const names = details.map(p => p.name.trim().toLowerCase());
    if (new Set(names).size !== names.length && passengers > 1) {
      const confirmed = window.confirm("You have duplicate passenger names. Is this intentional?");
      if (!confirmed) return;
    }
    
    setPassengerDetails(details);
    setCurrentStep("confirm");
    setConfirmModalOpen(true);
  }, [passengers]);

  const confirmBooking = async () => {
    setBookingLoading(true);
    setError("");
    
    try {
      // Final validations
      if (!user?.uid) {
        throw new Error("User authentication required");
      }

      if (!schedule || !selectedSeats.length || !passengerDetails.length) {
        throw new Error("Missing booking information");
      }
      
      if (selectedSeats.length !== passengers || passengerDetails.length !== passengers) {
        throw new Error("Seat and passenger count mismatch");
      }

      // Check seat availability one more time
      const scheduleRef = doc(db, "schedules", schedule.id);
      const scheduleSnap = await getDoc(scheduleRef);
      
      if (!scheduleSnap.exists()) {
        throw new Error("Schedule not found");
      }
      
      const currentScheduleData = scheduleSnap.data();
      const bookedSeats = currentScheduleData.bookedSeats || [];
      const conflictingSeats = selectedSeats.filter(seat => bookedSeats.includes(seat));

      if (conflictingSeats.length > 0) {
        throw new Error(`Seats ${conflictingSeats.join(', ')} are no longer available`);
      }
      
      if (currentScheduleData.availableSeats < selectedSeats.length) {
        throw new Error("Not enough available seats");
      }

      // Use transaction for atomic booking
      await runTransaction(db, async (transaction) => {
        // Re-check schedule in transaction
        const scheduleSnap = await transaction.get(scheduleRef);
        if (!scheduleSnap.exists()) throw new Error("Schedule not found");
        
        const latestScheduleData = scheduleSnap.data();
        const latestBookedSeats = latestScheduleData.bookedSeats || [];
        const stillConflicting = selectedSeats.filter(seat => latestBookedSeats.includes(seat));
        
        if (stillConflicting.length > 0) {
          throw new Error(`Seats ${stillConflicting.join(', ')} were just booked by someone else`);
        }

        // Generate unique references
        const txRef = generateTxRef();
        const bookingRef = generateBookingReference();
        
        // Prepare booking data
        const bookingData = {
          userId: user.uid,
          scheduleId: schedule.id,
          companyId: schedule.companyId,
          bookingReference: bookingRef,
          transactionReference: txRef,
          passengerDetails: passengerDetails.map(p => ({
            name: p.name.trim(),
            age: p.age,
            gender: p.gender,
            seatNumber: p.seatNumber
          })),
          seatNumbers: selectedSeats,
          totalAmount: schedule.price * passengers,
          bookingStatus: BOOKING_STATUS.PENDING,
          paymentStatus: "pending",
          bookingDate: new Date(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        // Create booking document
        transaction.set(doc(db, "bookings", txRef), bookingData);
        
        // Update schedule: add to booked seats and reduce available seats
        transaction.update(scheduleRef, {
          bookedSeats: arrayUnion(...selectedSeats),
          availableSeats: increment(-selectedSeats.length),
          updatedAt: serverTimestamp()
        });
      });

      setSuccess("Booking request submitted successfully! Redirecting to your bookings...");
      setConfirmModalOpen(false);
      
      // Redirect after a short delay
      setTimeout(() => {
        router.push("/bookings");
      }, 2000);
      
    } catch (error: any) {
      console.error("Error creating booking:", error);
      setError(`Failed to submit booking request: ${error.message || "Unknown error"}`);
    } finally {
      setBookingLoading(false);
    }
  };

  // ================================
  // NAVIGATION HANDLERS
  // ================================
  const goBackToSeats = () => {
    setCurrentStep("seats");
    setError("");
    
    if (selectedSeats.length > 0) {
      releaseSeats().catch(err => {
        console.error("Failed to release seats on navigation:", err);
      });
      setSelectedSeats([]);
    }
  };

  const goBackToPassengers = () => {
    setCurrentStep("passengers");
    setConfirmModalOpen(false);
    setError("");
  };

  // ================================
  // EFFECTS
  // ================================
  // Authentication and validation
  useEffect(() => {
    if (!user) {
      router.push("/register");
      return;
    }
    
    if (passengers < 1 || passengers > 10) {
      setError("Invalid passenger count. Please select between 1 and 10 passengers.");
      setTimeout(() => router.push("/search"), 3000);
    }
  }, [user, passengers, router]);

  // Data fetching
  useEffect(() => {
    if (user && scheduleId && passengers >= 1 && passengers <= 10) {
      fetchBookingData();
    }
  }, [scheduleId, user]);

  // Auto-clear messages
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // ================================
  // RENDER CONDITIONS
  // ================================
  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-6">
            {/* Header skeleton */}
            <Card>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                  <div className="text-center space-y-3">
                    <div className="h-6 bg-gray-200 rounded w-1/3 mx-auto"></div>
                    <div className="h-4 bg-gray-200 rounded w-2/3 mx-auto"></div>
                  </div>
                  <div className="text-right space-y-3">
                    <div className="h-6 bg-gray-200 rounded w-1/4 ml-auto"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2 ml-auto"></div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Progress skeleton */}
            <Card>
              <CardContent className="p-6">
                <div className="flex justify-center space-x-8">
                  {[1, 2, 3].map((step) => (
                    <div key={step} className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                      <div className="h-4 bg-gray-200 rounded w-24"></div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            {/* Content skeleton */}
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="h-6 bg-gray-200 rounded w-1/4"></div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[...Array(8)].map((_, i) => (
                      <div key={i} className="h-20 bg-gray-200 rounded"></div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (!schedule || !bus || !route || !company) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Booking Not Available</h2>
            <p className="text-gray-600 mb-6">
              {error || "The requested booking could not be loaded. Please try again."}
            </p>
            <div className="space-y-3">
              <Button onClick={() => window.location.reload()} className="w-full">
                Try Again
              </Button>
              <Button onClick={() => router.push("/search")} variant="outline" className="w-full">
                Back to Search
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ================================
  // MAIN RENDER
  // ================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Trip Information Header */}
        <Card className="mb-6 shadow-lg border-0">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
              {/* Company Info */}
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-xl">
                    {company.name?.charAt(0) || "?"}
                  </span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{company.name || "Unknown Company"}</h1>
                  <p className="text-sm text-gray-600">
                    {bus.licensePlate || "N/A"} • {bus.busType || "Standard"}
                  </p>
                  <div className="flex items-center mt-1">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span className="text-sm text-gray-600 ml-1">4.5 (120 reviews)</span>
                  </div>
                </div>
              </div>

              {/* Route Info */}
              <div className="text-center">
                <div className="flex items-center justify-center space-x-4 mb-2">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">
                      {formatTime(schedule.departureDateTime)}
                    </p>
                    <p className="text-sm text-gray-600 flex items-center justify-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {route.origin || "Unknown"}
                    </p>
                  </div>
                  <div className="flex-1 max-w-24 relative">
                    <div className="border-t-2 border-gray-300"></div>
                    <ArrowRight className="w-4 h-4 text-gray-400 absolute -top-2 left-1/2 transform -translate-x-1/2 bg-white" />
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDuration(route.duration)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">
                      {formatTime(schedule.arrivalDateTime)}
                    </p>
                    <p className="text-sm text-gray-600 flex items-center justify-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {route.destination || "Unknown"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <p className="text-sm text-gray-600">
                    {formatDate(schedule.departureDateTime)}
                  </p>
                </div>
              </div>

              {/* Pricing Info */}
              <div className="text-right lg:text-right text-center">
                <p className="text-3xl font-bold text-blue-600">
                  MWK {(schedule.price || 0).toLocaleString()}
                </p>
                <p className="text-sm text-gray-600">per person</p>
                <div className="flex items-center justify-end gap-2 mt-2">
                  <Users className="w-4 h-4 text-gray-500" />
                  <p className="text-sm text-gray-600">
                    {passengers} passenger{passengers > 1 ? "s" : ""}
                  </p>
                </div>
                <p className="text-lg font-semibold text-gray-900 mt-2">
                  Total: MWK {((schedule.price || 0) * passengers).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Amenities */}
            {bus.amenities && bus.amenities.length > 0 && (
              <div className="mt-6 pt-4 border-t">
                <div className="flex flex-wrap gap-2">
                  {bus.amenities.slice(0, 6).map((amenity, index) => (
                    <Badge key={index} variant="secondary" className="px-3 py-1">
                      {amenity}
                    </Badge>
                  ))}
                  {bus.amenities.length > 6 && (
                    <Badge variant="outline" className="px-3 py-1">
                      +{bus.amenities.length - 6} more
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Progress Steps */}
        <Card className="mb-6 shadow-md border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-center space-x-8">
              {[
                { step: 1, title: "Select Seats", key: "seats" },
                { step: 2, title: "Passenger Details", key: "passengers" },
                { step: 3, title: "Confirm & Submit", key: "confirm" },
              ].map(({ step, title, key }) => {
                const isActive = currentStep === key;
                const isCompleted =
                  (key === "seats" && (currentStep === "passengers" || currentStep === "confirm")) ||
                  (key === "passengers" && currentStep === "confirm");
                  
                return (
                  <div key={step} className={`flex items-center space-x-3 ${
                    isActive ? "text-blue-600" : isCompleted ? "text-green-600" : "text-gray-400"
                  }`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-200 ${
                      isActive
                        ? "bg-blue-600 text-white shadow-lg transform scale-110"
                        : isCompleted
                        ? "bg-green-600 text-white"
                        : "bg-gray-200 text-gray-600"
                    }`}>
                      {isCompleted ? <CheckCircle className="w-5 h-5" /> : step}
                    </div>
                    <span className="font-medium hidden sm:block">{title}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Error Messages */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <p className="text-red-700">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Success Messages */}
        {success && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                <p className="text-green-700">{success}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step Content */}
        <div className="space-y-6">
          {currentStep === "seats" && (
            <SeatSelection
              bus={bus}
              schedule={schedule}
              passengers={passengers}
              onSeatSelection={handleSeatSelection}
              selectedSeats={selectedSeats}
            />
          )}
          
          {currentStep === "passengers" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Passenger Details
                    </CardTitle>
                    <Button
                      variant="outline"
                      onClick={goBackToSeats}
                      className="flex items-center gap-2"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back to Seats
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <p className="text-sm text-gray-600">
                      Selected seats: <span className="font-semibold">{selectedSeats.join(", ")}</span>
                    </p>
                  </div>
                  <PassengerForm
                    passengerDetails={passengerDetails}
                    onSubmit={handlePassengerDetails}
                    onBack={goBackToSeats}
                    loading={bookingLoading}
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Confirmation Modal */}
          {confirmModalOpen && (
            <Modal
              isOpen={confirmModalOpen}
              onClose={() => {
                if (!bookingLoading) {
                  setConfirmModalOpen(false);
                }
              }}
              title="Confirm Booking Details"
            >
              <div className="space-y-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-700 font-medium">
                    Please review all details before submitting your booking request.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-semibold text-gray-700">Route</p>
                    <p>{route.origin} → {route.destination}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700">Date</p>
                    <p>{formatDate(schedule.departureDateTime)}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700">Departure</p>
                    <p>{formatTime(schedule.departureDateTime)}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700">Arrival</p>
                    <p>{formatTime(schedule.arrivalDateTime)}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700">Seats</p>
                    <p>{selectedSeats.join(", ")}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700">Total Amount</p>
                    <p className="text-lg font-bold text-blue-600">
                      MWK {((schedule.price || 0) * passengers).toLocaleString()}
                    </p>
                  </div>
                </div>
                
                <div>
                  <p className="font-semibold text-gray-700 mb-2">Passengers</p>
                  <div className="space-y-2">
                    {passengerDetails.map((p, i) => (
                      <div key={i} className="bg-gray-50 p-3 rounded-lg">
                        <p className="font-medium">{p.name}</p>
                        <p className="text-sm text-gray-600">
                          Age: {p.age} • Gender: {p.gender} • Seat: {p.seatNumber}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="flex space-x-4 pt-4 border-t">
                  <Button
                    onClick={goBackToPassengers}
                    variant="outline"
                    className="flex-1"
                    disabled={bookingLoading}
                  >
                    Edit Details
                  </Button>
                  <Button
                    onClick={confirmBooking}
                    className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
                    disabled={bookingLoading}
                  >
                    {bookingLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Submitting...</span>
                      </div>
                    ) : (
                      "Submit Request"
                    )}
                  </Button>
                </div>
              </div>
            </Modal>
          )}
        </div>
      </div>
    </div>
  );
}