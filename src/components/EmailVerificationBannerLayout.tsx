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
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { EmailVerificationPrompt } from '@/components/EmailVerificationPrompt';

const ProfileCompletionBanner: React.FC<{ onDismiss: () => void }> = ({ onDismiss }) => (
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
              Please update your account details for a faster and better checkout experience.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <Link href="/profile" className="inline-block">
            <Button size="sm" className="h-8 px-4 bg-blue-600 text-white hover:bg-blue-700">
              Complete profile
            </Button>
          </Link>
          <button
            onClick={onDismiss}
            className="text-amber-500 hover:text-amber-700 p-1 rounded-full hover:bg-amber-100 transition-colors ml-2"
            aria-label="Dismiss banner"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  </div>
);

export const EmailVerificationBannerLayout: React.FC = () => {
  const { user, userProfile, loading } = useAuth();
  const [profileDismissed, setProfileDismissed] = React.useState(false);

  // Initialize dismissal state from localStorage
  React.useEffect(() => {
    if (user?.id) {
      const isDismissed = localStorage.getItem(`profile_banner_dismissed_${user.id}`);
      if (isDismissed === 'true') {
        setProfileDismissed(true);
      }
    }
  }, [user?.id]);

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

  if (!profileDismissed && user.emailVerified && userProfile && !userProfile.setupCompleted) {
    const handleDismiss = () => {
      localStorage.setItem(`profile_banner_dismissed_${user.id}`, 'true');
      setProfileDismissed(true);
    };

    return <ProfileCompletionBanner onDismiss={handleDismiss} />;
  }

  return null;
};
