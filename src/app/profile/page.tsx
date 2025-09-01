'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebaseConfig';
import { doc, getDoc, Timestamp, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { UserProfile } from '@/types';
import { 
  Loader2, AlertCircle, User, MapPin, Edit, Mail, Phone, Shield,
  Calendar, Clock, CreditCard, Activity, Settings, ChevronRight, Star,
  TrendingUp, Users, Bus, CheckCircle, XCircle, AlertTriangle, BookOpen,
  History, Bell, Download, Share2, Eye, EyeOff, Camera, Award
} from 'lucide-react';
import AlertMessage from '../../components/AlertMessage';

interface BookingStats {
  total: number;
  completed: number;
  pending: number;
  cancelled: number;
  totalSpent: number;
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
}

interface TravelInsights {
  mostVisitedDestination: string;
  favoriteCompany: string;
  totalDistance: number;
  averageTripCost: number;
  destinationCounts: { [key: string]: number };
  companyCounts: { [key: string]: number };
}

const ProfilePage: React.FC = () => {
  const router = useRouter();
  const { user, userProfile, updateUserProfile } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editProfile, setEditProfile] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [bookingStats, setBookingStats] = useState<BookingStats>({
    total: 0, completed: 0, pending: 0, cancelled: 0, totalSpent: 0
  });
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [travelInsights, setTravelInsights] = useState<TravelInsights>({
    mostVisitedDestination: '',
    favoriteCompany: '',
    totalDistance: 0,
    averageTripCost: 0,
    destinationCounts: {},
    companyCounts: {}
  });
  const [statsLoading, setStatsLoading] = useState(false);
  const [showSensitiveInfo, setShowSensitiveInfo] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    nationalId: '',
    sex: '',
    currentAddress: '',
    email: user?.email || '',
  });
  const [actionLoading, setActionLoading] = useState(false);

  const fetchBookingData = async () => {
    if (!user) return;
    
    setStatsLoading(true);
    try {
      // Fetch user's bookings
      const bookingsQuery = query(
        collection(db, 'bookings'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(20) // Get more for better insights
      );
      
      const bookingsSnapshot = await getDocs(bookingsQuery);
      
      // Process bookings and fetch related data
      const bookingsWithDetails = await Promise.all(
        bookingsSnapshot.docs.map(async (bookingDoc) => {
          const bookingData = bookingDoc.data();
          
          // Fetch company details
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

          // Fetch schedule details for route information
          let origin = 'Unknown';
          let destination = 'Unknown';
          let departureDate = new Date();
          
          if (bookingData.scheduleId) {
            try {
              const scheduleDoc = await getDoc(doc(db, 'schedules', bookingData.scheduleId));
              if (scheduleDoc.exists()) {
                const scheduleData = scheduleDoc.data();
                origin = scheduleData.route?.origin || scheduleData.origin || origin;
                destination = scheduleData.route?.destination || scheduleData.destination || destination;
                
                // Handle departure date from schedule
                if (scheduleData.departureDateTime) {
                  departureDate = scheduleData.departureDateTime.toDate();
                } else if (scheduleData.departureDate) {
                  departureDate = scheduleData.departureDate.toDate();
                } else if (bookingData.bookingDate) {
                  departureDate = bookingData.bookingDate.toDate();
                }
              }
            } catch (err) {
              console.error('Error fetching schedule:', err);
            }
          }

          return {
            id: bookingDoc.id,
            ...bookingData,
            companyName,
            origin,
            destination,
            departureDate,
            status: bookingData.bookingStatus || bookingData.status || 'pending',
            amount: bookingData.totalAmount || 0,
            seatNumbers: bookingData.seatNumbers || []
          };
        })
      );

      // Calculate stats
      const stats = bookingsWithDetails.reduce((acc, booking) => {
        acc.total += 1;
        acc.totalSpent += booking.amount || 0;
        
        // Map booking statuses to display statuses
        const status = booking.status.toLowerCase();
        if (status === 'completed' || status === 'finished') {
          acc.completed += 1;
        } else if (status === 'confirmed' || status === 'pending' || status === 'booked') {
          acc.pending += 1;
        } else if (status === 'cancelled' || status === 'canceled') {
          acc.cancelled += 1;
        }
        return acc;
      }, { total: 0, completed: 0, pending: 0, cancelled: 0, totalSpent: 0 });

      setBookingStats(stats);

      // Set recent bookings (top 3)
      const recentBookingsData: RecentBooking[] = bookingsWithDetails.slice(0, 3);
      setRecentBookings(recentBookingsData);

      // Calculate travel insights
      const insights: TravelInsights = {
        mostVisitedDestination: '',
        favoriteCompany: '',
        totalDistance: 0,
        averageTripCost: stats.total > 0 ? stats.totalSpent / stats.total : 0,
        destinationCounts: {},
        companyCounts: {}
      };

      // Count destinations and companies
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

      // Find most visited destination
      let maxDestCount = 0;
      Object.entries(insights.destinationCounts).forEach(([dest, count]) => {
        if (count > maxDestCount) {
          maxDestCount = count;
          insights.mostVisitedDestination = dest;
        }
      });

      // Find favorite company
      let maxCompanyCount = 0;
      Object.entries(insights.companyCounts).forEach(([company, count]) => {
        if (count > maxCompanyCount) {
          maxCompanyCount = count;
          insights.favoriteCompany = company;
        }
      });

      setTravelInsights(insights);

    } catch (err) {
      console.error('Error fetching booking data:', err);
      setError('Failed to load booking data.');
    } finally {
      setStatsLoading(false);
    }
  };

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

        await fetchBookingData();
      } catch (err: any) {
        setError('Failed to load profile. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, userProfile, router]);

  const handleProfileUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    const errors: string[] = [];
    if (!formData.firstName.trim() || !formData.lastName.trim()) errors.push('First name and last name are required');
    if (!formData.phone.match(/^\+265\d{9}$/)) errors.push('Phone must be in +265 format (e.g., +265999123456)');
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.push('Valid email is required');
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
      setProfile(prev => prev ? { ...prev, ...formData, profileCompleted: true, updatedAt: new Date() } : null);
      setEditProfile(false);
      setError('Profile updated successfully.');
    } catch (err: any) {
      setError(`Failed to update profile: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const normalizedStatus = status.toLowerCase();
    switch (normalizedStatus) {
      case 'completed': 
      case 'finished': 
        return 'text-green-600 bg-green-50';
      case 'pending': 
      case 'confirmed': 
      case 'booked': 
        return 'text-yellow-600 bg-yellow-50';
      case 'cancelled': 
      case 'canceled': 
        return 'text-red-600 bg-red-50';
      default: 
        return 'text-gray-600 bg-gray-50';
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

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'bookings', label: 'My Bookings', icon: Bus },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Header Skeleton */}
          <div className="bg-white rounded-3xl shadow-lg p-8 mb-8 animate-pulse">
            <div className="flex items-center space-x-6">
              <div className="w-24 h-24 bg-gray-200 rounded-full"></div>
              <div className="flex-1">
                <div className="h-8 bg-gray-200 rounded w-64 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-48 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-32"></div>
              </div>
            </div>
          </div>

          {/* Stats Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-lg p-6 animate-pulse">
                <div className="h-6 bg-gray-200 rounded mb-4"></div>
                <div className="h-8 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>

          {/* Content Skeleton */}
          <div className="bg-white rounded-3xl shadow-lg p-8 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-48 mb-6"></div>
            <div className="space-y-4">
              {Array(3).fill(0).map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
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
      {error && (
        <div className="sticky top-0 z-50 p-4">
          <AlertMessage type="error" message={error} onClose={() => setError('')} />
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
                <button className="absolute -top-1 -right-1 w-8 h-8 bg-white rounded-full border-2 border-gray-200 flex items-center justify-center shadow-sm hover:shadow-md transition-shadow">
                  <Camera className="w-4 h-4 text-gray-600" />
                </button>
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
                  {profile.profileCompleted && (
                    <span className="flex items-center text-green-600">
                      <Award className="w-4 h-4 mr-1" />
                      Verified Profile
                    </span>
                  )}
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
              <button className="p-3 rounded-2xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-50 rounded-xl">
                <Bus className="w-6 h-6 text-blue-600" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">{bookingStats.total}</p>
                <p className="text-sm text-gray-600">Total Bookings</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-50 rounded-xl">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">{bookingStats.completed}</p>
                <p className="text-sm text-gray-600">Completed</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow">
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

          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-50 rounded-xl">
                <CreditCard className="w-6 h-6 text-purple-600" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">MWK {bookingStats.totalSpent.toLocaleString()}</p>
                <p className="text-sm text-gray-600">Total Spent</p>
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

                    {/* Quick Actions - Horizontal Layout */}
                    <div className="mt-8 p-6 bg-gradient-to-r from-gray-50 to-blue-50 rounded-2xl border border-gray-100">
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
                          onClick={() => router.push('/bookings')}
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
                          className="flex flex-col items-center p-4 bg-white rounded-xl border border-orange-100 hover:border-orange-300 hover:shadow-md transition-all group"
                        >
                          <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-3 group-hover:bg-orange-200 transition-colors">
                            <Download className="w-6 h-6 text-orange-600" />
                          </div>
                          <span className="font-medium text-gray-900 text-sm">Tickets</span>
                          <span className="text-xs text-gray-500 mt-1">Download & view</span>
                        </button>
                      </div>
                    </div>
                  </>
                )
              )}

              {activeTab === 'bookings' && (
                <>
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">My Bookings</h2>
                  <div className="text-center py-12">
                    <Bus className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-600 mb-4">Booking management features coming soon</p>
                    <button
                      onClick={() => router.push('/bookings')}
                      className="px-6 py-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-colors"
                    >
                      View All Bookings
                    </button>
                  </div>
                </>
              )}

              {activeTab === 'payments' && (
                <>
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Payment Management</h2>
                  
                  {/* Payment Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
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
                          <CreditCard className="w-6 h-6 text-blue-600" />
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-blue-900">
                            MWK {Math.round(travelInsights.averageTripCost).toLocaleString()}
                          </p>
                          <p className="text-sm text-blue-700">Average per Trip</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recent Transactions */}
                  <div className="mb-8">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Transactions</h3>
                    <div className="space-y-3">
                      {recentBookings.map((booking) => (
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
                            <div className={`px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(booking.status)}`}>
                              {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Payment Methods */}
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Payment Methods</h3>
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
                        <button className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors">
                          Configure
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'settings' && (
                <>
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Account Settings</h2>
                  <div className="space-y-6">
                    <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Preferences</h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">Email Notifications</p>
                            <p className="text-sm text-gray-600">Receive booking confirmations and updates</p>
                          </div>
                          <button className="w-12 h-6 bg-blue-600 rounded-full relative transition-colors">
                            <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5 transition-transform"></div>
                          </button>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">SMS Notifications</p>
                            <p className="text-sm text-gray-600">Get trip reminders via SMS</p>
                          </div>
                          <button className="w-12 h-6 bg-gray-300 rounded-full relative transition-colors">
                            <div className="w-5 h-5 bg-white rounded-full absolute left-0.5 top-0.5 transition-transform"></div>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 bg-red-50 rounded-2xl border border-red-100">
                      <h3 className="text-lg font-semibold text-red-900 mb-4">Danger Zone</h3>
                      <div className="space-y-3">
                        <button className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors">
                          Delete Account
                        </button>
                        <p className="text-sm text-red-700">This action cannot be undone</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'security' && (
                <>
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Security Settings</h2>
                  <div className="space-y-6">
                    <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Password</h3>
                      <div className="space-y-4">
                        <button className="px-6 py-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-colors">
                          Change Password
                        </button>
                        <p className="text-sm text-gray-600">Last changed: Never</p>
                      </div>
                    </div>

                    <div className="p-6 bg-green-50 rounded-2xl border border-green-100">
                      <h3 className="text-lg font-semibold text-green-900 mb-4">Two-Factor Authentication</h3>
                      <div className="space-y-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                          <span className="text-sm text-gray-700">Not enabled</span>
                        </div>
                        <button className="px-6 py-3 bg-green-600 text-white rounded-2xl hover:bg-green-700 transition-colors">
                          Enable 2FA
                        </button>
                      </div>
                    </div>

                    <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Login Activity</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center py-2">
                          <div>
                            <p className="text-sm font-medium text-gray-900">Current session</p>
                            <p className="text-xs text-gray-600">Blantyre, Malawi - Now</p>
                          </div>
                          <span className="text-xs text-green-600 font-medium">Active</span>
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
            {/* Recent Bookings with corrected data */}
            <div className="bg-white rounded-3xl shadow-lg p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Recent Bookings</h3>
                <button
                  onClick={() => router.push('/bookings')}
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
                  {recentBookings.map((booking) => (
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

            {/* Travel Insights Card */}
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
                      <Star className="w-5 h-5 text-purple-600" />
                      <span className="text-sm font-medium text-purple-900">Loyalty Points</span>
                    </div>
                    <span className="text-sm text-purple-700">
                      {bookingStats.completed * 10} pts
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Completion */}
            {!profile.profileCompleted && (
              <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200 rounded-3xl shadow-lg p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <AlertTriangle className="w-6 h-6 text-yellow-600" />
                  <h3 className="text-lg font-bold text-yellow-800">Complete Your Profile</h3>
                </div>
                <p className="text-yellow-700 mb-4 text-sm">
                  Complete your profile to unlock all features and enjoy a better booking experience.
                </p>
                <button
                  onClick={() => setEditProfile(true)}
                  className="w-full bg-yellow-600 text-white py-3 rounded-2xl hover:bg-yellow-700 transition-colors font-semibold"
                >
                  Complete Profile
                </button>
              </div>
            )}

            {/* Achievement Badge */}
            {profile.profileCompleted && bookingStats.completed >= 5 && (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-3xl shadow-lg p-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Star className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-green-800 mb-2">Frequent Traveler</h3>
                  <p className="text-green-700 text-sm mb-4">
                    You've completed {bookingStats.completed} trips! Keep exploring Malawi.
                  </p>
                  <div className="bg-green-100 rounded-2xl px-4 py-2 inline-block">
                    <span className="text-green-800 font-semibold text-sm">🎉 Achievement Unlocked</span>
                  </div>
                </div>
              </div>
            )}

            {/* Notifications */}
            <div className="bg-white rounded-3xl shadow-lg p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Notifications</h3>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-xs text-gray-500">2 new</span>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-2xl border border-blue-100">
                  <div className="p-1 bg-blue-100 rounded-lg">
                    <Bell className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900">Trip Reminder</p>
                    <p className="text-xs text-blue-700">Your next trip is coming up soon</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-2xl border border-green-100">
                  <div className="p-1 bg-green-100 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-900">Payment Confirmed</p>
                    <p className="text-xs text-green-700">Your payment was processed successfully</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-2xl transition-colors cursor-pointer">
                  <div className="p-1 bg-gray-100 rounded-lg">
                    <TrendingUp className="w-4 h-4 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">New Routes Available</p>
                    <p className="text-xs text-gray-600">Discover new destinations</p>
                  </div>
                </div>
              </div>

              <button className="w-full mt-4 text-sm text-gray-600 hover:text-gray-800 font-medium py-2 border-t border-gray-100">
                View All Notifications
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Section - Enhanced Travel Insights */}
        <div className="mt-8 bg-white rounded-3xl shadow-lg p-8 border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Detailed Travel Analytics</h2>
            <button 
              onClick={() => setActiveTab('analytics')}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View Details
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <MapPin className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Most Visited</h3>
              <p className="text-gray-600">{travelInsights.mostVisitedDestination || 'N/A'}</p>
              {travelInsights.mostVisitedDestination && (
                <p className="text-xs text-blue-600 mt-1">
                  {travelInsights.destinationCounts[travelInsights.mostVisitedDestination]} trips
                </p>
              )}
            </div>

            <div className="text-center p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border border-green-100">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <CreditCard className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Avg. Trip Cost</h3>
              <p className="text-gray-600">MWK {Math.round(travelInsights.averageTripCost).toLocaleString()}</p>
            </div>

            <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border border-purple-100">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Bus className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Favorite Company</h3>
              <p className="text-gray-600">{travelInsights.favoriteCompany || 'N/A'}</p>
              {travelInsights.favoriteCompany && (
                <p className="text-xs text-purple-600 mt-1">
                  {travelInsights.companyCounts[travelInsights.favoriteCompany]} bookings
                </p>
              )}
            </div>

            <div className="text-center p-6 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl border border-yellow-100">
              <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Star className="w-6 h-6 text-yellow-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Loyalty Status</h3>
              <p className="text-gray-600">
                {bookingStats.completed >= 10 ? 'Gold' : 
                 bookingStats.completed >= 5 ? 'Silver' : 'Bronze'}
              </p>
              <p className="text-xs text-yellow-600 mt-1">
                {bookingStats.completed * 10} points earned
              </p>
            </div>
          </div>

          {/* Spending Chart Placeholder */}
          {bookingStats.total > 0 && (
            <div className="mt-8 p-6 bg-gray-50 rounded-2xl">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Activity</h3>
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>Last 30 days</span>
                <span>{bookingStats.total} total bookings</span>
              </div>
              <div className="mt-4 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
                  style={{ 
                    width: `${Math.min(100, (bookingStats.completed / bookingStats.total) * 100)}%` 
                  }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>Completion Rate</span>
                <span>{Math.round((bookingStats.completed / bookingStats.total) * 100)}%</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;