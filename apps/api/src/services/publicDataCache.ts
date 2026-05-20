type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const cache = new Map<string, CacheEntry<unknown>>();

export async function getCachedPublicData<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
) {
  const now = Date.now();
  const cached = cache.get(key) as CacheEntry<T> | undefined;

  if (cached && cached.expiresAt > now) {
    return { value: cached.value, cacheHit: true };
  }

  const value = await fetcher();
  cache.set(key, {
    value,
    expiresAt: now + ttlMs,
  });

  return { value, cacheHit: false };
}
