'use client';

import React, { FC, useState, useEffect } from 'react';
import { Booking } from '@/types';
import { Banknote, ArrowRight, AlertCircle, Loader2, DollarSign, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Modal from '@/components/Modals';

interface CashCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  onConfirm: (bookingId: string, amount: number) => Promise<void>;
  loading: boolean;
}

const vibrate = () => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
};

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000];

const CashCollectionModal: FC<CashCollectionModalProps> = ({
  isOpen, onClose, booking, onConfirm, loading,
}) => {
  const [inputAmount, setInputAmount] = useState('');
  const [amountError, setAmountError] = useState('');

  useEffect(() => {
    if (booking) { setInputAmount(String(booking.totalAmount || '')); setAmountError(''); }
  }, [booking]);

  if (!booking) return null;

  const expectedAmount = booking.totalAmount || 0;
  const parsedAmount = parseFloat(inputAmount);
  const passenger = booking.passengerDetails?.[0];
  const change = parsedAmount > expectedAmount ? parsedAmount - expectedAmount : 0;

  const handleConfirm = async () => {
    if (!inputAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setAmountError('Please enter a valid amount'); return;
    }
    if (parsedAmount < expectedAmount) {
      setAmountError(`Amount is less than the fare (MWK ${expectedAmount.toLocaleString()})`); return;
    }
    setAmountError('');
    vibrate();
    await onConfirm(booking.id, parsedAmount);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Collect Cash Payment">
      <div className="space-y-4">
        {/* Passenger Info */}
        <div className="flex items-center gap-3 p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
            {booking.seatNumbers?.[0] || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900">{passenger?.name || 'Passenger'}</p>
            <p className="text-sm text-gray-500">{booking.contactPhone || 'No contact'}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide font-bold">Fare</p>
            <p className="text-lg font-black text-gray-900">MWK {expectedAmount.toLocaleString()}</p>
          </div>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center justify-between text-xs text-gray-400 px-1">
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold">1</div>
            <span className="text-amber-700 font-bold">Collect Cash</span>
          </div>
          <ArrowRight className="w-4 h-4" />
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-bold">2</div>
            <span>Board / No-Show</span>
          </div>
        </div>

        {/* Quick Amount Buttons */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Quick Amount</p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {QUICK_AMOUNTS.map(amt => (
              <button
                key={amt}
                onClick={() => { setInputAmount(String(amt)); setAmountError(''); }}
                className={`py-2.5 px-2 rounded-xl text-sm font-bold border transition-all active:scale-95 ${
                  parsedAmount === amt
                    ? 'bg-amber-600 text-white border-amber-600 shadow-md'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-amber-300'
                }`}
              >
                {amt >= 1000 ? `${amt / 1000}K` : amt}
              </button>
            ))}
          </div>
        </div>

        {/* Amount Input */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1.5">Amount Received (MWK)</label>
          <div className="relative">
            <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="number"
              value={inputAmount}
              onChange={e => { setInputAmount(e.target.value); setAmountError(''); }}
              className="w-full pl-10 pr-4 py-3.5 border border-gray-300 rounded-xl text-xl font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              placeholder={String(expectedAmount)} min={0}
            />
          </div>
          {amountError && (
            <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />{amountError}
            </p>
          )}
          {!amountError && parsedAmount > 0 && (
            <div className="mt-2 text-sm">
              {change > 0 ? (
                <p className="text-amber-700 font-bold flex items-center gap-1">💵 Change: MWK {change.toLocaleString()}</p>
              ) : parsedAmount === expectedAmount ? (
                <p className="text-green-700 font-bold flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Exact amount</p>
              ) : null}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
          <p className="font-bold mb-0.5">After collecting payment:</p>
          <p>The <strong>Boarded</strong> and <strong>No-Show</strong> buttons will unlock.</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white h-12 rounded-xl font-bold active:scale-[0.97]"
            onClick={handleConfirm} disabled={loading || !inputAmount}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <DollarSign className="w-5 h-5 mr-2" />}
            Confirm Payment
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default CashCollectionModal;
