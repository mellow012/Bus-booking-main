'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client'; // Adjust path to your browser client factory
import { Eye, EyeOff, Lock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

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
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-50 dark:bg-slate-900">
      <div className="sm:mx-auto w-full max-w-md">
        <h1 className="text-center text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white">
          TibhukeBus
        </h1>
        <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
          Secure Passenger & Operations Portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto w-full max-w-md">
        <div className="bg-white dark:bg-slate-800 py-8 px-4 shadow-md sm:rounded-xl sm:px-10 border border-slate-200/60 dark:border-slate-700/50">
          
          {success ? (
            /* ── SUCCESS VIEW ── */
            <div className="text-center py-4 space-y-3">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Password Updated!
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Your new security keys have been successfully applied. Redirecting you to the login screen...
              </p>
              <div className="pt-2">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600 mx-auto" />
              </div>
            </div>
          ) : (
            /* ── FORM VIEW ── */
            <form onSubmit={handleReset} className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Set new password
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Please choose a robust password to lock down your access rights.
                </p>
              </div>

              {/* Error Callout */}
              {errorMsg && (
                <div className="rounded-lg bg-rose-50 dark:bg-rose-950/30 p-3 flex gap-2 border border-rose-200/50 dark:border-rose-900/30">
                  <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div className="text-xs font-medium text-rose-800 dark:text-rose-300">
                    {errorMsg}
                  </div>
                </div>
              )}

              {/* Password Input Field */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  New Password
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting}
                    className="block w-full pl-10 pr-10 py-2.5 sm:text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-60"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password Input Field */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Confirm New Password
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isSubmitting}
                    className="block w-full pl-10 pr-3 py-2.5 sm:text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-60"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {/* Dynamic Helper Checklists */}
              <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200/40 dark:border-slate-700/30 space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <div className={`w-1.5 h-1.5 rounded-full ${hasMinLength ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                  <span className={hasMinLength ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}>
                    At least 6 characters long
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className={`w-1.5 h-1.5 rounded-full ${passwordsMatch ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                  <span className={passwordsMatch ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}>
                    Passwords match perfectly
                  </span>
                </div>
              </div>

              {/* Submit Trigger Action */}
              <button
                type="submit"
                disabled={!isFormValid || isSubmitting}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                  </span>
                ) : (
                  'Update Password'
                )}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}