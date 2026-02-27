// components/FCMInitializer.tsx

'use client';

import { useInitializeFCM } from '@/hooks/useFCM';

export function FCMInitializer() {
  useInitializeFCM({
    enabled: true,
    onTokenReceived: (token) => {
      console.log('FCM token registered:', token.substring(0, 20) + '...');
    },
    onMessageReceived: (payload) => {
      console.log('New FCM message:', payload.notification?.title);
      // Optional: toast.info(payload.notification?.body);
    },
    onError: (err) => {
      console.warn('FCM error:', err.message);
    },
  });

  return null;
}