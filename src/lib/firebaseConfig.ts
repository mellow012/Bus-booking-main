// src/lib/firebaseConfig.ts

/**
 * Firebase Client Configuration (FCM ONLY)
 * 
 * Authentication and Database have been migrated to Supabase.
 * This config is used SOLELY by the FCM client (src/utils/fcmClient.ts)
 * to register the browser for push notifications.
 */

export const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim(),
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim(),
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim(),
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim(),
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim(),
  measurementId:     process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID?.trim(),
};
