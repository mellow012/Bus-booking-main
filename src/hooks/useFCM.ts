'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { setupFCM, listenForMessages } from '@/utils/fcmClient';

/**
 * FIXES:
 * - Removed the duplicate fetch('/api/notifications/register-token') call.
 *   setupFCM() in fcmClient.ts already handles registration — calling it again
 *   here was causing the dozens of duplicate requests seen in the logs.
 * - Added session-level hasRun guard that resets on user change.
 * - localStorage check happens inside fcmClient now (single source of truth).
 */

interface UseInitializeFCMOptions {
  enabled?: boolean;
  onTokenReceived?: (token: string) => void;
  onMessageReceived?: (payload: any) => void;
  onError?: (error: Error) => void;
}

export function useInitializeFCM(options: UseInitializeFCMOptions = {}) {
  const { enabled = true, onTokenReceived, onMessageReceived, onError } = options;
  const { user } = useAuth();

  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const hasRun = useRef(false);
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !user?.uid) {
      setIsLoading(false);
      return;
    }

    // Reset guard if the user changed (e.g. logout → login as different user)
    if (lastUserId.current !== null && lastUserId.current !== user.uid) {
      hasRun.current = false;
    }

    // Skip if already ran for this user in this session
    if (hasRun.current) {
      setIsLoading(false);
      return;
    }

    const initializeFCMAsync = async () => {
      try {
        setIsLoading(true);

        // getIdToken without force=true — only force refresh when we know
        // the user's claims have changed (e.g. after email verification)
        const idToken = await user.getIdToken();

        // setupFCM handles EVERYTHING:
        //   1. Gets FCM token from Firebase
        //   2. Checks localStorage cache
        //   3. Registers with backend (once, deduplicated)
        // Do NOT call /api/notifications/register-token again here.
        const fcmToken = await setupFCM(idToken);

        if (fcmToken) {
          setToken(fcmToken);
          onTokenReceived?.(fcmToken);
        }

        setError(null);
        hasRun.current = true;
        lastUserId.current = user.uid;
      } catch (err: any) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        onError?.(e);
      } finally {
        setIsLoading(false);
      }
    };

    initializeFCMAsync();
  }, [enabled, user?.uid]); // intentionally exclude callbacks from deps to avoid re-runs

  // Message listener — only active when we have a token
  useEffect(() => {
    if (!enabled || !token || !onMessageReceived) return;

    const unlisten = listenForMessages(onMessageReceived);
    return unlisten;
  }, [enabled, token, onMessageReceived]);

  return {
    token,
    isLoading,
    error,
    isInitialized: token !== null,
  };
}

/**
 * Tracks notification permission state.
 * Uses visibility/focus events instead of polling — avoids unnecessary
 * re-renders and CPU usage from a 1s interval.
 */
export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    const updatePermission = () => setPermission(Notification.permission);

    updatePermission();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') updatePermission();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', updatePermission);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', updatePermission);
    };
  }, []);

  const requestPermission = async (): Promise<NotificationPermission> => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'default';
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  };

  return {
    permission,
    isGranted: permission === 'granted',
    isDenied: permission === 'denied',
    requestPermission,
  };
}