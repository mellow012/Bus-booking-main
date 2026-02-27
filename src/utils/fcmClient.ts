/**
 * Firebase Cloud Messaging - Client Setup
 * Initializes FCM and handles token registration
 */

import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { firebaseConfig } from '../lib/firebaseConfig';

let messaging: Messaging | null = null;

/**
 * Initialize Firebase Cloud Messaging
 * Call this once on app startup
 */
export function initializeFCM(): Messaging | null {
  try {
    if (typeof window === 'undefined') {
      console.log('[FCM] Running on server, skipping initialization');
      return null;
    }

    // Check if service workers are supported
    if (!('serviceWorker' in navigator)) {
      console.warn('[FCM] Service Workers not supported');
      return null;
    }

    // Initialize Firebase if not already done
    const app = initializeApp(firebaseConfig);
    messaging = getMessaging(app);

    // Register service worker
    navigator.serviceWorker
      .register('/firebase-messaging-sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[FCM] Service Worker registered:', registration);
      })
      .catch((error) => {
        console.error('[FCM] Service Worker registration failed:', error);
        // Reset messaging if SW can't register
        messaging = null;
      });

    // Listen for messages when app is in foreground
    onMessage(messaging, (payload) => {
      console.log('[FCM] Foreground message received:', payload);

      // Dispatch custom event so components can react
      window.dispatchEvent(
        new CustomEvent('fcm-message', { detail: payload })
      );

      // Optional: Show notification
      if (payload.notification) {
        const notificationTitle = payload.notification.title || 'New Message';
        const notificationOptions = {
          body: payload.notification.body || '',
          icon: payload.notification.image || '/icon-192x192.png',
          badge: '/badge-72x72.png',
          data: payload.data || {},
        };

        if (Notification.permission === 'granted') {
          new Notification(notificationTitle, notificationOptions);
        }
      }
    });

    return messaging;
  } catch (error) {
    console.error('[FCM] Initialization error:', error);
    return null;
  }
}

/**
 * Request notification permission and get FCM token
 */
export async function getAndRegisterFCMToken(): Promise<string | null> {
  try {
    if (!messaging && typeof window !== 'undefined') {
      messaging = initializeFCM();
    }

    if (!messaging) {
      console.warn('[FCM] Messaging not initialized');
      return null;
    }

    // Check current permission
    const permission = Notification.permission;
    console.log('[FCM] Current notification permission:', permission);

    // If denied, return null
    if (permission === 'denied') {
      console.warn('[FCM] Notification permission denied by user');
      return null;
    }

    // If not granted, request permission
    if (permission !== 'granted') {
      const newPermission = await Notification.requestPermission();
      console.log('[FCM] Permission request result:', newPermission);

      if (newPermission !== 'granted') {
        return null;
      }
    }

    // Get FCM token
    if (!process.env.NEXT_PUBLIC_FCM_VAPID_KEY) {
      console.warn('[FCM] VAPID key not configured in environment');
      return null;
    }

    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FCM_VAPID_KEY,
    });

    console.log('[FCM] Token retrieved:', token.substring(0, 20) + '...');
    return token;
  } catch (error) {
    console.error('[FCM] Error getting token:', error);
    return null;
  }
}

/**
 * Register FCM token with backend
 */
export async function registerFCMTokenWithBackend(
  token: string,
  idToken: string
): Promise<boolean> {
  try {
    const response = await fetch('/api/notifications/register-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to register token');
    }

    const result = await response.json();
    console.log('[FCM] Token registered with backend:', result);
    return true;
  } catch (error) {
    console.error('[FCM] Backend registration error:', error);
    return false;
  }
}

/**
 * Complete FCM setup: get token, request permission, register with backend
 */
export async function setupFCM(idToken: string): Promise<string | null> {
  try {
    console.log('[FCM] Starting FCM setup...');

    // Initialize messaging
    if (!messaging && typeof window !== 'undefined') {
      messaging = initializeFCM();
    }

    // Get and register token
    const token = await getAndRegisterFCMToken();

    if (token) {
      // Register with backend
      const registered = await registerFCMTokenWithBackend(token, idToken);
      if (registered) {
        console.log('[FCM] Setup completed successfully');
        return token;
      }
    }

    console.warn('[FCM] Setup completed with warnings');
    return token;
  } catch (error) {
    console.error('[FCM] Setup error:', error);
    return null;
  }
}

/**
 * Listen for incoming messages in foreground
 * Returns callback to unlisten
 */
export function listenForMessages(callback: (payload: any) => void): () => void {
  const listener = (event: Event) => {
    const customEvent = event as CustomEvent;
    callback(customEvent.detail);
  };

  window.addEventListener('fcm-message', listener);

  return () => {
    window.removeEventListener('fcm-message', listener);
  };
}
