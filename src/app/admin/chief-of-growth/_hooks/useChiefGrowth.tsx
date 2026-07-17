"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import Fuse from 'fuse.js';

// ─── API fetch ────────────────────────────────────────────────────────────────

async function fetchUsers({ queryKey }: any) {
  const [_key, { cursor, q, limit }] = queryKey;
  const url = new URL('/api/admin/users', window.location.origin);
  if (cursor) url.searchParams.set('cursor', cursor);
  // Only send q to server when NOT doing fuzzy (i.e. no query) so pagination works
  url.searchParams.set('limit', String(limit || 25));
  const res = await fetch(url.toString(), { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

// ─── Fuse.js config ───────────────────────────────────────────────────────────

const FUSE_OPTIONS = {
  // Fields to search across
  keys: [
    { name: 'firstName',  weight: 0.35 },
    { name: 'lastName',   weight: 0.35 },
    { name: 'email',      weight: 0.25 },
    { name: 'role',       weight: 0.05 },
  ],
  threshold:          0.35,   // 0 = exact, 1 = match anything
  distance:           120,    // how far from expected position to look
  minMatchCharLength: 1,
  includeScore:       true,
  ignoreLocation:     true,   // don't penalise matches far from start
  useExtendedSearch:  false,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export default function useChiefGrowth(initialData: any[] = [], initialMeta: any = {}) {
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);
  const [cursorStack,   setCursorStack]   = useState<string[]>([]);
  const [query,         setQueryRaw]      = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');

  const queryClient = useQueryClient();

  // Debounce query input by 180 ms so Fuse doesn't fire on every keystroke
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const setQuery = useCallback((val: string) => {
    setQueryRaw(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(val), 180);
  }, []);

  // Fetch users from API (no q param — fuzzy is client side)
  const qKey = ['adminUsers', { cursor: currentCursor, limit: initialMeta?.limit || 50 }];

  const { data, isLoading, refetch } = useQuery({
    queryKey: qKey,
    queryFn:  fetchUsers,
    initialData: { data: initialData || [], meta: initialMeta || {} },
    staleTime: 30_000, // cache for 30s
  });

  const rawUsers = (data?.data || []) as any[];
  const meta     = data?.meta || {};

  // Build Fuse index whenever rawUsers changes
  const fuseIndex = useMemo(() => new Fuse(rawUsers, FUSE_OPTIONS), [rawUsers]);

  // Apply fuzzy filter client-side
  const users = useMemo<any[]>(() => {
    const q = debouncedQuery.trim();
    if (!q) return rawUsers;
    const results = fuseIndex.search(q);
    return results.map(r => r.item);
  }, [debouncedQuery, rawUsers, fuseIndex]);

  // Pagination handlers
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

  // Role update mutation with optimistic update
  type RoleUpdate = { id: string; role: string };

  const mutation = useMutation({
    mutationFn: async ({ id, role }: RoleUpdate) => {
      const res = await fetch(`/api/admin/users/${id}`, {
        method:  'PATCH',
        body:    JSON.stringify({ role }),
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to update role');
      return res.json();
    },
    onMutate: async (variables: RoleUpdate) => {
      const { id, role } = variables;
      await queryClient.cancelQueries({ queryKey: ['adminUsers'] });
      const previous = queryClient.getQueryData(qKey);
      queryClient.setQueryData(qKey, (old: any) => {
        if (!old) return old;
        return { ...old, data: old.data.map((u: any) => u.id === id ? { ...u, role } : u) };
      });
      return { previous };
    },
    onError: (_err: unknown, _vars: RoleUpdate, context?: { previous?: unknown }) => {
      if (context?.previous) queryClient.setQueryData(qKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
    },
  });

  const refresh = useCallback(() => refetch(), [refetch]);

  return {
    users,
    rawUsers,
    meta,
    loading: isLoading,
    currentCursor,
    setCurrentCursor,
    query,
    debouncedQuery,
    setQuery,
    refresh,
    next,
    prev,
    updateRole: mutation.mutateAsync,
    isFuzzyActive: debouncedQuery.trim().length > 0,
  };
}
