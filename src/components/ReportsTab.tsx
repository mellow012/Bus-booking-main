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
  ArrowRight
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
    <div className="bg-white rounded-xl shadow-[0_2px_10px_-4_rgba(0,0,0,0.1)] p-5 relative overflow-hidden flex flex-col justify-between min-h-[140px] border border-gray-100">
      <div className="flex justify-between items-start mb-2">
        <div className={`p-2 rounded-lg ${iconBg}`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
      </div>
      <div className="mt-auto">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">{title}</p>
        <p className="text-2xl font-extrabold text-gray-900 leading-none">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-1.5">{subtitle}</p>}
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
    const date  = new Date(dateStr);
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const end   = new Date(start);
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
    const paidBookings       = dayBookings.filter(b => b.paymentStatus === "paid").length;
    const boardedPassengers  = dayBookings.filter(b => b.bookingStatus === "confirmed").length;
    const noShowPassengers   = dayBookings.filter(b => b.bookingStatus === "no-show").length;
    const totalRevenue       = dayBookings
      .filter(b => b.paymentStatus === "paid")
      .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

    const totalSeats        = daySchedules.reduce((sum, s) => {
      const bus = buses.find(b => b.id === s.busId);
      return sum + (bus?.capacity || 0);
    }, 0);
    const bookedSeats       = dayBookings.length;
    const avgOccupancyRate  = totalSeats > 0 ? (bookedSeats / totalSeats) * 100 : 0;

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
      const bus   = buses.find(b => b.id === schedule.busId);
      const paidTotal = scheduleBookings
        .filter(b => b.paymentStatus === "paid")
        .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

      return {
        scheduleId:    schedule.id,
        route:         `${route?.origin || "TBD"} → ${route?.destination || "TBD"}`,
        bus:           bus?.licensePlate || "N/A",
        busType:       bus?.busType || "N/A",
        busCapacity:   bus?.capacity || 0,
        departureTime: toDate(schedule.departureDateTime),
        arrivalTime:   toDate(schedule.arrivalDateTime),
        status:        schedule.status || "unknown",
        bookings: {
          total:   scheduleBookings.length,
          paid:    scheduleBookings.filter(b => b.paymentStatus === "paid").length,
          pending: scheduleBookings.filter(b => b.paymentStatus === "pending").length,
          boarded: scheduleBookings.filter(b => b.bookingStatus === "confirmed").length,
          noShow:  scheduleBookings.filter(b => b.bookingStatus === "no-show").length,
        },
        revenue:       paidTotal,
        occupancyRate: (scheduleBookings.length / (bus?.capacity || 1)) * 100,
        passengers:    scheduleBookings.map(b => ({
          name:          b.passengerDetails?.[0]?.name || "N/A",
          phone:         b.passengerDetails?.[0]?.contactNumber || "N/A",
          seats:         b.seatNumbers?.join(", ") || "N/A",
          amount:        b.totalAmount || 0,
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
        date:                selectedDate,
        companyId,
        totalSchedules:      reportData.totalSchedules,
        completedSchedules:  reportData.completedSchedules,
        totalBookings:       reportData.totalBookings,
        paidBookings:        reportData.paidBookings,
        boardedPassengers:   reportData.boardedPassengers,
        noShowPassengers:    reportData.noShowPassengers,
        totalRevenue:        reportData.totalRevenue,
        avgOccupancyRate:    reportData.avgOccupancyRate,
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
      toast.success("Report generated effectively!");
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

      toast.success("Report downloaded successfully");
    } catch (error: any) {
      setError(`Failed to download report: ${error.message}`);
    }
  }, [setError]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-gray-900 tracking-tight">Daily Operations</h1>
          <p className="text-[13px] text-gray-500 font-medium">Generate and analyze daily performance reports</p>
        </div>
        <div className="flex gap-2">
          <Input 
            type="date" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)} 
            className="w-40 bg-white border-gray-200"
          />
          <button 
            onClick={handleGenerateReport} 
            disabled={generating || daySchedules.length === 0}
            className="bg-indigo-900 hover:bg-indigo-800 text-white px-5 py-2.5 rounded-md text-sm font-semibold transition-colors flex items-center gap-2"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Generate Report
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {daySchedules.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <KineticStatCard
            title="DAILY REVENUE"
            value={`MWK ${fmt(reportData.totalRevenue)}`}
            icon={DollarSign}
            iconBg="bg-blue-50" iconColor="text-indigo-900"
            subtitle={`${reportData.paidBookings} paid bookings today`}
          />
          <KineticStatCard
            title="TOTAL BOOKINGS"
            value={String(reportData.totalBookings)}
            icon={Users}
            iconBg="bg-purple-50" iconColor="text-purple-600"
            subtitle={`${reportData.boardedPassengers} passengers boarded`}
          />
          <KineticStatCard
            title="DAILY SCHEDULES"
            value={String(reportData.totalSchedules)}
            icon={Calendar}
            iconBg="bg-green-50" iconColor="text-green-700"
            subtitle={`${reportData.completedSchedules} completed trips`}
          />
          <KineticStatCard
            title="AVG OCCUPANCY"
            value={`${reportData.avgOccupancyRate.toFixed(1)}%`}
            icon={TrendingUp}
            iconBg="bg-amber-50" iconColor="text-amber-600"
            subtitle="Fill rate across all routes"
          />
        </div>
      )}

      {/* Report Table */}
      {selectedReport ? (
        <div className="bg-white rounded-xl shadow-[0_2px_10px_-4_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <h2 className="text-[16px] font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-900" /> Report Details — {new Date(selectedReport.date).toLocaleDateString()}
            </h2>
            <div className="flex gap-2">
              <button 
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 text-[11px] font-bold rounded border border-gray-200 transition-colors"
              >
                <Printer className="w-3 h-3" /> PRINT
              </button>
              <button 
                onClick={() => handleDownloadReport(selectedReport)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 text-[11px] font-bold rounded border border-green-200 transition-colors"
              >
                <Download className="w-3 h-3" /> EXPORT CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-5 py-3 font-bold text-gray-500 text-[11px] uppercase tracking-wider">Route</th>
                  <th className="px-5 py-3 font-bold text-gray-500 text-[11px] uppercase tracking-wider">Bus</th>
                  <th className="px-5 py-3 font-bold text-gray-500 text-[11px] uppercase tracking-wider">Departure</th>
                  <th className="px-5 py-3 font-bold text-gray-500 text-[11px] uppercase tracking-wider text-center">Bookings</th>
                  <th className="px-5 py-3 font-bold text-gray-500 text-[11px] uppercase tracking-wider text-right">Revenue</th>
                  <th className="px-5 py-3 font-bold text-gray-500 text-[11px] uppercase tracking-wider text-right">Occupancy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {selectedReport.scheduleDetails.map((s, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4 font-bold text-gray-900">{s.route}</td>
                    <td className="px-5 py-4 text-gray-500 font-medium">{s.bus}</td>
                    <td className="px-5 py-4 text-gray-500">{new Date(s.departureTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-bold text-gray-900">{s.bookings.total}</span>
                        <span className="text-[10px] text-gray-400">{s.bookings.boarded} boarded</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-gray-900">MWK {fmt(s.revenue)}</td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-[12px] font-bold text-gray-900">{s.occupancyRate.toFixed(1)}%</span>
                        <div className="w-16 h-1 bg-gray-100 rounded-full mt-1">
                          <div className="h-full bg-indigo-900 rounded-full" style={{ width: `${s.occupancyRate}%` }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-indigo-900 text-white font-bold">
                <tr>
                  <td colSpan={3} className="px-5 py-4">TOTALS</td>
                  <td className="px-5 py-4 text-center">{selectedReport.totalBookings}</td>
                  <td className="px-5 py-4 text-right">MWK {fmt(selectedReport.totalRevenue)}</td>
                  <td className="px-5 py-4 text-right">{selectedReport.avgOccupancyRate.toFixed(1)}%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-[0_2px_10px_-4_rgba(0,0,0,0.1)] border border-gray-100 p-16 text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-8 h-8 text-gray-300" />
          </div>
          <h3 className="text-sm font-bold text-gray-900 mb-1">No Report Selected</h3>
          <p className="text-xs text-gray-500 mb-6">Select a date and click "Generate Report" to see performance metrics.</p>
          <div className="flex justify-center gap-3">
            <div className="text-left bg-gray-50 border border-gray-100 rounded-lg p-3 w-40">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Active Schedules</p>
              <p className="text-lg font-bold text-gray-900">{daySchedules.length}</p>
            </div>
            <div className="text-left bg-gray-50 border border-gray-100 rounded-lg p-3 w-40">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Total Bookings</p>
              <p className="text-lg font-bold text-gray-900">{dayBookings.length}</p>
            </div>
          </div>
        </div>
      )}

      {daySchedules.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <AlertTriangle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
          <p className="text-gray-600">Select a date with schedules to generate a report</p>
        </div>
      )}
    </div>
  );
};

export default DailyReportsTab;
