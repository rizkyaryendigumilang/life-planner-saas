type CacheEntry<T> = {
  data: T;
  timestamp: number;
  ttlMs: number;
};

const cacheStore = new Map<string, CacheEntry<unknown>>();

/**
 * Retrieve an item from the in-memory SWR cache.
 * @param key Cache identifier
 * @param allowStale If true, returns the cached value even if past ttlMs for instant display
 */
export function getCache<T>(key: string, allowStale = true): T | null {
  const entry = cacheStore.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;

  const age = Date.now() - entry.timestamp;
  if (!allowStale && age > entry.ttlMs) {
    cacheStore.delete(key);
    return null;
  }

  return entry.data;
}

/**
 * Check if a cached item is stale and should be revalidated in background.
 */
export function isCacheStale(key: string): boolean {
  const entry = cacheStore.get(key);
  if (!entry) return true;
  return Date.now() - entry.timestamp > entry.ttlMs;
}

/**
 * Save an item to the in-memory cache with a given TTL (default: 60 seconds).
 */
export function setCache<T>(key: string, data: T, ttlMs = 60_000): void {
  cacheStore.set(key, {
    data,
    timestamp: Date.now(),
    ttlMs,
  });
}

/**
 * Invalidate cache by key or key prefix.
 * Example: `invalidateCache("dashboard")` clears all dashboard-related caches.
 */
export function invalidateCache(keyOrPrefix?: string): void {
  if (!keyOrPrefix) {
    cacheStore.clear();
    return;
  }

  for (const key of cacheStore.keys()) {
    if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) {
      cacheStore.delete(key);
    }
  }
}
