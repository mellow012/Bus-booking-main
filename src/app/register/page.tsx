
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { 
  EnvelopeIcon, 
  LockClosedIcon, 
  UserIcon, 
  EyeIcon,
  EyeSlashIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';

// Types
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

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
  suggestions: string[];
}

// Constants
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const NAME_REGEX = /^[a-zA-Z\s'-]+$/;

// Password strength checker
const checkPasswordStrength = (password: string): PasswordStrength => {
  let score = 0;
  const suggestions: string[] = [];

  if (password.length >= MIN_PASSWORD_LENGTH) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
    score++;
  } else {
    suggestions.push('Use both uppercase and lowercase letters');
  }
  if (/\d/.test(password)) {
    score++;
  } else {
    suggestions.push('Include at least one number');
  }
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    score++;
  } else {
    suggestions.push('Add a special character (!@#$%^&*)');
  }

  const strengthMap = {
    0: { label: 'Very Weak', color: 'bg-red-500' },
    1: { label: 'Weak', color: 'bg-orange-500' },
    2: { label: 'Fair', color: 'bg-yellow-500' },
    3: { label: 'Good', color: 'bg-blue-500' },
    4: { label: 'Strong', color: 'bg-green-500' },
    5: { label: 'Very Strong', color: 'bg-green-600' },
  };

  const strength = strengthMap[score as keyof typeof strengthMap] || strengthMap[0];

  return {
    score,
    label: strength.label,
    color: strength.color,
    suggestions,
  };
};

// Custom hooks
const useFormValidation = (formData: FormData) => {
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateField = (name: string, value: string | boolean): string => {
    switch (name) {
      case 'email':
        if (!value || typeof value !== 'string' || !value.trim()) {
          return 'Email address is required';
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return 'Please enter a valid email address';
        }
        return '';

      case 'password':
        if (!value || typeof value !== 'string') {
          return 'Password is required';
        }
        if (value.length < MIN_PASSWORD_LENGTH) {
          return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
        }
        if (value.length > MAX_PASSWORD_LENGTH) {
          return `Password must be less than ${MAX_PASSWORD_LENGTH} characters`;
        }
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
          return 'Password must contain uppercase, lowercase, and a number';
        }
        return '';

      case 'confirmPassword':
        if (!value || typeof value !== 'string') {
          return 'Please confirm your password';
        }
        if (value !== formData.password) {
          return 'Passwords do not match';
        }
        return '';

      case 'firstName':
        if (!value || typeof value !== 'string' || !value.trim()) {
          return 'First name is required';
        }
        if (value.trim().length < 2) {
          return 'First name must be at least 2 characters';
        }
        if (!NAME_REGEX.test(value)) {
          return 'First name can only contain letters, spaces, hyphens, and apostrophes';
        }
        return '';

      case 'lastName':
        if (!value || typeof value !== 'string' || !value.trim()) {
          return 'Last name is required';
        }
        if (value.trim().length < 2) {
          return 'Last name must be at least 2 characters';
        }
        if (!NAME_REGEX.test(value)) {
          return 'Last name can only contain letters, spaces, hyphens, and apostrophes';
        }
        return '';

      case 'agreeToTerms':
        if (!value) {
          return 'You must agree to the terms and conditions';
        }
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

  const clearErrors = () => {
    setErrors({});
  };

  const clearFieldError = (name: string) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[name as keyof FormErrors];
      return newErrors;
    });
  };

  return {
    errors,
    touched,
    validateForm,
    handleBlur,
    clearErrors,
    clearFieldError,
  };
};

// Utility functions
const getErrorMessage = (error: any): string => {
  if (error?.code) {
    switch (error.code) {
      case 'auth/email-already-in-use':
        return 'This email is already registered. Please sign in or use a different email.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/operation-not-allowed':
        return 'Registration is currently disabled. Please contact support.';
      case 'auth/weak-password':
        return 'Password is too weak. Please choose a stronger password.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection and try again.';
      default:
        return 'Registration failed. Please try again or contact support.';
    }
  }
  return error?.message || 'An unexpected error occurred. Please try again.';
};

// Main component
export default function Register() {
  const { signUp } = useAuth();
  const router = useRouter();
  
  // Form state
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    agreeToTerms: false,
  });
  
  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [success, setSuccess] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength | null>(null);
  
  // Custom hooks
  const { errors, touched, validateForm, handleBlur, clearFieldError } = useFormValidation(formData);

  // Update password strength when password changes
  useEffect(() => {
    if (formData.password) {
      setPasswordStrength(checkPasswordStrength(formData.password));
    } else {
      setPasswordStrength(null);
    }
  }, [formData.password]);

  // Event handlers
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    const processedValue = type === 'checkbox' ? checked : value;

    setFormData(prev => ({
      ...prev,
      [name]: processedValue
    }));
    
    if (errors[name as keyof FormErrors]) {
      clearFieldError(name);
    }
    if (generalError) {
      setGeneralError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      const firstErrorField = Object.keys(errors)[0];
      document.getElementById(firstErrorField)?.focus();
      return;
    }

    setIsSubmitting(true);
    setGeneralError('');

    try {
      await signUp(formData.email, formData.password, {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        role: 'customer',
      });
      
      setSuccess(true);
      
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
      
    } catch (error: any) {
      console.error('Registration error:', error);
      setGeneralError(getErrorMessage(error));
      document.getElementById('email')?.focus();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render helpers
  const renderError = (fieldName: keyof FormErrors) => {
    const error = errors[fieldName];
    const isTouched = touched[fieldName];
    
    if (error && isTouched) {
      return (
        <div className="mt-1 flex items-center text-sm text-red-600" role="alert">
          <ExclamationTriangleIcon className="w-4 h-4 mr-1 flex-shrink-0" />
          {error}
        </div>
      );
    }
    return null;
  };

  const getInputClassName = (fieldName: keyof FormErrors) => {
    const baseClass = "appearance-none block w-full px-3 py-2.5 pl-10 border rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-200";
    const hasError = errors[fieldName] && touched[fieldName];
    
    if (hasError) {
      return `${baseClass} border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500`;
    }
    
    return `${baseClass} border-gray-300 focus:ring-blue-500 focus:border-blue-500`;
  };

  const renderPasswordStrength = () => {
    if (!passwordStrength || !formData.password) return null;

    return (
      <div className="mt-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-700">Password Strength:</span>
          <span className={`text-xs font-medium ${
            passwordStrength.score >= 4 ? 'text-green-600' : 
            passwordStrength.score >= 3 ? 'text-blue-600' : 
            passwordStrength.score >= 2 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {passwordStrength.label}
          </span>
        </div>
        <div className="flex space-x-1">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                i < passwordStrength.score ? passwordStrength.color : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
        {passwordStrength.suggestions.length > 0 && (
          <ul className="mt-2 space-y-1">
            {passwordStrength.suggestions.map((suggestion, i) => (
              <li key={i} className="text-xs text-gray-600 flex items-start">
                <span className="mr-1">•</span>
                {suggestion}
              </li>
            ))}
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
        {isMatch ? (
          <>
            <CheckCircleIcon className="w-4 h-4 mr-1" />
            Passwords match
          </>
        ) : (
          <>
            <XCircleIcon className="w-4 h-4 mr-1" />
            Passwords do not match
          </>
        )}
      </div>
    );
  };

  // Skeleton Loader
  const SkeletonLoader = () => (
    <div className="bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6 rounded-2xl shadow-xl animate-pulse sm:mx-auto sm:w-full sm:max-w-md">
      <div className="h-16 w-16 bg-gray-200 rounded-full mx-auto mb-6"></div>
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded w-3/4 mx-auto"></div>
        <div className="h-10 bg-gray-200 rounded"></div>
        <div className="h-10 bg-gray-200 rounded"></div>
        <div className="h-10 bg-gray-200 rounded"></div>
        <div className="h-10 bg-gray-200 rounded"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        <div className="h-10 bg-gray-200 rounded"></div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {isSubmitting && <SkeletonLoader />}
      <div className={`sm:mx-auto sm:w-full sm:max-w-md ${isSubmitting ? 'hidden' : ''}`}>
        {/* Logo */}
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-3xl">B</span>
          </div>
        </div>
        
        {/* Header */}
        <h1 className="mt-6 text-center text-4xl font-extrabold text-gray-900 tracking-tight">
          Create your account
        </h1>
        <p className="mt-2 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link 
            href="/login" 
            className="font-medium text-blue-600 hover:text-blue-500 focus:outline-none focus:underline transition-colors duration-200"
          >
            Sign in
          </Link>
        </p>
      </div>

      <div className={`mt-8 sm:mx-auto sm:w-full sm:max-w-md ${isSubmitting ? 'hidden' : ''}`}>
        <div className="bg-white py-10 px-6 shadow-xl rounded-2xl sm:px-12">
          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            {/* General Error */}
            {generalError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start" role="alert">
                <ExclamationTriangleIcon className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Registration Failed</p>
                  <p className="text-sm mt-1">{generalError}</p>
                </div>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-start">
                <CheckCircleIcon className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Registration Successful!</p>
                  <p className="text-sm mt-1">Redirecting to your dashboard...</p>
                </div>
              </div>
            )}

            {/* Name Fields - Side by Side */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                  <UserIcon className="w-4 h-4 inline mr-1" />
                  First Name
                </label>
                <div className="relative">
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    autoComplete="given-name"
                    required
                    aria-invalid={errors.firstName && touched.firstName ? 'true' : 'false'}
                    value={formData.firstName}
                    onChange={handleInputChange}
                    onBlur={() => handleBlur('firstName')}
                    className={getInputClassName('firstName')}
                    placeholder="John"
                    disabled={isSubmitting || success}
                  />
                  <UserIcon className="w-5 h-5 text-gray-400 absolute top-2.5 left-3 pointer-events-none" />
                </div>
                {renderError('firstName')}
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                  <UserIcon className="w-4 h-4 inline mr-1" />
                  Last Name
                </label>
                <div className="relative">
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    autoComplete="family-name"
                    required
                    aria-invalid={errors.lastName && touched.lastName ? 'true' : 'false'}
                    value={formData.lastName}
                    onChange={handleInputChange}
                    onBlur={() => handleBlur('lastName')}
                    className={getInputClassName('lastName')}
                    placeholder="Doe"
                    disabled={isSubmitting || success}
                  />
                  <UserIcon className="w-5 h-5 text-gray-400 absolute top-2.5 left-3 pointer-events-none" />
                </div>
                {renderError('lastName')}
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
                  aria-invalid={errors.email && touched.email ? 'true' : 'false'}
                  value={formData.email}
                  onChange={handleInputChange}
                  onBlur={() => handleBlur('email')}
                  className={getInputClassName('email')}
                  placeholder="john.doe@example.com"
                  disabled={isSubmitting || success}
                />
                <EnvelopeIcon className="w-5 h-5 text-gray-400 absolute top-2.5 left-3 pointer-events-none" />
              </div>
              {renderError('email')}
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                <LockClosedIcon className="w-4 h-4 inline mr-1" />
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  aria-invalid={errors.password && touched.password ? 'true' : 'false'}
                  value={formData.password}
                  onChange={handleInputChange}
                  onBlur={() => handleBlur('password')}
                  className={getInputClassName('password')}
                  placeholder="Create a strong password"
                  disabled={isSubmitting || success}
                />
                <LockClosedIcon className="w-5 h-5 text-gray-400 absolute top-2.5 left-3 pointer-events-none" />
                <button
                  type="button"
                  className="absolute top-2.5 right-3 text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600 transition-colors duration-200"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  disabled={isSubmitting || success}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="w-5 h-5" />
                  ) : (
                    <EyeIcon className="w-5 h-5" />
                  )}
                </button>
              </div>
              {renderError('password')}
              {renderPasswordStrength()}
            </div>

            {/* Confirm Password Field */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                <LockClosedIcon className="w-4 h-4 inline mr-1" />
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  aria-invalid={errors.confirmPassword && touched.confirmPassword ? 'true' : 'false'}
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  onBlur={() => handleBlur('confirmPassword')}
                  className={getInputClassName('confirmPassword')}
                  placeholder="Re-enter your password"
                  disabled={isSubmitting || success}
                />
                <LockClosedIcon className="w-5 h-5 text-gray-400 absolute top-2.5 left-3 pointer-events-none" />
                <button
                  type="button"
                  className="absolute top-2.5 right-3 text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600 transition-colors duration-200"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  disabled={isSubmitting || success}
                >
                  {showConfirmPassword ? (
                    <EyeSlashIcon className="w-5 h-5" />
                  ) : (
                    <EyeIcon className="w-5 h-5" />
                  )}
                </button>
              </div>
              {renderError('confirmPassword')}
              {renderPasswordMatch()}
            </div>

            {/* Terms and Conditions */}
            <div>
              <div className="flex items-start">
                <input
                  id="agreeToTerms"
                  name="agreeToTerms"
                  type="checkbox"
                  checked={formData.agreeToTerms}
                  onChange={handleInputChange}
                  onBlur={() => handleBlur('agreeToTerms')}
                  className="h-4 w-4 mt-0.5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded transition-colors duration-200"
                  disabled={isSubmitting || success}
                  aria-invalid={errors.agreeToTerms && touched.agreeToTerms ? 'true' : 'false'}
                />
                <label htmlFor="agreeToTerms" className="ml-2 block text-sm text-gray-700">
                  I agree to the{' '}
                  <Link 
                    href="/terms" 
                    className="text-blue-600 hover:text-blue-500 focus:outline-none focus:underline"
                    target="_blank"
                  >
                    Terms and Conditions
                  </Link>
                  {' '}and{' '}
                  <Link 
                    href="/privacy" 
                    className="text-blue-600 hover:text-blue-500 focus:outline-none focus:underline"
                    target="_blank"
                  >
                    Privacy Policy
                  </Link>
                </label>
              </div>
              {renderError('agreeToTerms')}
            </div>

            {/* Submit Button */}
            <div>
              <Button
                type="submit"
                disabled={isSubmitting || success}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                aria-label={isSubmitting ? 'Creating account...' : 'Create account'}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75" />
                    </svg>
                    Creating your account...
                  </>
                ) : success ? (
                  <>
                    <CheckCircleIcon className="w-5 h-5 mr-2" />
                    Account Created!
                  </>
                ) : (
                  'Create Account'
                )}
              </Button>
            </div>
          </form>

          {/* Sign In Link */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Already have an account?{' '}
              <Link 
                href="/login" 
                className="text-blue-600 hover:text-blue-500 focus:outline-none focus:underline transition-colors duration-200"
              >
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );}