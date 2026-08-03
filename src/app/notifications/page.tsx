import React, { Suspense } from 'react';
import NotificationsClient from './NotificationsClient';
import NotificationsLoading from './loading';

export const dynamic = 'force-dynamic';

export default function NotificationsPage() {
  return (
    <Suspense fallback={<NotificationsLoading />}>
      <NotificationsClient />
    </Suspense>
  );
}
