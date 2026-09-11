'use client';

import React, { useState } from 'react';
import { LogOut, Settings, X, Menu } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { buildTripStopSequence } from '@/types';

import WalkOnBookingModal, { WalkOnFormData } from './_components/WalkOnBookingModal';
import CashCollectionModal from './_components/CashCollectionModal';
import ScannerModal from './_components/ScannerModal';
import OperatorProfileTab from '@/components/OperatorProfileTab';

import { TABS, TabType } from './_lib/constants';
import { useConductorDashboard } from './_hooks/useConductorDashboard';
import MyTripsTab from './_components/MyTripsTab';
import PaymentsTab from './_components/PaymentsTab';
import ConductorHomeTab from './_components/ConductorHomeTab';
import ConductorBookingsTab from './_components/ConductorBookingsTab';
import PassengerVerificationModal from './_components/PassengerVerificationModal';
import * as dbActions from '@/lib/actions/db.actions';
import DashboardBottomNav from '@/components/DashboardBottomNav';
import { NotificationBell, useNotifications } from '@/contexts/NotificationContext';

export default function ConductorDashboard() {
  const {
    user, userProfile, authLoading, signOut,
    loading, trips, buses, routes, company,
    selectedTrip, setSelectedTrip, tripBookings,
    actionLoadingId, globalError, setGlobalError, successMessage, setSuccessMessage,
    tripStats, handleMarkBoarded, handleMarkNoShow, handleMarkAlighted, handleUpdateTripStatus, handleWalkOnBooking, handleScan,
    fetchInitialData
  } = useConductorDashboard();
  const { unreadCount } = useNotifications();

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [cashModalOpen, setCashModalOpen] = useState(false);
  const [activeBookingForCash, setActiveBookingForCash] = useState<any | null>(null);
  const [walkOnModalOpen, setWalkOnModalOpen] = useState(false);
  const [scannerModalOpen, setScannerModalOpen] = useState(false);
  const [scannedBooking, setScannedBooking] = useState<any | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (loading || authLoading) {
    return <div className="min-h-screen bg-brand-50/40"><LoadingSpinner className="text-brand-700" fullScreen /></div>;
  }

  const handleWalkOnBookingWrapper = async (seatNumber: string, data: any, amount: number) => {
    await handleWalkOnBooking(seatNumber, data, amount);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return (
        <ConductorHomeTab
          selectedTrip={selectedTrip}
          routes={routes}
          buses={buses}
          bookings={tripBookings}
          onWalkOn={() => setWalkOnModalOpen(true)}
          onScan={() => setScannerModalOpen(true)}
          onRefresh={() => fetchInitialData(false)}
          onUpdateTripStatus={handleUpdateTripStatus}
          statusLoading={actionLoadingId === 'trip-status'}
        />
      );
      case 'my-trips': return (
        <MyTripsTab
          trips={trips} routes={routes} buses={buses} selectedTrip={selectedTrip}
          setSelectedTrip={setSelectedTrip} setActiveTab={setActiveTab}
        />
      );
      case 'passengers': return (
        <ConductorBookingsTab
          bookings={tripBookings}
          selectedTrip={selectedTrip}
          route={selectedTrip ? routes.find((route) => route.id === selectedTrip.routeId) : null}
          onScan={() => setScannerModalOpen(true)}
          onMarkBoarded={async (bookingId) => { await handleMarkBoarded(bookingId, true); }}
          onMarkAlighted={handleMarkAlighted}
          loadingActionId={actionLoadingId}
        />
      );
      case 'payments': return <PaymentsTab tripBookings={tripBookings} />;
      case 'profile': return (
        <OperatorProfileTab
          userProfile={userProfile}
          companyName={company?.name || undefined}
          setError={setGlobalError}
          setSuccess={(msg) => { setGlobalError(''); setSuccessMessage(msg); }}
        />
      );
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-brand-50/40 flex flex-col lg:flex-row relative selection:bg-brand-100 selection:text-brand-900">
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
          <div className="w-12 h-12 bg-brand-700 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-100 text-white font-bold text-xl">
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
                  ${activeTab === tab.id ? 'bg-brand-700 text-white shadow-lg shadow-brand-100 scale-[1.02]' : 'text-gray-500 hover:bg-brand-50 hover:text-brand-700'}`}
              >
                <Icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-white' : 'text-gray-400 group-hover:text-brand-700'}`} />
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
        <header className="h-[60px] bg-white border-b border-gray-100 sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-50 rounded-lg"
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              {company?.logo ? (
                <img
                  src={company.logo}
                  alt={`${company.name || 'Company'} logo`}
                  className="h-9 w-9 rounded-full border border-gray-200 object-cover"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-brand-100 font-bold text-brand-700">
                  {company?.name?.[0] || 'C'}
                </div>
              )}
              <h2 className="hidden text-lg font-bold capitalize text-gray-900 sm:block">
                {activeTab.replace('-', ' ')}
              </h2>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-end gap-3 sm:gap-4">
            {selectedTrip && activeTab === 'dashboard' && (
              <div className="hidden rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-700 md:flex">
                Trip ID: {selectedTrip.id.substring(0, 8)}
              </div>
            )}
            {user?.id && <NotificationBell userId={user.id} />}
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className="ml-1 flex h-8 w-8 items-center justify-center rounded-full border border-brand-200 bg-brand-100 shadow-sm transition hover:bg-brand-200"
              aria-label="Open profile"
            >
              <span className="text-sm font-bold uppercase text-brand-700">
                {userProfile?.firstName?.[0] || user?.email?.[0] || 'C'}
              </span>
            </button>
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
        tabs={TABS.map(t => ({
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
        onScan={async (decodedText) => {
          const booking = await handleScan(decodedText);
          if (booking) {
            setScannerModalOpen(false);
            setScannedBooking(booking);
          }
        }}
      />
      {scannedBooking && (
        <PassengerVerificationModal
          booking={scannedBooking}
          selectedTrip={selectedTrip}
          route={selectedTrip ? routes.find((route) => route.id === selectedTrip.routeId) : null}
          onClose={() => setScannedBooking(null)}
          verifiedByScan
          onConfirm={async () => {
            await handleMarkBoarded(scannedBooking.id, true);
            setScannedBooking(null);
            setSuccessMessage(`Welcome aboard, ${scannedBooking.passengerDetails?.[0]?.name || 'Passenger'}!`);
          }}
          loading={actionLoadingId === scannedBooking.id}
          confirmLabel="Confirm passenger and board"
          requirePayment
          requireVerification
        />
      )}
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
