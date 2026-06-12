"use client";

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';

async function fetchUsers({ queryKey }: any) {
  const [_key, { cursor, q, limit }] = queryKey;
  const url = new URL('/api/admin/users', window.location.origin);
  if (cursor) url.searchParams.set('cursor', cursor);
  if (q) url.searchParams.set('q', q);
  url.searchParams.set('limit', String(limit || 25));
  const res = await fetch(url.toString(), { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

export default function useChiefGrowth(initialData: any[] = [], initialMeta: any = {}) {
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [query, setQuery] = useState<string>('');
  const queryClient = useQueryClient();

  const qKey = ['adminUsers', { cursor: currentCursor, q: query, limit: initialMeta?.limit || 25 }];

  const { data, isLoading, refetch } = useQuery({
    queryKey: qKey,
    queryFn: fetchUsers,
    initialData: { data: initialData || [], meta: initialMeta || {} },
  });

  const users = data?.data || [];
  const meta = data?.meta || {};

  const next = useCallback(() => {
    if (meta.nextCursor) {
      setCursorStack(s => [...s, currentCursor || '']);
      setCurrentCursor(meta.nextCursor);
    }
  }, [meta.nextCursor, currentCursor]);

  const prev = useCallback(() => {
    setCursorStack(s => {
      const copy = [...s];
      const last = copy.pop();
      setCurrentCursor(last && last !== '' ? last : null);
      return copy;
    });
  }, []);

  type RoleUpdate = { id: string; role: string };

  const mutation = useMutation({
    mutationFn: async ({ id, role }: RoleUpdate) => {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify({ role }), credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to update role');
      return res.json();
    },
    // optimistic update
    onMutate: async (variables: RoleUpdate) => {
      const { id, role } = variables;
      await queryClient.cancelQueries({ queryKey: ['adminUsers'] });
      const previous = queryClient.getQueryData(qKey);
      queryClient.setQueryData(qKey, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map((u: any) => u.id === id ? { ...u, role } : u)
        };
      });
      return { previous };
    },
    onError: (err: unknown, variables: RoleUpdate, context?: { previous?: unknown }) => {
      if (context?.previous) queryClient.setQueryData(qKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
    }
  });

  const refresh = useCallback(() => refetch(), [refetch]);

  return { users, meta, loading: isLoading, currentCursor, setCurrentCursor, query, setQuery, refresh, next, prev, updateRole: mutation.mutateAsync };
}
