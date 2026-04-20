// src/components/ReportsTab.tsx
"use client";

import { FC, useState, useMemo, useCallback } from "react";
import { Schedule, Booking, Bus, Route } from "@/types";
import {
  FileText,
  Download,
  Calendar,
  Loader2,
  AlertTriangle,
  TrendingUp,
  Users,
  DollarSign,
  Printer,
  ChevronRight,
  BarChart3,
  ArrowRight,
  Zap,
  Sparkles,
  Search,
  CheckCircle2,
  Activity,
  PieChart,
  BusIcon
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "react-hot-toast";

// ─── Helpers ───────────────────────────────────────────────────────────────────

const toDate = (v: unknown): Date => {
  if (v == null) return new Date();
  if (v instanceof Date) return v;
  const a = v as any;
  if (typeof a.toDate === "function") return a.toDate() as Date;
  if (typeof a === "string" || typeof a === "number") return new Date(a);
  return new Date();
};

const fmt = (n: number) => n.toLocaleString("en-MW");

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
    <div className="bg-white rounded-3xl shadow-[0_8px_30px_-10px_rgba(0,0,0,0.05)] p-6 relative overflow-hidden flex flex-col justify-between min-h-[160px] border border-gray-100 group hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] transition-all duration-500 text-left">
      <div className="absolute -right-8 -top-8 w-24 h-24 bg-indigo-600/5 rounded-full blur-3xl group-hover:bg-indigo-600/10 transition-colors"></div>

      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className={`p-3 rounded-2xl ${iconBg} shadow-sm border border-white/50 group-hover:scale-110 transition-transform duration-500`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
      </div>
      <div className="relative z-10">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">{title}</p>
        <p className="text-3xl font-black text-gray-900 leading-none tracking-tight">{value}</p>
        {subtitle && <p className="text-[11px] font-bold text-gray-400 mt-2 flex items-center gap-1.5"><Sparkles className="w-3 h-3 text-indigo-400" /> {subtitle}</p>}
      </div>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DailyReportsTabProps {
  schedules: Schedule[];
  bookings: Booking[];
  buses: Bus[];
  routes: Route[];
  companyId: string;
  user: any;
  userProfile: any;
  setError: (error: string) => void;
  setSuccess: (success: string) => void;
}

interface DailyReport {
  id: string;
  date: Date;
  companyId: string;
  createdBy: string;
  createdByName: string;
  totalSchedules: number;
  completedSchedules: number;
  totalBookings: number;
  paidBookings: number;
  boardedPassengers: number;
  noShowPassengers: number;
  totalRevenue: number;
  avgOccupancyRate: number;
  scheduleDetails: any[];
  generatedAt: Date;
}

// ─── Component ────────────────────────────────────────────────────────────────

const DailyReportsTab: FC<DailyReportsTabProps> = ({
  schedules,
  bookings,
  buses,
  routes,
  companyId,
  userProfile,
  setError,
  setSuccess,
}) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedReport, setSelectedReport] = useState<DailyReport | null>(null);
  const [generating, setGenerating] = useState(false);

  const getDateRange = (dateStr: string) => {
    const date = new Date(dateStr);
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  };

  const daySchedules = useMemo(() => {
    const { start, end } = getDateRange(selectedDate);
    return schedules.filter(s => {
      const depDate = toDate(s.departureDateTime);
      return depDate >= start && depDate < end;
    });
  }, [schedules, selectedDate]);

  const dayBookings = useMemo(() => {
    return bookings.filter(b => daySchedules.some(s => s.id === b.scheduleId));
  }, [bookings, daySchedules]);

  const reportData = useMemo(() => {
    const completedSchedules = daySchedules.filter(s => s.status === "completed").length;
    const paidBookings = dayBookings.filter(b => b.paymentStatus === "paid").length;
    const boardedPassengers = dayBookings.filter(b => b.bookingStatus === "confirmed").length;
    const noShowPassengers = dayBookings.filter(b => b.bookingStatus === "no-show").length;
    const totalRevenue = dayBookings
      .filter(b => b.paymentStatus === "paid")
      .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

    const totalSeats = daySchedules.reduce((sum, s) => {
      const bus = buses.find(b => b.id === s.busId);
      return sum + (bus?.capacity || 0);
    }, 0);
    const bookedSeats = dayBookings.length;
    const avgOccupancyRate = totalSeats > 0 ? (bookedSeats / totalSeats) * 100 : 0;

    return {
      totalSchedules: daySchedules.length,
      completedSchedules,
      totalBookings: dayBookings.length,
      paidBookings,
      boardedPassengers,
      noShowPassengers,
      totalRevenue,
      avgOccupancyRate,
    };
  }, [daySchedules, dayBookings, buses]);

  const generateScheduleDetails = useCallback(() => {
    return daySchedules.map(schedule => {
      const scheduleBookings = dayBookings.filter(b => b.scheduleId === schedule.id);
      const route = routes.find(r => r.id === schedule.routeId);
      const bus = buses.find(b => b.id === schedule.busId);
      const paidTotal = scheduleBookings
        .filter(b => b.paymentStatus === "paid")
        .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

      return {
        scheduleId: schedule.id,
        route: `${route?.origin || "TBD"} → ${route?.destination || "TBD"}`,
        bus: bus?.licensePlate || "N/A",
        busType: bus?.busType || "N/A",
        busCapacity: bus?.capacity || 0,
        departureTime: toDate(schedule.departureDateTime),
        arrivalTime: toDate(schedule.arrivalDateTime),
        status: schedule.status || "unknown",
        bookings: {
          total: scheduleBookings.length,
          paid: scheduleBookings.filter(b => b.paymentStatus === "paid").length,
          pending: scheduleBookings.filter(b => b.paymentStatus === "pending").length,
          boarded: scheduleBookings.filter(b => b.bookingStatus === "confirmed").length,
          noShow: scheduleBookings.filter(b => b.bookingStatus === "no-show").length,
        },
        revenue: paidTotal,
        occupancyRate: (scheduleBookings.length / (bus?.capacity || 1)) * 100,
        passengers: scheduleBookings.map(b => ({
          name: b.passengerDetails?.[0]?.name || "N/A",
          phone: b.passengerDetails?.[0]?.contactNumber || "N/A",
          seats: b.seatNumbers?.join(", ") || "N/A",
          amount: b.totalAmount || 0,
          paymentStatus: b.paymentStatus,
          bookingStatus: b.bookingStatus,
        })),
      };
    });
  }, [daySchedules, dayBookings, routes, buses]);

  const handleGenerateReport = useCallback(async () => {
    if (daySchedules.length === 0) {
      toast.error("No schedules for selected date");
      return;
    }

    setGenerating(true);
    try {
      const scheduleDetails = generateScheduleDetails();

      const payload = {
        date: selectedDate,
        companyId,
        totalSchedules: reportData.totalSchedules,
        completedSchedules: reportData.completedSchedules,
        totalBookings: reportData.totalBookings,
        paidBookings: reportData.paidBookings,
        boardedPassengers: reportData.boardedPassengers,
        noShowPassengers: reportData.noShowPassengers,
        totalRevenue: reportData.totalRevenue,
        avgOccupancyRate: reportData.avgOccupancyRate,
        scheduleDetails,
      };

      const res = await fetch("/api/reports/daily/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to persist report");
      }

      const json = await res.json();

      const report: DailyReport = {
        ...json.report,
        date: new Date(json.report.date),
        generatedAt: new Date(),
        scheduleDetails: json.report.reportData || scheduleDetails,
      };

      setSelectedReport(report);
      toast.success("Intelligence report generated!");
      setSuccess("Report generated and saved!");
    } catch (error: any) {
      console.error("Error generating report:", error);
      setError(`Failed to generate report: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  }, [selectedDate, daySchedules, reportData, companyId, generateScheduleDetails, setError, setSuccess]);

  const handleDownloadReport = useCallback((report: DailyReport) => {
    try {
      let csv = "Daily Operations Report\n";
      csv += `Date: ${new Date(report.date).toLocaleDateString()}\n`;
      csv += `Generated At: ${new Date(report.generatedAt).toLocaleString()}\n\n`;

      csv += "SUMMARY\n";
      csv += `Total Schedules,${report.totalSchedules}\n`;
      csv += `Completed Schedules,${report.completedSchedules}\n`;
      csv += `Total Bookings,${report.totalBookings}\n`;
      csv += `Paid Bookings,${report.paidBookings}\n`;
      csv += `Boarded Passengers,${report.boardedPassengers}\n`;
      csv += `No-Show Passengers,${report.noShowPassengers}\n`;
      csv += `Total Revenue,MWK ${report.totalRevenue.toLocaleString()}\n`;
      csv += `Average Occupancy Rate,${report.avgOccupancyRate.toFixed(2)}%\n\n`;

      csv += "SCHEDULES DETAIL\n";
      csv += "Route,Bus,Capacity,Departure,Status,Total Bookings,Paid,Boarded,No-Show,Revenue,Occupancy\n";
      report.scheduleDetails.forEach(s => {
        csv += `"${s.route}","${s.bus}",${s.busCapacity},`;
        csv += `${new Date(s.departureTime).toLocaleString()},${s.status},`;
        csv += `${s.bookings.total},${s.bookings.paid},${s.bookings.boarded},`;
        csv += `${s.bookings.noShow},${s.revenue},${s.occupancyRate.toFixed(2)}%\n`;
      });

      const el = document.createElement("a");
      el.setAttribute("href", "data:text/csv;charset=utf-8," + encodeURIComponent(csv));
      el.setAttribute("download", `daily_report_${new Date(report.date).toISOString().split("T")[0]}.csv`);
      el.style.display = "none";
      document.body.appendChild(el);
      el.click();
      document.body.removeChild(el);

      toast.success("CSV export dispatched");
    } catch (error: any) {
      setError(`Failed to download report: ${error.message}`);
    }
  }, [setError]);

  return (
    <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-[1600px] mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3 uppercase">
            YIELD INTELLIGENCE
            <Activity className="w-5 h-5 text-indigo-600" />
          </h1>
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mt-1.5 flex items-center gap-2">
            Performance analytics & daily operational audit
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Calendar className="w-4 h-4 text-indigo-400 absolute left-4 top-1/2 -translate-y-1/2 group-hover:scale-110 transition-transform" />
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-11 pr-4 py-6 bg-white border-gray-100 rounded-2xl text-[13px] font-bold text-gray-700 focus:ring-2 focus:ring-indigo-600 focus:bg-white outline-none transition-all shadow-sm w-44"
            />
          </div>
          <button
            onClick={handleGenerateReport}
            disabled={generating || daySchedules.length === 0}
            className="group bg-indigo-600 text-white px-8 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-3"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />}
            Generate Intelligence
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {daySchedules.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <KineticStatCard
            title="DAILY REVENUE"
            value={`MWK ${fmt(reportData.totalRevenue)}`}
            icon={DollarSign}
            iconBg="bg-indigo-50" iconColor="text-indigo-600"
            subtitle={`${reportData.paidBookings} paid bookings today`}
          />
          <KineticStatCard
            title="TOTAL BOOKINGS"
            value={String(reportData.totalBookings)}
            icon={Users}
            iconBg="bg-emerald-50" iconColor="text-emerald-600"
            subtitle={`${reportData.boardedPassengers} passengers boarded`}
          />
          <KineticStatCard
            title="DAILY SCHEDULES"
            value={String(reportData.totalSchedules)}
            icon={Calendar}
            iconBg="bg-amber-50" iconColor="text-amber-600"
            subtitle={`${reportData.completedSchedules} completed trips`}
          />
          <KineticStatCard
            title="AVG OCCUPANCY"
            value={`${reportData.avgOccupancyRate.toFixed(1)}%`}
            icon={PieChart}
            iconBg="bg-rose-50" iconColor="text-rose-600"
            subtitle="Fleet fill rate metrics"
          />
        </div>
      )}

      {/* Report Table */}
      {selectedReport ? (
        <div className="bg-white rounded-[2.5rem] shadow-[0_8px_30px_-10px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden text-left">
          <div className="flex items-center justify-between p-8 border-b border-gray-50">
            <div>
              <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-600" /> Operational Audit — {new Date(selectedReport.date).toLocaleDateString()}
              </h2>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Granular vessel performance breakdown</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-5 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 text-[10px] font-black uppercase tracking-widest rounded-xl border border-gray-100 transition-all active:scale-95"
              >
                <Printer className="w-3.5 h-3.5" /> PRINT
              </button>
              <button
                onClick={() => handleDownloadReport(selectedReport)}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 text-[10px] font-black uppercase tracking-widest rounded-xl border border-indigo-100 transition-all active:scale-95"
              >
                <Download className="w-3.5 h-3.5" /> EXPORT CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/30">
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Route Corridor</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Vessel</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Departure</th>
                  <th className="px-8 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Volume</th>
                  <th className="px-8 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Equity</th>
                  <th className="px-8 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Saturation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {selectedReport.scheduleDetails.map((s, idx) => (
                  <tr key={idx} className="hover:bg-indigo-50/20 transition-all duration-300 group">
                    <td className="px-8 py-6">
                      <p className="text-sm font-black text-gray-900 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">{s.route}</p>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">EN-MW REGIONAL</p>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2.5">
                        <BusIcon className="w-4 h-4 text-indigo-300" />
                        <span className="text-xs font-black text-gray-600 uppercase tracking-widest">{s.bus} <span className="text-[9px] text-gray-400">• {s.busType}</span></span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-gray-900">{new Date(s.departureTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">{s.status}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-sm font-black text-gray-900 tracking-tight">{s.bookings.total}</span>
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{s.bookings.boarded} boarded</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right font-black text-gray-900 text-sm tracking-tight">MWK {fmt(s.revenue)}</td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-xs font-black text-gray-900 mb-2">{s.occupancyRate.toFixed(1)}%</span>
                        <div className="w-24 h-1.5 bg-gray-50 rounded-full border border-gray-100 overflow-hidden">
                          <div className={`h-full transition-all duration-1000 ${s.occupancyRate > 80 ? 'bg-rose-500' : 'bg-indigo-600'}`} style={{ width: `${s.occupancyRate}%` }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-indigo-900 text-white font-black uppercase tracking-widest text-[11px]">
                <tr>
                  <td colSpan={3} className="px-8 py-6">AGGREGATED DAILY METRICS</td>
                  <td className="px-8 py-6 text-center">{selectedReport.totalBookings} UNITS</td>
                  <td className="px-8 py-6 text-right">MWK {fmt(selectedReport.totalRevenue)}</td>
                  <td className="px-8 py-6 text-right">{selectedReport.avgOccupancyRate.toFixed(1)}% SATURATION</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[2.5rem] shadow-[0_8px_30px_-10px_rgba(0,0,0,0.05)] border border-gray-100 p-24 text-center text-left">
          <div className="w-20 h-20 bg-gray-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 border border-gray-50">
            <BarChart3 className="w-8 h-8 text-gray-200" />
          </div>
          <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-2">Audit Pipeline Empty</h3>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-8 max-w-xs mx-auto leading-relaxed">Select a temporal window and execute intelligence generation to view metrics.</p>
          <div className="flex justify-center gap-4">
            <div className="text-left bg-gray-50 border border-gray-100 rounded-3xl p-6 w-48 group hover:bg-white hover:shadow-xl hover:shadow-indigo-50 transition-all duration-500">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 group-hover:text-indigo-400 transition-colors">Manifest Active</p>
              <p className="text-2xl font-black text-gray-900 tracking-tighter">{daySchedules.length} TRIPS</p>
            </div>
            <div className="text-left bg-gray-50 border border-gray-100 rounded-3xl p-6 w-48 group hover:bg-white hover:shadow-xl hover:shadow-emerald-50 transition-all duration-500">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 group-hover:text-emerald-400 transition-colors">Volume Pending</p>
              <p className="text-2xl font-black text-gray-900 tracking-tighter">{dayBookings.length} BOK</p>
            </div>
          </div>
        </div>
      )}

      {daySchedules.length === 0 && (
        <div className="bg-rose-50 rounded-[2.5rem] border border-rose-100 p-16 text-center">
          <AlertTriangle className="w-12 h-12 text-rose-300 mx-auto mb-4" />
          <h3 className="text-xs font-black text-rose-900 uppercase tracking-widest mb-2">Data Nullify</h3>
          <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">No scheduled operations detected for the selected period.</p>
        </div>
      )}
    </div>
  );
};

export default DailyReportsTab;
