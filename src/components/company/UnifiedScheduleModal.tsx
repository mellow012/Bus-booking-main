'use client';

import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Repeat, LayoutTemplate, Sparkles, Loader2 } from 'lucide-react';
import { createSchedule, createRoundTripSchedule, createScheduleTemplate, createRoundTripScheduleTemplate } from '@/lib/actions/schedule.actions';
import { Route, Bus } from '@/types';
import { useAppToast } from '@/contexts/ToastContext';

type ScheduleType = 'single' | 'return' | 'recurring';
type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const DAYS = [
  { value: 0, short: 'Sun', label: 'Sunday' },
  { value: 1, short: 'Mon', label: 'Monday' },
  { value: 2, short: 'Tue', label: 'Tuesday' },
  { value: 3, short: 'Wed', label: 'Wednesday' },
  { value: 4, short: 'Thu', label: 'Thursday' },
  { value: 5, short: 'Fri', label: 'Friday' },
  { value: 6, short: 'Sat', label: 'Saturday' },
] as const;

const fmtDateInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const fmtDateTimeInput = (d: Date) => {
  const base = fmtDateInput(d);
  return `${base}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

interface UnifiedScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  routes: Route[];
  buses: Bus[];
  companyId: string;
  onSuccess: () => void;
  preSelectedRouteId?: string;
  preSelectedBranchId?: string; // If we want to scope it
}

export default function UnifiedScheduleModal({
  isOpen,
  onClose,
  routes,
  buses,
  companyId,
  onSuccess,
  preSelectedRouteId,
  preSelectedBranchId,
}: UnifiedScheduleModalProps) {
  const toast = useAppToast();
  const [scheduleType, setScheduleType] = useState<ScheduleType>('single');
  const [actionLoading, setActionLoading] = useState(false);

  // Form states
  const initialFormState = {
    routeId: preSelectedRouteId || '',
    busId: '',
    departureDateTime: fmtDateTimeInput(new Date(Date.now() + 3600000)),
    arrivalDateTime: fmtDateTimeInput(new Date(Date.now() + 14400000)),
    price: 0,
    availableSeats: 0,
    // Round trip specific
    returnBusId: '',
    returnDepartureDateTime: fmtDateTimeInput(new Date(Date.now() + 86400000)),
    returnArrivalDateTime: fmtDateTimeInput(new Date(Date.now() + 100800000)),
  };
  const [formData, setFormData] = useState(initialFormState);

  const initialTemplateState = {
    routeId: preSelectedRouteId || '',
    busId: '',
    departureTime: '08:00',
    arrivalTime: '12:00',
    daysOfWeek: [] as DayOfWeek[],
    price: 0,
    availableSeats: 0,
    // Return template specific
    returnBusId: '',
    returnDepartureTime: '14:00',
    returnArrivalTime: '18:00',
  };
  const [templateFormData, setTemplateFormData] = useState(initialTemplateState);
  const [includeReturnTemplate, setIncludeReturnTemplate] = useState(false);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setScheduleType('single');
      setFormData({ ...initialFormState, routeId: preSelectedRouteId || '' });
      setTemplateFormData({ ...initialTemplateState, routeId: preSelectedRouteId || '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, preSelectedRouteId]);

  // Handle auto-populating fields
  useEffect(() => {
    if (formData.routeId) {
      const route = routes.find(r => r.id === formData.routeId);
      if (route) setFormData(prev => ({ ...prev, price: route.baseFare }));
    }
  }, [formData.routeId, routes]);

  useEffect(() => {
    if (formData.busId) {
      const bus = buses.find(b => b.id === formData.busId);
      if (bus) setFormData(prev => ({ ...prev, availableSeats: bus.capacity }));
    }
  }, [formData.busId, buses]);

  useEffect(() => {
    if (templateFormData.routeId) {
      const route = routes.find(r => r.id === templateFormData.routeId);
      if (route) setTemplateFormData(prev => ({ ...prev, price: route.baseFare }));
    }
  }, [templateFormData.routeId, routes]);

  useEffect(() => {
    if (templateFormData.busId) {
      const bus = buses.find(b => b.id === templateFormData.busId);
      if (bus) setTemplateFormData(prev => ({ ...prev, availableSeats: bus.capacity }));
    }
  }, [templateFormData.busId, buses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (scheduleType === 'recurring') {
      if (!templateFormData.routeId || !templateFormData.busId) {
        toast.error('Missing fields', 'Please select both a route and a bus.');
        return;
      }
      if (templateFormData.daysOfWeek.length === 0) {
        toast.error('Missing fields', 'Please select at least one day of the week.');
        return;
      }
      if (includeReturnTemplate && !templateFormData.returnBusId) {
        toast.error('Missing fields', 'Please select a bus for the return trip.');
        return;
      }
      setActionLoading(true);
      try {
        if (includeReturnTemplate) {
          const outboundData = {
            ...templateFormData,
            companyId,
          };
          const inboundData = {
            ...templateFormData,
            busId: templateFormData.returnBusId,
            departureTime: templateFormData.returnDepartureTime,
            arrivalTime: templateFormData.returnArrivalTime,
            companyId,
          };
          const result = await createRoundTripScheduleTemplate(outboundData, inboundData);
          if (result.success) {
            toast.success('Templates created', 'Both recurring schedules registered successfully!');
            onSuccess();
            onClose();
          } else throw new Error(result.error);
        } else {
          const result = await createScheduleTemplate({
            ...templateFormData,
            companyId,
          });
          if (result.success) {
            toast.success('Template created', 'Recurring schedule registered successfully!');
            onSuccess();
            onClose();
          } else throw new Error(result.error);
        }
      } catch (err: any) {
        toast.error('Template creation failed', err.message || 'Failed to create template');
      } finally {
        setActionLoading(false);
      }
      return;
    }

    // Single or Return trip
    if (!formData.routeId || !formData.busId) {
      toast.error('Missing fields', 'Please select both a route and a bus.');
      return;
    }

    setActionLoading(true);
    try {
      const route = routes.find(r => r.id === formData.routeId);

      if (scheduleType === 'single') {
        const scheduleData = {
          ...formData,
          departureDateTime: new Date(formData.departureDateTime),
          arrivalDateTime: new Date(formData.arrivalDateTime),
          departureLocation: route?.origin,
          arrivalLocation: route?.destination,
          companyId,
          status: 'active' as const,
        };
        const result = await createSchedule(scheduleData);
        if (result.success) {
          toast.success('Schedule created', 'Single schedule registered successfully!');
          onSuccess();
          onClose();
        } else {
          throw new Error(result.error || 'Failed to create schedule');
        }
      } else if (scheduleType === 'return') {
        if (!formData.returnBusId) {
          throw new Error('Please select a bus for the return trip.');
        }

        const outboundData = {
          ...formData,
          departureDateTime: new Date(formData.departureDateTime),
          arrivalDateTime: new Date(formData.arrivalDateTime),
          companyId,
          status: 'active' as const,
        };
        const inboundData = {
          ...formData,
          busId: formData.returnBusId,
          departureDateTime: new Date(formData.returnDepartureDateTime),
          arrivalDateTime: new Date(formData.returnArrivalDateTime),
          companyId,
          status: 'active' as const,
        };

        const result = await createRoundTripSchedule(outboundData, inboundData);
        if (result.success) {
          toast.success('Round trip created', 'Both schedules registered successfully!');
          onSuccess();
          onClose();
        } else {
          throw new Error(result.error);
        }
      }
    } catch (err: any) {
      toast.error('Schedule creation failed', err.message || 'Failed to add schedule');
    } finally {
      setActionLoading(false);
    }
  };

  // Filter routes based on branch if provided
  const availableRoutes = preSelectedBranchId 
    ? routes.filter(r => r.regionId === preSelectedBranchId)
    : routes;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold text-gray-900">Create Schedule</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <div className="flex gap-2 p-1 bg-gray-100 rounded-lg mb-6">
            {[
              { id: 'single', label: 'Single Trip', icon: CalendarIcon },
              { id: 'return', label: 'Round Trip', icon: Repeat },
              { id: 'recurring', label: 'Recurring', icon: LayoutTemplate },
            ].map(type => (
              <button
                key={type.id}
                type="button"
                onClick={() => setScheduleType(type.id as ScheduleType)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
                  scheduleType === type.id
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                }`}
              >
                <type.icon className="w-4 h-4" /> {type.label}
              </button>
            ))}
          </div>

          <form id="schedule-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Common Fields: Route & Bus */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Transit Corridor *
                </label>
                <select
                  value={scheduleType === 'recurring' ? templateFormData.routeId : formData.routeId}
                  onChange={e => {
                    const val = e.target.value;
                    if (scheduleType === 'recurring') setTemplateFormData({ ...templateFormData, routeId: val });
                    else setFormData({ ...formData, routeId: val });
                  }}
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                  required
                >
                  <option value="">Select Route</option>
                  {availableRoutes.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.origin} → {r.destination} {r.name ? `(${r.name})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assigned Vessel *
                </label>
                <select
                  value={scheduleType === 'recurring' ? templateFormData.busId : formData.busId}
                  onChange={e => {
                    const val = e.target.value;
                    if (scheduleType === 'recurring') setTemplateFormData({ ...templateFormData, busId: val });
                    else setFormData({ ...formData, busId: val });
                  }}
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                  required
                >
                  <option value="">Select Bus</option>
                  {buses.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.licensePlate} ({b.busType} - {b.capacity} seats)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Recurring Specific Fields */}
            {scheduleType === 'recurring' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Recurrence Cycle *
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map(day => {
                      const isActive = templateFormData.daysOfWeek.includes(day.value as any);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => {
                            const days = templateFormData.daysOfWeek.includes(day.value as any)
                              ? templateFormData.daysOfWeek.filter(d => d !== day.value)
                              : [...templateFormData.daysOfWeek, day.value as any];
                            setTemplateFormData({ ...templateFormData, daysOfWeek: days });
                          }}
                          className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                            isActive
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {day.short}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Departure Time *
                    </label>
                    <input
                      type="time"
                      value={templateFormData.departureTime}
                      onChange={e => setTemplateFormData({ ...templateFormData, departureTime: e.target.value })}
                      className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Arrival Time *
                    </label>
                    <input
                      type="time"
                      value={templateFormData.arrivalTime}
                      onChange={e => setTemplateFormData({ ...templateFormData, arrivalTime: e.target.value })}
                      className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                      required
                    />
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeReturnTemplate}
                      onChange={e => setIncludeReturnTemplate(e.target.checked)}
                      className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 w-4 h-4"
                    />
                    <span className="text-sm font-semibold text-gray-900">Include Return Journey</span>
                  </label>
                  <p className="text-xs text-gray-500 ml-6 mt-1">
                    Automatically create a second blueprint for the return route (B → A) on the same days.
                  </p>
                </div>

                {includeReturnTemplate && (
                  <div className="mt-4 space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Return Vessel *
                        </label>
                        <select
                          value={templateFormData.returnBusId}
                          onChange={e => setTemplateFormData({ ...templateFormData, returnBusId: e.target.value })}
                          className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                          required
                        >
                          <option value="">Select Return Bus</option>
                          {buses.map(b => (
                            <option key={b.id} value={b.id}>
                              {b.licensePlate} ({b.busType} - {b.capacity} seats)
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Return Departure Time *
                        </label>
                        <input
                          type="time"
                          value={templateFormData.returnDepartureTime}
                          onChange={e => setTemplateFormData({ ...templateFormData, returnDepartureTime: e.target.value })}
                          className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Return Arrival Time *
                        </label>
                        <input
                          type="time"
                          value={templateFormData.returnArrivalTime}
                          onChange={e => setTemplateFormData({ ...templateFormData, returnArrivalTime: e.target.value })}
                          className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Single / Round Trip Specific Fields */}
            {(scheduleType === 'single' || scheduleType === 'return') && (
              <>
                {scheduleType === 'return' && (
                  <h4 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2 mt-4">Outbound Trip</h4>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Departure Timeline *
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.departureDateTime}
                      onChange={e => setFormData({ ...formData, departureDateTime: e.target.value })}
                      className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Estimated Arrival *
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.arrivalDateTime}
                      onChange={e => setFormData({ ...formData, arrivalDateTime: e.target.value })}
                      className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                      required
                    />
                  </div>
                </div>

                {/* Return Trip Inbound Fields */}
                {scheduleType === 'return' && (
                  <>
                    <h4 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2 mt-6">Return Trip (Inbound)</h4>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Return Vessel *
                        </label>
                        <select
                          value={formData.returnBusId}
                          onChange={e => setFormData({ ...formData, returnBusId: e.target.value })}
                          className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                          required
                        >
                          <option value="">Select Return Bus</option>
                          {buses.map(b => (
                            <option key={b.id} value={b.id}>
                              {b.licensePlate} ({b.busType} - {b.capacity} seats)
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Return Departure Timeline *
                        </label>
                        <input
                          type="datetime-local"
                          value={formData.returnDepartureDateTime}
                          onChange={e => setFormData({ ...formData, returnDepartureDateTime: e.target.value })}
                          className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Return Estimated Arrival *
                        </label>
                        <input
                          type="datetime-local"
                          value={formData.returnArrivalDateTime}
                          onChange={e => setFormData({ ...formData, returnArrivalDateTime: e.target.value })}
                          className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                          required
                        />
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {/* Pricing / Capacity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-100 pt-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Base Fare (MWK) *
                </label>
                <input
                  type="number"
                  value={scheduleType === 'recurring' ? templateFormData.price : formData.price}
                  onChange={e => {
                    const val = parseInt(e.target.value) || 0;
                    if (scheduleType === 'recurring') setTemplateFormData({ ...templateFormData, price: val });
                    else setFormData({ ...formData, price: val });
                  }}
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Available Capacity *
                </label>
                <input
                  type="number"
                  value={scheduleType === 'recurring' ? templateFormData.availableSeats : formData.availableSeats}
                  onChange={e => {
                    const val = parseInt(e.target.value) || 0;
                    if (scheduleType === 'recurring') setTemplateFormData({ ...templateFormData, availableSeats: val });
                    else setFormData({ ...formData, availableSeats: val });
                  }}
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                  required
                />
              </div>
            </div>
          </form>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="schedule-form"
            disabled={actionLoading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold transition-colors text-sm disabled:opacity-50"
          >
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {actionLoading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
