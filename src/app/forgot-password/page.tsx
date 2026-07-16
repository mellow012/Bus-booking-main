'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createClient } from '@/utils/supabase/client'; // 💡 Import client-side Supabase
import { 
  EnvelopeIcon, 
  ArrowLeftIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

// Types
interface FormErrors {
  email?: string;
  general?: string;
}

// Utility functions
const validateEmail = (email: string): string => {
  if (!email.trim()) {
    return 'Email address is required';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Please enter a valid email address';
  }
  return '';
};

// Initialize client instance once outside the react render window cycle
const supabase = createClient();

export default function ForgotPassword() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams?.get('email');

  // Form state
  const [email, setEmail] = useState(emailParam || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<FormErrors>({});
  const [success, setSuccess] = useState(false);
  const [touched, setTouched] = useState(false);

  // Event handlers
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (error.email || error.general) {
      setError({});
    }
  };

  const handleBlur = () => {
    setTouched(true);
    const emailError = validateEmail(email);
    if (emailError) {
      setError({ email: emailError });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);

    const emailError = validateEmail(email);
    if (emailError) {
      setError({ email: emailError });
      return;
    }

    setIsSubmitting(true);
    setError({});

    try {
      // 💡 FIXED: Directly invoke Supabase client SDK on the client side.
      // This automatically triggers the "Send Email Hook" configured in your Supabase dashboard.
      const { error: apiError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        // 💡 FIXED: Direct the verification link to pass through your auth/callback route.
        // This exchanges the recovery code for valid session cookies before mounting the reset-password page.
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      
      if (apiError) {
        // Handle specific rate limits safely 
        if (apiError.status === 429 || apiError.message.includes('rate limit')) {
          setError({ general: 'Too many requests. Please wait a few minutes before trying again.' });
        } else {
          setError({ general: apiError.message });
        }
      } else {
        setSuccess(true);
      }
    } catch (err: unknown) {
      console.error('Password reset error:', err);
      setError({ general: 'An unexpected connection failure occurred. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    setSuccess(false);
    await handleSubmit(new Event('submit') as any);
  };

  const getInputClassName = () => {
    const baseClass = "appearance-none block w-full px-3 py-2.5 pl-10 border rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-200";
    const hasError = error.email && touched;
    
    if (hasError) {
      return `${baseClass} border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500`;
    }
    
    return `${baseClass} border-gray-300 focus:ring-brand-700 focus:border-brand-700`;
  };

  // Success view
  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center pt-28 sm:pt-32 lg:pt-36 pb-8 bg-gradient-to-br from-gray-50 to-gray-100 sm:px-6 lg:px-8 overflow-y-auto">
        <div className="w-full max-w-md pt-2">
          <div className="flex justify-center pb-1">
            <div className="flex items-center justify-center transition-transform duration-300 hover:scale-105 max-h-16 sm:max-h-20 md:max-h-20">
              <Image
                src="/tibhukebus_logo_transparent.png"
                alt="TibhukeBus Logo"
                width={120}
                height={48}
                className="w-auto h-auto object-contain"
                priority
              />
            </div>
          </div>
          
          <h1 className="mt-4 text-center text-3xl font-extrabold text-gray-900 tracking-tight">
            Check your email
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            Password reset instructions sent
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-10 px-6 shadow-xl rounded-2xl sm:px-12">
            <div className="text-center space-y-4">
              <div className="bg-brand-50 border border-brand-100 text-brand-800 px-4 py-3 rounded-lg">
                <InformationCircleIcon className="w-5 h-5 inline mr-2" />
                <span className="text-sm">
                  We&apos;ve sent password reset instructions to <strong>{email}</strong>
                </span>
              </div>

              <div className="text-sm text-gray-600 space-y-2">
                <p>Please check your email and click the reset link to continue.</p>
                <p className="text-xs">The link will expire in 1 hour for security reasons.</p>
              </div>

              <div className="pt-4 space-y-3">
                <Button
                  onClick={() => router.push('/login')}
                  className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-coral-500 hover:bg-coral-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-coral-500 transition-all duration-200"
                >
                  Back to Sign In
                </Button>

                <button
                  onClick={handleResend}
                  disabled={isSubmitting}
                  className="w-full text-sm text-brand-700 hover:text-brand-800 focus:outline-none focus:underline transition-colors duration-200 disabled:opacity-50"
                >
                  Didn&apos;t receive the email? Resend
                </button>
              </div>

              <div className="pt-6 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  Need help?{' '}
                  <Link 
                    href="/contact" 
                    className="text-brand-700 hover:text-brand-800 focus:outline-none focus:underline"
                  >
                    Contact support
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Form view
  return (
    <div className="min-h-screen flex flex-col items-center pt-28 sm:pt-32 lg:pt-36 pb-8 bg-gradient-to-br from-gray-50 to-gray-100 sm:px-6 lg:px-8 overflow-y-auto">
      <div className="w-full max-w-md pt-2">
        {/* Logo */}
        <div className="flex justify-center pb-1">
          <div className="flex items-center justify-center transition-transform duration-300 hover:scale-105 max-h-16 sm:max-h-20 md:max-h-20">
            <Image
              src="/tibhukebus_logo_transparent.png"
              alt="TibhukeBus Logo"
              width={120}
              height={48}
              className="w-auto h-auto object-contain"
              priority
            />
          </div>
        </div>

        {/* Header */}
        <h1 className="mt-6 text-center text-4xl font-extrabold text-gray-900 tracking-tight">
          Reset your password
        </h1>
        <p className="mt-2 text-center text-sm text-gray-600">
          Enter your email address and we&apos;ll send you a link to reset your password
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-10 px-6 shadow-xl rounded-2xl sm:px-12">
          
          <form className="space-y-6" onSubmit={handleSubmit} noValidate>
            
            {/* General Error */}
            {error.general && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start" role="alert">
                <ExclamationTriangleIcon className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Unable to Send Reset Email</p>
                  <p className="text-sm mt-1">{error.general}</p>
                </div>
              </div>
            )}

            {/* Info Box */}
            <div className="bg-brand-50 border border-brand-100 text-brand-800 px-4 py-3 rounded-lg flex items-start">
              <InformationCircleIcon className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Password Reset Instructions</p>
                <ul className="mt-2 space-y-1 list-disc list-inside text-xs">
                  <li>Enter your registered email address</li>
                  <li>Check your inbox for the reset link</li>
                  <li>Click the link to create a new password</li>
                  <li>The link expires in 1 hour</li>
                </ul>
              </div>
            </div>

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                <EnvelopeIcon className="w-4 h-4 inline mr-1" />
                Email Address
              </label>
              <div className="relative">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  autoFocus
                  aria-invalid={error.email && touched ? 'true' : 'false'}
                  aria-describedby={error.email && touched ? 'email-error' : undefined}
                  value={email}
                  onChange={handleEmailChange}
                  onBlur={handleBlur}
                  onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                  className={getInputClassName()}
                  placeholder="Enter your email address"
                  disabled={isSubmitting}
                />
                <EnvelopeIcon className="w-5 h-5 text-gray-400 absolute top-2.5 left-3 pointer-events-none" />
                {error.email && touched && (
                  <ExclamationTriangleIcon className="w-5 h-5 text-red-400 absolute top-2.5 right-3 pointer-events-none" />
                )}
              </div>
              {error.email && touched && (
                <div className="mt-1 flex items-center text-sm text-red-600" role="alert" id="email-error">
                  <ExclamationTriangleIcon className="w-4 h-4 mr-1 flex-shrink-0" />
                  {error.email}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-coral-500 hover:bg-coral-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-coral-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                aria-label={isSubmitting ? 'Sending reset link...' : 'Send reset link'}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75" />
                    </svg>
                    Sending reset link...
                  </>
                ) : (
                  <>
                    <EnvelopeIcon className="w-5 h-5 mr-2" />
                    Send Reset Link
                  </>
                )}
              </Button>
            </div>

            {/* Back to Login */}
            <div className="text-center">
              <Link 
                href="/login"
                className="inline-flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 focus:outline-none focus:underline transition-colors duration-200"
              >
                <ArrowLeftIcon className="w-4 h-4 mr-1" />
                Back to Sign In
              </Link>
            </div>
          </form>

          {/* Additional Help */}
          <div className="mt-6 pt-6 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-500">
              Don&apos;t have an account?{' '}
              <Link 
                href="/register" 
                className="text-brand-700 hover:text-brand-800 focus:outline-none focus:underline transition-colors duration-200"
              >
                Sign up
              </Link>
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Having trouble?{' '}
              <Link 
                href="/contact" 
                className="text-brand-700 hover:text-brand-800 focus:outline-none focus:underline transition-colors duration-200"
              >
                Contact support
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}