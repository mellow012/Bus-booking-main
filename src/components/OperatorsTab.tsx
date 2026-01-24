import React, { useState, useEffect } from 'react';
import { 
  collection, query, where, getDocs, updateDoc, doc, deleteDoc, 
  serverTimestamp, Timestamp 
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebaseConfig';
import { Button } from '@/components/ui/button';
import Modal from '@/components/Modals';
import { Plus, Trash2, UserPlus, Mail, ShieldCheck, Ban, RefreshCw, Send, Clock } from 'lucide-react';

interface Operator {
  id: string;
  uid: string;
  email: string;
  name: string;
  role: 'operator';
  status: 'active' | 'inactive' | 'pending';
  createdAt: Timestamp;
  createdBy: string;
  companyId: string;
  invitationSent?: boolean;
  invitationSentAt?: Timestamp;
}

interface OperatorsTabProps {
  companyId: string;
  setError: (msg: string) => void;
  setSuccess: (msg: string) => void;
}

const OperatorsTab: React.FC<OperatorsTabProps> = ({ companyId, setError, setSuccess }) => {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [companyName, setCompanyName] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newOperator, setNewOperator] = useState({ 
    name: '', 
    email: ''
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [resendingInvite, setResendingInvite] = useState<string | null>(null);
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!companyId || !currentUser) return;

    const fetchData = async () => {
      try {
        const companySnap = await getDocs(query(collection(db, 'companies'), where('__name__', '==', companyId)));
        if (!companySnap.empty) {
          setCompanyName(companySnap.docs[0].data().name || 'Your Company');
        }

        const q = query(collection(db, 'operators'), where('companyId', '==', companyId));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt,
          invitationSentAt: doc.data().invitationSentAt,
        })) as Operator[];
        setOperators(data);
      } catch (err: any) {
        setError(`Failed to load operators: ${err.message}`);
      }
    };

    fetchData();
  }, [companyId, currentUser, setError]);

  const handleAddOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return setError("You must be logged in");

    const payload = {
      name: newOperator.name.trim(),
      email: newOperator.email.trim(),
      companyId,
      companyName,
      invitedBy: currentUser.uid,
    };

    if (!payload.name) return setError("Name is required");
    if (!payload.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) return setError("Valid email required");

    console.log('Sending invite payload:', payload);

    setActionLoading(true);
    try {
      const response = await fetch('/api/operators/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to invite operator');
      }

      // Refresh list
      const q = query(collection(db, 'operators'), where('companyId', '==', companyId));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt,
        invitationSentAt: doc.data().invitationSentAt,
      })) as Operator[];
      setOperators(data);

      setShowAddModal(false);
      setNewOperator({ name: '', email: '' });
      setSuccess(`Invitation sent to ${payload.email}!`);
    } catch (err: any) {
      setError(err.message || 'Failed to send invite');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResendInvite = async (operatorId: string, email: string, name: string) => {
    if (!currentUser) return setError("You must be logged in");

    setResendingInvite(operatorId);
    try {
      const response = await fetch('/api/operators/resend-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operatorId,
          email,
          name,
          companyId,
          companyName,
        }),
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

  const handleToggleStatus = async (operatorId: string, currentStatus: string) => {
    if (!confirm(`Are you sure you want to ${currentStatus === 'active' ? 'deactivate' : 'activate'} this operator?`)) return;

    setActionLoading(true);
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      await updateDoc(doc(db, 'operators', operatorId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });

      setOperators(operators.map(op => 
        op.id === operatorId ? { ...op, status: newStatus as any } : op
      ));
      
      setSuccess(`Operator ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
    } catch (err: any) {
      setError(`Failed to update status: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteOperator = async (id: string, email: string) => {
    if (!confirm(`Delete ${email}? This cannot be undone.`)) return;

    setActionLoading(true);
    try {
      await deleteDoc(doc(db, 'operators', id));
      setOperators(operators.filter(op => op.id !== id));
      setSuccess('Operator deleted');
    } catch (err: any) {
      setError(`Failed to delete: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      pending: 'bg-yellow-100 text-yellow-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Operators</h2>
          <p className="text-sm text-gray-500 mt-1">Team members who help manage operations</p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="flex items-center gap-2">
          <UserPlus className="w-4 h-4" /> Invite Operator
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <p className="text-sm text-gray-600">Total Operators</p>
          <p className="text-2xl font-bold text-gray-900">{operators.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <p className="text-sm text-gray-600">Active</p>
          <p className="text-2xl font-bold text-green-600">
            {operators.filter(op => op.status === 'active').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <p className="text-sm text-gray-600">Pending Invites</p>
          <p className="text-2xl font-bold text-yellow-600">
            {operators.filter(op => op.status === 'pending').length}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {operators.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                  No operators yet. Invite some to get started.
                </td>
              </tr>
            ) : (
              operators.map((op) => (
                <tr key={op.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">{op.name || 'N/A'}</td>
                  <td className="px-6 py-4">{op.email}</td>
                  <td className="px-6 py-4">{getStatusBadge(op.status)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {op.status === 'pending' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResendInvite(op.id, op.email, op.name)}
                          disabled={resendingInvite === op.id}
                          title="Resend invite"
                        >
                          {resendingInvite === op.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleStatus(op.id, op.status)}
                        title={op.status === 'active' ? 'Deactivate' : 'Activate'}
                      >
                        {op.status === 'active' ? <Ban className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteOperator(op.id, op.email)}
                        title="Delete"
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

      {/* Add Modal – no role field */}
      <Modal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)} 
        title="Invite New Operator"
      >
        <form onSubmit={handleAddOperator} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
            <input
              type="text"
              value={newOperator.name}
              onChange={(e) => setNewOperator({ ...newOperator, name: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="John Mwale"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email Address *</label>
            <input
              type="email"
              value={newOperator.email}
              onChange={(e) => setNewOperator({ ...newOperator, email: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="john@example.com"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              They will receive an invitation to join as an operator.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>Note:</strong> New operators can manage their own schedules and bookings.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
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
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Invitation
                </>
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default OperatorsTab;