'use client';

import { useState, useEffect, useCallback } from 'react';
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

  useEffect(() => {
    if (!companyId?.trim()) return;

    const fetchBookings = async () => {
      const { data, error } = await supabase
        .from('Booking')
        .select('*, Payment(*)')
        .eq('companyId', companyId.trim())
        .order('updatedAt', { ascending: false })
        .limit(100);

      if (!error && data) {
        const processed = data.map(d => ({
          ...d,
          paymentMethod:
            (d as any).Payment?.[0]?.paymentType ||
            (d as any).Payment?.[0]?.provider ||
            (d as any).paymentMethod ||
            (d.paymentStatus === 'paid' ? 'cash' : 'Not specified'),
          transactionId: (d as any).Payment?.[0]?.transactionId || (d as any).transactionId,
          createdAt: new Date(d.createdAt),
          updatedAt: new Date(d.updatedAt),
        })) as Booking[];

        setBookings(prev => {
          if (prev.length > 0 && processed.length > prev.length && activeTab === 'bookings') {
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

    fetchBookings();

    const channel = supabase
      .channel('admin-bookings-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Booking', filter: `companyId=eq.${companyId.trim()}` },
        () => { fetchBookings(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [companyId, showAlert, activeTab]);

  return { bookings, setBookings, realtimeStatus };
};
