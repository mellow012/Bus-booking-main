"use client";

import React, { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { updateDoc, doc } from "firebase/firestore";
import { db, auth } from "@/lib/firebaseConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Label } from "@/components/ui/Label";
import {
  CreditCard, Bell, Mail, Crown, Save, Settings as SettingsIcon,
  Shield, DollarSign, Edit2, Eye, X, Check, ExternalLink,
  Smartphone, BarChart3, Headphones, Palette, Code2,
  AlertCircle, Phone, MapPin, MessageSquare, Unlink,
  CheckCircle2, Clock, Loader2, KeyRound,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Company {
  id: string;
  paymentSettings?: {
    paychanguEnabled?:          boolean;
    paychanguReceiveNumber?:    string;
    paychanguPublicKey?:        string;
    paychanguSecretKeyEnc?:     string; // AES-256-GCM encrypted blob — safe to store
    stripeEnabled?:             boolean;
    stripeAccountId?:           string;
    stripeOnboardingComplete?:  boolean;
    currency?:                  string;
  };
  notificationSettings?: {
    emailNotifications?: boolean;
    smsNotifications?:   boolean;
    bookingAlerts?:      boolean;
    paymentAlerts?:      boolean;
    systemAlerts?:       boolean;
  };
  contactSettings?: {
    supportEmail?:   string;
    supportPhone?:   string;
    whatsappNumber?: string;
    officeAddress?:  string;
  };
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

type SettingsSection = "payment" | "notifications" | "contact" | "premium";

// ─── Small shared primitives ──────────────────────────────────────────────────

const SectionHeader: React.FC<{
  title: string; description: string; icon: React.ReactNode;
  editMode?: boolean; onToggleEdit?: () => void; hideToggle?: boolean;
}> = ({ title, description, icon, editMode, onToggleEdit, hideToggle }) => (
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
    {!hideToggle && onToggleEdit && (
      <button
        type="button"
        onClick={onToggleEdit}
        className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
          editMode
            ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
            : "bg-blue-50 text-blue-600 hover:bg-blue-100"
        }`}
      >
        {editMode
          ? <><Eye className="w-3.5 h-3.5" /> View</>
          : <><Edit2 className="w-3.5 h-3.5" /> Edit</>}
      </button>
    )}
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

const InfoBox: React.FC<{ children: React.ReactNode; variant?: "info" | "warning" }> = ({
  children, variant = "info",
}) => (
  <div className={`flex items-start gap-2.5 p-3.5 rounded-xl text-sm ${
    variant === "warning"
      ? "bg-amber-50 border border-amber-200 text-amber-800"
      : "bg-blue-50 border border-blue-100 text-blue-800"
  }`}>
    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
    <div>{children}</div>
  </div>
);

const FormFooter: React.FC<{
  loading: boolean; onCancel: () => void;
}> = ({ loading, onCancel }) => (
  <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
    <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
      <X className="w-4 h-4 mr-1.5" /> Cancel
    </Button>
    <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
      {loading
        ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Saving…</>
        : <><Save className="w-4 h-4 mr-1.5" /> Save Changes</>}
    </Button>
  </div>
);

// ─── Payment Settings ─────────────────────────────────────────────────────────
const PaymentSettings: React.FC<{
  company: Company; setCompany: (c: Company) => void;
  setError: (e: string) => void; setSuccess: (s: string) => void;
  loading: boolean; setLoading: (l: boolean) => void;
  editMode: boolean; setEditMode: (m: boolean) => void;
}> = ({ company, setCompany, setError, setSuccess, loading, setLoading, editMode, setEditMode }) => {
  const [stripeWorking,     setStripeWorking]     = useState(false);
  const [onboardingWorking, setOnboardingWorking] = useState(false);
  const [showSecret,        setShowSecret]        = useState(false);

  const secretKeySet = !!company?.paymentSettings?.paychanguSecretKeyEnc;

  const { register, handleSubmit, reset, watch } = useForm({
    defaultValues: {
      paychanguEnabled:       company?.paymentSettings?.paychanguEnabled       ?? false,
      paychanguReceiveNumber: company?.paymentSettings?.paychanguReceiveNumber ?? "",
      paychanguPublicKey:     company?.paymentSettings?.paychanguPublicKey     ?? "",
      paychanguSecretKey:     "", // always blank — never pre-fill with encrypted blob
      currency:               company?.paymentSettings?.currency               ?? "MWK",
    },
  });

  const paychanguOn = watch("paychanguEnabled");
  const stripeId    = company?.paymentSettings?.stripeAccountId;
  const stripeOk    = !!company?.paymentSettings?.stripeOnboardingComplete;
  const stripeLinked = !!stripeId;

  // ── Stripe handlers ───────────────────────────────────────────────────────
  const handleStripeConnect = async () => {
    setStripeWorking(true);
    try {
      const res  = await fetch(`/api/payments/stripe/connect?companyId=${company.id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not start Stripe connection");
      window.location.href = json.url;
    } catch (err: any) {
      setError(err.message);
      setStripeWorking(false);
    }
  };

  const handleStripeOnboarding = async () => {
    setOnboardingWorking(true);
    try {
      const res  = await fetch(`/api/payments/stripe/onboarding-link?companyId=${company.id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not generate onboarding link");
      window.location.href = json.url;
    } catch (err: any) {
      setError(err.message);
      setOnboardingWorking(false);
    }
  };

  const handleStripeDisconnect = async () => {
    if (!confirm("Disconnect Stripe? Card payments will stop until you reconnect.")) return;
    setStripeWorking(true);
    try {
      const res = await fetch("/api/payments/stripe/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: company.id }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Disconnect failed");
      }
      setCompany({
        ...company,
        paymentSettings: {
          ...company.paymentSettings,
          stripeEnabled: false, stripeAccountId: undefined, stripeOnboardingComplete: false,
        },
      });
      setSuccess("Stripe account disconnected");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setStripeWorking(false);
    }
  };

  // ── PayChangu save ────────────────────────────────────────────────────────
  const onSubmit = async (data: any) => {
    setLoading(true); setError(""); setSuccess("");
    try {
      if (data.paychanguEnabled) {
        if (!data.paychanguReceiveNumber?.trim())
          throw new Error("Receive number is required");
        if (!data.paychanguPublicKey?.trim())
          throw new Error("Public key is required");
        if (!data.paychanguPublicKey.toLowerCase().startsWith("pub-"))
          throw new Error('Public key must start with "pub-"');
        // Secret key required on first save
        if (!secretKeySet && !data.paychanguSecretKey?.trim())
          throw new Error("Secret key is required for first-time setup");
        if (data.paychanguSecretKey?.trim() && !data.paychanguSecretKey.trim().toLowerCase().startsWith("sec-"))
          throw new Error('Secret key must start with "sec-"');
      }

      // Encrypt the secret key server-side if provided
      let paychanguSecretKeyEnc: string | null =
        company.paymentSettings?.paychanguSecretKeyEnc ?? null;

      if (data.paychanguSecretKey?.trim()) {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) throw new Error("Not authenticated — please sign in again");

        const res = await fetch("/api/admin/encrypt-paychangu-key", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            companyId: company.id,
            secretKey: data.paychanguSecretKey.trim().toLowerCase(),
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to encrypt secret key");
        }
        const json = await res.json();
        paychanguSecretKeyEnc = json.encrypted;
      }

      // Build update — use null instead of undefined (Firestore rejects undefined)
      const updated: Record<string, any> = {
        paychanguEnabled:         data.paychanguEnabled,
        paychanguSecretKeyEnc:    paychanguSecretKeyEnc,
        currency:                 data.currency || "MWK",
        stripeEnabled:            company.paymentSettings?.stripeEnabled            ?? false,
        stripeAccountId:          company.paymentSettings?.stripeAccountId          ?? null,
        stripeOnboardingComplete: company.paymentSettings?.stripeOnboardingComplete ?? false,
      };

      if (data.paychanguEnabled) {
        updated.paychanguReceiveNumber = data.paychanguReceiveNumber.trim();
        updated.paychanguPublicKey     = data.paychanguPublicKey.toLowerCase().trim();
      }

      await updateDoc(doc(db, "companies", company.id), { paymentSettings: updated });
      setCompany({ ...company, paymentSettings: updated });
      setSuccess("Payment settings saved");
      setEditMode(false);
    } catch (err: any) {
      setError(err.message || "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  // ── View mode ─────────────────────────────────────────────────────────────
  if (!editMode) {
    return (
      <div className="space-y-5">
        <SectionHeader
          title="Payment Gateways" description="Your connected payment methods"
          icon={<DollarSign className="w-5 h-5" />}
          editMode={false} onToggleEdit={() => setEditMode(true)}
        />

        {!company.paymentSettings?.paychanguEnabled && !stripeLinked && (
          <div className="text-center py-14 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <CreditCard className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500">No payment gateways configured</p>
            <p className="text-xs text-gray-400 mt-1">Click Edit to connect PayChangu or Stripe</p>
          </div>
        )}

        {/* PayChangu card */}
        {company.paymentSettings?.paychanguEnabled && (
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                  <Smartphone className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">PayChangu</p>
                  <p className="text-xs text-gray-500">Mobile Money · Airtel &amp; TNM</p>
                </div>
              </div>
              <StatusPill active activeLabel="Connected" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-gray-100">
              <div className="bg-white px-5 py-3.5">
                <p className="text-xs text-gray-400 mb-0.5">Receive Number</p>
                <p className="text-sm font-medium text-gray-900">
                  {company.paymentSettings.paychanguReceiveNumber}
                </p>
              </div>
              <div className="bg-white px-5 py-3.5">
                <p className="text-xs text-gray-400 mb-0.5">Public Key</p>
                <p className="text-sm font-mono text-gray-900">
                  {company.paymentSettings.paychanguPublicKey?.slice(0, 8)}{"•".repeat(8)}
                </p>
              </div>
              <div className="bg-white px-5 py-3.5">
                <p className="text-xs text-gray-400 mb-0.5">Secret Key</p>
                <div className="flex items-center gap-1.5">
                  {secretKeySet
                    ? <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /><p className="text-sm text-emerald-700 font-medium">Stored encrypted</p></>
                    : <><AlertCircle className="w-3.5 h-3.5 text-amber-500" /><p className="text-sm text-amber-600">Not set</p></>}
                </div>
              </div>
              <div className="bg-white px-5 py-3.5">
                <p className="text-xs text-gray-400 mb-0.5">Currency</p>
                <p className="text-sm font-medium text-gray-900">
                  {company.paymentSettings.currency || "MWK"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stripe card */}
        {stripeLinked && (
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Stripe</p>
                  <p className="text-xs text-gray-500">Credit &amp; Debit Cards</p>
                </div>
              </div>
              <StatusPill active={stripeOk} activeLabel="Active" inactiveLabel="Onboarding pending" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-gray-100">
              <div className="bg-white px-5 py-3.5">
                <p className="text-xs text-gray-400 mb-0.5">Connected Account</p>
                <p className="text-sm font-mono text-gray-900">{stripeId}</p>
              </div>
              <div className="bg-white px-5 py-3.5">
                <p className="text-xs text-gray-400 mb-0.5">Secret Key</p>
                <p className="text-sm text-gray-400 italic">Secured in server env vars</p>
              </div>
            </div>
            {!stripeOk && (
              <div className="px-5 py-3 bg-amber-50 border-t border-amber-100 flex items-center gap-2 text-xs text-amber-700">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                Stripe onboarding incomplete — card payments are not yet active.
                <button type="button" onClick={handleStripeOnboarding} disabled={onboardingWorking}
                  className="font-semibold underline ml-1 disabled:opacity-50">
                  {onboardingWorking
                    ? <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Loading…</span>
                    : "Complete onboarding →"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Edit mode ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Payment Gateways" description="Connect how you collect payments"
        icon={<DollarSign className="w-5 h-5" />}
        editMode={true} onToggleEdit={() => { reset(); setEditMode(false); }}
      />

      <InfoBox>
        <p className="font-semibold mb-0.5">Industry-standard security</p>
        Secret keys are encrypted with AES-256-GCM before storage — the plaintext never
        touches the database. Public keys and receive numbers are safe to store as-is.
      </InfoBox>

      {/* ── Stripe Connect block ── */}
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 bg-gray-50 border-b border-gray-200">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
            <CreditCard className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Stripe</p>
            <p className="text-xs text-gray-500">Credit &amp; Debit Cards — connected via OAuth</p>
          </div>
          {stripeLinked
            ? <StatusPill active={stripeOk} activeLabel="Connected" inactiveLabel="Pending" />
            : <StatusPill active={false} inactiveLabel="Not connected" />}
        </div>
        <div className="px-5 py-5 space-y-4">
          {stripeLinked ? (
            <>
              <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 px-3.5 py-3 rounded-lg border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Connected as <span className="font-mono font-semibold ml-1">{stripeId}</span>
              </div>
              {!stripeOk && (
                <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-3.5 py-3 rounded-lg border border-amber-200">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>Onboarding incomplete — card payments disabled until verified.</span>
                  <button type="button" onClick={handleStripeOnboarding} disabled={onboardingWorking}
                    className="ml-auto text-xs font-semibold underline shrink-0 disabled:opacity-50">
                    {onboardingWorking
                      ? <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Loading…</span>
                      : "Continue →"}
                  </button>
                </div>
              )}
              <button type="button" onClick={handleStripeDisconnect} disabled={stripeWorking}
                className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-medium disabled:opacity-50 transition-colors">
                {stripeWorking
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Disconnecting…</>
                  : <><Unlink className="w-3.5 h-3.5" /> Disconnect Stripe account</>}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                Connect your Stripe account via OAuth — no keys to copy or paste.
              </p>
              <Button type="button" onClick={handleStripeConnect} disabled={stripeWorking}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                {stripeWorking
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting to Stripe…</>
                  : <><ExternalLink className="w-4 h-4" /> Connect with Stripe</>}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── PayChangu form ── */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 bg-gray-50 border-b border-gray-200">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <Smartphone className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">PayChangu</p>
              <p className="text-xs text-gray-500">Mobile Money · Airtel Money &amp; TNM Mpamba</p>
            </div>
            {/* Toggle */}
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" {...register("paychanguEnabled")} className="sr-only peer" />
              <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 transition-colors
                after:content-[''] after:absolute after:top-0.5 after:left-0.5
                after:bg-white after:rounded-full after:h-4 after:w-4
                after:transition-all peer-checked:after:translate-x-4" />
            </label>
          </div>

          {paychanguOn && (
            <div className="px-5 py-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Receive number */}
                <div>
                  <Label htmlFor="paychanguReceiveNumber" className="text-xs font-medium text-gray-700 mb-1.5 block">
                    Receive Number <span className="text-red-500">*</span>
                  </Label>
                  <Input id="paychanguReceiveNumber" {...register("paychanguReceiveNumber")}
                    placeholder="+265 991 234 567" className="h-9 text-sm" />
                  <p className="text-xs text-gray-400 mt-1">Mobile money number where payments land</p>
                </div>

                {/* Public key */}
                <div>
                  <Label htmlFor="paychanguPublicKey" className="text-xs font-medium text-gray-700 mb-1.5 block">
                    Public Key <span className="text-red-500">*</span>
                  </Label>
                  <Input id="paychanguPublicKey" {...register("paychanguPublicKey")}
                    placeholder="pub-xxxxxxxxxxxxxxxxxxxx" className="h-9 text-sm font-mono" />
                  <p className="text-xs text-gray-400 mt-1">
                    Starts with <code className="bg-gray-100 px-1 rounded">pub-</code> or{" "}
                    <code className="bg-gray-100 px-1 rounded">PUB-</code> — normalised to lowercase on save
                  </p>
                </div>

                {/* Secret key */}
                <div className="sm:col-span-2">
                  <Label htmlFor="paychanguSecretKey" className="text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1.5 block">
                    <KeyRound className="w-3.5 h-3.5" />
                    Secret Key
                    {secretKeySet
                      ? <span className="ml-1 inline-flex items-center gap-1 text-emerald-600 font-normal">
                          <CheckCircle2 className="w-3 h-3" /> stored encrypted
                        </span>
                      : <span className="text-red-500 ml-1">*</span>}
                  </Label>
                  <div className="relative">
                    <Input
                      id="paychanguSecretKey"
                      {...register("paychanguSecretKey")}
                      type={showSecret ? "text" : "password"}
                      placeholder={secretKeySet
                        ? "Leave blank to keep existing key"
                        : "sec-xxxxxxxxxxxxxxxxxxxx"}
                      className="h-9 text-sm font-mono pr-14"
                    />
                    <button type="button" onClick={() => setShowSecret(v => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600">
                      {showSecret ? "hide" : "show"}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Starts with <code className="bg-gray-100 px-1 rounded">sec-</code> or{" "}
                    <code className="bg-gray-100 px-1 rounded">SEC-</code> — encrypted with AES-256-GCM before storage.
                    {secretKeySet && " Leave blank to keep the existing encrypted key."}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Currency */}
        <div className="max-w-xs">
          <Label htmlFor="currency" className="text-xs font-medium text-gray-700 mb-1.5 block">
            Default Currency
          </Label>
          <Input id="currency" {...register("currency")} placeholder="MWK" className="h-9 text-sm" />
        </div>

        <FormFooter loading={loading} onCancel={() => { reset(); setEditMode(false); }} />
      </form>
    </div>
  );
};

// ─── Notification Settings ────────────────────────────────────────────────────

const NOTIF_ROWS = [
  {
    group: "Channels",
    items: [
      { name: "emailNotifications" as const, label: "Email", description: "Updates via email" },
      { name: "smsNotifications"   as const, label: "SMS",   description: "Urgent alerts via SMS" },
    ],
  },
  {
    group: "Alert Types",
    items: [
      { name: "bookingAlerts" as const, label: "Booking Alerts", description: "New bookings and cancellations" },
      { name: "paymentAlerts" as const, label: "Payment Alerts", description: "Payments received and processed" },
      { name: "systemAlerts"  as const, label: "System Alerts",  description: "Platform updates and announcements" },
    ],
  },
];

const NotificationSettings: React.FC<{
  company: Company; setCompany: (c: Company) => void;
  setError: (e: string) => void; setSuccess: (s: string) => void;
  loading: boolean; setLoading: (l: boolean) => void;
  editMode: boolean; setEditMode: (m: boolean) => void;
}> = ({ company, setCompany, setError, setSuccess, loading, setLoading, editMode, setEditMode }) => {
  const { control, handleSubmit } = useForm({
    defaultValues: {
      emailNotifications: company?.notificationSettings?.emailNotifications ?? true,
      smsNotifications:   company?.notificationSettings?.smsNotifications   ?? false,
      bookingAlerts:      company?.notificationSettings?.bookingAlerts      ?? true,
      paymentAlerts:      company?.notificationSettings?.paymentAlerts      ?? true,
      systemAlerts:       company?.notificationSettings?.systemAlerts       ?? true,
    },
  });

  const onSubmit = async (data: any) => {
    setLoading(true); setError(""); setSuccess("");
    try {
      await updateDoc(doc(db, "companies", company.id), { notificationSettings: data });
      setCompany({ ...company, notificationSettings: data });
      setSuccess("Notification settings saved");
      setEditMode(false);
    } catch (err: any) {
      setError(err.message || "Failed to save");
    } finally { setLoading(false); }
  };

  const ns = company?.notificationSettings;

  if (!editMode) {
    return (
      <div className="space-y-5">
        <SectionHeader title="Notification Preferences" description="How you receive alerts and updates"
          icon={<Bell className="w-5 h-5" />} editMode={false} onToggleEdit={() => setEditMode(true)} />
        {NOTIF_ROWS.map(group => (
          <div key={group.group}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{group.group}</p>
            <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
              {group.items.map(item => (
                <div key={item.name} className="flex items-center justify-between px-4 py-3.5 bg-white">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.label}</p>
                    <p className="text-xs text-gray-500">{item.description}</p>
                  </div>
                  <StatusPill active={!!(ns as any)?.[item.name]} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SectionHeader title="Notification Preferences" description="Choose how you want to be notified"
        icon={<Bell className="w-5 h-5" />} editMode={true} onToggleEdit={() => setEditMode(false)} />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {NOTIF_ROWS.map(group => (
          <div key={group.group}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{group.group}</p>
            <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
              {group.items.map(item => (
                <Controller key={item.name} name={item.name} control={control}
                  render={({ field }) => (
                    <label htmlFor={item.name}
                      className="flex items-center gap-4 px-4 py-3.5 bg-white hover:bg-gray-50 cursor-pointer">
                      <Checkbox id={item.name} checked={field.value}
                        onCheckedChange={v => field.onChange(v)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{item.label}</p>
                        <p className="text-xs text-gray-500">{item.description}</p>
                      </div>
                    </label>
                  )}
                />
              ))}
            </div>
          </div>
        ))}
        <FormFooter loading={loading} onCancel={() => setEditMode(false)} />
      </form>
    </div>
  );
};

// ─── Contact Settings ─────────────────────────────────────────────────────────

const ContactSettings: React.FC<{
  company: Company; setCompany: (c: Company) => void;
  setError: (e: string) => void; setSuccess: (s: string) => void;
  loading: boolean; setLoading: (l: boolean) => void;
  editMode: boolean; setEditMode: (m: boolean) => void;
}> = ({ company, setCompany, setError, setSuccess, loading, setLoading, editMode, setEditMode }) => {
  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      supportEmail:   company?.contactSettings?.supportEmail   || "",
      supportPhone:   company?.contactSettings?.supportPhone   || "",
      whatsappNumber: company?.contactSettings?.whatsappNumber || "",
      officeAddress:  company?.contactSettings?.officeAddress  || "",
    },
  });

  const onSubmit = async (data: any) => {
    setLoading(true); setError(""); setSuccess("");
    try {
      await updateDoc(doc(db, "companies", company.id), { contactSettings: data });
      setCompany({ ...company, contactSettings: data });
      setSuccess("Contact information saved");
      setEditMode(false);
    } catch (err: any) {
      setError(err.message || "Failed to save");
    } finally { setLoading(false); }
  };

  const cs = company?.contactSettings;
  const FIELDS = [
    { key: "supportEmail",   label: "Support Email",   icon: <Mail className="w-4 h-4" />,          value: cs?.supportEmail,   type: "email", placeholder: "support@company.com" },
    { key: "supportPhone",   label: "Support Phone",   icon: <Phone className="w-4 h-4" />,         value: cs?.supportPhone,   type: "tel",   placeholder: "+265 XXX XXX XXX" },
    { key: "whatsappNumber", label: "WhatsApp Number", icon: <MessageSquare className="w-4 h-4" />, value: cs?.whatsappNumber, type: "tel",   placeholder: "+265 XXX XXX XXX" },
    { key: "officeAddress",  label: "Office Address",  icon: <MapPin className="w-4 h-4" />,        value: cs?.officeAddress,  type: "text",  placeholder: "123 Kamuzu Procession Rd, Lilongwe" },
  ];

  if (!editMode) {
    return (
      <div className="space-y-5">
        <SectionHeader title="Contact Information" description="How customers and staff can reach you"
          icon={<Mail className="w-5 h-5" />} editMode={false} onToggleEdit={() => setEditMode(true)} />
        <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
          {FIELDS.map(f => (
            <div key={f.key} className="flex items-center gap-3.5 px-4 py-3.5 bg-white">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 shrink-0">
                {f.icon}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-400">{f.label}</p>
                <p className={`text-sm font-medium truncate ${f.value ? "text-gray-900" : "text-gray-400 italic"}`}>
                  {f.value || "Not set"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SectionHeader title="Contact Information" description="Update your business contact details"
        icon={<Mail className="w-5 h-5" />} editMode={true}
        onToggleEdit={() => { reset(); setEditMode(false); }} />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FIELDS.map(f => (
            <div key={f.key}>
              <Label htmlFor={f.key}
                className="text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1.5 block">
                {f.icon} {f.label}
              </Label>
              <Input id={f.key} {...register(f.key as any)} type={f.type}
                placeholder={f.placeholder} className="h-9 text-sm" />
            </div>
          ))}
        </div>
        <FormFooter loading={loading} onCancel={() => { reset(); setEditMode(false); }} />
      </form>
    </div>
  );
};

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
                  {expiryDate
                    ? `Expires ${new Date(expiryDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
                    : "No expiry date set"}
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
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" /> {f}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 text-center py-12 px-6">
          <div className="w-14 h-14 rounded-2xl bg-yellow-100 flex items-center justify-center mx-auto mb-4">
            <Crown className="w-7 h-7 text-yellow-500" />
          </div>
          <h4 className="text-base font-semibold text-gray-900 mb-1">Upgrade to Premium</h4>
          <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
            Unlock advanced features to grow your business and serve customers better
          </p>
          <Button className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold gap-2">
            <Crown className="w-4 h-4" /> Upgrade Now
          </Button>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          {isPremium ? "Your plan includes" : "What you get with Premium"}
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {PREMIUM_FEATURES.map((f, i) => (
            <div key={i} className={`flex items-start gap-3.5 p-4 rounded-xl border ${
              isPremium ? "border-yellow-200 bg-yellow-50/50" : "border-gray-200 bg-white"
            }`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                isPremium ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"
              }`}>{f.icon}</div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{f.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{f.description}</p>
              </div>
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
  const [activeSection, setActiveSection] = useState<SettingsSection>("payment");
  const [loading, setLoading] = useState(false);

  const [editModes, setEditModes] = useState<Record<SettingsSection, boolean>>({
    payment: false, notifications: false, contact: false, premium: false,
  });

  const editMode    = editModes[activeSection];
  const setEditMode = (m: boolean) =>
    setEditModes(prev => ({ ...prev, [activeSection]: m }));

  const tabs = [
    { id: "payment"       as const, label: "Payments",      Icon: CreditCard },
    { id: "notifications" as const, label: "Notifications", Icon: Bell       },
    { id: "contact"       as const, label: "Contact",       Icon: Mail       },
    { id: "premium"       as const, label: "Premium",       Icon: Crown      },
  ];

  const shared = { company, setCompany, setError, setSuccess, loading, setLoading, editMode, setEditMode };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
          <SettingsIcon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Settings</h2>
          <p className="text-sm text-gray-500">Manage your company configuration</p>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex overflow-x-auto">
          {tabs.map(({ id, label, Icon }) => {
            const active = activeSection === id;
            return (
              <button key={id} onClick={() => setActiveSection(id)}
                className={`flex items-center gap-2 px-5 py-3.5 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                  active
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}>
                <Icon className="w-4 h-4" /> {label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {activeSection === "payment"       && <PaymentSettings      {...shared} />}
        {activeSection === "notifications" && <NotificationSettings {...shared} />}
        {activeSection === "contact"       && <ContactSettings      {...shared} />}
        {activeSection === "premium"       && (
          <PremiumFeatures company={company} setCompany={setCompany}
            setError={setError} setSuccess={setSuccess} />
        )}
      </div>
    </div>
  );
};

export default SettingsTab;