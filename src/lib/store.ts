// ============================================
// GNECT AUTH STORE (Zustand)
// Manages client-side auth state
// ============================================

import { create } from "zustand"

export interface GnectUser {
  id: string
  nickname: string
  age: number
  country: string
  region: string
  bio: string
  height: number | null
  weight: number | null
  body_type: string
  role: string
  role_last_changed: string | null
  region_last_changed: string | null
  availability: string
  discretion_mode: boolean
  secret_phrase: string | null
  street: string | null
  cucumber_size: number | null
  show_cucumber: boolean
  not_today: boolean
  not_today_expires: string | null
  status_text: string | null
  status_gradient: string | null
  status_expires_at: string | null
  status_views: number
  notification_settings: string
  is_premium: boolean
  is_premium_free: boolean
  is_early_adopter: boolean
  is_admin: boolean
  is_banned: boolean
  is_banned_posting: boolean
  is_online: boolean
  last_seen: string
  chats_this_week: number
  chats_week_reset: string
  not_today_count: number
  not_today_reset: string
  created_at: string
}

type AuthState = {
  user: GnectUser | null
  isLoading: boolean
  isAuthenticated: boolean
  showAgeGate: boolean

  // Phase 6: Disappear Mode — client-side only
  disappearMode: boolean
  setDisappearMode: (v: boolean) => void


  setUser: (user: GnectUser | null) => void
  setLoading: (loading: boolean) => void
  logout: () => void
  dismissAgeGate: () => void
  hasPremium: () => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  showAgeGate: true,

  // Phase 6: Disappear Mode
  disappearMode: false,
  setDisappearMode: (v) => set({ disappearMode: v }),


  setUser: (user) =>
    set((state) => ({
      user,
      isAuthenticated: !!user,
      isLoading: false,
    })),

  setLoading: (isLoading) => set({ isLoading }),

  logout: () =>
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    }),

  dismissAgeGate: () => set({ showAgeGate: false }),

  hasPremium: () => {
    const { user } = get()
    if (!user) return false
    return user.is_premium || user.is_premium_free || user.is_early_adopter
  },
}))

// ============================================
// GNECT BADGE STORE (Zustand) — Bug 6
// Real-time badge counts for bottom nav tabs
// ============================================

type BadgeState = {
  unreadChats: number
  unreadCommunity: number
  setUnreadChats: (count: number) => void
  setUnreadCommunity: (count: number) => void
  incrementChats: () => void
  decrementChats: () => void
  incrementCommunity: () => void
  decrementCommunity: () => void
  resetChats: () => void
  resetCommunity: () => void
}

export const useBadgeStore = create<BadgeState>((set) => ({
  unreadChats: 0,
  unreadCommunity: 0,
  setUnreadChats: (count) => set({ unreadChats: count }),
  setUnreadCommunity: (count) => set({ unreadCommunity: count }),
  incrementChats: () => set((s) => ({ unreadChats: s.unreadChats + 1 })),
  decrementChats: () => set((s) => ({ unreadChats: Math.max(0, s.unreadChats - 1) })),
  incrementCommunity: () => set((s) => ({ unreadCommunity: s.unreadCommunity + 1 })),
  decrementCommunity: () => set((s) => ({ unreadCommunity: Math.max(0, s.unreadCommunity - 1) })),
  resetChats: () => set({ unreadChats: 0 }),
  resetCommunity: () => set({ unreadCommunity: 0 }),
}))
