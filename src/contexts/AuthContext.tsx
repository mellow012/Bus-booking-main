'use client';
// contexts/AuthContext.tsx

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { auth, db } from '@/lib/firebaseConfig';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  reload,
  User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { UserProfile, UserRole, CompanyRole } from '@/types';
import { useRouter, usePathname } from 'next/navigation';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
const _isCompanyRole = (role?: UserRole): role is CompanyRole =>
  COMPANY_ROLES.includes(role as CompanyRole);

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  setUserProfile: (profile: UserProfile | null) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    profile: { firstName: string; lastName: string; phone?: string }
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

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user,          setUser]          = useState<User | null>(null);
  const [userProfile,   setUserProfile]   = useState<UserProfile | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  const syncingEmailVerified = useRef(false);

  const router   = useRouter();
  const pathname = usePathname();

  // ─── Session helpers ──────────────────────────────────────────────────────

  const createServerSession = async (currentUser: User): Promise<boolean> => {
    try {
      const idToken = await currentUser.getIdToken();
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      return res.ok;
    } catch (err) {
      console.error('[AuthContext] createServerSession failed:', err);
      return false;
    }
  };

  const deleteServerSession = async (): Promise<void> => {
    try {
      await fetch('/api/auth/session', { method: 'DELETE' });
    } catch (err) {
      console.error('[AuthContext] deleteServerSession failed:', err);
    }
  };

  // ─── emailVerified sync ───────────────────────────────────────────────────

  const syncEmailVerifiedToFirestore = useCallback(async (currentUser: User): Promise<void> => {
    if (!currentUser.emailVerified) return;
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      const snap = await getDoc(userDocRef);
      if (snap.exists() && snap.data()?.emailVerified !== true) {
        syncingEmailVerified.current = true;
        await updateDoc(userDocRef, {
          emailVerified: true,
          updatedAt:     serverTimestamp(),
        });
      }
    } catch (err) {
      console.warn('[AuthContext] syncEmailVerifiedToFirestore failed (non-fatal):', err);
    } finally {
      syncingEmailVerified.current = false;
    }
  }, []);

  // ─── Profile management ───────────────────────────────────────────────────

  const refreshUserProfile = useCallback(async (uid?: string) => {
    const targetUid = uid ?? user?.uid;
    if (!targetUid) return;

    try {
      const userDocRef = doc(db, 'users', targetUid);
      const userDoc    = await getDoc(userDocRef);

      if (userDoc.exists()) {
        setUserProfile({ id: userDoc.id, ...userDoc.data() } as UserProfile);
      } else {
        const defaultProfile = {
          id:             targetUid,
          uid:            targetUid,
          email:          auth.currentUser?.email || '',
          firstName:      '',
          lastName:       '',
          phone:          '',
          role:           'customer' as const,
          isActive:       true,
          emailVerified:  auth.currentUser?.emailVerified ?? false,
          passwordSet:    false,
          setupCompleted: false,
          createdAt:      serverTimestamp(),
          updatedAt:      serverTimestamp(),
        };
        await setDoc(userDocRef, defaultProfile, { merge: true });
        setUserProfile(defaultProfile as unknown as UserProfile);
      }
    } catch (error: any) {
      console.error('[AuthContext] refreshUserProfile failed:', error);
    }
  }, [user?.uid]);

  // ─── Auth state listener ──────────────────────────────────────────────────

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try { await reload(currentUser); } catch { /* offline — continue */ }

        const freshUser = auth.currentUser ?? currentUser;
        setUser(freshUser);

        await syncEmailVerifiedToFirestore(freshUser);
        await refreshUserProfile(freshUser.uid);
      } else {
        setUser(null);
        setUserProfile(null);
      }

      setLoading(false);
      setIsInitialized(true);
    });

    return () => unsubscribe();
  }, [refreshUserProfile, syncEmailVerifiedToFirestore]);

  // ─── Auto-refresh session cookie when ID token rotates ───────────────────
  // Also update user state so emailVerified changes (e.g. after applyActionCode)
  // are reflected immediately without waiting for the next onAuthStateChanged.

  useEffect(() => {
    const unsubscribeToken = auth.onIdTokenChanged(async (currentUser) => {
      if (!currentUser) return;

      // Update user state so emailVerified flips in the route guard immediately
      setUser({ ...currentUser } as User);

      try {
        const idToken = await currentUser.getIdToken();
        await fetch("/api/auth/session", {
          method: "POST",
          headers: { Authorization: `Bearer ${idToken}` },
        });
      } catch (err) {
        console.warn("[AuthContext] onIdTokenChanged session refresh failed:", err);
      }
    });
    return () => unsubscribeToken();
  }, []);

  // ─── Window focus: refresh when user returns after verifying ─────────────

  useEffect(() => {
    if (!user || user.emailVerified) return;

    const handleFocus = async () => {
      try {
        await reload(user);
        const refreshed = auth.currentUser;
        if (refreshed?.emailVerified) {
          await syncEmailVerifiedToFirestore(refreshed);
          setUser({ ...refreshed } as User);
          await refreshUserProfile(refreshed.uid);
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user, refreshUserProfile, syncEmailVerifiedToFirestore]);

  // ─── Route guard ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isInitialized || loading) return;

    const searchParams =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search)
        : null;

    const oobCode    = searchParams?.get('oobCode');
    const operatorId = searchParams?.get('operatorId');

    const publicRoutes = [
      '/login', '/register', '/', '/about', '/contact',
      '/forgot-password', '/reset-password', '/verify-email',
      '/company/setup', '/company/conductor/setup', '/company/operator/signup',
    ];
    const isPublicRoute = publicRoutes.includes(pathname);

    const isSetupPage =
      (pathname === '/company/setup' ||
        pathname === '/company/conductor/setup' ||
        pathname === '/company/operator/signup') &&
      !!(oobCode || operatorId);

    // ── Unauthenticated ────────────────────────────────────────────────────
    if (!user && !isSetupPage && !isPublicRoute) {
      router.push('/login');
      return;
    }

    if (user && userProfile) {
      const emailVerified = user.emailVerified;

      // ── Email not verified → hold on verify-email page ────────────────
      if (!emailVerified && !isPublicRoute && !syncingEmailVerified.current) {
        router.push('/verify-email');
        return;
      }

      // ── Just verified → leave verify-email, go to profile ─────────────
      if (emailVerified && pathname === '/verify-email') {
        // Only redirect if not already heading somewhere via the page itself
        // (the page does its own redirect after applyActionCode)
        if (!oobCode) {
          redirectAfterVerification(userProfile);
        }
        return;
      }

      // ── Customer: force profile completion before anything else ────────
      // A customer is considered "setup incomplete" if they haven't saved
      // their profile yet (setupCompleted flag is the source of truth).
      if (
        emailVerified &&
        userProfile.role === 'customer' &&
        !userProfile.setupCompleted &&
        pathname !== '/profile'
      ) {
        router.push('/profile');
        return;
      }

      // ── Auth page redirect ─────────────────────────────────────────────
      if (['/login', '/register'].includes(pathname)) {
        redirectToDashboard(userProfile);
        return;
      }

      // ── Role mismatch guards ───────────────────────────────────────────
      if (
        pathname.startsWith('/company/admin') &&
        (userProfile.role === 'operator' || userProfile.role === 'conductor')
      ) {
        redirectToDashboard(userProfile);
        return;
      }

      if (
        pathname.startsWith('/company/operator/dashboard') &&
        userProfile.role === 'company_admin'
      ) {
        redirectToDashboard(userProfile);
        return;
      }

      if (
        pathname.startsWith('/company/conductor/dashboard') &&
        userProfile.role !== 'conductor'
      ) {
        redirectToDashboard(userProfile);
        return;
      }

      if (pathname === '/company/setup' && userProfile.role !== 'company_admin') {
        redirectToDashboard(userProfile);
        return;
      }
    }
  }, [user, userProfile, isInitialized, loading, router, pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // After email verified with no oobCode on verify-email page,
  // send them where they should go next.
  const redirectAfterVerification = useCallback((profile: UserProfile) => {
    if (profile.role === 'customer' && !profile.setupCompleted) {
      router.push('/profile');
    } else {
      redirectToDashboard(profile);
    }
  }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  const redirectToDashboard = useCallback((profile: UserProfile) => {
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
          console.error('[AuthContext] Operator missing companyId');
          router.push('/login');
        }
        break;
      case 'conductor':
        if (profile.companyId) {
          router.push('/company/conductor/dashboard');
        } else {
          console.error('[AuthContext] Conductor missing companyId');
          router.push('/login');
        }
        break;
      case 'customer':
      default:
        router.push('/');
    }
  }, [router]);

  // ─── signIn ───────────────────────────────────────────────────────────────

  const signIn = async (email: string, password: string): Promise<void> => {
    if (!email?.trim() || !password?.trim()) {
      throw new Error('Email and password are required');
    }

    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password
      );

      const sessionCreated = await createServerSession(credential.user);

      if (!sessionCreated) {
        await signOut(auth);
        throw Object.assign(
          new Error('Unable to establish a secure session. Please try again.'),
          { code: 'auth/session-failed' }
        );
      }

      try { await reload(credential.user); } catch { /* non-fatal */ }

    } catch (error: any) {
      if (error.code === 'auth/session-failed') throw error;

      const messages: Record<string, string> = {
        'auth/user-not-found':         'No account found with this email address.',
        'auth/wrong-password':         'Incorrect password. Please try again.',
        'auth/invalid-email':          'Please enter a valid email address.',
        'auth/user-disabled':          'This account has been disabled. Contact support.',
        'auth/too-many-requests':      'Too many failed attempts. Please try again later.',
        'auth/invalid-credential':     'Invalid email or password.',
        'auth/network-request-failed': 'Network error. Check your connection and try again.',
      };

      throw new Error(messages[error.code] || 'Sign in failed. Please try again.');
    }
  };

  // ─── signUp ───────────────────────────────────────────────────────────────

  const signUp = async (
    email: string,
    password: string,
    profile: { firstName: string; lastName: string; phone?: string }
  ): Promise<void> => {
    if (!email?.trim() || !password?.trim()) {
      throw new Error('Email and password are required');
    }
    if (!profile.firstName?.trim() || !profile.lastName?.trim()) {
      throw new Error('First name and last name are required');
    }

    try {
      const { user: newUser } = await createUserWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password
      );

      await setDoc(doc(db, 'users', newUser.uid), {
        id:             newUser.uid,
        uid:            newUser.uid,
        email:          newUser.email || email.trim().toLowerCase(),
        firstName:      profile.firstName.trim(),
        lastName:       profile.lastName.trim(),
        phone:          formatPhoneToE164(profile.phone),
        role:           'customer',
        isActive:       true,
        emailVerified:  false,
        passwordSet:    true,
        setupCompleted: false,
        createdAt:      serverTimestamp(),
        updatedAt:      serverTimestamp(),
      });

      const sessionCreated = await createServerSession(newUser);
      if (!sessionCreated) {
        console.warn('[AuthContext] signUp — session cookie creation failed');
      }

      if (sessionCreated) {
        newUser.getIdToken()
          .then((idToken) =>
            fetch('/api/auth/send-verification-email', {
              method:  'POST',
              headers: { Authorization: `Bearer ${idToken}` },
            })
          )
          .then(async (res) => {
            if (!res.ok) {
              const body = await res.json().catch(() => ({}));
              console.warn('[AuthContext] signUp — verification email API error:', body.message);
            }
          })
          .catch((err) => {
            console.warn('[AuthContext] signUp — verification email failed:', err.message);
          });
      }
    } catch (error: any) {
      console.error('[AuthContext] signUp error:', error.code, error.message);

      const messages: Record<string, string> = {
        'auth/email-already-in-use':   'An account with this email already exists.',
        'auth/invalid-email':          'Please enter a valid email address.',
        'auth/weak-password':          'Password should be at least 6 characters.',
        'auth/operation-not-allowed':  'Account creation is currently disabled.',
        'auth/network-request-failed': 'Network error. Check your connection and try again.',
      };

      const friendlyMessage = messages[error.code] || 'Account creation failed. Please try again.';
      throw Object.assign(new Error(friendlyMessage), { code: error.code });
    }
  };

  // ─── updateUserProfile ────────────────────────────────────────────────────

  const updateUserProfile = async (profile: UpdateProfilePayload): Promise<void> => {
    if (!user?.uid) throw new Error('No authenticated user found');
    if (!profile.firstName?.trim() || !profile.lastName?.trim()) {
      throw new Error('First name and last name are required');
    }
    if (!profile.phone?.trim()) throw new Error('Phone number is required');

    try {
      const update: Record<string, any> = {
        firstName:      profile.firstName.trim(),
        lastName:       profile.lastName.trim(),
        phone:          formatPhoneToE164(profile.phone),
        setupCompleted: true,
        updatedAt:      serverTimestamp(),
      };

      if (profile.nationalId)     update.nationalId     = profile.nationalId;
      if (profile.sex)            update.sex            = profile.sex;
      if (profile.currentAddress) update.currentAddress = profile.currentAddress;

      await setDoc(doc(db, 'users', user.uid), update, { merge: true });
      await refreshUserProfile();
    } catch (error: any) {
      throw new Error(
        error.code === 'invalid-argument'
          ? 'Invalid data provided. Please check all fields and try again.'
          : 'Profile update failed. Please try again.'
      );
    }
  };

  // ─── signOut ──────────────────────────────────────────────────────────────

  const signOutUser = async (): Promise<void> => {
    try {
      await deleteServerSession();
      await signOut(auth);
      setUser(null);
      setUserProfile(null);
      router.push('/login');
    } catch (error: any) {
      console.error('[AuthContext] signOut error:', error);
      throw new Error('Sign out failed. Please try again.');
    }
  };

  // ─── Context value ────────────────────────────────────────────────────────

  const contextValue: AuthContextType = {
    user,
    userProfile,
    setUserProfile,
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