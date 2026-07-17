'use client';

import Link from 'next/link';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-brand-950/80 to-slate-950 flex items-center justify-center px-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-red-500/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] rounded-full bg-brand-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 text-center max-w-md w-full">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-red-500/20 border border-red-500/30 rounded-2xl flex items-center justify-center">
            <ShieldAlert className="w-10 h-10 text-red-400" />
          </div>
        </div>

        {/* Content */}
        <h1 className="text-4xl font-black text-white mb-3 tracking-tight">
          Access Denied
        </h1>
        <p className="text-slate-400 text-base mb-2">
          You don&apos;t have permission to view this page.
        </p>
        <p className="text-slate-500 text-sm mb-10">
          This area is restricted to authorized roles only. If you believe this
          is an error, please contact your administrator.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => window.history.back()}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold rounded-xl transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
          <Link
            href="/"
            className="flex items-center justify-center gap-2 px-6 py-3 bg-coral-500 hover:bg-coral-600 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-coral-950/40 text-sm"
          >
            <Home className="w-4 h-4" />
            Back to Home
          </Link>
        </div>

        {/* Error code */}
        <p className="text-slate-600 text-xs mt-10 font-mono">
          HTTP 403 — Forbidden
        </p>
      </div>
    </div>
  );
}
