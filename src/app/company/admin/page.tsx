import React, { Suspense } from 'react';
import CompanyAdminClient from './CompanyAdminClient';
import CompanyAdminLoading from './loading';

export const dynamic = 'force-dynamic';

export default function CompanyAdminPage() {
  return (
    <Suspense fallback={<CompanyAdminLoading />}>
      <CompanyAdminClient />
    </Suspense>
  );
}