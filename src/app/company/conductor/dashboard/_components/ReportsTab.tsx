'use client';

import { FileText, Activity, DollarSign, Printer, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Schedule, Booking, Route, Bus } from '@/types';

interface ReportsTabProps {
  selectedTrip: Schedule;
  tripBookings: Booking[];
  activeRoute: Route | null;
  activeBus: Bus | null;
  handleUpdateTripStatus: (status: any) => void;
}

export default function ReportsTab({
  selectedTrip, tripBookings, activeRoute, activeBus, handleUpdateTripStatus
}: ReportsTabProps) {
  const reportStats = {
    total: tripBookings.length,
    boarded: tripBookings.filter(b => b.bookingStatus === 'confirmed' || b.bookingStatus === 'completed').length,
    noShow: tripBookings.filter(b => b.bookingStatus === 'no-show').length,
    pending: tripBookings.filter(b => b.bookingStatus === 'pending').length,
    revenue: tripBookings.filter(b => b.paymentStatus === 'paid').reduce((sum, b) => sum + (b.totalAmount || 0), 0),
    cash: tripBookings.filter(b => b.paymentStatus === 'paid' && b.paymentMethod === 'cash').reduce((sum, b) => sum + (b.totalAmount || 0), 0),
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="bg-white rounded-[32px] border shadow-sm overflow-hidden border-indigo-100">
         <div className="bg-indigo-600 p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-10">
               <FileText className="w-32 h-32 rotate-12" />
            </div>
            <div className="relative z-10">
               <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-2">Trip Summary Report</p>
               <h3 className="text-3xl font-black tracking-tight">{activeRoute?.origin} → {activeRoute?.destination}</h3>
               <p className="text-sm font-medium opacity-90 mt-1">{new Date(selectedTrip.departureDateTime).toLocaleDateString()} · {activeBus?.licensePlate}</p>
            </div>
         </div>
         
         <div className="p-8 space-y-8">
            <section>
               <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-500" /> Trip Activity
               </h4>
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                     <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tight mb-1">Total Pax</p>
                     <p className="text-xl font-black text-gray-900">{reportStats.total}</p>
                  </div>
                  <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                     <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-tight mb-1">Boarded</p>
                     <p className="text-xl font-black text-emerald-700">{reportStats.boarded}</p>
                  </div>
                  <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100">
                     <p className="text-[10px] font-bold text-rose-600 uppercase tracking-tight mb-1">No-Shows</p>
                     <p className="text-xl font-black text-rose-700">{reportStats.noShow}</p>
                  </div>
                  <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                     <p className="text-[10px] font-bold text-amber-600 uppercase tracking-tight mb-1">Pending</p>
                     <p className="text-xl font-black text-amber-700">{reportStats.pending}</p>
                  </div>
               </div>
            </section>

            <section>
               <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-500" /> Financial Breakdown
               </h4>
               <div className="space-y-4">
                  <div className="flex justify-between items-center p-5 bg-gray-50 rounded-2xl border border-gray-100">
                     <div>
                        <p className="font-bold text-gray-900">Total Revenue</p>
                        <p className="text-xs text-gray-500">Gross collections for this trip</p>
                     </div>
                     <p className="text-xl font-black text-gray-900">MWK {reportStats.revenue.toLocaleString()}</p>
                  </div>
                  <div className="flex justify-between items-center p-5 bg-emerald-50/50 rounded-2xl border border-emerald-100/50">
                     <div>
                        <p className="font-bold text-emerald-900">Cash Collections</p>
                        <p className="text-xs text-emerald-600">Walk-on and station cash</p>
                     </div>
                     <p className="text-xl font-black text-emerald-700">MWK {reportStats.cash.toLocaleString()}</p>
                  </div>
               </div>
            </section>

            <div className="pt-6 border-t flex flex-col sm:flex-row gap-4">
               <Button onClick={() => window.print()} className="flex-1 h-14 bg-gray-900 hover:bg-black text-white font-bold rounded-2xl shadow-xl">
                  <Printer className="w-5 h-5 mr-2" /> Print Trip Report
               </Button>
               {selectedTrip.tripStatus !== 'completed' && (
                  <Button 
                    onClick={() => handleUpdateTripStatus('completed')}
                    className="flex-1 h-14 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-xl shadow-indigo-100"
                  >
                     <CheckCircle className="w-5 h-5 mr-2" /> End Trip & Finalize
                  </Button>
               )}
            </div>
         </div>
      </div>
    </div>
  );
}
