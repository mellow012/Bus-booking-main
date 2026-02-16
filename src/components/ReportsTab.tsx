"use client";

import { FC, useState, useMemo, useCallback } from "react";
import { collection, query, where, getDocs, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { useAuth } from "@/contexts/AuthContext";
import { Schedule, Booking, Bus, Route } from "@/types";
import {
  FileText,
  Download,
  Calendar,
  Loader2,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Users,
  DollarSign,
  Bus as BusIcon,
  MapPin,
  Clock,
  Eye,
  Share2,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "react-hot-toast";

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

const DailyReportsTab: FC<DailyReportsTabProps> = ({
  schedules,
  bookings,
  buses,
  routes,
  companyId,
  user,
  userProfile,
  setError,
  setSuccess,
}) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [generatedReports, setGeneratedReports] = useState<DailyReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Format date for filtering
  const getDateRange = (dateStr: string) => {
    const date = new Date(dateStr);
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  };

  // Filter schedules and bookings for selected date
  const daySchedules = useMemo(() => {
    const { start, end } = getDateRange(selectedDate);
    return schedules.filter(s => {
      const depDate = s.departureDateTime instanceof Date ? s.departureDateTime : new Date(s.departureDateTime);
      return depDate >= start && depDate < end;
    });
  }, [schedules, selectedDate]);

  const dayBookings = useMemo(() => {
    return bookings.filter(b => daySchedules.some(s => s.id === b.scheduleId));
  }, [bookings, daySchedules]);

  // Calculate report statistics
  const reportData = useMemo(() => {
    const completedSchedules = daySchedules.filter(s => s.completed || s.status === "completed").length;
    const paidBookings = dayBookings.filter(b => b.paymentStatus === "paid").length;
    // ✅ Changed 'boarded' to 'confirmed' (valid booking status)
    const boardedPassengers = dayBookings.filter(b => b.bookingStatus === "confirmed").length;
    const noShowPassengers = dayBookings.filter(b => b.bookingStatus === "no-show").length;
    const totalRevenue = dayBookings
      .filter(b => b.paymentStatus === "paid")
      .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

    const totalSeats = daySchedules.reduce((sum, s) => sum + (s.availableSeats || 0), 0);
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
  }, [daySchedules, dayBookings]);

  // Generate detailed schedule information
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
        departureTime: schedule.departureDateTime instanceof Date
          ? schedule.departureDateTime
          : new Date(schedule.departureDateTime),
        arrivalTime: schedule.arrivalDateTime instanceof Date
          ? schedule.arrivalDateTime
          : new Date(schedule.arrivalDateTime),
        status: schedule.status || "unknown",
        bookings: {
          total: scheduleBookings.length,
          paid: scheduleBookings.filter(b => b.paymentStatus === "paid").length,
          pending: scheduleBookings.filter(b => b.paymentStatus === "pending").length,
          // ✅ Changed 'boarded' to 'confirmed'
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

  // Generate report
  const handleGenerateReport = useCallback(async () => {
    if (daySchedules.length === 0) {
      toast.error("No schedules for selected date");
      return;
    }

    setGenerating(true);
    try {
      const scheduleDetails = generateScheduleDetails();

      const report: DailyReport = {
        id: `report_${selectedDate}_${Date.now()}`,
        date: new Date(selectedDate),
        companyId,
        createdBy: user?.uid || "",
        createdByName: `${userProfile?.firstName || ""} ${userProfile?.lastName || ""}`.trim(),
        totalSchedules: reportData.totalSchedules,
        completedSchedules: reportData.completedSchedules,
        totalBookings: reportData.totalBookings,
        paidBookings: reportData.paidBookings,
        boardedPassengers: reportData.boardedPassengers,
        noShowPassengers: reportData.noShowPassengers,
        totalRevenue: reportData.totalRevenue,
        avgOccupancyRate: reportData.avgOccupancyRate,
        scheduleDetails: scheduleDetails,
        generatedAt: new Date(),
      };

      // Save report to Firestore
      const reportsRef = collection(db, "dailyReports");
      await addDoc(reportsRef, {
        ...report,
        date: Timestamp.fromDate(report.date),
        generatedAt: Timestamp.fromDate(report.generatedAt),
      });

      setGeneratedReports(prev => [report, ...prev]);
      setSelectedReport(report);
      setSuccess("Report generated successfully");
    } catch (error: any) {
      console.error("Error generating report:", error);
      setError(`Failed to generate report: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  }, [selectedDate, daySchedules, reportData, companyId, user, userProfile, generateScheduleDetails, setError, setSuccess]);

  // Download report as PDF/Excel
  const handleDownloadReport = useCallback((report: DailyReport) => {
    try {
      // Generate CSV content
      let csvContent = "Daily Operations Report\n";
      csvContent += `Date: ${report.date.toLocaleDateString()}\n`;
      csvContent += `Generated By: ${report.createdByName}\n`;
      csvContent += `Generated At: ${report.generatedAt.toLocaleString()}\n\n`;

      csvContent += "SUMMARY\n";
      csvContent += `Total Schedules,${report.totalSchedules}\n`;
      csvContent += `Completed Schedules,${report.completedSchedules}\n`;
      csvContent += `Total Bookings,${report.totalBookings}\n`;
      csvContent += `Paid Bookings,${report.paidBookings}\n`;
      csvContent += `Boarded Passengers,${report.boardedPassengers}\n`;
      csvContent += `No-Show Passengers,${report.noShowPassengers}\n`;
      csvContent += `Total Revenue,MWK ${report.totalRevenue.toLocaleString()}\n`;
      csvContent += `Average Occupancy Rate,${report.avgOccupancyRate.toFixed(2)}%\n\n`;

      csvContent += "SCHEDULES DETAIL\n";
      csvContent += "Route,Bus,Capacity,Departure,Status,Total Bookings,Paid,Boarded,No-Show,Revenue,Occupancy\n";

      report.scheduleDetails.forEach(schedule => {
        csvContent += `"${schedule.route}","${schedule.bus}",${schedule.busCapacity},`;
        csvContent += `${schedule.departureTime.toLocaleString()},${schedule.status},`;
        csvContent += `${schedule.bookings.total},${schedule.bookings.paid},${schedule.bookings.boarded},`;
        csvContent += `${schedule.bookings.noShow},${schedule.revenue},${schedule.occupancyRate.toFixed(2)}%\n`;
      });

      csvContent += "\nPASSENGER DETAILS\n";
      csvContent += "Route,Name,Seats,Amount,Payment Status,Booking Status\n";

      report.scheduleDetails.forEach(schedule => {
        schedule.passengers.forEach((passenger: any) => {
          csvContent += `"${schedule.route}","${passenger.name}","${passenger.seats}",`;
          csvContent += `${passenger.amount},${passenger.paymentStatus},${passenger.bookingStatus}\n`;
        });
      });

      // Download CSV
      const element = document.createElement("a");
      element.setAttribute("href", "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent));
      element.setAttribute("download", `daily_report_${report.date.toISOString().split('T')[0]}.csv`);
      element.style.display = "none";
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);

      toast.success("Report downloaded successfully");
    } catch (error: any) {
      setError(`Failed to download report: ${error.message}`);
    }
  }, [setError]);

  return (
    <div className="space-y-6">
      {/* Report Generation */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <FileText className="w-6 h-6 text-blue-600" />
          Generate Daily Report
        </h2>

        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          <div className="flex items-end gap-2">
            <Button
              onClick={handleGenerateReport}
              disabled={generating || daySchedules.length === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {generating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Generate Report
            </Button>
          </div>
        </div>

        {daySchedules.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
            Found <strong>{daySchedules.length}</strong> schedule(s) and <strong>{dayBookings.length}</strong> booking(s) for{" "}
            <strong>{new Date(selectedDate).toLocaleDateString()}</strong>
          </div>
        )}
      </div>

      {/* Report Summary */}
      {daySchedules.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Schedules", value: reportData.totalSchedules, icon: Calendar, color: "blue" },
            { label: "Total Bookings", value: reportData.totalBookings, icon: Users, color: "purple" },
            { label: "Total Revenue", value: `MWK ${reportData.totalRevenue.toLocaleString()}`, icon: DollarSign, color: "green" },
            { label: "Avg Occupancy", value: `${reportData.avgOccupancyRate.toFixed(1)}%`, icon: TrendingUp, color: "orange" },
          ].map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div key={idx} className="bg-white rounded-xl shadow-sm border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">{stat.label}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                  </div>
                  <Icon className={`w-8 h-8 text-${stat.color}-500 opacity-20`} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Schedules Detail Table */}
      {selectedReport && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="p-6 border-b flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Daily Report - {selectedReport.date.toLocaleDateString()}
            </h3>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.print()}
              >
                <Printer className="w-4 h-4 mr-1" />
                Print
              </Button>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                onClick={() => handleDownloadReport(selectedReport)}
              >
                <Download className="w-4 h-4 mr-1" />
                Download CSV
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Route</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Bus</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Departure</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-700">Bookings</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-700">Boarded</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-700">No-Show</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Revenue</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Occupancy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {selectedReport.scheduleDetails.map((schedule, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{schedule.route}</td>
                    <td className="px-4 py-3 text-gray-700">{schedule.bus}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {schedule.departureTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-900 font-medium">{schedule.bookings.total}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                        {schedule.bookings.boarded}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                        {schedule.bookings.noShow}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      MWK {schedule.revenue.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {schedule.occupancyRate.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t">
                <tr>
                  <td colSpan={3} className="px-4 py-3 font-semibold text-gray-900">TOTAL</td>
                  <td className="px-4 py-3 text-center font-semibold text-gray-900">{selectedReport.totalBookings}</td>
                  <td className="px-4 py-3 text-center font-semibold text-gray-900">{selectedReport.boardedPassengers}</td>
                  <td className="px-4 py-3 text-center font-semibold text-gray-900">{selectedReport.noShowPassengers}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    MWK {selectedReport.totalRevenue.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    {selectedReport.avgOccupancyRate.toFixed(1)}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Passenger List */}
          <div className="p-6 border-t">
            <h4 className="font-semibold text-gray-900 mb-3">Passenger Details</h4>
            <div className="max-h-96 overflow-y-auto">
              {selectedReport.scheduleDetails.map((schedule, scheduleIdx) => (
                <div key={scheduleIdx} className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">{schedule.route}</p>
                  <div className="space-y-1">
                    {schedule.passengers.map((passenger: any, pIdx: number) => (
                      <div key={pIdx} className="flex justify-between items-center text-xs p-2 bg-gray-50 rounded">
                        <span className="font-medium text-gray-900">{passenger.name}</span>
                        <span className="text-gray-600">Seats: {passenger.seats}</span>
                        <span className="text-gray-600">MWK {passenger.amount.toLocaleString()}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          passenger.paymentStatus === "paid" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                        }`}>
                          {passenger.paymentStatus}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
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