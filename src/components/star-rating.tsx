'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import { toast } from 'sonner'

interface StarRatingProps {
  userId: string
  currentRating: number | null  // null = not rated yet
  avgRating: number             // average rating for this user
  ratingCount: number           // number of ratings
  size?: 'sm' | 'md'           // sm for profile cards, md for profile panel
  onRated?: (stars: number) => void
}

export function StarRating({ userId, currentRating, avgRating, ratingCount, size = 'sm', onRated }: StarRatingProps) {
  const [hoveredStar, setHoveredStar] = useState<number | null>(null)
  const [myRating, setMyRating] = useState(currentRating)
  const [submitting, setSubmitting] = useState(false)
  const [ratingError, setRatingError] = useState<string | null>(null)

  const starSize = size === 'sm' ? 'w-4 h-4' : 'w-6 h-6'

  const handleRate = async (stars: number) => {
    if (submitting) return
    setSubmitting(true)
    setRatingError(null)
    try {
      const res = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ ratedUserId: userId, stars }),
      })
      const data = await res.json()
      if (data.ok) {
        setMyRating(stars)
        onRated?.(stars)
        toast.success(stars === currentRating ? 'Rating removed' : `Rated ${stars} stars`)
      } else {
        setRatingError(data.error || 'Failed to rate')
        toast.error(data.error || 'Failed to rate')
      }
    } catch {
      setRatingError('Network error')
      toast.error('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  // Display: average rating + count
  const displayRating = myRating ?? avgRating

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => handleRate(star)}
              onMouseEnter={() => setHoveredStar(star)}
              onMouseLeave={() => setHoveredStar(null)}
              className="transition-transform active:scale-90"
              aria-label={`Rate ${star} stars`}
            >
              <Star
                className={`${starSize} transition-colors ${
                  star <= (hoveredStar ?? displayRating)
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-amber-400/40'
                }`}
              />
            </button>
          ))}
        </div>
        {ratingCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {avgRating.toFixed(1)} ({ratingCount})
          </span>
        )}
      </div>
      {ratingError && (
        <p className="text-[10px] text-amber-500/80 font-medium">{ratingError}</p>
      )}
    </div>
  )
}
