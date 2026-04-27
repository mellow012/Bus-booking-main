'use client';

import { Bus as BusIcon, QrCode, Search, Ticket, CheckCircle, MapPin, Users, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Schedule, Route, Bus, Booking } from '@/types';

interface DashboardTabProps {
  selectedTrip: Schedule | null;
  trips: Schedule[];
  routes: Route[];
  buses: Bus[];
  tripBookings: Booking[];
  tripStats: { totalPax: number; boarded: number; pending: number; cancelled: number };
  setSelectedTrip: (trip: Schedule) => void;
  handleUpdateTripStatus: (status: any) => void;
  setScannerModalOpen: (open: boolean) => void;
  setWalkOnModalOpen: (open: boolean) => void;
  setActiveTab: (tab: any) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  fetchInitialData: (isSilent: boolean) => void;
}

export default function DashboardTab({
  selectedTrip, trips, routes, buses, tripBookings, tripStats,
  setSelectedTrip, handleUpdateTripStatus, setScannerModalOpen, setWalkOnModalOpen, setActiveTab,
  searchQuery, setSearchQuery, fetchInitialData
}: DashboardTabProps) {
  const bestCandidate = selectedTrip || (trips.length > 0 ? (
    trips.find(t => t.tripStatus === 'boarding' || t.tripStatus === 'in_transit') || 
    [...trips].filter(t => t.tripStatus === 'scheduled' || !t.tripStatus)
      .sort((a,b) => new Date(a.departureDateTime).getTime() - new Date(b.departureDateTime).getTime())[0]
  ) : null);

  if (!bestCandidate) {
    return (
      <div className="space-y-6">
        <div className="bg-white p-12 rounded-3xl text-center border shadow-sm">
           <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
           <h2 className="text-xl font-bold text-gray-900 mb-2">No Trips Today</h2>
           <p className="text-gray-500 text-sm mb-8">You have no trips assigned for today. Contact your operator if this is an error.</p>
           <Button onClick={() => fetchInitialData(false)} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-8">
             Refresh Schedule
           </Button>
        </div>
      </div>
    );
  }

  const activeRoute = routes.find(r => r.id === bestCandidate.routeId);
  const activeBus = buses.find(b => b.id === bestCandidate.busId);
  const isUpcoming = bestCandidate.tripStatus === 'scheduled' || !bestCandidate.tripStatus;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="bg-white rounded-[24px] border border-gray-200 shadow-sm p-6 flex flex-wrap lg:flex-nowrap items-center justify-between gap-6">
         <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center border border-gray-100">
               <BusIcon className="w-6 h-6 text-gray-600" />
            </div>
            <div>
               <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                 {activeRoute?.origin || bestCandidate.departureLocation} → {activeRoute?.destination || bestCandidate.arrivalLocation}
               </h2>
               <p className={`text-xs font-bold uppercase tracking-widest mt-1 ${isUpcoming ? 'text-amber-500' : 'text-indigo-600'}`}>
                 {bestCandidate.tripStatus === 'boarding' ? 'Currently Boarding' : 
                  bestCandidate.tripStatus === 'in_transit' ? 'In Transit' : 'Next Trip • Scheduled'}
               </p>
            </div>
         </div>
         <div className="flex flex-wrap items-center gap-8 lg:gap-12">
            <div>
               <p className="text-xs text-gray-400 font-semibold mb-1 uppercase tracking-wider">Date</p>
               <p className="text-sm font-bold text-gray-900">{new Date(bestCandidate.departureDateTime).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
            </div>
            <div>
               <p className="text-xs text-gray-400 font-semibold mb-1 uppercase tracking-wider">Departure</p>
               <p className="text-sm font-bold text-gray-900">{new Date(bestCandidate.departureDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            {isUpcoming ? (
              <Button 
                onClick={() => { setSelectedTrip(bestCandidate); handleUpdateTripStatus('boarding'); }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-6 h-12 font-bold shadow-lg shadow-emerald-100"
              >
                 Start Boarding
              </Button>
            ) : (
              <div className="flex items-center gap-6">
                 <div>
                    <p className="text-xs text-gray-400 font-semibold mb-1 uppercase tracking-wider">Bus</p>
                    <p className="text-sm font-bold text-gray-900">{activeBus?.licensePlate || 'N/A'}</p>
                 </div>
                 <span className="px-4 py-2 rounded-lg text-xs font-bold bg-green-50 text-green-600">
                    On Time
                 </span>
              </div>
            )}
         </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
         <div className="bg-white rounded-[20px] p-6 border border-gray-100 shadow-sm flex flex-col justify-center">
            <p className="text-xs font-semibold text-gray-500 mb-2">Total Passengers</p>
            <p className="text-3xl font-black text-blue-600">{tripStats.totalPax}</p>
         </div>
         <div className="bg-white rounded-[20px] p-6 border border-gray-100 shadow-sm flex flex-col justify-center">
            <p className="text-xs font-semibold text-gray-500 mb-2">Checked In</p>
            <p className="text-3xl font-black text-emerald-500">{tripStats.boarded}</p>
         </div>
         <div className="bg-white rounded-[20px] p-6 border border-gray-100 shadow-sm flex flex-col justify-center">
            <p className="text-xs font-semibold text-gray-500 mb-2">Remaining</p>
            <p className="text-3xl font-black text-amber-500">{tripStats.pending}</p>
         </div>
         <div className="bg-white rounded-[20px] p-6 border border-gray-100 shadow-sm flex flex-col justify-center">
            <p className="text-xs font-semibold text-gray-500 mb-2">Cancelled</p>
            <p className="text-3xl font-black text-rose-500">{tripStats.cancelled}</p>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-8 flex flex-col items-center">
            <h3 className="w-full text-left font-bold text-gray-900 text-lg mb-2">Scan Ticket</h3>
            <p className="w-full text-left text-sm text-gray-500 mb-8">Scan QR code on the passenger ticket</p>
            
            <div className="w-48 h-48 border-2 border-dashed border-gray-300 rounded-3xl flex items-center justify-center mb-6 relative">
               <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-gray-400 rounded-tl-xl -mt-1 -ml-1"></div>
               <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-gray-400 rounded-tr-xl -mt-1 -mr-1"></div>
               <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-gray-400 rounded-bl-xl -mb-1 -ml-1"></div>
               <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-gray-400 rounded-br-xl -mb-1 -mr-1"></div>
               <QrCode className="w-16 h-16 text-gray-300" />
            </div>

            <Button onClick={() => setScannerModalOpen(true)} className="bg-[#4F5B7B] hover:bg-[#3D4761] text-white rounded-xl px-12 py-6 text-sm font-bold shadow-md mb-8">
               Scan QR Code
            </Button>

            <div className="w-full relative flex items-center justify-center py-2 mb-6">
               <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
               <span className="relative bg-white px-4 text-xs font-semibold text-gray-400 uppercase tracking-widest">or</span>
            </div>

            <div className="w-full">
               <p className="text-sm font-semibold text-gray-700 mb-2">Enter Booking ID / PNR</p>
               <div className="relative">
                  <input 
                    type="text" 
                    className="w-full h-12 pl-4 pr-12 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-600 outline-none placeholder:text-gray-400"
                    placeholder="Enter Booking ID or PNR"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600">
                     <Search className="w-5 h-5" />
                  </button>
               </div>
            </div>
         </div>

         <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-6 flex flex-col">
            <div className="flex items-center justify-between mb-6">
               <h3 className="font-bold text-gray-900 text-lg">Recent Scans</h3>
               <button onClick={() => setActiveTab('passengers')} className="text-xs font-bold text-indigo-600">View all</button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 max-h-[300px]">
               {tripBookings.filter(b => b.bookingStatus === 'confirmed' || b.bookingStatus === 'completed').slice(0,5).map(b => (
                 <div key={b.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                    <div>
                       <p className="font-bold text-gray-900 text-sm mb-1">{b.passengerDetails?.[0]?.name || 'Passenger'}</p>
                    </div>
                    <div className="text-right flex items-center gap-6">
                       <p className="text-xs font-mono font-bold text-gray-500">{b.bookingReference || b.id.substring(0,8).toUpperCase()}</p>
                       <p className="text-xs font-semibold text-gray-500 w-16">{new Date(b.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                       <div className="flex items-center gap-1.5 w-24 justify-end">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-xs font-bold text-emerald-600">Checked In</span>
                       </div>
                    </div>
                 </div>
               ))}
               {tripBookings.filter(b => b.bookingStatus === 'confirmed' || b.bookingStatus === 'completed').length === 0 && (
                 <div className="flex flex-col items-center justify-center py-10 opacity-40">
                    <Ticket className="w-10 h-10 mb-2" />
                    <p className="text-center text-sm font-medium">No recent scans.</p>
                 </div>
               )}
            </div>

            <div className="mt-6 pt-6 border-t border-gray-100">
               <p className="text-sm font-bold text-gray-900 mb-4">Quick Actions</p>
               <div className="grid grid-cols-3 gap-3">
                  <button onClick={() => setWalkOnModalOpen(true)} className="py-4 flex flex-col items-center justify-center gap-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                     <Ticket className="w-5 h-5 text-gray-600" />
                     <span className="text-[10px] font-bold text-gray-700">Walk-on</span>
                  </button>
                  <button onClick={() => setActiveTab('passengers')} className="py-4 flex flex-col items-center justify-center gap-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                     <Users className="w-5 h-5 text-gray-600" />
                     <span className="text-[10px] font-bold text-gray-700">Manifest</span>
                  </button>
                  <button onClick={() => setActiveTab('reports')} className="py-4 flex flex-col items-center justify-center gap-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                     <FileText className="w-5 h-5 text-gray-600" />
                     <span className="text-[10px] font-bold text-gray-700">Report</span>
                  </button>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
