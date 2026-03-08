'use client';
// app/verify-email/page.tsx

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getAuth, applyActionCode, checkActionCode, reload } from 'firebase/auth';
import { CheckCircleIcon, Loader2 } from 'lucide-react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';

export default function VerifyEmailPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [status,  setStatus]  = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email… Please wait.');

  const oobCode = searchParams.get('oobCode');
  const mode    = searchParams.get('mode');

  useEffect(() => {
    // Strict Mode guard via sessionStorage (survives unmount/remount unlike useRef).
    // applyActionCode is one-time — a second call burns the code and shows an error.
    if (!oobCode) {
      setStatus('error');
      setMessage('No verification code found. Please use the link sent to your email.');
      return;
    }

    const guardKey = `oob_applied_${oobCode}`;
    if (sessionStorage.getItem(guardKey)) return;

    const verifyEmail = async () => {
      if (mode && mode !== 'verifyEmail') {
        setStatus('error');
        setMessage('This link is not for email verification.');
        return;
      }

      const auth = getAuth();

      try {
        const info = await checkActionCode(auth, oobCode);
        if (info.operation !== 'VERIFY_EMAIL') {
          throw Object.assign(new Error('Wrong action type'), { code: 'auth/invalid-action-code' });
        }

        // Mark BEFORE applying so Strict Mode second run is blocked even mid-async
        sessionStorage.setItem(guardKey, '1');

        await applyActionCode(auth, oobCode);

        if (auth.currentUser) {
          await reload(auth.currentUser);

          let attempts = 0;
          while (!auth.currentUser.emailVerified && attempts < 10) {
            await new Promise(r => setTimeout(r, 500));
            await reload(auth.currentUser);
            attempts++;
          }

          console.log('[VerifyEmail] emailVerified after reload:', auth.currentUser.emailVerified);

          // Refresh session cookie — the old one has email_verified:false baked in
          try {
            const idToken = await auth.currentUser.getIdToken(true);
            const res = await fetch('/api/auth/session', {
              method:  'POST',
              headers: { Authorization: `Bearer ${idToken}` },
            });
            if (res.ok) {
              console.log('[VerifyEmail] Session cookie refreshed with email_verified:true');
            } else {
              console.warn('[VerifyEmail] Session refresh failed:', res.status);
            }
          } catch (sessionErr) {
            console.warn('[VerifyEmail] Session refresh error:', sessionErr);
          }
        }

        try { localStorage.removeItem('fcm_registered_token'); } catch { /* ignore */ }

        setStatus('success');
        setMessage('Your email has been verified! Redirecting you now...');
        setTimeout(() => router.push('/'), 2500);

      } catch (err: any) {
        console.error('[VerifyEmail] Error:', err.code, err.message);
        sessionStorage.removeItem(guardKey);
        setStatus('error');

        switch (err.code) {
          case 'auth/expired-action-code':
            setMessage('This verification link has expired (valid for 3 days). Please request a new one.');
            break;
          case 'auth/invalid-action-code':
            setMessage('This link has already been used or is invalid. If you just verified, try signing in. Otherwise, request a new verification email.');
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
  }, [oobCode, mode, router]);

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

        <p className="text-gray-600 mb-8 leading-relaxed">{message}</p>

        <div className="space-y-3">
          {status === 'success' && (
            <>
              <p className="text-sm text-gray-500">Redirecting automatically...</p>
              <Button onClick={() => router.push('/')} className="w-full bg-green-600 hover:bg-green-700 text-white h-11">
                Continue to App
              </Button>
            </>
          )}
          {status === 'error' && (
            <>
              <Button onClick={() => router.push('/login')} className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11">
                Go to Login
              </Button>
              <Button onClick={() => router.push('/login?resend=true')} variant="outline" className="w-full h-11">
                Request New Verification Email
              </Button>
            </>
          )}
          {status === 'loading' && (
            <p className="text-sm text-gray-500">This should only take a few seconds...</p>
          )}
        </div>

      </div>
    </div>
  );
} 