"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { useAuth } from "@/contexts/AuthContext";
import {
  Building2,
  Loader2,
  Calendar,
  MapPin,
  Users,
  Clock,
  User,
  Menu,
  X,
  AlertTriangle,
  Bus,
  CheckCircle,
  ChevronRight,
} from "lucide-react";
import AlertMessage from "@/components/AlertMessage";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Route {
  id: string;
  origin: string;
  destination: string;
  distance?: number;
  estimatedDuration?: number;
}

interface BusInfo {
  id: string;
  licensePlate: string;
  busType: string;
  capacity: number;
}

interface Booking {
  id: string;
  scheduleId: string;
  passengerDetails?: { name: string; seatNumber?: string }[];
  bookingStatus: string;
  paymentStatus: string;
  totalAmount: number;
}

interface AssignedTrip {
  id: string;
  routeId: string;
  busId: string;
  conductorId?: string;
  departureDateTime: Date;
  arrivalDateTime: Date;
  isActive: boolean;
  price: number;
  availableSeats: number;
  totalSeats: number;
  companyId: string;
  // resolved at render time
  route?: Route;
  bus?: BusInfo;
  bookings?: Booking[];
}

type AlertType = { type: "error" | "success" | "warning" | "info"; message: string } | null;
type TripFilter = "upcoming" | "today" | "past" | "all";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const convertFirestoreDate = (date: any): Date => {
  if (!date) return new Date();
  if (date instanceof Date) return date;
  if (date.toDate && typeof date.toDate === "function") {
    try { return date.toDate(); } catch { return new Date(); }
  }
  if (typeof date === "string" || typeof date === "number") return new Date(date);
  if (date.seconds) return new Date(date.seconds * 1000);
  return new Date();
};

const formatDate = (date: Date) =>
  date.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });

const formatTime = (date: Date) =>
  date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const formatDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m > 0 ? `${m}m` : ""}`.trim() : `${m}m`;
};

const getTripStatus = (departure: Date, arrival: Date): { label: string; color: string } => {
  const now = new Date();
  if (now < departure) return { label: "Upcoming", color: "bg-blue-100 text-blue-800" };
  if (now >= departure && now <= arrival) return { label: "In Progress", color: "bg-green-100 text-green-800" };
  return { label: "Completed", color: "bg-gray-100 text-gray-600" };
};

// ─── Alert hook ──────────────────────────────────────────────────────────────

const useAlert = () => {
  const [alert, setAlert] = useState<AlertType>(null);
  const showAlert = useCallback((type: "error" | "success" | "warning" | "info", message: string) => setAlert({ type, message }), []);
  const clearAlert = useCallback(() => setAlert(null), []);

  useEffect(() => {
    if (alert) {
      const t = setTimeout(clearAlert, alert.type === "error" ? 7000 : 5000);
      return () => clearTimeout(t);
    }
  }, [alert, clearAlert]);

  return { alert, showAlert, clearAlert };
};

// ─── Trip Card ────────────────────────────────────────────────────────────────

const TripCard = ({
  trip,
  onSelect,
}: {
  trip: AssignedTrip;
  onSelect: (trip: AssignedTrip) => void;
}) => {
  const status = getTripStatus(trip.departureDateTime, trip.arrivalDateTime);
  const occupancy = trip.totalSeats > 0
    ? Math.round(((trip.totalSeats - trip.availableSeats) / trip.totalSeats) * 100)
    : 0;

  return (
    <div
      className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onSelect(trip)}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-400" />
            <span className="font-semibold text-gray-900">
              {trip.route ? `${trip.route.origin} → ${trip.route.destination}` : "Unknown Route"}
            </span>
          </div>
          {trip.route?.estimatedDuration && (
            <p className="text-xs text-gray-500 mt-1 ml-6">
              {formatDuration(trip.route.estimatedDuration)} trip
              {trip.route.distance ? ` · ${trip.route.distance} km` : ""}
            </p>
          )}
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
          {status.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="space-y-1">
          <p className="text-xs text-gray-500 font-medium">DEPARTURE</p>
          <p className="text-sm font-semibold text-gray-900">{formatTime(trip.departureDateTime)}</p>
          <p className="text-xs text-gray-500">{formatDate(trip.departureDateTime)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-gray-500 font-medium">ARRIVAL</p>
          <p className="text-sm font-semibold text-gray-900">{formatTime(trip.arrivalDateTime)}</p>
          <p className="text-xs text-gray-500">{formatDate(trip.arrivalDateTime)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center gap-2 text-gray-600">
          <Bus className="w-4 h-4" />
          <span className="text-sm">{trip.bus?.licensePlate || "No bus assigned"}</span>
          {trip.bus?.busType && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {trip.bus.busType}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <Users className="w-4 h-4" />
          <span className="text-sm">{trip.totalSeats - trip.availableSeats}/{trip.totalSeats}</span>
          <span className="text-xs text-gray-400">({occupancy}%)</span>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400" />
      </div>
    </div>
  );
};

// ─── Trip Detail Modal ────────────────────────────────────────────────────────

const TripDetailPanel = ({
  trip,
  onClose,
}: {
  trip: AssignedTrip;
  onClose: () => void;
}) => {
  const status = getTripStatus(trip.departureDateTime, trip.arrivalDateTime);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {trip.route ? `${trip.route.origin} → ${trip.route.destination}` : "Trip Details"}
            </h2>
            <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
              {status.label}
            </span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Schedule */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-500 font-medium mb-1">DEPARTURE</p>
              <p className="text-base font-bold text-gray-900">{formatTime(trip.departureDateTime)}</p>
              <p className="text-sm text-gray-500">{formatDate(trip.departureDateTime)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-500 font-medium mb-1">ARRIVAL</p>
              <p className="text-base font-bold text-gray-900">{formatTime(trip.arrivalDateTime)}</p>
              <p className="text-sm text-gray-500">{formatDate(trip.arrivalDateTime)}</p>
            </div>
          </div>

          {/* Bus Info */}
          {trip.bus && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Bus Details</h3>
              <div className="bg-gray-50 rounded-lg p-4 flex items-center gap-4">
                <Bus className="w-8 h-8 text-gray-400" />
                <div>
                  <p className="font-semibold text-gray-900">{trip.bus.licensePlate}</p>
                  <p className="text-sm text-gray-500">{trip.bus.busType} · {trip.bus.capacity} seats</p>
                </div>
              </div>
            </div>
          )}

          {/* Passenger Manifest */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Passenger Manifest
              <span className="text-xs font-normal text-gray-500">
                ({trip.totalSeats - trip.availableSeats} confirmed)
              </span>
            </h3>
            <div className="border rounded-lg overflow-hidden">
              {!trip.bookings || trip.bookings.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-400 text-sm">
                  No confirmed bookings for this trip yet.
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Passenger</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Seat</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {trip.bookings.flatMap(booking =>
                      (booking.passengerDetails || []).map((p, i) => (
                        <tr key={`${booking.id}-${i}`} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-700">
                                {p.name?.charAt(0)?.toUpperCase() || "?"}
                              </div>
                              <span className="text-sm text-gray-900">{p.name || "Unknown"}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {p.seatNumber || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              booking.paymentStatus === "paid"
                                ? "bg-green-100 text-green-700"
                                : "bg-yellow-100 text-yellow-700"
                            }`}>
                              {booking.paymentStatus === "paid" ? "Paid" : "Pending"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function ConductorDashboard() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { alert, showAlert, clearAlert } = useAlert();

  const [trips, setTrips] = useState<AssignedTrip[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [buses, setBuses] = useState<BusInfo[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TripFilter>("upcoming");
  const [selectedTrip, setSelectedTrip] = useState<AssignedTrip | null>(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const companyId = userProfile?.companyId?.trim() || "";

  // Fetch all supporting data
  const fetchData = useCallback(async () => {
    if (!user || !companyId) return;
    setLoading(true);

    try {
      // Company name
      const companyDoc = await getDoc(doc(db, "companies", companyId));
      if (companyDoc.exists()) setCompanyName(companyDoc.data().name || "");

      // Routes
      const routesSnap = await getDocs(query(collection(db, "routes"), where("companyId", "==", companyId)));
      const routeData = routesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Route[];
      setRoutes(routeData);

      // Buses
      const busesSnap = await getDocs(query(collection(db, "buses"), where("companyId", "==", companyId)));
      const busData = busesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as BusInfo[];
      setBuses(busData);

      // Assigned trips — schedules where conductorId == current user uid
      const tripsSnap = await getDocs(
        query(
          collection(db, "schedules"),
          where("companyId", "==", companyId),
          where("conductorId", "==", user.uid)
        )
      );

      const tripData = tripsSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          departureDateTime: convertFirestoreDate(data.departureDateTime),
          arrivalDateTime: convertFirestoreDate(data.arrivalDateTime),
        } as AssignedTrip;
      });

      // Bookings for those trips
      if (tripData.length > 0) {
        const tripIds = tripData.map(t => t.id);
        // Firestore 'in' queries support up to 30 items; chunk if needed
        const chunks = [];
        for (let i = 0; i < tripIds.length; i += 30) chunks.push(tripIds.slice(i, i + 30));

        const bookingResults: Booking[] = [];
        for (const chunk of chunks) {
          const bSnap = await getDocs(
            query(collection(db, "bookings"), where("scheduleId", "in", chunk))
          );
          bSnap.docs.forEach(d => bookingResults.push({ id: d.id, ...d.data() } as Booking));
        }
        setBookings(bookingResults);
      }

      setTrips(tripData);
    } catch (err: any) {
      showAlert("error", err.message || "Failed to load trips");
    } finally {
      setLoading(false);
    }
  }, [user, companyId, showAlert]);

  // Auth guard
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    if (!userProfile) return;
    if (userProfile.role !== "conductor") {
      showAlert("error", "Access denied. Conductor role required.");
      router.push("/");
      return;
    }
    fetchData();
  }, [user, userProfile, authLoading, router, fetchData, showAlert]);

  // Enrich trips with related data
  const enrichedTrips = useMemo<AssignedTrip[]>(() => {
    return trips.map(trip => ({
      ...trip,
      route: routes.find(r => r.id === trip.routeId),
      bus: buses.find(b => b.id === trip.busId),
      bookings: bookings.filter(b => b.scheduleId === trip.id),
    }));
  }, [trips, routes, buses, bookings]);

  // Apply filter
  const filteredTrips = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);

    switch (filter) {
      case "upcoming":
        return enrichedTrips.filter(t => t.departureDateTime > now).sort(
          (a, b) => a.departureDateTime.getTime() - b.departureDateTime.getTime()
        );
      case "today":
        return enrichedTrips.filter(t => t.departureDateTime >= todayStart && t.departureDateTime < todayEnd).sort(
          (a, b) => a.departureDateTime.getTime() - b.departureDateTime.getTime()
        );
      case "past":
        return enrichedTrips.filter(t => t.arrivalDateTime < now).sort(
          (a, b) => b.departureDateTime.getTime() - a.departureDateTime.getTime()
        );
      default:
        return enrichedTrips.sort((a, b) => b.departureDateTime.getTime() - a.departureDateTime.getTime());
    }
  }, [enrichedTrips, filter]);

  // Quick stats
  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    return {
      total: enrichedTrips.length,
      today: enrichedTrips.filter(t => t.departureDateTime >= todayStart && t.departureDateTime < todayEnd).length,
      upcoming: enrichedTrips.filter(t => t.departureDateTime > now).length,
      completed: enrichedTrips.filter(t => t.arrivalDateTime < now).length,
    };
  }, [enrichedTrips]);

  const conductorName = `${userProfile?.firstName || ""} ${userProfile?.lastName || ""}`.trim() || userProfile?.name || "Conductor";

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-600 animate-spin mx-auto" />
          <p className="mt-4 text-gray-600">Loading your trips...</p>
        </div>
      </div>
    );
  }

  if (!user || userProfile?.role !== "conductor") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-2xl shadow-lg max-w-md">
          <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">You don't have permission to view this dashboard.</p>
          <button onClick={() => router.push("/login")} className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  const FILTERS: { id: TripFilter; label: string }[] = [
    { id: "upcoming", label: "Upcoming" },
    { id: "today", label: "Today" },
    { id: "past", label: "Past" },
    { id: "all", label: "All" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-gray-900 text-sm">{companyName || "BusBooking"}</h1>
                <p className="text-xs text-gray-500">Conductor Panel</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-purple-50 px-3 py-2 rounded-lg">
                <div className="w-7 h-7 bg-purple-100 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-purple-600" />
                </div>
                <span className="text-sm font-medium text-purple-900">{conductorName}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {alert && (
          <AlertMessage type={alert.type} message={alert.message} onClose={clearAlert} />
        )}

        {/* Welcome */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Trips</h2>
          <p className="text-sm text-gray-500 mt-1">View and manage your assigned trips</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Assigned", value: stats.total, icon: <Calendar className="w-5 h-5 text-gray-400" /> },
            { label: "Today", value: stats.today, icon: <Clock className="w-5 h-5 text-blue-400" /> },
            { label: "Upcoming", value: stats.upcoming, icon: <ChevronRight className="w-5 h-5 text-purple-400" /> },
            { label: "Completed", value: stats.completed, icon: <CheckCircle className="w-5 h-5 text-green-400" /> },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-xl border shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                {stat.icon}
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filter === f.id
                  ? "bg-purple-600 text-white"
                  : "bg-white text-gray-600 border hover:bg-gray-50"
              }`}
            >
              {f.label}
              {f.id === "today" && stats.today > 0 && (
                <span className="ml-2 bg-purple-200 text-purple-800 text-xs px-1.5 py-0.5 rounded-full">
                  {stats.today}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Trip List */}
        {filteredTrips.length === 0 ? (
          <div className="bg-white rounded-xl border shadow-sm px-6 py-16 text-center">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No trips found</p>
            <p className="text-sm text-gray-400 mt-1">
              {filter === "upcoming"
                ? "You have no upcoming trips assigned yet."
                : filter === "today"
                ? "No trips scheduled for today."
                : "No trips match this filter."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTrips.map(trip => (
              <TripCard key={trip.id} trip={trip} onSelect={setSelectedTrip} />
            ))}
          </div>
        )}
      </main>

      {/* Trip Detail Modal */}
      {selectedTrip && (
        <TripDetailPanel trip={selectedTrip} onClose={() => setSelectedTrip(null)} />
      )}
    </div>
  );
}