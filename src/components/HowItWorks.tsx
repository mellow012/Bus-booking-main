"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Calendar, CreditCard, Ticket,
  ArrowRight, CheckCircle, MapPin, Clock,
  Smartphone, Banknote, ChevronRight,
} from "lucide-react";

// ─── tiny hook: fires once when element enters viewport ─────────────────────
function useInView(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

// ─── Step data ───────────────────────────────────────────────────────────────

const STEPS = [
  {
    num: "01",
    icon: Search,
    title: "Search Routes",
    subtitle: "Find your journey",
    description: "Enter your departure city and destination. We scan all active operators and show you every available schedule in real time.",
    accent: "#2563EB",          // blue-600
    lightBg: "#EFF6FF",         // blue-50
    borderClr: "#BFDBFE",       // blue-200
    preview: <SearchPreview />,
  },
  {
    num: "02",
    icon: Calendar,
    title: "Pick a Schedule",
    subtitle: "Choose your time",
    description: "Compare departure times, bus companies, seat availability, and fares. Sort by price or time — the choice is yours.",
    accent: "#D97706",          // amber-600
    lightBg: "#FFFBEB",
    borderClr: "#FDE68A",
    preview: <SchedulePreview />,
  },
  {
    num: "03",
    icon: CreditCard,
    title: "Secure Payment",
    subtitle: "Pay your way",
    description: "Pay instantly via Airtel Money, TNM Mpamba, Visa/Mastercard, or opt for Cash on Boarding — all secured end-to-end.",
    accent: "#059669",          // emerald-600
    lightBg: "#ECFDF5",
    borderClr: "#A7F3D0",
    preview: <PaymentPreview />,
  },
  {
    num: "04",
    icon: Ticket,
    title: "Board & Travel",
    subtitle: "Show e-ticket & go",
    description: "Your digital ticket arrives instantly. Show the QR code at boarding and settle in for a comfortable ride across Malawi.",
    accent: "#7C3AED",          // violet-600
    lightBg: "#F5F3FF",
    borderClr: "#DDD6FE",
    preview: <TicketPreview />,
  },
];

// ─── Mini preview components ─────────────────────────────────────────────────

function SearchPreview() {
  return (
    <div className="space-y-2 w-full">
      <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 border border-blue-100 shadow-sm">
        <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
        <span className="text-xs font-semibold text-gray-800">Blantyre</span>
      </div>
      <div className="flex justify-center"><div className="w-px h-3 bg-blue-200" /></div>
      <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 border border-blue-100 shadow-sm">
        <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
        <span className="text-xs font-semibold text-gray-800">Lilongwe</span>
      </div>
      <div className="flex items-center justify-between bg-blue-600 rounded-xl px-3 py-2 mt-1">
        <span className="text-xs font-bold text-white">Search Buses</span>
        <Search className="w-3.5 h-3.5 text-blue-200" />
      </div>
    </div>
  );
}

function SchedulePreview() {
  const options = [
    { time: "07:00", company: "AXA Coach", seats: 12, price: "MWK 5,500", hot: true },
    { time: "10:30", company: "Shire Bus",  seats: 28, price: "MWK 4,800" },
  ];
  return (
    <div className="space-y-2 w-full">
      {options.map((o, i) => (
        <div key={i} className={`flex items-center gap-2.5 bg-white rounded-xl px-3 py-2.5 border shadow-sm transition-all ${i === 0 ? "border-amber-300 ring-1 ring-amber-200" : "border-gray-100"}`}>
          <div className="text-center shrink-0">
            <p className="text-xs font-bold text-gray-900">{o.time}</p>
            <p className="text-[10px] text-gray-400">AM</p>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-800 truncate">{o.company}</p>
            <p className="text-[10px] text-gray-400">{o.seats} seats left</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs font-bold text-amber-600">{o.price}</p>
            {o.hot && <span className="text-[9px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded-full font-semibold">Best</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function PaymentPreview() {
  const methods = [
    { label: "Airtel Money", icon: Smartphone, active: true, clr: "text-red-500", bg: "bg-red-50 border-red-200" },
    { label: "TNM Mpamba",   icon: Smartphone, active: false, clr: "text-blue-500", bg: "bg-blue-50 border-blue-100" },
    { label: "Card",         icon: CreditCard, active: false, clr: "text-gray-500", bg: "bg-gray-50 border-gray-200" },
    { label: "Cash",         icon: Banknote,   active: false, clr: "text-gray-500", bg: "bg-gray-50 border-gray-200" },
  ];
  return (
    <div className="space-y-1.5 w-full">
      {methods.map((m, i) => (
        <div key={i} className={`flex items-center gap-2.5 rounded-xl px-3 py-2 border ${m.bg} transition-all`}>
          <m.icon className={`w-3.5 h-3.5 shrink-0 ${m.clr}`} />
          <span className={`text-xs font-semibold ${m.active ? "text-gray-900" : "text-gray-500"}`}>{m.label}</span>
          {m.active && <CheckCircle className="w-3.5 h-3.5 text-emerald-500 ml-auto" />}
        </div>
      ))}
      <div className="flex items-center justify-between bg-emerald-600 rounded-xl px-3 py-2 mt-0.5">
        <span className="text-xs font-bold text-white">Confirm Payment</span>
        <span className="text-xs font-bold text-emerald-200">MWK 5,500</span>
      </div>
    </div>
  );
}

function TicketPreview() {
  return (
    <div className="w-full bg-white rounded-xl border border-violet-200 shadow-sm overflow-hidden">
      {/* Header strip */}
      <div className="bg-violet-600 px-3 py-2 flex items-center justify-between">
        <span className="text-xs font-bold text-white">TibhukeBus</span>
        <CheckCircle className="w-3.5 h-3.5 text-violet-200" />
      </div>
      <div className="px-3 py-2.5 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="text-center">
            <p className="font-bold text-gray-900">BLT</p>
            <p className="text-[10px] text-gray-400">Blantyre</p>
          </div>
          <div className="flex flex-col items-center gap-0.5 flex-1 px-2">
            <div className="flex items-center w-full gap-1">
              <div className="flex-1 h-px bg-violet-200"/>
              <ArrowRight className="w-3 h-3 text-violet-400"/>
              <div className="flex-1 h-px bg-violet-200"/>
            </div>
            <span className="text-[10px] text-gray-400">4h 30m</span>
          </div>
          <div className="text-center">
            <p className="font-bold text-gray-900">LLW</p>
            <p className="text-[10px] text-gray-400">Lilongwe</p>
          </div>
        </div>
        {/* QR placeholder */}
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded bg-gray-100 grid grid-cols-3 gap-0.5 p-1 shrink-0">
            {Array(9).fill(0).map((_,i) => (
              <div key={i} className={`rounded-sm ${[0,2,4,6,8].includes(i) ? "bg-violet-600" : "bg-gray-200"}`} />
            ))}
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-800">Seat 12A · Economy</p>
            <p className="text-[10px] text-gray-400">07:00 AM · 12 Apr</p>
            <p className="text-[10px] text-violet-600 font-semibold">#TB-4821</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const HowItWorks = () => {
  const router = useRouter();
  const { ref, visible } = useInView(0.1);
  const [activeStep, setActiveStep] = useState(0);

  // Auto-cycle active step for subtle engagement
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setActiveStep(s => (s + 1) % STEPS.length), 3200);
    return () => clearInterval(id);
  }, [visible]);

  return (
    <section
      ref={ref}
      className="relative py-20 overflow-hidden"
      style={{ background: "linear-gradient(160deg,#f8fafc 0%,#eff6ff 50%,#f5f3ff 100%)" }}
      aria-label="How TibhukeBus Works"
    >
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-blue-100/60 blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-violet-100/50 blur-3xl translate-y-1/2 -translate-x-1/3" />
        {/* Subtle dot grid */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.035]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.5" fill="#64748b" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div
          className="text-center mb-14 transition-all duration-700"
          style={{ opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(20px)" }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-widest mb-4 border border-blue-200">
            <Clock className="w-3.5 h-3.5" /> Book in under 2 minutes
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 tracking-tight mb-4"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            How{" "}
            <span className="relative inline-block">
              <span className="relative z-10 text-blue-600">TibhukeBus</span>
              <span className="absolute bottom-1 left-0 w-full h-3 bg-blue-100 rounded-sm -z-0" />
            </span>{" "}
            Works
          </h2>
          <p className="text-gray-500 text-base sm:text-lg max-w-lg mx-auto leading-relaxed">
            Four simple steps from search to seat — the whole thing takes less time than waiting in a queue.
          </p>
        </div>

        {/* ── Step cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-14">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const isActive = activeStep === i;
            const delay = `${i * 120}ms`;

            return (
              <div
                key={i}
                onMouseEnter={() => setActiveStep(i)}
                className="relative flex flex-col transition-all duration-500 cursor-default"
                style={{
                  opacity: visible ? 1 : 0,
                  transform: visible ? "none" : "translateY(28px)",
                  transitionDelay: delay,
                }}
              >
                {/* Connector line (lg only) */}
                {i < STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-[52px] left-[calc(100%-8px)] w-[calc(100%-48px+16px)] h-px z-10"
                    style={{ background: `linear-gradient(90deg,${step.accent}55,${STEPS[i+1].accent}33)` }}
                  >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full" style={{ background: STEPS[i+1].accent }} />
                  </div>
                )}

                {/* Card */}
                <div
                  className="flex flex-col flex-1 rounded-2xl border p-5 transition-all duration-300 group"
                  style={{
                    background: isActive ? step.lightBg : "#fff",
                    borderColor: isActive ? step.accent : "#e5e7eb",
                    boxShadow: isActive
                      ? `0 8px 32px -4px ${step.accent}22, 0 2px 8px -2px ${step.accent}18`
                      : "0 1px 4px 0 rgba(0,0,0,0.06)",
                    transform: isActive ? "translateY(-4px)" : "none",
                  }}
                >
                  {/* Step number + icon */}
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300"
                      style={{
                        background: isActive
                          ? `linear-gradient(135deg,${step.accent},${step.accent}cc)`
                          : step.lightBg,
                      }}
                    >
                      <Icon
                        className="w-5 h-5 transition-colors duration-300"
                        style={{ color: isActive ? "#fff" : step.accent }}
                      />
                    </div>
                    <span
                      className="text-2xl font-black leading-none transition-colors duration-300"
                      style={{ color: isActive ? step.accent : "#e5e7eb", fontFamily: "'Plus Jakarta Sans',sans-serif" }}
                    >
                      {step.num}
                    </span>
                  </div>

                  {/* Text */}
                  <p className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: step.accent }}>{step.subtitle}</p>
                  <h3 className="text-base font-bold text-gray-900 mb-2" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>{step.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed flex-1">{step.description}</p>

                  {/* Mini preview — visible when active */}
                  <div
                    className="mt-4 overflow-hidden transition-all duration-500"
                    style={{ maxHeight: isActive ? "240px" : "0px", opacity: isActive ? 1 : 0 }}
                  >
                    <div className="pt-3 border-t" style={{ borderColor: step.borderClr }}>
                      {step.preview}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Progress indicator (mobile-friendly step tracker) ───────────── */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {STEPS.map((s, i) => (
            <button
              key={i}
              onClick={() => setActiveStep(i)}
              className="transition-all duration-300 rounded-full"
              style={{
                width: activeStep === i ? "28px" : "8px",
                height: "8px",
                background: activeStep === i ? s.accent : "#cbd5e1",
              }}
              aria-label={`Step ${i + 1}: ${s.title}`}
            />
          ))}
        </div>

        {/* ── Bottom CTA ──────────────────────────────────────────────────── */}
        <div
          className="relative rounded-3xl overflow-hidden transition-all duration-700"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "none" : "translateY(20px)",
            transitionDelay: "520ms",
            background: "linear-gradient(135deg,#1e40af 0%,#2563eb 50%,#4f46e5 100%)",
          }}
        >
          {/* Inner decoration */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/5" />
            <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-white/5" />
            <svg className="absolute inset-0 w-full h-full opacity-[0.06]" xmlns="http://www.w3.org/2000/svg">
              <defs><pattern id="cdots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="white"/></pattern></defs>
              <rect width="100%" height="100%" fill="url(#cdots)"/>
            </svg>
          </div>

          <div className="relative flex flex-col sm:flex-row items-center justify-between gap-6 px-8 py-8 sm:py-10">
            <div>
              <p className="text-blue-200 text-sm font-semibold mb-1">Ready to travel?</p>
              <h3
                className="text-white text-2xl sm:text-3xl font-extrabold leading-tight"
                style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}
              >
                Book your next journey<br className="hidden sm:block" /> in minutes.
              </h3>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <button
                onClick={() => router.push("/schedules")}
                className="group flex items-center justify-center gap-2 px-7 py-3.5 bg-white text-blue-700 font-bold rounded-2xl hover:bg-blue-50 transition-all shadow-lg text-sm active:scale-[.97]"
              >
                Find a Bus
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <button
                onClick={() => router.push("/schedules")}
                className="flex items-center justify-center gap-2 px-7 py-3.5 bg-white/15 hover:bg-white/25 border border-white/25 text-white font-semibold rounded-2xl transition-all text-sm active:scale-[.97]"
              >
                Browse All Routes
              </button>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

export default HowItWorks;  
