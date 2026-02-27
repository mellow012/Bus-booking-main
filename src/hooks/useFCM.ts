/**
 * useFCM Hook
 * Manages FCM token lifecycle in React components
 */

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { setupFCM, listenForMessages } from '@/utils/fcmClient';

interface UseInitializeFCMOptions {
  enabled?: boolean;
  onTokenReceived?: (token: string) => void;
  onMessageReceived?: (payload: any) => void;
  onError?: (error: Error) => void;
}

/**
 * Initialize FCM on component mount
 */
export function useInitializeFCM(options: UseInitializeFCMOptions = {}) {
  const { enabled = true, onTokenReceived, onMessageReceived, onError } = options;
  const { user } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled || !user) {
      setIsLoading(false);
      return;
    }

    const initializeFCMAsync = async () => {
      try {
        setIsLoading(true);
        // Get ID token from Firebase auth user
        const idToken = await user.getIdToken(true);
        const fcmToken = await setupFCM(idToken);

        if (fcmToken) {
          setToken(fcmToken);
          onTokenReceived?.(fcmToken);
        }

        setError(null);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeFCMAsync();
  }, [enabled, user, onTokenReceived, onError]);

  // Listen for incoming messages
  useEffect(() => {
    if (!enabled || !token) {
      return;
    }

    if (onMessageReceived) {
      const unlisten = listenForMessages(onMessageReceived);
      return unlisten;
    }
  }, [enabled, token, onMessageReceived]);

  return {
    token,
    isLoading,
    error,
    isInitialized: token !== null,
  };
}

/**
 * Hook to check if user has notification permission
 */
export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);

      // Listen for permission changes
      const interval = setInterval(() => {
        setPermission(Notification.permission);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, []);

  const requestPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    }
  };

  return {
    permission,
    isGranted: permission === 'granted',
    isDenied: permission === 'denied',
    requestPermission,
  };
}
