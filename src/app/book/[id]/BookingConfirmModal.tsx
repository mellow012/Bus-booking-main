import React from "react";
import Modal from "@/components/Modals";
import { Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TicketPercent, Loader2, CreditCard, ArrowRight, MapPin, Calendar, Clock } from "lucide-react";
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
  const hasReturn = wantsReturnTrip && returnSchedule && selectedReturnSeats.length > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirm Booking Details"
    >
      <div className="space-y-5">
        <div className="bg-brand-50 p-3 rounded-lg">
          <p className="text-sm text-brand-700 font-medium">
            Review all details before submitting. The final price will be confirmed by the server.
          </p>
        </div>

        {/* ── Outbound Trip Details ── */}
        <div className="rounded-xl border border-brand-200 overflow-hidden">
          <div className="bg-brand-700 px-4 py-2 flex items-center gap-2">
            <span className="text-white text-xs font-bold uppercase tracking-wide">🚌 Outbound Trip</span>
          </div>
          <div className="p-4 bg-white space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Pick-up</p>
                  <p className="font-semibold text-sm text-green-800">{stopName(originStopId)}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Drop-off</p>
                  <p className="font-semibold text-sm text-red-700">{stopName(destinationStopId)}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-brand-700 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Departure</p>
                  <p className="font-semibold text-sm">{formatDate(schedule.departureDateTime)}</p>
                  <p className="text-xs text-brand-700 font-medium">{formatTime(schedule.departureDateTime)}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-base mt-0.5 shrink-0">💺</span>
                <div>
                  <p className="text-xs text-gray-500">Seats</p>
                  <p className="font-semibold text-sm">{selectedSeats.join(", ")}</p>
                </div>
              </div>
            </div>
            <div className="flex justify-between items-center text-sm pt-2 border-t border-gray-100">
              <span className="text-gray-600">Outbound fare ({passengers} × MWK {displayPrice.toLocaleString()})</span>
              <span className="font-bold text-gray-900">MWK {outboundAmount.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* ── Return Trip Details ── */}
        {hasReturn && (
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-700 px-4 py-2 flex items-center gap-2">
              <span className="text-white text-xs font-bold uppercase tracking-wide">🔁 Return Trip</span>
            </div>
            <div className="p-4 bg-white space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Pick-up</p>
                    <p className="font-semibold text-sm text-green-800">{returnSchedule!.departureLocation || returnRoute?.origin || ''}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Drop-off</p>
                    <p className="font-semibold text-sm text-red-700">{returnSchedule!.arrivalLocation || returnRoute?.destination || ''}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-brand-700 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Departure</p>
                    <p className="font-semibold text-sm">{formatDate(returnSchedule!.departureDateTime)}</p>
                    <p className="text-xs text-brand-700 font-medium">{formatTime(returnSchedule!.departureDateTime)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-base mt-0.5 shrink-0">💺</span>
                  <div>
                    <p className="text-xs text-gray-500">Return Seats</p>
                    <p className="font-semibold text-sm">{selectedReturnSeats.join(", ")}</p>
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center text-sm pt-2 border-t border-gray-100">
                <span className="text-gray-600">Return fare ({passengers} × MWK {(returnSchedule!.price || 0).toLocaleString()})</span>
                <span className="font-bold text-gray-900">MWK {returnAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Price Summary ── */}
        <div className="p-4 bg-brand-50 rounded-xl border border-brand-100">
          <p className="text-xs font-semibold text-brand-700 uppercase tracking-wide mb-2">Price Summary</p>
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Outbound fare</span>
              <span className="font-semibold text-gray-900">MWK {outboundAmount.toLocaleString()}</span>
            </div>
            {hasReturn && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Return fare</span>
                <span className="font-semibold text-gray-900">MWK {returnAmount.toLocaleString()}</span>
              </div>
            )}
            {appliedPromo && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-green-600 flex items-center gap-1"><TicketPercent className="w-3 h-3" /> Promo: {appliedPromo.code}</span>
                <span className="font-semibold text-green-600">- MWK {appliedPromo.discount.toLocaleString()}</span>
              </div>
            )}
            <div className="pt-2 border-t border-brand-200 mt-1 flex justify-between items-center">
              <span className="font-bold text-gray-900">Total Amount</span>
              <span className="text-xl font-black text-brand-700">
                MWK {finalTotalAmount.toLocaleString()}
              </span>
            </div>
            {hasReturn && (
              <p className="text-[11px] text-brand-700 mt-1">Round trip — both legs included in the total above.</p>
            )}
          </div>
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
                className="shrink-0 border-brand-200 text-brand-700 hover:bg-brand-50"
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

        {/* ── Passengers ── */}
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">Passengers</p>
          <div className="space-y-2">
            {passengerForms.map((p, i) => (
              <div key={i} className="p-3 bg-gray-50 rounded-lg flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-sm">{p.name}</p>
                  <p className="text-xs text-gray-500">Age {p.ageInput} · {p.gender}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold bg-brand-100 text-brand-700 px-2 py-1 rounded">
                    Seat {p.seatNumber}
                  </span>
                  {hasReturn && selectedReturnSeats[i] && (
                    <span className="text-xs font-semibold bg-slate-200 text-slate-700 px-2 py-1 rounded">
                      Return: {selectedReturnSeats[i]}
                    </span>
                  )}
                </div>
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
            className="flex-1 bg-coral-500 text-white hover:bg-coral-600"
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
  );
}
