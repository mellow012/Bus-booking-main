'use client';
// components/EmailVerificationBannerLayout.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Renders the auth prompt banner for unverified users or customers with
// incomplete profile setup.
//
// IMPORTANT — no window focus listener here.
// AuthContext already handles window focus → reload() → state update.
// Adding a second focus listener here caused double reload() calls and a race
// where both listeners tried to update auth state simultaneously, resulting in
// the banner persisting even after emailVerified flipped to true.
//
// This component is purely reactive: it renders the appropriate banner based
// on auth state and profile completeness.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import Link from 'next/link';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { EmailVerificationPrompt } from '@/components/EmailVerificationPrompt';

const ProfileCompletionBanner: React.FC = () => (
  <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-yellow-50 via-amber-50 to-orange-50 border-b border-amber-200 shadow-sm">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <ExclamationTriangleIcon className="w-5 h-5 text-amber-700 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-amber-900">
              Complete your profile setup
            </p>
            <p className="text-xs text-amber-700 truncate">
              Finish your account details to access booking features.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <Link href="/profile" className="inline-block">
            <Button size="sm" className="h-8 px-4 bg-blue-600 text-white hover:bg-blue-700">
              Complete profile
            </Button>
          </Link>
        </div>
      </div>
    </div>
  </div>
);

export const EmailVerificationBannerLayout: React.FC = () => {
  const { user, userProfile, loading } = useAuth();

  React.useEffect(() => {
    if (!loading && user) {
      console.log('[EmailVerificationBannerLayout]', {
        emailVerified: user.emailVerified,
        role: userProfile?.role,
        setupCompleted: userProfile?.setupCompleted,
        userProfileExists: !!userProfile,
      });
    }
  }, [user, userProfile, loading]);

  if (loading || !user) return null;

  if (!user.emailVerified && user.email) {
    return <EmailVerificationPrompt email={user.email} showBanner={true} />;
  }

  if (user.emailVerified && (!userProfile || (userProfile.role === 'customer' && !userProfile.setupCompleted))) {
    return <ProfileCompletionBanner />;
  }

  return null;
};
