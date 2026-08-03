import React, { Suspense } from 'react';
import OperatorDashboardClient from './OperatorDashboardClient';
import OperatorDashboardLoading from './loading';

export const dynamic = 'force-dynamic';

export default function OperatorDashboardPage() {
  return (
    <Suspense fallback={<OperatorDashboardLoading />}>
      <OperatorDashboardClient />
    </Suspense>
  );
}
