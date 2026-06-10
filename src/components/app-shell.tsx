'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Bell, Shield, Compass, MessageCircle, Users, EyeOff, HelpCircle, BookOpen, LifeBuoy, Lightbulb, X, Gift, Ban, Shuffle, Download } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { io, Socket } from 'socket.io-client'
import { GeometricAvatar } from '@/components/geometric-avatar'
import { useAuthStore, useBadgeStore } from '@/lib/store'
import { useDataStore } from '@/lib/data-store'
import { useNotificationSocket } from '@/lib/use-notification-socket'
import { usePrefetchAll, usePrefetchOnInteraction } from '@/lib/use-prefetch'
import { useAppCache } from '@/lib/app-cache'
import { toast } from 'sonner'
import { SAFE_PAGES, getMediaUrl } from '@/lib/constants'
import { DiscoverScreen } from '@/components/discover-screen'
import { ChatsScreen } from '@/components/chats-screen'
import { CommunityScreen } from '@/components/community-screen'
import { MixerScreen } from '@/components/mixer-screen'
import { ProfilePanel } from '@/components/profile-panel'
import { NotificationCenter } from '@/components/notification-center'
import { BroadcastOverlay } from '@/components/broadcast-overlay'
import { usePanicTripleTap } from '@/components/panic-button'
import { PrivacyGuide } from '@/components/privacy-guide'
import { AppGuide } from '@/components/app-guide'

import { ErrorBoundary } from '@/components/error-boundary'
import { ErrorCatcher } from '@/components/error-catcher'
import { SupportScreen } from '@/components/support/support-screen'
import { FeedbackForm } from '@/components/feedback-form'
import { Button } from '@/components/ui/button'
import { usePwaInstall } from '@/lib/use-pwa-install'

type Screen = 'discover' | 'chats' | 'community' | 'mixer'

export function AppShell() {
  const { user, disappearMode, setDisappearMode } = useAuthStore()
  const badgeStore = useBadgeStore
  const dataStore = useDataStore
  const appCache = useAppCache
  const [activeScreen, setActiveScreen] = useState<Screen>('discover')

  // PWA install prompt — shows floating banner if browser supports install
  const { canInstall, isInstalled, promptInstall, isLoading } = usePwaInstall()
  const [dismissedInstall, setDismissedInstall] = useState(false)
  const showInstallBanner = canInstall && !isInstalled && !dismissedInstall

  // === Aggressive prefetch: fire all data fetches on app mount ===
  usePrefetchAll()

  // === Prefetch on hover/touch for instant tab switching ===
  const { prefetchDiscover, prefetchChatList } = usePrefetchOnInteraction()

  // Legacy prefetch ref — kept as fallback for cache seeding during initial mount
  const prefetchRanRef = useRef(false)
  useEffect(() => {
    if (!user || prefetchRanRef.current) return
    prefetchRanRef.current = true

    // Seed the data store and app cache timestamps — actual fetch is handled by usePrefetchAll
    // This ensures timestamps are set even if prefetch hooks already ran
    Promise.all([
      fetch('/api/discover/nearby?limit=20&sort=nearby', { credentials: 'same-origin' })
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) {
            dataStore.getState().setNearbyUsers(d.data || [], d.nextCursor || null)
            appCache.getState().setTimestamp('discover')
          }
        })
        .catch(() => {}),
      fetch('/api/discover/all?limit=20', { credentials: 'same-origin' })
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) {
            dataStore.getState().setAllUsers(d.data || [], d.nextCursor || null)
          }
        })
        .catch(() => {}),
      fetch('/api/chat/list', { credentials: 'same-origin' })
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) {
            dataStore.getState().setChatList(d.data || [])
            appCache.getState().setTimestamp('chatList')
          }
        })
        .catch(() => {}),
      fetch('/api/profile/tags', { credentials: 'same-origin' })
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) {
            dataStore.getState().setCurrentTags(d.data || [])
            appCache.getState().setTimestamp('tags')
          }
        })
        .catch(() => {}),
      // Fetch user's profile photo for avatar display
      fetch('/api/profile/photos', { credentials: 'same-origin' })
        .then((r) => r.json())
        .then((d) => {
          if (d.ok && d.data?.length > 0) {
            const url = getMediaUrl(d.data[0].catbox_url)
            if (url) dataStore.getState().setProfilePhotoUrl(url)
          }
        })
        .catch(() => {}),
    ])
  }, [user, dataStore, appCache])

  // Phase 9: Track current screen for error catcher context
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__gnectCurrentScreen = activeScreen
    }
  }, [activeScreen])

  const [showProfile, setShowProfile] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showPrivacyGuide, setShowPrivacyGuide] = useState(false)
  const [showAppGuide, setShowAppGuide] = useState(false)
  const [showSupport, setShowSupport] = useState(false)
  const [showFeedbackSheet, setShowFeedbackSheet] = useState(false)
  // Phase 6: Instant dark overlay on focus loss — privacy protection
  const [appBlurred, setAppBlurred] = useState(false)

  // Phase 6: Screenshot deterrent flash
  const [showScreenshotFlash, setShowScreenshotFlash] = useState(false)

  // Phase 6: Triple-tap header for panic
  const handleHeaderTripleTap = usePanicTripleTap()

  // Phase 6: Set up panic redirect function for triple-tap
  useEffect(() => {
    if (!user) return
    const safePageId = (() => {
      try {
        if (!user.notification_settings) return 'calculator'
        const s = JSON.parse(user.notification_settings)
        return s.safePageId || 'calculator'
      } catch { return 'calculator' }
    })()

    const triggerPanic = () => {
      const safePage = SAFE_PAGES.find((p) => p.id === safePageId) || SAFE_PAGES.find((p) => p.id === 'calculator')!
      window.location.replace(safePage.url)
    }

    ;(window as unknown as Record<string, unknown>).__gnectPanic = triggerPanic
    return () => { delete (window as unknown as Record<string, unknown>).__gnectPanic }
  }, [user])

  // Chat state — supports opening chat from Spotlight
  const [chatWithUserId, setChatWithUserId] = useState<string | null>(null)
  const [chatKey, setChatKey] = useState(0) // Force re-mount when opening new chat
  const [chatOpenedFromDiscover, setChatOpenedFromDiscover] = useState(false) // Track if chat was opened from Discover
  // Bug 6: Sync totalUnread to badge store for bottom nav
  const [totalUnread, setTotalUnread] = useState(0)
  const [notifUnread, setNotifUnread] = useState(0)

  // Sync chat unread to badge store
  useEffect(() => {
    badgeStore.getState().setUnreadChats(totalUnread)
  }, [totalUnread, badgeStore])
  const chatSocketRef = useRef<Socket | null>(null)
  const activeScreenRef = useRef<Screen>(activeScreen)

  // Keep screen ref in sync so the socket listener always has the latest
  // Also set global screen variable for error catcher
  useEffect(() => {
    activeScreenRef.current = activeScreen
    if (typeof window !== 'undefined') {
      window.__gnectCurrentScreen = activeScreen
    }
  }, [activeScreen])

  const initial = user?.nickname?.charAt(0)?.toUpperCase() || '?'
  const isAdmin = user?.is_admin

  // Real-time notifications via Socket.io — Bug 6: also update badge counts
  useNotificationSocket(useCallback((notif) => {
    setNotifUnread((prev) => prev + 1)
    // Bug 6: Increment community badge for community notifications
    if (notif.type === 'community') {
      badgeStore.getState().incrementCommunity()
    }
    // Increment chat badge for message notifications (real-time counter)
    if (notif.type === 'message' && activeScreen !== 'chats') {
      setTotalUnread((prev) => prev + 1)
    }
    toast(notif.title, {
      description: notif.body,
      duration: 3000,
    })
  }, [badgeStore, activeScreen]))

  // Real-time chat unread badge — Socket.io listener for when user is NOT on chats tab
  // Uses server-based counting (not incremental) for accuracy
  const unreadDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchChatUnreadCount = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/unread-count', { credentials: 'same-origin' })
      const data = await res.json()
      if (data.ok) {
        setTotalUnread(data.count)
      }
    } catch {
      // Silent fail
    }
  }, [])

  // Fetch initial unread count on mount
  useEffect(() => {
    if (!user) return
    // Schedule fetch outside of synchronous effect body
    const id = setTimeout(fetchChatUnreadCount, 0)
    return () => clearTimeout(id)
  }, [user, fetchChatUnreadCount])

  useEffect(() => {
    if (!user) return

    // Bug 15: use env var only, no hardcoded fallback
    const envSocketUrl = process.env.NEXT_PUBLIC_SOCKET_URL
    if (!envSocketUrl) {
      console.warn('NEXT_PUBLIC_SOCKET_URL is not set — chat unread socket disabled')
      return
    }

    // Determine socket URL: if env points to localhost, use gateway proxy instead
    // This ensures socket.io works through the Caddy gateway in sandbox environments
    const isLocalhost = envSocketUrl.includes('localhost') || envSocketUrl.includes('127.0.0.1')
    const socketUrl = isLocalhost ? window.location.origin : envSocketUrl

    const socketOpts: Parameters<typeof io>[1] = {
      path: '/socket.io',
      query: {
        userId: user.id,
        ...(isLocalhost ? { XTransformPort: '3003' } : {}),
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 15000,
    }

    const socket = io(socketUrl, socketOpts)
    chatSocketRef.current = socket

    // Instant optimistic update + debounced server fetch for accuracy
    // User sees the badge IMMEDIATELY, then server count corrects if needed
    // Use a flag to prevent double-increment from chat-updated + new-message firing together
    let lastIncrementTime = 0
    const instantIncrementAndDebouncedFetch = () => {
      if (activeScreenRef.current !== 'chats') {
        // Optimistic: increment immediately for instant feedback
        // Throttle: only increment once per 500ms to avoid double-count from simultaneous events
        const now = Date.now()
        if (now - lastIncrementTime > 500) {
          setTotalUnread((prev) => prev + 1)
          lastIncrementTime = now
        }
        // Then verify with server after 2s (corrects any drift)
        if (unreadDebounceRef.current) clearTimeout(unreadDebounceRef.current)
        unreadDebounceRef.current = setTimeout(() => {
          fetchChatUnreadCount()
        }, 2000)
      }
    }

    socket.on('chat-updated', () => {
      instantIncrementAndDebouncedFetch()
    })

    socket.on('new-message', () => {
      instantIncrementAndDebouncedFetch()
    })

    // When socket reconnects, fetch fresh count
    socket.on('connect', () => {
      if (activeScreenRef.current !== 'chats') {
        fetchChatUnreadCount()
      }
    })

    return () => {
      socket.disconnect()
      chatSocketRef.current = null
      if (unreadDebounceRef.current) clearTimeout(unreadDebounceRef.current)
    }
  }, [user, fetchChatUnreadCount])

  // Refresh unread count when switching away from chats tab
  const prevScreenRef = useRef<Screen>(activeScreen)
  useEffect(() => {
    if (prevScreenRef.current === 'chats' && activeScreen !== 'chats') {
      // Just left chats tab — schedule fetch for badge
      const id = setTimeout(fetchChatUnreadCount, 0)
      return () => clearTimeout(id)
    }
    prevScreenRef.current = activeScreen
  }, [activeScreen, fetchChatUnreadCount])

  // Refresh unread count when tab becomes visible (user was on another browser tab)
  useEffect(() => {
    if (!user) return

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchChatUnreadCount()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [user, fetchChatUnreadCount])

  // Fallback: Poll every 60s for unread count
  useEffect(() => {
    if (!user) return
    const fetchCount = () => {
      fetch('/api/notifications/unread-count', { credentials: 'same-origin' })
        .then((r) => r.json())
        .then((d) => { if (d.ok) setNotifUnread(d.count) })
        .catch(() => {})
    }
    fetchCount()
    const interval = setInterval(fetchCount, 60000)
    return () => clearInterval(interval)
  }, [user])

  // Register service worker for push notifications
  useEffect(() => {
    if (!user || !('serviceWorker' in navigator)) return

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js')
        const existingSub = await registration.pushManager.getSubscription()
        if (existingSub) return

        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (!vapidKey) return

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKey,
        })

        await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            keys: subscription.toJSON().keys,
            deviceInfo: navigator.userAgent.slice(0, 100),
          }),
          credentials: 'same-origin',
        })
      } catch {
        // Push subscription likely denied by user — that's fine
      }
    }
    registerSW()
  }, [user])

  // Heartbeat: keep is_online + in_app_at fresh in database
  useEffect(() => {
    if (!user) return

    const heartbeat = () => {
      fetch('/api/profile/heartbeat', {
        method: 'POST',
        credentials: 'same-origin',
      }).catch(() => {})
    }

    // Send heartbeat immediately and then every 60 seconds
    heartbeat()
    const interval = setInterval(heartbeat, 60000)

    // Mark offline when page is closed/navigated away
    const handleUnload = () => {
      navigator.sendBeacon(
        '/api/profile/online-status',
        JSON.stringify({ userId: user.id, isOnline: false })
      )
    }
    window.addEventListener('beforeunload', handleUnload)

    return () => {
      clearInterval(interval)
      window.removeEventListener('beforeunload', handleUnload)
      // Mark offline on cleanup
      fetch('/api/profile/online-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, isOnline: false }),
        credentials: 'same-origin',
      }).catch(() => {})
    }
  }, [user])

  // Phase 6: Enhanced screenshot detection + INSTANT dark overlay on focus loss
  useEffect(() => {
    if (!user) return

    const handleScreenshot = () => {
      setShowScreenshotFlash(true)
      setTimeout(() => setShowScreenshotFlash(false), 2000)

      // P1.13: Pass chatId if on chats screen so partner gets notified
      const params = new URLSearchParams()
      if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).__gnectActiveChatId) {
        params.set('chatId', String((window as unknown as Record<string, unknown>).__gnectActiveChatId))
      }

      fetch(`/api/notifications/screenshot?${params.toString()}`, {
        method: 'POST',
        credentials: 'same-origin',
      }).then(async (res) => {
        const data = await res.json()
        if (!data.ok && !data.rateLimited) {
          // Don't show error for rate-limited or missing chatId
        }
      }).catch(() => {})
    }

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        handleScreenshot()
      }
    }

    // INSTANT dark on focus loss — uses BOTH visibilitychange AND blur/focus events
    // Zero delay. Zero animation. Privacy is priority.
    const handleVisibility = () => {
      if (document.hidden) {
        setAppBlurred(true)
      } else {
        setAppBlurred(false)
      }
    }

    const handleWindowBlur = () => {
      setAppBlurred(true)
    }

    const handleWindowFocus = () => {
      setAppBlurred(false)
    }

    const handleContextMenu = (e: MouseEvent) => {
      if ((e.target as HTMLElement).tagName === 'IMG') {
        e.preventDefault()
      }
    }

    window.addEventListener('keydown', handleKeydown)
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('blur', handleWindowBlur)
    window.addEventListener('focus', handleWindowFocus)
    document.addEventListener('contextmenu', handleContextMenu)
    return () => {
      window.removeEventListener('keydown', handleKeydown)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('blur', handleWindowBlur)
      window.removeEventListener('focus', handleWindowFocus)
      document.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [user])

  // P1.13: Listen for active chat changes from ChatsScreen
  useEffect(() => {
    if (!user) return

    const handleActiveChatChange = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.chatId) {
        ;(window as unknown as Record<string, unknown>).__gnectActiveChatId = detail.chatId
      } else {
        delete (window as unknown as Record<string, unknown>).__gnectActiveChatId
      }
    }

    window.addEventListener('gnect-active-chat-change', handleActiveChatChange)
    return () => window.removeEventListener('gnect-active-chat-change', handleActiveChatChange)
  }, [user])

  // Open chat with a specific user (from Spotlight Message button)
  const openChatWithUser = useCallback((userId: string) => {
    setChatWithUserId(userId)
    setChatKey((prev) => prev + 1)
    setChatOpenedFromDiscover(true)
    setActiveScreen('chats')
  }, [])

  // Clear chat target after it's been consumed by ChatsScreen
  const clearChatWithUser = useCallback(() => {
    setChatWithUserId(null)
    setChatOpenedFromDiscover(false)
  }, [])

  return (
    <div className="h-dvh flex flex-col bg-background overflow-hidden relative">
      {/* Skip link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:px-4 focus:py-2 focus:rounded-xl focus:bg-primary focus:text-primary-foreground focus:text-sm focus:font-semibold"
      >
        Skip to main content
      </a>

      {/* Client-side error catcher — silent background logger */}
      <ErrorCatcher />

      {/* Broadcast Overlay — handles urgent/info broadcasts */}
      <BroadcastOverlay />

      {/* Top Bar — WhatsApp dark header style */}
      <header className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 gnect-glass border-b border-border/50 z-10 shrink-0">
        {/* Avatar + admin badge */}
        <button
          onClick={() => setShowProfile(true)}
          className="relative h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0 active:scale-95 transition-transform overflow-hidden"
          aria-label="Open profile"
        >
          {dataStore.getState().profilePhotoUrl ? (
            <img
              src={dataStore.getState().profilePhotoUrl!}
              alt="Your profile photo"
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            <GeometricAvatar nickname={user?.nickname || ''} size={40} className="rounded-full" />
          )}
          {/* Online dot */}
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-primary border-2 border-background online-pulse" />
          {/* Admin shield badge */}
          {isAdmin && (
            <span className="absolute -top-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-primary flex items-center justify-center border-2 border-background">
              <Shield className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary-foreground" />
            </span>
          )}
        </button>

        {/* Brand — triple-tap triggers panic (Phase 6) */}
        <div className="flex flex-col items-center" onClick={handleHeaderTripleTap}>
          <span className="text-sm font-bold tracking-widest text-primary">GNECT</span>
          <span className="text-[8px] text-muted-foreground/50 tracking-wide">Private by Design</span>
          {/* 🆓 Free Test Version badge */}
          <span className="text-[8px] font-semibold tracking-wide text-primary/50 uppercase flex items-center gap-0.5"><Gift className="w-2 h-2" /> Free Test Version</span>
          {isAdmin && (
            <span className="text-[9px] font-semibold tracking-wider text-primary/70 uppercase flex items-center gap-0.5"><Shield className="w-2.5 h-2.5" /> Boss Mode</span>
          )}
          {/* Disappear mode indicator */}
          {disappearMode && (
            <span className="text-[8px] font-semibold tracking-wider text-yellow-500 uppercase flex items-center gap-0.5">
              <EyeOff className="w-2.5 h-2.5" /> Disappear
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          {/* Support icon — opens Support screen */}
          <button
            onClick={() => setShowSupport(true)}
            className="relative h-10 w-10 rounded-full flex items-center justify-center active:bg-primary/10 transition-colors"
            aria-label="Contact Support"
          >
            <LifeBuoy className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
          </button>

          {/* Feedback icon — opens Feedback sheet */}
          <button
            onClick={() => setShowFeedbackSheet(true)}
            className="relative h-10 w-10 rounded-full flex items-center justify-center active:bg-primary/10 transition-colors"
            aria-label="Send Feedback"
          >
            <Lightbulb className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
          </button>

          {/* Help button — opens App Guide (with Privacy Guide link inside) */}
          <button
            onClick={() => setShowAppGuide(true)}
            className="relative h-10 w-10 rounded-full flex items-center justify-center active:bg-primary/10 transition-colors"
            aria-label="Help & guides"
          >
            <HelpCircle className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
          </button>

          {/* Notification bell with unread badge */}
          <button
            onClick={() => setShowNotifications(true)}
            className="relative h-10 w-10 rounded-full flex items-center justify-center active:bg-primary/10 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
            {notifUnread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                {notifUnread > 99 ? '99+' : notifUnread}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Content Area — Framer Motion tab transitions */}
      <div id="main-content" className="flex-1 min-h-0 relative overflow-hidden" role="main">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeScreen}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0"
          >
            <ErrorBoundary level="screen">
              {activeScreen === 'discover' ? (
                <DiscoverScreen onOpenChat={openChatWithUser} />
              ) : activeScreen === 'chats' ? (
                <ChatsScreen key={chatKey} openChatWithUserId={chatWithUserId} onChatOpened={clearChatWithUser} onUnreadCountChange={setTotalUnread} />
              ) : activeScreen === 'community' ? (
                <CommunityScreen />
              ) : (
                <MixerScreen onUnreadCountChange={(count) => badgeStore.getState().setUnreadMixer(count)} />
              )}
            </ErrorBoundary>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Tab Bar — WhatsApp dark style */}
      <div className="shrink-0 flex items-center border-t border-border/50 gnect-glass z-10 safe-bottom">
        <button
          onClick={() => setActiveScreen('discover')}
          onTouchStart={prefetchDiscover}
          onMouseEnter={prefetchDiscover}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[52px] transition-colors relative gnect-press ${
            activeScreen === 'discover' ? 'text-primary' : 'text-muted-foreground'
          }`}
          aria-label="Discover screen"
        >
          <motion.div animate={activeScreen === 'discover' ? { scale: [1, 1.15, 1] } : {}} transition={{ duration: 0.3 }} className="relative">
            <Compass className={`w-5 h-5 ${activeScreen === 'discover' ? 'text-primary' : ''}`} />
            {notifUnread > 0 && activeScreen !== 'discover' && (
              <span className="absolute -top-1 -right-1 min-w-[6px] h-[6px] rounded-full bg-primary" />
            )}
          </motion.div>
          <span className={`text-[10px] font-semibold tracking-wide ${activeScreen === 'discover' ? 'text-primary' : ''}`}>
            Discover
          </span>
          {activeScreen === 'discover' && (
            <div className="absolute top-0 left-2 right-2 h-0.5 bg-primary rounded-full gnect-tab-fade" />
          )}
        </button>
        <button
          onClick={() => {
            if (chatOpenedFromDiscover) {
              setChatWithUserId(null)
              setChatOpenedFromDiscover(false)
            }
            setActiveScreen('chats')
            setTotalUnread(0) // Reset unread count when opening chats tab (ChatsScreen will recalculate)
            badgeStore.getState().resetChats() // Bug 6: reset chats badge when tab opened
          }}
          onTouchStart={prefetchChatList}
          onMouseEnter={prefetchChatList}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[52px] transition-colors relative gnect-press ${
            activeScreen === 'chats' ? 'text-primary' : 'text-muted-foreground'
          }`}
          aria-label="Chats screen"
        >
          <div className="relative">
            <motion.div animate={activeScreen === 'chats' ? { scale: [1, 1.15, 1] } : {}} transition={{ duration: 0.3 }}>
              <MessageCircle className={`w-5 h-5 ${activeScreen === 'chats' ? 'text-primary' : ''}`} />
            </motion.div>
            {totalUnread > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </div>
          <span className={`text-[10px] font-semibold tracking-wide ${activeScreen === 'chats' ? 'text-primary' : ''}`}>
            Chats
          </span>
          {activeScreen === 'chats' && (
            <div className="absolute top-0 left-2 right-2 h-0.5 bg-primary rounded-full gnect-tab-fade" />
          )}
        </button>
        <button
          onClick={() => {
            setActiveScreen('community')
            badgeStore.getState().resetCommunity() // Bug 6: reset community badge when tab opened
          }}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[52px] transition-colors relative gnect-press ${
            activeScreen === 'community' ? 'text-primary' : 'text-muted-foreground'
          }`}
          aria-label="Community screen"
        >
          <div className="relative">
            <motion.div animate={activeScreen === 'community' ? { scale: [1, 1.15, 1] } : {}} transition={{ duration: 0.3 }}>
              <Users className={`w-5 h-5 ${activeScreen === 'community' ? 'text-primary' : ''}`} />
            </motion.div>
            {badgeStore((s) => s.unreadCommunity) > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                {badgeStore((s) => s.unreadCommunity) > 99 ? '99+' : badgeStore((s) => s.unreadCommunity)}
              </span>
            )}
          </div>
          <span className={`text-[10px] font-semibold tracking-wide ${activeScreen === 'community' ? 'text-primary' : ''}`}>
            Community
          </span>
          {activeScreen === 'community' && (
            <div className="absolute top-0 left-2 right-2 h-0.5 bg-primary rounded-full gnect-tab-fade" />
          )}
        </button>
        <button
          onClick={() => {
            setActiveScreen('mixer')
            badgeStore.getState().resetMixer()
          }}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[52px] transition-colors relative gnect-press ${
            activeScreen === 'mixer' ? 'text-primary' : 'text-muted-foreground'
          }`}
          aria-label="Mixer screen"
        >
          <div className="relative">
            <motion.div animate={activeScreen === 'mixer' ? { scale: [1, 1.15, 1] } : {}} transition={{ duration: 0.3 }}>
              <Shuffle className={`w-5 h-5 ${activeScreen === 'mixer' ? 'text-primary' : ''}`} />
            </motion.div>
            {badgeStore((s) => s.unreadMixer) > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-[8px] h-[8px] rounded-full bg-primary" />
            )}
          </div>
          <span className={`text-[10px] font-semibold tracking-wide ${activeScreen === 'mixer' ? 'text-primary' : ''}`}>
            Mixer
          </span>
          {activeScreen === 'mixer' && (
            <div className="absolute top-0 left-2 right-2 h-0.5 bg-primary rounded-full gnect-tab-fade" />
          )}
        </button>

      </div>

      {/* Profile Panel */}
      <AnimatePresence>
        {showProfile && <ProfilePanel onClose={() => setShowProfile(false)} />}
      </AnimatePresence>

      {/* Notification Center */}
      <AnimatePresence>
        {showNotifications && <NotificationCenter onClose={() => setShowNotifications(false)} />}
      </AnimatePresence>

      {/* Privacy & Safety Guide */}
      <AnimatePresence>
        {showPrivacyGuide && <PrivacyGuide onClose={() => setShowPrivacyGuide(false)} />}
      </AnimatePresence>

      {/* Whole App Guide — Phase 8 */}
      <AnimatePresence>
        {showAppGuide && <AppGuide onClose={() => setShowAppGuide(false)} />}
      </AnimatePresence>

      {/* Support Screen — Batch 2 Feature */}
      <AnimatePresence>
        {showSupport && <SupportScreen onClose={() => setShowSupport(false)} />}
      </AnimatePresence>

      {/* Feedback Bottom Sheet — Batch 2 Feature */}
      <AnimatePresence>
        {showFeedbackSheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex flex-col bg-background"
          >
            <div className="flex items-center gap-3 px-4 py-3 gnect-glass-elevated border-b border-border/50 shrink-0">
              <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setShowFeedbackSheet(false)}>
                <X className="h-5 w-5" />
              </Button>
              <h2 className="text-lg font-semibold">Feedback & Ideas</h2>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain gnect-scroll px-4 py-4">
              <FeedbackForm />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Screen reader live region for dynamic announcements */}
      <div aria-live="polite" className="sr-only" id="sr-announcements" />

      {/* Phase 6: Screenshot deterrent flash overlay */}
      <AnimatePresence>
        {showScreenshotFlash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100] bg-destructive/90 flex items-center justify-center screenshot-flash"
          >
            <div className="text-center">
              <Ban className="w-16 h-16 text-white" />
              <p className="text-destructive-foreground text-xl font-bold mt-4">Screenshot blocked</p>
              <p className="text-destructive-foreground/70 text-sm mt-1">Content is protected</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PWA Install Banner — floating bottom card when browser supports install */}
      <AnimatePresence>
        {showInstallBanner && user && (
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 60 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-16 left-3 right-3 z-40 rounded-2xl bg-card/95 backdrop-blur-xl border border-primary/20 shadow-lg shadow-primary/5 p-3 flex items-center gap-3 safe-bottom"
          >
            <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
              <Download className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Install GNECT</p>
              <p className="text-[10px] text-muted-foreground">One tap — no app store needed</p>
            </div>
            <Button
              size="sm"
              onClick={async () => {
                const accepted = await promptInstall()
                if (accepted) {
                  toast.success('GNECT installed!', { description: 'Find it on your home screen' })
                }
              }}
              disabled={isLoading}
              className="shrink-0 rounded-xl font-bold"
            >
              {isLoading ? '...' : 'Install'}
            </Button>
            <button
              onClick={() => setDismissedInstall(true)}
              className="shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Dismiss install banner"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase 6: INSTANT black overlay on focus loss — privacy protection */}
      {appBlurred && (
        <div
          className="fixed inset-0 z-[9999] bg-black"
          aria-hidden="true"
        />
      )}
    </div>
  )
}
