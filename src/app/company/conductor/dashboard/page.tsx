"use client";

import { FC, useState, useEffect, useCallback, useMemo } from "react";
import {
  collection, query, where, onSnapshot, doc,
  updateDoc, getDocs, addDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { useAuth } from "@/contexts/AuthContext";
import { Schedule, Booking, Bus, TripStop, buildTripStopSequence } from "@/types";
import {
  Bus as BusIcon, Calendar, Clock, MapPin, Users,
  CheckCircle, XCircle, Loader2, AlertCircle,
  DollarSign, Bell, Check, UserX, Lock, Banknote,
  ArrowRight, CreditCard, UserPlus, ChevronLeft,
  ChevronRight, Ticket, Info, Navigation, Flag,
  PlayCircle, StopCircle, ChevronDown, ArrowRightCircle,
  Radio, Flame, CalendarClock, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Modal from "@/components/Modals";
import { format } from "date-fns";
import { toast } from "react-hot-toast";
import {
  logPassengerBoarded, logPassengerNoShow, logPaymentCollected,
} from "../../../../../src/utils/AuditLogs";

// ─── Types ────────────────────────────────────────────────────────────────────

type WalkOnStep = "seat" | "details" | "payment" | "confirm";

interface WalkOnFormData {
  firstName: string;
  lastName: string;
  phone: string;
  sex: "male" | "female" | "other" | "";
  age: string;
  amountPaid: string;
  originStopId: string;
  destinationStopId: string;
}

// ─── Trip Control Panel ───────────────────────────────────────────────────────
// Renders the start/depart/arrive controls above the manifest.

interface TripControlPanelProps {
  trip: Schedule;
  stopSequence: TripStop[];
  onStartTrip: () => Promise<void>;
  onDepart: () => Promise<void>;
  onArriveAtNext: () => Promise<void>;
  loading: boolean;
}

const TripControlPanel: FC<TripControlPanelProps> = ({
  trip, stopSequence, onStartTrip, onDepart, onArriveAtNext, loading,
}) => {
  const tripStatus      = trip.tripStatus ?? "scheduled";
  const currentIdx      = trip.currentStopIndex ?? 0;
  const currentStop     = stopSequence[currentIdx];
  const nextStop        = stopSequence[currentIdx + 1] ?? null;
  const isLastStop      = currentIdx >= stopSequence.length - 1;
  const isFinalApproach = nextStop && currentIdx === stopSequence.length - 2;

  // ── Not started ──────────────────────────────────────────────────────────
  if (tripStatus === "scheduled") {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
            <Navigation className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-blue-900 text-base">Trip not started</p>
            <p className="text-sm text-blue-700">
              {trip.departureLocation} → {trip.arrivalLocation}
            </p>
          </div>
        </div>

        {/* Stop progress preview */}
        <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1">
          {stopSequence.map((stop, i) => (
            <div key={stop.id} className="flex items-center gap-1.5 shrink-0">
              <div className="flex flex-col items-center gap-0.5">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-300 border-2 border-gray-400" />
                <p className="text-[10px] text-gray-500 max-w-[60px] text-center leading-tight">{stop.name}</p>
              </div>
              {i < stopSequence.length - 1 && (
                <div className="w-6 h-0.5 bg-gray-300 mb-3" />
              )}
            </div>
          ))}
        </div>

        <Button
          className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 text-base font-semibold"
          onClick={onStartTrip}
          disabled={loading}
        >
          {loading
            ? <Loader2 className="w-5 h-5 animate-spin mr-2" />
            : <PlayCircle className="w-5 h-5 mr-2" />
          }
          Start Trip from {stopSequence[0]?.name}
        </Button>
      </div>
    );
  }

  // ── Completed ────────────────────────────────────────────────────────────
  if (tripStatus === "completed") {
    return (
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center">
            <Flag className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-green-900 text-base">Trip completed</p>
            <p className="text-sm text-green-700">
              Arrived at {trip.arrivalLocation}
              {trip.tripCompletedAt && ` · ${format(new Date(trip.tripCompletedAt), "HH:mm")}`}
            </p>
          </div>
          <CheckCircle className="w-7 h-7 text-green-600 ml-auto" />
        </div>
      </div>
    );
  }

  // ── Boarding at a stop ───────────────────────────────────────────────────
  if (tripStatus === "boarding") {
    return (
      <div className="bg-gradient-to-r from-green-50 to-teal-50 border border-green-200 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center animate-pulse">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <p className="font-semibold text-green-900 text-base">Boarding open</p>
            </div>
            <p className="text-sm text-green-700 font-medium">
              At: <strong>{currentStop?.name}</strong>
            </p>
          </div>
        </div>

        {/* Route progress */}
        <StopProgressBar stopSequence={stopSequence} currentIdx={currentIdx} departedStops={trip.departedStops ?? []} />

        {nextStop && (
          <p className="text-xs text-gray-500 mt-3 mb-4">
            Next stop: <strong>{nextStop.name}</strong>
            {isFinalApproach && " (final destination)"}
          </p>
        )}

        <Button
          className={`w-full h-11 text-base font-semibold text-white ${
            isFinalApproach
              ? "bg-orange-600 hover:bg-orange-700"
              : "bg-teal-600 hover:bg-teal-700"
          }`}
          onClick={onDepart}
          disabled={loading}
        >
          {loading
            ? <Loader2 className="w-5 h-5 animate-spin mr-2" />
            : <ArrowRightCircle className="w-5 h-5 mr-2" />
          }
          Depart {currentStop?.name}
          {isFinalApproach && " → Final stop"}
        </Button>
      </div>
    );
  }

  // ── In transit ───────────────────────────────────────────────────────────
  if (tripStatus === "in_transit") {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
            <BusIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-blue-900 text-base">🚌 In Transit</p>
            <p className="text-sm text-blue-700">
              Heading to: <strong>{nextStop?.name ?? trip.arrivalLocation}</strong>
            </p>
          </div>
        </div>

        <StopProgressBar stopSequence={stopSequence} currentIdx={currentIdx} departedStops={trip.departedStops ?? []} inTransit />

        <Button
          className={`w-full mt-4 h-11 text-base font-semibold text-white ${
            isLastStop || !nextStop
              ? "bg-green-700 hover:bg-green-800"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
          onClick={onArriveAtNext}
          disabled={loading || !nextStop}
        >
          {loading
            ? <Loader2 className="w-5 h-5 animate-spin mr-2" />
            : isLastStop || (nextStop && currentIdx === stopSequence.length - 2)
            ? <Flag className="w-5 h-5 mr-2" />
            : <MapPin className="w-5 h-5 mr-2" />
          }
          {nextStop
            ? currentIdx === stopSequence.length - 2
              ? `Arrived at ${nextStop.name} — Complete Trip`
              : `Arrived at ${nextStop.name}`
            : "No more stops"
          }
        </Button>
      </div>
    );
  }

  return null;
};

// ─── Stop Progress Bar ────────────────────────────────────────────────────────

const StopProgressBar: FC<{
  stopSequence: TripStop[];
  currentIdx: number;
  departedStops: string[];
  inTransit?: boolean;
}> = ({ stopSequence, currentIdx, departedStops, inTransit = false }) => (
  <div className="flex items-center gap-1 overflow-x-auto pb-1">
    {stopSequence.map((stop, i) => {
      const departed = departedStops.includes(stop.id);
      const isCurrent = i === currentIdx;
      const isAhead = i > currentIdx;

      return (
        <div key={stop.id} className="flex items-center gap-1 shrink-0">
          <div className="flex flex-col items-center gap-0.5">
            <div className={`w-3 h-3 rounded-full border-2 transition-all ${
              departed
                ? "bg-green-500 border-green-600"
                : isCurrent && !inTransit
                ? "bg-blue-500 border-blue-600 scale-125"
                : isCurrent && inTransit
                ? "bg-blue-300 border-blue-400"
                : "bg-gray-200 border-gray-300"
            }`} />
            <p className={`text-[9px] max-w-[52px] text-center leading-tight ${
              departed ? "text-green-700 font-medium" :
              isCurrent ? "text-blue-700 font-semibold" : "text-gray-400"
            }`}>
              {stop.name}
            </p>
          </div>
          {i < stopSequence.length - 1 && (
            <div className={`w-5 h-0.5 mb-3 transition-all ${
              departed ? "bg-green-400" : "bg-gray-200"
            }`} />
          )}
        </div>
      );
    })}
  </div>
);

// ─── Walk-on Booking Modal ────────────────────────────────────────────────────

interface WalkOnModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Schedule | null;
  bus: Bus | null;
  existingBookings: Booking[];
  stopSequence: TripStop[];
  currentStopIndex: number;
  onConfirm: (seatNumber: string, data: WalkOnFormData, amount: number) => Promise<void>;
  loading: boolean;
}

const WalkOnBookingModal: FC<WalkOnModalProps> = ({
  isOpen, onClose, trip, bus, existingBookings, stopSequence, currentStopIndex, onConfirm, loading,
}) => {
  const [step, setStep] = useState<WalkOnStep>("seat");
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
  const [form, setForm] = useState<WalkOnFormData>({
    firstName: "", lastName: "", phone: "",
    sex: "", age: "", amountPaid: String(trip?.price || ""),
    originStopId: "", destinationStopId: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof WalkOnFormData, string>>>({});

  // Remaining stops the passenger can travel to from the current boarding stop
  const boardingStop     = stopSequence[currentStopIndex];
  const remainingStops   = stopSequence.slice(currentStopIndex + 1);

  useEffect(() => {
    if (isOpen) {
      setStep("seat");
      setSelectedSeat(null);
      setForm({
        firstName: "", lastName: "", phone: "", sex: "", age: "",
        amountPaid: String(trip?.price || ""),
        // Origin is always current stop — conductor can't change this
        originStopId: boardingStop?.id ?? "__origin__",
        destinationStopId: remainingStops[remainingStops.length - 1]?.id ?? "__destination__",
      });
      setErrors({});
    }
  }, [isOpen, trip?.price]);

  if (!trip || !bus) return null;

  const fareAmount   = trip.price || 0;
  const parsedAmount = parseFloat(form.amountPaid);
  const change       = parsedAmount > fareAmount ? parsedAmount - fareAmount : 0;

  const departure = trip.departureDateTime instanceof Date
    ? trip.departureDateTime
    : new Date(trip.departureDateTime);

  const validateDetails = () => {
    const errs: Partial<Record<keyof WalkOnFormData, string>> = {};
    if (!form.firstName.trim()) errs.firstName = "Required";
    if (!form.lastName.trim())  errs.lastName  = "Required";
    if (!form.phone.trim())     errs.phone     = "Required";
    if (!form.sex)              errs.sex       = "Required";
    if (!form.age.trim())       errs.age       = "Required";
    else if (isNaN(Number(form.age)) || Number(form.age) < 1 || Number(form.age) > 120)
      errs.age = "Enter a valid age";
    if (!form.destinationStopId) errs.destinationStopId = "Required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validatePayment = () => {
    const errs: Partial<Record<keyof WalkOnFormData, string>> = {};
    if (!form.amountPaid || isNaN(parsedAmount) || parsedAmount <= 0)
      errs.amountPaid = "Enter a valid amount";
    else if (parsedAmount < fareAmount)
      errs.amountPaid = `Minimum MWK ${fareAmount.toLocaleString()} required`;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (step === "seat" && selectedSeat) setStep("details");
    else if (step === "details" && validateDetails()) setStep("payment");
    else if (step === "payment" && validatePayment()) setStep("confirm");
  };

  const handleBack = () => {
    if (step === "details") setStep("seat");
    else if (step === "payment") setStep("details");
    else if (step === "confirm") setStep("payment");
  };

  const handleSubmit = async () => {
    if (!selectedSeat) return;
    await onConfirm(selectedSeat, form, parsedAmount);
    onClose();
  };

  const stepIndex: Record<WalkOnStep, number> = { seat: 0, details: 1, payment: 2, confirm: 3 };
  const stepLabels = ["Seat", "Details", "Payment", "Confirm"];

  const renderScheduleInfo = () => (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
      <div className="flex items-center gap-2 text-blue-800 font-semibold text-sm mb-1">
        <Info className="w-4 h-4" />
        Trip Details
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        <div>
          <p className="text-blue-600 text-xs">Boarding at</p>
          <p className="font-semibold text-blue-900">{boardingStop?.name ?? trip.departureLocation}</p>
        </div>
        <div>
          <p className="text-blue-600 text-xs">Destination</p>
          <p className="font-semibold text-blue-900">
            {remainingStops.find(s => s.id === form.destinationStopId)?.name ?? trip.arrivalLocation}
          </p>
        </div>
        <div>
          <p className="text-blue-600 text-xs">Date</p>
          <p className="font-semibold text-blue-900">{format(departure, "EEE, MMM d yyyy")}</p>
        </div>
        <div>
          <p className="text-blue-600 text-xs">Bus</p>
          <p className="font-semibold text-blue-900">{bus.licensePlate}</p>
        </div>
        <div>
          <p className="text-blue-600 text-xs">Fare</p>
          <p className="font-bold text-blue-900 text-base">MWK {fareAmount.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );

  const renderSeatStep = () => (
    <div className="space-y-4">
      {renderScheduleInfo()}
      <p className="text-sm text-gray-600">
        Tap an available seat to assign it.
      </p>
      <div className="bg-gray-50 rounded-xl border p-5">
        <div className="flex justify-center mb-4">
          <div className="px-4 py-1.5 bg-gray-200 rounded-full text-xs text-gray-600 font-medium flex items-center gap-2">
            <BusIcon className="w-4 h-4" /> Driver's Cab — Front
          </div>
        </div>
        <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          {Array.from({ length: bus.capacity }).map((_, i) => {
            const seatNum = (i + 1).toString();
            const booking = existingBookings.find(
              (b) => b.seatNumbers?.includes(seatNum) && b.bookingStatus !== "cancelled"
            );
            const isTaken    = !!booking;
            const isSelected = selectedSeat === seatNum;

            let cls = "aspect-square rounded-lg flex items-center justify-center font-semibold text-sm border-2 transition-all duration-150 ";
            if (isSelected) {
              cls += "bg-blue-600 border-blue-700 text-white scale-110 shadow-lg";
            } else if (isTaken) {
              if (booking?.bookingStatus === "confirmed")
                cls += "bg-green-500 border-green-600 text-white cursor-not-allowed";
              else if (booking?.bookingStatus === "no-show")
                cls += "bg-red-400 border-red-500 text-white cursor-not-allowed";
              else if (booking?.paymentStatus !== "paid")
                cls += "bg-amber-400 border-amber-500 text-white cursor-not-allowed";
              else
                cls += "bg-blue-400 border-blue-500 text-white cursor-not-allowed";
            } else {
              cls += "bg-white border-gray-300 text-gray-700 hover:border-blue-400 hover:bg-blue-50 cursor-pointer hover:scale-105";
            }

            return (
              <button
                key={seatNum}
                className={cls}
                onClick={() => !isTaken && setSelectedSeat(seatNum)}
                disabled={isTaken}
                title={isTaken ? `Seat ${seatNum} — ${booking?.passengerDetails?.[0]?.name || "Taken"}` : `Seat ${seatNum} — Available`}
              >
                {seatNum}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-3 justify-center text-xs text-gray-600">
          {[
            { color: "bg-white border-2 border-gray-300", label: "Available" },
            { color: "bg-blue-600", label: "Selected" },
            { color: "bg-amber-400", label: "Cash due" },
            { color: "bg-blue-400", label: "Paid" },
            { color: "bg-green-500", label: "Boarded" },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className={`w-3 h-3 rounded ${color} inline-block`} /> {label}
            </span>
          ))}
        </div>
      </div>
      {selectedSeat && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800 font-medium">
          <CheckCircle className="w-4 h-4 text-blue-600" />
          Seat {selectedSeat} selected
        </div>
      )}
    </div>
  );

  const renderDetailsStep = () => (
    <div className="space-y-4">
      {renderScheduleInfo()}
      <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700">
        <Ticket className="w-5 h-5 flex-shrink-0 text-blue-600" />
        <span>Assigning <strong>Seat {selectedSeat}</strong> — enter passenger details below</span>
      </div>

      {/* Destination stop selector — only remaining stops available */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Travelling to <span className="text-red-500">*</span>
        </label>
        <select
          value={form.destinationStopId}
          onChange={e => setForm({ ...form, destinationStopId: e.target.value })}
          className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${
            errors.destinationStopId ? "border-red-400 bg-red-50" : "border-gray-300"
          }`}
        >
          <option value="">Select destination…</option>
          {remainingStops.map(stop => (
            <option key={stop.id} value={stop.id}>{stop.name}</option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Boarding from: <strong>{boardingStop?.name}</strong>
        </p>
        {errors.destinationStopId && <p className="text-xs text-red-600 mt-1">{errors.destinationStopId}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">First Name <span className="text-red-500">*</span></label>
          <input type="text" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })}
            className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.firstName ? "border-red-400 bg-red-50" : "border-gray-300"}`}
            placeholder="John" />
          {errors.firstName && <p className="text-xs text-red-600 mt-1">{errors.firstName}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Last Name <span className="text-red-500">*</span></label>
          <input type="text" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })}
            className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.lastName ? "border-red-400 bg-red-50" : "border-gray-300"}`}
            placeholder="Banda" />
          {errors.lastName && <p className="text-xs text-red-600 mt-1">{errors.lastName}</p>}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number <span className="text-red-500">*</span></label>
        <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
          className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.phone ? "border-red-400 bg-red-50" : "border-gray-300"}`}
          placeholder="+265 999 000 000" />
        {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sex <span className="text-red-500">*</span></label>
          <select value={form.sex} onChange={e => setForm({ ...form, sex: e.target.value as WalkOnFormData["sex"] })}
            className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${errors.sex ? "border-red-400 bg-red-50" : "border-gray-300"}`}>
            <option value="">Select…</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
          {errors.sex && <p className="text-xs text-red-600 mt-1">{errors.sex}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Age <span className="text-red-500">*</span></label>
          <input type="number" value={form.age} onChange={e => setForm({ ...form, age: e.target.value })}
            className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.age ? "border-red-400 bg-red-50" : "border-gray-300"}`}
            placeholder="30" min={1} max={120} />
          {errors.age && <p className="text-xs text-red-600 mt-1">{errors.age}</p>}
        </div>
      </div>
    </div>
  );

  const renderPaymentStep = () => (
    <div className="space-y-4">
      {renderScheduleInfo()}
      <div className="flex items-center gap-3 p-3 bg-gray-50 border rounded-lg">
        <div className="w-10 h-10 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center flex-shrink-0">{selectedSeat}</div>
        <div>
          <p className="font-semibold text-gray-900">{form.firstName} {form.lastName}</p>
          <p className="text-sm text-gray-500">{form.phone} · {form.sex} · {form.age} yrs</p>
          <p className="text-xs text-gray-500">
            {boardingStop?.name} → {remainingStops.find(s => s.id === form.destinationStopId)?.name}
          </p>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount Received (MWK) <span className="text-red-500">*</span></label>
        <div className="relative">
          <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="number" value={form.amountPaid}
            onChange={e => { setForm({ ...form, amountPaid: e.target.value }); setErrors({}); }}
            className={`w-full pl-10 pr-4 py-3 border rounded-xl text-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.amountPaid ? "border-red-400 bg-red-50" : "border-gray-300"}`}
            placeholder={String(fareAmount)} min={0} />
        </div>
        {errors.amountPaid && (
          <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> {errors.amountPaid}</p>
        )}
        {!errors.amountPaid && parsedAmount > 0 && (
          <div className="mt-2 text-sm">
            {change > 0
              ? <p className="text-amber-700 font-medium">💵 Give change: MWK {change.toLocaleString()}</p>
              : parsedAmount === fareAmount
              ? <p className="text-green-700 font-medium">✓ Exact amount</p>
              : null}
          </div>
        )}
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
        <p className="font-medium">Cash only — collect before confirming.</p>
        <p className="mt-0.5 text-amber-700">Once confirmed the booking is created and the passenger is marked as boarded immediately.</p>
      </div>
    </div>
  );

  const renderConfirmStep = () => (
    <div className="space-y-4">
      <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2 text-green-800 font-semibold text-base">
          <CheckCircle className="w-5 h-5" />
          Ready to confirm walk-on booking
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-gray-500">Passenger</p><p className="font-semibold">{form.firstName} {form.lastName}</p></div>
          <div><p className="text-gray-500">Phone</p><p className="font-semibold">{form.phone}</p></div>
          <div><p className="text-gray-500">Sex / Age</p><p className="font-semibold capitalize">{form.sex} · {form.age} yrs</p></div>
          <div><p className="text-gray-500">Seat</p><p className="font-semibold">Seat {selectedSeat}</p></div>
          <div>
            <p className="text-gray-500">Boarding at</p>
            <p className="font-semibold">{boardingStop?.name}</p>
          </div>
          <div>
            <p className="text-gray-500">Destination</p>
            <p className="font-semibold">{remainingStops.find(s => s.id === form.destinationStopId)?.name}</p>
          </div>
          <div><p className="text-gray-500">Amount Paid</p><p className="font-semibold">MWK {parsedAmount.toLocaleString()}</p></div>
          <div>
            <p className="text-gray-500">Change Due</p>
            <p className={`font-semibold ${change > 0 ? "text-amber-700" : ""}`}>
              {change > 0 ? `MWK ${change.toLocaleString()}` : "None"}
            </p>
          </div>
        </div>
      </div>
      <p className="text-sm text-gray-500 text-center">
        Creates the booking, records cash payment, and marks the passenger as <strong>boarded</strong> — all in one step.
      </p>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Walk-on Booking">
      <div className="space-y-5">
        {/* Step indicator */}
        <div className="flex items-center justify-between px-1">
          {stepLabels.map((label, idx) => {
            const current = stepIndex[step];
            const done    = idx < current;
            const active  = idx === current;
            return (
              <div key={label} className="flex items-center">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                    done ? "bg-blue-600 border-blue-600 text-white" :
                    active ? "bg-white border-blue-600 text-blue-600" :
                    "bg-white border-gray-300 text-gray-400"
                  }`}>
                    {done ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                  </div>
                  <span className={`text-xs font-medium ${active ? "text-blue-700" : done ? "text-blue-500" : "text-gray-400"}`}>{label}</span>
                </div>
                {idx < stepLabels.length - 1 && (
                  <div className={`h-0.5 w-10 mx-1 mb-4 rounded ${done ? "bg-blue-500" : "bg-gray-200"}`} />
                )}
              </div>
            );
          })}
        </div>

        <div>
          {step === "seat"    && renderSeatStep()}
          {step === "details" && renderDetailsStep()}
          {step === "payment" && renderPaymentStep()}
          {step === "confirm" && renderConfirmStep()}
        </div>

        <div className="flex gap-3 pt-2 border-t">
          {step !== "seat" ? (
            <Button variant="outline" className="flex-1" onClick={handleBack} disabled={loading}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          ) : (
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>Cancel</Button>
          )}
          {step !== "confirm" ? (
            <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleNext}
              disabled={step === "seat" && !selectedSeat}>
              Continue <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={handleSubmit} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Confirm & Board
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};

// ─── Cash Collection Modal ────────────────────────────────────────────────────

interface CashCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  onConfirm: (bookingId: string, amount: number) => Promise<void>;
  loading: boolean;
}

const CashCollectionModal: FC<CashCollectionModalProps> = ({
  isOpen, onClose, booking, onConfirm, loading,
}) => {
  const [inputAmount, setInputAmount] = useState("");
  const [amountError, setAmountError] = useState("");

  useEffect(() => {
    if (booking) { setInputAmount(String(booking.totalAmount || "")); setAmountError(""); }
  }, [booking]);

  if (!booking) return null;

  const expectedAmount = booking.totalAmount || 0;
  const parsedAmount   = parseFloat(inputAmount);
  const passenger      = booking.passengerDetails?.[0];
  const change         = parsedAmount > expectedAmount ? parsedAmount - expectedAmount : 0;

  const handleConfirm = async () => {
    if (!inputAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setAmountError("Please enter a valid amount"); return;
    }
    if (parsedAmount < expectedAmount) {
      setAmountError(`Amount is less than the fare (MWK ${expectedAmount.toLocaleString()}). Collect the full amount.`); return;
    }
    setAmountError("");
    await onConfirm(booking.id, parsedAmount);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Collect Cash Payment">
      <div className="space-y-5">
        <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
            {booking.seatNumbers?.[0] || "?"}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{passenger?.name || "Passenger"}</p>
            <p className="text-sm text-gray-500">{booking.contactPhone || "No contact"}</p>
            <p className="text-sm text-gray-500">Seat {booking.seatNumbers?.join(", ") || "?"}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Fare Due</p>
            <p className="text-xl font-bold text-gray-900">MWK {expectedAmount.toLocaleString()}</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-400 px-1">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold">1</div>
            <span className="text-amber-700 font-medium">Collect Cash</span>
          </div>
          <ArrowRight className="w-4 h-4" />
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-bold">2</div>
            <span>Mark Boarded / No-Show</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount Received (MWK)</label>
          <div className="relative">
            <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="number" value={inputAmount}
              onChange={e => { setInputAmount(e.target.value); setAmountError(""); }}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              placeholder={String(expectedAmount)} min={0} />
          </div>
          {amountError && <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1"><AlertCircle className="w-4 h-4" />{amountError}</p>}
          {change > 0 && !amountError && <p className="mt-1.5 text-sm text-green-700 font-medium">💵 Change to give: MWK {change.toLocaleString()}</p>}
          {parsedAmount === expectedAmount && !amountError && inputAmount && <p className="mt-1.5 text-sm text-green-700 font-medium">✓ Exact amount</p>}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          <p className="font-medium mb-0.5">After collecting payment:</p>
          <p>The <strong>Boarded</strong> and <strong>No-Show</strong> buttons will unlock for this passenger.</p>
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button className="flex-1 bg-amber-600 hover:bg-amber-700 text-white" onClick={handleConfirm} disabled={loading || !inputAmount}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <DollarSign className="w-4 h-4 mr-2" />}
            Confirm Payment
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// ─── Trip Buckets ─────────────────────────────────────────────────────────────
// Groups the conductor's assigned trips into: Live Now / Today / This Week / Completed

type TripBucket = "live" | "today" | "week" | "completed";

const toDate = (v: any): Date => {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  if (typeof v?.toDate === "function") return v.toDate();
  return new Date(v);
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth()    === b.getMonth()    &&
  a.getDate()     === b.getDate();

function getTripBucket(t: Schedule): TripBucket {
  const ts  = t.tripStatus ?? "scheduled";
  const dep = toDate(t.departureDateTime);

  if (ts === "boarding" || ts === "in_transit") return "live";
  if (ts === "completed") return "completed";

  const now = new Date();
  if (isSameDay(dep, now)) return "today";
  return "week";
}

const BUCKET_CFG: Record<TripBucket, {
  label: string; icon: React.ReactNode;
  textCls: string; bgCls: string; borderCls: string; pillCls: string;
}> = {
  live:      { label: "Live Now",   icon: <Radio className="w-4 h-4" />,         textCls: "text-green-800",  bgCls: "bg-green-50",  borderCls: "border-green-200", pillCls: "bg-green-200 text-green-900" },
  today:     { label: "Today",      icon: <Flame className="w-4 h-4" />,          textCls: "text-blue-800",   bgCls: "bg-blue-50",   borderCls: "border-blue-200",  pillCls: "bg-blue-200 text-blue-900"  },
  week:      { label: "This Week",  icon: <CalendarClock className="w-4 h-4" />,  textCls: "text-slate-700",  bgCls: "bg-slate-50",  borderCls: "border-slate-200", pillCls: "bg-slate-200 text-slate-800" },
  completed: { label: "Completed",  icon: <CheckCircle className="w-4 h-4" />,    textCls: "text-gray-600",   bgCls: "bg-gray-50",   borderCls: "border-gray-200",  pillCls: "bg-gray-200 text-gray-700"  },
};

const BUCKET_ORDER: TripBucket[] = ["live", "today", "week", "completed"];

const TripCard: FC<{ trip: Schedule; bus: Bus | undefined; onClick: () => void }> = ({ trip, bus, onClick }) => {
  const dep = toDate(trip.departureDateTime);
  const arr = toDate(trip.arrivalDateTime);
  const ts  = trip.tripStatus ?? "scheduled";
  const bkt = getTripBucket(trip);

  const accentCls =
    bkt === "live"      ? "border-l-green-500" :
    bkt === "today"     ? "border-l-blue-500"  :
    bkt === "completed" ? "border-l-gray-300"  :
    "border-l-slate-300";

  const tsBadgeCls =
    ts === "boarding"   ? "bg-green-100 text-green-800 border-green-200" :
    ts === "in_transit" ? "bg-blue-100 text-blue-800 border-blue-200"   :
    ts === "completed"  ? "bg-gray-100 text-gray-500 border-gray-200"   :
    "bg-slate-100 text-slate-600 border-slate-200";

  const tsLabel =
    ts === "boarding"   ? "🟢 Boarding" :
    ts === "in_transit" ? "🚌 In Transit" :
    ts === "completed"  ? "✓ Completed" :
    "Scheduled";

  const actionLabel = (ts === "boarding" || ts === "in_transit") ? "Manage Trip" : "View Manifest";

  return (
    <div onClick={onClick}
      className={`bg-white rounded-xl border border-l-4 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer ${accentCls} ${bkt === "completed" ? "opacity-70" : ""}`}
    >
      <div className="p-4">
        {/* Route + date */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">
              {trip.departureLocation || "TBD"} → {trip.arrivalLocation || "TBD"}
            </p>
            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
              <BusIcon className="w-3 h-3" /> {bus?.licensePlate ?? "—"} · {bus?.busType ?? "—"}
            </p>
          </div>
          <span className="shrink-0 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-lg whitespace-nowrap">
            {isSameDay(dep, new Date()) ? "Today" : format(dep, "EEE d MMM")}
          </span>
        </div>

        {/* Times */}
        <div className="flex items-center gap-2 text-sm text-gray-700 mb-3">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          <span className="font-semibold">{format(dep, "HH:mm")}</span>
          <ArrowRight className="w-3 h-3 text-gray-400" />
          <span className="font-semibold">{format(arr, "HH:mm")}</span>
        </div>

        {/* Fill bar */}
        {bus?.capacity && (() => {
          const booked = trip.bookedSeats?.length || 0;
          const pct    = Math.min((booked / bus.capacity) * 100, 100);
          return (
            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{booked} booked</span>
                <span>{bus.capacity - booked} seats free</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div className={`h-full rounded-full ${pct > 75 ? "bg-red-400" : pct > 50 ? "bg-amber-400" : "bg-green-400"}`}
                  style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })()}

        {/* Status + action */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${tsBadgeCls}`}>
            {tsLabel}
          </span>
          <span className="text-xs text-blue-600 font-medium hover:underline">{actionLabel} →</span>
        </div>
      </div>
    </div>
  );
};

const TripBuckets: FC<{
  trips: Schedule[];
  buses: Bus[];
  onSelect: (t: Schedule) => void;
}> = ({ trips, buses, onSelect }) => {
  const [collapsed, setCollapsed] = useState<Record<TripBucket, boolean>>({
    live: false, today: false, week: false, completed: true,
  });
  const toggle = (b: TripBucket) => setCollapsed(p => ({ ...p, [b]: !p[b] }));

  const busMap = useMemo(() => new Map(buses.map(b => [b.id, b])), [buses]);

  const bucketed = useMemo(() => {
    const map: Record<TripBucket, Schedule[]> = { live: [], today: [], week: [], completed: [] };
    trips.forEach(t => { const b = getTripBucket(t); map[b].push(t); });
    // Sort each bucket: live/today/week ascending by dep, completed descending
    const asc  = (a: Schedule, b: Schedule) => toDate(a.departureDateTime).getTime() - toDate(b.departureDateTime).getTime();
    const desc = (a: Schedule, b: Schedule) => toDate(b.departureDateTime).getTime() - toDate(a.departureDateTime).getTime();
    map.live.sort(asc); map.today.sort(asc); map.week.sort(asc); map.completed.sort(desc);
    return map;
  }, [trips]);

  const totalActive = bucketed.live.length + bucketed.today.length + bucketed.week.length;

  if (trips.length === 0) {
    return (
      <section>
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          <Calendar className="w-6 h-6 text-blue-600" /> Your Trips
        </h2>
        <div className="bg-white rounded-2xl p-10 text-center border shadow-sm">
          <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-xl font-medium text-gray-700">No trips assigned yet</p>
          <p className="text-gray-500 mt-2 text-sm">Your operator hasn't assigned any upcoming trips to your buses</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <Calendar className="w-6 h-6 text-blue-600" /> Your Trips
        </h2>
        <span className="text-sm text-gray-500">{totalActive} active</span>
      </div>

      <div className="space-y-4">
        {BUCKET_ORDER.map(bucket => {
          const list = bucketed[bucket];
          if (!list.length) return null;
          const cfg = BUCKET_CFG[bucket];

          return (
            <div key={bucket} className="space-y-3">
              {/* Section header */}
              <button
                onClick={() => toggle(bucket)}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border font-medium text-sm transition-all hover:opacity-90 ${cfg.bgCls} ${cfg.borderCls} ${cfg.textCls}`}
              >
                <div className="flex items-center gap-2.5">
                  {cfg.icon}
                  <span className="font-semibold">{cfg.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${cfg.pillCls}`}>{list.length}</span>
                </div>
                {collapsed[bucket]
                  ? <ChevronDown className="w-4 h-4 opacity-50" />
                  : <ChevronUp   className="w-4 h-4 opacity-50" />}
              </button>

              {!collapsed[bucket] && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 pl-1">
                  {list.map(trip => (
                    <TripCard
                      key={trip.id}
                      trip={trip}
                      bus={busMap.get(trip.busId)}
                      onClick={() => onSelect(trip)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────

const ConductorDashboard: FC = () => {
  const { userProfile, user } = useAuth();
  const authUid = user?.uid;
  const conductorName =
    userProfile?.name ||
    `${userProfile?.firstName || ""} ${userProfile?.lastName || ""}`.trim() ||
    "Conductor";

  const [myBuses, setMyBuses]           = useState<Bus[]>([]);
  const [myTrips, setMyTrips]           = useState<Schedule[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<Schedule | null>(null);
  const [tripBookings, setTripBookings] = useState<Booking[]>([]);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [loading, setLoading]           = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [conductorFirestoreId, setConductorFirestoreId] = useState<string | null>(null);
  const [cashModalOpen, setCashModalOpen]       = useState(false);
  const [cashModalBooking, setCashModalBooking] = useState<Booking | null>(null);
  const [walkOnModalOpen, setWalkOnModalOpen]   = useState(false);

  // Build stop sequence from the selected trip whenever it changes
  // This is derived from the stops[] array that was copied from the route on materialisation
  const stopSequence: TripStop[] = selectedTrip ? buildTripStopSequence(selectedTrip) : [];
  const currentStopIndex = selectedTrip?.currentStopIndex ?? 0;

  // ── Load conductor profile ─────────────────────────────────────────────────
  useEffect(() => {
    if (!authUid) { setError("No conductor authentication found – please log in again"); setLoading(false); return; }
    const run = async () => {
      try {
        const snap = await getDocs(query(
          collection(db, "operators"),
          where("uid", "==", authUid),
          where("role", "==", "conductor")
        ));
        if (snap.empty) { setError("Conductor profile not found. Please contact support."); setLoading(false); return; }
        const d = snap.docs[0];
        setConductorFirestoreId(d.data().id || d.id);
      } catch (err: any) { setError(`Failed to load conductor profile: ${err.message}`); setLoading(false); }
    };
    run();
  }, [authUid]);

  // ── Load assigned buses ────────────────────────────────────────────────────
  useEffect(() => {
    if (!conductorFirestoreId) return;
    const unsub = onSnapshot(
      query(collection(db, "buses"), where("conductorIds", "array-contains", conductorFirestoreId), where("status", "==", "active")),
      (snap) => { setMyBuses(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Bus[]); setError(null); },
      (err: any) => { setError(`Failed to load your buses: ${err.message}`); setMyBuses([]); }
    );
    return () => unsub();
  }, [conductorFirestoreId]);

  // ── Load trips (next 7 days) ───────────────────────────────────────────────
  useEffect(() => {
    if (myBuses.length === 0) { setMyTrips([]); setLoading(false); return; }
    const now       = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const nextWeekEnd = new Date(todayStart);
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);

    const run = async () => {
      const all: Schedule[] = [];
      for (const bus of myBuses) {
        try {
          const snap = await getDocs(query(collection(db, "schedules"), where("busId", "==", bus.id)));
          all.push(...snap.docs
            .map(d => {
              const data = d.data();
              return {
                id: d.id, ...data,
                departureDateTime: data.departureDateTime?.toDate?.() || new Date(data.departureDateTime),
                arrivalDateTime:   data.arrivalDateTime?.toDate?.()   || new Date(data.arrivalDateTime),
              } as Schedule;
            })
            .filter(t => {
              const dep = t.departureDateTime instanceof Date ? t.departureDateTime : new Date(t.departureDateTime);
              // Show scheduled/boarding/in_transit trips regardless of departure time
              // so conductor can still manage a trip that started earlier today
              const isLiveTrip = t.tripStatus && t.tripStatus !== "scheduled" && t.tripStatus !== "completed";
              return (isLiveTrip || (dep >= todayStart && dep < nextWeekEnd)) && t.status === "active";
            })
          );
        } catch (e) { console.error(e); }
      }
      all.sort((a, b) => {
        const aD = a.departureDateTime instanceof Date ? a.departureDateTime : new Date(a.departureDateTime);
        const bD = b.departureDateTime instanceof Date ? b.departureDateTime : new Date(b.departureDateTime);
        return aD.getTime() - bD.getTime();
      });
      setMyTrips(all);
      setLoading(false);
    };
    run();
  }, [myBuses]);

  // ── Real-time trip updates (keep selectedTrip in sync with Firestore) ──────
  // When the conductor taps start/depart/arrive, we update Firestore and the
  // onSnapshot here refreshes the local selectedTrip so the UI reflects the change.
  useEffect(() => {
    if (!selectedTrip?.id) return;
    const unsub = onSnapshot(
      doc(db, "schedules", selectedTrip.id),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const updated: Schedule = {
            id: snap.id,
            ...data,
            departureDateTime: data.departureDateTime?.toDate?.() || new Date(data.departureDateTime),
            arrivalDateTime:   data.arrivalDateTime?.toDate?.()   || new Date(data.arrivalDateTime),
          } as Schedule;
          setSelectedTrip(updated);
          // Also update in myTrips list
          setMyTrips(prev => prev.map(t => t.id === updated.id ? updated : t));
        }
      },
      (err) => console.warn("Schedule watch error:", err)
    );
    return () => unsub();
  }, [selectedTrip?.id]);

  // ── Load bookings for selected trip ───────────────────────────────────────
  useEffect(() => {
    if (!selectedTrip?.id) { setTripBookings([]); return; }
    let initialLoad = true;
    const unsub = onSnapshot(
      query(collection(db, "bookings"), where("scheduleId", "==", selectedTrip.id)),
      (snap) => {
        const bookings = snap.docs.map(d => ({
          id: d.id, ...d.data(),
          createdAt: d.data().createdAt?.toDate?.() || new Date(),
        })) as Booking[];
        if (!initialLoad) {
          bookings
            .filter(b => !tripBookings.some(p => p.id === b.id))
            .forEach(b => {
              const name = b.passengerDetails?.[0]?.name || "Passenger";
              toast(`New booking: ${name} • Seat ${b.seatNumbers?.[0] || "?"}`, {
                icon: <Bell className="w-5 h-5 text-blue-600" />, duration: 6000,
              });
              setNotifications(prev => [`New booking: ${name}`, ...prev.slice(0, 4)]);
            });
        }
        setTripBookings(bookings);
        initialLoad = false;
      },
      () => setError("Failed to load manifest")
    );
    return () => unsub();
  }, [selectedTrip?.id]);

  // ── Trip lifecycle actions ─────────────────────────────────────────────────

  const handleStartTrip = useCallback(async () => {
    if (!selectedTrip) return;
    setActionLoading(true);
    try {
      await updateDoc(doc(db, "schedules", selectedTrip.id), {
        tripStatus:       "boarding",
        currentStopIndex: 0,
        departedStops:    [],
        tripStartedAt:    new Date(),
        conductorUid:     authUid ?? "",
        updatedAt:        new Date(),
      });
      toast.success(`Trip started — boarding open at ${stopSequence[0]?.name}`);
    } catch (err: any) {
      toast.error(`Failed to start trip: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  }, [selectedTrip, stopSequence, authUid]);

  const handleDepart = useCallback(async () => {
    if (!selectedTrip) return;
    setActionLoading(true);
    try {
      const currentStop    = stopSequence[currentStopIndex];
      const newDeparted    = [...(selectedTrip.departedStops ?? []), currentStop.id];

      await updateDoc(doc(db, "schedules", selectedTrip.id), {
        tripStatus:    "in_transit",
        departedStops: newDeparted,
        updatedAt:     new Date(),
      });
      toast.success(`Departed ${currentStop.name}`);
    } catch (err: any) {
      toast.error(`Failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  }, [selectedTrip, stopSequence, currentStopIndex]);

  const handleArriveAtNext = useCallback(async () => {
    if (!selectedTrip) return;
    setActionLoading(true);
    try {
      const nextIdx     = currentStopIndex + 1;
      const nextStop    = stopSequence[nextIdx];
      const isFinalStop = nextIdx >= stopSequence.length - 1;

      if (isFinalStop) {
        // Complete the trip
        await updateDoc(doc(db, "schedules", selectedTrip.id), {
          tripStatus:       "completed",
          status:           "completed",
          isCompleted:      true,
          currentStopIndex: nextIdx,
          departedStops:    [...(selectedTrip.departedStops ?? [])],
          tripCompletedAt:  new Date(),
          completedAt:      new Date(),
          updatedAt:        new Date(),
        });
        toast.success(`Trip completed — arrived at ${nextStop?.name ?? selectedTrip.arrivalLocation}`);
      } else {
        // Arrive at intermediate stop — open boarding
        await updateDoc(doc(db, "schedules", selectedTrip.id), {
          tripStatus:       "boarding",
          currentStopIndex: nextIdx,
          updatedAt:        new Date(),
        });
        toast.success(`Arrived at ${nextStop?.name} — boarding open`);
      }
    } catch (err: any) {
      toast.error(`Failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  }, [selectedTrip, stopSequence, currentStopIndex]);

  // ── Passenger actions ──────────────────────────────────────────────────────

  const handleMarkBoarded = async (bookingId: string) => {
    setActionLoading(true);
    try {
      const booking = tripBookings.find(b => b.id === bookingId);
      if (!booking) throw new Error("Booking not found");
      await updateDoc(doc(db, "bookings", bookingId), {
        bookingStatus: "confirmed",
        paymentStatus: booking.paymentStatus,
        paymentMethod: booking.paymentMethod || null,
        paidAmount:    booking.totalAmount || null,
        paidAt:        booking.paidAt || null,
        paidBy:        conductorFirestoreId,
        updatedAt:     new Date(),
        boardedAt:     new Date(),
      });
      setTripBookings(prev => prev.map(b => b.id === bookingId ? { ...b, bookingStatus: "confirmed" } : b));
      await logPassengerBoarded(user?.uid || "", conductorName, userProfile?.role || "conductor",
        userProfile?.companyId || "", bookingId, booking.passengerDetails?.[0]?.name || "Passenger", booking.seatNumbers?.[0] || "?");
      toast.success("Passenger marked as boarded");
    } catch (err: any) { toast.error(`Failed: ${err.message}`); }
    finally { setActionLoading(false); }
  };

  const handleMarkNoShow = async (bookingId: string) => {
    setActionLoading(true);
    try {
      const booking = tripBookings.find(b => b.id === bookingId);
      if (!booking) throw new Error("Booking not found");
      await updateDoc(doc(db, "bookings", bookingId), {
        bookingStatus: "no-show",
        paymentStatus: booking.paymentStatus,
        paymentMethod: booking.paymentMethod || null,
        paidAmount:    booking.totalAmount || null,
        paidAt:        booking.paidAt || null,
        paidBy:        conductorFirestoreId,
        updatedAt:     new Date(),
        noShowAt:      new Date(),
      });
      setTripBookings(prev => prev.map(b => b.id === bookingId ? { ...b, bookingStatus: "no-show" } : b));
      await logPassengerNoShow(user?.uid || "", conductorName, userProfile?.role || "conductor",
        userProfile?.companyId || "", bookingId, booking.passengerDetails?.[0]?.name || "Passenger", booking.seatNumbers?.[0] || "?");
      toast.success("Passenger marked as no-show");
    } catch (err: any) { toast.error(`Failed: ${err.message}`); }
    finally { setActionLoading(false); }
  };

  const handleCollectCash = async (bookingId: string, amount: number) => {
    setActionLoading(true);
    try {
      const booking = tripBookings.find(b => b.id === bookingId);
      if (!booking) throw new Error("Booking not found");
      await updateDoc(doc(db, "bookings", bookingId), {
        bookingStatus: booking.bookingStatus,
        paymentStatus: "paid",
        paymentMethod: "cash_on_boarding",
        paidAmount:    amount,
        paidAt:        new Date(),
        paidBy:        conductorFirestoreId,
        updatedAt:     new Date(),
      });
      setTripBookings(prev => prev.map(b =>
        b.id === bookingId ? { ...b, paymentStatus: "paid", paymentMethod: "cash_on_boarding" } : b
      ));
      await logPaymentCollected(user?.uid || "", conductorName, userProfile?.role || "conductor",
        userProfile?.companyId || "", bookingId, booking.passengerDetails?.[0]?.name || "Passenger", amount, "cash_on_boarding");
      toast.success(`MWK ${amount.toLocaleString()} recorded — now mark boarding status`);
    } catch (err: any) { toast.error(`Failed: ${err.message}`); }
    finally { setActionLoading(false); }
  };

  const handleWalkOnBooking = async (seatNumber: string, data: WalkOnFormData, amount: number) => {
    if (!selectedTrip || !conductorFirestoreId) return;
    setActionLoading(true);
    try {
      const passengerName    = `${data.firstName} ${data.lastName}`.trim();
      const boardingStop     = stopSequence[currentStopIndex];
      const destinationStop  = stopSequence.find(s => s.id === data.destinationStopId);

      const docRef = await addDoc(collection(db, "bookings"), {
        scheduleId:       selectedTrip.id,
        busId:            selectedTrip.busId,
        seatNumbers:      [seatNumber],
        passengerDetails: [{
          name:          passengerName,
          gender:        (data.sex || "other") as "male" | "female" | "other",
          age:           Number(data.age),
          seatNumber:    seatNumber,
          contactNumber: data.phone,
        }],
        contactPhone:     data.phone,
        totalAmount:      selectedTrip.price || amount,
        paidAmount:       amount,
        bookingStatus:    "confirmed",
        paymentStatus:    "paid",
        paymentMethod:    "cash_on_boarding",
        bookedBy:         "conductor",
        createdBy:        "conductor",
        isWalkOn:         true,
        conductorId:      conductorFirestoreId,
        conductorUid:     authUid ?? "",
        paidAt:           new Date(),
        paidBy:           conductorFirestoreId,
        boardedAt:        new Date(),
        // Segment data — where this passenger boarded and where they alight
        originStopId:      boardingStop?.id ?? "__origin__",
        destinationStopId: data.destinationStopId || "__destination__",
        originStopName:    boardingStop?.name ?? selectedTrip.departureLocation,
        destinationStopName: destinationStop?.name ?? selectedTrip.arrivalLocation,
        createdAt:        serverTimestamp(),
        updatedAt:        serverTimestamp(),
        departureLocation: selectedTrip.departureLocation,
        arrivalLocation:   selectedTrip.arrivalLocation,
        departureDateTime: selectedTrip.departureDateTime,
        companyId:        userProfile?.companyId ?? "",
      });

      await updateDoc(doc(db, "schedules", selectedTrip.id), {
        bookedSeats: [...(selectedTrip.bookedSeats || []), seatNumber],
        updatedAt:   new Date(),
      });

      await logPaymentCollected(user?.uid || "", conductorName, userProfile?.role || "conductor",
        userProfile?.companyId || "", docRef.id, passengerName, amount, "cash_on_boarding");
      await logPassengerBoarded(user?.uid || "", conductorName, userProfile?.role || "conductor",
        userProfile?.companyId || "", docRef.id, passengerName, seatNumber);

      toast.success(`Walk-on confirmed — ${passengerName}, Seat ${seatNumber}`);
    } catch (err: any) { toast.error(`Failed to create booking: ${err.message}`); }
    finally { setActionLoading(false); }
  };

  // ── Seat map ───────────────────────────────────────────────────────────────

  const renderSeatMap = () => {
    if (!selectedTrip || !myBuses.length) return null;
    const bus = myBuses.find(b => b.id === selectedTrip.busId);
    if (!bus?.capacity) return null;

    return (
      <div className="mt-6">
        <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
          <BusIcon className="w-5 h-5" /> Seat Map ({bus.capacity} seats)
        </h3>
        <div className="bg-gray-50 p-6 rounded-xl border">
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
            {Array.from({ length: bus.capacity }).map((_, i) => {
              const seatNum = (i + 1).toString();
              const booking = tripBookings.find(b => b.seatNumbers?.includes(seatNum));
              let bg   = "bg-gray-200 border border-gray-300 cursor-default";
              let text = "text-gray-700";
              let icon = null;

              if (booking) {
                if (booking.bookingStatus === "confirmed") {
                  bg = "bg-green-500 border-green-600 cursor-default"; text = "text-white";
                  icon = <CheckCircle className="w-4 h-4" />;
                } else if (booking.bookingStatus === "no-show") {
                  bg = "bg-red-500 border-red-600 cursor-default"; text = "text-white";
                  icon = <XCircle className="w-4 h-4" />;
                } else if (booking.paymentStatus !== "paid") {
                  bg = "bg-amber-400 border-amber-500 cursor-pointer hover:scale-105"; text = "text-white";
                  icon = <DollarSign className="w-4 h-4" />;
                } else {
                  bg = "bg-blue-500 border-blue-600 cursor-default"; text = "text-white";
                }
              }

              return (
                <div
                  key={seatNum}
                  title={booking
                    ? `${booking.passengerDetails?.[0]?.name || "Passenger"} — ${booking.paymentStatus === "paid" ? "Paid" : "Cash due"}`
                    : "Available"}
                  className={`aspect-square rounded-lg flex items-center justify-center font-medium text-sm relative transition-transform ${bg} ${text}`}
                  onClick={() => {
                    if (booking && booking.paymentStatus !== "paid" && booking.bookingStatus !== "cancelled") {
                      setCashModalBooking(booking);
                      setCashModalOpen(true);
                    }
                  }}
                >
                  {seatNum}
                  {icon && <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow">{icon}</div>}
                </div>
              );
            })}
          </div>
          <div className="mt-6 flex flex-wrap gap-4 justify-center text-xs">
            <div className="flex items-center gap-2"><div className="w-4 h-4 bg-gray-200 rounded border border-gray-300" /> Available</div>
            <div className="flex items-center gap-2"><div className="w-4 h-4 bg-amber-400 rounded border border-amber-500" /> Cash Due (tap)</div>
            <div className="flex items-center gap-2"><div className="w-4 h-4 bg-blue-500 rounded border border-blue-600" /> Paid / Ready</div>
            <div className="flex items-center gap-2"><div className="w-4 h-4 bg-green-500 rounded border border-green-600" /> Boarded</div>
            <div className="flex items-center gap-2"><div className="w-4 h-4 bg-red-500 rounded border border-red-600" /> No-Show</div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading your assignments...</p>
        </div>
      </div>
    );
  }

  // ── Walk-on allowed guard ──────────────────────────────────────────────────
  // Walk-ons are only allowed when the bus is actively boarding at a stop.
  // We also block walk-ons if the trip is complete or hasn't started.
  const walkOnAllowed = selectedTrip?.tripStatus === "boarding" || !selectedTrip?.tripStatus || selectedTrip?.tripStatus === "scheduled";

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-8">

        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Welcome, {conductorName}</h1>
          <p className="text-gray-600 mt-2">Your assigned trips & passenger manifest</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div><h3 className="font-medium text-red-900">Error</h3><p className="text-sm text-red-800 mt-1">{error}</p></div>
          </div>
        )}

        {notifications.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="w-5 h-5 text-amber-600" />
              <h3 className="font-medium text-amber-800">Recent Updates</h3>
            </div>
            <ul className="text-sm text-amber-800 space-y-1">{notifications.map((msg, i) => <li key={i}>• {msg}</li>)}</ul>
          </div>
        )}

        {myBuses.length > 0 && (
          <section className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <BusIcon className="w-5 h-5 text-blue-600" />Assigned Buses ({myBuses.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {myBuses.map(bus => (
                <div key={bus.id} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="font-semibold text-blue-900 text-lg">{bus.licensePlate}</p>
                  <div className="text-sm text-blue-700 mt-2 space-y-1">
                    <p>Type: {bus.busType}</p>
                    <p>Capacity: {bus.capacity} seats</p>
                    {bus.amenities?.length > 0 && <p>Amenities: {bus.amenities.join(", ")}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <TripBuckets
          trips={myTrips}
          buses={myBuses}
          onSelect={setSelectedTrip}
        />

        {/* ── Manifest Modal ── */}
        <Modal
          isOpen={!!selectedTrip}
          onClose={() => setSelectedTrip(null)}
          title={`${selectedTrip?.departureLocation || "Trip"} → ${selectedTrip?.arrivalLocation || "Destination"}`}
        >
          {selectedTrip && (
            <div className="space-y-6">
              {/* Trip info */}
              <div className="p-4 bg-gray-50 rounded-lg border">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Bus</p>
                    <p className="font-medium">{myBuses.find(b => b.id === selectedTrip.busId)?.licensePlate || "N/A"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-600">Departure</p>
                    <p className="font-medium">{format(
                      selectedTrip.departureDateTime instanceof Date ? selectedTrip.departureDateTime : new Date(selectedTrip.departureDateTime),
                      "PPp"
                    )}</p>
                  </div>
                </div>
              </div>

              {/* ── Trip Control Panel ── */}
              {stopSequence.length > 0 && (
                <TripControlPanel
                  trip={selectedTrip}
                  stopSequence={stopSequence}
                  onStartTrip={handleStartTrip}
                  onDepart={handleDepart}
                  onArriveAtNext={handleArriveAtNext}
                  loading={actionLoading}
                />
              )}

              {/* Stats */}
              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                  <p className="text-2xl font-bold text-blue-700">{tripBookings.length}</p>
                  <p className="text-xs text-blue-600 mt-0.5">Booked</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                  <p className="text-2xl font-bold text-green-700">{tripBookings.filter(b => b.bookingStatus === "confirmed").length}</p>
                  <p className="text-xs text-green-600 mt-0.5">Boarded</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                  <p className="text-2xl font-bold text-amber-700">{tripBookings.filter(b => b.paymentStatus !== "paid").length}</p>
                  <p className="text-xs text-amber-600 mt-0.5">Cash Due</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                  <p className="text-2xl font-bold text-purple-700">
                    {tripBookings.filter(b => (b as any).bookedBy === "conductor" || b.createdBy === "conductor").length}
                  </p>
                  <p className="text-xs text-purple-600 mt-0.5">Walk-ons</p>
                </div>
              </div>

              {/* Walk-on button — only when boarding is open */}
              {walkOnAllowed && selectedTrip.tripStatus !== "completed" && (
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 text-base"
                  onClick={() => setWalkOnModalOpen(true)}
                >
                  <UserPlus className="w-5 h-5 mr-2" /> Walk-on Booking — Board a New Passenger
                </Button>
              )}

              {/* Walk-on blocked when in transit */}
              {selectedTrip.tripStatus === "in_transit" && (
                <div className="flex items-center gap-2 p-3 bg-gray-50 border rounded-lg text-sm text-gray-600">
                  <Lock className="w-4 h-4" />
                  Walk-on bookings are paused while the bus is in transit. They will reopen at the next stop.
                </div>
              )}

              {renderSeatMap()}

              {/* Passenger manifest */}
              <div>
                <h3 className="font-semibold text-lg mb-3 flex items-center justify-between">
                  <span>Passenger Manifest</span>
                  <span className="text-sm font-normal text-gray-500">
                    {tripBookings.filter(b => b.paymentStatus === "paid").length} / {tripBookings.length} paid
                  </span>
                </h3>

                {tripBookings.length === 0 ? (
                  <div className="text-center py-10 bg-gray-50 rounded-lg border">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600">No passengers booked yet</p>
                    <p className="text-sm text-gray-400 mt-1">Use the walk-on button above to board passengers</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                    {tripBookings.map(booking => {
                      const isPaid      = booking.paymentStatus === "paid";
                      const isConfirmed = booking.bookingStatus === "confirmed";
                      const isNoShow    = booking.bookingStatus === "no-show";
                      const isWalkOn    = (booking as any).bookedBy === "conductor" || booking.createdBy === "conductor";
                      const passenger   = booking.passengerDetails?.[0];

                      // Show segment info if available
                      const originName = (booking as any).originStopName || (booking as any).departureLocation;
                      const destName   = (booking as any).destinationStopName || (booking as any).arrivalLocation;
                      const hasSegment = originName && destName && originName !== destName;

                      return (
                        <div key={booking.id} className={`p-4 rounded-xl border transition-colors ${
                          isConfirmed ? "bg-green-50 border-green-200" :
                          isNoShow    ? "bg-red-50 border-red-200" :
                          !isPaid     ? "bg-amber-50 border-amber-200" :
                                        "bg-white border-gray-200 hover:bg-gray-50"
                        }`}>
                          <div className="flex items-start gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white text-lg flex-shrink-0 ${
                              isConfirmed ? "bg-green-600" : isNoShow ? "bg-red-600" : !isPaid ? "bg-amber-500" : "bg-blue-600"
                            }`}>
                              {booking.seatNumbers?.[0] || "?"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-base flex items-center gap-1.5 flex-wrap">
                                {passenger?.name || "Passenger"}
                                {isWalkOn && (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                                    <UserPlus className="w-3 h-3" /> Walk-on
                                  </span>
                                )}
                                {isConfirmed && <CheckCircle className="w-4 h-4 text-green-600" />}
                                {isNoShow && <XCircle className="w-4 h-4 text-red-600" />}
                              </p>
                              <p className="text-sm text-gray-500">{booking.contactPhone || "No contact"}</p>
                              {hasSegment && (
                                <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                                  <MapPin className="w-3 h-3" /> {originName} → {destName}
                                </p>
                              )}
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-sm font-medium text-gray-700">MWK {booking.totalAmount?.toLocaleString() || "?"}</span>
                                {isPaid ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                                    <CreditCard className="w-3 h-3" />
                                    {booking.paymentMethod === "cash_on_boarding" ? "Cash collected" : "Paid online"}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                    <Banknote className="w-3 h-3" /> Cash pending
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action area */}
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {!isPaid && (
                              <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white"
                                onClick={() => { setCashModalBooking(booking); setCashModalOpen(true); }}
                                disabled={actionLoading}>
                                <Banknote className="w-4 h-4 mr-1.5" /> Collect Cash
                              </Button>
                            )}
                            {isPaid && !isConfirmed && !isNoShow && (
                              <>
                                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                                  onClick={() => handleMarkBoarded(booking.id)} disabled={actionLoading}>
                                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Check className="w-4 h-4 mr-1.5" />}
                                  Boarded
                                </Button>
                                <Button size="sm" variant="destructive"
                                  onClick={() => handleMarkNoShow(booking.id)} disabled={actionLoading}>
                                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <UserX className="w-4 h-4 mr-1.5" />}
                                  No-Show
                                </Button>
                              </>
                            )}
                            {!isPaid && (
                              <span className="inline-flex items-center gap-1 text-xs text-gray-400 ml-1">
                                <Lock className="w-3 h-3" /> Boarding locked until paid
                              </span>
                            )}
                            {isConfirmed && (
                              <span className="text-sm text-green-700 font-medium flex items-center gap-1">
                                <CheckCircle className="w-4 h-4" /> Boarded
                              </span>
                            )}
                            {isNoShow && (
                              <span className="text-sm text-red-700 font-medium flex items-center gap-1">
                                <XCircle className="w-4 h-4" /> No-Show
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setSelectedTrip(null)}>Close</Button>
              </div>
            </div>
          )}
        </Modal>

        {/* ── Walk-on Modal ── */}
        {selectedTrip && (
          <WalkOnBookingModal
            isOpen={walkOnModalOpen}
            onClose={() => setWalkOnModalOpen(false)}
            trip={selectedTrip}
            bus={myBuses.find(b => b.id === selectedTrip.busId) || null}
            existingBookings={tripBookings}
            stopSequence={stopSequence}
            currentStopIndex={currentStopIndex}
            onConfirm={handleWalkOnBooking}
            loading={actionLoading}
          />
        )}

        {/* ── Cash Modal ── */}
        <CashCollectionModal
          isOpen={cashModalOpen}
          onClose={() => { setCashModalOpen(false); setCashModalBooking(null); }}
          booking={cashModalBooking}
          onConfirm={handleCollectCash}
          loading={actionLoading}
        />
      </div>
    </div>
  );
};

export default ConductorDashboard;  