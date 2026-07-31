'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { createClient } from '@/utils/supabase/client';
import { markPasswordSet } from '@/lib/actions/user.actions';
import {
  EnvelopeIcon,
  LockClosedIcon,
  EyeIcon,
  EyeSlashIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  BuildingOfficeIcon,
  UserIcon,
} from '@heroicons/react/24/outline';

interface SetupInfo {
  id: string;
  name: string;
  email: string;
  targetUserId: string;
  type: 'company' | 'operator' | 'conductor';
  companyId?: string;
}

function CompanySetupContent() {
  const router = useRouter();
  const { refreshUserProfile } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [setupData, setSetupData] = useState<SetupInfo | null>(null);
  const [tokenHashState, setTokenHashState] = useState<string | null>(null);
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [errors, setErrors] = useState<{
    password?: string;
    confirmPassword?: string;
    general?: string;
  }>({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('token_hash') || params.get('token');
    const continueUrl = params.get('continueUrl');
    
    if (code) setTokenHashState(code);

    let idToFetch = params.get('companyId') || params.get('operatorId') || params.get('conductorId') || null;
    let detectedType: 'company' | 'operator' | 'conductor' = 
      params.get('conductorId') ? 'conductor' : params.get('operatorId') ? 'operator' : 'company';

    if (!idToFetch && continueUrl) {
      try {
        const decodedUrl = new URL(continueUrl);
        const opId = decodedUrl.searchParams?.get('operatorId');
        const compId = decodedUrl.searchParams?.get('companyId');
        const condId = decodedUrl.searchParams?.get('conductorId');
        idToFetch = condId || opId || compId || null;
        detectedType = condId ? 'conductor' : opId ? 'operator' : 'company';
      } catch (e) {
        console.error("Error parsing continueUrl:", e);
      }
    }

    if (idToFetch) {
      fetchSetupDetails(idToFetch, detectedType);
    } else if (!code) {
      setErrors({ general: 'Invalid setup link. Please check your email.' });
    }
  }, []);

  const fetchSetupDetails = async (id: string, type: 'company' | 'operator' | 'conductor') => {
    setLoading(true);
    try {
      const response = await fetch(`/api/auth/setup-details?id=${id}&type=${type}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        setErrors({ general: 'Account record not found.' });
        setLoading(false);
        return;
      }

      const data = await response.json();
      setSetupData({
        id: data.id,
        name: data.name || data.companyName || 'New User',
        email: data.email,
        targetUserId: data.targetUserId,
        type: type,
        companyId: data.companyId
      });
      
      // Verify token hash if present
      const code = new URLSearchParams(window.location.search).get('token_hash') || new URLSearchParams(window.location.search).get('token');
      if (code && data.email) {
        try {
          const verifyResponse = await fetch('/api/auth/verify-reset-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: code })
          });
          if (!verifyResponse.ok) {
             const vData = await verifyResponse.json();
             setErrors({ general: vData.message || 'Setup link is invalid or has expired.' });
          }
        } catch (err) {
          console.error("Token verification check failed", err);
        }
      }
    } catch {
      setErrors({ general: 'Failed to load details. Please refresh.' });
    } finally {
      setLoading(false);
    }
  };

  // Password criteria flags
  const hasMinLength = password.length >= 6;
  const hasUppercase = /(?=.*[A-Z])/.test(password);
  const hasLowercase = /(?=.*[a-z])/.test(password);
  const hasNumber    = /(?=.*\d)/.test(password);
  const passwordsMatch = password && password === confirmPassword;
  const isFormValid  = hasMinLength && hasUppercase && hasLowercase && hasNumber && passwordsMatch;

  const validatePassword = (pwd: string): string | null => {
    if (!pwd) return 'Password is required';
    if (pwd.length < 6) return 'Password must be at least 6 characters';
    if (!/(?=.*[a-z])/.test(pwd)) return 'Must include a lowercase letter';
    if (!/(?=.*[A-Z])/.test(pwd)) return 'Must include an uppercase letter';
    if (!/(?=.*\d)/.test(pwd)) return 'Must include a number';
    return null;
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tokenHashState || !setupData) {
      setErrors({ general: 'Setup tokens missing. Please refresh.' });
      return;
    }

    const passwordError = validatePassword(password);
    const confirmError = password !== confirmPassword ? 'Passwords do not match' : null;

    if (passwordError || confirmError) {
      setErrors({ password: passwordError || undefined, confirmPassword: confirmError || undefined });
      return;
    }

    setLoading(true);
    try {
      // Update password in Supabase Auth
      const supabase = createClient();
      const { error: authError } = await supabase.auth.updateUser({ password });
      
      if (authError) {
        throw authError;
      }

      // Mark passwordSet as true in Prisma
      await markPasswordSet(setupData.email).catch((err) =>
        console.error('[setup] Failed to sync Prisma passwordSet flag:', err)
      );

      await refreshUserProfile();
      setIsSuccess(true);
      
      // Dynamic Redirect after success animation
      setTimeout(() => {
        if (setupData.type === 'operator') {
          router.push(`/company/operator/dashboard?companyId=${setupData.companyId}`);
        } else if (setupData.type === 'conductor') {
          router.push(`/company/conductor/dashboard?companyId=${setupData.companyId}`);
        } else {
          router.push('/company/admin?setup=pending');
        }
      }, 2500);

    } catch (error: any) {
      console.error('Setup error:', error);
      setErrors({ general: error.message || 'Failed to set password.' });
    } finally {
      setLoading(false);
    }
  };

  const resendSetupEmail = async () => {
    if (!setupData) return;
    try {
      const response = await fetch('/api/auth/resend-setup-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: setupData.email,
          type: setupData.type,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to resend email');
      }

      setErrors({ general: 'A new setup link has been sent to your email.' });
    } catch {
      setErrors({ general: 'Failed to resend email.' });
    }
  };

  if (!setupData && !errors.general && loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-brand-700 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-600">Loading setup details…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      
      {/* Brand Logo & Header */}
      <div className="sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center pb-2">
          <div className="flex items-center justify-center transition-transform duration-300 hover:scale-105">
            <Image
              src="/tibhukebus_logo_transparent.png"
              alt="TibhukeBus Logo"
              width={192}
              height={80}
              className="w-48 h-20 object-contain drop-shadow-xl brightness-[1.02] contrast-[1.05]"
              priority
            />
          </div>
        </div>

        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
          Set Your Password
        </h1>
        <p className="mt-1.5 text-sm text-gray-600">
          Welcome, <span className="font-bold text-gray-900">{setupData?.name || 'User'}</span>! Please secure your account.
        </p>

        {/* Account Role Badge */}
        {setupData?.type && (
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-sm transition-all"
            style={{
              backgroundColor: setupData.type === 'operator' ? '#ecfeff' : setupData.type === 'conductor' ? '#fffbeb' : '#f0fdf4',
              borderColor: setupData.type === 'operator' ? '#a5f3fc' : setupData.type === 'conductor' ? '#fde68a' : '#bbf7d0',
              color: setupData.type === 'operator' ? '#0891b2' : setupData.type === 'conductor' ? '#d97706' : '#16a34a',
            }}>
            {setupData.type === 'company' ? (
              <BuildingOfficeIcon className="w-3.5 h-3.5" />
            ) : (
              <UserIcon className="w-3.5 h-3.5" />
            )}
            <span>Setting up {setupData.type === 'operator' ? 'Operator' : setupData.type === 'conductor' ? 'Conductor' : 'Company Admin'} Account</span>
          </div>
        )}
      </div>

      {/* Main Card Container */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-10 px-6 shadow-xl rounded-2xl sm:px-10 border border-gray-100">
          
          {isSuccess ? (
            <div className="text-center py-6 space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500 shadow-lg text-white mx-auto">
                <CheckCircleIcon className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">
                Setup Complete!
              </h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Your credentials have been configured. Redirecting you to your portal dashboard now…
              </p>
              <div className="pt-4">
                <div className="w-8 h-8 border-4 border-brand-700 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            </div>
          ) : (
            <form onSubmit={handleSetPassword} className="space-y-6">

              {/* Error Alert Callout */}
              {errors.general && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start" role="alert">
                  <ExclamationTriangleIcon className="w-5 h-5 mr-2.5 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs">
                    <p className="font-bold text-sm">Setup Notice</p>
                    <p className="mt-0.5 leading-snug">{errors.general}</p>
                    {errors.general.includes('expired') && (
                      <button
                        type="button"
                        onClick={resendSetupEmail}
                        className="mt-2 text-xs font-bold text-brand-700 hover:underline"
                      >
                        Request new setup link
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Disabled Email Field */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  Account Email
                </label>
                <div className="relative">
                  <input
                    type="email"
                    disabled
                    value={setupData?.email || ''}
                    className="appearance-none block w-full px-3.5 py-2.5 pl-10 border border-gray-200 rounded-xl bg-gray-50 text-gray-600 text-sm font-medium cursor-not-allowed"
                  />
                  <EnvelopeIcon className="w-5 h-5 text-gray-400 absolute top-2.5 left-3 pointer-events-none" />
                </div>
              </div>

              {/* New Password Field */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors(prev => ({ ...prev, password: undefined }));
                    }}
                    disabled={loading}
                    placeholder="••••••••"
                    className={`appearance-none block w-full px-3.5 py-2.5 pl-10 pr-10 border rounded-xl placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-700 focus:border-brand-700 transition-colors duration-200 ${
                      errors.password ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'
                    }`}
                  />
                  <LockClosedIcon className="w-5 h-5 text-gray-400 absolute top-2.5 left-3 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute top-2.5 right-3 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
                  >
                    {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && (
                  <div className="mt-1 flex items-center text-xs text-red-600">
                    <ExclamationTriangleIcon className="w-4 h-4 mr-1 flex-shrink-0" />
                    {errors.password}
                  </div>
                )}
              </div>

              {/* Confirm Password Field */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (errors.confirmPassword) setErrors(prev => ({ ...prev, confirmPassword: undefined }));
                    }}
                    disabled={loading}
                    placeholder="••••••••"
                    className={`appearance-none block w-full px-3.5 py-2.5 pl-10 pr-10 border rounded-xl placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-700 focus:border-brand-700 transition-colors duration-200 ${
                      errors.confirmPassword ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'
                    }`}
                  />
                  <LockClosedIcon className="w-5 h-5 text-gray-400 absolute top-2.5 left-3 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute top-2.5 right-3 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
                  >
                    {showConfirmPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                  </button>
                </div>
                {confirmPassword && (
                  <div className={`mt-1.5 flex items-center text-xs font-medium ${passwordsMatch ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {passwordsMatch ? (
                      <>
                        <CheckCircleIcon className="w-4 h-4 mr-1 flex-shrink-0" />
                        Passwords match
                      </>
                    ) : (
                      <>
                        <ExclamationTriangleIcon className="w-4 h-4 mr-1 flex-shrink-0" />
                        Passwords do not match
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Password Requirement Guidance Card */}
              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">Password Requirements</p>
                <div className="flex items-center gap-2 text-xs">
                  <div className={`w-1.5 h-1.5 rounded-full ${hasMinLength ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                  <span className={hasMinLength ? 'text-emerald-700 font-semibold' : 'text-gray-500'}>
                    At least 6 characters long
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className={`w-1.5 h-1.5 rounded-full ${hasUppercase && hasLowercase && hasNumber ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                  <span className={hasUppercase && hasLowercase && hasNumber ? 'text-emerald-700 font-semibold' : 'text-gray-500'}>
                    Must include uppercase, lowercase, and number
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={!isFormValid || loading}
                className="w-full h-12 bg-coral-500 hover:bg-coral-600 text-white rounded-xl text-base font-bold transition-all duration-200 shadow-lg shadow-coral-500/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Completing Setup…</span>
                  </>
                ) : (
                  <>
                    <LockClosedIcon className="w-5 h-5" />
                    <span>Complete Setup</span>
                  </>
                )}
              </Button>
            </form>
          )}

          {/* Footer Link */}
          <div className="mt-8 text-center pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Already completed setup?{' '}
              <Link href="/login" className="text-brand-700 font-bold hover:underline">
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CompanySetup() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-brand-700 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <CompanySetupContent />
    </Suspense>
  );
}
