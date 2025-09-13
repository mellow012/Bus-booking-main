"use client";

import React, { useState, useCallback } from 'react';
import { PassengerDetail } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Modal from '@/components/Modals'; // Ensure this path is correct for your project
import { AlertCircle, Users, ArrowLeft, Loader2 } from 'lucide-react';

interface PassengerFormProps {
  passengerDetails: PassengerDetail[];
  onSubmit: (details: PassengerDetail[]) => void;
  onBack: () => void;
  loading: boolean;
}

interface ValidationError {
  field: keyof PassengerDetail;
  message: string;
  passengerIndex: number;
}

export default function PassengerForm({
  passengerDetails,
  onSubmit,
  onBack,
  loading
}: PassengerFormProps) {
  const [details, setDetails] = useState<PassengerDetail[]>(passengerDetails);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [finalDetails, setFinalDetails] = useState<PassengerDetail[] | null>(null);

  const validatePassengerDetails = useCallback((detailsToValidate: PassengerDetail[]): ValidationError[] => {
    const validationErrors: ValidationError[] = [];
    detailsToValidate.forEach((passenger, index) => {
      const nameRegex = /^[a-zA-Z\s\-\'\.]{2,50}$/;
      if (!passenger.name?.trim()) {
        validationErrors.push({ field: 'name', message: 'Name is required', passengerIndex: index });
      } else if (!nameRegex.test(passenger.name.trim())) {
        validationErrors.push({ field: 'name', message: 'Enter a valid name (letters, spaces, etc.)', passengerIndex: index });
      }

      if (!passenger.age || passenger.age < 1 || passenger.age > 120) {
        validationErrors.push({ field: 'age', message: 'Age must be between 1 and 120', passengerIndex: index });
      }

      if (!passenger.gender || !['male', 'female', 'other'].includes(passenger.gender)) {
        validationErrors.push({ field: 'gender', message: 'Please select a gender', passengerIndex: index });
      }
    });
    return validationErrors;
  }, []);

  const handleChange = useCallback((
    index: number,
    field: keyof PassengerDetail,
    value: string | number
  ) => {
    const newDetails = [...details];
    let processedValue = value;

    if (field === 'name' && typeof value === 'string') {
      processedValue = value.replace(/[^a-zA-Z\s\-\'\.]/g, '').slice(0, 50);
    } else if (field === 'age') {
      processedValue = Math.max(1, Math.min(120, Number(value) || 18));
    }

    newDetails[index] = { ...newDetails[index], [field]: processedValue };
    setDetails(newDetails);

    setErrors(prev => prev.filter(
      error => !(error.passengerIndex === index && error.field === field)
    ));
  }, [details]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsValidating(true);

    const validationErrors = validatePassengerDetails(details);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      setIsValidating(false);
      return;
    }

    const sanitizedDetails = details.map(passenger => ({
      ...passenger,
      name: passenger.name.trim(),
    }));

    const names = sanitizedDetails.map(p => p.name.toLowerCase());
    const hasDuplicates = new Set(names).size !== names.length;

    if (hasDuplicates) {
      setFinalDetails(sanitizedDetails);
      setIsConfirmModalOpen(true);
      setIsValidating(false);
    } else {
      setErrors([]);
      onSubmit(sanitizedDetails);
      setIsValidating(false);
    }
  }, [details, validatePassengerDetails, onSubmit]);

  const handleConfirmSubmit = () => {
    if (finalDetails) {
      setErrors([]);
      onSubmit(finalDetails);
    }
    setIsConfirmModalOpen(false);
  };

  const getFieldError = (passengerIndex: number, field: keyof PassengerDetail) => {
    return errors.find(error => error.passengerIndex === passengerIndex && error.field === field);
  };

  const isSubmitDisabled = loading || isValidating;

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
              <div key={index} className="space-y-4 p-4 border rounded-lg bg-gray-50">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800">
                    Passenger {index + 1}
                  </h3>
                  <span className="text-sm text-gray-600 bg-blue-100 px-2 py-1 rounded">
                    Seat: {passenger.seatNumber}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`name-${index}`}>Full Name *</Label>
                    <Input
                      id={`name-${index}`}
                      type="text"
                      value={passenger.name || ''}
                      onChange={(e) => handleChange(index, 'name', e.target.value)}
                      placeholder="Enter full name"
                      className={getFieldError(index, 'name') ? 'border-red-500' : ''}
                      required
                      disabled={loading}
                    />
                    {getFieldError(index, 'name') && (
                      <p className="text-sm text-red-600">
                        {getFieldError(index, 'name')?.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`age-${index}`}>Age *</Label>
                    <Input
                      id={`age-${index}`}
                      type="number"
                      value={passenger.age || ''}
                      onChange={(e) => handleChange(index, 'age', parseInt(e.target.value))}
                      min="1"
                      max="120"
                      className={getFieldError(index, 'age') ? 'border-red-500' : ''}
                      required
                      disabled={loading}
                    />
                    {getFieldError(index, 'age') && (
                      <p className="text-sm text-red-600">
                        {getFieldError(index, 'age')?.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`gender-${index}`}>Gender *</Label>
                    <Select
                      value={passenger.gender || ''}
                      onValueChange={(value) => handleChange(index, 'gender', value)}
                      disabled={loading}
                    >
                      <SelectTrigger className={getFieldError(index, 'gender') ? 'border-red-500' : ''}>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {getFieldError(index, 'gender') && (
                      <p className="text-sm text-red-600">
                        {getFieldError(index, 'gender')?.message}
                      </p>
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
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Seats
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={isSubmitDisabled}
              >
                {isSubmitDisabled ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isValidating ? 'Validating...' : 'Processing...'}
                  </>
                ) : (
                  'Continue to Review'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="Confirm Duplicate Names"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            You have entered duplicate passenger names. Please ensure this is correct before continuing.
          </p>
          <div className="flex justify-end space-x-3 pt-4">
            <Button variant="outline" onClick={() => setIsConfirmModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmSubmit}>
              Yes, Continue
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}