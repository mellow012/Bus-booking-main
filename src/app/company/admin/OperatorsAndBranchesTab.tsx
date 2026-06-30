'use client';

import React, { useState } from 'react';
import { PlusCircle, MoreVertical, Edit, Trash2, Building2, MapPin, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import InviteOperatorModal from './InviteOperatorModal';
import ConfirmDeleteModal from '../../../components/company-admin/modals/ConfirmDeleteModal';
import EditOperatorModal from '../../../components/company-admin/modals/EditOperatorModal';

interface OperatorsAndBranchesTabProps {
  dashboard: any;
}

export default function OperatorsAndBranchesTab({ dashboard }: OperatorsAndBranchesTabProps) {
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const { dashboardData, updateDashboardData } = dashboard;
  const operators = dashboardData.operators || [];
  const branches = dashboardData.regions || [];

  const searchQuery = dashboard.searchQuery?.toLowerCase() || '';

  const filteredBranches = branches.filter((branch: any) => {
    return (
      branch.name?.toLowerCase().includes(searchQuery) ||
      branch.code?.toLowerCase().includes(searchQuery)
    );
  });

  const filteredOperators = operators.filter((operator: any) => {
    return (
      operator.firstName?.toLowerCase().includes(searchQuery) ||
      operator.lastName?.toLowerCase().includes(searchQuery) ||
      operator.email?.toLowerCase().includes(searchQuery) ||
      operator.branch?.some((b: string) => b.toLowerCase().includes(searchQuery)) ||
      operator.region?.toLowerCase().includes(searchQuery) ||
      branches.find((b: any) => b.id === operator.regionId)?.name.toLowerCase().includes(searchQuery)
    );
  });

  const [isInviteModalOpen, setInviteModalOpen] = useState(false);
  const [operatorToDelete, setOperatorToDelete] = useState<any>(null);
  const [operatorToEdit, setOperatorToEdit] = useState<any>(null);

  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchCode, setNewBranchCode] = useState('');
  const [isAddingBranch, setIsAddingBranch] = useState(false);

  const handleAddBranch = async () => {
    if (!newBranchName.trim()) return;
    try {
      const companyId = dashboardData.company?.id;
      if (!companyId) throw new Error("Company ID missing");

      // We use supabase directly since we're in a client component and the hook uses it
      const { data, error } = await supabase.from('Region').insert({
        companyId,
        name: newBranchName.trim(),
        code: newBranchCode.trim() || null,
        isActive: true
      }).select().single();
      
      if (error) throw error;

      const updatedBranches = [...branches, data];
      // Optimistic UI update
      updateDashboardData('regions', updatedBranches);

      setNewBranchName('');
      setNewBranchCode('');
      setIsAddingBranch(false);
      dashboard.showAlert('success', 'Branch added successfully');
    } catch (err: any) {
      dashboard.showAlert('error', 'Failed to add branch');
    }
  };

  const handleConfirmDelete = async () => {
    if (operatorToDelete) {
      try {
        await fetch(`/api/company/operators/${operatorToDelete.id}`, { method: 'DELETE' });
        dashboard.fetchInitialData();
        setOperatorToDelete(null);
        dashboard.showAlert('success', 'Operator deleted');
      } catch (e) {
        dashboard.showAlert('error', 'Failed to delete operator');
      }
    }
  };

  return (
    <>
      <InviteOperatorModal isOpen={isInviteModalOpen} onClose={() => { setInviteModalOpen(false); dashboard.fetchInitialData(); }} branches={branches} />
      <EditOperatorModal isOpen={!!operatorToEdit} onClose={() => { setOperatorToEdit(null); dashboard.fetchInitialData(); }} operator={operatorToEdit} />
      <ConfirmDeleteModal
        isOpen={!!operatorToDelete}
        onClose={() => setOperatorToDelete(null)}
        onConfirm={handleConfirmDelete}
        isDeleting={false}
        title="Delete Operator"
        message={`Are you sure you want to delete this operator? This action cannot be undone.`}
      />

      <div className="space-y-8 animate-in fade-in duration-500">

        {/* Branches Section */}
        <div>
          <div className="flex justify-between items-end mb-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
                <Building2 className="w-6 h-6 text-indigo-600" />
                Company Branches
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Manage your operational jurisdictions.
              </p>
            </div>
            {!isAddingBranch && (
              <button
                onClick={() => setIsAddingBranch(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-white border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm"
              >
                <PlusCircle className="h-4 w-4" />
                Add Branch
              </button>
            )}
          </div>

          {isAddingBranch && (
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-wrap gap-3 items-center">
              <input
                type="text"
                placeholder="Branch name (e.g., Lilongwe)"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                className="block flex-1 min-w-[200px] rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
              />
              <input
                type="text"
                placeholder="Branch Code (Optional)"
                value={newBranchCode}
                onChange={(e) => setNewBranchCode(e.target.value)}
                className="block flex-1 min-w-[150px] rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
              />
              <button
                onClick={handleAddBranch}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                Save
              </button>
              <button
                onClick={() => setIsAddingBranch(false)}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBranches.map((branch: any) => (
              <div key={branch.id} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{branch.name}</h3>
                    <p className="text-xs text-gray-500">{operators.filter((o: any) => o.regionId === branch.id || o.branch?.includes(branch.name)).length} Operators assigned</p>
                  </div>
                </div>
              </div>
            ))}
            {filteredBranches.length === 0 && !isAddingBranch && (
              <div className="col-span-full py-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <p className="text-gray-500">{searchQuery ? 'No branches found matching search.' : 'No branches added yet.'}</p>
              </div>
            )}
          </div>
        </div>

        {/* Operators Section */}
        <div>
          <div className="flex justify-between items-end mb-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
                <Users className="w-6 h-6 text-indigo-600" />
                Operators
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Manage your operators and their assigned branches.
              </p>
            </div>
            <button
              onClick={() => setInviteModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              <PlusCircle className="h-4 w-4" />
              Invite Operator
            </button>
          </div>

          <div className="overflow-hidden shadow-sm ring-1 ring-black ring-opacity-5 rounded-xl">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="py-3.5 pl-6 pr-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Branch / Region</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="relative py-3.5 pl-3 pr-6"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredOperators.map((operator: any) => (
                  <tr key={operator.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap py-4 pl-6 pr-3 text-sm">
                      <div className="font-bold text-gray-900">{operator.firstName} {operator.lastName}</div>
                      <div className="text-gray-500">{operator.email}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                      {branches.find((b: any) => b.id === operator.regionId)?.name || operator.branch?.join(', ') || operator.region || 'Not assigned'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${operator.isActive !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {operator.isActive !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-6 text-right text-sm font-medium">
                      <div className="relative inline-block text-left">
                        <button
                          onClick={() => setOpenDropdownId(openDropdownId === operator.id ? null : operator.id)}
                          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                        >
                          <MoreVertical className="h-5 w-5" />
                        </button>
                        {openDropdownId === operator.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setOpenDropdownId(null)}></div>
                            <div className="absolute right-0 z-20 mt-2 w-40 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                              <div className="py-1">
                                <button
                                  onClick={() => { setOperatorToEdit(operator); setOpenDropdownId(null); }}
                                  className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  <Edit className="mr-3 h-4 w-4 text-gray-400" /> Edit
                                </button>
                                <button
                                  onClick={() => { setOperatorToDelete(operator); setOpenDropdownId(null); }}
                                  className="flex w-full items-center px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="mr-3 h-4 w-4 text-red-400" /> Delete
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredOperators.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-sm text-gray-500">
                      {searchQuery ? 'No operators found matching search.' : 'No operators found. Invite one to get started.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}