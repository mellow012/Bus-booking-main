'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { auth, db } from '@/lib/firebaseConfig';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  reload,
  User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, deleteField } from 'firebase/firestore';
import { UserProfile, UserRole, CompanyRole } from '@/types';
import { useRouter, usePathname } from 'next/navigation';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatPhoneToE164 = (phone?: string): string => {
  if (!phone) return '';
  let p = phone.trim();
  p = p.replace(/[\s\-()]/g, '');
  if (p.startsWith('00')) p = '+' + p.slice(2);
  if (p.startsWith('+')) {
    const digits = p.replace(/[^\d]/g, '');
    return '+' + digits;
  }
  if (p.startsWith('0')) {
    const digits = p.replace(/^0+/, '');
    return '+265' + digits;
  }
  const digitsOnly = p.replace(/[^\d]/g, '');
  if (/^\d+$/.test(p) && digitsOnly.length >= 7 && digitsOnly.length <= 10) {
    return '+265' + digitsOnly;
  }
  return '+' + digitsOnly;
};

/** Roles that require a companyId on the user profile */
const COMPANY_ROLES: CompanyRole[] = ['company_admin', 'operator', 'conductor'];

const isCompanyRole = (role?: UserRole): role is CompanyRole =>
  COMPANY_ROLES.includes(role as CompanyRole);

// ─── Context types ────────────────────────────────────────────────────────────

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  setUserProfile: (profile: UserProfile | null) => void;
  signIn: (email: string, password: string) => Promise<void>;
  /**
   * signUp creates a customer account only.
   * Role elevation (superadmin, company_admin, etc.) must be performed
   * server-side via a Firebase Admin SDK Cloud Function.
   */
  signUp: (
    email: string,
    password: string,
    profile: {
      firstName: string;
      lastName: string;
      phone?: string;
    }
  ) => Promise<void>;
  updateUserProfile: (profile: UpdateProfilePayload) => Promise<void>;
  signOut: () => Promise<void>;
  loading: boolean;
  refreshUserProfile: () => Promise<void>;
  // NOTE: setSuperAdmin has been removed from the client.
  // Use the Cloud Function `setUserRole` with Admin SDK claim verification instead.
}

// FIX F-03: role and companyId removed from UpdateProfilePayload entirely.
// These fields are server-only and must only be written by Cloud Functions
// that verify the caller's Firebase Auth custom claims before writing.
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
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // ─── Profile fetch ─────────────────────────────────────────────────────────

  const refreshUserProfile = useCallback(async () => {
    if (!user?.uid) return;

    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const profile = { id: userDoc.id, ...userDoc.data() } as UserProfile;
        setUserProfile(profile);
      } else {
        // New user with no Firestore doc yet — create a default customer profile.
        // Role defaults to 'customer'; any elevation must go through Cloud Functions.
        const defaultProfile: Partial<UserProfile> = {
          id: user.uid,
          email: user.email || '',
          firstName: '',
          lastName: '',
          phone: '',
          role: 'customer',
          createdAt: serverTimestamp() as unknown as Date,
          updatedAt: serverTimestamp() as unknown as Date,
          passwordSet: false,
        };
        await setDoc(userDocRef, defaultProfile, { merge: true });
        setUserProfile({ ...defaultProfile, id: user.uid } as UserProfile);
      }
    } catch (error: any) {
      console.error('Error refreshing user profile:', error);
    }
  }, [user?.uid]);

  // ─── Auth state listener ───────────────────────────────────────────────────

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // FIX 1: Reload so emailVerified reflects actual state, not cached value.
        try {
          await reload(currentUser);
        } catch {
          // reload can fail if offline — safe to continue with cached data
        }

        setUser(currentUser);
        await refreshUserProfile();
      } else {
        setUser(null);
        setUserProfile(null);
      }

      setLoading(false);
      setIsInitialized(true);
    });

    return () => unsubscribe();
  }, [refreshUserProfile]);

  // ─── Window focus: refresh emailVerified when user tabs back in ────────────
  // FIX 2: Reload Firebase user when the tab regains focus so the verification
  // banner hides without a full page refresh.

  useEffect(() => {
    if (!user || user.emailVerified) return;

    const handleFocus = async () => {
      try {
        await reload(user);
        const refreshed = auth.currentUser;
        if (refreshed?.emailVerified) {
          setUser({ ...refreshed } as User);
        }
      } catch {
        // ignore focus-refresh errors silently
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user]);

  // ─── Navigation / route guards ─────────────────────────────────────────────

  useEffect(() => {
    if (!isInitialized || loading) return;

    const searchParams =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const oobCode = searchParams?.get('oobCode');
    const operatorId = searchParams?.get('operatorId');

    const publicRoutes = [
      '/login',
      '/register',
      '/company/setup',
      '/conductor/setup',
      '/operator/signup',
      '/',
      '/about',
      '/contact',
      '/forgot-password',
      '/reset-password',
      '/verify-email', // FIX F-14: must be public so unverified users can land here
    ];
    const isPublicRoute = publicRoutes.includes(pathname);

    const isSetupPage =
      (pathname === '/company/setup' ||
        pathname === '/conductor/setup' ||
        pathname === '/operator/signup') &&
      (oobCode || operatorId);

    if (!user && !isSetupPage && !isPublicRoute) {
      router.push('/login');
      return;
    }

    if (user && userProfile) {
      // FIX F-14: Block unverified users from all non-public routes.
      // Redirect them to /verify-email until emailVerified is true.
      if (!user.emailVerified && !isPublicRoute) {
        router.push('/verify-email');
        return;
      }

      // ── Customer: prompt for profile completion on first login ──────────────
      // FIX F-26: profileCompleted flag stored in Firestore, not localStorage.
      if (
        userProfile.role === 'customer' &&
        !userProfile.nationalId &&
        !userProfile.sex &&
        !userProfile.currentAddress &&
        pathname !== '/profile' &&
        !userProfile.setupCompleted
      ) {
        // Mark as completed in Firestore so it persists across devices/sessions
        const userDocRef = doc(db, 'users', user.uid);
        updateDoc(userDocRef, { setupCompleted: true }).catch(() => {/* non-fatal */});
        router.push('/profile');
        return;
      }

      // ── Redirect authenticated users away from auth pages ──────────────────
      const authPages = ['/login', '/register'];
      if (authPages.includes(pathname)) {
        redirectToDashboard(userProfile);
        return;
      }

      // ── Prevent cross-role dashboard access ────────────────────────────────

      if (
        pathname.startsWith('/company/admin') &&
        (userProfile.role === 'operator' || userProfile.role === 'conductor')
      ) {
        redirectToDashboard(userProfile);
        return;
      }

      if (
        pathname.startsWith('/operator/dashboard') &&
        userProfile.role === 'company_admin'
      ) {
        redirectToDashboard(userProfile);
        return;
      }

      if (
        pathname.startsWith('/conductor/dashboard') &&
        userProfile.role !== 'conductor'
      ) {
        redirectToDashboard(userProfile);
        return;
      }

      // FIX 4: Only company_admin without a companyId may visit /company/setup.
      if (
        pathname === '/company/setup' &&
        userProfile.role !== 'company_admin'
      ) {
        redirectToDashboard(userProfile);
        return;
      }
    }
  }, [user, userProfile, isInitialized, loading, router, pathname]);

  /** Central role-based redirect helper */
  const redirectToDashboard = useCallback(
    (profile: UserProfile) => {
      switch (profile.role) {
        case 'superadmin':
          router.push('/super-admin/dashboard');
          break;
        case 'company_admin':
          if (profile.companyId) {
            router.push(`/company/admin?companyId=${profile.companyId}`);
          } else {
            router.push('/company/setup');
          }
          break;
        case 'operator':
          if (profile.companyId) {
            router.push(`/operator/dashboard?companyId=${profile.companyId}`);
          } else {
            console.error('Operator without companyId');
            router.push('/login');
          }
          break;
        case 'conductor':
          if (profile.companyId) {
            router.push('/conductor/dashboard');
          } else {
            console.error('Conductor without companyId');
            router.push('/login');
          }
          break;
        case 'customer':
        default:
          router.push('/');
      }
    },
    [router]
  );

  // ─── signIn ────────────────────────────────────────────────────────────────

  const signIn = async (email: string, password: string) => {
    if (!email?.trim() || !password?.trim()) {
      throw new Error('Email and password are required');
    }

    const trimmedEmail = email.trim().toLowerCase();

    try {
      const credential = await signInWithEmailAndPassword(auth, trimmedEmail, password);

      // FIX 5: Force-reload immediately after sign-in so emailVerified is fresh.
      try {
        await reload(credential.user);
      } catch {
        // non-fatal
      }
    } catch (error: any) {
      const messages: Record<string, string> = {
        'auth/user-not-found': 'No account found with this email address.',
        'auth/wrong-password': 'Incorrect password. Please try again.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/user-disabled': 'This account has been disabled.',
        'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
        'auth/invalid-credential': 'Invalid email or password. Please check your credentials.',
      };
      throw new Error(messages[error.code] || 'Sign in failed. Please try again.');
    }
  };

  // ─── signUp ────────────────────────────────────────────────────────────────
  // FIX F-01: role parameter removed entirely. All new accounts are 'customer'.
  // Role elevation (superadmin, company_admin, etc.) must be performed
  // server-side via a Firebase Admin SDK Cloud Function that verifies the
  // caller's custom claims before writing the new role.

  const signUp = async (
    email: string,
    password: string,
    profile: {
      firstName: string;
      lastName: string;
      phone?: string;
    }
  ) => {
    if (!email?.trim() || !password?.trim()) throw new Error('Email and password are required');
    if (!profile.firstName?.trim() || !profile.lastName?.trim())
      throw new Error('First name and last name are required');

    const trimmedEmail = email.trim().toLowerCase();

    try {
      const { user: newUser } = await createUserWithEmailAndPassword(auth, trimmedEmail, password);

      const userProfileData: Partial<UserProfile> = {
        id: newUser.uid,
        email: newUser.email || trimmedEmail,
        firstName: profile.firstName.trim(),
        lastName: profile.lastName.trim(),
        phone: formatPhoneToE164(profile.phone),
        role: 'customer', // always customer — server-side only for elevation
        createdAt: serverTimestamp() as unknown as Date,
        updatedAt: serverTimestamp() as unknown as Date,
        passwordSet: true,
      };

      await setDoc(doc(db, 'users', newUser.uid), userProfileData);
    } catch (error: any) {
      const messages: Record<string, string> = {
        'auth/email-already-in-use': 'An account with this email already exists.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/weak-password': 'Password should be at least 6 characters long.',
        'auth/operation-not-allowed': 'Account creation is currently disabled.',
      };
      throw new Error(messages[error.code] || 'Account creation failed. Please try again.');
    }
  };

  // ─── updateUserProfile ─────────────────────────────────────────────────────
  // FIX F-03: role and companyId removed from payload. Profile owners can only
  // update personal fields. Role/company changes go through Cloud Functions.

  const updateUserProfile = async (profile: UpdateProfilePayload) => {
    if (!user?.uid) throw new Error('No authenticated user found');
    if (!profile.firstName?.trim() || !profile.lastName?.trim())
      throw new Error('First name and last name are required');
    if (!profile.phone?.trim()) throw new Error('Phone number is required');

    try {
      const userProfileData: Partial<UserProfile> = {
        firstName: profile.firstName.trim(),
        lastName: profile.lastName.trim(),
        phone: formatPhoneToE164(profile.phone),
        updatedAt: serverTimestamp() as unknown as Date,
      };

      if (profile.nationalId) userProfileData.nationalId = profile.nationalId;
      if (profile.sex) userProfileData.sex = profile.sex;
      if (profile.currentAddress) userProfileData.currentAddress = profile.currentAddress;

      await setDoc(doc(db, 'users', user.uid), userProfileData, { merge: true });
      await refreshUserProfile();
    } catch (error: any) {
      throw new Error(
        error.code === 'invalid-argument'
          ? 'Invalid data provided. Please ensure all fields are valid and try again.'
          : 'Profile update failed. Please try again.'
      );
    }
  };

  // ─── signOut ───────────────────────────────────────────────────────────────

  const signOutUser = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setUserProfile(null);
      router.push('/login');
    } catch (error: any) {
      throw new Error('Sign out failed. Please try again.');
    }
  };

  // ─── FIX F-02: setSuperAdmin removed from client entirely ─────────────────
  // To promote a user to superadmin, call the Cloud Function `setUserRole`
  // from an existing superadmin account. The Cloud Function verifies the
  // caller's custom claims via Admin SDK before writing the new role.
  // Example:
  //   const setUserRole = httpsCallable(functions, 'setUserRole');
  //   await setUserRole({ uid: targetUid, role: 'superadmin' });

  // ─── Context value ─────────────────────────────────────────────────────────

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

  // FIX F-35: Replace 50-line skeleton with a simple centered spinner.
  // The auth initialization window is ~100ms — a full-page skeleton is
  // unnecessary and brittle (breaks whenever the homepage layout changes).
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

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};