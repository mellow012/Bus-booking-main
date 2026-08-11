'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, MapPin, Calendar, Loader2, Bus as BusIcon,
  ArrowRight, Phone, DollarSign, Check, X, Megaphone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

interface ChatterRequest {
  id: string;
  organizerName: string;
  organizerPhone: string;
  origin: string;
  destination: string;
  departureDate: string;
  estimatedPax: number;
  seatsRequested: number | null;
  proposedFare: number | null;
  contactPhone: string | null;
  confirmedPrice: number | null;
  resultingScheduleId: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  user?: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  };
}

interface ChatterRequestsTabProps {
  dashboard: any;
}

export default function ChatterRequestsTab({ dashboard }: ChatterRequestsTabProps) {
  const companyId = dashboard.dashboardData?.company?.id;
  const [requests, setRequests] = useState<ChatterRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/chatter/requests?companyId=${companyId}`);
      const json = await res.json();
      if (json.success) {
        setRequests(json.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch chatter requests:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleConfirm = async (requestId: string) => {
    // For now, confirm with default values — the full modal flow can be added later
    try {
      setActionLoading(requestId);
      const request = requests.find(r => r.id === requestId);
      if (!request) return;

      // Get first available bus and route from dashboard data
      const buses = dashboard.dashboardData?.buses || [];
      const routes = dashboard.dashboardData?.routes || [];

      if (buses.length === 0 || routes.length === 0) {
        dashboard.showAlert?.('warning', 'You need at least one bus and one route to confirm a chatter request.');
        return;
      }

      const matchingRoute = routes.find((r: any) =>
        r.origin?.toLowerCase().includes(request.origin.toLowerCase()) ||
        r.destination?.toLowerCase().includes(request.destination.toLowerCase())
      ) || routes[0];

      const availableBus = buses.find((b: any) => b.status === 'active') || buses[0];

      const departureDate = new Date(request.departureDate);
      const arrivalDate = new Date(departureDate.getTime() + 4 * 60 * 60 * 1000); // +4 hours default

      const res = await fetch(`/api/chatter/requests/${requestId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          busId: availableBus.id,
          routeId: matchingRoute.id,
          departureDateTime: departureDate.toISOString(),
          arrivalDateTime: arrivalDate.toISOString(),
          confirmedPrice: request.proposedFare || 5000,
        }),
      });

      const json = await res.json();
      if (json.success) {
        dashboard.showAlert?.('success', 'Chatter request confirmed! Schedule created.');
        fetchRequests();
      } else {
        dashboard.showAlert?.('error', json.error || 'Failed to confirm request.');
      }
    } catch (err: any) {
      dashboard.showAlert?.('error', err.message || 'Failed to confirm request.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (requestId: string) => {
    try {
      setActionLoading(requestId);
      const res = await fetch(`/api/chatter/requests/${requestId}/decline`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.success) {
        dashboard.showAlert?.('success', 'Request declined.');
        fetchRequests();
      } else {
        dashboard.showAlert?.('error', json.error || 'Failed to decline request.');
      }
    } catch (err: any) {
      dashboard.showAlert?.('error', err.message || 'Failed to decline request.');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Loading chatter requests...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-indigo-600" />
            Chatter Requests
          </h2>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
            Group booking requests from representatives
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchRequests} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Users className="w-4 h-4 mr-2" />}
          Refresh
        </Button>
      </div>

      <div className="grid gap-6">
        {requests.map((req) => (
          <div key={req.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden group">
            <div className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                    <Users className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{req.organizerName}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-widest">
                        {req.seatsRequested || req.estimatedPax} Seats
                      </span>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        Requested {format(new Date(req.createdAt), 'MMM d, HH:mm')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                    req.status === 'pending'
                      ? 'text-amber-600 bg-amber-50 border-amber-100'
                      : req.status === 'confirmed'
                      ? 'text-emerald-600 bg-emerald-50 border-emerald-100'
                      : 'text-red-600 bg-red-50 border-red-100'
                  }`}>
                    {req.status}
                  </span>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-8 mb-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-indigo-400 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Route</p>
                      <p className="font-bold text-gray-800 flex items-center gap-2">
                        {req.origin} <ArrowRight className="w-4 h-4 text-indigo-600" /> {req.destination}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-indigo-400 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Departure</p>
                      <p className="font-bold text-gray-800">{format(new Date(req.departureDate), 'EEEE, MMM do yyyy')}</p>
                    </div>
                  </div>
                  {req.contactPhone && (
                    <div className="flex items-start gap-3">
                      <Phone className="w-5 h-5 text-indigo-400 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Contact</p>
                        <p className="font-bold text-gray-800">{req.contactPhone}</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  {req.proposedFare && (
                    <div className="flex items-start gap-3">
                      <DollarSign className="w-5 h-5 text-amber-500 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Proposed Fare</p>
                        <p className="font-bold text-gray-800">MWK {req.proposedFare.toLocaleString()} / seat</p>
                      </div>
                    </div>
                  )}
                  {req.notes && (
                    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Notes</p>
                      <p className="text-sm text-gray-600 italic font-medium leading-relaxed">{req.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {req.status === 'pending' && (
                <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 rounded-xl shadow-lg shadow-emerald-100"
                    onClick={() => handleConfirm(req.id)}
                    disabled={actionLoading === req.id}
                  >
                    {actionLoading === req.id ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Check className="w-4 h-4 mr-2" />
                    )}
                    Confirm & Assign Bus
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 rounded-xl font-bold text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => handleDecline(req.id)}
                    disabled={actionLoading === req.id}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Decline
                  </Button>
                </div>
              )}

              {req.status === 'confirmed' && req.resultingScheduleId && (
                <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
                    <Check className="w-4 h-4" />
                    <span className="font-medium">Schedule created — bookings now open</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {requests.length === 0 && !loading && (
          <div className="text-center py-20 bg-gray-50 rounded-[3rem] border border-dashed border-gray-200">
            <Megaphone className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">No Chatter Requests yet</p>
            <p className="text-sm text-gray-400 mt-2">When representatives send group booking requests to your company, they will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
