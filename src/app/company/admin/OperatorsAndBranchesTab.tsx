'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, PlusCircle, Users, Pencil, Trash2 } from 'lucide-react';
import { useAppToast } from '@/contexts/ToastContext';
import InviteOperatorModal from './InviteOperatorModal';
import EditOperatorModal from './EditOperatorModal';

interface OperatorsAndBranchesTabProps {
  dashboard: any;
}

type OperatorRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  region: string;
  regionId?: string | null;
};

export default function OperatorsAndBranchesTab({ dashboard }: OperatorsAndBranchesTabProps) {
  const [isInviteModalOpen, setInviteModalOpen] = useState(false);
  const [isBranchModalOpen, setBranchModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any | null>(null);
  const [selectedOperator, setSelectedOperator] = useState<OperatorRow | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [isSavingBranch, setIsSavingBranch] = useState(false);

  const operators = useMemo<OperatorRow[]>(() => {
    const rawOperators = dashboard?.dashboardData?.operators || [];
    const branches = dashboard?.dashboardData?.regions || [];

    return rawOperators.map((operator: any) => {
      const firstName = operator.firstName || '';
      const lastName = operator.lastName || '';
      const derivedName = [firstName, lastName].filter(Boolean).join(' ').trim() || operator.name || operator.email || 'Unknown operator';
      const branchName = operator.region || operator.regionName || branches.find((branch: any) => branch.id === operator.regionId)?.name || 'Unassigned';

      return {
        id: operator.id || operator.uid || operator.email || `${derivedName}-${branchName}`,
        name: derivedName,
        email: operator.email || '',
        role: operator.role || 'operator',
        status: operator.status || (operator.isActive === false ? 'inactive' : 'active'),
        region: branchName,
        regionId: operator.regionId || (operator.region && typeof operator.region === 'object' ? operator.region.id : null) || null,
      };
    });
  }, [dashboard]);

  const router = useRouter();
  const toast = useAppToast();
  const branches = useMemo(() => dashboard?.dashboardData?.regions || [], [dashboard]);
  const companyId = dashboard?.dashboardData?.company?.id || '';
  const companyName = dashboard?.dashboardData?.company?.name || '';

  const filteredOperators = useMemo(() => {
    if (!selectedBranchId) return operators;
    return operators.filter(op => op.regionId === selectedBranchId);
  }, [operators, selectedBranchId]);

  const handleViewOperatorDashboard = (operatorId: string) => {
    router.push(`/company/operator/dashboard?operatorId=${encodeURIComponent(operatorId)}`);
  };

  const openEditOperatorModal = (operator: OperatorRow) => {
    setSelectedOperator(operator);
    setEditModalOpen(true);
  };

  const closeEditOperatorModal = () => {
    setSelectedOperator(null);
    setEditModalOpen(false);
  };

  const confirmDeleteOperator = async (operator: OperatorRow) => {
    setIsActionLoading(true);
    dashboard.setIsBusy?.(true);
    try {
      const response = await fetch(`/api/admin/users/${operator.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to delete operator');
      }
      if (data?.error) {
        throw new Error(data.error);
      }
      await dashboard?.fetchInitialData?.();
      toast.success('Operator deleted', `${operator.name} was removed successfully.`);
      dashboard?.showAlert?.('success', `${operator.name} deleted successfully.`);
    } catch (err: any) {
      toast.error('Delete failed', err?.message || 'Failed to delete operator.');
      dashboard?.showAlert?.('error', err?.message || 'Failed to delete operator');
    } finally {
      setIsActionLoading(false);
      dashboard.setIsBusy?.(false);
    }
  };

  const handleDeleteOperator = (operator: OperatorRow) => {
    let toastId = '';
    toastId = toast.addToast(
      'Confirm deletion',
      `Remove ${operator.name} from the company? This cannot be undone.`,
      'warning',
      0,
      {
        label: 'Confirm',
        onClick: async () => {
          toast.removeToast(toastId);
          await confirmDeleteOperator(operator);
        },
      }
    );
  };

  const resetBranchModal = () => {
    setBranchModalOpen(false);
    setEditingBranch(null);
    setBranchName('');
  };

  const openAddBranchModal = () => {
    setEditingBranch(null);
    setBranchName('');
    setBranchModalOpen(true);
  };

  const openEditBranchModal = (branch: any) => {
    setEditingBranch(branch);
    setBranchName(branch.name || '');
    setBranchModalOpen(true);
  };

  const handleBranchSelect = (branchId: string) => {
    setSelectedBranchId(prev => prev === branchId ? null : branchId);
  };

  const handleSaveBranch = async () => {
    const trimmedName = branchName.trim();
    if (!trimmedName) return;

    setIsSavingBranch(true);
    dashboard.setIsBusy?.(true);
    try {
      const currentBranches = (dashboard?.dashboardData?.regions || []).map((branch: any) => ({
        id: branch.id,
        name: branch.name?.trim() || '',
      })).filter((branch: any) => branch.name);

      const duplicateExists = currentBranches.some((branch: any) =>
        branch.id !== editingBranch?.id && branch.name.toLowerCase() === trimmedName.toLowerCase()
      );

      if (duplicateExists) {
        dashboard?.showAlert?.('error', 'A branch with that name already exists.');
        setIsSavingBranch(false);
        return;
      }

      const nextBranches = editingBranch
        ? currentBranches.map((branch: any) => (branch.id === editingBranch.id ? { ...branch, name: trimmedName } : branch))
        : [...currentBranches, { id: undefined, name: trimmedName }];

      const response = await fetch('/api/company/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          updates: {
            branches: nextBranches.map((branch: any) => ({ id: branch.id || undefined, name: branch.name })),
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save branch');

      await dashboard?.fetchInitialData?.();
      resetBranchModal();
      toast.success('Branch saved', editingBranch ? 'Branch updated successfully.' : 'Branch created successfully.');
      dashboard?.showAlert?.('success', editingBranch ? 'Branch updated successfully' : 'Branch created successfully');
    } catch (err: any) {
      toast.error('Branch save failed', err.message || 'Failed to save branch.');
      dashboard?.showAlert?.('error', err.message || 'Failed to save branch');
    } finally {
      setIsSavingBranch(false);
      dashboard.setIsBusy?.(false);
    }
  };

  return (
    <div className="space-y-6">
      <InviteOperatorModal
        isOpen={isInviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        branches={branches}
        companyId={companyId}
        companyName={companyName}
      />
      <EditOperatorModal
        isOpen={isEditModalOpen}
        onClose={closeEditOperatorModal}
        operator={selectedOperator}
        companyId={companyId}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Operators & Branches</h2>
          <p className="mt-1 text-sm text-gray-600">
            Review the operators linked to this company and manage the branches available to them.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openAddBranchModal}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <MapPin className="h-5 w-5" />
            Add Branch
          </button>
          <button
            type="button"
            onClick={() => setInviteModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            <PlusCircle className="h-5 w-5" />
            Invite Operator
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 bg-gray-50/70 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <MapPin className="h-4 w-4 text-indigo-600" />
            Available branches
          </div>
        </div>
        {branches.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-500">No branches have been created yet.</div>
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {branches.map((branch: any) => {
              const isSelected = selectedBranchId === branch.id;
              return (
                <div
                  key={branch.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleBranchSelect(branch.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleBranchSelect(branch.id);
                    }
                  }}
                  className={`group text-left rounded-xl border px-4 py-3 transition ${isSelected ? 'border-indigo-600 bg-indigo-50 shadow-sm' : 'border-gray-200 bg-gray-50 hover:border-indigo-300 hover:bg-white'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className={`font-medium ${isSelected ? 'text-indigo-900' : 'text-gray-900'}`}>{branch.name}</div>
                      <div className="mt-1 text-xs text-gray-500">{branch.code || 'Branch'}</div>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => { event.stopPropagation(); openEditBranchModal(branch); }}
                      className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 bg-gray-50/70 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Users className="h-4 w-4 text-indigo-600" />
            Company operators
          </div>
        </div>

        {filteredOperators.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-500">
            {selectedBranchId ? 'No operators assigned to this branch yet.' : 'No operators have been linked to this company yet.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-white">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-6">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-6">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-6">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-6">Branch</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-6">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredOperators.map((operator) => (
                  <tr key={operator.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900 sm:px-6">
                      <div className="font-medium">{operator.name}</div>
                      <div className="text-xs text-gray-500">{operator.email}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 sm:px-6">{operator.role}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm sm:px-6">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${operator.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>
                        {operator.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 sm:px-6">{operator.region}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right sm:px-6 space-x-2">
                      <button
                        type="button"
                        onClick={() => handleViewOperatorDashboard(operator.id)}
                        disabled={isActionLoading}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditOperatorModal(operator)}
                        disabled={isActionLoading}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteOperator(operator)}
                        disabled={isActionLoading}
                        className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500 transition disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isBranchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{editingBranch ? 'Update branch' : 'Add branch'}</h3>
              <button type="button" onClick={resetBranchModal} className="text-sm text-gray-500 hover:text-gray-700">Close</button>
            </div>
            <div className="mt-4 space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                Branch name
                <input
                  value={branchName}
                  onChange={(event) => setBranchName(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none ring-0 focus:border-indigo-500"
                  placeholder="e.g. CBD"
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={resetBranchModal} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={handleSaveBranch} disabled={isSavingBranch || !branchName.trim()} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60">
                {isSavingBranch ? 'Saving...' : editingBranch ? 'Save changes' : 'Create branch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}