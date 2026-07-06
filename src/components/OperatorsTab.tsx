"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import * as dbActions from '@/lib/actions/db.actions';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import Modal from '@/components/Modals';
import {
  Trash2, UserPlus, ShieldCheck, Ban, RefreshCw, Send,
  Users, Bus, MapPin, Edit3, X, Check, Clock, Mail,
  AlertTriangle, ChevronRight, Loader2, Sparkles, User,
  Building2, Shield, UserCog, BadgeCheck
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type TeamRole = 'operator';

interface TeamMember {
  id: string; uid: string; email: string; name: string; firstName?: string; lastName?: string;
  role: TeamRole; status: 'active' | 'inactive' | 'pending';
  region?: string; createdAt: Date; createdBy: string;
  companyId: string; invitationSent?: boolean; invitationSentAt?: Date;
}

interface TeamManagementTabProps {
  companyId: string;
  companyBranches?: string[];
  setError: (msg: string) => void;
  setSuccess: (msg: string) => void;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const ROLE_CONFIG = {
  operator: {
    label: 'Platform Operator', plural: 'Operations Hub',
    description: 'Logistics & Capacity Management',
    icon: UserCog, color: 'indigo',
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    tab:   'border-indigo-600 text-indigo-700 bg-indigo-50/50',
    permissions: 'Critical. Can execute scheduling logic, manage vessel assignments, and override booking states for their assigned corridor.',
  }
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const parseBranches = (data: any): string[] => {
  if (!data) return [];
  if (Array.isArray(data)) return data.filter(b => typeof b === 'string').map(b => b.trim());
  if (typeof data === 'string') return data.split(',').map(b => b.trim()).filter(Boolean);
  return [];
};

const initials = (name: string) => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status?: string }> = ({ status }) => {
  const safeStatus = status || 'inactive';
  const map: Record<string, string> = {
    active:   'bg-emerald-50 text-emerald-700 border-emerald-100',
    inactive: 'bg-slate-50 text-slate-400 border-slate-100',
    pending:  'bg-amber-50 text-amber-700 border-amber-100',
  };
  const Icon = safeStatus === 'active' ? BadgeCheck : safeStatus === 'pending' ? Clock : X;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-bold uppercase tracking-widest border shadow-sm ${map[safeStatus] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}>
      <Icon className="w-3.5 h-3.5" />
      {safeStatus}
    </span>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const TeamManagementTab: React.FC<TeamManagementTabProps> = ({
  companyId, companyBranches = [], setError, setSuccess,
}) => {
  const [members,        setMembers]        = useState<TeamMember[]>([]);
  const [branches,       setBranches]       = useState<string[]>([]);
  const [companyName,    setCompanyName]    = useState('');
  const [activeTab,      setActiveTab]      = useState<TeamRole>('operator');
  const [showAddModal,   setShowAddModal]   = useState(false);
  const [showEditModal,  setShowEditModal]  = useState(false);
  const [editingMember,  setEditingMember]  = useState<TeamMember | null>(null);
  const [addingRole,     setAddingRole]     = useState<TeamRole>('operator');
  const [newMember,      setNewMember]      = useState({ name: '', email: '', region: '' });
  const [editData,       setEditData]       = useState<{ region: string; status: 'active'|'inactive'|'pending' }>({ region: '', status: 'active' });
  const [actionLoading,  setActionLoading]  = useState(false);
  const [resendingId,    setResendingId]    = useState<string | null>(null);
  const [loading,        setLoading]        = useState(true);

  // Region and Route DB states
  const [dbRegions, setDbRegions] = useState<{ id: string; name: string }[]>([]);
  const [dbRoutes, setDbRoutes] = useState<{ id: string; name: string; origin: string; destination: string }[]>([]);
  const [selectedRouteIds, setSelectedRouteIds] = useState<string[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<string>('');
  const [editRegionId, setEditRegionId] = useState<string>('');

  const { user: currentUser } = useAuth();

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!companyId || !currentUser) return;
    const fetch = async () => {
      setLoading(true);
      try {
        const { data: companyData, error: companyError } = await supabase
          .from('Company')
          .select('id, name, branches')
          .eq('id', companyId)
          .single();
          
        if (!companyError && companyData) {
          setCompanyName(companyData.name || 'Your Company');
          setBranches(parseBranches(companyData.branches));
        }

        // Fetch Regions & Routes via API (bypasses RLS issues)
        const [regionsRes, routesRes] = await Promise.all([
          window.fetch(`/api/admin/coo/regions?companyId=${companyId}&limit=100`, { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null),
          window.fetch(`/api/admin/coo/routes?companyId=${companyId}&limit=100`, { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null),
        ]);

        if (regionsRes?.regions) setDbRegions(regionsRes.regions.filter((r: any) => r.isActive));
        if (routesRes?.routes) setDbRoutes(routesRes.routes.map((r: any) => ({ id: r.id, name: r.name, origin: r.origin, destination: r.destination })));
        
        const { data: membersData, error: membersError } = await supabase
          .from('User')
          .select('*')
          .eq('companyId', companyId)
          .eq('role', 'operator');
          
        if (!membersError && membersData) {
          setMembers(membersData.map(m => {
            let status: 'active' | 'inactive' | 'pending' = 'active';
            if (!m.setupCompleted && m.invitationSent) status = 'pending';
            else if (!m.isActive) status = 'inactive';

            return {
              ...m,
              name: m.name || `${m.firstName} ${m.lastName}`.trim(),
              createdAt: new Date(m.createdAt),
              status,
            } as TeamMember;
          }));
        }
      } catch (e: unknown) {
        setError(`Failed to load team: ${(e as any).message}`);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [companyId, currentUser, setError]);

  const refreshMembers = async () => {
    const { data, error: membersError } = await supabase
      .from('User')
      .select('*')
      .eq('companyId', companyId)
      .eq('role', 'operator');
      
    if (!membersError && data) {
      setMembers(data.map(m => {
        let status: 'active' | 'inactive' | 'pending' = 'active';
        if (!m.setupCompleted && m.invitationSent) status = 'pending';
        else if (!m.isActive) status = 'inactive';

        return {
          ...m,
          name: m.name || `${m.firstName} ${m.lastName}`.trim(),
          createdAt: new Date(m.createdAt),
          status,
        } as TeamMember;
      }));
    }
  };

  // ── Modals ─────────────────────────────────────────────────────────────────
  const openAdd = (role: TeamRole) => {
    setAddingRole(role);
    setNewMember({ name: '', email: '', region: '' });
    setSelectedRouteIds([]);
    setSelectedRegionId('');
    setShowAddModal(true);
  };

  const openEdit = async (m: TeamMember) => {
    setEditingMember(m);
    setEditData({ region: m.region || '', status: m.status });
    
    // Clear and load operator region and routes from Operator table
    setSelectedRouteIds([]);
    setEditRegionId('');
    
    try {
      const { data: opData, error: opError } = await supabase
        .from('Operator')
        .select('regionId')
        .eq('id', m.id)
        .maybeSingle();

      if (opError) {
        throw opError;
      }

      if (opData) {
        setEditRegionId(opData.regionId || '');
      }

      const { data: operatorRoutes, error: operatorRoutesError } = await supabase
        .from('_OperatorRoutes')
        .select('B')
        .eq('A', m.id);

      if (operatorRoutesError) {
        throw operatorRoutesError;
      }

      if (operatorRoutes) {
        setSelectedRouteIds((operatorRoutes as any[]).map((r: any) => r.B));
      }
    } catch (err) {
      console.error('Error fetching operator assignments:', err);
    }
    
    setShowEditModal(true);
  };

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return setError('Not logged in');
    if (addingRole === 'operator' && !selectedRegionId) return setError('Region is required for operators');
    if (!newMember.name.trim()) return setError('Name is required');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newMember.email)) return setError('Valid email required');

    setActionLoading(true);
    try {
      const res = await fetch('/api/operators/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newMember.name.trim(),
          email: newMember.email.trim(),
          regionId: selectedRegionId || undefined,
          routeIds: selectedRouteIds,
          role: addingRole,
          companyId,
          companyName,
          invitedBy: currentUser.id,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'Failed to send invite');
      await refreshMembers();
      setShowAddModal(false);
      if (result.emailFailed && result.inviteLink) {
        try {
          await navigator.clipboard.writeText(result.inviteLink);
          setSuccess(`Recruited successfully! The invitation email could not be sent (Resend API key is invalid/expired), but the setup link has been copied to your clipboard: ${result.inviteLink}`);
        } catch (clipErr) {
          setSuccess(`Recruited successfully! Email failed to send (Resend API key is invalid/expired). Please share this setup link manually: ${result.inviteLink}`);
        }
      } else {
        setSuccess(`Invitation sent to ${newMember.email}`);
      }
    } catch (e: unknown) {
      setError((e as any).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    setActionLoading(true);
    try {
      const result = await dbActions.updateOperatorAssignments(editingMember.id, {
        regionId: editRegionId || null,
        routeIds: selectedRouteIds,
        status: editData.status
      });

      if (!result.success) throw new Error(result.error);
      
      await refreshMembers();
      setShowEditModal(false);
      setEditingMember(null);
      setSuccess(`${editingMember.name} updated successfully`);
    } catch (e: unknown) {
      setError((e as any).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResend = async (m: TeamMember) => {
    setResendingId(m.id);
    try {
      const res = await fetch('/api/operators/resend-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorId: m.id, email: m.email, name: m.name, role: m.role, companyId, companyName }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'Failed');
      if (result.emailFailed && result.inviteLink) {
        try {
          await navigator.clipboard.writeText(result.inviteLink);
          setSuccess(`Link regenerated! The invitation email could not be sent (Resend API key is invalid/expired), but the link has been copied to your clipboard: ${result.inviteLink}`);
        } catch (clipErr) {
          setSuccess(`Link regenerated! Email failed to send (Resend API key is invalid/expired). Please share this link manually: ${result.inviteLink}`);
        }
      } else {
        setSuccess(`Invitation resent to ${m.email}`);
      }
    } catch (e: unknown) {
      setError((e as any).message);
    } finally {
      setResendingId(null);
    }
  };

  const handleToggle = async (m: TeamMember) => {
    if (!confirm(`${m.status === 'active' ? 'Deactivate' : 'Activate'} ${m.name}?`)) return;
    setActionLoading(true);
    try {
      const isCurrentlyActive = m.status === 'active';
      const newIsActive = !isCurrentlyActive;

      const updatePayload: any = {
        isActive: newIsActive,
        updatedAt: new Date().toISOString(),
      };
      // When activating, also mark setupCompleted so they're fully operational
      if (newIsActive) updatePayload.setupCompleted = true;

      const { error } = await supabase
        .from('User')
        .update(updatePayload)
        .eq('id', m.id);

      if (error) throw error;
      
      const newStatus = newIsActive ? 'active' : 'inactive';
      setMembers(prev => prev.map(x => x.id === m.id ? { ...x, status: newStatus as any } : x));
      setSuccess(`${m.name} ${newIsActive ? 'activated' : 'deactivated'}`);
    } catch (e: unknown) {
      setError((e as any).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (m: TeamMember) => {
    if (!confirm(`Remove ${m.name} from the team? This cannot be undone.`)) return;
    setActionLoading(true);
    try {
      const result = await dbActions.deleteUser(m.id);
      if (!result.success) throw new Error(result.error);
      
      setMembers(prev => prev.filter(x => x.id !== m.id));
      setSuccess(`${m.name} removed`);
    } catch (e: unknown) {
      setError((e as any).message);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const filtered = members.filter(m => m.role === activeTab);
  const teamStats = (role: TeamRole) => ({
    total:   members.filter(m => m.role === role).length,
    active:  members.filter(m => m.role === role && m.status === 'active').length,
    pending: members.filter(m => m.role === role && m.status === 'pending').length,
  });

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-12">

      {/* ── Header + Stats Row ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight uppercase flex items-center gap-3">
            Operators
            <span className="text-xs font-bold bg-indigo-600 text-white px-2.5 py-1 rounded-xl">{members.length}</span>
          </h2>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-1">
            Manage route operators and regional assignments
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Inline Stats */}
          <div className="hidden sm:flex items-center gap-3">
            <div className="px-4 py-2.5 bg-emerald-50 border border-emerald-100 rounded-xl text-center">
              <p className="text-lg font-black text-emerald-700">{teamStats('operator').active}</p>
              <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">Active</p>
            </div>
            {teamStats('operator').pending > 0 && (
              <div className="px-4 py-2.5 bg-amber-50 border border-amber-100 rounded-xl text-center">
                <p className="text-lg font-black text-amber-700">{teamStats('operator').pending}</p>
                <p className="text-[9px] font-bold text-amber-600 uppercase tracking-widest">Pending</p>
              </div>
            )}
          </div>

          <button
            onClick={() => openAdd('operator')}
            className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
          >
            <UserPlus className="w-4 h-4" /> Add Operator
          </button>
        </div>
      </div>

      {/* ── Table Card ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-300" />
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Loading operators...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-5">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center border border-indigo-100">
              <UserCog className="w-8 h-8 text-indigo-300" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-gray-900 uppercase tracking-tight">No operators yet</p>
              <p className="text-xs text-gray-400 mt-1">Add your first operator to get started</p>
            </div>
            <button
              onClick={() => openAdd('operator')}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-indigo-700 transition-all active:scale-95"
            >
              <UserPlus className="w-4 h-4" /> Add Operator
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Operator</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Email</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Region</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Joined</th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(member => (
                  <tr key={member.id} className="group hover:bg-indigo-50/30 transition-colors">
                    {/* Operator */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0 group-hover:scale-105 transition-transform">
                          {initials(member.name)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{member.name || 'Unnamed'}</p>
                          <p className="text-[10px] text-gray-400 font-medium">ID: {member.id.substring(0, 8).toUpperCase()}</p>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                        <span className="text-xs font-medium text-gray-600">{member.email}</span>
                      </div>
                    </td>

                    {/* Region */}
                    <td className="px-6 py-4">
                      {member.region ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-xl">
                          <MapPin className="w-3.5 h-3.5 text-blue-500" />
                          <span className="text-xs font-bold text-blue-700">{member.region}</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-100 rounded-xl">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                          <span className="text-[10px] font-bold text-rose-600 uppercase tracking-widest">Unassigned</span>
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <StatusBadge status={member.status} />
                    </td>

                    {/* Joined */}
                    <td className="px-6 py-4">
                      <span className="text-xs text-gray-500 font-medium">
                        {member.createdAt ? new Date(member.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {member.status === 'pending' && (
                          <button
                            onClick={() => handleResend(member)}
                            disabled={resendingId === member.id}
                            title="Resend invite"
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all border border-transparent hover:border-indigo-100"
                          >
                            {resendingId === member.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(member)}
                          title="Edit operator"
                          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all border border-transparent hover:border-indigo-100"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggle(member)}
                          disabled={actionLoading}
                          title={member.status === 'active' ? 'Deactivate' : 'Activate'}
                          className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all border border-transparent hover:border-amber-100"
                        >
                          {member.status === 'active' ? <Ban className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDelete(member)}
                          disabled={actionLoading}
                          title="Remove operator"
                          className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all border border-transparent hover:border-rose-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add Modal ── */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Recruit Team Intelligence">
        <form onSubmit={handleAdd} className="space-y-6 text-left">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Personnel Name</label>
              <div className="relative">
                 <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                 <input type="text" value={newMember.name} onChange={e => setNewMember({ ...newMember, name: e.target.value })}
                   className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-indigo-600 focus:bg-white outline-none transition-all"
                   placeholder="Identity Credentials" required />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Primary Access Email</label>
              <div className="relative">
                 <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                 <input type="email" value={newMember.email} onChange={e => setNewMember({ ...newMember, email: e.target.value })}
                   className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-indigo-600 focus:bg-white outline-none transition-all"
                   placeholder="digital-access@domain.ms" required />
              </div>
            </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Strategic Deployment Region</label>
                  {dbRegions.length > 0 ? (
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                      <select value={selectedRegionId} onChange={e => {
                        const regId = e.target.value;
                        setSelectedRegionId(regId);
                        const regName = dbRegions.find(r => r.id === regId)?.name || '';
                        setNewMember(prev => ({ ...prev, region: regName }));
                      }}
                        className="w-full pl-11 pr-10 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-indigo-600 focus:bg-white outline-none appearance-none cursor-pointer" required>
                        <option value="">Select Region</option>
                        {dbRegions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                      <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 rotate-90" />
                    </div>
                  ) : (
                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                      <p className="text-[10px] font-bold text-amber-800 uppercase tracking-widest leading-relaxed">No active branches found. Please add branches in your Company Profile to assign operators to regions.</p>
                    </div>
                  )}
                </div>

                {dbRoutes.length > 0 && (
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Assigned Routes</label>
                    <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 max-h-48 overflow-y-auto space-y-2">
                      {dbRoutes.map(route => {
                        const checked = selectedRouteIds.includes(route.id);
                        return (
                          <label key={route.id} className="flex items-center gap-3 cursor-pointer p-2 rounded-xl hover:bg-white transition-colors">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedRouteIds(prev => [...prev, route.id]);
                                } else {
                                  setSelectedRouteIds(prev => prev.filter(id => id !== route.id));
                                }
                              }}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                            />
                            <span className="text-xs font-bold text-gray-700 uppercase tracking-tight">{route.name || `${route.origin} → ${route.destination}`}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
          </div>

          <div className="p-4 bg-indigo-900 rounded-2xl text-white/90 relative overflow-hidden">
             <div className="absolute right-0 top-0 w-24 h-24 bg-white/5 rounded-full blur-2xl -mr-12 -mt-12"></div>
             <p className="text-[9px] font-bold uppercase tracking-[0.2em] mb-2 text-white/50">AUTHORIZATION LEVEL</p>
             <p className="text-[11px] font-bold leading-relaxed">{ROLE_CONFIG[addingRole].permissions}</p>
          </div>

          <div className="flex gap-3 pt-6 border-t border-gray-50">
            <button type="button" onClick={() => setShowAddModal(false)}
              className="flex-1 px-4 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-gray-400 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all">
              Abort
            </button>
            <button type="submit" disabled={actionLoading}
              className="flex-[2] flex items-center justify-center gap-3 px-4 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-xl shadow-indigo-100 transition-all disabled:opacity-50 active:scale-95">
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Dispatch Credentials
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Edit Modal ── */}
      <Modal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setEditingMember(null); }}
        title="Override Personnel Config">
        {editingMember && (
          <form onSubmit={handleEdit} className="space-y-6 text-left">
            <div className="flex items-center gap-5 p-4 sm:p-6 bg-slate-50 rounded-2xl border border-gray-100">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-white flex items-center justify-center text-lg sm:text-xl font-bold text-indigo-600 shadow-sm border border-gray-100">
                 {initials(editingMember.name)}
              </div>
              <div>
                <p className="text-base sm:text-lg font-bold text-gray-900 uppercase tracking-tight leading-none">{editingMember.name}</p>
                <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-widest">USER_REF: {editingMember.id.substring(0,8)}</p>
              </div>
            </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Relocate Strategic Region</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                    <select value={editRegionId} onChange={e => {
                      const regId = e.target.value;
                      setEditRegionId(regId);
                      const regName = dbRegions.find(r => r.id === regId)?.name || '';
                      setEditData(prev => ({ ...prev, region: regName }));
                    }}
                      className="w-full pl-11 pr-10 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-indigo-600 focus:bg-white outline-none appearance-none cursor-pointer" required>
                      <option value="">Select Region</option>
                      {dbRegions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 rotate-90" />
                  </div>
                </div>

                {dbRoutes.length > 0 && (
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Assigned Routes</label>
                    <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 max-h-48 overflow-y-auto space-y-2">
                      {dbRoutes.map(route => {
                        const checked = selectedRouteIds.includes(route.id);
                        return (
                          <label key={route.id} className="flex items-center gap-3 cursor-pointer p-2 rounded-xl hover:bg-white transition-colors">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedRouteIds(prev => [...prev, route.id]);
                                } else {
                                  setSelectedRouteIds(prev => prev.filter(id => id !== route.id));
                                }
                              }}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                            />
                            <span className="text-xs font-bold text-gray-700 uppercase tracking-tight">{route.name || `${route.origin} → ${route.destination}`}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Operational state</label>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {(['active', 'inactive', 'pending'] as const).map(s => (
                  <button key={s} type="button" onClick={() => setEditData({ ...editData, status: s })}
                    className={`py-3 rounded-2xl text-[9px] sm:text-[10px] font-bold uppercase tracking-widest border-2 transition-all ${
                      editData.status === s
                        ? s === 'active'   ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : s === 'inactive' ? 'border-slate-400 bg-slate-50 text-slate-700'
                        :                   'border-amber-400 bg-amber-50 text-amber-700'
                        : 'border-gray-50 bg-gray-50/30 text-gray-300 hover:border-gray-200 hover:text-gray-400'
                    }`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-6 border-t border-gray-50">
              <button type="button" onClick={() => { setShowEditModal(false); setEditingMember(null); }}
                className="flex-1 px-4 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-gray-400 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all">
                Cancel
              </button>
              <button type="submit" disabled={actionLoading}
                className="flex-[2] flex items-center justify-center gap-3 px-4 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-xl shadow-indigo-100 transition-all disabled:opacity-50 active:scale-95">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply Overrides'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default TeamManagementTab;
