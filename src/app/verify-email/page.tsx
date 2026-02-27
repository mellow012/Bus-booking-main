'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAuth, applyActionCode, isSignInWithEmailLink } from 'firebase/auth';
import { CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email...');
  const [showRedirect, setShowRedirect] = useState(false);

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        // Get the oobCode from URL parameters
        const oobCode = searchParams.get('oobCode');
        const uid = searchParams.get('uid');

        if (!oobCode) {
          setStatus('error');
          setMessage('Invalid verification link. Please request a new one.');
          return;
        }

        const auth = getAuth();

        try {
          // Apply the verification code
          await applyActionCode(auth, oobCode);

          // Force refresh the user's token to update emailVerified claim
          const user = auth.currentUser;
          if (user) {
            await user.getIdToken(true); // Force refresh
          }

          setStatus('success');
          setMessage('✅ Email verified successfully! Redirecting...');
          
          // Redirect after 2 seconds
          setTimeout(() => {
            router.push('/');
          }, 2000);
        } catch (firebaseError: any) {
          console.error('Firebase error:', firebaseError);
          
          // Handle specific Firebase errors
          if (firebaseError.code === 'auth/invalid-action-code') {
            setStatus('error');
            setMessage('This verification link has expired. Please request a new one.');
          } else if (firebaseError.code === 'auth/user-token-expired') {
            setStatus('error');
            setMessage('Your session has expired. Please sign in again.');
          } else {
            setStatus('error');
            setMessage(`Verification failed: ${firebaseError.message}`);
          }
        }
      } catch (error: any) {
        console.error('Verification error:', error);
        setStatus('error');
        setMessage('An unexpected error occurred. Please try again.');
      }
    };

    verifyEmail();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-8 text-center">
        {/* Status Icon */}
        <div className="mb-6">
          {status === 'loading' && (
            <div className="inline-flex p-4 bg-blue-100 rounded-full">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
          )}
          {status === 'success' && (
            <div className="inline-flex p-4 bg-green-100 rounded-full">
              <CheckCircleIcon className="w-8 h-8 text-green-600" />
            </div>
          )}
          {status === 'error' && (
            <div className="inline-flex p-4 bg-red-100 rounded-full">
              <ExclamationTriangleIcon className="w-8 h-8 text-red-600" />
            </div>
          )}
        </div>

        {/* Message */}
        <h1 className={`text-2xl font-bold mb-2 ${
          status === 'success' ? 'text-green-600' :
          status === 'error' ? 'text-red-600' :
          'text-gray-900'
        }`}>
          {status === 'loading' && 'Verifying Email'}
          {status === 'success' && 'Email Verified!'}
          {status === 'error' && 'Verification Failed'}
        </h1>

        <p className="text-gray-600 mb-8">
          {message}
        </p>

        {/* Actions */}
        {status === 'error' && (
          <div className="space-y-3">
            <Button
              onClick={() => router.push('/register')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              Back to Register
            </Button>
            <Button
              onClick={() => router.push('/login')}
              variant="outline"
              className="w-full"
            >
              Go to Login
            </Button>
          </div>
        )}

        {status === 'success' && (
          <Button
            onClick={() => router.push('/')}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            Go to Home
          </Button>
        )}
      </div>
    </div>
  );
}
