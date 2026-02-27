'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { EmailVerificationPrompt } from '@/components/EmailVerificationPrompt';

/**
 * Email verification banner wrapper for use in layout
 * Shows banner to authenticated users with unverified emails
 */
export const EmailVerificationBannerLayout: React.FC = () => {
  const { user } = useAuth();

  // Don't show if not authenticated
  if (!user || !user.email) {
    return null;
  }

  // Don't show if email is already verified
  if (user.emailVerified) {
    return null;
  }

  return (
    <EmailVerificationPrompt
      email={user.email}
      showBanner={true}
    />
  );
};
