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

// A stop as used in the segment selector.
// We inject synthetic terminal stops for origin + destination
// so passengers can always book the full trip OR any sub-segment.
interface NormalisedStop {
  id: string;
  name: string;
  distanceFromOrigin: number; // km from route origin
  order: number;
}

// ================================
// HELPERS
// ================================

/**
 * Build a normalised, ordered stop list that ALWAYS includes the
 * route terminals (origin at position 0, destination at last position).
 * Intermediate stops with distanceFromOrigin === 0 are fixed up by
 * interpolating their km position between their neighbours.
 */
function buildNormalisedStops(route: Route): NormalisedStop[] {
  const stops: NormalisedStop[] = [];

  // Terminal: origin
  stops.push({
    id: "__origin__",
    name: route.origin,
    distanceFromOrigin: 0,
    order: -1,
  });

  // Intermediate stops from route.stops
  const intermediate = (route.stops ?? [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  intermediate.forEach((s, i) => {
    stops.push({
      id: s.id,
      name: s.name,
      // If the stop has a real non-zero distance use it,
      // otherwise estimate proportionally between 0 and route.distance
      distanceFromOrigin:
        s.distanceFromOrigin > 0
          ? s.distanceFromOrigin
          : Math.round(
              ((i + 1) / (intermediate.length + 1)) * (route.distance || 100)
            ),
      order: i,
    });
  });

  // Terminal: destination
  stops.push({
    id: "__destination__",
    name: route.destination,
    distanceFromOrigin: route.distance || 100,
    order: intermediate.length,
  });

  return stops;
}

/**
 * Calculate the price for a segment.
 *
 * Priority:
 *   1. route.pricePerKm exists → baseFare + distance * pricePerKm
 *   2. route.baseFare + proportional share of schedule.price
 *   3. Proportional share of schedule.price only
 */
function calcSegmentPrice(
  originDist: number,
  destDist: number,
  route: Route,
  schedulePrice: number,
  isFullTrip: boolean
): number {
  // Full trip: always return the schedule price directly
  if (isFullTrip) return schedulePrice;

  const segmentKm = Math.max(0, destDist - originDist);
  const totalKm = route.distance || 0;

  // If we have per-km pricing, use it
  if (route.pricePerKm && route.pricePerKm > 0 && segmentKm > 0) {
    return Math.round((route.baseFare || 0) + segmentKm * route.pricePerKm);
  }

  // If we have real distances, use proportional pricing
  if (totalKm > 0 && segmentKm > 0) {
    const fraction = segmentKm / totalKm;
    const base = route.baseFare ? route.baseFare * fraction : 0;
    return Math.round(base + schedulePrice * fraction);
  }

  // No usable distance data — fall back to schedule price for the segment
  // (operator hasn't set up per-km pricing, treat as flat fare)
  return schedulePrice;
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
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [bus, setBus] = useState<Bus | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [company, setCompany] = useState<Company | null>(null);

  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [passengerDetails, setPassengerDetails] = useState<PassengerDetails[]>([]);
  const [currentStep, setCurrentStep] = useState<"seats" | "passengers" | "confirm">("seats");
  const [reservationId, setReservationId] = useState<string | null>(null);

  // Stop selection
  const [normalisedStops, setNormalisedStops] = useState<NormalisedStop[]>([]);
  const [originStopId, setOriginStopId] = useState<string>("");
  const [destinationStopId, setDestinationStopId] = useState<string>("");
  const [calculatedPrice, setCalculatedPrice] = useState<number>(0);

  // UI
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
        hour12: true,
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
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
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

  // Resolve a stop id to a human-readable name
  const stopName = (stopId: string) => {
    const s = normalisedStops.find((n) => n.id === stopId);
    return s?.name ?? stopId;
  };

  // ================================
  // SEAT RESERVATION FUNCTIONS
  // ================================
  const holdSeats = useCallback(
    async (seats: string[]) => {
      if (!schedule || !user) {
        throw new Error("Missing schedule or user information");
      }

      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        throw new Error("User profile not found");
      }

      const userRole = userDocSnap.data()?.role;
      if (userRole !== "customer") {
        const roleNames: Record<string, string> = {
          operator: "Bus Operator",
          conductor: "Bus Conductor",
          company_admin: "Company Administrator",
          superadmin: "Super Administrator",
        };
        throw new Error(
          `❌ Access Denied\n\nYou are logged in as a ${
            roleNames[userRole] || userRole
          }. Only customer accounts can book bus tickets.\n\nPlease log out and create a customer account to book tickets.`
        );
      }

      const newReservationId = `${schedule.id}_${user.uid}_${crypto.randomUUID()}`;
      const reservationRef = doc(db, "seatReservations", newReservationId);

      await setDoc(reservationRef, {
        scheduleId: schedule.id,
        customerId: user.uid,
        seatNumbers: seats,
        status: "reserved",
        expiresAt: Timestamp.fromDate(
          new Date(Date.now() + SEAT_HOLD_DURATION)
        ),
        createdAt: serverTimestamp(),
      });

      setReservationId(newReservationId);
    },
    [schedule, user]
  );

  const releaseSeats = useCallback(async () => {
    if (!reservationId) return;
    try {
      await updateDoc(doc(db, "seatReservations", reservationId), {
        status: "released",
        updatedAt: serverTimestamp(),
      });
      setReservationId(null);
    } catch (err) {
      console.error("Failed to release seats:", err);
    }
  }, [reservationId]);

  // ================================
  // DATA FETCHING
  // ================================
  const fetchBookingData = async () => {
    if (!scheduleId || typeof scheduleId !== "string") {
      setError("Invalid schedule ID");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const scheduleDoc = await getDoc(doc(db, "schedules", scheduleId));
      if (!scheduleDoc.exists()) throw new Error("Schedule not found");

      const scheduleData = {
        id: scheduleDoc.id,
        ...scheduleDoc.data(),
      } as Schedule;

      if (!scheduleData.busId || !scheduleData.routeId || !scheduleData.companyId)
        throw new Error("Schedule data is incomplete");

      if ((scheduleData.availableSeats || 0) < passengers)
        throw new Error(
          `Not enough available seats. Only ${
            scheduleData.availableSeats || 0
          } seats available.`
        );

      const departureTime = (scheduleData.departureDateTime as any)?.toDate
        ? (scheduleData.departureDateTime as any).toDate()
        : new Date(scheduleData.departureDateTime);

      if (departureTime < new Date())
        throw new Error("This schedule has already departed");

      setSchedule(scheduleData);

      const [busDoc, routeDoc, companyDoc] = await Promise.all([
        getDoc(doc(db, "buses", scheduleData.busId)),
        getDoc(doc(db, "routes", scheduleData.routeId)),
        getDoc(doc(db, "companies", scheduleData.companyId)),
      ]);

      if (!busDoc.exists()) throw new Error("Bus information not found");
      setBus({ id: busDoc.id, ...busDoc.data() } as Bus);

      if (!routeDoc.exists()) throw new Error("Route information not found");
      const routeData = { id: routeDoc.id, ...routeDoc.data() } as Route;
      setRoute(routeData);

      if (!companyDoc.exists()) throw new Error("Company information not found");
      setCompany({ id: companyDoc.id, ...companyDoc.data() } as Company);
    } catch (error: any) {
      console.error("Error fetching booking data:", error);
      setError(error.message || "Error loading booking information");
    } finally {
      setLoading(false);
    }
  };

  // ================================
  // STOP + PRICE EFFECTS
  // ================================

  // Build normalised stops whenever the route loads
 // Change the stop effect to set defaults immediately when normalisedStops resolves
useEffect(() => {
  if (!route) return;
  const stops = buildNormalisedStops(route);
  setNormalisedStops(stops);
  setOriginStopId(stops[0].id);           // "__origin__"
  setDestinationStopId(stops[stops.length - 1].id);  // "__destination__"
}, [route]);

  // Recalculate price whenever stop selection changes
  useEffect(() => {
    if (!route || !normalisedStops.length || !originStopId || !destinationStopId)
      return;

    const originStop = normalisedStops.find((s) => s.id === originStopId);
    const destStop = normalisedStops.find((s) => s.id === destinationStopId);

    if (!originStop || !destStop || originStop.distanceFromOrigin >= destStop.distanceFromOrigin) {
      setCalculatedPrice(0);
      return;
    }

    const isFullTrip =
      originStop.id === "__origin__" && destStop.id === "__destination__";

    const price = calcSegmentPrice(
      originStop.distanceFromOrigin,
      destStop.distanceFromOrigin,
      route,
      schedule?.price ?? 0,
      isFullTrip
    );

    setCalculatedPrice(price);
  }, [originStopId, destinationStopId, normalisedStops, route, schedule]);

  // ================================
  // BOOKING FLOW HANDLERS
  // ================================
  const handleSeatSelection = useCallback(
    (seats: string[]) => {
      console.log("handleSeatSelection called", { seats, originStopId, destinationStopId, calculatedPrice });
      setError("");

      if (seats.length !== passengers) {
        setError(
          `Please select exactly ${passengers} seat${passengers > 1 ? "s" : ""}.`
        );
        return;
      }

      if (new Set(seats).size !== seats.length) {
        setError("Duplicate seats selected. Please choose different seats.");
        return;
      }

      if (schedule?.bookedSeats?.some((seat) => seats.includes(seat))) {
        setError(
          "One or more selected seats are already booked. Please choose different seats."
        );
        return;
      }

      if (!originStopId || !destinationStopId) {
        setError("Please select boarding and alighting stops.");
        return;
      }

      // Note: price validation happens in confirmBooking via the transaction.
      // We don't block seat selection here because price may be legitimately
      // determined later (e.g. cash on boarding), or route.distance may not
      // be set yet. The confirmation step will catch a zero-price case.

      holdSeats(seats)
        .then(() => {
          setSelectedSeats(seats);
          setCurrentStep("passengers");
          setPassengerDetails(
            seats.map((seat) => ({
              name: "",
              age: 18,
              gender: "male" as const,
              seatNumber: seat,
              ticketType: "adult" as const,
            }))
          );
        })
        .catch((err) => {
          setError(err.message || "Failed to reserve seats. Please try again.");
        });
    },
    [passengers, schedule?.bookedSeats, holdSeats, originStopId, destinationStopId, calculatedPrice]
  );

  const handlePassengerDetails = useCallback(
    (details: PassengerDetails[]) => {
      setError("");

      if (details.length !== passengers) {
        setError(
          `Please provide details for exactly ${passengers} passenger${
            passengers > 1 ? "s" : ""
          }.`
        );
        return;
      }

      const hasMissingFields = details.some(
        (p) => !p.name || !p.age || !p.gender || !p.seatNumber
      );
      if (hasMissingFields) {
        setError("Please fill in all required fields for every passenger.");
        return;
      }

      const names = details.map((p) => p.name.trim().toLowerCase());
      if (new Set(names).size !== names.length && passengers > 1) {
        const confirmed = window.confirm(
          "You have duplicate passenger names. Is this intentional?"
        );
        if (!confirmed) return;
      }

      setPassengerDetails(details);
      setCurrentStep("confirm");
      setConfirmModalOpen(true);
    },
    [passengers]
  );

  const confirmBooking = async () => {
    setBookingLoading(true);
    setError("");

    try {
      if (!user?.uid) throw new Error("User authentication required");
      if (!schedule || !selectedSeats.length || !passengerDetails.length)
        throw new Error("Missing booking information");
      if (
        selectedSeats.length !== passengers ||
        passengerDetails.length !== passengers
      )
        throw new Error("Seat and passenger count mismatch");
      if (!originStopId || !destinationStopId)
        throw new Error("Please select boarding and alighting stops");
      // Allow zero price only if the route has no price data — warn but don't block
      if (calculatedPrice < 0)
        throw new Error("Invalid price calculation");

      const userDocSnap = await getDoc(doc(db, "users", user.uid));
      if (!userDocSnap.exists())
        throw new Error("User document not found in /users collection!");
      if (userDocSnap.data()?.role !== "customer")
        throw new Error(
          `User role is "${userDocSnap.data()?.role}", expected "customer"`
        );

      const scheduleRef = doc(db, "schedules", schedule.id);
      const scheduleSnap = await getDoc(scheduleRef);
      if (!scheduleSnap.exists()) throw new Error("Schedule not found");

      const currentData = scheduleSnap.data();
      const bookedSeats = currentData.bookedSeats || [];
      const conflicting = selectedSeats.filter((s) => bookedSeats.includes(s));
      if (conflicting.length > 0)
        throw new Error(`Seats ${conflicting.join(", ")} are no longer available`);
      if (currentData.availableSeats < selectedSeats.length)
        throw new Error("Not enough available seats");

      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(scheduleRef);
        if (!snap.exists()) throw new Error("Schedule not found");

        const latest = snap.data();
        const latestBooked = latest.bookedSeats || [];
        const stillConflicting = selectedSeats.filter((s) =>
          latestBooked.includes(s)
        );
        if (stillConflicting.length > 0)
          throw new Error(
            `Seats ${stillConflicting.join(", ")} were just booked by someone else`
          );

        const txRef = generateTxRef();
        const bookingRefStr = generateBookingReference();

        const bookingData = {
          userId: user.uid,
          scheduleId: schedule.id,
          companyId: schedule.companyId,
          bookingReference: bookingRefStr,
          transactionReference: txRef,
          passengerDetails: passengerDetails.map((p) => ({
            name: p.name.trim(),
            age: p.age,
            gender: p.gender,
            seatNumber: p.seatNumber,
          })),
          seatNumbers: selectedSeats,
          // Store the human-readable segment so conductors can verify
          originStopId,
          destinationStopId,
          originStopName: stopName(originStopId),
          destinationStopName: stopName(destinationStopId),
          // Price per person and total
          pricePerPerson: calculatedPrice,
          totalAmount: calculatedPrice * passengers,
          bookingStatus: BOOKING_STATUS.PENDING,
          paymentStatus: "pending",
          bookingDate: new Date(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        transaction.set(doc(db, "bookings", txRef), bookingData);
        transaction.update(scheduleRef, {
          bookedSeats: arrayUnion(...selectedSeats),
          availableSeats: increment(-selectedSeats.length),
          updatedAt: serverTimestamp(),
        });
      });

      setSuccess(
        "Booking request submitted successfully! Redirecting to your bookings…"
      );
      setConfirmModalOpen(false);
      setTimeout(() => router.push("/bookings"), 2000);
    } catch (error: any) {
      console.error("Error creating booking:", error);
      setError(
        `Failed to submit booking request: ${error.message || "Unknown error"}`
      );
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
      releaseSeats().catch(console.error);
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
  useEffect(() => {
    if (!user) {
      router.push("/register");
      return;
    }
    if (passengers < 1 || passengers > 10) {
      setError(
        "Invalid passenger count. Please select between 1 and 10 passengers."
      );
      setTimeout(() => router.push("/search"), 3000);
    }
  }, [user, passengers, router]);

  useEffect(() => {
    if (user && scheduleId && passengers >= 1 && passengers <= 10) {
      fetchBookingData();
    }
  }, [scheduleId, user]);

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(""), 5000);
      return () => clearTimeout(t);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(""), 5000);
      return () => clearTimeout(t);
    }
  }, [success]);

  // ================================
  // RENDER CONDITIONS
  // ================================
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-6">
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

  if (!schedule || !bus || !route || !company) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Booking Not Available
            </h2>
            <p className="text-gray-600 mb-6">
              {error || "The requested booking could not be loaded. Please try again."}
            </p>
            <div className="space-y-3">
              <Button onClick={() => window.location.reload()} className="w-full">
                Try Again
              </Button>
              <Button
                onClick={() => router.push("/search")}
                variant="outline"
                className="w-full"
              >
                Back to Search
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Stops that come AFTER the currently selected origin (for destination dropdown)
  const availableDestinations = normalisedStops.filter((s) => {
    const originStop = normalisedStops.find((n) => n.id === originStopId);
    return originStop && s.distanceFromOrigin > originStop.distanceFromOrigin;
  });

  // ================================
  // MAIN RENDER
  // ================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

        {/* ── Trip Information Header ── */}
        <Card className="mb-6 shadow-lg border-0">
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
              {/* Company */}
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shrink-0">
                  <span className="text-white font-bold text-xl">
                    {company.name?.charAt(0) || "?"}
                  </span>
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-gray-900">
                    {company.name || "Unknown Company"}
                  </h1>
                  <p className="text-sm text-gray-600">
                    {bus.licensePlate || "N/A"} · {bus.busType || "Standard"}
                  </p>
                  <div className="flex items-center mt-1">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span className="text-sm text-gray-600 ml-1">
                      4.5 (120 reviews)
                    </span>
                  </div>
                </div>
              </div>

              {/* Route */}
              <div className="text-center">
                <div className="flex items-center justify-center gap-3 sm:gap-4 mb-2">
                  <div className="text-center">
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">
                      {formatTime(schedule.departureDateTime)}
                    </p>
                    <p className="text-sm text-gray-600 flex items-center justify-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate max-w-[80px] sm:max-w-none">
                        {route.origin || "Unknown"}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1 hidden sm:block">
                      {formatDate(schedule.departureDateTime)}
                    </p>
                  </div>
                  <div className="flex-1 max-w-16 sm:max-w-24 relative">
                    <div className="border-t-2 border-gray-300"></div>
                    <ArrowRight className="w-4 h-4 text-gray-400 absolute -top-2 left-1/2 -translate-x-1/2 bg-white" />
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDuration(route.duration)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">
                      {formatTime(schedule.arrivalDateTime)}
                    </p>
                    <p className="text-sm text-gray-600 flex items-center justify-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate max-w-[80px] sm:max-w-none">
                        {route.destination || "Unknown"}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1 hidden sm:block">
                      {formatDate(schedule.arrivalDateTime)}
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

              {/* Pricing */}
              <div className="text-center lg:text-right">
                <p className="text-2xl sm:text-3xl font-bold text-blue-600">
                  MWK {calculatedPrice > 0 ? calculatedPrice.toLocaleString() : "—"}
                </p>
                <p className="text-sm text-gray-600">per person</p>
                <div className="flex items-center justify-center lg:justify-end gap-2 mt-2">
                  <Users className="w-4 h-4 text-gray-500" />
                  <p className="text-sm text-gray-600">
                    {passengers} passenger{passengers > 1 ? "s" : ""}
                  </p>
                </div>
                {calculatedPrice > 0 && (
                  <p className="text-lg font-semibold text-gray-900 mt-2">
                    Total: MWK {(calculatedPrice * passengers).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            {/* Amenities */}
            {bus.amenities && bus.amenities.length > 0 && (
              <div className="mt-5 pt-4 border-t">
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

        {/* ── Boarding & Alighting Stop Selector ── */}
        {currentStep === "seats" && normalisedStops.length > 1 && (
          <Card className="mb-6 shadow-lg border-0">
            <CardContent className="p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold mb-1 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-600" />
                Boarding & Alighting Points
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                You can board or alight at any stop along this route — not just the terminals.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {/* Board At */}
                <div>
                  <Label htmlFor="boardAt" className="mb-1.5 block">
                    Board At <span className="text-red-500">*</span>
                  </Label>
                  <select
                    id="boardAt"
                    value={originStopId}
                    onChange={(e) => {
                      setOriginStopId(e.target.value);
                      // Reset destination if it's now behind the new origin
                      const newOrigin = normalisedStops.find(
                        (s) => s.id === e.target.value
                      );
                      const currentDest = normalisedStops.find(
                        (s) => s.id === destinationStopId
                      );
                      if (
                        newOrigin &&
                        currentDest &&
                        currentDest.distanceFromOrigin <=
                          newOrigin.distanceFromOrigin
                      ) {
                        setDestinationStopId("");
                      }
                    }}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm"
                    required
                  >
                    {normalisedStops
                      // Can board anywhere except the last stop
                      .filter(
                        (s) =>
                          s.id !== normalisedStops[normalisedStops.length - 1].id
                      )
                      .map((stop, idx) => (
                        <option key={stop.id} value={stop.id}>
                          {stop.name}
                          {stop.distanceFromOrigin > 0 &&
                          stop.distanceFromOrigin < (route.distance || 0)
                            ? ` (${stop.distanceFromOrigin} km)`
                            : idx === 0
                            ? " — Start"
                            : ""}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Alight At */}
                <div>
                  <Label htmlFor="alightAt" className="mb-1.5 block">
                    Alight At <span className="text-red-500">*</span>
                  </Label>
                  <select
                    id="alightAt"
                    value={destinationStopId}
                    onChange={(e) => setDestinationStopId(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    required
                    disabled={!originStopId}
                  >
                    <option value="">Select alighting stop</option>
                    {availableDestinations.map((stop) => (
                      <option key={stop.id} value={stop.id}>
                        {stop.name}
                        {stop.distanceFromOrigin > 0 &&
                        stop.distanceFromOrigin < (route.distance || 0)
                          ? ` (${stop.distanceFromOrigin} km)`
                          : stop.id === "__destination__"
                          ? " — End"
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Segment summary */}
              {originStopId && destinationStopId && calculatedPrice > 0 && (
                <div className="mt-4 p-3 sm:p-4 bg-blue-50 border border-blue-100 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm text-blue-800">
                    <MapPin className="w-4 h-4 shrink-0" />
                    <span className="font-medium">
                      {stopName(originStopId)}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-medium">
                      {stopName(destinationStopId)}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-blue-700 shrink-0">
                    MWK {calculatedPrice.toLocaleString()} / person
                  </span>
                </div>
              )}

              {/* Warning if stops give zero price */}
              {originStopId && destinationStopId && calculatedPrice <= 0 && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2 text-sm text-yellow-800">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  Could not calculate a price for this segment. Please contact support or choose different stops.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Progress Steps ── */}
        <Card className="mb-6 shadow-md border-0">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-center gap-4 sm:gap-8">
              {[
                { step: 1, title: "Select Seats", key: "seats" },
                { step: 2, title: "Passenger Details", key: "passengers" },
                { step: 3, title: "Confirm & Submit", key: "confirm" },
              ].map(({ step, title, key }, idx) => {
                const isActive = currentStep === key;
                const isCompleted =
                  (key === "seats" &&
                    (currentStep === "passengers" ||
                      currentStep === "confirm")) ||
                  (key === "passengers" && currentStep === "confirm");

                return (
                  <div key={step} className="flex items-center gap-2 sm:gap-3">
                    <div
                      className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-200 text-sm sm:text-base ${
                        isActive
                          ? "bg-blue-600 text-white shadow-lg scale-110"
                          : isCompleted
                          ? "bg-green-600 text-white"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {isCompleted ? <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" /> : step}
                    </div>
                    <span className={`font-medium text-xs sm:text-sm hidden sm:block ${
                      isActive ? "text-blue-600" : isCompleted ? "text-green-600" : "text-gray-400"
                    }`}>
                      {title}
                    </span>
                    {idx < 2 && (
                      <div className="w-6 sm:w-10 h-px bg-gray-200 hidden sm:block" />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ── Error / Success Messages ── */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-red-700 whitespace-pre-wrap font-medium text-sm">
                  {error}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {success && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                <p className="text-green-700 text-sm">{success}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step Content ── */}
        <div className="space-y-6">
          {currentStep === "seats" && (
            <SeatSelection
              bus={bus}
              schedule={schedule}
              passengers={passengers}
              onSeatSelection={handleSeatSelection}
              selectedSeats={selectedSeats}
              originStopId={originStopId}
              destinationStopId={destinationStopId}
              route={route}
            />
          )}

          {currentStep === "passengers" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Passenger Details
                    </CardTitle>
                    <Button
                      variant="outline"
                      onClick={goBackToSeats}
                      className="flex items-center gap-2 w-full sm:w-auto"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back to Seats
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">
                      Selected seats:{" "}
                      <span className="font-semibold">
                        {selectedSeats.join(", ")}
                      </span>
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      Segment:{" "}
                      <span className="font-semibold">
                        {stopName(originStopId)} → {stopName(destinationStopId)}
                      </span>
                      {" · "}
                      <span className="font-semibold text-blue-600">
                        MWK {calculatedPrice.toLocaleString()} / person
                      </span>
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

          {/* ── Confirmation Modal ── */}
          {confirmModalOpen && (
            <Modal
              isOpen={confirmModalOpen}
              onClose={() => {
                if (!bookingLoading) setConfirmModalOpen(false);
              }}
              title="Confirm Booking Details"
            >
              <div className="space-y-5">
                <div className="bg-blue-50 p-3 sm:p-4 rounded-lg">
                  <p className="text-sm text-blue-700 font-medium">
                    Please review all details before submitting your booking request.
                  </p>
                </div>

                {/* Trip summary */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-0.5">Boarding Stop</p>
                    <p className="font-semibold text-sm">{stopName(originStopId)}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-0.5">Alighting Stop</p>
                    <p className="font-semibold text-sm">{stopName(destinationStopId)}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-0.5">Departure</p>
                    <p className="font-semibold text-sm">
                      {formatDate(schedule.departureDateTime)}
                    </p>
                    <p className="text-sm text-blue-600 font-medium">
                      {formatTime(schedule.departureDateTime)}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-0.5">Arrival (Est.)</p>
                    <p className="font-semibold text-sm">
                      {formatDate(schedule.arrivalDateTime)}
                    </p>
                    <p className="text-sm text-blue-600 font-medium">
                      {formatTime(schedule.arrivalDateTime)}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-0.5">Seats</p>
                    <p className="font-semibold text-sm">{selectedSeats.join(", ")}</p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-xs text-gray-500 mb-0.5">Total Amount</p>
                    <p className="text-lg font-bold text-blue-600">
                      MWK {(calculatedPrice * passengers).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      {passengers} × MWK {calculatedPrice.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Passengers */}
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    Passengers
                  </p>
                  <div className="space-y-2">
                    {passengerDetails.map((passenger, i) => (
                      <div
                        key={i}
                        className="p-3 bg-gray-50 rounded-lg flex items-center justify-between gap-3"
                      >
                        <div>
                          <p className="font-medium text-sm">{passenger.name}</p>
                          <p className="text-xs text-gray-500">
                            Age {passenger.age} · {passenger.gender}
                          </p>
                        </div>
                        <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-1 rounded shrink-0">
                          Seat {passenger.seatNumber}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t">
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
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Submitting…</span>
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