import { FC, useState, useEffect, useMemo } from "react";
import { Search, Check, X, Clock, Users, MapPin, Calendar, Eye, CreditCard, FileText, ChevronLeft, ChevronRight, RotateCcw, Mail, Phone, AlertTriangle, DollarSign, Ban } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { Button } from "@/components/ui/button";

interface Passenger {
  name: string;
  phone?: string;
  email?: string;
  age?: number;
  gender?: string;
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
  bookingDate?: Date | { toDate(): Date };
  createdAt?: Date | { toDate(): Date };
  updatedAt?: Date | { toDate(): Date };
  paymentMethod?: string;
  paymentProvider?: string;
  transactionReference?: string;
  userId?: string;
  cancellationDate?: Date | { toDate(): Date };
}

interface Schedule {
  id: string;
  routeId: string;
  departureDateTime: { seconds: number };
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
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("total");

  // Utility function to safely convert dates
  const getDateTime = (date: Date | { toDate(): Date } | any): number => {
    if (!date) return 0;
    if (date instanceof Date) return date.getTime();
    if (date.toDate && typeof date.toDate === 'function') return date.toDate().getTime();
    if (typeof date === "string") return new Date(date).getTime() || 0;
    return 0;
  };

  // Memoized filtered bookings to prevent unnecessary recalculations
  const filteredBookings = useMemo(() => {
    if (!bookings.length) return [];

    return bookings
      .filter((b) => {
        const searchLower = searchTerm.toLowerCase();
        const bookingRef = b.bookingReference || b.id || "NO-REF";
        const matchesSearch =
          b.passengerDetails?.some((p) => p?.name?.toLowerCase().includes(searchLower)) ||
          bookingRef.toLowerCase().includes(searchLower) ||
          b.seatNumbers?.join(",").toLowerCase().includes(searchLower);

        if (role === "company_admin") return matchesSearch && b.companyId === companyId;
        return matchesSearch;
      })
      .sort((a, b) => getDateTime(b.createdAt) - getDateTime(a.createdAt));
  }, [bookings, searchTerm, companyId, role]);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeTab]);

  const handleUpdateBookingStatus = async (bookingId: string, newStatus: "confirmed" | "pending" | "cancelled", reason?: string) => {
    try {
      setLoading(true);
      const bookingRef = doc(db, "bookings", bookingId);
      const updateData: any = {
        bookingStatus: newStatus,
        updatedAt: new Date(),
      };

      if (newStatus === "cancelled") {
        updateData.cancellationDate = new Date();
        if (reason) {
          updateData.cancellationReason = reason;
        }
      }

      if (newStatus === "confirmed") {
        updateData.confirmedDate = new Date();
      }

      await updateDoc(bookingRef, updateData);

      setSuccess(`Booking ${newStatus === "confirmed" ? "approved" : newStatus} successfully`);
      setBookings((prevBookings) =>
        prevBookings.map((b) =>
          b.id === bookingId
            ? {
                ...b,
                bookingStatus: newStatus,
                updatedAt: new Date(),
                ...(newStatus === "cancelled" && { 
                  cancellationDate: new Date(),
                  ...(reason && { cancellationReason: reason })
                }),
                ...(newStatus === "confirmed" && { confirmedDate: new Date() }),
              }
            : b
        )
      );
    } catch (err: any) {
      setError("Failed to update booking: " + (err?.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const handleRefund = async (bookingId: string) => {
    if (!window.confirm("Are you sure you want to process a refund for this booking?")) {
      return;
    }

    try {
      setLoading(true);
      const bookingRef = doc(db, "bookings", bookingId);
      await updateDoc(bookingRef, {
        paymentStatus: "refunded",
        refundDate: new Date(),
        updatedAt: new Date(),
      });

      setSuccess("Refund processed successfully");
      setBookings((prevBookings) =>
        prevBookings.map((b) =>
          b.id === bookingId
            ? {
                ...b,
                paymentStatus: "refunded",
                refundDate: new Date(),
                updatedAt: new Date(),
              }
            : b
        )
      );
    } catch (err: any) {
      setError("Failed to process refund: " + (err?.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (bookingId: string) => {
    const reason = window.prompt("Please provide a reason for rejection (optional):");
    
    if (reason === null) return; // User cancelled

    await handleUpdateBookingStatus(bookingId, "cancelled", reason || "Rejected by admin");
  };

  const handleResendConfirmation = async (bookingId: string) => {
    try {
      setLoading(true);
      // In a real implementation, this would trigger an email/SMS
      // For now, we'll just show a success message
      setSuccess("Confirmation resent to customer");
    } catch (err: any) {
      setError("Failed to resend confirmation: " + (err?.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string, type: string = "booking") => {
    const baseClasses = "inline-flex px-2 py-1 rounded-full text-xs font-medium";
    if (type === "booking") {
      switch (status.toLowerCase()) {
        case "confirmed":
          return `${baseClasses} bg-green-100 text-green-800`;
        case "pending":
          return `${baseClasses} bg-yellow-100 text-yellow-800`;
        case "cancelled":
          return `${baseClasses} bg-red-100 text-red-800`;
        default:
          return `${baseClasses} bg-gray-100 text-gray-800`;
      }
    } else {
      switch (status.toLowerCase()) {
        case "paid":
          return `${baseClasses} bg-green-100 text-green-800`;
        case "pending":
          return `${baseClasses} bg-yellow-100 text-yellow-800`;
        case "refunded":
          return `${baseClasses} bg-blue-100 text-blue-800`;
        case "failed":
          return `${baseClasses} bg-red-100 text-red-800`;
        default:
          return `${baseClasses} bg-gray-100 text-gray-800`;
      }
    }
  };

  // Memoized filtered bookings by tab
  const bookingsByTab = useMemo(() => {
    switch (activeTab) {
      case "confirmed":
        // Only show bookings that are both booking confirmed AND payment paid
        return filteredBookings.filter((b) => 
          b.bookingStatus === "confirmed" && b.paymentStatus === "paid"
        );
      case "pending":
        // Show bookings that are either booking pending OR payment pending (but not fully confirmed)
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

  // Memoized stats calculation
  const stats = useMemo(() => ({
    total: filteredBookings.length,
    confirmed: filteredBookings.filter((b) => 
      b.bookingStatus === "confirmed" && b.paymentStatus === "paid"
    ).length,
    pending: filteredBookings.filter((b) => 
      b.bookingStatus === "pending" || 
      (b.bookingStatus === "confirmed" && b.paymentStatus === "pending")
    ).length,
    cancelled: filteredBookings.filter((b) => b.bookingStatus === "cancelled").length,
    totalRevenue: filteredBookings
      .filter((b) => b.paymentStatus === "paid")
      .reduce((sum, b) => sum + (b.totalAmount || 0), 0),
  }), [filteredBookings]);

  // Pagination calculations
  const totalPages = Math.ceil(bookingsByTab.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedBookings = bookingsByTab.slice(startIndex, startIndex + pageSize);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Format date safely - specifically for Firestore timestamps
  const formatDate = (date: Date | { toDate(): Date } | { seconds: number } | any): string => {
    try {
      if (!date) return "N/A";
      if (date instanceof Date) return date.toLocaleDateString();
      if (date.toDate && typeof date.toDate === 'function') return date.toDate().toLocaleDateString();
      if (date.seconds && typeof date.seconds === 'number') {
        return new Date(date.seconds * 1000).toLocaleDateString();
      }
      return "N/A";
    } catch {
      return "N/A";
    }
  };

  // Format datetime for journey display
  const formatDateTime = (date: Date | { toDate(): Date } | { seconds: number } | any): string => {
    try {
      if (!date) return "N/A";
      if (date instanceof Date) return date.toLocaleString();
      if (date.toDate && typeof date.toDate === 'function') return date.toDate().toLocaleString();
      if (date.seconds && typeof date.seconds === 'number') {
        return new Date(date.seconds * 1000).toLocaleString();
      }
      return "N/A";
    } catch {
      return "N/A";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Bookings Management</h2>
          <p className="text-gray-600 mt-1">Monitor and manage all customer bookings</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button className="bg-blue-600 text-white hover:bg-blue-700">
            <FileText className="w-4 h-4 mr-2" /> Export
          </Button>
        </div>
      </div>

      {/* Tabs */}
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
              className={`flex items-center space-x-2 px-4 py-2 rounded-t-lg ${
                activeTab === id ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              onClick={() => setActiveTab(id)}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
              <span className="ml-2 bg-gray-200 text-gray-800 text-xs font-medium px-2 py-1 rounded-full">
                {count}
              </span>
            </Button>
          ))}
        </div>
      </div>

      {/* Search and Controls */}
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

      {/* Table */}
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
              {bookingsByTab.length === 0 ? (
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
                  // Handle departure date from schedule
                  const departureDate = schedule?.departureDateTime ? 
                    (schedule.departureDateTime.seconds ? 
                      new Date(schedule.departureDateTime.seconds * 1000) : 
                      schedule.departureDateTime
                    ) : null;

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
                        <span className="text-sm text-gray-900">
                          {booking.seatNumbers?.join(", ") || "N/A"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">
                          MWK {(booking.totalAmount || 0).toLocaleString()}
                        </span>
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
                          <div className="flex space-x-2">
                            {/* Pending Status Actions */}
                            {booking.bookingStatus === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleUpdateBookingStatus(booking.id, "confirmed")}
                                  disabled={loading}
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                  title="Approve Booking"
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleReject(booking.id)}
                                  disabled={loading}
                                  title="Reject Booking"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            
                            {/* Confirmed Status Actions */}
                            {booking.bookingStatus === "confirmed" && booking.paymentStatus === "paid" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleResendConfirmation(booking.id)}
                                  disabled={loading}
                                  title="Resend Confirmation"
                                  className="text-blue-600 hover:text-blue-700"
                                >
                                  <Mail className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleUpdateBookingStatus(booking.id, "cancelled", "Cancelled by admin")}
                                  disabled={loading}
                                  title="Cancel Booking"
                                >
                                  <Ban className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            
                            {/* Confirmed but Pending Payment Actions */}
                            {booking.bookingStatus === "confirmed" && booking.paymentStatus === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleResendConfirmation(booking.id)}
                                  disabled={loading}
                                  title="Send Payment Reminder"
                                  className="text-orange-600 hover:text-orange-700"
                                >
                                  <AlertTriangle className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleUpdateBookingStatus(booking.id, "cancelled", "Payment not received")}
                                  disabled={loading}
                                  title="Cancel Due to Non-Payment"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            
                            {/* Cancelled Status Actions */}
                            {booking.bookingStatus === "cancelled" && booking.paymentStatus === "paid" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRefund(booking.id)}
                                disabled={loading}
                                title="Process Refund"
                                className="text-purple-600 hover:text-purple-700"
                              >
                                <DollarSign className="w-4 h-4" />
                              </Button>
                            )}
                            
                            {/* Failed Payment Actions */}
                            {booking.paymentStatus === "failed" && booking.bookingStatus !== "cancelled" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleResendConfirmation(booking.id)}
                                  disabled={loading}
                                  title="Request Payment Retry"
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleUpdateBookingStatus(booking.id, "cancelled", "Payment failed")}
                                  disabled={loading}
                                  title="Cancel Due to Payment Failure"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            
                            {/* Universal Actions */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedBooking(booking)}
                              title="View Full Details"
                              className="text-gray-600 hover:text-gray-700"
                            >
                              <Eye className="w-4 h-4" />
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

        {/* Booking Details Modal */}
        {selectedBooking && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                {/* Modal Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">Booking Details</h3>
                    <p className="text-gray-600">
                      {selectedBooking.bookingReference || selectedBooking.id}
                    </p>
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

                {/* Booking Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Trip Information</h4>
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span className="text-sm">
                            {routes.find(r => r.id === schedules.find(s => s.id === selectedBooking.scheduleId)?.routeId)?.origin} → {routes.find(r => r.id === schedules.find(s => s.id === selectedBooking.scheduleId)?.routeId)?.destination || "Unknown Route"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-sm">{formatDate(selectedBooking.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-gray-400" />
                          <span className="text-sm">{selectedBooking.passengerDetails?.length || 0} passenger(s)</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Payment Information</h4>
                      <div className="mt-2 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Amount:</span>
                          <span className="text-sm font-semibold">MWK {(selectedBooking.totalAmount || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Method:</span>
                          <span className="text-sm">{selectedBooking.paymentMethod || "N/A"}</span>
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
                      <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Status</h4>
                      <div className="mt-2 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Booking:</span>
                          <span className={getStatusBadge(selectedBooking.bookingStatus)}>
                            {selectedBooking.bookingStatus}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Payment:</span>
                          <span className={getStatusBadge(selectedBooking.paymentStatus, "payment")}>
                            {selectedBooking.paymentStatus}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Seats</h4>
                      <div className="mt-2">
                        <div className="flex flex-wrap gap-1">
                          {selectedBooking.seatNumbers?.map((seat, index) => (
                            <span key={index} className="inline-flex px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                              {seat}
                            </span>
                          )) || <span className="text-sm text-gray-500">No seats assigned</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Passenger Details */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Passenger Details</h4>
                  <div className="space-y-3">
                    {selectedBooking.passengerDetails?.map((passenger, index) => (
                      <div key={index} className="bg-gray-50 p-4 rounded-lg">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Name:</span>
                            <p className="font-medium">{passenger.name}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Age:</span>
                            <p className="font-medium">{passenger.age}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Gender:</span>
                            <p className="font-medium capitalize">{passenger.gender}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Seat:</span>
                            <p className="font-medium">{passenger.seatNumber || "N/A"}</p>
                          </div>
                        </div>
                      </div>
                    )) || <p className="text-gray-500 text-sm">No passenger details available</p>}
                  </div>
                </div>

                {/* Action Buttons */}
                {role === "company_admin" && (
                  <div className="border-t pt-4">
                    <div className="flex flex-wrap gap-2 justify-end">
                      {selectedBooking.bookingStatus === "pending" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => {
                              handleUpdateBookingStatus(selectedBooking.id, "confirmed");
                              setSelectedBooking(null);
                            }}
                            disabled={loading}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <Check className="w-4 h-4 mr-2" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              handleReject(selectedBooking.id);
                              setSelectedBooking(null);
                            }}
                            disabled={loading}
                          >
                            <X className="w-4 h-4 mr-2" />
                            Reject
                          </Button>
                        </>
                      )}
                      
                      {selectedBooking.bookingStatus === "confirmed" && selectedBooking.paymentStatus === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            handleResendConfirmation(selectedBooking.id);
                            setSelectedBooking(null);
                          }}
                          disabled={loading}
                          className="text-orange-600 hover:text-orange-700"
                        >
                          <AlertTriangle className="w-4 h-4 mr-2" />
                          Payment Reminder
                        </Button>
                      )}
                      
                      {selectedBooking.bookingStatus === "cancelled" && selectedBooking.paymentStatus === "paid" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            handleRefund(selectedBooking.id);
                            setSelectedBooking(null);
                          }}
                          disabled={loading}
                          className="text-purple-600 hover:text-purple-700"
                        >
                          <DollarSign className="w-4 h-4 mr-2" />
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
              Showing {startIndex + 1} to {Math.min(startIndex + pageSize, bookingsByTab.length)} of {bookingsByTab.length} results
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
              <div className="flex space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(page)}
                    >
                      {page}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
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