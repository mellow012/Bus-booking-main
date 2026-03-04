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
  ArrowLeft,
} from "lucide-react";

// ================================
// CONSTANTS
// ================================
const BOOKING_STATUS = {
  PENDING:   "pending",
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

interface NormalisedStop {
  id: string;
  name: string;
  distanceFromOrigin: number;
  order: number;
}

// Extended passenger details used internally — age stored as string
// so the input can be edited freely (e.g. "2" → "20") without snapping.
// We convert to number only when submitting.
interface PassengerFormState {
  name: string;
  ageInput: string;      // ← string while editing
  age: number;           // ← numeric, kept in sync on blur
  gender: "male" | "female" | "other";
  seatNumber: string;
  ticketType: "adult" | "child" | "senior";
}

// ================================
// HELPERS
// ================================

function buildNormalisedStops(route: Route): NormalisedStop[] {
  const stops: NormalisedStop[] = [];

  stops.push({
    id: "__origin__",
    name: route.origin,
    distanceFromOrigin: 0,
    order: -1,
  });

  const intermediate = (route.stops ?? [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  intermediate.forEach((s, i) => {
    stops.push({
      id: s.id,
      name: s.name,
      distanceFromOrigin:
        s.distanceFromOrigin > 0
          ? s.distanceFromOrigin
          : Math.round(
              ((i + 1) / (intermediate.length + 1)) * (route.distance || 100)
            ),
      order: i,
    });
  });

  stops.push({
    id: "__destination__",
    name: route.destination,
    distanceFromOrigin: route.distance || 100,
    order: intermediate.length,
  });

  return stops;
}

function calcSegmentPrice(
  originDist: number,
  destDist: number,
  route: Route,
  schedulePrice: number,
  isFullTrip: boolean
): number {
  if (isFullTrip) return schedulePrice;

  const segmentKm = Math.max(0, destDist - originDist);
  const totalKm = route.distance || 0;

  if (route.pricePerKm && route.pricePerKm > 0 && segmentKm > 0) {
    return Math.round((route.baseFare || 0) + segmentKm * route.pricePerKm);
  }

  if (totalKm > 0 && segmentKm > 0) {
    const fraction = segmentKm / totalKm;
    const base = route.baseFare ? route.baseFare * fraction : 0;
    return Math.round(base + schedulePrice * fraction);
  }

  return schedulePrice;
}

// ================================
// INLINE PASSENGER FORM
// ================================
// We inline a minimal passenger form here so we can own the age input state
// as a string. If your PassengerForm component also exists, you can replace
// this with it — but you'll need to apply the same ageInput string fix there.

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

        {/* Full Name */}
        <div>
          <Label htmlFor={`name-${i}`} className="mb-1 block text-sm">
            Full Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id={`name-${i}`}
            value={p.name}
            onChange={e => onChange(i, "name", e.target.value)}
            placeholder="e.g. Chisomo Banda"
            className="h-10"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Age — string-driven input */}
          <div>
            <Label htmlFor={`age-${i}`} className="mb-1 block text-sm">
              Age <span className="text-red-500">*</span>
            </Label>
            <Input
              id={`age-${i}`}
              type="text"            // ← text, NOT number
              inputMode="numeric"    // ← numeric keyboard on mobile
              pattern="[0-9]*"
              value={p.ageInput}
              onChange={e => {
                // Only allow digits, no decimals, no negatives
                const val = e.target.value.replace(/\D/g, "");
                onChange(i, "ageInput", val);
              }}
              onBlur={() => onAgeBlur(i)}
              placeholder="e.g. 28"
              className="h-10"
              required
            />
          </div>

          {/* Gender */}
          <div>
            <Label htmlFor={`gender-${i}`} className="mb-1 block text-sm">
              Gender <span className="text-red-500">*</span>
            </Label>
            <select
              id={`gender-${i}`}
              value={p.gender}
              onChange={e => onChange(i, "gender", e.target.value)}
              className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              required
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        {/* Ticket type */}
        <div>
          <Label htmlFor={`ticket-${i}`} className="mb-1 block text-sm">Ticket Type</Label>
          <select
            id={`ticket-${i}`}
            value={p.ticketType}
            onChange={e => onChange(i, "ticketType", e.target.value)}
            className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
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
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
        {error}
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

  // Core data
  const [schedule, setSchedule]   = useState<Schedule | null>(null);
  const [bus, setBus]             = useState<Bus | null>(null);
  const [route, setRoute]         = useState<Route | null>(null);
  const [company, setCompany]     = useState<Company | null>(null);

  // Booking flow
  const [selectedSeats,    setSelectedSeats]    = useState<string[]>([]);
  const [passengerForms,   setPassengerForms]   = useState<PassengerFormState[]>([]);
  const [currentStep,      setCurrentStep]      = useState<"seats" | "passengers" | "confirm">("seats");
  const [reservationId,    setReservationId]    = useState<string | null>(null);

  // Stop selection
  const [normalisedStops,  setNormalisedStops]  = useState<NormalisedStop[]>([]);
  const [originStopId,     setOriginStopId]     = useState<string>("");
  const [destinationStopId, setDestinationStopId] = useState<string>("");
  const [calculatedPrice,  setCalculatedPrice]  = useState<number>(0);

  // UI
  const [loading,          setLoading]          = useState(true);
  const [bookingLoading,   setBookingLoading]   = useState(false);
  const [error,            setError]            = useState("");
  const [passengerError,   setPassengerError]   = useState("");
  const [success,          setSuccess]          = useState("");
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  // ── Utility ────────────────────────────────────────────────────────────────

  const generateTxRef = () => {
    const ts  = Date.now().toString(36);
    const rnd = Math.random().toString(36).substring(2, 8);
    return `TX${ts}${rnd}`.toUpperCase();
  };

  const generateBookingReference = () => {
    const ts  = Date.now().toString(36);
    const rnd = Math.random().toString(36).substring(2, 8);
    return `BK${ts}${rnd}`.toUpperCase();
  };

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

    const userSnap = await getDoc(doc(db, "users", user.uid));
    if (!userSnap.exists()) throw new Error("User profile not found");

    const role = userSnap.data()?.role;
    if (role !== "customer") {
      const labels: Record<string, string> = {
        operator: "Bus Operator", conductor: "Bus Conductor",
        company_admin: "Company Administrator", superadmin: "Super Administrator",
      };
      throw new Error(
        `❌ Access Denied\n\nYou are logged in as a ${labels[role] || role}. Only customer accounts can book bus tickets.\n\nPlease log out and create a customer account to book tickets.`
      );
    }

    const newReservationId = `${schedule.id}_${user.uid}_${crypto.randomUUID()}`;
    await setDoc(doc(db, "seatReservations", newReservationId), {
      scheduleId: schedule.id, customerId: user.uid,
      seatNumbers: seats, status: "reserved",
      expiresAt: Timestamp.fromDate(new Date(Date.now() + SEAT_HOLD_DURATION)),
      createdAt: serverTimestamp(),
    });
    setReservationId(newReservationId);
  }, [schedule, user]);

  const releaseSeats = useCallback(async () => {
    if (!reservationId) return;
    try {
      await updateDoc(doc(db, "seatReservations", reservationId), {
        status: "released", updatedAt: serverTimestamp(),
      });
      setReservationId(null);
    } catch (e) { console.error("Failed to release seats:", e); }
  }, [reservationId]);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchBookingData = async () => {
    if (!scheduleId || typeof scheduleId !== "string") {
      setError("Invalid schedule ID"); setLoading(false); return;
    }
    setLoading(true); setError("");
    try {
      const scheduleDoc = await getDoc(doc(db, "schedules", scheduleId));
      if (!scheduleDoc.exists()) throw new Error("Schedule not found");

      const scheduleData = { id: scheduleDoc.id, ...scheduleDoc.data() } as Schedule;
      if (!scheduleData.busId || !scheduleData.routeId || !scheduleData.companyId)
        throw new Error("Schedule data is incomplete");
      if ((scheduleData.availableSeats || 0) < passengers)
        throw new Error(`Not enough available seats. Only ${scheduleData.availableSeats || 0} seats available.`);

      const depTime = (scheduleData.departureDateTime as any)?.toDate
        ? (scheduleData.departureDateTime as any).toDate()
        : new Date(scheduleData.departureDateTime);
      if (depTime < new Date()) throw new Error("This schedule has already departed");

      setSchedule(scheduleData);

      const [busDoc, routeDoc, companyDoc] = await Promise.all([
        getDoc(doc(db, "buses",     scheduleData.busId)),
        getDoc(doc(db, "routes",    scheduleData.routeId)),
        getDoc(doc(db, "companies", scheduleData.companyId)),
      ]);
      if (!busDoc.exists())     throw new Error("Bus information not found");
      if (!routeDoc.exists())   throw new Error("Route information not found");
      if (!companyDoc.exists()) throw new Error("Company information not found");

      setBus(    { id: busDoc.id,     ...busDoc.data()     } as Bus);
      setRoute(  { id: routeDoc.id,   ...routeDoc.data()   } as Route);
      setCompany({ id: companyDoc.id, ...companyDoc.data() } as Company);
    } catch (e: any) {
      console.error("Error fetching booking data:", e);
      setError(e.message || "Error loading booking information");
    } finally { setLoading(false); }
  };

  // ── Stop / price effects ───────────────────────────────────────────────────

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
      setCalculatedPrice(0); return;
    }
    const isFullTrip = originStop.id === "__origin__" && destStop.id === "__destination__";
    setCalculatedPrice(calcSegmentPrice(
      originStop.distanceFromOrigin, destStop.distanceFromOrigin,
      route, schedule?.price ?? 0, isFullTrip
    ));
  }, [originStopId, destinationStopId, normalisedStops, route, schedule]);

  // ── Passenger form helpers ─────────────────────────────────────────────────

  const handlePassengerFieldChange = (
    index: number,
    field: keyof PassengerFormState,
    value: string
  ) => {
    setPassengerForms(prev => prev.map((p, i) =>
      i !== index ? p : { ...p, [field]: value }
    ));
  };

  // On age blur: parse ageInput string to a number and store it
  const handleAgeBlur = (index: number) => {
    setPassengerForms(prev => prev.map((p, i) => {
      if (i !== index) return p;
      const parsed = parseInt(p.ageInput, 10);
      const clamped = isNaN(parsed) ? 1 : Math.min(120, Math.max(1, parsed));
      return { ...p, age: clamped, ageInput: String(clamped) };
    }));
  };

  // ── Booking flow handlers ──────────────────────────────────────────────────

  const handleSeatSelection = useCallback(
    (seats: string[]) => {
      setError("");

      if (seats.length !== passengers) {
        setError(`Please select exactly ${passengers} seat${passengers > 1 ? "s" : ""}.`); return;
      }
      if (new Set(seats).size !== seats.length) {
        setError("Duplicate seats selected. Please choose different seats."); return;
      }
      if (schedule?.bookedSeats?.some(s => seats.includes(s))) {
        setError("One or more selected seats are already booked. Please choose different seats."); return;
      }
      if (!originStopId || !destinationStopId) {
        setError("Please select boarding and alighting stops."); return;
      }

      holdSeats(seats)
        .then(() => {
          setSelectedSeats(seats);
          setCurrentStep("passengers");
          // Initialise passenger form state with string-based age
          setPassengerForms(seats.map(seat => ({
            name: "", ageInput: "18", age: 18,
            gender: "male" as const,
            seatNumber: seat, ticketType: "adult" as const,
          })));
        })
        .catch(err => setError(err.message || "Failed to reserve seats. Please try again."));
    },
    [passengers, schedule?.bookedSeats, holdSeats, originStopId, destinationStopId]
  );

  const handlePassengerSubmit = useCallback(() => {
    setPassengerError("");

    if (passengerForms.length !== passengers) {
      setPassengerError(`Please provide details for exactly ${passengers} passenger${passengers > 1 ? "s" : ""}.`); return;
    }

    const missing = passengerForms.some(p => !p.name.trim() || !p.ageInput || !p.gender || !p.seatNumber);
    if (missing) { setPassengerError("Please fill in all required fields for every passenger."); return; }

    const ageVals = passengerForms.map(p => parseInt(p.ageInput, 10));
    if (ageVals.some(a => isNaN(a) || a < 1 || a > 120)) {
      setPassengerError("Please enter a valid age (1–120) for each passenger."); return;
    }

    const names = passengerForms.map(p => p.name.trim().toLowerCase());
    if (new Set(names).size !== names.length && passengers > 1) {
      if (!window.confirm("You have duplicate passenger names. Is this intentional?")) return;
    }

    // Commit numeric ages before proceeding
    setPassengerForms(prev => prev.map(p => ({
      ...p,
      age: Math.min(120, Math.max(1, parseInt(p.ageInput, 10) || 18)),
    })));

    setCurrentStep("confirm");
    setConfirmModalOpen(true);
  }, [passengerForms, passengers]);

  const confirmBooking = async () => {
    setBookingLoading(true); setError("");
    try {
      if (!user?.uid) throw new Error("User authentication required");
      if (!schedule || !selectedSeats.length || !passengerForms.length)
        throw new Error("Missing booking information");
      if (!originStopId || !destinationStopId)
        throw new Error("Please select boarding and alighting stops");
      if (calculatedPrice < 0) throw new Error("Invalid price calculation");

      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (!userSnap.exists()) throw new Error("User document not found in /users collection!");
      if (userSnap.data()?.role !== "customer")
        throw new Error(`User role is "${userSnap.data()?.role}", expected "customer"`);

      const scheduleRef  = doc(db, "schedules", schedule.id);
      const scheduleSnap = await getDoc(scheduleRef);
      if (!scheduleSnap.exists()) throw new Error("Schedule not found");

      const currentData = scheduleSnap.data();
      const conflicting = selectedSeats.filter(s => (currentData.bookedSeats || []).includes(s));
      if (conflicting.length > 0) throw new Error(`Seats ${conflicting.join(", ")} are no longer available`);
      if (currentData.availableSeats < selectedSeats.length) throw new Error("Not enough available seats");

      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(scheduleRef);
        if (!snap.exists()) throw new Error("Schedule not found");
        const latest = snap.data();
        const stillConflicting = selectedSeats.filter(s => (latest.bookedSeats || []).includes(s));
        if (stillConflicting.length > 0)
          throw new Error(`Seats ${stillConflicting.join(", ")} were just booked by someone else`);

        const txRef         = generateTxRef();
        const bookingRefStr = generateBookingReference();

        const bookingData = {
          userId: user.uid, scheduleId: schedule.id, companyId: schedule.companyId,
          bookingReference: bookingRefStr, transactionReference: txRef,
          passengerDetails: passengerForms.map(p => ({
            name:          p.name.trim(),
            age:           Math.min(120, Math.max(1, parseInt(p.ageInput, 10) || p.age)),
            gender:        p.gender,
            seatNumber:    p.seatNumber,
          })),
          seatNumbers: selectedSeats,
          originStopId,      destinationStopId,
          originStopName:    stopName(originStopId),
          destinationStopName: stopName(destinationStopId),
          pricePerPerson:    calculatedPrice,
          totalAmount:       calculatedPrice * passengers,
          bookingStatus:     BOOKING_STATUS.PENDING,
          paymentStatus:     "pending",
          bookingDate:       new Date(),
          createdAt:         serverTimestamp(),
          updatedAt:         serverTimestamp(),
        };

        transaction.set(doc(db, "bookings", txRef), bookingData);
        transaction.update(scheduleRef, {
          bookedSeats:    arrayUnion(...selectedSeats),
          availableSeats: increment(-selectedSeats.length),
          updatedAt:      serverTimestamp(),
        });
      });

      setSuccess("Booking request submitted successfully! Redirecting to your bookings…");
      setConfirmModalOpen(false);
      setTimeout(() => router.push("/bookings"), 2000);
    } catch (e: any) {
      console.error("Error creating booking:", e);
      setError(`Failed to submit booking request: ${e.message || "Unknown error"}`);
    } finally { setBookingLoading(false); }
  };

  // ── Navigation ─────────────────────────────────────────────────────────────

  const goBackToSeats = () => {
    setCurrentStep("seats"); setError(""); setPassengerError("");
    if (selectedSeats.length > 0) { releaseSeats().catch(console.error); setSelectedSeats([]); }
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
                <div className="text-center space-y-3"><div className="h-6 bg-gray-200 rounded w-1/3 mx-auto" /><div className="h-4 bg-gray-200 rounded w-2/3 mx-auto" /></div>
                <div className="text-right space-y-3"><div className="h-6 bg-gray-200 rounded w-1/4 ml-auto" /><div className="h-4 bg-gray-200 rounded w-1/2 ml-auto" /></div>
              </div>
            </CardContent></Card>
            <Card><CardContent className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded" />)}
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
          <p className="text-gray-600 mb-6">{error || "The requested booking could not be loaded. Please try again."}</p>
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

  // Resolved stop names for display in header
  const boardingStopName  = originStopId      ? stopName(originStopId)      : route.origin;
  const alightingStopName = destinationStopId ? stopName(destinationStopId) : route.destination;
  const isPartialSegment  =
    originStopId !== "__origin__" || destinationStopId !== "__destination__";

  // ── Main render ────────────────────────────────────────────────────────────

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
                  <span className="text-white font-bold text-xl">{company.name?.charAt(0) || "?"}</span>
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-gray-900">{company.name || "Unknown Company"}</h1>
                  <p className="text-sm text-gray-600">{bus.licensePlate || "N/A"} · {bus.busType || "Standard"}</p>
                  <div className="flex items-center mt-1">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span className="text-sm text-gray-600 ml-1">4.5 (120 reviews)</span>
                  </div>
                </div>
              </div>

              {/* Route — shows actual boarding/alighting stops */}
              <div className="text-center">
                <div className="flex items-center justify-center gap-3 sm:gap-4 mb-2">

                  {/* Departure side */}
                  <div className="text-center">
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">
                      {formatTime(schedule.departureDateTime)}
                    </p>
                    {/* Stop label — shows boarding stop, not just route origin */}
                    <p className="text-sm text-gray-600 flex items-center justify-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0 text-green-600" />
                      <span className="truncate max-w-[90px] sm:max-w-[120px] font-medium text-green-700">
                        {boardingStopName}
                      </span>
                    </p>
                    {/* Show full route origin if it differs */}
                    {isPartialSegment && originStopId !== "__origin__" && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        from {route.origin}
                      </p>
                    )}
                  </div>

                  {/* Arrow + duration */}
                  <div className="flex-1 max-w-16 sm:max-w-24 relative">
                    <div className="border-t-2 border-gray-300" />
                    <ArrowRight className="w-4 h-4 text-gray-400 absolute -top-2 left-1/2 -translate-x-1/2 bg-white" />
                    <p className="text-xs text-gray-500 mt-1">{formatDuration(route.duration)}</p>
                  </div>

                  {/* Arrival side */}
                  <div className="text-center">
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">
                      {formatTime(schedule.arrivalDateTime)}
                    </p>
                    {/* Stop label — shows alighting stop, not just route destination */}
                    <p className="text-sm text-gray-600 flex items-center justify-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0 text-red-500" />
                      <span className="truncate max-w-[90px] sm:max-w-[120px] font-medium text-red-600">
                        {alightingStopName}
                      </span>
                    </p>
                    {/* Show full route destination if it differs */}
                    {isPartialSegment && destinationStopId !== "__destination__" && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        to {route.destination}
                      </p>
                    )}
                  </div>
                </div>

                {/* Date */}
                <div className="flex items-center justify-center gap-2 mt-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <p className="text-sm text-gray-600">{formatDate(schedule.departureDateTime)}</p>
                </div>

                {/* Partial segment badge */}
                {isPartialSegment && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs text-amber-700 font-medium">
                    <MapPin className="w-3 h-3" />
                    Partial segment
                  </div>
                )}
              </div>

              {/* Pricing — with stop labels */}
              <div className="text-center lg:text-right">
                <p className="text-2xl sm:text-3xl font-bold text-blue-600">
                  MWK {calculatedPrice > 0 ? calculatedPrice.toLocaleString() : "—"}
                </p>
                <p className="text-sm text-gray-600">per person</p>

                {/* Boarding / alighting labels — always visible in pricing column */}
                <div className="mt-2 space-y-1 text-xs text-gray-500 lg:text-right">
                  <div className="flex items-center justify-center lg:justify-end gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                    <span>Boarding: <span className="font-semibold text-gray-700">{boardingStopName}</span></span>
                  </div>
                  <div className="flex items-center justify-center lg:justify-end gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                    <span>Alighting: <span className="font-semibold text-gray-700">{alightingStopName}</span></span>
                  </div>
                </div>

                <div className="flex items-center justify-center lg:justify-end gap-2 mt-2">
                  <Users className="w-4 h-4 text-gray-500" />
                  <p className="text-sm text-gray-600">{passengers} passenger{passengers > 1 ? "s" : ""}</p>
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
                <MapPin className="w-5 h-5 text-blue-600" />
                Pick-up &amp; Drop-off Stops
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Select where you will board and alight — you are not limited to the route terminals.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {/* Pick-up stop */}
                <div>
                  <Label htmlFor="boardAt" className="mb-1.5 block font-medium">
                    🟢 Pick-up Stop <span className="text-red-500">*</span>
                  </Label>
                  <select
                    id="boardAt"
                    value={originStopId}
                    onChange={e => {
                      setOriginStopId(e.target.value);
                      const newOrigin = normalisedStops.find(s => s.id === e.target.value);
                      const currentDest = normalisedStops.find(s => s.id === destinationStopId);
                      if (newOrigin && currentDest && currentDest.distanceFromOrigin <= newOrigin.distanceFromOrigin) {
                        setDestinationStopId("");
                      }
                    }}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm"
                    required
                  >
                    {normalisedStops
                      .filter(s => s.id !== normalisedStops[normalisedStops.length - 1].id)
                      .map((stop, idx) => (
                        <option key={stop.id} value={stop.id}>
                          {stop.name}
                          {stop.distanceFromOrigin > 0 && stop.distanceFromOrigin < (route.distance || 0)
                            ? ` (${stop.distanceFromOrigin} km)`
                            : idx === 0 ? " — Start" : ""}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Drop-off stop */}
                <div>
                  <Label htmlFor="alightAt" className="mb-1.5 block font-medium">
                    🔴 Drop-off Stop <span className="text-red-500">*</span>
                  </Label>
                  <select
                    id="alightAt"
                    value={destinationStopId}
                    onChange={e => setDestinationStopId(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    required
                    disabled={!originStopId}
                  >
                    <option value="">Select drop-off stop</option>
                    {availableDestinations.map(stop => (
                      <option key={stop.id} value={stop.id}>
                        {stop.name}
                        {stop.distanceFromOrigin > 0 && stop.distanceFromOrigin < (route.distance || 0)
                          ? ` (${stop.distanceFromOrigin} km)`
                          : stop.id === "__destination__" ? " — End" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Segment summary */}
              {originStopId && destinationStopId && calculatedPrice > 0 && (
                <div className="mt-4 p-3 sm:p-4 bg-blue-50 border border-blue-100 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm text-blue-800">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
                    <span className="font-medium">{stopName(originStopId)}</span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                    <span className="font-medium">{stopName(destinationStopId)}</span>
                  </div>
                  <span className="text-sm font-bold text-blue-700 shrink-0">
                    MWK {calculatedPrice.toLocaleString()} / person
                  </span>
                </div>
              )}

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
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-200 text-sm sm:text-base ${
                      isActive    ? "bg-blue-600 text-white shadow-lg scale-110" :
                      isCompleted ? "bg-green-600 text-white" :
                      "bg-gray-200 text-gray-600"
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

        {/* ── Global error / success ── */}
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

          {/* Step 2 — Passenger details (inline form with string-age fix) */}
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
                {/* Segment reminder */}
                <div className="mb-4 p-3 bg-gray-50 rounded-lg border text-sm text-gray-600 space-y-1">
                  <p>Selected seats: <span className="font-semibold">{selectedSeats.join(", ")}</span></p>
                  <p className="flex items-center gap-1.5 flex-wrap">
                    <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                    <span>Pick-up: <span className="font-semibold text-green-700">{boardingStopName}</span></span>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-400 mx-0.5" />
                    <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                    <span>Drop-off: <span className="font-semibold text-red-600">{alightingStopName}</span></span>
                    <span className="ml-1 font-semibold text-blue-600">· MWK {calculatedPrice.toLocaleString()} / person</span>
                  </p>
                </div>

                <InlinePassengerForm
                  passengers={passengers}
                  formState={passengerForms}
                  onChange={handlePassengerFieldChange}
                  onAgeBlur={handleAgeBlur}
                  onSubmit={handlePassengerSubmit}
                  onBack={goBackToSeats}
                  loading={bookingLoading}
                  error={passengerError}
                />
              </CardContent>
            </Card>
          )}

          {/* Step 3 — Confirmation modal */}
          {confirmModalOpen && (
            <Modal
              isOpen={confirmModalOpen}
              onClose={() => { if (!bookingLoading) setConfirmModalOpen(false); }}
              title="Confirm Booking Details"
            >
              <div className="space-y-5">
                <div className="bg-blue-50 p-3 sm:p-4 rounded-lg">
                  <p className="text-sm text-blue-700 font-medium">
                    Please review all details before submitting your booking request.
                  </p>
                </div>

                {/* Trip summary */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-green-50 border border-green-100 rounded-lg">
                    <p className="text-xs text-gray-500 mb-0.5 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Pick-up Stop</p>
                    <p className="font-semibold text-sm text-green-800">{stopName(originStopId)}</p>
                  </div>
                  <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
                    <p className="text-xs text-gray-500 mb-0.5 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />Drop-off Stop</p>
                    <p className="font-semibold text-sm text-red-800">{stopName(destinationStopId)}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-0.5">Departure</p>
                    <p className="font-semibold text-sm">{formatDate(schedule.departureDateTime)}</p>
                    <p className="text-sm text-blue-600 font-medium">{formatTime(schedule.departureDateTime)}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-0.5">Arrival (Est.)</p>
                    <p className="font-semibold text-sm">{formatDate(schedule.arrivalDateTime)}</p>
                    <p className="text-sm text-blue-600 font-medium">{formatTime(schedule.arrivalDateTime)}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-0.5">Seats</p>
                    <p className="font-semibold text-sm">{selectedSeats.join(", ")}</p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-xs text-gray-500 mb-0.5">Total Amount</p>
                    <p className="text-lg font-bold text-blue-600">MWK {(calculatedPrice * passengers).toLocaleString()}</p>
                    <p className="text-xs text-gray-500">{passengers} × MWK {calculatedPrice.toLocaleString()}</p>
                  </div>
                </div>

                {/* Passengers */}
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

                {/* Actions */}
                <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t">
                  <Button onClick={goBackToPassengers} variant="outline" className="flex-1" disabled={bookingLoading}>
                    Edit Details
                  </Button>
                  <Button onClick={confirmBooking} className="flex-1 bg-blue-600 text-white hover:bg-blue-700" disabled={bookingLoading}>
                    {bookingLoading
                      ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Submitting…</span></span>
                      : "Submit Request"
                    }
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