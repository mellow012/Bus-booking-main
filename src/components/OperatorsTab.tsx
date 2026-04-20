"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import * as dbActions from '@/lib/actions/db.actions';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import Modal from '@/components/Modals';
import {
  Trash2, UserPlus, ShieldCheck, Ban, RefreshCw, Send,
  Users, Truck, MapPin, Edit3, X, Check, Clock, Mail,
  AlertTriangle, ChevronRight, Loader2, Sparkles, User,
  Building2, Shield, UserCog, BadgeCheck
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type TeamRole = 'operator' | 'conductor';

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
  },
  conductor: {
    label: 'Field Personnel', plural: 'Transit Crew',
    description: 'Trip Execution & Validation',
    icon: Truck, color: 'emerald',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    tab:   'border-emerald-600 text-emerald-700 bg-emerald-50/50',
    permissions: 'Operational. Limited to viewing assigned manifests, validating passenger credentials, and real-time trip status reporting.',
  },
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
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border shadow-sm ${map[safeStatus] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}>
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
        
        const { data: membersData, error: membersError } = await supabase
          .from('User')
          .select('*')
          .eq('companyId', companyId)
          .in('role', ['operator', 'conductor']);
          
        if (!membersError && membersData) {
          setMembers(membersData.map(m => ({
            ...m,
            name: m.name || `${m.firstName} ${m.lastName}`.trim(),
            createdAt: new Date(m.createdAt),
          } as TeamMember)));
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
      .in('role', ['operator', 'conductor']);
      
    if (!membersError && data) {
      setMembers(data.map(m => ({
        ...m,
        name: m.name || `${m.firstName} ${m.lastName}`.trim(),
        createdAt: new Date(m.createdAt),
      } as TeamMember)));
    }
  };

  // ── Modals ─────────────────────────────────────────────────────────────────
  const openAdd = (role: TeamRole) => {
    setAddingRole(role);
    setNewMember({ name: '', email: '', region: '' });
    setShowAddModal(true);
  };

  const openEdit = (m: TeamMember) => {
    setEditingMember(m);
    setEditData({ region: m.region || '', status: m.status });
    setShowEditModal(true);
  };

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return setError('Not logged in');
    if (addingRole === 'operator' && !newMember.region) return setError('Region is required for operators');
    if (!newMember.name.trim()) return setError('Name is required');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newMember.email)) return setError('Valid email required');

    setActionLoading(true);
    try {
      const res = await fetch('/api/operators/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newMember.name.trim(), email: newMember.email.trim(),
          region: newMember.region.trim() || undefined,
          role: addingRole, companyId, companyName,
          invitedBy: currentUser.id,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'Failed to send invite');
      await refreshMembers();
      setShowAddModal(false);
      setSuccess(`Invitation sent to ${newMember.email}`);
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
      const patch: any = { status: editData.status };
      if (editingMember.role === 'operator') patch.region = editData.region;
      
      const result = await dbActions.updateUser(editingMember.id, patch);
      if (!result.success) throw new Error(result.error);
      
      setMembers(prev => prev.map(m =>
        m.id === editingMember.id
          ? { ...m, status: editData.status, region: editingMember.role === 'operator' ? editData.region : m.region }
          : m
      ));
      setShowEditModal(false);
      setEditingMember(null);
      setSuccess(`${editingMember.name} updated`);
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
      setSuccess(`Invitation resent to ${m.email}`);
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
      const newStatus = m.status === 'active' ? 'inactive' : 'active';
      const result = await dbActions.updateUser(m.id, { status: newStatus } as any);
      if (!result.success) throw new Error(result.error);
      
      setMembers(prev => prev.map(x => x.id === m.id ? { ...x, status: newStatus as any } : x));
      setSuccess(`${m.name} ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
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
    <div className="space-y-8 pb-12">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3 uppercase">
             TEAM HIERARCHY
             <Shield className="w-5 h-5 text-indigo-600" />
          </h2>
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mt-1.5 flex items-center gap-2">
            Control personnel access & operational roles
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => openAdd('operator')}
            className="group flex items-center gap-2 px-6 py-3 bg-white border border-gray-100 rounded-2xl text-[11px] font-black uppercase tracking-widest text-gray-900 shadow-sm hover:shadow-lg hover:border-indigo-100 hover:text-indigo-600 transition-all active:scale-95">
            <UserCog className="w-4 h-4 group-hover:rotate-12 transition-transform" /> Recruit Operator
          </button>
          <button onClick={() => openAdd('conductor')}
            className="group flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95">
            <Truck className="w-4 h-4 group-hover:translate-x-1 transition-transform" /> Recruit Conductor
          </button>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(['operator', 'conductor'] as TeamRole[]).map(role => {
          const cfg = ROLE_CONFIG[role];
          const s   = teamStats(role);
          const Icon = cfg.icon;
          const isActive = activeTab === role;
          
          return (
            <button key={role} onClick={() => setActiveTab(role)}
              className={`p-8 bg-white rounded-[2.5rem] shadow-[0_8px_30px_-10px_rgba(0,0,0,0.05)] border transition-all duration-500 flex flex-col text-left relative overflow-hidden group ${
                isActive ? 'border-indigo-600 ring-2 ring-indigo-50 shadow-indigo-50' : 'border-gray-50 hover:border-indigo-200'
              }`}>
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-indigo-600/5 rounded-full blur-3xl group-hover:bg-indigo-600/10 transition-colors"></div>
              
              <div className="flex items-center justify-between mb-6 relative z-10">
                <div className={`p-4 rounded-2xl ${isActive ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-indigo-400'} shadow-sm transition-all duration-500`}>
                  <Icon className="w-6 h-6" />
                </div>
                {isActive && <div className="w-3 h-3 rounded-full bg-indigo-600 shadow-[0_0_12px_rgba(79,70,229,0.5)] animate-pulse" />}
              </div>
              
              <div className="relative z-10">
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">{cfg.plural}</p>
                 <p className="text-4xl font-black text-gray-900 leading-none tracking-tighter mb-4">{s.total}</p>
                 <div className="flex items-center gap-4">
                    <span className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-100">
                       <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {s.active} Operational
                    </span>
                    {s.pending > 0 && (
                       <span className="flex items-center gap-2 text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-100">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> {s.pending} Pending
                       </span>
                    )}
                 </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Table card ── */}
      <div className="bg-white rounded-[2.5rem] shadow-[0_8px_30px_-10px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden">
        {/* Tab Header Bar */}
        <div className="flex p-2 bg-gray-50/50">
          {(['operator', 'conductor'] as TeamRole[]).map(role => {
            const cfg = ROLE_CONFIG[role];
            const isActive = activeTab === role;
            return (
              <button 
                key={role} 
                onClick={() => setActiveTab(role)}
                className={`flex items-center justify-center gap-3 px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex-1 ${
                  isActive 
                    ? 'bg-white text-indigo-600 shadow-sm border border-gray-100' 
                    : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'
                }`}
              >
                <cfg.icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-gray-300'}`} />
                {cfg.plural}
              </button>
            );
          })}
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-100" />
          </div>
        ) : (
          <div className="overflow-x-auto text-left">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-50">
                  {["Personnel Identity", "Digital Access", ...(activeTab === 'operator' ? ["Deployment Region"] : []), "Operational Status", "Execution Control"].map(h => (
                    <th key={h} className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={activeTab === 'operator' ? 5 : 4} className="px-8 py-24 text-center">
                      <div className="flex flex-col items-center gap-4 text-gray-300">
                        <div className="w-16 h-16 bg-gray-50 rounded-3xl flex items-center justify-center border border-gray-50">
                           {React.createElement(ROLE_CONFIG[activeTab].icon, { className: "w-8 h-8 opacity-20" })}
                        </div>
                        <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">No {activeTab} records identified</p>
                        <button onClick={() => openAdd(activeTab)} className="text-[11px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 transition-all">
                          Initiate Recruitment
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : filtered.map(member => (
                  <tr key={member.id} className="hover:bg-indigo-50/20 transition-all duration-300 group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-black border group-hover:scale-110 transition-transform ${
                          member.role === 'operator' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                        }`}>
                          {initials(member.name)}
                        </div>
                        <div>
                          <p className="text-sm font-black text-gray-900 uppercase tracking-tight">{member.name || 'ANONYMOUS UNIT'}</p>
                          <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mt-1">ID: {member.id.substring(0,8).toUpperCase()}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-slate-50 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                           <Mail className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-bold text-gray-600 lowercase">{member.email}</span>
                      </div>
                    </td>

                    {activeTab === 'operator' && (
                      <td className="px-8 py-6">
                        {member.region ? (
                          <div className="flex items-center gap-2.5">
                            <MapPin className="w-4 h-4 text-rose-300" />
                            <span className="text-xs font-black text-gray-900 uppercase tracking-tight">{member.region}</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-rose-50 border border-rose-100 rounded-lg">
                            <AlertTriangle className="w-3 h-3 text-rose-500" />
                            <span className="text-[9px] font-black text-rose-700 uppercase tracking-widest">Unassigned</span>
                          </div>
                        )}
                      </td>
                    )}

                    <td className="px-8 py-6">
                      <StatusBadge status={member.status} />
                    </td>

                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        {member.status === 'pending' && (
                          <button onClick={() => handleResend(member)} disabled={resendingId === member.id}
                            className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all shadow-sm hover:shadow active:scale-95 border border-transparent hover:border-indigo-100">
                            {resendingId === member.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          </button>
                        )}
                        <button onClick={() => openEdit(member)} 
                          className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all shadow-sm hover:shadow active:scale-95 border border-transparent hover:border-indigo-100">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleToggle(member)} disabled={actionLoading}
                          className="p-2.5 text-slate-400 hover:text-amber-600 hover:bg-white rounded-xl transition-all shadow-sm hover:shadow active:scale-95 border border-transparent hover:border-amber-100">
                          {member.status === 'active' ? <Ban className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                        </button>
                        <button onClick={() => handleDelete(member)} disabled={actionLoading}
                          className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-xl transition-all shadow-sm hover:shadow active:scale-95 border border-transparent hover:border-rose-100">
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
          {/* Role picker */}
          <div className="grid grid-cols-2 gap-4">
            {(['operator', 'conductor'] as TeamRole[]).map(role => {
              const cfg  = ROLE_CONFIG[role];
              const Icon = cfg.icon;
              const sel  = addingRole === role;
              return (
                <button key={role} type="button" onClick={() => setAddingRole(role)}
                  className={`relative flex flex-col items-center gap-3 p-6 rounded-[2rem] border-2 transition-all duration-300 ${
                    sel
                      ? `border-indigo-600 bg-indigo-50/50`
                      : 'border-gray-50 bg-gray-50/30 text-gray-300 hover:border-gray-200'
                  }`}>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${sel ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white border border-gray-100'}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="text-center">
                    <p className={`text-[11px] font-black uppercase tracking-widest ${sel ? 'text-indigo-600' : 'text-gray-400'}`}>{cfg.label}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">{cfg.description}</p>
                  </div>
                  {sel && <div className="absolute top-4 right-4"><BadgeCheck className="w-5 h-5 text-indigo-600" /></div>}
                </button>
              );
            })}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Personnel Name</label>
              <div className="relative">
                 <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                 <input type="text" value={newMember.name} onChange={e => setNewMember({ ...newMember, name: e.target.value })}
                   className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-indigo-600 focus:bg-white outline-none transition-all"
                   placeholder="Identity Credentials" required />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Primary Access Email</label>
              <div className="relative">
                 <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                 <input type="email" value={newMember.email} onChange={e => setNewMember({ ...newMember, email: e.target.value })}
                   className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-indigo-600 focus:bg-white outline-none transition-all"
                   placeholder="digital-access@domain.ms" required />
              </div>
            </div>

            {addingRole === 'operator' && (
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Strategic Deployment Zone</label>
                {branches.length > 0 ? (
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                    <select value={newMember.region} onChange={e => setNewMember({ ...newMember, region: e.target.value })}
                      className="w-full pl-11 pr-10 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-indigo-600 focus:bg-white outline-none appearance-none cursor-pointer" required>
                      <option value="">Select Command Center</option>
                      {branches.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 rotate-90" />
                  </div>
                ) : (
                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                    <p className="text-[10px] font-bold text-amber-800 uppercase tracking-widest leading-relaxed">No branches identified. Update company architecture in settings first.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-4 bg-indigo-900 rounded-2xl text-white/90 relative overflow-hidden">
             <div className="absolute right-0 top-0 w-24 h-24 bg-white/5 rounded-full blur-2xl -mr-12 -mt-12"></div>
             <p className="text-[9px] font-black uppercase tracking-[0.2em] mb-2 text-white/50">AUTHORIZATION LEVEL</p>
             <p className="text-[11px] font-bold leading-relaxed">{ROLE_CONFIG[addingRole].permissions}</p>
          </div>

          <div className="flex gap-3 pt-6 border-t border-gray-50">
            <button type="button" onClick={() => setShowAddModal(false)}
              className="flex-1 px-6 py-4 text-[11px] font-black uppercase tracking-widest text-gray-400 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all">
              Abort
            </button>
            <button type="submit" disabled={actionLoading}
              className="flex-[2] flex items-center justify-center gap-3 px-6 py-4 text-[11px] font-black uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-xl shadow-indigo-100 transition-all disabled:opacity-50 active:scale-95">
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
            <div className="flex items-center gap-5 p-6 bg-slate-50 rounded-[2rem] border border-gray-100">
              <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center text-xl font-black text-indigo-600 shadow-sm border border-gray-100">
                 {initials(editingMember.name)}
              </div>
              <div>
                <p className="text-lg font-black text-gray-900 uppercase tracking-tight leading-none">{editingMember.name}</p>
                <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-widest">USER_REF: {editingMember.id.substring(0,8)}</p>
              </div>
            </div>

            {editingMember.role === 'operator' && (
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Relocate Strategic Zone</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                  <select value={editData.region} onChange={e => setEditData({ ...editData, region: e.target.value })}
                    className="w-full pl-11 pr-10 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-indigo-600 focus:bg-white outline-none appearance-none" required>
                    <option value="">Select Command Center</option>
                    {branches.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Operational state</label>
              <div className="grid grid-cols-3 gap-3">
                {(['active', 'inactive', 'pending'] as const).map(s => (
                  <button key={s} type="button" onClick={() => setEditData({ ...editData, status: s })}
                    className={`py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${
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
                className="flex-1 px-6 py-4 text-[11px] font-black uppercase tracking-widest text-gray-400 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all">
                Cancel
              </button>
              <button type="submit" disabled={actionLoading}
                className="flex-[2] flex items-center justify-center gap-3 px-6 py-4 text-[11px] font-black uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-xl shadow-indigo-100 transition-all disabled:opacity-50 active:scale-95">
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
