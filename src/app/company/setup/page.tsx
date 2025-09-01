'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth, db } from '@/lib/firebaseConfig';
import { 
  confirmPasswordReset, 
  signInWithEmailAndPassword,
  verifyPasswordResetCode,
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
  CheckCircle, 
  AlertCircle, 
  Eye, 
  EyeOff,
  Building2,
  Lock,
  Mail 
} from 'lucide-react';

interface CompanyData {
  id: string;
  name: string;
  email: string;
  adminUserId: string;
  status: string;
  setupCompleted: boolean;
}

function CompanySetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, refreshUserProfile } = useAuth();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{
    password?: string;
    confirmPassword?: string;
    general?: string;
  }>({});

  const oobCode = searchParams.get('oobCode');
  const continueUrl = searchParams.get('continueUrl');

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const oobCode = searchParams.get('oobCode');
    const continueUrl = searchParams.get('continueUrl');
    const companyIdFromUrl = searchParams.get('companyId') || (continueUrl ? new URL(continueUrl).searchParams.get('companyId') : null);
    console.log('Search params:', Object.fromEntries(searchParams), 'continueUrl:', continueUrl, 'companyIdFromUrl:', companyIdFromUrl);
    if (companyIdFromUrl) {
      fetchCompanyDetails(companyIdFromUrl);
    } else if (!oobCode) {
      setErrors({ general: 'Invalid setup link. Please check your email.' });
    }
  }, []);

  const fetchCompanyDetails = async (companyId: string) => {
    setLoading(true);
    try {
      console.log('Fetching company with id:', companyId);
      const companyDoc = await getDoc(doc(db, 'companies', companyId));
      if (companyDoc.exists()) {
        const data = companyDoc.data();
        console.log('Company data fetched:', data);
        setCompany({ id: companyDoc.id, ...data } as CompanyData);
      } else {
        console.log('Company document not found for id:', companyId);
        setErrors({ general: 'Company not found. Contact support.' });
      }
    } catch (error) {
      console.error('Fetch error:', error);
      setErrors({ general: 'Failed to load company details. Check Firestore rules or connection.' });
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
    console.log('Setting password - oobCode:', oobCode, 'company:', company, 'User:', user);
    if (!oobCode || !company) {
      setErrors({ general: 'Invalid setup link or missing company data.' });
      return;
    }
    const passwordError = validatePassword(password);
    const confirmError = password !== confirmPassword ? 'Passwords do not match' : null;
    if (passwordError || confirmError) {
      setErrors({ password: passwordError, confirmPassword: confirmError });
      return;
    }
    setLoading(true);
    setErrors({});
    try {
      console.log('Verifying oobCode:', oobCode);
      await verifyPasswordResetCode(auth, oobCode);
      console.log('oobCode verified');
      console.log('Confirming password reset');
      await confirmPasswordReset(auth, oobCode, password);
      console.log('Signing in');
      await signInWithEmailAndPassword(auth, company.email, password);
      console.log('Updating user');
      await updateDoc(doc(db, 'users', company.adminUserId), { 
        passwordSet: true,
        role: 'company_admin',
        setupCompleted: false,
        updatedAt: Timestamp.now()
      });
      await refreshUserProfile();
      // Redirect to admin dashboard with setup pending
      router.push('/company/admin?setup=pending');
    } catch (error: any) {
      console.error('Password setup error:', error);
      let msg = 'Failed to set password.';
      if (error.code === 'auth/invalid-action-code') msg = 'Invalid or expired link.';
      if (error.code === 'auth/expired-action-code') msg = 'Link expired.';
      setErrors({ general: msg });
    }
    setLoading(false);
  };

  const resendSetupEmail = async () => {
    if (!company) return;
    try {
      await sendPasswordResetEmail(auth, company.email);
      setErrors({ general: 'New setup email sent!' });
    } catch (error) {
      setErrors({ general: 'Failed to resend email. Contact support.' });
    }
  };

  const ErrorAlert = ({ message }: { message: string }) => (
    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
      <AlertCircle className="w-5 h-5 text-red-600" />
      <div className="text-red-700">{message}</div>
    </div>
  );

  if (!company && !errors.general && loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Building2 className="mx-auto h-12 w-12 text-blue-600" />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Set Your Password</h2>
          <p className="mt-2 text-sm text-gray-600">Welcome to {company?.name}! Set your password.</p>
        </div>
        {errors.general && <ErrorAlert message={errors.general} />}
        <form className="mt-8 space-y-6" onSubmit={handleSetPassword}>
          <div className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">New Password</label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full px-3 py-2 border ${errors.password ? 'border-red-300' : 'border-gray-300'} rounded-md focus:ring-blue-500 focus:border-blue-500`}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">Confirm Password</label>
              <div className="mt-1 relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full px-3 py-2 border ${errors.confirmPassword ? 'border-red-300' : 'border-gray-300'} rounded-md focus:ring-blue-500 focus:border-blue-500`}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}
                </button>
              </div>
              {errors.confirmPassword && <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>}
            </div>
          </div>
          <p className="text-xs text-gray-500">Must be 8+ characters with uppercase, lowercase, and a number.</p>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>
              <Lock className="w-5 h-5 mr-2" /> Set Password & Continue
            </>}
          </button>
          <button
            type="button"
            onClick={resendSetupEmail}
            className="text-sm text-blue-600 hover:text-blue-500 text-center w-full"
          >
            Didn't receive the email? Resend setup link
          </button>
        </form>
      </div>
    </div>
  );
}

export default function CompanySetup() {
  return (
    <Suspense 
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        </div>
      }
    >
      <CompanySetupContent />
    </Suspense>
  );
}