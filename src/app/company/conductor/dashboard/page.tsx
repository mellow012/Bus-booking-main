"use client";

import { FC, useState, useEffect, useMemo } from "react";
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { useAuth } from "@/contexts/AuthContext";
import { Schedule, Booking, Bus } from "@/types";
import {
  Bus as BusIcon,
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  DollarSign,
  Bell,
  ArrowRight,
  Check,
  UserX,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Modal from "@/components/Modals";
import { format } from "date-fns";
import { toast } from "react-hot-toast";

const ConductorDashboard: FC = () => {
  const { userProfile, user } = useAuth();
  const authUid = user?.uid;
  const conductorName = userProfile?.name || `${userProfile?.firstName || ""} ${userProfile?.lastName || ""}`.trim() || "Conductor";

  const [myBuses, setMyBuses] = useState<Bus[]>([]);
  const [myTrips, setMyTrips] = useState<Schedule[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<Schedule | null>(null);
  const [tripBookings, setTripBookings] = useState<Booking[]>([]);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conductorFirestoreId, setConductorFirestoreId] = useState<string | null>(null);

  // ✅ Step 1: Fetch conductor document to get Firestore doc ID
  useEffect(() => {
    if (!authUid) {
      setError("No conductor authentication found – please log in again");
      setLoading(false);
      return;
    }

    const fetchConductorId = async () => {
      try {
        const operatorsRef = collection(db, "operators");
        const q = query(
          operatorsRef,
          where("uid", "==", authUid),
          where("role", "==", "conductor")
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          setError("Conductor profile not found. Please contact support.");
          setLoading(false);
          return;
        }

        const conductorDoc = snapshot.docs[0];
        const conductorData = conductorDoc.data();
        const firestoreId = conductorData.id || conductorDoc.id;

        setConductorFirestoreId(firestoreId);
      } catch (err: any) {
        setError(`Failed to load conductor profile: ${err.message}`);
        setLoading(false);
      }
    };

    fetchConductorId();
  }, [authUid]);

  // ✅ Step 2: Query buses using Firestore doc ID
  useEffect(() => {
    if (!conductorFirestoreId) return;

    try {
      const q = query(
        collection(db, "buses"),
        where("conductorIds", "array-contains", conductorFirestoreId),
        where("status", "==", "active")
      );

      const unsub = onSnapshot(
        q,
        (snap) => {
          const buses = snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Bus[];

          setMyBuses(buses);
          setError(null);
        },
        (err: any) => {
          setError(`Failed to load your buses: ${err.message}`);
          setMyBuses([]);
        }
      );

      return () => unsub();
    } catch (err: any) {
      setError("Error setting up bus query");
    }
  }, [conductorFirestoreId]);

  // ✅ Step 3: Fetch schedules for those buses
  useEffect(() => {
    if (myBuses.length === 0) {
      setMyTrips([]);
      setLoading(false);
      return;
    }

    const busIds = myBuses.map(b => b.id);

    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const nextWeekEnd = new Date(todayStart);
      nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);

      const fetchSchedules = async () => {
        const allTrips: Schedule[] = [];

        for (const busId of busIds) {
          try {
            const q = query(
              collection(db, "schedules"),
              where("busId", "==", busId)
            );

            const snap = await getDocs(q);

            const trips = snap.docs.map(doc => {
              const data = doc.data();
              const depDate = data.departureDateTime?.toDate?.() || new Date(data.departureDateTime);
              
              return {
                id: doc.id,
                ...data,
                departureDateTime: depDate,
                arrivalDateTime: data.arrivalDateTime?.toDate?.() || new Date(data.arrivalDateTime),
              } as Schedule;
            });

            // Filter by date range
            const filteredTrips = trips.filter(trip => {
              const depDate = trip.departureDateTime instanceof Date 
                ? trip.departureDateTime 
                : new Date(trip.departureDateTime);
              const isInRange = depDate >= todayStart && depDate < nextWeekEnd;
              const isActive = trip.status === "active";
              return isInRange && isActive;
            });

            allTrips.push(...filteredTrips);
          } catch (err: any) {
            console.error(`Error fetching schedules for bus ${busId}:`, err);
          }
        }

        // Sort by departure time
        allTrips.sort((a, b) => {
          const aDate = a.departureDateTime instanceof Date ? a.departureDateTime : new Date(a.departureDateTime);
          const bDate = b.departureDateTime instanceof Date ? b.departureDateTime : new Date(b.departureDateTime);
          return aDate.getTime() - bDate.getTime();
        });

        setMyTrips(allTrips);
        setLoading(false);
      };

      fetchSchedules();
    } catch (err: any) {
      setError("Failed to load trips");
      setLoading(false);
    }
  }, [myBuses]);

  // ✅ Load bookings for selected trip
  useEffect(() => {
    if (!selectedTrip?.id) {
      setTripBookings([]);
      return;
    }

    try {
      const q = query(
        collection(db, "bookings"),
        where("scheduleId", "==", selectedTrip.id)
      );

      let initialLoad = true;

      const unsub = onSnapshot(
        q,
        (snap) => {
          const bookings = snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.() || new Date(),
          })) as Booking[];

          if (!initialLoad) {
            const newBookings = bookings.filter(
              b => !tripBookings.some(prev => prev.id === b.id)
            );
            newBookings.forEach(b => {
              const name = b.passengerDetails?.[0]?.name || "Passenger";
              const seat = b.seatNumbers?.[0] || "?";
              toast(`New booking: ${name} • Seat ${seat}`, {
                icon: <Bell className="w-5 h-5 text-blue-600" />,
                duration: 6000,
              });
              setNotifications(prev => [`New booking: ${name}`, ...prev.slice(0, 4)]);
            });
          }

          setTripBookings(bookings);
          initialLoad = false;
        },
        err => {
          setError("Failed to load manifest");
        }
      );

      return () => unsub();
    } catch (err: any) {
      setError("Failed to load bookings");
    }
  }, [selectedTrip?.id]);

  // ✅ Boarding / No-show (only after payment confirmed)
  const handleUpdateStatus = async (bookingId: string, status: "boarded" | "no-show") => {
    if (!selectedTrip) return;

    setActionLoading(true);
    try {
      const ref = doc(db, "bookings", bookingId);
      await updateDoc(ref, {
        bookingStatus: status,
        updatedAt: new Date(),
        updatedBy: conductorFirestoreId,
      });

      setTripBookings(prev =>
        prev.map(b => b.id === bookingId ? { ...b, bookingStatus: status } : b)
      );

      toast.success(`Marked as ${status}`);
    } catch (err: any) {
      console.error("Status update error:", err);
      toast.error(`Failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // ✅ Cash collection
  const handleCollectCash = async (bookingId: string, amount: number) => {
    if (!selectedTrip) return;

    if (!confirm(`Collect MWK ${amount.toLocaleString()} cash?`)) return;

    setActionLoading(true);
    try {
      const ref = doc(db, "bookings", bookingId);
      await updateDoc(ref, {
        paymentStatus: "paid",
        paymentMethod: "cash_on_boarding",
        paidAmount: amount,
        paidAt: new Date(),
        paidBy: conductorFirestoreId,
        updatedAt: new Date(),
      });

      setTripBookings(prev =>
        prev.map(b =>
          b.id === bookingId 
            ? { ...b, paymentStatus: "paid", paymentMethod: "cash_on_boarding" } 
            : b
        )
      );

      toast.success(`MWK ${amount.toLocaleString()} recorded`);
    } catch (err: any) {
      console.error("Cash collection error:", err);
      toast.error(`Failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // ✅ Seat map
  const renderSeatMap = () => {
    if (!selectedTrip || !myBuses.length) return null;

    const bus = myBuses.find(b => b.id === selectedTrip.busId);
    if (!bus?.capacity) return null;

    const seatsPerRow = 4;

    return (
      <div className="mt-6">
        <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
          <BusIcon className="w-5 h-5" />
          Seat Map ({bus.capacity} seats)
        </h3>

        <div className="bg-gray-50 p-6 rounded-xl border">
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${seatsPerRow}, 1fr)` }}>
            {Array.from({ length: bus.capacity }).map((_, i) => {
              const seatNum = (i + 1).toString();
              const booking = tripBookings.find(b => b.seatNumbers?.includes(seatNum));

              let bg = "bg-gray-200 border border-gray-300";
              let text = "text-gray-700";
              let icon = null;

              if (booking) {
                if (booking.bookingStatus === "boarded") {
                  bg = "bg-green-500 border-green-600";
                  text = "text-white";
                  icon = <CheckCircle className="w-4 h-4" />;
                } else if (booking.bookingStatus === "no-show") {
                  bg = "bg-red-500 border-red-600";
                  text = "text-white";
                  icon = <XCircle className="w-4 h-4" />;
                } else {
                  bg = "bg-blue-500 border-blue-600";
                  text = "text-white";
                }
              }

              return (
                <div
                  key={seatNum}
                  className={`aspect-square rounded-lg flex items-center justify-center font-medium text-sm relative cursor-pointer hover:scale-105 transition-transform ${bg} ${text}`}
                  onClick={() => {
                    if (booking && booking.bookingStatus === "pending" && booking.paymentStatus === "paid") {
                      handleUpdateStatus(booking.id, "boarded");
                    }
                  }}
                >
                  {seatNum}
                  {icon && (
                    <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow">
                      {icon}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap gap-4 justify-center text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-200 rounded border border-gray-300" /> Available
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded border border-blue-600" /> Booked
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded border border-green-600" /> Boarded
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded border border-red-600" /> No-Show
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading your assignments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Welcome, {conductorName}</h1>
          <p className="text-gray-600 mt-2">Your assigned trips & passenger manifest</p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-red-900">Error</h3>
              <p className="text-sm text-red-800 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Notifications */}
        {notifications.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="w-5 h-5 text-amber-600" />
              <h3 className="font-medium text-amber-800">Recent Updates</h3>
            </div>
            <ul className="text-sm text-amber-800 space-y-1">
              {notifications.map((msg, i) => (
                <li key={i}>• {msg}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Assigned Buses */}
        {myBuses.length > 0 && (
          <section className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <BusIcon className="w-5 h-5 text-blue-600" />
              Assigned Buses ({myBuses.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {myBuses.map(bus => (
                <div key={bus.id} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="font-semibold text-blue-900 text-lg">{bus.licensePlate}</p>
                  <div className="text-sm text-blue-700 mt-2 space-y-1">
                    <p>Type: {bus.busType}</p>
                    <p>Capacity: {bus.capacity} seats</p>
                    {bus.amenities && bus.amenities.length > 0 && (
                      <p>Amenities: {bus.amenities.join(", ")}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Trips */}
        <section>
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-600" />
            Your Trips (Next 7 Days)
          </h2>

          {myTrips.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center border shadow-sm">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-xl font-medium text-gray-700">No trips assigned yet</p>
              <p className="text-gray-500 mt-2">
                {myBuses.length === 0 
                  ? "You haven't been assigned to any buses yet"
                  : "No active schedules for the next 7 days"}
              </p>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {myTrips.map((trip) => {
                const bus = myBuses.find(b => b.id === trip.busId);
                const departure = trip.departureDateTime instanceof Date
                  ? trip.departureDateTime
                  : new Date(trip.departureDateTime);

                const booked = (trip.bookedSeats?.length || 0);

                return (
                  <div
                    key={trip.id}
                    className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden"
                    onClick={() => setSelectedTrip(trip)}
                  >
                    <div className="p-5">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg text-gray-900 line-clamp-1">
                            {trip.departureLocation || "TBD"} → {trip.arrivalLocation || "TBD"}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1 flex items-center gap-1.5">
                            <MapPin className="w-4 h-4" />
                            {trip.departureLocation || "N/A"} → {trip.arrivalLocation || "N/A"}
                          </p>
                        </div>
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium whitespace-nowrap">
                          {format(departure, "MMM d")}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-500" />
                          <span>{format(departure, "HH:mm")}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <BusIcon className="w-4 h-4 text-gray-500" />
                          <span className="truncate">{bus?.licensePlate || "N/A"}</span>
                        </div>
                      </div>

                      <div className="mt-5 pt-4 border-t flex justify-between items-center">
                        <div className="flex items-center gap-2 text-sm">
                          <Users className="w-4 h-4 text-blue-600" />
                          <span>{booked} booked</span>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-blue-700 border-blue-200 hover:bg-blue-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTrip(trip);
                          }}
                        >
                          View Manifest
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Manifest Modal */}
        <Modal
          isOpen={!!selectedTrip}
          onClose={() => setSelectedTrip(null)}
          title={`Manifest: ${selectedTrip?.departureLocation || "Trip"} → ${selectedTrip?.arrivalLocation || "Destination"}`}
        >
          {selectedTrip && (
            <div className="space-y-6">
              {/* Trip Info */}
              <div className="p-4 bg-gray-50 rounded-lg border">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Bus</p>
                    <p className="font-medium">
                      {myBuses.find(b => b.id === selectedTrip.busId)?.licensePlate || "N/A"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-600">Departure</p>
                    <p className="font-medium">
                      {format(
                        selectedTrip.departureDateTime instanceof Date
                          ? selectedTrip.departureDateTime
                          : new Date(selectedTrip.departureDateTime),
                        "PPp"
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Seat Map */}
              {renderSeatMap()}

              {/* Passenger Manifest */}
              <div>
                <h3 className="font-semibold text-lg mb-3 flex items-center justify-between">
                  <span>Passenger Manifest</span>
                  <span className="text-sm text-gray-600">
                    {tripBookings.length} booked • {tripBookings.filter(b => b.paymentStatus === "paid").length} paid
                  </span>
                </h3>

                {tripBookings.length === 0 ? (
                  <div className="text-center py-10 bg-gray-50 rounded-lg border">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600">No passengers booked yet</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                    {tripBookings.map((booking) => {
                      const isPaid = booking.paymentStatus === "paid";
                      const isBoarded = booking.bookingStatus === "boarded";
                      const isNoShow = booking.bookingStatus === "no-show";
                      const isPending = booking.bookingStatus === "pending";
                      const firstPassenger = booking.passengerDetails?.[0];

                      return (
                        <div
                          key={booking.id}
                          className={`p-4 rounded-lg border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                            isBoarded 
                              ? "bg-green-50 border-green-200"
                              : isNoShow 
                              ? "bg-red-50 border-red-200"
                              : "bg-white hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-start gap-4 flex-1">
                            <div
                              className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-white text-lg flex-shrink-0 ${
                                isBoarded 
                                  ? "bg-green-600"
                                  : isNoShow 
                                  ? "bg-red-600"
                                  : "bg-blue-600"
                              }`}
                            >
                              {booking.seatNumbers?.[0] || "?"}
                            </div>

                            <div>
                              <p className="font-medium text-base flex items-center gap-1">
                                {firstPassenger?.name || "Passenger"}
                                {isBoarded && <CheckCircle className="w-4 h-4 text-green-600" />}
                                {isNoShow && <XCircle className="w-4 h-4 text-red-600" />}
                              </p>
                              <div className="text-sm text-gray-600 mt-1 space-y-0.5">
                                <p>{booking.contactPhone || "No contact"}</p>
                                <p className="text-xs text-gray-500">
                                  MWK {booking.totalAmount?.toLocaleString() || "?"}
                                </p>
                                <p className="text-xs">
                                  {isPaid ? (
                                    <span className="text-green-700 font-medium">✓ Paid</span>
                                  ) : (
                                    <span className="text-amber-700 font-medium">💳 Pending Payment</span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 self-end md:self-center">
                            {/* ✅ NEW: Show Boarded/No-Show ONLY if paid */}
                            {isPaid && !isBoarded && !isNoShow && (
                              <>
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                  onClick={() => handleUpdateStatus(booking.id, "boarded")}
                                  disabled={actionLoading}
                                >
                                  <Check className="w-4 h-4 mr-1" />
                                  Boarded
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleUpdateStatus(booking.id, "no-show")}
                                  disabled={actionLoading}
                                >
                                  <UserX className="w-4 h-4 mr-1" />
                                  No-Show
                                </Button>
                              </>
                            )}

                            {/* ✅ SHOW: Collect Cash ONLY if payment pending */}
                            {!isPaid && (
                              <Button
                                size="sm"
                                className="bg-amber-600 hover:bg-amber-700 text-white"
                                onClick={() => handleCollectCash(booking.id, booking.totalAmount || 0)}
                                disabled={actionLoading}
                              >
                                <DollarSign className="w-4 h-4 mr-1" />
                                Collect Cash
                              </Button>
                            )}

                            {/* ✅ Show lock icon if payment not done */}
                            {!isPaid && (
                              <div className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 bg-gray-100 rounded-md">
                                <Lock className="w-3 h-3" />
                                <span>Actions locked until payment</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setSelectedTrip(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
};

export default ConductorDashboard;