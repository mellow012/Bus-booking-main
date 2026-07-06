/**
 * Lightweight in-memory cache for server-side API routes.
 * 
 * Design rationale:
 * - Avoids external dependencies (no Redis needed for this scale)
 * - TTL-based expiration with stale-while-revalidate support
 * - Automatic cleanup to prevent memory leaks
 * - Cache keys are normalized to maximize hit rates
 */

interface CacheEntry<T> {
  data: T;
  createdAt: number;
  expiresAt: number;
  staleAt: number; // After this time, serve stale but revalidate in background
}

class MemoryCache {
  private store = new Map<string, CacheEntry<any>>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private revalidating = new Set<string>(); // Track in-flight revalidations

  constructor() {
    // Clean expired entries every 60 seconds
    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
    }
  }

  /**
   * Get a cached value. Returns null if expired (past stale window).
   * Returns the cached value even if stale (caller should revalidate).
   */
  get<T>(key: string): { data: T; isStale: boolean } | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    const now = Date.now();

    // Fully expired (past stale window) — treat as miss
    if (now > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    // Still fresh
    if (now <= entry.staleAt) {
      return { data: entry.data, isStale: false };
    }

    // Stale but still within expiry window — serve stale
    return { data: entry.data, isStale: true };
  }

  /**
   * Set a cached value with TTL configuration.
   * @param freshMs  Time in ms the data is considered fresh (no revalidation)
   * @param staleMs  Additional time in ms to serve stale data while revalidating
   */
  set<T>(key: string, data: T, freshMs: number, staleMs: number = 0): void {
    const now = Date.now();
    this.store.set(key, {
      data,
      createdAt: now,
      staleAt: now + freshMs,
      expiresAt: now + freshMs + staleMs,
    });
  }

  /**
   * Invalidate a specific key or all keys matching a prefix.
   */
  invalidate(keyOrPrefix: string): void {
    if (this.store.has(keyOrPrefix)) {
      this.store.delete(keyOrPrefix);
      return;
    }
    // Prefix-based invalidation
    for (const key of this.store.keys()) {
      if (key.startsWith(keyOrPrefix)) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Check if a key is currently being revalidated (prevents thundering herd).
   */
  isRevalidating(key: string): boolean {
    return this.revalidating.has(key);
  }

  markRevalidating(key: string): void {
    this.revalidating.add(key);
  }

  clearRevalidating(key: string): void {
    this.revalidating.delete(key);
  }

  /** Remove all fully expired entries */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  /** Get cache stats for debugging */
  stats() {
    return {
      size: this.store.size,
      revalidating: this.revalidating.size,
    };
  }
}

// Singleton instance shared across all API route invocations in the same process
export const serverCache = new MemoryCache();

/**
 * Helper to create a normalized cache key from query parameters.
 * Rounds time-based parameters to improve hit rates.
 */
export function createScheduleCacheKey(params: {
  from?: string;
  to?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  companyId?: string;
  tzOffset?: number;
  page?: number;
  limit?: number;
}): string {
  const parts = ['schedules'];
  if (params.from) parts.push(`from:${params.from.toLowerCase()}`);
  if (params.to) parts.push(`to:${params.to.toLowerCase()}`);
  if (params.date) parts.push(`date:${params.date}`);
  if (params.startDate) parts.push(`sd:${params.startDate}`);
  if (params.endDate) parts.push(`ed:${params.endDate}`);
  if (params.companyId) parts.push(`company:${params.companyId}`);
  if (typeof params.tzOffset === 'number') parts.push(`tz:${params.tzOffset}`);
  parts.push(`sort:${params.sortBy || 'time'}`);
  parts.push(`p:${params.page || 1}`);
  parts.push(`l:${params.limit || 30}`);
  return parts.join('|');
}
