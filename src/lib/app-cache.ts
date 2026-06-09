// ============================================
// GNECT APP CACHE (Zustand)
// Aggressive client-side speed optimization layer
// - Timestamped caches with configurable staleness
// - Request deduplication (in-flight tracking)
// - Optimistic update helpers
// - Background refresh support
// ============================================

import { create } from 'zustand'
import { useDataStore } from '@/lib/data-store'

// ============================================
// Staleness thresholds (ms)
// ============================================

export const CACHE_TTL = {
  discover: 30_000,    // 30 seconds — nearby/all users
  community: 30_000,   // 30 seconds — community posts
  chatList: 15_000,    // 15 seconds — chat list
  tags: Infinity,      // Never stale — rarely changes, only invalidates on manual action
  profile: Infinity,   // Never stale — only invalidates on profile update
  notifications: 10_000, // 10 seconds — unread count
} as const

// ============================================
// Cache key types
// ============================================

export type CacheKey = keyof typeof CACHE_TTL

// ============================================
// In-flight request tracking for dedup
// ============================================

const inflightRequests = new Map<string, Promise<unknown>>()

function getInflightKey(key: string, params?: string): string {
  return params ? `${key}:${params}` : key
}

/**
 * Dedup wrapper: if a request with this key is already in-flight,
 * return the existing promise instead of making a new request.
 */
export function dedupFetch<T>(key: string, fetcher: () => Promise<T>, params?: string): Promise<T> {
  const inflightKey = getInflightKey(key, params)
  const existing = inflightRequests.get(inflightKey)
  if (existing) return existing as Promise<T>

  const promise = fetcher().finally(() => {
    inflightRequests.delete(inflightKey)
  })
  inflightRequests.set(inflightKey, promise)
  return promise
}

// ============================================
// Store interface
// ============================================

interface AppCacheState {
  // Timestamps for when each cache was last populated
  timestamps: Record<string, number>

  // Profile cache (fetch once, cache forever until manual refresh)
  profileCached: boolean

  // Notification count cache
  notifCount: number

  // Setters
  setTimestamp: (key: CacheKey) => void
  isStale: (key: CacheKey, customTtl?: number) => boolean
  isFresh: (key: CacheKey) => boolean

  // Profile
  setProfileCached: (cached: boolean) => void
  invalidateProfile: () => void

  // Notifications
  setNotifCount: (count: number) => void

  // Bulk invalidation
  invalidateDiscover: () => void
  invalidateCommunity: () => void
  invalidateChatList: () => void
  invalidateAll: () => void

  // Check if data exists in the underlying data store
  hasCachedDiscover: () => boolean
  hasCachedCommunity: () => boolean
  hasCachedChatList: () => boolean
  hasCachedTags: () => boolean
}

export const useAppCache = create<AppCacheState>((set, get) => ({
  timestamps: {},
  profileCached: false,
  notifCount: 0,

  setTimestamp: (key) =>
    set((state) => ({
      timestamps: { ...state.timestamps, [key]: Date.now() },
    })),

  isStale: (key, customTtl) => {
    const ts = get().timestamps[key]
    if (!ts) return true
    const ttl = customTtl ?? CACHE_TTL[key]
    if (ttl === Infinity) return false
    return Date.now() - ts > ttl
  },

  isFresh: (key) => !get().isStale(key),

  // Profile
  setProfileCached: (cached) => set({ profileCached: cached }),
  invalidateProfile: () => set((state) => ({
    profileCached: false,
    timestamps: { ...state.timestamps, profile: 0 },
  })),

  // Notifications
  setNotifCount: (count) => set({ notifCount: count }),

  // Bulk invalidation
  invalidateDiscover: () => set((state) => ({
    timestamps: { ...state.timestamps, discover: 0 },
  })),

  invalidateCommunity: () => set((state) => ({
    timestamps: { ...state.timestamps, community: 0 },
  })),

  invalidateChatList: () => set((state) => ({
    timestamps: { ...state.timestamps, chatList: 0 },
  })),

  invalidateAll: () => set({
    timestamps: {},
    profileCached: false,
    notifCount: 0,
  }),

  // Check if data exists in the underlying data store
  hasCachedDiscover: () => useDataStore.getState().nearbyUsers.length > 0 || useDataStore.getState().allUsers.length > 0,
  hasCachedCommunity: () => useDataStore.getState().communityPosts.length > 0,
  hasCachedChatList: () => useDataStore.getState().chatList.length > 0,
  hasCachedTags: () => useDataStore.getState().currentTags.length > 0,
}))

// ============================================
// Cache-aware fetch helpers
// ============================================

/**
 * Fetch with cache-first strategy:
 * 1. If cached data exists, show it instantly (no loading spinner)
 * 2. If data is stale or no cache, refresh in background
 * 3. Dedup in-flight requests
 *
 * Returns { fromCache: boolean } so callers know whether to show loading state
 */
export async function cacheFirstFetch(
  key: CacheKey,
  fetcher: () => Promise<void>,
  params?: string,
): Promise<{ fromCache: boolean }> {
  const cache = useAppCache.getState()

  // Check if we have cached data that's still fresh
  if (!cache.isStale(key)) {
    return { fromCache: true }
  }

  // Check if we have any cached data (even if stale)
  const hasAnyCache =
    (key === 'discover' && cache.hasCachedDiscover()) ||
    (key === 'community' && cache.hasCachedCommunity()) ||
    (key === 'chatList' && cache.hasCachedChatList()) ||
    (key === 'tags' && cache.hasCachedTags()) ||
    (key === 'profile' && cache.profileCached)

  // Dedup the request
  await dedupFetch(key, async () => {
    await fetcher()
    useAppCache.getState().setTimestamp(key)
  }, params)

  return { fromCache: hasAnyCache }
}

/**
 * Optimistic update helper:
 * 1. Apply optimistic change immediately to local state
 * 2. Execute the API call
 * 3. On success: reconcile (optionally update cache)
 * 4. On failure: rollback
 */
export async function optimisticUpdate<T>({
  execute,
  optimistic,
  onRollback,
}: {
  execute: () => Promise<T>
  optimistic: () => void
  onRollback: () => void
}): Promise<T> {
  // Apply optimistic change immediately
  optimistic()

  try {
    const result = await execute()
    return result
  } catch (error) {
    // Rollback on failure
    onRollback()
    throw error
  }
}
