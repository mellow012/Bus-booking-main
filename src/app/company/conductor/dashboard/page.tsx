'use client';

import React, { useState } from 'react';
import { Loader2, LogOut, QrCode, Settings, X, Ticket, Menu, LayoutDashboard, MapPin, Users, DollarSign, FileText, User } from 'lucide-react';
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
import DashboardBottomNav from '@/components/DashboardBottomNav';
import { useNotifications } from '@/contexts/NotificationContext';

export default function ConductorDashboard() {
  const {
    user, userProfile, authLoading, signOut,
    loading, trips, buses, routes, company,
    selectedTrip, setSelectedTrip, tripBookings,
    actionLoadingId, globalError, setGlobalError, successMessage, setSuccessMessage,
    tripStats, handleMarkBoarded, handleMarkNoShow, handleUpdateTripStatus, handleWalkOnBooking, handleScan,
    fetchInitialData
  } = useConductorDashboard();
  const { unreadCount } = useNotifications();

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [cashModalOpen, setCashModalOpen] = useState(false);
  const [activeBookingForCash, setActiveBookingForCash] = useState<any | null>(null);
  const [walkOnModalOpen, setWalkOnModalOpen] = useState(false);
  const [scannerModalOpen, setScannerModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
    <div className="min-h-screen bg-[#f8fafc] flex flex-col lg:flex-row relative selection:bg-indigo-100 selection:text-indigo-900">
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden backdrop-blur-sm animate-in fade-in duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-[280px] glass lg:bg-white border-r border-gray-100 flex flex-col transition-all duration-500 ease-in-out shadow-premium
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-8 border-b border-gray-50 flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 text-white font-bold text-xl">
             {company?.name?.[0] || 'T'}
          </div>
          <div>
            <h1 className="font-bold tracking-tight text-gray-900 truncate text-base">{company?.name || 'Transport Co.'}</h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Company Portal</p>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setIsMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 group text-[13px] font-bold
                  ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-[1.02]' : 'text-gray-500 hover:bg-gray-50 hover:text-indigo-600'}`}
              >
                <Icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-white' : 'text-gray-400 group-hover:text-indigo-600'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 mt-auto border-t border-gray-50">
          <button 
            onClick={() => signOut()}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-rose-500 hover:bg-rose-50 transition-all duration-300 font-bold text-[13px]"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-20 lg:h-24 bg-white/95 backdrop-blur-md border-b border-gray-100 sticky top-0 z-30 px-6 lg:px-12 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2.5 hover:bg-gray-50 rounded-xl transition-colors border border-gray-100"
            >
              <Menu className="w-6 h-6 text-gray-600" />
            </button>
            <div>
              <h2 className="text-xl lg:text-2xl font-black text-indigo-950 capitalize">{activeTab.replace('-', ' ')}</h2>
              <p className="text-[10px] lg:text-xs text-gray-400 font-bold uppercase tracking-widest mt-0.5">Real-time Operations Control</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 lg:gap-6">
            {selectedTrip && activeTab === 'dashboard' && (
              <div className="hidden md:flex bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-[10px] font-bold border border-gray-200 uppercase tracking-widest">
                 Trip ID: {selectedTrip.id.substring(0,8)}
              </div>
            )}
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-full flex items-center justify-center font-bold text-indigo-700 text-sm">
                 {userProfile?.firstName?.[0] || 'C'}
               </div>
               <div className="hidden sm:block">
                  <p className="text-[11px] font-black text-gray-900 uppercase tracking-tight leading-none">{userProfile?.firstName} {userProfile?.lastName}</p>
                  <p className="text-[9px] text-indigo-600 font-bold uppercase tracking-widest mt-1">Conductor On Duty</p>
               </div>
             </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-12 overflow-y-auto pb-32">
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

      {/* Bottom Nav for Mobile */}
      <DashboardBottomNav 
        tabs={TABS.slice(0, 4).map(t => ({
          ...t,
          badge: t.id === 'dashboard' ? unreadCount > 0 : false
        }))} 
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as TabType)}
      />

      {/* Modals */}
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
