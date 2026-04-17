// hooks/useEmailVerification.ts
// ─────────────────────────────────────────────────────────────────────────────
// Provides email verification actions for components.
//
// Single source of truth for emailVerified:
//   Always read user.email_confirmed_at from Supabase Auth (via useAuth().user).
//
// This hook handles:
//   - Sending / resending verification emails via the Supabase client
//   - Checking verification status (via session refresh)
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/utils/supabase/client';

interface VerificationStatus {
  isVerified: boolean;
  email: string;
  loading: boolean;
  error: string | null;
}

export const useEmailVerification = () => {
  const { user } = useAuth();
  const supabase = createClient();

  // ─── Send / resend verification email ──────────────────────────────────────

  const sendVerificationEmail = useCallback(async (): Promise<{
    success: boolean;
    message: string;
    alreadyVerified?: boolean;
    verificationLink?: string;
  }> => {
    if (!user || !user.email) throw new Error('User email not found');

    try {
      // Supabase handles resending verification emails via auth.resend
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
        options: {
          emailRedirectTo: `${window.location.origin}/verify-email`,
        },
      });

      if (error) throw error;

      return {
        success: true,
        message: 'Verification email sent successfully',
        alreadyVerified: !!user.email_confirmed_at,
      };
    } catch (error: any) {
      console.error('[useEmailVerification] sendVerificationEmail error:', error);
      throw error;
    }
  }, [user, supabase.auth]);

  // ─── Check verification status ─────────────────────────────────────────────

  const checkVerificationStatus = useCallback(async (): Promise<VerificationStatus> => {
    if (!user) {
      return { isVerified: false, email: '', loading: false, error: 'User not authenticated' };
    }

    try {
      // Refresh user session to get latest email_confirmed_at
      const { data: { user: refreshedUser }, error } = await supabase.auth.getUser();

      if (error) throw error;

      return {
        isVerified: !!refreshedUser?.email_confirmed_at,
        email: refreshedUser?.email || '',
        loading: false,
        error: null,
      };
    } catch (error: any) {
      console.error('[useEmailVerification] checkVerificationStatus error:', error);
      return {
        isVerified: !!user.email_confirmed_at,
        email: user.email || '',
        loading: false,
        error: error.message,
      };
    }
  }, [user, supabase.auth]);

  // ─── Refresh verification status ──────────────────────────────────────────

  const refreshEmailVerificationStatus = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const { data: { user: refreshedUser }, error } = await supabase.auth.getUser();
      if (error) throw error;
      
      return !!refreshedUser?.email_confirmed_at;
    } catch (error) {
      console.error('[useEmailVerification] Refresh error:', error);
      return false;
    }
  }, [user, supabase.auth]);

  return {
    sendVerificationEmail,
    checkVerificationStatus,
    refreshEmailVerificationStatus,
    isVerified: !!user?.email_confirmed_at,
    email: user?.email ?? '',
  };
};