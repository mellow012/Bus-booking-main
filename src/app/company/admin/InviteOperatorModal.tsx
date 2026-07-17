'use client';

import React, { Fragment } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, Transition } from '@headlessui/react';
import { Loader2, X } from 'lucide-react';
import { inviteOperator } from '@/lib/actions/operator.actions';

const inviteSchema = z.object({
  name: z.string().min(2, 'Name is required.'),
  email: z.string().email('A valid email is required.'),
  role: z.enum(['operator', 'conductor'], { error: 'Role is required.' }),
  regionId: z.string().optional(),
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface InviteOperatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  branches?: any[];
  companyId?: string;
  companyName?: string;
}

export default function InviteOperatorModal({ isOpen, onClose, branches = [], companyId = '', companyName = '' }: InviteOperatorModalProps) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
  });

  const mutation = useMutation({
    mutationFn: async (data: InviteFormData) => {
      const response = await inviteOperator({
        ...data,
        role: data.role as 'operator' | 'conductor',
        companyId,
        companyName,
        invitedBy: companyId || 'admin',
      });
      if (!response.success) {
        throw new Error(response.error || 'Failed to send invitation.');
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operators'] });
      onClose();
    },
  });

  const onSubmit = (data: InviteFormData) => {
    mutation.mutate(data);
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
            <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95" enterTo="opacity-100 translate-y-0 sm:scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 translate-y-0 sm:scale-100" leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95">
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
                  <button type="button" className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none" onClick={onClose}><X className="h-6 w-6" /></button>
                </div>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">Invite New Operator</Dialog.Title>
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">Full Name</label>
                    <input type="text" id="name" {...register('name')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm" />
                    {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email Address</label>
                    <input type="email" id="email" {...register('email')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm" />
                    {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
                  </div>
                  <div>
                    <label htmlFor="role" className="block text-sm font-medium text-gray-700">Role</label>
                    <select id="role" {...register('role')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm">
                      <option value="">Select a role</option>
                      <option value="operator">Operator</option>
                      <option value="conductor">Conductor</option>
                    </select>
                    {errors.role && <p className="mt-1 text-sm text-red-600">{errors.role.message}</p>}
                  </div>
                  <div>
                    <label htmlFor="regionId" className="block text-sm font-medium text-gray-700">Assign to Branch (Optional)</label>
                    <select id="regionId" {...register('regionId')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm">
                      <option value="">No branch assigned</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    {errors.regionId && <p className="mt-1 text-sm text-red-600">{errors.regionId.message}</p>}
                  </div>
                  {mutation.isError && <p className="text-sm text-red-600">Error: {mutation.error.message}</p>}
                  <div className="mt-5 sm:mt-6">
                    <button type="submit" disabled={isSubmitting} className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50">
                      {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Send Invitation'}
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