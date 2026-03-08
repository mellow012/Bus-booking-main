'use client';
// components/EmailVerificationBannerLayout.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Renders the email verification prompt banner for unverified users.
//
// IMPORTANT — no window focus listener here.
// AuthContext already handles window focus → reload() → state update.
// Adding a second focus listener here caused double reload() calls and a race
// where both listeners tried to update auth state simultaneously, resulting in
// the banner persisting even after emailVerified flipped to true.
//
// This component is purely reactive: it renders when user.emailVerified is
// false and disappears when AuthContext updates user.emailVerified to true,
// which happens automatically via the onAuthStateChanged + focus listener
// already wired in AuthContext.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { EmailVerificationPrompt } from '@/components/EmailVerificationPrompt';

export const EmailVerificationBannerLayout: React.FC = () => {
  const { user, loading } = useAuth();

  // Don't render while loading, if no user, or if already verified
  if (loading || !user || !user.email || user.emailVerified) {
    return null;
  }

  return <EmailVerificationPrompt email={user.email} showBanner={true} />;
};