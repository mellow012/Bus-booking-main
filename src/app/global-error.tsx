'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="flex-1 flex flex-col items-center justify-center min-h-screen px-4 bg-gray-50">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">A critical error occurred</h2>
          <Button
            onClick={() => reset()}
            className="h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-base font-semibold"
          >
            Try again
          </Button>
        </div>
      </body>
    </html>
  );
}
