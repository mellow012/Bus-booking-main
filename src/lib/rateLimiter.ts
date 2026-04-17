/**
 * Rate Limiter — Upstash Redis sliding window
 *
 * FIX F-06: Replaces in-memory Map with persistent Redis-backed rate limiting.
 *
 * FIRST RUN THIS:
 *   npm install @upstash/redis @upstash/ratelimit
 *
 * Then add to your .env.local:
 *   UPSTASH_REDIS_REST_URL=https://...
 *   UPSTASH_REDIS_REST_TOKEN=...
 *
 * Get both values from: https://console.upstash.com → your Redis DB → REST API
 *
 * Usage in an API route:
 *   import { authRateLimiter, getClientIp } from '@/lib/rateLimiter';
 *   const { success, reset } = await authRateLimiter.limit(getClientIp(request));
 *   if (!success) {
 *     return NextResponse.json(
 *       { error: 'Too many requests. Please try again later.' },
 *       { status: 429, headers: { 'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)) } }
 *     );
 *   }
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// ─── Redis client ─────────────────────────────────────────────────────────────

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error(
    'Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN. ' +
    'Create a free Redis DB at https://console.upstash.com and add the credentials to .env.local'
  );
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// ─── Safe Limiter Wrapper ───────────────────────────────────────────────────

const createSafeLimiter = (options: any) => {
  const ratelimit = new Ratelimit(options);
  return {
    limit: async (identifier: string) => {
      try {
        return await ratelimit.limit(identifier);
      } catch (error: any) {
        console.warn(`[RateLimiter] Bypassing limit for ${identifier} due to Redis error: ${error.message}`);
        return { success: true, limit: 100, remaining: 99, reset: Date.now() + 60000 };
      }
    }
  };
};

// ─── Rate limiter instances ───────────────────────────────────────────────────

/** Auth endpoints — 5 requests per 60 s per identifier. */
export const authRateLimiter = createSafeLimiter({
  redis,
  limiter: Ratelimit.slidingWindow(5, '60 s'),
  prefix: 'ratelimit:auth',
});

/** Payment endpoints — 10 requests per 60 s per identifier. */
export const paymentRateLimiter = createSafeLimiter({
  redis,
  limiter: Ratelimit.slidingWindow(10, '60 s'),
  prefix: 'ratelimit:payment',
});

/** General API endpoints — 30 requests per 60 s per identifier. */
export const apiRateLimiter = createSafeLimiter({
  redis,
  limiter: Ratelimit.slidingWindow(30, '60 s'),
  prefix: 'ratelimit:api',
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract the real client IP, respecting Vercel / reverse-proxy forwarding headers. */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}

/** Reset the rate limit for a specific key (e.g. after a successful CAPTCHA). */
export async function resetRateLimit(prefix: string, key: string): Promise<void> {
  await redis.del(`${prefix}:${key}`);
}