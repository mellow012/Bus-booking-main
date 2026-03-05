// lib/stripe.ts
//
// FIX F-15: The previous implementation called `new Stripe(...)` at module
// import time. If STRIPE_SECRET_KEY is missing, the entire Next.js process
// crashes on startup before it can serve a health check or any other route.
//
// The server-side instance is now created lazily via getStripeServer() and
// only throws when actually called, not at import time.
//
// FIX F-23: API version "2025-08-27.basil" is a pre-release / beta suffix
// that may be unavailable or deprecated in production. Pinned to the current
// stable GA release "2024-11-20". Verify against your Stripe dashboard and
// update as needed when upgrading.

import { loadStripe } from '@stripe/stripe-js';
import type { Stripe as StripeJS } from '@stripe/stripe-js';
import Stripe from 'stripe';

// ─── Client-side (browser) ────────────────────────────────────────────────────
// Lazily loads the Stripe.js script. Safe to call from React components.

let stripeClientPromise: Promise<StripeJS | null> | null = null;

export function getStripe(): Promise<StripeJS | null> {
  if (!stripeClientPromise) {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      throw new Error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set');
    }
    stripeClientPromise = loadStripe(publishableKey);
  }
  return stripeClientPromise;
}

// ─── Server-side (API routes / Cloud Functions only) ─────────────────────────
// Never import this in client components — it requires STRIPE_SECRET_KEY.
// Use the `server-only` package in a wrapper if you want a build-time guard:
//   import 'server-only';

let _stripeServer: Stripe | null = null;

export function getStripeServer(): Stripe {
  if (_stripeServer) return _stripeServer;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      'STRIPE_SECRET_KEY is not set. ' +
      'Add it to .env.local for development or to your hosting environment for production.'
    );
  }

  _stripeServer = new Stripe(secretKey, {
    // FIX F-23: pinned to stable GA release — remove the ".basil" beta suffix.
    // Check https://stripe.com/docs/api/versioning for the latest stable version.
    apiVersion: '2024-11-20' as Stripe.LatestApiVersion,
    telemetry: true,
  });

  return _stripeServer;
}

// ─── Legacy named export (backward-compatible) ────────────────────────────────
// Existing imports like `import { stripe } from '@/lib/stripe'` continue to
// work. The Proxy defers initialization to first property access.
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return (getStripeServer() as any)[prop];
  },
});