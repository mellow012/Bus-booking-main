'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import * as dbActions from '@/lib/actions/db.actions';
import { Button } from '@/components/ui/button';
import {
  User, Mail, Building2, MapPin, Calendar, Shield, Save, Edit2, X,
  CheckCircle, Phone, Lock, Sparkles
} from 'lucide-react';
import { UserProfile } from '@/types/core';

interface OperatorProfileTabProps {
  userProfile: UserProfile | null;
  companyName?: string;
  companyBranches?: string[];
  setError: (message: string) => void;
  setSuccess: (message: string) => void;
}

interface EditData {
  phoneNumber: string;
}

const ROLE_META: Record<string, { label: string; color: string; bg: string; gradient: string }> = {
  superadmin:           { label: 'Super Admin',           color: 'text-purple-700', bg: 'bg-purple-100',  gradient: 'from-purple-600 to-indigo-600' },
  chief_of_growth:      { label: 'Chief of Growth',       color: 'text-emerald-700', bg: 'bg-emerald-100', gradient: 'from-emerald-500 to-teal-600' },
  chief_of_operations:  { label: 'Chief of Operations',   color: 'text-blue-700',   bg: 'bg-blue-100',    gradient: 'from-blue-600 to-cyan-600' },
  company_admin:        { label: 'Company Admin',          color: 'text-indigo-700', bg: 'bg-indigo-100',  gradient: 'from-indigo-600 to-blue-600' },
  operator:             { label: 'Operator',               color: 'text-blue-700',   bg: 'bg-blue-100',    gradient: 'from-blue-500 to-indigo-600' },
  conductor:            { label: 'Conductor',              color: 'text-sky-700',    bg: 'bg-sky-100',     gradient: 'from-sky-500 to-blue-600' },
  finance:              { label: 'Finance Manager',        color: 'text-green-700',  bg: 'bg-green-100',   gradient: 'from-green-600 to-emerald-600' },
};

const DEFAULT_META = { label: 'Staff', color: 'text-gray-700', bg: 'bg-gray-100', gradient: 'from-gray-600 to-slate-600' };

const getPermissionsByRole = (role: string) => {
  switch (role) {
    case 'superadmin':
      return [
        { label: 'Manage All Companies', description: 'Create, suspend, and view all registered companies', allowed: true },
        { label: 'Manage Users & Roles', description: 'Promote users and assign platform/company roles', allowed: true },
        { label: 'Platform Settings', description: 'Configure global system parameters', allowed: true },
        { label: 'Audit Logs', description: 'Inspect system-wide security logs', allowed: true },
      ];
    case 'chief_of_growth':
    case 'chief_of_operations':
      return [
        { label: 'Platform Overview', description: 'Full system oversight and reporting', allowed: true },
        { label: 'View Analytics', description: 'Monitor system performance and growth metrics', allowed: true },
        { label: 'Support Assistance', description: 'Review support and route issues', allowed: true },
        { label: 'Delete Entities', description: 'Super Admin only', allowed: false },
      ];
    case 'company_admin':
      return [
        { label: 'Manage Team', description: 'Invite, edit, and assign operators and conductors', allowed: true },
        { label: 'Manage Routes & Buses', description: 'Add new fleet vehicles and service routes', allowed: true },
        { label: 'Create Schedules', description: 'Setup one-off and recurrent blueprints', allowed: true },
        { label: 'View Revenue & Reports', description: 'Access financial logs and settlement files', allowed: true },
      ];
    case 'operator':
      return [
        { label: 'Create Schedules', description: 'For routes in your region', allowed: true },
        { label: 'Manage Bookings', description: 'For your schedules only', allowed: true },
        { label: 'View Payments', description: 'For your schedules only', allowed: true },
        { label: 'Assign Buses', description: 'To your schedules', allowed: true },
        { label: 'Delete Routes', description: 'Company admin only', allowed: false },
        { label: 'Manage Team', description: 'Company admin only', allowed: false },
      ];
    case 'conductor':
      return [
        { label: 'Passenger Boarding', description: 'Verify ticket references and mark checked-in', allowed: true },
        { label: 'Manage Trip Status', description: 'Mark departure, transit, and arrival milestones', allowed: true },
        { label: 'Cash Collection', description: 'Record cash fares collected onboard', allowed: true },
        { label: 'Create Schedules', description: 'Admins/Operators only', allowed: false },
      ];
    default:
      return [{ label: 'View Dashboard', description: 'Access your assigned dashboard', allowed: true }];
  }
};

const OperatorProfileTab: React.FC<OperatorProfileTabProps> = ({
  userProfile,
  companyName,
  setError,
  setSuccess,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [operatorRegion, setOperatorRegion] = useState<string>('Loading...');
  const [loading, setLoading] = useState(true);
  const [editData, setEditData] = useState<EditData>({
    phoneNumber: userProfile?.phone || '',
  });

  const activeRole = (userProfile?.role as string) || 'staff';
  const meta = ROLE_META[activeRole] || DEFAULT_META;
  const isOperator = activeRole === 'operator';
  const hasCompany = ['company_admin', 'operator', 'conductor', 'finance'].includes(activeRole);

  useEffect(() => {
    if (!userProfile?.id || !isOperator) {
      setOperatorRegion('Not assigned');
      setLoading(false);
      return;
    }
    const fetchOperatorData = async () => {
      try {
        const { data: operatorData, error: fetchError } = await (supabase as any)
          .from('Operator')
          .select('regionId, region(name)')
          .or(`id.eq.${userProfile.id},uid.eq.${userProfile.id}`)
          .single();
        if (!fetchError && operatorData) {
          setOperatorRegion(operatorData.region?.name || operatorData.regionId || 'Not assigned');
        } else {
          setOperatorRegion('Not assigned');
        }
      } catch {
        setOperatorRegion('Not assigned');
      } finally {
        setLoading(false);
      }
    };
    fetchOperatorData();
  }, [userProfile?.id, isOperator]);

  const handleSave = async () => {
    if (!userProfile?.id) { setError('User profile not found'); return; }
    setSaving(true);
    try {
      const result = await dbActions.updateUser(userProfile.id, {
        phone: editData.phoneNumber,
        updatedAt: new Date(),
      });
      if (!result.success) throw new Error(result.error);
      setSuccess('Profile updated successfully!');
      setIsEditing(false);
      window.location.reload();
    } catch (error: any) {
      setError(`Failed to update profile: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const operatorName = `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim() || 'Staff Member';
  const initial = operatorName.charAt(0).toUpperCase();
  const permissions = getPermissionsByRole(activeRole);
  const memberSince = userProfile?.createdAt instanceof Date
    ? userProfile.createdAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Unknown';

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* ─── Profile Hero ───────────────────────────────────────── */}

      {/* Full-width gradient banner — sits BEHIND the card */}
      <div className={`relative h-36 rounded-3xl bg-gradient-to-r ${meta.gradient} overflow-hidden`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_65%)]" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute top-3 right-3 bottom-3 flex items-start">
          {/* Edit / Save on the banner */}
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-sm font-semibold rounded-xl border border-white/30 transition-all mt-1"
            >
              <Edit2 className="w-3.5 h-3.5" /> Edit Profile
            </button>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={() => { setEditData({ phoneNumber: userProfile?.phone || '' }); setIsEditing(false); }}
                className="px-3 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-sm font-semibold rounded-xl border border-white/30 transition-all"
                disabled={saving}
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-white text-gray-900 text-sm font-bold rounded-xl shadow transition-all hover:bg-gray-50 active:scale-95"
              >
                {saving ? (
                  <div className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* White card — floats up with negative margin so avatar overlaps banner */}
      <div className="relative bg-white rounded-[2rem] shadow-sm border border-gray-100 -mt-10 mx-0 overflow-visible">
        <div className="px-6 sm:px-8 pt-0 pb-6">

          {/* Avatar row — pulls up to overlap the banner */}
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-10 mb-6">
            <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${meta.gradient} flex items-center justify-center text-white font-bold text-3xl shadow-lg ring-4 ring-white flex-shrink-0`}>
              {initial}
            </div>
            <div className="sm:pb-2">
              <h2 className="text-2xl font-bold text-white leading-tight drop-shadow-sm">{operatorName}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${meta.bg} ${meta.color}`}>
                  <Shield className="w-3 h-3" />
                  {meta.label}
                </span>
                {companyName && (
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" /> {companyName}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Email */}
            <div className="group">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3 h-3" /> Email
              </p>
              <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                <p className="text-sm text-gray-800 font-medium flex-1 truncate">{userProfile?.email || '—'}</p>
                <Lock className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
              </div>
              <p className="text-[11px] text-gray-400 mt-1 ml-1">Cannot be changed</p>
            </div>

            {/* Phone */}
            <div className="group">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3 h-3" /> Phone
              </p>
              {isEditing ? (
                <input
                  type="tel"
                  value={editData.phoneNumber}
                  onChange={(e) => setEditData({ ...editData, phoneNumber: e.target.value })}
                  placeholder="+265 999 123 456"
                  className="w-full px-4 py-3 text-sm border-2 border-indigo-400 bg-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
                  autoFocus
                />
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                  <p className="text-sm text-gray-800 font-medium">{userProfile?.phone || <span className="text-gray-400 italic">Not set</span>}</p>
                </div>
              )}
            </div>

            {/* Company (conditional) */}
            {hasCompany && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3 h-3" /> Company
                </p>
                <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${meta.gradient} flex-shrink-0`} />
                  <p className="text-sm text-gray-800 font-medium">{companyName || <span className="text-gray-400 italic">Not assigned</span>}</p>
                </div>
              </div>
            )}

            {/* Operating Region (operator only) */}
            {isOperator && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3 h-3" /> Region
                </p>
                <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-gray-400 italic">Loading…</span>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-800 font-medium">{operatorRegion}</p>
                  )}
                </div>
              </div>
            )}

            {/* Member Since */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3 h-3" /> Member Since
              </p>
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                <p className="text-sm text-gray-800 font-medium">{memberSince}</p>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ─── Permissions Card ──────────────────────────────────── */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${meta.gradient} flex items-center justify-center`}>
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Your Permissions</h3>
            <p className="text-xs text-gray-400">Based on your {meta.label} role</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {permissions.map((permission, index) => (
            <div
              key={index}
              className={`flex items-start gap-3 p-4 rounded-2xl border transition-all ${
                permission.allowed
                  ? 'bg-gray-50 border-gray-200 hover:border-indigo-200 hover:bg-indigo-50/40'
                  : 'bg-gray-50/50 border-dashed border-gray-200 opacity-60'
              }`}
            >
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                permission.allowed ? 'bg-green-100' : 'bg-gray-100'
              }`}>
                {permission.allowed
                  ? <CheckCircle className="w-4 h-4 text-green-600" />
                  : <X className="w-3.5 h-3.5 text-gray-400" />
                }
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${permission.allowed ? 'text-gray-900' : 'text-gray-500'}`}>
                  {permission.label}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{permission.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Security Notice ───────────────────────────────────── */}
      <div className="rounded-[2rem] border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-5 flex items-start gap-4">
        <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Shield className="w-4 h-4 text-amber-600" />
        </div>
        <div>
          <p className="text-sm font-bold text-amber-800 mb-1">Security Notice</p>
          <p className="text-sm text-amber-700 leading-relaxed">
            Your system assignments and role cannot be modified from this panel.
            Contact the system administrator if changes are required.
          </p>
        </div>
      </div>
    </div>
  );
};

export default OperatorProfileTab;
