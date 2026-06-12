'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
// use intrinsic image for logo to render at natural size
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { 
  LockClosedIcon, 
  EyeIcon, 
  EyeSlashIcon, 
  ExclamationTriangleIcon,
  CheckCircleIcon 
} from '@heroicons/react/24/outline';

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Status feedback states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Client-side strength criteria
  const hasMinLength = password.length >= 6;
  const passwordsMatch = password && password === confirmPassword;
  const isFormValid = hasMinLength && passwordsMatch;

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // 💡 Supabase automatically reads the recovery session cookies set by your auth callback router
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        throw error;
      }

      setSuccess(true);
      
      // Give them a moment to read the beautiful success screen before bouncing to login
      setTimeout(() => {
        router.push('/login?message=Your password has been successfully updated.');
      }, 3000);

    } catch (err: any) {
      console.error('[ResetPage] Update password failed:', err.message);
      setErrorMsg(err.message || 'Failed to update password. Please try requesting another link.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Logo consistent with Register page */}
        <div className="flex justify-center">
          <div className="flex items-center justify-center transition-transform duration-300 hover:scale-105">
            <img
              src="/tibhukebus_logo_transparent.png"
              alt="TibhukeBus Logo"
              className="max-w-full h-auto object-contain"
            />
          </div>
        </div>
        
        <h1 className="mt-2 text-center text-4xl font-extrabold text-gray-900 tracking-tight">
          Secure your account
        </h1>
        <p className="mt-2 text-center text-sm text-gray-600">
          Secure Passenger & Operations Portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-10 px-6 shadow-xl rounded-2xl sm:px-12">
          
          {success ? (
            <div className="text-center py-6 space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500 shadow-lg text-white">
                <CheckCircleIcon className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">
                Password Updated!
              </h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Your new credentials have been successfully applied. We are redirecting you to the sign-in screen now.
              </p>
              <div className="pt-4">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-6">
              {/* Error Callout matching App pattern */}
              {errorMsg && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start" role="alert">
                  <ExclamationTriangleIcon className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Update Failed</p>
                    <p className="text-xs mt-1">{errorMsg}</p>
                  </div>
                </div>
              )}

              {/* Password Input Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <LockClosedIcon className="w-4 h-4 inline mr-1" />
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting}
                    className="appearance-none block w-full px-3 py-2.5 pl-10 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 disabled:bg-gray-50"
                    placeholder="••••••••"
                  />
                  <LockClosedIcon className="w-5 h-5 text-gray-400 absolute top-2.5 left-3 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute top-2.5 right-3 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors duration-200"
                  >
                    {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password Input Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <LockClosedIcon className="w-4 h-4 inline mr-1" />
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isSubmitting}
                    className="appearance-none block w-full px-3 py-2.5 pl-10 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 disabled:bg-gray-50"
                    placeholder="••••••••"
                  />
                  <LockClosedIcon className="w-5 h-5 text-gray-400 absolute top-2.5 left-3 pointer-events-none" />
                </div>
                {password && confirmPassword && (
                  <div className={`mt-1 flex items-center text-xs ${password === confirmPassword ? 'text-green-600' : 'text-red-600'}`}>
                    {password === confirmPassword ? (
                      <>
                        <CheckCircleIcon className="w-4 h-4 mr-1" />
                        Passwords match
                      </>
                    ) : (
                      <>
                        <ExclamationTriangleIcon className="w-4 h-4 mr-1" />
                        Passwords do not match
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <div className={`w-1.5 h-1.5 rounded-full ${hasMinLength ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className={hasMinLength ? 'text-green-700 font-medium' : 'text-gray-500'}>
                    At least 6 characters long
                  </span>
                </div>
              </div>

              <Button
                type="submit"
                disabled={!isFormValid || isSubmitting}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Updating Password...
                  </>
                ) : (
                  'Update Password'
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}