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

const GRACE_PERIOD = 60 * 60 * 1000; // 1 hour
const DISMISS_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export const EmailVerificationPrompt: React.FC<EmailVerificationPromptProps> = ({
  email,
  onVerified,
  showBanner = true,
}) => {
  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [resendMessage, setResendMessage] = useState('');
  const [showBannerState, setShowBannerState] = useState(false);
  const [signupTime, setSignupTime] = useState<number | null>(null);

  const { sendVerificationEmail } = useEmailVerification();

  useEffect(() => {
    if (!showBanner || !email) return;

    const storedSignupTime = localStorage.getItem(`emailSignupTime_${email}`);
    const lastDismissTime = localStorage.getItem(`emailDismissed_${email}`);
    const now = Date.now();

    if (!storedSignupTime) {
      localStorage.setItem(`emailSignupTime_${email}`, now.toString());
      setSignupTime(now);
      setShowBannerState(true);
    } else {
      const signup = parseInt(storedSignupTime);
      setSignupTime(signup);

      const withinGrace = now - signup < GRACE_PERIOD;
      const canShowAgain = !lastDismissTime || now - parseInt(lastDismissTime) > DISMISS_DURATION;

      setShowBannerState(withinGrace || canShowAgain);
    }
  }, [email, showBanner]);

  const handleResendEmail = async () => {
    setIsResending(true);
    setResendStatus('idle');
    setResendMessage('');

    try {
      await sendVerificationEmail();
      const now = Date.now();
      localStorage.setItem(`emailSignupTime_${email}`, now.toString());
      localStorage.removeItem(`emailDismissed_${email}`);
      setSignupTime(now);

      setResendStatus('success');
      setResendMessage('Verification email resent! Check your inbox & spam folder.');
    } catch (err: any) {
      console.error('Resend failed:', err);
      setResendStatus('error');
      setResendMessage(
        err.message?.includes('too-many-requests')
          ? 'Too many attempts. Wait a minute and try again.'
          : 'Failed to resend. Please try again later.'
      );
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
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 border-b border-blue-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <EnvelopeIcon className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900">
                Please verify your email
              </p>
              <p className="text-xs text-gray-600 truncate">
                We sent a link to {email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <Button
              onClick={handleResendEmail}
              disabled={isResending}
              size="sm"
              variant={resendStatus === 'success' ? 'outline' : 'default'}
              className={`text-xs h-8 px-4 ${
                resendStatus === 'success'
                  ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                  : ''
              }`}
            >
              {isResending ? (
                <span className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Sending...
                </span>
              ) : resendStatus === 'success' ? (
                'Resent!'
              ) : (
                'Resend Email'
              )}
            </Button>

            <button
              onClick={handleDismiss}
              className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Dismiss banner"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback message */}
        {resendMessage && (
          <div
            className={`mt-3 text-xs p-2.5 rounded-lg ${
              resendStatus === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {resendMessage}
          </div>
        )}
      </div>
    </div>
  );
};  