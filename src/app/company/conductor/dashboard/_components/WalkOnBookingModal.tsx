'use client';

import React, { FC, useState, useEffect } from 'react';
import { Schedule, Bus, Booking, TripStop } from '@/types';
import {
  Bus as BusIcon, Info, CheckCircle, AlertCircle, Loader2,
  Banknote, ChevronLeft, ChevronRight, Check, UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Modal from '@/components/Modals';
import { format } from 'date-fns';

type WalkOnStep = 'seat' | 'details' | 'payment' | 'confirm';

export interface WalkOnFormData {
  firstName: string;
  lastName: string;
  phone: string;
  sex: 'male' | 'female' | 'other' | '';
  age: string;
  amountPaid: string;
  originStopId: string;
  destinationStopId: string;
}

interface WalkOnBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Schedule | null;
  bus: Bus | null;
  existingBookings: Booking[];
  stopSequence: TripStop[];
  currentStopIndex: number;
  onConfirm: (seatNumber: string, data: WalkOnFormData, amount: number) => Promise<void>;
  loading: boolean;
}

const toDate = (v: unknown): Date => {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  if (v && typeof v === 'object' && 'toDate' in v && typeof (v as any).toDate === 'function') return (v as any).toDate();
  return new Date(v as string | number);
};

const WalkOnBookingModal: FC<WalkOnBookingModalProps> = ({
  isOpen, onClose, trip, bus, existingBookings, stopSequence, currentStopIndex, onConfirm, loading,
}) => {
  const [step, setStep] = useState<WalkOnStep>('seat');
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
  const [form, setForm] = useState<WalkOnFormData>({
    firstName: '', lastName: '', phone: '', sex: '', age: '',
    amountPaid: String(trip?.price || ''), originStopId: '', destinationStopId: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof WalkOnFormData, string>>>({});

  const boardingStop = stopSequence[currentStopIndex];
  const remainingStops = stopSequence.slice(currentStopIndex + 1);

  useEffect(() => {
    if (isOpen) {
      setStep('seat'); setSelectedSeat(null);
      setForm({
        firstName: '', lastName: '', phone: '', sex: '', age: '',
        amountPaid: String(trip?.price || ''),
        originStopId: boardingStop?.id ?? '__origin__',
        destinationStopId: remainingStops[remainingStops.length - 1]?.id ?? '__destination__',
      });
      setErrors({});
    }
  }, [isOpen, trip?.price]);

  if (!trip || !bus) return null;

  const fareAmount = trip.price || 0;
  const parsedAmount = parseFloat(form.amountPaid);
  const change = parsedAmount > fareAmount ? parsedAmount - fareAmount : 0;
  const departure = toDate(trip.departureDateTime);

  const validateDetails = () => {
    const errs: Partial<Record<keyof WalkOnFormData, string>> = {};
    if (!form.firstName.trim()) errs.firstName = 'Required';
    if (!form.lastName.trim()) errs.lastName = 'Required';
    if (!form.phone.trim()) errs.phone = 'Required';
    if (!form.sex) errs.sex = 'Required';
    if (!form.age.trim()) errs.age = 'Required';
    else if (isNaN(Number(form.age)) || Number(form.age) < 1 || Number(form.age) > 120) errs.age = 'Invalid';
    if (!form.destinationStopId) errs.destinationStopId = 'Required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validatePayment = () => {
    const errs: Partial<Record<keyof WalkOnFormData, string>> = {};
    if (!form.amountPaid || isNaN(parsedAmount) || parsedAmount <= 0) errs.amountPaid = 'Enter a valid amount';
    else if (parsedAmount < fareAmount) errs.amountPaid = `Min MWK ${fareAmount.toLocaleString()}`;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (step === 'seat' && selectedSeat) setStep('details');
    if (step === 'details' && validateDetails()) setStep('payment');
    if (step === 'payment' && validatePayment()) setStep('confirm');
  };

  const handleBack = () => {
    if (step === 'details') setStep('seat');
    if (step === 'payment') setStep('details');
    if (step === 'confirm') setStep('payment');
  };

  const handleSubmit = async () => {
    if (!selectedSeat) return;
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
    await onConfirm(selectedSeat, form, parsedAmount);
    onClose();
  };

  const stepIndex: Record<WalkOnStep, number> = { seat: 0, details: 1, payment: 2, confirm: 3 };
  const currentStepIdx = stepIndex[step];

  // Progress bar instead of numbered circles
  const renderProgressBar = () => (
    <div className="space-y-2">
      <div className="flex justify-between text-[11px] font-bold text-gray-500">
        <span className={currentStepIdx >= 0 ? 'text-blue-600' : ''}>Seat</span>
        <span className={currentStepIdx >= 1 ? 'text-blue-600' : ''}>Details</span>
        <span className={currentStepIdx >= 2 ? 'text-blue-600' : ''}>Payment</span>
        <span className={currentStepIdx >= 3 ? 'text-blue-600' : ''}>Confirm</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-blue-600 h-2 rounded-full transition-all duration-500"
          style={{ width: `${((currentStepIdx + 1) / 4) * 100}%` }}
        />
      </div>
    </div>
  );

  const renderTripInfo = () => (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-1.5">
      <div className="flex items-center gap-2 text-blue-800 font-bold text-sm">
        <Info className="w-4 h-4" /> Trip Info
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        <div><p className="text-blue-600 text-[10px] font-bold">From</p>
          <p className="font-bold text-blue-900 text-xs truncate">{boardingStop?.name ?? trip.departureLocation}</p></div>
        <div><p className="text-blue-600 text-[10px] font-bold">To</p>
          <p className="font-bold text-blue-900 text-xs truncate">
            {remainingStops.find(s => s.id === form.destinationStopId)?.name ?? trip.arrivalLocation}
          </p></div>
        <div><p className="text-blue-600 text-[10px] font-bold">Date</p>
          <p className="font-bold text-blue-900 text-xs">{format(departure, 'EEE, MMM d')}</p></div>
        <div><p className="text-blue-600 text-[10px] font-bold">Fare</p>
          <p className="font-black text-blue-900 text-sm">MWK {fareAmount.toLocaleString()}</p></div>
      </div>
    </div>
  );

  const renderSeatStep = () => (
    <div className="space-y-3">
      {renderTripInfo()}
      <p className="text-sm text-gray-600 font-medium">Tap an available seat:</p>
      <div className="bg-gray-50 rounded-xl border p-3 sm:p-4">
        <div className="flex justify-center mb-3">
          <div className="px-3 py-1 bg-gray-200 rounded-full text-[11px] text-gray-600 font-bold flex items-center gap-1.5">
            <BusIcon className="w-3.5 h-3.5" /> Front
          </div>
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {Array.from({ length: bus.capacity }).map((_, i) => {
            const seatNum = (i + 1).toString();
            const booking = existingBookings.find(b => b.seatNumbers?.includes(seatNum) && b.bookingStatus !== 'cancelled');
            const isTaken = !!booking;
            const isSelected = selectedSeat === seatNum;
            let cls = 'aspect-square rounded-xl flex items-center justify-center font-bold text-sm border-2 transition-all min-h-[44px] ';
            if (isSelected) cls += 'bg-blue-600 border-blue-700 text-white scale-105 shadow-lg';
            else if (isTaken) {
              if (booking?.bookingStatus === 'confirmed') cls += 'bg-green-500 border-green-600 text-white cursor-not-allowed';
              else if (booking?.bookingStatus === 'no-show') cls += 'bg-red-400 border-red-500 text-white cursor-not-allowed';
              else if (booking?.paymentStatus !== 'paid') cls += 'bg-amber-400 border-amber-500 text-white cursor-not-allowed';
              else cls += 'bg-blue-400 border-blue-500 text-white cursor-not-allowed';
            } else {
              cls += 'bg-white border-gray-300 text-gray-700 hover:border-blue-400 hover:bg-blue-50 active:scale-95';
            }
            return (
              <button key={seatNum} className={cls} onClick={() => !isTaken && setSelectedSeat(seatNum)}
                disabled={isTaken}
                title={isTaken ? `Seat ${seatNum} — Taken` : `Seat ${seatNum}`}>
                {seatNum}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 justify-center text-[10px] text-gray-600">
          {[
            { color: 'bg-white border-2 border-gray-300', label: 'Free' },
            { color: 'bg-blue-600', label: 'Selected' },
            { color: 'bg-amber-400', label: 'Cash due' },
            { color: 'bg-green-500', label: 'Boarded' },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1">
              <span className={`w-3 h-3 rounded ${color} inline-block`} /> {label}
            </span>
          ))}
        </div>
      </div>
      {selectedSeat && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 text-sm text-blue-800 font-bold">
          <CheckCircle className="w-4 h-4 text-blue-600" /> Seat {selectedSeat} selected
        </div>
      )}
    </div>
  );

  const renderDetailsStep = () => (
    <div className="space-y-3">
      {renderTripInfo()}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-1">Destination <span className="text-red-500">*</span></label>
        <select value={form.destinationStopId} onChange={e => setForm({ ...form, destinationStopId: e.target.value })}
          className={`w-full px-3 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${errors.destinationStopId ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}>
          <option value="">Select destination…</option>
          {remainingStops.map(stop => <option key={stop.id} value={stop.id}>{stop.name}</option>)}
        </select>
        <p className="text-xs text-gray-500 mt-1">Boarding: <strong>{boardingStop?.name}</strong></p>
        {errors.destinationStopId && <p className="text-xs text-red-600 mt-1">{errors.destinationStopId}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">First Name <span className="text-red-500">*</span></label>
          <input type="text" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })}
            className={`w-full px-3 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.firstName ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
            placeholder="John" />
          {errors.firstName && <p className="text-xs text-red-600 mt-1">{errors.firstName}</p>}
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Last Name <span className="text-red-500">*</span></label>
          <input type="text" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })}
            className={`w-full px-3 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.lastName ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
            placeholder="Banda" />
          {errors.lastName && <p className="text-xs text-red-600 mt-1">{errors.lastName}</p>}
        </div>
      </div>
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-1">Phone <span className="text-red-500">*</span></label>
        <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
          className={`w-full px-3 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.phone ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
          placeholder="+265 999 000 000" />
        {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Sex <span className="text-red-500">*</span></label>
          <select value={form.sex} onChange={e => setForm({ ...form, sex: e.target.value as WalkOnFormData['sex'] })}
            className={`w-full px-3 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${errors.sex ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}>
            <option value="">Select…</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
          {errors.sex && <p className="text-xs text-red-600 mt-1">{errors.sex}</p>}
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Age <span className="text-red-500">*</span></label>
          <input type="number" value={form.age} onChange={e => setForm({ ...form, age: e.target.value })}
            className={`w-full px-3 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.age ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
            placeholder="30" min={1} max={120} />
          {errors.age && <p className="text-xs text-red-600 mt-1">{errors.age}</p>}
        </div>
      </div>
    </div>
  );

  const renderPaymentStep = () => (
    <div className="space-y-3">
      {renderTripInfo()}
      <div className="flex items-center gap-3 p-3 bg-gray-50 border rounded-xl">
        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center shrink-0">{selectedSeat}</div>
        <div className="min-w-0">
          <p className="font-bold text-gray-900 truncate">{form.firstName} {form.lastName}</p>
          <p className="text-xs text-gray-500">{form.phone} · {form.sex} · {form.age}yrs</p>
        </div>
      </div>
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-1.5">Amount Received (MWK) <span className="text-red-500">*</span></label>
        <div className="relative">
          <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="number" value={form.amountPaid}
            onChange={e => { setForm({ ...form, amountPaid: e.target.value }); setErrors({}); }}
            className={`w-full pl-10 pr-4 py-3.5 border rounded-xl text-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.amountPaid ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
            placeholder={String(fareAmount)} min={0} />
        </div>
        {errors.amountPaid && <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> {errors.amountPaid}</p>}
        {!errors.amountPaid && parsedAmount > 0 && (
          <div className="mt-2 text-sm">
            {change > 0 ? <p className="text-amber-700 font-bold">💵 Change: MWK {change.toLocaleString()}</p>
              : parsedAmount === fareAmount ? <p className="text-green-700 font-bold">✓ Exact amount</p> : null}
          </div>
        )}
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
        <p className="font-bold">Cash only — collect before confirming.</p>
      </div>
    </div>
  );

  const renderConfirmStep = () => (
    <div className="space-y-3">
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-green-800 font-bold text-base">
          <CheckCircle className="w-5 h-5" /> Ready to confirm
        </div>
        <div className="grid grid-cols-2 gap-2.5 text-sm">
          <div><p className="text-gray-500 text-xs">Passenger</p><p className="font-bold">{form.firstName} {form.lastName}</p></div>
          <div><p className="text-gray-500 text-xs">Phone</p><p className="font-bold">{form.phone}</p></div>
          <div><p className="text-gray-500 text-xs">Seat</p><p className="font-bold">Seat {selectedSeat}</p></div>
          <div><p className="text-gray-500 text-xs">Sex / Age</p><p className="font-bold capitalize">{form.sex} · {form.age}yrs</p></div>
          <div><p className="text-gray-500 text-xs">From</p><p className="font-bold truncate">{boardingStop?.name}</p></div>
          <div><p className="text-gray-500 text-xs">To</p><p className="font-bold truncate">{remainingStops.find(s => s.id === form.destinationStopId)?.name}</p></div>
          <div><p className="text-gray-500 text-xs">Paid</p><p className="font-bold">MWK {parsedAmount.toLocaleString()}</p></div>
          <div><p className="text-gray-500 text-xs">Change</p>
            <p className={`font-bold ${change > 0 ? 'text-amber-700' : ''}`}>
              {change > 0 ? `MWK ${change.toLocaleString()}` : 'None'}
            </p></div>
        </div>
      </div>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Walk-on Booking">
      <div className="space-y-4">
        {renderProgressBar()}
        <div>
          {step === 'seat' && renderSeatStep()}
          {step === 'details' && renderDetailsStep()}
          {step === 'payment' && renderPaymentStep()}
          {step === 'confirm' && renderConfirmStep()}
        </div>
        <div className="flex gap-3 pt-2 border-t">
          {step !== 'seat'
            ? <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold" onClick={handleBack} disabled={loading}><ChevronLeft className="w-4 h-4 mr-1" /> Back</Button>
            : <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold" onClick={onClose} disabled={loading}>Cancel</Button>}
          {step !== 'confirm'
            ? <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white h-12 rounded-xl font-bold" onClick={handleNext} disabled={step === 'seat' && !selectedSeat}>
              Continue <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
            : <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white h-12 rounded-xl font-bold" onClick={handleSubmit} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Confirm &amp; Board
            </Button>}
        </div>
      </div>
    </Modal>
  );
};

export default WalkOnBookingModal;
