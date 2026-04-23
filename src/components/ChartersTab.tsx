'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Users, MapPin, Calendar, Clock, Bus as BusIcon, 
  MessageSquare, Loader2, AlertCircle, CheckCircle2,
  ChevronRight, DollarSign, ArrowRight, User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

interface CharterRequest {
  id: string;
  organizerName: string;
  organizerPhone: string;
  origin: string;
  destination: string;
  departureDate: string;
  estimatedPax: number;
  notes: string;
  budget: number | null;
  status: string;
  createdAt: string;
}

interface ChartersTabProps {
  companyId: string;
  setError: (msg: string) => void;
  setSuccess: (msg: string) => void;
}

export default function ChartersTab({ companyId, setError, setSuccess }: ChartersTabProps) {
  const [requests, setRequests] = useState<CharterRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [quotingId, setQuotingId] = useState<string | null>(null);
  const [quotePrice, setQuotePrice] = useState('');
  const [quoteNotes, setQuoteNotes] = useState('');

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('GroupCharterRequest')
        .select('*')
        .order('createdAt', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleQuote = async (requestId: string) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('GroupCharterQuote')
        .insert([{
          requestId,
          companyId,
          price: parseInt(quotePrice),
          notes: quoteNotes,
          status: 'pending'
        }]);

      if (error) throw error;
      
      setSuccess('Quote sent successfully!');
      setQuotingId(null);
      setQuotePrice('');
      setQuoteNotes('');
      fetchRequests();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Syncing charter requests...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Charter Marketplace</h2>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Pending group & school requests</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchRequests} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Activity className="w-4 h-4 mr-2" />}
          Refresh List
        </Button>
      </div>

      <div className="grid gap-6">
        {requests.map((req) => (
          <div key={req.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden group">
            <div className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                    <Users className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{req.organizerName}</h3>
                    <div className="flex items-center gap-2 mt-1">
                       <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-widest">
                          {req.estimatedPax} Pax
                       </span>
                       <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          Requested {format(new Date(req.createdAt), 'MMM d, HH:mm')}
                       </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-widest border border-emerald-100">
                    {req.status}
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-8 mb-8">
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
                </div>
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> Organizer Notes
                  </p>
                  <p className="text-sm text-gray-600 italic font-medium leading-relaxed">
                    {req.notes || "No special requirements specified."}
                  </p>
                </div>
              </div>

              {quotingId === req.id ? (
                <div className="p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100 animate-in slide-in-from-top-2 duration-300">
                   <div className="grid md:grid-cols-2 gap-4 mb-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-indigo-900 uppercase tracking-widest ml-1">Your Quote (MWK)</label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                          <input 
                            type="number"
                            className="w-full pl-10 pr-4 h-12 bg-white border-transparent rounded-xl focus:border-indigo-500 focus:ring-0 transition-all text-sm font-bold"
                            placeholder="Total amount"
                            value={quotePrice}
                            onChange={(e) => setQuotePrice(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-indigo-900 uppercase tracking-widest ml-1">Notes to Organizer</label>
                        <input 
                          className="w-full px-4 h-12 bg-white border-transparent rounded-xl focus:border-indigo-500 focus:ring-0 transition-all text-sm font-medium"
                          placeholder="e.g. Include AC, WiFi, 2 Drivers..."
                          value={quoteNotes}
                          onChange={(e) => setQuoteNotes(e.target.value)}
                        />
                      </div>
                   </div>
                   <div className="flex gap-3">
                      <Button className="flex-1 bg-indigo-600 hover:bg-black text-white font-bold h-12 rounded-xl shadow-lg shadow-indigo-100" onClick={() => handleQuote(req.id)} disabled={!quotePrice}>
                        Submit Quote
                      </Button>
                      <Button variant="outline" className="h-12 rounded-xl font-bold" onClick={() => setQuotingId(null)}>
                        Cancel
                      </Button>
                   </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  {req.budget && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-amber-600" />
                      <p className="text-xs font-bold text-amber-700 uppercase tracking-tight">Est. Budget: MWK {req.budget.toLocaleString()}</p>
                    </div>
                  )}
                  <Button 
                    className="ml-auto bg-white border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-600 hover:text-white font-bold px-8 rounded-xl transition-all"
                    onClick={() => setQuotingId(req.id)}
                  >
                    Provide Quote
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}

        {requests.length === 0 && (
          <div className="text-center py-20 bg-gray-50 rounded-[3rem] border border-dashed border-gray-200">
             <BusIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">No Charter Requests in your region</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Minimal Activity icon if lucide-react doesn't have it in current context
function Activity({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
  );
}
