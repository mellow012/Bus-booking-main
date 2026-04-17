'use client';

import React, { FC, useState, useEffect } from 'react';
import { Booking } from '@/types';
import { Banknote, ArrowRight, AlertCircle, Loader2, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Modal from '@/components/Modals';

interface CashCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  onConfirm: (bookingId: string, amount: number) => Promise<void>;
  loading: boolean;
}

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
      setAmountError(`Amount is less than the fare (MWK ${expectedAmount.toLocaleString()}). Collect the full amount.`); return;
    }
    setAmountError('');
    await onConfirm(booking.id, parsedAmount);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Collect Cash Payment">
      <div className="space-y-5">
        <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
            {booking.seatNumbers?.[0] || '?'}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{passenger?.name || 'Passenger'}</p>
            <p className="text-sm text-gray-500">{booking.contactPhone || 'No contact'}</p>
            <p className="text-sm text-gray-500">Seat {booking.seatNumbers?.join(', ') || '?'}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Fare Due</p>
            <p className="text-xl font-bold text-gray-900">MWK {expectedAmount.toLocaleString()}</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-400 px-1">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold">1</div>
            <span className="text-amber-700 font-medium">Collect Cash</span>
          </div>
          <ArrowRight className="w-4 h-4" />
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-bold">2</div>
            <span>Mark Boarded / No-Show</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount Received (MWK)</label>
          <div className="relative">
            <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="number"
              value={inputAmount}
              onChange={e => { setInputAmount(e.target.value); setAmountError(''); }}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              placeholder={String(expectedAmount)} min={0}
            />
          </div>
          {amountError && (
            <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />{amountError}
            </p>
          )}
          {change > 0 && !amountError && (
            <p className="mt-1.5 text-sm text-green-700 font-medium">💵 Change to give: MWK {change.toLocaleString()}</p>
          )}
          {parsedAmount === expectedAmount && !amountError && inputAmount && (
            <p className="mt-1.5 text-sm text-green-700 font-medium">✓ Exact amount</p>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          <p className="font-medium mb-0.5">After collecting payment:</p>
          <p>The <strong>Boarded</strong> and <strong>No-Show</strong> buttons will unlock for this passenger.</p>
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
            onClick={handleConfirm} disabled={loading || !inputAmount}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <DollarSign className="w-4 h-4 mr-2" />}
            Confirm Payment
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default CashCollectionModal;
