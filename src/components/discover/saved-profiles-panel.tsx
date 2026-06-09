'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Bookmark, Loader2, Compass, MapPin, Star, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getMediaUrl } from '@/lib/constants'
import { GeometricAvatar } from '@/components/geometric-avatar'
import { toast } from 'sonner'

// ============================================
// Types
// ============================================

interface SavedProfile {
  id: string
  nickname: string
  age: number
  region: string
  role: string
  availability: string
  is_online: boolean
  last_seen: string
  photos: { id: string; catbox_url: string; is_locked: boolean; is_face_pic: boolean; upload_order: number }[]
  into_tags: string[]
}

interface SavedProfilesPanelProps {
  onClose: () => void
  onOpenProfile: (userId: string) => void
  onOpenChat: (userId: string) => void
}

// ============================================
// Saved Profiles Panel Component
// ============================================

export function SavedProfilesPanel({ onClose, onOpenProfile, onOpenChat }: SavedProfilesPanelProps) {
  const [profiles, setProfiles] = useState<SavedProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [removingId, setRemovingId] = useState<string | null>(null)

  useEffect(() => {
    fetchSavedProfiles()
  }, [])

  const fetchSavedProfiles = async () => {
    try {
      const res = await fetch('/api/profile/save', { credentials: 'same-origin' })
      const data = await res.json()
      if (data.ok) {
        setProfiles(data.data || [])
      }
    } catch {
      toast.error('Failed to load saved profiles')
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async (userId: string) => {
    if (removingId) return
    setRemovingId(userId)

    // Optimistic: remove from UI immediately
    const rollback = [...profiles]
    setProfiles((prev) => prev.filter((p) => p.id !== userId))

    try {
      const res = await fetch('/api/profile/save', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Profile removed from saved')
      } else {
        // Rollback
        setProfiles(rollback)
        toast.error(data.error || 'Failed to remove')
      }
    } catch {
      setProfiles(rollback)
      toast.error('Network error')
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border gnect-glass-elevated shrink-0">
        <Button variant="ghost" size="icon" className="h-10 w-10 gnect-press" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-primary" />
            Saved Profiles
          </h2>
        </div>
        <span className="text-xs text-muted-foreground">{profiles.length} saved</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain gnect-scroll">
        {loading ? (
          <div className="px-4 py-4 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-2xl border bg-card p-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-16 h-16 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-36" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : profiles.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 gap-3 py-16">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Bookmark className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-foreground">No saved profiles yet</h3>
            <p className="text-xs text-muted-foreground text-center max-w-xs">
              When you save someone&apos;s profile in Discover, they&apos;ll appear here for easy access.
            </p>
            <Button variant="outline" className="mt-4 rounded-xl" onClick={onClose}>
              <Compass className="w-4 h-4 mr-2" />
              Discover People
            </Button>
          </div>
        ) : (
          <div className="px-4 py-3 space-y-2">
            {profiles.map((profile) => {
              const displayPic = profile.photos.find((p) => !p.is_locked) || profile.photos[0]
              const isAvailableNow = profile.availability === 'Available Now'

              return (
                <div
                  key={profile.id}
                  className="rounded-2xl border bg-card p-3 gnect-card gnect-card-hover"
                >
                  <div className="flex items-center gap-3">
                    {/* Photo */}
                    <button
                      onClick={() => onOpenProfile(profile.id)}
                      className="relative shrink-0"
                    >
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted">
                        {displayPic ? (
                          <img
                            src={getMediaUrl(displayPic.catbox_url) ?? undefined}
                            alt={profile.nickname}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <GeometricAvatar nickname={profile.nickname} size="100%" className="w-full h-full" />
                        )}
                      </div>
                      {/* Online dot */}
                      {profile.is_online && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-primary border-2 border-card" />
                      )}
                      {isAvailableNow && (
                        <span className="absolute -top-0.5 -left-0.5 flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
                        </span>
                      )}
                    </button>

                    {/* Info */}
                    <button
                      onClick={() => onOpenProfile(profile.id)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm truncate max-w-[120px]">
                          {profile.nickname}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          {profile.role} · {profile.age}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-muted-foreground/30 shrink-0" />
                        <span className="text-[10px] text-primary/70 font-medium flex items-center gap-0.5">
                          <MapPin className="w-2.5 h-2.5" />{profile.region}
                        </span>
                      </div>
                      {/* Tags */}
                      {profile.into_tags.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          {profile.into_tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary leading-none"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>

                    {/* Actions */}
                    <div className="flex flex-col items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => onOpenChat(profile.id)}
                        className="h-9 w-9 rounded-full flex items-center justify-center bg-primary/10 text-primary active:scale-90 transition-transform"
                        aria-label={`Message ${profile.nickname}`}
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRemove(profile.id)}
                        disabled={removingId === profile.id}
                        className="h-9 w-9 rounded-full flex items-center justify-center bg-destructive/10 text-destructive active:scale-90 transition-transform"
                        aria-label={`Remove ${profile.nickname} from saved`}
                      >
                        {removingId === profile.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <X className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </motion.div>
  )
}
