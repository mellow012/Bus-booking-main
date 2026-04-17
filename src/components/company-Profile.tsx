// src/components/company-Profile.tsx
"use client";

import { FC, useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import {
  Building2, Edit3, Save, Camera, Loader2,
  Clock, Calendar, MapPin, Plus, X,
  Phone, Mail, FileText, Globe, CheckCircle,
  Truck, Route as RouteIcon, Users
} from "lucide-react";
import { OperatingHours, Company } from "@/types";
import { Button } from "@/components/ui/button";
import { uploadLogo } from "@/utils/supabase/storage-utils";
import { toast } from "react-hot-toast";

interface CompanyProfileTabProps {
  company: Company | null;
  setCompany: React.Dispatch<React.SetStateAction<Company | null>>;
  schedules?: any[];
  routes?: any[];
  setError: (msg: string) => void;
  setSuccess: (msg: string) => void;
}

const DEFAULT_HOURS: Record<string, OperatingHours> = {
  Monday: { open: "08:00", close: "17:00", closed: false },
  Tuesday: { open: "08:00", close: "17:00", closed: false },
  Wednesday: { open: "08:00", close: "17:00", closed: false },
  Thursday: { open: "08:00", close: "17:00", closed: false },
  Friday: { open: "08:00", close: "17:00", closed: false },
  Saturday: { open: "09:00", close: "13:00", closed: false },
  Sunday: { open: "08:00", close: "17:00", closed: false },
};

const parseBranches = (data: any): string[] => {
  if (!data) return [];
  if (Array.isArray(data)) return data.filter(b => typeof b === "string").map(b => b.trim());
  if (typeof data === "string") return data.split(",").map(b => b.trim()).filter(Boolean);
  return [];
};

const CompanyProfileTab: FC<CompanyProfileTabProps> = ({
  company, setCompany, schedules = [], routes = [], setError, setSuccess
}) => {
  const { userProfile, refreshUserProfile } = useAuth();
  const router = useRouter();

  const [editData, setEditData] = useState<Company | null>(company);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(company?.logo || null);
  const [actionLoading, setActionLoading] = useState(false);
  const [isInitialSetup, setIsInitialSetup] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newBranch, setNewBranch] = useState("");
  const [branches, setBranches] = useState<string[]>(company ? parseBranches(company.branches) : []);

  const todaysSchedules = (schedules || []).filter(s => {
    const d = new Date(s.departureDateTime);
    return d.toDateString() === new Date().toDateString();
  });

  useEffect(() => {
    if (userProfile && !userProfile.setupCompleted) {
      setIsInitialSetup(true); setIsEditing(true); setEditData(company);
    }
  }, [userProfile, company]);

  useEffect(() => {
    if (company?.branches) setBranches(parseBranches(company.branches));
  }, [company?.branches]);

  const handleAddBranch = () => {
    const t = newBranch.trim();
    if (!t) { toast.error("Branch name cannot be empty"); return; }
    if (branches.includes(t)) { toast.error("This branch already exists"); return; }
    setBranches([...branches, t]); setNewBranch("");
  };

  const handleRemoveBranch = (b: string) => setBranches(branches.filter(x => x !== b));

  const handleHoursChange = (day: string, field: keyof OperatingHours, value: any) =>
    setEditData(prev => prev ? {
      ...prev,
      operatingHours: {
        ...(prev.operatingHours || DEFAULT_HOURS),
        [day]: { ...(prev.operatingHours?.[day] || DEFAULT_HOURS[day]), [field]: value },
      },
    } : prev);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editData || !userProfile) return;
    if (branches.length === 0) { setError("Please add at least one branch/region"); return; }

    setActionLoading(true);
    try {
      // Step 1: Upload logo to Supabase Storage if changed
      let logoUrl = editData.logo || null;
      if (logoFile) {
        logoUrl = await uploadLogo(logoFile, editData.id);
      }

      // Step 2: Update company via unified API
      const payload = {
        phone: editData.contact,
        address: editData.address,
        description: editData.description,
        logo: logoUrl,
        branches: branches,
        operatingHours: editData.operatingHours || DEFAULT_HOURS,
        contactSettings: {
          branding: (editData as any).brandColors || { primary: "#312e81", secondary: "#1e3a8a" }
        }
      };

      const res = await fetch("/api/company/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: editData.id,
          updates: payload,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update company");
      }

      const json = await res.json();

      // Step 3: Mark setup completed if necessary
      if (isInitialSetup) {
        await fetch("/api/auth/complete-setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId: editData.id }),
        });
      }

      setCompany(json.company);
      setLogoFile(null);
      setSuccess("Profile updated successfully!");
      setIsEditing(false);

      if (isInitialSetup) {
        await refreshUserProfile();
        router.push("/company/admin");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to update profile");
    } finally { setActionLoading(false); }
  };

  if (!company) return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <Loader2 className="animate-spin mb-4 w-10 h-10" />
      <p className="font-medium text-sm">Loading your profile...</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-gray-900 tracking-tight">Company Profile</h1>
          <p className="text-[13px] text-gray-500 font-medium">Manage your company details and operating hours.</p>
        </div>
        {!isEditing && (
          <button
            onClick={() => { setIsEditing(true); setEditData(company); }}
            className="bg-indigo-900 hover:bg-indigo-800 text-white px-5 py-2.5 rounded-md text-sm font-semibold transition-colors shadow-sm flex items-center gap-2"
          >
            <Edit3 className="w-4 h-4" /> Edit Profile
          </button>
        )}
      </div>

      {/* ── Profile Header Card ── */}
      <div className="bg-white rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
        {/* Banner */}
        <div className="h-32 bg-gradient-to-r from-indigo-900 via-indigo-800 to-blue-900 relative">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          <div className="absolute bottom-4 left-32 ml-4 hidden sm:block">
            <h2 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-md">{company.name}</h2>
          </div>
        </div>

        {/* Profile Info */}
        <div className="px-6 pb-6 relative">
          <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-end -mt-10">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-24 h-24 rounded-xl bg-white p-1 shadow-lg border-4 border-white">
                <img
                  src={logoPreview || company.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(company.name || "C")}&background=312e81&color=fff&size=128`}
                  className="w-full h-full rounded-lg object-cover" alt="Company Logo"
                />
              </div>
              {isEditing && (
                <label className="absolute -bottom-1 -right-1 bg-indigo-900 text-white p-1.5 rounded-lg shadow-lg cursor-pointer hover:bg-indigo-800 transition-colors">
                  <Camera className="w-3.5 h-3.5" />
                  <input type="file" className="hidden" accept="image/*" onChange={e => {
                    const f = e.target.files?.[0]; if (!f) return;
                    setLogoFile(f); setLogoPreview(URL.createObjectURL(f));
                  }} />
                </label>
              )}
            </div>

            {/* Name & Status */}
            <div className="flex-1 pt-2 min-w-0">
              <h2 className="text-2xl font-extrabold text-gray-900 sm:hidden">{company.name}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase rounded-full ${company.status === "active"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-600"
                  }`}>
                  <CheckCircle className="w-3 h-3" /> {company.status || "Active"}
                </span>
                <span className="px-2.5 py-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 rounded-full">
                  {branches.length} {branches.length === 1 ? "Branch" : "Branches"}
                </span>
                <span className="px-2.5 py-1 text-[10px] font-bold text-blue-700 bg-blue-50 rounded-full">
                  {routes.length} Routes
                </span>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex gap-4 pt-2 shrink-0">
              {[
                { icon: Truck, value: String(todaysSchedules.length), label: "Today" },
                { icon: RouteIcon, value: String(routes.filter((r: any) => r.isActive).length), label: "Active" },
              ].map(({ icon: Icon, value, label }) => (
                <div key={label} className="text-center">
                  <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center mx-auto mb-1">
                    <Icon className="w-4 h-4 text-gray-500" />
                  </div>
                  <p className="text-sm font-extrabold text-gray-900">{value}</p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {isEditing ? (
        /* ── EDITING MODE ── */
        <form onSubmit={handleUpdate} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* General Info */}
            <div className="bg-white rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-gray-100 p-6">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-5">
                <div className="p-1.5 rounded-lg bg-blue-50"><Building2 className="w-4 h-4 text-blue-600" /></div>
                General Information
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Company Name</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm font-semibold"
                      value={editData?.name || ""}
                      onChange={e => setEditData(prev => prev ? { ...prev, name: e.target.value } : null)}
                      placeholder="e.g., Tibhuke Bus Services"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm font-medium"
                      value={editData?.contact || ""}
                      onChange={e => setEditData(prev => prev ? { ...prev, contact: e.target.value } : null)}
                      placeholder="e.g., +265 999 123 456"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Physical Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm font-medium"
                      value={editData?.address || ""}
                      onChange={e => setEditData(prev => prev ? { ...prev, address: e.target.value } : null)}
                      placeholder="e.g., Area 3, Lilongwe"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Branding & Aesthetic */}
            <div className="bg-white rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-gray-100 p-6">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-5">
                <div className="p-1.5 rounded-lg bg-indigo-50"><Camera className="w-4 h-4 text-indigo-600" /></div>
                Branding & Aesthetic
              </h3>
              <p className="text-xs text-gray-500 mb-6">These colors will be used for your tickets and dashboard highlights.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Primary Brand Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      className="w-12 h-12 rounded-lg border-none cursor-pointer p-0 overflow-hidden"
                      value={(editData as any)?.brandColors?.primary || "#312e81"}
                      onChange={e => setEditData(prev => prev ? {
                        ...prev,
                        brandColors: { ...(prev as any).brandColors, primary: e.target.value }
                      } : null)}
                    />
                    <div className="flex-1">
                      <input
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono"
                        value={(editData as any)?.brandColors?.primary || "#312e81"}
                        onChange={e => setEditData(prev => prev ? {
                          ...prev,
                          brandColors: { ...(prev as any).brandColors, primary: e.target.value }
                        } : null)}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Secondary Brand Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      className="w-12 h-12 rounded-lg border-none cursor-pointer p-0 overflow-hidden"
                      value={(editData as any)?.brandColors?.secondary || "#1e3a8a"}
                      onChange={e => setEditData(prev => prev ? {
                        ...prev,
                        brandColors: { ...(prev as any).brandColors, secondary: e.target.value }
                      } : null)}
                    />
                    <div className="flex-1">
                      <input
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono"
                        value={(editData as any)?.brandColors?.secondary || "#1e3a8a"}
                        onChange={e => setEditData(prev => prev ? {
                          ...prev,
                          brandColors: { ...(prev as any).brandColors, secondary: e.target.value }
                        } : null)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-gray-100 p-6">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-5">
                <div className="p-1.5 rounded-lg bg-indigo-50"><FileText className="w-4 h-4 text-indigo-600" /></div>
                Company Bio
              </h3>
              <textarea
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm font-medium h-28 resize-none"
                value={editData?.description || ""}
                onChange={e => setEditData(prev => prev ? { ...prev, description: e.target.value } : null)}
                placeholder="Tell passengers about your company..."
              />
            </div>

            {/* Branches */}
            <div className="bg-white rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-gray-100 p-6">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-5">
                <div className="p-1.5 rounded-lg bg-green-50"><MapPin className="w-4 h-4 text-green-600" /></div>
                Operating Branches
              </h3>
              <div className="flex gap-2 mb-4">
                <input type="text" value={newBranch}
                  onChange={e => setNewBranch(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleAddBranch())}
                  placeholder="e.g., Lilongwe, Blantyre"
                  className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-sm font-medium" />
                <Button type="button" onClick={handleAddBranch} className="px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-1.5 text-sm font-bold">
                  <Plus className="w-4 h-4" /> Add
                </Button>
              </div>
              {branches.length > 0 ? (
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {branches.map((branch, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-lg group hover:bg-green-50 transition-colors border border-gray-100 hover:border-green-200">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-green-100 flex items-center justify-center">
                          <MapPin className="w-3 h-3 text-green-600" />
                        </div>
                        <span className="font-semibold text-sm text-gray-900">{branch}</span>
                      </div>
                      <button type="button" onClick={() => handleRemoveBranch(branch)}
                        className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 rounded-md">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                  <MapPin className="mx-auto text-gray-300 mb-2 w-8 h-8" />
                  <p className="text-sm text-gray-500 font-medium">No branches added yet</p>
                  <p className="text-xs text-gray-400 mt-1">Add the cities where your company operates.</p>
                </div>
              )}
            </div>
          </div>

          {/* Operating Hours */}
          <div className="bg-white rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-gray-100 p-6">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-5">
              <div className="p-1.5 rounded-lg bg-purple-50"><Clock className="w-4 h-4 text-purple-600" /></div>
              Operating Hours
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {Object.keys(DEFAULT_HOURS).map(day => {
                const d = editData?.operatingHours?.[day] || DEFAULT_HOURS[day];
                const isToday = new Date().toLocaleDateString('en-US', { weekday: 'long' }) === day;
                return (
                  <div key={day} className={`p-3 rounded-lg border transition-colors ${isToday ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-100'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-bold ${isToday ? 'text-indigo-700' : 'text-gray-700'}`}>{day}</span>
                      <button type="button" onClick={() => handleHoursChange(day, "closed", !d.closed)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${d.closed ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"
                          }`}>
                        {d.closed ? "CLOSED" : "OPEN"}
                      </button>
                    </div>
                    {!d.closed ? (
                      <div className="flex items-center gap-1.5">
                        <input type="time" value={d.open} onChange={e => handleHoursChange(day, "open", e.target.value)}
                          className="flex-1 px-2 py-1.5 bg-white border border-gray-200 rounded-md text-xs font-medium focus:ring-1 focus:ring-indigo-500 outline-none" />
                        <span className="text-gray-300 text-xs">→</span>
                        <input type="time" value={d.close} onChange={e => handleHoursChange(day, "close", e.target.value)}
                          className="flex-1 px-2 py-1.5 bg-white border border-gray-200 rounded-md text-xs font-medium focus:ring-1 focus:ring-indigo-500 outline-none" />
                      </div>
                    ) : (
                      <p className="text-xs text-red-400 font-medium italic">Not operating</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Save / Cancel Bar */}
          <div className="flex items-center justify-between bg-indigo-50 p-4 rounded-xl border border-indigo-100">
            <p className="text-indigo-700 text-sm font-medium flex items-center gap-2">
              <FileText className="w-4 h-4" /> Unsaved changes — remember to save.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => {
                setIsEditing(false); setLogoFile(null); setLogoPreview(company?.logo || null);
                setBranches(company ? parseBranches(company.branches) : []);
                setEditData(company);
              }} className="px-5 py-2.5 font-semibold text-gray-500 text-sm hover:text-gray-700 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={actionLoading}
                className="bg-indigo-900 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 text-sm hover:bg-indigo-800 disabled:opacity-50 transition-colors">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Profile
              </button>
            </div>
          </div>
        </form>
      ) : (
        /* ── VIEW MODE ── */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Company Details */}
            <div className="bg-white rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-gray-100 p-6">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-5">
                <div className="p-1.5 rounded-lg bg-blue-50"><Building2 className="w-4 h-4 text-blue-600" /></div>
                Company Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { icon: Phone, label: "CONTACT", value: company.contact || "Not set" },
                  { icon: MapPin, label: "ADDRESS", value: company.address || "Not set" },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">{value}</p>
                  </div>
                ))}
              </div>
              {company.description && (
                <div className="mt-4 p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                  <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2">ABOUT</p>
                  <p className="text-sm text-indigo-900 font-medium leading-relaxed">&quot;{company.description}&quot;</p>
                </div>
              )}
            </div>

            {/* Branches */}
            <div className="bg-white rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-gray-100 p-6">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-5">
                <div className="p-1.5 rounded-lg bg-green-50"><MapPin className="w-4 h-4 text-green-600" /></div>
                Operating Branches ({branches.length})
              </h3>
              {branches.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {branches.map((branch, i) => (
                    <div key={i} className="flex items-center gap-2.5 p-3 bg-gray-50 rounded-lg border border-gray-100 hover:bg-green-50 hover:border-green-200 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                        <MapPin className="w-3.5 h-3.5 text-green-600" />
                      </div>
                      <span className="text-sm font-bold text-gray-900">{branch}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                  <MapPin className="mx-auto text-gray-300 mb-2 w-8 h-8" />
                  <p className="text-sm text-gray-500 font-medium">No branches configured</p>
                  <button onClick={() => setIsEditing(true)} className="mt-3 text-sm font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 mx-auto">
                    <Plus className="w-4 h-4" /> Add Branches
                  </button>
                </div>
              )}
            </div>

            {/* Today's Schedule */}
            <div className="bg-white rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-gray-100 p-6">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-5">
                <div className="p-1.5 rounded-lg bg-blue-50"><Calendar className="w-4 h-4 text-blue-600" /></div>
                Today&apos;s Schedule ({todaysSchedules.length})
              </h3>
              {todaysSchedules.length > 0 ? (
                <div className="space-y-3">
                  {todaysSchedules.slice(0, 4).map(s => {
                    const route = routes.find((r: any) => r.id === s.routeId);
                    return (
                      <div key={s.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-100 hover:bg-blue-50 hover:border-blue-200 transition-colors">
                        <div className="w-12 h-12 bg-indigo-900 text-white rounded-lg flex flex-col items-center justify-center shrink-0">
                          <span className="text-xs font-bold leading-none">
                            {new Date(s.departureDateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">
                            {route ? `${route.origin} → ${route.destination}` : 'Route not set'}
                          </p>
                          <p className="text-xs text-gray-500 font-medium">{s.busId || "No bus assigned"}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-extrabold text-gray-900">{s.availableSeats}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase">Seats</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <Calendar className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                  <p className="text-sm font-medium text-gray-500">No trips scheduled today</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Operating Hours */}
            <div className="bg-white rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-gray-100 p-6">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-5">
                <div className="p-1.5 rounded-lg bg-purple-50"><Clock className="w-4 h-4 text-purple-600" /></div>
                Terminal Hours
              </h3>
              <div className="space-y-2.5">
                {Object.keys(DEFAULT_HOURS).map(day => {
                  const h = company.operatingHours?.[day] || DEFAULT_HOURS[day];
                  const isToday = new Date().toLocaleDateString('en-US', { weekday: 'long' }) === day;
                  return (
                    <div key={day} className={`flex justify-between items-center px-3 py-2 rounded-lg text-sm ${isToday ? 'bg-indigo-50 border border-indigo-200' : ''}`}>
                      <span className={`font-bold text-[11px] uppercase tracking-wider ${isToday ? 'text-indigo-700' : 'text-gray-400'}`}>{day}</span>
                      <span className={`font-bold text-sm ${h.closed ? "text-red-400" : isToday ? "text-indigo-900" : "text-gray-900"}`}>
                        {h.closed ? "Closed" : `${h.open} — ${h.close}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Company Story */}
            <div className="bg-gradient-to-br from-indigo-900 to-[#1e1b4b] rounded-xl p-6 text-white shadow-[0_8px_20px_-4px_rgba(49,46,129,0.4)] relative overflow-hidden">
              <div className="absolute -right-4 -bottom-4 opacity-10">
                <Building2 className="w-32 h-32" />
              </div>
              <div className="relative z-10">
                <h3 className="text-sm font-bold text-indigo-200 uppercase tracking-wider mb-3">Our Story</h3>
                <p className="text-sm text-indigo-100 leading-relaxed italic">
                  &quot;{company.description || "Providing reliable and comfortable travel services across Malawi."}&quot;
                </p>
                <div className="mt-4 pt-4 border-t border-indigo-700/50">
                  <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">Member Since</p>
                  <p className="text-sm font-bold text-white mt-0.5">
                    {company.createdAt ? new Date(company.createdAt as any).toLocaleDateString('en-MW', { year: 'numeric', month: 'long' }) : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyProfileTab;
