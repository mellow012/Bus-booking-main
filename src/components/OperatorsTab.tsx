"use client";

import React, { useState, useEffect } from 'react';
import {
  collection, query, where, getDocs, updateDoc, doc, deleteDoc, getDoc, serverTimestamp, Timestamp
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebaseConfig';
import { Button } from '@/components/ui/button';
import Modal from '@/components/Modals';
import {
  Trash2, UserPlus, ShieldCheck, Ban, RefreshCw, Send,
  Users, Truck, MapPin, Edit2, X, Check, Clock, Mail,
  AlertTriangle, ChevronRight, Loader2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type TeamRole = 'operator' | 'conductor';

interface TeamMember {
  id: string; uid: string; email: string; name: string;
  role: TeamRole; status: 'active' | 'inactive' | 'pending';
  region?: string; createdAt: Timestamp; createdBy: string;
  companyId: string; invitationSent?: boolean; invitationSentAt?: Timestamp;
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
    label: 'Operator', plural: 'Operators',
    description: 'Manages schedules and bookings',
    icon: Users, color: 'blue',
    badge: 'bg-blue-100 text-blue-700 border-blue-200',
    tab:   'border-blue-500 text-blue-700 bg-blue-50',
    permissions: 'Can create and manage schedules, handle bookings, and support daily operations for their assigned region.',
  },
  conductor: {
    label: 'Conductor / Driver', plural: 'Conductors & Drivers',
    description: 'Views assigned trips',
    icon: Truck, color: 'purple',
    badge: 'bg-purple-100 text-purple-700 border-purple-200',
    tab:   'border-purple-500 text-purple-700 bg-purple-50',
    permissions: 'Can view only their assigned trips and related passenger information.',
  },
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const parseBranches = (data: any): string[] => {
  if (!data) return [];
  if (Array.isArray(data)) return data.filter(b => typeof b === 'string').map(b => b.trim());
  if (typeof data === 'string') return data.split(',').map(b => b.trim()).filter(Boolean);
  return [];
};

const initials = (name: string) => name?.slice(0, 2).toUpperCase() || '??';

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, string> = {
    active:   'bg-green-100 text-green-700 border-green-200',
    inactive: 'bg-gray-100  text-gray-500  border-gray-200',
    pending:  'bg-amber-100 text-amber-700 border-amber-200',
  };
  const Icon = status === 'active' ? Check : status === 'pending' ? Clock : X;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${map[status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
      <Icon className="w-3 h-3" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

const Avatar: React.FC<{ name: string; role: TeamRole }> = ({ name, role }) => (
  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
    role === 'operator' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
  }`}>
    {initials(name)}
  </div>
);

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

  const currentUser = auth.currentUser;

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!companyId || !currentUser) return;
    const fetch = async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, 'companies', companyId));
        if (snap.exists()) {
          const d = snap.data();
          setCompanyName(d.name || 'Your Company');
          setBranches(parseBranches(d.branches));
        }
        const q = query(collection(db, 'operators'), where('companyId', '==', companyId));
        const s = await getDocs(q);
        setMembers(s.docs.map(d => ({ id: d.id, ...d.data() } as TeamMember)));
      } catch (e: any) {
        setError(`Failed to load team: ${e.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [companyId, currentUser, setError]);

  const refreshMembers = async () => {
    const q = query(collection(db, 'operators'), where('companyId', '==', companyId));
    const s = await getDocs(q);
    setMembers(s.docs.map(d => ({ id: d.id, ...d.data() } as TeamMember)));
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
          invitedBy: currentUser.uid,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'Failed to send invite');
      await refreshMembers();
      setShowAddModal(false);
      setSuccess(`Invitation sent to ${newMember.email}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    if (editingMember.role === 'operator' && !editData.region) return setError('Region is required');
    setActionLoading(true);
    try {
      const patch: any = { status: editData.status, updatedAt: serverTimestamp() };
      if (editingMember.role === 'operator') patch.region = editData.region;
      await updateDoc(doc(db, 'operators', editingMember.id), patch);
      setMembers(prev => prev.map(m =>
        m.id === editingMember.id
          ? { ...m, status: editData.status, region: editingMember.role === 'operator' ? editData.region : m.region }
          : m
      ));
      setShowEditModal(false);
      setEditingMember(null);
      setSuccess(`${editingMember.name} updated`);
    } catch (e: any) {
      setError(e.message);
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
    } catch (e: any) {
      setError(e.message);
    } finally {
      setResendingId(null);
    }
  };

  const handleToggle = async (m: TeamMember) => {
    if (!confirm(`${m.status === 'active' ? 'Deactivate' : 'Activate'} ${m.name}?`)) return;
    setActionLoading(true);
    try {
      const newStatus = m.status === 'active' ? 'inactive' : 'active';
      await updateDoc(doc(db, 'operators', m.id), { status: newStatus, updatedAt: serverTimestamp() });
      setMembers(prev => prev.map(x => x.id === m.id ? { ...x, status: newStatus as any } : x));
      setSuccess(`${m.name} ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (m: TeamMember) => {
    if (!confirm(`Remove ${m.name} from the team? This cannot be undone.`)) return;
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, 'operators', m.id));
      setMembers(prev => prev.filter(x => x.id !== m.id));
      setSuccess(`${m.name} removed`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const filtered = members.filter(m => m.role === activeTab);
  const stats = (role: TeamRole) => ({
    total:   members.filter(m => m.role === role).length,
    active:  members.filter(m => m.role === role && m.status === 'active').length,
    pending: members.filter(m => m.role === role && m.status === 'pending').length,
  });

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Team Management</h2>
          <p className="text-sm text-gray-400 mt-0.5">Manage operators and conductors for your company</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => openAdd('operator')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 rounded-xl transition-colors">
            <Users className="w-4 h-4" /> Add Operator
          </button>
          <button onClick={() => openAdd('conductor')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors">
            <Truck className="w-4 h-4" /> Add Conductor
          </button>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 gap-4">
        {(['operator', 'conductor'] as TeamRole[]).map(role => {
          const cfg = ROLE_CONFIG[role];
          const s   = stats(role);
          const Icon = cfg.icon;
          return (
            <button key={role} onClick={() => setActiveTab(role)}
              className={`p-4 bg-white rounded-2xl border-2 text-left transition-all ${
                activeTab === role ? cfg.tab + ' border-current' : 'border-gray-100 hover:border-gray-200'
              }`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-xl ${role === 'operator' ? 'bg-blue-100' : 'bg-purple-100'}`}>
                  <Icon className={`w-4 h-4 ${role === 'operator' ? 'text-blue-600' : 'text-purple-600'}`} />
                </div>
                <p className="text-sm font-semibold text-gray-700">{cfg.plural}</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{s.total}</p>
              <p className="text-xs text-gray-400 mt-1">
                <span className="text-green-600 font-medium">{s.active} active</span>
                {s.pending > 0 && <span className="text-amber-600 font-medium ml-2">{s.pending} pending</span>}
              </p>
            </button>
          );
        })}
      </div>

      {/* ── Table card ── */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b">
          {(['operator', 'conductor'] as TeamRole[]).map(role => {
            const cfg   = ROLE_CONFIG[role];
            const count = members.filter(m => m.role === role).length;
            const Icon  = cfg.icon;
            return (
              <button key={role} onClick={() => setActiveTab(role)}
                className={`flex items-center gap-2 px-6 py-3.5 text-sm font-semibold transition-colors flex-1 justify-center border-b-2 ${
                  activeTab === role
                    ? cfg.tab
                    : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                }`}>
                <Icon className="w-4 h-4" />
                {cfg.plural}
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  activeTab === role ? cfg.badge : 'bg-gray-100 text-gray-500'
                }`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/70 border-b">
                <tr>
                  {["Member", "Email", ...(activeTab === 'operator' ? ["Region"] : []), "Status", "Actions"].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={activeTab === 'operator' ? 5 : 4} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-gray-300">
                        {React.createElement(ROLE_CONFIG[activeTab].icon, { className: "w-10 h-10" })}
                        <p className="text-sm text-gray-400">No {ROLE_CONFIG[activeTab].plural.toLowerCase()} yet</p>
                        <button onClick={() => openAdd(activeTab)}
                          className="text-sm text-blue-600 hover:underline font-semibold">
                          Invite your first {ROLE_CONFIG[activeTab].label.toLowerCase()} →
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : filtered.map(member => (
                  <tr key={member.id} className="hover:bg-gray-50/50 transition-colors">
                    {/* Member */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={member.name} role={member.role} />
                        <div>
                          <p className="font-semibold text-gray-900">{member.name || 'N/A'}</p>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${ROLE_CONFIG[member.role]?.badge}`}>
                            {ROLE_CONFIG[member.role]?.label}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <Mail className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                        <span className="text-sm truncate max-w-[180px]">{member.email}</span>
                      </div>
                    </td>

                    {/* Region — operators only */}
                    {activeTab === 'operator' && (
                      <td className="px-5 py-3.5">
                        {member.region ? (
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <MapPin className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                            {member.region}
                          </div>
                        ) : (
                          <span className="text-xs text-amber-500 font-medium flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />Not set
                          </span>
                        )}
                      </td>
                    )}

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <StatusBadge status={member.status} />
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1">
                        {member.status === 'pending' && (
                          <button onClick={() => handleResend(member)} disabled={resendingId === member.id} title="Resend invite"
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50">
                            {resendingId === member.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Send className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        <button onClick={() => openEdit(member)} title="Edit"
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleToggle(member)} disabled={actionLoading} title={member.status === 'active' ? 'Deactivate' : 'Activate'}
                          className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50">
                          {member.status === 'active' ? <Ban className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => handleDelete(member)} disabled={actionLoading} title="Remove"
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50">
                          <Trash2 className="w-3.5 h-3.5" />
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
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Invite Team Member">
        <form onSubmit={handleAdd} className="space-y-4">
          {/* Role picker */}
          <div className="grid grid-cols-2 gap-3">
            {(['operator', 'conductor'] as TeamRole[]).map(role => {
              const cfg  = ROLE_CONFIG[role];
              const Icon = cfg.icon;
              const sel  = addingRole === role;
              return (
                <button key={role} type="button" onClick={() => setAddingRole(role)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-sm ${
                    sel
                      ? `border-${cfg.color}-400 bg-${cfg.color}-50 text-${cfg.color}-700`
                      : 'border-gray-200 text-gray-400 hover:border-gray-300'
                  }`}>
                  <Icon className="w-5 h-5" />
                  <span className="font-semibold">{cfg.label}</span>
                  <span className="text-[11px] text-center text-gray-400 leading-tight">{cfg.description}</span>
                </button>
              );
            })}
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Full Name *</label>
            <input type="text" value={newMember.name} onChange={e => setNewMember({ ...newMember, name: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="John Banda" required />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Email Address *</label>
            <input type="email" value={newMember.email} onChange={e => setNewMember({ ...newMember, email: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="john@example.com" required />
            <p className="mt-1 text-xs text-gray-400">They'll receive an email invitation to complete registration.</p>
          </div>

          {/* Region — operators only */}
          {addingRole === 'operator' && (
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Region / Branch *</label>
              {branches.length > 0 ? (
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                  <select value={newMember.region} onChange={e => setNewMember({ ...newMember, region: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none" required>
                    <option value="">Select region</option>
                    {branches.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800">No branches configured. Add branches in your company profile first.</p>
                </div>
              )}
              <p className="mt-1 text-xs text-gray-400">Operators can only manage schedules in their assigned region.</p>
            </div>
          )}

          {/* Permissions note */}
          <div className={`p-3 rounded-xl border text-xs ${
            addingRole === 'operator' ? 'bg-blue-50 border-blue-100 text-blue-800' : 'bg-purple-50 border-purple-100 text-purple-800'
          }`}>
            <p className="font-semibold mb-0.5">Permissions</p>
            <p>{ROLE_CONFIG[addingRole].permissions}</p>
          </div>

          <div className="flex gap-2 pt-2 border-t">
            <button type="button" onClick={() => setShowAddModal(false)}
              className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={actionLoading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50">
              {actionLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Sending…</> : <><Send className="w-4 h-4" />Send Invitation</>}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Edit Modal ── */}
      <Modal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setEditingMember(null); }}
        title={`Edit ${editingMember?.name || 'Team Member'}`}>
        {editingMember && (
          <form onSubmit={handleEdit} className="space-y-4">
            {/* Read-only summary */}
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border">
              <Avatar name={editingMember.name} role={editingMember.role} />
              <div>
                <p className="font-semibold text-gray-900">{editingMember.name}</p>
                <p className="text-xs text-gray-400">{editingMember.email}</p>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border mt-1 inline-block ${ROLE_CONFIG[editingMember.role]?.badge}`}>
                  {ROLE_CONFIG[editingMember.role]?.label}
                </span>
              </div>
            </div>

            {/* Region — operators only */}
            {editingMember.role === 'operator' && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Region / Branch *</label>
                {branches.length > 0 ? (
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                    <select value={editData.region} onChange={e => setEditData({ ...editData, region: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none" required>
                      <option value="">Select region</option>
                      {branches.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-xs text-amber-800">No branches configured in your profile.</p>
                  </div>
                )}
              </div>
            )}

            {/* Status */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Status</label>
              <div className="grid grid-cols-3 gap-2">
                {(['active', 'inactive', 'pending'] as const).map(s => (
                  <button key={s} type="button" onClick={() => setEditData({ ...editData, status: s })}
                    className={`py-2 rounded-xl text-xs font-semibold capitalize border-2 transition-all ${
                      editData.status === s
                        ? s === 'active'   ? 'border-green-400 bg-green-50  text-green-700'
                        : s === 'inactive' ? 'border-gray-400  bg-gray-50   text-gray-700'
                        :                   'border-amber-400 bg-amber-50  text-amber-700'
                        : 'border-gray-100 text-gray-400 hover:border-gray-200'
                    }`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
              <p className="text-xs text-blue-800"><span className="font-semibold">Note:</span> Only region and status can be edited here. The member must update their personal details in their own profile.</p>
            </div>

            <div className="flex gap-2 pt-2 border-t">
              <button type="button" onClick={() => { setShowEditModal(false); setEditingMember(null); }}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={actionLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50">
                {actionLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default TeamManagementTab;