import React, { useState, useEffect } from 'react';
import {
  collection, query, where, getDocs, updateDoc, doc, deleteDoc,
  serverTimestamp, Timestamp
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebaseConfig';
import { Button } from '@/components/ui/button';
import Modal from '@/components/Modals';
import {
  Trash2, UserPlus, ShieldCheck, Ban, RefreshCw, Send,
  Users, Truck, ChevronDown
} from 'lucide-react';

type TeamRole = 'operator' | 'conductor';

interface TeamMember {
  id: string;
  uid: string;
  email: string;
  name: string;
  role: TeamRole;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Timestamp;
  createdBy: string;
  companyId: string;
  invitationSent?: boolean;
  invitationSentAt?: Timestamp;
}

interface TeamManagementTabProps {
  companyId: string;
  setError: (msg: string) => void;
  setSuccess: (msg: string) => void;
}

const ROLE_CONFIG: Record<TeamRole, {
  label: string;
  plural: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  badgeColor: string;
}> = {
  operator: {
    label: 'Operator',
    plural: 'Operators',
    description: 'Can manage schedules and bookings',
    icon: <Users className="w-5 h-5" />,
    color: 'blue',
    badgeColor: 'bg-blue-100 text-blue-800',
  },
  conductor: {
    label: 'Conductor / Driver',
    plural: 'Conductors & Drivers',
    description: 'Can view their assigned trips',
    icon: <Truck className="w-5 h-5" />,
    color: 'purple',
    badgeColor: 'bg-purple-100 text-purple-800',
  },
};

const TeamManagementTab: React.FC<TeamManagementTabProps> = ({ companyId, setError, setSuccess }) => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [companyName, setCompanyName] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TeamRole>('operator');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingRole, setAddingRole] = useState<TeamRole>('operator');
  const [newMember, setNewMember] = useState({ name: '', email: '' });
  const [actionLoading, setActionLoading] = useState(false);
  const [resendingInvite, setResendingInvite] = useState<string | null>(null);
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!companyId || !currentUser) return;

    const fetchData = async () => {
      try {
        const companySnap = await getDocs(
          query(collection(db, 'companies'), where('__name__', '==', companyId))
        );
        if (!companySnap.empty) {
          setCompanyName(companySnap.docs[0].data().name || 'Your Company');
        }

        const q = query(collection(db, 'operators'), where('companyId', '==', companyId));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data(),
          createdAt: d.data().createdAt,
          invitationSentAt: d.data().invitationSentAt,
        })) as TeamMember[];
        setMembers(data);
      } catch (err: any) {
        setError(`Failed to load team members: ${err.message}`);
      }
    };

    fetchData();
  }, [companyId, currentUser, setError]);

  const refreshMembers = async () => {
    const q = query(collection(db, 'operators'), where('companyId', '==', companyId));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt,
      invitationSentAt: d.data().invitationSentAt,
    })) as TeamMember[];
    setMembers(data);
  };

  const openAddModal = (role: TeamRole) => {
    setAddingRole(role);
    setNewMember({ name: '', email: '' });
    setShowAddModal(true);
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return setError('You must be logged in');

    const payload = {
      name: newMember.name.trim(),
      email: newMember.email.trim(),
      role: addingRole,
      companyId,
      companyName,
      invitedBy: currentUser.uid,
    };

    if (!payload.name) return setError('Name is required');
    if (!payload.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      return setError('Valid email required');
    }

    setActionLoading(true);
    try {
      const response = await fetch('/api/operators/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to send invite');
      }

      await refreshMembers();
      setShowAddModal(false);
      setNewMember({ name: '', email: '' });
      setSuccess(`Invitation sent to ${payload.email}!`);
    } catch (err: any) {
      setError(err.message || 'Failed to send invite');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResendInvite = async (memberId: string, email: string, name: string, role: TeamRole) => {
    if (!currentUser) return setError('You must be logged in');

    setResendingInvite(memberId);
    try {
      const response = await fetch('/api/operators/resend-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorId: memberId, email, name, role, companyId, companyName }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to resend');
      }

      setSuccess(`Invitation resent to ${email}`);
    } catch (err: any) {
      setError(err.message || 'Failed to resend invitation');
    } finally {
      setResendingInvite(null);
    }
  };

  const handleToggleStatus = async (memberId: string, currentStatus: string) => {
    const action = currentStatus === 'active' ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${action} this team member?`)) return;

    setActionLoading(true);
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      await updateDoc(doc(db, 'operators', memberId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      setMembers(members.map(m => m.id === memberId ? { ...m, status: newStatus as any } : m));
      setSuccess(`Team member ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
    } catch (err: any) {
      setError(`Failed to update status: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteMember = async (id: string, email: string) => {
    if (!confirm(`Delete ${email}? This cannot be undone.`)) return;

    setActionLoading(true);
    try {
      await deleteDoc(doc(db, 'operators', id));
      setMembers(members.filter(m => m.id !== id));
      setSuccess('Team member removed');
    } catch (err: any) {
      setError(`Failed to delete: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      pending: 'bg-yellow-100 text-yellow-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] ?? 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const filteredMembers = members.filter(m => m.role === activeTab);
  const roleConfig = ROLE_CONFIG[activeTab];

  const statsFor = (role: TeamRole) => ({
    total: members.filter(m => m.role === role).length,
    active: members.filter(m => m.role === role && m.status === 'active').length,
    pending: members.filter(m => m.role === role && m.status === 'pending').length,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Team Management</h2>
          <p className="text-sm text-gray-500 mt-1">Manage operators and conductors for your company</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => openAddModal('operator')}
            variant="outline"
            className="flex items-center gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            <Users className="w-4 h-4" /> Add Operator
          </Button>
          <Button
            onClick={() => openAddModal('conductor')}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Truck className="w-4 h-4" /> Add Conductor
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(['operator', 'conductor'] as TeamRole[]).flatMap(role => {
          const stats = statsFor(role);
          const cfg = ROLE_CONFIG[role];
          return [
            <div key={`${role}-total`} className="bg-white p-4 rounded-lg border shadow-sm">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{cfg.plural}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
              <p className="text-xs text-gray-400 mt-1">{stats.active} active · {stats.pending} pending</p>
            </div>
          ];
        })}
      </div>

      {/* Tab Switcher */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="flex border-b">
          {(['operator', 'conductor'] as TeamRole[]).map(role => {
            const cfg = ROLE_CONFIG[role];
            const count = members.filter(m => m.role === role).length;
            const isActive = activeTab === role;
            return (
              <button
                key={role}
                onClick={() => setActiveTab(role)}
                className={`
                  flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors relative flex-1 justify-center
                  ${isActive
                    ? `text-${cfg.color}-700 border-b-2 border-${cfg.color}-600 bg-${cfg.color}-50`
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}
                `}
              >
                {cfg.icon}
                {cfg.plural}
                <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${isActive ? cfg.badgeColor : 'bg-gray-100 text-gray-600'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Table */}
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredMembers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-gray-400">
                    {roleConfig.icon}
                    <p className="text-sm">No {roleConfig.plural.toLowerCase()} yet.</p>
                    <button
                      onClick={() => openAddModal(activeTab)}
                      className="text-sm text-blue-600 hover:underline font-medium"
                    >
                      Invite your first {roleConfig.label.toLowerCase()}
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              filteredMembers.map(member => (
                <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-600">
                        {member.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <span className="font-medium text-gray-900">{member.name || 'N/A'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{member.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${ROLE_CONFIG[member.role]?.badgeColor ?? 'bg-gray-100 text-gray-700'}`}>
                      {ROLE_CONFIG[member.role]?.label ?? member.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(member.status)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      {member.status === 'pending' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResendInvite(member.id, member.email, member.name, member.role)}
                          disabled={resendingInvite === member.id}
                          title="Resend invite"
                          className="text-gray-500 hover:text-blue-600"
                        >
                          {resendingInvite === member.id
                            ? <RefreshCw className="w-4 h-4 animate-spin" />
                            : <Send className="w-4 h-4" />}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleStatus(member.id, member.status)}
                        disabled={actionLoading}
                        title={member.status === 'active' ? 'Deactivate' : 'Activate'}
                        className="text-gray-500 hover:text-orange-600"
                      >
                        {member.status === 'active'
                          ? <Ban className="w-4 h-4" />
                          : <ShieldCheck className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteMember(member.id, member.email)}
                        disabled={actionLoading}
                        title="Remove"
                        className="text-gray-500 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Member Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={`Invite New ${ROLE_CONFIG[addingRole].label}`}
      >
        <form onSubmit={handleAddMember} className="space-y-5">
          {/* Role selector inside modal */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Inviting as</label>
            <div className="grid grid-cols-2 gap-3">
              {(['operator', 'conductor'] as TeamRole[]).map(role => {
                const cfg = ROLE_CONFIG[role];
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setAddingRole(role)}
                    className={`
                      flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all text-sm
                      ${addingRole === role
                        ? `border-${cfg.color}-500 bg-${cfg.color}-50 text-${cfg.color}-700`
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'}
                    `}
                  >
                    {cfg.icon}
                    <span className="font-medium">{cfg.label}</span>
                    <span className="text-xs text-center text-gray-400">{cfg.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input
              type="text"
              value={newMember.name}
              onChange={e => setNewMember({ ...newMember, name: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="John Banda"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
            <input
              type="email"
              value={newMember.email}
              onChange={e => setNewMember({ ...newMember, email: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="john@example.com"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              They'll receive an email invitation to complete their registration.
            </p>
          </div>

          <div className={`rounded-lg p-4 border ${addingRole === 'operator' ? 'bg-blue-50 border-blue-200' : 'bg-purple-50 border-purple-200'}`}>
            <p className={`text-sm font-medium ${addingRole === 'operator' ? 'text-blue-800' : 'text-purple-800'}`}>
              {ROLE_CONFIG[addingRole].label} Permissions
            </p>
            <p className={`text-xs mt-1 ${addingRole === 'operator' ? 'text-blue-700' : 'text-purple-700'}`}>
              {addingRole === 'operator'
                ? 'Can create and manage schedules, handle bookings, and support daily operations.'
                : 'Can view only their assigned trips and related passenger information.'}
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAddModal(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={actionLoading}
              className="flex items-center gap-2"
            >
              {actionLoading ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Sending...</>
              ) : (
                <><Send className="w-4 h-4" /> Send Invitation</>
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default TeamManagementTab;