'use client';

import React, { useState, useEffect } from 'react';
import { Route, Schedule, Bus } from '@/types';
import { Map, MapPin, Calendar, Bus as BusIcon, Plus, LayoutTemplate, Clock, Sparkles } from 'lucide-react';

import UnifiedScheduleModal from '@/components/company/UnifiedScheduleModal';
import GenerateTripsModal from '@/components/company/GenerateTripsModal';

interface RoutesTabProps {
  dashboard: any;
}

export default function RoutesTab({ dashboard }: RoutesTabProps) {
  const { assignedRoutes, schedules, templates, buses, userProfile: profile } = dashboard;
  const companyId = profile?.companyId?.trim() || '';

  const searchQuery = dashboard.searchQuery?.toLowerCase() || '';

  const filteredRoutes = assignedRoutes.filter((r: Route) => {
    if (!searchQuery) return true;
    return (
      r.name?.toLowerCase().includes(searchQuery) ||
      r.origin?.toLowerCase().includes(searchQuery) ||
      r.destination?.toLowerCase().includes(searchQuery)
    );
  });

  const [showUnifiedModal, setShowUnifiedModal] = useState(false);
  const [preSelectedRouteId, setPreSelectedRouteId] = useState<string | undefined>();
  const [generateRouteId, setGenerateRouteId] = useState<string | undefined>();
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [scheduleFilterDate, setScheduleFilterDate] = useState<string>('');

  useEffect(() => {
    if (filteredRoutes.length > 0 && (!selectedRouteId || !filteredRoutes.find((r: Route) => r.id === selectedRouteId))) {
      setSelectedRouteId(filteredRoutes[0].id);
    }
  }, [filteredRoutes, selectedRouteId]);

  const openCreateSchedule = (routeId?: string) => {
    setPreSelectedRouteId(routeId);
    setShowUnifiedModal(true);
  };

  const openGenerateTrips = (routeId: string) => {
    setGenerateRouteId(routeId);
    setShowGenerateModal(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Map className="w-6 h-6 text-indigo-600" />
            My Assigned Routes
          </h2>
          <p className="mt-1 text-sm text-gray-500">Routes and schedules within your operational jurisdiction.</p>
        </div>
        <button
          onClick={() => openCreateSchedule()}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4" /> Create Schedule
        </button>
      </div>

      {filteredRoutes.length === 0 ? (
        <div className="py-12 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-gray-900 font-medium">{searchQuery ? 'No routes match your search' : 'No routes assigned'}</h3>
          <p className="text-gray-500 mt-1">{searchQuery ? 'Try a different search term.' : 'Contact your company admin to assign routes to your branch.'}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Horizontal Routes Scroll */}
          <div className="flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory">
            {filteredRoutes.map((route: Route) => {
              const isSelected = selectedRouteId === route.id;
              return (
                <div 
                  key={route.id} 
                  onClick={() => setSelectedRouteId(route.id)}
                  className={`flex-shrink-0 w-72 p-4 rounded-2xl border cursor-pointer transition-all duration-200 snap-start ${
                    isSelected ? 'bg-indigo-50 border-indigo-200 shadow-md ring-1 ring-indigo-500' : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-gray-900 text-base line-clamp-1">{route.name}</h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      route.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {route.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-2">
                    <MapPin className="w-3 h-3 flex-shrink-0 text-gray-400"/> 
                    <span className="line-clamp-1">{route.origin} → {route.destination}</span>
                  </p>
                </div>
              );
            })}
          </div>

          {/* Schedules for Selected Route */}
          {selectedRouteId && (() => {
            const selectedRoute = filteredRoutes.find((r: Route) => r.id === selectedRouteId);
            if (!selectedRoute) return null;
            
            const routeSchedules = schedules.filter((s: Schedule) => {
              if (s.routeId !== selectedRouteId) return false;
              if (scheduleFilterDate) {
                const sDate = new Date(s.departureDateTime).toISOString().split('T')[0];
                return sDate === scheduleFilterDate;
              }
              const now = new Date();
              return s.departureDateTime >= now || ['boarding', 'in_transit', 'arrived'].includes(s.tripStatus || '');
            });
            const routeTemplates = templates?.filter((t: any) => t.routeId === selectedRouteId) || [];

            return (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in duration-300">
                <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                   <h3 className="text-lg font-bold text-gray-900">{selectedRoute.name} Details</h3>
                </div>
                
                <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Schedules */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 whitespace-nowrap">
                          {scheduleFilterDate ? 'Archived Schedules' : 'Active / Upcoming'}
                        </h4>
                        <input 
                          type="date"
                          value={scheduleFilterDate}
                          onChange={(e) => setScheduleFilterDate(e.target.value)}
                          className="text-xs px-2 py-1 border border-gray-200 rounded-md text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                          title="Filter by date to see past schedules"
                        />
                        {scheduleFilterDate && (
                          <button 
                            onClick={() => setScheduleFilterDate('')}
                            className="text-[10px] uppercase font-bold text-gray-400 hover:text-gray-700"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => openCreateSchedule(selectedRoute.id)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-500 transition-colors bg-indigo-50 px-2 py-1 rounded-md"
                      >
                        <Plus className="w-3 h-3" /> Add Schedule
                      </button>
                    </div>
                    {routeSchedules.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-sm">
                        {scheduleFilterDate ? 'No schedules found for this date.' : 'No active or upcoming schedules.'}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {routeSchedules.map((schedule: Schedule) => {
                          const bus = buses.find((b:Bus) => b.id === schedule.busId);
                          return (
                            <div key={schedule.id} className="p-3 bg-white rounded-xl border border-gray-200 flex justify-between items-center hover:border-indigo-200 transition-colors group shadow-sm">
                              <div className="flex items-center gap-3 text-sm">
                                <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                                  <Calendar className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="font-bold text-gray-900">{new Date(schedule.departureDateTime).toLocaleString([], {dateStyle:'medium', timeStyle:'short'})}</div>
                                  <div className="text-xs text-gray-500 mt-0.5 uppercase tracking-wide">{schedule.tripStatus || schedule.status}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 text-xs font-medium text-gray-600 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                                <BusIcon className="w-3 h-3" />
                                {bus?.licensePlate || 'Unassigned'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Templates */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Recurring Blueprints</h4>
                      {routeTemplates.length > 0 && (
                        <button
                          onClick={() => openGenerateTrips(selectedRoute.id)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-500 transition-colors bg-emerald-50 px-2 py-1 rounded-md"
                        >
                          <Sparkles className="w-3 h-3" /> Generate
                        </button>
                      )}
                    </div>
                    
                    {routeTemplates.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-sm">
                        No active blueprints.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {routeTemplates.map((template: any) => {
                          const bus = buses.find((b:Bus) => b.id === template.busId);
                          const shortDays = template.daysOfWeek?.map((d: number) => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ');
                          return (
                            <div key={template.id} className="p-3 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-indigo-200 transition-colors group">
                              <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                                    <LayoutTemplate className="w-4 h-4" />
                                  </div>
                                  <span className="text-sm font-bold text-gray-900">{shortDays || 'No days set'}</span>
                                </div>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-emerald-100 text-emerald-700">
                                  Active
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-xs text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                <div className="flex items-center gap-1 font-medium text-gray-700">
                                  <Clock className="w-3 h-3 text-gray-400" />
                                  {template.departureTime} - {template.arrivalTime}
                                </div>
                                <div className="flex items-center gap-1 font-medium text-gray-700">
                                  <BusIcon className="w-3 h-3 text-gray-400" />
                                  {bus?.licensePlate || 'TBA'}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      <UnifiedScheduleModal
        isOpen={showUnifiedModal}
        onClose={() => setShowUnifiedModal(false)}
        routes={assignedRoutes}
        buses={buses}
        companyId={companyId}
        onSuccess={() => dashboard.fetchInitialData?.()}
        preSelectedRouteId={preSelectedRouteId}
      />

      {showGenerateModal && generateRouteId && (
        <GenerateTripsModal
          isOpen={showGenerateModal}
          onClose={() => setShowGenerateModal(false)}
          companyId={companyId}
          routeId={generateRouteId}
          routeName={assignedRoutes.find((r: Route) => r.id === generateRouteId)?.name}
          onSuccess={() => dashboard.fetchInitialData?.()}
        />
      )}
    </div>
  );
}
