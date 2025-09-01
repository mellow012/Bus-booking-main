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
  setDoc,
} from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, sendSignInLinkToEmail, ActionCodeSettings } from 'firebase/auth';
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
  Filter,
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
} from 'lucide-react';
import AlertMessage from '../../components/AlertMessage';
import {
  Company,
  DashboardStats,
  CreateCompanyRequest,
  UserProfile,
  Booking,
  Schedule,
  Route,
} from '@/types'; // Make sure this import points to your types/index.ts
import TabButton from '@/components/tabButton';
import CompanyProfileTab from '@/components/company-Profile';
import StatCard from '@/components/startCard';
import { v4 as uuidv4 } from 'uuid';

type StatusFilter = 'all' | 'active' | 'inactive' | 'pending';
type SortBy = 'name' | 'createdAt' | 'status' | 'email';
type SortOrder = 'asc' | 'desc';
type TabType = 'overview' | 'companies' | 'bookings' | 'profile' | 'routes' | 'schedules';

interface AlertState {
  type: 'error' | 'success' | 'warning' | 'info';
  message: string;
  id?: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  contact?: string;
  adminPhone?: string;
}

interface LoadingStates {
  companies: boolean;
  bookings: boolean;
  creating: boolean;
  updating: boolean;
  deleting: boolean;
  initializing: boolean;
}

const COMPANIES_PER_PAGE = 10;
const MONTHLY_BOOKING_MULTIPLIER = 0.3;
const DEFAULT_GROWTH_RATES = { monthly: 12.5, revenue: 18.2 } as const;

const STATUS_CONFIG = {
  active: { color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
  pending: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock },
  inactive: { color: 'bg-red-100 text-red-800 border-red-200', icon: Ban },
} as const;

const validateEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validatePhone = (phone: string): boolean => !phone || /^\+?[\d\s-()]{8,15}$/.test(phone);
const formatDate = (date: Date): string => new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);

const debounce = <T extends (...args: any[]) => any>(func: T, wait: number) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

const BookingsTab = ({ bookings, companies, schedules, routes, loading, setBookings, setError, setSuccess }: {
  bookings: Booking[];
  setBookings: (bookings: Booking[]) => void;
  companies: Company[];
  schedules: Schedule[];
  routes: Route[];
  loading: boolean;
  setError: (msg: string) => void;
  setSuccess: (msg: string) => void;
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const BOOKINGS_PER_PAGE = 10;

  const paginationData = useMemo(() => {
    const totalItems = bookings.length;
    const totalPages = Math.ceil(totalItems / BOOKINGS_PER_PAGE);
    const indexOfLastBooking = currentPage * BOOKINGS_PER_PAGE;
    const indexOfFirstBooking = indexOfLastBooking - BOOKINGS_PER_PAGE;
    const currentBookings = bookings.slice(indexOfFirstBooking, indexOfLastBooking);

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
  }, [bookings, currentPage]);

  if (loading) return <div className="flex items-center justify-center"><Loader2 className="w-12 h-12 text-blue-600 animate-spin" /></div>;
  if (!bookings.length) return <p className="text-gray-600">No bookings available.</p>;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>{['Company', 'Route', 'Schedule', 'Date', 'Status'].map(header => <th key={header} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{header}</th>)}</tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginationData.currentBookings.map(booking => {
              const company = companies.find(c => c.id === booking.companyId);
              const route = routes.find(r => r.id === booking.routeId);
              const schedule = schedules.find(s => s.id === booking.scheduleId);
              return (
                <tr key={booking.id}>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{company?.name || 'Unknown'}</div></td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{route?.name || 'Unknown'}</div></td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{schedule?.departureTime || 'N/A'}</div></td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(booking.createdAt || new Date())}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${booking.bookingStatus === 'confirmed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {booking.bookingStatus === 'confirmed' ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                      {booking.bookingStatus || 'Pending'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mt-6">
        <div className="text-sm text-gray-700">Showing {paginationData.startIndex} to {paginationData.endIndex} of {paginationData.totalItems} results</div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentPage(prev => prev - 1)} disabled={!paginationData.hasPrevPage} className="p-2 border rounded-lg disabled:opacity-50"><ChevronLeft className="w-5 h-5" /></button>
          <span className="text-sm">Page {currentPage} of {paginationData.totalPages}</span>
          <button onClick={() => setCurrentPage(prev => prev + 1)} disabled={!paginationData.hasNextPage} className="p-2 border rounded-lg disabled:opacity-50"><ChevronRight className="w-5 h-5" /></button>
        </div>
      </div>
    </div>
  );
};

export default function SuperAdminDashboard() {
  const router = useRouter();
  const { user, userProfile, signOut, loading: authLoading } = useAuth();

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

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const [modals, setModals] = useState({
    add: false,
    edit: false,
    view: false,
    delete: null as string | null,
  });
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  const [formData, setFormData] = useState<CreateCompanyRequest>({
    name: '',
    email: '',
    contact: '',
    status: 'pending',
    address: '',
    description: '',
  });

  const isAuthorized = useMemo(() => userProfile?.role === 'superadmin', [userProfile?.role]);

  const showAlert = useCallback((type: AlertState['type'], message: string) => {
    const id = Date.now().toString();
    const newAlert = { type, message, id };
    setAlerts(prev => [...prev, newAlert]);
    if (type === 'success' || type === 'info') setTimeout(() => setAlerts(prev => prev.filter(alert => alert.id !== id)), 5000);
  }, []);

  const clearAlert = useCallback((id: string) => setAlerts(prev => prev.filter(alert => alert.id !== id)), []);
  const clearAllAlerts = useCallback(() => setAlerts([]), []);

  const validateForm = useCallback((): boolean => {
    const errors: FormErrors = {};
    if (!formData.name.trim()) errors.name = 'Company name is required';
    if (!formData.email.trim()) errors.email = 'Admin email is required';
    else if (!validateEmail(formData.email)) errors.email = 'Please enter a valid email address';
    if (formData.contact && !validatePhone(formData.contact)) errors.contact = 'Please enter a valid phone number';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  const setLoadingState = useCallback((key: keyof LoadingStates, value: boolean) => {
    setLoadingStates(prev => ({ ...prev, [key]: value }));
  }, []);

  const calculateStats = useCallback((companyList: Company[], bookingList: Booking[]) => {
    try {
      const totalCompanies = companyList.length;
      const activeCompanies = companyList.filter(c => c.status === 'active').length;
      const pendingCompanies = companyList.filter(c => c.status === 'pending').length;
      const inactiveCompanies = companyList.filter(c => c.status === 'inactive').length;
      const totalRevenue = companyList.reduce((sum, company) => sum + (Number(company.monthlyRevenue) || 0), 0);
      const totalBookings = bookingList.length;
      setStats({
        totalCompanies,
        activeCompanies,
        pendingCompanies,
        inactiveCompanies,
        totalRevenue,
        monthlyRevenue: totalRevenue,
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

  useEffect(() => calculateStats(companies, bookings), [companies, bookings, calculateStats]);

  useEffect(() => {
    if (authLoading) {
      console.log('Auth still loading, waiting...');
      return;
    }
    if (!user) {
      console.log('No user, redirecting to home');
      router.push('/');
      return;
    }
    if (!userProfile) {
      console.log('User exists but no profile yet, waiting...');
      return;
    }
    if (userProfile.role !== 'superadmin') {
      console.log('User not authorized, redirecting');
      showAlert('error', "You don't have permission to view this page.");
      router.push('/');
      return;
    }

    setLoadingState('initializing', true);
    console.log('Initializing dashboard for Super Admin...');

    const unsubs: (() => void)[] = [];

    const companiesQuery = query(collection(db, 'companies'), orderBy('createdAt', 'desc'));
    const companiesUnsub = onSnapshot(companiesQuery, (snapshot) => {
      const companyList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt instanceof Timestamp ? doc.data().createdAt.toDate() : new Date(),
        updatedAt: doc.data().updatedAt instanceof Timestamp ? doc.data().updatedAt.toDate() : new Date(),
      }) as Company);
      setCompanies(companyList);
      setLoadingState('companies', false);
      console.log('Companies listener updated:', companyList.length);
    }, (error) => {
      console.error('Error in companies listener:', error);
      showAlert('error', `Failed to load companies: ${error.message}`);
      setLoadingState('companies', false);
    });
    unsubs.push(companiesUnsub);

    const bookingsUnsub = onSnapshot(collection(db, 'bookings'), (snapshot) => {
      const bookingList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt instanceof Timestamp ? doc.data().createdAt.toDate() : new Date(),
      }) as Booking);
      setBookings(bookingList);
      setLoadingState('bookings', false);
      console.log('Bookings listener updated:', bookingList.length);
    }, (error) => {
      console.error('Error in bookings listener:', error);
      showAlert('error', `Failed to load bookings: ${error.message}`);
      setLoadingState('bookings', false);
    });
    unsubs.push(bookingsUnsub);

    const fetchStaticData = async () => {
      try {
        const [schedulesSnapshot, routesSnapshot] = await Promise.all([
          getDocs(collection(db, 'schedules')),
          getDocs(collection(db, 'routes')),
        ]);
        setSchedules(schedulesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Schedule));
        setRoutes(routesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Route));
      } catch (error) {
        console.error('Error loading static data:', error);
        showAlert('error', 'Failed to load schedules and routes data');
      }
    };
    fetchStaticData().finally(() => setLoadingState('initializing', false));

    return () => {
      console.log('Cleaning up listeners...');
      unsubs.forEach(unsub => unsub());
    };
  }, [user, userProfile, authLoading, router, showAlert, setLoadingState]);

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
      }),
    });

    // Check if response is ok before parsing JSON
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    if (data.success) {
      showAlert('success', data.message);
      closeModal('add');
      resetForm();
      
      // Optionally refresh the companies list
      // You might want to trigger a refresh of your companies data here
    } else {
      showAlert('error', data.error || 'Failed to create company');
    }
  } catch (error: any) {
    console.error('Company creation error:', error);
    
    // Better error handling
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


  const handleDeleteCompany = async (companyId: string) => {
    setLoadingState('deleting', true);
    clearAllAlerts();
    try {
      await deleteDoc(doc(db, 'companies', companyId));
      showAlert('success', 'Company deleted successfully!');
      closeModal('delete');
    } catch (error) {
      showAlert('error', `Failed to delete company: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    } catch (error) {
      showAlert('error', `Failed to update status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const openModal = useCallback((modalType: keyof typeof modals, company?: Company) => {
    if (company) {
      setSelectedCompany(company);
      if (modalType === 'edit') {
        setFormData({
          name: company.name,
          email: company.email || '',
          contact: company.contact || '',
          status: company.status,
          address: company.address || '',
          description: company.description || '',
        });
      }
    }
    setModals(prev => ({ ...prev, [modalType]: modalType === 'delete' ? company?.id || true : true }));
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
    });
    setFormErrors({});
  }, []);

  const closeModal = useCallback((modalType: keyof typeof modals) => {
    setModals(prev => ({ ...prev, [modalType]: modalType === 'delete' ? null : false }));
    setSelectedCompany(null);
    resetForm();
  }, [resetForm]);

  const debouncedSearch = useMemo(() => debounce(() => setCurrentPage(1), 300), []);
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    debouncedSearch();
  };

  const filteredAndSortedCompanies = useMemo(() => {
    return companies
      .filter(company => {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm || company.name.toLowerCase().includes(searchLower) || company.email.toLowerCase().includes(searchLower);
        const matchesStatus = statusFilter === 'all' || company.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        const aValue = a[sortBy] || '';
        const bValue = b[sortBy] || '';
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
    const currentCompanies = filteredAndSortedCompanies.slice(indexOfFirstCompany, indexOfLastCompany);

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

  useEffect(() => setCurrentPage(1), [statusFilter, sortBy, sortOrder]);

  const getStatusIcon = useCallback((status: string) => {
    const IconComponent = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.icon || AlertCircle;
    return <IconComponent className="w-4 h-4" />;
  }, []);

  const getStatusColor = useCallback((status: string) => {
    return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.color || 'bg-gray-100 text-gray-800 border-gray-200';
  }, []);

  if (authLoading || loadingStates.initializing) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center"><Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" /><p className="text-gray-600">{authLoading ? 'Authenticating...' : 'Loading Dashboard...'}</p></div>
    </div>
  );
  if (!isAuthorized) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center"><AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" /><h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2><p className="text-gray-600 mb-4">You don't have permission to access this dashboard.</p></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Super Admin Dashboard</h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">Welcome, {userProfile?.name || userProfile?.email}</span>
            <button onClick={signOut} className="text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg border hover:bg-gray-50 transition-colors">Sign Out</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-2 mb-6">{alerts.map(alert => <AlertMessage key={alert.id} type={alert.type} message={alert.message} onClose={() => clearAlert(alert.id!)} />)}</div>

        <div className="flex flex-wrap gap-2 mb-8 bg-white p-2 rounded-xl shadow-sm">
          {['overview', 'companies', 'bookings', 'profile', 'routes', 'schedules'].map(tab => (
            <TabButton key={tab} id={tab} label={tab.charAt(0).toUpperCase() + tab.slice(1)} icon={tab === 'overview' ? BarChart3 : tab === 'companies' ? Building2 : tab === 'bookings' ? List : tab === 'profile' ? User : tab === 'routes' ? Map : Calendar} isActive={activeTab === tab} onClick={() => setActiveTab(tab as TabType)} />
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard title="Total Companies" value={stats.totalCompanies} icon={Building2} color="green" />
              <StatCard title="Total Revenue" value={`$${stats.totalRevenue.toLocaleString()}`} icon={DollarSign} color="yellow" />
              <StatCard title="Total Bookings" value={stats.totalBookings} icon={Calendar} />
              <StatCard title="Active Routes" value={routes.length} icon={Map} color="purple" />
              <StatCard title="Monthly Growth" value={`${stats.monthlyGrowth}%`} icon={BarChart3} color="teal" />
              <StatCard title="Revenue Growth" value={`${stats.revenueGrowth}%`} icon={DollarSign} color="orange" />
              <button onClick={() => {
                const csv = ['Title,Value', `Total Companies,${stats.totalCompanies}`, `Total Revenue,$${stats.totalRevenue.toLocaleString()}`, `Total Bookings,${stats.totalBookings}`, `Active Routes,${routes.length}`, `Monthly Growth,${stats.monthlyGrowth}%`, `Revenue Growth,${stats.revenueGrowth}%`].join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'dashboard-stats.csv';
                a.click();
                window.URL.revokeObjectURL(url);
                showAlert('success', 'Stats exported successfully!');
              }} className="mt-4 w-full bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"><Download className="w-5 h-5" /> Export Stats</button>
            </div>
          )}

          {activeTab === 'companies' && (
            <div>
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input type="text" placeholder="Search companies..." value={searchTerm} onChange={handleSearchChange} className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div className="flex gap-2">
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <button onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')} className="p-2 border rounded-lg hover:bg-gray-50">{sortOrder === 'asc' ? <SortAsc /> : <SortDesc />}</button>
                  <button onClick={() => openModal('add')} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"><Plus className="w-5 h-5" /> Add Company</button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>{['Name', 'Email', 'Status', 'Created', 'Actions'].map(header => <th key={header} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{header}</th>)}</tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginationData.currentCompanies.map(company => (
                      <tr key={company.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {company.logo ? <img src={company.logo} alt={company.name} className="h-10 w-10 rounded-lg object-cover" /> : <Building2 className="h-10 w-10 text-gray-400" />}
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{company.name}</div>
                              <div className="text-sm text-gray-500">{company.contact}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{company.email}</div></td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(company.status || 'unknown')}`}>
                            {getStatusIcon(company.status || 'unknown')}
                            {(company.status || 'unknown').charAt(0).toUpperCase() + (company.status || 'unknown').slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(company.createdAt)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-2">
                            <button onClick={() => openModal('view', company)} className="text-blue-600 hover:text-blue-800"><Eye className="w-5 h-5" /></button>
                            <button onClick={() => openModal('edit', company)} className="text-amber-600 hover:text-amber-800"><Edit className="w-5 h-5" /></button>
                            <button onClick={() => openModal('delete', company)} className="text-red-600 hover:text-red-800"><Trash className="w-5 h-5" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-gray-700">Showing {paginationData.startIndex} to {paginationData.endIndex} of {paginationData.totalItems} results</div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCurrentPage(prev => prev - 1)} disabled={!paginationData.hasPrevPage} className="p-2 border rounded-lg disabled:opacity-50"><ChevronLeft className="w-5 h-5" /></button>
                  <span className="text-sm">Page {currentPage} of {paginationData.totalPages}</span>
                  <button onClick={() => setCurrentPage(prev => prev + 1)} disabled={!paginationData.hasNextPage} className="p-2 border rounded-lg disabled:opacity-50"><ChevronRight className="w-5 h-5" /></button>
                </div>
              </div>

              <button onClick={() => {
                const csv = filteredAndSortedCompanies.map(company => `${company.id},${company.name},${company.email},${company.status},${formatDate(company.createdAt)}`).join('\n');
                const blob = new Blob(['ID,Name,Email,Status,Created\n' + csv], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'companies-data.csv';
                a.click();
                window.URL.revokeObjectURL(url);
                showAlert('success', 'Companies data exported successfully!');
              }} className="mt-4 w-full bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"><Download className="w-5 h-5" /> Export Companies</button>
            </div>
          )}

          {activeTab === 'bookings' && (
            <BookingsTab bookings={bookings} setBookings={setBookings} companies={companies} schedules={schedules} routes={routes} loading={loadingStates.bookings} setError={msg => showAlert('error', msg)} setSuccess={msg => showAlert('success', msg)} />
          )}

          {activeTab === 'profile' && userProfile && (
            <CompanyProfileTab userProfile={userProfile} onUpdate={updatedProfile => showAlert('success', 'Profile updated successfully!')} />
          )}

          {activeTab === 'routes' && (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>{['Name', 'Origin', 'Destination', 'Distance', 'Created'].map(header => <th key={header} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{header}</th>)}</tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {routes.map(route => (
                      <tr key={route.id}>
                        <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{route.name}</div></td>
                        <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{route.origin}</div></td>
                        <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{route.destination}</div></td>
                        <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{route.distance} km</div></td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(route.createdAt || new Date())}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={() => {
                const csv = routes.map(route => `${route.id},${route.name},${route.origin},${route.destination},${route.distance},${formatDate(route.createdAt || new Date())}`).join('\n');
                const blob = new Blob(['ID,Name,Origin,Destination,Distance,Created\n' + csv], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'routes-data.csv';
                a.click();
                window.URL.revokeObjectURL(url);
                showAlert('success', 'Routes data exported successfully!');
              }} className="mt-4 w-full bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"><Download className="w-5 h-5" /> Export Routes</button>
            </div>
          )}

          {activeTab === 'schedules' && (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>{['Route', 'Departure Time', 'Arrival Time', 'Price', 'Created'].map(header => <th key={header} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{header}</th>)}</tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {schedules.map(schedule => {
                      const route = routes.find(r => r.id === schedule.routeId);
                      return (
                        <tr key={schedule.id}>
                          <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{route?.name || 'Unknown'}</div></td>
                          <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{schedule.departureTime}</div></td>
                          <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{schedule.arrivalTime}</div></td>
                          <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">${schedule.price || 'N/A'}</div></td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(schedule.createdAt || new Date())}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <button onClick={() => {
                const csv = schedules.map(schedule => {
                  const route = routes.find(r => r.id === schedule.routeId);
                  return `${schedule.id},${route?.name || 'Unknown'},${schedule.departureTime},${schedule.arrivalTime},${schedule.price},${formatDate(schedule.createdAt || new Date())}`;
                }).join('\n');
                const blob = new Blob(['ID,Route,Departure Time,Arrival Time,Price,Created\n' + csv], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'schedules-data.csv';
                a.click();
                window.URL.revokeObjectURL(url);
                showAlert('success', 'Schedules data exported successfully!');
              }} className="mt-4 w-full bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"><Download className="w-5 h-5" /> Export Schedules</button>
            </div>
          )}
        </div>
      </main>

      {modals.add && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center border-b pb-4">
              <h3 className="text-lg font-semibold">Add New Company</h3>
              <button onClick={() => closeModal('add')} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">Company Name</label>
                <input type="text" id="name" value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} className={`mt-1 block w-full border rounded-md p-2 ${formErrors.name ? 'border-red-500' : 'border-gray-300'}`} />
                {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">Admin Email</label>
                <input type="email" id="email" value={formData.email} onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))} className={`mt-1 block w-full border rounded-md p-2 ${formErrors.email ? 'border-red-500' : 'border-gray-300'}`} />
                {formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}
              </div>
              <div>
                <label htmlFor="adminPhone" className="block text-sm font-medium text-gray-700">Admin Phone (Optional)</label>
                <input type="tel" id="adminPhone" value={formData.adminPhone} onChange={(e) => setFormData(prev => ({ ...prev, adminPhone: e.target.value }))} className={`mt-1 block w-full border rounded-md p-2 ${formErrors.adminPhone ? 'border-red-500' : 'border-gray-300'}`} />
                {formErrors.adminPhone && <p className="text-red-500 text-xs mt-1">{formErrors.adminPhone}</p>}
              </div>
              <div>
                <label htmlFor="contact" className="block text-sm font-medium text-gray-700">Contact Phone</label>
                <input type="tel" id="contact" value={formData.contact} onChange={(e) => setFormData(prev => ({ ...prev, contact: e.target.value }))} className="mt-1 block w-full border rounded-md p-2 border-gray-300" />
              </div>
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700">Status</label>
                <select id="status" value={formData.status} onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as Company['status'] }))} className="mt-1 block w-full border rounded-md p-2 border-gray-300">
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-4">
              <button onClick={() => closeModal('add')} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleCreateCompany} disabled={loadingStates.creating} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300">
                {loadingStates.creating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modals.edit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center border-b pb-4">
              <h3 className="text-lg font-semibold">Edit Company</h3>
              <button onClick={() => closeModal('edit')} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">Company Name</label>
                <input type="text" id="name" value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} className={`mt-1 block w-full border rounded-md p-2 ${formErrors.name ? 'border-red-500' : 'border-gray-300'}`} />
                {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">Admin Email</label>
                <input type="email" id="email" value={formData.email} onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))} className={`mt-1 block w-full border rounded-md p-2 ${formErrors.email ? 'border-red-500' : 'border-gray-300'}`} disabled />
                {formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}
              </div>
              <div>
                <label htmlFor="adminPhone" className="block text-sm font-medium text-gray-700">Admin Phone (Optional)</label>
                <input type="tel" id="adminPhone" value={formData.adminPhone} onChange={(e) => setFormData(prev => ({ ...prev, adminPhone: e.target.value }))} className={`mt-1 block w-full border rounded-md p-2 ${formErrors.adminPhone ? 'border-red-500' : 'border-gray-300'}`} />
                {formErrors.adminPhone && <p className="text-red-500 text-xs mt-1">{formErrors.adminPhone}</p>}
              </div>
              <div>
                <label htmlFor="contact" className="block text-sm font-medium text-gray-700">Contact Phone</label>
                <input type="tel" id="contact" value={formData.contact} onChange={(e) => setFormData(prev => ({ ...prev, contact: e.target.value }))} className="mt-1 block w-full border rounded-md p-2 border-gray-300" />
              </div>
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700">Status</label>
                <select id="status" value={formData.status} onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as Company['status'] }))} className="mt-1 block w-full border rounded-md p-2 border-gray-300">
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-4">
              <button onClick={() => closeModal('edit')} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleUpdateCompany} disabled={loadingStates.updating} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300">
                {loadingStates.updating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modals.view && selectedCompany && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center border-b pb-4">
              <h3 className="text-lg font-semibold">{selectedCompany.name}</h3>
              <button onClick={() => closeModal('view')} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
            </div>
            <div className="mt-4 space-y-4">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-700">Status</span>
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedCompany.status || 'unknown')}`}>
                  {getStatusIcon(selectedCompany.status || 'unknown')}
                  {(selectedCompany.status || 'unknown').charAt(0).toUpperCase() + (selectedCompany.status || 'unknown').slice(1)}
                </span>
              </div>
              <div><p className="text-sm font-medium text-gray-700">Email</p><p className="text-sm text-gray-900">{selectedCompany.email}</p></div>
              <div><p className="text-sm font-medium text-gray-700">Contact</p><p className="text-sm text-gray-900">{selectedCompany.contact || 'N/A'}</p></div>
              <div><p className="text-sm font-medium text-gray-700">Created</p><p className="text-sm text-gray-900">{formatDate(selectedCompany.createdAt)}</p></div>
              <div><p className="text-sm font-medium text-gray-700">Last Updated</p><p className="text-sm text-gray-900">{formatDate(selectedCompany.updatedAt)}</p></div>
            </div>
            <div className="mt-6 flex justify-end"><button onClick={() => closeModal('view')} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Close</button></div>
          </div>
        </div>
      )}

      {modals.delete && selectedCompany && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Confirm Delete</h3>
            <p className="text-gray-600 mb-6">Are you sure you want to delete <span className="font-bold">{selectedCompany.name}</span>? This action cannot be undone.</p>
            <div className="flex justify-end gap-4">
              <button onClick={() => closeModal('delete')} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={() => { if (typeof modals.delete === 'string') handleDeleteCompany(modals.delete); }} disabled={loadingStates.deleting} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-300">
                {loadingStates.deleting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}