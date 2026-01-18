"use client";

import { FC, useState, useMemo, useCallback } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { Booking } from "@/types/core";
import {
  Search,
  Check,
  X,
  Clock,
  Users,
  MapPin,
  Calendar,
  Eye,
  CreditCard,
  RefreshCw,
  Download,
  DollarSign,
  AlertTriangle,
  Phone,
  Bus as BusIcon,
  List as ListIcon,
  LayoutGrid,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ────────────────────────────────────────────────
// Adapted SeatSelection for view-only (admin/operator manifest style)
// ────────────────────────────────────────────────

const SEAT_LAYOUT_CONFIGS = {
  standard: { seatsPerRow: 4, aislePosition: 2, seatLabels: ["A", "B", "C", "D"] },
  luxury: { seatsPerRow: 3, aislePosition: 1, seatLabels: ["A", "B", "C"] },
  express: { seatsPerRow: 4, aislePosition: 2, seatLabels: ["A", "B", "C", "D"] },
};

interface SeatSelectionViewProps {
  bus: any;
  schedule: any;
  bookings: Booking[];
  onSeatClick?: (booking: Booking) => void;
  className?: string;
}

interface BookingsTabProps {
  bookings: Booking[];
  setBookings: (bookings: Booking[] | ((prev: Booking[]) => Booking[])) => void;
  schedules: any[];
  routes: any[];
  companyId?: string;
  setError: (error: string) => void;
  setSuccess: (success: string) => void;
  role?: "company_admin" | "operator" | "user";
  companies?: any[];
  buses?: any[];
}

const SeatSelectionView: FC<SeatSelectionViewProps> = ({
  bus,
  schedule,
  bookings,
  onSeatClick,
  className = "",
}) => {
  const busTypeKey = (bus?.busType?.toLowerCase() || "standard") as keyof typeof SEAT_LAYOUT_CONFIGS;
  const layoutConfig = SEAT_LAYOUT_CONFIGS[busTypeKey] || SEAT_LAYOUT_CONFIGS.standard;

  const seatLayout = useMemo(() => {
    const total = bus?.capacity || 40;
    const { seatsPerRow, seatLabels } = layoutConfig;
    const rows = Math.ceil(total / seatsPerRow);
    const seats: (string | null)[][] = [];
    let counter = 1;

    for (let r = 1; r <= rows; r++) {
      const row: (string | null)[] = [];
      for (let c = 0; c < seatsPerRow && counter <= total; c++) {
        row.push(`${r}${seatLabels[c]}`);
        counter++;
      }
      while (row.length < seatsPerRow) row.push(null);
      seats.push(row);
    }
    return seats;
  }, [bus?.capacity, layoutConfig]);

  // Map seat number → booking (first match)
  const seatToBooking = useMemo(() => {
    const map = new Map<string, Booking>();
    bookings.forEach((b) => {
      b.seatNumbers?.forEach((seat: string | number) => {
        map.set(String(seat), b);
      });
    });
    return map;
  }, [bookings]);

  const getSeatStatus = (seat: string | null) => {
    if (!seat) return "empty";
    return seatToBooking.has(seat) ? "booked" : "available";
  };

  const getSeatClass = (status: string) => {
    const base = "w-10 h-10 rounded-xl text-xs font-semibold border-2 transition-all flex items-center justify-center";
    switch (status) {
      case "booked":
        return `${base} bg-red-100 border-red-300 text-red-800 cursor-pointer hover:bg-red-200 hover:shadow-sm`;
      case "available":
        return `${base} bg-white border-gray-200 text-gray-400 cursor-default`;
      default:
        return "invisible";
    }
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm border p-6 ${className}`}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-semibold flex items-center gap-3">
          <BusIcon className="w-5 h-5 text-blue-600" />
          {bus?.licensePlate || "Bus"} • {bus?.capacity || "?"} seats
        </h3>
        <span className="text-sm text-gray-500">
          {schedule?.departureDateTime?.toLocaleString() || "N/A"}
        </span>
      </div>

      <div className="grid gap-2 mb-6" style={{ gridTemplateColumns: `repeat(${layoutConfig.seatsPerRow}, minmax(0, 1fr))` }}>
        {seatLayout.flat().map((seat, idx) => {
          if (!seat) return <div key={idx} className="w-10 h-10" />;
          const status = getSeatStatus(seat);
          const booking = seatToBooking.get(seat);

          return (
            <div
              key={idx}
              className={getSeatClass(status)}
              onClick={() => status === "booked" && booking && onSeatClick?.(booking)}
              title={booking ? booking.passengerDetails?.[0]?.name || "Passenger" : undefined}
            >
              {seat}
            </div>
          );
        })}
      </div>

      <div className="flex justify-center gap-6 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-white border border-gray-200 rounded" /> Available
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-100 border border-red-300 rounded" /> Booked
        </div>
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────
// Main BookingsTab Component
// ────────────────────────────────────────────────

// Helper function for status badges
const getStatusBadge = (status: string, type: "booking" | "payment" = "booking") => {
  const baseClass = "px-3 py-1 rounded-full text-xs font-medium";
  if (type === "booking") {
    switch (status) {
      case "confirmed":
        return `${baseClass} bg-green-100 text-green-800`;
      case "pending":
        return `${baseClass} bg-yellow-100 text-yellow-800`;
      case "cancelled":
        return `${baseClass} bg-red-100 text-red-800`;
      default:
        return `${baseClass} bg-gray-100 text-gray-800`;
    }
  } else {
    switch (status) {
      case "paid":
        return `${baseClass} bg-green-100 text-green-800`;
      case "pending":
        return `${baseClass} bg-yellow-100 text-yellow-800`;
      case "refunded":
        return `${baseClass} bg-blue-100 text-blue-800`;
      default:
        return `${baseClass} bg-gray-100 text-gray-800`;
    }
  }
};

// Helper function for notifications
const showNotification = (title: string, message: string, type: "success" | "warning" | "error" = "success") => {
  console.log(`[${type.toUpperCase()}] ${title}: ${message}`);
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
  buses = [],
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [activeTab, setActiveTab] = useState("total");
  const [viewMode, setViewMode] = useState<"list" | "seats">("list");
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  // ────────────────────────────────────────────────
  // Data Processing
  // ────────────────────────────────────────────────

  const getTimestampMillis = useCallback((date: any): number => {
    if (!date) return 0;
    if (date instanceof Date) return date.getTime();
    if (typeof date.toMillis === 'function') return date.toMillis();
    if (date.seconds && typeof date.seconds === 'number') return date.seconds * 1000;
    return 0;
  }, []);

  const filteredBookings = useMemo(() => {
    return bookings
      .filter((b) => {
        if (!b) return false;
        const q = searchTerm.toLowerCase();
        const ref = b.bookingReference || b.id || "";
        const matches =
          b.passengerDetails?.some((p) => p?.name?.toLowerCase().includes(q)) ||
          ref.toLowerCase().includes(q) ||
          b.seatNumbers?.join(",").toLowerCase().includes(q);

        return matches && (role !== "company_admin" || b.companyId === companyId);
      })
      .sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt));
  }, [bookings, searchTerm, companyId, role, getTimestampMillis]);

  const bookingsByTab = useMemo(() => {
    switch (activeTab) {
      case "confirmed":
        return filteredBookings.filter((b) => b.bookingStatus === "confirmed" && b.paymentStatus === "paid");
      case "pending":
        return filteredBookings.filter(
          (b) => b.bookingStatus === "pending" || (b.bookingStatus === "confirmed" && b.paymentStatus === "pending")
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
    pending: filteredBookings.filter(
      (b) => b.bookingStatus === "pending" || (b.bookingStatus === "confirmed" && b.paymentStatus === "pending")
    ).length,
    cancelled: filteredBookings.filter((b) => b.bookingStatus === "cancelled").length,
    totalRevenue: filteredBookings
      .filter((b) => b.paymentStatus === "paid")
      .reduce((sum, b) => sum + (b.totalAmount || 0), 0),
  }), [filteredBookings]);

  const totalPages = Math.ceil(bookingsByTab.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedBookings = bookingsByTab.slice(startIndex, startIndex + pageSize);

  const bookingsBySchedule = useMemo(() => {
    const map = new Map<string, Booking[]>();
    filteredBookings.forEach((b) => {
      if (b.scheduleId) {
        if (!map.has(b.scheduleId)) map.set(b.scheduleId, []);
        map.get(b.scheduleId)!.push(b);
      }
    });
    return map;
  }, [filteredBookings]);

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
          bookingStatus: newStatus,
          updatedAt: new Date(),
          [newStatus === "confirmed" ? "confirmedDate" : "cancellationDate"]: new Date(),
          ...(reason && { cancellationReason: reason }),
        };

        await updateDoc(bookingRef, updatedData);

        // FIX: Explicitly cast the merged object as Booking to satisfy TypeScript's strict literal type checking
        setBookings((prev) =>
          prev.map((b) => (b.id === bookingId ? ({ ...b, ...updatedData } as Booking) : b))
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
          paymentStatus: "refunded",
          refundDate: new Date(),
          updatedAt: new Date(),
        };

        await updateDoc(bookingRef, updatedData);

        // FIX: Explicitly cast the merged object as Booking to satisfy TypeScript's strict literal type checking
        setBookings((prev) =>
          prev.map((b) => (b.id === bookingId ? ({ ...b, ...updatedData } as Booking) : b))
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Bookings</h2>
          <p className="text-gray-600">Monitor and manage reservations</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm border p-5">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex-1 relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by name, reference, seat..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="border rounded px-3 py-2 text-sm min-w-[140px]"
            >
              <option value={5}>5 per page</option>
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
            </select>

            <div className="flex gap-2">
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="flex items-center gap-2"
              >
                <ListIcon className="w-4 h-4" />
                List View
              </Button>
              <Button
                variant={viewMode === "seats" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("seats")}
                className="flex items-center gap-2"
              >
                <LayoutGrid className="w-4 h-4" />
                Seat Layout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex flex-wrap gap-2 overflow-x-auto pb-1">
        {[
          { id: "total", label: "All Bookings", count: stats.total, color: "blue" },
          { id: "confirmed", label: "Confirmed", count: stats.confirmed, color: "green" },
          { id: "pending", label: "Pending", count: stats.pending, color: "yellow" },
          { id: "cancelled", label: "Cancelled", count: stats.cancelled, color: "red" },
          { id: "revenue", label: "Revenue", count: stats.totalRevenue.toLocaleString("en-MW"), color: "purple" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
              activeTab === tab.id
                ? `bg-${tab.color}-600 text-white border-${tab.color}-600 shadow-sm`
                : `bg-white text-gray-700 border-gray-200 hover:bg-gray-50`
            }`}
          >
            {tab.label}
            <span className="px-2 py-0.5 text-xs rounded-full bg-white/20">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Main Content */}
      {viewMode === "list" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedBookings.length === 0 ? (
            <div className="col-span-full py-12 text-center text-gray-500">
              No bookings match your filters
            </div>
          ) : (
            paginatedBookings.map((booking) => {
              const route = routes.find((r) => r.id === schedules.find((s) => s.id === booking.scheduleId)?.routeId);
              const statusColor =
                booking.bookingStatus === "confirmed"
                  ? "green"
                  : booking.bookingStatus === "pending"
                  ? "yellow"
                  : "red";

              return (
                <div
                  key={booking.id}
                  className="bg-white rounded-xl shadow-sm border hover:shadow-md transition-all duration-200 overflow-hidden"
                >
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="text-xs text-gray-500">
                          Ref: {booking.bookingReference || booking.id?.slice(0, 8)}
                        </div>
                        <h3 className="font-semibold text-gray-900 mt-1">
                          {booking.passengerDetails?.[0]?.name || "Passenger"}
                        </h3>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium bg-${statusColor}-100 text-${statusColor}-800`}
                      >
                        {booking.bookingStatus}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm text-gray-600 mb-5">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-500" />
                        {route ? `${route.origin} → ${route.destination}` : "Route N/A"}
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-500" />
                        {booking.createdAt?.toLocaleString() || "N/A"}
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-500" />
                        {booking.seatNumbers?.length || 0} seat(s) • MWK {booking.totalAmount?.toLocaleString() || "0"}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setSelectedBooking(booking)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>

                      {booking.bookingStatus === "pending" && (
                        <Button
                          size="sm"
                          className="flex-1 bg-green-600 hover:bg-green-700"
                          onClick={() => handleUpdateBookingStatus(booking.id, "confirmed")}
                          disabled={actionLoading[booking.id]}
                        >
                          {actionLoading[booking.id] ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <Check className="w-4 h-4 mr-2" />
                          )}
                          Approve
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {Array.from(bookingsBySchedule.keys()).length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border p-12 text-center text-gray-500">
              No bookings with seat assignments to display
            </div>
          ) : (
            Array.from(bookingsBySchedule.entries()).map(([scheduleId, groupBookings]) => {
              const schedule = schedules.find((s) => s.id === scheduleId);
              const bus = buses.find((b) => b.id === schedule?.busId);

              return (
                <SeatSelectionView
                  key={scheduleId}
                  bus={bus}
                  schedule={schedule}
                  bookings={groupBookings}
                  onSeatClick={(booking) => setSelectedBooking(booking)}
                />
              );
            })
          )}
        </div>
      )}

      {/* Pagination (list view only) */}
      {viewMode === "list" && totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 px-1">
          <div className="text-sm text-gray-600">
            Showing {startIndex + 1}–{Math.min(startIndex + pageSize, bookingsByTab.length)} of {bookingsByTab.length}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            {getPaginationPages().map((page) => (
              <Button
                key={`page-${page}`}
                variant={currentPage === page ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </Button>
            ))}

            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
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
                              const departureDate =
                                schedule && schedule.departureDateTime &&
                                typeof schedule.departureDateTime === "object" &&
                                "seconds" in schedule.departureDateTime && typeof (schedule.departureDateTime as any).seconds === "number"
                                  ? new Date((schedule.departureDateTime as { seconds: number }).seconds * 1000)
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
                          <span className="text-sm">{selectedBooking.paymentProvider || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Provider:</span>
                          <span className="text-sm">{selectedBooking.paymentProvider || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Transaction:</span>
                          <span className="text-sm font-mono">{selectedBooking.transactionReference || "N/A"}</span>
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
                            ? selectedBooking.seatNumbers.map((seat) => (
                                <span key={`seat-${seat}`} className="inline-flex px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded">
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
                          <div key={`passenger-${index}-${passenger.name || ''}`} className="bg-gray-50 p-4 rounded-lg">
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
                              {passenger.contactNumber && (
                                <div>
                                  <span className="text-gray-600 font-medium">Phone:</span>
                                  <p className="font-medium text-gray-900 flex items-center">
                                    <Phone className="w-3 h-3 mr-1" />
                                    {passenger.contactNumber}
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
                    key={`page-${page}`}
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
    );
  };

export default BookingsTab;