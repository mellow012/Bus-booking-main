'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { 
  Users, School, MapPin, Calendar, Clock, 
  Bus as BusIcon, ShieldCheck, CreditCard, ArrowRight,
  Loader2, CheckCircle2, Star, Sparkles
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function GroupCharterPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [formData, setFormData] = useState({
    charterType: 'student',
    organizerName: '',
    organizerPhone: '',
    schoolName: '',
    origin: '',
    destination: '',
    departureDate: '',
    estimatedPax: '',
    notes: '',
    budget: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      router.push('/login?redirect=/groups');
      return;
    }
    setLoading(true);
    
    try {
      const response = await fetch('/api/groups/charter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setSubmitted(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-[3rem] p-10 shadow-2xl text-center border border-emerald-100 animate-in zoom-in duration-500">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4 tracking-tight">Request Received!</h2>
            <p className="text-gray-500 mb-8 leading-relaxed">
              Awesome! We've sent your request to our top bus operators. You'll receive quotes in your dashboard shortly.
            </p>
            <Button 
              onClick={() => router.push('/dashboard')}
              className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl transition-all shadow-lg"
            >
              Go to My Dashboard
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col font-sans">
      <Header />
      
      {/* Hero Section */}
      <section className="relative h-[60vh] flex items-center justify-center overflow-hidden">
        <img 
          src="/student_group_bus_charter_1776923652869.png" 
          alt="Student Group Charter" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        
        <div className="relative max-w-7xl mx-auto px-6 text-center text-white animate-in slide-in-from-bottom-8 duration-700">
          <div className="inline-flex items-center gap-2 bg-brand-700/30 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 mb-6">
            {formData.charterType === 'student' ? (
              <><School className="w-4 h-4 text-brand-300" />
              <span className="text-xs font-bold uppercase tracking-widest">Exclusive for Students</span></>
            ) : (
              <><Users className="w-4 h-4 text-brand-300" />
              <span className="text-xs font-bold uppercase tracking-widest">Group Travel Made Easy</span></>
            )}
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter mb-6 leading-none">
            {formData.charterType === 'student' ? (
              <>Charter Your Own <br /> <span className="text-brand-400">Campus Express</span></>
            ) : (
              <>Charter a Private <br /> <span className="text-brand-400">Bus For Your Group</span></>
            )}
          </h1>
          <p className="text-xl md:text-2xl text-gray-200 max-w-2xl mx-auto font-medium leading-relaxed">
            {formData.charterType === 'student' 
              ? "Planning a university trip? Organize a private bus for your school, club, or friends in just a few clicks."
              : "Planning a company retreat, wedding, or large event? Get instant quotes for your private bus charter."}
          </p>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-6 -mt-20 relative z-10 pb-20">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Form Section */}
          <div className="lg:col-span-2 bg-white rounded-[3rem] p-10 shadow-2xl border border-gray-100 shadow-brand-100/50">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-10 justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center text-brand-700">
                  <Users className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Charter Request</h2>
                  <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest mt-1">Free quotes • Verified operators</p>
                </div>
              </div>
              
              <div className="bg-gray-100 p-1 rounded-xl flex items-center text-sm font-bold self-stretch sm:self-auto">
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, charterType: 'student'})}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg transition-all ${formData.charterType === 'student' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  Student Trip
                </button>
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, charterType: 'group'})}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg transition-all ${formData.charterType === 'group' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  Group Travel
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 ml-1">Organizer Name</label>
                  <div className="relative">
                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                      required
                      className="w-full pl-12 pr-4 h-14 bg-gray-50 border-transparent rounded-2xl focus:bg-white focus:border-brand-700 focus:ring-0 transition-all text-sm font-semibold"
                      placeholder="e.g. Student Union President"
                      value={formData.organizerName}
                      onChange={(e) => setFormData({...formData, organizerName: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 ml-1">Contact Phone</label>
                  <div className="relative">
                    <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                      required
                      className="w-full pl-12 pr-4 h-14 bg-gray-50 border-transparent rounded-2xl focus:bg-white focus:border-brand-700 focus:ring-0 transition-all text-sm font-semibold"
                      placeholder="+265 999 ..."
                      value={formData.organizerPhone}
                      onChange={(e) => setFormData({...formData, organizerPhone: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 ml-1">
                  {formData.charterType === 'student' ? 'School / University Name' : 'Group / Organization Name'}
                </label>
                <div className="relative">
                  {formData.charterType === 'student' ? (
                    <School className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  ) : (
                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  )}
                  <input 
                    required
                    className="w-full pl-12 pr-4 h-14 bg-gray-50 border-transparent rounded-2xl focus:bg-white focus:border-brand-700 focus:ring-0 transition-all text-sm font-semibold"
                    placeholder={formData.charterType === 'student' ? "University of Malawi (UNIMA)" : "e.g. Acme Corp, Wedding Party"}
                    value={formData.schoolName}
                    onChange={(e) => setFormData({...formData, schoolName: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 ml-1">Pickup Location (Origin)</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                      required
                      className="w-full pl-12 pr-4 h-14 bg-gray-50 border-transparent rounded-2xl focus:bg-white focus:border-brand-700 focus:ring-0 transition-all text-sm font-semibold"
                      placeholder="School Main Gate"
                      value={formData.origin}
                      onChange={(e) => setFormData({...formData, origin: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 ml-1">Drop-off Location (Destination)</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                      required
                      className="w-full pl-12 pr-4 h-14 bg-gray-50 border-transparent rounded-2xl focus:bg-white focus:border-brand-700 focus:ring-0 transition-all text-sm font-semibold"
                      placeholder="Event Venue / City"
                      value={formData.destination}
                      onChange={(e) => setFormData({...formData, destination: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 ml-1">Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                      required
                      type="date"
                      className="w-full pl-12 pr-4 h-14 bg-gray-50 border-transparent rounded-2xl focus:bg-white focus:border-brand-700 focus:ring-0 transition-all text-sm font-semibold"
                      value={formData.departureDate}
                      onChange={(e) => setFormData({...formData, departureDate: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 ml-1">Estimated Pax</label>
                  <div className="relative">
                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                      required
                      type="number"
                      className="w-full pl-12 pr-4 h-14 bg-gray-50 border-transparent rounded-2xl focus:bg-white focus:border-brand-700 focus:ring-0 transition-all text-sm font-semibold"
                      placeholder="e.g. 50"
                      value={formData.estimatedPax}
                      onChange={(e) => setFormData({...formData, estimatedPax: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 ml-1">Total Budget (Optional)</label>
                  <div className="relative">
                    <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                      type="number"
                      className="w-full pl-12 pr-4 h-14 bg-gray-50 border-transparent rounded-2xl focus:bg-white focus:border-brand-700 focus:ring-0 transition-all text-sm font-semibold"
                      placeholder="MWK"
                      value={formData.budget}
                      onChange={(e) => setFormData({...formData, budget: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 ml-1">Special Requirements / Notes</label>
                <textarea 
                  rows={4}
                  className="w-full p-4 bg-gray-50 border-transparent rounded-2xl focus:bg-white focus:border-brand-700 focus:ring-0 transition-all text-sm font-semibold"
                  placeholder="Tell us about AC needs, luggage, or multiple stops..."
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                />
              </div>

              <Button 
                type="submit"
                disabled={loading}
                className="w-full h-16 bg-coral-500 hover:bg-coral-600 text-white text-lg font-bold rounded-2xl transition-all shadow-xl shadow-coral-100 flex items-center justify-center gap-3"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                  <>
                    Request Charter Quotes <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </Button>
            </form>
          </div>

          {/* Info Sidebar */}
          <div className="space-y-8">
            <div className="bg-brand-700 rounded-[3rem] p-10 text-white shadow-xl">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-brand-300" /> Why Charter?
              </h3>
              <ul className="space-y-6">
                <li className="flex gap-4">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="w-5 h-5 text-brand-200" />
                  </div>
                  <div>
                    <p className="font-bold text-lg leading-none mb-1">Safe & Reliable</p>
                    <p className="text-brand-100 text-xs">Vetted operators with GPS tracking.</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <BusIcon className="w-5 h-5 text-brand-200" />
                  </div>
                  <div>
                    <p className="font-bold text-lg leading-none mb-1">Tailored Comfort</p>
                    <p className="text-brand-100 text-xs">Choose AC, WiFi, or power outlets.</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-brand-200" />
                  </div>
                  <div>
                    <p className="font-bold text-lg leading-none mb-1">Your Schedule</p>
                    <p className="text-brand-100 text-xs">We pick you up from your school gate.</p>
                  </div>
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-[3rem] p-8 border border-gray-100 shadow-lg text-center">
              <div className="flex justify-center -space-x-4 mb-6">
                {[1,2,3,4].map(i => (
                  <div key={i} className="w-12 h-12 rounded-full border-4 border-white bg-gray-100 flex items-center justify-center text-xs font-bold text-brand-700 ring-2 ring-brand-50">
                    {['UN', 'MZ', 'LI', 'LU'][i-1]}
                  </div>
                ))}
              </div>
              <p className="text-sm font-bold text-gray-900 mb-2">Trusted by 20+ Student Unions</p>
              <div className="flex items-center justify-center gap-1">
                {[1,2,3,4,5].map(i => <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
              </div>
              <p className="text-xs text-gray-400 mt-2 font-medium">Average 4.9/5 rating for charters</p>
            </div>

            <div className="bg-gradient-to-br from-brand-50 to-brand-100/40 rounded-[3rem] p-8 border border-brand-100 text-center">
              <p className="text-sm font-bold text-brand-900 mb-4">Just need a few seats?</p>
              <Button 
                onClick={() => router.push('/schedules')}
                variant="outline"
                className="w-full border-brand-200 text-brand-700 hover:bg-brand-50 rounded-2xl font-bold"
              >
                View Regular Schedules
              </Button>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
