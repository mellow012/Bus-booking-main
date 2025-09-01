"use client";

import React, { useState, useCallback } from 'react';
import { PassengerDetail } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { AlertCircle, Users, ArrowLeft, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

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

  // Enhanced validation with better error messaging
  const validatePassengerDetails = useCallback((details: PassengerDetail[]): ValidationError[] => {
    const validationErrors: ValidationError[] = [];

    details.forEach((passenger, index) => {
      // Name validation
      const nameRegex = /^[a-zA-Z\s\-\'\.]{2,50}$/;
      if (!passenger.name?.trim()) {
        validationErrors.push({
          field: 'name',
          message: 'Name is required',
          passengerIndex: index
        });
      } else if (!nameRegex.test(passenger.name.trim())) {
        validationErrors.push({
          field: 'name',
          message: 'Name must be 2-50 characters and contain only letters, spaces, hyphens, apostrophes, and periods',
          passengerIndex: index
        });
      }

      // Age validation
      if (!passenger.age || passenger.age < 1 || passenger.age > 120) {
        validationErrors.push({
          field: 'age',
          message: 'Age must be between 1 and 120',
          passengerIndex: index
        });
      }

      // Gender validation
      if (!passenger.gender || !['male', 'female', 'other'].includes(passenger.gender)) {
        validationErrors.push({
          field: 'gender',
          message: 'Please select a valid gender',
          passengerIndex: index
        });
      }

      // Contact number validation (if provided)
      if (passenger.contactNumber) {
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        const cleanPhone = passenger.contactNumber.replace(/[\s\-\(\)]/g, '');
        if (!phoneRegex.test(cleanPhone)) {
          validationErrors.push({
            field: 'contactNumber',
            message: 'Invalid phone number format',
            passengerIndex: index
          });
        }
      }

      // Seat number validation
      if (!passenger.seatNumber?.trim()) {
        validationErrors.push({
          field: 'seatNumber',
          message: 'Seat number is required',
          passengerIndex: index
        });
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
    
    // Process value based on field type
    let processedValue: string | number = value;
    if (field === 'name' && typeof value === 'string') {
      // Sanitize name input
      processedValue = value.replace(/[^a-zA-Z\s\-\'\.]/g, '').slice(0, 50);
    } else if (field === 'age') {
      processedValue = Math.max(1, Math.min(120, Number(value) || 18));
    } else if (field === 'contactNumber' && typeof value === 'string') {
      // Allow only digits, spaces, hyphens, parentheses, and plus sign
      processedValue = value.replace(/[^\d\s\-\(\)\+]/g, '').slice(0, 20);
    }

    newDetails[index] = { ...newDetails[index], [field]: processedValue };
    setDetails(newDetails);

    // Clear specific field errors when user starts typing
    setErrors(prev => prev.filter(
      error => !(error.passengerIndex === index && error.field === field)
    ));
  }, [details]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsValidating(true);

    try {
      // Validate all passenger details
      const validationErrors = validatePassengerDetails(details);
      
      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        setIsValidating(false);
        return;
      }

      // Check for duplicate names (warning, not error)
      const names = details.map(p => p.name.trim().toLowerCase());
      const duplicateNames = names.filter((name, index) => names.indexOf(name) !== index);
      
      if (duplicateNames.length > 0) {
        const confirmed = window.confirm(
          "You have entered duplicate passenger names. This might be intentional for family members with the same name. Do you want to continue?"
        );
        if (!confirmed) {
          setIsValidating(false);
          return;
        }
      }

      // Sanitize and prepare final data
      const sanitizedDetails = details.map(passenger => ({
        ...passenger,
        name: passenger.name.trim(),
        contactNumber: passenger.contactNumber?.replace(/[\s\-\(\)]/g, '') || ''
      }));

      setErrors([]);
      onSubmit(sanitizedDetails);
    } catch (error) {
      console.error('Form validation error:', error);
      setErrors([{
        field: 'name',
        message: 'An unexpected error occurred. Please try again.',
        passengerIndex: 0
      }]);
    } finally {
      setIsValidating(false);
    }
  }, [details, validatePassengerDetails, onSubmit]);

  const getFieldError = (passengerIndex: number, field: keyof PassengerDetail) => {
    return errors.find(error => error.passengerIndex === passengerIndex && error.field === field);
  };

  const hasErrors = errors.length > 0;
  const isSubmitDisabled = loading || isValidating || hasErrors;

  return (
    <Card className="shadow-lg border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Users className="w-5 h-5" />
          Passenger Details
        </CardTitle>
        <p className="text-sm text-gray-600">
          Please provide accurate information for all passengers as it will be used for boarding verification.
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Global error display */}
        {hasErrors && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please correct the errors below before continuing.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {details.map((passenger, index) => {
            const passengerErrors = errors.filter(error => error.passengerIndex === index);
            
            return (
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
                  {/* Name Field */}
                  <div className="space-y-2">
                    <Label htmlFor={`name-${index}`} className="text-sm font-medium">
                      Full Name *
                    </Label>
                    <Input
                      id={`name-${index}`}
                      type="text"
                      value={passenger.name || ''}
                      onChange={(e) => handleChange(index, 'name', e.target.value)}
                      placeholder="Enter full name"
                      className={getFieldError(index, 'name') ? 'border-red-500 focus:border-red-500' : ''}
                      required
                      maxLength={50}
                      disabled={loading}
                      aria-describedby={getFieldError(index, 'name') ? `name-error-${index}` : undefined}
                    />
                    {getFieldError(index, 'name') && (
                      <p id={`name-error-${index}`} className="text-sm text-red-600" role="alert">
                        {getFieldError(index, 'name')?.message}
                      </p>
                    )}
                  </div>

                  {/* Age Field */}
                  <div className="space-y-2">
                    <Label htmlFor={`age-${index}`} className="text-sm font-medium">
                      Age *
                    </Label>
                    <Input
                      id={`age-${index}`}
                      type="number"
                      value={passenger.age || ''}
                      onChange={(e) => handleChange(index, 'age', parseInt(e.target.value) || 18)}
                      min="1"
                      max="120"
                      className={getFieldError(index, 'age') ? 'border-red-500 focus:border-red-500' : ''}
                      required
                      disabled={loading}
                      aria-describedby={getFieldError(index, 'age') ? `age-error-${index}` : undefined}
                    />
                    {getFieldError(index, 'age') && (
                      <p id={`age-error-${index}`} className="text-sm text-red-600" role="alert">
                        {getFieldError(index, 'age')?.message}
                      </p>
                    )}
                  </div>

                  {/* Gender Field */}
                  <div className="space-y-2">
                    <Label htmlFor={`gender-${index}`} className="text-sm font-medium">
                      Gender *
                    </Label>
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
                      <p className="text-sm text-red-600" role="alert">
                        {getFieldError(index, 'gender')?.message}
                      </p>
                    )}
                  </div>

                  {/* Contact Number Field (Optional) */}
                  <div className="space-y-2">
                    <Label htmlFor={`contact-${index}`} className="text-sm font-medium">
                      Contact Number (Optional)
                    </Label>
                    <Input
                      id={`contact-${index}`}
                      type="tel"
                      value={passenger.contactNumber || ''}
                      onChange={(e) => handleChange(index, 'contactNumber', e.target.value)}
                      placeholder="+265 123 456 789"
                      className={getFieldError(index, 'contactNumber') ? 'border-red-500 focus:border-red-500' : ''}
                      maxLength={20}
                      disabled={loading}
                      aria-describedby={getFieldError(index, 'contactNumber') ? `contact-error-${index}` : undefined}
                    />
                    {getFieldError(index, 'contactNumber') && (
                      <p id={`contact-error-${index}`} className="text-sm text-red-600" role="alert">
                        {getFieldError(index, 'contactNumber')?.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Passenger-specific errors */}
                {passengerErrors.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {passengerErrors.map((error, errorIndex) => (
                      <p key={errorIndex} className="text-sm text-red-600" role="alert">
                        • {error.message}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t">
            <Button
              type="button"
              onClick={onBack}
              variant="outline"
              className="flex-1 flex items-center justify-center gap-2"
              disabled={loading || isValidating}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Seats
            </Button>
            
            <Button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 flex items-center justify-center gap-2"
              disabled={isSubmitDisabled}
            >
              {(loading || isValidating) ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isValidating ? 'Validating...' : 'Processing...'}
                </>
              ) : (
                'Continue to Review'
              )}
            </Button>
          </div>
        </form>

        {/* Form Help Text */}
        <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded-lg">
          <p className="font-medium">Important:</p>
          <ul className="mt-1 space-y-1">
            <li>• Names must match official ID documents</li>
            <li>• Contact numbers are optional but recommended for trip updates</li>
            <li>• All information will be verified during boarding</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}