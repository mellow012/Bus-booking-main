/**
 * FCMInitializer Component
 * Initializes Firebase Cloud Messaging when user is authenticated
 * This component runs on client-side only
 */

'use client';

import { useInitializeFCM } from '@/hooks/useFCM';

export function FCMInitializer() {
  // Initialize FCM - this will automatically request notification permission
  // and register the device token
  useInitializeFCM({
    enabled: true,
    onTokenReceived: (token) => {
      console.log('✅ FCM token received and registered:', token.substring(0, 20) + '...');
    },
    onMessageReceived: (payload) => {
      console.log('📬 New message received:', payload.notification?.title);
    },
    onError: (error) => {
      console.warn('⚠️ FCM initialization error:', error.message);
      // Don't throw - let app continue if FCM fails
    },
  });

  return null; // This component doesn't render anything
}
