'use client';
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { User, type AuthError } from '@supabase/supabase-js';
import { UserProfile, UserRole, CompanyRole } from '@/types';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';

const getCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
};

const formatPhoneToE164 = (phone?: string): string => {
  if (!phone) return '';
  let p = phone.trim().replace(/[\s\-()]/g, '');
  if (p.startsWith('00'))  p = '+' + p.slice(2);
  if (p.startsWith('+'))   return '+' + p.replace(/[^\d]/g, '');
  if (p.startsWith('0'))   return '+265' + p.replace(/^0+/, '');
  const digits = p.replace(/[^\d]/g, '');
  if (digits.length >= 7 && digits.length <= 10) return '+265' + digits;
  return '+' + digits;
};

const COMPANY_ROLES: CompanyRole[] = ['company_admin', 'operator', 'conductor'];

const splitFullName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ') || firstName;
  return { firstName, lastName };
};

const _isCompanyRole = (role?: UserRole): role is CompanyRole =>
  COMPANY_ROLES.includes(role as CompanyRole);

interface AuthContextType {
  user: (User & { uid: string; emailVerified: boolean; getIdToken: () => Promise<string> }) | null;
  userProfile: UserProfile | null;
  setUserProfile: (profile: UserProfile | null) => void;
  signInWithGoogle: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    profile: { fullName: string; phone?: string }
  ) => Promise<void>;
  updateUserProfile: (profile: UpdateProfilePayload) => Promise<void>;
  signOut: () => Promise<void>;
  loading: boolean;
  refreshUserProfile: (uid?: string) => Promise<void>;
}

interface UpdateProfilePayload {
  firstName: string;
  lastName: string;
  phone: string;
  nationalId?: string;
  sex?: string;
  currentAddress?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const supabase = createClient();

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<(User & { uid: string; emailVerified: boolean; getIdToken: () => Promise<string> }) | null>(null);
  const [userProfile,   setUserProfile]   = useState<UserProfile | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  const router   = useRouter();
  const pathname = usePathname();

  // ─── Profile management ───────────────────────────────────────────────────

  const refreshUserProfile = useCallback(async (uid?: string, sessionUser?: any) => {
    const targetUid = uid ?? user?.id;
    if (!targetUid) return;

    // Industry Standard: Prevent redundant fetching if profile is already loaded and fresh
    if (userProfile && userProfile.id === targetUid && !uid) {
      return;
    }

    // Use sessionUser metadata if provided (from onAuthStateChange), otherwise fall back to state
    const meta = sessionUser?.user_metadata ?? user?.user_metadata;
    const metaEmail = sessionUser?.email ?? user?.email;
    const metaEmailConfirmed = sessionUser?.email_confirmed_at ?? user?.email_confirmed_at;

    try {
      // Add timeout to prevent indefinite waiting (increased to 30s for cold starts)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch('/api/auth/profile', { 
        signal: controller.signal,
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const { data } = await response.json();
        if (data) {
          setUserProfile(data as UserProfile);

          // ── Auto-activate team members on first sign-in (non-blocking) ──
          const isTeamRole = ['operator', 'conductor'].includes(data.role);
          const needsActivation = isTeamRole && data.invitationSent && (!data.isActive || !data.setupCompleted);

          if (needsActivation) {
            // Fire and forget - don't wait for activation
            fetch('/api/auth/profile', {
              method: 'PATCH',
              headers: { 
                'Content-Type': 'application/json',
                'x-csrf-token': getCookie('__csrf_token') || ''
              },
              body: JSON.stringify({
                isActive: true,
                setupCompleted: true,
                passwordSet: true,
              }),
            }).then(async (res) => {
              if (res.ok) {
                const { data: updatedData } = await res.json();
                if (updatedData) setUserProfile(updatedData as UserProfile);
              }
            }).catch((err) => console.error('[AuthContext] Auto-activate failed:', err));
          }

          // Check if we should update missing name or phone from user metadata (non-blocking)
          const needsMetadataSync = (!data.firstName || !data.phone) && 
                                    (meta?.first_name || meta?.phone);
          if (needsMetadataSync) {
            fetch('/api/auth/profile', {
              method: 'PATCH',
              headers: { 
                'Content-Type': 'application/json',
                'x-csrf-token': getCookie('__csrf_token') || ''
              },
              body: JSON.stringify({
                firstName: data.firstName || meta?.first_name || '',
                lastName: data.lastName || meta?.last_name || '',
                phone: data.phone || meta?.phone || '',
              }),
            }).then(async (res) => {
              if (res.ok) {
                const { data: updatedData } = await res.json();
                if (updatedData) setUserProfile(updatedData as UserProfile);
              }
            }).catch((err) => console.error('[AuthContext] Metadata sync failed:', err));
          }
        } else {
          // Initialize profile if not exists (non-blocking)
          const metaFirstName = meta?.first_name || '';
          const metaLastName = meta?.last_name || '';
          const metaPhone = meta?.phone || '';

          fetch('/api/auth/profile', {
            method: 'PATCH',
            headers: { 
              'Content-Type': 'application/json',
              'x-csrf-token': getCookie('__csrf_token') || ''
            },
            body: JSON.stringify({
              email: metaEmail || '',
              firstName: metaFirstName,
              lastName: metaLastName,
              phone: metaPhone,
              role: 'customer',
              isActive: true,
              emailVerified: metaEmailConfirmed ? true : false,
              setupCompleted: false,
            }),
          }).then(async (res) => {
            if (res.ok) {
              const { data: newData } = await res.json();
              if (newData) setUserProfile(newData as UserProfile);
            }
          }).catch((err) => console.error('[AuthContext] Profile init failed:', err));
        }
      }
    } catch (error: any) {
      // Only log if it's not a timeout/abort
      if (error.name !== 'AbortError') {
        console.error('[AuthContext] refreshUserProfile failed:', error);
      }
    }
  }, [user?.id, user?.email, user?.email_confirmed_at]);

  // ─── Auth state listener ──────────────────────────────────────────────────

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const augmentedUser = {
          ...session.user,
          uid: session.user.id,
          emailVerified: !!session.user.email_confirmed_at,
          getIdToken: async () => session.access_token,
        };
        setUser(augmentedUser);
        // Set loading to false immediately to allow redirects, then fetch profile in background
        setLoading(false);
        setIsInitialized(true);

        // If the user clicked a password recovery link, redirect to the reset page
        if (event === 'PASSWORD_RECOVERY') {
          router.push('/reset-password');
          return;
        }

        // Refresh profile without blocking - pass session.user so metadata is available immediately
        refreshUserProfile(session.user.id, session.user);
      } else {
        setUser(null);
        setUserProfile(null);
        setLoading(false);
        setIsInitialized(true);
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Route guard ──────────────────────────────────────────────────────────

  useEffect(() => {
    // Only run after auth is initialized
    if (!isInitialized) return;

    const publicRoutes = [
      '/login', '/register', '/', '/about', '/contact',
      '/forgot-password', '/reset-password', '/verify-email',
      '/company/setup', '/company/conductor/setup', '/company/operator/signup',
      '/search', '/schedules'
    ];
    const isPublicRoute = publicRoutes.includes(pathname) || pathname.startsWith('/bus/');

    // Skip setup page check if needed or implement same as before
    const isSetupPage = false; // logic would go here if needed

    if (!user && !isSetupPage && !isPublicRoute) {
      const currentPath = typeof window !== 'undefined' ? pathname + window.location.search : pathname;
      router.push(`/login?redirect=${encodeURIComponent(currentPath)}`);
      return;
    }

    // If user exists, begin immediate redirects while profile loads in background
    if (user) {
      const emailVerified = !!user.email_confirmed_at;
      const isSuperAdmin  = userProfile?.role === 'superadmin';

      if (!emailVerified && !isPublicRoute && !isSuperAdmin) {
        router.push('/verify-email');
        return;
      }

      // Only check these routes if we have the profile (it may still be loading)
      if (userProfile) {
        if (emailVerified && pathname === '/verify-email') {
          redirectToDashboard(userProfile);
          return;
        }

        if (['/login', '/register'].includes(pathname)) {
          redirectToDashboard(userProfile);
          return;
        }
      }
    }
  }, [user, userProfile, isInitialized, router, pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const redirectToDashboard = useCallback((profile: UserProfile) => {
    // Check for redirect parameter in URL
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const redirect = searchParams.get('redirect');
      if (redirect && redirect.startsWith('/')) {
        router.push(redirect);
        return;
      }
    }

    switch (profile.role) {
      case 'superadmin':
        router.push('/admin');
        break;
      case 'company_admin':
        router.push(
          profile.companyId
            ? `/company/admin?companyId=${profile.companyId}`
            : '/company/setup'
        );
        break;
      case 'operator':
        if (profile.companyId) {
          router.push(`/company/operator/dashboard?companyId=${profile.companyId}`);
        } else {
          router.push('/login');
        }
        break;
      case 'conductor':
        if (profile.companyId) {
          router.push('/company/conductor/dashboard');
        } else {
          router.push('/login');
        }
        break;
      case 'customer':
        router.push('/');
        break;
      default:
        router.push('/');
    }
  }, [router]);

  // ─── Google Sign In ───────────────────────────────────────────────────────

  const signInWithGoogle = async (): Promise<void> => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Ensure this URL is added to your Supabase Redirect URLs
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    });
    if (error) throw new Error(error.message);
  };

  // ─── signIn ───────────────────────────────────────────────────────────────

  const signIn = async (email: string, password: string): Promise<void> => {
    if (!email?.trim() || !password?.trim()) {
      throw new Error('Email and password are required');
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      const messages: Record<string, string> = {
        'Invalid login credentials': 'Invalid email or password.',
        'Email not confirmed':        'Please verify your email address before signing in.',
      };
      throw new Error(messages[error.message] || error.message);
    }
  };

  // ─── signUp ───────────────────────────────────────────────────────────────

  const signUp = async (
    email: string,
    password: string,
    profile: { fullName: string; phone?: string }
  ): Promise<void> => {
    if (!email?.trim() || !password?.trim()) {
      throw new Error('Email and password are required');
    }
    if (!profile.fullName?.trim()) {
      throw new Error('Full name is required');
    }

    const { firstName, lastName } = splitFullName(profile.fullName);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/verify-email?mode=verified`,
        data: {
          first_name: firstName,
          last_name:  lastName,
          phone:      formatPhoneToE164(profile.phone),
        }
      }
    });

    if (error) {
      throw new Error(error.message);
    }

    if (data.user) {
      // Sync with Prisma (may return 401 if unauthenticated, which will fall back to sync on login)
      await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'x-csrf-token': getCookie('__csrf_token') || ''
        },
        body: JSON.stringify({
          email:          data.user.email,
          firstName,
          lastName,
          phone:          formatPhoneToE164(profile.phone),
          role:           'customer',
          isActive:       true,
          emailVerified:  false,
          setupCompleted: false,
        }),
      }).catch(err => console.warn('[AuthContext] Unauthenticated sync skipped during registration:', err));
    }
  };

  // ─── updateUserProfile ────────────────────────────────────────────────────

  const updateUserProfile = async (profile: UpdateProfilePayload): Promise<void> => {
    if (!user?.id) throw new Error('No authenticated user found');
    
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-csrf-token': getCookie('__csrf_token') || ''
        },
        body: JSON.stringify({
          firstName:      profile.firstName.trim(),
          lastName:       profile.lastName.trim(),
          phone:          formatPhoneToE164(profile.phone),
          setupCompleted: true,
          nationalId:     profile.nationalId,
          sex:            profile.sex,
          currentAddress: profile.currentAddress,
        }),
      });

      if (!response.ok) throw new Error('Failed to update profile');

      try {
        await refreshUserProfile();
      } catch (refreshError) {
        console.warn('[AuthContext] refreshUserProfile failed after profile update:', refreshError);
      }
    } catch (error: any) {
      throw new Error('Profile update failed. Please try again.');
    }
  };

  // ─── signOut ──────────────────────────────────────────────────────────────

  const signOutUser = async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
    setUser(null);
    setUserProfile(null);
    router.push('/login');
  };

  // ─── Context value ────────────────────────────────────────────────────────

  const contextValue: AuthContextType = {
    user,
    userProfile,
    setUserProfile,
    signInWithGoogle,
    signIn,
    signUp,
    updateUserProfile,
    signOut: signOutUser,
    loading,
    refreshUserProfile,
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};