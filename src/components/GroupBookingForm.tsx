'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebaseConfig';
import { collection, addDoc, Timestamp, doc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { GroupBookingFormData, Schedule } from '@/types';
import { 
  Users, 
  MessageCircle, 
  Loader2,
  AlertCircle,
  CheckCircle2,
  Phone,
  Calendar,
  MapPin,
  DollarSign,
  ArrowRight,
  X
} from 'lucide-react';

interface GroupBookingFormProps {
  scheduleId: string;
  routeId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const GroupBookingForm: React.FC<GroupBookingFormProps> = ({
  scheduleId,
  routeId,
  onSuccess,
  onCancel,
}) => {
  const { user, userProfile } = useAuth();
  const [formData, setFormData] = useState<GroupBookingFormData>({
    organizerName: userProfile?.firstName && userProfile?.lastName 
      ? `${userProfile.firstName} ${userProfile.lastName}` 
      : '',
    organizerPhone: userProfile?.phone || '',
    seatsRequested: 10,
    notes: '',
  });
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Fetch schedule data
  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        setLoading(true);
        const scheduleRef = doc(db, 'schedules', scheduleId);
        const scheduleDoc = await getDoc(scheduleRef);
        
        if (scheduleDoc.exists()) {
          const data = scheduleDoc.data() as Omit<Schedule, 'id'>;
          // Ensure price field exists
          const pricePerSeat = data.price || data.price;
          const scheduleData: Schedule = {
            id: scheduleDoc.id,
            ...data,
            price: pricePerSeat !== undefined ? pricePerSeat : 0,
          };
          setSchedule(scheduleData);
          setError('');
        } else {
          setError('Schedule not found. Please go back and try again.');
        }
      } catch (err: any) {
        console.error('Fetch schedule error:', err);
        setError('Failed to load schedule details. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (scheduleId) {
      fetchSchedule();
    }
  }, [scheduleId]);

  // Validation function
  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.organizerName.trim()) {
      errors.organizerName = 'Full name is required';
    }

    if (!formData.organizerPhone.trim()) {
      errors.organizerPhone = 'Phone number is required';
    } else if (!/^\+?[0-9\s\-\(\)]{10,}$/.test(formData.organizerPhone)) {
      errors.organizerPhone = 'Please enter a valid phone number';
    }

    if (!formData.seatsRequested || formData.seatsRequested < 1) {
      errors.seatsRequested = 'Minimum 1 seat required';
    } else if (schedule && formData.seatsRequested > schedule.availableSeats) {
      errors.seatsRequested = `Only ${schedule.availableSeats} seats available`;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, schedule]);

  const handleSeatsChange = (value: number) => {
    if (value < 1) return;
    setFormData(prev => ({ ...prev, seatsRequested: value }));
    // Clear seat error when user corrects it
    if (validationErrors.seatsRequested) {
      setValidationErrors(prev => {
        const updated = { ...prev };
        delete updated.seatsRequested;
        return updated;
      });
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear field error when user starts correcting it
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!user || !schedule) {
      setError('User or schedule information missing. Please try again.');
      return;
    }

    if (!validateForm()) {
      setError('Please fix the errors above.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const totalPrice = formData.seatsRequested * (schedule.price || schedule.price || 0);
      
      await addDoc(collection(db, 'groupRequests'), {
        userId: user.uid,
        organizerName: formData.organizerName.trim(),
        organizerPhone: formData.organizerPhone.trim(),
        routeId,
        scheduleId,
        seatsRequested: formData.seatsRequested,
        seatsBooked: [],
        totalPrice,
        companyId: schedule.companyId,
        status: 'pending',
        notes: formData.notes.trim(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      console.error('Group request error:', err);
      setError('Failed to submit your request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Skeleton Loader Component
  const SkeletonLoader = () => (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 sm:p-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
        <div className="space-y-4">
          {Array(5).fill(0).map((_, i) => (
            <div key={i} className="h-12 bg-gray-200 rounded"></div>
          ))}
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="flex gap-3">
            <div className="h-12 bg-gray-200 rounded flex-1"></div>
            <div className="h-12 bg-gray-200 rounded flex-1"></div>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) return <SkeletonLoader />;

  if (error && !schedule) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg border border-red-200 p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 mb-1">Error Loading Schedule</h3>
              <p className="text-sm text-red-700 mb-4">{error}</p>
              <Button
                onClick={onCancel}
                variant="outline"
                className="border-red-200 hover:bg-red-50"
              >
                Go Back
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!schedule) return null;

  const totalPrice = formData.seatsRequested * (schedule.price || schedule.price || 0);
  const estimatedTotal = totalPrice.toLocaleString();

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">
                  Group Booking Request
                </h2>
                <p className="text-blue-100 text-sm">
                  Get custom pricing for your group
                </p>
              </div>
            </div>
            <button
              onClick={onCancel}
              disabled={submitting}
              className="text-white/70 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Success Message */}
        {success && (
          <div className="bg-green-50 border-b border-green-200 px-4 sm:px-6 py-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-green-900 mb-1">Request Submitted Successfully!</h4>
                <p className="text-sm text-green-700">
                  The bus company will contact you soon with custom pricing for {formData.seatsRequested} seats.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="p-4 sm:p-6">
          {/* Schedule Summary */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 mb-6 border border-blue-100">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-600 mb-1">Route</p>
                  <p className="font-semibold text-gray-900 truncate text-sm">
                    {schedule.departureLocation} <ArrowRight className="w-3 h-3 inline" /> {schedule.arrivalLocation}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-600 mb-1">Departure</p>
                  <p className="font-semibold text-gray-900 text-sm">
                    {schedule.departureDateTime instanceof Timestamp
                      ? schedule.departureDateTime.toDate().toLocaleString()
                      : schedule.departureDateTime instanceof Date
                      ? schedule.departureDateTime.toLocaleString()
                      : 'TBA'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <DollarSign className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-600 mb-1">Per Seat</p>
                  <p className="font-semibold text-gray-900 text-sm">
                    MWK {(schedule.price || schedule.price || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Organizer Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Full Name *
              </label>
              <Input
                placeholder="e.g., John Doe"
                value={formData.organizerName}
                onChange={(e) => handleInputChange('organizerName', e.target.value)}
                disabled={submitting}
                className={`rounded-lg ${validationErrors.organizerName ? 'border-red-500 focus:ring-red-500' : ''}`}
              />
              {validationErrors.organizerName && (
                <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {validationErrors.organizerName}
                </p>
              )}
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Contact Phone Number *
              </label>
              <Input
                placeholder="e.g., +265999123456"
                value={formData.organizerPhone}
                onChange={(e) => handleInputChange('organizerPhone', e.target.value)}
                disabled={submitting}
                className={`rounded-lg ${validationErrors.organizerPhone ? 'border-red-500 focus:ring-red-500' : ''}`}
                type="tel"
              />
              {validationErrors.organizerPhone && (
                <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {validationErrors.organizerPhone}
                </p>
              )}
            </div>

            {/* Seats Requested */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Number of Seats *
              </label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="Minimum 1 seat"
                  value={formData.seatsRequested}
                  onChange={(e) => handleSeatsChange(parseInt(e.target.value) || 0)}
                  disabled={submitting}
                  min="1"
                  max={schedule.availableSeats}
                  className={`rounded-lg ${validationErrors.seatsRequested ? 'border-red-500 focus:ring-red-500' : ''}`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                  Available: {schedule.availableSeats}
                </span>
              </div>
              {validationErrors.seatsRequested && (
                <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {validationErrors.seatsRequested}
                </p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Group Purpose (Optional)
              </label>
              <Textarea
                placeholder="e.g., School trip, wedding party, corporate event, etc."
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                disabled={submitting}
                rows={4}
                className="rounded-lg resize-none"
              />
            </div>

            {/* Price Summary */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-700">
                  {formData.seatsRequested} seat{formData.seatsRequested !== 1 ? 's' : ''} × MWK {(schedule.price || schedule.price || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <span className="font-semibold text-gray-900">Estimated Total:</span>
                <span className="text-xl font-bold text-blue-600">
                  MWK {estimatedTotal}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                The bus company will confirm final pricing after reviewing your request.
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-semibold py-3 h-auto disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Submit Request
                  </>
                )}
              </Button>
              <Button
                type="button"
                onClick={onCancel}
                disabled={submitting}
                variant="outline"
                className="flex-1 rounded-lg py-3 h-auto"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default GroupBookingForm;