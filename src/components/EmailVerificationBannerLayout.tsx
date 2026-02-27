'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { EmailVerificationPrompt } from '@/components/EmailVerificationPrompt';
import { useEmailVerification } from '@/hooks/useEmailVerification';

/**
 * FIXES:
 * - Listens for window focus events to re-check emailVerified.
 *   When a user clicks the verification link in their email (opens a new tab),
 *   then returns to the app, the focus event triggers a Firebase reload so
 *   the banner disappears automatically without needing a page refresh.
 * - Uses refreshEmailVerificationStatus from the hook (which calls reload()
 *   internally) rather than just reading the stale user.emailVerified value.
 */

export const EmailVerificationBannerLayout: React.FC = () => {
  const { user, loading } = useAuth();
  const { refreshEmailVerificationStatus } = useEmailVerification();

  // When user returns to this tab (e.g. after clicking verify link in email),
  // refresh Firebase user object so the banner disappears immediately
  useEffect(() => {
    if (!user || user.emailVerified) return;

    const handleFocus = async () => {
      const isNowVerified = await refreshEmailVerificationStatus();
      if (isNowVerified) {
        // AuthContext should re-render via onAuthStateChanged;
        // if it doesn't update automatically, a router.refresh() here can help.
        console.log('[EmailVerificationBanner] User is now verified — banner will hide');
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user, refreshEmailVerificationStatus]);

  // Don't render while loading, if no user, if no email, or if already verified
  if (loading || !user || !user.email || user.emailVerified) {
    return null;
  }

  return <EmailVerificationPrompt email={user.email} showBanner={true} />;
};