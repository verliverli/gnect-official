'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { AgeGate } from '@/components/auth/age-gate'
import { SeriousnessGate } from '@/components/auth/seriousness-gate'
import { RegisterForm } from '@/components/auth/register-form'
import { LoginForm } from '@/components/auth/login-form'
import { AppShell } from '@/components/app-shell'
import { ErrorBoundary } from '@/components/error-boundary'

type Screen = 'age-gate' | 'seriousness' | 'register' | 'login' | 'app'

const GNECT_TOKEN_KEY = 'gnect_token'

// Helper: get token from localStorage (for Telegram Mini App)
function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(GNECT_TOKEN_KEY)
}

// Helper: save token to localStorage (for Telegram Mini App)
export function storeToken(token: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(GNECT_TOKEN_KEY, token)
}

// Helper: clear token from localStorage
export function clearStoredToken() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(GNECT_TOKEN_KEY)
}

export default function Home() {
  const { isAuthenticated, setUser, isLoading, setLoading } = useAuthStore()
  const [screen, setScreen] = useState<Screen>('age-gate')

  // Check existing session on mount
  // Strategy: Try cookie first (normal browser). If that fails, try
  // Authorization header with localStorage token (Telegram Mini App).
  useEffect(() => {
    const checkSession = async () => {
      try {
        // Build headers — include Authorization if we have a stored token
        const headers: Record<string, string> = {}
        const storedToken = getStoredToken()
        if (storedToken) {
          headers['Authorization'] = `Bearer ${storedToken}`
        }

        const res = await fetch('/api/auth/me', {
          credentials: 'same-origin',
          headers,
        })
        const data = await res.json()
        if (data.ok && data.user) {
          setUser(data.user)
        } else {
          // Auth failed — clear stale token from localStorage
          clearStoredToken()
        }
      } catch {
        // No session
      } finally {
        setLoading(false)
      }
    }
    checkSession()
  }, [setUser, setLoading])

  // Derive screen from auth state
  useEffect(() => {
    if (isAuthenticated) {
      setScreen('app')
    } else {
      const ageConfirmed = typeof window !== 'undefined' && localStorage.getItem('gnect_age_confirmed')
      const seriousnessConfirmed = typeof window !== 'undefined' && localStorage.getItem('gnect_seriousness_confirmed')
      if (seriousnessConfirmed === 'true') {
        setScreen('register')
      } else if (ageConfirmed === 'true') {
        setScreen('seriousness')
      } else {
        setScreen('age-gate')
      }
    }
  }, [isAuthenticated])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" role="status" aria-label="Loading GNECT">
        <div className="text-primary font-bold text-2xl tracking-tight animate-pulse">GNECT</div>
      </div>
    )
  }

  if (screen === 'app') {
    return (
      <ErrorBoundary>
        <AppShell />
      </ErrorBoundary>
    )
  }

  if (screen === 'age-gate') {
    return (
      <AgeGate
        onConfirm={() => {
          localStorage.setItem('gnect_age_confirmed', 'true')
          setScreen('seriousness')
        }}
      />
    )
  }

  if (screen === 'seriousness') {
    return (
      <SeriousnessGate
        onConfirm={() => {
          localStorage.setItem('gnect_seriousness_confirmed', 'true')
          setScreen('register')
        }}
      />
    )
  }

  if (screen === 'login') {
    return <LoginForm onSwitchToRegister={() => setScreen('register')} />
  }

  return <RegisterForm onSwitchToLogin={() => setScreen('login')} />
}
