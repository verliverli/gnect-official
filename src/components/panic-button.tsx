'use client'

import { useEffect, useCallback, useRef } from 'react'
import { SAFE_PAGES } from '@/lib/constants'

// ============================================
// PANIC BUTTON — Phase 6 Privacy Feature
// Only triple-tap on GNECT header triggers panic
// Floating button REMOVED per Batch 3 spec
// ============================================

// ============================================
// TRIPLE-TAP HEADER HOOK
// Attaches triple-tap detection to the GNECT header text
// ============================================

export function usePanicTripleTap() {
  const tapRef = useRef<{ count: number; lastTap: number }>({ count: 0, lastTap: 0 })

  const handleHeaderTap = useCallback(() => {
    const now = Date.now()
    if (now - tapRef.current.lastTap < 500) {
      tapRef.current.count++
      if (tapRef.current.count >= 3) {
        tapRef.current.count = 0
        // Trigger panic via global function
        if (typeof window !== 'undefined' && (window as any).__gnectPanic) {
          ;(window as any).__gnectPanic()
        }
      }
    } else {
      tapRef.current.count = 1
    }
    tapRef.current.lastTap = now
  }, [])

  return handleHeaderTap
}

// ============================================
// SAFE PAGE PICKER — For Profile Panel > Privacy
// ============================================

export function SafePagePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Panic Button Safe Page</p>
      <p className="text-xs text-muted-foreground">Where to redirect when panic button is pressed</p>
      <div className="flex flex-wrap gap-2">
        {SAFE_PAGES.map((page) => (
          <button
            key={page.id}
            onClick={() => onChange(page.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              value === page.id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            {page.name}
          </button>
        ))}
      </div>
    </div>
  )
}
