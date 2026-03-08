// hooks/useEmailVerification.ts
// ─────────────────────────────────────────────────────────────────────────────
// Provides email verification actions for components.
//
// IMPORTANT — single source of truth for emailVerified:
//   Always read user.emailVerified from Firebase Auth (via useAuth().user),
//   never userProfile.emailVerified from Firestore. Auth is updated immediately
//   when the user clicks the verification link; Firestore lags until
//   AuthContext.syncEmailVerifiedToFirestore() writes it back.
//
// This hook handles:
//   - Sending / resending verification emails via the API route
//   - Checking verification status server-side (for polling on /verify-email)
//   - Refreshing the Firebase user object to pick up emailVerified changes
//
// Window focus listening is handled in AuthContext to avoid duplicate
// reload() calls. Do NOT add another focus listener here.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getAuth, reload } from 'firebase/auth';

interface VerificationStatus {
  isVerified: boolean;
  email: string;
  loading: boolean;
  error: string | null;
}

export const useEmailVerification = () => {
  const { user } = useAuth();

  // ─── Send / resend verification email ──────────────────────────────────────

  const sendVerificationEmail = useCallback(async (): Promise<{
    success: boolean;
    message: string;
    alreadyVerified?: boolean;
    verificationLink?: string;
  }> => {
    if (!user) throw new Error('User not authenticated');

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/auth/send-verification-email', {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send verification email');
      }

      return {
        success:          true,
        message:          data.message,
        alreadyVerified:  data.alreadyVerified ?? false,
        verificationLink: data.verificationLink,
      };
    } catch (error: any) {
      console.error('[useEmailVerification] sendVerificationEmail error:', error);
      throw error;
    }
  }, [user]);

  // ─── Check verification status server-side ─────────────────────────────────
  // Calls the Admin SDK which always has the current server-side state.
  // Use this for polling on the /verify-email page.

  const checkVerificationStatus = useCallback(async (): Promise<VerificationStatus> => {
    if (!user) {
      return { isVerified: false, email: '', loading: false, error: 'User not authenticated' };
    }

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/auth/check-verification', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to check verification status');
      }

      return {
        isVerified: data.emailVerified,
        email:      data.email,
        loading:    false,
        error:      null,
      };
    } catch (error: any) {
      console.error('[useEmailVerification] checkVerificationStatus error:', error);
      return {
        isVerified: false,
        email:      user.email || '',
        loading:    false,
        error:      error.message,
      };
    }
  }, [user]);

  // ─── Refresh Firebase user object ─────────────────────────────────────────
  // Call this when you need to force-check emailVerified without waiting for
  // the next onAuthStateChanged event (e.g. a "Check again" button).
  //
  // Note: AuthContext already calls reload() on window focus. Only call this
  // manually for explicit user-triggered actions to avoid redundant network calls.

  const refreshEmailVerificationStatus = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const currentUser = getAuth().currentUser;
      if (!currentUser) return false;

      await reload(currentUser);
      console.log('[useEmailVerification] Refreshed — emailVerified:', currentUser.emailVerified);
      return currentUser.emailVerified;
    } catch (error) {
      console.error('[useEmailVerification] Refresh error:', error);
      return false;
    }
  }, [user]);

  return {
    sendVerificationEmail,
    checkVerificationStatus,
    refreshEmailVerificationStatus,
    // Always read from Firebase Auth — never from userProfile
    isVerified: user?.emailVerified ?? false,
    email:      user?.email ?? '',
  };
};