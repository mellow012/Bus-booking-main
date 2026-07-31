import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { BUS_TYPES, BUS_STATUSES, SEAT_LAYOUT_TYPES } from '@/app/company/admin/_lib/constants';
import { RowOverride, RowOverrideType } from '@/lib/seatLayout';
import { Plus, Trash2 } from 'lucide-react';

interface AddBusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}

export default function AddBusModal({ isOpen, onClose, onSubmit }: AddBusModalProps) {
  const [formData, setFormData] = useState({
    licensePlate: '',
    busType: 'Standard',
    seatLayoutPreset: 'coach',
    capacity: 45,
    status: 'active',
  });

  const [rowOverrides, setRowOverrides] = useState<RowOverride[]>([]);
  const [showAddOverride, setShowAddOverride] = useState(false);
  const [newOverridePosMode, setNewOverridePosMode] = useState<'first' | 'last' | 'specific'>('last');
  const [newOverrideSpecificRow, setNewOverrideSpecificRow] = useState<number>(5);
  const [newOverrideType, setNewOverrideType] = useState<RowOverrideType>('bench');
  const [newOverrideBenchSeats, setNewOverrideBenchSeats] = useState<number>(5);
  const [newOverrideLeftSeats, setNewOverrideLeftSeats] = useState<number>(2);
  const [newOverrideRightSeats, setNewOverrideRightSeats] = useState<number>(0);
  const [newOverrideLabel, setNewOverrideLabel] = useState<string>('W/C');

  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleAddOverride = () => {
    const position = newOverridePosMode === 'specific' ? newOverrideSpecificRow : newOverridePosMode;
    let overrideObj: RowOverride;

    if (newOverrideType === 'bench') {
      overrideObj = { position, type: 'bench', benchSeats: newOverrideBenchSeats };
    } else if (newOverrideType === 'block') {
      overrideObj = { position, type: 'block', label: newOverrideLabel || 'W/C' };
    } else {
      overrideObj = { position, type: 'asymmetric', leftSeats: newOverrideLeftSeats, rightSeats: newOverrideRightSeats };
    }

    setRowOverrides(prev => [...prev, overrideObj]);
    setShowAddOverride(false);
  };

  const handleRemoveOverride = (index: number) => {
    setRowOverrides(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...formData,
        metadata: {
          seatLayout: {
            preset: formData.seatLayoutPreset,
            rowOverrides,
          },
        },
      };
      await onSubmit(payload);
      setFormData({
        licensePlate: '',
        busType: 'Standard',
        seatLayoutPreset: 'coach',
        capacity: 45,
        status: 'active',
      });
      setRowOverrides([]);
      onClose();
    } catch (err) {
      // Error handled by parent
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Add Bus</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input required type="text" placeholder="License Plate" value={formData.licensePlate} onChange={e => setFormData(prev => ({ ...prev, licensePlate: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
          
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Bus Category (Comfort Tier)</label>
            <select value={formData.busType} onChange={e => setFormData(prev => ({ ...prev, busType: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
              {BUS_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Seat Layout Shape</label>
            <select value={formData.seatLayoutPreset} onChange={e => setFormData(prev => ({ ...prev, seatLayoutPreset: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
              {SEAT_LAYOUT_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Total Capacity</label>
            <input required type="number" min="10" max="100" placeholder="Capacity" value={formData.capacity || ''} onChange={e => setFormData(prev => ({ ...prev, capacity: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
          </div>

          {/* Row Overrides Section */}
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-gray-700">Custom Row Overrides</label>
              {!showAddOverride && (
                <button
                  type="button"
                  onClick={() => setShowAddOverride(true)}
                  className="text-xs text-brand-600 font-bold hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Override
                </button>
              )}
            </div>

            {rowOverrides.length > 0 ? (
              <div className="space-y-1.5 mb-3">
                {rowOverrides.map((ov, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                    <div>
                      <span className="font-bold text-gray-800 capitalize">
                        {ov.position === 'first' ? 'First Row' : ov.position === 'last' ? 'Last Row' : `Row ${ov.position}`}:
                      </span>{' '}
                      <span className="text-gray-600">
                        {ov.type === 'bench' ? `Bench (${ov.benchSeats || 5} seats)` : ov.type === 'block' ? `Block (${ov.label || 'W/C'})` : `Asymmetric (${ov.leftSeats || 0}L / ${ov.rightSeats || 0}R)`}
                      </span>
                    </div>
                    <button type="button" onClick={() => handleRemoveOverride(i)} className="text-rose-500 hover:text-rose-700">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-gray-400 mb-2 italic">No custom row overrides added (using default preset grid).</p>
            )}

            {showAddOverride && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3 mb-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-gray-600 mb-1">Position</label>
                    <select value={newOverridePosMode} onChange={e => setNewOverridePosMode(e.target.value as any)} className="w-full px-2 py-1 border border-gray-300 rounded">
                      <option value="last">Last Row</option>
                      <option value="first">First Row</option>
                      <option value="specific">Specific Row #</option>
                    </select>
                  </div>
                  {newOverridePosMode === 'specific' && (
                    <div>
                      <label className="block text-gray-600 mb-1">Row Number</label>
                      <input type="number" min="1" max="30" value={newOverrideSpecificRow} onChange={e => setNewOverrideSpecificRow(parseInt(e.target.value) || 1)} className="w-full px-2 py-1 border border-gray-300 rounded" />
                    </div>
                  )}
                  <div>
                    <label className="block text-gray-600 mb-1">Override Type</label>
                    <select value={newOverrideType} onChange={e => setNewOverrideType(e.target.value as any)} className="w-full px-2 py-1 border border-gray-300 rounded">
                      <option value="bench">Bench Row (Continuous)</option>
                      <option value="block">Non-seat Block (W/C)</option>
                      <option value="asymmetric">Asymmetric Row</option>
                    </select>
                  </div>
                </div>

                {newOverrideType === 'bench' && (
                  <div>
                    <label className="block text-gray-600 mb-1">Bench Seats Count</label>
                    <input type="number" min="1" max="6" value={newOverrideBenchSeats} onChange={e => setNewOverrideBenchSeats(parseInt(e.target.value) || 5)} className="w-full px-2 py-1 border border-gray-300 rounded" />
                  </div>
                )}

                {newOverrideType === 'block' && (
                  <div>
                    <label className="block text-gray-600 mb-1">Block Label</label>
                    <input type="text" placeholder="W/C" value={newOverrideLabel} onChange={e => setNewOverrideLabel(e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded" />
                  </div>
                )}

                {newOverrideType === 'asymmetric' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-gray-600 mb-1">Left Seats</label>
                      <input type="number" min="0" max="3" value={newOverrideLeftSeats} onChange={e => setNewOverrideLeftSeats(parseInt(e.target.value) || 0)} className="w-full px-2 py-1 border border-gray-300 rounded" />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-1">Right Seats</label>
                      <input type="number" min="0" max="3" value={newOverrideRightSeats} onChange={e => setNewOverrideRightSeats(parseInt(e.target.value) || 0)} className="w-full px-2 py-1 border border-gray-300 rounded" />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setShowAddOverride(false)} className="px-2.5 py-1 text-gray-500 hover:text-gray-700">Cancel</button>
                  <button type="button" onClick={handleAddOverride} className="px-3 py-1 bg-brand-600 text-white rounded font-bold hover:bg-brand-700">Save Override</button>
                </div>
              </div>
            )}
          </div>
          
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
