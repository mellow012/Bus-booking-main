"use client";

import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/Label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  DollarSign, 
  Download, 
  Filter, 
  Search, 
  Calendar,
  CreditCard,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  RefreshCw
} from "lucide-react";

interface PaymentsTabProps {
  company: { id: string; [key: string]: any };
  paymentSettings: any;
  bookings: any[];
  setError: (msg: string) => void;
  setSuccess: (msg: string) => void;
}

interface Transaction {
  id: string;
  bookingReference: string;
  totalAmount: number;
  bookingDate: Date;
  paymentStatus: string;
  paymentMethod?: string;
  customerName?: string;
  customerEmail?: string;
  route?: string;
  departureTime?: string;
  seats?: number;
  seatNumbers?: string[];
  transactionId?: string;
  bookingStatus?: string;
  passengerDetails?: any[];
  userId?: string | null;
}

type PaymentStatus = 'all' | 'paid' | 'pending' | 'failed' | 'refunded';
type DateFilter = 'all' | 'today' | 'week' | 'month' | 'custom';

const PaymentsTab: React.FC<PaymentsTabProps> = ({ company, paymentSettings, bookings, setError, setSuccess }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<PaymentStatus>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Fetch transactions with schedule details
  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, "bookings"), 
          where("companyId", "==", company.id)
        );
        const snapshot = await getDocs(q);
        
        // Collect unique schedule IDs
        const scheduleIds = new Set<string>();
        snapshot.docs.forEach(doc => {
          const scheduleId = doc.data().scheduleId;
          if (scheduleId) scheduleIds.add(scheduleId);
        });
        
        // Fetch all schedules at once (public read allowed)
        const scheduleMap = new Map();
        if (scheduleIds.size > 0) {
          try {
            const schedulesSnapshot = await getDocs(collection(db, "schedules"));
            schedulesSnapshot.docs.forEach(doc => {
              if (scheduleIds.has(doc.id)) {
                scheduleMap.set(doc.id, doc.data());
              }
            });
          } catch (err) {
            console.error("Error fetching schedules:", err);
          }
        }
        
        // Process transactions
        const fetchedTransactions = snapshot.docs.map((doc) => {
          const data = doc.data();
          
          // Get customer info from first passenger
          const firstPassenger = data.passengerDetails?.[0] || {};
          const customerName = firstPassenger.name || 'N/A';
          
          // Get schedule details for route information
          let routeInfo = 'N/A';
          let departureTime = '';
          if (data.scheduleId && scheduleMap.has(data.scheduleId)) {
            const scheduleData = scheduleMap.get(data.scheduleId);
            routeInfo = `${scheduleData.origin || ''} → ${scheduleData.destination || ''}`.trim();
            departureTime = scheduleData.departureTime || '';
          }
          
          // Use email from booking data if available, otherwise show N/A
          // Note: For security reasons, we can't fetch user emails from users collection
          // Consider storing customer email in the booking document during creation
          const customerEmail = data.customerEmail || 'N/A';
          
          return {
            id: doc.id,
            bookingReference: data.bookingReference || 'N/A',
            totalAmount: data.totalAmount || 0,
            bookingDate: data.bookingDate?.toDate ? data.bookingDate.toDate() : new Date(data.bookingDate),
            paymentStatus: data.paymentStatus || 'pending',
            paymentMethod: data.paymentMethod || 'Not specified',
            customerName,
            customerEmail,
            route: routeInfo,
            departureTime,
            seats: data.seatNumbers?.length || 0,
            seatNumbers: data.seatNumbers || [],
            transactionId: data.transactionReference || 'N/A',
            bookingStatus: data.bookingStatus || 'pending',
            passengerDetails: data.passengerDetails || [],
            userId: data.userId || null,
          };
        });
        
        // Sort by date descending
        fetchedTransactions.sort((a, b) => b.bookingDate.getTime() - a.bookingDate.getTime());
        
        setTransactions(fetchedTransactions);
        setFilteredTransactions(fetchedTransactions);
      } catch (err: any) {
        setError(err.message || "Failed to load transactions");
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    if (company.id) fetchTransactions();
  }, [company.id, setError]);

  // Apply filters
  useEffect(() => {
    let filtered = [...transactions];

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => t.paymentStatus.toLowerCase() === statusFilter);
    }

    // Date filter
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    if (dateFilter === 'today') {
      filtered = filtered.filter(t => t.bookingDate >= today);
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      filtered = filtered.filter(t => t.bookingDate >= weekAgo);
    } else if (dateFilter === 'month') {
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      filtered = filtered.filter(t => t.bookingDate >= monthAgo);
    } else if (dateFilter === 'custom' && customStartDate && customEndDate) {
      const start = new Date(customStartDate);
      const end = new Date(customEndDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(t => t.bookingDate >= start && t.bookingDate <= end);
    }

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(t => 
        t.bookingReference.toLowerCase().includes(search) ||
        t.customerName?.toLowerCase().includes(search) ||
        t.customerEmail?.toLowerCase().includes(search) ||
        t.transactionId?.toLowerCase().includes(search)
      );
    }

    setFilteredTransactions(filtered);
  }, [transactions, statusFilter, dateFilter, customStartDate, customEndDate, searchTerm]);

  // Calculate statistics
  const stats = {
    total: filteredTransactions.reduce((sum, t) => sum + t.totalAmount, 0),
    paid: filteredTransactions.filter(t => t.paymentStatus === 'paid').reduce((sum, t) => sum + t.totalAmount, 0),
    pending: filteredTransactions.filter(t => t.paymentStatus === 'pending').reduce((sum, t) => sum + t.totalAmount, 0),
    count: filteredTransactions.length,
    paidCount: filteredTransactions.filter(t => t.paymentStatus === 'paid').length,
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Reference', 'Customer', 'Amount', 'Date', 'Status', 'Method', 'Transaction ID'];
    const rows = filteredTransactions.map(t => [
      t.bookingReference,
      t.customerName,
      t.totalAmount,
      t.bookingDate.toLocaleDateString(),
      t.paymentStatus,
      t.paymentMethod,
      t.transactionId
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    setSuccess('Report exported successfully');
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      paid: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle },
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock },
      failed: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle },
      refunded: { bg: 'bg-gray-100', text: 'text-gray-800', icon: RefreshCw },
    };

    const config = statusConfig[status.toLowerCase() as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        <Icon className="w-3 h-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getPaymentMethodBadge = (method?: string) => {
    const methodConfig = {
      'airtel money': { bg: 'bg-red-100', text: 'text-red-800' },
      'tnm mpamba': { bg: 'bg-blue-100', text: 'text-blue-800' },
      'card': { bg: 'bg-purple-100', text: 'text-purple-800' },
      'stripe': { bg: 'bg-purple-100', text: 'text-purple-800' },
      'paychangu': { bg: 'bg-blue-100', text: 'text-blue-800' },
    };

    const config = methodConfig[method?.toLowerCase() as keyof typeof methodConfig] || { bg: 'bg-gray-100', text: 'text-gray-800' };

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${config.bg} ${config.text}`}>
        {method || 'Unknown'}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <div className="h-8 bg-gray-200 animate-pulse rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 animate-pulse rounded w-1/2 mt-2"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {Array(4).fill(0).map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 animate-pulse rounded-lg"></div>
          ))}
        </div>
        <div className="h-96 bg-gray-200 animate-pulse rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <DollarSign className="w-8 h-8 text-blue-600" />
            Payment Management
          </h3>
          <p className="text-gray-600 mt-1">Track and manage all payment transactions</p>
        </div>
        <Button onClick={exportToCSV} variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          Export Report
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Total Revenue</p>
              <p className="text-2xl font-bold text-blue-900 mt-1">
                MWK {stats.total.toLocaleString()}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Paid Amount</p>
              <p className="text-2xl font-bold text-green-900 mt-1">
                MWK {stats.paid.toLocaleString()}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-6 border border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-900 mt-1">
                MWK {stats.pending.toLocaleString()}
              </p>
            </div>
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">Transactions</p>
              <p className="text-2xl font-bold text-purple-900 mt-1">
                {stats.count}
              </p>
              <p className="text-xs text-purple-600 mt-1">{stats.paidCount} paid</p>
            </div>
            <CreditCard className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-lg border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-gray-900 flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </h4>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? 'Hide' : 'Show'} Filters
          </Button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
            {/* Search */}
            <div>
              <Label htmlFor="search">Search</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Reference, name, email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <Label htmlFor="status">Payment Status</Label>
              <select
                id="status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as PaymentStatus)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>

            {/* Date Filter */}
            <div>
              <Label htmlFor="dateFilter">Date Range</Label>
              <select
                id="dateFilter"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as DateFilter)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {/* Clear Filters */}
            <div className="flex items-end">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter('all');
                  setDateFilter('all');
                  setCustomStartDate("");
                  setCustomEndDate("");
                }}
              >
                Clear Filters
              </Button>
            </div>

            {/* Custom Date Range */}
            {dateFilter === 'custom' && (
              <>
                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-semibold">Reference</TableHead>
                <TableHead className="font-semibold">Customer</TableHead>
                <TableHead className="font-semibold">Route</TableHead>
                <TableHead className="font-semibold">Amount</TableHead>
                <TableHead className="font-semibold">Method</TableHead>
                <TableHead className="font-semibold">Date</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No transactions found</p>
                    <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredTransactions.map((transaction) => (
                  <TableRow key={transaction.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium text-blue-600">
                      {transaction.bookingReference}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-gray-900">{transaction.customerName}</p>
                        <p className="text-xs text-gray-500">{transaction.customerEmail}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm text-gray-900">{transaction.route}</p>
                        <p className="text-xs text-gray-500">
                          {transaction.seatNumbers?.join(', ') || `${transaction.seats} seat(s)`}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold text-gray-900">
                      MWK {transaction.totalAmount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {getPaymentMethodBadge(transaction.paymentMethod)}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {transaction.bookingDate.toLocaleDateString('en-GB')}
                      <br />
                      <span className="text-xs text-gray-400">
                        {transaction.bookingDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(transaction.paymentStatus)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedTransaction(transaction)}
                        className="gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Transaction Details Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">Transaction Details</h3>
                <button
                  onClick={() => setSelectedTransaction(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">Booking Reference</p>
                  <p className="text-gray-900 font-semibold">{selectedTransaction.bookingReference}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Transaction ID</p>
                  <p className="text-gray-900 font-mono text-sm">{selectedTransaction.transactionId}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Customer Name</p>
                  <p className="text-gray-900">{selectedTransaction.customerName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Customer Email</p>
                  <p className="text-gray-900">{selectedTransaction.customerEmail}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Route</p>
                  <p className="text-gray-900">{selectedTransaction.route}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Seat Numbers</p>
                  <p className="text-gray-900">{selectedTransaction.seatNumbers?.join(', ') || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Amount</p>
                  <p className="text-gray-900 font-bold text-lg">MWK {selectedTransaction.totalAmount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Payment Method</p>
                  <div className="mt-1">{getPaymentMethodBadge(selectedTransaction.paymentMethod)}</div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Booking Date</p>
                  <p className="text-gray-900">{selectedTransaction.bookingDate.toLocaleString('en-GB')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Payment Status</p>
                  <div className="mt-1">{getStatusBadge(selectedTransaction.paymentStatus)}</div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Booking Status</p>
                  <p className="text-gray-900 capitalize">{selectedTransaction.bookingStatus || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Departure Time</p>
                  <p className="text-gray-900">{selectedTransaction.departureTime || 'N/A'}</p>
                </div>
              </div>
              
              {/* Passenger Details */}
              {selectedTransaction.passengerDetails && selectedTransaction.passengerDetails.length > 0 && (
                <div className="pt-4 border-t">
                  <h4 className="font-semibold text-gray-900 mb-3">Passenger Details</h4>
                  <div className="space-y-2">
                    {selectedTransaction.passengerDetails.map((passenger: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div>
                          <p className="font-medium text-gray-900">{passenger.name || 'N/A'}</p>
                          <p className="text-sm text-gray-600">
                            {passenger.gender ? `${passenger.gender.charAt(0).toUpperCase() + passenger.gender.slice(1)}` : ''}{passenger.age ? `, ${passenger.age} years` : ''}
                          </p>
                        </div>
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium">
                          Seat {passenger.seatNumber || 'N/A'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setSelectedTransaction(null)}>
                Close
              </Button>
              {selectedTransaction.paymentStatus === 'paid' && (
                <Button className="bg-blue-600 hover:bg-blue-700">
                  Initiate Payout
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentsTab;