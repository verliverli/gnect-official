'use client'

import { useState, useEffect, useCallback } from 'react'
import { Flame, MessageCircle, Loader2, X } from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'

// ============================================
// Types
// ============================================

interface DailyDare {
  id: string
  text: string
  category: string
}

interface HotTake {
  id: string
  question: string
  option_a: string
  option_b: string
  votes_a: number
  votes_b: number
  my_vote: string | null
}

interface StreakData {
  current: number
  longest: number
}

interface PulseData {
  newUsersToday: number
  onlineInCountry: number
  country: string
}

interface DailyData {
  dare: DailyDare | null
  hotTake: HotTake | null
  streak: StreakData
  pulse: PulseData
}

// ============================================
// DailyEngagement Component
// ============================================

export function DailyEngagement() {
  const { user: currentUser } = useAuthStore()

  const [data, setData] = useState<DailyData | null>(null)
  const [loading, setLoading] = useState(true)

  // Local hot take state for optimistic voting
  const [hotTakeVoted, setHotTakeVoted] = useState<string | null>(null)

  // Dismiss state — hide until next day
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('dailyEngagementDismissed')
      if (stored) {
        const storedDate = new Date(stored)
        const today = new Date()
        if (
          storedDate.getFullYear() === today.getFullYear() &&
          storedDate.getMonth() === today.getMonth() &&
          storedDate.getDate() === today.getDate()
        ) {
          setDismissed(true)
        } else {
          localStorage.removeItem('dailyEngagementDismissed')
        }
      }
    } catch {}
  }, [])

  const handleDismiss = useCallback(() => {
    setDismissed(true)
    try {
      localStorage.setItem('dailyEngagementDismissed', new Date().toISOString())
    } catch {}
  }, [])

  // ========================================
  // Fetch daily engagement data
  // ========================================
  useEffect(() => {
    if (!currentUser) return

    const fetchDaily = async () => {
      try {
        const res = await fetch('/api/daily', { credentials: 'same-origin' })
        const d = await res.json()
        if (d.ok) {
          setData(d.data)
          setHotTakeVoted(d.data.hotTake?.my_vote || null)
        }
      } catch {
        // Silent — widget shouldn't block the page
      } finally {
        setLoading(false)
      }
    }

    fetchDaily()
  }, [currentUser])

  // ========================================
  // Hot Take vote handler
  // ========================================
  const handleVote = useCallback(async (choice: 'a' | 'b') => {
    if (!data?.hotTake || hotTakeVoted) return

    const hotTakeId = data.hotTake.id

    // Optimistic update
    setHotTakeVoted(choice)
    setData((prev) => {
      if (!prev?.hotTake) return prev
      return {
        ...prev,
        hotTake: {
          ...prev.hotTake,
          my_vote: choice,
          votes_a: prev.hotTake.votes_a + (choice === 'a' ? 1 : 0),
          votes_b: prev.hotTake.votes_b + (choice === 'b' ? 1 : 0),
        },
      }
    })

    try {
      const res = await fetch('/api/daily/hot-take/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hot_take_id: hotTakeId, choice }),
        credentials: 'same-origin',
      })
      const d = await res.json()
      if (!d.ok) {
        toast.error(d.error || 'Vote failed')
        // Revert
        setHotTakeVoted(null)
        setData((prev) => {
          if (!prev?.hotTake) return prev
          return {
            ...prev,
            hotTake: {
              ...prev.hotTake,
              my_vote: null,
              votes_a: prev.hotTake.votes_a - (choice === 'a' ? 1 : 0),
              votes_b: prev.hotTake.votes_b - (choice === 'b' ? 1 : 0),
            },
          }
        })
      }
    } catch {
      toast.error('Network error')
      setHotTakeVoted(null)
    }
  }, [data?.hotTake, hotTakeVoted])

  // ========================================
  // Dismissed — hide until next day
  if (dismissed) return null

  // Loading state
  // ========================================
  if (loading) {
    return (
      <div className="flex gap-2.5 px-4 py-1.5 overflow-x-auto gnect-scroll shrink-0">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-3 min-w-[150px] animate-pulse">
            <div className="h-3 bg-muted/20 rounded w-16 mb-2" />
            <div className="h-4 bg-muted/20 rounded w-full mb-1" />
            <div className="h-4 bg-muted/20 rounded w-3/4" />
          </div>
        ))}
      </div>
    )
  }

  if (!data) return null

  const { dare, hotTake, streak, pulse } = data

  // If there's nothing to show, don't render
  if (!dare && !hotTake && streak.current <= 1 && pulse.onlineInCountry <= 0) return null

  // ========================================
  // Render
  // ========================================
  return (
    <div className="shrink-0 border-b border-border/30 bg-background/95">
      {/* Header bar with title + dismiss X */}
      <div className="flex items-center justify-between px-4 pt-2 pb-1">
        <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
          Today&apos;s Picks
        </span>
        <button
          onClick={handleDismiss}
          className="w-6 h-6 flex items-center justify-center rounded-full bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors active:scale-90"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Scrollable cards row */}
      <div
        className="flex gap-2.5 px-4 pb-2.5 overflow-x-auto gnect-scroll snap-x snap-mandatory"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* 🔥 Daily Dare Card */}
        {dare && (
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3 min-w-[180px] max-w-[220px] snap-start shrink-0">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-sm">🔥</span>
              <span className="text-[10px] font-semibold text-green-500/80 uppercase tracking-wider">
                Daily Dare
              </span>
            </div>
            <p className="text-xs text-foreground leading-relaxed line-clamp-3">
              {dare.text}
            </p>
            <div className="mt-2">
              <span className="text-[10px] font-bold text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">
                Let&apos;s Go 🔥
              </span>
            </div>
          </div>
        )}

        {/* 💬 Hot Take Card */}
        {hotTake && (
          <div className="rounded-xl border border-border bg-card p-3 min-w-[200px] max-w-[260px] snap-start shrink-0">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-sm">💬</span>
              <span className="text-[10px] font-semibold text-foreground/60 uppercase tracking-wider">
                Hot Take
              </span>
            </div>
            <p className="text-xs text-foreground leading-relaxed mb-2 line-clamp-2">
              {hotTake.question}
            </p>

            {hotTakeVoted ? (
              // Show results after voting
              <div className="space-y-1.5">
                <VoteResultBar
                  label={hotTake.option_a}
                  votes={hotTake.votes_a}
                  total={hotTake.votes_a + hotTake.votes_b}
                  isMyVote={hotTakeVoted === 'a'}
                />
                <VoteResultBar
                  label={hotTake.option_b}
                  votes={hotTake.votes_b}
                  total={hotTake.votes_a + hotTake.votes_b}
                  isMyVote={hotTakeVoted === 'b'}
                />
              </div>
            ) : (
              // Show vote buttons
              <div className="flex gap-2">
                <button
                  onClick={() => handleVote('a')}
                  className="flex-1 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-xs font-medium text-green-500 transition-all active:scale-95 hover:bg-green-500/15"
                >
                  {hotTake.option_a.length > 15 ? hotTake.option_a.slice(0, 15) + '…' : hotTake.option_a}
                </button>
                <button
                  onClick={() => handleVote('b')}
                  className="flex-1 py-1.5 rounded-lg bg-card border border-border text-xs font-medium text-foreground transition-all active:scale-95 hover:bg-accent"
                >
                  {hotTake.option_b.length > 15 ? hotTake.option_b.slice(0, 15) + '…' : hotTake.option_b}
                </button>
              </div>
            )}
          </div>
        )}

        {/* 🔥 Streak + Pulse Card */}
        <div className="rounded-xl border border-border bg-card p-3 min-w-[145px] max-w-[180px] snap-start shrink-0">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-sm">🔥</span>
            <span className="text-[10px] font-semibold text-foreground/60 uppercase tracking-wider">
              Streak
            </span>
          </div>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-2xl font-bold text-green-500">
              {streak.current}
            </span>
            <span className="text-[10px] text-muted-foreground">
              day{streak.current !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Pulse info */}
          <div className="flex flex-col gap-0.5 pt-1 border-t border-border/30">
            {pulse.onlineInCountry > 0 && (
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] text-muted-foreground">
                  {pulse.onlineInCountry} online
                </span>
              </div>
            )}
            {pulse.newUsersToday > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-[10px]">✨</span>
                <span className="text-[10px] text-muted-foreground">
                  {pulse.newUsersToday} new today
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// Vote Result Bar
// ============================================

function VoteResultBar({
  label,
  votes,
  total,
  isMyVote,
}: {
  label: string
  votes: number
  total: number
  isMyVote: boolean
}) {
  const pct = total > 0 ? Math.round((votes / total) * 100) : 0

  return (
    <div className="relative rounded-lg overflow-hidden border border-border/50">
      {/* Background fill */}
      <div
        className={`absolute inset-y-0 left-0 transition-all duration-500 ${
          isMyVote ? 'bg-green-500/20' : 'bg-muted/10'
        }`}
        style={{ width: `${pct}%` }}
      />
      <div className="relative flex items-center justify-between px-2.5 py-1.5">
        <span className={`text-[11px] font-medium truncate ${isMyVote ? 'text-green-500' : 'text-foreground'}`}>
          {isMyVote && '✓ '}{label.length > 12 ? label.slice(0, 12) + '…' : label}
        </span>
        <span className={`text-[10px] font-semibold shrink-0 ml-1 ${isMyVote ? 'text-green-500' : 'text-muted-foreground'}`}>
          {pct}%
        </span>
      </div>
    </div>
  )
}
