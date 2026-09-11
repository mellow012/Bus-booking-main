'use client';

import { useState } from 'react';
import { Booking, Route, Schedule } from '@/types';
import { Button } from '@/components/ui/button';
import { QrCode, X } from 'lucide-react';

interface PassengerVerificationModalProps {
  booking: Booking;
  selectedTrip: Schedule | null;
  route?: Route | null;
  onClose: () => void;
  onConfirm?: () => void;
  loading?: boolean;
  confirmLabel?: string;
  requirePayment?: boolean;
  requireVerification?: boolean;
  verifiedByScan?: boolean;
  onScan?: () => void;
}

export default function PassengerVerificationModal({
  booking,
  selectedTrip,
  route,
  onClose,
  onConfirm,
  loading = false,
  confirmLabel = 'Confirm passenger',
  requirePayment = false,
  requireVerification = false,
  verifiedByScan = false,
  onScan,
}: PassengerVerificationModalProps) {
  const [reference, setReference] = useState('');
  const [referenceVerified, setReferenceVerified] = useState(verifiedByScan);
  const [verificationError, setVerificationError] = useState('');
  const destinationStopId = (booking as Booking & { destinationStopId?: string }).destinationStopId;
  const stops = selectedTrip?.stops?.length ? selectedTrip.stops : route?.stops || [];
  const dropOffName = destinationStopId && destinationStopId !== '__destination__'
    ? stops.find((stop) => stop.id === destinationStopId)?.name || 'Selected stop'
    : selectedTrip?.arrivalLocation || route?.destination || 'Final destination';
  const isPaid = booking.paymentStatus === 'paid';
  const isVerified = referenceVerified || verifiedByScan;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-white p-5" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-brand-900">Verify passenger</h3>
          <button onClick={onClose} aria-label="Close passenger verification"><X /></button>
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <p><strong>Name:</strong> {booking.passengerDetails?.[0]?.name || 'Passenger'}</p>
          <p><strong>Seat:</strong> {booking.seatNumbers?.join(', ') || '—'}</p>
          <p><strong>Reference:</strong> {booking.bookingReference}</p>
          <p><strong>Drop-off:</strong> {dropOffName}</p>
          <p><strong>Status:</strong> {booking.bookingStatus}</p>
          <p>
            <strong>Payment:</strong>{' '}
            <span className={isPaid ? 'font-bold text-emerald-700' : 'font-bold text-rose-700'}>
              {isPaid ? 'Paid' : booking.paymentStatus}
            </span>
          </p>
        </div>
        <div className="mt-5 rounded-2xl border border-brand-100 bg-brand-50/60 p-4">
          <p className="text-xs font-black uppercase tracking-wider text-brand-800">Verify ticket</p>
          <p className="mt-1 text-xs text-gray-600">Scan the passenger ticket or enter its reference before boarding.</p>
          {onScan && (
            <Button type="button" onClick={onScan} className="mt-3 w-full bg-coral-600 text-white hover:bg-coral-700">
              <QrCode className="mr-2 h-4 w-4" /> Scan ticket
            </Button>
          )}
          <div className="mt-3 flex gap-2">
            <input
              value={reference}
              onChange={(event) => { setReference(event.target.value); setVerificationError(''); setReferenceVerified(false); }}
              placeholder="Enter reference key"
              aria-label="Enter ticket reference key"
              className="min-w-0 flex-1 rounded-xl border bg-white px-3 py-2.5 text-sm uppercase outline-none focus:border-brand-600"
            />
            <Button
              type="button"
              onClick={() => {
                if (reference.trim().toLowerCase() !== booking.bookingReference.toLowerCase()) {
                  setVerificationError('Reference does not match this passenger.');
                  setReferenceVerified(false);
                  return;
                }
                setVerificationError('');
                setReferenceVerified(true);
              }}
              className="bg-brand-700 text-white"
            >
              Verify
            </Button>
          </div>
          {verificationError && <p className="mt-2 text-xs font-bold text-rose-600">{verificationError}</p>}
          {isVerified && <p className="mt-2 text-xs font-bold text-emerald-700">Ticket verified.</p>}
        </div>
        {onConfirm && (
          <Button
            disabled={loading || (requirePayment && !isPaid) || (requireVerification && !isVerified)}
            onClick={onConfirm}
            className="mt-5 w-full bg-brand-700 text-white"
          >
            {loading ? 'Confirming…' : requirePayment && !isPaid ? 'Payment required before boarding' : confirmLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
