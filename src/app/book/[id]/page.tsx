"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Schedule, Bus, Route, Company } from "@/types";
import SeatSelection from "@/components/SeatSelection";
import { Button } from "@/components/ui/button";
import Modal from "@/components/Modals";
import { Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard, CheckCircle, AlertCircle, MapPin,
  Users, Calendar, ArrowRight, Star, ArrowLeft,
} from "lucide-react";

// ================================
// CONSTANTS
// ================================
// SEAT_HOLD_DURATION is now handled server-side in the API

// ================================
// INTERFACES
// ================================
interface NormalisedStop {
  id: string;
  name: string;
  distanceFromOrigin: number;
  order: number;
}

interface PassengerFormState {
  name: string;
  ageInput: string;
  age: number;
  gender: "male" | "female" | "other";
  seatNumber: string;
  ticketType: "adult" | "child" | "senior";
}

// ================================
// HELPERS
// ================================

function buildNormalisedStops(route: Route): NormalisedStop[] {
  const stops: NormalisedStop[] = [];
  stops.push({ id: "__origin__", name: route.origin, distanceFromOrigin: 0, order: -1 });

  const intermediate = (route.stops ?? [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  intermediate.forEach((s, i) => {
    stops.push({
      id: s.id, name: s.name,
      distanceFromOrigin: s.distanceFromOrigin > 0
        ? s.distanceFromOrigin
        : Math.round(((i + 1) / (intermediate.length + 1)) * (route.distance || 100)),
      order: i,
    });
  });

  stops.push({
    id: "__destination__", name: route.destination,
    distanceFromOrigin: route.distance || 100, order: intermediate.length,
  });
  return stops;
}

// ✅ New — stop-index based, matches server logic exactly
function calcSegmentPrice(
  originDist: number, destDist: number,
  route: Route, schedulePrice: number, isFullTrip: boolean,
  stops: NormalisedStop[], originId: string, destId: string,
  segmentPrices?: Record<string, number>
): number {
  if (isFullTrip) return schedulePrice;

  const key = `${originId}:${destId}`;
  const price = segmentPrices?.[key];
  if (typeof price === 'number' && price > 0) return price;

  const oi = stops.findIndex(s => s.id === originId);
  const di = stops.findIndex(s => s.id === destId);
  if (oi !== -1 && di !== -1 && di > oi && stops.length > 1) {
    const raw = ((di - oi) / (stops.length - 1)) * schedulePrice;
    return Math.max(50, Math.round(raw / 50) * 50);
  }

  const segKm = Math.max(0, destDist - originDist);
  const totalKm = route.distance || 0;
  if (totalKm > 0 && segKm > 0)
    return Math.max(50, Math.round(((segKm / totalKm) * schedulePrice) / 50) * 50);

  return schedulePrice;
}

// ================================
// INLINE PASSENGER FORM
// ================================
interface InlinePassengerFormProps {
  passengers: number;
  formState: PassengerFormState[];
  onChange: (index: number, field: keyof PassengerFormState, value: string) => void;
  onAgeBlur: (index: number) => void;
  onSubmit: () => void;
  onBack: () => void;
  loading: boolean;
  error: string;
}

const InlinePassengerForm: React.FC<InlinePassengerFormProps> = ({
  passengers, formState, onChange, onAgeBlur, onSubmit, onBack, loading, error,
}) => (
  <div className="space-y-5">
    {formState.map((p, i) => (
      <div key={i} className="p-4 border border-gray-200 rounded-xl bg-white space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
            {i + 1}
          </span>
          <span className="font-semibold text-gray-800 text-sm">
            Passenger {i + 1} — Seat {p.seatNumber}
          </span>
        </div>
        <div>
          <Label htmlFor={`name-${i}`} className="mb-1 block text-sm">
            Full Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id={`name-${i}`} value={p.name}
            onChange={e => onChange(i, "name", e.target.value)}
            placeholder="e.g. Chisomo Banda" className="h-10" required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor={`age-${i}`} className="mb-1 block text-sm">
              Age <span className="text-red-500">*</span>
            </Label>
            <Input
              id={`age-${i}`} type="text" inputMode="numeric" pattern="[0-9]*"
              value={p.ageInput}
              onChange={e => onChange(i, "ageInput", e.target.value.replace(/\D/g, ""))}
              onBlur={() => onAgeBlur(i)}
              placeholder="e.g. 28" className="h-10" required
            />
          </div>
          <div>
            <Label htmlFor={`gender-${i}`} className="mb-1 block text-sm">
              Gender <span className="text-red-500">*</span>
            </Label>
            <select
              id={`gender-${i}`} value={p.gender}
              onChange={e => onChange(i, "gender", e.target.value)}
              className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 bg-white"
              required
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        <div>
          <Label htmlFor={`ticket-${i}`} className="mb-1 block text-sm">Ticket Type</Label>
          <select
            id={`ticket-${i}`} value={p.ticketType}
            onChange={e => onChange(i, "ticketType", e.target.value)}
            className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="adult">Adult</option>
            <option value="child">Child</option>
            <option value="senior">Senior</option>
          </select>
        </div>
      </div>
    ))}
    {error && (
      <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}
      </div>
    )}
    <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
      <Button variant="outline" onClick={onBack} disabled={loading} className="flex items-center gap-2 sm:flex-1">
        <ArrowLeft className="w-4 h-4" /> Back to Seats
      </Button>
      <Button onClick={onSubmit} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white sm:flex-1">
        {loading
          ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</span>
          : "Continue to Review →"
        }
      </Button>
    </div>
  </div>
);

// ================================
// MAIN COMPONENT
// ================================
export default function BookBus() {
  const { id: scheduleId } = useParams() as { id: string };
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const passengers = parseInt(searchParams.get("passengers") || "1", 10);

  const [schedule,   setSchedule]   = useState<Schedule | null>(null);
  const [bus,        setBus]        = useState<Bus | null>(null);
  const [route,      setRoute]      = useState<Route | null>(null);
  const [company,    setCompany]    = useState<Company | null>(null);

  const [selectedSeats,    setSelectedSeats]    = useState<string[]>([]);
  const [passengerForms,   setPassengerForms]   = useState<PassengerFormState[]>([]);
  const [currentStep,      setCurrentStep]      = useState<"seats" | "passengers" | "confirm">("seats");
  const [reservationId,    setReservationId]    = useState<string | null>(null);

  // PAY-2: Server-confirmed booking values — never trust client-calculated price
  const [confirmedBookingId,     setConfirmedBookingId]     = useState<string | null>(null);
  const [serverTotalAmount,      setServerTotalAmount]      = useState<number | null>(null);
  const [serverCurrency,         setServerCurrency]         = useState<string>("MWK");

  const [normalisedStops,      setNormalisedStops]      = useState<NormalisedStop[]>([]);
  const [originStopId,         setOriginStopId]         = useState<string>("");
  const [destinationStopId,    setDestinationStopId]    = useState<string>("");
  // displayPrice is for UI only — the authoritative amount comes from the server
  const [displayPrice,         setDisplayPrice]         = useState<number>(0);

  const [loading,          setLoading]          = useState(true);
  const [bookingLoading,   setBookingLoading]   = useState(false);
  const [error,            setError]            = useState("");
  const [passengerError,   setPassengerError]   = useState("");
  const [success,          setSuccess]          = useState("");
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  // FIX UX-1: replaces window.confirm() for duplicate name check
  const [dupNameModalOpen, setDupNameModalOpen] = useState(false);
  const [pendingPassengerSubmit, setPendingPassengerSubmit] = useState(false);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const formatTime = (timestamp: any) => {
    if (!timestamp) return "N/A";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    } catch { return "N/A"; }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    } catch { return "N/A"; }
  };

  const formatDuration = (minutes: number) => {
    if (!minutes || minutes < 0) return "N/A";
    const h = Math.floor(minutes / 60); const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const stopName = (stopId: string) =>
    normalisedStops.find(n => n.id === stopId)?.name ?? stopId;

  // ── Seat reservation ───────────────────────────────────────────────────────

  const holdSeats = useCallback(async (seats: string[]) => {
    if (!schedule || !user) throw new Error("Missing schedule or user information");
    
    try {
      const response = await fetch("/api/bookings/reserve-seats", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scheduleId: schedule.id,
          seatNumbers: seats,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || "Failed to reserve seats");
      }

      setReservationId(result.reservationId);
    } catch (error: any) {
      throw new Error(error.message || "Failed to reserve seats");
    }
  }, [schedule, user]);

  const releaseSeats = useCallback(async () => {
    if (!reservationId || !user) return;
    try {
      await fetch(`/api/bookings/reserve-seats/${reservationId}/release`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      setReservationId(null);
    } catch (e) { 
      console.error("Failed to release seats:", e); 
    }
  }, [reservationId, user]);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchBookingData = async () => {
    if (!scheduleId || typeof scheduleId !== "string") {
      setError("Invalid schedule ID"); setLoading(false); return;
    }
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/bookings/details/${scheduleId}`);
      
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to load booking information");
      }

      const { schedule: scheduleData, bus: busData, route: routeData, company: companyData } = await response.json();

      if (!scheduleData || !busData || !routeData || !companyData) {
        throw new Error("Incomplete booking information");
      }

      if ((scheduleData.availableSeats || 0) < passengers) {
        throw new Error(`Not enough seats. Only ${scheduleData.availableSeats || 0} available.`);
      }

      // Transform API response (already has correct field names)
      const schedule = {
        id: scheduleData.id,
        departureDateTime: new Date(scheduleData.departureDateTime),
        arrivalDateTime: new Date(scheduleData.arrivalDateTime),
        availableSeats: scheduleData.availableSeats,
        bookedSeats: scheduleData.bookedSeats,
        price: scheduleData.price,
        baseFare: scheduleData.baseFare,
        segmentPrices: scheduleData.segmentPrices,
        departureLocation: scheduleData.departureLocation,
        arrivalLocation: scheduleData.arrivalLocation,
        busId: busData.id,
        routeId: routeData.id,
        companyId: companyData.id,
      } as unknown as Schedule;

      setSchedule(schedule);
      setBus(busData as Bus);
      setRoute(routeData as Route);
      setCompany(companyData as Company);
    } catch (e: any) {
      setError(e.message || "Error loading booking information");
    } finally { 
      setLoading(false); 
    }
  };

  // ── Stop / display price effects ───────────────────────────────────────────

  useEffect(() => {
    if (!route) return;
    const stops = buildNormalisedStops(route);
    setNormalisedStops(stops);
    setOriginStopId(stops[0].id);
    setDestinationStopId(stops[stops.length - 1].id);
  }, [route]);

  useEffect(() => {
    if (!route || !normalisedStops.length || !originStopId || !destinationStopId) return;
    const originStop = normalisedStops.find(s => s.id === originStopId);
    const destStop   = normalisedStops.find(s => s.id === destinationStopId);
    if (!originStop || !destStop || originStop.distanceFromOrigin >= destStop.distanceFromOrigin) {
      setDisplayPrice(0); return;
    }
    const isFullTrip = originStop.id === "__origin__" && destStop.id === "__destination__";
    const segmentPrices: Record<string, number> = (schedule as any)?.segmentPrices ?? {};
setDisplayPrice(calcSegmentPrice(
  originStop.distanceFromOrigin, destStop.distanceFromOrigin,
  route, schedule?.price ?? 0, isFullTrip,
  normalisedStops, originStopId, destinationStopId, segmentPrices
));
  }, [originStopId, destinationStopId, normalisedStops, route, schedule]);

  // ── Passenger form helpers ─────────────────────────────────────────────────

  const handlePassengerFieldChange = (
    index: number, field: keyof PassengerFormState, value: string
  ) => {
    setPassengerForms(prev => prev.map((p, i) => i !== index ? p : { ...p, [field]: value }));
  };

  const handleAgeBlur = (index: number) => {
    setPassengerForms(prev => prev.map((p, i) => {
      if (i !== index) return p;
      const parsed = parseInt(p.ageInput, 10);
      const clamped = isNaN(parsed) ? 1 : Math.min(120, Math.max(1, parsed));
      return { ...p, age: clamped, ageInput: String(clamped) };
    }));
  };

  // ── Booking flow handlers ──────────────────────────────────────────────────

  const handleSeatSelection = useCallback((seats: string[]) => {
    setError("");
    if (seats.length !== passengers) {
      setError(`Please select exactly ${passengers} seat${passengers > 1 ? "s" : ""}.`); return;
    }
    if (new Set(seats).size !== seats.length) {
      setError("Duplicate seats selected. Please choose different seats."); return;
    }
    if (schedule?.bookedSeats?.some(s => seats.includes(s))) {
      setError("One or more selected seats are already booked."); return;
    }
    if (!originStopId || !destinationStopId) {
      setError("Please select boarding and alighting stops."); return;
    }
    holdSeats(seats)
      .then(() => {
        setSelectedSeats(seats);
        setCurrentStep("passengers");
        setPassengerForms(seats.map(seat => ({
          name: "", ageInput: "18", age: 18,
          gender: "male" as const, seatNumber: seat, ticketType: "adult" as const,
        })));
      })
      .catch(err => setError(err.message || "Failed to reserve seats. Please try again."));
  }, [passengers, schedule?.bookedSeats, holdSeats, originStopId, destinationStopId]);

  // Core passenger validation — returns true if valid, false if not
  const validatePassengers = (): boolean => {
    setPassengerError("");
    if (passengerForms.length !== passengers) {
      setPassengerError(`Please provide details for exactly ${passengers} passenger${passengers > 1 ? "s" : ""}.`);
      return false;
    }
    const missing = passengerForms.some(p => !p.name.trim() || !p.ageInput || !p.gender || !p.seatNumber);
    if (missing) {
      setPassengerError("Please fill in all required fields for every passenger.");
      return false;
    }
    const ageVals = passengerForms.map(p => parseInt(p.ageInput, 10));
    if (ageVals.some(a => isNaN(a) || a < 1 || a > 120)) {
      setPassengerError("Please enter a valid age (1–120) for each passenger.");
      return false;
    }
    return true;
  };

  const proceedToConfirm = useCallback(() => {
    // Commit numeric ages
    setPassengerForms(prev => prev.map(p => ({
      ...p,
      age: Math.min(120, Math.max(1, parseInt(p.ageInput, 10) || 18)),
    })));
    setCurrentStep("confirm");
    setConfirmModalOpen(true);
  }, []);

  const handlePassengerSubmit = useCallback(() => {
    if (!validatePassengers()) return;
    // FIX UX-1: replaced window.confirm() with Modal
    const names = passengerForms.map(p => p.name.trim().toLowerCase());
    const hasDuplicates = new Set(names).size !== names.length && passengers > 1;
    if (hasDuplicates) {
      setPendingPassengerSubmit(true);
      setDupNameModalOpen(true);
      return;
    }
    proceedToConfirm();
  }, [passengerForms, passengers, proceedToConfirm]);

  // ── confirmBooking — PAY-2 fix ─────────────────────────────────────────────
  // Previously this wrote totalAmount: calculatedPrice * passengers directly
  // to Firestore from the client. A buyer could manipulate calculatedPrice
  // in DevTools and pay any amount they wanted.
  //
  // Now we call POST /api/bookings/create which reads baseFare from Firestore
  // server-side and returns the authoritative bookingId + totalAmount.
  // The client displays the server's amount and never supplies a price.

  const confirmBooking = async () => {
    setBookingLoading(true);
    setError("");
    try {
      if (!user?.id) throw new Error("User authentication required");
      if (!schedule || !selectedSeats.length || !passengerForms.length)
        throw new Error("Missing booking information");
      if (!originStopId || !destinationStopId)
        throw new Error("Please select boarding and alighting stops");

      const response = await fetch("/api/bookings/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scheduleId: schedule.id,
          routeId:    schedule.routeId,
          companyId:  schedule.companyId,
          seatNumbers: selectedSeats,
          passengerDetails: passengerForms.map(p => ({
            firstName:  p.name.trim().split(" ")[0] || p.name.trim(),
            lastName:   p.name.trim().split(" ").slice(1).join(" ") || "",
            age:        Math.min(120, Math.max(1, parseInt(p.ageInput, 10) || p.age)),
            gender:     p.gender,
            seatNumber: p.seatNumber,
            ticketType: p.ticketType,
            originStopId,
            destinationStopId,
            originStopName:      stopName(originStopId),
            destinationStopName: stopName(destinationStopId),
          })),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Booking failed (${response.status})`);
      }

      // Store server-returned values for display — never calculate these client-side
      setConfirmedBookingId(result.bookingId);
      setServerTotalAmount(result.totalAmount);
      setServerCurrency(result.currency ?? "MWK");

      setSuccess("Booking created successfully! Redirecting to payment…");
      setConfirmModalOpen(false);

      // Redirect to payment page with the server-issued bookingId
      // The payment page must read totalAmount from the booking document,
      // never from a query param or local state.
      setTimeout(() => router.push(`/bookings`), 1500);
    } catch (e: any) {
      console.error("Error creating booking:", e);
      setError(`Failed to create booking: ${e.message || "Unknown error"}`);
    } finally {
      setBookingLoading(false);
    }
  };

  // ── Navigation ─────────────────────────────────────────────────────────────

  const goBackToSeats = () => {
    setCurrentStep("seats"); setError(""); setPassengerError("");
    if (selectedSeats.length > 0) {
      releaseSeats().catch(console.error);
      setSelectedSeats([]);
    }
  };

  const goBackToPassengers = () => {
    setCurrentStep("passengers"); setConfirmModalOpen(false); setError("");
  };

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) { router.push("/register"); return; }
    if (passengers < 1 || passengers > 10) {
      setError("Invalid passenger count. Please select between 1 and 10 passengers.");
      setTimeout(() => router.push("/search"), 3000);
    }
  }, [user, passengers, router]);

  useEffect(() => {
    if (user && scheduleId && passengers >= 1 && passengers <= 10) fetchBookingData();
  }, [scheduleId, user]);

  useEffect(() => {
    if (error)   { const t = setTimeout(() => setError(""),   5000); return () => clearTimeout(t); }
  }, [error]);
  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(""), 5000); return () => clearTimeout(t); }
  }, [success]);

  // ── Render: loading ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-6">
            <Card><CardContent className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="space-y-3"><div className="h-6 bg-gray-200 rounded w-3/4" /><div className="h-4 bg-gray-200 rounded w-1/2" /></div>
                <div className="text-center space-y-3"><div className="h-6 bg-gray-200 rounded w-1/3 mx-auto" /></div>
                <div className="text-right space-y-3"><div className="h-6 bg-gray-200 rounded w-1/4 ml-auto" /></div>
              </div>
            </CardContent></Card>
          </div>
        </div>
      </div>
    );
  }

  if (!schedule || !bus || !route || !company) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md"><CardContent className="p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Booking Not Available</h2>
          <p className="text-gray-600 mb-6">{error || "Could not load booking. Please try again."}</p>
          <div className="space-y-3">
            <Button onClick={() => window.location.reload()} className="w-full">Try Again</Button>
            <Button onClick={() => router.push("/search")} variant="outline" className="w-full">Back to Search</Button>
          </div>
        </CardContent></Card>
      </div>
    );
  }

  const availableDestinations = normalisedStops.filter(s => {
    const origin = normalisedStops.find(n => n.id === originStopId);
    return origin && s.distanceFromOrigin > origin.distanceFromOrigin;
  });

  const boardingStopName  = originStopId      ? stopName(originStopId)      : route.origin;
  const alightingStopName = destinationStopId ? stopName(destinationStopId) : route.destination;
  const isPartialSegment  = originStopId !== "__origin__" || destinationStopId !== "__destination__";

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

        {/* ── Trip Information Header ── */}
        <Card className="mb-6 shadow-lg border-0">
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shrink-0">
                  <span className="text-white font-bold text-xl">{company.name?.charAt(0) || "?"}</span>
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-gray-900">{company.name}</h1>
                  <p className="text-sm text-gray-600">{bus.licensePlate} · {bus.busType || "Standard"}</p>
                  <div className="flex items-center mt-1">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span className="text-sm text-gray-600 ml-1">4.5 (120 reviews)</span>
                  </div>
                </div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <div className="text-center">
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">{formatTime(schedule.departureDateTime)}</p>
                    <p className="text-sm text-gray-600 flex items-center justify-center gap-1">
                      <MapPin className="w-3 h-3 text-green-600" />
                      <span className="font-medium text-green-700 truncate max-w-[100px]">{boardingStopName}</span>
                    </p>
                  </div>
                  <div className="flex-1 max-w-20 relative">
                    <div className="border-t-2 border-gray-300" />
                    <ArrowRight className="w-4 h-4 text-gray-400 absolute -top-2 left-1/2 -translate-x-1/2 bg-white" />
                    <p className="text-xs text-gray-500 mt-1">{formatDuration(route.duration)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">{formatTime(schedule.arrivalDateTime)}</p>
                    <p className="text-sm text-gray-600 flex items-center justify-center gap-1">
                      <MapPin className="w-3 h-3 text-red-500" />
                      <span className="font-medium text-red-600 truncate max-w-[100px]">{alightingStopName}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <p className="text-sm text-gray-600">{formatDate(schedule.departureDateTime)}</p>
                </div>
                {isPartialSegment && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs text-amber-700 font-medium">
                    <MapPin className="w-3 h-3" /> Partial segment
                  </div>
                )}
              </div>
              <div className="text-center lg:text-right">
                {/* Display estimate only — server price shown after booking created */}
                <p className="text-xs text-gray-400 mb-1">Estimated price</p>
                <p className="text-2xl sm:text-3xl font-bold text-blue-600">
                  MWK {displayPrice > 0 ? displayPrice.toLocaleString() : "—"}
                </p>
                <p className="text-sm text-gray-600">per person</p>
                <div className="flex items-center justify-center lg:justify-end gap-2 mt-2">
                  <Users className="w-4 h-4 text-gray-500" />
                  <p className="text-sm text-gray-600">{passengers} passenger{passengers > 1 ? "s" : ""}</p>
                </div>
                {displayPrice > 0 && (
                  <p className="text-sm text-gray-500 mt-1">
                    Est. total: MWK {(displayPrice * passengers).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
            {bus.amenities && bus.amenities.length > 0 && (
              <div className="mt-5 pt-4 border-t">
                <div className="flex flex-wrap gap-2">
                  {bus.amenities.slice(0, 6).map((amenity, i) => (
                    <Badge key={i} variant="secondary" className="px-3 py-1">{amenity}</Badge>
                  ))}
                  {bus.amenities.length > 6 && (
                    <Badge variant="outline" className="px-3 py-1">+{bus.amenities.length - 6} more</Badge>
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
                <MapPin className="w-5 h-5 text-blue-600" /> Pick-up &amp; Drop-off Stops
              </h3>
              <p className="text-sm text-gray-500 mb-4">Select where you will board and alight.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="boardAt" className="mb-1.5 block font-medium">
                    🟢 Pick-up Stop <span className="text-red-500">*</span>
                  </Label>
                  <select
                    id="boardAt" value={originStopId}
                    onChange={e => {
                      setOriginStopId(e.target.value);
                      const newOrigin = normalisedStops.find(s => s.id === e.target.value);
                      const currentDest = normalisedStops.find(s => s.id === destinationStopId);
                      if (newOrigin && currentDest && currentDest.distanceFromOrigin <= newOrigin.distanceFromOrigin)
                        setDestinationStopId("");
                    }}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                    required
                  >
                    {normalisedStops
                      .filter(s => s.id !== normalisedStops[normalisedStops.length - 1].id)
                      .map((stop, idx) => (
                        <option key={stop.id} value={stop.id}>
                          {stop.name}
                          {stop.distanceFromOrigin > 0 && stop.distanceFromOrigin < (route.distance || 0)
                            ? ` (${stop.distanceFromOrigin} km)` : idx === 0 ? " — Start" : ""}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="alightAt" className="mb-1.5 block font-medium">
                    🔴 Drop-off Stop <span className="text-red-500">*</span>
                  </Label>
                  <select
                    id="alightAt" value={destinationStopId}
                    onChange={e => setDestinationStopId(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-sm disabled:opacity-50"
                    required disabled={!originStopId}
                  >
                    <option value="">Select drop-off stop</option>
                    {availableDestinations.map(stop => (
                      <option key={stop.id} value={stop.id}>
                        {stop.name}
                        {stop.distanceFromOrigin > 0 && stop.distanceFromOrigin < (route.distance || 0)
                          ? ` (${stop.distanceFromOrigin} km)` : stop.id === "__destination__" ? " — End" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {originStopId && destinationStopId && displayPrice > 0 && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-between gap-2 text-sm text-blue-800">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="font-medium">{stopName(originStopId)}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="font-medium">{stopName(destinationStopId)}</span>
                  </div>
                  <span className="font-bold text-blue-700 shrink-0">
                    ~MWK {displayPrice.toLocaleString()} / person
                  </span>
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
                { step: 1, title: "Select Seats",      key: "seats"      },
                { step: 2, title: "Passenger Details", key: "passengers" },
                { step: 3, title: "Confirm & Submit",  key: "confirm"    },
              ].map(({ step, title, key }, idx) => {
                const isActive    = currentStep === key;
                const isCompleted =
                  (key === "seats"      && (currentStep === "passengers" || currentStep === "confirm")) ||
                  (key === "passengers" && currentStep === "confirm");
                return (
                  <div key={step} className="flex items-center gap-2 sm:gap-3">
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-semibold transition-all text-sm sm:text-base ${
                      isActive ? "bg-blue-600 text-white shadow-lg scale-110" :
                      isCompleted ? "bg-green-600 text-white" : "bg-gray-200 text-gray-600"
                    }`}>
                      {isCompleted ? <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" /> : step}
                    </div>
                    <span className={`font-medium text-xs sm:text-sm hidden sm:block ${
                      isActive ? "text-blue-600" : isCompleted ? "text-green-600" : "text-gray-400"
                    }`}>{title}</span>
                    {idx < 2 && <div className="w-6 sm:w-10 h-px bg-gray-200 hidden sm:block" />}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ── Alerts ── */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50"><CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-red-700 whitespace-pre-wrap font-medium text-sm">{error}</p>
            </div>
          </CardContent></Card>
        )}
        {success && (
          <Card className="mb-6 border-green-200 bg-green-50"><CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
              <p className="text-green-700 text-sm">{success}</p>
            </div>
          </CardContent></Card>
        )}

        {/* ── Step content ── */}
        <div className="space-y-6">

          {/* Step 1 — Seat selection */}
          {currentStep === "seats" && (
            <SeatSelection
              bus={bus} schedule={schedule} passengers={passengers}
              onSeatSelection={handleSeatSelection}
              selectedSeats={selectedSeats}
              originStopId={originStopId}
              destinationStopId={destinationStopId}
              route={route}
            />
          )}

          {/* Step 2 — Passenger details */}
          {currentStep === "passengers" && (
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" /> Passenger Details
                  </CardTitle>
                  <Button variant="outline" onClick={goBackToSeats} className="flex items-center gap-2 w-full sm:w-auto">
                    <ArrowLeft className="w-4 h-4" /> Back to Seats
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4 p-3 bg-gray-50 rounded-lg border text-sm text-gray-600 space-y-1">
                  <p>Selected seats: <span className="font-semibold">{selectedSeats.join(", ")}</span></p>
                  <p className="flex items-center gap-1.5 flex-wrap">
                    <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                    <span>Pick-up: <span className="font-semibold text-green-700">{boardingStopName}</span></span>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                    <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                    <span>Drop-off: <span className="font-semibold text-red-600">{alightingStopName}</span></span>
                  </p>
                </div>
                <InlinePassengerForm
                  passengers={passengers} formState={passengerForms}
                  onChange={handlePassengerFieldChange} onAgeBlur={handleAgeBlur}
                  onSubmit={handlePassengerSubmit} onBack={goBackToSeats}
                  loading={bookingLoading} error={passengerError}
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── FIX UX-1: Duplicate name confirmation modal ── */}
        <Modal
          isOpen={dupNameModalOpen}
          onClose={() => { setDupNameModalOpen(false); setPendingPassengerSubmit(false); }}
          title="Duplicate Passenger Names"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              You have entered duplicate passenger names. Is this intentional?
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline" className="flex-1"
                onClick={() => { setDupNameModalOpen(false); setPendingPassengerSubmit(false); }}
              >
                Go Back &amp; Edit
              </Button>
              <Button
                className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => {
                  setDupNameModalOpen(false);
                  setPendingPassengerSubmit(false);
                  proceedToConfirm();
                }}
              >
                Yes, Continue
              </Button>
            </div>
          </div>
        </Modal>

        {/* ── Step 3: Confirm booking modal ── */}
        {confirmModalOpen && (
          <Modal
            isOpen={confirmModalOpen}
            onClose={() => { if (!bookingLoading) setConfirmModalOpen(false); }}
            title="Confirm Booking Details"
          >
            <div className="space-y-5">
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-blue-700 font-medium">
                  Review all details before submitting. The final price will be confirmed by the server.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-green-50 border border-green-100 rounded-lg">
                  <p className="text-xs text-gray-500 mb-0.5">Pick-up Stop</p>
                  <p className="font-semibold text-sm text-green-800">{stopName(originStopId)}</p>
                </div>
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
                  <p className="text-xs text-gray-500 mb-0.5">Drop-off Stop</p>
                  <p className="font-semibold text-sm text-red-800">{stopName(destinationStopId)}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-0.5">Departure</p>
                  <p className="font-semibold text-sm">{formatDate(schedule.departureDateTime)}</p>
                  <p className="text-sm text-blue-600 font-medium">{formatTime(schedule.departureDateTime)}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-0.5">Seats</p>
                  <p className="font-semibold text-sm">{selectedSeats.join(", ")}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 col-span-full">
                  <p className="text-xs text-gray-500 mb-0.5">Price</p>
                  {serverTotalAmount !== null ? (
                    <>
                      <p className="text-lg font-bold text-blue-600">
                        {serverCurrency} {serverTotalAmount.toLocaleString()}
                      </p>
                      <p className="text-xs text-green-600 font-medium">✓ Server-confirmed price</p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">Will be confirmed on submission</p>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Passengers</p>
                <div className="space-y-2">
                  {passengerForms.map((p, i) => (
                    <div key={i} className="p-3 bg-gray-50 rounded-lg flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-sm">{p.name}</p>
                        <p className="text-xs text-gray-500">Age {p.ageInput} · {p.gender}</p>
                      </div>
                      <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-1 rounded shrink-0">
                        Seat {p.seatNumber}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t">
                <Button onClick={goBackToPassengers} variant="outline" className="flex-1" disabled={bookingLoading}>
                  Edit Details
                </Button>
                <Button
                  onClick={confirmBooking}
                  className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
                  disabled={bookingLoading}
                >
                  {bookingLoading
                    ? <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Creating booking…</span>
                      </span>
                    : <span className="flex items-center justify-center gap-2">
                        <CreditCard className="w-4 h-4" /> Submit &amp; Pay
                      </span>
                  }
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
}