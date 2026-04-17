'use client';
// app/verify-email/page.tsx
//
// Two distinct states:
//   1. No oobCode → "Check your email" holding screen
//   2. oobCode present → apply + refresh session + redirect to /profile

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircleIcon, Loader2,Mail } from 'lucide-react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { useEmailVerification } from '@/hooks/useEmailVerification';

export default function VerifyEmailPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [status,  setStatus]  = useState<'waiting' | 'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  const oobCode = searchParams.get('oobCode');
  const mode    = searchParams.get('mode');

  const { sendVerificationEmail } = useEmailVerification();
  const [resending,     setResending]     = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  const handleResend = async () => {
    setResending(true);
    setResendMessage('');
    try {
      await sendVerificationEmail();
      setResendMessage('Email sent! Check your inbox and spam folder.');
    } catch (err: any) {
      setResendMessage(err.message?.includes('too-many-requests')
        ? 'Too many attempts — please wait a minute.'
        : 'Failed to resend. Please try again.');
    } finally {
      setResending(false);
    }
  };

  useEffect(() => {
    // ── No oobCode: user just registered, waiting for them to click the link ──
    if (!oobCode) {
      setStatus('waiting');
      return;
    }

    // ── Strict Mode guard: applyActionCode is one-time use ────────────────────
    const guardKey = `oob_applied_${oobCode}`;
    if (sessionStorage.getItem(guardKey)) return;

    const verifyEmail = async () => {
      if (mode && mode !== 'verifyEmail') {
        setStatus('error');
        setMessage('This link is not for email verification.');
        return;
      }

      try {
        // Mark before applying so Strict Mode second run is blocked even mid-async
        sessionStorage.setItem(guardKey, '1');

        // Call API to verify the email with the oobCode
        const response = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ oobCode }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw Object.assign(new Error(error.message || 'Verification failed'), { code: error.code });
        }

        const data = await response.json();

        // Refresh session cookie with new token
        try {
          const res = await fetch('/api/auth/session', {
            method:  'POST',
          });
          if (!res.ok) {
            console.warn('[VerifyEmail] Session refresh returned', res.status);
          }
        } catch (sessionErr) {
          console.warn('[VerifyEmail] Session refresh failed (non-fatal):', sessionErr);
        }

        try { localStorage.removeItem('fcm_registered_token'); } catch { /* ignore */ }

        setStatus('success');

        // Use hard navigation to strip the oobCode from the URL.
        // This triggers the AuthContext's verified route guard logic,
        // correctly routing Customers to /profile and Company Staff to their dashboards.
        setTimeout(() => { window.location.href = '/verify-email'; }, 2000);

      } catch (err: any) {
        console.error('[VerifyEmail] Error:', err.code, err.message);
        sessionStorage.removeItem(guardKey);
        setStatus('error');

        switch (err.code) {
          case 'expired-token':
            setMessage('This verification link has expired (valid for 3 days). Please request a new one.');
            break;
          case 'invalid-token':
            setMessage('This link has already been used or is invalid. If you just verified, try signing in. Otherwise, request a new verification email.');
            break;
          case 'user-disabled':
            setMessage('Your account has been disabled. Please contact support.');
            break;
          case 'user-not-found':
            setMessage('No account found for this link. Please register again.');
            break;
          default:
            setMessage(err.message || 'Verification failed. Please request a new verification email.');
        }
      }
    };

    verifyEmail();
  }, [oobCode, mode, router]);

  // ── "Check your email" holding screen (no oobCode) ───────────────────────
  if (status === 'waiting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-12">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center border border-gray-100">
          <div className="mb-6 flex justify-center">
            <div className="p-4 bg-blue-100 rounded-full">
              <Mail className="h-12 w-12 text-blue-600" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-3 text-gray-900">
            Check Your Email
          </h1>
          <p className="text-gray-600 mb-2 leading-relaxed">
            We sent a verification link to your email address.
          </p>
          <p className="text-gray-500 text-sm mb-8">
            Click the link in the email to verify your account, then come back here.
          </p>
          <div className="bg-blue-50 rounded-lg p-4 mb-6 text-sm text-blue-700">
            Didn't get it? Check your spam folder, or resend below.
          </div>
          <div className="space-y-3">
            <Button
              onClick={handleResend}
              disabled={resending}
              variant="outline"
              className="w-full h-11"
            >
              {resending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </span>
              ) : 'Resend Verification Email'}
            </Button>
            {resendMessage && (
              <p className="text-sm text-center text-gray-600">{resendMessage}</p>
            )}
            <Button
              onClick={() => router.push('/login')}
              variant="ghost"
              className="w-full h-11 text-gray-500"
            >
              Back to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Verification in progress / result ─────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center border border-gray-100">

        <div className="mb-6 flex justify-center">
          {status === 'loading' && <Loader2 className="h-16 w-16 text-blue-600 animate-spin" />}
          {status === 'success' && (
            <div className="p-4 bg-green-100 rounded-full">
              <CheckCircleIcon className="h-12 w-12 text-green-600" />
            </div>
          )}
          {status === 'error' && (
            <div className="p-4 bg-red-100 rounded-full">
              <ExclamationTriangleIcon className="h-12 w-12 text-red-600" />
            </div>
          )}
        </div>

        <h1 className={`text-2xl sm:text-3xl font-bold mb-3 ${
          status === 'success' ? 'text-green-700' :
          status === 'error'   ? 'text-red-700'   : 'text-gray-900'
        }`}>
          {status === 'loading' && 'Verifying Your Email'}
          {status === 'success' && 'Email Verified!'}
          {status === 'error'   && 'Verification Failed'}
        </h1>

        <p className="text-gray-600 mb-8 leading-relaxed">
          {status === 'loading' && 'Verifying your email… Please wait.'}
          {status === 'success' && "You're verified! Redirecting you to your dashboard…"}
          {status === 'error'   && message}
        </p>

        <div className="space-y-3">
          {status === 'success' && (
            <>
              <p className="text-sm text-gray-500">Redirecting automatically...</p>
              <Button
                onClick={() => { window.location.href = '/verify-email'; }}
                className="w-full bg-green-600 hover:bg-green-700 text-white h-11"
              >
                Continue
              </Button>
            </>
          )}
          {status === 'error' && (
            <>
              <Button
                onClick={() => router.push('/login')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11"
              >
                Go to Login
              </Button>
              <Button
                onClick={() => router.push('/login?resend=true')}
                variant="outline"
                className="w-full h-11"
              >
                Request New Verification Email
              </Button>
            </>
          )}
          {status === 'loading' && (
            <p className="text-sm text-gray-500">This should only take a few seconds…</p>
          )}
        </div>

      </div>
    </div>
  );
}
