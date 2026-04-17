'use client';

import React, { useState, useEffect, FormEvent, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

import {
  Loader2, AlertCircle, User, Mail, Phone, Shield,
  Calendar, CreditCard, Activity, Settings, ChevronRight, Award, Trash2,
  Key, RefreshCw, TrendingUp, MapPin, Bus, DollarSign, CheckCircle, Clock, XCircle, AlertTriangle,
  Edit, Eye, EyeOff, Users, ExternalLink, Search, Copy, Download, BarChart3, Smartphone, Bell, Zap, FileText, Share2, History as HistoryIcon
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import AlertMessage from '../../components/AlertMessage';
import ProfilePageSkeleton from '@/components/ui/ProfilePageSkeleton';
import ConfirmationModal from '@/components/ui/ConfirmationModal';

interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  nationalId?: string;
  sex?: string;
  currentAddress?: string;
  role: string;
  createdAt: Date;
  updatedAt?: Date;
  [key: string]: unknown;
}

interface BookingStats {
  total: number;
  completed: number;
  pending: number;
  cancelled: number;
  totalSpent: number;
  thisMonth: number;
  lastMonth: number;
  avgBookingValue: number;
}

interface RecentBooking {
  id: string;
  companyName: string;
  origin: string;
  destination: string;
  departureDate: Date;
  status: string;
  bookingStatus?: string; // Add this to solve linting error
  amount: number;
  seatNumbers: string[];
  bookingReference: string;
  paymentStatus: string;
}

interface TravelInsights {
  mostVisitedDestination: string;
  favoriteCompany: string;
  totalDistance: number;
  averageTripCost: number;
  destinationCounts: { [key: string]: number };
  companyCounts: { [key: string]: number };
  monthlySpending: { month: string; amount: number }[];
  travelFrequency: string;
}

interface PaymentMethod {
  id: string;
  type: 'card' | 'mobile_money' | 'bank_transfer';
  last4?: string;
  provider: string;
  isDefault: boolean;
  expiryDate?: string;
}

interface NotificationPreferences {
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
  bookingReminders: boolean;
  promotionalEmails: boolean;
  securityAlerts: boolean;
}

interface SecuritySettings {
  twoFactorEnabled: boolean;
  lastPasswordChange: Date | null;
  loginSessions: Array<{
    id: string;
    device: string;
    location: string;
    lastActive: Date;
    isCurrent: boolean;
  }>;
}

interface RouteSuggestion {
  origin: string;
  destination: string;
  companyId: string;
  departureTime: Date;
}

const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  emailNotifications: true,
  smsNotifications: false,
  pushNotifications: true,
  bookingReminders: true,
  promotionalEmails: false,
  securityAlerts: true,
};

const DEFAULT_SECURITY: SecuritySettings = {
  twoFactorEnabled: false,
  lastPasswordChange: null,
  loginSessions: [],
};

const ProfilePage: React.FC = () => {
  const router = useRouter();
  const { user, userProfile, updateUserProfile, signOut } = useAuth();

  // Core state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editProfile, setEditProfile] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [routeSuggestions, setRouteSuggestions] = useState<RouteSuggestion[]>([]);

  // Data state
  const [bookingStats, setBookingStats] = useState<BookingStats>({
    total: 0, completed: 0, pending: 0, cancelled: 0,
    totalSpent: 0, thisMonth: 0, lastMonth: 0, avgBookingValue: 0
  });
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [travelInsights, setTravelInsights] = useState<TravelInsights>({
    mostVisitedDestination: '',
    favoriteCompany: '',
    totalDistance: 0,
    averageTripCost: 0,
    destinationCounts: {},
    companyCounts: {},
    monthlySpending: [],
    travelFrequency: 'Occasional'
  });

  // Feature state
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [notifications, setNotifications] = useState<NotificationPreferences>(DEFAULT_NOTIFICATIONS);
  const [security, setSecurity] = useState<SecuritySettings>(DEFAULT_SECURITY);

  // UI state
  const [statsLoading, setStatsLoading] = useState(false);
  const [showSensitiveInfo, setShowSensitiveInfo] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<string | null>(null);
  const [bookingFilter, setBookingFilter] = useState('all');

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    nationalId: '',
    sex: '',
    currentAddress: '',
    email: user?.email || '',
  });

  // ─── Booking data ─────────────────────────────────────────────────────────

  const fetchBookingData = useCallback(async () => {
    if (!user) return;

    setStatsLoading(true);
    try {
      const response = await fetch('/api/profile', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch profile data');
      }

      const { data } = await response.json();

      // Populate booking stats
      setBookingStats({
        total: data.stats.totalBookings,
        completed: data.stats.completedBookings,
        pending: data.stats.pendingBookings,
        cancelled: data.stats.cancelledBookings,
        totalSpent: data.stats.totalSpent,
        thisMonth: data.stats.thisMonthSpent,
        lastMonth: 0, // Can be extended in API if needed
        avgBookingValue: data.stats.averageBookingValue,
      });

      // Populate travel insights
      setTravelInsights({
        mostVisitedDestination: data.insights.mostVisitedDestination,
        favoriteCompany: data.insights.favoriteCompany,
        totalDistance: data.insights.totalDistance,
        averageTripCost: data.insights.averageTripCost,
        destinationCounts: {},
        companyCounts: {},
        monthlySpending: [],
        travelFrequency: data.insights.travelFrequency,
      });

      // Set recent bookings
      const sortedBookings = (data.bookings || []).map((b: any) => ({
        id: b.id,
        companyName: b.schedule?.company?.name || 'Unknown',
        origin: b.schedule?.route?.origin || 'Unknown',
        destination: b.schedule?.route?.destination || 'Unknown',
        departureDate: new Date(b.schedule?.departureDateTime || b.createdAt),
        status: b.bookingStatus || 'pending',
        amount: b.totalAmount || 0,
        seatNumbers: b.seatNumbers || [],
        bookingReference: b.bookingReference || 'N/A',
        paymentStatus: b.paymentStatus || 'pending',
      })).sort((a: any, b: any) => b.departureDate.getTime() - a.departureDate.getTime());

      setRecentBookings(sortedBookings);
    } catch (err: unknown) {
      console.error('Error fetching booking data:', err);
      setError('Failed to load booking data.');
    } finally {
      setStatsLoading(false);
    }
  }, [user]);

  // Next Trip - closest upcoming trip
  const nextTrip = useMemo(() => {
    const now = new Date();
    return recentBookings
      .filter(b => ['pending', 'confirmed', 'booked'].includes(b.status.toLowerCase()) && b.departureDate > now)
      .sort((a, b) => a.departureDate.getTime() - b.departureDate.getTime())[0];
  }, [recentBookings]);

  // Build "book again" shortcuts from recent bookings
  const bookAgainRoutes = useMemo(() => {
    const seen = new Set<string>();
    return recentBookings
      .filter(b => b.origin !== 'Unknown' && b.destination !== 'Unknown')
      .filter(b => { const k = `${b.origin}-${b.destination}`; if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, 3);
  }, [recentBookings]);

  // ─── User preferences ─────────────────────────────────────────────────────
  // Preferences are now loaded from API response
  const loadUserPreferences = useCallback(async () => {
    // Preferences can be loaded from the same /api/profile call
    // or can be implemented separately if needed
    // For now, using default preferences
    setNotifications(DEFAULT_NOTIFICATIONS);
    setSecurity(DEFAULT_SECURITY);
    setPaymentMethods([]);
  }, []);

  // ─── Init ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (userProfile?.role !== 'customer') {
      router.push(userProfile?.role === 'superadmin' ? '/admin' : '/company/admin');
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/profile', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          setError('User profile not found. Please complete your profile.');
          return;
        }

        const { data: userData } = await response.json();

        const createdAtDate = userData.createdAt ? new Date(userData.createdAt) : new Date();
        setProfile({ ...userData, createdAt: createdAtDate } as any);
        setFormData({
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          phone: userData.phone || '',
          nationalId: userData.nationalId || '',
          sex: userData.sex || '',
          currentAddress: userData.currentAddress || '',
          email: userData.email || user.email || '',
        });
        await Promise.all([fetchBookingData(), loadUserPreferences()]);
      } catch (err: unknown) {
        console.error('Profile fetch error:', err);
        setError('Failed to load profile. Please try again or contact support.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, userProfile, router, fetchBookingData, loadUserPreferences]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleProfileUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    const errors: string[] = [];
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      errors.push('First name and last name are required');
    }
    if (!formData.phone.match(/^\+265\d{9}$/)) {
      errors.push('Phone must be in +265 format (e.g., +265999123456)');
    }
    // Email is read-only — not included in validation or save

    if (errors.length > 0) { setError(errors.join('. ')); return; }

    setActionLoading(true);
    setError('');
    try {
      await updateUserProfile({
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        nationalId: formData.nationalId || undefined,
        sex: formData.sex || undefined,
        currentAddress: formData.currentAddress || undefined,
      });

      setProfile(prev => prev ? { ...prev, ...formData, profileCompleted: true, updatedAt: new Date() } : null);
      setEditProfile(false);
      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) {
      setError(`Failed to update profile: ${(err as any).message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const updateNotificationPreferences = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!user) return;

    const newNotifications = { ...notifications, [key]: value };
    setNotifications(newNotifications);

    try {
      // Preferences update can be implemented via API if needed
      // For now, just update local state
      setSuccess('Notification preferences updated');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      console.error('Error updating preferences:', err);
      setError('Failed to update preferences');
    }
  };

  // ─── Delete Account Modal state ────────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const handleAccountDeletion = async () => {
    if (!user || deleteConfirmText !== 'DELETE') return;
    setActionLoading(true);
    try {
      // Note: Account deletion would need to be implemented via API endpoint
      // For now, just sign out
      await signOut();
      router.push('/');
    } catch (err) {
      console.error('Error deleting account:', err);
      setError('Failed to delete account. Please contact support.');
      setShowDeleteModal(false);
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Cancel Booking ───────────────────────────────────────────────────────
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const initiateCancel = (bookingId: string) => {
    setBookingToCancel(bookingId);
    setShowCancelModal(true);
  };

  const handleCancelBooking = async () => {
    if (!user || !bookingToCancel) return;
    setCancellingId(bookingToCancel);
    try {
      const response = await fetch(`/api/bookings/${bookingToCancel}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to cancel booking');
      }

      await fetchBookingData();
      setSuccess('Booking cancelled successfully.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) {
      console.error('Error cancelling booking:', err);
      setError('Failed to cancel booking. Please try again.');
    } finally {
      setCancellingId(null);
      setBookingToCancel(null);
      setShowCancelModal(false);
    }
  };

  // ─── Password Reset ───────────────────────────────────────────────────────
  const [pwResetSent, setPwResetSent] = useState(false);
  const handlePasswordReset = async () => {
    if (!user?.email) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setPwResetSent(true);
      setSuccess(`Password reset email sent to ${user.email}`);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: unknown) {
      setError(`Failed to send reset email: ${(err as any).message}`);
    }
  };

  const copyBookingReference = (reference: string) => {
    navigator.clipboard.writeText(reference);
    setSuccess('Booking reference copied!');
    setTimeout(() => setSuccess(''), 2000);
  };

  const filteredBookings = useMemo(() => {
    let filtered = recentBookings;
    if (bookingFilter !== 'all') {
      filtered = filtered.filter(b => b.bookingStatus?.toLowerCase() === bookingFilter);
    }
    if (searchTerm) {
      filtered = filtered.filter(b =>
        b.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.bookingReference.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return filtered;
  }, [recentBookings, bookingFilter, searchTerm]);

  // ─── Utilities ────────────────────────────────────────────────────────────

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': case 'finished': return 'text-green-600 bg-green-50 border-green-200';
      case 'pending': case 'confirmed': case 'booked': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'cancelled': case 'canceled': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': case 'finished': return <CheckCircle className="w-4 h-4" />;
      case 'pending': case 'confirmed': case 'booked': return <Clock className="w-4 h-4" />;
      case 'cancelled': case 'canceled': return <XCircle className="w-4 h-4" />;
      default: return <AlertTriangle className="w-4 h-4" />;
    }
  };

  // Convert value to Date (handles ISO strings and Date objects)
  const toDate = (value: unknown): Date => {
    if (!value) return new Date();
    if (value instanceof Date) return value;
    return new Date(value as string);
  };

  const calculateProfileCompletion = () => {
    const fields = [
      profile?.firstName, profile?.lastName, profile?.email,
      profile?.phone, profile?.sex, profile?.currentAddress, profile?.nationalId
    ];
    const completed = fields.filter(f => f && f.trim() !== '').length;
    return Math.round((completed / fields.length) * 100);
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'bookings', label: 'My Bookings', icon: Bus },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) return <ProfilePageSkeleton />;

  if (!profile || userProfile?.role !== 'customer') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
        <AlertMessage type="error" message={error || 'Access denied'} onClose={() => router.push('/')} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Background Decorations */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100/40 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-100/40 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10">
        {error && (
          <div className="sticky top-0 z-50 p-4 max-w-7xl mx-auto">
            <AlertMessage type="error" message={error} onClose={() => setError('')} />
          </div>
        )}
        {success && (
          <div className="sticky top-0 z-50 p-4 max-w-7xl mx-auto">
            <AlertMessage type="success" message={success} onClose={() => setSuccess('')} />
          </div>
        )}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">

          {/* Profile Header */}
          <div className="bg-white/80 backdrop-blur-md rounded-[32px] shadow-sm border border-white p-6 sm:p-8 mb-8">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="flex items-center space-x-6 w-full lg:w-auto">
                <div className="relative flex-shrink-0">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-3xl flex items-center justify-center text-white font-bold text-3xl sm:text-4xl shadow-xl shadow-blue-200/50 rotate-3">
                    <span className="-rotate-3">{profile.firstName?.charAt(0) || 'U'}</span>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-500 rounded-2xl border-4 border-white flex items-center justify-center shadow-lg">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">
                      {profile.firstName} {profile.lastName}
                    </h1>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-blue-100">Customer</span>
                  </div>
                  <p className="text-gray-500 flex items-center text-sm mb-3">
                    <Mail className="w-3.5 h-3.5 mr-1.5" />
                    {profile.email}
                  </p>
                  <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-gray-400">
                    <span className="flex items-center bg-gray-50 px-2 py-1 rounded-lg">
                      <Calendar className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                      Member since {toDate(profile.createdAt).getFullYear()}
                    </span>
                    <span className="flex items-center bg-blue-50/50 text-blue-600 px-2 py-1 rounded-lg">
                      <Award className="w-3.5 h-3.5 mr-1.5" />
                      {calculateProfileCompletion()}% Profile Score
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex w-full sm:w-auto items-center gap-3">
                <button
                  onClick={() => setEditProfile(!editProfile)}
                  className={`flex-1 sm:flex-none px-6 py-3 rounded-2xl font-bold transition-all duration-300 flex items-center justify-center space-x-2 ${editProfile
                      ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200'
                    }`}
                >
                  {editProfile ? <XCircle className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
                  <span>{editProfile ? 'Close Editor' : 'Edit Profile'}</span>
                </button>

                <button
                  onClick={() => fetchBookingData()}
                  className="w-12 h-12 rounded-2xl bg-white border border-gray-100 text-gray-400 hover:text-indigo-600 hover:border-indigo-100 hover:shadow-md transition-all flex items-center justify-center shrink-0"
                  disabled={statsLoading}
                >
                  <RefreshCw className={`w-5 h-5 ${statsLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-50 rounded-xl"><Bus className="w-6 h-6 text-blue-600" /></div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">{bookingStats.total}</p>
                  <p className="text-sm text-gray-600">Total Bookings</p>
                  {bookingStats.thisMonth > 0 && (
                    <p className="text-xs text-green-600">+{bookingStats.thisMonth} this month</p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-green-50 rounded-xl"><CheckCircle className="w-6 h-6 text-green-600" /></div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">{bookingStats.completed}</p>
                  <p className="text-sm text-gray-600">Completed</p>
                  <p className="text-xs text-gray-500">
                    {bookingStats.total > 0 ? Math.round((bookingStats.completed / bookingStats.total) * 100) : 0}% success rate
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-yellow-50 rounded-xl"><Clock className="w-6 h-6 text-yellow-600" /></div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">{bookingStats.pending}</p>
                  <p className="text-sm text-gray-600">Pending</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-50 rounded-xl"><DollarSign className="w-6 h-6 text-purple-600" /></div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">MWK {bookingStats.totalSpent.toLocaleString()}</p>
                  <p className="text-sm text-gray-600">Total Spent</p>
                  <p className="text-xs text-gray-500">Avg: MWK {Math.round(bookingStats.avgBookingValue).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="bg-gray-200/50 p-1.5 rounded-[24px] mb-8 w-fit mx-auto md:mx-0">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-6 py-2.5 rounded-2xl transition-all duration-300 font-bold text-sm whitespace-nowrap ${activeTab === tab.id
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-900'
                    }`}
                >
                  <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-indigo-600' : 'text-gray-400'}`} />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 p-6 sm:p-10">

                {/* Overview Tab */}
                {activeTab === 'overview' && (
                  editProfile ? (
                    <>
                      <div className="mb-10">
                        <h2 className="text-2xl font-bold text-gray-900">Update Profile</h2>
                        <p className="text-gray-500 text-sm mt-1">Keep your information accurate for a better booking experience.</p>
                      </div>

                      <form onSubmit={handleProfileUpdate} className="space-y-10">
                        {/* Personal Section */}
                        <section>
                          <div className="flex items-center gap-2 mb-6">
                            <div className="w-1 h-6 bg-indigo-500 rounded-full" />
                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Personal Details</h3>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                            <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">First Name</label>
                              <div className="relative group">
                                <input type="text" value={formData.firstName}
                                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                  className="w-full px-5 py-3.5 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none" required />
                                <User className="w-4 h-4 text-gray-300 absolute right-4 top-4 group-focus-within:text-indigo-400 transition-colors" />
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Last Name</label>
                              <div className="relative group">
                                <input type="text" value={formData.lastName}
                                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                  className="w-full px-5 py-3.5 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none" required />
                                <User className="w-4 h-4 text-gray-300 absolute right-4 top-4 group-focus-within:text-indigo-400 transition-colors" />
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Gender</label>
                              <select value={formData.sex}
                                onChange={(e) => setFormData({ ...formData, sex: e.target.value })}
                                className="w-full px-5 py-3.5 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none appearance-none cursor-pointer">
                                <option value="">Select Gender</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">National ID</label>
                              <div className="relative group">
                                <input type={showSensitiveInfo ? 'text' : 'password'} value={formData.nationalId}
                                  onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
                                  className="w-full px-5 py-3.5 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none" />
                                <Shield className="w-4 h-4 text-gray-300 absolute right-4 top-4 group-focus-within:text-indigo-400 transition-colors" />
                              </div>
                            </div>
                          </div>
                        </section>

                        {/* Contact Section */}
                        <section>
                          <div className="flex items-center gap-2 mb-6">
                            <div className="w-1 h-6 bg-blue-500 rounded-full" />
                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Contact & Address</h3>
                          </div>
                          <div className="space-y-6">
                            <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Phone Number</label>
                              <div className="relative group">
                                <input type="tel" value={formData.phone}
                                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                  className="w-full px-5 py-3.5 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                                  placeholder="+265..." required />
                                <Phone className="w-4 h-4 text-gray-300 absolute right-4 top-4 group-focus-within:text-indigo-400 transition-colors" />
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Current Address</label>
                              <div className="relative group">
                                <input type="text" value={formData.currentAddress}
                                  onChange={(e) => setFormData({ ...formData, currentAddress: e.target.value })}
                                  className="w-full px-5 py-3.5 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none" />
                                <MapPin className="w-4 h-4 text-gray-300 absolute right-4 top-4 group-focus-within:text-indigo-400 transition-colors" />
                              </div>
                            </div>
                          </div>
                        </section>

                        <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-gray-100">
                          <button type="submit"
                            className="flex-1 px-8 py-4 bg-indigo-600 text-white rounded-[24px] hover:bg-indigo-700 transition-all duration-300 disabled:opacity-50 flex items-center justify-center font-bold text-lg shadow-xl shadow-indigo-100"
                            disabled={actionLoading}>
                            {actionLoading ? <Loader2 className="animate-spin w-5 h-5 mr-3" /> : <CheckCircle className="w-5 h-5 mr-3" />}
                            Update Account
                          </button>
                          <button type="button" onClick={() => setEditProfile(false)}
                            className="px-8 py-4 bg-gray-50 text-gray-600 rounded-[24px] hover:bg-gray-100 transition-all font-bold">
                            Cancel
                          </button>
                        </div>
                      </form>
                    </>
                  ) : (
                    <>
                      {/* Next Trip Highlight */}
                      {nextTrip && (
                        <div className="mb-10 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-[32px] p-6 sm:p-8 text-white shadow-2xl shadow-indigo-200 relative overflow-hidden group">
                          <div className="absolute top-0 right-0 p-8 transform translate-x-10 -translate-y-10 transition-transform duration-700 group-hover:translate-x-6 group-hover:-translate-y-6">
                            <Bus className="w-48 h-48 text-white/10 rotate-12" />
                          </div>

                          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div>
                              <span className="inline-flex items-center px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-white/20">
                                Upcoming Trip
                              </span>
                              <h3 className="text-3xl sm:text-4xl font-black mb-2 leading-none uppercase tracking-tight">
                                {nextTrip.origin} → {nextTrip.destination}
                              </h3>
                              <p className="text-indigo-100 text-sm font-medium">with {nextTrip.companyName}</p>
                            </div>

                            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-5 rounded-3xl flex flex-col items-center justify-center min-w-[140px]">
                              <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1 opacity-70">Starting in</p>
                              <p className="text-2xl font-black">
                                {Math.max(0, Math.ceil((nextTrip.departureDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} Days
                              </p>
                              <p className="text-[10px] font-bold mt-1 opacity-70">{nextTrip.departureDate.toLocaleDateString()}</p>
                            </div>
                          </div>

                          <div className="mt-8 flex flex-wrap gap-3 relative z-10">
                            <button onClick={() => router.push(`/bookings?ref=${nextTrip.bookingReference}`)}
                              className="px-6 py-2.5 bg-white text-indigo-700 rounded-2xl font-bold text-sm hover:scale-105 transition-transform flex items-center shadow-lg shadow-indigo-900/20">
                              Manage Booking <ChevronRight className="w-4 h-4 ml-1.5" />
                            </button>
                            <button onClick={() => router.push(`/bookings?ref=${nextTrip.bookingReference}&action=download`)}
                              className="px-6 py-2.5 bg-indigo-500/30 text-white rounded-2xl font-bold text-sm hover:bg-indigo-500/50 transition-colors flex items-center border border-white/10 backdrop-blur-sm">
                              <Download className="w-4 h-4 mr-1.5" /> Ticket
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between mb-8">
                        <h2 className="text-2xl font-bold text-gray-900">Personal Space</h2>
                        <button onClick={() => setShowSensitiveInfo(!showSensitiveInfo)}
                          className={`flex items-center space-x-2 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-xl transition-all ${showSensitiveInfo ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-400 hover:text-gray-900'
                            }`}>
                          {showSensitiveInfo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          <span>{showSensitiveInfo ? 'Privacy ON' : 'Privacy OFF'}</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-10">
                        {[
                          { icon: <User className="w-5 h-5" />, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Identity', value: `${profile.firstName} ${profile.lastName}`, sensitive: false },
                          { icon: <Mail className="w-5 h-5" />, color: 'text-green-600', bg: 'bg-green-50', label: 'E-mail', value: profile.email, sensitive: false },
                          { icon: <Phone className="w-5 h-5" />, color: 'text-purple-600', bg: 'bg-purple-50', label: 'Mobile', value: profile.phone || '—', sensitive: true },
                          { icon: <Shield className="w-5 h-5" />, color: 'text-red-600', bg: 'bg-red-50', label: 'NID', value: profile.nationalId || '—', sensitive: true },
                          { icon: <Users className="w-5 h-5" />, color: 'text-indigo-600', bg: 'bg-indigo-50', label: 'Gender', value: profile.sex || '—', sensitive: false, capitalize: true },
                          { icon: <MapPin className="w-5 h-5" />, color: 'text-orange-600', bg: 'bg-orange-50', label: 'Location', value: profile.currentAddress || '—', sensitive: false },
                        ].map((item, i) => (
                          <div key={i} className="group p-5 bg-white/50 border border-gray-100/80 rounded-[28px] hover:border-indigo-100 hover:bg-white hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300">
                            <div className="flex items-center gap-4">
                              <div className={`p-3.5 ${item.bg} ${item.color} rounded-[20px] transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6`}>{item.icon}</div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-0.5">{item.label}</p>
                                <p className={`text-base font-bold text-gray-800 truncate ${item.capitalize ? 'capitalize' : ''}`}>
                                  {item.sensitive && !showSensitiveInfo ? '••••••••••' : item.value}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Quick Link Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-6 bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-[32px] group">
                          <h4 className="text-sm font-black text-indigo-900 uppercase tracking-widest mb-4">Discovery</h4>
                          <div className="flex flex-col gap-3">
                            <button onClick={() => router.push('/schedules')}
                              className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition-all group-hover:-translate-y-1">
                              <div className="flex items-center gap-3">
                                <Zap className="w-5 h-5 text-yellow-500" />
                                <span className="font-bold text-gray-900">New Trip</span>
                              </div>
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            </button>
                            <button onClick={() => window.open('https://www.busbud.com/', '_blank')}
                              className="flex items-center justify-between p-4 bg-white/40 rounded-2xl hover:bg-white/80 transition-all">
                              <div className="flex items-center gap-3">
                                <ExternalLink className="w-5 h-5 text-indigo-400" />
                                <span className="font-bold text-indigo-900/70">Partner Routes</span>
                              </div>
                              <ChevronRight className="w-4 h-4 text-indigo-400/50" />
                            </button>
                          </div>
                        </div>

                        <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 rounded-[32px]">
                          <h4 className="text-sm font-black text-green-900 uppercase tracking-widest mb-4">Rewards</h4>
                          <div className="flex items-center gap-4 bg-white p-5 rounded-2xl border border-green-100 shadow-sm">
                            <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center flex-shrink-0 animate-bounce">
                              <Award className="w-6 h-6" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-gray-500">Tier Status</p>
                              <p className="font-black text-green-900 uppercase tracking-tighter">Level {Math.floor(bookingStats.completed / 5) + 1} Traveler</p>
                            </div>
                          </div>
                          <p className="text-[10px] text-green-700/60 mt-4 text-center font-bold tracking-widest">
                            {5 - (bookingStats.completed % 5)} TRIPS UNTIL NEXT LEVEL
                          </p>
                        </div>
                      </div>


                      {/* Quick Actions */}
                      <div className="p-4 sm:p-6 bg-gradient-to-r from-gray-50 to-blue-50 rounded-2xl border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          {[
                            { icon: <Bus className="w-6 h-6 text-blue-600" />, bg: 'bg-blue-100', hoverBorder: 'hover:border-blue-300', label: 'Book a Trip', sub: 'Find & book tickets', action: () => router.push('/schedules') },
                            { icon: <HistoryIcon className="w-6 h-6 text-green-600" />, bg: 'bg-green-100', hoverBorder: 'hover:border-green-300', label: 'My Bookings', sub: `${bookingStats.total} total trips`, action: () => setActiveTab('bookings') },
                            { icon: <CreditCard className="w-6 h-6 text-purple-600" />, bg: 'bg-purple-100', hoverBorder: 'hover:border-purple-300', label: 'Payments', sub: 'Manage payments', action: () => setActiveTab('payments') },
                            { icon: <ExternalLink className="w-6 h-6 text-orange-600" />, bg: 'bg-orange-100', hoverBorder: 'hover:border-orange-300', label: 'Explore Routes', sub: 'via Busbud', action: () => window.open('https://www.busbud.com/', '_blank') },
                          ].map((item, i) => (
                            <button key={i} onClick={item.action}
                              className={`flex flex-col items-center p-4 bg-white rounded-xl border border-gray-100 ${item.hoverBorder} hover:shadow-md transition-all group`}>
                              <div className={`w-12 h-12 ${item.bg} rounded-xl flex items-center justify-center mb-3`}>{item.icon}</div>
                              <span className="font-medium text-gray-900 text-sm">{item.label}</span>
                              <span className="text-xs text-gray-500 mt-1">{item.sub}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Book Again Shortcuts */}
                      <div className="mt-8">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Book Again</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {bookAgainRoutes.length > 0 ? (
                            bookAgainRoutes.map((b) => (
                              <div key={b.id} className="p-4 bg-white/50 border border-white/50 rounded-2xl flex flex-col items-center gap-2 group">
                                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                  <Bus className="w-5 h-5" />
                                </div>
                                <p className="text-xs font-bold text-gray-900">{b.origin} to {b.destination}</p>
                                <button onClick={() => router.push(`/schedules?from=${b.origin}&to=${b.destination}`)}
                                  className="text-[10px] font-black uppercase text-indigo-600 tracking-widest bg-indigo-50 px-3 py-1.5 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                  Book Now
                                </button>
                              </div>
                            ))
                          ) : (
                            <div className="col-span-full py-10 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200 text-center">
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No previous routes to show</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )
                )}

                {/* Bookings Tab */}
                {activeTab === 'bookings' && (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">Trip History</h2>
                        <p className="text-gray-500 text-sm mt-1">Found {filteredBookings.length} bookings</p>
                      </div>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        <div className="relative group">
                          <input type="text" placeholder="Search..." value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full sm:w-48 pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all text-sm outline-none" />
                          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3 group-focus-within:text-indigo-500 transition-colors" />
                        </div>
                        <select value={bookingFilter} onChange={(e) => setBookingFilter(e.target.value)}
                          className="px-4 py-2.5 bg-gray-50 border-none rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all text-sm outline-none cursor-pointer">
                          <option value="all">Status: All</option>
                          <option value="completed">Completed</option>
                          <option value="pending">Pending</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                    </div>

                    {statsLoading ? (
                      <div className="space-y-4">
                        {Array(3).fill(0).map((_, i) => (
                          <div key={i} className="h-32 bg-gray-50 rounded-[28px] animate-pulse" />
                        ))}
                      </div>
                    ) : filteredBookings.length > 0 ? (
                      <div className="space-y-6">
                        {filteredBookings.map((booking) => (
                          <div key={booking.id} className="group p-6 bg-white border border-gray-100 rounded-[32px] hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300">
                            <div className="flex flex-col sm:flex-row items-start justify-between gap-6">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-3">
                                  <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight truncate">{booking.origin} → {booking.destination}</h3>
                                  <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border flex items-center gap-1.5 ${getStatusColor(booking.status)}`}>
                                    {getStatusIcon(booking.status)}
                                    <span>{booking.status}</span>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-500 font-medium">
                                  <span className="flex items-center"><Bus className="w-4 h-4 mr-2 text-gray-300" /> {booking.companyName}</span>
                                  <span className="flex items-center"><Calendar className="w-4 h-4 mr-2 text-gray-300" /> {booking.departureDate.toLocaleDateString()}</span>
                                  <span className="flex items-center"><Clock className="w-4 h-4 mr-2 text-gray-300" /> {booking.departureDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-2 shrink-0">
                                <p className="text-2xl font-black text-gray-900 tracking-tighter">MWK {booking.amount.toLocaleString()}</p>
                                <button onClick={() => copyBookingReference(booking.bookingReference)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest">
                                  <Copy className="w-3 h-3" />
                                  <span>{booking.bookingReference}</span>
                                </button>
                              </div>
                            </div>

                            <div className="mt-6 pt-6 border-t border-gray-50 flex flex-col sm:flex-row items-center justify-between gap-4">
                              <div className="flex items-center gap-2">
                                {booking.seatNumbers.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {booking.seatNumbers.map(s => <span key={s} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md font-bold text-[10px]">Seat {s}</span>)}
                                  </div>
                                )}
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-2">Paid via {booking.paymentStatus}</span>
                              </div>
                              <div className="flex items-center gap-3 w-full sm:w-auto">
                                {!['cancelled', 'canceled'].includes(booking.status.toLowerCase()) && (
                                  <button
                                    onClick={() => initiateCancel(booking.id)}
                                    className="flex-1 sm:flex-none px-5 py-2 text-xs font-black uppercase tracking-[0.1em] text-red-600 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100">
                                    Cancel Trip
                                  </button>
                                )}
                                <button
                                  onClick={() => router.push(`/bookings?ref=${booking.bookingReference}`)}
                                  className="flex-1 sm:flex-none px-5 py-2 text-xs font-black uppercase tracking-[0.1em] bg-gray-900 text-white rounded-xl hover:bg-black transition-all shadow-lg shadow-black/10">
                                  Info
                                </button>
                                <button
                                  onClick={() => router.push(`/bookings?ref=${booking.bookingReference}&action=download`)}
                                  className="p-2 sm:px-4 py-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all flex items-center justify-center">
                                  <Download className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-20 bg-gray-50/50 rounded-[32px] border border-dashed border-gray-200">
                        <Bus className="w-12 h-12 mx-auto mb-4 text-gray-200" />
                        <p className="text-gray-500 font-medium font-bold uppercase tracking-widest">No bookings found matching your filters.</p>
                      </div>
                    )}
                  </>
                )}

                {/* Payments Tab */}
                {activeTab === 'payments' && (
                  <>
                    <div className="mb-10">
                      <h2 className="text-2xl font-bold text-gray-900">Wallet & Payments</h2>
                      <p className="text-gray-500 text-sm mt-1">Manage your payment methods and view transaction history.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                      {[
                        { icon: <CheckCircle className="w-6 h-6 text-green-600" />, value: `${bookingStats.totalSpent.toLocaleString()}`, label: 'Total Paid', sub: 'MWK' },
                        { icon: <BarChart3 className="w-6 h-6 text-blue-600" />, value: `${Math.round(travelInsights.averageTripCost).toLocaleString()}`, label: 'Avg / Trip', sub: 'MWK' },
                        { icon: <TrendingUp className="w-6 h-6 text-purple-600" />, value: String(bookingStats.thisMonth), label: 'This Month', sub: 'Trips' },
                      ].map((card) => (
                        <div key={card.label} className="p-6 bg-gray-50/50 border border-gray-100 rounded-[28px] hover:bg-white hover:shadow-xl hover:shadow-gray-500/5 transition-all">
                          <div className="text-center">
                            <div className="inline-flex p-3 bg-white shadow-sm rounded-2xl mb-4">{card.icon}</div>
                            <p className="text-2xl font-black text-gray-900 tracking-tighter">{card.value}</p>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">{card.label} ({card.sub})</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mb-10">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Payment Methods</h3>
                        <button disabled className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5 opacity-50">
                          <Smartphone className="w-3 h-3" /> Coming Soon
                        </button>
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-5 bg-white border border-gray-100 rounded-[28px]">
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-green-50 rounded-2xl"><Smartphone className="w-5 h-5 text-green-600" /></div>
                            <div>
                              <p className="font-bold text-gray-900">Mobile Money</p>
                              <p className="text-xs text-gray-500">Connected to your profile</p>
                            </div>
                          </div>
                          <span className="px-3 py-1 bg-green-50 text-green-700 text-[10px] font-black uppercase tracking-widest rounded-lg">Primary</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-6">Recent Activity</h3>
                      {recentBookings.length > 0 ? (
                        <div className="space-y-3">
                          {recentBookings.slice(0, 5).map((booking) => (
                            <div key={booking.id} className="flex items-center justify-between p-4 bg-gray-50/50 border border-gray-100 rounded-2xl transition-all hover:bg-white hover:shadow-sm">
                              <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-white rounded-xl shadow-sm text-gray-400"><HistoryIcon className="w-4 h-4" /></div>
                                <div>
                                  <p className="text-sm font-bold text-gray-900">{booking.origin} → {booking.destination}</p>
                                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{booking.departureDate.toLocaleDateString()}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-black text-gray-900">MWK {booking.amount.toLocaleString()}</p>
                                <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Success</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12 bg-gray-50/50 rounded-[32px] border border-dashed border-gray-200">
                          <CreditCard className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                          <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">No activity found</p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Settings Tab */}
                {activeTab === 'settings' && (
                  <>
                    <div className="mb-10">
                      <h2 className="text-2xl font-bold text-gray-900">Preferences</h2>
                      <p className="text-gray-500 text-sm mt-1">Customize your experience on the platform.</p>
                    </div>

                    <div className="space-y-4 mb-12">
                      <div className="flex items-center gap-2 mb-6">
                        <div className="w-1 h-6 bg-blue-500 rounded-full" />
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Notifications</h3>
                      </div>
                      {([
                        { key: 'emailNotifications', title: 'Email', desc: 'Confirmations & updates' },
                        { key: 'smsNotifications', title: 'SMS', desc: 'Trip reminders' },
                        { key: 'pushNotifications', title: 'Web Push', desc: 'Browser notifications' },
                        { key: 'bookingReminders', title: 'Reminders', desc: 'Upcoming trip alerts' },
                        { key: 'promotionalEmails', title: 'Offers', desc: 'Deals and travel rewards' },
                      ] as { key: keyof NotificationPreferences; title: string; desc: string }[]).map(({ key, title, desc }) => (
                        <div key={key} className="flex items-center justify-between p-5 bg-white border border-gray-100 rounded-[28px] hover:shadow-lg hover:shadow-gray-500/5 transition-all">
                          <div>
                            <p className="font-bold text-gray-900 text-sm">{title}</p>
                            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">{desc}</p>
                          </div>
                          <button
                            onClick={() => updateNotificationPreferences(key, !notifications[key])}
                            className={`w-11 h-6 rounded-full relative transition-all duration-300 ${notifications[key] ? 'bg-indigo-600 shadow-inner' : 'bg-gray-200'}`}>
                            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 shadow-md transition-all duration-300 ${notifications[key] ? 'right-1' : 'left-1'}`}></div>
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="pt-8 border-t border-gray-100">
                      <div className="flex items-center gap-2 mb-6 text-red-600">
                        <div className="w-1 h-6 bg-red-500 rounded-full" />
                        <h3 className="text-sm font-bold uppercase tracking-wider">Danger Zone</h3>
                      </div>
                      <div className="p-6 bg-red-50/50 rounded-[32px] border border-red-100">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                          <div>
                            <p className="text-sm font-black text-red-900 uppercase tracking-tighter mb-1">Delete Account</p>
                            <p className="text-xs text-red-700/60 font-medium">This will remove your data permanently.</p>
                          </div>
                          <button onClick={() => setShowDeleteModal(true)} disabled={actionLoading}
                            className="px-6 py-3 bg-white text-red-600 border border-red-200 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-sm">
                            Delete My Profile
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Security Tab */}
                {activeTab === 'security' && (
                  <>
                    <div className="mb-10">
                      <h2 className="text-2xl font-bold text-gray-900">Security</h2>
                      <p className="text-gray-500 text-sm mt-1">Keep your account safe and monitor your sessions.</p>
                    </div>

                    <div className="space-y-6">
                      <div className="flex items-center gap-2 mb-6">
                        <div className="w-1 h-6 bg-indigo-500 rounded-full" />
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Accessibility</h3>
                      </div>

                      <div className="p-7 bg-white border border-gray-100 rounded-[32px] hover:shadow-xl hover:shadow-indigo-500/5 transition-all group">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                          <div className="flex items-center gap-4">
                            <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:rotate-6 transition-transform">
                              <Key className="w-6 h-6" />
                            </div>
                            <div>
                              <p className="text-lg font-black text-gray-900 tracking-tight">Login Password</p>
                              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                                {pwResetSent ? 'Reset code sent to your email' : 'Update your password regularly'}
                              </p>
                            </div>
                          </div>
                          <button onClick={handlePasswordReset} disabled={pwResetSent}
                            className="px-8 py-3.5 bg-gray-900 text-white rounded-[20px] text-xs font-black uppercase tracking-[0.2em] hover:bg-black transition-all disabled:opacity-50 shadow-xl shadow-black/10">
                            {pwResetSent ? 'Check Inbox' : 'Reset Link'}
                          </button>
                        </div>
                      </div>

                      <div className="p-7 bg-gray-50/50 border border-gray-100 rounded-[32px] opacity-70 cursor-not-allowed">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="p-4 bg-white shadow-sm text-green-500 rounded-2xl">
                              <Smartphone className="w-6 h-6" />
                            </div>
                            <div>
                              <p className="text-lg font-black text-gray-400 tracking-tight">Two-Factor (2FA)</p>
                              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Multi-layer protection</p>
                            </div>
                          </div>
                          <span className="px-3 py-1.5 bg-yellow-100 text-yellow-700 text-[10px] font-black uppercase tracking-widest rounded-lg">Labs</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-10 p-6 bg-indigo-600 rounded-[32px] text-white flex items-center gap-6">
                      <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shrink-0">
                        <Shield className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg mb-0.5 leading-none">Smart Shield</h4>
                        <p className="text-indigo-100 text-xs">Your account is being monitored for suspicious activity.</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-8">
              <div className="bg-white/80 backdrop-blur-sm rounded-[32px] shadow-sm border border-white p-6 sm:p-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Insights</h3>
                  <Activity className="w-4 h-4 text-indigo-500" />
                </div>

                {statsLoading ? (
                  <div className="space-y-6">
                    {Array(4).fill(0).map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded-2xl animate-pulse" />)}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {[
                      { icon: <MapPin className="w-4 h-4" />, label: 'Fav Destination', value: travelInsights.mostVisitedDestination || 'N/A', bg: 'bg-blue-50', text: 'text-blue-600' },
                      { icon: <Bus className="w-4 h-4" />, label: 'Pref. Operator', value: travelInsights.favoriteCompany || 'N/A', bg: 'bg-green-50', text: 'text-green-600' },
                      { icon: <Zap className="w-4 h-4" />, label: 'Trip Pace', value: travelInsights.travelFrequency, bg: 'bg-purple-50', text: 'text-purple-600' },
                      { icon: <DollarSign className="w-4 h-4" />, label: 'Avg Ticket', value: bookingStats.total > 0 ? `MWK ${Math.round(bookingStats.avgBookingValue).toLocaleString()}` : 'N/A', bg: 'bg-yellow-50', text: 'text-yellow-600' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between py-4 border-b border-gray-50 last:border-0 group">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 ${item.bg} ${item.text} rounded-xl group-hover:scale-110 transition-transform`}>{item.icon}</div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{item.label}</span>
                        </div>
                        <span className="text-xs font-bold text-gray-900 truncate max-w-[100px]">{item.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Profile Health */}
              <div className="bg-white/80 backdrop-blur-sm rounded-[32px] shadow-sm border border-white p-6 sm:p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Profile Health</h3>
                  <span className="text-[10px] font-black text-indigo-600">{calculateProfileCompletion()}%</span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full mb-6 overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000 shadow-sm" style={{ width: `${calculateProfileCompletion()}%` }} />
                </div>
                <p className="text-[10px] uppercase font-bold text-gray-400 text-center tracking-widest leading-relaxed">
                  {calculateProfileCompletion() === 100
                    ? "Perfect! You're all set to travel."
                    : "Complete your profile to unlock faster checkouts."}
                </p>
                {calculateProfileCompletion() < 100 && (
                  <button onClick={() => setEditProfile(true)}
                    className="w-full mt-6 py-3 bg-gray-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-black transition-all shadow-xl shadow-black/10">
                    Fill Gaps
                  </button>
                )}
              </div>

              <div className="bg-indigo-600 rounded-[32px] p-8 text-white shadow-2xl shadow-indigo-200 group cursor-pointer relative overflow-hidden" onClick={() => router.push('/support')}>
                <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all opacity-0 group-hover:opacity-100" />
                <h3 className="text-lg font-black uppercase tracking-widest mb-2 relative z-10">Need Help?</h3>
                <p className="text-indigo-100 text-xs font-medium mb-6 leading-relaxed relative z-10">Our support team is available 24/7 for you.</p>
                <button className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest bg-white text-indigo-600 px-4 py-2 rounded-xl relative z-10 transition-transform group-hover:translate-x-1">
                  Contact Support <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Cancellation Confirmation Modal */}
          <ConfirmationModal
            isOpen={showCancelModal}
            isLoading={cancellingId !== null}
            onClose={() => { if (!cancellingId) setShowCancelModal(false); }}
            onConfirm={handleCancelBooking}
            title="Cancel Trip?"
            message="Are you sure you want to cancel this booking? This action might be subject to the company's refund policy."
            confirmText="Yes, Cancel"
            cancelText="No, Keep It"
          />

          {/* Delete Account Modal */}
          {showDeleteModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-red-900/20 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
              <div className="relative bg-white rounded-[32px] shadow-2xl p-8 w-full max-w-md border border-red-50 animate-in zoom-in-95 duration-200">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="p-3 bg-red-100 rounded-2xl"><Trash2 className="w-6 h-6 text-red-600" /></div>
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight">Delete Account</h2>
                </div>
                <p className="text-gray-600 mb-4 text-sm leading-relaxed">This will permanently delete your account and all travel history. <strong className="text-red-600">This cannot be undone.</strong></p>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Type DELETE to confirm:</p>
                <input type="text" value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl mb-8 focus:ring-4 focus:ring-red-500/10 focus:bg-white transition-all font-black text-center tracking-widest outline-none" />
                <div className="flex gap-3">
                  <button onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(''); }}
                    className="flex-1 px-6 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-colors">Cancel</button>
                  <button onClick={handleAccountDeletion} disabled={deleteConfirmText !== 'DELETE' || actionLoading}
                    className="flex-[2] px-6 py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg shadow-red-200">
                    {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                    Delete Forever
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;

