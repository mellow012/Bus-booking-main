import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { BUS_TYPES, BUS_STATUSES } from '@/app/company/admin/_lib/constants';

interface AddBusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}

export default function AddBusModal({ isOpen, onClose, onSubmit }: AddBusModalProps) {
  const [formData, setFormData] = useState({ licensePlate: '', busType: 'Minibus', capacity: 15, status: 'active' });
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(formData);
      setFormData({ licensePlate: '', busType: 'Minibus', capacity: 15, status: 'active' });
      onClose();
    } catch (err) {
      // Error handled by parent
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Add Bus</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input required type="text" placeholder="License Plate" value={formData.licensePlate} onChange={e => setFormData(prev => ({ ...prev, licensePlate: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
          
          <select value={formData.busType} onChange={e => setFormData(prev => ({ ...prev, busType: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
            {BUS_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
          </select>
          
          <input required type="number" min="10" max="100" placeholder="Capacity" value={formData.capacity || ''} onChange={e => setFormData(prev => ({ ...prev, capacity: parseInt(e.target.value) }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
          
          <select value={formData.status} onChange={e => setFormData(prev => ({ ...prev, status: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
            {BUS_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" isLoading={loading}>
              Create
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
