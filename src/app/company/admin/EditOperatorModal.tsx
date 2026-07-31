'use client';

import React, { Fragment, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, Transition } from '@headlessui/react';
import { Loader2, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Operator, Region } from '@prisma/client';
import { useAppToast } from '@/contexts/ToastContext';

interface OperatorData {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  regionId?: string | null;
}

const editOperatorSchema = z.object({
  role: z.enum(['operator', 'conductor']),
  status: z.enum(['active', 'inactive', 'suspended', 'invited']),
  regionId: z.string().nullable().optional(),
});

type EditFormData = z.infer<typeof editOperatorSchema>;

type EditOperatorModalProps = {
  isOpen: boolean;
  onClose: () => void;
  operator: OperatorData | null;
  companyId?: string;
}

const useRegions = (companyId?: string) => {
  return useQuery<Region[], Error>({
    queryKey: ['regions', companyId],
    queryFn: async () => {
      const url = new URL('/api/admin/coo/regions', window.location.origin);
      url.searchParams.set('limit', '100');
      if (companyId) url.searchParams.set('companyId', companyId);
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error('Failed to fetch regions');
      const data = await response.json();
      return data.regions || [];
    },
    enabled: !!companyId,
  });
};

export default function EditOperatorModal({ isOpen, onClose, operator, companyId }: EditOperatorModalProps) {
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const { data: regions, isLoading: isLoadingRegions } = useRegions(companyId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EditFormData>({
    resolver: zodResolver(editOperatorSchema),
  });

  const regionMatchId = React.useMemo(() => {
    if (!operator?.regionId || !regions) return '';
    const match = regions.find((r) => r.id === operator.regionId);
    return match?.id || '';
  }, [operator?.regionId, regions]);

  useEffect(() => {
    if (operator) {
      reset({
        role: operator.role as 'operator' | 'conductor',
        status: operator.status as 'active' | 'inactive' | 'suspended' | 'invited',
        regionId: operator.regionId || regionMatchId || '',
      });
    }
  }, [operator, regionMatchId, reset]);

  const mutation = useMutation({
    mutationFn: async (data: EditFormData) => {
      if (!operator) throw new Error('No operator selected');
      const response = await fetch(`/api/admin/users/${operator.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          regionId: data.regionId,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update operator.');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['operators'] });
      const branchName = variables.regionId
        ? regions?.find(r => r.id === variables.regionId)?.name || 'selected branch'
        : 'no branch';
      toast.success('Operator updated', `${operator?.name || 'Operator'} has been updated (branch: ${branchName}).`);
      onClose();
    },
    onError: (error: Error) => {
      toast.error('Update failed', error.message || 'Failed to update operator. Please try again.');
    },
  });

  const onSubmit = (data: EditFormData) => {
    mutation.mutate(data);
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-xl transition-all w-full max-w-md border border-gray-100">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <Dialog.Title as="h3" className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-600" />
                    Edit Operator: {operator?.name}
                  </Dialog.Title>
                  <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg font-semibold">×</button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
                  <div>
                    <label htmlFor="role" className="block text-sm font-medium text-gray-700">Role</label>
                    <select id="role" {...register('role')} className="h-10 mt-1 block w-full rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white">
                      <option value="operator">Operator</option>
                      <option value="conductor">Conductor</option>
                    </select>
                    {errors.role && <p className="mt-1 text-xs text-red-600">{errors.role.message}</p>}
                  </div>
                  <div>
                    <label htmlFor="status" className="block text-sm font-medium text-gray-700">Status</label>
                    <select id="status" {...register('status')} className="h-10 mt-1 block w-full rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white">
                      <option value="invited">Invited</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="suspended">Suspended</option>
                    </select>
                    {errors.status && <p className="mt-1 text-xs text-red-600">{errors.status.message}</p>}
                  </div>
                  <div>
                    <label htmlFor="regionId" className="block text-sm font-medium text-gray-700">Region</label>
                    <select id="regionId" {...register('regionId')} className="h-10 mt-1 block w-full rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white" disabled={isLoadingRegions}>
                      <option value="">No Region</option>
                      {regions?.map(region => <option key={region.id} value={region.id}>{region.name}</option>)}
                    </select>
                    {errors.regionId && <p className="mt-1 text-xs text-red-600">{errors.regionId.message}</p>}
                  </div>
                  {mutation.isError && <p className="text-xs text-red-600">Error: {mutation.error.message}</p>}
                  
                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-50 mt-6">
                    <Button type="button" variant="outline" onClick={onClose} className="rounded-xl h-10">
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-10 min-w-[100px]">
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
                    </Button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}