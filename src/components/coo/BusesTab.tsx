import React, { useState, useCallback } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import useFilterStore from '@/lib/stores/filterStore';
import * as dbActions from '@/lib/actions/db.actions';
import { Loader2, Plus, Edit3, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';

type Props = { companyId?: string };

const columnHelper = createColumnHelper<any>();

export default function BusesTab({ companyId }: Props) {
  const { regionId, routeId, dateRange } = useFilterStore();
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedBus, setSelectedBus] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const limit = 12;

  const [formData, setFormData] = useState({
    registration: '',
    licensePlate: '',
    seatCount: 0,
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['cooBuses', { companyId, regionId, routeId, page, limit, dateRange }],
    queryFn: async () => {
      const url = new URL('/api/admin/coo/buses', window.location.origin);
      if (companyId) url.searchParams.set('companyId', companyId);
      if (regionId) url.searchParams.set('regionId', regionId);
      if (routeId) url.searchParams.set('routeId', routeId);
      url.searchParams.set('page', String(page));
      url.searchParams.set('limit', String(limit));
      if (dateRange?.from) url.searchParams.set('from', dateRange.from);
      if (dateRange?.to) url.searchParams.set('to', dateRange.to);
      const res = await fetch(url.toString(), { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to fetch buses');
      return res.json();
    },
    placeholderData: keepPreviousData,
  });

  const buses = ((data as any)?.buses || []) as any[];
  const total = (data as any)?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const columns = [
    columnHelper.accessor('registration', { header: 'Registration' }),
    columnHelper.accessor(row => row.company?.name ?? row.companyId, { id: 'company', header: 'Company' }),
    columnHelper.accessor('seatCount', { header: 'Seats', cell: info => info.getValue() ?? '—' }),
    columnHelper.accessor(row => (row.isActive ? 'Active' : 'Inactive'), { id: 'status', header: 'Status' }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: (info) => (
        <div className="inline-flex gap-1" onClick={e => e.stopPropagation()}>
          <Button type="button" variant="ghost" size="sm" className="p-2 text-blue-600 rounded-lg hover:bg-blue-100" onClick={() => { setSelectedBus(info.row.original); setFormData({ registration: info.row.original.registration || '', licensePlate: info.row.original.licensePlate || '', seatCount: info.row.original.seatCount || 0 }); setShowEditModal(true); }} disabled={actionLoading}>
            <Edit3 className="w-4 h-4" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="p-2 text-red-600 rounded-lg hover:bg-red-100" onClick={() => handleDelete(info.row.original.id)} disabled={actionLoading}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    }),
  ];

  const table = useReactTable({ data: buses, columns, getCoreRowModel: getCoreRowModel() });

  const handleAddSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.registration) { alert('Registration is required'); return; }
    setActionLoading(true);
    try {
      const result = await dbActions.createBus({ ...formData, companyId });
      if (result.success) {
        setShowAddModal(false);
        setFormData({ registration: '', licensePlate: '', seatCount: 0 });
        refetch();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to create bus');
    } finally {
      setActionLoading(false);
    }
  }, [formData, companyId, refetch]);

  const handleEditSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBus) return;
    setActionLoading(true);
    try {
      const result = await dbActions.updateBus(selectedBus.id, formData);
      if (result.success) {
        setShowEditModal(false);
        setSelectedBus(null);
        setFormData({ registration: '', licensePlate: '', seatCount: 0 });
        refetch();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update bus');
    } finally {
      setActionLoading(false);
    }
  }, [formData, selectedBus, refetch]);

  const handleDelete = useCallback(async (busId: string) => {
    if (!window.confirm('Are you sure you want to delete this bus?')) return;
    setActionLoading(true);
    try {
      const result = await dbActions.deleteBus(busId);
      if (result.success) {
        refetch();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete bus');
    } finally {
      setActionLoading(false);
    }
  }, [refetch]);

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-10 h-10 text-gray-400 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900">Buses</h3>
        <Button type="button" variant="secondary" className="inline-flex items-center gap-2 text-sm font-bold" onClick={() => { setShowAddModal(true); setFormData({ registration: '', licensePlate: '', seatCount: 0 }); }}>
          <Plus className="w-4 h-4" /> Register Bus
        </Button>
      </div>

      <div className="overflow-x-auto bg-white rounded-xl border border-gray-100">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th key={header.id} className="px-6 py-3 text-left font-bold text-gray-700">{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100">
            {table.getRowModel().rows.map(row => (
              <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-6 py-3 text-gray-700">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" className="px-3" onClick={() => setPage(Math.max(1, page - 1))}>
            Prev
          </Button>
          <Button type="button" variant="outline" size="sm" className="px-3" onClick={() => setPage(Math.min(totalPages, page + 1))}>
            Next
          </Button>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Register Bus</h2>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <input type="text" placeholder="Registration" value={formData.registration} onChange={e => setFormData(prev => ({ ...prev, registration: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              <input type="text" placeholder="License Plate" value={formData.licensePlate} onChange={e => setFormData(prev => ({ ...prev, licensePlate: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              <input type="number" placeholder="Seat Count" value={formData.seatCount} onChange={e => setFormData(prev => ({ ...prev, seatCount: parseInt(e.target.value) }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" isLoading={actionLoading}>
                  Create
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && selectedBus && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Edit Bus</h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <input type="text" placeholder="Registration" value={formData.registration} onChange={e => setFormData(prev => ({ ...prev, registration: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              <input type="text" placeholder="License Plate" value={formData.licensePlate} onChange={e => setFormData(prev => ({ ...prev, licensePlate: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              <input type="number" placeholder="Seat Count" value={formData.seatCount} onChange={e => setFormData(prev => ({ ...prev, seatCount: parseInt(e.target.value) }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowEditModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" isLoading={actionLoading}>
                  Update
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
