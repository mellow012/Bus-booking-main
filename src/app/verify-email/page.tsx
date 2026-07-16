'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircleIcon, Loader2, Mail } from 'lucide-react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { useEmailVerification } from '@/hooks/useEmailVerification';
import { createClient } from '@/utils/supabase/client';

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<'waiting' | 'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  const mode = searchParams?.get('mode');

  const { sendVerificationEmail } = useEmailVerification();
  const [resending, setResending] = useState(false);
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
    // If they just registered, mode is null. They are waiting for the email.
    if (mode !== 'verified') {
      setStatus('waiting');
      return;
    }

    // If mode is verified, they clicked the link in their email.
    // Supabase automatically extracts the access_token from the URL hash and logs them in.
    const processVerification = async () => {
      setStatus('loading');

      const supabase = createClient();

      // Wait briefly for Supabase to process the session from the URL hash
      await new Promise(resolve => setTimeout(resolve, 1500));

      const { data: { session } } = await supabase.auth.getSession();

      const redirect = searchParams?.get('redirect') || searchParams?.get('redirectTo') || searchParams?.get('from');
      if (session) {
        // User is logged in by the email link and email has been verified.
        setStatus('success');
        setMessage('Email confirmed! Redirecting you to the app...');

        setTimeout(() => {
          router.push(redirect || '/');
        }, 1200);
      } else {
        // No session found.
        setStatus('error');
        setMessage('Verification link is invalid or expired. Please try logging in or requesting a new link.');
      }
    };

    processVerification();
  }, [mode, router]);

  // ── "Check your email" holding screen ───────────────────────
  if (status === 'waiting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-brand-50 to-gray-50 flex items-center justify-center px-4 py-12">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center border border-gray-100">
          <div className="mb-6 flex justify-center">
            <div className="p-4 bg-brand-50 rounded-full">
              <Mail className="h-12 w-12 text-brand-700" />
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
          <div className="bg-brand-50 rounded-lg p-4 mb-6 text-sm text-brand-800">
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-brand-50 to-gray-50 flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center border border-gray-100">

        <div className="mb-6 flex justify-center">
          {status === 'loading' && <Loader2 className="h-16 w-16 text-brand-700 animate-spin" />}
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

        <h1 className={`text-2xl sm:text-3xl font-bold mb-3 ${status === 'success' ? 'text-green-700' :
            status === 'error' ? 'text-red-700' : 'text-gray-900'
          }`}>
          {status === 'loading' && 'Verifying Your Email'}
          {status === 'success' && 'Email Verified!'}
          {status === 'error' && 'Verification Failed'}
        </h1>

        <p className="text-gray-600 mb-8 leading-relaxed">
          {status === 'loading' && 'Verifying your email… Please wait.'}
          {status === 'success' && "You're verified! Redirecting you to login…"}
          {status === 'error' && message}
        </p>

        <div className="space-y-3">
          {status === 'success' && (
            <p className="text-sm text-gray-500">Redirecting automatically...</p>
          )}
          {status === 'error' && (
            <>
              <Button
                onClick={() => router.push('/login')}
                className="w-full bg-coral-500 hover:bg-coral-600 text-white h-11"
              >
                Go to Login
              </Button>
              <Button
                onClick={handleResend}
                disabled={resending}
                variant="outline"
                className="w-full h-11"
              >
                {resending ? 'Sending...' : 'Request New Verification Email'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
