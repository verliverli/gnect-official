'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, RefreshCw, Plus, Loader2, Flag, Shield } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/lib/store'
import { dedupFetch } from '@/lib/app-cache'
import { CONFESSION_CATEGORIES, CONFESSION_REACTIONS, CONFESSION_AUTO_DELETE_DAYS, type ConfessionCategory } from '@/lib/constants'
import { toast } from 'sonner'

// ============================================
// Types
// ============================================

interface Confession {
  id: string
  anonymous_alias: string
  content: string
  category: string
  country: string
  reactions_summary: string
  total_reactions: number
  is_pinned: boolean
  auto_delete_at: string
  created_at: string
  my_reaction: string | null
}

type CategoryFilter = 'all' | ConfessionCategory

// ============================================
// Time ago helper
// ============================================

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// ============================================
// Parse reactions_summary JSON
// ============================================

function parseReactionsSummary(raw: string): Record<string, number> {
  try {
    return JSON.parse(raw || '{}')
  } catch {
    return {}
  }
}

// ============================================
// ConfessionsScreen Component
// ============================================

export function ConfessionsScreen() {
  const { user: currentUser } = useAuthStore()

  // Category filter
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')

  // Posts state
  const [confessions, setConfessions] = useState<Confession[]>([])
  const [loading, setLoading] = useState(true)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Create confession modal
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Report modal
  const [reportConfessionId, setReportConfessionId] = useState<string | null>(null)

  // Pull-to-refresh state
  const [pullStartY, setPullStartY] = useState<number | null>(null)
  const [pullDistance, setPullDistance] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Request ID ref to prevent stale responses
  const requestIdRef = useRef(0)

  // ========================================
  // Fetch confessions
  // ========================================
  const fetchConfessions = useCallback(async (append = false, silent = false) => {
    if (!currentUser) return

    const requestId = ++requestIdRef.current

    const hasData = confessions.length > 0
    if (!append && !silent && !hasData) setLoading(true)
    else if (append) setLoadingMore(true)
    else if (!silent && !hasData) setRefreshing(true)

    const currentCursor = append ? cursor : null

    const filterKey = categoryFilter === 'all' ? 'all' : categoryFilter
    const paramsKey = append && currentCursor ? `confessions-${currentCursor}-${filterKey}` : `confessions-${filterKey}`

    try {
      await dedupFetch(paramsKey, async () => {
        const params = new URLSearchParams()
        params.set('limit', '20')
        if (categoryFilter !== 'all') params.set('category', categoryFilter)
        if (append && currentCursor) params.set('cursor', currentCursor)

        const res = await fetch(`/api/confessions?${params.toString()}`, { credentials: 'same-origin' })

        if (requestId !== requestIdRef.current) return

        if (!res.ok) {
          if (!append) setConfessions([])
          if (!silent) toast.error('Failed to load confessions')
          return
        }

        const data = await res.json()
        if (requestId !== requestIdRef.current) return

        if (data.ok) {
          const newConfessions = data.data || []
          if (append) {
            setConfessions((prev) => [...prev, ...newConfessions])
          } else {
            setConfessions(newConfessions)
          }
          setCursor(data.nextCursor || null)
          setHasMore(!!data.nextCursor)
        } else {
          if (!append) setConfessions([])
          if (!silent) toast.error(data.error || 'Failed to load confessions')
        }
      })
    } catch {
      if (requestId !== requestIdRef.current) return
      if (!append) setConfessions([])
      if (!silent) toast.error('Network error')
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false)
        setRefreshing(false)
        setLoadingMore(false)
      }
    }
  }, [currentUser, categoryFilter, cursor])

  // ========================================
  // Initial fetch & refetch on category change
  // ========================================
  useEffect(() => {
    if (currentUser) {
      setCursor(null)
      setConfessions([])
      setLoading(true)
      fetchConfessions()
    }
  }, [currentUser, categoryFilter])

  // ========================================
  // Reaction toggle handler
  // ========================================
  const handleReaction = useCallback(async (confessionId: string, emoji: string, currentReaction: string | null) => {
    // Optimistic update
    setConfessions((prev) =>
      prev.map((c) => {
        if (c.id !== confessionId) return c
        const summary = parseReactionsSummary(c.reactions_summary)

        // If same emoji — remove reaction (toggle off)
        if (currentReaction === emoji) {
          summary[emoji] = Math.max(0, (summary[emoji] || 0) - 1)
          if (summary[emoji] === 0) delete summary[emoji]
          return {
            ...c,
            my_reaction: null,
            total_reactions: Math.max(0, c.total_reactions - 1),
            reactions_summary: JSON.stringify(summary),
          }
        }

        // If different reaction — remove old, add new
        if (currentReaction) {
          summary[currentReaction] = Math.max(0, (summary[currentReaction] || 0) - 1)
          if (summary[currentReaction] === 0) delete summary[currentReaction]
        } else {
          // New reaction — increment total
          c = { ...c, total_reactions: c.total_reactions + 1 }
        }
        summary[emoji] = (summary[emoji] || 0) + 1
        return {
          ...c,
          my_reaction: emoji,
          reactions_summary: JSON.stringify(summary),
        }
      })
    )

    try {
      const res = await fetch(`/api/confessions/${confessionId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (!data.ok) {
        // Revert optimistic — refetch
        fetchConfessions(false, true)
      }
    } catch {
      fetchConfessions(false, true)
    }
  }, [fetchConfessions])

  // ========================================
  // Report handler
  // ========================================
  const handleReport = useCallback(async (confessionId: string, reason: string) => {
    try {
      const res = await fetch(`/api/confessions/${confessionId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Report submitted')
      } else {
        toast.error(data.error || 'Failed to report')
      }
    } catch {
      toast.error('Network error')
    }
    setReportConfessionId(null)
  }, [])

  // ========================================
  // Infinite scroll
  // ========================================
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    if (scrollHeight - scrollTop - clientHeight < 200) {
      if (hasMore && !loadingMore && !loading && !refreshing) {
        fetchConfessions(true)
      }
    }
  }, [hasMore, loadingMore, loading, refreshing, fetchConfessions])

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
      setCursor(null)
      fetchConfessions()
    }
    setPullStartY(null)
    setPullDistance(0)
  }

  // ========================================
  // Category config with "All" tab
  // ========================================
  const categoryTabs = useMemo(() => [
    { id: 'all' as CategoryFilter, label: 'All', emoji: '🎭' },
    ...CONFESSION_CATEGORIES.map((c) => ({ id: c.id as CategoryFilter, label: c.label, emoji: c.emoji })),
  ], [])

  // ========================================
  // Loading skeleton
  // ========================================
  const renderSkeletons = () => (
    <div className="px-4 space-y-2.5">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-2xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Skeleton className="h-4 w-20 rounded-full" />
            <Skeleton className="h-4 w-14 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full mb-1" />
          <Skeleton className="h-4 w-3/4 mb-1" />
          <Skeleton className="h-4 w-1/2 mb-3" />
          <div className="flex items-center gap-3 pt-2 border-t border-border/30">
            <Skeleton className="h-6 w-10 rounded-full" />
            <Skeleton className="h-6 w-10 rounded-full" />
            <Skeleton className="h-6 w-10 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )

  // ========================================
  // Empty state
  // ========================================
  const renderEmpty = () => (
    <div className="flex-1 flex flex-col items-center justify-center px-6 gap-3 py-12">
      <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
        <MessageSquare className="w-7 h-7 text-green-500" />
      </div>
      <h3 className="text-base font-semibold text-foreground">No confessions yet</h3>
      <p className="text-xs text-muted-foreground text-center max-w-xs">
        Be the first to share anonymously 🔥
      </p>
    </div>
  )

  // ========================================
  // Get category emoji for a confession
  // ========================================
  const getCategoryEmoji = (categoryId: string): string => {
    const cat = CONFESSION_CATEGORIES.find((c) => c.id === categoryId)
    return cat?.emoji || '🎭'
  }

  // ========================================
  // Render
  // ========================================
  return (
    <div className="h-full flex flex-col relative">
      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/30 bg-background/95 shrink-0 overflow-x-auto gnect-scroll">
        {categoryTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setCategoryFilter(tab.id)}
            aria-pressed={categoryFilter === tab.id}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border whitespace-nowrap shrink-0 ${
              categoryFilter === tab.id
                ? 'bg-green-500/10 text-green-500 border-green-500/30'
                : 'bg-card text-muted-foreground border-border hover:bg-card/80'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Pull-to-refresh indicator */}
      {pullDistance > 0 && (
        <div
          className="flex items-center justify-center py-1 transition-all shrink-0"
          style={{ height: pullDistance }}
        >
          <RefreshCw
            className={`w-4 h-4 text-green-500 ${pullDistance > 50 ? 'animate-spin' : ''}`}
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
        <div key={categoryFilter} className="gnect-tab-fade">
          {loading ? (
            renderSkeletons()
          ) : confessions.length === 0 ? (
            renderEmpty()
          ) : (
            <div className="px-4 space-y-2.5 py-2 pb-24">
              {confessions.map((confession) => {
                const summary = parseReactionsSummary(confession.reactions_summary)
                return (
                  <ConfessionCard
                    key={confession.id}
                    confession={confession}
                    summary={summary}
                    onReact={handleReaction}
                    onReport={(id) => setReportConfessionId(id)}
                    categoryEmoji={getCategoryEmoji(confession.category)}
                  />
                )
              })}

              {loadingMore && (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-green-500" />
                </div>
              )}

              {!hasMore && confessions.length > 0 && (
                <div className="text-center py-6 text-xs text-muted-foreground/50">
                  That&apos;s all for now 🤫
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* FAB — Create Confession */}
      <button
        onClick={() => setShowCreateModal(true)}
        className="absolute bottom-4 right-4 h-14 w-14 rounded-full bg-green-500 text-black gnect-fab flex items-center justify-center active:scale-90 transition-transform z-10"
        aria-label="Create new confession"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Create Confession Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateConfessionModal
            onClose={() => setShowCreateModal(false)}
            onCreated={() => {
              setShowCreateModal(false)
              setCursor(null)
              fetchConfessions()
            }}
          />
        )}
      </AnimatePresence>

      {/* Report Modal */}
      <AnimatePresence>
        {reportConfessionId && (
          <ReportModal
            onClose={() => setReportConfessionId(null)}
            onReport={(reason) => handleReport(reportConfessionId, reason)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================
// Confession Card Component
// ============================================

function ConfessionCard({
  confession,
  summary,
  onReact,
  onReport,
  categoryEmoji,
}: {
  confession: Confession
  summary: Record<string, number>
  onReact: (id: string, emoji: string, currentReaction: string | null) => void
  onReport: (id: string) => void
  categoryEmoji: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      {/* Header: Alias + Category + Time + Report */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-green-500 truncate">
            {confession.anonymous_alias}
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-500/80 border border-green-500/20 whitespace-nowrap">
            {categoryEmoji} {confession.category.replace('_', ' ')}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-muted-foreground/60">
            {timeAgo(confession.created_at)}
          </span>
          <button
            onClick={() => onReport(confession.id)}
            className="text-muted-foreground/30 hover:text-muted-foreground/70 transition-colors"
            aria-label="Report confession"
          >
            <Flag className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Pinned badge */}
      {confession.is_pinned && (
        <div className="text-[10px] font-semibold text-yellow-500 mb-1.5 flex items-center gap-1">
          📌 Pinned
        </div>
      )}

      {/* Content */}
      <p className="text-sm text-foreground leading-relaxed mb-3 whitespace-pre-line break-words">
        {confession.content}
      </p>

      {/* Reaction Bar */}
      <div className="flex items-center gap-1.5 pt-2 border-t border-border/30 flex-wrap">
        {CONFESSION_REACTIONS.map((emoji) => {
          const count = summary[emoji] || 0
          const isActive = confession.my_reaction === emoji
          return (
            <button
              key={emoji}
              onClick={() => onReact(confession.id, emoji, confession.my_reaction)}
              className={`flex items-center gap-0.5 px-2 py-1 rounded-full text-xs transition-all border ${
                isActive
                  ? 'bg-green-500/15 border-green-500/30 scale-105'
                  : 'bg-background/50 border-transparent hover:bg-card hover:border-border'
              }`}
              aria-label={`React with ${emoji}`}
              aria-pressed={isActive}
            >
              <span className="text-sm">{emoji}</span>
              {count > 0 && (
                <span className={`text-[10px] font-medium ${isActive ? 'text-green-500' : 'text-muted-foreground/70'}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}

        {/* Total reactions */}
        {confession.total_reactions > 0 && (
          <span className="text-[10px] text-muted-foreground/40 ml-auto">
            {confession.total_reactions} reaction{confession.total_reactions !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  )
}

// ============================================
// Create Confession Modal
// ============================================

function CreateConfessionModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [category, setCategory] = useState<ConfessionCategory | null>(null)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!category) {
      toast.error('Pick a category first')
      return
    }
    if (!content.trim()) {
      toast.error('Write your confession')
      return
    }
    if (content.length > 1000) {
      toast.error('Too long — max 1000 characters')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/confessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), category }),
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Confession posted anonymously 🎭')
        onCreated()
      } else {
        toast.error(data.error || 'Failed to post')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-lg bg-card border-t border-border rounded-t-2xl max-h-[90vh] overflow-y-auto gnect-scroll"
      >
        <div className="p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">🎭 Post Confession</h2>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground text-xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Category Selector */}
          <div className="mb-4">
            <label className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2 block">
              Category
            </label>
            <div className="flex flex-wrap gap-2">
              {CONFESSION_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id as ConfessionCategory)}
                  className={`px-3 py-2 rounded-xl text-sm font-medium transition-all border ${
                    category === cat.id
                      ? 'bg-green-500/10 text-green-500 border-green-500/30'
                      : 'bg-background text-muted-foreground border-border hover:border-green-500/20'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Text Area */}
          <div className="mb-4">
            <label className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2 block">
              Your confession
            </label>
            <textarea
              value={content}
              onChange={(e) => {
                if (e.target.value.length <= 1000) setContent(e.target.value)
              }}
              placeholder="Spill it... nobody will know it's you 🤫"
              className="w-full h-32 rounded-xl border border-border bg-background text-foreground text-sm p-3 resize-none focus:outline-none focus:border-green-500/50 placeholder:text-muted-foreground/40"
              maxLength={1000}
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] text-muted-foreground/40">
                {content.length}/1000
              </span>
            </div>
          </div>

          {/* Privacy note */}
          <div className="flex items-center gap-2 mb-4 p-2.5 rounded-lg bg-green-500/5 border border-green-500/10">
            <Shield className="w-4 h-4 text-green-500/60 shrink-0" />
            <p className="text-[11px] text-muted-foreground/60 leading-snug">
              Your identity is never shown — auto-deletes in {CONFESSION_AUTO_DELETE_DAYS} days
            </p>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={submitting || !category || !content.trim()}
            className="w-full h-12 rounded-xl bg-green-500 text-black font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100"
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            ) : (
              'Post Anonymously 🎭'
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ============================================
// Report Modal
// ============================================

const REPORT_REASONS = ['Spam', 'Harassment', 'Underage', 'Illegal', 'Other']

function ReportModal({
  onClose,
  onReport,
}: {
  onClose: () => void
  onReport: (reason: string) => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-lg bg-card border-t border-border rounded-t-2xl p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground">🚩 Report</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="space-y-2">
          {REPORT_REASONS.map((reason) => (
            <button
              key={reason}
              onClick={() => onReport(reason)}
              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm text-left hover:bg-card transition-colors"
            >
              {reason}
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}
