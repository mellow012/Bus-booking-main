"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Schedule, Bus, Route, Company } from "@/types";
import { buildNormalisedStops, calcSegmentPrice } from "./utils";

import type { NormalisedStop } from "./utils";
import type { PassengerFormState } from "./InlinePassengerForm";

export default function useBookBus() {
  const { id: scheduleId } = useParams() as { id: string };
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, userProfile } = useAuth();

  const passengers = parseInt(searchParams?.get("passengers") ?? "1", 10);

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [bus, setBus] = useState<Bus | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [company, setCompany] = useState<Company | null>(null);

  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [passengerForms, setPassengerForms] = useState<PassengerFormState[]>([]);
  const [currentStep, setCurrentStep] = useState<"seats" | "passengers" | "confirm">("seats");
  const [reservationId, setReservationId] = useState<string | null>(null);

  const [confirmedBookingId, setConfirmedBookingId] = useState<string | null>(null);
  const [serverTotalAmount, setServerTotalAmount] = useState<number | null>(null);
  const [serverCurrency, setServerCurrency] = useState<string>("MWK");

  const [normalisedStops, setNormalisedStops] = useState<NormalisedStop[]>([]);
  const [originStopId, setOriginStopId] = useState<string>("");
  const [destinationStopId, setDestinationStopId] = useState<string>("");
  const [displayPrice, setDisplayPrice] = useState<number>(0);

  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [error, setError] = useState("");
  const [passengerError, setPassengerError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [bookingForSelf, setBookingForSelf] = useState(true);

  const [dupNameModalOpen, setDupNameModalOpen] = useState(false);
  const [pendingPassengerSubmit, setPendingPassengerSubmit] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);

  const [wantsReturnTrip, setWantsReturnTrip] = useState(false);
  const [returnDate, setReturnDate] = useState("");

  // ── REFINEMENT: MEMOIZED AVAILABLE DESTINATIONS ───────────────────────────
  const availableDestinations = useMemo(() => {
    const origin = normalisedStops.find((s) => s.id === originStopId);
    if (!origin) return [];
    return normalisedStops.filter((s) => s.distanceFromOrigin > origin.distanceFromOrigin);
  }, [normalisedStops, originStopId]);

  // ── REFINEMENT: UNIFIED STOP CHANGE HANDLER WITH SIDE-EFFECT GUARDRAILS ───
  const handleOriginChange = useCallback((newOriginId: string) => {
    setOriginStopId(newOriginId);
    
    const newOrigin = normalisedStops.find((s) => s.id === newOriginId);
    const currentDest = normalisedStops.find((s) => s.id === destinationStopId);
    
    // Auto-invalidate drop-off selection if user chooses a pick-up downstream from it
    if (newOrigin && currentDest && currentDest.distanceFromOrigin <= newOrigin.distanceFromOrigin) {
      setDestinationStopId("");
    }
  }, [normalisedStops, destinationStopId]);

  const stopName = useCallback((stopId: string) =>
    normalisedStops.find((n) => n.id === stopId)?.name ?? stopId, [normalisedStops]);

  const holdSeats = useCallback(async (seats: string[]) => {
    if (!schedule || !user) throw new Error("Missing schedule or user information");
    try {
      const response = await fetch("/api/bookings/reserve-seats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleId: schedule.id, seatNumbers: seats }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || result.error || "Failed to reserve seats");
      setReservationId(result.reservationId);
    } catch (error: any) {
      throw new Error(error.message || "Failed to reserve seats");
    }
  }, [schedule, user]);

  const releaseSeats = useCallback(async () => {
    if (!reservationId || !user) return;
    try {
      await fetch(`/api/bookings/reserve-seats/${reservationId}/release`, { method: "PATCH", headers: { "Content-Type": "application/json" } });
      setReservationId(null);
    } catch (e) { console.error("Failed to release seats:", e); }
  }, [reservationId, user]);

  const fetchBookingData = useCallback(async () => {
    if (!scheduleId || typeof scheduleId !== "string") { setError("Invalid schedule ID"); setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/bookings/details/${scheduleId}`);
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to load booking information");
      }
      const { schedule: scheduleData, bus: busData, route: routeData, company: companyData } = await response.json();
      if (!scheduleData || !busData || !routeData || !companyData) throw new Error("Incomplete booking information");
      if ((scheduleData.availableSeats || 0) < passengers) throw new Error(`Not enough seats. Only ${scheduleData.availableSeats || 0} available.`);
      const hydratedSchedule = {
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
      setSchedule(hydratedSchedule);
      setBus(busData as Bus);
      setRoute(routeData as Route);
      setCompany(companyData as Company);
    } catch (e: any) {
      setError(e.message || "Error loading booking information");
    } finally { setLoading(false); }
  }, [scheduleId, passengers]);

  useEffect(() => {
    if (!route || !schedule) return;
    let stops = buildNormalisedStops(route);
    const departed = (schedule as any).departedStops || [];
    const currentId = (schedule as any).currentStopId;
    if (departed.length > 0) stops = stops.filter((s) => !departed.includes(s.id));
    if (currentId) {
      const idx = stops.findIndex((s) => s.id === currentId);
      if (idx !== -1) stops = stops.slice(idx);
    }
    setNormalisedStops(stops);
    if (stops.length > 0) {
      setOriginStopId(stops[0].id);
      if (stops.length > 1) setDestinationStopId(stops[stops.length - 1].id);
      else setDestinationStopId("");
    }
  }, [route, schedule]);

  useEffect(() => {
    if (!route || !normalisedStops.length || !originStopId || !destinationStopId) return;
    const originStop = normalisedStops.find((s) => s.id === originStopId);
    const destStop = normalisedStops.find((s) => s.id === destinationStopId);
    if (!originStop || !destStop || originStop.distanceFromOrigin >= destStop.distanceFromOrigin) { setDisplayPrice(0); return; }
    const isFullTrip = originStop.id === "__origin__" && destStop.id === "__destination__";
    const segmentPrices: Record<string, number> = (schedule as any)?.segmentPrices ?? {};
    setDisplayPrice(calcSegmentPrice(
      originStop.distanceFromOrigin, destStop.distanceFromOrigin,
      route, schedule?.price ?? 0, isFullTrip,
      normalisedStops, originStopId, destinationStopId, segmentPrices
    ));
  }, [originStopId, destinationStopId, normalisedStops, route, schedule]);

  const handlePassengerFieldChange = (index: number, field: keyof PassengerFormState, value: string) => {
    setPassengerForms((prev) => prev.map((p, i) => i !== index ? p : { ...p, [field]: value }));
  };

  const handleAgeBlur = (index: number) => {
    setPassengerForms((prev) => prev.map((p, i) => {
      if (i !== index) return p;
      const parsed = parseInt(p.ageInput, 10);
      const clamped = isNaN(parsed) ? 1 : Math.min(120, Math.max(1, parsed));
      return { ...p, age: clamped, ageInput: String(clamped) };
    }));
  };

  const validatePromoCode = async () => {
    if (!promoCode.trim()) return;
    setIsValidatingPromo(true); setError("");
    try {
      const res = await fetch("/api/promotions/validate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoCode, amount: displayPrice * passengers }),
      });
      const result = await res.json();
      if (result.success) { setAppliedPromo(result.data); setSuccess(`Promo code "${result.data.code}" applied!`); }
      else { setError(result.error || "Invalid promo code"); setAppliedPromo(null); }
    } catch (err) { setError("Failed to validate promo code"); }
    finally { setIsValidatingPromo(false); }
  };

  const handleSeatSelection = useCallback((seats: string[]) => {
    setError("");
    if (seats.length !== passengers) { setError(`Please select exactly ${passengers} seat${passengers > 1 ? "s" : ""}.`); return; }
    if (new Set(seats).size !== seats.length) { setError("Duplicate seats selected. Please choose different seats."); return; }
    if (schedule?.bookedSeats?.some((s) => seats.includes(s))) { setError("One or more selected seats are already booked."); return; }
    if (!originStopId || !destinationStopId) { setError("Please select boarding and alighting stops."); return; }
    holdSeats(seats)
      .then(() => {
        setSelectedSeats(seats);
        setCurrentStep("passengers");
        setPassengerForms(seats.map((seat, index) => ({
          name: (index === 0 && bookingForSelf && userProfile) ? `${userProfile.firstName} ${userProfile.lastName}`.trim() : "",
          ageInput: "18", age: 18,
          gender: (index === 0 && bookingForSelf && userProfile?.sex) ? (userProfile.sex.toLowerCase() as any) : ("male" as const),
          seatNumber: seat, ticketType: "adult" as const,
        })));
      })
      .catch((err) => setError(err.message || "Failed to reserve seats. Please try again."));
  }, [passengers, schedule?.bookedSeats, holdSeats, originStopId, destinationStopId, bookingForSelf, userProfile]);

  const toggleBookingForSelf = (val: boolean) => {
    setBookingForSelf(val);
    if (passengerForms.length > 0) {
      setPassengerForms((prev) => prev.map((p, i) => {
        if (i !== 0) return p;
        if (val && userProfile) {
          return { ...p, name: `${userProfile.firstName} ${userProfile.lastName}`.trim(), ageInput: "18", age: 18, gender: (userProfile.sex?.toLowerCase() as any) || "male" };
        } else {
          return { ...p, name: "", ageInput: "18", age: 18, gender: "male" };
        }
      }));
    }
  };

  const validatePassengers = (): boolean => {
    setPassengerError("");
    if (passengerForms.length !== passengers) { setPassengerError(`Please provide details for exactly ${passengers} passenger${passengers > 1 ? "s" : ""}.`); return false; }
    const missing = passengerForms.some((p) => !p.name.trim() || !p.ageInput || !p.gender || !p.seatNumber);
    if (missing) { setPassengerError("Please fill in all required fields for every passenger."); return false; }
    const ageVals = passengerForms.map((p) => parseInt(p.ageInput, 10));
    if (ageVals.some((a) => isNaN(a) || a < 1 || a > 120)) { setPassengerError("Please enter a valid age (1–120) for each passenger."); return false; }
    return true;
  };

  const proceedToConfirm = useCallback(() => {
    setPassengerForms((prev) => prev.map((p) => ({ ...p, age: Math.min(120, Math.max(1, parseInt(p.ageInput, 10) || 18)) })));
    setCurrentStep("confirm"); setConfirmModalOpen(true);
  }, []);

  const handlePassengerSubmit = useCallback(() => {
    if (!validatePassengers()) return;
    const names = passengerForms.map((p) => p.name.trim().toLowerCase());
    const hasDuplicates = new Set(names).size !== names.length && passengers > 1;
    if (hasDuplicates) { setPendingPassengerSubmit(true); setDupNameModalOpen(true); return; }
    proceedToConfirm();
  }, [passengerForms, passengers, proceedToConfirm]);

  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [currentStep]);

  const confirmBooking = async () => {
    setBookingLoading(true); setError("");
    try {
      if (!user?.id) throw new Error("User authentication required");
      if (!schedule || !selectedSeats.length || !passengerForms.length) throw new Error("Missing booking information");
      if (!originStopId || !destinationStopId) throw new Error("Please select boarding and alighting stops");

      const response = await fetch("/api/bookings/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId: schedule.id, routeId: schedule.routeId, companyId: schedule.companyId,
          seatNumbers: selectedSeats,
          passengerDetails: passengerForms.map((p) => ({
            firstName: p.name.trim().split(" ")[0] || p.name.trim(),
            lastName: p.name.trim().split(" ").slice(1).join(" ") || "",
            age: Math.min(120, Math.max(1, parseInt(p.ageInput, 10) || p.age)),
            gender: p.gender, seatNumber: p.seatNumber, ticketType: p.ticketType,
            originStopId, destinationStopId, originStopName: stopName(originStopId), destinationStopName: stopName(destinationStopId),
          })),
          promoCode: appliedPromo?.code,
          returnDate: wantsReturnTrip ? returnDate : undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Booking failed (${response.status})`);

      setConfirmedBookingId(result.bookingId);
      setServerTotalAmount(result.totalAmount);
      setServerCurrency(result.currency ?? "MWK");

      setSuccess("Booking created successfully! Redirecting to payment…");
      setConfirmModalOpen(false);
      setTimeout(() => router.push(`/bookings`), 1500);
    } catch (e: any) {
      console.error("Error creating booking:", e);
      setError(`Failed to create booking: ${e.message || "Unknown error"}`);
    } finally { setBookingLoading(false); }
  };

  const goBackToSeats = () => {
    setCurrentStep("seats"); setError(""); setPassengerError("");
    if (selectedSeats.length > 0) { releaseSeats().catch(console.error); setSelectedSeats([]); }
  };

  const goBackToPassengers = () => { setCurrentStep("passengers"); setConfirmModalOpen(false); setError(""); };

  useEffect(() => {
    if (!user) { router.push("/register"); return; }
    if (passengers < 1 || passengers > 10) {
      setError("Invalid passenger count. Please select between 1 and 10 passengers.");
      setTimeout(() => router.push("/schedules"), 3000);
    }
  }, [user, passengers, router]);

  useEffect(() => { if (user && scheduleId && passengers >= 1 && passengers <= 10) fetchBookingData(); }, [scheduleId, user, fetchBookingData]);

  useEffect(() => { if (error) { const t = setTimeout(() => setError(""), 5000); return () => clearTimeout(t); } }, [error]);
  useEffect(() => { if (success) { window.scrollTo({ top: 0, behavior: "smooth" }); const t = setTimeout(() => setSuccess(""), 5000); return () => clearTimeout(t); } }, [success]);

  return {
    // data
    schedule, bus, route, company,
    passengers,
    // selection
    selectedSeats, setSelectedSeats,
    passengerForms, setPassengerForms,
    currentStep, setCurrentStep,
    reservationId,
    confirmedBookingId, serverTotalAmount, serverCurrency,
    // stops & pricing
    normalisedStops, originStopId, setOriginStopId, destinationStopId, setDestinationStopId,
    availableDestinations, displayPrice,
    // UI state
    loading, bookingLoading, error, setError, passengerError, success, setSuccess,
    confirmModalOpen, setConfirmModalOpen,
    // misc
    bookingForSelf, toggleBookingForSelf,
    dupNameModalOpen, setDupNameModalOpen, pendingPassengerSubmit, setPendingPassengerSubmit,
    promoCode, setPromoCode, appliedPromo, setAppliedPromo, isValidatingPromo,
    wantsReturnTrip, setWantsReturnTrip, returnDate, setReturnDate,
    // helpers/handlers
    holdSeats, releaseSeats, fetchBookingData,
    handleOriginChange, handleSeatSelection, handlePassengerFieldChange, handleAgeBlur, handlePassengerSubmit, proceedToConfirm,
    confirmBooking, goBackToSeats, goBackToPassengers, validatePromoCode, stopName,
  } as const;
}