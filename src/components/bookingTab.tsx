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
  Mail,
  User,
  Ban,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SEAT_LAYOUT_CONFIGS = {
  standard: { seatsPerRow: 4, aislePosition: 2, seatLabels: ["A", "B", "C", "D"] },
  luxury: { seatsPerRow: 3, aislePosition: 1, seatLabels: ["A", "B", "C"] },
  express: { seatsPerRow: 4, aislePosition: 2, seatLabels: ["A", "B", "C", "D"] },
  minibus: { seatsPerRow: 3, aislePosition: 1, seatLabels: ["A", "B", "C"] },
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
  user: any;
  userProfile: any;
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
    const base = "w-12 h-12 rounded-lg text-xs font-bold border-2 transition-all flex items-center justify-center";
    switch (status) {
      case "booked":
        return `${base} bg-red-50 border-red-400 text-red-700 cursor-pointer hover:bg-red-100 hover:shadow-md hover:scale-105`;
      case "available":
        return `${base} bg-white border-gray-300 text-gray-500 cursor-default`;
      default:
        return "invisible";
    }
  };

  const bookedSeats = bookings.reduce((sum, b) => sum + (b.seatNumbers?.length || 0), 0);
  const availableSeats = (bus?.capacity || 0) - bookedSeats;
  const occupancyRate = bus?.capacity ? (bookedSeats / bus.capacity) * 100 : 0;

  return (
    <div className={`bg-white rounded-xl shadow-sm border ${className}`}>
      <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 rounded-xl">
              <BusIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">{bus?.licensePlate || "Bus"}</h3>
              <p className="text-sm text-gray-600">{bus?.busType} • {bus?.capacity || "?"} seats total</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Departure</p>
            <p className="font-semibold text-gray-900">
              {schedule?.departureDateTime?.toLocaleDateString() || "N/A"}
            </p>
            <p className="text-sm text-gray-600">
              {schedule?.departureDateTime?.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) || ""}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-red-600">{bookedSeats}</p>
            <p className="text-xs text-gray-600">Booked</p>
          </div>
          <div className="bg-white rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{availableSeats}</p>
            <p className="text-xs text-gray-600">Available</p>
          </div>
          <div className="bg-white rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{occupancyRate.toFixed(0)}%</p>
            <p className="text-xs text-gray-600">Occupancy</p>
          </div>
        </div>

        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className={`h-3 rounded-full transition-all ${
                occupancyRate > 75 ? 'bg-red-500' : occupancyRate > 50 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${occupancyRate}%` }}
            />
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="flex items-center justify-center mb-6">
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full">
            <div className="w-8 h-8 bg-gray-800 rounded-md flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm font-medium text-gray-700">Driver</span>
          </div>
        </div>

        <div className="max-w-md mx-auto">
          <div className="space-y-2">
            {seatLayout.map((row, rowIdx) => (
              <div 
                key={rowIdx} 
                className="flex justify-center gap-2"
              >
                {row.map((seat, seatIdx) => {
                  if (!seat) return <div key={seatIdx} className="w-12 h-12" />;
                  const status = getSeatStatus(seat);
                  const booking = seatToBooking.get(seat);
                  const passenger = booking?.passengerDetails?.find(p => p.seatNumber === seat);

                  return (
                    <div
                      key={seatIdx}
                      className={getSeatClass(status)}
                      onClick={() => status === "booked" && booking && onSeatClick?.(booking)}
                      title={passenger?.name || (booking ? "Passenger" : "Available")}
                    >
                      {seat}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-center gap-8 text-sm text-gray-600 mt-8">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-white border-2 border-gray-300 rounded" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-red-50 border-2 border-red-400 rounded" />
            <span>Booked (Click to view)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

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
  user, 
  userProfile,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [activeTab, setActiveTab] = useState("total");
  const [viewMode, setViewMode] = useState<"list" | "seats">("list");
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const getTimestampMillis = useCallback((date: any): number => {
    if (!date) return 0;
    if (date instanceof Date) return date.getTime();
    if (typeof date.toMillis === 'function') return date.toMillis();
    if (date.seconds && typeof date.seconds === 'number') return date.seconds * 1000;
    return 0;
  }, []);

// Inside BookingsTab.tsx

const filteredBookings = useMemo(() => {
  return bookings.filter((b) => {
    if (!b) return false;

    // --- ACCESS CONTROL LOGIC ---
    if (userProfile?.role === 'company_admin') {
      // Admin: Must match companyId (already fetched, but extra safety)
      if (b.companyId !== companyId) return false;
    } 
    else if (userProfile?.role === 'operator') {
      // Operator: Only show bookings for schedules they created
      const operatorScheduleIds = schedules
        .filter(s => s.createdBy === user?.uid)
        .map(s => s.id);
      
      if (!operatorScheduleIds.includes(b.scheduleId)) return false;
    }

    // --- SEARCH LOGIC ---
    const q = searchTerm.toLowerCase();
    const matchesSearch = 
      b.bookingReference?.toLowerCase().includes(q) ||
      b.passengerDetails?.some(p => p.name?.toLowerCase().includes(q));

    return matchesSearch;
  });
}, [bookings, schedules, user, userProfile, companyId, searchTerm]);

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
}), [filteredBookings])

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

  const formatDate = useCallback((date: any): string => {
    try {
      if (!date) return "N/A";
      if (date instanceof Date) return date.toLocaleDateString();
      if (date.toDate && typeof date.toDate === 'function') return date.toDate().toLocaleDateString();
      if (date.seconds && typeof date.seconds === 'number') {
        return new Date(date.seconds * 1000).toLocaleDateString();
      }
      return "N/A";
    } catch (error) {
      return "N/A";
    }
  }, []);

  const formatDateTime = useCallback((date: any): string => {
    try {
      if (!date) return "N/A";
      if (date instanceof Date) return date.toLocaleString();
      if (date.toDate && typeof date.toDate === 'function') return date.toDate().toLocaleString();
      if (date.seconds && typeof date.seconds === 'number') {
        return new Date(date.seconds * 1000).toLocaleString();
      }
      return "N/A";
    } catch (error) {
      return "N/A";
    }
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

        if (!bookingDoc.exists()) throw new Error("Booking not found");

        const updatedData = {
          bookingStatus: newStatus,
          updatedAt: new Date(),
          [newStatus === "confirmed" ? "confirmedDate" : "cancellationDate"]: new Date(),
          ...(reason && { cancellationReason: reason }),
        };

        await updateDoc(bookingRef, updatedData);
        setBookings((prev) =>
          prev.map((b) => (b.id === bookingId ? ({ ...b, ...updatedData } as Booking) : b))
        );

        showNotification("Booking Updated", `Booking ${newStatus}`, newStatus === "confirmed" ? "success" : "warning");
        setSuccess(`Booking ${newStatus} successfully`);
      } catch (error: any) {
        setError(error.message || `Failed to ${newStatus} booking`);
      } finally {
        setActionLoading((prev) => ({ ...prev, [bookingId]: false }));
      }
    },
    [setBookings, setError, setSuccess]
  );

  if (!companyId && role === "company_admin") {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-red-600" />
          <div>
            <h3 className="font-semibold text-red-900">Access Error</h3>
            <p className="text-sm text-red-700">Company ID is required for company admin role</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { id: "total", label: "Total", count: stats.total, icon: Users, color: "blue" },
          { id: "confirmed", label: "Confirmed", count: stats.confirmed, icon: Check, color: "green" },
          { id: "pending", label: "Pending", count: stats.pending, icon: Clock, color: "yellow" },
          { id: "cancelled", label: "Cancelled", count: stats.cancelled, icon: X, color: "red" },
          { id: "revenue", label: "Revenue", count: `MWK ${stats.totalRevenue.toLocaleString()}`, icon: DollarSign, color: "purple" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <button
              key={stat.id}
              onClick={() => setActiveTab(stat.id)}
              className={`p-4 rounded-xl border-2 transition-all text-left ${
                activeTab === stat.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className={`w-5 h-5 ${activeTab === stat.id ? 'text-blue-600' : 'text-gray-400'}`} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.count}</p>
              <p className="text-sm text-gray-600">{stat.label}</p>
            </button>
          );
        })}
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder="Search by name, reference, or seat..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
            </select>

            <div className="flex gap-1 border rounded-lg p-1">
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="px-3"
              >
                <ListIcon className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === "seats" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("seats")}
                className="px-3"
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
            </div>

            <Button variant="outline" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {viewMode === "list" ? (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Passenger</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Seats</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  {userProfile?.role === 'operator' && (
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedBookings.length === 0 ? (
                  <tr>
                    <td colSpan={userProfile?.role === 'operator' ? 8 : 7} className="px-6 py-12 text-center text-gray-500">
                      No bookings found matching your criteria
                    </td>
                  </tr>
                ) : (
                  paginatedBookings.map((booking) => {
                    const schedule = schedules.find((s) => s.id === booking.scheduleId);
                    const route = routes.find((r) => r.id === schedule?.routeId);
                    const ref = booking.bookingReference || booking.id?.slice(0, 10);

                    return (
                      <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-mono font-medium text-gray-900">{ref}</span>
                            <span className="text-xs text-gray-500">{formatDate(booking.createdAt)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <User className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {booking.passengerDetails?.[0]?.name || "N/A"}
                              </div>
                              {booking.passengerDetails?.[0]?.contactNumber && (
                                <div className="text-xs text-gray-500 flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {booking.passengerDetails[0].contactNumber}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-900">
                              {route ? `${route.origin} → ${route.destination}` : "Unknown"}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-900">
                              {schedule?.departureDateTime ? formatDateTime(schedule.departureDateTime) : "N/A"}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {booking.seatNumbers?.slice(0, 3).map((seat, idx) => (
                              <span key={idx} className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                                {seat}
                              </span>
                            ))}
                            {(booking.seatNumbers?.length || 0) > 3 && (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                                +{(booking.seatNumbers?.length || 0) - 3}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-900">
                              MWK {booking.totalAmount?.toLocaleString() || "0"}
                            </span>
                            {booking.paymentProvider && (
                              <span className="text-xs text-gray-500">{booking.paymentProvider}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className={getStatusBadge(booking.bookingStatus)}>
                              {booking.bookingStatus}
                            </span>
                            <span className={getStatusBadge(booking.paymentStatus, "payment")}>
                              {booking.paymentStatus}
                            </span>
                          </div>
                        </td>
                        {userProfile?.role === 'operator' && (
                          <td className="px-6 py-4">
                            <div className="flex gap-1">
                              {booking.bookingStatus === "pending" && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => handleUpdateBookingStatus(booking.id, "confirmed")}
                                    disabled={actionLoading[booking.id]}
                                    className="bg-green-600 hover:bg-green-700 px-2 py-1 h-8"
                                  >
                                    {actionLoading[booking.id] ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Check className="w-3 h-3" />
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleUpdateBookingStatus(booking.id, "cancelled", "Cancelled by operator")}
                                    disabled={actionLoading[booking.id]}
                                    className="px-2 py-1 h-8"
                                  >
                                    {actionLoading[booking.id] ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <X className="w-3 h-3" />
                                    )}
                                  </Button>
                                </>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedBooking(booking)}
                                className="px-2 py-1 h-8"
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {startIndex + 1} to {Math.min(startIndex + pageSize, bookingsByTab.length)} of {bookingsByTab.length} bookings
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                {getPaginationPages().map((page) => (
                  <Button
                    key={page}
                    size="sm"
                    variant={currentPage === page ? "default" : "outline"}
                    onClick={() => handlePageChange(page)}
                    className="px-3 py-1"
                  >
                    {page}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Seat View */
        <div className="space-y-6">
          {Array.from(bookingsBySchedule.entries()).map(([scheduleId, scheduleBookings]) => {
            const schedule = schedules.find(s => s.id === scheduleId);
            const bus = buses.find(b => b.id === schedule?.busId);
            const route = routes.find(r => r.id === schedule?.routeId);

            if (!schedule || !bus) return null;

            return (
              <div key={scheduleId}>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {route ? `${route.origin} → ${route.destination}` : 'Unknown Route'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {schedule.departureDateTime?.toLocaleDateString()} at{' '}
                      {schedule.departureDateTime?.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {scheduleBookings.length} booking{scheduleBookings.length !== 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-gray-600">
                      {scheduleBookings.reduce((sum, b) => sum + (b.seatNumbers?.length || 0), 0)} seat{scheduleBookings.reduce((sum, b) => sum + (b.seatNumbers?.length || 0), 0) !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <SeatSelectionView
                  bus={bus}
                  schedule={schedule}
                  bookings={scheduleBookings}
                  onSeatClick={userProfile?.role === 'operator' ? setSelectedBooking : undefined}
                />
              </div>
            );
          })}
          {bookingsBySchedule.size === 0 && (
            <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
              <LayoutGrid className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No bookings to display</h3>
              <p className="text-gray-500">Bookings will appear here when passengers make reservations</p>
            </div>
          )}
        </div>
      )}

      {/* Booking Details Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedBooking(null)}>
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Booking Details</h3>
                <p className="text-sm text-gray-600 font-mono">{selectedBooking.bookingReference || selectedBooking.id?.slice(0, 10)}</p>
              </div>
              <button onClick={() => setSelectedBooking(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status */}
              <div className="flex gap-2">
                <span className={getStatusBadge(selectedBooking.bookingStatus)}>
                  {selectedBooking.bookingStatus}
                </span>
                <span className={getStatusBadge(selectedBooking.paymentStatus, "payment")}>
                  {selectedBooking.paymentStatus}
                </span>
              </div>

              {/* Route & Schedule */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Route</p>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <p className="font-medium">
                      {(() => {
                        const schedule = schedules.find(s => s.id === selectedBooking.scheduleId);
                        const route = routes.find(r => r.id === schedule?.routeId);
                        return route ? `${route.origin} → ${route.destination}` : 'Unknown';
                      })()}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Departure</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <p className="font-medium">
                      {(() => {
                        const schedule = schedules.find(s => s.id === selectedBooking.scheduleId);
                        return schedule?.departureDateTime ? formatDateTime(schedule.departureDateTime) : 'N/A';
                      })()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Passengers */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">Passengers</p>
                <div className="space-y-2">
                  {selectedBooking.passengerDetails?.map((passenger, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{passenger.name}</p>
                          <div className="flex items-center gap-3 text-sm text-gray-600">
                            {passenger.contactNumber && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {passenger.contactNumber}
                              </span>
                            )}
                            {passenger.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {passenger.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded">
                        Seat {passenger.seatNumber}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment */}
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Payment Information</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Total Amount</p>
                    <p className="text-lg font-bold text-gray-900">
                      MWK {selectedBooking.totalAmount?.toLocaleString() || "0"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Payment Method</p>
                    <p className="font-medium text-gray-900">{selectedBooking.paymentProvider || "N/A"}</p>
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="border-t pt-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Created</p>
                    <p className="font-medium">{formatDateTime(selectedBooking.createdAt)}</p>
                  </div>
                  {selectedBooking.updatedAt && (
                    <div>
                      <p className="text-gray-600">Updated</p>
                      <p className="font-medium">{formatDateTime(selectedBooking.updatedAt)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              {userProfile?.role === 'operator' && selectedBooking.bookingStatus === "pending" && (
                <div className="border-t pt-4 flex gap-2">
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => {
                      handleUpdateBookingStatus(selectedBooking.id, "confirmed");
                      setSelectedBooking(null);
                    }}
                    disabled={actionLoading[selectedBooking.id]}
                  >
                    {actionLoading[selectedBooking.id] ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Check className="w-4 h-4 mr-2" />
                    )}
                    Confirm Booking
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => {
                      handleUpdateBookingStatus(selectedBooking.id, "cancelled", "Cancelled by operator");
                      setSelectedBooking(null);
                    }}
                    disabled={actionLoading[selectedBooking.id]}
                  >
                    {actionLoading[selectedBooking.id] ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Ban className="w-4 h-4 mr-2" />
                    )}
                    Cancel Booking
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingsTab;