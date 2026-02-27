import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

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
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/auth/send-verification-email', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
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
      console.error('Error sending verification email:', error);
      throw error;
    }
  }, [user]);

  const checkVerificationStatus = useCallback(async (): Promise<VerificationStatus> => {
    if (!user) {
      return {
        isVerified: false,
        email: '',
        loading: false,
        error: 'User not authenticated',
      };
    }

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/auth/check-verification', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
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
      console.error('Error checking verification status:', error);
      return {
        isVerified: false,
        email: user.email || '',
        loading: false,
        error: error.message,
      };
    }
  }, [user]);

  // Refresh firebase token (forces Firebase to read updated emailVerified claim)
  const refreshEmailVerificationStatus = useCallback(async () => {
    if (!user) return false;
    try {
      const token = await user.getIdToken(true); // Force refresh
      return user.emailVerified;
    } catch (error) {
      console.error('Error refreshing email verification status:', error);
      return false;
    }
  }, [user]);

  return {
    sendVerificationEmail,
    checkVerificationStatus,
    refreshEmailVerificationStatus,
  };
};
