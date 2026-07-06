'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, PlusCircle, Users, Pencil, Trash2 } from 'lucide-react';
import { useAppToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
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
  routeIds?: string[];
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
  const [isRouteAssignmentModalOpen, setRouteAssignmentModalOpen] = useState(false);
  const [routeAssignmentOperator, setRouteAssignmentOperator] = useState<OperatorRow | null>(null);
  const [selectedRouteIds, setSelectedRouteIds] = useState<string[]>([]);
  const [isSavingRouteAssignment, setIsSavingRouteAssignment] = useState(false);

  const operators = useMemo<OperatorRow[]>(() => {
    const rawOperators = dashboard?.dashboardData?.operators || [];
    const branches = dashboard?.dashboardData?.regions || [];

    return rawOperators.map((operator: any) => {
      const firstName = operator.firstName || '';
      const lastName = operator.lastName || '';
      const derivedName = [firstName, lastName].filter(Boolean).join(' ').trim() || operator.name || operator.email || 'Unknown operator';
      const branchName = operator.region || operator.regionName || branches.find((branch: any) => branch.id === operator.regionId)?.name || 'Unassigned';
      const existingRouteIds = Array.isArray(operator.routes)
        ? operator.routes
            .map((route: any) => route?.id || route?.routeId)
            .filter(Boolean)
        : [];

      return {
        id: operator.id || operator.uid || operator.email || `${derivedName}-${branchName}`,
        name: derivedName,
        email: operator.email || '',
        role: operator.role || 'operator',
        status: operator.status || (operator.isActive === false ? 'inactive' : 'active'),
        region: branchName,
        regionId: operator.regionId || (operator.region && typeof operator.region === 'object' ? operator.region.id : null) || null,
        routeIds: existingRouteIds,
      };
    });
  }, [dashboard]);

  const router = useRouter();
  const toast = useAppToast();
  const branches = useMemo(() => dashboard?.dashboardData?.regions || [], [dashboard]);
  const availableRoutes = useMemo(() => dashboard?.dashboardData?.routes || [], [dashboard]);
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

  const openAssignRoutesModal = async (operator: OperatorRow) => {
    setRouteAssignmentOperator(operator);
    setSelectedRouteIds([]);
    setRouteAssignmentModalOpen(true);

    try {
      const { data, error } = await supabase
        .from('_OperatorRoutes')
        .select('B')
        .eq('A', operator.id);

      if (error) throw error;

      const routeIds = (data || []).map((row: any) => row.B).filter(Boolean);
      setSelectedRouteIds(routeIds);
    } catch (err) {
      console.error('Error loading assigned routes:', err);
      setSelectedRouteIds(operator.routeIds || []);
    }
  };

  const closeAssignRoutesModal = () => {
    setRouteAssignmentOperator(null);
    setSelectedRouteIds([]);
    setRouteAssignmentModalOpen(false);
  };

  const toggleRouteSelection = (routeId: string) => {
    setSelectedRouteIds((prev) =>
      prev.includes(routeId) ? prev.filter((id) => id !== routeId) : [...prev, routeId]
    );
  };

  const handleSaveRouteAssignment = async () => {
    if (!routeAssignmentOperator) return;

    setIsSavingRouteAssignment(true);
    dashboard.setIsBusy?.(true);
    try {
      const response = await fetch(`/api/admin/users/${routeAssignmentOperator.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: routeAssignmentOperator.role,
          status: routeAssignmentOperator.status,
          regionId: routeAssignmentOperator.regionId || null,
          routeIds: selectedRouteIds,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update route assignments');

      await dashboard?.fetchInitialData?.();
      toast.success('Routes updated', `${routeAssignmentOperator.name} now has ${selectedRouteIds.length} assigned route${selectedRouteIds.length === 1 ? '' : 's'}.`);
      dashboard?.showAlert?.('success', 'Route assignments updated successfully');
      closeAssignRoutesModal();
    } catch (err: any) {
      toast.error('Route assignment failed', err.message || 'Failed to update route assignments.');
      dashboard?.showAlert?.('error', err.message || 'Failed to update route assignments');
    } finally {
      setIsSavingRouteAssignment(false);
      dashboard.setIsBusy?.(false);
    }
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
                        onClick={() => openAssignRoutesModal(operator)}
                        disabled={isActionLoading}
                        className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition disabled:opacity-50"
                      >
                        Routes
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

      {isRouteAssignmentModalOpen && routeAssignmentOperator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Assign routes</h3>
                <p className="mt-1 text-sm text-gray-600">{routeAssignmentOperator.name}</p>
              </div>
              <button type="button" onClick={closeAssignRoutesModal} className="text-sm text-gray-500 hover:text-gray-700">Close</button>
            </div>
            <div className="mt-4 space-y-4">
              {availableRoutes.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">No routes are available for this company yet.</div>
              ) : (
                <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-gray-200 p-3">
                  {availableRoutes.map((route: any) => {
                    const isChecked = selectedRouteIds.includes(route.id);
                    return (
                      <label key={route.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-transparent px-2 py-2 hover:border-gray-200 hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleRouteSelection(route.id)}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{route.name || `${route.origin} → ${route.destination}`}</div>
                          <div className="text-xs text-gray-500">{route.origin} → {route.destination}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={closeAssignRoutesModal} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={handleSaveRouteAssignment} disabled={isSavingRouteAssignment} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60">
                {isSavingRouteAssignment ? 'Saving...' : 'Save routes'}
              </button>
            </div>
          </div>
        </div>
      )}

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