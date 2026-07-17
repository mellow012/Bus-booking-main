/**
 * Consolidated Rate Limiter — Upstash Redis sliding window
 *
 * Single module for all rate limiting needs. Uses one shared Redis client.
 *
 * Usage in an API route:
 *   import { authRateLimiter, getClientIp } from '@/lib/rateLimit';
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

// ─── Redis client (single shared instance) ───────────────────────────────────

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

// ─── Safe Limiter Wrapper ───────────────────────────────────────────────────
// Fails open: if Redis errors, allow the request but log server-side

function createSafeLimiter(options: ConstructorParameters<typeof Ratelimit>[0]) {
  const ratelimit = new Ratelimit(options);
  return {
    limit: async (identifier: string) => {
      try {
        return await ratelimit.limit(identifier);
      } catch (error: any) {
        console.warn(`[RateLimiter] Bypassing limit for ${identifier} due to Redis error: ${error.message}`);
        return { success: true, limit: 100, remaining: 99, reset: Date.now() + 60000 };
      }
    },
  };
}

// ─── Auth & API Rate Limiters ────────────────────────────────────────────────

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

// ─── Admin Rate Limiters ─────────────────────────────────────────────────────

/** General admin endpoints: 120 req / minute per admin */
const adminLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(120, '1 m'),
  prefix: 'ratelimit:admin',
});

/** Export endpoint: 4 exports per hour per admin */
const exportLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(4, '1 h'),
  prefix: 'ratelimit:export',
});

/** Share endpoint: 30 shares per hour per admin */
const shareLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '1 h'),
  prefix: 'ratelimit:share',
});

export async function checkAdminLimit(userId: string) {
  try {
    const res = await adminLimiter.limit(userId);
    return res.success;
  } catch (err) {
    console.warn('[RateLimiter] Admin limiter error:', err);
    return true;
  }
}

export async function checkExportLimit(userId: string) {
  try {
    const res = await exportLimiter.limit(userId);
    return res.success;
  } catch (err) {
    console.warn('[RateLimiter] Export limiter error:', err);
    return true;
  }
}

export async function checkShareLimit(userId: string) {
  try {
    const res = await shareLimiter.limit(userId);
    return res.success;
  } catch (err) {
    console.warn('[RateLimiter] Share limiter error:', err);
    return true;
  }
}

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
