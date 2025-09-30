'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAuth, confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { 
  LockClosedIcon,
  EyeIcon,
  EyeSlashIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';

// Types
interface FormErrors {
  password?: string;
  confirmPassword?: string;
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

// Validation functions
const validatePassword = (password: string): string => {
  if (!password) {
    return 'Password is required';
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Password must be less than ${MAX_PASSWORD_LENGTH} characters`;
  }
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    return 'Password must contain uppercase, lowercase, and a number';
  }
  return '';
};

const validateConfirmPassword = (password: string, confirmPassword: string): string => {
  if (!confirmPassword) {
    return 'Please confirm your password';
  }
  if (password !== confirmPassword) {
    return 'Passwords do not match';
  }
  return '';
};

const getErrorMessage = (error: any): string => {
  if (error?.code) {
    switch (error.code) {
      case 'auth/expired-action-code':
        return 'This password reset link has expired. Please request a new one.';
      case 'auth/invalid-action-code':
        return 'This password reset link is invalid. Please request a new one.';
      case 'auth/user-disabled':
        return 'This account has been disabled. Please contact support.';
      case 'auth/user-not-found':
        return 'No account found. The user may have been deleted.';
      case 'auth/weak-password':
        return 'Password is too weak. Please choose a stronger password.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection and try again.';
      default:
        return 'Failed to reset password. Please try again or contact support.';
    }
  }
  return error?.message || 'An unexpected error occurred. Please try again.';
};

export default function ResetPassword() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oobCode = searchParams.get('oobCode'); // Firebase action code
  
  // Form state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [errors, setErrors] = useState<FormErrors>({});
  const [success, setSuccess] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  
  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength | null>(null);

  // Verify reset code on mount
  useEffect(() => {
    const verifyCode = async () => {
      if (!oobCode) {
        setErrors({ general: 'Invalid or missing reset code. Please request a new password reset link.' });
        setIsVerifying(false);
        return;
      }

      try {
        const auth = getAuth();
        const userEmail = await verifyPasswordResetCode(auth, oobCode);
        setEmail(userEmail);
        setIsVerifying(false);
      } catch (error: any) {
        console.error('Code verification error:', error);
        setErrors({ general: getErrorMessage(error) });
        setIsVerifying(false);
      }
    };

    verifyCode();
  }, [oobCode]);

  // Update password strength when password changes
  useEffect(() => {
    if (password) {
      setPasswordStrength(checkPasswordStrength(password));
    } else {
      setPasswordStrength(null);
    }
  }, [password]);

  // Event handlers
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (errors.password) {
      const newErrors = { ...errors };
      delete newErrors.password;
      setErrors(newErrors);
    }
    if (errors.general) {
      const newErrors = { ...errors };
      delete newErrors.general;
      setErrors(newErrors);
    }
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value);
    if (errors.confirmPassword) {
      const newErrors = { ...errors };
      delete newErrors.confirmPassword;
      setErrors(newErrors);
    }
  };

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    
    if (field === 'password') {
      const error = validatePassword(password);
      if (error) {
        setErrors(prev => ({ ...prev, password: error }));
      }
    } else if (field === 'confirmPassword') {
      const error = validateConfirmPassword(password, confirmPassword);
      if (error) {
        setErrors(prev => ({ ...prev, confirmPassword: error }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mark all fields as touched
    setTouched({ password: true, confirmPassword: true });

    // Validate
    const passwordError = validatePassword(password);
    const confirmPasswordError = validateConfirmPassword(password, confirmPassword);
    
    if (passwordError || confirmPasswordError) {
      setErrors({
        password: passwordError,
        confirmPassword: confirmPasswordError,
      });
      return;
    }

    if (!oobCode) {
      setErrors({ general: 'Invalid reset code. Please request a new password reset link.' });
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const auth = getAuth();
      await confirmPasswordReset(auth, oobCode, password);
      setSuccess(true);
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push(`/login?email=${encodeURIComponent(email)}&reset=success`);
      }, 3000);
      
    } catch (error: any) {
      console.error('Password reset error:', error);
      setErrors({ general: getErrorMessage(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render helpers
  const getInputClassName = (field: 'password' | 'confirmPassword') => {
    const baseClass = "appearance-none block w-full px-3 py-2.5 pl-10 pr-10 border rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-200";
    const hasError = errors[field] && touched[field];
    
    if (hasError) {
      return `${baseClass} border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500`;
    }
    
    return `${baseClass} border-gray-300 focus:ring-blue-500 focus:border-blue-500`;
  };

  const renderPasswordStrength = () => {
    if (!passwordStrength || !password) return null;

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
    if (!confirmPassword || !touched.confirmPassword) return null;

    const isMatch = password === confirmPassword;
    
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

  // Loading state while verifying code
  if (isVerifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-blue-600 mx-auto" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
            <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75" />
          </svg>
          <p className="mt-4 text-gray-600">Verifying reset link...</p>
        </div>
      </div>
    );
  }

  // Error state for invalid/expired code
  if (errors.general && !oobCode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-lg">
              <ExclamationTriangleIcon className="w-10 h-10 text-white" />
            </div>
          </div>
          
          <h1 className="mt-6 text-center text-4xl font-extrabold text-gray-900 tracking-tight">
            Invalid Reset Link
          </h1>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-10 px-6 shadow-xl rounded-2xl sm:px-12">
            <div className="text-center space-y-4">
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-left">
                <p className="font-medium">{errors.general}</p>
              </div>

              <div className="pt-4 space-y-3">
                <Button
                  onClick={() => router.push('/forgot-password')}
                  className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
                >
                  Request New Reset Link
                </Button>

                <Link
                  href="/login"
                  className="block text-center text-sm text-blue-600 hover:text-blue-500 focus:outline-none focus:underline transition-colors duration-200"
                >
                  Back to Sign In
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
              <CheckCircleIcon className="w-10 h-10 text-white" />
            </div>
          </div>
          
          <h1 className="mt-6 text-center text-4xl font-extrabold text-gray-900 tracking-tight">
            Password Reset Successful
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            Your password has been updated
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-10 px-6 shadow-xl rounded-2xl sm:px-12">
            <div className="text-center space-y-4">
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                <CheckCircleIcon className="w-5 h-5 inline mr-2" />
                <span className="text-sm font-medium">
                  Your password has been successfully reset!
                </span>
              </div>

              <div className="text-sm text-gray-600 space-y-2">
                <p>You can now sign in with your new password.</p>
                <p className="text-xs">Redirecting you to the login page...</p>
              </div>

              <div className="pt-4">
                <Button
                  onClick={() => router.push('/login')}
                  className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
                >
                  Continue to Sign In
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main form view
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-3xl">B</span>
          </div>
        </div>
        
        {/* Header */}
        <h1 className="mt-6 text-center text-4xl font-extrabold text-gray-900 tracking-tight">
          Set New Password
        </h1>
        <p className="mt-2 text-center text-sm text-gray-600">
          {email && `for ${email}`}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-10 px-6 shadow-xl rounded-2xl sm:px-12">
          
          <form className="space-y-6" onSubmit={handleSubmit} noValidate>
            
            {/* General Error */}
            {errors.general && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start" role="alert">
                <ExclamationTriangleIcon className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Password Reset Failed</p>
                  <p className="text-sm mt-1">{errors.general}</p>
                </div>
              </div>
            )}

            {/* Password Requirements Info */}
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg">
              <p className="text-sm font-medium mb-2">Password Requirements:</p>
              <ul className="text-xs space-y-1 list-disc list-inside">
                <li>At least {MIN_PASSWORD_LENGTH} characters long</li>
                <li>Contains uppercase and lowercase letters</li>
                <li>Contains at least one number</li>
                <li>Contains at least one special character</li>
              </ul>
            </div>

            {/* New Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                <LockClosedIcon className="w-4 h-4 inline mr-1" />
                New Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  autoFocus
                  aria-invalid={errors.password && touched.password ? 'true' : 'false'}
                  aria-describedby={errors.password && touched.password ? 'password-error' : undefined}
                  value={password}
                  onChange={handlePasswordChange}
                  onBlur={() => handleBlur('password')}
                  className={getInputClassName('password')}
                  placeholder="Create a strong password"
                  disabled={isSubmitting}
                />
                <LockClosedIcon className="w-5 h-5 text-gray-400 absolute top-2.5 left-3 pointer-events-none" />
                <button
                  type="button"
                  className="absolute top-2.5 right-3 text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600 transition-colors duration-200"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  disabled={isSubmitting}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="w-5 h-5" />
                  ) : (
                    <EyeIcon className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.password && touched.password && (
                <div className="mt-1 flex items-center text-sm text-red-600" role="alert" id="password-error">
                  <ExclamationTriangleIcon className="w-4 h-4 mr-1 flex-shrink-0" />
                  {errors.password}
                </div>
              )}
              {renderPasswordStrength()}
            </div>

            {/* Confirm Password Field */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                <LockClosedIcon className="w-4 h-4 inline mr-1" />
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  aria-invalid={errors.confirmPassword && touched.confirmPassword ? 'true' : 'false'}
                  aria-describedby={errors.confirmPassword && touched.confirmPassword ? 'confirmPassword-error' : undefined}
                  value={confirmPassword}
                  onChange={handleConfirmPasswordChange}
                  onBlur={() => handleBlur('confirmPassword')}
                  className={getInputClassName('confirmPassword')}
                  placeholder="Re-enter your new password"
                  disabled={isSubmitting}
                />
                <LockClosedIcon className="w-5 h-5 text-gray-400 absolute top-2.5 left-3 pointer-events-none" />
                <button
                  type="button"
                  className="absolute top-2.5 right-3 text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600 transition-colors duration-200"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  disabled={isSubmitting}
                >
                  {showConfirmPassword ? (
                    <EyeSlashIcon className="w-5 h-5" />
                  ) : (
                    <EyeIcon className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && touched.confirmPassword && (
                <div className="mt-1 flex items-center text-sm text-red-600" role="alert" id="confirmPassword-error">
                  <ExclamationTriangleIcon className="w-4 h-4 mr-1 flex-shrink-0" />
                  {errors.confirmPassword}
                </div>
              )}
              {renderPasswordMatch()}
            </div>

            {/* Submit Button */}
            <div>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                aria-label={isSubmitting ? 'Resetting password...' : 'Reset password'}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75" />
                    </svg>
                    Resetting Password...
                  </>
                ) : (
                  <>
                    <LockClosedIcon className="w-5 h-5 mr-2" />
                    Reset Password
                  </>
                )}
              </Button>
            </div>

            {/* Back to Login */}
            <div className="text-center">
              <Link 
                href="/login"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 focus:outline-none focus:underline transition-colors duration-200"
              >
                Back to Sign In
              </Link>
            </div>
          </form>

          {/* Additional Help */}
          <div className="mt-6 pt-6 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-500">
              Having trouble?{' '}
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