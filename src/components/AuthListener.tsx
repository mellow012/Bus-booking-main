'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthListener() {
  const router = useRouter();
  const { user, userProfile, loading } = useAuth();

  useEffect(() => {
    if (!loading && user && userProfile) {
      // Only redirect if setup is completed or not applicable
      if (userProfile.setupCompleted !== false) {
        if (userProfile.role === 'company_admin') {
          router.push('/company/admin');
        } else if (userProfile.role === 'superadmin') {
          router.push('/admin');
        } else {
          router.push('/');
        }
      }
    }
  }, [user, userProfile, loading, router]);

  return null;
}