"use client";

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const memoryCache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

export function readClientCache<T>(key: string): T | null {
  const entry = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value;
}

export function writeClientCache<T>(key: string, value: T, ttlMs: number): T {
  memoryCache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

export function invalidateClientCache(prefix?: string) {
  if (!prefix) {
    memoryCache.clear();
    return;
  }

  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) memoryCache.delete(key);
  }
}

export async function getOrLoadClientData<T>(options: {
  key: string;
  ttlMs: number;
  load: () => Promise<T>;
  force?: boolean;
}): Promise<T> {
  const { key, ttlMs, load, force = false } = options;

  if (!force) {
    const cached = readClientCache<T>(key);
    if (cached !== null) return cached;
  }

  const pending = inFlight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const request = load()
    .then((value) => writeClientCache(key, value, ttlMs))
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, request);
  return request;
}
