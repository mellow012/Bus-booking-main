'use client';
import React, { useEffect, useState } from 'react';
import TourModal from '@/components/TourModal';
import { useAuth } from '@/contexts/AuthContext';

/**
 * AutoTour — silently shows the tour modal once for brand-new users.
 *
 * Strategy:
 *  1. Check localStorage for key "tour_seen". If present → skip.
 *  2. Check if the Firebase user account was created very recently
 *     (within the last 30 seconds) — that means this is the first session
 *     after signup.
 *  3. If both conditions pass → open the tour after a short delay,
 *     then mark it seen so it never shows again.
 */
export function AutoTour() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Already seen?
    if (localStorage.getItem('tour_seen')) return;

    // Is this a brand-new account? Firebase stores creation time in metadata.
    // user.metadata is the Firebase UserMetadata object.
    const meta = (user as any)?.metadata;
    if (!meta) return;

    const creationTime: string | undefined = meta.creationTime;
    if (!creationTime) return;

    const createdAt = new Date(creationTime).getTime();
    const now = Date.now();
    const secondsOld = (now - createdAt) / 1000;

    // Open only if account is less than 60 seconds old (fresh signup)
    if (secondsOld < 60) {
      const timer = setTimeout(() => setOpen(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const handleClose = () => {
    setOpen(false);
    localStorage.setItem('tour_seen', '1');
  };

  return <TourModal open={open} onClose={handleClose} />;
}
