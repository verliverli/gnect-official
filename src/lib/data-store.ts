// ============================================
// GNECT DATA STORE (Zustand)
// Cache-first data layer for instant tab switching
// Prefetch on login, cache in Zustand, background refresh
// ============================================

import { create } from "zustand"

// ============================================
// Types — mirror the screen component types
// ============================================

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
}

interface ChatListItem {
  id: string
  otherUser: {
    id: string
    nickname: string
    photo: string | null
    is_online: boolean
  }
  lastMessage: {
    content: string | null
    sent_at: string
    sender_id: string
    media_type: string | null
    is_view_once: boolean
  } | null
  unreadCount: number
  last_message_at: string
}

interface CommunityPost {
  id: string
  content: string
  category: 'SFW' | 'NSFW'
  region_tag: string | null
  upvotes_count: number
  comments_count: number
  is_own: boolean
  has_upvoted: boolean
  created_at: string
  auto_delete_at: string
}

// ============================================
// Store interface
// ============================================

interface DataStore {
  // Nearby users
  nearbyUsers: DiscoverUser[]
  nearbyCursor: string | null
  setNearbyUsers: (users: DiscoverUser[], cursor: string | null) => void

  // All users
  allUsers: DiscoverUser[]
  allCursor: string | null
  setAllUsers: (users: DiscoverUser[], cursor: string | null) => void

  // Chat list
  chatList: ChatListItem[]
  setChatList: (chats: ChatListItem[]) => void

  // Community posts (cached per tab+category)
  communityPosts: CommunityPost[]
  communityCursor: string | null
  setCommunityPosts: (posts: CommunityPost[], cursor: string | null) => void

  // Current user tags
  currentTags: string[]
  setCurrentTags: (tags: string[]) => void

  // Current user profile photo URL (first photo)
  profilePhotoUrl: string | null
  setProfilePhotoUrl: (url: string | null) => void

  // Cached messages per chat (for instant chat reopen)
  chatMessages: Record<string, any[]>
  setChatMessages: (chatId: string, messages: any[]) => void
  getChatMessages: (chatId: string) => any[]

  // Chat preload cache — stores pre-fetched chat data from Spotlight
  // Keyed by target userId (not chatId) because we preload BEFORE the chat is opened
  chatPreload: Record<string, {
    chatId: string
    otherUser: { id: string; nickname: string; photo: string | null; is_online: boolean }
    messages: any[]
    nextCursor: string | null
    selfDestructHours: number | null
    myRating: number | null
    timestamp: number
    error?: string
  }>
  setChatPreload: (userId: string, data: DataStore['chatPreload'][string]) => void
  getChatPreload: (userId: string) => DataStore['chatPreload'][string] | null
  clearChatPreload: (userId: string) => void

  // Last fetch timestamps for stale detection
  lastFetch: Record<string, number>
  setLastFetch: (key: string) => void

  // Check if data is stale (older than threshold ms)
  isStale: (key: string, thresholdMs?: number) => boolean

  // Reset all cached data (on logout)
  resetCache: () => void
}

// Default stale threshold: 2 minutes
const STALE_THRESHOLD_MS = 2 * 60 * 1000

export const useDataStore = create<DataStore>((set, get) => ({
  // Nearby
  nearbyUsers: [],
  nearbyCursor: null,
  setNearbyUsers: (users, cursor) =>
    set({ nearbyUsers: users, nearbyCursor: cursor }),

  // All users
  allUsers: [],
  allCursor: null,
  setAllUsers: (users, cursor) =>
    set({ allUsers: users, allCursor: cursor }),

  // Chats
  chatList: [],
  setChatList: (chats) => set({ chatList: chats }),

  // Community posts
  communityPosts: [],
  communityCursor: null,
  setCommunityPosts: (posts, cursor) =>
    set({ communityPosts: posts, communityCursor: cursor }),

  // Tags
  currentTags: [],
  setCurrentTags: (tags) => set({ currentTags: tags }),

  // Profile photo
  profilePhotoUrl: null,
  setProfilePhotoUrl: (url) => set({ profilePhotoUrl: url }),

  // Chat messages cache
  chatMessages: {},
  setChatMessages: (chatId, messages) =>
    set((state) => ({
      chatMessages: { ...state.chatMessages, [chatId]: messages },
    })),
  getChatMessages: (chatId) => {
    return get().chatMessages[chatId] || []
  },

  // Chat preload cache — Spotlight preloads chat data before user clicks MESSAGE
  chatPreload: {},
  setChatPreload: (userId, data) =>
    set((state) => ({
      chatPreload: { ...state.chatPreload, [userId]: data },
    })),
  getChatPreload: (userId) => {
    const entry = get().chatPreload[userId]
    if (!entry) return null
    // Preload expires after 5 minutes
    if (Date.now() - entry.timestamp > 5 * 60 * 1000) return null
    return entry
  },
  clearChatPreload: (userId) =>
    set((state) => {
      const next = { ...state.chatPreload }
      delete next[userId]
      return { chatPreload: next }
    }),

  // Timestamps
  lastFetch: {},
  setLastFetch: (key) =>
    set((state) => ({
      lastFetch: { ...state.lastFetch, [key]: Date.now() },
    })),

  isStale: (key, thresholdMs = STALE_THRESHOLD_MS) => {
    const lastFetch = get().lastFetch[key]
    if (!lastFetch) return true
    return Date.now() - lastFetch > thresholdMs
  },

  resetCache: () =>
    set({
      nearbyUsers: [],
      nearbyCursor: null,
      allUsers: [],
      allCursor: null,
      chatList: [],
      communityPosts: [],
      communityCursor: null,
      currentTags: [],
      profilePhotoUrl: null,
      chatMessages: {},
      chatPreload: {},
      lastFetch: {},
    }),
}))
