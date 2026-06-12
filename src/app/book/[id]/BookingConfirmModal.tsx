import React from "react";
import Modal from "@/components/Modals";
import { Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TicketPercent, Loader2, CreditCard } from "lucide-react";
import type { Schedule } from "@/types";
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
  bookingLoading: boolean;
  passengerForms: PassengerFormState[];
  goBackToPassengers: () => void;
  confirmBooking: () => Promise<void> | void;
}

export default function BookingConfirmModal({
  isOpen, onClose, schedule, originStopId, destinationStopId, stopName,
  formatDate, formatTime, selectedSeats, displayPrice, passengers,
  appliedPromo, promoCode, setPromoCode, isValidatingPromo, validatePromoCode,
  setAppliedPromo, bookingLoading, passengerForms, goBackToPassengers, confirmBooking,
}: BookingConfirmModalProps) {
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
                <span className="text-gray-600">Base Fare ({passengers}x)</span>
                <span className="font-semibold text-gray-900">MWK {(displayPrice * passengers).toLocaleString()}</span>
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
                  MWK {((displayPrice * passengers) - (appliedPromo?.discount || 0)).toLocaleString()}
                </span>
              </div>
            </div>
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
  );
}
