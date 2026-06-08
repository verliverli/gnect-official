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
      currentTags: [],
      profilePhotoUrl: null,
      chatMessages: {},
      lastFetch: {},
    }),
}))
