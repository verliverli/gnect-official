'use client'

// ============================================
// GNECT — Telegram Mini App Integration
// Additive only — PWA works exactly as before
// ============================================

import { useEffect, useRef, useCallback } from 'react'

interface TelegramWebApp {
  ready: () => void
  expand: () => void
  close: () => void
  MainButton: {
    text: string
    show: () => void
    hide: () => void
    onClick: (fn: () => void) => void
    setParams: (params: { text?: string; color?: string }) => void
  }
  BackButton: {
    show: () => void
    hide: () => void
    onClick: (fn: () => void) => void
  }
  themeParams: {
    bg_color?: string
    text_color?: string
    hint_color?: string
    button_color?: string
    button_text_color?: string
    secondary_bg_color?: string
  }
  colorScheme: 'light' | 'dark'
  isExpanded: boolean
  enableClosingConfirmation: () => void
  disableVerticalSwipes: () => void
  initData: string
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void
    selectionChanged: () => void
  }
  initDataUnsafe?: {
    user?: {
      id: number
      first_name: string
      username?: string
    }
  }
  version: string
  platform: string
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp
    }
  }
}

export function useTelegram() {
  const tgRef = useRef<TelegramWebApp | null>(null)
  const isTelegramRef = useRef(false)

  useEffect(() => {
    const webapp = window.Telegram?.WebApp
    if (webapp) {
      tgRef.current = webapp
      isTelegramRef.current = true

      // Tell Telegram we're ready
      webapp.ready()

      // Expand to full height
      webapp.expand()

      // Enable closing confirmation (prevent accidental back-swipe)
      webapp.enableClosingConfirmation()

      // Disable vertical swipes to close MiniApp
      // Users can ONLY close using the X button in the header
      // This prevents pull-to-close from interfering with pull-to-refresh inside the app
      if (typeof webapp.disableVerticalSwipes === 'function') {
        webapp.disableVerticalSwipes()
      }
    }
  }, [])

  const hapticLight = useCallback(() => {
    tgRef.current?.HapticFeedback.impactOccurred('light')
  }, [])

  const hapticMedium = useCallback(() => {
    tgRef.current?.HapticFeedback.impactOccurred('medium')
  }, [])

  const hapticSuccess = useCallback(() => {
    tgRef.current?.HapticFeedback.notificationOccurred('success')
  }, [])

  const hapticError = useCallback(() => {
    tgRef.current?.HapticFeedback.notificationOccurred('error')
  }, [])

  return {
    isTelegram: isTelegramRef,
    tg: tgRef,
    hapticLight,
    hapticMedium,
    hapticSuccess,
    hapticError,
  }
}
