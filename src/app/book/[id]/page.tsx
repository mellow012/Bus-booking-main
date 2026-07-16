"use client";

import { useRef, useEffect } from "react";
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
  TicketPercent, Loader2, Lock, ArrowDown,
} from "lucide-react";

import InlinePassengerForm, { PassengerFormState } from "./InlinePassengerForm";
import useBookBus from "./useBookBus";
import BookingConfirmModal from "./BookingConfirmModal";
import { formatTime, formatDate, formatDuration } from "./utils";

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
  } = useBookBus();



  // ── Render: loading ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-50 to-brand-100/50 pt-28 sm:pt-32 lg:pt-36">
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

  const boardingStopName = originStopId ? stopName(originStopId) : route.origin;
  const alightingStopName = destinationStopId ? stopName(destinationStopId) : route.destination;
  const isPartialSegment = originStopId !== "__origin__" || destinationStopId !== "__destination__";

  const formattedReturnDate = returnDate ? new Date(returnDate).toLocaleDateString() : '';

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-brand-50 to-gray-50 pt-28 sm:pt-32 lg:pt-36">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

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
                  <Label htmlFor="boardAt" className="mb-1.5 block font-medium">
                    🟢 Pick-up Stop <span className="text-red-500">*</span>
                  </Label>
                  <select
                    id="boardAt" value={originStopId}
                    onChange={e => handleOriginChange(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-700 bg-white text-sm"
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
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-700 bg-white text-sm disabled:opacity-50"
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
                <div className="mt-4 p-3 bg-brand-50 border border-brand-100 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-sm text-brand-800">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                    <span className="font-medium min-w-0 break-words">{stopName(originStopId)}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                    <span className="font-medium min-w-0 break-words">{stopName(destinationStopId)}</span>
                  </div>
                  <span className="font-bold text-brand-700 shrink-0 mt-2 sm:mt-0">
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

                        {returnSchedule && (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">Return schedule selected</p>
                                <p className="text-sm text-slate-600">{returnSchedule.departureLocation} → {returnSchedule.arrivalLocation}</p>
                              </div>
                              <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 border border-slate-200">MWK {returnSchedule.price?.toLocaleString()}</span>
                            </div>

                            <SeatSelection
                              bus={returnBus!} schedule={returnSchedule} passengers={passengers}
                              onSeatSelection={handleReturnSeatSelection}
                              selectedSeats={selectedReturnSeats}
                              originStopId="__origin__"
                              destinationStopId="__destination__"
                              route={returnRoute!}
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
                    <p className="flex items-center gap-1.5 flex-wrap mt-1">
                      <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                      <span>Pick-up: <span className="font-semibold text-green-700">{boardingStopName}</span></span>
                      <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                      <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                      <span>Drop-off: <span className="font-semibold text-red-600">{alightingStopName}</span></span>
                    </p>
                  </div>
                  {/* Return leg summary (only when return trip is selected) */}
                  {wantsReturnTrip && returnSchedule && selectedReturnSeats.length > 0 && (
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm text-gray-700">
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">🔁 Return Trip</p>
                      <p>Seats: <span className="font-semibold text-gray-900">{selectedReturnSeats.join(", ")}</span></p>
                      <p className="flex items-center gap-1.5 flex-wrap mt-1">
                        <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                        <span>From: <span className="font-semibold text-green-700">{returnSchedule.departureLocation || returnRoute?.origin || route.destination}</span></span>
                        <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                        <span>To: <span className="font-semibold text-red-600">{returnSchedule.arrivalLocation || returnRoute?.destination || route.origin}</span></span>
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Departure: {new Date(returnSchedule.departureDateTime).toLocaleDateString()} · {new Date(returnSchedule.departureDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
          onClose={() => { if (!bookingLoading) setConfirmModalOpen(false); }}
          schedule={schedule}
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
        />
      </div>
    </div>
  );
}