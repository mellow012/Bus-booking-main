'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { EnvelopeIcon, LockClosedIcon, EyeIcon, EyeSlashIcon, ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

// Types
interface FormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: FormErrors;
}

// Constants
const MAX_ATTEMPTS      = 5;
const MIN_PASSWORD_LENGTH = 6;

// ─── Hooks ────────────────────────────────────────────────────────────────────

const useFormValidation = (formData: FormData, t: (key: string, opts?: any) => string) => {
  const [errors,  setErrors]  = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateField = (name: string, value: string): string => {
    switch (name) {
      case 'email':
        if (!value.trim()) return t('errorEmailRequired');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return t('errorInvalidEmail');
        return '';
      case 'password':
        if (!value) return t('errorPasswordRequired');
        if (value.length < MIN_PASSWORD_LENGTH) return t('errorPasswordMin', { min: MIN_PASSWORD_LENGTH });
        return '';
      default:
        return '';
    }
  };

  const validateForm = (): ValidationResult => {
    const newErrors: FormErrors = {};
    Object.keys(formData).forEach((key) => {
      if (key !== 'rememberMe') {
        const error = validateField(key, formData[key as keyof FormData] as string);
        if (error) newErrors[key as keyof FormErrors] = error;
      }
    });
    setErrors(newErrors);
    return { isValid: Object.keys(newErrors).length === 0, errors: newErrors };
  };

  const handleBlur = (name: string) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    const error = validateField(name, formData[name as keyof FormData] as string);
    setErrors(prev => ({ ...prev, [name]: error || undefined }));
  };

  const clearErrors = () => { setErrors({}); setTouched({}); };

  return { errors, touched, validateForm, handleBlur, clearErrors };
};

const useLoginAttempts = () => {
  const [attemptCount, setAttemptCount] = useState(0);
  const [isLockedOut,  setIsLockedOut]  = useState(false);

  const incrementAttempts = () => {
    const newCount = attemptCount + 1;
    setAttemptCount(newCount);
    if (newCount >= MAX_ATTEMPTS) {
      setIsLockedOut(true);
    }
  };

  const resetAttempts = () => {
    setAttemptCount(0);
    setIsLockedOut(false);
  };

  return { attemptCount, isLockedOut, incrementAttempts, resetAttempts };
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function Login() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const isVerified   = searchParams?.get('verified') === 'true';
  // FIX: use AuthContext.signIn so the __session cookie is created properly.
  // Previously the page called Firebase directly and skipped session creation,
  // which caused middleware to reject every subsequent request.
  const { signIn, signInWithGoogle } = useAuth();
  const t          = useTranslations('login');

  const [formData,     setFormData]     = useState<FormData>({ email: '', password: '', rememberMe: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [generalError, setGeneralError] = useState('');

  const { errors, touched, validateForm, handleBlur, clearErrors } = useFormValidation(formData, t);
  const { attemptCount, isLockedOut, incrementAttempts, resetAttempts } = useLoginAttempts();

  const getErrorMessage = (error: any): string => {
    // Supabase error messages are usually in the message string
    // but some implementations might still pass objects with codes
    const message = error?.message || '';
    
    if (message.includes('Invalid login credentials')) return t('errorInvalid');
    if (message.includes('Email not confirmed')) return 'Please verify your email address before signing in.';
    if (message.includes('Too many requests')) return t('errorTooMany');
    
    // Fallback for legacy Firebase codes if any still bubble up from components
    if (error?.code) {
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':     return t('errorInvalid');
        case 'auth/too-many-requests':      return t('errorTooMany');
        case 'auth/user-disabled':          return t('errorDisabled');
        default:                            return t('errorGeneral');
      }
    }
    return message || t('errorUnexpected');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (errors[name as keyof FormErrors]) clearErrors();
    if (generalError) setGeneralError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLockedOut) {
      setGeneralError(t('lockedBody'));
      return;
    }

    const validation = validateForm();
    if (!validation.isValid) return;

    setIsSubmitting(true);
    setGeneralError('');

    try {
      // FIX: call AuthContext.signIn — it creates the __session cookie and
      // lets the route guard in AuthContext handle the redirect. Do NOT push
      // the router manually here; both systems redirecting causes a race.
      await signIn(formData.email, formData.password);
      resetAttempts();
      
      // Check for redirectTo parameter to ensure user returns to their previous context (e.g., booking or search)
      const dest = searchParams?.get('redirectTo');
      if (dest) {
        router.push(dest);
      }
    } catch (error: any) {
      console.error('Login error:', error);
      incrementAttempts();
      setGeneralError(getErrorMessage(error));
      document.getElementById('email')?.focus();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = () => {
    router.push(`/forgot-password${formData.email ? `?email=${encodeURIComponent(formData.email)}` : ''}`);
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setGeneralError('');
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error('Google login error:', error);
      setGeneralError(error.message || 'Failed to sign in with Google');
      setIsGoogleLoading(false);
    }
  };

  const renderError = (fieldName: keyof FormErrors) => {
    const error    = errors[fieldName];
    const isTouched = touched[fieldName];
    if (error && isTouched) {
      return (
        <div className="mt-1 flex items-center text-sm text-red-600" role="alert">
          <ExclamationTriangleIcon className="w-4 h-4 mr-1 flex-shrink-0" />{error}
        </div>
      );
    }
    return null;
  };

  const getInputClassName = (fieldName: keyof FormErrors) => {
    const base     = "appearance-none block w-full px-3 py-2.5 pl-10 pr-10 border rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-200";
    const hasError = errors[fieldName] && touched[fieldName];
    return hasError
      ? `${base} border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500`
      : `${base} border-gray-300 focus:ring-blue-500 focus:border-blue-500`;
  };

  return (
    <div className="min-h-screen flex flex-col items-center pt-28 sm:pt-32 lg:pt-36 pb-8 bg-gradient-to-br from-gray-50 to-gray-100 sm:px-6 lg:px-8 overflow-y-auto">
      <div className="w-full max-w-md pt-2">
        <div className="flex justify-center pb-1">
          <div className="flex items-center justify-center transition-transform duration-300 hover:scale-105 max-h-16 sm:max-h-18 md:max-h-20">
            <Image
              src="/tibhukebus_logo_transparent.png"
              alt="TibhukeBus Logo"
              width={120}
              height={48}
              className="w-auto h-auto object-contain drop-shadow-2xl brightness-[1.02] contrast-[1.05]"
              priority
            />
          </div>
        </div>
        <h1 className="text-center text-2xl font-extrabold text-gray-900 tracking-tight">
          {t('title')}
        </h1>
      </div>

      <div className="mt-3 w-full max-w-md">
        <div className="bg-white py-10 px-6 shadow-xl rounded-2xl sm:px-12">

          {isVerified && (
            <div className="mb-6 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-start">
              <CheckCircleIcon className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5 text-green-600" />
              <div>
                <p className="font-medium">Email Verified!</p>
                <p className="text-sm mt-1">Your email has been verified successfully. You can now log in.</p>
              </div>
            </div>
          )}

          {isLockedOut && (
            <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg flex items-start">
              <ExclamationTriangleIcon className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{t('lockedTitle')}</p>
                <p className="text-sm mt-1">{t('lockedBody')}</p>
              </div>
            </div>
          )}

          {attemptCount > 0 && attemptCount < MAX_ATTEMPTS && !isLockedOut && (
            <div className="mb-6 bg-orange-50 border border-orange-200 text-orange-800 px-4 py-3 rounded-lg flex items-center">
              <ExclamationTriangleIcon className="w-5 h-5 mr-2 flex-shrink-0" />
              <p className="text-sm">{t('attemptsRemaining', { count: MAX_ATTEMPTS - attemptCount })}</p>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit} noValidate>
            {generalError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start" role="alert">
                <ExclamationTriangleIcon className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">{t('errorTitle')}</p>
                  <p className="text-sm mt-1">{generalError}</p>
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                <EnvelopeIcon className="w-4 h-4 inline mr-1" />{t('emailLabel')}
              </label>
              <div className="relative">
                <input
                  id="email" name="email" type="email"
                  autoComplete="email" required
                  aria-invalid={errors.email && touched.email ? 'true' : 'false'}
                  value={formData.email}
                  onChange={handleInputChange}
                  onBlur={() => handleBlur('email')}
                  onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                  className={getInputClassName('email')}
                  placeholder={t('emailPlaceholder')}
                  disabled={isSubmitting || isLockedOut}
                />
                <EnvelopeIcon className="w-5 h-5 text-gray-400 absolute top-2.5 left-3 pointer-events-none" />
                {errors.email && touched.email && (
                  <ExclamationTriangleIcon className="w-5 h-5 text-red-400 absolute top-2.5 right-3 pointer-events-none" />
                )}
              </div>
              {renderError('email')}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                <LockClosedIcon className="w-4 h-4 inline mr-1" />{t('passwordLabel')}
              </label>
              <div className="relative">
                <input
                  id="password" name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password" required
                  aria-invalid={errors.password && touched.password ? 'true' : 'false'}
                  value={formData.password}
                  onChange={handleInputChange}
                  onBlur={() => handleBlur('password')}
                  onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                  className={getInputClassName('password')}
                  placeholder={t('passwordPlaceholder')}
                  disabled={isSubmitting || isLockedOut}
                />
                <LockClosedIcon className="w-5 h-5 text-gray-400 absolute top-2.5 left-3 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute top-2.5 right-3 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors duration-200"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  disabled={isSubmitting || isLockedOut}
                >
                  {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                </button>
              </div>
              {renderError('password')}
            </div>

            {/* Remember me / Forgot password */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="rememberMe" name="rememberMe" type="checkbox"
                  checked={formData.rememberMe}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded transition-colors duration-200"
                  disabled={isSubmitting || isLockedOut}
                />
                <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-700 cursor-pointer">
                  {t('rememberMe')}
                </label>
              </div>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={isSubmitting}
                className="text-sm font-medium text-blue-600 hover:text-blue-500 focus:outline-none focus:underline transition-colors duration-200"
              >
                {t('forgotPassword')}
              </button>
            </div>

            {/* Submit */}
            <div>
              <Button
                type="submit"
                disabled={isSubmitting || isLockedOut}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75" />
                    </svg>
                    {t('submitting')}
                  </>
                ) : t('submitButton')}
              </Button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with</span>
              </div>
            </div>

            <div className="mt-6">
              <Button
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading || isSubmitting || isLockedOut}
                variant="outline"
                className="w-full flex justify-center items-center py-2.5 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
              >
                {isGoogleLoading ? (
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-700" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                    <path d="M1 1h22v22H1z" fill="none" />
                  </svg>
                )}
                Google
              </Button>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              {t('newCustomer')}{' '}
              <Link href="/register" className="font-medium text-blue-600 hover:text-blue-500 focus:outline-none focus:underline transition-colors duration-200">
                {t('createAccount')}
              </Link>
            </p>
          </div>

          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500">
              {t('troubleSignIn')}{' '}
              <Link href="/contact" className="text-blue-600 hover:text-blue-500 focus:outline-none focus:underline transition-colors duration-200">
                Contact support
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}   
