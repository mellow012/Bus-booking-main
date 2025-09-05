'use client';

import React, { useState, useEffect, FormEvent, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebaseConfig';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  deleteDoc,
  Timestamp, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs,
  writeBatch 
} from 'firebase/firestore';
import ProfilePageSkeleton from '@/components/SkeletonLoader'
import { UserProfile } from '@/types';
import { 
  Loader2, AlertCircle, User, MapPin, Edit, Mail, Phone, Shield,
  Calendar, Clock, CreditCard, Activity, Settings, ChevronRight, Star,
  TrendingUp, Users, Bus, CheckCircle, XCircle, AlertTriangle, BookOpen,
  History, Bell, Download, Share2, Eye, EyeOff, Camera, Award, Trash2,
  Key, Smartphone, LogOut, RefreshCw, BarChart3, PieChart, Filter,
  Search, ExternalLink, Copy, FileText, DollarSign, Zap
} from 'lucide-react';
import AlertMessage from '../../components/AlertMessage';

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
  const [routeSuggestions, setRouteSuggestions] = useState<RouteSuggestion[]>([])
  
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
  const [notifications, setNotifications] = useState<NotificationPreferences>({
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    bookingReminders: true,
    promotionalEmails: false,
    securityAlerts: true
  });
  const [security, setSecurity] = useState<SecuritySettings>({
    twoFactorEnabled: false,
    lastPasswordChange: null,
    loginSessions: []
  });
  
  // UI state
  const [statsLoading, setStatsLoading] = useState(false);
  const [showSensitiveInfo, setShowSensitiveInfo] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [bookingFilter, setBookingFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    nationalId: '',
    sex: '',
    currentAddress: '',
    email: user?.email || '',
  });

  // Debounced form update
  const [formUpdateTimeout, setFormUpdateTimeout] = useState<NodeJS.Timeout | null>(null);

  const debouncedFormUpdate = useCallback((field: string, value: string) => {
    if (formUpdateTimeout) {
      clearTimeout(formUpdateTimeout);
    }
    
    const timeout = setTimeout(() => {
      setFormData(prev => ({ ...prev, [field]: value }));
    }, 300);
    
    setFormUpdateTimeout(timeout);
  }, [formUpdateTimeout]);

  // Enhanced booking data fetch with caching
  const fetchBookingData = useCallback(async () => {
    if (!user) return;
    
    setStatsLoading(true);
    try {
      const bookingsQuery = query(
        collection(db, 'bookings'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      
      const bookingsSnapshot = await getDocs(bookingsQuery);
      
     const bookingsWithDetails = await Promise.all(
    bookingsSnapshot.docs.map(async (bookingDoc) => {
      const bookingData = bookingDoc.data();
      
      let companyName = 'Unknown Company';
      if (bookingData.companyId) {
        try {
          const companyDoc = await getDoc(doc(db, 'companies', bookingData.companyId));
          if (companyDoc.exists()) {
            companyName = companyDoc.data().name || companyName;
          }
        } catch (err) {
          console.error('Error fetching company:', err);
        }
      }

      // --- MODIFICATION STARTS HERE ---
      let origin = 'Unknown';
      let destination = 'Unknown';
      let departureDate = new Date();
      
      if (bookingData.scheduleId) {
        try {
          // 1. Fetch the schedule document
          const scheduleDoc = await getDoc(doc(db, 'schedules', bookingData.scheduleId));
          if (scheduleDoc.exists()) {
            const scheduleData = scheduleDoc.data();
            
            // 2. NEW: Check if the schedule has a 'routeId'
            if (scheduleData.routeId) {
                // 3. Fetch the route document from the 'routes' collection
                const routeDoc = await getDoc(doc(db, 'routes', scheduleData.routeId));
                if (routeDoc.exists()) {
                    const routeData = routeDoc.data();
                    // 4. Get origin and destination directly from the route data
                    origin = routeData.origin || origin;
                    destination = routeData.destination || destination;
                }
            } else {
                // Fallback for older data where route info might be embedded
                origin = scheduleData.route?.origin || scheduleData.origin || origin;
                destination = scheduleData.route?.destination || scheduleData.destination || destination;
            }
            
            // This part for setting the date remains the same
            if (scheduleData.departureDateTime) {
              departureDate = scheduleData.departureDateTime.toDate();
            } else if (scheduleData.departureDate) {
              departureDate = scheduleData.departureDate.toDate();
            } else if (bookingData.bookingDate) {
              departureDate = bookingData.bookingDate.toDate();
            }
          }
        } catch (err) {
          console.error('Error fetching schedule or route:', err);
        }
      }
      // --- MODIFICATION ENDS HERE ---

      return {
        id: bookingDoc.id,
        ...bookingData,
        companyName,
        origin, // This will now have the correct value
        destination, // This will also have the correct value
        departureDate,
        status: bookingData.bookingStatus || bookingData.status || 'pending',
        amount: bookingData.totalAmount || 0,
        seatNumbers: bookingData.seatNumbers || [],
        bookingReference: bookingData.bookingReference || bookingData.transactionReference || '',
        paymentStatus: bookingData.paymentDetails?.paymentStatus || 'pending'
      };
    })
  );

      // Enhanced stats calculation
      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      
      const stats = bookingsWithDetails.reduce((acc, booking) => {
        acc.total += 1;
        acc.totalSpent += booking.amount || 0;
        
        const bookingDate = new Date(booking.departureDate);
        if (bookingDate >= thisMonth) {
          acc.thisMonth += 1;
        } else if (bookingDate >= lastMonth && bookingDate < thisMonth) {
          acc.lastMonth += 1;
        }
        
        const status = booking.status.toLowerCase();
        if (status === 'completed' || status === 'finished') {
          acc.completed += 1;
        } else if (status === 'confirmed' || status === 'pending' || status === 'booked') {
          acc.pending += 1;
        } else if (status === 'cancelled' || status === 'canceled') {
          acc.cancelled += 1;
        }
        return acc;
      }, { 
        total: 0, completed: 0, pending: 0, cancelled: 0, 
        totalSpent: 0, thisMonth: 0, lastMonth: 0, avgBookingValue: 0 
      });

      stats.avgBookingValue = stats.total > 0 ? stats.totalSpent / stats.total : 0;
      setBookingStats(stats);

      // Set recent bookings
      setRecentBookings(bookingsWithDetails.slice(0, 5) as RecentBooking[]);

      // Enhanced travel insights
      const insights: TravelInsights = {
        mostVisitedDestination: '',
        favoriteCompany: '',
        totalDistance: 0,
        averageTripCost: stats.avgBookingValue,
        destinationCounts: {},
        companyCounts: {},
        monthlySpending: [],
        travelFrequency: stats.total >= 10 ? 'Frequent' : stats.total >= 5 ? 'Regular' : 'Occasional'
      };

      // Calculate insights
      bookingsWithDetails.forEach(booking => {
        if (booking.destination && booking.destination !== 'Unknown') {
          insights.destinationCounts[booking.destination] = 
            (insights.destinationCounts[booking.destination] || 0) + 1;
        }
        if (booking.companyName && booking.companyName !== 'Unknown Company') {
          insights.companyCounts[booking.companyName] = 
            (insights.companyCounts[booking.companyName] || 0) + 1;
        }
      });

      // Find most popular
      let maxDestCount = 0;
      Object.entries(insights.destinationCounts).forEach(([dest, count]) => {
        if (count > maxDestCount) {
          maxDestCount = count;
          insights.mostVisitedDestination = dest;
        }
      });

      let maxCompanyCount = 0;
      Object.entries(insights.companyCounts).forEach(([company, count]) => {
        if (count > maxCompanyCount) {
          maxCompanyCount = count;
          insights.favoriteCompany = company;
        }
      });

      // Monthly spending data
      const monthlyData = bookingsWithDetails.reduce((acc, booking) => {
        const date = new Date(booking.departureDate);
        const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
        acc[monthKey] = (acc[monthKey] || 0) + (booking.amount || 0);
        return acc;
      }, {} as { [key: string]: number });

      insights.monthlySpending = Object.entries(monthlyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([month, amount]) => ({ month, amount }));

      setTravelInsights(insights);

    } catch (err) {
      console.error('Error fetching booking data:', err);
      setError('Failed to load booking data.');
    } finally {
      setStatsLoading(false);
    }
  }, [user]);
  const fetchRouteSuggestions = useCallback(async () => {
  if (!user) return;
  
  try {
    const bookings = recentBookings;
    if (bookings.length === 0) {
      setRouteSuggestions([]);
      return;
    }

    const uniqueDestinations = [...new Set(bookings.map(b => b.destination))];
    const suggestions: RouteSuggestion[] = [];

    for (const dest of uniqueDestinations) {
      const origin = bookings.find(b => b.destination === dest)?.origin || '';
      const schedulesQuery = query(
        collection(db, 'schedules'),
        where('origin', '==', origin),
        where('destination', '==', dest),
        where('departureDateTime', '>', new Date()),
        limit(3)
      );
      const snapshot = await getDocs(schedulesQuery);
      snapshot.forEach(doc => {
        const data = doc.data();
        suggestions.push({
          origin,
          destination: dest,
          companyId: data.companyId || '',
          departureTime: data.departureDateTime?.toDate() || new Date()
        });
      });
    }

    setRouteSuggestions(suggestions.slice(0, 3)); // Limit to 3 suggestions
  } catch (err) {
    console.error('Error fetching route suggestions:', err);
    setError('Failed to load route suggestions.');
  }
}, [user, recentBookings]);

  // Load user preferences
  const loadUserPreferences = useCallback(async () => {
    if (!user) return;
    
    try {
      const preferencesDoc = await getDoc(doc(db, 'userPreferences', user.uid));
      if (preferencesDoc.exists()) {
        const data = preferencesDoc.data();
        setNotifications(data.notifications || notifications);
        setSecurity(data.security || security);
        setPaymentMethods(data.paymentMethods || []);
      }
    } catch (err) {
      console.error('Error loading preferences:', err);
    }
  }, [user, notifications, security]);

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
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
          setError('User profile not found');
          return;
        }
        
        const userData = { id: userDoc.id, ...userDoc.data() } as UserProfile;
        const createdAtDate = userData.createdAt instanceof Timestamp 
          ? userData.createdAt.toDate() 
          : userData.createdAt || new Date();
          
        setProfile({ ...userData, createdAt: createdAtDate });
        setFormData({
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          phone: userData.phone || '',
          nationalId: userData.nationalId || '',
          sex: userData.sex || '',
          currentAddress: userData.currentAddress || '',
          email: userData.email || user.email || '',
        });

        // Load data in parallel
        await Promise.all([
          fetchBookingData(),
          loadUserPreferences()
        ]);
        
      } catch (err: any) {
        setError('Failed to load profile. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, userProfile, router, fetchBookingData, loadUserPreferences]);
  useEffect(() => {
  fetchRouteSuggestions();
}, [fetchRouteSuggestions]);

  // Enhanced profile update with success notification
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
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.push('Valid email is required');
    }
    
    if (errors.length > 0) {
      setError(errors.join('. '));
      return;
    }

    setActionLoading(true);
    setError('');
    try {
      await updateUserProfile({
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        nationalId: formData.nationalId || null,
        sex: formData.sex || null,
        currentAddress: formData.currentAddress || null,
        email: formData.email,
      });
      
      setProfile(prev => prev ? { 
        ...prev, 
        ...formData, 
        profileCompleted: true, 
        updatedAt: new Date() 
      } : null);
      
      setEditProfile(false);
      setSuccess('Profile updated successfully!');
      
      // Auto-clear success message
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (err: any) {
      setError(`Failed to update profile: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Notification preferences update
  const updateNotificationPreferences = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!user) return;
    
    const newNotifications = { ...notifications, [key]: value };
    setNotifications(newNotifications);
    
    try {
      await updateDoc(doc(db, 'userPreferences', user.uid), {
        'notifications': newNotifications,
        updatedAt: Timestamp.now()
      });
      setSuccess('Notification preferences updated');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      console.error('Error updating preferences:', err);
      setError('Failed to update preferences');
    }
  };

  // Account deletion
  const handleAccountDeletion = async () => {
    if (!user || !confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return;
    }
    
    const confirmText = prompt('Type "DELETE" to confirm account deletion:');
    if (confirmText !== 'DELETE') {
      return;
    }

    setActionLoading(true);
    try {
      // Delete user data
      const batch = writeBatch(db);
      batch.delete(doc(db, 'users', user.uid));
      batch.delete(doc(db, 'userPreferences', user.uid));
      
      await batch.commit();
      await signOut();
      router.push('/');
    } catch (err) {
      console.error('Error deleting account:', err);
      setError('Failed to delete account. Please contact support.');
    } finally {
      setActionLoading(false);
    }
  };

  // Copy booking reference
  const copyBookingReference = (reference: string) => {
    navigator.clipboard.writeText(reference);
    setSuccess('Booking reference copied!');
    setTimeout(() => setSuccess(''), 2000);
  };

  // Filter bookings
  const filteredBookings = useMemo(() => {
    let filtered = recentBookings;
    
    if (bookingFilter !== 'all') {
      filtered = filtered.filter(booking => 
        booking.status.toLowerCase() === bookingFilter
      );
    }
    
    if (searchTerm) {
      filtered = filtered.filter(booking =>
        booking.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.bookingReference.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return filtered;
  }, [recentBookings, bookingFilter, searchTerm]);

  // Utility functions
  const getStatusColor = (status: string) => {
    const normalizedStatus = status.toLowerCase();
    switch (normalizedStatus) {
      case 'completed': 
      case 'finished': 
        return 'text-green-600 bg-green-50 border-green-200';
      case 'pending': 
      case 'confirmed': 
      case 'booked': 
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'cancelled': 
      case 'canceled': 
        return 'text-red-600 bg-red-50 border-red-200';
      default: 
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    const normalizedStatus = status.toLowerCase();
    switch (normalizedStatus) {
      case 'completed': 
      case 'finished': 
        return <CheckCircle className="w-4 h-4" />;
      case 'pending': 
      case 'confirmed': 
      case 'booked': 
        return <Clock className="w-4 h-4" />;
      case 'cancelled': 
      case 'canceled': 
        return <XCircle className="w-4 h-4" />;
      default: 
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const calculateProfileCompletion = () => {
    const fields = [
      profile?.firstName,
      profile?.lastName,
      profile?.email,
      profile?.phone,
      profile?.sex,
      profile?.currentAddress,
      profile?.nationalId
    ];
    const completedFields = fields.filter(field => field && field.trim() !== '').length;
    return Math.round((completedFields / fields.length) * 100);
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'bookings', label: 'My Bookings', icon: Bus },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  if (loading) {
    return <ProfilePageSkeleton />;
  }

  if (!profile || userProfile?.role !== 'customer') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
        <AlertMessage type="error" message={error || 'Access denied'} onClose={() => router.push('/')} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Notifications */}
      {error && (
        <div className="sticky top-0 z-50 p-4">
          <AlertMessage type="error" message={error} onClose={() => setError('')} />
        </div>
      )}
      {success && (
        <div className="sticky top-0 z-50 p-4">
          <AlertMessage type="success" message={success} onClose={() => setSuccess('')} />
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Profile Header */}
        <div className="bg-white rounded-3xl shadow-lg p-8 mb-8 border border-gray-100">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between">
            <div className="flex items-center space-x-6 mb-6 lg:mb-0">
              <div className="relative">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-3xl shadow-lg">
                  {profile.firstName?.charAt(0) || 'U'}
                </div>
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full border-4 border-white flex items-center justify-center shadow-md">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {profile.firstName} {profile.lastName}
                </h1>
                <p className="text-gray-600 mb-1">{profile.email}</p>
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span className="flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    Joined {new Date(profile.createdAt).toLocaleDateString()}
                  </span>
                  <span className="flex items-center text-blue-600">
                    <Award className="w-4 h-4 mr-1" />
                    {calculateProfileCompletion()}% Complete
                  </span>
                </div>
                {/* Profile completion progress bar */}
                <div className="mt-2 w-48 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500"
                    style={{ width: `${calculateProfileCompletion()}%` }}
                  ></div>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setEditProfile(!editProfile)}
                className={`px-6 py-3 rounded-2xl font-semibold transition-all duration-200 flex items-center space-x-2 ${
                  editProfile 
                    ? 'bg-gray-200 text-gray-800 hover:bg-gray-300' 
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl'
                }`}
              >
                <Edit className="w-4 h-4" />
                <span>{editProfile ? 'Cancel' : 'Edit Profile'}</span>
              </button>
              <button 
                onClick={() => fetchBookingData()}
                className="p-3 rounded-2xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                disabled={statsLoading}
              >
                <RefreshCw className={`w-5 h-5 ${statsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Enhanced Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-50 rounded-xl">
                <Bus className="w-6 h-6 text-blue-600" />
              </div>
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
              <div className="p-3 bg-green-50 rounded-xl">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
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
              <div className="p-3 bg-yellow-50 rounded-xl">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">{bookingStats.pending}</p>
                <p className="text-sm text-gray-600">Pending</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-50 rounded-xl">
                <DollarSign className="w-6 h-6 text-purple-600" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">MWK {bookingStats.totalSpent.toLocaleString()}</p>
                <p className="text-sm text-gray-600">Total Spent</p>
                <p className="text-xs text-gray-500">Avg: MWK {Math.round(bookingStats.avgBookingValue).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-3xl shadow-lg p-2 mb-8 border border-gray-100">
          <div className="flex space-x-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-3 rounded-2xl font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl shadow-lg p-8 border border-gray-100">
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                editProfile ? (
                  <>
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Edit Profile</h2>
                    <form onSubmit={handleProfileUpdate} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            First Name <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={formData.firstName}
                              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                              className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                              required
                            />
                            <User className="w-5 h-5 text-gray-400 absolute top-3.5 left-3" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Last Name <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={formData.lastName}
                              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                              className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                              required
                            />
                            <User className="w-5 h-5 text-gray-400 absolute top-3.5 left-3" />
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Email <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                            required
                          />
                          <Mail className="w-5 h-5 text-gray-400 absolute top-3.5 left-3" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Phone <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                            placeholder="+265999123456"
                            required
                          />
                          <Phone className="w-5 h-5 text-gray-400 absolute top-3.5 left-3" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">National ID</label>
                          <div className="relative">
                            <input
                              type={showSensitiveInfo ? 'text' : 'password'}
                              value={formData.nationalId}
                              onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
                              className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                            />
                            <Shield className="w-5 h-5 text-gray-400 absolute top-3.5 left-3" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                          <div className="relative">
                            <select
                              value={formData.sex}
                              onChange={(e) => setFormData({ ...formData, sex: e.target.value })}
                              className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors appearance-none"
                            >
                              <option value="">Select Gender</option>
                              <option value="male">Male</option>
                              <option value="female">Female</option>
                              <option value="other">Other</option>
                            </select>
                            <User className="w-5 h-5 text-gray-400 absolute top-3.5 left-3" />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Current Address</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={formData.currentAddress}
                            onChange={(e) => setFormData({ ...formData, currentAddress: e.target.value })}
                            className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                          />
                          <MapPin className="w-5 h-5 text-gray-400 absolute top-3.5 left-3" />
                        </div>
                      </div>

                      <div className="flex space-x-4 pt-4">
                        <button
                          type="submit"
                          className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 flex items-center justify-center font-semibold shadow-lg hover:shadow-xl"
                          disabled={actionLoading}
                        >
                          {actionLoading ? <Loader2 className="animate-spin w-5 h-5 mr-2" /> : <CheckCircle className="w-5 h-5 mr-2" />}
                          Save Changes
                        </button>
                      </div>
                    </form>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-2xl font-bold text-gray-900">Profile Information</h2>
                      <button
                        onClick={() => setShowSensitiveInfo(!showSensitiveInfo)}
                        className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                      >
                        {showSensitiveInfo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        <span>{showSensitiveInfo ? 'Hide' : 'Show'} sensitive info</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                      <div className="space-y-6">
                        <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                          <div className="p-3 bg-blue-100 rounded-xl">
                            <User className="w-6 h-6 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-600 mb-1">Full Name</label>
                            <p className="text-gray-900 font-medium text-lg">{profile.firstName} {profile.lastName}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                          <div className="p-3 bg-green-100 rounded-xl">
                            <Mail className="w-6 h-6 text-green-600" />
                          </div>
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
                            <p className="text-gray-900 font-medium">{profile.email}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                          <div className="p-3 bg-purple-100 rounded-xl">
                            <Phone className="w-6 h-6 text-purple-600" />
                          </div>
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-600 mb-1">Phone</label>
                            <p className="text-gray-900 font-medium">
                              {showSensitiveInfo ? (profile.phone || 'Not provided') : '••••••••••'}
                            </p>
                          </div>
                          {!showSensitiveInfo && (
                            <div className="p-2 bg-yellow-100 rounded-lg">
                              <EyeOff className="w-4 h-4 text-yellow-600" />
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-6">
                        <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                          <div className="p-3 bg-red-100 rounded-xl">
                            <Shield className="w-6 h-6 text-red-600" />
                          </div>
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-600 mb-1">National ID</label>
                            <p className="text-gray-900 font-medium">
                              {showSensitiveInfo ? (profile.nationalId || 'Not provided') : '••••••••••'}
                            </p>
                          </div>
                          {!showSensitiveInfo && (
                            <div className="p-2 bg-yellow-100 rounded-lg">
                              <EyeOff className="w-4 h-4 text-yellow-600" />
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                          <div className="p-3 bg-indigo-100 rounded-xl">
                            <Users className="w-6 h-6 text-indigo-600" />
                          </div>
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-600 mb-1">Gender</label>
                            <p className="text-gray-900 font-medium capitalize">{profile.sex || 'Not provided'}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                          <div className="p-3 bg-orange-100 rounded-xl">
                            <MapPin className="w-6 h-6 text-orange-600" />
                          </div>
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-600 mb-1">Address</label>
                            <p className="text-gray-900 font-medium">{profile.currentAddress || 'Not provided'}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Enhanced Quick Actions */}
                    <div className="p-6 bg-gradient-to-r from-gray-50 to-blue-50 rounded-2xl border border-gray-100">
                      <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <button
                          onClick={() => router.push('/schedules')}
                          className="flex flex-col items-center p-4 bg-white rounded-xl border border-blue-100 hover:border-blue-300 hover:shadow-md transition-all group"
                        >
                          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-3 group-hover:bg-blue-200 transition-colors">
                            <Bus className="w-6 h-6 text-blue-600" />
                          </div>
                          <span className="font-medium text-gray-900 text-sm">Book a Trip</span>
                          <span className="text-xs text-gray-500 mt-1">Find & book tickets</span>
                        </button>

                        <button
                          onClick={() => setActiveTab('bookings')}
                          className="flex flex-col items-center p-4 bg-white rounded-xl border border-green-100 hover:border-green-300 hover:shadow-md transition-all group"
                        >
                          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-3 group-hover:bg-green-200 transition-colors">
                            <History className="w-6 h-6 text-green-600" />
                          </div>
                          <span className="font-medium text-gray-900 text-sm">My Bookings</span>
                          <span className="text-xs text-gray-500 mt-1">{bookingStats.total} total trips</span>
                        </button>

                        <button
                          onClick={() => setActiveTab('payments')}
                          className="flex flex-col items-center p-4 bg-white rounded-xl border border-purple-100 hover:border-purple-300 hover:shadow-md transition-all group"
                        >
                          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-3 group-hover:bg-purple-200 transition-colors">
                            <CreditCard className="w-6 h-6 text-purple-600" />
                          </div>
                          <span className="font-medium text-gray-900 text-sm">Payments</span>
                          <span className="text-xs text-gray-500 mt-1">Manage payments</span>
                        </button>

                        <button
                          onClick={() => window.open(`https://www.busbud.com/?utm_source=booknpay&utm_medium=referral`, '_blank')}
                          className="flex flex-col items-center p-4 bg-white rounded-xl border border-orange-100 hover:border-orange-300 hover:shadow-md transition-all group"
                        >
                          <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-3 group-hover:bg-orange-200 transition-colors">
                            <ExternalLink className="w-6 h-6 text-orange-600" />
                          </div>
                          <span className="font-medium text-gray-900 text-sm">Explore Routes</span>
                          <span className="text-xs text-gray-500 mt-1">via Busbud</span>
                        </button>
                      </div>
                      
                    </div>
                    {activeTab === 'overview' && !editProfile && (
                  <div className="mt-8">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Suggested Routes</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {routeSuggestions.length > 0 ? (
                        routeSuggestions.map((suggestion, index) => (
                          <div key={index} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-blue-200 transition-all">
                            <p className="text-sm text-gray-600">{suggestion.origin} → {suggestion.destination}</p>
                            <p className="text-xs text-gray-500">Next: {suggestion.departureTime.toLocaleString()}</p>
                            <button
                              onClick={() => router.push(`/schedules?origin=${suggestion.origin}&destination=${suggestion.destination}`)}
                              className="mt-2 px-3 py-1 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                            >
                              Book Now
                            </button>
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-500">No suggestions yet. Book a trip to get personalized routes!</p>
                      )}
                    </div>
                  </div>
                )}
                  </>
                )
              )}

              {/* Bookings Tab */}
              {activeTab === 'bookings' && (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">My Bookings</h2>
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search bookings..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                      </div>
                      <select
                        value={bookingFilter}
                        onChange={(e) => setBookingFilter(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      >
                        <option value="all">All Status</option>
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
                        <div key={i} className="p-6 border border-gray-100 rounded-2xl animate-pulse">
                          <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
                          <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
                          <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                        </div>
                      ))}
                    </div>
                  ) : filteredBookings.length > 0 ? (
                    <div className="space-y-4">
                      {filteredBookings.map((booking) => (
                        <div key={booking.id} className="p-6 border border-gray-100 rounded-2xl hover:border-blue-200 hover:shadow-md transition-all">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-2">
                                <h3 className="text-lg font-semibold text-gray-900">
                                  {booking.origin} → {booking.destination}
                                </h3>
                                <div className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center space-x-1 ${getStatusColor(booking.status)}`}>
                                  {getStatusIcon(booking.status)}
                                  <span className="capitalize">{booking.status}</span>
                                </div>
                              </div>
                              <p className="text-sm text-gray-600 mb-1">{booking.companyName}</p>
                              <p className="text-sm text-gray-500">
                                Departure: {booking.departureDate.toLocaleDateString()} at {booking.departureDate.toLocaleTimeString()}
                              </p>
                              {booking.seatNumbers.length > 0 && (
                                <p className="text-sm text-gray-500">Seats: {booking.seatNumbers.join(', ')}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-bold text-gray-900 mb-1">MWK {booking.amount.toLocaleString()}</p>
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => copyBookingReference(booking.bookingReference)}
                                  className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                                  title="Copy booking reference"
                                >
                                  <Copy className="w-3 h-3" />
                                  <span>{booking.bookingReference}</span>
                                </button>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                            <div className="flex items-center space-x-4">
                              <span className="text-xs text-gray-500">Payment: {booking.paymentStatus}</span>
                              <span className="text-xs text-gray-400">•</span>
                              <span className="text-xs text-gray-500">Booked on {new Date(booking.departureDate).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              {booking.status.toLowerCase() !== 'cancelled' && (
                                <button className="px-3 py-1 text-xs text-red-600 hover:text-red-800 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                                  Cancel
                                </button>
                              )}
                              <button className="px-3 py-1 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">
                                View Details
                              </button>
                              <button className="px-3 py-1 text-xs text-green-600 hover:text-green-800 border border-green-200 rounded-lg hover:bg-green-50 transition-colors">
                                Download Ticket
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Bus className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                      <p className="text-gray-600 mb-4">
                        {searchTerm || bookingFilter !== 'all' ? 'No bookings match your search' : 'No bookings yet'}
                      </p>
                      <button
                        onClick={() => router.push('/schedules')}
                        className="px-6 py-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-colors"
                      >
                        Book Your First Trip
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Payments Tab */}
              {activeTab === 'payments' && (
                <>
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Payment Management</h2>
                  
                  {/* Payment Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-2xl border border-green-100">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-green-100 rounded-xl">
                          <CheckCircle className="w-6 h-6 text-green-600" />
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-900">MWK {bookingStats.totalSpent.toLocaleString()}</p>
                          <p className="text-sm text-green-700">Total Paid</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-100">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-blue-100 rounded-xl">
                          <BarChart3 className="w-6 h-6 text-blue-600" />
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-blue-900">
                            MWK {Math.round(travelInsights.averageTripCost).toLocaleString()}
                          </p>
                          <p className="text-sm text-blue-700">Average per Trip</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-2xl border border-purple-100">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-purple-100 rounded-xl">
                          <TrendingUp className="w-6 h-6 text-purple-600" />
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-purple-900">{bookingStats.thisMonth}</p>
                          <p className="text-sm text-purple-700">This Month</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Payment Methods */}
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-bold text-gray-900">Payment Methods</h3>
                      <button className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm">
                        Add Payment Method
                      </button>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <div className="flex items-center space-x-4">
                          <div className="p-2 bg-green-100 rounded-xl">
                            <Phone className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">Mobile Money</p>
                            <p className="text-sm text-gray-600">Primary payment method</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Default</span>
                          <button className="px-3 py-1 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">
                            Configure
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 opacity-60">
                        <div className="flex items-center space-x-4">
                          <div className="p-2 bg-gray-100 rounded-xl">
                            <CreditCard className="w-5 h-5 text-gray-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">Credit/Debit Card</p>
                            <p className="text-sm text-gray-600">International payments</p>
                          </div>
                        </div>
                        <button className="px-3 py-1 text-xs text-gray-600 border border-gray-200 rounded-lg cursor-not-allowed">
                          Coming Soon
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Recent Transactions */}
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Transactions</h3>
                    {recentBookings.length > 0 ? (
                      <div className="space-y-3">
                        {recentBookings.slice(0, 5).map((booking) => (
                          <div key={booking.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                            <div className="flex items-center space-x-4">
                              <div className="p-2 bg-white rounded-xl shadow-sm">
                                <CreditCard className="w-5 h-5 text-gray-600" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{booking.origin} → {booking.destination}</p>
                                <p className="text-sm text-gray-600">{booking.departureDate.toLocaleDateString()}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-gray-900">MWK {booking.amount.toLocaleString()}</p>
                              <div className={`px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(booking.paymentStatus)}`}>
                                {booking.paymentStatus.charAt(0).toUpperCase() + booking.paymentStatus.slice(1)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-30" />
                        <p>No transactions yet</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Settings Tab */}
              {activeTab === 'settings' && (
                <>
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Account Settings</h2>
                  
                  {/* Notification Preferences */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Notification Preferences</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <div>
                          <p className="font-medium text-gray-900">Email Notifications</p>
                          <p className="text-sm text-gray-600">Receive booking confirmations and updates via email</p>
                        </div>
                        <button 
                          onClick={() => updateNotificationPreferences('emailNotifications', !notifications.emailNotifications)}
                          className={`w-12 h-6 rounded-full relative transition-colors ${notifications.emailNotifications ? 'bg-blue-600' : 'bg-gray-300'}`}
                        >
                          <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${notifications.emailNotifications ? 'right-0.5' : 'left-0.5'}`}></div>
                        </button>
                      </div>
                      
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <div>
                          <p className="font-medium text-gray-900">SMS Notifications</p>
                          <p className="text-sm text-gray-600">Get trip reminders and updates via SMS</p>
                        </div>
                        <button 
                          onClick={() => updateNotificationPreferences('smsNotifications', !notifications.smsNotifications)}
                          className={`w-12 h-6 rounded-full relative transition-colors ${notifications.smsNotifications ? 'bg-blue-600' : 'bg-gray-300'}`}
                        >
                          <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${notifications.smsNotifications ? 'right-0.5' : 'left-0.5'}`}></div>
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <div>
                          <p className="font-medium text-gray-900">Push Notifications</p>
                          <p className="text-sm text-gray-600">Receive notifications in your browser</p>
                        </div>
                        <button 
                          onClick={() => updateNotificationPreferences('pushNotifications', !notifications.pushNotifications)}
                          className={`w-12 h-6 rounded-full relative transition-colors ${notifications.pushNotifications ? 'bg-blue-600' : 'bg-gray-300'}`}
                        >
                          <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${notifications.pushNotifications ? 'right-0.5' : 'left-0.5'}`}></div>
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <div>
                          <p className="font-medium text-gray-900">Booking Reminders</p>
                          <p className="text-sm text-gray-600">Get reminded about upcoming trips</p>
                        </div>
                        <button 
                          onClick={() => updateNotificationPreferences('bookingReminders', !notifications.bookingReminders)}
                          className={`w-12 h-6 rounded-full relative transition-colors ${notifications.bookingReminders ? 'bg-blue-600' : 'bg-gray-300'}`}
                        >
                          <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${notifications.bookingReminders ? 'right-0.5' : 'left-0.5'}`}></div>
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <div>
                          <p className="font-medium text-gray-900">Promotional Emails</p>
                          <p className="text-sm text-gray-600">Receive offers and travel deals</p>
                        </div>
                        <button 
                          onClick={() => updateNotificationPreferences('promotionalEmails', !notifications.promotionalEmails)}
                          className={`w-12 h-6 rounded-full relative transition-colors ${notifications.promotionalEmails ? 'bg-blue-600' : 'bg-gray-300'}`}
                        >
                          <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${notifications.promotionalEmails ? 'right-0.5' : 'left-0.5'}`}></div>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* App Preferences */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">App Preferences</h3>
                    <div className="space-y-4">
                      <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <div className="flex items-center justify-between mb-3">
                          <p className="font-medium text-gray-900">Language</p>
                          <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                            <option>English</option>
                            <option>Chichewa</option>
                          </select>
                        </div>
                      </div>

                      <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <div className="flex items-center justify-between mb-3">
                          <p className="font-medium text-gray-900">Currency</p>
                          <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                            <option>MWK (Malawi Kwacha)</option>
                            <option>USD (US Dollar)</option>
                          </select>
                        </div>
                      </div>

                      <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <div className="flex items-center justify-between mb-3">
                          <p className="font-medium text-gray-900">Time Format</p>
                          <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                            <option>12-hour (AM/PM)</option>
                            <option>24-hour</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Danger Zone */}
                  <div className="p-6 bg-red-50 rounded-2xl border border-red-200">
                    <h3 className="text-lg font-semibold text-red-900 mb-4">Danger Zone</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-red-900">Delete Account</p>
                          <p className="text-sm text-red-700">Permanently delete your account and all data</p>
                        </div>
                        <button 
                          onClick={handleAccountDeletion}
                          disabled={actionLoading}
                          className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
                        >
                          {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          <span>Delete Account</span>
                        </button>
                      </div>
                      <div className="text-sm text-red-600 bg-red-100 p-3 rounded-lg">
                        <strong>Warning:</strong> This action cannot be undone. All your bookings, payments, and personal data will be permanently deleted.
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Security Tab */}
              {activeTab === 'security' && (
                <>
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Security Settings</h2>
                  
                  {/* Password Section */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Password & Authentication</h3>
                    <div className="space-y-4">
                      <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-blue-100 rounded-xl">
                              <Key className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">Password</p>
                              <p className="text-sm text-gray-600">
                                Last changed: {security.lastPasswordChange ? new Date(security.lastPasswordChange).toLocaleDateString() : 'Never'}
                              </p>
                            </div>
                          </div>
                          <button className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors">
                            Change Password
                          </button>
                        </div>
                      </div>

                      <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-green-100 rounded-xl">
                              <Smartphone className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">Two-Factor Authentication</p>
                              <p className="text-sm text-gray-600">
                                Add an extra layer of security to your account
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium ${security.twoFactorEnabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              <div className={`w-2 h-2 rounded-full ${security.twoFactorEnabled ? 'bg-green-500' : 'bg-red-500'}`}></div>
                              <span>{security.twoFactorEnabled ? 'Enabled' : 'Disabled'}</span>
                            </div>
                            <button className={`px-4 py-2 rounded-xl transition-colors ${security.twoFactorEnabled ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-green-600 text-white hover:bg-green-700'}`}>
                              {security.twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Login Activity */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Login Activity</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-4 bg-green-50 rounded-2xl border border-green-200">
                        <div className="flex items-center space-x-4">
                          <div className="p-2 bg-green-100 rounded-xl">
                            <Activity className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-green-900">Current session</p>
                            <p className="text-xs text-green-700">Blantyre, Malawi • Chrome on Windows</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-green-600 font-medium">Active now</span>
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        </div>
                      </div>

                      <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">Previous session</p>
                            <p className="text-xs text-gray-600">Lilongwe, Malawi • 2 days ago</p>
                          </div>
                          <button className="text-xs text-red-600 hover:text-red-800 font-medium">
                            Revoke
                          </button>
                        </div>
                      </div>

                      <div className="text-center pt-4">
                        <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                          View all login activity
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Security Recommendations */}
                  <div className="p-6 bg-blue-50 rounded-2xl border border-blue-200">
                    <h3 className="text-lg font-semibold text-blue-900 mb-4">Security Recommendations</h3>
                    <div className="space-y-3">
                      {!security.twoFactorEnabled && (
                        <div className="flex items-start space-x-3">
                          <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-blue-900">Enable Two-Factor Authentication</p>
                            <p className="text-xs text-blue-700">Protect your account with an additional security layer</p>
                          </div>
                        </div>
                      )}
                      
                      {!security.lastPasswordChange && (
                        <div className="flex items-start space-x-3">
                          <Key className="w-5 h-5 text-blue-600 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-blue-900">Update Your Password</p>
                            <p className="text-xs text-blue-700">Use a strong, unique password for better security</p>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-start space-x-3">
                        <Bell className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-blue-900">Security Alerts</p>
                          <p className="text-xs text-blue-700">We'll notify you of suspicious account activity</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Recent Bookings */}
            <div className="bg-white rounded-3xl shadow-lg p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Recent Bookings</h3>
                <button
                  onClick={() => setActiveTab('bookings')}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center"
                >
                  View All
                  <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              </div>
              
              {statsLoading ? (
                <div className="space-y-3">
                  {Array(3).fill(0).map((_, i) => (
                    <div key={i} className="p-4 border border-gray-100 rounded-2xl animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : recentBookings.length > 0 ? (
                <div className="space-y-3">
                  {recentBookings.slice(0, 3).map((booking) => (
                    <div key={booking.id} className="p-4 border border-gray-100 rounded-2xl hover:border-blue-200 transition-colors cursor-pointer">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-gray-900">{booking.origin} → {booking.destination}</p>
                          <p className="text-sm text-gray-600">{booking.companyName}</p>
                          {booking.seatNumbers.length > 0 && (
                            <p className="text-xs text-gray-500">Seats: {booking.seatNumbers.join(', ')}</p>
                          )}
                        </div>
                        <div className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center space-x-1 ${getStatusColor(booking.status)}`}>
                          {getStatusIcon(booking.status)}
                          <span className="capitalize">{booking.status}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{booking.departureDate.toLocaleDateString()}</span>
                        <span className="font-medium text-gray-900">MWK {booking.amount.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <Bus className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>No bookings yet</p>
                  <button
                    onClick={() => router.push('/schedules')}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Browse Schedules
                  </button>
                </div>
              )}
            </div>

            {/* Travel Insights */}
            <div className="bg-white rounded-3xl shadow-lg p-6 border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Travel Insights</h3>
              
              {statsLoading ? (
                <div className="space-y-4">
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-2xl border border-blue-100">
                    <div className="flex items-center space-x-3">
                      <MapPin className="w-5 h-5 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">Most Visited</span>
                    </div>
                    <span className="text-sm text-blue-700">
                      {travelInsights.mostVisitedDestination || 'N/A'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-2xl border border-green-100">
                    <div className="flex items-center space-x-3">
                      <Bus className="w-5 h-5 text-green-600" />
                      <span className="text-sm font-medium text-green-900">Favorite Company</span>
                    </div>
                    <span className="text-sm text-green-700">
                      {travelInsights.favoriteCompany || 'N/A'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-2xl border border-purple-100">
                    <div className="flex items-center space-x-3">
                      <Zap className="w-5 h-5 text-purple-600" />
                      <span className="text-sm font-medium text-purple-900">Travel Frequency</span>
                    </div>
                    <span className="text-sm text-purple-700">
                      {travelInsights.travelFrequency}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-2xl border border-yellow-100">
                    <div className="flex items-center space-x-3">
                      <Star className="w-5 h-5 text-yellow-600" />
                      <span className="text-sm font-medium text-yellow-900">Loyalty Points</span>
                    </div>
                    <span className="text-sm text-yellow-700">
                      {bookingStats.completed * 10} pts
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Completion or Achievement */}
            {calculateProfileCompletion() < 100 ? (
              <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200 rounded-3xl shadow-lg p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <AlertTriangle className="w-6 h-6 text-yellow-600" />
                  <h3 className="text-lg font-bold text-yellow-800">Complete Your Profile</h3>
                </div>
                <p className="text-yellow-700 mb-4 text-sm">
                  {calculateProfileCompletion()}% complete. Add missing information to unlock all features.
                </p>
                <div className="mb-4 w-full h-2 bg-yellow-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-yellow-500 transition-all duration-500"
                    style={{ width: `${calculateProfileCompletion()}%` }}
                  ></div>
                </div>
                <button
                  onClick={() => setEditProfile(true)}
                  className="w-full bg-yellow-600 text-white py-3 rounded-2xl hover:bg-yellow-700 transition-colors font-semibold"
                >
                  Complete Profile
                </button>
              </div>
            ) : bookingStats.completed >= 5 && (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-3xl shadow-lg p-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Award className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-green-800 mb-2">
                    {bookingStats.completed >= 20 ? 'Travel Expert' : 
                     bookingStats.completed >= 10 ? 'Frequent Traveler' : 
                     'Regular Traveler'}
                  </h3>
                  <p className="text-green-700 text-sm mb-4">
                    You've completed {bookingStats.completed} trips! Keep exploring Malawi.
                  </p>
                  <div className="bg-green-100 rounded-2xl px-4 py-2 inline-block">
                    <span className="text-green-800 font-semibold text-sm">Achievement Unlocked</span>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Support */}
            <div className="bg-white rounded-3xl shadow-lg p-6 border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Need Help?</h3>
              <div className="space-y-3">
                <button className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-2xl transition-colors">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-gray-900">Help Center</span>
                </button>
                <button className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-2xl transition-colors">
                  <Phone className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-gray-900">Contact Support</span>
                </button>
                <button className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-2xl transition-colors">
                  <Share2 className="w-5 h-5 text-purple-600" />
                  <span className="text-sm font-medium text-gray-900">Send Feedback</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;