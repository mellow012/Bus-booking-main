import React, { useEffect, useState } from 'react';
import { Wallet, Smartphone, CheckCircle2 } from 'lucide-react';
import { BookingWithDetails } from './useBookingsList';

export const PAYMENT_CATEGORIES = [
  {
    id: 'paychangu',
    label: 'Mobile Money',
    hint: 'Pay via PayChangu (Airtel / TNM)',
    Icon: Smartphone,
    accent: 'from-violet-500 to-purple-600',
    border: 'border-violet-200 hover:border-violet-400',
    bg: 'hover:bg-violet-50',
  },
  {
    id: 'cash',
    label: 'Cash on Boarding',
    hint: 'Pay the conductor when you board',
    Icon: Wallet,
    accent: 'from-amber-400 to-orange-500',
    border: 'border-amber-200 hover:border-amber-400',
    bg: 'hover:bg-amber-50',
  },
];

export const PaymentMethodSelector: React.FC<{
  booking: BookingWithDetails;
  onSelect: (provider: string, subId: string, label: string) => void;
  loading?: boolean;
}> = ({ booking, onSelect, loading }) => (
  <div className="space-y-4">
    <div className="text-center pb-3 border-b border-gray-100">
      <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-0.5">Booking</p>
      <p className="font-bold text-gray-900">{booking.bookingReference || booking.id.slice(-8)}</p>
      <p className="text-2xl font-black text-gray-900 mt-1">MWK {booking.totalAmount.toLocaleString()}</p>
    </div>
    <p className="text-sm font-semibold text-gray-700">How would you like to pay?</p>
    <div className="grid grid-cols-1 gap-3">
      {PAYMENT_CATEGORIES.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id, c.id + '_default', c.label)}
          disabled={loading}
          className={`flex items-center gap-4 px-5 py-4 rounded-2xl border-2 transition-all duration-200 ${c.border} ${c.bg} group`}
        >
          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${c.accent} flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform`}>
            <c.Icon className="w-5 h-5 text-white" />
          </div>
          <div className="text-left flex-1">
            <div className="font-bold text-gray-900 text-sm">{c.label}</div>
            <div className="text-xs text-gray-500 mt-0.5">{c.hint}</div>
          </div>
          <CheckCircle2 className="w-5 h-5 text-gray-300 group-hover:text-violet-400 transition-colors shrink-0" />
        </button>
      ))}
    </div>
  </div>
);

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
      <div className="bg-gray-50 rounded-xl p-4 space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Route</span>
          <span className="font-medium text-gray-900">{booking.route?.origin} → {booking.route?.destination}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Departure</span>
          <span className="font-medium text-gray-900">{formatDate(booking.schedule.departureDateTime)} {formatTime(booking.schedule.departureDateTime)}</span>
        </div>
        <div className="flex justify-between border-t border-gray-200 pt-2 mt-1">
          <span className="text-gray-700 font-semibold">Total</span>
          <span className="font-black text-gray-900 text-base">MWK {booking.totalAmount.toLocaleString()}</span>
        </div>
      </div>

      {!isCash && (
        <div className="grid grid-cols-1 gap-3">
          <input
            name="name" value={userDetails.name}
            onChange={(e) => onChange({ ...userDetails, name: e.target.value })}
            placeholder="Full name" required
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
          <input
            name="email" type="email" value={userDetails.email}
            onChange={(e) => onChange({ ...userDetails, email: e.target.value })}
            placeholder="Email address" required
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
          <input
            name="phone" type="tel" value={userDetails.phone}
            onChange={(e) => onChange({ ...userDetails, phone: e.target.value })}
            placeholder="Phone e.g. +265 999 000 111" required
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
          <p className="text-xs text-gray-400">
            You'll be redirected to PayChangu to complete payment securely via Airtel or TNM mobile money.
          </p>
        </div>
      )}

      {isCash && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <Wallet className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" />
          <span>Have <strong>MWK {booking.totalAmount.toLocaleString()}</strong> ready to pay the conductor when you board. Your seat is reserved.</span>
        </div>
      )}

      <button
        type="submit" disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-2xl hover:from-violet-600 hover:to-purple-700 transition-all shadow-lg font-bold disabled:opacity-50 active:scale-[.98] text-sm"
      >
        {loading ? 'Processing…' : isCash ? '✓ Confirm — Pay on Boarding' : `Pay MWK ${booking.totalAmount.toLocaleString()} via Mobile Money`}
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

const BookingCheckoutDrawer: React.FC<BookingCheckoutDrawerProps> = ({
  booking, initialStep = 'select', onSelect, onConfirm, loading,
  userDetails, setUserDetails, formatDate, formatTime, providerLabel,
}) => {
  const [step, setStep] = useState<'select' | 'confirm'>(initialStep);

  useEffect(() => { setStep(initialStep); }, [initialStep]);

  if (!booking) return null;

  return (
    <div className="space-y-4">
      {step === 'select' && (
        <PaymentMethodSelector
          booking={booking} loading={loading}
          onSelect={(provider, subId, label) => { onSelect(provider, subId, label); setStep('confirm'); }}
        />
      )}
      {step === 'confirm' && (
        <ConfirmAndPayForm
          booking={booking} providerLabel={providerLabel}
          userDetails={userDetails} onChange={setUserDetails}
          onSubmit={onConfirm} loading={loading}
          formatDate={formatDate} formatTime={formatTime}
        />
      )}
    </div>
  );
};

export default BookingCheckoutDrawer;
