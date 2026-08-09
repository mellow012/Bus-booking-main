"use client";

import { useRef, useEffect, useState } from "react";
import SeatSelection from "@/components/SeatSelection";
import AlertMessage from '@/components/AlertMessage';
import BackButton from '@/components/BackButton';
import { Button } from "@/components/ui/button";
import Modal from "@/components/Modals";
import { Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard, CheckCircle, AlertCircle, MapPin,
  Users, Calendar, ArrowRight, Star, ArrowLeft,
  TicketPercent, Loader2, Lock, ArrowDown, Armchair, Bus as BusIcon, MessageSquare,
  Camera, Share2, ChevronLeft, ChevronRight, X, ChevronDown,
} from "lucide-react";

import InlinePassengerForm, { PassengerFormState } from "./InlinePassengerForm";
import useBookBus from "./useBookBus";
import BookingConfirmModal from "./BookingConfirmModal";
import BookBusLoading from "./loading";
import { formatTime, formatDate, formatDuration } from "./utils";
import { formatDateISO } from "@/lib/timezone";
import { RouteStopsDisplay } from "@/components/RouteStopsDisplay";

// ================================
// CONSTANTS
// ================================
// SEAT_HOLD_DURATION is now handled server-side in the API

// ================================
// INTERFACES
// ================================
// Helpers and types extracted to ./utils and InlinePassengerForm

// Inline passenger form extracted to ./InlinePassengerForm

// ================================
// MAIN COMPONENT
// ================================
export default function BookBus() {
  const ref = useRef<HTMLDivElement | null>(null);

  const {
    schedule, bus, route, company,
    passengers,
    selectedSeats, setSelectedSeats,
    selectedReturnSeats, setSelectedReturnSeats,
    passengerForms, setPassengerForms,
    currentStep, setCurrentStep,
    reservationId,
    returnReservationId,
    confirmedBookingId, serverTotalAmount, serverCurrency,
    normalisedStops, originStopId, setOriginStopId, destinationStopId, setDestinationStopId,
    availableDestinations, handleOriginChange,
    displayPrice,
    wantsReturnTrip, setWantsReturnTrip, returnDate, setReturnDate,
    outboundLocked, savedOutboundSeats,
    returnSchedules, returnScheduleLoading, returnScheduleError,
    returnDateOptions, returnDateOptionsLoading,
    selectedReturnScheduleId, returnSchedule, returnBus, returnRoute,
    loading, bookingLoading, error, setError, passengerError, success, setSuccess,
    confirmModalOpen, setConfirmModalOpen,
    bookingForSelf, toggleBookingForSelf,
    dupNameModalOpen, setDupNameModalOpen, pendingPassengerSubmit, setPendingPassengerSubmit,
    promoCode, setPromoCode, appliedPromo, setAppliedPromo, isValidatingPromo,
    fetchBookingData,
    handleSeatSelection, handleSelectReturnSchedule, handleReturnSeatSelection, handlePassengerFieldChange, handleAgeBlur, handlePassengerSubmit, proceedToConfirm,
    confirmBooking, goBackToSeats, goBackToPassengers, skipReturnAndProceed, validatePromoCode, stopName,
    outboundSectionRef, returnSectionScrollRef,
    liveSelectedSeats, setLiveSelectedSeats,
    reviewsData,
  } = useBookBus();

  const [activeTab, setActiveTab] = useState<'seatSelection' | 'aboutBus'>('seatSelection');
  const [aboutBusSubTab, setAboutBusSubTab] = useState<'reviews' | 'ratings'>('reviews');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    const images = bus?.images;
    if (!lightboxOpen || !images) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxOpen(false);
      } else if (e.key === 'ArrowLeft' && images.length > 1) {
        setActiveImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
      } else if (e.key === 'ArrowRight' && images.length > 1) {
        setActiveImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, bus?.images]);

  const openLightbox = (index: number) => {
    setActiveImageIndex(index);
    setLightboxOpen(true);
  };

  // ── Render: loading ────────────────────────────────────────────────────────

  if (loading) {
    return <BookBusLoading />;
  }

  if (!schedule || !bus || !route || !company) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-50 to-brand-100/50 flex items-center justify-center p-4 pt-28 sm:pt-32 lg:pt-36">
        <Card className="w-full max-w-md"><CardContent className="p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Booking Not Available</h2>
          <p className="text-gray-600 mb-6">{error || "Could not load booking. Please try again."}</p>
          <div className="space-y-3">
            <Button onClick={() => window.location.reload()} className="w-full">Try Again</Button>
            <Button onClick={() => (window.location.href = "/schedules")} variant="outline" className="w-full">Back to Search</Button>
          </div>
        </CardContent></Card>
      </div>
    );
  }

  // `availableDestinations` is provided by the hook (memoized)
  const busImages = bus.images || [];

  const boardingStopName = originStopId ? stopName(originStopId) : route.origin;
  const alightingStopName = destinationStopId ? stopName(destinationStopId) : route.destination;
  const isPartialSegment = originStopId !== "__origin__" || destinationStopId !== "__destination__";

  const formattedReturnDate = returnDate ? formatDateISO(returnDate) : '';
  const originIdx = normalisedStops.findIndex(s => s.id === originStopId);
  const destIdx = normalisedStops.findIndex(s => s.id === destinationStopId);
  const selectedPathStops = originIdx !== -1 && destIdx !== -1 && destIdx >= originIdx 
    ? normalisedStops.slice(originIdx, destIdx + 1).map(s => ({ id: s.id, name: s.name, stage: 'default' as const }))
    : [];

  const handleShare = async () => {
    const baseUrl = window.location.origin + window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    if (originStopId) params.set('originStopId', originStopId);
    if (destinationStopId) params.set('destinationStopId', destinationStopId);
    const url = `${baseUrl}?${params.toString()}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${route.origin} to ${route.destination} on TibhukeBus`,
          text: `Check out this trip from ${route.origin} to ${route.destination} with ${company.name}!`,
          url,
        });
      } catch (err) {
        console.error('Share failed', err);
      }
    } else {
      await navigator.clipboard.writeText(url);
      alert('Link copied to clipboard!');
    }
  };

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-brand-50 to-gray-50 pt-28 sm:pt-32 lg:pt-36">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

        {/* ── Back Button ── */}
        <div className="mb-4">
          <BackButton href="/schedules" iconOnly hideOnMobile={false} className="border-slate-200 shadow-sm bg-white text-slate-600 hover:text-slate-900" />
        </div>

        {/* ── Header with Share ── */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
            {route.origin} → {route.destination}
          </h2>
          <Button variant="outline" size="sm" onClick={handleShare} className="flex items-center gap-2 bg-white">
            <Share2 className="w-4 h-4" /> <span className="hidden sm:inline">Share</span>
          </Button>
        </div>

        {/* ── Boarding & Alighting Stop Selector ── */}
        {currentStep === "seats" && normalisedStops.length > 1 && (
          <Card className="mb-6 shadow-lg border-0">
            <CardContent className="p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold mb-1 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-brand-700" /> Pick-up &amp; Drop-off Stops
              </h3>
              <p className="text-sm text-gray-500 mb-4">Select where you will board and alight.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="boardAt" className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">
                    🟢 Pick-up Stop <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-500">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <select
                      id="boardAt" value={originStopId}
                      onChange={e => handleOriginChange(e.target.value)}
                      className="w-full appearance-none pl-10 pr-10 py-3 bg-white border border-slate-200 hover:border-slate-350 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-slate-800 font-semibold text-sm transition-all shadow-sm cursor-pointer"
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
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>
                <div>
                  <Label htmlFor="alightAt" className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">
                    🔴 Drop-off Stop <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-rose-500">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <select
                      id="alightAt" value={destinationStopId}
                      onChange={e => setDestinationStopId(e.target.value)}
                      className="w-full appearance-none pl-10 pr-10 py-3 bg-white border border-slate-200 hover:border-slate-350 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-slate-800 font-semibold text-sm transition-all shadow-sm cursor-pointer disabled:opacity-60"
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
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>
              {originStopId && destinationStopId && displayPrice > 0 && selectedPathStops.length > 0 && (
                <div className="mt-4 p-4 bg-brand-50 border border-brand-100 rounded-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 text-sm text-brand-800 shadow-sm overflow-hidden">
                  <div className="flex-1 w-full min-w-0 overflow-x-auto hide-scrollbar">
                    <RouteStopsDisplay stops={selectedPathStops} />
                  </div>
                  <div className="font-bold text-brand-700 shrink-0 whitespace-nowrap bg-white px-4 py-2 rounded-lg shadow-sm border border-brand-100 text-base">
                    ~MWK {displayPrice.toLocaleString()} <span className="text-sm font-semibold text-brand-600">/ person</span>
                  </div>
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
                  (key === "seats" && (currentStep === "passengers" || currentStep === "confirm")) ||
                  (key === "passengers" && currentStep === "confirm");
                return (
                  <div key={step} className="flex items-center gap-2 sm:gap-3">
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-semibold transition-all text-sm sm:text-base ${isActive ? "bg-brand-700 text-white shadow-lg scale-110" :
                        isCompleted ? "bg-green-600 text-white" : "bg-gray-200 text-gray-600"
                      }`}>
                      {isCompleted ? <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" /> : step}
                    </div>
                    <span className={`font-medium text-xs sm:text-sm hidden sm:block ${isActive ? "text-brand-700" : isCompleted ? "text-green-600" : "text-gray-400"
                      }`}>{title}</span>
                    {idx < 2 && <div className="w-6 sm:w-10 h-px bg-gray-200 hidden sm:block" />}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {success && (
          <Card className="mb-6 border-green-200 bg-green-50"><CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
              <p className="text-green-700 text-sm">{success}</p>
            </div>
          </CardContent></Card>
        )}
        {currentStep !== "seats" && error && (
          <AlertMessage
            type="error"
            message={error}
            onClose={() => setError('')}
            scrollIntoView={true}
            className="mb-6"
          />
        )}

        {/* ── Step content ── */}
        <div className="space-y-6">

          {/* Step 1 — Seat selection */}
          {currentStep === "seats" && (
            <>
              {/* Tabs */}
              <div className="flex justify-center border-b border-gray-200 mb-6 gap-2">
                <button
                  className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors ${activeTab === 'seatSelection' ? 'border-b-2 border-brand-700 text-brand-700' : 'text-gray-500 hover:text-gray-700'}`}
                  onClick={() => setActiveTab('seatSelection')}
                >
                  <Armchair className="w-4 h-4" />
                  Seat Selection
                </button>
                <button
                  className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors ${activeTab === 'aboutBus' ? 'border-b-2 border-brand-700 text-brand-700' : 'text-gray-500 hover:text-gray-700'}`}
                  onClick={() => setActiveTab('aboutBus')}
                >
                  <BusIcon className="w-4 h-4" />
                  About Bus
                </button>
              </div>

              {activeTab === 'seatSelection' ? (
                <>
                  {/* Outbound Seat Map — attached to outboundSectionRef for scroll-back-to-top */}
              <div ref={outboundSectionRef}>
                <SeatSelection
                  bus={bus} schedule={schedule} passengers={passengers}
                  onSeatSelection={handleSeatSelection}
                  onSelectionChange={setLiveSelectedSeats}
                  selectedSeats={selectedSeats}
                  disabled={outboundLocked}
                  hideContinue={outboundLocked}
                  originStopId={originStopId}
                  destinationStopId={destinationStopId}
                  route={route}
                  reservedSeats={schedule.reservedSeats || []}
                />
              </div>

              {outboundLocked && savedOutboundSeats && (
                <div className="mt-3 flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                  <span>
                    <span className="font-semibold">Outbound confirmed:</span> seats <span className="font-bold">{savedOutboundSeats.join(', ')}</span> locked.
                    {' '}To change, uncheck &ldquo;Add return trip&rdquo; below.
                  </span>
                </div>
              )}

              {/* Return trip card — ref used for smooth scroll from hook */}
              <div ref={returnSectionScrollRef}>
                <Card className="mt-6 border border-brand-100 shadow-sm">
                  <CardContent className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">Return trip</h3>
                        <p className="text-sm text-gray-500">Add a return schedule from {route.destination} back to {route.origin}.</p>
                      </div>
                      <div className="flex flex-col items-end">
                        <label className={`inline-flex items-center gap-2 select-none ${liveSelectedSeats.length !== passengers ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={wantsReturnTrip}
                            disabled={liveSelectedSeats.length !== passengers}
                            onChange={(e) => setWantsReturnTrip(e.target.checked)}
                            className="h-4 w-4 accent-brand-700 border-gray-300 rounded focus:ring-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                          <span className="text-sm font-medium text-gray-700">Add return trip</span>
                        </label>
                        {liveSelectedSeats.length !== passengers && (
                          <p className="text-[11px] text-gray-500 mt-1">Select outbound seats first</p>
                        )}
                      </div>
                    </div>

                    {wantsReturnTrip && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-gray-700">Return date</p>
                          <p className="text-sm text-gray-500">Select one of the available return dates for this bus/company combination.</p>
                        </div>

                        {returnDateOptionsLoading ? (
                          <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-700">Searching available return dates...</div>
                        ) : returnDateOptions.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                            {returnDateOptions.map((option) => {
                              const isSelected = returnDate === option.date;
                              return (
                                <button
                                  key={option.date}
                                  type="button"
                                  onClick={() => setReturnDate(option.date)}
                                  className={`w-full rounded-2xl border p-4 text-left transition ${isSelected ? 'border-brand-700 bg-brand-50 shadow-sm' : 'border-gray-200 bg-white hover:border-brand-200'}`}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <p className="font-semibold text-gray-900">{option.formatted}</p>
                                      <p className="text-xs text-gray-500">{option.count} available trip{option.count > 1 ? 's' : ''}</p>
                                    </div>
                                    {isSelected && <span className="inline-flex items-center rounded-full bg-brand-700 text-white px-2 py-1 text-[11px] font-semibold">Selected</span>}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">
                            <p className="mb-3">{returnScheduleError || 'No return trip dates available for this company and route in the next week.'}</p>
                            <Button
                              variant="outline"
                              className="bg-white hover:bg-rose-50 text-rose-700 border-rose-200"
                              onClick={skipReturnAndProceed}
                            >
                              Skip return trip & continue
                            </Button>
                          </div>
                        )}

                        {returnDate && (
                          <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-700">
                            Selected return date: <span className="font-semibold text-brand-900">{formattedReturnDate}</span>
                          </div>
                        )}

                        {returnDate && returnScheduleLoading && (
                          <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-700">Searching return schedules for {formattedReturnDate}...</div>
                        )}

                        {returnDate && !returnScheduleLoading && returnScheduleError && (
                          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">
                            {returnScheduleError}
                          </div>
                        )}

                        {returnDate && !returnScheduleLoading && returnSchedules.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-gray-900">Select a return schedule</p>
                              <span className="text-sm text-gray-500">{returnSchedules.length} option{returnSchedules.length > 1 ? 's' : ''}</span>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                              {returnSchedules.map((returnOption: any) => {
                                const isSelected = selectedReturnScheduleId === returnOption.id;
                                return (
                                  <button
                                    key={returnOption.id}
                                    type="button"
                                    onClick={() => handleSelectReturnSchedule(returnOption.id)}
                                    className={`w-full rounded-2xl border p-4 text-left transition ${isSelected ? 'border-brand-700 bg-brand-50 shadow-sm' : 'border-gray-200 bg-white hover:border-brand-200'}`}
                                  >
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                      <div>
                                        <p className="font-semibold text-gray-900">{returnOption.origin} → {returnOption.destination}</p>
                                        <p className="text-sm text-gray-500">{new Date(returnOption.departureDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {new Date(returnOption.arrivalDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-sm font-semibold text-gray-900">MWK {returnOption.price?.toLocaleString()}</p>
                                        <p className="text-xs text-gray-500">{returnOption.availableSeats} seats left</p>
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {returnSchedule && returnBus && returnRoute && (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">Return schedule selected</p>
                                <p className="text-sm text-slate-600">{returnSchedule.departureLocation} → {returnSchedule.arrivalLocation}</p>
                              </div>
                              <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 border border-slate-200">MWK {returnSchedule.price?.toLocaleString()}</span>
                            </div>

                            <SeatSelection
                              bus={returnBus} schedule={returnSchedule} passengers={passengers}
                              onSeatSelection={handleReturnSeatSelection}
                              selectedSeats={selectedReturnSeats}
                              originStopId="__origin__"
                              destinationStopId="__destination__"
                              route={returnRoute}
                              reservedSeats={returnSchedule.reservedSeats || []}
                            />
                          </div>
                        )}
                      </div>
                    )}

                  </CardContent>
                </Card>
              </div>

              {error && (
                <AlertMessage
                  type="error"
                  message={error}
                  onClose={() => setError('')}
                  scrollIntoView={true}
                  className="mt-4"
                />
              )}
                </>
              ) : (
                <div className="space-y-8 animate-in fade-in duration-300">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Bus Details</h2>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                       <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                          <p className="text-sm text-gray-500">Company</p>
                          <p className="font-medium text-gray-900 mt-1">{company.name}</p>
                       </div>
                       <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                          <p className="text-sm text-gray-500">Category</p>
                          <p className="font-medium text-gray-900 mt-1">{bus.busType}</p>
                       </div>
                       <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                          <p className="text-sm text-gray-500">Capacity</p>
                          <p className="font-medium text-gray-900 mt-1">{bus.capacity} Seats</p>
                       </div>
                       <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                          <p className="text-sm text-gray-500">Amenities</p>
                          <p className="font-medium text-gray-900 mt-1">{(bus.amenities || []).join(', ') || 'None'}</p>
                       </div>
                       <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                          <p className="text-sm text-gray-500">Vehicle Rating</p>
                          <div className="font-medium text-gray-900 mt-1 flex items-center gap-1.5">
                            {reviewsData ? (
                              <>
                                 <Star className="w-4 h-4 text-amber-500 fill-amber-400" /> 
                                 {reviewsData.averageRating} <span className="text-gray-500 text-xs ml-1">({reviewsData.count} reviews)</span>
                              </>
                            ) : (
                              <span className="text-gray-400 text-sm">Loading...</span>
                            )}
                          </div>
                       </div>
                    </div>
                  </div>

                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <Camera className="w-5 h-5 text-brand-700" />
                        Photos
                      </h3>
                      {busImages.length > 0 ? (
                        <div>
                          {/* Modern Grid Layout */}
                          {busImages.length === 1 && (
                            <div 
                              className="relative group overflow-hidden rounded-2xl border border-gray-200/60 shadow-sm cursor-pointer w-full max-w-3xl"
                              onClick={() => openLightbox(0)}
                            >
                              <img 
                                src={busImages[0]} 
                                alt="Bus view 1" 
                                className="w-full h-64 md:h-80 object-cover transition-transform duration-500 group-hover:scale-102" 
                              />
                              <div className="absolute inset-0 bg-black/10 group-hover:bg-black/25 transition-colors duration-300 flex items-center justify-center">
                                <span className="text-white text-sm font-semibold bg-black/60 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2 transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                                  <Camera className="w-4 h-4" /> View Full Photo
                                </span>
                              </div>
                            </div>
                          )}

                          {busImages.length === 2 && (
                            <div className="grid grid-cols-2 gap-3 max-w-4xl">
                              {busImages.map((img: string, i: number) => (
                                <div 
                                  key={i} 
                                  className="relative group overflow-hidden rounded-2xl border border-gray-200/60 shadow-sm cursor-pointer aspect-[4/3] md:aspect-[16/10]"
                                  onClick={() => openLightbox(i)}
                                >
                                  <img 
                                    src={img} 
                                    alt={`Bus view ${i+1}`} 
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                                  />
                                  <div className="absolute inset-0 bg-black/10 group-hover:bg-black/25 transition-colors duration-300 flex items-center justify-center">
                                    <span className="text-white text-xs md:text-sm font-semibold bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-1.5 transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                                      <Camera className="w-3.5 h-3.5" /> View
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {busImages.length === 3 && (
                            <div className="grid grid-cols-3 gap-3 max-w-4xl aspect-[16/10] md:aspect-[16/8] w-full">
                              <div 
                                className="col-span-2 relative group overflow-hidden rounded-2xl border border-gray-200/60 shadow-sm cursor-pointer h-full"
                                onClick={() => openLightbox(0)}
                              >
                                <img 
                                  src={busImages[0]} 
                                  alt="Bus view 1" 
                                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-103" 
                                />
                                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/25 transition-colors duration-300 flex items-center justify-center">
                                  <span className="text-white text-sm font-semibold bg-black/60 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2 transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                                    <Camera className="w-4 h-4" /> View Gallery
                                  </span>
                                </div>
                              </div>
                              <div className="col-span-1 grid grid-rows-2 gap-3 h-full">
                                {busImages.slice(1, 3).map((img: string, idx: number) => (
                                  <div 
                                    key={idx} 
                                    className="relative group overflow-hidden rounded-2xl border border-gray-200/60 shadow-sm cursor-pointer h-full"
                                    onClick={() => openLightbox(idx + 1)}
                                  >
                                    <img 
                                      src={img} 
                                      alt={`Bus view ${idx+2}`} 
                                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                                    />
                                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors duration-300" />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {busImages.length === 4 && (
                            <div className="grid grid-cols-2 gap-3 max-w-4xl aspect-[16/10] md:aspect-[16/8] w-full">
                              {busImages.map((img: string, i: number) => (
                                <div 
                                  key={i} 
                                  className="relative group overflow-hidden rounded-2xl border border-gray-200/60 shadow-sm cursor-pointer h-full"
                                  onClick={() => openLightbox(i)}
                                >
                                  <img 
                                    src={img} 
                                    alt={`Bus view ${i+1}`} 
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                                  />
                                  <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors duration-300" />
                                </div>
                              ))}
                            </div>
                          )}

                          {busImages.length >= 5 && (
                            <div className="grid grid-cols-4 gap-3 max-w-5xl aspect-[16/10] md:aspect-[16/8] w-full">
                              {/* Left large photo */}
                              <div 
                                className="col-span-2 row-span-2 relative group overflow-hidden rounded-2xl border border-gray-200/60 shadow-sm cursor-pointer h-full"
                                onClick={() => openLightbox(0)}
                              >
                                <img 
                                  src={busImages[0]} 
                                  alt="Bus view 1" 
                                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-103" 
                                />
                                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/25 transition-colors duration-300 flex items-center justify-center">
                                  <span className="text-white text-sm font-semibold bg-black/60 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2 transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                                    <Camera className="w-4 h-4" /> View Gallery
                                  </span>
                                </div>
                              </div>
                              {/* Right grid */}
                              <div className="col-span-2 grid grid-cols-2 grid-rows-2 gap-3 h-full">
                                {busImages.slice(1, 5).map((img: string, idx: number) => {
                                  const imageIndex = idx + 1;
                                  const isLastSlot = idx === 3;
                                  const hasMore = busImages.length > 5;
                                  const remainingCount = busImages.length - 5;

                                  return (
                                    <div 
                                      key={idx} 
                                      className="relative group overflow-hidden rounded-2xl border border-gray-200/60 shadow-sm cursor-pointer h-full" 
                                      onClick={() => openLightbox(imageIndex)}
                                    >
                                      <img 
                                        src={img} 
                                        alt={`Bus view ${imageIndex + 1}`} 
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                                      />
                                      <div className="absolute inset-0 bg-black/15 group-hover:bg-black/25 transition-colors duration-300 flex items-center justify-center">
                                        {isLastSlot && hasMore && (
                                          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white transition-colors duration-300 group-hover:bg-black/50">
                                            <span className="text-lg md:text-xl font-bold">+{remainingCount + 1}</span>
                                            <span className="text-[9px] md:text-xs font-semibold tracking-wider uppercase mt-0.5">Photos</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 px-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-center">
                          <Camera className="w-8 h-8 text-gray-300 mb-2 animate-pulse" />
                          <p className="text-xs text-gray-500 font-semibold">No vehicle photos uploaded yet</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">Images showing the exterior and interior amenities will appear here once added by the operator.</p>
                        </div>
                      )}
                    </div>

                  {reviewsData && (
                    <div>
                      <div className="flex border-b border-gray-200 mb-6 gap-2">
                        <button
                          className={`flex items-center gap-2 px-4 py-2 font-medium text-sm transition-colors ${aboutBusSubTab === 'reviews' ? 'border-b-2 border-brand-700 text-brand-700' : 'text-gray-500 hover:text-gray-700'}`}
                          onClick={() => setAboutBusSubTab('reviews')}
                        >
                          <MessageSquare className="w-4 h-4" />
                          Recent Reviews
                        </button>
                        <button
                          className={`flex items-center gap-2 px-4 py-2 font-medium text-sm transition-colors ${aboutBusSubTab === 'ratings' ? 'border-b-2 border-brand-700 text-brand-700' : 'text-gray-500 hover:text-gray-700'}`}
                          onClick={() => setAboutBusSubTab('ratings')}
                        >
                          <Star className="w-4 h-4" />
                          Rating Breakdown
                        </button>
                      </div>

                      {aboutBusSubTab === 'reviews' ? (
                        <div className="space-y-4 max-w-3xl">
                          {reviewsData.reviews.length > 0 ? reviewsData.reviews.map((r: any, i: number) => (
                            <div key={i} className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  {r.authorAvatar ? (
                                     <img src={r.authorAvatar} alt="Avatar" className="w-8 h-8 rounded-full object-cover" />
                                  ) : (
                                     <div className="w-8 h-8 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center text-xs font-bold uppercase">
                                       {r.authorName.charAt(0)}
                                     </div>
                                  )}
                                  <div>
                                    <span className="font-medium text-sm text-gray-900 block">{r.authorName}</span>
                                    <span className="text-xs text-gray-500">{new Date(r.date || r.createdAt || Date.now()).toLocaleDateString()}</span>
                                  </div>
                                </div>
                                <div className="flex text-amber-400 text-sm">
                                  {'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}
                                </div>
                              </div>
                              {r.text && <p className="text-gray-600 text-sm leading-relaxed">{r.text}</p>}
                            </div>
                          )) : (
                            <p className="text-gray-500 text-sm italic">No reviews yet for this bus.</p>
                          )}
                        </div>
                      ) : (
                        <div className="max-w-md p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
                           <div className="flex items-center gap-4 mb-6">
                             <div className="text-4xl font-bold text-gray-900">{reviewsData.averageRating}</div>
                             <div>
                               <div className="flex text-amber-400 mb-1">
                                 {'★'.repeat(Math.round(reviewsData.averageRating))}{'☆'.repeat(5-Math.round(reviewsData.averageRating))}
                               </div>
                               <div className="text-sm text-gray-500">Based on {reviewsData.count} reviews</div>
                             </div>
                           </div>
                           
                           <div className="space-y-3">
                             {[5, 4, 3, 2, 1].map(stars => {
                               const count = reviewsData.ratingBreakdown?.[stars] || 0;
                               const percentage = reviewsData.count > 0 ? (count / reviewsData.count) * 100 : 0;
                               return (
                                 <div key={stars} className="flex items-center gap-3 text-sm">
                                   <div className="w-12 text-gray-600 font-medium flex items-center gap-1">
                                     {stars} <Star className="w-3 h-3 text-gray-400 fill-current" />
                                   </div>
                                   <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                     <div className="h-full bg-amber-400 rounded-full" style={{ width: `${percentage}%` }}></div>
                                   </div>
                                   <div className="w-8 text-right text-gray-500">{count}</div>
                                 </div>
                               );
                             })}
                           </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="pt-6 mt-4 border-t border-gray-100 flex justify-center">
                    <Button variant="outline" className="w-full sm:w-auto" asChild>
                      <a href={`/schedules?busId=${bus.id}`} className="flex items-center gap-2 text-brand-700">
                        <Calendar className="w-4 h-4" /> 
                        View All Upcoming Schedules For This Bus
                      </a>
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Step 2 — Passenger details */}
          {currentStep === "passengers" && (
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" /> Passenger Details
                  </CardTitle>
                  <BackButton
                    onClick={goBackToSeats}
                    label="Back to Seats"
                    className="flex items-center gap-2 w-full sm:w-auto"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4 space-y-3">
                  {/* Outbound leg summary */}
                  <div className="p-3 bg-brand-50 rounded-lg border border-brand-100 text-sm text-gray-700">
                    <p className="text-xs font-semibold text-brand-700 uppercase tracking-wide mb-1.5">🚌 Outbound Trip</p>
                    <p>Seats: <span className="font-semibold text-gray-900">{selectedSeats.join(", ")}</span></p>
                    <div className="mt-3 flex justify-center overflow-x-auto hide-scrollbar w-full">
                      <RouteStopsDisplay stops={selectedPathStops} />
                    </div>
                  </div>
                  {/* Return leg summary (only when return trip is selected) */}
                  {wantsReturnTrip && returnSchedule && selectedReturnSeats.length > 0 && (
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm text-gray-700">
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">🔁 Return Trip</p>
                      <p>Seats: <span className="font-semibold text-gray-900">{selectedReturnSeats.join(", ")}</span></p>
                      <div className="mt-3 flex justify-center overflow-x-auto hide-scrollbar w-full">
                        <RouteStopsDisplay stops={[
                          { id: 'ret_origin', name: returnSchedule.departureLocation || returnRoute?.origin || route.destination, stage: 'default' as const },
                          { id: 'ret_dest', name: returnSchedule.arrivalLocation || returnRoute?.destination || route.origin, stage: 'default' as const }
                        ]} />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Departure: {formatDateISO(returnSchedule.departureDateTime)} · {formatTime(returnSchedule.departureDateTime)}
                      </p>
                    </div>
                  )}
                </div>
                <InlinePassengerForm
                  passengers={passengers} formState={passengerForms}
                  onChange={handlePassengerFieldChange} onAgeBlur={handleAgeBlur}
                  onSubmit={handlePassengerSubmit} onBack={goBackToSeats}
                  loading={bookingLoading} error={passengerError}
                  bookingForSelf={bookingForSelf}
                  onToggleSelf={toggleBookingForSelf}
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
                className="flex-1 bg-coral-500 text-white hover:bg-coral-600"
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
        <BookingConfirmModal
          isOpen={confirmModalOpen}
          onClose={() => { if (!bookingLoading) { setConfirmModalOpen(false); setCurrentStep("passengers"); } }}
          schedule={schedule}
          company={company}
          originStopId={originStopId}
          destinationStopId={destinationStopId}
          stopName={stopName}
          formatDate={formatDate}
          formatTime={formatTime}
          selectedSeats={selectedSeats}
          selectedReturnSeats={selectedReturnSeats}
          returnSchedule={returnSchedule}
          returnRoute={returnRoute}
          displayPrice={displayPrice}
          passengers={passengers}
          appliedPromo={appliedPromo}
          promoCode={promoCode}
          setPromoCode={setPromoCode}
          isValidatingPromo={isValidatingPromo}
          validatePromoCode={validatePromoCode}
          setAppliedPromo={setAppliedPromo}
          wantsReturnTrip={wantsReturnTrip}
          setWantsReturnTrip={setWantsReturnTrip}
          returnDate={returnDate}
          setReturnDate={setReturnDate}
          bookingLoading={bookingLoading}
          passengerForms={passengerForms}
          goBackToPassengers={goBackToPassengers}
          confirmBooking={confirmBooking}
          selectedPathStops={selectedPathStops}
        />

        {/* Lightbox Modal */}
        {lightboxOpen && busImages.length > 0 && (
          <div 
            className="fixed inset-0 bg-black/95 backdrop-blur-md z-[150] flex flex-col items-center justify-center animate-in fade-in duration-200"
            onClick={() => setLightboxOpen(false)}
          >
            {/* Top Bar */}
            <div className="absolute top-0 inset-x-0 h-16 flex items-center justify-between px-6 bg-gradient-to-b from-black/60 to-transparent text-white z-10 select-none">
              <span className="text-sm font-medium text-gray-300">
                {activeImageIndex + 1} / {busImages.length}
              </span>
              <button 
                onClick={() => setLightboxOpen(false)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white focus:outline-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Main Image Container */}
            <div className="relative w-full max-w-5xl px-4 flex items-center justify-center h-[80vh]" onClick={(e) => e.stopPropagation()}>
              <img 
                src={busImages[activeImageIndex]} 
                alt={`Bus view ${activeImageIndex + 1}`} 
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl select-none animate-in zoom-in-95 duration-200"
              />

              {/* Navigation Buttons */}
              {busImages.length > 1 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveImageIndex((prev) => (prev === 0 ? busImages.length - 1 : prev - 1));
                    }}
                    className="absolute left-2 md:left-6 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 transition-all text-white border border-white/10 hover:scale-105 active:scale-95 focus:outline-none"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveImageIndex((prev) => (prev === busImages.length - 1 ? 0 : prev + 1));
                    }}
                    className="absolute right-2 md:right-6 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 transition-all text-white border border-white/10 hover:scale-105 active:scale-95 focus:outline-none"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}
            </div>

            {/* Bottom Info bar */}
            <div className="absolute bottom-4 text-center text-xs text-gray-400 select-none">
              Use Left/Right arrow keys or Esc to close
            </div>
          </div>
        )}
      </div>
    </div>
  );
}