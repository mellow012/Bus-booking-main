"use client";

import React, { useState, useCallback } from 'react';
import { PassengerDetails } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Modal from '@/components/Modals';
import { AlertCircle, Users, ArrowLeft, Loader2 } from 'lucide-react';

interface PassengerFormProps {
  passengerDetails: PassengerDetails[];
  onSubmit: (details: PassengerDetails[]) => void;
  onBack: () => void;
  loading: boolean;
  originName?: string;
  alightName?: string;
}

interface ValidationError {
  field: keyof PassengerDetails | 'ageInput';
  message: string;
  passengerIndex: number;
}

// Internal shape — age is a string while typing so the field
// can hold partial values like "" or "2" without snapping back.
interface InternalPassenger {
  name: string;
  ageInput: string;   // what the user sees / types
  gender: 'male' | 'female' | 'other' | '';
  seatNumber: string;
  ticketType: 'adult' | 'child' | 'senior';
}

function toInternal(p: PassengerDetails): InternalPassenger {
  return {
    name:       p.name       ?? '',
    ageInput:   p.age != null ? String(p.age) : '',
    gender:     (p.gender as InternalPassenger['gender']) ?? '',
    seatNumber: p.seatNumber ?? '',
    ticketType: (p.ticketType as InternalPassenger['ticketType']) ?? 'adult',
  };
}

function toExternal(p: InternalPassenger): PassengerDetails {
  return {
    name:       p.name.trim(),
    age:        parseInt(p.ageInput, 10),
    gender:     p.gender as PassengerDetails['gender'],
    seatNumber: p.seatNumber,
    ticketType: p.ticketType as PassengerDetails['ticketType'],
  };
}

export default function PassengerForm({
  passengerDetails,
  onSubmit,
  onBack,
  loading,
  originName,
  alightName,
}: PassengerFormProps) {
  const [details, setDetails] = useState<InternalPassenger[]>(
    () => passengerDetails.map(toInternal)
  );
  const [errors, setErrors]   = useState<ValidationError[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState<PassengerDetails[] | null>(null);

  // ── Field change ─────────────────────────────────────────────────────────────

  const handleChange = useCallback((
    index: number,
    field: keyof InternalPassenger,
    value: string
  ) => {
    setDetails(prev => prev.map((p, i) => {
      if (i !== index) return p;

      if (field === 'name') {
        // Allow letters, spaces, hyphens, apostrophes, dots — max 50 chars
        return { ...p, name: value.replace(/[^a-zA-Z\s\-'\.]/g, '').slice(0, 50) };
      }

      if (field === 'ageInput') {
        // Only allow digits — no decimals, no minus signs
        return { ...p, ageInput: value.replace(/\D/g, '').slice(0, 3) };
      }

      return { ...p, [field]: value };
    }));

    // Clear the error for this field as soon as the user starts editing
    setErrors(prev => prev.filter(
      e => !(e.passengerIndex === index && e.field === field)
    ));
  }, []);

  // ── Age blur — clamp to 1–120 ────────────────────────────────────────────────
  // We DON'T clamp on every keystroke because that is what prevents typing "20"
  // (each digit would immediately be clamped to a number, preventing partial entry).
  // Instead we only normalise when the user leaves the field.

  const handleAgeBlur = useCallback((index: number) => {
    setDetails(prev => prev.map((p, i) => {
      if (i !== index) return p;
      const raw = parseInt(p.ageInput, 10);
      if (isNaN(raw)) return p; // leave blank so user sees the validation error
      const clamped = Math.min(120, Math.max(1, raw));
      return { ...p, ageInput: String(clamped) };
    }));
  }, []);

  // ── Validation ───────────────────────────────────────────────────────────────

  const validate = useCallback((rows: InternalPassenger[]): ValidationError[] => {
    const errs: ValidationError[] = [];
    const nameRegex = /^[a-zA-Z\s\-'\.]{2,50}$/;

    rows.forEach((p, i) => {
      if (!p.name.trim()) {
        errs.push({ field: 'name', message: 'Name is required', passengerIndex: i });
      } else if (!nameRegex.test(p.name.trim())) {
        errs.push({ field: 'name', message: 'Enter a valid name (letters, spaces, hyphens, apostrophes)', passengerIndex: i });
      }

      const age = parseInt(p.ageInput, 10);
      if (!p.ageInput || isNaN(age) || age < 1 || age > 120) {
        errs.push({ field: 'ageInput', message: 'Age must be between 1 and 120', passengerIndex: i });
      }

      if (!p.gender || !['male', 'female', 'other'].includes(p.gender)) {
        errs.push({ field: 'gender', message: 'Please select a gender', passengerIndex: i });
      }
    });

    return errs;
  }, []);

  // ── Submit ───────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsValidating(true);

    const errs = validate(details);
    if (errs.length > 0) {
      setErrors(errs);
      setIsValidating(false);
      return;
    }

    const sanitised = details.map(toExternal);
    const names     = sanitised.map(p => p.name.toLowerCase());
    const hasDupes  = new Set(names).size !== names.length;

    if (hasDupes) {
      setPendingSubmit(sanitised);
      setIsConfirmModalOpen(true);
    } else {
      setErrors([]);
      onSubmit(sanitised);
    }

    setIsValidating(false);
  }, [details, validate, onSubmit]);

  const handleConfirmSubmit = () => {
    if (pendingSubmit) { setErrors([]); onSubmit(pendingSubmit); }
    setIsConfirmModalOpen(false);
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const getError = (index: number, field: ValidationError['field']) =>
    errors.find(e => e.passengerIndex === index && e.field === field);

  const isSubmitDisabled = loading || isValidating;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <Card className="shadow-lg border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Users className="w-5 h-5" />
            Passenger Details
          </CardTitle>
          <p className="text-sm text-gray-600">
            Please provide accurate information for all passengers.
          </p>
          {originName && alightName && (
            <p className="text-sm text-blue-600 mt-2 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
              {originName}
              <span className="text-gray-400">→</span>
              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
              {alightName}
            </p>
          )}
        </CardHeader>

        <CardContent>
          {errors.length > 0 && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please correct the errors below before continuing.
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {details.map((passenger, index) => (
              <div key={index} className="space-y-4 p-4 border rounded-xl bg-gray-50">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                      {index + 1}
                    </span>
                    Passenger {index + 1}
                  </h3>
                  <span className="text-sm text-gray-600 bg-blue-100 text-blue-700 font-medium px-2 py-1 rounded">
                    Seat {passenger.seatNumber}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor={`name-${index}`}>Full Name <span className="text-red-500">*</span></Label>
                    <Input
                      id={`name-${index}`}
                      type="text"
                      value={passenger.name}
                      onChange={e => handleChange(index, 'name', e.target.value)}
                      placeholder="e.g. Chisomo Banda"
                      className={getError(index, 'name') ? 'border-red-500 focus:ring-red-500' : ''}
                      required
                      disabled={loading}
                    />
                    {getError(index, 'name') && (
                      <p className="text-xs text-red-600">{getError(index, 'name')!.message}</p>
                    )}
                  </div>

                  {/* Age — type="text" with inputMode="numeric" */}
                  <div className="space-y-1.5">
                    <Label htmlFor={`age-${index}`}>Age <span className="text-red-500">*</span></Label>
                    <Input
                      id={`age-${index}`}
                      type="text"           // ← NOT "number"
                      inputMode="numeric"   // ← numeric keyboard on mobile
                      pattern="[0-9]*"
                      value={passenger.ageInput}
                      onChange={e => handleChange(index, 'ageInput', e.target.value)}
                      onBlur={() => handleAgeBlur(index)}
                      placeholder="e.g. 28"
                      className={getError(index, 'ageInput') ? 'border-red-500 focus:ring-red-500' : ''}
                      required
                      disabled={loading}
                    />
                    {getError(index, 'ageInput') && (
                      <p className="text-xs text-red-600">{getError(index, 'ageInput')!.message}</p>
                    )}
                  </div>

                  {/* Gender */}
                  <div className="space-y-1.5">
                    <Label htmlFor={`gender-${index}`}>Gender <span className="text-red-500">*</span></Label>
                    <Select
                      value={passenger.gender}
                      onValueChange={value => handleChange(index, 'gender', value)}
                      disabled={loading}
                    >
                      <SelectTrigger className={getError(index, 'gender') ? 'border-red-500' : ''}>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {getError(index, 'gender') && (
                      <p className="text-xs text-red-600">{getError(index, 'gender')!.message}</p>
                    )}
                  </div>

                </div>
              </div>
            ))}

            <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t">
              <Button
                type="button"
                onClick={onBack}
                variant="outline"
                className="flex-1"
                disabled={isSubmitDisabled}
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Seats
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                disabled={isSubmitDisabled}
              >
                {isSubmitDisabled ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isValidating ? 'Validating…' : 'Processing…'}
                  </>
                ) : (
                  'Continue to Review'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Duplicate name confirmation */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="Confirm Duplicate Names"
      >
        <div className="space-y-4">
          <p className="text-gray-700 text-sm">
            You have entered duplicate passenger names. Please make sure this is correct before continuing.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setIsConfirmModalOpen(false)}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleConfirmSubmit}>
              Yes, Continue
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}   