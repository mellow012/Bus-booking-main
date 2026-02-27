'use client';

import React, { useState, useEffect } from 'react';
import { EnvelopeIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { useEmailVerification } from '@/hooks/useEmailVerification';

interface EmailVerificationPromptProps {
  email: string;
  onVerified?: () => void;
  showBanner?: boolean;
}

const GRACE_PERIOD = 60 * 60 * 1000; // 1 hour grace period
const DISMISS_DURATION = 24 * 60 * 60 * 1000; // Dismiss for 24 hours after clicking dismiss

export const EmailVerificationPrompt: React.FC<EmailVerificationPromptProps> = ({
  email,
  onVerified,
  showBanner = true,
}) => {
  const [isResending, setIsResending] = useState(false);
  const [showBannerState, setShowBannerState] = useState(false);
  const [signupTime, setSignupTime] = useState<number | null>(null);
  const { sendVerificationEmail } = useEmailVerification();

  // Initialize: check if user should see banner
  useEffect(() => {
    if (!showBanner || !email) return;

    // Load signup time and last dismiss time from localStorage
    const storedSignupTime = localStorage.getItem(`emailSignupTime_${email}`);
    const lastDismissTime = localStorage.getItem(`emailDismissed_${email}`);
    const now = Date.now();

    // Set signup time if first time
    if (!storedSignupTime) {
      localStorage.setItem(`emailSignupTime_${email}`, now.toString());
      setSignupTime(now);
      setShowBannerState(true);
    } else {
      const signup = parseInt(storedSignupTime);
      setSignupTime(signup);

      // Show banner if:
      // 1. Still within grace period (1 hour), OR
      // 2. Dismissed more than 24 hours ago
      const withinGracePeriod = now - signup < GRACE_PERIOD;
      const canShowAgain = !lastDismissTime || now - parseInt(lastDismissTime) > DISMISS_DURATION;

      if (withinGracePeriod || canShowAgain) {
        setShowBannerState(true);
      }
    }
  }, [email, showBanner]);

  const handleResendEmail = async () => {
    setIsResending(true);
    try {
      await sendVerificationEmail();
      // Reset signup time so banner shows from now
      localStorage.setItem(`emailSignupTime_${email}`, Date.now().toString());
      localStorage.removeItem(`emailDismissed_${email}`);
      setSignupTime(Date.now());
    } catch (error) {
      console.error('Failed to resend verification email:', error);
    } finally {
      setIsResending(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(`emailDismissed_${email}`, Date.now().toString());
    setShowBannerState(false);
  };

  if (!showBannerState) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-blue-200 shadow-md animate-in fade-in slide-in-from-top-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Message */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0">
              <EnvelopeIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">
                Email not verified yet
              </p>
              <p className="text-xs text-gray-600 truncate">
                Check {email} for verification link
              </p>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              onClick={handleResendEmail}
              disabled={isResending}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
            >
              {isResending ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                  Sending...
                </>
              ) : (
                'Resend'
              )}
            </Button>
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 text-gray-500 hover:text-gray-700 transition-colors p-1"
              aria-label="Dismiss"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
