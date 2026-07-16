import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

// General admin endpoints: 120 req / minute per admin
export const adminLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(120, '1 m'),
});

// Export endpoint: 4 exports per hour per admin
export const exportLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(4, '1 h'),
});

// Share endpoint: 30 shares per hour per admin
export const shareLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '1 h'),
});

export async function checkAdminLimit(userId: string) {
  try {
    const res = await adminLimiter.limit(userId);
    return res.success;
  } catch (err) {
    // Fail open: if limiter errors, allow request but log server-side
    console.error('Rate limiter error (admin):', err);
    return true;
  }
}

export async function checkExportLimit(userId: string) {
  try {
    const res = await exportLimiter.limit(userId);
    return res.success;
  } catch (err) {
    console.error('Rate limiter error (export):', err);
    return true;
  }
}

export async function checkShareLimit(userId: string) {
  try {
    const res = await shareLimiter.limit(userId);
    return res.success;
  } catch (err) {
    console.error('Rate limiter error (share):', err);
    return true;
  }
}
