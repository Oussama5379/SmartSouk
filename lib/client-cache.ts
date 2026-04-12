"use client"

interface ClientCacheEntry<T> {
  value: T
  cachedAt: number
}

const CACHE_STORAGE_PREFIX = "aurea_client_cache"
const inMemoryCache = new Map<string, ClientCacheEntry<unknown>>()

function getStorageKey(key: string): string {
  return `${CACHE_STORAGE_PREFIX}:${key}`
}

function isValidCacheEntry(value: unknown): value is ClientCacheEntry<unknown> {
  if (!value || typeof value !== "object") {
    return false
  }

  const candidate = value as Partial<ClientCacheEntry<unknown>>
  return typeof candidate.cachedAt === "number" && Number.isFinite(candidate.cachedAt) && "value" in candidate
}

export function readClientCache<T>(key: string, maxAgeMs: number): T | null {
  const now = Date.now()
  const fromMemory = inMemoryCache.get(key)
  if (fromMemory) {
    if (now - fromMemory.cachedAt <= maxAgeMs) {
      return fromMemory.value as T
    }
    inMemoryCache.delete(key)
  }

  if (typeof window === "undefined") {
    return null
  }

  const stored = window.sessionStorage.getItem(getStorageKey(key))
  if (!stored) {
    return null
  }

  try {
    const parsed = JSON.parse(stored) as unknown
    if (!isValidCacheEntry(parsed)) {
      window.sessionStorage.removeItem(getStorageKey(key))
      return null
    }

    if (now - parsed.cachedAt > maxAgeMs) {
      window.sessionStorage.removeItem(getStorageKey(key))
      return null
    }

    inMemoryCache.set(key, parsed)
    return parsed.value as T
  } catch {
    window.sessionStorage.removeItem(getStorageKey(key))
    return null
  }
}

export function writeClientCache<T>(key: string, value: T) {
  const entry: ClientCacheEntry<T> = {
    value,
    cachedAt: Date.now(),
  }
  inMemoryCache.set(key, entry)

  if (typeof window === "undefined") {
    return
  }

  window.sessionStorage.setItem(getStorageKey(key), JSON.stringify(entry))
}

export function clearClientCache(key: string) {
  inMemoryCache.delete(key)
  if (typeof window === "undefined") {
    return
  }

  window.sessionStorage.removeItem(getStorageKey(key))
}
