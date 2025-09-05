import { FC, useState, useEffect, useMemo, useCallback } from "react";
import { db, } from "@/lib/firebaseConfig";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { Search, Check, X, Clock, Users, MapPin, Calendar, Eye, CreditCard, FileText, Mail, ChevronLeft, ChevronRight, Ban, Loader2, RefreshCw, Activity, Download, DollarSign, AlertTriangle, RotateCcw, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// Enhanced Skeleton Component
const Skeleton = ({ className }: { className?: string }) => (
  <div className={`bg-gray-200 animate-pulse rounded ${className || 'h-4 w-3/4'}`} />
);

interface Passenger {
  name: string;
  phone?: string;
  email?: string;
  age?: number;
  gender?: string;
  seatNumber?: string;
}

interface Booking {
  id: string;
  bookingReference?: string;
  passengerDetails: Passenger[];
  scheduleId: string;
  companyId: string;
  seatNumbers: string[];
  totalAmount: number;
  bookingStatus: "confirmed" | "pending" | "cancelled";
  paymentStatus: "paid" | "pending" | "refunded" | "failed";
  bookingDate?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  paymentMethod?: string;
  paymentProvider?: string;
  transactionReference?: string;
  userId?: string;
  cancellationDate?: Date;
  cancellationReason?: string;
  confirmedDate?: Date;
  refundDate?: Date;
}

interface Schedule {
  id: string;
  routeId: string;
  departureDateTime: Date | { seconds: number };
}

interface Route {
  id: string;
  origin: string;
  destination: string;
}

interface Company {
  id: string;
  name: string;
}

interface BookingsTabProps {
  bookings: Booking[];
  setBookings: React.Dispatch<React.SetStateAction<Booking[]>>;
  schedules: Schedule[];
  routes: Route[];
  companyId: string;
  setError: (msg: string) => void;
  setSuccess: (msg: string) => void;
  role?: "superadmin" | "company_admin";
  companies?: Company[];
}

const showNotification = (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body: message, icon: '/favicon.ico', badge: '/favicon.ico' });
  }
  console.log(`${type.toUpperCase()}: ${title} - ${message}`);
};

const BookingsTab: FC<BookingsTabProps> = ({
  bookings,
  setBookings,
  schedules,
  routes,
  companyId,
  setError,
  setSuccess,
  role = "company_admin",
  companies = [],
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [activeTab, setActiveTab] = useState("total");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const checkPermission = async () => {
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission === 'denied') {
          setError('Notification permission denied. Some alerts will be logged to console only.');
        }
      }
    };
    checkPermission();
  }, [setError]);

  const getDateTime = useCallback((date: Date | { toDate(): Date } | { seconds: number } | any): number => {
    if (!date) return 0;
    if (date instanceof Date) return date.getTime();
    if (date.toDate && typeof date.toDate === 'function') return date.toDate().getTime();
    if (date.seconds && typeof date.seconds === 'number') return date.seconds * 1000;
    if (typeof date === "string") return new Date(date).getTime() || 0;
    return 0;
  }, []);

  const filteredBookings = useMemo(() => {
    if (!Array.isArray(bookings) || !bookings.length) return [];
    return bookings
      .filter((booking) => {
        if (!booking || typeof booking !== 'object') return false;
        const searchLower = searchTerm.toLowerCase();
        const bookingRef = booking.bookingReference || booking.id || "NO-REF";
        const matchesSearch =
          (Array.isArray(booking.passengerDetails) &&
           booking.passengerDetails.some((p) => p?.name?.toLowerCase().includes(searchLower))) ||
          bookingRef.toLowerCase().includes(searchLower) ||
          (Array.isArray(booking.seatNumbers) &&
           booking.seatNumbers.join(",").toLowerCase().includes(searchLower));
        if (role === "company_admin") {
          return matchesSearch && booking.companyId === companyId;
        }
        return matchesSearch;
      })
      .sort((a, b) => getDateTime(b.createdAt) - getDateTime(a.createdAt));
  }, [bookings, searchTerm, companyId, role, getDateTime]);

  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      setSuccess("Data refreshed successfully");
    } catch (error) {
      setError("Failed to refresh data");
    } finally {
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  }, [setSuccess, setError]);

  const getStatusBadge = useCallback((status: string, type: string = "booking") => {
    const baseClasses = "inline-flex px-2 py-1 rounded-full text-xs font-medium";
    if (type === "booking") {
      switch (status?.toLowerCase()) {
        case "confirmed": return `${baseClasses} bg-green-100 text-green-800`;
        case "pending": return `${baseClasses} bg-yellow-100 text-yellow-800`;
        case "cancelled": return `${baseClasses} bg-red-100 text-red-800`;
        default: return `${baseClasses} bg-gray-100 text-gray-800`;
      }
    } else {
      switch (status?.toLowerCase()) {
        case "paid": return `${baseClasses} bg-green-100 text-green-800`;
        case "pending": return `${baseClasses} bg-yellow-100 text-yellow-800`;
        case "refunded": return `${baseClasses} bg-blue-100 text-blue-800`;
        case "failed": return `${baseClasses} bg-red-100 text-red-800`;
        default: return `${baseClasses} bg-gray-100 text-gray-800`;
      }
    }
  }, []);

  const bookingsByTab = useMemo(() => {
    switch (activeTab) {
      case "confirmed":
        return filteredBookings.filter((b) => b.bookingStatus === "confirmed" && b.paymentStatus === "paid");
      case "pending":
        return filteredBookings.filter((b) =>
          b.bookingStatus === "pending" ||
          (b.bookingStatus === "confirmed" && b.paymentStatus === "pending")
        );
      case "cancelled":
        return filteredBookings.filter((b) => b.bookingStatus === "cancelled");
      case "revenue":
        return filteredBookings.filter((b) => b.paymentStatus === "paid");
      default:
        return filteredBookings;
    }
  }, [filteredBookings, activeTab]);

  const stats = useMemo(() => ({
    total: filteredBookings.length,
    confirmed: filteredBookings.filter((b) => b.bookingStatus === "confirmed" && b.paymentStatus === "paid").length,
    pending: filteredBookings.filter((b) =>
      b.bookingStatus === "pending" ||
      (b.bookingStatus === "confirmed" && b.paymentStatus === "pending")
    ).length,
    cancelled: filteredBookings.filter((b) => b.bookingStatus === "cancelled").length,
    totalRevenue: filteredBookings
      .filter((b) => b.paymentStatus === "paid")
      .reduce((sum, b) => sum + (b.totalAmount || 0), 0),
  }), [filteredBookings]);

  const totalPages = Math.ceil(bookingsByTab.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedBookings = bookingsByTab.slice(startIndex, startIndex + pageSize);

  const handlePageChange = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  }, [totalPages]);

  const formatDate = useCallback((date: Date | { toDate(): Date } | { seconds: number } | any): string => {
    try {
      if (!date) return "N/A";
      if (date instanceof Date) return date.toLocaleDateString();
      if (date.toDate && typeof date.toDate === 'function') return date.toDate().toLocaleDateString();
      if (date.seconds && typeof date.seconds === 'number') {
        return new Date(date.seconds * 1000).toLocaleDateString();
      }
      return "N/A";
    } catch (error) {
      console.warn('Date formatting error:', error);
      return "N/A";
    }
  }, []);

  const formatDateTime = useCallback((date: Date | { toDate(): Date } | { seconds: number } | any): string => {
    try {
      if (!date) return "N/A";
      if (date instanceof Date) return date.toLocaleString();
      if (date.toDate && typeof date.toDate === 'function') return date.toDate().toLocaleString();
      if (date.seconds && typeof date.seconds === 'number') {
        return new Date(date.seconds * 1000).toLocaleString();
      }
      return "N/A";
    } catch (error) {
      console.warn('DateTime formatting error:', error);
      return "N/A";
    }
  }, []);

  const formatRelativeTime = useCallback((date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }, []);

  const getPaginationPages = useCallback(() => {
    const maxVisiblePages = 5;
    const pages: number[] = [];
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      const start = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
      const end = Math.min(totalPages, start + maxVisiblePages - 1);
      for (let i = start; i <= end; i++) pages.push(i);
    }
    return pages;
  }, [currentPage, totalPages]);

  const handleUpdateBookingStatus = useCallback(
    async (bookingId: string, newStatus: "confirmed" | "cancelled", reason?: string) => {
      setActionLoading((prev) => ({ ...prev, [bookingId]: true }));
      try {
        const bookingRef = doc(db, "bookings", bookingId);
        const bookingDoc = await getDoc(bookingRef);

        if (!bookingDoc.exists()) {
          throw new Error("Booking not found");
        }

        const bookingData = bookingDoc.data() as Booking;
        const updatedData = {
          ...bookingData,
          bookingStatus: newStatus,
          updatedAt: new Date(),
          [newStatus === "confirmed" ? "confirmedDate" : "cancellationDate"]: new Date(),
          ...(reason && { cancellationReason: reason }),
        };

        await updateDoc(bookingRef, updatedData);

        setBookings((prev) =>
          prev.map((b) => (b.id === bookingId ? { ...b, ...updatedData } : b))
        );

        showNotification(
          "Booking Updated",
          `Booking ${bookingId} status changed to ${newStatus}`,
          newStatus === "confirmed" ? "success" : "warning"
        );
        setSuccess(`Booking ${newStatus} successfully`);
      } catch (error: any) {
        console.error(`Failed to update booking ${bookingId} status:`, error);
        setError(error.message || `Failed to ${newStatus} booking`);
      } finally {
        setActionLoading((prev) => ({ ...prev, [bookingId]: false }));
      }
    },
    [setBookings, setError, setSuccess]
  );

  const handleReject = useCallback(
    async (bookingId: string) => {
      setActionLoading((prev) => ({ ...prev, [bookingId]: true }));
      try {
        await handleUpdateBookingStatus(bookingId, "cancelled", "Rejected by admin");
        showNotification("Booking Rejected", `Booking ${bookingId} rejected`, "warning");
      } catch (error: any) {
        setError(error.message || "Failed to reject booking");
      } finally {
        setActionLoading((prev) => ({ ...prev, [bookingId]: false }));
      }
    },
    [handleUpdateBookingStatus, setError]
  );

  const handleResendConfirmation = useCallback(
    async (bookingId: string) => {
      setActionLoading((prev) => ({ ...prev, [`resend-${bookingId}`]: true }));
      try {
        // Simulate sending confirmation (replace with actual email service)
        const booking = bookings.find((b) => b.id === bookingId);
        if (booking?.passengerDetails?.[0]?.email) {
          showNotification(
            "Confirmation Resent",
            `Confirmation sent to ${booking.passengerDetails[0].email}`,
            "success"
          );
          setSuccess("Confirmation resent successfully");
        } else {
          throw new Error("No email available for resend");
        }
      } catch (error: any) {
        console.error("Failed to resend confirmation:", error);
        setError(error.message || "Failed to resend confirmation");
      } finally {
        setActionLoading((prev) => ({ ...prev, [`resend-${bookingId}`]: false }));
      }
    },
    [bookings, setError, setSuccess]
  );

  const handleRefund = useCallback(
    async (bookingId: string) => {
      setActionLoading((prev) => ({ ...prev, [`refund-${bookingId}`]: true }));
      try {
        const bookingRef = doc(db, "bookings", bookingId);
        const bookingDoc = await getDoc(bookingRef);

        if (!bookingDoc.exists()) {
          throw new Error("Booking not found");
        }

        const bookingData = bookingDoc.data() as Booking;
        if (bookingData.paymentStatus !== "paid") {
          throw new Error("Cannot refund a non-paid booking");
        }

        const updatedData = {
          ...bookingData,
          paymentStatus: "refunded",
          refundDate: new Date(),
          updatedAt: new Date(),
        };

        await updateDoc(bookingRef, updatedData);

        setBookings((prev) =>
          prev.map((b) => (b.id === bookingId ? { ...b, ...updatedData } : b))
        );

        showNotification("Refund Processed", `Refund of MWK ${bookingData.totalAmount} for booking ${bookingId}`, "success");
        setSuccess("Refund processed successfully");
      } catch (error: any) {
        console.error("Failed to process refund:", error);
        setError(error.message || "Failed to process refund");
      } finally {
        setActionLoading((prev) => ({ ...prev, [`refund-${bookingId}`]: false }));
      }
    },
    [setBookings, setError, setSuccess]
  );

  if (!companyId && role === "company_admin") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
            <span className="text-red-800">Company ID is required for company admin role</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Bookings Management</h2>
          <p className="text-gray-600">Monitor and manage all customer bookings</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={handleManualRefresh} disabled={isRefreshing} className="flex items-center space-x-2">
            {isRefreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            <span>Refresh</span>
          </Button>
          <Button className="bg-blue-600 text-white hover:bg-blue-700">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="border-b">
        <div className="flex space-x-4 overflow-x-auto pb-2">
          {[
            { id: "total", label: "Total", icon: FileText, count: stats.total },
            { id: "confirmed", label: "Confirmed", icon: Check, count: stats.confirmed },
            { id: "pending", label: "Pending", icon: Clock, count: stats.pending },
            { id: "cancelled", label: "Cancelled", icon: X, count: stats.cancelled },
            { id: "revenue", label: "Revenue", icon: CreditCard, count: `MWK ${stats.totalRevenue.toLocaleString()}` },
          ].map(({ id, label, icon: Icon, count }) => (
            <Button
              key={id}
              variant={activeTab === id ? "default" : "outline"}
              className={`flex items-center space-x-2 px-4 py-2 rounded-t-lg transition-all ${
                activeTab === id ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => setActiveTab(id)}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
              <span className={`ml-2 text-xs font-medium px-2 py-1 rounded-full ${
                activeTab === id ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'
              }`}>
                {count}
              </span>
            </Button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search bookings by name, reference, or seat..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value={5}>5 per page</option>
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                {role === "superadmin" && (
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                )}
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Passenger(s)</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Route</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Journey</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Seats</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                {role === "company_admin" && (
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedBookings.length === 0 ? (
                <tr>
                  <td colSpan={role === "superadmin" ? 9 : 8} className="px-6 py-12 text-center">
                    <div className="text-gray-500">
                      {searchTerm ? "No bookings found matching your search." : "No bookings available."}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedBookings.map((booking) => {
                  const schedule = schedules.find((s) => s.id === booking.scheduleId);
                  const route = routes.find((r) => r.id === schedule?.routeId);
                  const companyName = companies.find((c) => c.id === booking.companyId)?.name || "Unknown";
                  const bookingRef = booking.bookingReference || booking.id || "NO-REF";
                  const departureDate = schedule?.departureDateTime?.seconds
                    ? new Date(schedule.departureDateTime.seconds * 1000)
                    : schedule?.departureDateTime instanceof Date
                    ? schedule.departureDateTime
                    : null;

                  return (
                    <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                      {role === "superadmin" && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">{companyName}</span>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900 font-mono">
                            {bookingRef.length > 10 ? `${bookingRef.substring(0, 10)}...` : bookingRef}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatDate(booking.createdAt)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <Users className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">
                              {booking.passengerDetails?.[0]?.name || "N/A"}
                            </div>
                            {(booking.passengerDetails?.length || 0) > 1 && (
                              <div className="text-xs text-gray-500">+{booking.passengerDetails.length - 1} more</div>
                            )}
                            {booking.passengerDetails?.[0]?.phone && (
                              <div className="text-xs text-gray-500 flex items-center">
                                <Phone className="w-3 h-3 mr-1" />
                                {booking.passengerDetails[0].phone}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-900">
                            {route ? `${route.origin} → ${route.destination}` : "Unknown Route"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-900">
                            {departureDate ? formatDateTime(departureDate) : "N/A"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {Array.isArray(booking.seatNumbers) && booking.seatNumbers.length > 0 ? (
                            booking.seatNumbers.map((seat, idx) => (
                              <span key={idx} className="inline-flex px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded">
                                {seat}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-gray-500">N/A</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">
                            MWK {(booking.totalAmount || 0).toLocaleString()}
                          </span>
                          {booking.paymentMethod && (
                            <span className="text-xs text-gray-500">{booking.paymentMethod}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col space-y-1">
                          <span className={getStatusBadge(booking.bookingStatus)}>
                            {booking.bookingStatus}
                          </span>
                          <span className={getStatusBadge(booking.paymentStatus, "payment")}>
                            {booking.paymentStatus}
                          </span>
                        </div>
                      </td>
                      {role === "company_admin" && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex space-x-1">
                            {booking.bookingStatus === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleUpdateBookingStatus(booking.id, "confirmed")}
                                  disabled={actionLoading[booking.id]}
                                  className="bg-green-600 hover:bg-green-700 text-white px-2 py-1"
                                  title="Approve Booking"
                                >
                                  {actionLoading[booking.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleReject(booking.id)}
                                  disabled={actionLoading[booking.id]}
                                  className="px-2 py-1"
                                  title="Reject Booking"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </>
                            )}

                            {booking.bookingStatus === "confirmed" && booking.paymentStatus === "paid" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleResendConfirmation(booking.id)}
                                  disabled={actionLoading[`resend-${booking.id}`]}
                                  className="text-blue-600 hover:text-blue-700 px-2 py-1"
                                  title="Resend Confirmation"
                                >
                                  {actionLoading[`resend-${booking.id}`] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleUpdateBookingStatus(booking.id, "cancelled", "Cancelled by admin")}
                                  disabled={actionLoading[booking.id]}
                                  className="px-2 py-1"
                                  title="Cancel Booking"
                                >
                                  {actionLoading[booking.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />}
                                </Button>
                              </>
                            )}

                            {booking.bookingStatus === "confirmed" && booking.paymentStatus === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleResendConfirmation(booking.id)}
                                  disabled={actionLoading[`resend-${booking.id}`]}
                                  className="text-orange-600 hover:text-orange-700 px-2 py-1"
                                  title="Send Payment Reminder"
                                >
                                  {actionLoading[`resend-${booking.id}`] ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlertTriangle className="w-3 h-3" />}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleUpdateBookingStatus(booking.id, "cancelled", "Payment not received")}
                                  disabled={actionLoading[booking.id]}
                                  className="px-2 py-1"
                                  title="Cancel Due to Non-Payment"
                                >
                                  {actionLoading[booking.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                                </Button>
                              </>
                            )}

                            {booking.bookingStatus === "cancelled" && booking.paymentStatus === "paid" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRefund(booking.id)}
                                disabled={actionLoading[`refund-${booking.id}`]}
                                className="text-purple-600 hover:text-purple-700 px-2 py-1"
                                title="Process Refund"
                              >
                                {actionLoading[`refund-${booking.id}`] ? <Loader2 className="w-3 h-3 animate-spin" /> : <DollarSign className="w-3 h-3" />}
                              </Button>
                            )}

                            {booking.paymentStatus === "failed" && booking.bookingStatus !== "cancelled" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleResendConfirmation(booking.id)}
                                  disabled={actionLoading[`resend-${booking.id}`]}
                                  className="text-red-600 hover:text-red-700 px-2 py-1"
                                  title="Request Payment Retry"
                                >
                                  {actionLoading[`resend-${booking.id}`] ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleUpdateBookingStatus(booking.id, "cancelled", "Payment failed")}
                                  disabled={actionLoading[booking.id]}
                                  className="px-2 py-1"
                                  title="Cancel Due to Payment Failure"
                                >
                                  {actionLoading[booking.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                                </Button>
                              </>
                            )}

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedBooking(booking)}
                              className="text-gray-600 hover:text-gray-700 px-2 py-1"
                              title="View Full Details"
                            >
                              <Eye className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {selectedBooking && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">Booking Details</h3>
                    <p className="text-gray-600">
                      {selectedBooking.bookingReference || selectedBooking.id}
                    </p>
                    <div className="flex items-center space-x-2 mt-2">
                      <span className={getStatusBadge(selectedBooking.bookingStatus)}>
                        {selectedBooking.bookingStatus}
                      </span>
                      <span className={getStatusBadge(selectedBooking.paymentStatus, "payment")}>
                        {selectedBooking.paymentStatus}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedBooking(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Trip Information</h4>
                      <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span className="text-sm">
                            {(() => {
                              const schedule = schedules.find(s => s.id === selectedBooking.scheduleId);
                              const route = routes.find(r => r.id === schedule?.routeId);
                              return route ? `${route.origin} → ${route.destination}` : "Unknown Route";
                            })()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-sm">
                            {(() => {
                              const schedule = schedules.find(s => s.id === selectedBooking.scheduleId);
                              const departureDate = schedule?.departureDateTime?.seconds
                                ? new Date(schedule.departureDateTime.seconds * 1000)
                                : schedule?.departureDateTime instanceof Date
                                ? schedule.departureDateTime
                                : null;
                              return departureDate ? formatDateTime(departureDate) : "Unknown Time";
                            })()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-gray-400" />
                          <span className="text-sm">{selectedBooking.passengerDetails?.length || 0} passenger(s)</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Payment Information</h4>
                      <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Amount:</span>
                          <span className="text-sm font-semibold">MWK {(selectedBooking.totalAmount || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Method:</span>
                          <span className="text-sm">{selectedBooking.paymentMethod || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Provider:</span>
                          <span className="text-sm">{selectedBooking.paymentProvider || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Transaction:</span>
                          <span className="text-sm font-mono text-xs">{selectedBooking.transactionReference || "N/A"}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Booking Timeline</h4>
                      <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Created:</span>
                          <span className="text-sm">{formatDateTime(selectedBooking.createdAt)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Last Updated:</span>
                          <span className="text-sm">{formatDateTime(selectedBooking.updatedAt)}</span>
                        </div>
                        {selectedBooking.confirmedDate && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Confirmed:</span>
                            <span className="text-sm">{formatDateTime(selectedBooking.confirmedDate)}</span>
                          </div>
                        )}
                        {selectedBooking.cancellationDate && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Cancelled:</span>
                            <span className="text-sm">{formatDateTime(selectedBooking.cancellationDate)}</span>
                          </div>
                        )}
                        {selectedBooking.refundDate && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Refunded:</span>
                            <span className="text-sm">{formatDateTime(selectedBooking.refundDate)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Seats</h4>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex flex-wrap gap-2">
                          {Array.isArray(selectedBooking.seatNumbers) && selectedBooking.seatNumbers.length > 0
                            ? selectedBooking.seatNumbers.map((seat, index) => (
                                <span key={index} className="inline-flex px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded">
                                  Seat {seat}
                                </span>
                              ))
                            : <span className="text-sm text-gray-500">No seats assigned</span>
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Passenger Details</h4>
                  <div className="space-y-3">
                    {Array.isArray(selectedBooking.passengerDetails) && selectedBooking.passengerDetails.length > 0
                      ? selectedBooking.passengerDetails.map((passenger, index) => (
                          <div key={index} className="bg-gray-50 p-4 rounded-lg">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-gray-600 font-medium">Name:</span>
                                <p className="font-medium text-gray-900">{passenger.name || "N/A"}</p>
                              </div>
                              <div>
                                <span className="text-gray-600 font-medium">Age:</span>
                                <p className="font-medium text-gray-900">{passenger.age || "N/A"}</p>
                              </div>
                              <div>
                                <span className="text-gray-600 font-medium">Gender:</span>
                                <p className="font-medium text-gray-900 capitalize">{passenger.gender || "N/A"}</p>
                              </div>
                              <div>
                                <span className="text-gray-600 font-medium">Seat:</span>
                                <p className="font-medium text-gray-900">{passenger.seatNumber || "N/A"}</p>
                              </div>
                              {passenger.phone && (
                                <div>
                                  <span className="text-gray-600 font-medium">Phone:</span>
                                  <p className="font-medium text-gray-900 flex items-center">
                                    <Phone className="w-3 h-3 mr-1" />
                                    {passenger.phone}
                                  </p>
                                </div>
                              )}
                              {passenger.email && (
                                <div>
                                  <span className="text-gray-600 font-medium">Email:</span>
                                  <p className="font-medium text-gray-900">{passenger.email}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      : <p className="text-gray-500 text-sm text-center py-4">No passenger details available</p>
                    }
                  </div>
                </div>

                {selectedBooking.cancellationReason && (
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Cancellation Reason</h4>
                    <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                      <p className="text-sm text-red-800">{selectedBooking.cancellationReason}</p>
                    </div>
                  </div>
                )}

                {role === "company_admin" && (
                  <div className="border-t pt-4">
                    <div className="flex flex-wrap gap-2 justify-end">
                      {selectedBooking.bookingStatus === "pending" && (
                        <>
                          <Button
                            onClick={() => {
                              handleUpdateBookingStatus(selectedBooking.id, "confirmed");
                              setSelectedBooking(null);
                            }}
                            disabled={actionLoading[selectedBooking.id]}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            {actionLoading[selectedBooking.id] ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                            Approve
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => {
                              handleReject(selectedBooking.id);
                              setSelectedBooking(null);
                            }}
                            disabled={actionLoading[selectedBooking.id]}
                          >
                            <X className="w-4 h-4 mr-2" />
                            Reject
                          </Button>
                        </>
                      )}

                      {selectedBooking.bookingStatus === "confirmed" && selectedBooking.paymentStatus === "pending" && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            handleResendConfirmation(selectedBooking.id);
                            setSelectedBooking(null);
                          }}
                          disabled={actionLoading[`resend-${selectedBooking.id}`]}
                          className="text-orange-600 hover:text-orange-700"
                        >
                          {actionLoading[`resend-${selectedBooking.id}`] ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <AlertTriangle className="w-4 h-4 mr-2" />}
                          Payment Reminder
                        </Button>
                      )}

                      {selectedBooking.bookingStatus === "cancelled" && selectedBooking.paymentStatus === "paid" && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            handleRefund(selectedBooking.id);
                            setSelectedBooking(null);
                          }}
                          disabled={actionLoading[`refund-${selectedBooking.id}`]}
                          className="text-purple-600 hover:text-purple-700"
                        >
                          {actionLoading[`refund-${selectedBooking.id}`] ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <DollarSign className="w-4 h-4 mr-2" />}
                          Process Refund
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
              <span className="font-medium">{Math.min(startIndex + pageSize, bookingsByTab.length)}</span> of{' '}
              <span className="font-medium">{bookingsByTab.length}</span> results
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
              <div className="flex space-x-1">
                {getPaginationPages().map((page) => (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(page)}
                    className="px-3 py-1"
                  >
                    {page}
                  </Button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingsTab;