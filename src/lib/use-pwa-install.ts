'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// BeforeInstallPromptEvent — not in standard TS types
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Hook to capture the browser's `beforeinstallprompt` event
 * and provide a one-click install function.
 *
 * Returns:
 * - canInstall: true if the browser supports PWA install
 * - isInstalled: true if already running as standalone PWA
 * - promptInstall: call to trigger the native install prompt
 * - isLoading: true while the prompt is being shown
 */
export function usePwaInstall() {
  const [canInstall, setCanInstall] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null)

  // Check if already installed (standalone mode)
  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://')

    if (standalone) {
      setIsInstalled(true)
      return
    }

    // Also check if app was installed via appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setCanInstall(false)
    }

    window.addEventListener('appinstalled', handleAppInstalled)
    return () => window.removeEventListener('appinstalled', handleAppInstalled)
  }, [])

  // Capture beforeinstallprompt event
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      promptRef.current = e as BeforeInstallPromptEvent
      setCanInstall(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const promptInstall = useCallback(async () => {
    if (!promptRef.current) return false

    setIsLoading(true)
    try {
      await promptRef.current.prompt()
      const { outcome } = await promptRef.current.userChoice

      if (outcome === 'accepted') {
        setIsInstalled(true)
        setCanInstall(false)
      }

      promptRef.current = null
      return outcome === 'accepted'
    } catch {
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { canInstall, isInstalled, promptInstall, isLoading }
}
