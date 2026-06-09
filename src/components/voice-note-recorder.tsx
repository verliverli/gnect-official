'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, Square, X, Send, Play, Pause } from 'lucide-react'
import { MEDIA_LIMITS } from '@/lib/constants'

// ============================================
// Voice Note Recorder Component (P1.12)
// Tap mic → record → preview → send
// Shows live waveform + duration + preview + send
// ============================================

interface VoiceNoteRecorderProps {
  onSend: (audioBlob: Blob, durationSeconds: number) => void
  onCancel: () => void
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Cleanup function — pure, no hooks dependency issues
function cleanupRecording(
  timerRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>,
  mediaRecorderRef: React.MutableRefObject<MediaRecorder | null>,
  streamRef: React.MutableRefObject<MediaStream | null>,
  audioContextRef: React.MutableRefObject<AudioContext | null>,
  analyserRef: React.MutableRefObject<AnalyserNode | null>,
) {
  if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
    try { mediaRecorderRef.current.stop() } catch {}
  }
  if (streamRef.current) {
    streamRef.current.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }
  if (audioContextRef.current) {
    audioContextRef.current.close().catch(() => {})
    audioContextRef.current = null
  }
  analyserRef.current = null
}

export function VoiceNoteRecorder({ onSend, onCancel }: VoiceNoteRecorderProps) {
  const [recording, setRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [playProgress, setPlayProgress] = useState(0)
  const [amplitudes, setAmplitudes] = useState<number[]>(Array(40).fill(0))

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)

  // Keep audioUrlRef in sync
  useEffect(() => { audioUrlRef.current = audioUrl }, [audioUrl])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupRecording(timerRef, mediaRecorderRef, streamRef, audioContextRef, analyserRef)
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    }
  }, [])

  const stopRecording = useCallback(() => {
    cleanupRecording(timerRef, mediaRecorderRef, streamRef, audioContextRef, analyserRef)
  }, [])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      streamRef.current = stream

      // Set up audio analyser for waveform visualization
      const audioCtx = new AudioContext()
      audioContextRef.current = audioCtx
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 128
      source.connect(analyser)
      analyserRef.current = analyser

      // Choose best available format
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
        ? 'audio/ogg;codecs=opus'
        : 'audio/webm'

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const url = URL.createObjectURL(blob)
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
        setAudioBlob(blob)
        setAudioUrl(url)
        setRecording(false)
      }

      recorder.start(100) // Collect data every 100ms
      setRecording(true)
      setDuration(0)
      setAudioBlob(null)
      setAudioUrl(null)

      // Start timer
      const startTime = Date.now()
      timerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000
        setDuration(elapsed)

        // Update waveform from analyser
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
          analyserRef.current.getByteFrequencyData(dataArray)
          const step = Math.floor(dataArray.length / 40)
          const amps = Array.from({ length: 40 }, (_, i) => {
            const value = dataArray[i * step] / 255
            return Math.max(0.05, value)
          })
          setAmplitudes(amps)
        }

        // Auto-stop at max duration
        if (elapsed >= MEDIA_LIMITS.MAX_VOICE_NOTE_DURATION_SECONDS) {
          cleanupRecording(timerRef, mediaRecorderRef, streamRef, audioContextRef, analyserRef)
        }
      }, 50)
    } catch (err) {
      console.error('Failed to start recording:', err)
      onCancel()
    }
  }, [onCancel])

  const handleSend = useCallback(() => {
    if (audioBlob) {
      onSend(audioBlob, Math.round(duration))
      setAudioBlob(null)
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      setAudioUrl(null)
      setDuration(0)
      setAmplitudes(Array(40).fill(0))
    }
  }, [audioBlob, duration, audioUrl, onSend])

  const handleCancel = useCallback(() => {
    setAudioBlob(null)
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioUrl(null)
    setDuration(0)
    setAmplitudes(Array(40).fill(0))
    onCancel()
  }, [audioUrl, onCancel])

  // Playback for preview
  const togglePlayPreview = useCallback(() => {
    if (!audioUrl) return
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl)
      audioRef.current.onended = () => { setPlaying(false); setPlayProgress(0) }
      audioRef.current.ontimeupdate = () => {
        if (audioRef.current && duration > 0) {
          setPlayProgress(audioRef.current.currentTime / duration)
        }
      }
    }
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current.play()
      setPlaying(true)
    }
  }, [audioUrl, playing, duration])

  // === Recording in progress ===
  if (recording) {
    return (
      <div className="flex-1 flex items-center gap-3 px-3 py-2 bg-primary/5 rounded-2xl">
        {/* Pulsing red dot */}
        <span className="relative flex h-3 w-3 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
        </span>

        {/* Waveform visualization */}
        <div className="flex-1 flex items-center gap-[2px] h-8">
          {amplitudes.map((amp, i) => (
            <div
              key={i}
              className="flex-1 bg-primary/60 rounded-full transition-all duration-75"
              style={{ height: `${Math.max(4, amp * 100)}%`, minHeight: '4px' }}
            />
          ))}
        </div>

        {/* Duration counter */}
        <span className="text-xs font-mono text-muted-foreground shrink-0 tabular-nums">
          {formatDuration(duration)}
        </span>

        {/* Stop button */}
        <button
          onClick={stopRecording}
          className="h-9 w-9 rounded-full bg-red-500/20 flex items-center justify-center active:scale-90 transition-transform shrink-0"
          aria-label="Stop recording"
        >
          <Square className="w-4 h-4 text-red-500 fill-red-500" />
        </button>
      </div>
    )
  }

  // === Preview recorded voice note ===
  if (audioBlob && audioUrl) {
    return (
      <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-primary/5 rounded-2xl">
        {/* Play/Pause preview */}
        <button
          onClick={togglePlayPreview}
          className="h-9 w-9 rounded-full bg-primary flex items-center justify-center active:scale-90 transition-transform shrink-0"
          aria-label={playing ? 'Pause preview' : 'Play preview'}
        >
          {playing ? (
            <Pause className="w-4 h-4 text-primary-foreground fill-primary-foreground" />
          ) : (
            <Play className="w-4 h-4 text-primary-foreground fill-primary-foreground ml-0.5" />
          )}
        </button>

        {/* Waveform with progress */}
        <div className="flex-1 flex items-center gap-[2px] h-8">
          {amplitudes.map((amp, i) => {
            const isPlayed = (i / 40) <= playProgress
            return (
              <div
                key={i}
                className={`flex-1 rounded-full transition-colors duration-100 ${
                  isPlayed ? 'bg-primary' : 'bg-primary/30'
                }`}
                style={{ height: `${Math.max(4, amp * 100)}%`, minHeight: '4px' }}
              />
            )
          })}
        </div>

        {/* Duration */}
        <span className="text-xs font-mono text-muted-foreground shrink-0 tabular-nums">
          {formatDuration(duration)}
        </span>

        {/* Cancel */}
        <button
          onClick={handleCancel}
          className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-destructive/10 active:scale-90 transition-all shrink-0"
          aria-label="Cancel voice note"
        >
          <X className="w-4 h-4 text-destructive" />
        </button>

        {/* Send */}
        <button
          onClick={handleSend}
          className="h-9 w-9 rounded-full bg-primary flex items-center justify-center active:scale-90 transition-transform shrink-0"
          aria-label="Send voice note"
        >
          <Send className="w-4 h-4 text-primary-foreground" />
        </button>
      </div>
    )
  }

  // === Idle: This component is only rendered when isRecordingVoice is true ===
  // So this state shouldn't normally be reached, but handle gracefully
  return (
    <button
      onClick={startRecording}
      className="h-9 w-9 rounded-full flex items-center justify-center active:bg-primary/10 active:scale-90 transition-all shrink-0"
      aria-label="Record voice note"
    >
      <Mic className="w-5 h-5 text-muted-foreground" />
    </button>
  )
}
