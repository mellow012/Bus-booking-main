'use client';

import React, { useState } from 'react';
import { Loader2, X, AlertTriangle } from 'lucide-react';
import { useOperatorDashboard } from './_hooks/useOperatorDashboard';
import OperatorSidebar, { TabType } from './_components/OperatorSidebar';
import OperatorHeader from './_components/OperatorHeader';
import { NotificationBell } from '@/contexts/NotificationContext';

// Tabs Components
import OverviewTab from '@/components/operator/tabs/OverviewTab';
import MyRoutesTab from '@/components/operator/tabs/MyRoutesTab';
import SchedulesTab from '@/components/scheduleTab';
import BusesTab from '@/components/busesTab';
import BookingsTab from '@/components/bookingTab';
import DailyReportsTab from '@/components/ReportsTab';

export default function OperatorDashboard() {
  const {
    user,
    userProfile,
    authLoading,
    signOut,
    loading,
    globalError,
    setGlobalError,
    successMessage,
    setSuccessMessage,
    operatorInfo,
    assignedRoutes,
    schedules,
    buses,
    bookings,
    liveLocation,
    stats,
    fetchInitialData,
  } = useOperatorDashboard();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const companyId = userProfile?.companyId?.trim() || '';

  const renderActiveTab = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Synchronizing Fleet Operations...</p>
        </div>
      );
    }

    switch (activeTab) {
      case 'overview':
        return (
          <OverviewTab
            stats={stats}
            routes={assignedRoutes}
            buses={buses}
            bookings={bookings}
            liveLocation={liveLocation}
            setActiveTab={setActiveTab}
          />
        );
      case 'routes':
        return (
          <MyRoutesTab
            assignedRoutes={assignedRoutes}
            schedules={schedules}
            buses={buses}
            bookings={bookings}
            onGenerateManifest={(scheduleId) => {
              // PDF Manifest generation placeholder trigger
              alert(`PDF Manifest generation initiated for Schedule ID: ${scheduleId}`);
            }}
          />
        );
      case 'schedules':
        return (
          <SchedulesTab
            companyId={companyId}
            schedules={schedules}
            routes={assignedRoutes}
            buses={buses}
            setSchedules={() => {}}
            addSchedule={async () => null}
            setError={setGlobalError}
            setSuccess={(msg) => {
              setGlobalError('');
              setSuccessMessage(msg);
            }}
            isAdmin={false} // operators have read-only or limited schedule mutation
            user={user}
            userProfile={userProfile}
          />
        );
      case 'buses':
        return (
          <BusesTab
            buses={buses}
            setBuses={() => {}}
            companyId={companyId}
            setError={setGlobalError}
            setSuccess={(msg) => {
              setGlobalError('');
              setSuccessMessage(msg);
            }}
            subscriptionTier="premium"
            schedules={schedules}
            bookings={bookings}
          />
        );
      case 'bookings':
        return (
          <BookingsTab
            schedules={schedules}
            routes={assignedRoutes}
            buses={buses}
            companyId={companyId}
            user={user}
            userProfile={userProfile}
          />
        );
      case 'payments':
        return (
          <DailyReportsTab
            schedules={schedules}
            bookings={bookings}
            buses={buses}
            routes={assignedRoutes}
            companyId={companyId}
            user={user}
            userProfile={userProfile}
            setError={setGlobalError}
            setSuccess={(msg) => {
              setGlobalError('');
              setSuccessMessage(msg);
            }}
          />
        );
      default:
        return (
          <div className="text-center py-12">
            <p className="text-gray-500">Tab component not identified</p>
          </div>
        );
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  const companyName = operatorInfo?.companyName || (userProfile as any)?.companyName || 'Quantum Tours';

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans text-gray-900 selection:bg-indigo-100 selection:text-indigo-900 relative">
      
      {/* Side Navigation Panel */}
      <OperatorSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        companyName={companyName}
        onSignOut={signOut}
      />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Workspace Top Header */}
        <OperatorHeader
          title={activeTab === 'overview' ? 'Daily Snapshot' : activeTab === 'routes' ? 'My Routes' : activeTab}
          onMenuClick={() => setIsMobileOpen(true)}
          user={user}
          userProfile={userProfile}
          NotificationBellComponent={NotificationBell}
        />

        {/* Dynamic Content Panel */}
        <main className="flex-1 p-6 sm:p-8 overflow-y-auto">
          {globalError && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between mb-6 border border-red-100 animate-in fade-in duration-300">
              <span className="font-bold text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                {globalError}
              </span>
              <button onClick={() => setGlobalError('')} className="p-1 hover:bg-red-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {successMessage && (
            <div className="bg-emerald-50 text-emerald-700 px-4 py-3 rounded-xl flex items-center justify-between mb-6 border border-emerald-100 animate-in fade-in duration-300">
              <span className="font-bold text-sm">{successMessage}</span>
              <button onClick={() => setSuccessMessage('')} className="p-1 hover:bg-emerald-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Active Tab Screen */}
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {renderActiveTab()}
          </div>
        </main>
      </div>
    </div>
  );
}
