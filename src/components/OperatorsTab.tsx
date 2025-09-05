import React, { useState, useEffect } from 'react';
import { addDoc, collection, query, where, getDocs, updateDoc, doc,deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { Button } from '@/components/ui/button';
import Modal from '@/components/Modals';
import { Plus, Edit3, Trash2 } from 'lucide-react';

interface Operator {
  id: string;
  email: string;
  name: string;
  role: 'operations_manager' | 'ticket_manager';
  status: 'active' | 'inactive';
  createdAt: Date;
}

interface OperatorsTabProps {
  companyId: string;
  setError: (msg: string) => void;
  setSuccess: (msg: string) => void;
}

const OperatorsTab: React.FC<OperatorsTabProps> = ({ companyId, setError, setSuccess }) => {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newOperator, setNewOperator] = useState({ name: '', email: '', role: 'operations_manager' as 'operations_manager' | 'ticket_manager' });
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const fetchOperators = async () => {
      try {
        const q = query(collection(db, 'operators'), where('companyId', '==', companyId));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt.toDate(),
        })) as Operator[];
        setOperators(data);
      } catch (err: any) {
        setError(`Failed to load operators: ${err.message}`);
      }
    };

    fetchOperators();
  }, [companyId, setError]);

  const handleAddOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const docRef = await addDoc(collection(db, 'operators'), {
        ...newOperator,
        companyId,
        status: 'active',
        createdAt: new Date(),
      });
      setOperators([...operators, { id: docRef.id, ...newOperator, status: 'active', createdAt: new Date() }]);
      setShowAddModal(false);
      setNewOperator({ name: '', email: '', role: 'operations_manager' });
      setSuccess('Operator added successfully!');
    } catch (err: any) {
      setError(`Failed to add operator: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteOperator = async (id: string) => {
    if (!confirm('Are you sure you want to delete this operator?')) return;
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, 'operators', id));
      setOperators(operators.filter(op => op.id !== id));
      setSuccess('Operator deleted successfully!');
    } catch (err: any) {
      setError(`Failed to delete operator: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Operators</h2>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4 mr-2" /> Add Operator
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {operators.map((op) => (
              <tr key={op.id}>
                <td className="px-6 py-4">{op.name}</td>
                <td className="px-6 py-4">{op.email}</td>
                <td className="px-6 py-4">{op.role === 'operations_manager' ? 'Operations Manager' : 'Ticket Manager'}</td>
                <td className="px-6 py-4">{op.status}</td>
                <td className="px-6 py-4">
                  <Button variant="ghost" onClick={() => handleDeleteOperator(op.id)} className="text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Operator">
        <form onSubmit={handleAddOperator} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              value={newOperator.name}
              onChange={(e) => setNewOperator({ ...newOperator, name: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border rounded-md"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={newOperator.email}
              onChange={(e) => setNewOperator({ ...newOperator, email: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border rounded-md"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Role</label>
            <select
              value={newOperator.role}
              onChange={(e) => setNewOperator({ ...newOperator, role: e.target.value as 'operations_manager' | 'ticket_manager' })}
              className="mt-1 block w-full px-3 py-2 border rounded-md"
              required
            >
              <option value="operations_manager">Operations Manager (Routes, Bookings, Payments)</option>
              <option value="ticket_manager">Ticket Manager (Tickets)</option>
            </select>
          </div>
          <Button type="submit" disabled={actionLoading}>Add Operator</Button>
        </form>
      </Modal>
    </div>
  );
};

export default OperatorsTab;