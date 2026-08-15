import React from "react";
import Modal from "@/components/Modals";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, Calendar, Clock } from "lucide-react";
import { toDate, formatTimeAMPM } from "@/lib/chatterHelpers";

export interface ChatterConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: any;
  selectedSeats: string[];
  passengers: any[];
  totalAmount: number;
  loading: boolean;
  onConfirm: () => void;
}

export default function ChatterConfirmModal({
  isOpen, onClose, schedule, selectedSeats, passengers, totalAmount, loading, onConfirm
}: ChatterConfirmModalProps) {
  const scheduleDateObj = toDate(schedule.travelDate);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Confirm Booking Details">
      <div className="space-y-5">
        <div className="bg-brand-50 p-3 rounded-lg">
          <p className="text-sm text-brand-700 font-medium">
            Review your chatter booking details before proceeding to payment.
          </p>
        </div>

        <div className="rounded-xl border border-brand-200 overflow-hidden">
          <div className="bg-brand-700 px-4 py-2 flex items-center gap-2">
            <span className="text-white text-xs font-bold uppercase tracking-wide">🚌 Chatter Trip</span>
          </div>
          <div className="p-4 bg-white space-y-4">
            <div className="flex items-start gap-2">
              <span className="text-base mt-0.5 shrink-0">👥</span>
              <div>
                <p className="text-xs text-gray-500">Passengers</p>
                <ul className="text-sm font-semibold space-y-1.5 mt-1">
                  {passengers.map(p => (
                    <li key={p.seatNumber} className="flex items-center gap-2">
                      <span className="truncate">{p.firstName} {p.lastName}</span>
                      <span className="text-gray-400 font-normal text-xs">(Seat {p.seatNumber})</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            
            <div className="w-full h-px bg-gray-100"></div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Origin</p>
                  <p className="font-semibold text-sm text-green-800">{schedule.origin}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Destination</p>
                  <p className="font-semibold text-sm text-red-700">{schedule.destination}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-brand-700 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Departure</p>
                  <p className="font-semibold text-sm">{scheduleDateObj ? scheduleDateObj.toLocaleDateString() : 'TBD'}</p>
                  <p className="text-xs text-brand-700 font-medium">{formatTimeAMPM(schedule.departureTime)}</p>
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
          </div>
        </div>

        <div className="p-4 bg-brand-50/80 rounded-xl border border-brand-100 space-y-2.5">
          <p className="text-xs font-black text-brand-800 uppercase tracking-wider">Price Breakdown</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between items-center text-gray-700">
              <span>Fare ({selectedSeats.length} x MWK {schedule.fare.toLocaleString()})</span>
              <span className="font-semibold text-gray-900">MWK {totalAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center pt-2 mt-2 border-t border-brand-200">
              <span className="font-bold text-gray-900">Total to Pay</span>
              <span className="text-lg font-black text-brand-700">MWK {totalAmount.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button type="button" variant="outline" className="flex-1 bg-white hover:bg-gray-50" onClick={onClose} disabled={loading}>
            Review details
          </Button>
          <Button type="button" className="flex-1 bg-brand-600 hover:bg-brand-700 text-white" onClick={onConfirm} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...
              </>
            ) : (
              "Proceed to Payment"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
