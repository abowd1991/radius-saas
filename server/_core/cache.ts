/**
 * Simple in-memory cache with TTL support
 * For production, consider using Redis or similar
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class SimpleCache {
  private cache: Map<string, CacheEntry<any>> = new Map();

  /**
   * Get value from cache
   * Returns undefined if key doesn't exist or has expired
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.data as T;
  }

  /**
   * Set value in cache with TTL (in seconds)
   */
  set<T>(key: string, data: T, ttlSeconds: number): void {
    const expiresAt = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { data, expiresAt });
  }

  /**
   * Delete specific key from cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Delete all keys matching a pattern
   * Example: deletePattern('nas:*') deletes all NAS-related cache
   */
  deletePattern(pattern: string): void {
    const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  stats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Clean up expired entries (run periodically)
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;
    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    return cleaned;
  }
}

// Singleton instance
export const cache = new SimpleCache();

// Run cleanup every 5 minutes
setInterval(() => {
  const cleaned = cache.cleanup();
  if (cleaned > 0) {
    console.log(`[Cache] Cleaned up ${cleaned} expired entries`);
  }
}, 5 * 60 * 1000);

// Cache key generators for consistency
export const cacheKeys = {
  nasList: (ownerId: number) => `nas:list:${ownerId}`,
  nasListAll: () => `nas:list:all`,
  nasDevice: (id: number) => `nas:device:${id}`,
  userPlan: (userId: number) => `user:plan:${userId}`,
  speedProfiles: (ownerId: number) => `speed:profiles:${ownerId}`,
  dashboardStats: (ownerId: number) => `dashboard:stats:${ownerId}`,
  ipPoolStats: () => `ippool:stats`,
};

// Cache TTLs (in seconds)
export const cacheTTL = {
  nasList: 5 * 60, // 5 minutes
  nasDevice: 2 * 60, // 2 minutes
  userPlan: 10 * 60, // 10 minutes (updated on change)
  speedProfiles: 5 * 60, // 5 minutes
  dashboardStats: 1 * 60, // 1 minute
  ipPoolStats: 2 * 60, // 2 minutes
};
