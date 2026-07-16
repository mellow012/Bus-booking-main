'use client';

import React, { useState } from 'react';
import { Sparkles, Loader2, X, CalendarRange, Info } from 'lucide-react';
import { materializeSchedules } from '@/lib/actions/schedule.actions';
import { useAppToast } from '@/contexts/ToastContext';

const HORIZON_OPTIONS = [
  { label: '1 Week',   value: 7 },
  { label: '2 Weeks',  value: 14 },
  { label: '1 Month',  value: 30 },
  { label: '2 Months', value: 60 },
];

interface GenerateTripsModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  routeId: string;
  routeName?: string;
  onSuccess: () => void;
}

export default function GenerateTripsModal({
  isOpen,
  onClose,
  companyId,
  routeId,
  routeName,
  onSuccess,
}: GenerateTripsModalProps) {
  const toast = useAppToast();
  const [daysAhead, setDaysAhead] = useState(30);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const result = await materializeSchedules(companyId, routeId, daysAhead);
      if (result.success) {
        if (result.createdCount === 0) {
          toast.info('Nothing new', 'All trips for this period already exist. No duplicates created.');
        } else {
          toast.success(
            'Trips Generated!',
            `${result.createdCount} new bookable trip${result.createdCount === 1 ? '' : 's'} created for the next ${daysAhead} days.`
          );
          onSuccess();
        }
        onClose();
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      toast.error('Generation failed', err.message || 'Failed to generate trips.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md shadow-xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Generate Bookable Trips</h2>
              {routeName && <p className="text-xs text-gray-500">{routeName}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              This will generate individual bookable trips from your active recurring blueprints for this route.
              Running it multiple times is safe — no duplicate trips will be created.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-3">
              <CalendarRange className="w-4 h-4 inline-block mr-1.5 text-gray-500" />
              How far ahead should we generate trips?
            </label>
            <div className="grid grid-cols-2 gap-3">
              {HORIZON_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDaysAhead(option.value)}
                  className={`p-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                    daysAhead === option.value
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-60 shadow-sm"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Generate Trips</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
