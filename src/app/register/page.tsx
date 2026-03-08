'use client';

import React, { useState, useEffect } from 'react';
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  agreeToTerms: boolean;
}

interface FormErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  firstName?: string;
  lastName?: string;
  agreeToTerms?: string;
  general?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const NAME_REGEX = /^[a-zA-Z\s'-]+$/;

// ─── Password strength (raw — labels come from translations) ─────────────────

const checkPasswordStrengthRaw = (
  password: string
): { score: number; suggestions: ('upper' | 'number' | 'special')[] } => {
  let score = 0;
  const suggestions: ('upper' | 'number' | 'special')[] = [];
  if (password.length >= MIN_PASSWORD_LENGTH) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
    score++;
  } else {
    suggestions.push('upper');
  }
  if (/\d/.test(password)) {
    score++;
  } else {
    suggestions.push('number');
  }
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    score++;
  } else {
    suggestions.push('special');
  }
  return { score, suggestions };
};

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
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) return t('errorPasswordStrength');
        return '';
      case 'confirmPassword':
        if (!value || typeof value !== 'string') return t('errorConfirmRequired');
        if (value !== formData.password) return t('errorConfirmMatch');
        return '';
      case 'firstName':
        if (!value || typeof value !== 'string' || !value.trim()) return t('errorFirstNameRequired');
        if (value.trim().length < 2) return t('errorFirstNameMin');
        if (!NAME_REGEX.test(value)) return t('errorFirstNameChars');
        return '';
      case 'lastName':
        if (!value || typeof value !== 'string' || !value.trim()) return t('errorLastNameRequired');
        if (value.trim().length < 2) return t('errorLastNameMin');
        if (!NAME_REGEX.test(value)) return t('errorLastNameChars');
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
  const { signUp } = useAuth();

  const [formData, setFormData] = useState<FormData>({
    email: '', password: '', confirmPassword: '',
    firstName: '', lastName: '', agreeToTerms: false,
  });
  const [isSubmitting,       setIsSubmitting]       = useState(false);
  const [showPassword,       setShowPassword]       = useState(false);
  const [showConfirmPassword,setShowConfirmPassword] = useState(false);
  const [generalError,       setGeneralError]       = useState('');
  const [success,            setSuccess]            = useState(false);
  const [userEmail,          setUserEmail]          = useState('');
  const [strengthData,       setStrengthData]       = useState<{
    score: number; suggestions: ('upper' | 'number' | 'special')[];
  } | null>(null);

  const { errors, touched, validateForm, handleBlur, clearFieldError } =
    useFormValidation(formData, t);

  const strengthLabels = [
    'strengthVeryWeak','strengthWeak','strengthFair',
    'strengthGood','strengthStrong','strengthVeryStrong',
  ] as const;
  const strengthColors = [
    'bg-red-500','bg-orange-500','bg-yellow-500',
    'bg-blue-500','bg-green-500','bg-green-600',
  ];

  useEffect(() => {
    if (formData.password) setStrengthData(checkPasswordStrengthRaw(formData.password));
    else setStrengthData(null);
  }, [formData.password]);

  // FIX VER-1: getErrorMessage now handles Firebase error codes directly on the
  // error object. AuthContext.signUp re-throws with error.code preserved when
  // possible, or wraps in a plain Error with a message string as fallback.
  const getErrorMessage = (error: any): string => {
    const code = error?.code ?? '';
    switch (code) {
      case 'auth/email-already-in-use':   return t('authEmailInUse');
      case 'auth/invalid-email':          return t('authInvalidEmail');
      case 'auth/operation-not-allowed':  return t('authNotAllowed');
      case 'auth/weak-password':          return t('authWeakPassword');
      case 'auth/network-request-failed': return t('authNetwork');
      default:
        // AuthContext wraps unknown errors as plain Error messages
        return error?.message || t('authGeneral');
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
        { firstName: formData.firstName.trim(), lastName: formData.lastName.trim() }
      );

      // FIX VER-1: verification email is now sent inside AuthContext.signUp
      // using the live newUser reference — no race condition possible.
      // Do NOT call sendVerificationEmail() here.

      setUserEmail(formData.email);
      setSuccess(true);
      setTimeout(() => router.push('/'), 2000);

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

  const renderPasswordStrength = () => {
    if (!strengthData || !formData.password) return null;
    const { score, suggestions } = strengthData;
    const labelKey   = strengthLabels[score] ?? strengthLabels[0];
    const color      = strengthColors[score] ?? strengthColors[0];
    const scoreColor = score >= 4 ? 'text-green-600' : score >= 3 ? 'text-blue-600'
                     : score >= 2 ? 'text-yellow-600' : 'text-red-600';
    return (
      <div className="mt-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-700">{t('passwordStrengthLabel')}</span>
          <span className={`text-xs font-medium ${scoreColor}`}>{t(labelKey)}</span>
        </div>
        <div className="flex space-x-1">
          {[...Array(5)].map((_, i) => (
            <div key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i < score ? color : 'bg-gray-200'}`}
            />
          ))}
        </div>
        {suggestions.length > 0 && (
          <ul className="mt-2 space-y-1">
            {suggestions.map((s, i) => {
              const label = s === 'upper'  ? t('suggestionUpperLower')
                          : s === 'number' ? t('suggestionNumber')
                          :                  t('suggestionSpecial');
              return (
                <li key={i} className="text-xs text-gray-600 flex items-start">
                  <span className="mr-1">•</span>{label}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
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

      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className={`sm:mx-auto sm:w-full sm:max-w-md ${isSubmitting ? 'hidden' : ''}`}>
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-3xl">TB</span>
            </div>  
          </div>
          <h1 className="mt-6 text-center text-4xl font-extrabold text-gray-900 tracking-tight">
            {t('title')}
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            {t('alreadyHaveAccount')}{' '}
            <Link href="/login"
              className="font-medium text-blue-600 hover:text-blue-500 focus:outline-none focus:underline transition-colors duration-200">
              {t('signIn')}
            </Link>
          </p>
        </div>

        <div className={`mt-8 sm:mx-auto sm:w-full sm:max-w-md ${isSubmitting ? 'hidden' : ''}`}>
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

              {/* Name fields */}
              <div className="grid grid-cols-2 gap-4">
                {/* First name */}
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                    <UserIcon className="w-4 h-4 inline mr-1" />{t('firstNameLabel')}
                  </label>
                  <div className="relative">
                    <input
                      id="firstName" name="firstName" type="text"
                      autoComplete="given-name" required
                      aria-invalid={errors.firstName && touched.firstName ? 'true' : 'false'}
                      value={formData.firstName}
                      onChange={handleInputChange}
                      onBlur={() => handleBlur('firstName')}
                      className={getInputClassName('firstName')}
                      placeholder={t('firstNamePlaceholder')}
                      disabled={isSubmitting || success}
                    />
                    <UserIcon className="w-5 h-5 text-gray-400 absolute top-2.5 left-3 pointer-events-none" />
                  </div>
                  {renderError('firstName')}
                </div>

                {/* Last name */}
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                    <UserIcon className="w-4 h-4 inline mr-1" />{t('lastNameLabel')}
                  </label>
                  <div className="relative">
                    <input
                      id="lastName" name="lastName" type="text"
                      autoComplete="family-name" required
                      aria-invalid={errors.lastName && touched.lastName ? 'true' : 'false'}
                      value={formData.lastName}
                      onChange={handleInputChange}
                      onBlur={() => handleBlur('lastName')}
                      className={getInputClassName('lastName')}
                      placeholder={t('lastNamePlaceholder')}
                      disabled={isSubmitting || success}
                    />
                    <UserIcon className="w-5 h-5 text-gray-400 absolute top-2.5 left-3 pointer-events-none" />
                  </div>
                  {renderError('lastName')}
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
                {renderPasswordStrength()}
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