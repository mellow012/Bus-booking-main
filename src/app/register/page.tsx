'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { EmailVerificationPrompt } from '@/components/EmailVerificationPrompt';
import {
  EnvelopeIcon, LockClosedIcon, UserIcon, EyeIcon,
  EyeSlashIcon, ExclamationTriangleIcon, CheckCircleIcon, XCircleIcon
} from '@heroicons/react/24/outline';
import { Phone } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormData {
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  phone: string;
  agreeToTerms: boolean;
}

interface FormErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  fullName?: string;
  phone?: string;
  agreeToTerms?: string;
  general?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 128;
const NAME_REGEX = /^[a-zA-Z\s'-]+$/;

// ─── Validation hook ──────────────────────────────────────────────────────────

const useFormValidation = (formData: FormData, t: (key: string, opts?: any) => string) => {
  const [errors, setErrors]   = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateField = (name: string, value: string | boolean): string => {
    switch (name) {
      case 'email':
        if (!value || typeof value !== 'string' || !value.trim()) return t('errorEmailRequired');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return t('errorEmailInvalid');
        return '';
      case 'password':
        if (!value || typeof value !== 'string') return t('errorPasswordRequired');
        if (value.length < MIN_PASSWORD_LENGTH) return t('errorPasswordMin', { min: MIN_PASSWORD_LENGTH });
        if (value.length > MAX_PASSWORD_LENGTH) return t('errorPasswordMax', { max: MAX_PASSWORD_LENGTH });
        return '';
      case 'confirmPassword':
        if (!value || typeof value !== 'string') return t('errorConfirmRequired');
        if (value !== formData.password) return t('errorConfirmMatch');
        return '';
      case 'fullName':
        if (!value || typeof value !== 'string' || !value.trim()) return 'Full name is required';
        if (value.trim().length < 2) return 'Full name must be at least 2 characters';
        if (!NAME_REGEX.test(value)) return 'Full name contains invalid characters';
        return '';
      case 'phone':
        if (!value || typeof value !== 'string' || !value.trim()) return 'Phone number is required';
        const normalizedPhone = value.trim().replace(/[\s()-]/g, '');
        if (!/^((\+265|265|0)?\d{8,9})$/.test(normalizedPhone)) return 'Enter a valid phone number';
        return '';
      case 'agreeToTerms':
        if (!value) return t('errorTermsRequired');
        return '';
      default:
        return '';
    }
  };

  const validateForm = () => {
    const newErrors: FormErrors = {};
    Object.keys(formData).forEach((key) => {
      const error = validateField(key, formData[key as keyof FormData]);
      if (error) newErrors[key as keyof FormErrors] = error;
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleBlur = (name: string) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    const error = validateField(name, formData[name as keyof FormData]);
    setErrors(prev => ({ ...prev, [name]: error || undefined }));
  };

  const clearErrors     = () => setErrors({});
  const clearFieldError = (name: string) =>
    setErrors(prev => { const n = { ...prev }; delete n[name as keyof FormErrors]; return n; });

  return { errors, touched, validateForm, handleBlur, clearErrors, clearFieldError };
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function Register() {
  const router   = useRouter();
  const t        = useTranslations('register');
  const { signUp, signInWithGoogle } = useAuth();

  const [formData, setFormData] = useState<FormData>({
    email: '', password: '', confirmPassword: '',
    fullName: '', phone: '', agreeToTerms: false,
  });
  const [isSubmitting,       setIsSubmitting]       = useState(false);
  const [isGoogleLoading,    setIsGoogleLoading]    = useState(false);
  const [showPassword,       setShowPassword]       = useState(false);
  const [showConfirmPassword,setShowConfirmPassword] = useState(false);
  const [generalError,       setGeneralError]       = useState('');
  const [success,            setSuccess]            = useState(false);
  const [userEmail,          setUserEmail]          = useState('');

  const { errors, touched, validateForm, handleBlur, clearFieldError } =
    useFormValidation(formData, t);

  // FIX VER-1: getErrorMessage now handles Firebase error codes directly on the
  // error object. AuthContext.signUp re-throws with error.code preserved when
  // possible, or wraps in a plain Error with a message string as fallback.
  const getErrorMessage = (error: any): string => {
    const message = error?.message || '';
    
    if (message.includes('User already registered')) return t('authEmailInUse');
    if (message.includes('Password should be at least')) return t('authWeakPassword');
    
    // Fallback for codes
    const code = error?.code ?? '';
    switch (code) {
      case 'auth/email-already-in-use':   return t('authEmailInUse');
      case 'auth/invalid-email':          return t('authInvalidEmail');
      case 'auth/operation-not-allowed':  return t('authNotAllowed');
      case 'auth/weak-password':          return t('authWeakPassword');
      default:
        return message || t('authGeneral');
    }
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    const processedValue = type === 'checkbox' ? checked : value;
    setFormData(prev => ({ ...prev, [name]: processedValue }));
    if (errors[name as keyof FormErrors]) clearFieldError(name);
    if (generalError) setGeneralError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      const firstError = Object.keys(errors)[0];
      document.getElementById(firstError)?.focus();
      return;
    }

    setIsSubmitting(true);
    setGeneralError('');

    try {
      await signUp(
        formData.email,
        formData.password,
        { fullName: formData.fullName.trim(), phone: formData.phone.trim() }
      );

      // FIX VER-1: verification email is now sent inside AuthContext.signUp
      // using the live newUser reference — no race condition possible.
      // Do NOT call sendVerificationEmail() here.

      setUserEmail(formData.email);
      setSuccess(true);
      setTimeout(() => router.push('/verify-email'), 2000);

    } catch (error: any) {
      console.error('Registration error:', error);
      setGeneralError(getErrorMessage(error));
      document.getElementById('email')?.focus();
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderError = (fieldName: keyof FormErrors) => {
    const error    = errors[fieldName];
    const isTouched = touched[fieldName];
    if (!error || !isTouched) return null;
    return (
      <div className="mt-1 flex items-center text-sm text-red-600" role="alert">
        <ExclamationTriangleIcon className="w-4 h-4 mr-1 flex-shrink-0" />
        {error}
      </div>
    );
  };

  const getInputClassName = (fieldName: keyof FormErrors) => {
    const base = "appearance-none block w-full px-3 py-2.5 pl-10 border rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-200";
    const hasError = errors[fieldName] && touched[fieldName];
    return hasError
      ? `${base} border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500`
      : `${base} border-gray-300 focus:ring-blue-500 focus:border-blue-500`;
  };

  const renderPasswordMatch = () => {
    if (!formData.confirmPassword || !touched.confirmPassword) return null;
    const isMatch = formData.password === formData.confirmPassword;
    return (
      <div className={`mt-1 flex items-center text-sm ${isMatch ? 'text-green-600' : 'text-red-600'}`}>
        {isMatch
          ? <><CheckCircleIcon className="w-4 h-4 mr-1" />{t('passwordsMatch')}</>
          : <><XCircleIcon    className="w-4 h-4 mr-1" />{t('passwordsNoMatch')}</>}
      </div>
    );
  };

  return (
    <>
      {/* Show verification prompt banner once registration succeeds */}
      {userEmail && <EmailVerificationPrompt email={userEmail} showBanner={true} />}

      <div className="min-h-screen flex flex-col items-center pt-28 sm:pt-32 lg:pt-36 pb-8 bg-gradient-to-br from-gray-50 to-gray-100 sm:px-6 lg:px-8 overflow-y-auto">
        <div className={`w-full max-w-md pt-2 ${isSubmitting ? 'hidden' : ''}`}>
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
          <h1 className="text-center text-2xl font-extrabold text-gray-900 tracking-tight">
            {t('title')}
          </h1>
        </div>

        <div className={`mt-4 w-full max-w-md ${isSubmitting ? 'hidden' : ''}`}>
          <div className="bg-white py-10 px-6 shadow-xl rounded-2xl sm:px-12">
            <form className="space-y-5" onSubmit={handleSubmit} noValidate>

              {/* General error */}
              {generalError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start" role="alert">
                  <ExclamationTriangleIcon className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">{t('errorTitle')}</p>
                    <p className="text-sm mt-1">{generalError}</p>
                  </div>
                </div>
              )}

              {/* Success */}
              {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-start">
                  <CheckCircleIcon className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">{t('successTitle')}</p>
                    <p className="text-sm mt-1">{t('successRedirect')}</p>
                  </div>
                </div>
              )}

              {/* Name + phone */}
              <div className="space-y-4">
                <div>
                  <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                    <UserIcon className="w-4 h-4 inline mr-1" />Full Name
                  </label>
                  <div className="relative">
                    <input
                      id="fullName" name="fullName" type="text"
                      autoComplete="name" required
                      aria-invalid={errors.fullName && touched.fullName ? 'true' : 'false'}
                      value={formData.fullName}
                      onChange={handleInputChange}
                      onBlur={() => handleBlur('fullName')}
                      onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                      className={getInputClassName('fullName')}
                      placeholder="Enter your full name"
                      disabled={isSubmitting || success}
                    />
                    <UserIcon className="w-5 h-5 text-gray-400 absolute top-2.5 left-3 pointer-events-none" />
                  </div>
                  {renderError('fullName')}
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                    <Phone className="w-4 h-4 inline mr-1" />Phone Number
                  </label>
                  <div className="relative">
                    <input
                      id="phone" name="phone" type="tel"
                      autoComplete="tel" required
                      aria-invalid={errors.phone && touched.phone ? 'true' : 'false'}
                      value={formData.phone}
                      onChange={handleInputChange}
                      onBlur={() => handleBlur('phone')}
                      onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                      className={getInputClassName('phone')}
                      placeholder="+265 999 123 456"
                      disabled={isSubmitting || success}
                    />
                    <Phone className="w-5 h-5 text-gray-400 absolute top-2.5 left-3 pointer-events-none" />
                  </div>
                  {renderError('phone')}
                </div>
              </div>

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
                    disabled={isSubmitting || success}
                  />
                  <EnvelopeIcon className="w-5 h-5 text-gray-400 absolute top-2.5 left-3 pointer-events-none" />
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
                    autoComplete="new-password" required
                    aria-invalid={errors.password && touched.password ? 'true' : 'false'}
                    value={formData.password}
                    onChange={handleInputChange}
                    onBlur={() => handleBlur('password')}
                    onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                    className={getInputClassName('password')}
                    placeholder={t('passwordPlaceholder')}
                    disabled={isSubmitting || success}
                  />
                  <LockClosedIcon className="w-5 h-5 text-gray-400 absolute top-2.5 left-3 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute top-2.5 right-3 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors duration-200"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    disabled={isSubmitting || success}
                  >
                    {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                  </button>
                </div>
                {renderError('password')}
              </div>

              {/* Confirm password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  <LockClosedIcon className="w-4 h-4 inline mr-1" />{t('confirmPasswordLabel')}
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword" name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password" required
                    aria-invalid={errors.confirmPassword && touched.confirmPassword ? 'true' : 'false'}
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    onBlur={() => handleBlur('confirmPassword')}
                    onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                    className={getInputClassName('confirmPassword')}
                    placeholder={t('confirmPasswordPlaceholder')}
                    disabled={isSubmitting || success}
                  />
                  <LockClosedIcon className="w-5 h-5 text-gray-400 absolute top-2.5 left-3 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute top-2.5 right-3 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors duration-200"
                    disabled={isSubmitting || success}
                  >
                    {showConfirmPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                  </button>
                </div>
                {renderError('confirmPassword')}
                {renderPasswordMatch()}
              </div>

              {/* Terms */}
              <div>
                <div className="flex items-start">
                  <input
                    id="agreeToTerms" name="agreeToTerms" type="checkbox"
                    checked={formData.agreeToTerms}
                    onChange={handleInputChange}
                    onBlur={() => handleBlur('agreeToTerms')}
                    className="h-4 w-4 mt-0.5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded transition-colors duration-200"
                    disabled={isSubmitting || success}
                    aria-invalid={errors.agreeToTerms && touched.agreeToTerms ? 'true' : 'false'}
                  />
                  <label htmlFor="agreeToTerms" className="ml-2 block text-sm text-gray-700">
                    {t('agreeTermsPre')}{' '}
                    <Link href="/terms" target="_blank"
                      className="text-blue-600 hover:text-blue-500 focus:outline-none focus:underline">
                      {t('termsLink')}
                    </Link>
                    {' '}{t('andWord')}{' '}
                    <Link href="/privacy" target="_blank"
                      className="text-blue-600 hover:text-blue-500 focus:outline-none focus:underline">
                      {t('privacyLink')}
                    </Link>
                  </label>
                </div>
                {renderError('agreeToTerms')}
              </div>

              {/* Submit */}
              <div>
                <Button
                  type="submit"
                  disabled={isSubmitting || success}
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
                  ) : success ? (
                    <><CheckCircleIcon className="w-5 h-5 mr-2" />{t('accountCreated')}</>
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
                  disabled={isGoogleLoading || isSubmitting || success}
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
              <p className="text-xs text-gray-500">
                {t('alreadyHaveAccount')}{' '}
                <Link href="/login"
                  className="text-blue-600 hover:text-blue-500 focus:outline-none focus:underline transition-colors duration-200">
                  {t('signInHere')}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
