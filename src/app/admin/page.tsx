'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebaseConfig';
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  Timestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import {
  Loader2,
  Plus,
  Edit,
  Trash,
  Building2,
  CheckCircle,
  Clock,
  Ban,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  X,
  Search,
  SortAsc,
  SortDesc,
  Eye,
  BarChart3,
  List,
  User,
  DollarSign,
  Calendar,
  Map,
  Download,
  Phone,
  Mail,
} from 'lucide-react';
import AlertMessage from '../../components/AlertMessage';
import {
  Company,
  UserProfile,
  Booking,
  Schedule,
  Route,
  FirestoreDocument,
} from '@/types/index';
import TabButton from '@/components/tabButton';
import CompanyProfileTab from '@/components/company-Profile';
import StatCard from '@/components/startCard';

// Types and Interfaces
type StatusFilter = 'all' | 'active' | 'inactive' | 'pending';
type SortBy = 'name' | 'createdAt' | 'status' | 'email';
type SortOrder = 'asc' | 'desc';
type TabType = 'overview' | 'companies' | 'bookings' | 'profile' | 'routes' | 'schedules';

interface AlertState {
  type: 'error' | 'success' | 'warning' | 'info';
  message: string;
  id: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  contact?: string;
  adminPhone?: string;
  adminFirstName?: string;
  adminLastName?: string;
}

interface LoadingStates {
  companies: boolean;
  bookings: boolean;
  creating: boolean;
  updating: boolean;
  deleting: boolean;
  initializing: boolean;
}

interface DashboardStats {
  totalCompanies: number;
  activeCompanies: number;
  pendingCompanies: number;
  inactiveCompanies: number;
  totalRevenue: number;
  monthlyRevenue: number;
  totalBookings: number;
  monthlyBookings: number;
  monthlyGrowth: number;
  revenueGrowth: number;
}

interface CreateCompanyRequest {
  name: string;
  email: string;
  contact: string;
  status: Company['status'];
  address?: string;
  description?: string;
  adminFirstName?: string;
  adminLastName?: string;
  adminPhone?: string;
}

// Constants
const COMPANIES_PER_PAGE = 10;
const BOOKINGS_PER_PAGE = 10;
const MONTHLY_BOOKING_MULTIPLIER = 0.3;
const DEFAULT_GROWTH_RATES = { monthly: 12.5, revenue: 18.2 } as const;

const STATUS_CONFIG = {
  active: { color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
  pending: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock },
  inactive: { color: 'bg-red-100 text-red-800 border-red-200', icon: Ban },
} as const;

// Utility functions
const validateEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validatePhone = (phone: string): boolean => !phone || /^\+?[\d\s-()]{8,15}$/.test(phone);

// Fixed formatDate function to handle string, Date, and Timestamp
const formatDate = (date: Date | Timestamp | string | undefined): string => {
  if (!date) return '';
  
  let dateObj: Date;
  
  if (date instanceof Timestamp) {
    dateObj = date.toDate();
  } else if (date instanceof Date) {
    dateObj = date;
  } else if (typeof date === 'string') {
    dateObj = new Date(date);
  } else {
    return '';
  }

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateObj);
};

const debounce = <T extends (...args: any[]) => any>(func: T, wait: number) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Convert Firestore timestamp to Date
const convertTimestamp = (timestamp: any): Date => {
  if (timestamp instanceof Timestamp) return timestamp.toDate();
  if (timestamp && typeof timestamp.toDate === 'function') return timestamp.toDate();
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === 'string' || typeof timestamp === 'number') return new Date(timestamp);
  return new Date();
};

// Bookings Tab Component
const BookingsTab: React.FC<{
  bookings: Booking[];
  companies: Company[];
  schedules: Schedule[];
  routes: Route[];
  loading: boolean;
  setError: (msg: string) => void;
  setSuccess: (msg: string) => void;
}> = ({ bookings, companies, schedules, routes, loading, setError, setSuccess }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<Booking['bookingStatus'] | 'all'>('all');

  const filteredBookings = useMemo(() => {
    return bookings.filter(booking => {
      const company = companies.find(c => c.id === booking.companyId);
      const matchesSearch = !searchTerm ||
        company?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.bookingReference.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || booking.bookingStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [bookings, companies, searchTerm, statusFilter]);

  const paginationData = useMemo(() => {
    const totalItems = filteredBookings.length;
    const totalPages = Math.ceil(totalItems / BOOKINGS_PER_PAGE);
    const indexOfLastBooking = currentPage * BOOKINGS_PER_PAGE;
    const indexOfFirstBooking = indexOfLastBooking - BOOKINGS_PER_PAGE;
    const currentBookings = filteredBookings.slice(indexOfFirstBooking, indexOfLastBooking);

    return {
      currentBookings,
      totalPages,
      totalItems,
      currentPage,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1,
      startIndex: totalItems > 0 ? indexOfFirstBooking + 1 : 0,
      endIndex: Math.min(indexOfLastBooking, totalItems),
    };
  }, [filteredBookings, currentPage]);

  const exportBookingsData = () => {
    try {
      const csv = filteredBookings.map(booking => {
        const company = companies.find(c => c.id === booking.companyId);
        const schedule = schedules.find(s => s.id === booking.scheduleId);
        const route = schedule ? routes.find(r => r.id === schedule.routeId) : undefined;
        const createdAt = convertTimestamp(booking.createdAt);

        return [
          booking.bookingReference,
          company?.name || 'Unknown',
          route ? `${route.origin} → ${route.destination}` : 'Unknown',
          booking.bookingStatus,
          `MWK ${booking.totalAmount.toLocaleString()}`,
          formatDate(createdAt),
        ].join(',');
      }).join('\n');

      const headers = 'Booking Reference,Company,Route,Status,Amount,Date';
      const blob = new Blob([headers + '\n' + csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bookings-data.csv';
      a.click();
      window.URL.revokeObjectURL(url);
      setSuccess('Bookings data exported successfully!');
    } catch (error) {
      setError('Failed to export bookings data');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search bookings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as Booking['bookingStatus'] | 'all')}
          className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no-show">No Show</option>
        </select>
        <button
          onClick={exportBookingsData}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Table */}
      {!paginationData.totalItems ? (
        <div className="text-center py-12">
          <List className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No bookings found</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {['Booking Ref', 'Company', 'Route', 'Passenger', 'Amount', 'Status', 'Date'].map(header => (
                    <th key={header} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginationData.currentBookings.map(booking => {
                  const company = companies.find(c => c.id === booking.companyId);
                  const schedule = schedules.find(s => s.id === booking.scheduleId);
                  const route = schedule ? routes.find(r => r.id === schedule.routeId) : undefined;
                  const createdAt = convertTimestamp(booking.createdAt);
                  const primaryPassenger = booking.passengerDetails?.[0];

                  return (
                    <tr key={booking.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {booking.bookingReference}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{company?.name || 'Unknown'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {route ? `${route.origin} → ${route.destination}` : 'Unknown Route'}
                        </div>
                        <div className="text-xs text-gray-500">
                          Seats: {booking.seatNumbers.join(', ')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {primaryPassenger?.name || 'Unknown'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {booking.passengerDetails.length} passenger(s)
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          MWK {booking.totalAmount.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          Payment: {booking.paymentStatus}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                          booking.bookingStatus === 'confirmed' ? 'bg-green-100 text-green-800' :
                          booking.bookingStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          booking.bookingStatus === 'completed' ? 'bg-blue-100 text-blue-800' :
                          booking.bookingStatus === 'cancelled' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {booking.bookingStatus === 'confirmed' ? <CheckCircle className="w-3 h-3" /> :
                           booking.bookingStatus === 'pending' ? <Clock className="w-3 h-3" /> :
                           <AlertCircle className="w-3 h-3" />}
                          {booking.bookingStatus.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {paginationData.startIndex} to {paginationData.endIndex} of {paginationData.totalItems} results
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={!paginationData.hasPrevPage}
                className="p-2 border rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm">
                Page {currentPage} of {paginationData.totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, paginationData.totalPages))}
                disabled={!paginationData.hasNextPage}
                className="p-2 border rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Main Component
export default function SuperAdminDashboard() {
  const router = useRouter();
  const { user, userProfile, signOut, loading: authLoading } = useAuth();

  // State
  const [companies, setCompanies] = useState<Company[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalCompanies: 0,
    activeCompanies: 0,
    pendingCompanies: 0,
    inactiveCompanies: 0,
    totalRevenue: 0,
    monthlyRevenue: 0,
    totalBookings: 0,
    monthlyBookings: 0,
    monthlyGrowth: 0,
    revenueGrowth: 0,
  });

  const [loadingStates, setLoadingStates] = useState<LoadingStates>({
    companies: true,
    bookings: true,
    creating: false,
    updating: false,
    deleting: false,
    initializing: true,
  });

  const [alerts, setAlerts] = useState<AlertState[]>([]);
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  // Filters and pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Modals
  const [modals, setModals] = useState({
    add: false,
    edit: false,
    view: false,
    delete: null as string | null,
  });
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  // Form data
  const [formData, setFormData] = useState<CreateCompanyRequest>({
    name: '',
    email: '',
    contact: '',
    status: 'pending',
    address: '',
    description: '',
    adminFirstName: '',
    adminLastName: '',
    adminPhone: '',
  });

  // Authorization check
  const isAuthorized = useMemo(() => userProfile?.role === 'superadmin', [userProfile?.role]);

  // Alert management
  const showAlert = useCallback((type: AlertState['type'], message: string) => {
    const id = Date.now().toString();
    const newAlert: AlertState = { type, message, id };
    setAlerts(prev => [...prev, newAlert]);
    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        setAlerts(prev => prev.filter(alert => alert.id !== id));
      }, 5000);
    }
  }, []);

  const clearAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
  }, []);

  const clearAllAlerts = useCallback(() => setAlerts([]), []);

  // Form validation
  const validateForm = useCallback((): boolean => {
    const errors: FormErrors = {};
    if (!formData.name.trim()) errors.name = 'Company name is required';
    if (!formData.email.trim()) errors.email = 'Admin email is required';
    else if (!validateEmail(formData.email)) errors.email = 'Please enter a valid email address';
    if (formData.contact && !validatePhone(formData.contact)) errors.contact = 'Please enter a valid phone number';
    if (formData.adminPhone && !validatePhone(formData.adminPhone)) errors.adminPhone = 'Please enter a valid admin phone number';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  // Loading state management
  const setLoadingState = useCallback((key: keyof LoadingStates, value: boolean) => {
    setLoadingStates(prev => ({ ...prev, [key]: value }));
  }, []);

  // Stats calculation
  const calculateStats = useCallback((companyList: Company[], bookingList: Booking[]) => {
    try {
      const totalCompanies = companyList.length;
      const activeCompanies = companyList.filter(c => c.status === 'active').length;
      const pendingCompanies = companyList.filter(c => c.status === 'pending').length;
      const inactiveCompanies = companyList.filter(c => c.status === 'inactive').length;

      // Calculate revenue from bookings
      const totalRevenue = bookingList.reduce((sum, booking) => {
        return booking.bookingStatus !== 'cancelled' ? sum + (booking.totalAmount || 0) : sum;
      }, 0);

      const totalBookings = bookingList.length;

      setStats({
        totalCompanies,
        activeCompanies,
        pendingCompanies,
        inactiveCompanies,
        totalRevenue,
        monthlyRevenue: totalRevenue * MONTHLY_BOOKING_MULTIPLIER,
        totalBookings,
        monthlyBookings: Math.floor(totalBookings * MONTHLY_BOOKING_MULTIPLIER),
        monthlyGrowth: DEFAULT_GROWTH_RATES.monthly,
        revenueGrowth: DEFAULT_GROWTH_RATES.revenue,
      });
    } catch (error) {
      console.error('Error calculating stats:', error);
      showAlert('error', 'Failed to calculate dashboard statistics');
    }
  }, [showAlert]);

  // Data fetching effect
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push('/');
      return;
    }

    if (!userProfile) return;

    if (userProfile.role !== 'superadmin') {
      showAlert('error', "You don't have permission to view this page.");
      router.push('/');
      return;
    }

    setLoadingState('initializing', true);

    const unsubscribers: (() => void)[] = [];

    // Companies listener
    const companiesQuery = query(collection(db, 'companies'), orderBy('createdAt', 'desc'));
    const companiesUnsub = onSnapshot(
      companiesQuery,
      (snapshot) => {
        const companyList = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            status: data.status || 'pending', // Default to 'pending' if status is missing
            createdAt: convertTimestamp(data.createdAt),
            updatedAt: convertTimestamp(data.updatedAt),
          } as Company;
        });
        setCompanies(companyList);
        setLoadingState('companies', false);
      },
      (error) => {
        console.error('Error in companies listener:', error);
        showAlert('error', `Failed to load companies: ${error.message}`);
        setLoadingState('companies', false);
      }
    );
    unsubscribers.push(companiesUnsub);

    // Bookings listener
    const bookingsUnsub = onSnapshot(
      collection(db, 'bookings'),
      (snapshot) => {
        const bookingList = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: convertTimestamp(data.createdAt),
            bookingDate: convertTimestamp(data.bookingDate),
            cancellationDate: data.cancellationDate ? convertTimestamp(data.cancellationDate) : undefined,
            refundDate: data.refundDate ? convertTimestamp(data.refundDate) : undefined,
          } as Booking;
        });
        setBookings(bookingList);
        setLoadingState('bookings', false);
      },
      (error) => {
        console.error('Error in bookings listener:', error);
        showAlert('error', `Failed to load bookings: ${error.message}`);
        setLoadingState('bookings', false);
      }
    );
    unsubscribers.push(bookingsUnsub);

    // Load static data
    const fetchStaticData = async () => {
      try {
        const [schedulesSnapshot, routesSnapshot] = await Promise.all([
          getDocs(collection(db, 'schedules')),
          getDocs(collection(db, 'routes')),
        ]);

        const scheduleList = schedulesSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            companyId: data.companyId || '',
            busId: data.busId || '',
            routeId: data.routeId || '',
            departureLocation: data.departureLocation || '',
            arrivalLocation: data.arrivalLocation || '',
            departureDateTime: convertTimestamp(data.departureDateTime),
            arrivalDateTime: convertTimestamp(data.arrivalDateTime),
            price: data.price || 0,
            availableSeats: data.availableSeats || 0,
            bookedSeats: data.bookedSeats || [],
            status: data.status || 'active',
            isActive: data.isActive ?? true,
            createdAt: convertTimestamp(data.createdAt),
            updatedAt: data.updatedAt ? convertTimestamp(data.updatedAt) : undefined,
          } as Schedule;
        });

        const routeList = routesSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || '',
            companyId: data.companyId || '',
            origin: data.origin || '',
            destination: data.destination || '',
            distance: data.distance || 0,
            duration: data.duration || 0,
            stops: data.stops || [],
            status: data.status || 'active',
            createdAt: convertTimestamp(data.createdAt),
            updatedAt: data.updatedAt ? convertTimestamp(data.updatedAt) : undefined,
          } as Route;
        });

        setSchedules(scheduleList);
        setRoutes(routeList);
      } catch (error) {
        console.error('Error loading static data:', error);
        showAlert('error', 'Failed to load schedules and routes data');
      }
    };

    fetchStaticData().finally(() => setLoadingState('initializing', false));

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [user, userProfile, authLoading, router, showAlert, setLoadingState]);

  // Calculate stats when data changes
  useEffect(() => {
    calculateStats(companies, bookings);
  }, [companies, bookings, calculateStats]);

  // Company management functions
  const handleCreateCompany = async () => {
    if (!validateForm() || !user) {
      showAlert('error', 'Please fix the form errors or log in.');
      return;
    }

    setLoadingState('creating', true);
    clearAllAlerts();

    try {
      const response = await fetch('/api/create-company', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName: formData.name.trim(),
          companyEmail: formData.email.trim().toLowerCase(),
          adminFirstName: formData.adminFirstName?.trim() || '',
          adminLastName: formData.adminLastName?.trim() || '',
          adminPhone: formData.adminPhone?.trim() || '',
          companyContact: formData.contact?.trim() || '',
          companyAddress: formData.address?.trim() || '',
          companyDescription: formData.description?.trim() || '',
          status: formData.status,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      if (data.success) {
        showAlert('success', data.message || 'Company created successfully!');
        closeModal('add');
        resetForm();
        // Optionally refresh companies list
        const companiesQuery = query(collection(db, 'companies'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(companiesQuery);
        const updatedCompanies = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          status: doc.data().status || 'pending',
          createdAt: convertTimestamp(doc.data().createdAt),
          updatedAt: convertTimestamp(doc.data().updatedAt),
        }) as Company);
        setCompanies(updatedCompanies);
      } else {
        showAlert('error', data.error || 'Failed to create company');
      }
    } catch (error: any) {
      console.error('Company creation error:', error);

      if (error.message.includes('Failed to fetch')) {
        showAlert('error', 'Network error. Please check your connection and try again.');
      } else if (error.message.includes('JSON')) {
        showAlert('error', 'Server response error. Please try again.');
      } else {
        showAlert('error', error.message || 'Failed to create company. Please try again.');
      }
    } finally {
      setLoadingState('creating', false);
    }
  };

  const handleUpdateCompany = async () => {
    if (!validateForm() || !selectedCompany) {
      showAlert('error', 'Please fix the form errors.');
      return;
    }

    setLoadingState('updating', true);
    clearAllAlerts();

    try {
      await updateDoc(doc(db, 'companies', selectedCompany.id), {
        name: formData.name.trim(),
        contact: formData.contact?.trim() || '',
        address: formData.address?.trim() || '',
        description: formData.description?.trim() || '',
        status: formData.status,
        updatedAt: Timestamp.now(),
      });

      showAlert('success', 'Company updated successfully!');
      closeModal('edit');
      // Refresh companies list
      const companiesQuery = query(collection(db, 'companies'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(companiesQuery);
      const updatedCompanies = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        status: doc.data().status || 'pending',
        createdAt: convertTimestamp(doc.data().createdAt),
        updatedAt: convertTimestamp(doc.data().updatedAt),
      }) as Company);
      setCompanies(updatedCompanies);
    } catch (error: any) {
      showAlert('error', `Failed to update company: ${error.message}`);
    } finally {
      setLoadingState('updating', false);
    }
  };

  const handleDeleteCompany = async (companyId: string) => {
    setLoadingState('deleting', true);
    clearAllAlerts();

    try {
      await deleteDoc(doc(db, 'companies', companyId));
      showAlert('success', 'Company deleted successfully!');
      closeModal('delete');
      // Refresh companies list
      const companiesQuery = query(collection(db, 'companies'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(companiesQuery);
      const updatedCompanies = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        status: doc.data().status || 'pending',
        createdAt: convertTimestamp(doc.data().createdAt),
        updatedAt: convertTimestamp(doc.data().updatedAt),
      }) as Company);
      setCompanies(updatedCompanies);
    } catch (error: any) {
      showAlert('error', `Failed to delete company: ${error.message}`);
    } finally {
      setLoadingState('deleting', false);
    }
  };

  const handleStatusChange = async (companyId: string, newStatus: Company['status']) => {
    try {
      await updateDoc(doc(db, 'companies', companyId), {
        status: newStatus,
        updatedAt: Timestamp.now(),
      });
      showAlert('success', `Company status updated to ${newStatus}`);
      // Refresh companies list
      const companiesQuery = query(collection(db, 'companies'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(companiesQuery);
      const updatedCompanies = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        status: doc.data().status || 'pending',
        createdAt: convertTimestamp(doc.data().createdAt),
        updatedAt: convertTimestamp(doc.data().updatedAt),
      }) as Company);
      setCompanies(updatedCompanies);
    } catch (error: any) {
      showAlert('error', `Failed to update status: ${error.message}`);
    }
  };

  // Modal management
  const openModal = useCallback((modalType: keyof typeof modals, company?: Company) => {
    if (company) {
      setSelectedCompany(company);
      if (modalType === 'edit') {
        setFormData({
          name: company.name,
          email: company.email || '',
          contact: company.contact || '',
          status: company.status || 'pending',
          address: company.address || '',
          description: company.description || '',
          adminFirstName: '',
          adminLastName: '',
          adminPhone: '',
        });
      }
    }
    setModals(prev => ({
      ...prev,
      [modalType]: modalType === 'delete' ? company?.id || true : true,
    }));
    setFormErrors({});
  }, []);

  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      email: '',
      contact: '',
      status: 'pending',
      address: '',
      description: '',
      adminFirstName: '',
      adminLastName: '',
      adminPhone: '',
    });
    setFormErrors({});
  }, []);

  const closeModal = useCallback((modalType: keyof typeof modals) => {
    setModals(prev => ({
      ...prev,
      [modalType]: modalType === 'delete' ? null : false,
    }));
    setSelectedCompany(null);
    resetForm();
  }, [resetForm]);

  // Search and filtering
  const debouncedSearch = useMemo(() =>
    debounce(() => setCurrentPage(1), 300),
    []
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    debouncedSearch();
  };

  const filteredAndSortedCompanies = useMemo(() => {
    return companies
      .filter(company => {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm ||
          company.name.toLowerCase().includes(searchLower) ||
          company.email.toLowerCase().includes(searchLower);
        const matchesStatus = statusFilter === 'all' || company.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        let aValue: any = a[sortBy];
        let bValue: any = b[sortBy];

        // Handle date sorting
        if (sortBy === 'createdAt') {
          aValue = aValue instanceof Date ? aValue.getTime() : new Date(aValue).getTime();
          bValue = bValue instanceof Date ? bValue.getTime() : new Date(bValue).getTime();
        } else {
          aValue = String(aValue || '').toLowerCase();
          bValue = String(bValue || '').toLowerCase();
        }

        if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [companies, searchTerm, statusFilter, sortBy, sortOrder]);

  const paginationData = useMemo(() => {
    const totalItems = filteredAndSortedCompanies.length;
    const totalPages = Math.ceil(totalItems / COMPANIES_PER_PAGE);
    const indexOfLastCompany = currentPage * COMPANIES_PER_PAGE;
    const indexOfFirstCompany = indexOfLastCompany - COMPANIES_PER_PAGE;
    const currentCompanies = filteredAndSortedCompanies.slice(
      indexOfFirstCompany,
      indexOfLastCompany
    );

    return {
      currentCompanies,
      totalPages,
      totalItems,
      currentPage,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1,
      startIndex: totalItems > 0 ? indexOfFirstCompany + 1 : 0,
      endIndex: Math.min(indexOfLastCompany, totalItems),
    };
  }, [filteredAndSortedCompanies, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, sortBy, sortOrder]);

  // Helper functions
  const getStatusIcon = useCallback((status?: string) => {
    const IconComponent = status && STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.icon || AlertCircle;
    return <IconComponent className="w-4 h-4" />;
  }, []);

  const getStatusColor = useCallback((status?: string) => {
    return status && STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.color ||
           'bg-gray-100 text-gray-800 border-gray-200';
  }, []);

  // Export functions
  const exportCompaniesData = () => {
    try {
      const csv = filteredAndSortedCompanies.map(company =>
        [
          company.id,
          company.name,
          company.email,
          company.contact || '',
          company.status || 'pending',
          formatDate(company.createdAt),
        ].join(',')
      ).join('\n');

      const headers = 'ID,Name,Email,Contact,Status,Created';
      const blob = new Blob([headers + '\n' + csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'companies-data.csv';
      a.click();
      window.URL.revokeObjectURL(url);
      showAlert('success', 'Companies data exported successfully!');
    } catch (error) {
      showAlert('error', 'Failed to export companies data');
    }
  };

  const exportStatsData = () => {
    try {
      const statsData = [
        ['Metric', 'Value'],
        ['Total Companies', stats.totalCompanies.toString()],
        ['Active Companies', stats.activeCompanies.toString()],
        ['Pending Companies', stats.pendingCompanies.toString()],
        ['Inactive Companies', stats.inactiveCompanies.toString()],
        ['Total Revenue', `MWK ${stats.totalRevenue.toLocaleString()}`],
        ['Total Bookings', stats.totalBookings.toString()],
        ['Monthly Bookings', stats.monthlyBookings.toString()],
        ['Monthly Growth', `${stats.monthlyGrowth}%`],
        ['Revenue Growth', `${stats.revenueGrowth}%`],
        ['Active Routes', routes.length.toString()],
        ['Active Schedules', schedules.length.toString()],
      ];

      const csv = statsData.map(row => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dashboard-stats.csv';
      a.click();
      window.URL.revokeObjectURL(url);
      showAlert('success', 'Stats exported successfully!');
    } catch (error) {
      showAlert('error', 'Failed to export stats');
    }
  };

  // Loading and authorization checks
  if (authLoading || loadingStates.initializing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">
            {authLoading ? 'Authenticating...' : 'Loading Dashboard...'}
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">
            You don't have permission to access this dashboard.
          </p>
          <button
            onClick={() => router.push('/')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Super Admin Dashboard</h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              Welcome, {userProfile?.firstName || userProfile?.email}
            </span>
            <button
              onClick={signOut}
              className="text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg border hover:bg-gray-50 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Alerts */}
        <div className="space-y-2 mb-6">
          {alerts.map(alert => (
            <AlertMessage
              key={alert.id}
              type={alert.type}
              message={alert.message}
              onClose={() => clearAlert(alert.id)}
            />
          ))}
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 mb-8 bg-white p-2 rounded-xl shadow-sm">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'companies', label: 'Companies', icon: Building2 },
            { id: 'bookings', label: 'Bookings', icon: List },
            { id: 'routes', label: 'Routes', icon: Map },
            { id: 'schedules', label: 'Schedules', icon: Calendar },
            { id: 'profile', label: 'Profile', icon: User },
          ].map(tab => (
            <TabButton
              key={tab.id}
              id={tab.id}
              label={tab.label}
              icon={tab.icon}
              isActive={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
            />
          ))}
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                  title="Total Companies"
                  value={stats.totalCompanies}
                  icon={Building2}
                  color="blue"
                />
                <StatCard
                  title="Total Revenue"
                  value={`MWK ${stats.totalRevenue.toLocaleString()}`}
                  icon={DollarSign}
                  color="green"
                />
                <StatCard
                  title="Total Bookings"
                  value={stats.totalBookings}
                  icon={Calendar}
                  color="purple"
                />
                <StatCard
                  title="Active Routes"
                  value={routes.length}
                  icon={Map}
                  color="orange"
                />
                <StatCard
                  title="Active Companies"
                  value={stats.activeCompanies}
                  icon={CheckCircle}
                  color="green"
                />
                <StatCard
                  title="Pending Companies"
                  value={stats.pendingCompanies}
                  icon={Clock}
                  color="yellow"
                />
                <StatCard
                  title="Monthly Growth"
                  value={`${stats.monthlyGrowth}%`}
                  icon={BarChart3}
                  color="teal"
                />
                <StatCard
                  title="Revenue Growth"
                  value={`${stats.revenueGrowth}%`}
                  icon={DollarSign}
                  color="indigo"
                />
              </div>

              {/* Export Button */}
              <div className="flex justify-end">
                <button
                  onClick={exportStatsData}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                >
                  <Download className="w-5 h-5" />
                  Export Stats
                </button>
              </div>
            </div>
          )}

          {activeTab === 'companies' && (
            <div className="space-y-6">
              {/* Filters and Actions */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search companies..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                    className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <button
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="p-2 border rounded-lg hover:bg-gray-50"
                  >
                    {sortOrder === 'asc' ? <SortAsc className="w-5 h-5" /> : <SortDesc className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={exportCompaniesData}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                  >
                    <Download className="w-4 h-4" />
                    Export
                  </button>
                  <button
                    onClick={() => openModal('add')}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="w-5 h-5" />
                    Add Company
                  </button>
                </div>
              </div>

              {/* Companies Table */}
              {paginationData.totalItems === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No companies found</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          {['Company', 'Contact', 'Status', 'Created', 'Actions'].map(header => (
                            <th
                              key={header}
                              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {paginationData.currentCompanies.map(company => (
                          <tr key={company.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                {company.logo ? (
                                  <img
                                    src={company.logo}
                                    alt={company.name}
                                    className="h-10 w-10 rounded-lg object-cover"
                                  />
                                ) : (
                                  <Building2 className="h-10 w-10 text-gray-400 p-2 bg-gray-100 rounded-lg" />
                                )}
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">
                                    {company.name}
                                  </div>
                                  <div className="text-sm text-gray-500 flex items-center gap-1">
                                    <Mail className="w-3 h-3" />
                                    {company.email}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900 flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {company.contact || 'N/A'}
                              </div>
                              {company.address && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {company.address}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(company.status)}`}>
                                {getStatusIcon(company.status)}
                                {company.status ? company.status.charAt(0).toUpperCase() + company.status.slice(1) : 'Unknown'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(company.createdAt)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => openModal('view', company)}
                                  className="text-blue-600 hover:text-blue-800 p-1"
                                  title="View Details"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => openModal('edit', company)}
                                  className="text-amber-600 hover:text-amber-800 p-1"
                                  title="Edit Company"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => openModal('delete', company)}
                                  className="text-red-600 hover:text-red-800 p-1"
                                  title="Delete Company"
                                >
                                  <Trash className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-700">
                      Showing {paginationData.startIndex} to {paginationData.endIndex} of {paginationData.totalItems} results
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={!paginationData.hasPrevPage}
                        className="p-2 border rounded-lg disabled:opacity-50 hover:bg-gray-50"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <span className="text-sm">
                        Page {currentPage} of {paginationData.totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, paginationData.totalPages))}
                        disabled={!paginationData.hasNextPage}
                        className="p-2 border rounded-lg disabled:opacity-50 hover:bg-gray-50"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'bookings' && (
            <BookingsTab
              bookings={bookings}
              companies={companies}
              schedules={schedules}
              routes={routes}
              loading={loadingStates.bookings}
              setError={msg => showAlert('error', msg)}
              setSuccess={msg => showAlert('success', msg)}
            />
          )}

          {activeTab === 'profile' && selectedCompany && (
            <CompanyProfileTab
              company={selectedCompany}
              setCompany={setSelectedCompany}
            />
          )}

          {activeTab === 'routes' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Routes Management</h3>
                <button
                  onClick={() => {
                    const csv = routes.map(route =>
                      [
                        route.id,
                        route.name,
                        route.origin,
                        route.destination,
                        route.distance,
                        route.duration,
                        formatDate(route.createdAt),
                      ].join(',')
                    ).join('\n');
                    const headers = 'ID,Name,Origin,Destination,Distance (km),Duration (min),Created';
                    const blob = new Blob([headers + '\n' + csv], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'routes-data.csv';
                    a.click();
                    window.URL.revokeObjectURL(url);
                    showAlert('success', 'Routes data exported successfully!');
                  }}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                >
                  <Download className="w-4 h-4" />
                  Export Routes
                </button>
              </div>

              {routes.length === 0 ? (
                <div className="text-center py-12">
                  <Map className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No routes found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Name', 'Origin', 'Destination', 'Distance', 'Duration', 'Stops', 'Status', 'Created'].map(header => (
                          <th
                            key={header}
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {routes.map(route => (
                        <tr key={route.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{route.name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{route.origin}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{route.destination}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{route.distance} km</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {Math.floor(route.duration / 60)}h {route.duration % 60}m
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{route.stops?.length || 0}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              route.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {route.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(route.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'schedules' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Schedules Management</h3>
                <button
                  onClick={() => {
                    const csv = schedules.map(schedule => {
                      const route = routes.find(r => r.id === schedule.routeId);
                      return [
                        schedule.id,
                        route?.name || 'Unknown',
                        formatDate(schedule.departureDateTime),
                        formatDate(schedule.arrivalDateTime),
                        `MWK ${schedule.price.toLocaleString()}`,
                        schedule.availableSeats,
                        schedule.status,
                        formatDate(schedule.createdAt),
                      ].join(',');
                    }).join('\n');
                    const headers = 'ID,Route,Departure,Arrival,Price,Available Seats,Status,Created';
                    const blob = new Blob([headers + '\n' + csv], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'schedules-data.csv';
                    a.click();
                    window.URL.revokeObjectURL(url);
                    showAlert('success', 'Schedules data exported successfully!');
                  }}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                >
                  <Download className="w-4 h-4" />
                  Export Schedules
                </button>
              </div>

              {schedules.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No schedules found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Route', 'Departure', 'Arrival', 'Price', 'Available Seats', 'Status', 'Created'].map(header => (
                          <th
                            key={header}
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {schedules.map(schedule => {
                        const route = routes.find(r => r.id === schedule.routeId);
                        return (
                          <tr key={schedule.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {route?.name || 'Unknown Route'}
                              </div>
                              <div className="text-xs text-gray-500">
                                {route ? `${route.origin} → ${route.destination}` : 'N/A'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {formatDate(schedule.departureDateTime)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {formatDate(schedule.arrivalDateTime)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                MWK {schedule.price.toLocaleString()}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {schedule.availableSeats}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                                schedule.status === 'active' ? 'bg-green-100 text-green-800' :
                                schedule.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {schedule.status.charAt(0).toUpperCase() + schedule.status.slice(1)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(schedule.createdAt)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Add Company Modal */}
      {modals.add && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center border-b pb-4">
              <h3 className="text-lg font-semibold">Add New Company</h3>
              <button onClick={() => closeModal('add')} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">Company Name</label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className={`mt-1 block w-full border rounded-md p-2 ${formErrors.name ? 'border-red-500' : 'border-gray-300'}`}
                />
                {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">Admin Email</label>
                <input
                  type="email"
                  id="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className={`mt-1 block w-full border rounded-md p-2 ${formErrors.email ? 'border-red-500' : 'border-gray-300'}`}
                />
                {formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}
              </div>
              <div>
                <label htmlFor="adminPhone" className="block text-sm font-medium text-gray-700">Admin Phone (Optional)</label>
                <input
                  type="tel"
                  id="adminPhone"
                  value={formData.adminPhone}
                  onChange={(e) => setFormData(prev => ({ ...prev, adminPhone: e.target.value }))}
                  className={`mt-1 block w-full border rounded-md p-2 ${formErrors.adminPhone ? 'border-red-500' : 'border-gray-300'}`}
                />
                {formErrors.adminPhone && <p className="text-red-500 text-xs mt-1">{formErrors.adminPhone}</p>}
              </div>
              <div>
                <label htmlFor="contact" className="block text-sm font-medium text-gray-700">Contact Phone</label>
                <input
                  type="tel"
                  id="contact"
                  value={formData.contact}
                  onChange={(e) => setFormData(prev => ({ ...prev, contact: e.target.value }))}
                  className={`mt-1 block w-full border rounded-md p-2 ${formErrors.contact ? 'border-red-500' : 'border-gray-300'}`}
                />
                {formErrors.contact && <p className="text-red-500 text-xs mt-1">{formErrors.contact}</p>}
              </div>
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700">Status</label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as Company['status'] }))}
                  className="mt-1 block w-full border rounded-md p-2 border-gray-300"
                >
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-4">
              <button onClick={() => closeModal('add')} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleCreateCompany}
                disabled={loadingStates.creating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300"
              >
                {loadingStates.creating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Company Modal */}
      {modals.edit && selectedCompany && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center border-b pb-4">
              <h3 className="text-lg font-semibold">Edit Company</h3>
              <button onClick={() => closeModal('edit')} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">Company Name</label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className={`mt-1 block w-full border rounded-md p-2 ${formErrors.name ? 'border-red-500' : 'border-gray-300'}`}
                />
                {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">Admin Email</label>
                <input
                  type="email"
                  id="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className={`mt-1 block w-full border rounded-md p-2 ${formErrors.email ? 'border-red-500' : 'border-gray-300'}`}
                  disabled
                />
                {formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}
              </div>
              <div>
                <label htmlFor="adminPhone" className="block text-sm font-medium text-gray-700">Admin Phone (Optional)</label>
                <input
                  type="tel"
                  id="adminPhone"
                  value={formData.adminPhone}
                  onChange={(e) => setFormData(prev => ({ ...prev, adminPhone: e.target.value }))}
                  className={`mt-1 block w-full border rounded-md p-2 ${formErrors.adminPhone ? 'border-red-500' : 'border-gray-300'}`}
                />
                {formErrors.adminPhone && <p className="text-red-500 text-xs mt-1">{formErrors.adminPhone}</p>}
              </div>
              <div>
                <label htmlFor="contact" className="block text-sm font-medium text-gray-700">Contact Phone</label>
                <input
                  type="tel"
                  id="contact"
                  value={formData.contact}
                  onChange={(e) => setFormData(prev => ({ ...prev, contact: e.target.value }))}
                  className={`mt-1 block w-full border rounded-md p-2 ${formErrors.contact ? 'border-red-500' : 'border-gray-300'}`}
                />
                {formErrors.contact && <p className="text-red-500 text-xs mt-1">{formErrors.contact}</p>}
              </div>
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700">Status</label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as Company['status'] }))}
                  className="mt-1 block w-full border rounded-md p-2 border-gray-300"
                >
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-4">
              <button onClick={() => closeModal('edit')} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleUpdateCompany}
                disabled={loadingStates.updating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300"
              >
                {loadingStates.updating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Company Modal */}
      {modals.view && selectedCompany && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center border-b pb-4">
              <h3 className="text-lg font-semibold">{selectedCompany.name}</h3>
              <button onClick={() => closeModal('view')} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-700">Status</span>
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(selectedCompany.status)}`}>
                  {getStatusIcon(selectedCompany.status)}
                  {selectedCompany.status ? selectedCompany.status.charAt(0).toUpperCase() + selectedCompany.status.slice(1) : 'Unknown'}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Email</p>
                <p className="text-sm text-gray-900">{selectedCompany.email}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Contact</p>
                <p className="text-sm text-gray-900">{selectedCompany.contact || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Created</p>
                <p className="text-sm text-gray-900">{formatDate(selectedCompany.createdAt)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Last Updated</p>
                <p className="text-sm text-gray-900">{formatDate(selectedCompany.updatedAt)}</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={() => closeModal('view')} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Company Modal */}
      {modals.delete && selectedCompany && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Confirm Delete</h3>
            <p className="text-gray-600 mb-6">Are you sure you want to delete <span className="font-bold">{selectedCompany.name}</span>? This action cannot be undone.</p>
            <div className="flex justify-end gap-4">
              <button onClick={() => closeModal('delete')} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => { if (typeof modals.delete === 'string') handleDeleteCompany(modals.delete); }}
                disabled={loadingStates.deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-300"
              >
                {loadingStates.deleting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}