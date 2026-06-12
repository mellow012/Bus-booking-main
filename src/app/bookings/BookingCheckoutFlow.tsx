import React, { useEffect, useMemo, useState } from 'react';
import { Wallet, Zap, CreditCard } from 'lucide-react';
import { BookingWithDetails } from './useBookingsList';

export const PAYMENT_CATEGORIES = [
  { id: 'cash', label: 'Cash on Boarding', hint: 'Pay the conductor when boarding', Icon: Wallet },
  { id: 'flutterwave', label: 'Flutterwave', hint: 'Pay via Flutterwave checkout', Icon: Zap },
  { id: 'paychangu', label: 'PayChangu', hint: 'Pay via PayChangu', Icon: CreditCard },
];

export const PaymentMethodSelector: React.FC<{
  booking: BookingWithDetails;
  onSelect: (provider: string, subId: string, label: string) => void;
  loading?: boolean;
}> = ({ booking, onSelect, loading }) => {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">Choose a payment method for booking {booking.bookingReference || booking.id.slice(-8)}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {PAYMENT_CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id, c.id + '_default', c.label)}
            disabled={loading}
            className="flex items-center gap-3 px-4 py-3 rounded-lg border hover:shadow transition"
          >
            <c.Icon className="w-5 h-5 text-gray-700" />
            <div className="text-left">
              <div className="font-medium text-sm">{c.label}</div>
              <div className="text-xs text-gray-500">{c.hint}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export const ConfirmAndPayForm: React.FC<{
  booking: BookingWithDetails;
  provider?: string;
  providerLabel?: string;
  subMethodId?: string;
  userDetails: { name: string; email: string; phone: string };
  onChange: (d: { name: string; email: string; phone: string }) => void;
  onSubmit: (e: any, extra?: { transactionId?: string }) => void;
  loading?: boolean;
  formatDate: (d: unknown) => string;
  formatTime: (d: unknown) => string;
}> = ({ booking, userDetails, onChange, onSubmit, loading, formatDate, formatTime, providerLabel }) => {
  const isCash = providerLabel?.toLowerCase().includes('cash');

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-2">
        <input name="name" value={userDetails.name} onChange={(e) => onChange({ ...userDetails, name: e.target.value })} placeholder="Full name" className="w-full p-2 border rounded" />
        <input name="email" value={userDetails.email} onChange={(e) => onChange({ ...userDetails, email: e.target.value })} placeholder="Email" className="w-full p-2 border rounded" />
        <input name="phone" value={userDetails.phone} onChange={(e) => onChange({ ...userDetails, phone: e.target.value })} placeholder="Phone" className="w-full p-2 border rounded" />
      </div>

      <div className="text-sm text-gray-600">
        <div>Route: {booking.route?.origin} → {booking.route?.destination}</div>
        <div>Departure: {formatDate(booking.schedule.departureDateTime)} {formatTime(booking.schedule.departureDateTime)}</div>
        <div className="font-medium mt-2">Total: MWK {booking.totalAmount.toLocaleString()}</div>
      </div>

      <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg font-bold disabled:opacity-50 active:scale-[.98]">
        {loading ? 'Processing…' : isCash ? 'Confirm — Pay on Boarding' : `Confirm & Pay — MWK ${booking.totalAmount.toLocaleString()}`}
      </button>
    </form>
  );
};

export type BookingCheckoutDrawerProps = {
  booking: BookingWithDetails | null;
  initialStep?: 'select' | 'confirm';
  onClose?: () => void;
  onSelect: (provider: string, subId: string, label: string) => void;
  onConfirm: (e: any, extra?: { transactionId?: string }) => void;
  loading?: boolean;
  actionLoading?: string | null;
  userDetails: { name: string; email: string; phone: string };
  setUserDetails: (d: { name: string; email: string; phone: string }) => void;
  formatDate: (d: unknown) => string;
  formatTime: (d: unknown) => string;
  providerLabel?: string;
};

const BookingCheckoutDrawer: React.FC<BookingCheckoutDrawerProps> = ({ booking, initialStep = 'select', onClose, onSelect, onConfirm, loading, userDetails, setUserDetails, formatDate, formatTime, providerLabel }) => {
  const [step, setStep] = useState<'select' | 'confirm'>(initialStep);

  useEffect(() => {
    setStep(initialStep);
  }, [initialStep]);

  if (!booking) return null;

  return (
    <div className="space-y-4">
      {step === 'select' && (
        <PaymentMethodSelector booking={booking} loading={loading} onSelect={(provider, subId, label) => { onSelect(provider, subId, label); setStep('confirm'); }} />
      )}
      {step === 'confirm' && (
        <ConfirmAndPayForm booking={booking} providerLabel={providerLabel} userDetails={userDetails} onChange={setUserDetails} onSubmit={onConfirm} loading={loading} formatDate={formatDate} formatTime={formatTime} />
      )}
    </div>
  );
};

export default BookingCheckoutDrawer;
