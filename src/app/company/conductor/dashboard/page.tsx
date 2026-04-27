'use client';

import React, { useState } from 'react';
import { Loader2, LogOut, QrCode, Settings, X, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';

import WalkOnBookingModal, { WalkOnFormData } from './_components/WalkOnBookingModal';
import { buildTripStopSequence } from '@/types';
import CashCollectionModal from './_components/CashCollectionModal';
import PassengerManifest from './_components/PassengerManifest';
import ScannerModal from './_components/ScannerModal';
import OperatorProfileTab from '@/components/OperatorProfileTab';

import { TABS, TabType } from './_lib/constants';
import { useConductorDashboard } from './_hooks/useConductorDashboard';
import DashboardTab from './_components/DashboardTab';
import MyTripsTab from './_components/MyTripsTab';
import PaymentsTab from './_components/PaymentsTab';
import ReportsTab from './_components/ReportsTab';
import * as dbActions from '@/lib/actions/db.actions';

export default function ConductorDashboard() {
  const {
    user, userProfile, authLoading, signOut,
    loading, trips, buses, routes, company,
    selectedTrip, setSelectedTrip, tripBookings,
    actionLoadingId, globalError, setGlobalError, successMessage, setSuccessMessage,
    tripStats, handleMarkBoarded, handleMarkNoShow, handleUpdateTripStatus, handleWalkOnBooking, handleScan,
    fetchInitialData
  } = useConductorDashboard();

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [cashModalOpen, setCashModalOpen] = useState(false);
  const [activeBookingForCash, setActiveBookingForCash] = useState<any | null>(null);
  const [walkOnModalOpen, setWalkOnModalOpen] = useState(false);
  const [scannerModalOpen, setScannerModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  if (loading || authLoading) {
    return <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center"><Loader2 className="w-10 h-10 text-indigo-600 animate-spin" /></div>;
  }

  const activeRoute = selectedTrip ? routes.find(r => r.id === selectedTrip.routeId) || null : null;
  const activeBus = selectedTrip ? buses.find(b => b.id === selectedTrip.busId) || null : null;

  const handleWalkOnBookingWrapper = async (seatNumber: string, data: any, amount: number) => {
    await handleWalkOnBooking(seatNumber, data, amount);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return (
        <DashboardTab 
          selectedTrip={selectedTrip} trips={trips} routes={routes} buses={buses} tripBookings={tripBookings} tripStats={tripStats}
          setSelectedTrip={setSelectedTrip} handleUpdateTripStatus={handleUpdateTripStatus} 
          setScannerModalOpen={setScannerModalOpen} setWalkOnModalOpen={setWalkOnModalOpen} setActiveTab={setActiveTab}
          searchQuery={searchQuery} setSearchQuery={setSearchQuery} fetchInitialData={fetchInitialData}
        />
      );
      case 'my-trips': return (
        <MyTripsTab 
          trips={trips} routes={routes} buses={buses} selectedTrip={selectedTrip} 
          setSelectedTrip={setSelectedTrip} setActiveTab={setActiveTab}
        />
      );
      case 'passengers': return selectedTrip ? (
        <div className="max-w-4xl mx-auto">
          <PassengerManifest 
            bookings={tripBookings} 
            tripStatus={selectedTrip.tripStatus || 'scheduled'}
            onOpenCashModal={(b) => { setActiveBookingForCash(b); setCashModalOpen(true); }}
            onMarkBoarded={handleMarkBoarded}
            onMarkNoShow={handleMarkNoShow}
            loadingActionId={actionLoadingId}
          />
        </div>
      ) : <DashboardTab 
          selectedTrip={selectedTrip} trips={trips} routes={routes} buses={buses} tripBookings={tripBookings} tripStats={tripStats}
          setSelectedTrip={setSelectedTrip} handleUpdateTripStatus={handleUpdateTripStatus} 
          setScannerModalOpen={setScannerModalOpen} setWalkOnModalOpen={setWalkOnModalOpen} setActiveTab={setActiveTab}
          searchQuery={searchQuery} setSearchQuery={setSearchQuery} fetchInitialData={fetchInitialData}
        />;
      case 'payments': return <PaymentsTab tripBookings={tripBookings} />;
      case 'reports': return selectedTrip ? (
        <ReportsTab 
          selectedTrip={selectedTrip} tripBookings={tripBookings} activeRoute={activeRoute} activeBus={activeBus} 
          handleUpdateTripStatus={handleUpdateTripStatus} 
        />
      ) : null;
      case 'ticket-scanning': return (
        <div className="max-w-2xl mx-auto bg-white p-12 rounded-3xl border shadow-sm text-center">
           <QrCode className="w-16 h-16 text-indigo-600 mx-auto mb-6" />
           <h2 className="text-xl font-bold text-gray-900 mb-2">Scan Ticket</h2>
           <p className="text-gray-500 text-sm mb-8">Place the passenger's QR code inside the viewfinder</p>
           <div className="w-64 h-64 border-4 border-indigo-600 rounded-3xl mx-auto mb-10 flex items-center justify-center bg-gray-50 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-500/10 to-transparent animate-scan" />
              <Ticket className="w-12 h-12 text-gray-200" />
           </div>
           <Button onClick={() => setScannerModalOpen(true)} className="w-full bg-indigo-600 py-6 rounded-xl font-bold">Initialize Scanner</Button>
        </div>
      );
      case 'profile': return (
        <OperatorProfileTab 
           userProfile={userProfile} 
           setError={setGlobalError} 
           setSuccess={(msg) => { setGlobalError(''); setSuccessMessage(msg); }} 
        />
      );
      case 'settings': return (
        <div className="max-w-4xl mx-auto bg-white p-8 rounded-2xl border shadow-sm text-center">
           <Settings className="w-12 h-12 text-gray-300 mx-auto mb-4" />
           <p className="text-gray-500 font-bold">Account and device settings coming soon.</p>
        </div>
      );
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans text-gray-900 selection:bg-indigo-100 selection:text-indigo-900">
      <aside className="hidden lg:flex w-[280px] bg-white border-r border-gray-100 flex-col sticky top-0 h-screen overflow-hidden shadow-premium z-50">
        <div className="p-8 border-b border-gray-50 flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 text-white font-bold text-xl">
             {company?.name?.[0] || 'T'}
          </div>
          <div>
            <h1 className="font-bold tracking-tight text-gray-900 truncate text-base">{company?.name || 'Transport Co.'}</h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Company Portal</p>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
           {TABS.map(tab => {
             const Icon = tab.icon;
             return (
               <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all text-[13px] font-bold ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-[1.02]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}>
                 <Icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-white' : 'text-gray-400'}`} /> {tab.label}
               </button>
             );
           })}
        </nav>
        <div className="p-4 mt-auto border-t border-gray-50">
          <button onClick={signOut} className="w-full flex items-center gap-3 px-4 py-3.5 text-rose-500 hover:bg-rose-50 rounded-2xl transition-all text-[13px] font-bold">
             <LogOut className="w-5 h-5" /> Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-20 bg-white border-b border-gray-100 px-8 flex items-center justify-between sticky top-0 z-40">
           <div>
             <h2 className="text-xl font-extrabold tracking-tight text-gray-900 uppercase">
                {TABS.find(t => t.id === activeTab)?.label || 'Dashboard'}
             </h2>
             <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Real-time Operations Control</p>
           </div>
           <div className="flex items-center gap-6">
             {selectedTrip && activeTab === 'dashboard' && (
                <div className="bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-[10px] font-bold border border-gray-200 uppercase tracking-widest">
                   Trip ID: {selectedTrip.id.substring(0,8)}
                </div>
             )}
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-full flex items-center justify-center font-bold text-indigo-700 text-sm">
                 {userProfile?.firstName?.[0] || 'C'}
               </div>
               <div className="hidden sm:block">
                  <p className="text-[11px] font-black text-gray-900 uppercase tracking-tight">{userProfile?.firstName} {userProfile?.lastName}</p>
                  <p className="text-[9px] text-indigo-600 font-bold uppercase tracking-widest">Conductor On Duty</p>
               </div>
             </div>
           </div>
        </header>

        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
          {globalError && (
             <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between mb-6 border border-red-100">
               <span className="font-bold text-sm">{globalError}</span>
               <button onClick={() => setGlobalError('')}><X className="w-4 h-4" /></button>
             </div>
          )}

          {successMessage && (
             <div className="bg-emerald-50 text-emerald-700 px-4 py-3 rounded-xl flex items-center justify-between mb-6 border border-emerald-100">
               <span className="font-bold text-sm">{successMessage}</span>
               <button onClick={() => setSuccessMessage('')}><X className="w-4 h-4" /></button>
             </div>
          )}

          {renderContent()}
        </main>
      </div>

      <WalkOnBookingModal 
        isOpen={walkOnModalOpen} 
        onClose={() => setWalkOnModalOpen(false)} 
        trip={selectedTrip} 
        bus={buses.find(b => b.id === selectedTrip?.busId) || null}
        route={selectedTrip ? (routes.find(r => r.id === selectedTrip.routeId) || null) : null}
        existingBookings={tripBookings} 
        stopSequence={selectedTrip ? buildTripStopSequence(selectedTrip, routes.find(r => r.id === selectedTrip.routeId)) : []} 
        currentStopIndex={selectedTrip?.currentStopIndex || 0}
        onConfirm={handleWalkOnBookingWrapper} 
        loading={actionLoadingId === 'walk-on'}
      />
      <ScannerModal 
        isOpen={scannerModalOpen} 
        onClose={() => setScannerModalOpen(false)} 
        onScan={handleScan} 
      />
      <CashCollectionModal
        isOpen={cashModalOpen}
        onClose={() => { setCashModalOpen(false); setActiveBookingForCash(null); }}
        booking={activeBookingForCash}
        loading={false}
        onConfirm={async (id, method) => {
          await dbActions.updateBooking(id, { paymentStatus: 'paid', paymentMethod: method as any });
          setCashModalOpen(false);
          setActiveBookingForCash(null);
        }}
      />
    </div>
  );
}
