// src/components/SettingsTab.tsx
"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Mail, Crown, Save, Settings as SettingsIcon,
  Check,
  BarChart3, Headphones, Palette, Code2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Company {
  id: string;
  premiumFeatures?: {
    isActive?:   boolean;
    expiryDate?: Date;
    features?:   string[];
  };
}

interface SettingsTabProps {
  company:    Company;
  setCompany: (c: Company) => void;
  setError:   (e: string)  => void;
  setSuccess: (s: string)  => void;
}

type SettingsSection = "premium";

// ─── Small shared primitives ──────────────────────────────────────────────────

const SectionHeader: React.FC<{
  title: string; description: string; icon: React.ReactNode; hideToggle?: boolean;
}> = ({ title, description, icon, hideToggle }) => (
  <div className="flex items-start justify-between gap-4 pb-5 mb-6 border-b border-gray-100">
    <div className="flex items-center gap-3.5">
      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
        {icon}
      </div>
      <div>
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500 mt-0.5">{description}</p>
      </div>
    </div>
  </div>
);

const StatusPill: React.FC<{
  active: boolean; activeLabel?: string; inactiveLabel?: string;
}> = ({ active, activeLabel = "Enabled", inactiveLabel = "Disabled" }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
    active
      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
      : "bg-gray-100 text-gray-500"
  }`}>
    <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-gray-400"}`} />
    {active ? activeLabel : inactiveLabel}
  </span>
);

// ─── Premium Features ─────────────────────────────────────────────────────────

const PREMIUM_FEATURES = [
  { icon: <BarChart3 className="w-5 h-5" />,  title: "Analytics Dashboard", description: "Advanced revenue reporting and insights" },
  { icon: <Headphones className="w-5 h-5" />, title: "Priority Support",    description: "24/7 dedicated customer service" },
  { icon: <Palette className="w-5 h-5" />,    title: "Custom Branding",     description: "White-label your booking pages" },
  { icon: <Code2 className="w-5 h-5" />,      title: "API Access",          description: "Integrate with your existing systems" },
];

const PremiumFeatures: React.FC<{
  company: Company; setCompany: (c: Company) => void;
  setError: (e: string) => void; setSuccess: (s: string) => void;
}> = ({ company }) => {
  const isPremium  = company?.premiumFeatures?.isActive;
  const features   = company?.premiumFeatures?.features || [];
  const expiryDate = company?.premiumFeatures?.expiryDate;

  return (
    <div className="space-y-5">
      <SectionHeader title="Premium Features" description="Unlock advanced capabilities for your business"
        icon={<Crown className="w-5 h-5" />} hideToggle />
      {isPremium ? (
        <div className="rounded-xl border-2 border-yellow-200 bg-gradient-to-br from-yellow-50 to-orange-50 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-yellow-200">
            <div className="flex items-center gap-3">
              <Crown className="w-6 h-6 text-yellow-600" />
              <div>
                <p className="text-sm font-bold text-gray-900">Premium Active</p>
                <p className="text-xs text-gray-600">
                  {expiryDate ? `Expires ${new Date(expiryDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}` : "No expiry date set"}
                </p>
              </div>
            </div>
            <StatusPill active activeLabel="Active" />
          </div>
          {features.length > 0 && (
            <div className="px-5 py-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Active Features</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-700"><Check className="w-4 h-4 text-emerald-600 shrink-0" /> {f}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 text-center py-12 px-6">
          <div className="w-14 h-14 rounded-2xl bg-yellow-100 flex items-center justify-center mx-auto mb-4"><Crown className="w-7 h-7 text-yellow-500" /></div>
          <h4 className="text-base font-semibold text-gray-900 mb-1">Upgrade to Premium</h4>
          <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">Unlock advanced features to grow your business and serve customers better</p>
          <Button className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold gap-2" onClick={() => alert("Premium billing system coming soon!")}>
            <Crown className="w-4 h-4" /> Upgrade Now
          </Button>
        </div>
      )}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{isPremium ? "Your plan includes" : "What you get with Premium"}</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {PREMIUM_FEATURES.map((f, i) => (
            <div key={i} className={`flex items-start gap-3.5 p-4 rounded-xl border ${isPremium ? "border-yellow-200 bg-yellow-50/50" : "border-gray-200 bg-white"}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isPremium ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"}`}>{f.icon}</div>
              <div><p className="text-sm font-semibold text-gray-900">{f.title}</p><p className="text-xs text-gray-500 mt-0.5">{f.description}</p></div>
              {isPremium && <Check className="w-4 h-4 text-emerald-500 ml-auto shrink-0 mt-0.5" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Root component ───────────────────────────────────────────────────────────

const SettingsTab: React.FC<SettingsTabProps> = ({ company, setCompany, setError, setSuccess }) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>("premium");

  const tabs = [
    { id: "premium" as const, label: "Premium", Icon: Crown },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0"><SettingsIcon className="w-5 h-5 text-white" /></div>
        <div><h2 className="text-xl font-bold text-gray-900">Settings</h2><p className="text-sm text-gray-500">Manage your company configuration</p></div>
      </div>
      <div className="border-b border-gray-200">
        <nav className="flex overflow-x-auto">
          {tabs.map(({ id, label, Icon }) => {
            const active = activeSection === id;
            return (
              <button key={id} onClick={() => setActiveSection(id)}
                className={`flex items-center gap-2 px-5 py-3.5 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                  active ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}>
                <Icon className="w-4 h-4" /> {label}
              </button>
            );
          })}
        </nav>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex-1">
        {activeSection === "premium" && <PremiumFeatures company={company} setCompany={setCompany} setError={setError} setSuccess={setSuccess} />}
      </div>
    </div>
  );
};

export default SettingsTab;
