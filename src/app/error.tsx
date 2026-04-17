'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Optionally log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh] px-4">
      <div className="text-center max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-8 h-8 text-rose-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Something went wrong!</h2>
        <p className="text-gray-500 mb-8">
          We apologize for the inconvenience. An unexpected error occurred while processing your request.
        </p>
        <div className="flex flex-col gap-3">
          <Button
            onClick={() => reset()}
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-base font-semibold transition-colors"
          >
            Try again
          </Button>
          <Button
            variant="outline"
            onClick={() => window.location.href = '/'}
            className="w-full h-12 rounded-xl text-base font-medium transition-colors"
          >
            Go back home
          </Button>
        </div>
      </div>
    </div>
  );
}
