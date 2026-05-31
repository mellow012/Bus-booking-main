'use client';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';
import { UserProfile, CompanyRole } from '@/types';
import { useRouter, usePathname } from 'next/navigation';

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

const splitFullName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ') || firstName;
  return { firstName, lastName };
};

interface AuthContextType {
  user: (User & { uid: string; emailVerified: boolean; getIdToken: () => Promise<string> }) | null;
  userProfile: UserProfile | null; // 👈 Exposed user profile instance
  setUserProfile: (profile: UserProfile | null) => void;
  signInWithGoogle: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, profile: { fullName: string; phone?: string }) => Promise<void>;
  updateUserProfile: (profile: UpdateProfilePayload) => Promise<void>;
  signOut: () => Promise<void>;
  loading: boolean;
  refreshUserProfile: (uid?: string, sessionUser?: any) => Promise<void>;
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
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null); // 👈 Profile local react state tracking
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  const router = useRouter();
  const pathname = usePathname();

  // Redirect routing rules strictly driven by userProfile configuration parameters
  const redirectToDashboard = useCallback((profile: UserProfile) => {
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
        router.push(profile.companyId ? `/company/admin?companyId=${profile.companyId}` : '/company/setup');
        break;
      case 'operator':
        router.push(profile.companyId ? `/company/operator/dashboard?companyId=${profile.companyId}` : '/login');
        break;
      case 'conductor':
        router.push(profile.companyId ? '/company/conductor/dashboard' : '/login');
        break;
      case 'customer': 
        router.push('/'); 
        break;
      default: 
        router.push('/');
    }
  }, [router]);

  // Network engine query layer updating userProfile fields from api data context pipelines
  const refreshUserProfile = useCallback(async (uid?: string, sessionUser?: any) => {
    const targetUid = uid ?? user?.id;
    if (!targetUid) return;

    const meta = sessionUser?.user_metadata ?? user?.user_metadata;
    const metaEmail = sessionUser?.email ?? user?.email;
    const metaEmailConfirmed = sessionUser?.email_confirmed_at ?? user?.email_confirmed_at;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch('/api/auth/profile', {
        signal: controller.signal,
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type');
      if (!response.ok || !contentType || !contentType.includes('application/json')) {
        console.warn('[AuthContext] Profile fetch failed or returned non-JSON:', response.status);
        return;
      }

      const { data } = await response.json();
      if (data) {
        setUserProfile(data as UserProfile);

        const isTeamRole = ['operator', 'conductor'].includes(data.role);
        const needsActivation = isTeamRole && data.invitationSent && (!data.isActive || !data.setupCompleted);
        if (needsActivation) {
          fetch('/api/auth/profile', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCookie('__csrf_token') || '' },
            body: JSON.stringify({ isActive: true, setupCompleted: true, passwordSet: true }),
          })
            .then(async (res) => {
              const cType = res.headers.get('content-type');
              if (res.ok && cType?.includes('application/json')) {
                const { data: updatedData } = await res.json();
                if (updatedData) setUserProfile(updatedData as UserProfile);
              }
            })
            .catch((err) => console.error('[AuthContext] Auto-activate failed:', err));
        }

        const needsMetadataSync = (!data.firstName || !data.phone) && (meta?.first_name || meta?.phone);
        if (needsMetadataSync) {
          fetch('/api/auth/profile', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCookie('__csrf_token') || '' },
            body: JSON.stringify({
              firstName: data.firstName || meta?.first_name || '',
              lastName: data.lastName || meta?.last_name || '',
              phone: data.phone || meta?.phone || '',
            }),
          })
            .then(async (res) => {
              const cType = res.headers.get('content-type');
              if (res.ok && cType?.includes('application/json')) {
                const { data: updatedData } = await res.json();
                if (updatedData) setUserProfile(updatedData as UserProfile);
              }
            })
            .catch((err) => console.error('[AuthContext] Metadata sync failed:', err));
        }
      } else {
        // Automatically initialize profile layout fallback configurations if user entry doesn't exist
        fetch('/api/auth/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCookie('__csrf_token') || '' },
          body: JSON.stringify({
            email: metaEmail || '',
            firstName: meta?.first_name || '',
            lastName: meta?.last_name || '',
            phone: meta?.phone || '',
            role: 'customer',
            isActive: true,
            emailVerified: !!metaEmailConfirmed,
            setupCompleted: false,
          }),
        })
          .then(async (res) => {
            const cType = res.headers.get('content-type');
            if (res.ok && cType?.includes('application/json')) {
              const { data: newData } = await res.json();
              if (newData) setUserProfile(newData as UserProfile);
            }
          })
          .catch((err) => console.error('[AuthContext] Profile init failed:', err));
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('[AuthContext] refreshUserProfile failed:', error);
      }
    }
  }, [user?.id, user?.email, user?.email_confirmed_at]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        const augmentedUser = {
          ...session.user,
          uid: session.user.id,
          emailVerified: !!session.user.email_confirmed_at,
          getIdToken: async () => session.access_token,
        };
        setUser(augmentedUser);
        setLoading(false);
        setIsInitialized(true);

        const isRecovery = event === 'PASSWORD_RECOVERY' || 
                          pathname === '/reset-password' || 
                          pathname === '/auth/callback' || 
                          (typeof window !== 'undefined' && (
                            window.location.href.includes('type=recovery') || 
                            window.location.href.includes('access_token=') ||
                            window.location.hash.includes('recovery') ||
                            window.location.search.includes('type=recovery')
                          ));

        if (isRecovery) return;

        refreshUserProfile(session.user.id, session.user);
      } else {
        setUser(null);
        setUserProfile(null);
        setLoading(false);
        setIsInitialized(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [pathname, refreshUserProfile]);

  useEffect(() => {
    if (!isInitialized) return;

    const publicRoutes = [
      '/login', '/register', '/', '/about', '/contact',
      '/forgot-password', '/reset-password', '/verify-email',
      '/auth/callback',
      '/company/setup', '/company/conductor/setup', '/company/operator/signup',
      '/search', '/schedules',
    ];
    const isPublicRoute = publicRoutes.includes(pathname) || pathname.startsWith('/bus/');

    const isRecoveryFlow = pathname === '/reset-password' || 
                          pathname === '/auth/callback' ||
                          pathname === '/forgot-password' ||
                          pathname === '/verify-email' ||
                          (typeof window !== 'undefined' && (
                            window.location.href.includes('type=recovery') || 
                            window.location.href.includes('access_token=') ||
                            window.location.hash.includes('recovery') ||
                            window.location.search.includes('type=recovery')
                          ));
    if (isRecoveryFlow) return;

    if (!user && !isPublicRoute) {
      const currentPath = typeof window !== 'undefined' ? pathname + window.location.search : pathname;
      router.push(`/login?redirect=${encodeURIComponent(currentPath)}`);
      return;
    }

    if (user) {
      const emailVerified = !!user.email_confirmed_at;
      const isSuperAdmin = userProfile?.role === 'superadmin';

      if (!emailVerified && !isPublicRoute && !isSuperAdmin) {
        router.push('/verify-email');
        return;
      }

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
  }, [user, userProfile, isInitialized, router, pathname, redirectToDashboard]);

  const signInWithGoogle = async (): Promise<void> => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: 'offline', prompt: 'select_account' },
      },
    });
    if (error) throw new Error(error.message);
  };

  const signIn = async (email: string, password: string): Promise<void> => {
    if (!email?.trim() || !password?.trim()) throw new Error('Email and password are required');
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) {
      const messages: Record<string, string> = {
        'Invalid login credentials': 'Invalid email or password.',
        'Email not confirmed': 'Please verify your email address before signing in.',
      };
      throw new Error(messages[error.message] || error.message);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    profile: { fullName: string; phone?: string }
  ): Promise<void> => {
    if (!email?.trim() || !password?.trim()) throw new Error('Email and password are required');
    if (!profile.fullName?.trim()) throw new Error('Full name is required');

    const { firstName, lastName } = splitFullName(profile.fullName);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/verify-email?mode=verified`,
        data: {
          first_name: firstName,
          last_name: lastName,
          phone: formatPhoneToE164(profile.phone),
        },
      },
    });

    if (error) {
      const messages: Record<string, string> = {
        'User already registered': 'This email is already associated with an account. Please sign in or reset your password.',
        'Invalid Content-Type: Missing Content-Type header': 'A server-side configuration error occurred during registration.',
        'Email rate limit exceeded': 'Rate limit reached. Please wait an hour before trying again.',
      };
      throw new Error(messages[error.message] || error.message);
    }

    if (data.user && data.user.identities && data.user.identities.length === 0) {
      throw new Error('This email is already associated with an account. Please sign in or reset your password.');
    }

    if (data.user && data.session) {
      await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCookie('__csrf_token') || '' },
        body: JSON.stringify({
          email: data.user.email,
          firstName,
          lastName,
          phone: formatPhoneToE164(profile.phone),
          role: 'customer',
          isActive: true,
          emailVerified: false,
          setupCompleted: false,
        }),
      }).catch(err => console.warn('[AuthContext] Unauthenticated profile sync skipped:', err));
    }
  };

  const updateUserProfile = async (profile: UpdateProfilePayload): Promise<void> => {
    if (!user?.id) throw new Error('No authenticated user found');
    const response = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCookie('__csrf_token') || '' },
      body: JSON.stringify({
        firstName: profile.firstName.trim(),
        lastName: profile.lastName.trim(),
        phone: formatPhoneToE164(profile.phone),
        setupCompleted: true,
        nationalId: profile.nationalId,
        sex: profile.sex,
        currentAddress: profile.currentAddress,
      }),
    });
    if (!response.ok) throw new Error('Failed to update profile');
    await refreshUserProfile();
  };

  const signOutUser = async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
    setUser(null);
    setUserProfile(null);
    router.push('/login');
  };

  const contextValue: AuthContextType = {
    user, 
    userProfile, // 👈 Included in the exported provider map value
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