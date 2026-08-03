import React, { Suspense } from 'react';
import ProfileClient from './ProfileClient';
import ProfileLoading from './loading';

export const dynamic = 'force-dynamic';

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileLoading />}>
      <ProfileClient />
    </Suspense>
  );
}
