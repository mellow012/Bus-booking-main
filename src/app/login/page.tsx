'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { EnvelopeIcon, LockClosedIcon, EyeIcon, EyeSlashIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

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
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 8;

// Custom hooks
const useFormValidation = (formData: FormData) => {
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateField = (name: string, value: string): string => {
    switch (name) {
      case 'email':
        if (!value.trim()) {
          return 'Email address is required';
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return 'Please enter a valid email address';
        }
        return '';
      case 'password':
        if (!value) {
          return 'Password is required';
        }
        if (value.length < MIN_PASSWORD_LENGTH) {
          return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
        }
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
    return {
      isValid: Object.keys(newErrors).length === 0,
      errors: newErrors
    };
  };

  const handleBlur = (name: string) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    const error = validateField(name, formData[name as keyof FormData] as string);
    setErrors(prev => ({ ...prev, [name]: error || undefined }));
  };

  const clearErrors = () => {
    setErrors({});
    setTouched({});
  };

  return {
    errors,
    touched,
    validateForm,
    handleBlur,
    clearErrors
  };
};

const useLoginAttempts = () => {
  const [attemptCount, setAttemptCount] = useState(0);
  const [lockoutTime, setLockoutTime] = useState<number | null>(null);
  const [isLockedOut, setIsLockedOut] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('loginAttempts');
    if (stored) {
      const { count, lockout } = JSON.parse(stored);
      setAttemptCount(count || 0);
      if (lockout && Date.now() < lockout) {
        setLockoutTime(lockout);
        setIsLockedOut(true);
      }
    }
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (lockoutTime && isLockedOut) {
      timer = setInterval(() => {
        if (Date.now() >= lockoutTime) {
          setIsLockedOut(false);
          setAttemptCount(0);
          setLockoutTime(null);
          localStorage.removeItem('loginAttempts');
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [lockoutTime, isLockedOut]);

  const incrementAttempts = () => {
    const newCount = attemptCount + 1;
    setAttemptCount(newCount);
    
    if (newCount >= MAX_ATTEMPTS) {
      const lockout = Date.now() + LOCKOUT_DURATION;
      setLockoutTime(lockout);
      setIsLockedOut(true);
      localStorage.setItem('loginAttempts', JSON.stringify({ 
        count: newCount, 
        lockout 
      }));
    } else {
      localStorage.setItem('loginAttempts', JSON.stringify({ 
        count: newCount 
      }));
    }
  };

  const resetAttempts = () => {
    setAttemptCount(0);
    setLockoutTime(null);
    setIsLockedOut(false);
    localStorage.removeItem('loginAttempts');
  };

  const getRemainingTime = () => {
    if (!lockoutTime) return 0;
    return Math.max(0, Math.ceil((lockoutTime - Date.now()) / 1000));
  };

  return {
    attemptCount,
    isLockedOut,
    remainingTime: getRemainingTime(),
    incrementAttempts,
    resetAttempts
  };
};

// Utility functions
const getErrorMessage = (error: any): string => {
  if (error?.code) {
    switch (error.code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Invalid email or password. Please check your credentials and try again.';
      case 'auth/too-many-requests':
        return 'Too many failed login attempts. Please try again later or reset your password.';
      case 'auth/user-disabled':
        return 'This account has been disabled. Please contact support for assistance.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection and try again.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      default:
        return 'Login failed. Please try again or contact support if the problem persists.';
    }
  }
  return 'An unexpected error occurred. Please try again.';
};

const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// API functions
const handlePostLoginActions = async (user: any) => {
  try {
    const token = await user.getIdTokenResult();
    const role = token.claims.role;
    const companyId = token.claims.companyId;
    
    // Route based on role
    if (role === 'company_admin' && companyId) {
      // Activate company for company admin
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user.getIdToken()}`
        },
        body: JSON.stringify({
          companyId: companyId,
          action: 'activate_company'
        })
      });

      if (!response.ok) {
        console.error('Failed to activate company:', await response.text());
      }

      return `/company/admin?companyId=${companyId}`;
    } 
    else if (role === 'operator' && companyId) {
      // Redirect operator to operator dashboard
      return `/company/operator/dashboard?companyId=${companyId}`;
    }
    else if (role === 'super_admin') {
      // Redirect super admin
      return '/admin/dashboard';
    }
    else if (role === 'customer') {
      // Redirect customer
      return '/dashboard';
    }
    
    // Default fallback
    return '/';
  } catch (error) {
    console.error('Post-login actions failed:', error);
    return '/';
  }
};

// Main component
export default function Login() {
  const router = useRouter();
  const { signIn } = useAuth();
  
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    rememberMe: false,
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [generalError, setGeneralError] = useState('');
  
  const { errors, touched, validateForm, handleBlur, clearErrors } = useFormValidation(formData);
  const { attemptCount, isLockedOut, remainingTime, incrementAttempts, resetAttempts } = useLoginAttempts();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    if (errors[name as keyof FormErrors]) {
      clearErrors();
    }
    if (generalError) {
      setGeneralError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLockedOut) {
      setGeneralError(`Account temporarily locked. Try again in ${formatTime(remainingTime)}.`);
      return;
    }

    const validation = validateForm();
    if (!validation.isValid) {
      return;
    }

    setIsSubmitting(true);
    setGeneralError('');

    try {
      const auth = getAuth();
      const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
      
      resetAttempts();
      
      const redirectUrl = await handlePostLoginActions(userCredential.user);
      router.push(redirectUrl);
      
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
    const baseClass = "appearance-none block w-full px-3 py-2.5 pl-10 pr-10 border rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-200";
    const hasError = errors[fieldName] && touched[fieldName];
    
    if (hasError) {
      return `${baseClass} border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500`;
    }
    
    return `${baseClass} border-gray-300 focus:ring-blue-500 focus:border-blue-500`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-3xl">TB</span>
          </div>
        </div>
        
        <h1 className="mt-6 text-center text-4xl font-extrabold text-gray-900 tracking-tight">
          Sign in to your account
        </h1>
        <p className="mt-2 text-center text-sm text-gray-600">
          New customer?{' '}
          <Link 
            href="/register" 
            className="font-medium text-blue-600 hover:text-blue-500 focus:outline-none focus:underline transition-colors duration-200"
          >
            Create an account
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-10 px-6 shadow-xl rounded-2xl sm:px-12">
          
          {isLockedOut && (
            <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg flex items-start">
              <ExclamationTriangleIcon className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Account Temporarily Locked</p>
                <p className="text-sm mt-1">
                  Too many failed attempts. Try again in {formatTime(remainingTime)}.
                </p>
              </div>
            </div>
          )}

          {attemptCount > 0 && attemptCount < MAX_ATTEMPTS && !isLockedOut && (
            <div className="mb-6 bg-orange-50 border border-orange-200 text-orange-800 px-4 py-3 rounded-lg flex items-center">
              <ExclamationTriangleIcon className="w-5 h-5 mr-2 flex-shrink-0" />
              <p className="text-sm">
                {MAX_ATTEMPTS - attemptCount} attempt{MAX_ATTEMPTS - attemptCount !== 1 ? 's' : ''} remaining before account lockout.
              </p>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit} noValidate>
            
            {generalError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start" role="alert">
                <ExclamationTriangleIcon className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Sign In Failed</p>
                  <p className="text-sm mt-1">{generalError}</p>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                <EnvelopeIcon className="w-4 h-4 inline mr-1" />
                Email address
              </label>
              <div className="relative">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  aria-invalid={errors.email && touched.email ? 'true' : 'false'}
                  aria-describedby={errors.email && touched.email ? 'email-error' : undefined}
                  value={formData.email}
                  onChange={handleInputChange}
                  onBlur={() => handleBlur('email')}
                  className={getInputClassName('email')}
                  placeholder="Enter your email address"
                  disabled={isSubmitting || isLockedOut}
                />
                <EnvelopeIcon className="w-5 h-5 text-gray-400 absolute top-2.5 left-3 pointer-events-none" />
                {errors.email && touched.email && (
                  <ExclamationTriangleIcon className="w-5 h-5 text-red-400 absolute top-2.5 right-3 pointer-events-none" />
                )}
              </div>
              {renderError('email')}
            </div>

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
                  autoComplete="current-password"
                  required
                  aria-invalid={errors.password && touched.password ? 'true' : 'false'}
                  aria-describedby={errors.password && touched.password ? 'password-error' : undefined}
                  value={formData.password}
                  onChange={handleInputChange}
                  onBlur={() => handleBlur('password')}
                  className={getInputClassName('password')}
                  placeholder="Enter your password"
                  disabled={isSubmitting || isLockedOut}
                />
                <LockClosedIcon className="w-5 h-5 text-gray-400 absolute top-2.5 left-3 pointer-events-none" />
                <button
                  type="button"
                  className="absolute top-2.5 right-3 text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600 transition-colors duration-200"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  disabled={isSubmitting || isLockedOut}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="w-5 h-5" />
                  ) : (
                    <EyeIcon className="w-5 h-5" />
                  )}
                </button>
              </div>
              {renderError('password')}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="rememberMe"
                  name="rememberMe"
                  type="checkbox"
                  checked={formData.rememberMe}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded transition-colors duration-200"
                  disabled={isSubmitting || isLockedOut}
                />
                <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-700 cursor-pointer">
                  Remember me
                </label>
              </div>

              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-sm font-medium text-blue-600 hover:text-blue-500 focus:outline-none focus:underline transition-colors duration-200"
                disabled={isSubmitting}
              >
                Forgot password?
              </button>
            </div>

            <div>
              <Button
                type="submit"
                disabled={isSubmitting || isLockedOut}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                aria-label={isSubmitting ? 'Signing in...' : 'Sign in to your account'}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75" />
                    </svg>
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Having trouble signing in?{' '}
              <Link 
                href="/contact" 
                className="text-blue-600 hover:text-blue-500 focus:outline-none focus:underline transition-colors duration-200"
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