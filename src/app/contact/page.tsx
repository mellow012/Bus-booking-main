"use client";

import React, { useState } from 'react';
import { Phone, Mail, MapPin, Send, MessageSquare } from 'lucide-react';
import BackButton from "@/components/BackButton";

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pnr, setPnr] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !message) return;
    setSubmitted(true);
    setName('');
    setEmail('');
    setPnr('');
    setMessage('');
    setTimeout(() => setSubmitted(false), 5000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-brand-50/30 to-gray-50 pt-28 sm:pt-32 lg:pt-36">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Back Button */}
        <div className="mb-5">
          <BackButton iconOnly hideOnMobile={false} className="border-slate-200 shadow-sm bg-white" />
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 border border-brand-100 text-xs font-bold text-brand-700 uppercase tracking-wider mb-3">
            <MessageSquare className="w-3.5 h-3.5" /> Support
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Contact Support &amp; Customer Care
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 max-w-2xl">
            Have questions about your booking? Get in touch with our team. We are available 24/7.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Direct Contacts */}
          <div className="lg:col-span-5 space-y-4">
            <h2 className="text-base font-bold text-gray-900 mb-2">Direct Channels</h2>
            
            <a
              href="tel:+265883344063"
              className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 hover:border-brand-200 hover:shadow-md transition-all duration-300 group"
            >
              <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-700 shrink-0 group-hover:bg-brand-100 transition-colors">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Call Support (24/7)
                </span>
                <span className="text-sm font-bold text-slate-800 group-hover:text-brand-700 transition-colors">
                  +265 883 34 40 63
                </span>
              </div>
            </a>

            <a
              href="mailto:support@tibhukebus.com"
              className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 hover:border-brand-200 hover:shadow-md transition-all duration-300 group"
            >
              <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-700 shrink-0 group-hover:bg-brand-100 transition-colors">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Email Help Desk
                </span>
                <span className="text-sm font-bold text-slate-800 group-hover:text-brand-700 transition-colors">
                  support@tibhukebus.com
                </span>
              </div>
            </a>

            <a
              href="https://wa.me/265883344063"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 hover:border-emerald-250 hover:shadow-md transition-all duration-300 group"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 group-hover:bg-emerald-100 transition-colors">
                <svg
                  className="w-5 h-5 fill-current"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413" />
                </svg>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  WhatsApp Chat
                </span>
                <span className="text-sm font-bold text-slate-800 group-hover:text-emerald-600 transition-colors">
                  +265 883 34 40 63
                </span>
              </div>
            </a>

            <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Headquarters
                </span>
                <span className="text-sm font-bold text-slate-800">
                  Mzuzu, Malawi
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Contact Form */}
          <div className="lg:col-span-7 bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Send an Inquiry</h2>
              <p className="text-xs text-slate-500 mt-0.5">Use the form below to reach support with booking questions.</p>
            </div>

            {submitted ? (
              <div className="p-5 bg-emerald-50 border border-emerald-150 text-emerald-800 rounded-2xl text-center font-medium animate-in fade-in duration-300">
                🚀 Message sent successfully! Our team will get back to you shortly.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="formName" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Full Name *
                    </label>
                    <input
                      id="formName"
                      type="text"
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="John Doe"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent rounded-xl text-sm font-medium transition-all"
                    />
                  </div>
                  <div>
                    <label htmlFor="formEmail" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Email Address *
                    </label>
                    <input
                      id="formEmail"
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="john@example.com"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent rounded-xl text-sm font-medium transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="formPnr" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Booking Reference (Optional)
                  </label>
                  <input
                    id="formPnr"
                    type="text"
                    value={pnr}
                    onChange={e => setPnr(e.target.value)}
                    placeholder="TBK-123456"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent rounded-xl text-sm font-medium transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="formMsg" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Your Message *
                  </label>
                  <textarea
                    id="formMsg"
                    required
                    rows={4}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Describe your inquiry..."
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent rounded-xl text-sm font-medium transition-all resize-none"
                  ></textarea>
                </div>

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-coral-500 hover:bg-coral-600 text-white font-bold text-sm transition-all shadow-sm active:scale-98 cursor-pointer"
                >
                  Send Message <Send className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
