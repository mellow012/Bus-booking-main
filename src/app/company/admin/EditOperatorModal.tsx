'use client';

import React, { Fragment, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, Transition } from '@headlessui/react';
import { Loader2, X } from 'lucide-react';
import { Operator, Region } from '@prisma/client';

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
  region: z.string().nullable().optional(),
});

type EditFormData = z.infer<typeof editOperatorSchema>;

type EditOperatorModalProps = {
  isOpen: boolean;
  onClose: () => void;
  operator: OperatorData | null;
}

const useRegions = () => {
  return useQuery<Region[], Error>({
    queryKey: ['regions'],
    queryFn: async () => {
      const response = await fetch('/api/company/regions');
      if (!response.ok) throw new Error('Failed to fetch regions');
      return response.json();
    },
  });
};

export default function EditOperatorModal({ isOpen, onClose, operator }: EditOperatorModalProps) {
  const queryClient = useQueryClient();
  const { data: regions, isLoading: isLoadingRegions } = useRegions();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EditFormData>({
    resolver: zodResolver(editOperatorSchema),
  });

  useEffect(() => {
    if (operator) {
      reset({
        role: operator.role as 'operator' | 'conductor',
        status: operator.status as 'active' | 'inactive' | 'suspended' | 'invited',
        region: operator.regionId || '',
      });
    }
  }, [operator, reset]);

  const mutation = useMutation({
    mutationFn: async (data: EditFormData) => {
      if (!operator) throw new Error('No operator selected');
      const response = await fetch(`/api/company/operators/${operator.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update operator.');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operators'] });
      onClose();
    },
  });

  const onSubmit = (data: EditFormData) => {
    mutation.mutate(data);
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0"><div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" /></Transition.Child>
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
            <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95" enterTo="opacity-100 translate-y-0 sm:scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 translate-y-0 sm:scale-100" leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95">
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block"><button type="button" className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none" onClick={onClose}><X className="h-6 w-6" /></button></div>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">Edit Operator: {operator?.name}</Dialog.Title>
                  <div>
                    <label htmlFor="role" className="block text-sm font-medium text-gray-700">Role</label>
                    <select id="role" {...register('role')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"><option value="operator">Operator</option><option value="conductor">Conductor</option></select>
                    {errors.role && <p className="mt-1 text-sm text-red-600">{errors.role.message}</p>}
                  </div>
                  <div>
                    <label htmlFor="status" className="block text-sm font-medium text-gray-700">Status</label>
                    <select id="status" {...register('status')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"><option value="invited">Invited</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></select>
                    {errors.status && <p className="mt-1 text-sm text-red-600">{errors.status.message}</p>}
                  </div>
                  <div>
                    <label htmlFor="region" className="block text-sm font-medium text-gray-700">Region</label>
                    <select id="region" {...register('region')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm" disabled={isLoadingRegions}>
                      <option value="">No Region</option>
                      {regions?.map(region => <option key={region.id} value={region.id}>{region.name}</option>)}
                    </select>
                    {errors.region && <p className="mt-1 text-sm text-red-600">{errors.region.message}</p>}
                  </div>
                  {mutation.isError && <p className="text-sm text-red-600">Error: {mutation.error.message}</p>}
                  <div className="mt-5 sm:mt-6">
                    <button type="submit" disabled={isSubmitting} className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50">
                      {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Save Changes'}
                    </button>
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