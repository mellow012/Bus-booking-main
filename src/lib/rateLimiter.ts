/**
 * Simple in-memory rate limiter
 * Tracks IP addresses and their request counts
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private readonly maxAttempts: number;
  private readonly windowMs: number; // milliseconds

  constructor(maxAttempts: number = 5, windowMs: number = 60000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;

    // Cleanup expired entries every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.store.entries()) {
        if (now > entry.resetAt) {
          this.store.delete(key);
        }
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Check if a request should be allowed and increment counter
   * @param key - Unique identifier (usually IP address)
   * @returns Object with allowed status, remaining attempts, and reset time
   */
  check(key: string): {
    allowed: boolean;
    remaining: number;
    resetAt: number;
    retryAfter?: number;
  } {
    const now = Date.now();
    const entry = this.store.get(key);

    // Reset if window expired
    if (!entry || now > entry.resetAt) {
      this.store.set(key, {
        count: 1,
        resetAt: now + this.windowMs,
      });
      return {
        allowed: true,
        remaining: this.maxAttempts - 1,
        resetAt: now + this.windowMs,
      };
    }

    // Increment counter
    entry.count++;

    if (entry.count > this.maxAttempts) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.resetAt,
        retryAfter,
      };
    }

    return {
      allowed: true,
      remaining: this.maxAttempts - entry.count,
      resetAt: entry.resetAt,
    };
  }

  /**
   * Reset rate limit for a specific key
   */
  reset(key: string) {
    this.store.delete(key);
  }

  /**
   * Clear all rate limit data (useful for testing)
   */
  clear() {
    this.store.clear();
  }
}

// Create singleton instances for different endpoints
export const authRateLimiter = new RateLimiter(5, 60 * 1000); // 5 attempts per minute
export const paymentRateLimiter = new RateLimiter(10, 60 * 1000); // 10 attempts per minute
export const apiRateLimiter = new RateLimiter(30, 60 * 1000); // 30 attempts per minute

/**
 * Helper to extract IP address from request
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  return 'unknown';
}
