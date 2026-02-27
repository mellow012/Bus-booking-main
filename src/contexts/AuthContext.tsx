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
  signUp: (
    email: string,
    password: string,
    profile: {
      firstName: string;
      lastName: string;
      phone?: string;
      role?: 'customer' | 'superadmin';
    }
  ) => Promise<void>;
  updateUserProfile: (profile: UpdateProfilePayload) => Promise<void>;
  signOut: () => Promise<void>;
  loading: boolean;
  refreshUserProfile: () => Promise<void>;
  setSuperAdmin: (uid: string) => Promise<void>;
}

interface UpdateProfilePayload {
  firstName: string;
  lastName: string;
  phone: string;
  nationalId?: string;
  sex?: string;
  currentAddress?: string;
  role?: UserRole;
  companyId?: string;
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
    if (!user?.uid) {
      console.log('Cannot refresh profile — no user UID');
      return;
    }

    try {
      console.log('Refreshing user profile for UID:', user.uid);
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const profile = { id: userDoc.id, ...userDoc.data() } as UserProfile;
        console.log('Profile refreshed:', profile.role);
        setUserProfile(profile);
      } else {
        console.warn('User document missing for UID:', user.uid);
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
        console.log('Default customer profile created for UID:', user.uid);
      }
    } catch (error: any) {
      console.error('Error refreshing user profile:', error);
    }
  }, [user?.uid]);

  // ─── Auth state listener ───────────────────────────────────────────────────

  useEffect(() => {
    console.log('Setting up auth state listener');
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log('Auth state changed — User:', currentUser?.uid || 'none');

      if (currentUser) {
        // FIX 1: Reload the user object from Firebase Auth servers so that
        // emailVerified reflects the actual current state, not a cached value.
        // Without this, emailVerified stays false even after the user clicks
        // the verification link, until they sign out and back in.
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

    return () => {
      console.log('Auth state listener unsubscribed');
      unsubscribe();
    };
  }, [refreshUserProfile]);

  // ─── Window focus: refresh emailVerified when user tabs back in ────────────
  // FIX 2: When a user verifies their email in another tab/window and returns,
  // we reload their Firebase user so the banner hides and routing updates
  // without needing a full page refresh.

  useEffect(() => {
    if (!user || user.emailVerified) return;

    const handleFocus = async () => {
      try {
        await reload(user);
        // onAuthStateChanged won't fire on reload() alone, so we force a
        // state update by re-setting the user to the same (now-updated) object.
        // We use auth.currentUser which has the refreshed emailVerified value.
        const refreshed = auth.currentUser;
        if (refreshed?.emailVerified) {
          console.log('[AuthContext] Email verified detected on focus — updating state');
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

    console.log('Handling navigation — User:', user?.uid, 'Role:', userProfile?.role);

    const searchParams =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const oobCode = searchParams?.get('oobCode');
    const operatorId = searchParams?.get('operatorId');

    // Routes accessible without authentication
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
    ];
    const isPublicRoute = publicRoutes.includes(pathname);

    // Setup pages are accessible with a one-time code even before auth
    const isSetupPage =
      (pathname === '/company/setup' ||
        pathname === '/conductor/setup' ||
        pathname === '/operator/signup') &&
      (oobCode || operatorId);

    if (!user && !isSetupPage && !isPublicRoute) {
      console.log('Unauthenticated on protected route — redirecting to /login');
      router.push('/login');
      return;
    }

    if (user && userProfile) {
      // FIX 3: Don't redirect company_admin to /company/setup just because
      // they're on /login or /register. Only redirect to setup if they
      // genuinely have no companyId yet. Previously, any company_admin
      // landing on an auth page would hit redirectToDashboard() which sent
      // them to /company/setup even when they already had a companyId.
      // The fix is that redirectToDashboard already handles this correctly —
      // the bug was that it was being called too eagerly from the auth pages
      // block below. The guard is now tightened.

      // ── Customer: prompt for profile completion on first login ──────────────
      if (
        userProfile.role === 'customer' &&
        !userProfile.nationalId &&
        !userProfile.sex &&
        !userProfile.currentAddress &&
        pathname !== '/profile'
      ) {
        const isFirstLogin =
          typeof window !== 'undefined'
            ? !localStorage.getItem(`profileCompleted_${user.uid}`)
            : true;
        if (isFirstLogin) {
          console.log('First-login customer with incomplete profile → /profile');
          router.push('/profile');
          if (typeof window !== 'undefined') {
            localStorage.setItem(`profileCompleted_${user.uid}`, 'true');
          }
          return;
        }
      }

      // ── Redirect authenticated users away from auth pages ──────────────────
      const authPages = ['/login', '/register'];
      if (authPages.includes(pathname)) {
        console.log('Authenticated user on auth page — redirecting to dashboard');
        redirectToDashboard(userProfile);
        return;
      }

      // ── Prevent cross-role dashboard access ────────────────────────────────

      // Operators/conductors must not access company admin
      if (
        pathname.startsWith('/company/admin') &&
        (userProfile.role === 'operator' || userProfile.role === 'conductor')
      ) {
        console.log(`${userProfile.role} on admin route — redirecting to own dashboard`);
        redirectToDashboard(userProfile);
        return;
      }

      // Company admins must not access operator dashboard
      if (
        pathname.startsWith('/operator/dashboard') &&
        userProfile.role === 'company_admin'
      ) {
        console.log('company_admin on operator route — redirecting to admin dashboard');
        redirectToDashboard(userProfile);
        return;
      }

      // Anyone other than conductors must not access conductor dashboard
      if (
        pathname.startsWith('/conductor/dashboard') &&
        userProfile.role !== 'conductor'
      ) {
        console.log(`${userProfile.role} on conductor route — redirecting`);
        redirectToDashboard(userProfile);
        return;
      }

      // FIX 4: Prevent non-company_admin roles from landing on /company/setup.
      // Previously any authenticated user (including customers) who somehow
      // hit /company/setup would get stuck there or be looped. Now only
      // company_admin without a companyId is allowed through.
      if (
        pathname === '/company/setup' &&
        userProfile.role !== 'company_admin'
      ) {
        console.log(`${userProfile.role} on /company/setup — redirecting to correct dashboard`);
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
          // Only send to setup if they genuinely have no company yet
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
    console.log('Signing in:', trimmedEmail);

    try {
      const credential = await signInWithEmailAndPassword(auth, trimmedEmail, password);

      // FIX 5: Force-reload the user immediately after sign-in so that
      // emailVerified is fresh. This prevents the redirect guard from
      // treating a verified user as unverified on their first sign-in
      // after clicking the verification link.
      try {
        await reload(credential.user);
      } catch {
        // non-fatal
      }

      console.log('Sign in successful — emailVerified:', credential.user.emailVerified);
    } catch (error: any) {
      console.error('Sign in error:', error);
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

  const signUp = async (
    email: string,
    password: string,
    profile: {
      firstName: string;
      lastName: string;
      phone?: string;
      role?: 'customer' | 'superadmin';
    }
  ) => {
    if (!email?.trim() || !password?.trim()) throw new Error('Email and password are required');
    if (!profile.firstName?.trim() || !profile.lastName?.trim())
      throw new Error('First name and last name are required');

    const trimmedEmail = email.trim().toLowerCase();

    try {
      const { user: newUser } = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      console.log('Auth user created, UID:', newUser.uid);

      const userProfileData: Partial<UserProfile> = {
        id: newUser.uid,
        email: newUser.email || trimmedEmail,
        firstName: profile.firstName.trim(),
        lastName: profile.lastName.trim(),
        phone: formatPhoneToE164(profile.phone),
        role: profile.role || 'customer',
        createdAt: serverTimestamp() as unknown as Date,
        updatedAt: serverTimestamp() as unknown as Date,
        passwordSet: true,
      };

      await setDoc(doc(db, 'users', newUser.uid), userProfileData);
      console.log('User profile saved to Firestore');
    } catch (error: any) {
      console.error('Sign up error:', error);
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
      if (profile.role) userProfileData.role = profile.role;

      const updateData: any = { ...userProfileData };

      // Attach companyId for company-related roles; strip it for others
      if (isCompanyRole(profile.role) && profile.companyId) {
        updateData.companyId = profile.companyId;
      } else if (!isCompanyRole(userProfile?.role)) {
        updateData.companyId = deleteField();
      }

      await setDoc(doc(db, 'users', user.uid), updateData, { merge: true });
      console.log('User profile updated successfully');
      await refreshUserProfile();
    } catch (error: any) {
      console.error('Error updating user profile:', error);
      throw new Error(
        error.code === 'invalid-argument'
          ? 'Invalid data provided. Please ensure all fields are valid and try again.'
          : 'Profile update failed. Please try again.'
      );
    }
  };

  // ─── signOut ───────────────────────────────────────────────────────────────

  const signOutUser = async () => {
    console.log('Signing out');
    try {
      await signOut(auth);
      setUser(null);
      setUserProfile(null);
      console.log('Sign out successful');
      router.push('/login');
    } catch (error: any) {
      console.error('Sign out error:', error);
      throw new Error('Sign out failed. Please try again.');
    }
  };

  // ─── setSuperAdmin ─────────────────────────────────────────────────────────

  const setSuperAdmin = async (uid: string) => {
    if (!uid) throw new Error('UID is required');
    try {
      await updateDoc(doc(db, 'users', uid), {
        role: 'superadmin',
        updatedAt: serverTimestamp() as unknown as Date,
      });
      console.log('User set as superadmin:', uid);
      if (user?.uid === uid) await refreshUserProfile();
    } catch (error: any) {
      console.error('Error setting superadmin:', error);
      throw new Error('Failed to set superadmin role.');
    }
  };

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
    setSuperAdmin,
  };

  // Show skeleton while initializing to prevent flash of wrong content
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center mb-12">
            <div className="text-center lg:text-left animate-pulse">
              <div className="inline-flex items-center px-4 py-2 bg-gray-200 rounded-full text-sm font-medium mb-6 w-64 h-8" />
              <div className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-200 mb-6 leading-tight h-24" />
              <div className="text-lg sm:text-xl text-gray-200 max-w-2xl mx-auto lg:mx-0 leading-relaxed mb-8 h-16" />
              <div className="flex flex-wrap gap-6 justify-center lg:justify-start h-16">
                <div className="w-40 h-6 bg-gray-200 rounded" />
                <div className="w-40 h-6 bg-gray-200 rounded" />
                <div className="w-40 h-6 bg-gray-200 rounded" />
              </div>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mt-6 h-12">
                <div className="w-40 h-10 bg-gray-200 rounded" />
                <div className="w-40 h-10 bg-gray-200 rounded" />
              </div>
            </div>
            <div className="relative w-full max-w-lg mx-auto">
              <div className="w-full h-64 bg-gray-200 rounded-2xl animate-pulse" />
              <div className="absolute -top-4 -right-4 w-16 h-16 bg-gray-200 rounded-full" />
              <div className="absolute -bottom-4 -left-4 w-14 h-14 bg-gray-200 rounded-full" />
              <div className="absolute top-8 left-8 w-8 h-8 bg-gray-200 rounded-full" />
              <div className="absolute bottom-12 right-12 w-6 h-6 bg-gray-200 rounded-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-12">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="bg-gray-200 rounded-2xl p-6 h-32 animate-pulse" />
            ))}
          </div>
          <div className="bg-gray-200 rounded-3xl p-6 lg:p-8 h-64 animate-pulse" />
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