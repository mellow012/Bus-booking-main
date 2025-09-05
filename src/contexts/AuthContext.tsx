'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { auth, db } from '@/lib/firebaseConfig';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  sendSignInLinkToEmail,
  ActionCodeSettings,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc, collection, addDoc } from 'firebase/firestore';
import { UserProfile } from '@/types';
import { useRouter, usePathname } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  setUserProfile: (profile: UserProfile | null) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    profile: { firstName: string; lastName: string; phone: string; role?: 'customer' | 'superadmin' }
  ) => Promise<void>;
  updateUserProfile: (
    profile: { 
      firstName: string; 
      lastName: string; 
      phone: string; 
      nationalId?: string; 
      sex?: string; 
      currentAddress?: string; 
      role?: 'customer' | 'superadmin' | 'company_admin'; 
      companyId?: string 
    }
  ) => Promise<void>;
  signOut: () => Promise<void>;
  loading: boolean;
  refreshUserProfile: () => Promise<void>;
  setSuperAdmin: (uid: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const router = useRouter();
  const pathname = usePathname(); // Use usePathname instead of router.pathname

  const refreshUserProfile = useCallback(async () => {
    if (!user?.uid) {
      console.log('Cannot refresh profile - no user UID available');
      return;
    }

    try {
      console.log('Refreshing user profile for UID:', user.uid);
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const profile = { id: userDoc.id, ...userDoc.data() } as UserProfile;
        console.log('Profile refreshed successfully:', profile);
        setUserProfile(profile);
      } else {
        console.warn('User document does not exist for UID:', user.uid);
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
        console.log('Default profile created for UID:', user.uid);
      }
    } catch (error: any) {
      console.error('Error refreshing user profile:', error);
    }
  }, [user?.uid]); // Removed router.pathname dependency

  useEffect(() => {
    console.log('Setting up auth state listener');
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log('Auth state changed - User:', currentUser?.uid || 'none');
      setUser(currentUser);

      if (currentUser) {
        await refreshUserProfile();
      } else {
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

  // Separate effect for navigation handling to avoid infinite loops
  useEffect(() => {
    if (!isInitialized || loading) return;
    
    console.log('Handling navigation - User:', user?.uid, 'Profile:', userProfile);
    
    // Get search params safely
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const oobCode = searchParams?.get('oobCode');

    // Define public routes that don't require authentication
    const publicRoutes = ['/login', '/register', '/company/setup', '/', '/about', '/contact'];
    const isPublicRoute = publicRoutes.includes(pathname);

    // Only redirect to login if user is not authenticated and not on a public route
    if (!user && !oobCode && !isPublicRoute) {
      console.log('No user found and not on public route, redirecting to /login');
      router.push('/login');
      return;
    }

    // Handle authenticated user redirects - only for specific cases
    if (user && userProfile) {
      // Only redirect customers with incomplete profiles on their first login
      if (
        userProfile.role === 'customer' && 
        !userProfile.nationalId && 
        !userProfile.sex && 
        !userProfile.currentAddress &&
        pathname !== '/profile'
      ) {
        const isFirstLogin = typeof window !== 'undefined' ? !localStorage.getItem(`profileCompleted_${user.uid}`) : true;
        if (isFirstLogin) {
          console.log('First login customer with incomplete profile, redirecting to /profile');
          router.push('/profile');
          if (typeof window !== 'undefined') {
            localStorage.setItem(`profileCompleted_${user.uid}`, 'true');
          }
          return;
        }
      }

      // Optional: Redirect to default dashboard only from login/register pages
      const authPages = [ '/login', '/register'];
      if (authPages.includes(pathname)) {
        console.log('User authenticated, redirecting from auth page to appropriate dashboard');
        if (userProfile.role === 'superadmin') {
          router.push('/admin');
        } else if (userProfile.role === 'company_admin' && userProfile.companyId) {
          router.push('/company/admin');
        } else {
          router.push('/'); // Redirect customers to homepage
        }
      }
    }
  }, [user, userProfile, isInitialized, loading, router, pathname]);

  const signIn = async (email: string, password: string) => {
    if (!email?.trim() || !password?.trim()) {
      throw new Error('Email and password are required');
    }

    const trimmedEmail = email.trim().toLowerCase();
    console.log('Attempting sign in for:', trimmedEmail);
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
      console.log('Sign in successful');
      // Don't call refreshUserProfile here - it will be called by the auth state change listener
    } catch (error: any) {
      console.error('Sign in error:', error);
      let userMessage;
      switch (error.code) {
        case 'auth/user-not-found':
          userMessage = 'No account found with this email address.';
          break;
        case 'auth/wrong-password':
          userMessage = 'Incorrect password. Please try again.';
          break;
        case 'auth/invalid-email':
          userMessage = 'Please enter a valid email address.';
          break;
        case 'auth/user-disabled':
          userMessage = 'This account has been disabled.';
          break;
        case 'auth/too-many-requests':
          userMessage = 'Too many failed attempts. Please try again later.';
          break;
        case 'auth/invalid-credential':
          userMessage = 'Invalid email or password. Please check your credentials.';
          break;
        default:
          userMessage = 'Sign in failed. Please try again.';
      }
      throw new Error(userMessage);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    profile: { firstName: string; lastName: string; phone: string; role?: 'customer' | 'superadmin' }
  ) => {
    if (!email?.trim() || !password?.trim()) {
      throw new Error('Email and password are required');
    }
    if (!profile.firstName?.trim() || !profile.lastName?.trim()) {
      throw new Error('First name and last name are required');
    }
    if (!profile.phone?.trim()) {
      throw new Error('Phone number is required');
    }

    const trimmedEmail = email.trim().toLowerCase();
    console.log('Attempting sign up for:', trimmedEmail);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      const newUser = userCredential.user;
      console.log('User account created, UID:', newUser.uid);

      const userProfileData: Partial<UserProfile> = {
        id: newUser.uid,
        email: newUser.email || trimmedEmail,
        firstName: profile.firstName.trim(),
        lastName: profile.lastName.trim(),
        phone: profile.phone.trim(),
        role: profile.role || 'customer',
        createdAt: serverTimestamp() as unknown as Date,
        updatedAt: serverTimestamp() as unknown as Date,
        passwordSet: true, // Add this field
      };

      await setDoc(doc(db, 'users', newUser.uid), userProfileData);
      console.log('User profile saved to Firestore');
      // Don't call refreshUserProfile here - it will be called by the auth state change listener
    } catch (error: any) {
      console.error('Sign up error:', error);
      let userMessage;
      switch (error.code) {
        case 'auth/email-already-in-use':
          userMessage = 'An account with this email already exists.';
          break;
        case 'auth/invalid-email':
          userMessage = 'Please enter a valid email address.';
          break;
        case 'auth/weak-password':
          userMessage = 'Password should be at least 6 characters long.';
          break;
        case 'auth/operation-not-allowed':
          userMessage = 'Account creation is currently disabled.';
          break;
        default:
          userMessage = 'Account creation failed. Please try again.';
      }
      throw new Error(userMessage);
    }
  };

  const updateUserProfile = async (
    profile: { 
      firstName: string; 
      lastName: string; 
      phone: string; 
      nationalId?: string; 
      sex?: string; 
      currentAddress?: string; 
      role?: 'customer' | 'superadmin' | 'company_admin'; 
      companyId?: string 
    }
  ) => {
    if (!user?.uid) {
      throw new Error('No authenticated user found');
    }
    if (!profile.firstName?.trim() || !profile.lastName?.trim()) {
      throw new Error('First name and last name are required');
    }
    if (!profile.phone?.trim()) {
      throw new Error('Phone number is required');
    }

    try {
      const userProfileData: Partial<UserProfile> = {
        firstName: profile.firstName.trim(),
        lastName: profile.lastName.trim(),
        phone: profile.phone.trim(),
        nationalId: profile.nationalId || null,
        sex: profile.sex || null,
        currentAddress: profile.currentAddress || null,
        role: profile.role || (userProfile?.role || 'customer'),
        companyId: profile.companyId || null,
        updatedAt: serverTimestamp() as unknown as Date,
      };

      await setDoc(doc(db, 'users', user.uid), userProfileData, { merge: true });
      console.log('User profile updated successfully');
      await refreshUserProfile(); // Refresh the profile after update
    } catch (error: any) {
      console.error('Error updating user profile:', error);
      throw new Error('Profile update failed. Please try again.');
    }
  };

  const signOutUser = async () => {
    console.log('Attempting sign out');
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

  const setSuperAdmin = async (uid: string) => {
    if (!uid) throw new Error('UID is required');
    try {
      const userDocRef = doc(db, 'users', uid);
      await updateDoc(userDocRef, { 
        role: 'superadmin', 
        updatedAt: serverTimestamp() as unknown as Date 
      });
      console.log('User set as superadmin:', uid);
      if (user?.uid === uid) await refreshUserProfile();
    } catch (error: any) {
      console.error('Error setting superadmin:', error);
      throw new Error('Failed to set superadmin role.');
    }
  };

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

  // Show skeleton loader during initial load
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center mb-12">
            <div className="text-center lg:text-left animate-pulse">
              <div className="inline-flex items-center px-4 py-2 bg-gray-200 rounded-full text-sm font-medium mb-6 w-64 h-8"></div>
              <div className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-200 mb-6 leading-tight h-24"></div>
              <div className="text-lg sm:text-xl text-gray-200 max-w-2xl mx-auto lg:mx-0 leading-relaxed mb-8 h-16"></div>
              <div className="flex flex-wrap gap-6 justify-center lg:justify-start h-16">
                <div className="w-40 h-6 bg-gray-200 rounded"></div>
                <div className="w-40 h-6 bg-gray-200 rounded"></div>
                <div className="w-40 h-6 bg-gray-200 rounded"></div>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mt-6 h-12">
                <div className="w-40 h-10 bg-gray-200 rounded"></div>
                <div className="w-40 h-10 bg-gray-200 rounded"></div>
              </div>
            </div>
            <div className="relative w-full max-w-lg mx-auto">
              <div className="w-full h-64 bg-gray-200 rounded-2xl animate-pulse"></div>
              <div className="absolute -top-4 -right-4 w-16 h-16 bg-gray-200 rounded-full"></div>
              <div className="absolute -bottom-4 -left-4 w-14 h-14 bg-gray-200 rounded-full"></div>
              <div className="absolute top-8 left-8 w-8 h-8 bg-gray-200 rounded-full"></div>
              <div className="absolute bottom-12 right-12 w-6 h-6 bg-gray-200 rounded-full"></div>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-12">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="bg-gray-200 rounded-2xl p-6 h-32 animate-pulse"></div>
            ))}
          </div>
          <div className="bg-gray-200 rounded-3xl p-6 lg:p-8 h-64 animate-pulse"></div>
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

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};