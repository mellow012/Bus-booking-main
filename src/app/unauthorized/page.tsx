'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';

export default function UnauthorizedPage() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[65vh] px-4 py-12 text-center">
      <div className="text-center max-w-md w-full flex flex-col items-center justify-center mx-auto">
        {/* Icon with signature tilted container */}
        <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-8 transform -rotate-6">
          <ShieldAlert className="w-10 h-10 text-red-600 transform rotate-6" />
        </div>

        {/* Content */}
        <h1 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight text-center">
          Access Denied
        </h1>
        <p className="text-slate-500 text-lg mb-2 leading-relaxed text-center">
          You don&apos;t have permission to view this page.
        </p>
        <p className="text-slate-400 text-sm mb-8 text-center">
          This area is restricted to authorized platform roles only.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center w-full">
          <button
            onClick={() => window.history.back()}
            className="h-12 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors text-base flex items-center justify-center gap-2 border border-slate-200 w-full sm:w-auto"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
          <Link href="/" className="w-full sm:w-auto">
            <Button className="h-12 px-6 bg-coral-500 hover:bg-coral-600 text-white rounded-xl text-base font-semibold transition-colors shadow-lg shadow-coral-500/30 flex items-center justify-center gap-2 w-full sm:w-auto">
              <Home className="w-4 h-4" />
              Return to Homepage
            </Button>
          </Link>
        </div>

        {/* Error Code */}
        <p className="text-slate-400 text-xs mt-10 font-mono text-center">
          HTTP 403 — Forbidden
        </p>
      </div>
    </div>
  );
}

