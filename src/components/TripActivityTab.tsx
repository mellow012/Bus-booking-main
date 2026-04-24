"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Activity, 
  MapPin, 
  Clock, 
  CheckCircle, 
  Truck, 
  Navigation, 
  AlertTriangle,
  ChevronRight,
  ArrowRight,
  Calendar,
  Building2,
  Zap,
  Info
} from "lucide-react";
import { Schedule, Route, ActivityLog } from "@/types";
import * as dbActions from "@/lib/actions/db.actions";
import { format } from "date-fns";

interface TripActivityTabProps {
  companyId: string;
  schedules: Schedule[];
  routes: Route[];
  showAlert: (type: "error" | "success" | "warning" | "info", message: string) => void;
}

export default function TripActivityTab({ companyId, schedules, routes, showAlert }: TripActivityTabProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const fetchLogs = async () => {
    try {
      const res = await dbActions.getActivityLogs({ companyId, limit: 100 });
      if (res.success && res.data) {
        setLogs(res.data as any[]);
      }
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 15000); // Polling for updates
    return () => clearInterval(interval);
  }, [companyId]);

  const filteredLogs = useMemo(() => {
    if (filter === "all") return logs;
    return logs.filter(log => log.action.includes(filter.toUpperCase()));
  }, [logs, filter]);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'TRIP_STARTED': return <Zap className="w-5 h-5 text-amber-500" />;
      case 'DEPARTED_STOP': return <Navigation className="w-5 h-5 text-blue-500" />;
      case 'ARRIVED_AT_STOP': return <MapPin className="w-5 h-5 text-indigo-500" />;
      case 'TRIP_COMPLETED': return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'DELAYED': return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      default: return <Info className="w-5 h-5 text-gray-400" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'TRIP_STARTED': return 'bg-amber-50 border-amber-100';
      case 'DEPARTED_STOP': return 'bg-blue-50 border-blue-100';
      case 'ARRIVED_AT_STOP': return 'bg-indigo-50 border-indigo-100';
      case 'TRIP_COMPLETED': return 'bg-emerald-50 border-emerald-100';
      case 'DELAYED': return 'bg-orange-50 border-orange-100';
      default: return 'bg-gray-50 border-gray-100';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200">
              <Activity className="w-6 h-6 text-white" />
            </div>
            Operational Pulse
          </h2>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em] mt-2 ml-14">
            Live Intelligence Stream • Kinetic Sync Active
          </p>
        </div>

        <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100 self-stretch sm:self-auto">
          {["all", "started", "stop", "completed"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                filter === f 
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" 
                  : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Decrypting Activity Stream...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-32 bg-white rounded-[2.5rem] border-2 border-dashed border-gray-100 shadow-sm">
          <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Truck className="w-10 h-10 text-gray-200" />
          </div>
          <h3 className="text-lg font-black text-gray-900 uppercase">Static Field Detected</h3>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-2">No active movement logs in current operational window</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline Line */}
          <div className="absolute left-8 top-0 bottom-0 w-[2px] bg-gradient-to-b from-indigo-100 via-gray-50 to-transparent"></div>

          <div className="space-y-6 relative">
            {filteredLogs.map((log, idx) => {
              const schedule = schedules.find(s => s.id === log.scheduleId);
              const route = routes.find(r => r.id === schedule?.routeId);
              
              return (
                <div key={log.id} className="flex gap-8 group">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border transition-all duration-500 group-hover:scale-110 z-10 ${getActionColor(log.action)}`}>
                    {getActionIcon(log.action)}
                  </div>

                  <div className="flex-1 bg-white p-6 rounded-[2rem] border border-gray-100 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_40px_-20px_rgba(0,0,0,0.1)] transition-all duration-500 group-hover:border-indigo-100 relative overflow-hidden">
                    <div className="absolute -right-12 -top-12 w-32 h-32 bg-gray-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                    
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg uppercase tracking-widest border border-indigo-100">
                            {log.action.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1.5">
                            <Clock className="w-3 h-3" /> {format(new Date(log.createdAt), "HH:mm:ss")}
                          </span>
                        </div>
                        <h4 className="text-lg font-black text-gray-900 tracking-tight group-hover:text-indigo-600 transition-colors">
                          {log.description}
                        </h4>
                        {route && (
                          <div className="flex items-center gap-2 mt-2">
                             <div className="p-1 bg-gray-50 rounded-md">
                                <Truck className="w-3 h-3 text-gray-400" />
                             </div>
                             <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                               {route.name} <span className="mx-2 opacity-30">|</span> 
                               Bus: {schedule?.busId?.substring(0, 8)}
                             </p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3 self-end md:self-auto">
                        <div className="text-right mr-2">
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Logged By</p>
                          <p className="text-[11px] font-bold text-gray-700">{(log as any).user?.firstName || "System"} Console</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-gray-100 border-2 border-white shadow-sm flex items-center justify-center overflow-hidden">
                           {(log as any).user?.logo ? (
                              <img src={(log as any).user.logo} className="w-full h-full object-cover" />
                           ) : (
                              <Building2 className="w-5 h-5 text-gray-400" />
                           )}
                        </div>
                      </div>
                    </div>

                    {log.metadata && (log.metadata as any).departedStops && (
                       <div className="mt-4 pt-4 border-t border-gray-50 flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                          {(log.metadata as any).departedStops.map((stop: string, i: number) => (
                             <div key={i} className="flex items-center shrink-0">
                                <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md uppercase">
                                   {stop.substring(0, 10)}
                                </span>
                                {i < (log.metadata as any).departedStops.length - 1 && (
                                   <ArrowRight className="w-3 h-3 mx-2 text-gray-300" />
                                )}
                             </div>
                          ))}
                       </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
