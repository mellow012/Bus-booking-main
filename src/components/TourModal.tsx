import React, { useEffect, useRef, useState } from 'react';
import { X, ArrowRight, ArrowLeft, Search, CreditCard, CheckCircle } from 'lucide-react';

interface TourModalProps {
  open: boolean;
  onClose: () => void;
}

const slides = [
  {
    id: 'search',
    title: 'Search Schedules',
    description: 'Quickly find routes and times across partner companies — filter by date, origin and destination.',
    icon: <Search className="w-10 h-10 text-blue-600" />,
  },
  {
    id: 'select',
    title: 'Choose Seats & Date',
    description: 'Select the best seats, view prices and available amenities before you book.',
    icon: <CreditCard className="w-10 h-10 text-green-600" />,
  },
  {
    id: 'pay',
    title: 'Secure Payment & Confirmation',
    description: 'Pay securely and get immediate booking confirmation with e-tickets sent to your profile.',
    icon: <CheckCircle className="w-10 h-10 text-purple-600" />,
  },
];

export default function TourModal({ open, onClose }: TourModalProps) {
  const [index, setIndex] = useState(0);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (open) {
      setIndex(0);
      // trap focus simply by focusing close button
      setTimeout(() => closeButtonRef.current?.focus(), 50);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, slides.length - 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const goNext = () => {
    if (index < slides.length - 1) setIndex(index + 1);
    else onClose();
  };

  const goPrev = () => setIndex(Math.max(0, index - 1));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"> 
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`tour-title-${slides[index].id}`}
        className="relative bg-white rounded-2xl shadow-2xl max-w-xl w-full mx-4 p-6 sm:p-8 z-10"
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 id={`tour-title-${slides[index].id}`} className="text-lg font-bold text-gray-900">
              {slides[index].title}
            </h3>
            <p className="text-sm text-gray-600 mt-1">{slides[index].description}</p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="text-sm text-gray-400">{index + 1}/{slides.length}</div>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              aria-label="Close tour"
              className="p-2 rounded-md hover:bg-gray-100 text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center text-center">
          <div className="w-24 h-24 flex items-center justify-center bg-gray-50 rounded-full">
            {slides[index].icon}
          </div>
          <div className="mt-4 text-sm text-gray-700 max-w-lg">{slides[index].description}</div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div>
            <button
              onClick={goPrev}
              disabled={index === 0}
              className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${index === 0 ? 'text-gray-300' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </button>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="text-sm text-gray-500 hover:underline"
            >
              Skip
            </button>

            <button
              onClick={goNext}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {index < slides.length - 1 ? (
                <>
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              ) : (
                'Finish'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
