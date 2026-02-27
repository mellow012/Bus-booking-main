'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getAuth, applyActionCode, checkActionCode, reload } from 'firebase/auth';
import { CheckCircleIcon, Loader2 } from 'lucide-react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';

/**
 * Handles Firebase custom action URL:
 *   https://yourdomain.com/verify-email?mode=verifyEmail&oobCode=XXX&apiKey=YYY
 *
 * REQUIRES: Firebase Console → Auth → Templates → Email verification →
 * "Customize action URL" = https://yourdomain.com/verify-email
 *
 * The auth/invalid-action-code error happens when:
 *  1. The oobCode was already consumed (user clicked link twice)
 *  2. The link went to the WRONG page first (/company/setup) and the code
 *     expired or was invalidated before the user reached this page
 *  3. The Firebase Console action URL is wrong — fix that first
 */

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email… Please wait.');

  useEffect(() => {
    const verifyEmail = async () => {
      const oobCode = searchParams.get('oobCode');
      const mode = searchParams.get('mode');

      // No code at all — user navigated here manually
      if (!oobCode) {
        setStatus('error');
        setMessage('No verification code found. Please use the link sent to your email.');
        return;
      }

      // Wrong action type (e.g. password reset link landed here)
      if (mode && mode !== 'verifyEmail') {
        setStatus('error');
        setMessage('This link is not for email verification.');
        return;
      }

      const auth = getAuth();

      try {
        // Step 1: Validate before applying — gives a clear error if stale/used
        const info = await checkActionCode(auth, oobCode);
        if (info.operation !== 'VERIFY_EMAIL') {
          throw Object.assign(new Error('Wrong action type'), { code: 'auth/invalid-action-code' });
        }

        // Step 2: Apply the code
        await applyActionCode(auth, oobCode);

        // Step 3: Force-refresh Firebase user so emailVerified = true
        // propagates to AuthContext without needing sign-out/sign-in
        if (auth.currentUser) {
          await reload(auth.currentUser);
          await auth.currentUser.getIdToken(true);
          console.log('[VerifyEmail] emailVerified:', auth.currentUser.emailVerified);
        }

        // Step 4: Clear FCM token cache — re-registers on verified account
        try {
          localStorage.removeItem('fcm_registered_token');
        } catch {
          // ignore
        }

        setStatus('success');
        setMessage('Your email has been verified! Redirecting you now…');

        // Redirect to / — AuthContext handles role-based routing from there
        setTimeout(() => router.push('/'), 3000);

      } catch (err: any) {
        console.error('[VerifyEmail] Error:', err.code, err.message);
        setStatus('error');

        switch (err.code) {
          case 'auth/expired-action-code':
            setMessage(
              'This verification link has expired (valid for 3 days). Please request a new one.'
            );
            break;
          case 'auth/invalid-action-code':
            setMessage(
              'This link is invalid or has already been used. If you verified recently, try signing in. Otherwise, request a new verification email.'
            );
            break;
          case 'auth/user-disabled':
            setMessage('Your account has been disabled. Please contact support.');
            break;
          case 'auth/user-not-found':
            setMessage('No account found for this link. Please register again.');
            break;
          default:
            setMessage(err.message || 'Verification failed. Please request a new verification email.');
        }
      }
    };

    verifyEmail();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center border border-gray-100">

        <div className="mb-6 flex justify-center">
          {status === 'loading' && (
            <Loader2 className="h-16 w-16 text-blue-600 animate-spin" />
          )}
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
          status === 'error'   ? 'text-red-700'   :
                                  'text-gray-900'
        }`}>
          {status === 'loading' && 'Verifying Your Email'}
          {status === 'success' && 'Email Verified!'}
          {status === 'error'   && 'Verification Failed'}
        </h1>

        <p className="text-gray-600 mb-8 leading-relaxed">{message}</p>

        <div className="space-y-4">
          {status === 'success' && (
            <>
              <p className="text-sm text-gray-500">Redirecting automatically in 3 seconds…</p>
              <Button
                onClick={() => router.push('/')}
                className="w-full bg-green-600 hover:bg-green-700 text-white h-11"
              >
                Go Now
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