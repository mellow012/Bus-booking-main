/**
 * Firebase Cloud Messaging - Client Setup
 * Initializes FCM and handles token registration
 * 
 * FIXES:
 * - Added in-memory flag to prevent duplicate registrations in the same session
 * - registerFCMTokenWithBackend now accepts optional idToken (falls back to auth header)
 * - setupFCM is the single source of truth for registration — do NOT call register-token separately
 */

import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { firebaseConfig } from '../lib/firebaseConfig';

let messaging: Messaging | null = null;

// In-memory guard: prevents re-registering the same token in one session
let lastRegisteredToken: string | null = null;
let isRegistering = false; // mutex to prevent concurrent registration races

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

    if (!('serviceWorker' in navigator)) {
      console.warn('[FCM] Service Workers not supported');
      return null;
    }

    // Reuse existing Firebase app if already initialized
    const app = getApps().length === 0
      ? initializeApp(firebaseConfig)
      : getApps()[0];

    messaging = getMessaging(app);

    // Register service worker (non-blocking)
    navigator.serviceWorker
      .register('/firebase-messaging-sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[FCM] Service Worker registered:', registration.scope);
      })
      .catch((error) => {
        console.error('[FCM] Service Worker registration failed:', error);
      });

    // Listen for foreground messages
    onMessage(messaging, (payload) => {
      console.log('[FCM] Foreground message received:', payload);

      window.dispatchEvent(
        new CustomEvent('fcm-message', { detail: payload })
      );

      if (payload.notification && Notification.permission === 'granted') {
        new Notification(payload.notification.title || 'New Message', {
          body: payload.notification.body || '',
          icon: payload.notification.image || '/icon-192x192.png',
          badge: '/badge-72x72.png',
          data: payload.data || {},
        });
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

    const permission = Notification.permission;

    if (permission === 'denied') {
      console.warn('[FCM] Notification permission denied by user');
      return null;
    }

    if (permission !== 'granted') {
      const newPermission = await Notification.requestPermission();
      if (newPermission !== 'granted') {
        return null;
      }
    }

    if (!process.env.NEXT_PUBLIC_FCM_VAPID_KEY) {
      console.warn('[FCM] VAPID key not configured in environment');
      return null;
    }

    // Wait for SW to be ready before subscribing
    const serviceWorkerRegistration = await navigator.serviceWorker.ready;

    console.log('[FCM] Service Worker is ready, retrieving token...');

    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FCM_VAPID_KEY,
      serviceWorkerRegistration,
    });

    if (token) {
      console.log('[FCM] Token retrieved:', token.substring(0, 20) + '...');
    } else {
      console.log('[FCM] No token retrieved.');
    }

    return token || null;
  } catch (error) {
    console.error('[FCM] Error getting token:', error);
    return null;
  }
}

/**
 * Register FCM token with backend
 * Only sends request if token has changed since last registration
 */
export async function registerFCMTokenWithBackend(
  token: string,
  idToken: string
): Promise<boolean> {
  // Guard: don't re-register the same token
  if (token === lastRegisteredToken) {
    console.log('[FCM] Token unchanged — skipping backend registration');
    return true;
  }

  // Guard: prevent concurrent registration
  if (isRegistering) {
    console.log('[FCM] Registration already in progress — skipping');
    return false;
  }

  isRegistering = true;

  try {
    // Check localStorage as secondary dedup (survives page refresh)
    const storedToken = localStorage.getItem('fcm_registered_token');
    if (storedToken === token) {
      console.log('[FCM] Token already registered (localStorage cache)');
      lastRegisteredToken = token;
      return true;
    }

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

    // Update both caches on success
    lastRegisteredToken = token;
    localStorage.setItem('fcm_registered_token', token);

    return true;
  } catch (error) {
    console.error('[FCM] Backend registration error:', error);
    return false;
  } finally {
    isRegistering = false;
  }
}

/**
 * Complete FCM setup: get token, request permission, register with backend
 * This is the ONLY place that calls registerFCMTokenWithBackend.
 * Do NOT call register-token from hooks separately.
 */
export async function setupFCM(idToken: string): Promise<string | null> {
  try {
    console.log('[FCM] Starting FCM setup...');

    if (!messaging && typeof window !== 'undefined') {
      messaging = initializeFCM();
    }

    const token = await getAndRegisterFCMToken();

    if (token) {
      await registerFCMTokenWithBackend(token, idToken);
      console.log('[FCM] Setup completed successfully');
    } else {
      console.warn('[FCM] Setup completed — no token obtained');
    }

    return token;
  } catch (error) {
    console.error('[FCM] Setup error:', error);
    return null;
  }
}

/**
 * Listen for incoming messages in foreground
 * Returns unlisten callback
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