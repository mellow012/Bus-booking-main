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
  const [selectedReturnSeats, setSelectedReturnSeats] = useState<string[]>([]);
  const [passengerForms, setPassengerForms] = useState<PassengerFormState[]>([]);
  const [currentStep, setCurrentStep] = useState<"seats" | "passengers" | "confirm">("seats");
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [returnReservationId, setReturnReservationId] = useState<string | null>(null);
  const [returnSchedules, setReturnSchedules] = useState<any[]>([]);
  const [returnDateOptions, setReturnDateOptions] = useState<{ date: string; count: number; formatted: string }[]>([]);
  const [returnDateOptionsLoading, setReturnDateOptionsLoading] = useState(false);
  const [returnScheduleLoading, setReturnScheduleLoading] = useState(false);
  const [selectedReturnScheduleId, setSelectedReturnScheduleId] = useState<string>("");
  const [returnSchedule, setReturnSchedule] = useState<Schedule | null>(null);
  const [returnBus, setReturnBus] = useState<Bus | null>(null);
  const [returnRoute, setReturnRoute] = useState<Route | null>(null);
  const [returnScheduleError, setReturnScheduleError] = useState<string>("");

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

  const [wantsReturnTrip, setWantsReturnTrip] = useState(Boolean(searchParams?.get('returnDate')));
  const [returnDate, setReturnDate] = useState(searchParams?.get('returnDate') ?? "");
  const [outboundLocked, setOutboundLocked] = useState(false);
  const [savedOutboundSeats, setSavedOutboundSeats] = useState<string[] | null>(null);

  const toggleWantsReturnTrip = useCallback((value: boolean) => {
    // When enabling return trip and outbound seats are fully selected, lock outbound and save selection
    if (value && selectedSeats.length === passengers && passengers > 0) {
      setSavedOutboundSeats(selectedSeats.slice());
      setOutboundLocked(true);
    } else if (!value) {
      // clearing return trip should unlock outbound and restore saved seats
      setOutboundLocked(false);
      setSavedOutboundSeats(null);
      setReturnDate("");
      setReturnDateOptions([]);
    }
    setWantsReturnTrip(value);
  }, [passengers, selectedSeats]);

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

  const reserveSeats = useCallback(async (scheduleId: string, seats: string[]) => {
    if (!user) throw new Error("User authentication required");
    const response = await fetch("/api/bookings/reserve-seats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduleId, seatNumbers: seats }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || result.error || "Failed to reserve seats");
    return result.reservationId as string;
  }, [user]);

  const releaseReservation = useCallback(async (reservationIdToRelease: string | null) => {
    if (!reservationIdToRelease) return;
    try {
      await fetch(`/api/bookings/reserve-seats/${reservationIdToRelease}/release`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });
    } catch (e) {
      console.error("Failed to release seat reservation:", e);
    }
  }, []);

  const releaseAllHeldSeats = useCallback(async () => {
    await Promise.all([
      releaseReservation(reservationId),
      releaseReservation(returnReservationId),
    ]);
    setReservationId(null);
    setReturnReservationId(null);
  }, [releaseReservation, reservationId, returnReservationId]);

  const fetchReturnSchedules = useCallback(async () => {
    if (!route || !schedule || !wantsReturnTrip || !returnDate) {
      setReturnSchedules([]);
      setSelectedReturnScheduleId("");
      setReturnSchedule(null);
      setReturnBus(null);
      setReturnRoute(null);
      setSelectedReturnSeats([]);
      setReturnScheduleError("");
      return;
    }

    setReturnScheduleLoading(true);
    setReturnScheduleError("");

    try {
      const params = new URLSearchParams({
        from: route.destination || "",
        to: route.origin || "",
        date: returnDate,
        passengers: String(passengers),
        tzOffset: String(new Date().getTimezoneOffset()),
      });
      if (company?.id) {
        params.append('companyId', company.id);
      }

      const response = await fetch(`/api/schedules?${params.toString()}`);
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to load return schedules");
      }

      const data = await response.json();
      const schedules = Array.isArray(data?.data) ? data.data : [];
      setReturnSchedules(schedules);
      if (!schedules.length) {
        setReturnScheduleError("No return schedules found for the selected date and route.");
      }
    } catch (error: any) {
      setReturnSchedules([]);
      setReturnScheduleError(error.message || "Failed to load return schedules");
    } finally {
      setReturnScheduleLoading(false);
    }
  }, [route, schedule, wantsReturnTrip, returnDate, passengers, company]);

  const fetchReturnDateOptions = useCallback(async () => {
    if (!route || !schedule || !wantsReturnTrip) {
      setReturnDateOptions([]);
      return;
    }

    setReturnDateOptionsLoading(true);
    setReturnScheduleError("");

    try {
      const departureDate = new Date(schedule.departureDateTime);
      const startDate = new Date(departureDate);
      startDate.setDate(startDate.getDate() + 1);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);

      const params = new URLSearchParams({
        from: route.destination || "",
        to: route.origin || "",
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        passengers: String(passengers),
        tzOffset: String(new Date().getTimezoneOffset()),
      });
      if (company?.id) {
        params.append('companyId', company.id);
      }

      const response = await fetch(`/api/schedules?${params.toString()}`);
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to load return trip dates");
      }

      const data = await response.json();
      const schedules = Array.isArray(data?.data) ? (data.data as Array<{ date?: string }>) : [];
      const grouped = schedules.reduce<Record<string, { count: number; formatted: string }>>((acc, item) => {
        if (!item?.date) return acc;
        const date = item.date;
        if (!acc[date]) {
          acc[date] = {
            count: 0,
            formatted: new Date(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
          };
        }
        acc[date].count += 1;
        return acc;
      }, {});

      const sorted = Object.entries(grouped)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, option]) => ({ date, ...option }));

      setReturnDateOptions(sorted);
      if (!sorted.length) {
        setReturnScheduleError("No return trip dates available for this company and route in the next week.");
      }
    } catch (error: any) {
      setReturnDateOptions([]);
      setReturnScheduleError(error.message || "Failed to load return trip dates");
    } finally {
      setReturnDateOptionsLoading(false);
    }
  }, [route, schedule, wantsReturnTrip, passengers, company]);

  const fetchScheduleDetails = useCallback(async (scheduleId: string) => {
    setReturnScheduleLoading(true);
    setReturnScheduleError("");
    try {
      const response = await fetch(`/api/bookings/details/${scheduleId}`);
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to fetch schedule details");
      }
      const result = await response.json();
      const { schedule: scheduleData, bus: busData, route: routeData } = result;
      if (!scheduleData || !busData || !routeData) {
        throw new Error("Incomplete return schedule details");
      }

      const hydratedReturnSchedule = {
        id: scheduleData.id,
        departureDateTime: new Date(scheduleData.departureDateTime),
        arrivalDateTime: new Date(scheduleData.arrivalDateTime),
        availableSeats: scheduleData.availableSeats,
        bookedSeats: normalizeSeatArray(scheduleData.bookedSeats),
        reservedSeats: normalizeSeatArray(scheduleData.reservedSeats || []),
        price: scheduleData.price,
        baseFare: scheduleData.baseFare,
        segmentPrices: scheduleData.segmentPrices,
        departureLocation: scheduleData.departureLocation,
        arrivalLocation: scheduleData.arrivalLocation,
        busId: busData.id,
        routeId: routeData.id,
        companyId: scheduleData.companyId,
      } as unknown as Schedule;

      setReturnSchedule(hydratedReturnSchedule);
      setReturnBus(busData as Bus);
      setReturnRoute(routeData as Route);
    } catch (error: any) {
      setReturnSchedule(null);
      setReturnBus(null);
      setReturnRoute(null);
      setReturnScheduleError(error.message || "Unable to load return schedule details");
    } finally {
      setReturnScheduleLoading(false);
    }
  }, []);

  const clearReturnSelection = useCallback(() => {
    setSelectedReturnScheduleId("");
    setReturnSchedule(null);
    setReturnBus(null);
    setReturnRoute(null);
    setSelectedReturnSeats([]);
    setReturnScheduleError("");
    setReturnSchedules([]);
  }, []);

  useEffect(() => {
    if (!wantsReturnTrip) {
      setReturnDateOptions([]);
      if (returnReservationId) {
        releaseReservation(returnReservationId).catch(console.error);
        setReturnReservationId(null);
      }
      clearReturnSelection();
      return;
    }

    if (route && schedule) {
      fetchReturnDateOptions();
    }
  }, [wantsReturnTrip, route, schedule, fetchReturnDateOptions, returnReservationId, releaseReservation, clearReturnSelection]);

  useEffect(() => {
    if (!wantsReturnTrip || !returnDate) {
      return;
    }

    if (route && schedule) {
      fetchReturnSchedules();
    }
  }, [wantsReturnTrip, returnDate, route, schedule, fetchReturnSchedules]);

  const handleSelectReturnSchedule = useCallback(async (scheduleId: string) => {
    setSelectedReturnScheduleId(scheduleId);
    setSelectedReturnSeats([]);
    if (returnReservationId) {
      await releaseReservation(returnReservationId);
      setReturnReservationId(null);
    }
    if (!scheduleId) {
      setReturnSchedule(null);
      setReturnBus(null);
      setReturnRoute(null);
      return;
    }
    await fetchScheduleDetails(scheduleId);
  }, [fetchScheduleDetails, releaseReservation, returnReservationId]);

  // When outbound seats change while return trip is requested and outbound was locked,
  // ensure saved outbound seats stay in sync and reserved.
  useEffect(() => {
    if (outboundLocked) setSavedOutboundSeats(selectedSeats.slice());
  }, [selectedSeats, outboundLocked]);

  const handleReturnSeatSelection = useCallback(async (seats: string[]) => {
    setError("");
    if (!returnSchedule) {
      setError("Please select a return schedule first.");
      return;
    }
    if (seats.length !== passengers) {
      setError(`Please select exactly ${passengers} seat${passengers > 1 ? "s" : ""} for the return trip.`);
      return;
    }
    if (new Set(seats).size !== seats.length) {
      setError("Duplicate seats selected for the return trip. Please choose different seats.");
      return;
    }
    if (returnSchedule.bookedSeats?.some((s) => seats.includes(s))) {
      setError("One or more selected seats are already booked on the return schedule.");
      return;
    }
    if (returnSchedule.reservedSeats?.some((s) => seats.includes(s))) {
      setError("One or more selected seats are temporarily reserved on the return schedule.");
      return;
    }

    try {
      if (returnReservationId) {
        await releaseReservation(returnReservationId);
        setReturnReservationId(null);
      }
      const newReservationId = await reserveSeats(returnSchedule.id, seats);
      setReturnReservationId(newReservationId);
      setSelectedReturnSeats(seats);

      // If outbound seats are already selected (one-way completed),
      // initialize passenger forms the same way we do for one-way bookings
      // so the Passenger Details step is prefilled and shown.
      if (selectedSeats.length === passengers) {
        setPassengerForms(selectedSeats.map((seat, index) => ({
          name: (index === 0 && bookingForSelf && userProfile) ? `${userProfile.firstName} ${userProfile.lastName}`.trim() : "",
          ageInput: "18", age: 18,
          gender: (index === 0 && bookingForSelf && userProfile?.sex) ? (userProfile.sex.toLowerCase() as any) : ("male" as const),
          seatNumber: seat, ticketType: "adult" as const,
        })));

        setCurrentStep("passengers");
      }
    } catch (err: any) {
      setError(err.message || "Failed to reserve return seats. Please try again.");
    }
  }, [passengers, returnReservationId, returnSchedule, reserveSeats, releaseReservation, selectedSeats.length, bookingForSelf, userProfile]);

  function normalizeSeatArray(value: unknown): string[] {
    if (Array.isArray(value)) return value.filter((seat): seat is string => typeof seat === 'string');
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed.filter((seat): seat is string => typeof seat === 'string');
      } catch {
        return [];
      }
    }
    return [];
  }

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
        bookedSeats: normalizeSeatArray(scheduleData.bookedSeats),
        reservedSeats: normalizeSeatArray(scheduleData.reservedSeats || []),
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

  const handleSeatSelection = useCallback(async (seats: string[]) => {
    setError("");
    if (seats.length !== passengers) { setError(`Please select exactly ${passengers} seat${passengers > 1 ? "s" : ""}.`); return; }
    if (new Set(seats).size !== seats.length) { setError("Duplicate seats selected. Please choose different seats."); return; }
    if (schedule?.bookedSeats?.some((s) => seats.includes(s))) { setError("One or more selected seats are already booked."); return; }
    if (!originStopId || !destinationStopId) { setError("Please select boarding and alighting stops."); return; }

    try {
      if (!schedule) {
        setError("Booking schedule is unavailable. Please reload the page and try again.");
        return;
      }
      if (reservationId) {
        await releaseReservation(reservationId);
        setReservationId(null);
      }
      const newReservationId = await reserveSeats(schedule.id, seats);
      setReservationId(newReservationId);
      setSelectedSeats(seats);

      const nextStep = wantsReturnTrip ? "seats" : "passengers";
      setCurrentStep(nextStep);

      if (!wantsReturnTrip) {
        setPassengerForms(seats.map((seat, index) => ({
          name: (index === 0 && bookingForSelf && userProfile) ? `${userProfile.firstName} ${userProfile.lastName}`.trim() : "",
          ageInput: "18", age: 18,
          gender: (index === 0 && bookingForSelf && userProfile?.sex) ? (userProfile.sex.toLowerCase() as any) : ("male" as const),
          seatNumber: seat, ticketType: "adult" as const,
        })));
      }
    } catch (err: any) {
      setError(err.message || "Failed to reserve seats. Please try again.");
    }
  }, [passengers, schedule?.bookedSeats, originStopId, destinationStopId, bookingForSelf, userProfile, wantsReturnTrip, reservationId, releaseReservation, reserveSeats]);

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
      if (wantsReturnTrip) {
        if (!returnDate) {
          setError("Please provide a return date before submitting your round-trip booking.");
          setBookingLoading(false);
          return;
        }
        if (!returnSchedule || !selectedReturnScheduleId || selectedReturnSeats.length !== passengers) {
          setError("Please select a return schedule and return seats before submitting your round-trip booking.");
          setBookingLoading(false);
          return;
        }
        const parsedReturn = new Date(returnDate);
        if (Number.isNaN(parsedReturn.getTime())) {
          setError("Please provide a valid return date.");
          setBookingLoading(false);
          return;
        }
        const departureDate = new Date(schedule.departureDateTime);
        if (parsedReturn < departureDate) {
          setError("Return date must be on or after the departure date.");
          setBookingLoading(false);
          return;
        }
      }

      const outboundSegment = {
        scheduleId: schedule.id,
        seatNumbers: selectedSeats,
        originStopId,
        destinationStopId,
      };
      const segments = wantsReturnTrip && returnSchedule
        ? [outboundSegment, {
            scheduleId: returnSchedule.id,
            seatNumbers: selectedReturnSeats,
            originStopId: "__origin__",
            destinationStopId: "__destination__",
          }]
        : [outboundSegment];

      const response = await fetch("/api/bookings/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId: schedule.id,
          routeId: schedule.routeId,
          companyId: schedule.companyId,
          seatNumbers: selectedSeats,
          segments,
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
    if (selectedSeats.length > 0 || selectedReturnSeats.length > 0) {
      releaseAllHeldSeats().catch(console.error);
      setSelectedSeats([]);
      setSelectedReturnSeats([]);
    }
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
    selectedReturnSeats, setSelectedReturnSeats,
    passengerForms, setPassengerForms,
    currentStep, setCurrentStep,
    reservationId,
    returnReservationId,
    confirmedBookingId, serverTotalAmount, serverCurrency,
    // stops & pricing
    normalisedStops, originStopId, setOriginStopId, destinationStopId, setDestinationStopId,
    availableDestinations, displayPrice,
    // return trip state
    wantsReturnTrip, setWantsReturnTrip: toggleWantsReturnTrip, returnDate, setReturnDate,
    outboundLocked, savedOutboundSeats,
    returnSchedules, returnScheduleLoading, returnScheduleError,
    selectedReturnScheduleId, returnSchedule, returnBus, returnRoute,
    // UI state
    loading, bookingLoading, error, setError, passengerError, success, setSuccess,
    confirmModalOpen, setConfirmModalOpen,
    // misc
    bookingForSelf, toggleBookingForSelf,
    dupNameModalOpen, setDupNameModalOpen, pendingPassengerSubmit, setPendingPassengerSubmit,
    promoCode, setPromoCode, appliedPromo, setAppliedPromo, isValidatingPromo,
    // helpers/handlers
    reserveSeats, releaseAllHeldSeats, fetchBookingData,
    handleOriginChange, handleSeatSelection, handleSelectReturnSchedule, handleReturnSeatSelection, handlePassengerFieldChange, handleAgeBlur, handlePassengerSubmit, proceedToConfirm,
    confirmBooking, goBackToSeats, goBackToPassengers, validatePromoCode, stopName,
    returnDateOptions, returnDateOptionsLoading,
  } as const;
}