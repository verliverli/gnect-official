'use client'

import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react'
import { io } from 'socket.io-client'
import { motion, AnimatePresence } from 'framer-motion'
import { Compass, Search, RefreshCw, Users, MapPin, Loader2, RotateCcw, ChevronDown, Shield, SlidersHorizontal, Flame } from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import { useDataStore } from '@/lib/data-store'
import { useAppCache, dedupFetch } from '@/lib/app-cache'
import { BannerCard } from '@/components/discover/banner-card'
import { SpotlightView } from '@/components/discover/spotlight-view'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { ROLES, BODY_TYPES, AVAILABILITY_STATUSES, INTO_TAGS } from '@/lib/constants'

// ============================================
// Types
// ============================================

type DiscoverTab = 'nearby' | 'all'

interface DiscoverUser {
  id: string
  nickname: string
  age: number
  region: string
  role: string
  body_type: string
  availability: string
  is_online: boolean
  last_seen: string
  street?: string | null
  cucumber_size?: number | null
  show_cucumber?: boolean
  discretion_mode: boolean
  status_text?: string | null
  status_gradient?: string | null
  created_at: string
  photos: { id: string; catbox_url: string; is_face_pic: boolean; is_locked: boolean }[]
  into_tags: string[]
  is_saved: boolean
  rating_avg: number
  rating_count: number
}

interface NearbyFilters {
  role: string
  availability: string
  bodyType: string
  street: string
  tag: string
  ageMin: string
  ageMax: string
}

const DEFAULT_NEARBY_FILTERS: NearbyFilters = {
  role: '',
  availability: '',
  bodyType: '',
  street: '',
  tag: '',
  ageMin: '',
  ageMax: '',
}

// ============================================
// Simple Dropdown Select Component
// ============================================

const DropdownFilter = memo(function DropdownFilter({
  label,
  value,
  onChange,
  options,
  placeholder = 'All',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly string[]
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const displayValue = value || placeholder

  return (
    <div className="relative space-y-1" ref={ref}>
      <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-0.5">
        {label}
      </span>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full h-10 px-3 rounded-xl border text-sm text-left flex items-center justify-between gap-2 transition-colors ${
          value
            ? 'border-primary/30 bg-primary/5 text-primary font-medium'
            : 'border-border bg-card text-foreground hover:bg-card/80'
        }`}
      >
        <span className="truncate">{displayValue}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.1 }}
            className="absolute left-0 right-0 z-50 mt-1 min-w-[160px] max-h-60 overflow-y-auto rounded-xl border bg-popover shadow-lg gnect-scroll"
          >
            {/* "All" option to clear */}
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              className={`w-full px-3 py-2.5 text-sm text-left hover:bg-accent transition-colors ${
                !value ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'
              }`}
            >
              All
            </button>
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt === value ? '' : opt); setOpen(false) }}
                className={`w-full px-3 py-2.5 text-sm text-left hover:bg-accent transition-colors ${
                  opt === value ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'
                }`}
              >
                {opt}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})

// ============================================
// Discover Screen Component

export function DiscoverScreen({ onOpenChat }: { onOpenChat?: (userId: string) => void }) {
  const { user: currentUser } = useAuthStore()
  const dataStore = useDataStore
  const appCache = useAppCache

  // Read cached data from store for instant rendering
  const cachedNearby = dataStore((s) => s.nearbyUsers)
  const cachedAll = dataStore((s) => s.allUsers)
  const cachedTags = dataStore((s) => s.currentTags)

  // Tab state
  const [activeTab, setActiveTab] = useState<DiscoverTab>('nearby')

  // Nearby state — if cache exists, show it instantly (no spinner)
  const [nearbyUsers, setNearbyUsers] = useState<DiscoverUser[]>(cachedNearby)
  const [nearbyLoading, setNearbyLoading] = useState(cachedNearby.length === 0)
  const [nearbyCursor, setNearbyCursor] = useState<string | null>(null)
  const [nearbyHasMore, setNearbyHasMore] = useState(false)
  const [nearbyRefreshing, setNearbyRefreshing] = useState(false)
  const [nearbyLoadingMore, setNearbyLoadingMore] = useState(false)

  // All users state — same cache-first pattern
  const [allUsers, setAllUsers] = useState<DiscoverUser[]>(cachedAll)
  const [allLoading, setAllLoading] = useState(cachedAll.length === 0)
  const [allCursor, setAllCursor] = useState<string | null>(null)
  const [allHasMore, setAllHasMore] = useState(false)
  const [allLoadingMore, setAllLoadingMore] = useState(false)
  const [allSearch, setAllSearch] = useState('')
  const [allAvailableOnly, setAllAvailableOnly] = useState(false)

  // Filter panel visibility
  const [filtersVisible, setFiltersVisible] = useState(false)

  // Filter state for Nearby
  const [filters, setFilters] = useState<NearbyFilters>(DEFAULT_NEARBY_FILTERS)

  // Spotlight state
  const [spotlightUserId, setSpotlightUserId] = useState<string | null>(null)
  const [spotlightIndex, setSpotlightIndex] = useState(-1)

  // Pull-to-refresh state
  const [pullStartY, setPullStartY] = useState<number | null>(null)
  const [pullDistance, setPullDistance] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Current user's tags for shared interest matching
  const [currentTags, setCurrentTags] = useState<string[]>(cachedTags)

  // Request ID refs to prevent stale responses from overwriting newer ones
  const nearbyRequestIdRef = useRef(0)
  const allRequestIdRef = useRef(0)
  // Refs for has-cached-data checks (avoid stale closures in useCallback)
  const nearbyUsersLengthRef = useRef(0)
  const allUsersLengthRef = useRef(0)

  // Broadcast banner state
  const [activeBroadcasts, setActiveBroadcasts] = useState<any[]>([])

  // Real-time online status updates via Socket.io
  useEffect(() => {
    if (!currentUser) return

    const envSocketUrl = process.env.NEXT_PUBLIC_SOCKET_URL
    if (!envSocketUrl) return

    const isLocalhost = envSocketUrl.includes('localhost') || envSocketUrl.includes('127.0.0.1')
    const socketUrl = isLocalhost ? window.location.origin : envSocketUrl

    const statusSocket = io(socketUrl, {
      path: '/socket.io',
      query: {
        userId: currentUser.id,
        ...(isLocalhost ? { XTransformPort: '3003' } : {}),
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
    })

    statusSocket.on('user-status-change', (data: { userId: string; isOnline: boolean }) => {
      // Update nearbyUsers
      setNearbyUsers((prev) => {
        const updated = prev.map((u) =>
          u.id === data.userId ? { ...u, is_online: data.isOnline } : u
        )
        // Re-sort: online users first
        return updated.sort((a, b) => {
          if (a.is_online !== b.is_online) return a.is_online ? -1 : 1
          return new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime()
        })
      })

      // Update allUsers
      setAllUsers((prev) => {
        const updated = prev.map((u) =>
          u.id === data.userId ? { ...u, is_online: data.isOnline } : u
        )
        // Re-sort: online users first
        return updated.sort((a, b) => {
          if (a.is_online !== b.is_online) return a.is_online ? -1 : 1
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })
      })
    })

    return () => {
      statusSocket.disconnect()
    }
  }, [currentUser])

  // Fetch active broadcasts
  useEffect(() => {
    if (!currentUser) return
    const fetchBroadcasts = () => {
      fetch('/api/broadcasts/active', { credentials: 'same-origin' })
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) {
            // Show ALL active broadcasts (urgent + info) as uncancellable banners
            setActiveBroadcasts([...(d.urgent || []), ...(d.info || [])])
          }
        })
        .catch(() => {})
    }
    fetchBroadcasts()
    const interval = setInterval(fetchBroadcasts, 30000) // Check every 30s (Socket.io handles instant, this is fallback)
    return () => clearInterval(interval)
  }, [currentUser])

  // Active filter count for badge
  const activeFilterCount = useMemo(() =>
    (filters.role ? 1 : 0) +
    (filters.availability ? 1 : 0) +
    (filters.bodyType ? 1 : 0) +
    (filters.street.trim() ? 1 : 0) +
    (filters.tag ? 1 : 0) +
    (filters.ageMin ? 1 : 0) +
    (filters.ageMax ? 1 : 0)
  , [filters])

  // Fetch current user's tags on mount — cache-first with dedup
  useEffect(() => {
    if (!currentUser) return
    // Tags rarely change — skip fetch entirely if we have cache and it's not stale
    if (cachedTags.length > 0 && !appCache.getState().isStale('tags')) return

    dedupFetch('tags', async () => {
      try {
        const res = await fetch('/api/profile/tags', { credentials: 'same-origin' })
        const d = await res.json()
        if (d.ok) {
          setCurrentTags(d.data)
          dataStore.getState().setCurrentTags(d.data)
          appCache.getState().setTimestamp('tags')
        }
      } catch { /* silent */ }
    })
  }, [currentUser])

  // ========================================
  // Build query params from filters
  // ========================================
  const buildNearbyParams = useCallback((cursor?: string) => {
    const params = new URLSearchParams()
    params.set('limit', '20')
    if (cursor) params.set('cursor', cursor)

    // Sort based on availability filter
    if (filters.availability === 'Available Now') params.set('sort', 'available_now')
    else if (filters.availability === 'Online') params.set('sort', 'online')
    else if (filters.availability === 'New') params.set('sort', 'newest')
    else params.set('sort', 'nearby')

    // Role filter
    if (filters.role) params.set('role', filters.role)

    // Body type
    if (filters.bodyType) params.set('bodyType', filters.bodyType)

    // Availability
    if (filters.availability === 'Available Now') params.set('availability', 'Available Now')
    if (filters.availability === 'Tonight') params.set('availability', 'Tonight')
    if (filters.availability === 'This Week') params.set('availability', 'This Week')

    // Online only
    if (filters.availability === 'Online') params.set('onlineOnly', 'true')

    // Street
    if (filters.street.trim()) params.set('street', filters.street.trim())

    // Tag filter
    if (filters.tag) params.set('tag', filters.tag)

    // Age range
    if (filters.ageMin) {
      const min = parseInt(filters.ageMin)
      if (!isNaN(min) && min >= 18) params.set('ageMin', String(min))
    }
    if (filters.ageMax) {
      const max = parseInt(filters.ageMax)
      if (!isNaN(max) && max >= 18) params.set('ageMax', String(max))
    }

    return params
  }, [filters])

  // Fetch nearby users — with request counter to discard stale responses
  // ========================================
  const fetchNearby = useCallback(async (cursor?: string, append = false, silent = false) => {
    if (!currentUser) return

    const requestId = ++nearbyRequestIdRef.current

    const isRefresh = !append && !cursor
    const hasCachedData = nearbyUsersLengthRef.current > 0
    // Only show loading spinner if no cache and not silent
    if (isRefresh && !silent && !hasCachedData) setNearbyRefreshing(true)
    else if (append) setNearbyLoadingMore(true)
    else if (!silent && !hasCachedData) setNearbyLoading(true)

    // Include filters in dedup key so changing filters always triggers a NEW fetch
    const filterKey = JSON.stringify(filters)
    const paramsKey = cursor ? `nearby-${cursor}-${filterKey}` : `nearby-${filterKey}`

    try {
      await dedupFetch(paramsKey, async () => {
        const params = buildNearbyParams(cursor)
        const res = await fetch(`/api/discover/nearby?${params.toString()}`, { credentials: 'same-origin' })
        const data = await res.json()

        // Discard stale response if a newer request has been fired
        if (requestId !== nearbyRequestIdRef.current) return

        if (data.ok) {
          const users = data.data || []
          if (append) {
            setNearbyUsers((prev) => [...prev, ...users])
          } else {
            setNearbyUsers(users)
            nearbyUsersLengthRef.current = users.length
            // Update data store cache
            dataStore.getState().setNearbyUsers(users, data.nextCursor || null)
            appCache.getState().setTimestamp('discover')
          }
          setNearbyCursor(data.nextCursor || null)
          setNearbyHasMore(!!data.nextCursor)
        } else {
          if (!append) {
            setNearbyUsers([])
            nearbyUsersLengthRef.current = 0
          }
          if (!silent) toast.error(data.error || 'Failed to load nearby users')
        }
      })
    } catch {
      // Discard stale response
      if (requestId !== nearbyRequestIdRef.current) return
      if (!append) {
        setNearbyUsers([])
        nearbyUsersLengthRef.current = 0
      }
      if (!silent) toast.error('Network error')
    } finally {
      // Only clear loading states if this is still the latest request
      if (requestId === nearbyRequestIdRef.current) {
        setNearbyLoading(false)
        setNearbyRefreshing(false)
        setNearbyLoadingMore(false)
      }
    }
  }, [currentUser, buildNearbyParams, dataStore])

  // ========================================
  // Fetch all users — with request counter to discard stale responses
  // ========================================
  const fetchAll = useCallback(async (cursor?: string, append = false, silent = false) => {
    if (!currentUser) return

    const requestId = ++allRequestIdRef.current

    const isRefresh = !append && !cursor
    const hasCachedData = allUsersLengthRef.current > 0
    // Only show loading spinner if no cache and not silent
    if (isRefresh && !silent && !hasCachedData) setAllLoading(true)
    else if (append) setAllLoadingMore(true)

    const paramsKey = cursor ? `all-${cursor}-${allSearch}-${allAvailableOnly}` : `all-${allSearch}-${allAvailableOnly}`

    try {
      await dedupFetch(paramsKey, async () => {
        const params = new URLSearchParams()
        params.set('limit', '20')
        if (cursor) params.set('cursor', cursor)
        if (allSearch.trim()) params.set('search', allSearch.trim().slice(0, 20))
        if (allAvailableOnly) params.set('availability', 'Available Now')

        const res = await fetch(`/api/discover/all?${params.toString()}`, { credentials: 'same-origin' })
        const data = await res.json()

        // Discard stale response if a newer request has been fired
        if (requestId !== allRequestIdRef.current) return

        if (data.ok) {
          const users = data.data || []
          if (append) {
            setAllUsers((prev) => [...prev, ...users])
          } else {
            setAllUsers(users)
            allUsersLengthRef.current = users.length
            // Update data store cache
            dataStore.getState().setAllUsers(users, data.nextCursor || null)
          }
          setAllCursor(data.nextCursor || null)
          setAllHasMore(!!data.nextCursor)
        } else {
          if (!append) {
            setAllUsers([])
            allUsersLengthRef.current = 0
          }
        }
      })
    } catch {
      // Discard stale response
      if (requestId !== allRequestIdRef.current) return
      if (!append) {
        setAllUsers([])
        allUsersLengthRef.current = 0
      }
    } finally {
      // Only clear loading states if this is still the latest request
      if (requestId === allRequestIdRef.current) {
        setAllLoading(false)
        setAllLoadingMore(false)
      }
    }
  }, [currentUser, allSearch, allAvailableOnly, dataStore])

  // ========================================
  // Initial fetch & filter changes
  // Clear old results instantly and re-fetch when filters change
  // ========================================
  useEffect(() => {
    if (currentUser) {
      setNearbyCursor(null)
      setNearbyUsers([])  // Clear old results immediately so stale data doesn't show
      nearbyUsersLengthRef.current = 0
      setNearbyLoading(true)  // Show loading skeleton right away
      fetchNearby()
    }
  }, [currentUser, filters])

  useEffect(() => {
    if (activeTab === 'all' && currentUser) {
      setAllCursor(null)
      setAllUsers([])  // Clear old results immediately when switching to All Users tab
      allUsersLengthRef.current = 0
      setAllLoading(true)  // Show loading skeleton right away
      fetchAll()
    }
  }, [activeTab, currentUser, allSearch, allAvailableOnly])

  // ========================================
  // Save/bookmark toggle
  // ========================================
  const handleSave = useCallback(async (userId: string) => {
    const isInNearby = nearbyUsers.find((u) => u.id === userId)
    const isInAll = allUsers.find((u) => u.id === userId)
    const isSaved = isInNearby?.is_saved || isInAll?.is_saved || false

    // === Optimistic UI: toggle saved state instantly ===
    const rollbackNearby = isInNearby ? { ...isInNearby } : null
    const rollbackAll = isInAll ? { ...isInAll } : null
    setNearbyUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, is_saved: !isSaved } : u))
    )
    setAllUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, is_saved: !isSaved } : u))
    )

    try {
      const method = isSaved ? 'DELETE' : 'POST'
      const res = await fetch('/api/profile/save', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (data.ok) {
        toast.success(isSaved ? 'Removed from saved' : 'Profile saved!')
      } else {
        // Rollback on failure
        if (rollbackNearby) setNearbyUsers((prev) => prev.map((u) => (u.id === userId ? rollbackNearby : u)))
        if (rollbackAll) setAllUsers((prev) => prev.map((u) => (u.id === userId ? rollbackAll : u)))
        toast.error(data.error || 'Failed')
      }
    } catch {
      // Rollback on network error
      if (rollbackNearby) setNearbyUsers((prev) => prev.map((u) => (u.id === userId ? rollbackNearby : u)))
      if (rollbackAll) setAllUsers((prev) => prev.map((u) => (u.id === userId ? rollbackAll : u)))
      toast.error('Network error')
    }
  }, [nearbyUsers, allUsers])

  // ========================================
  // Spotlight navigation
  // ========================================
  const openSpotlight = useCallback((userId: string) => {
    const currentList = activeTab === 'nearby' ? nearbyUsers : allUsers
    const idx = currentList.findIndex((u) => u.id === userId)
    setSpotlightIndex(idx)
    setSpotlightUserId(userId)
  }, [activeTab, nearbyUsers, allUsers])

  const closeSpotlight = useCallback(() => {
    setSpotlightUserId(null)
    setSpotlightIndex(-1)
  }, [])

  const goToPrev = useCallback(() => {
    const currentList = activeTab === 'nearby' ? nearbyUsers : allUsers
    const newIdx = Math.max(0, spotlightIndex - 1)
    if (newIdx !== spotlightIndex) {
      setSpotlightIndex(newIdx)
      setSpotlightUserId(currentList[newIdx].id)
    }
  }, [activeTab, nearbyUsers, allUsers, spotlightIndex])

  const goToNext = useCallback(() => {
    const currentList = activeTab === 'nearby' ? nearbyUsers : allUsers
    const newIdx = Math.min(currentList.length - 1, spotlightIndex + 1)
    if (newIdx !== spotlightIndex) {
      setSpotlightIndex(newIdx)
      setSpotlightUserId(currentList[newIdx].id)
    }
  }, [activeTab, nearbyUsers, allUsers, spotlightIndex])

  // ========================================
  // Infinite scroll
  // ========================================
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    if (scrollHeight - scrollTop - clientHeight < 200) {
      if (activeTab === 'nearby' && nearbyHasMore && !nearbyLoadingMore && !nearbyLoading && !nearbyRefreshing) {
        fetchNearby(nearbyCursor || undefined, true)
      } else if (activeTab === 'all' && allHasMore && !allLoadingMore && !allLoading) {
        fetchAll(allCursor || undefined, true)
      }
    }
  }, [activeTab, nearbyHasMore, nearbyLoadingMore, nearbyLoading, nearbyRefreshing, nearbyCursor, fetchNearby, allHasMore, allLoadingMore, allLoading, allCursor, fetchAll])

  // ========================================
  // Pull-to-refresh
  // ========================================
  const onTouchStart = (e: React.TouchEvent) => {
    if (scrollRef.current && scrollRef.current.scrollTop === 0) {
      setPullStartY(e.touches[0].clientY)
    }
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (pullStartY === null) return
    const diff = e.touches[0].clientY - pullStartY
    if (diff > 0 && scrollRef.current && scrollRef.current.scrollTop === 0) {
      setPullDistance(Math.min(diff * 0.5, 80))
    }
  }

  const onTouchEnd = () => {
    if (pullDistance > 50) {
      if (activeTab === 'nearby') {
        setNearbyCursor(null)
        fetchNearby()
      } else {
        setAllCursor(null)
        fetchAll()
      }
    }
    setPullStartY(null)
    setPullDistance(0)
  }

  // ========================================
  // Search input handler — instant, no debounce
  // ========================================
  const handleSearchChange = (value: string) => {
    if (value.length > 20) return
    setAllSearch(value)
  }

  // ========================================
  // Reset filters
  // ========================================
  const handleResetFilters = useCallback(() => {
    setFilters(DEFAULT_NEARBY_FILTERS)
  }, [])

  // ========================================
  // Loading skeleton
  // ========================================
  const renderSkeletons = () => (
    <div className="px-4 space-y-2.5">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-2xl border bg-card p-3">
          <div className="flex items-start gap-3">
            <Skeleton className="w-20 h-20 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2 min-w-0">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-36" />
              <div className="flex gap-1.5">
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )

  // ========================================
  // Empty states
  // ========================================
  const renderEmpty = (type: 'nearby' | 'all' | 'filtered') => {
    const messages = {
      nearby: {
        title: 'No one nearby right now',
        subtitle: "They'll come",
      },
      all: {
        title: 'No users yet',
        subtitle: 'Be the first in your area',
      },
      filtered: {
        title: 'No matches',
        subtitle: `No one matches your filters in ${currentUser?.region || 'your area'}. Try broadening.`,
      },
    }
    const msg = messages[type]
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-3 py-12">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Compass className="w-7 h-7 text-primary" />
        </div>
        <h3 className="text-base font-semibold text-foreground">{msg.title}</h3>
        <p className="text-xs text-muted-foreground text-center max-w-xs">{msg.subtitle}</p>
      </div>
    )
  }

  // ========================================
  // Render
  // ========================================
  return (
    <div className="h-full flex flex-col">
      {/* Tab Bar */}
      <div className="flex items-center border-b border-border/50 shrink-0">
        <div className="flex-1 flex items-center justify-center relative">
          <button
            onClick={() => setActiveTab('nearby')}
            className={`flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
              activeTab === 'nearby' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            Nearby
          </button>
          {/* Filter toggle button - sibling, not nested */}
          <button
            type="button"
            onClick={() => setFiltersVisible(!filtersVisible)}
            className={`relative h-6 w-6 rounded-full flex items-center justify-center transition-colors ${
              filtersVisible ? 'bg-primary/20 text-primary' : 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-secondary'
            }`}
            aria-label="Toggle filters"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 rounded-full bg-primary text-primary-foreground text-[8px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
          {activeTab === 'nearby' && (
            <div className="absolute bottom-0 left-2 right-2 h-[3px] bg-primary rounded-full gnect-tab-fade" />
          )}
        </div>
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors relative ${
            activeTab === 'all' ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          All Users
          {activeTab === 'all' && (
            <div className="absolute bottom-0 left-2 right-2 h-[3px] bg-primary rounded-full gnect-tab-fade" />
          )}
        </button>
      </div>

      {/* ===== NEARBY FILTER DROPDOWNS (collapsible) ===== */}
      {activeTab === 'nearby' && (
        <AnimatePresence>
          {filtersVisible && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="shrink-0 border-b border-border/30 gnect-glass-light"
              style={{ overflow: 'visible' }}
            >
              <div className="px-3 py-2.5">
          {/* Row 1: Role + Availability */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <DropdownFilter
              label="Role"
              value={filters.role}
              onChange={(v) => setFilters((prev) => ({ ...prev, role: v }))}
              options={ROLES}
              placeholder="All Roles"
            />
            <DropdownFilter
              label="Availability"
              value={filters.availability}
              onChange={(v) => setFilters((prev) => ({ ...prev, availability: v }))}
              options={['Available Now', 'Online', 'Tonight', 'This Week', 'New']}
              placeholder="All Status"
            />
          </div>

          {/* Row 2: Body Type + Street */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <DropdownFilter
              label="Body Type"
              value={filters.bodyType}
              onChange={(v) => setFilters((prev) => ({ ...prev, bodyType: v }))}
              options={BODY_TYPES}
              placeholder="All Types"
            />
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-0.5">
                Street / Area
              </span>
              <div className="relative">
                <Input
                  placeholder="e.g. West Bay"
                  value={filters.street}
                  onChange={(e) => {
                    if (e.target.value.length <= 30) {
                      setFilters((prev) => ({ ...prev, street: e.target.value }))
                    }
                  }}
                  className="h-10 rounded-xl text-sm pr-8"
                  maxLength={30}
                />
                {filters.street && (
                  <button
                    type="button"
                    onClick={() => setFilters((prev) => ({ ...prev, street: '' }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Row 3: Tag + Age Range */}
          <div className="grid grid-cols-2 gap-2">
            <DropdownFilter
              label="Into Tag"
              value={filters.tag}
              onChange={(v) => setFilters((prev) => ({ ...prev, tag: v }))}
              options={INTO_TAGS}
              placeholder="All Tags"
            />
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-0.5">
                Age Range
              </span>
              <div className="flex items-center gap-1">
                <Input
                  placeholder="18"
                  value={filters.ageMin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 2)
                    setFilters((prev) => ({ ...prev, ageMin: val }))
                  }}
                  className="h-10 rounded-xl text-sm text-center px-1"
                  maxLength={2}
                />
                <span className="text-muted-foreground/50 text-xs shrink-0">–</span>
                <Input
                  placeholder="99"
                  value={filters.ageMax}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 2)
                    setFilters((prev) => ({ ...prev, ageMax: val }))
                  }}
                  className="h-10 rounded-xl text-sm text-center px-1"
                  maxLength={2}
                />
              </div>
            </div>
          </div>

          {/* Active filters + reset */}
          {activeFilterCount > 0 && (
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/20">
              <span className="text-[10px] text-muted-foreground">
                {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
              </span>
              <button
                type="button"
                onClick={handleResetFilters}
                className="flex items-center gap-1 text-[10px] text-primary font-medium hover:underline"
              >
                <RotateCcw className="w-3 h-3" />
                Reset all
              </button>
            </div>
          )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* ===== ALL USERS FILTER BAR ===== */}
      {activeTab === 'all' && (
        <div className="px-4 py-2 shrink-0 border-b border-border/30 bg-background/95">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by nickname..."
                value={allSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9 h-10 rounded-xl text-sm"
                maxLength={20}
              />
            </div>
            <button
              type="button"
              onClick={() => setAllAvailableOnly(!allAvailableOnly)}
              className={`h-10 px-4 rounded-xl text-sm font-medium transition-all ${
                allAvailableOnly
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              Available
            </button>
          </div>
        </div>
      )}

      {/* ===== UNCANCELLABLE BROADCAST BANNER ===== */}
      {activeBroadcasts.length > 0 && (
        <div className="shrink-0 border-b border-yellow-500/20 bg-yellow-500/5">
          {activeBroadcasts.map((b) => (
            <div key={b.id} className="flex items-center gap-2.5 px-4 py-2.5">
              <Shield className="w-4 h-4 text-yellow-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 truncate">
                  {b.title}
                </p>
                <p className="text-[10px] text-muted-foreground line-clamp-1">
                  {b.message}
                </p>
              </div>
              {b.action_label && b.action_url && (
                <a
                  href={b.action_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 h-7 px-3 rounded-full bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 text-[10px] font-semibold hover:bg-yellow-500/30 transition-colors flex items-center"
                >
                  {b.action_label}
                </a>
              )}
              {/* NO dismiss/OK/X button — this banner is uncancellable */}
            </div>
          ))}
        </div>
      )}

      {/* Pull-to-refresh indicator */}
      {pullDistance > 0 && (
        <div
          className="flex items-center justify-center py-1 transition-all shrink-0"
          style={{ height: pullDistance }}
        >
          <RefreshCw
            className={`w-4 h-4 text-primary ${pullDistance > 50 ? 'animate-spin' : ''}`}
          />
        </div>
      )}

      {/* Content Area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="flex-1 overflow-y-auto overscroll-contain gnect-scroll"
      >
        <div key={activeTab} className="gnect-tab-fade">
            {/* ===== NEARBY TAB ===== */}
            {activeTab === 'nearby' && (
              <>
                {nearbyLoading ? (
                  renderSkeletons()
                ) : nearbyUsers.length === 0 ? (
                  renderEmpty(activeFilterCount > 0 ? 'filtered' : 'nearby')
                ) : (
                  <div className="px-4 space-y-2.5 py-2 pb-20">
                    {nearbyUsers.map((u) => (
                      <BannerCard
                        key={u.id}
                        user={u}
                        currentUserId={currentUser?.id || ''}
                        currentTags={currentTags}
                        onTap={openSpotlight}
                        onSave={handleSave}
                      />
                    ))}

                    {nearbyLoadingMore && (
                      <div className="flex justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      </div>
                    )}

                    {!nearbyHasMore && nearbyUsers.length > 0 && (
                      <div className="text-center py-6 text-xs text-muted-foreground/50">
                        That&apos;s everyone nearby for now
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ===== ALL USERS TAB ===== */}
            {activeTab === 'all' && (
              <>
                {allLoading ? (
                  renderSkeletons()
                ) : allUsers.length === 0 ? (
                  renderEmpty(allSearch || allAvailableOnly ? 'filtered' : 'all')
                ) : (
                  <div className="px-4 space-y-2.5 py-2 pb-20">
                    {allUsers.map((u) => (
                      <BannerCard
                        key={u.id}
                        user={u}
                        currentUserId={currentUser?.id || ''}
                        currentTags={currentTags}
                        onTap={openSpotlight}
                        onSave={handleSave}
                      />
                    ))}

                    {allLoadingMore && (
                      <div className="flex justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      </div>
                    )}

                    {!allHasMore && allUsers.length > 0 && (
                      <div className="text-center py-6 text-xs text-muted-foreground/50">
                        That&apos;s everyone for now
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
        </div>
      </div>

      {/* Spotlight View */}
      <AnimatePresence>
        {spotlightUserId && (
          <SpotlightView
            key={spotlightUserId}
            userId={spotlightUserId}
            currentUserId={currentUser?.id || ''}
            currentTags={currentTags}
            onClose={closeSpotlight}
            onPrev={goToPrev}
            onNext={goToNext}
            hasPrev={spotlightIndex > 0}
            hasNext={spotlightIndex < (activeTab === 'nearby' ? nearbyUsers : allUsers).length - 1}
            onOpenChat={onOpenChat}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
