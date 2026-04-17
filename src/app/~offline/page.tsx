import Image from 'next/image';

export const metadata = {
  title: 'Offline - TibhukeBus',
  description: 'You are currently offline',
};

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

      {/* Grid lines */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="offline-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#offline-grid)"/>
      </svg>

      <div className="relative flex flex-col items-center gap-6 px-8 text-center max-w-sm">
        {/* Logo (greyscale when offline) */}
        <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl overflow-hidden border border-white/10 flex items-center justify-center bg-white/5">
          <Image
            src="/tibhukebus_logo_transparent.png"
            alt="TibhukeBus"
            width={128}
            height={128}
            className="w-full h-full object-contain p-2 grayscale opacity-60"
            priority
          />
        </div>

        <div className="flex flex-col items-center gap-3">
          {/* Wi-fi off icon */}
          <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-400/30 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="1" y1="1" x2="23" y2="23"/>
              <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
              <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
              <path d="M10.71 5.05A16 16 0 0 1 22.56 9"/>
              <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
              <line x1="12" y1="20" x2="12.01" y2="20"/>
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-white">No Internet Connection</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            TibhukeBus requires an internet connection to load. Please check your network and try again.
          </p>
        </div>

        <button
          onClick={() => {
            if (typeof window !== 'undefined') window.location.reload();
          }}
          className="mt-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-blue-900/40 text-sm"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
