import React, { Suspense } from 'react';
import BookingsClient from './BookingsClient';
import BookingsLoading from './loading';

export const dynamic = 'force-dynamic';

export default function BookingsPage() {
  return (
    <Suspense fallback={<BookingsLoading />}>
      <BookingsClient />
    </Suspense>
  );
}
