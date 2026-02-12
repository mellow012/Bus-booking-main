'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebaseConfig';
import { 
  confirmPasswordReset, 
  signInWithEmailAndPassword,
  verifyPasswordResetCode,
  sendPasswordResetEmail
} from 'firebase/auth';
import { 
  doc, 
  updateDoc, 
  getDoc, 
  Timestamp 
} from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Loader2, 
  AlertCircle, 
  Eye, 
  EyeOff,
  Building2,
  Lock
} from 'lucide-react';

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
  const [oobCodeState, setOobCodeState] = useState<string | null>(null);
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{
    password?: string;
    confirmPassword?: string;
    general?: string;
  }>({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('oobCode');
    const continueUrl = params.get('continueUrl');
    
    if (code) setOobCodeState(code);

    let idToFetch = params.get('companyId') || params.get('operatorId') || params.get('conductorId') || null;
    let detectedType: 'company' | 'operator' | 'conductor' = 
      params.get('conductorId') ? 'conductor' : params.get('operatorId') ? 'operator' : 'company';

    if (!idToFetch && continueUrl) {
      try {
        const decodedUrl = new URL(continueUrl);
        const opId = decodedUrl.searchParams.get('operatorId');
        const compId = decodedUrl.searchParams.get('companyId');
        const condId = decodedUrl.searchParams.get('conductorId');
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
      const collectionName = type === 'company' ? 'companies' : type === 'operator' ? 'operators' : 'conductors';
      const docSnap = await getDoc(doc(db, collectionName, id));

      if (docSnap.exists()) {
        const data = docSnap.data();
        setSetupData({
          id: docSnap.id,
          name: data.name || data.companyName || 'New User',
          email: data.email,
          targetUserId: type === 'company' ? data.adminUserId : data.uid,
          type: type,
          companyId: data.companyId
        });
      } else {
        const otherTypes = type === 'company' ? ['operator', 'conductor'] : type === 'operator' ? ['company', 'conductor'] : ['company', 'operator'];
        let found = false;
        
        for (const otherType of otherTypes) {
          const otherColl = otherType === 'company' ? 'companies' : otherType === 'operator' ? 'operators' : 'conductors';
          const otherSnap = await getDoc(doc(db, otherColl, id));
          
          if (otherSnap.exists()) {
            const oData = otherSnap.data();
            setSetupData({
              id: otherSnap.id,
              name: oData.name || oData.companyName || 'New User',
              email: oData.email,
              targetUserId: otherType === 'company' ? oData.adminUserId : oData.uid,
              type: otherType as 'company' | 'operator' | 'conductor',
              companyId: oData.companyId
            });
            found = true;
            break;
          }
        }
        
        if (!found) {
          setErrors({ general: 'Account record not found.' });
        }
      }
    } catch (error) {
      setErrors({ general: 'Failed to load details. Please refresh.' });
    } finally {
      setLoading(false);
    }
  };

  const validatePassword = (pwd: string): string | null => {
    if (!pwd) return 'Password is required';
    if (pwd.length < 8) return 'Password must be at least 8 characters';
    if (!/(?=.*[a-z])/.test(pwd)) return 'Must include a lowercase letter';
    if (!/(?=.*[A-Z])/.test(pwd)) return 'Must include an uppercase letter';
    if (!/(?=.*\d)/.test(pwd)) return 'Must include a number';
    return null;
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!oobCodeState || !setupData) {
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
      // 1. Verify and Update Auth Password
      await verifyPasswordResetCode(auth, oobCodeState);
      await confirmPasswordReset(auth, oobCodeState, password);
      
      // 2. Log in
      await signInWithEmailAndPassword(auth, setupData.email, password);
      
      // 3. Update the Users Document
      await updateDoc(doc(db, 'users', setupData.targetUserId), { 
        passwordSet: true,
        updatedAt: Timestamp.now()
      });

      // 4. Update role-specific status if applicable
      if (setupData.type === 'operator' || setupData.type === 'conductor') {
        const collectionName = setupData.type === 'operator' ? 'operators' : 'conductors';
        await updateDoc(doc(db, collectionName, setupData.id), {
          status: 'active',
          signupCompletedAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      }

      await refreshUserProfile();
      
      // 5. Dynamic Redirect based on type
      if (setupData.type === 'operator') {
        // Redirect to operator dashboard with companyId
        router.push(`/operator/dashboard?companyId=${setupData.companyId}`);
      } else if (setupData.type === 'conductor') {
        // Redirect to conductor dashboard with companyId
        router.push(`/conductor/dashboard?companyId=${setupData.companyId}`);
      } else {
        // Company admin redirect
        router.push('/company/admin?setup=pending');
      }

    } catch (error: any) {
      console.error('Setup error:', error);
      let msg = 'Failed to set password.';
      if (error.code === 'auth/invalid-action-code') msg = 'Link expired or already used.';
      if (error.code === 'auth/user-disabled') msg = 'Account is disabled.';
      if (error.code === 'auth/expired-action-code') msg = 'This link has expired. Please request a new one.';
      setErrors({ general: msg });
    } finally {
      setLoading(false);
    }
  };

  const resendSetupEmail = async () => {
    if (!setupData) return;
    try {
      await sendPasswordResetEmail(auth, setupData.email);
      setErrors({ general: 'A new setup link has been sent to your email.' });
    } catch (error) {
      setErrors({ general: 'Failed to resend email.' });
    }
  };

  if (!setupData && !errors.general && loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Building2 className="mx-auto h-12 w-12 text-blue-600" />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Set Your Password</h2>
          <p className="mt-2 text-sm text-gray-600">
            Welcome, {setupData?.name || 'User'}! Please secure your account.
          </p>
          {setupData?.type === 'operator' && (
            <p className="mt-1 text-xs text-blue-600">
              Setting up your operator account
            </p>
          )}
          {setupData?.type === 'conductor' && (
            <p className="mt-1 text-xs text-blue-600">
              Setting up your conductor account
            </p>
          )}
        </div>

        {errors.general && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-700 text-sm font-medium">{errors.general}</p>
                {errors.general.includes('expired') && (
                  <button
                    onClick={resendSetupEmail}
                    className="mt-2 text-xs text-blue-600 hover:underline"
                  >
                    Request new link
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSetPassword}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={setupData?.email || ''}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 pr-10"
                  placeholder="Enter a strong password"
                />
                <button 
                  type="button" 
                  className="absolute inset-y-0 right-0 pr-3 flex items-center" 
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Must be 8+ characters with uppercase, lowercase, and number
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 pr-10"
                  placeholder="Confirm your password"
                />
                <button 
                  type="button" 
                  className="absolute inset-y-0 right-0 pr-3 flex items-center" 
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center gap-2 py-3 px-4 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Setting up...
              </>
            ) : (
              <>
                <Lock className="w-5 h-5" />
                Complete Setup
              </>
            )}
          </button>
        </form>

        <div className="text-center">
          <p className="text-xs text-gray-500">
            Already completed setup?{' '}
            <a href="/login" className="text-blue-600 hover:underline">
              Sign in here
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function CompanySetup() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    }>
      <CompanySetupContent />
    </Suspense>
  );
}