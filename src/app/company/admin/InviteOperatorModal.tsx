import React, { Fragment } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, Transition } from '@headlessui/react';
import { Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
                    Invite New Operator
                  </Dialog.Title>
                  <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg font-semibold">×</button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">Full Name</label>
                    <input type="text" id="name" {...register('name')} className="h-10 mt-1 block w-full rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white" placeholder="Enter full name" />
                    {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email Address</label>
                    <input type="email" id="email" {...register('email')} className="h-10 mt-1 block w-full rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white" placeholder="operator@example.com" />
                    {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
                  </div>
                  <div>
                    <label htmlFor="role" className="block text-sm font-medium text-gray-700">Role</label>
                    <select id="role" {...register('role')} className="h-10 mt-1 block w-full rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white">
                      <option value="">Select a role</option>
                      <option value="operator">Operator</option>
                      <option value="conductor">Conductor</option>
                    </select>
                    {errors.role && <p className="mt-1 text-xs text-red-600">{errors.role.message}</p>}
                  </div>
                  <div>
                    <label htmlFor="regionId" className="block text-sm font-medium text-gray-700">Assign to Branch (Optional)</label>
                    <select id="regionId" {...register('regionId')} className="h-10 mt-1 block w-full rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white">
                      <option value="">No branch assigned</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    {errors.regionId && <p className="mt-1 text-xs text-red-600">{errors.regionId.message}</p>}
                  </div>
                  {mutation.isError && <p className="text-xs text-red-600">Error: {mutation.error.message}</p>}
                  
                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-50 mt-6">
                    <Button type="button" variant="outline" onClick={onClose} className="rounded-xl h-10">
                      Cancel
                    </Button>
                    <Button type="submit" disabled={mutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-10 min-w-[100px]">
                      {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Invitation'}
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