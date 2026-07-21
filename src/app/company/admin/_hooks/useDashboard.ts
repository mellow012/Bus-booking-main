'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Booking } from '@/types';
import { RealtimeStatus, TabType } from '../_lib/constants';

// ── useAlert ──────────────────────────────────────────────────────────────────

type AlertType = { type: 'error' | 'success' | 'warning' | 'info'; message: string } | null;

export const useAlert = () => {
  const [alert, setAlert] = useState<AlertType>(null);

  const showAlert = useCallback(
    <T extends 'error' | 'success' | 'warning' | 'info'>(type: T, message: string) => {
      setAlert({ type, message });
    },
    []
  );

  const clearAlert = useCallback(() => setAlert(null), []);

  useEffect(() => {
    if (!alert) return;
    const t = setTimeout(clearAlert, alert.type === 'error' ? 7000 : 5000);
    return () => clearTimeout(t);
  }, [alert, clearAlert]);

  return { alert, showAlert, clearAlert };
};

// ── useRealtimeBookings ───────────────────────────────────────────────────────
// Optimizations vs original:
//   1. Added limit(100) to cap reads per snapshot.
//   2. Tracks ALL docs in the snapshot so local state is always a complete view
//      — avoids stale-state bugs.
//   3. Removed reconnect loop that created duplicate listeners.

export const useRealtimeBookings = (
  companyId: string | undefined,
  showAlert: (type: 'error' | 'success' | 'warning' | 'info', message: string) => void,
  activeTab: TabType
) => {
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>({
    isConnected: false, lastUpdate: null, pendingUpdates: 0,
  });
  const [bookings, setBookings] = useState<Booking[]>([]);
  const activeTabRef = useRef(activeTab);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    if (!companyId?.trim()) return;

    const processBooking = (raw: any): Booking => ({
      ...raw,
      paymentMethod:
        (raw as any).Payment?.[0]?.paymentType ||
        (raw as any).Payment?.[0]?.provider ||
        raw.paymentMethod ||
        (raw.paymentStatus === 'paid' ? 'cash' : 'Not specified'),
      transactionId: (raw as any).Payment?.[0]?.transactionId || raw.transactionId,
      createdAt: raw.createdAt ? new Date(raw.createdAt) : new Date(),
      updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : new Date(),
    }) as Booking;

    const fetchBookings = async () => {
      if (!companyId?.trim() || document.visibilityState !== 'visible') return;
      const { data, error } = await supabase
        .from('Booking')
        .select('*, Payment(*)')
        .eq('companyId', companyId.trim())
        .order('updatedAt', { ascending: false })
        .limit(100);

      if (!error && data) {
        const processed = data.map(processBooking);

        setBookings(prev => {
          if (prev.length > 0 && processed.length > prev.length && activeTabRef.current === 'bookings') {
            const newB = processed.find(b => !prev.some(old => old.id === b.id));
            if (newB)
              showAlert('info', `New booking received from ${newB.passengerDetails?.[0]?.name || 'customer'}`);
          }
          return processed;
        });

        setRealtimeStatus({ isConnected: true, lastUpdate: new Date(), pendingUpdates: 0 });
      } else if (error) {
        console.error('Supabase booking fetch error:', error);
        setRealtimeStatus(prev => ({ ...prev, isConnected: false }));
      }
    };

    const applyRealtimeUpdate = (payload: any) => {
      const eventType = payload?.eventType?.toUpperCase?.();
      const newRow = payload?.new ? processBooking(payload.new) : null;
      const oldRow = payload?.old ? processBooking(payload.old) : null;

      setBookings(prev => {
        if (eventType === 'INSERT' && newRow) {
          if (activeTabRef.current === 'bookings' && !prev.some(b => b.id === newRow.id)) {
            showAlert('info', `New booking received from ${newRow.passengerDetails?.[0]?.name || 'customer'}`);
          }
          return [newRow, ...prev.filter(b => b.id !== newRow.id)].slice(0, 100);
        }

        if (eventType === 'UPDATE' && newRow) {
          return prev.map(b => (b.id === newRow.id ? newRow : b));
        }

        if (eventType === 'DELETE' && oldRow) {
          return prev.filter(b => b.id !== oldRow.id);
        }

        return prev;
      });

      setRealtimeStatus({ isConnected: true, lastUpdate: new Date(), pendingUpdates: 0 });
    };

    fetchBookings();

    const channel = supabase
      .channel('admin-bookings-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Booking', filter: `companyId=eq.${companyId.trim()}` },
        (payload) => { applyRealtimeUpdate(payload); }
      )
      .subscribe();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchBookings();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [companyId, showAlert]);

  return { bookings, setBookings, realtimeStatus };
};
