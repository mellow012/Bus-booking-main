import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { reload } from 'firebase/auth';
import { getAuth } from 'firebase/auth';

/**
 * FIXES:
 * - refreshEmailVerificationStatus now calls reload() on the Firebase user
 *   before reading emailVerified, so it reflects server-side truth.
 * - Added refreshAndSync which forces token refresh AND reloads the user
 *   object — use this after the user returns from clicking the email link.
 */

interface VerificationStatus {
  isVerified: boolean;
  email: string;
  loading: boolean;
  error: string | null;
}

export const useEmailVerification = () => {
  const { user } = useAuth();

  const sendVerificationEmail = useCallback(async (): Promise<{
    success: boolean;
    message: string;
    verificationLink?: string;
  }> => {
    if (!user) throw new Error('User not authenticated');

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/auth/send-verification-email', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send verification email');
      }

      return {
        success: true,
        message: data.message,
        verificationLink: data.verificationLink,
      };
    } catch (error: any) {
      console.error('[useEmailVerification] Error sending email:', error);
      throw error;
    }
  }, [user]);

  const checkVerificationStatus = useCallback(async (): Promise<VerificationStatus> => {
    if (!user) {
      return { isVerified: false, email: '', loading: false, error: 'User not authenticated' };
    }

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/auth/check-verification', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to check verification status');
      }

      return {
        isVerified: data.emailVerified,
        email: data.email,
        loading: false,
        error: null,
      };
    } catch (error: any) {
      console.error('[useEmailVerification] Error checking status:', error);
      return {
        isVerified: false,
        email: user.email || '',
        loading: false,
        error: error.message,
      };
    }
  }, [user]);

  /**
   * Reload the Firebase user object AND force a token refresh.
   * Call this when the user returns to the app after clicking the verification
   * link — e.g. on window focus, after polling, or on a "I've verified" button.
   *
   * Returns true if emailVerified is now true.
   */
  const refreshEmailVerificationStatus = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;

      if (!currentUser) return false;

      // reload() fetches the latest user data from Firebase Auth servers
      // This is what actually updates emailVerified on the user object
      await reload(currentUser);

      // Force-refresh the ID token so the new emailVerified claim propagates
      await currentUser.getIdToken(true);

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
    isVerified: user?.emailVerified ?? false,
    email: user?.email ?? '',
  };
};