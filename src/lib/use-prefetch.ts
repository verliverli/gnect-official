// ============================================
// GNECT PREFETCH HOOKS
// Fire background data fetches on app mount
// so data appears instantly when switching tabs
// ============================================

'use client'

import { useEffect, useRef } from 'react'
import { useDataStore } from '@/lib/data-store'
import { useAppCache, dedupFetch } from '@/lib/app-cache'
import { useAuthStore } from '@/lib/store'

/**
 * Prefetch discover (nearby + all users) data on app mount.
 * If cached data exists and is fresh, skip fetch.
 * If stale, refresh silently in background.
 */
export function usePrefetchDiscover() {
  const user = useAuthStore((s) => s.user)
  const ranRef = useRef(false)

  useEffect(() => {
    if (!user || ranRef.current) return
    ranRef.current = true

    const cache = useAppCache.getState()
    const dataStore = useDataStore.getState()

    // Only fetch if stale or no cache
    if (cache.isStale('discover') || dataStore.nearbyUsers.length === 0) {
      dedupFetch('prefetch-nearby', async () => {
        try {
          const res = await fetch('/api/discover/nearby?limit=20&sort=nearby', { credentials: 'same-origin' })
          const d = await res.json()
          if (d.ok) {
            dataStore.setNearbyUsers(d.data || [], d.nextCursor || null)
            useAppCache.getState().setTimestamp('discover')
          }
        } catch { /* silent */ }
      })

      dedupFetch('prefetch-all', async () => {
        try {
          const res = await fetch('/api/discover/all?limit=20', { credentials: 'same-origin' })
          const d = await res.json()
          if (d.ok) {
            dataStore.setAllUsers(d.data || [], d.nextCursor || null)
          }
        } catch { /* silent */ }
      })
    }
  }, [user])
}

/**
 * Prefetch chat list on app mount.
 * If cached data exists and is fresh, skip fetch.
 */
export function usePrefetchChatList() {
  const user = useAuthStore((s) => s.user)
  const ranRef = useRef(false)

  useEffect(() => {
    if (!user || ranRef.current) return
    ranRef.current = true

    const cache = useAppCache.getState()
    const dataStore = useDataStore.getState()

    if (cache.isStale('chatList') || dataStore.chatList.length === 0) {
      dedupFetch('prefetch-chatlist', async () => {
        try {
          const res = await fetch('/api/chat/list', { credentials: 'same-origin' })
          const d = await res.json()
          if (d.ok) {
            dataStore.setChatList(d.data || [])
            useAppCache.getState().setTimestamp('chatList')
          }
        } catch { /* silent */ }
      })
    }
  }, [user])
}

/**
 * Prefetch own profile data on app mount.
 * Profile data is cached forever until manual refresh.
 */
export function usePrefetchProfile() {
  const user = useAuthStore((s) => s.user)
  const ranRef = useRef(false)

  useEffect(() => {
    if (!user || ranRef.current) return
    ranRef.current = true

    // Profile is already loaded via auth — just mark as cached
    useAppCache.getState().setProfileCached(true)
    useAppCache.getState().setTimestamp('profile')
  }, [user])
}

/**
 * Prefetch tags on app mount.
 * Tags rarely change, so they're cached forever.
 */
export function usePrefetchTags() {
  const user = useAuthStore((s) => s.user)
  const ranRef = useRef(false)

  useEffect(() => {
    if (!user || ranRef.current) return
    ranRef.current = true

    const cache = useAppCache.getState()
    const dataStore = useDataStore.getState()

    // Tags rarely change — only fetch if we have no cache at all
    if (dataStore.currentTags.length === 0) {
      dedupFetch('prefetch-tags', async () => {
        try {
          const res = await fetch('/api/profile/tags', { credentials: 'same-origin' })
          const d = await res.json()
          if (d.ok) {
            dataStore.setCurrentTags(d.data || [])
            useAppCache.getState().setTimestamp('tags')
          }
        } catch { /* silent */ }
      })
    }
  }, [user])
}

/**
 * Prefetch notification count on app mount.
 */
export function usePrefetchNotifications() {
  const user = useAuthStore((s) => s.user)
  const ranRef = useRef(false)

  useEffect(() => {
    if (!user || ranRef.current) return
    ranRef.current = true

    const cache = useAppCache.getState()

    if (cache.isStale('notifications')) {
      dedupFetch('prefetch-notif-count', async () => {
        try {
          const res = await fetch('/api/notifications/unread-count', { credentials: 'same-origin' })
          const d = await res.json()
          if (d.ok) {
            useAppCache.getState().setNotifCount(d.count)
            useAppCache.getState().setTimestamp('notifications')
          }
        } catch { /* silent */ }
      })
    }
  }, [user])
}

/**
 * Master prefetch hook — runs all prefetches on app mount.
 * Use this once in AppShell.
 */
export function usePrefetchAll() {
  usePrefetchDiscover()
  usePrefetchChatList()
  usePrefetchProfile()
  usePrefetchTags()
  usePrefetchNotifications()
}

/**
 * Prefetch a specific tab's data when user starts touching/hovering the tab.
 * Call on onTouchStart or onMouseEnter of tab buttons.
 */
export function usePrefetchOnInteraction() {
  const prefetchDiscover = () => {
    const cache = useAppCache.getState()
    const dataStore = useDataStore.getState()
    if (cache.isStale('discover') || dataStore.nearbyUsers.length === 0) {
      dedupFetch('prefetch-nearby', async () => {
        try {
          const res = await fetch('/api/discover/nearby?limit=20&sort=nearby', { credentials: 'same-origin' })
          const d = await res.json()
          if (d.ok) {
            dataStore.setNearbyUsers(d.data || [], d.nextCursor || null)
            useAppCache.getState().setTimestamp('discover')
          }
        } catch { /* silent */ }
      })
    }
  }

  const prefetchChatList = () => {
    const cache = useAppCache.getState()
    const dataStore = useDataStore.getState()
    if (cache.isStale('chatList') || dataStore.chatList.length === 0) {
      dedupFetch('prefetch-chatlist', async () => {
        try {
          const res = await fetch('/api/chat/list', { credentials: 'same-origin' })
          const d = await res.json()
          if (d.ok) {
            dataStore.setChatList(d.data || [])
            useAppCache.getState().setTimestamp('chatList')
          }
        } catch { /* silent */ }
      })
    }
  }

  return { prefetchDiscover, prefetchChatList }
}
