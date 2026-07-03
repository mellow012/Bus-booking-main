import React from "react";
import Modal from "@/components/Modals";
import { Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TicketPercent, Loader2, CreditCard } from "lucide-react";
import type { Schedule, Route } from "@/types";
import type { PassengerFormState } from "./InlinePassengerForm";

export interface BookingConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: Schedule;
  originStopId: string;
  destinationStopId: string;
  stopName: (id: string) => string;
  formatDate: (t: any) => string;
  formatTime: (t: any) => string;
  selectedSeats: string[];
  displayPrice: number;
  passengers: number;
  appliedPromo: any;
  promoCode: string;
  setPromoCode: (v: string) => void;
  isValidatingPromo: boolean;
  validatePromoCode: () => Promise<void> | void;
  setAppliedPromo: (p: any) => void;
  wantsReturnTrip: boolean;
  setWantsReturnTrip: (v: boolean) => void;
  returnDate: string;
  setReturnDate: (v: string) => void;
  bookingLoading: boolean;
  passengerForms: PassengerFormState[];
  selectedReturnSeats: string[];
  returnSchedule: Schedule | null;
  returnRoute: Route | null;
  goBackToPassengers: () => void;
  confirmBooking: () => Promise<void> | void;
}

export default function BookingConfirmModal({
  isOpen, onClose, schedule, originStopId, destinationStopId, stopName,
  formatDate, formatTime, selectedSeats, selectedReturnSeats, returnSchedule, returnRoute, displayPrice, passengers,
  appliedPromo, promoCode, setPromoCode, isValidatingPromo, validatePromoCode,
  setAppliedPromo, wantsReturnTrip, setWantsReturnTrip, returnDate, setReturnDate, bookingLoading, passengerForms, goBackToPassengers, confirmBooking,
}: BookingConfirmModalProps) {
  const outboundAmount = displayPrice * passengers;
  const returnAmount = wantsReturnTrip && returnSchedule ? (returnSchedule.price || 0) * passengers : 0;
  const finalBaseFare = outboundAmount + returnAmount;
  const finalTotalAmount = finalBaseFare - (appliedPromo?.discount || 0);
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
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
            <p className="text-xs text-gray-500 mb-0.5">Price Summary</p>
            <div className="space-y-1">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Base Fare ({passengers}x {wantsReturnTrip ? 'Round Trip' : 'One Way'})</span>
                <span className="font-semibold text-gray-900">MWK {finalBaseFare.toLocaleString()}</span>
              </div>
              {appliedPromo && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-green-600 flex items-center gap-1"><TicketPercent className="w-3 h-3" /> Promo: {appliedPromo.code}</span>
                  <span className="font-semibold text-green-600">- MWK {appliedPromo.discount.toLocaleString()}</span>
                </div>
              )}
              <div className="pt-1 border-t border-blue-100 mt-1 flex justify-between items-center">
                <span className="font-bold text-gray-900">Total Amount</span>
                <span className="text-xl font-black text-blue-600">
                  MWK {finalTotalAmount.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Return Trip Option */}
        <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input 
              type="checkbox" 
              checked={wantsReturnTrip}
              onChange={(e) => setWantsReturnTrip(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <span className="font-semibold text-sm text-gray-900">Add Return Trip (Pay upfront)</span>
          </label>
          {wantsReturnTrip && (
            <div className="pl-7 space-y-2">
              <Label htmlFor="returnDate" className="text-xs font-semibold text-gray-600">Return Date</Label>
              <Input
                id="returnDate"
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required={wantsReturnTrip}
                aria-describedby={wantsReturnTrip && !returnDate ? 'returnDateError' : undefined}
                className="w-full sm:w-1/2"
              />
              {!returnDate ? (
                <p id="returnDateError" className="text-xs text-rose-600 font-medium">Please choose your return date to continue.</p>
              ) : null}
              <p className="text-xs text-gray-500">Your return date will be recorded and you will be charged for both trips now.</p>
            </div>
          )}
        </div>

        {/* Promo Code Input */}
        {!appliedPromo ? (
          <div className="space-y-2">
            <Label htmlFor="promoCode" className="text-xs font-black text-gray-400 uppercase tracking-widest">Have a Promo Code?</Label>
            <div className="flex gap-2">
              <Input
                id="promoCode"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                placeholder="ENTER CODE"
                className="flex-1 font-black tracking-widest uppercase"
                disabled={isValidatingPromo}
              />
              <Button
                onClick={validatePromoCode}
                variant="outline"
                className="shrink-0 border-blue-200 text-blue-600 hover:bg-blue-50"
                disabled={isValidatingPromo || !promoCode.trim()}
              >
                {isValidatingPromo ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-green-50 border border-green-100 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-green-100 text-green-600 rounded-lg">
                <TicketPercent className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-black text-green-700 uppercase tracking-widest">{appliedPromo.code}</p>
                <p className="text-[10px] text-green-600 font-bold">{appliedPromo.title}</p>
              </div>
            </div>
            <button onClick={() => { setAppliedPromo(null); setPromoCode(""); }} className="text-xs font-bold text-red-500 hover:underline">Remove</button>
          </div>
        )}

        {wantsReturnTrip && returnSchedule ? (
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Return Trip</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-700">
              <div>
                <p className="font-semibold">{returnRoute?.origin} → {returnRoute?.destination}</p>
                <p>{formatDate(returnSchedule.departureDateTime)} · {formatTime(returnSchedule.departureDateTime)}</p>
                <p className="text-xs text-slate-500">Return seats: {selectedReturnSeats.join(', ')}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">MWK {(returnSchedule.price || 0).toLocaleString()} per seat</p>
                <p className="text-xs text-slate-500">Total: MWK {(returnAmount).toLocaleString()}</p>
              </div>
            </div>
          </div>
        ) : wantsReturnTrip ? (
          <div className="p-4 bg-rose-50 rounded-xl border border-rose-100 text-sm text-rose-700">
            Please complete return schedule and seat selection before submitting.
          </div>
        ) : null}

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
            disabled={bookingLoading || (wantsReturnTrip && !returnDate)}
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
  );
}
