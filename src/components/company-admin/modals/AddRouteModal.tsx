import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface AddRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  regionId: string;
}

export default function AddRouteModal({ isOpen, onClose, onSubmit, regionId }: AddRouteModalProps) {
  const [formData, setFormData] = useState({ origin: '', destination: '', baseFare: 0, distance: 0 });
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({ ...formData, regionId, name: `${formData.origin} - ${formData.destination}` });
      setFormData({ origin: '', destination: '', baseFare: 0, distance: 0 });
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
        <h2 className="text-xl font-bold text-gray-900 mb-4">Add Route</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input required type="text" placeholder="Origin" value={formData.origin} onChange={e => setFormData(prev => ({ ...prev, origin: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
          <input required type="text" placeholder="Destination" value={formData.destination} onChange={e => setFormData(prev => ({ ...prev, destination: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
          <input required type="number" min="0" placeholder="Base Fare (MWK)" value={formData.baseFare || ''} onChange={e => setFormData(prev => ({ ...prev, baseFare: parseFloat(e.target.value) }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
          <input required type="number" min="0" placeholder="Distance (km)" value={formData.distance || ''} onChange={e => setFormData(prev => ({ ...prev, distance: parseFloat(e.target.value) }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-gray-100 text-gray-900 rounded-lg font-bold hover:bg-gray-200">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
