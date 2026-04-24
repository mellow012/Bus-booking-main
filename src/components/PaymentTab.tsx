"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
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
  Eye, RefreshCw, Truck, BarChart3, Activity, ArrowRight,
  Wallet, Sparkles, MapPin, Calendar, User, Mail, Loader2
} from "lucide-react";

import { Company, Booking, Bus } from "@/types";

interface PaymentsTabProps {
  company: Company;
  paymentSettings: any;
  bookings: Booking[];
  buses?: Bus[];
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
  routeOrigin?: string;
  routeDestination?: string;
  departureTime?: string;
  seats?: number;
  seatNumbers?: string[];
  transactionId?: string;
  bookingStatus?: string;
  passengerDetails?: {
    name: string;
    email: string;
    seatNumber: string;
    age?: number;
    gender?: string;
  }[];
  userId?: string | null;
  busId?: string;
  busLicensePlate?: string;
  scheduleId?: string;
}

interface BusPaymentSummary {
  busId: string;
  licensePlate: string;
  busType: string;
  totalRevenue: number;
  paidRevenue: number;
  pendingRevenue: number;
  transactionCount: number;
  paidCount: number;
  pendingCount: number;
  lastTransaction?: Date;
  status: "active" | "inactive" | "maintenance";
}

type PaymentStatus = "all" | "paid" | "pending" | "failed" | "refunded";
type DateFilter = "all" | "today" | "week" | "month" | "custom";
type ViewMode = "overview" | "by-bus";

const toDate = (v: any): Date => {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  return new Date(v);
};

const fmtTime = (timeStr: string | undefined): string => timeStr || "—";

// ─── Sub-components ────────────────────────────────────────────────────────────

function KineticStatCard({ title, value, icon: Icon, iconBg, iconColor, subtitle }: {
  title: string;
  value: string;
  icon: any;
  iconBg: string;
  iconColor: string;
  subtitle?: string;
}) {
  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl shadow-[0_8px_30px_-10px_rgba(0,0,0,0.05)] p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between min-h-[120px] sm:min-h-[140px] border border-gray-100 group hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] transition-all duration-500 text-left">
      <div className="absolute -right-8 -top-8 w-24 h-24 bg-indigo-600/5 rounded-full blur-3xl group-hover:bg-indigo-600/10 transition-colors"></div>
      <div className="flex justify-between items-start mb-3 sm:mb-4 relative z-10">
        <div className={`p-2.5 rounded-2xl ${iconBg} shadow-sm border border-white/50 group-hover:scale-110 transition-transform duration-500`}>
          <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${iconColor}`} />
        </div>
      </div>
      <div className="relative z-10">
        <p className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{title}</p>
        <p className="text-xl sm:text-2xl font-black text-gray-900 leading-none tracking-tight">{value}</p>
        {subtitle && <p className="text-[10px] sm:text-[11px] font-bold text-gray-400 mt-2 flex items-center gap-1.5"><Sparkles className="w-3 h-3 text-indigo-400" /> {subtitle}</p>}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

const PaymentsTab: React.FC<PaymentsTabProps> = ({
  company,
  paymentSettings,
  bookings,
  buses = [],
  setError,
  setSuccess,
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<PaymentStatus>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [selectedBusId, setSelectedBusId] = useState<string>("");

  const busLookup = useMemo(() => {
    const m = new Map<string, { licensePlate: string; busType: string; status: string }>();
    buses.forEach(b => m.set(b.id, { licensePlate: b.licensePlate, busType: b.busType, status: b.status }));
    return m;
  }, [buses]);

  const scheduleCache = useRef<Map<string, {
    busId: string;
    origin: string;
    destination: string;
    departureTime: string;
  }>>(new Map());

  const processedBookingHash = useRef<string>("");

  const rebuildTransactions = () => {
    const enriched: Transaction[] = bookings.map(b => {
      const firstPassenger = b.passengerDetails?.[0] || {};
      const sched = scheduleCache.current.get(b.scheduleId);
      const busInfo = sched ? busLookup.get(sched.busId) : undefined;
      const origin = sched?.origin || "";
      const destination = sched?.destination || "";
      return {
        id: b.id,
        bookingReference: b.bookingReference || "N/A",
        totalAmount: b.totalAmount || 0,
        bookingDate: toDate(b.bookingDate || b.createdAt),
        paymentStatus: b.paymentStatus || "pending",
        paymentMethod: b.paymentMethod || "Not specified",
        customerName: firstPassenger.name || "N/A",
        customerEmail: b.contactEmail || "N/A",
        routeOrigin: origin,
        routeDestination: destination,
        route: origin && destination ? `${origin} → ${destination}` : "N/A",
        departureTime: sched?.departureTime || "",
        seats: b.seatNumbers?.length || 0,
        seatNumbers: b.seatNumbers || [],
        transactionId: b.transactionReference || b.transactionId || "N/A",
        bookingStatus: b.bookingStatus || "pending",
        passengerDetails: b.passengerDetails || [],
        userId: b.userId || null,
        busId: sched?.busId || "",
        busLicensePlate: busInfo?.licensePlate || (sched?.busId ? "Loading…" : "N/A"),
        scheduleId: b.scheduleId,
      } as Transaction;
    });
    enriched.sort((a, b) => b.bookingDate.getTime() - a.bookingDate.getTime());
    setTransactions(enriched);
    setFilteredTransactions(enriched);
    setLoading(false);
  };

  useEffect(() => {
    if (!company.id || bookings.length === 0) {
      setTransactions([]);
      setFilteredTransactions([]);
      setLoading(false);
      return;
    }
    const currentHash = bookings.map(b => b.id).sort().join(",");
    if (currentHash === processedBookingHash.current) {
      rebuildTransactions();
      return;
    }
    processedBookingHash.current = currentHash;
    const run = async () => {
      setLoading(true);
      try {
        const missingIds = new Set<string>();
        bookings.forEach(b => {
          if (b.scheduleId && !scheduleCache.current.has(b.scheduleId))
            missingIds.add(b.scheduleId);
        });
        if (missingIds.size > 0) {
          const ids = [...missingIds];
          const chunks: string[][] = [];
          for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
          await Promise.all(chunks.map(async chunk => {
            const { data, error: fetchError } = await supabase
              .from('Schedule')
              .select('*, Route(*)')
              .in('id', chunk);
            if (!fetchError && data) {
              data.forEach(d => {
                scheduleCache.current.set(d.id, {
                  busId: d.busId || "",
                  origin: (d as any).Route?.origin || d.departureLocation || "",
                  destination: (d as any).Route?.destination || d.arrivalLocation || "",
                  departureTime: d.departureDateTime ? new Date(d.departureDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "",
                });
              });
            }
          }));
        }
        rebuildTransactions();
      } catch (err: any) {
        setError(err.message || "Failed to load payment data");
      } finally { setLoading(false); }
    };
    run();
  }, [company.id, bookings]);

  const busPaymentSummaries = useMemo<BusPaymentSummary[]>(() => {
    const map = new Map<string, BusPaymentSummary>();
    buses.forEach(bus => {
      map.set(bus.id, {
        busId: bus.id,
        licensePlate: bus.licensePlate,
        busType: bus.busType,
        totalRevenue: 0,
        paidRevenue: 0,
        pendingRevenue: 0,
        transactionCount: 0,
        paidCount: 0,
        pendingCount: 0,
        status: bus.status as any,
      });
    });
    transactions.forEach(t => {
      if (!t.busId) return;
      let s = map.get(t.busId);
      if (!s) return;
      s.totalRevenue += t.totalAmount;
      s.transactionCount += 1;
      if (t.paymentStatus === "paid") { s.paidRevenue += t.totalAmount; s.paidCount++; }
      if (t.paymentStatus === "pending") { s.pendingRevenue += t.totalAmount; s.pendingCount++; }
    });
    return Array.from(map.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [transactions, buses]);

  useEffect(() => {
    let filtered = [...transactions];
    if (viewMode === "by-bus" && selectedBusId)
      filtered = filtered.filter(t => t.busId === selectedBusId);
    if (statusFilter !== "all")
      filtered = filtered.filter(t => t.paymentStatus.toLowerCase() === statusFilter);
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      filtered = filtered.filter(t =>
        t.bookingReference.toLowerCase().includes(s) ||
        t.customerName?.toLowerCase().includes(s) ||
        t.transactionId?.toLowerCase().includes(s)
      );
    }
    setFilteredTransactions(filtered);
  }, [transactions, statusFilter, searchTerm, viewMode, selectedBusId]);

  const stats = useMemo(() => ({
    total: filteredTransactions.reduce((s, t) => s + t.totalAmount, 0),
    paid: filteredTransactions.filter(t => t.paymentStatus === "paid").reduce((s, t) => s + t.totalAmount, 0),
    pending: filteredTransactions.filter(t => t.paymentStatus === "pending").reduce((s, t) => s + t.totalAmount, 0),
    count: filteredTransactions.length,
    activeBuses: busPaymentSummaries.filter(b => b.status === "active").length,
  }), [filteredTransactions, busPaymentSummaries]);

  const exportToCSV = () => {
    const headers = ["Reference", "Customer", "Amount", "Date", "Status", "Method"];
    const rows = filteredTransactions.map(t => [
      t.bookingReference, t.customerName, t.totalAmount, t.bookingDate.toLocaleDateString(), t.paymentStatus, t.paymentMethod
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `payments-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    setSuccess("Export complete.");
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      paid: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      pending: 'bg-amber-50 text-amber-700 border-amber-100',
      failed: 'bg-rose-50 text-rose-700 border-rose-100',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border shadow-sm ${map[status.toLowerCase()] || 'bg-slate-50 text-slate-600 border-slate-100'}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 pb-12 px-2 sm:px-0 text-left">

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <KineticStatCard
          title="TOTAL VOLUME"
          value={`MWK ${(stats.total / 1000).toFixed(0)}K`}
          icon={TrendingUp}
          iconBg="bg-indigo-50" iconColor="text-indigo-600"
          subtitle={`${stats.count} Gross Transactions`}
        />
        <KineticStatCard
          title="SETTLED EQUITY"
          value={`MWK ${(stats.paid / 1000).toFixed(0)}K`}
          icon={CheckCircle}
          iconBg="bg-emerald-50" iconColor="text-emerald-600"
          subtitle="Cleared revenue"
        />
        <KineticStatCard
          title="PENDING SYNC"
          value={`MWK ${(stats.pending / 1000).toFixed(0)}K`}
          icon={Clock}
          iconBg="bg-amber-50" iconColor="text-amber-600"
          subtitle="Awaiting authorization"
        />
        <KineticStatCard
          title="ACTIVE FLEET"
          value={String(stats.activeBuses)}
          icon={Truck}
          iconBg="bg-purple-50" iconColor="text-purple-600"
          subtitle="Contributing vessels"
        />
      </div>

      {/* Controls */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto flex-1 max-w-4xl">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by reference, passenger or transaction id..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-600 focus:bg-white outline-none text-xs font-bold text-gray-700 transition-all"
              />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
              className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-[10px] font-black text-gray-700 outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all uppercase tracking-widest">
              <option value="all">All States</option>
              <option value="paid">Settled</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <button onClick={exportToCSV}
            className="w-full lg:w-auto flex items-center justify-center gap-2 px-6 py-4 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest border border-indigo-100 transition-all active:scale-95">
            <Download className="w-4 h-4" /> Export Ledger
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-[2.5rem] shadow-[0_8px_30px_-10px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50/20">
                {["Transaction Ref", "Beneficiary Identity", "Manifest Corridor", "Equity Value", "Method", "Date", "Status", "Control"].map(h => (
                  <th key={h} className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-8 py-24 text-center">
                    <p className="text-[11px] font-black text-gray-300 uppercase tracking-widest">No financial records identified</p>
                  </td>
                </tr>
              ) : filteredTransactions.map(t => (
                <tr key={t.id} className="hover:bg-indigo-50/20 transition-all duration-300 group">
                  <td className="px-8 py-6">
                    <span className="font-mono text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100">
                      {t.bookingReference}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center text-[10px] font-black text-slate-400 border border-slate-100 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        {t.customerName?.substring(0, 1)}
                      </div>
                      <div>
                        <p className="text-sm font-black text-gray-900 uppercase tracking-tight">{t.customerName}</p>
                        <p className="text-[9px] font-bold text-gray-400 lowercase">{t.customerEmail}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2 text-xs font-black text-gray-700 uppercase tracking-tight">
                      {t.routeOrigin} <ArrowRight className="w-3 h-3 text-gray-300" /> {t.routeDestination}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <p className="text-sm font-black text-gray-900 tracking-tight">MWK {t.totalAmount.toLocaleString()}</p>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">{t.paymentMethod}</span>
                  </td>
                  <td className="px-8 py-6">
                    <p className="text-[10px] font-black text-gray-900 uppercase tracking-widest">{t.bookingDate.toLocaleDateString('en-GB')}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{t.bookingDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </td>
                  <td className="px-8 py-6">
                    {getStatusBadge(t.paymentStatus)}
                  </td>
                  <td className="px-8 py-6">
                    <button onClick={() => setSelectedTransaction(t)}
                      className="p-2.5 bg-gray-50 hover:bg-indigo-600 hover:text-white rounded-xl text-gray-400 transition-all active:scale-95 border border-gray-100">
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-300 text-left">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-[2.5rem] rounded-t-[2.5rem] max-h-[90vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom-10 duration-500">
            <div className="p-6 sm:p-8 border-b border-gray-50 flex items-start justify-between">
              <div>
                <p className="text-xl font-black text-gray-900 tracking-tight uppercase">TRANSACTION LEDGER</p>
                <p className="text-[10px] font-black text-gray-400 tracking-widest mt-1">REF: {selectedTransaction.bookingReference}</p>
              </div>
              <button onClick={() => setSelectedTransaction(null)} className="p-2.5 bg-gray-50 hover:bg-gray-100 rounded-2xl text-gray-400 transition-colors"><XCircle className="w-5 h-5" /></button>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              <div className="p-5 bg-indigo-50/50 rounded-[2rem] border border-indigo-100">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">MANIFEST VALUE</p>
                  {getStatusBadge(selectedTransaction.paymentStatus)}
                </div>
                <p className="text-3xl font-black text-gray-900 tracking-tighter">MWK {selectedTransaction.totalAmount.toLocaleString()}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">CORRIDOR</p>
                  <p className="text-xs font-black text-gray-900 uppercase truncate">{selectedTransaction.routeOrigin} → {selectedTransaction.routeDestination}</p>
                </div>
                <div className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">METHOD</p>
                  <p className="text-xs font-black text-gray-900 uppercase">{selectedTransaction.paymentMethod}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-gray-300" />
                  <div>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">CLIENT</p>
                    <p className="text-sm font-black text-gray-900 uppercase">{selectedTransaction.customerName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-gray-300" />
                  <div>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">DIGITAL CONTACT</p>
                    <p className="text-sm font-black text-gray-900 lowercase">{selectedTransaction.customerEmail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Truck className="w-4 h-4 text-gray-300" />
                  <div>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">ASSIGNED VESSEL</p>
                    <p className="text-sm font-black text-gray-900 uppercase">{selectedTransaction.busLicensePlate}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8 border-t border-gray-50">
              <button onClick={() => setSelectedTransaction(null)}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 active:scale-95 transition-all">
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentsTab;
