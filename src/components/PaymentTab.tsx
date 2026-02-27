"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/Label";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from "@/components/ui/table";
import {
  DollarSign, Download, Filter, Search, CreditCard,
  TrendingUp, Clock, CheckCircle, XCircle, AlertCircle,
  Eye, RefreshCw, Truck, BarChart3, Activity
} from "lucide-react";

interface PaymentsTabProps {
  company:         { id: string; [key: string]: any };
  paymentSettings: any;
  bookings:        any[];
  buses?:          any[];
  setError:        (msg: string) => void;
  setSuccess:      (msg: string) => void;
}

interface Transaction {
  id:               string;
  bookingReference: string;
  totalAmount:      number;
  bookingDate:      Date;
  paymentStatus:    string;
  paymentMethod?:   string;
  customerName?:    string;
  customerEmail?:   string;
  route?:           string;
  routeOrigin?:     string;
  routeDestination?:string;
  departureTime?:   string;
  seats?:           number;
  seatNumbers?:     string[];
  transactionId?:   string;
  bookingStatus?:   string;
  passengerDetails?:any[];
  userId?:          string | null;
  busId?:           string;
  busLicensePlate?: string;
  scheduleId?:      string;
}

interface BusPaymentSummary {
  busId:            string;
  licensePlate:     string;
  busType:          string;
  totalRevenue:     number;
  paidRevenue:      number;
  pendingRevenue:   number;
  transactionCount: number;
  paidCount:        number;
  pendingCount:     number;
  lastTransaction?: Date;
  status:           "active" | "inactive" | "maintenance";
}

type PaymentStatus = "all" | "paid" | "pending" | "failed" | "refunded";
type DateFilter    = "all" | "today" | "week" | "month" | "custom";
type ViewMode      = "overview" | "by-bus";

const toDate = (v: any): Date => {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  if (v?.toDate) return v.toDate();
  if (v?.seconds) return new Date(v.seconds * 1000);
  return new Date(v);
};

const fmtTime = (timeStr: string | undefined): string => timeStr || "—";

const PaymentsTab: React.FC<PaymentsTabProps> = ({
  company,
  paymentSettings,
  bookings,
  buses = [],
  setError,
  setSuccess,
}) => {
  const [transactions,         setTransactions]         = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [loading,              setLoading]              = useState(true);
  const [searchTerm,           setSearchTerm]           = useState("");
  const [statusFilter,         setStatusFilter]         = useState<PaymentStatus>("all");
  const [dateFilter,           setDateFilter]           = useState<DateFilter>("all");
  const [customStartDate,      setCustomStartDate]      = useState("");
  const [customEndDate,        setCustomEndDate]        = useState("");
  const [selectedTransaction,  setSelectedTransaction]  = useState<Transaction | null>(null);
  const [showFilters,          setShowFilters]          = useState(false);
  const [viewMode,             setViewMode]             = useState<ViewMode>("overview");
  const [selectedBusId,        setSelectedBusId]        = useState<string>("");

  // ── Bus lookup from prop (stable map, no reads) ───────────────────────────
  const busLookup = useMemo(() => {
    const m = new Map<string, { licensePlate: string; busType: string; status: string }>();
    buses.forEach(b => m.set(b.id, { licensePlate: b.licensePlate, busType: b.busType, status: b.status }));
    return m;
  }, [buses]);

  // ── Schedule cache — populated once, never re-fetched ────────────────────
  // Using a ref so updates don't trigger re-renders or re-runs of the effect
  const scheduleCache = useRef<Map<string, {
    busId:       string;
    origin:      string;
    destination: string;
    departureTime: string;
  }>>(new Map());

  // ── Stable set of booking IDs we've already processed ────────────────────
  // Prevents re-processing the same bookings list on every parent re-render
  const processedBookingHash = useRef<string>("");

  // ── FIXED: Main data transform ───────────────────────────────────────────
  // Key fixes vs old version:
  //   1. Removed `where("companyId", "==", company.id)` from the schedules
  //      query — Firestore does NOT support combining `__name__ in [...]`
  //      with other where clauses. That was silently returning 0 docs → all N/A.
  //   2. Added processedBookingHash ref so this only re-runs when the actual
  //      set of booking IDs changes, not on every render cycle (stops glitching).
  useEffect(() => {
    if (!company.id || bookings.length === 0) {
      setTransactions([]);
      setFilteredTransactions([]);
      setLoading(false);
      return;
    }

    // Build a hash of current booking IDs to detect real changes
    const currentHash = bookings.map(b => b.id).sort().join(",");
    if (currentHash === processedBookingHash.current) {
      // Same bookings — just rebuild from existing cache (no Firestore reads)
      rebuildTransactions();
      return;
    }
    processedBookingHash.current = currentHash;

    const run = async () => {
      setLoading(true);
      try {
        // Collect schedule IDs not yet in cache
        const missingIds = new Set<string>();
        bookings.forEach(b => {
          if (b.scheduleId && !scheduleCache.current.has(b.scheduleId))
            missingIds.add(b.scheduleId);
        });

        // Fetch missing schedules in chunks of 30 (Firestore `in` limit)
        // NOTE: fetch by __name__ only — no extra where() clauses
        if (missingIds.size > 0) {
          const ids = [...missingIds];
          const chunks: string[][] = [];
          for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));

          await Promise.all(chunks.map(async chunk => {
            const snap = await getDocs(
              query(collection(db, "schedules"), where("__name__", "in", chunk))
              // ↑ No companyId filter here — that's what caused all the N/A values
            );
            snap.docs.forEach(d => {
              const data = d.data();
              scheduleCache.current.set(d.id, {
                busId:       data.busId || "",
                origin:      data.origin || data.departureLocation || "",
                destination: data.destination || data.arrivalLocation || "",
                departureTime: data.departureTime || "",
              });
            });
          }));
        }

        rebuildTransactions();
      } catch (err: any) {
        setError(err.message || "Failed to load payment data");
        console.error("PaymentsTab fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id, bookings]);   // ← only real deps; busLookup is stable

  // ── Pure rebuild from in-memory caches (zero reads) ──────────────────────
  const rebuildTransactions = () => {
    const enriched: Transaction[] = bookings.map(b => {
      const firstPassenger = b.passengerDetails?.[0] || {};
      const sched          = scheduleCache.current.get(b.scheduleId);
      const busInfo        = sched ? busLookup.get(sched.busId) : undefined;

      const origin      = sched?.origin      || "";
      const destination = sched?.destination || "";

      return {
        id:               b.id,
        bookingReference: b.bookingReference || "N/A",
        totalAmount:      b.totalAmount      || 0,
        bookingDate:      toDate(b.bookingDate || b.createdAt),
        paymentStatus:    b.paymentStatus    || "pending",
        paymentMethod:    b.paymentMethod    || "Not specified",
        customerName:     firstPassenger.name || b.contactName || "N/A",
        customerEmail:    b.customerEmail    || firstPassenger.email || "N/A",
        routeOrigin:      origin,
        routeDestination: destination,
        route:            origin && destination ? `${origin} → ${destination}` : "N/A",
        departureTime:    sched?.departureTime || "",
        seats:            b.seatNumbers?.length || 0,
        seatNumbers:      b.seatNumbers || [],
        transactionId:    b.transactionReference || b.transactionId || "N/A",
        bookingStatus:    b.bookingStatus    || "pending",
        passengerDetails: b.passengerDetails || [],
        userId:           b.userId           || null,
        busId:            sched?.busId       || "",
        busLicensePlate:  busInfo?.licensePlate || (sched?.busId ? "Loading…" : "N/A"),
        scheduleId:       b.scheduleId,
      } as Transaction;
    });

    enriched.sort((a, b) => b.bookingDate.getTime() - a.bookingDate.getTime());
    setTransactions(enriched);
    setFilteredTransactions(enriched);
    setLoading(false);
  };

  // ── Per-bus summaries ─────────────────────────────────────────────────────
  const busPaymentSummaries = useMemo<BusPaymentSummary[]>(() => {
    const map = new Map<string, BusPaymentSummary>();

    // Seed with all known buses
    buses.forEach(bus => {
      map.set(bus.id, {
        busId:            bus.id,
        licensePlate:     bus.licensePlate,
        busType:          bus.busType,
        totalRevenue:     0,
        paidRevenue:      0,
        pendingRevenue:   0,
        transactionCount: 0,
        paidCount:        0,
        pendingCount:     0,
        status:           bus.status,
      });
    });

    transactions.forEach(t => {
      if (!t.busId) return;
      let s = map.get(t.busId);
      if (!s) {
        const bi = busLookup.get(t.busId);
        s = {
          busId:            t.busId,
          licensePlate:     bi?.licensePlate || t.busLicensePlate || "Unknown",
          busType:          bi?.busType      || "Unknown",
          totalRevenue:     0,
          paidRevenue:      0,
          pendingRevenue:   0,
          transactionCount: 0,
          paidCount:        0,
          pendingCount:     0,
          status:           (bi?.status as any) || "inactive",
        };
        map.set(t.busId, s);
      }
      s.totalRevenue     += t.totalAmount;
      s.transactionCount += 1;
      if (t.paymentStatus === "paid")    { s.paidRevenue    += t.totalAmount; s.paidCount++;    }
      if (t.paymentStatus === "pending") { s.pendingRevenue += t.totalAmount; s.pendingCount++; }
      if (!s.lastTransaction || t.bookingDate > s.lastTransaction)
        s.lastTransaction = t.bookingDate;
    });

    return Array.from(map.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [transactions, buses, busLookup]);

  // ── Client-side filters ───────────────────────────────────────────────────
  useEffect(() => {
    let filtered = [...transactions];

    if (viewMode === "by-bus" && selectedBusId)
      filtered = filtered.filter(t => t.busId === selectedBusId);

    if (statusFilter !== "all")
      filtered = filtered.filter(t => t.paymentStatus.toLowerCase() === statusFilter);

    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (dateFilter === "today") {
      filtered = filtered.filter(t => t.bookingDate >= today);
    } else if (dateFilter === "week") {
      const ago = new Date(today); ago.setDate(ago.getDate() - 7);
      filtered = filtered.filter(t => t.bookingDate >= ago);
    } else if (dateFilter === "month") {
      const ago = new Date(today); ago.setMonth(ago.getMonth() - 1);
      filtered = filtered.filter(t => t.bookingDate >= ago);
    } else if (dateFilter === "custom" && customStartDate && customEndDate) {
      const start = new Date(customStartDate);
      const end   = new Date(customEndDate); end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(t => t.bookingDate >= start && t.bookingDate <= end);
    }

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      filtered = filtered.filter(t =>
        t.bookingReference.toLowerCase().includes(s) ||
        t.customerName?.toLowerCase().includes(s) ||
        t.customerEmail?.toLowerCase().includes(s) ||
        t.transactionId?.toLowerCase().includes(s) ||
        t.busLicensePlate?.toLowerCase().includes(s) ||
        t.route?.toLowerCase().includes(s)
      );
    }

    setFilteredTransactions(filtered);
  }, [transactions, statusFilter, dateFilter, customStartDate, customEndDate, searchTerm, viewMode, selectedBusId]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:           filteredTransactions.reduce((s, t) => s + t.totalAmount, 0),
    paid:            filteredTransactions.filter(t => t.paymentStatus === "paid").reduce((s, t) => s + t.totalAmount, 0),
    pending:         filteredTransactions.filter(t => t.paymentStatus === "pending").reduce((s, t) => s + t.totalAmount, 0),
    count:           filteredTransactions.length,
    paidCount:       filteredTransactions.filter(t => t.paymentStatus === "paid").length,
    activeBuses:     busPaymentSummaries.filter(b => b.status === "active").length,
    topPerformingBus:busPaymentSummaries[0] || null,
  }), [filteredTransactions, busPaymentSummaries]);

  // ── CSV export ────────────────────────────────────────────────────────────
  const exportToCSV = () => {
    const headers = ["Reference", "Customer", "Bus", "From", "To", "Amount", "Date", "Status", "Method", "TxID"];
    const rows = filteredTransactions.map(t => [
      t.bookingReference, t.customerName, t.busLicensePlate,
      t.routeOrigin, t.routeDestination,
      t.totalAmount, t.bookingDate.toLocaleDateString(),
      t.paymentStatus, t.paymentMethod, t.transactionId,
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `payments-${viewMode}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    setSuccess("Report exported successfully");
  };

  // ── Badge helpers ─────────────────────────────────────────────────────────
  const getStatusBadge = (status: string) => {
    const cfg: Record<string, { bg: string; text: string; Icon: any }> = {
      paid:     { bg: "bg-green-100",  text: "text-green-800",  Icon: CheckCircle },
      pending:  { bg: "bg-yellow-100", text: "text-yellow-800", Icon: Clock },
      failed:   { bg: "bg-red-100",    text: "text-red-800",    Icon: XCircle },
      refunded: { bg: "bg-gray-100",   text: "text-gray-800",   Icon: RefreshCw },
    };
    const { bg, text, Icon } = cfg[status?.toLowerCase()] || cfg.pending;
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
        <Icon className="w-3 h-3 mr-1" />{status?.charAt(0).toUpperCase() + status?.slice(1)}
      </span>
    );
  };

  const getMethodBadge = (method?: string) => {
    const cfg: Record<string, { bg: string; text: string }> = {
      "airtel money":  { bg: "bg-red-100",    text: "text-red-800" },
      "tnm mpamba":    { bg: "bg-blue-100",   text: "text-blue-800" },
      "card":          { bg: "bg-purple-100", text: "text-purple-800" },
      "stripe":        { bg: "bg-purple-100", text: "text-purple-800" },
      "paychangu":     { bg: "bg-blue-100",   text: "text-blue-800" },
      "cash_on_boarding": { bg: "bg-orange-100", text: "text-orange-800" },
    };
    const key = method?.toLowerCase() || "";
    const { bg, text } = cfg[key] || { bg: "bg-gray-100", text: "text-gray-800" };
    return <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${bg} ${text}`}>{method || "Unknown"}</span>;
  };

  // ── Route display helper ──────────────────────────────────────────────────
  const RouteSegment = ({ origin, destination }: { origin?: string; destination?: string }) => {
    if (!origin && !destination) return <span className="text-gray-400 text-xs">Route not available</span>;
    return (
      <div className="flex items-center gap-1 text-xs">
        <span className="font-medium text-gray-900">{origin || "—"}</span>
        <span className="text-gray-400">→</span>
        <span className="font-medium text-gray-900">{destination || "—"}</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="h-8 bg-gray-200 animate-pulse rounded w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {Array(4).fill(0).map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 animate-pulse rounded-lg" />
          ))}
        </div>
        <div className="h-96 bg-gray-200 animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <DollarSign className="w-8 h-8 text-blue-600" />Payment Management
          </h3>
          <p className="text-gray-600 mt-1">Track and manage all payment transactions</p>
        </div>
        <Button onClick={exportToCSV} variant="outline" className="gap-2">
          <Download className="w-4 h-4" />Export Report
        </Button>
      </div>

      {/* View mode tabs */}
      <div className="bg-white rounded-lg border p-2 inline-flex gap-2">
        <button onClick={() => { setViewMode("overview"); setSelectedBusId(""); }}
          className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${viewMode === "overview" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
          <BarChart3 className="w-4 h-4" />Overall View
        </button>
        <button onClick={() => setViewMode("by-bus")}
          className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${viewMode === "by-bus" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
          <Truck className="w-4 h-4" />By Bus
        </button>
      </div>

      {/* Stats */}
      {viewMode === "overview" ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Revenue</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">MWK {stats.total.toLocaleString()}</p>
                <p className="text-xs text-blue-600 mt-1">{stats.activeBuses} active buses</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Paid Amount</p>
                <p className="text-2xl font-bold text-green-900 mt-1">MWK {stats.paid.toLocaleString()}</p>
                <p className="text-xs text-green-600 mt-1">{stats.paidCount} transactions</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-6 border border-yellow-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-900 mt-1">MWK {stats.pending.toLocaleString()}</p>
                <p className="text-xs text-yellow-600 mt-1">{stats.count - stats.paidCount} pending</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Top Performer</p>
                <p className="text-lg font-bold text-purple-900 mt-1 truncate">
                  {stats.topPerformingBus?.licensePlate || "N/A"}
                </p>
                <p className="text-xs text-purple-600 mt-1">
                  MWK {stats.topPerformingBus?.totalRevenue.toLocaleString() || "0"}
                </p>
              </div>
              <Activity className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg border p-4">
            <Label htmlFor="busSelect" className="text-sm font-medium text-gray-700 mb-2 block">
              Select Bus to View Payments
            </Label>
            <select id="busSelect" value={selectedBusId} onChange={e => setSelectedBusId(e.target.value)}
              className="w-full md:w-96 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              <option value="">All Buses</option>
              {busPaymentSummaries.map(b => (
                <option key={b.busId} value={b.busId}>
                  {b.licensePlate} — MWK {b.totalRevenue.toLocaleString()}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {busPaymentSummaries.map(bs => (
              <div key={bs.busId}
                className={`bg-white rounded-xl border-2 transition-all cursor-pointer ${selectedBusId === bs.busId ? "border-blue-500 shadow-lg" : "border-gray-200 hover:border-blue-300 hover:shadow-md"}`}
                onClick={() => setSelectedBusId(bs.busId)}>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Truck className="w-5 h-5 text-blue-600" />
                        <h4 className="text-lg font-bold text-gray-900">{bs.licensePlate}</h4>
                      </div>
                      <p className="text-sm text-gray-600">{bs.busType}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${bs.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                      {bs.status}
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div>
                        <p className="text-xs text-blue-600 font-medium">Total Revenue</p>
                        <p className="text-xl font-bold text-blue-900 mt-0.5">MWK {bs.totalRevenue.toLocaleString()}</p>
                      </div>
                      <DollarSign className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-green-50 rounded-lg">
                        <p className="text-xs text-green-600 font-medium">Paid</p>
                        <p className="text-lg font-bold text-green-900 mt-0.5">MWK {bs.paidRevenue.toLocaleString()}</p>
                        <p className="text-xs text-green-600 mt-1">{bs.paidCount} txn</p>
                      </div>
                      <div className="p-3 bg-yellow-50 rounded-lg">
                        <p className="text-xs text-yellow-600 font-medium">Pending</p>
                        <p className="text-lg font-bold text-yellow-900 mt-0.5">MWK {bs.pendingRevenue.toLocaleString()}</p>
                        <p className="text-xs text-yellow-600 mt-1">{bs.pendingCount} txn</p>
                      </div>
                    </div>
                    {bs.lastTransaction && (
                      <div className="pt-3 border-t">
                        <p className="text-xs text-gray-500">Last transaction</p>
                        <p className="text-sm text-gray-900 font-medium mt-1">
                          {bs.lastTransaction.toLocaleDateString("en-GB")}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {busPaymentSummaries.length === 0 && (
              <div className="col-span-full text-center py-12 bg-white rounded-lg border">
                <Truck className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">No bus payment data available</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-gray-900 flex items-center gap-2">
            <Filter className="w-5 h-5" />Filters
          </h4>
          <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)}>
            {showFilters ? "Hide" : "Show"} Filters
          </Button>
        </div>
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
            <div>
              <Label htmlFor="search">Search</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input id="search" placeholder="Reference, name, route, bus…"
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
              </div>
            </div>
            <div>
              <Label htmlFor="status">Payment Status</Label>
              <select id="status" value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as PaymentStatus)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="all">All Status</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
            <div>
              <Label htmlFor="dateFilter">Date Range</Label>
              <select id="dateFilter" value={dateFilter}
                onChange={e => setDateFilter(e.target.value as DateFilter)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button variant="outline" className="w-full" onClick={() => {
                setSearchTerm(""); setStatusFilter("all"); setDateFilter("all");
                setCustomStartDate(""); setCustomEndDate("");
              }}>
                Clear Filters
              </Button>
            </div>
            {dateFilter === "custom" && (
              <>
                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input id="startDate" type="date" value={customStartDate}
                    onChange={e => setCustomStartDate(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="endDate">End Date</Label>
                  <Input id="endDate" type="date" value={customEndDate}
                    onChange={e => setCustomEndDate(e.target.value)} className="mt-1" />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Transactions table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-semibold">Reference</TableHead>
                <TableHead className="font-semibold">Customer</TableHead>
                {viewMode === "overview" && <TableHead className="font-semibold">Bus</TableHead>}
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
                  <TableCell colSpan={viewMode === "overview" ? 9 : 8} className="text-center py-12">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No transactions found</p>
                    <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
                  </TableCell>
                </TableRow>
              ) : filteredTransactions.map(t => (
                <TableRow key={t.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium text-blue-600 whitespace-nowrap">
                    {t.bookingReference}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-gray-900">{t.customerName}</p>
                    <p className="text-xs text-gray-500">{t.customerEmail}</p>
                  </TableCell>
                  {viewMode === "overview" && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900">{t.busLicensePlate}</span>
                      </div>
                    </TableCell>
                  )}
                  <TableCell>
                    <RouteSegment origin={t.routeOrigin} destination={t.routeDestination} />
                    <p className="text-xs text-gray-400 mt-0.5">
                      {t.seatNumbers?.length ? `Seats: ${t.seatNumbers.join(", ")}` : `${t.seats} seat(s)`}
                    </p>
                  </TableCell>
                  <TableCell className="font-semibold text-gray-900 whitespace-nowrap">
                    MWK {t.totalAmount.toLocaleString()}
                  </TableCell>
                  <TableCell>{getMethodBadge(t.paymentMethod)}</TableCell>
                  <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                    {t.bookingDate.toLocaleDateString("en-GB")}
                    <br />
                    <span className="text-xs text-gray-400">
                      {t.bookingDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </TableCell>
                  <TableCell>{getStatusBadge(t.paymentStatus)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm"
                      onClick={() => setSelectedTransaction(t)} className="gap-1">
                      <Eye className="w-4 h-4" />View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Transaction detail modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">Transaction Details</h3>
                <button onClick={() => setSelectedTransaction(null)}
                  className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {/* Journey */}
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="flex items-center gap-4">
                  <div className="text-center flex-1">
                    <p className="text-lg font-bold text-gray-900">{selectedTransaction.routeOrigin || "—"}</p>
                    <p className="text-xs text-gray-500 mt-1">{fmtTime(selectedTransaction.departureTime)}</p>
                  </div>
                  <div className="flex flex-col items-center flex-2 px-2">
                    <div className="w-full flex items-center gap-1">
                      <div className="flex-1 border-t-2 border-dashed border-blue-300" />
                      <Truck className="w-5 h-5 text-blue-500" />
                      <div className="flex-1 border-t-2 border-dashed border-blue-300" />
                    </div>
                    <p className="text-xs text-blue-600 mt-1">{selectedTransaction.busLicensePlate}</p>
                  </div>
                  <div className="text-center flex-1">
                    <p className="text-lg font-bold text-gray-900">{selectedTransaction.routeDestination || "—"}</p>
                    <p className="text-xs text-gray-500 mt-1">Arrival</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {([
                  ["Booking Reference", selectedTransaction.bookingReference],
                  ["Transaction ID",    selectedTransaction.transactionId],
                  ["Bus",              selectedTransaction.busLicensePlate],
                  ["Customer Name",    selectedTransaction.customerName],
                  ["Customer Email",   selectedTransaction.customerEmail],
                  ["Seat Numbers",     selectedTransaction.seatNumbers?.join(", ") || "N/A"],
                  ["Amount",          `MWK ${selectedTransaction.totalAmount.toLocaleString()}`],
                  ["Booking Date",     selectedTransaction.bookingDate.toLocaleString("en-GB")],
                  ["Booking Status",   selectedTransaction.bookingStatus || "N/A"],
                ] as [string, string][]).map(([label, value]) => (
                  <div key={label}>
                    <p className="text-sm font-medium text-gray-600">{label}</p>
                    <p className="text-gray-900 font-semibold">{value}</p>
                  </div>
                ))}
                <div>
                  <p className="text-sm font-medium text-gray-600">Payment Method</p>
                  <div className="mt-1">{getMethodBadge(selectedTransaction.paymentMethod)}</div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Payment Status</p>
                  <div className="mt-1">{getStatusBadge(selectedTransaction.paymentStatus)}</div>
                </div>
              </div>

              {selectedTransaction.passengerDetails && selectedTransaction.passengerDetails.length > 0 && (
                <div className="pt-4 border-t">
                  <h4 className="font-semibold text-gray-900 mb-3">Passenger Details</h4>
                  <div className="space-y-2">
                    {selectedTransaction.passengerDetails.map((p: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div>
                          <p className="font-medium text-gray-900">{p.name || "N/A"}</p>
                          <p className="text-sm text-gray-600">
                            {p.gender ? p.gender.charAt(0).toUpperCase() + p.gender.slice(1) : ""}
                            {p.age ? `, ${p.age} years` : ""}
                          </p>
                        </div>
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium">
                          Seat {p.seatNumber || "N/A"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setSelectedTransaction(null)}>Close</Button>
              {selectedTransaction.paymentStatus === "paid" && (
                <Button className="bg-blue-600 hover:bg-blue-700">Download Receipt</Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentsTab;