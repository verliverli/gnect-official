'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Play, Pause, Mic } from 'lucide-react'
import { getMediaUrl } from '@/lib/constants'
import { memo } from 'react'

// ============================================
// Voice Note Player Component
// Plays back voice notes in chat bubbles
// Shows: play/pause, animated waveform, duration
// ============================================

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

interface VoiceNotePlayerProps {
  message: {
    id: string
    content: string | null
    media_url: string | null
    sent_at: string
  }
  isMine: boolean
}

export const VoiceNotePlayer = memo(function VoiceNotePlayer({
  message,
  isMine,
}: VoiceNotePlayerProps) {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(() => {
    // Duration stored in content field as seconds string
    const d = parseInt(message.content || '0', 10)
    return isNaN(d) ? 0 : d
  })
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrl = message.media_url ? getMediaUrl(message.media_url) : null

  // Generate pseudo-random waveform bars from message ID for consistent look
  const bars = useMemo(
    () => Array.from({ length: 32 }, (_, i) => {
      // Deterministic "random" from message id + index
      const seed = (message.id.charCodeAt(i % message.id.length) * 7 + i * 13) % 100
      return Math.max(0.08, seed / 100)
    }),
    [message.id]
  )

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  const togglePlay = useCallback(() => {
    if (!audioUrl || error) return

    if (!audioRef.current) {
      const audio = new Audio(audioUrl)
      audio.onloadedmetadata = () => {
        setLoaded(true)
        // Use audio duration if available and content-based duration is 0
        if (audio.duration && isFinite(audio.duration) && duration === 0) {
          setDuration(audio.duration)
        }
      }
      audio.ontimeupdate = () => {
        if (audio.duration && isFinite(audio.duration)) {
          setProgress(audio.currentTime / audio.duration)
        }
      }
      audio.onended = () => {
        setPlaying(false)
        setProgress(0)
      }
      audio.onerror = () => {
        setError(true)
        setPlaying(false)
      }
      audioRef.current = audio
    }

    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current.play().catch(() => {
        setError(true)
      })
      setPlaying(true)
    }
  }, [audioUrl, playing, error, duration])

  return (
    <div
      className={`flex items-center gap-2.5 min-w-[180px] max-w-[240px] rounded-2xl px-3 py-2.5 ${
        isMine
          ? 'bg-primary/10'
          : 'bg-secondary/50'
      }`}
    >
      {/* Play/Pause button */}
      <button
        onClick={togglePlay}
        className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 active:scale-90 transition-transform ${
          isMine ? 'bg-primary/20' : 'bg-primary/10'
        }`}
        aria-label={playing ? 'Pause voice note' : 'Play voice note'}
      >
        {error ? (
          <Mic className="w-4 h-4 text-muted-foreground/50" />
        ) : playing ? (
          <Pause className="w-4 h-4 text-primary fill-primary" />
        ) : (
          <Play className="w-4 h-4 text-primary fill-primary ml-0.5" />
        )}
      </button>

      {/* Waveform bars */}
      <div className="flex-1 flex items-center gap-[1.5px] h-7">
        {bars.map((amp, i) => {
          const isPlayed = (i / 32) <= progress
          return (
            <div
              key={i}
              className={`flex-1 rounded-full transition-colors duration-100 ${
                isPlayed
                  ? isMine ? 'bg-primary' : 'bg-primary/70'
                  : isMine ? 'bg-primary/25' : 'bg-muted-foreground/25'
              }`}
              style={{ height: `${Math.max(8, amp * 100)}%` }}
            />
          )
        })}
      </div>

      {/* Duration */}
      <span className="text-[11px] font-mono text-muted-foreground/70 shrink-0 tabular-nums min-w-[28px] text-right">
        {error ? '--:--' : formatDuration(playing ? duration * (1 - progress) : duration)}
      </span>
    </div>
  )
})
