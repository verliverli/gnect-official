'use client'

import { Bookmark, BookmarkCheck, MapPin, Flame, Star } from 'lucide-react'
import { useCallback, useMemo, memo } from 'react'
import { getMediaUrl } from '@/lib/constants'
import { GeometricAvatar } from '@/components/geometric-avatar'

interface BannerCardProps {
  user: {
    id: string
    nickname: string
    age: number
    region: string
    role: string
    body_type: string
    availability: string
    is_online: boolean
    is_in_app: boolean
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
    rating_avg: number
    rating_count: number
  }
  currentUserId: string
  currentTags: string[]
  onTap: (userId: string) => void
  onSave: (userId: string) => void
}

function isNewUser(createdAt: string): boolean {
  const created = new Date(createdAt)
  const now = new Date()
  const diffMs = now.getTime() - created.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  return diffDays <= 7
}

export const BannerCard = memo(function BannerCard({
  user,
  currentUserId,
  currentTags,
  onTap,
  onSave,
}: BannerCardProps) {
  const isAvailableNow = user.availability === 'Available Now'
  const isNew = isNewUser(user.created_at)
  // Show first unlocked photo — NO blur, NO discretion overlay, NO GeometricAvatar replacement
  const displayPic = user.photos.find((p) => !p.is_locked) || user.photos[0]

  const sharedTags = useMemo(() => {
    if (!currentTags.length || !user.into_tags.length) return []
    return user.into_tags.filter((tag) => currentTags.includes(tag))
  }, [currentTags, user.into_tags])

  const truncatedNickname = useMemo(() => {
    if (user.nickname.length <= 15) return user.nickname
    return user.nickname.slice(0, 14) + '\u2026'
  }, [user.nickname])

  const displayTags = user.into_tags.slice(0, 2)

  const handleTap = useCallback(() => {
    onTap(user.id)
  }, [onTap, user.id])

  const handleSave = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onSave(user.id)
    },
    [onSave, user.id]
  )

  return (
    <div
      onClick={handleTap}
      className={`
        rounded-2xl border bg-card p-3 cursor-pointer
        gnect-card gnect-card-hover gnect-shimmer-hover
        ${isAvailableNow ? 'border-l-[3px] border-l-primary/70' : ''}
      `}
    >
      <div className="flex items-center gap-3">
        {/* Photo area — NO blur, always show photo directly */}
        <div className="relative shrink-0">
          <div className="w-[72px] h-[72px] sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-muted">
            {displayPic ? (
              <img
                src={getMediaUrl(displayPic.catbox_url) ?? undefined}
                alt={user.nickname}
                className="w-full h-full object-cover gnect-photo-shimmer"
                loading="lazy"
                decoding="async"
              />
            ) : (
              /* No photo: show geometric avatar */
              <GeometricAvatar nickname={user.nickname} size="100%" className="w-full h-full" />
            )}
          </div>
          {/* In App indicator — stronger than online */}
          {user.is_in_app && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-emerald-500 border-2 border-card" />
          )}
          {/* Online dot — only show if NOT in app (in app takes priority) */}
          {user.is_online && !user.is_in_app && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-primary border-2 border-card" />
          )}
          {/* Available Now pulse */}
          {isAvailableNow && (
            <span className="absolute -top-0.5 -left-0.5 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
            </span>
          )}
        </div>

        {/* Info area */}
        <div className="flex-1 min-w-0">
          {/* Line 1: Nickname + In App badge */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-[140px]">
              {truncatedNickname}
            </span>
            {user.is_in_app && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 leading-none shrink-0 flex items-center gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                In App
              </span>
            )}
            {!user.is_in_app && user.is_online && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary leading-none shrink-0">
                Online
              </span>
            )}
            {isNew && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary leading-none shrink-0">
                New Here
              </span>
            )}
          </div>

          {/* Line 2: Role + Age + Region */}
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-muted-foreground">
              {user.role} &middot; {user.age}
            </span>
            <span className="w-1 h-1 rounded-full bg-muted-foreground/30 shrink-0" />
            <span className="text-[10px] text-primary/70 font-medium flex items-center gap-0.5 shrink-0">
              <MapPin className="w-2.5 h-2.5" />{user.region}
            </span>
            {isAvailableNow && (
              <span className="text-[10px] text-primary font-medium shrink-0">
                Now
              </span>
            )}
          </div>

          {/* Line 2.5: Star rating display */}
          {(user.rating_count ?? 0) > 0 && (
            <div className="flex items-center gap-1 mt-0.5">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-3 h-3 ${
                      star <= Math.round(user.rating_avg ?? 0)
                        ? 'fill-amber-400 text-amber-400'
                        : 'fill-none text-amber-400/30'
                    }`}
                  />
                ))}
              </div>
              <span className="text-[9px] text-muted-foreground">
                {(user.rating_avg ?? 0).toFixed(1)} ({user.rating_count ?? 0})
              </span>
            </div>
          )}

          {/* Line 3: Tags as pills */}
          {displayTags.length > 0 && (
            <div className="flex items-center gap-1 mt-1">
              {displayTags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary leading-none"
                >
                  {tag}
                </span>
              ))}
              {sharedTags.length > 0 && (
                <span className="text-[9px] text-[#d4a843] leading-none shrink-0 flex items-center gap-0.5">
                  <Flame className="w-2.5 h-2.5" /> {sharedTags.length}
                </span>
              )}
            </div>
          )}

          {/* Line 4: Quick status strip */}
          {user.status_text && (
            <div className="mt-1">
              <span
                className="text-[10px] px-2 py-0.5 rounded-full text-white leading-none inline-block max-w-full truncate"
                style={{
                  background: user.status_gradient || 'linear-gradient(90deg, #22c55e, #86efac)',
                }}
              >
                {user.status_text.length > 35
                  ? user.status_text.slice(0, 34) + '\u2026'
                  : user.status_text}
              </span>
            </div>
          )}
        </div>

        {/* Right side: Save button */}
        <button
          onClick={handleSave}
          className="shrink-0 w-11 h-11 flex items-center justify-center rounded-xl active:bg-secondary transition-colors"
          aria-label={user.is_saved ? 'Unsave profile' : 'Save profile'}
        >
          {user.is_saved ? (
            <BookmarkCheck className="w-5 h-5 text-primary" />
          ) : (
            <Bookmark className="w-5 h-5 text-muted-foreground" />
          )}
        </button>
      </div>
    </div>
  )
})
