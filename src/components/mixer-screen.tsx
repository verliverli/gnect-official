'use client'

import { useState, useEffect, useCallback, useRef, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Send, Mic, Reply, Loader2, Users,
  LogOut, Hash, Volume2, Globe, Shuffle
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/lib/store'
import { getCountryFlag, containsLink, getMediaUrl } from '@/lib/constants'
import { toast } from 'sonner'
import { VoiceNoteRecorder } from '@/components/voice-note-recorder'
import { VoiceNotePlayer } from '@/components/voice-note-player'

// ============================================
// Types
// ============================================

interface GroupRoom {
  id: string
  country: string
  region: string
  name: string
  memberCount: number
  lastMessage: {
    id: string
    anonymous_name: string
    content: string | null
    media_type: string | null
    sent_at: string
  } | null
  last_message_at: string
  membership: {
    anonymous_name: string
    last_read_at: string
  } | null
}

interface GroupMessage {
  id: string
  sender_id: string
  anonymous_name: string
  content: string | null
  media_url: string | null
  media_type: string | null
  reply_to_id: string | null
  sent_at: string
}

// ============================================
// Anonymous Name Color Palette
// Consistent color based on name hash
// ============================================

const ANON_COLORS = [
  'text-rose-400',
  'text-amber-400',
  'text-emerald-400',
  'text-cyan-400',
  'text-violet-400',
  'text-pink-400',
  'text-orange-400',
  'text-teal-400',
] as const

const ANON_BG_COLORS = [
  'bg-rose-400/15',
  'bg-amber-400/15',
  'bg-emerald-400/15',
  'bg-cyan-400/15',
  'bg-violet-400/15',
  'bg-pink-400/15',
  'bg-orange-400/15',
  'bg-teal-400/15',
] as const

const ANON_BORDER_COLORS = [
  'border-rose-400/25',
  'border-amber-400/25',
  'border-emerald-400/25',
  'border-cyan-400/25',
  'border-violet-400/25',
  'border-pink-400/25',
  'border-orange-400/25',
  'border-teal-400/25',
] as const

function hashNameToIndex(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % ANON_COLORS.length
}

function getAnonColor(name: string): string {
  return ANON_COLORS[hashNameToIndex(name)]
}

function getAnonBgColor(name: string): string {
  return ANON_BG_COLORS[hashNameToIndex(name)]
}

function getAnonBorderColor(name: string): string {
  return ANON_BORDER_COLORS[hashNameToIndex(name)]
}

// ============================================
// Helpers
// ============================================

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then

  if (diffMs < 0) return 'now'

  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return 'now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`

  const days = Math.floor(hours / 24)
  if (days === 1) return 'yest'
  if (days < 7) return `${days}d`

  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

function getReplyPreviewText(msg: GroupMessage | null): string {
  if (!msg) return '[Message removed]'
  if (msg.media_type === 'voice_note') return 'Voice note'
  if (!msg.content && msg.media_type) return '[Message removed]'
  return msg.content?.slice(0, 60) || '[Message removed]'
}

function getRoomLastMessagePreview(room: GroupRoom): string {
  if (!room.lastMessage) return 'No messages yet'
  if (room.lastMessage.media_type === 'voice_note') return 'Voice note'
  if (room.lastMessage.content) {
    return room.lastMessage.content.length > 40
      ? room.lastMessage.content.slice(0, 40) + '...'
      : room.lastMessage.content
  }
  return 'No messages yet'
}

function hasUnread(room: GroupRoom): boolean {
  if (!room.membership || !room.lastMessage) return false
  const lastRead = new Date(room.membership.last_read_at).getTime()
  const lastMsg = new Date(room.last_message_at).getTime()
  return lastMsg > lastRead
}

// ============================================
// Anonymous Name Badge
// ============================================

function AnonBadge({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-bold tracking-wide border ${getAnonBgColor(name)} ${getAnonColor(name)} ${getAnonBorderColor(name)} ${className}`}
    >
      {name}
    </span>
  )
}

// ============================================
// Group Chat Bubble Component
// ============================================

const GroupBubble = memo(function GroupBubble({
  message,
  isMine,
  replyTo,
  onReply,
  currentUserId,
}: {
  message: GroupMessage
  isMine: boolean
  replyTo: GroupMessage | null
  onReply: (message: GroupMessage) => void
  currentUserId: string
}) {
  // Swipe-to-reply state
  const [swipeX, setSwipeX] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const SWIPE_THRESHOLD = 60
  const REPLY_ICON_SHOW = 20

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    const touch = e.touches[0]
    const dx = touch.clientX - touchStartRef.current.x
    const dy = Math.abs(touch.clientY - touchStartRef.current.y)

    if (dx > 10 && dy < 30) {
      setIsSwiping(true)
      setSwipeX(Math.max(0, Math.min(dx, 100)))
    } else if (dx < -10 && dy < 30) {
      setIsSwiping(false)
      setSwipeX(0)
    }
  }

  const handleTouchEnd = () => {
    if (isSwiping && swipeX >= SWIPE_THRESHOLD) {
      onReply(message)
    }
    setSwipeX(0)
    setIsSwiping(false)
    touchStartRef.current = null
  }

  // Desktop mouse swipe
  const mouseStartRef = useRef<{ x: number } | null>(null)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    mouseStartRef.current = { x: e.clientX }
  }
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!mouseStartRef.current) return
    const dx = e.clientX - mouseStartRef.current.x
    if (dx > 10) {
      setIsSwiping(true)
      setSwipeX(Math.max(0, Math.min(dx, 100)))
    }
  }
  const handleMouseUp = () => {
    if (isSwiping && swipeX >= SWIPE_THRESHOLD) {
      onReply(message)
    }
    setSwipeX(0)
    setIsSwiping(false)
    mouseStartRef.current = null
  }

  const anonName = message.anonymous_name
  const anonColorClass = getAnonColor(anonName)

  // Voice note
  if (message.media_type === 'voice_note') {
    return (
      <div
        className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1 gnect-bubble-enter`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setSwipeX(0); setIsSwiping(false); mouseStartRef.current = null }}
        style={{ transform: `translateX(${swipeX}px)`, transition: isSwiping ? 'none' : 'transform 0.2s ease-out' }}
      >
        {swipeX > REPLY_ICON_SHOW && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full pr-2 flex items-center">
            <Reply className="w-5 h-5 text-primary" />
          </div>
        )}
        <div className="relative max-w-[80%]">
          {/* Anonymous name */}
          {!isMine && <AnonBadge name={anonName} className="mb-1" />}
          {/* Reply preview */}
          {replyTo && (
            <div className={`text-[10px] px-2 py-1 rounded-t-xl mb-0.5 ${
              isMine ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'
            }`}>
              <span className="font-medium truncate block">
                {getReplyPreviewText(replyTo)}
              </span>
            </div>
          )}
          <VoiceNotePlayer message={message} isMine={isMine} />
          <div className={`flex items-center gap-1 mt-0.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
            <span className="text-[10px] text-muted-foreground/50">{formatTime(message.sent_at)}</span>
          </div>
        </div>
      </div>
    )
  }

  // Text message
  return (
    <div
      className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1 gnect-bubble-enter`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { setSwipeX(0); setIsSwiping(false); mouseStartRef.current = null }}
      style={{ transform: `translateX(${swipeX}px)`, transition: isSwiping ? 'none' : 'transform 0.2s ease-out' }}
    >
      {swipeX > REPLY_ICON_SHOW && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full pr-2 flex items-center">
          <Reply className="w-5 h-5 text-primary" />
        </div>
      )}
      <div
        className={`relative max-w-[80%] ${
          isMine
            ? 'bg-primary/15 text-foreground rounded-2xl rounded-br-md'
            : 'bg-secondary text-foreground rounded-2xl rounded-bl-md'
        }`}
      >
        {/* Anonymous name */}
        {!isMine && (
          <div className="px-3 pt-2 pb-0">
            <AnonBadge name={anonName} />
          </div>
        )}
        {/* Reply preview */}
        {replyTo && (
          <div className={`text-[10px] px-3 pt-1 pb-0.5 ${
            isMine ? 'bg-primary/10 text-primary/80' : 'bg-secondary/80 text-muted-foreground'
          }`}>
            <span className="font-medium truncate block">
              {getReplyPreviewText(replyTo)}
            </span>
          </div>
        )}
        {/* Content */}
        <div className="px-3 py-2">
          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
          <div className={`flex items-center gap-1 mt-0.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
            <span className="text-[10px] text-muted-foreground/50">{formatTime(message.sent_at)}</span>
          </div>
        </div>
      </div>
    </div>
  )
})

// ============================================
// Main MixerScreen Component
// ============================================

export function MixerScreen({ onUnreadCountChange }: { onUnreadCountChange?: (count: number) => void }) {
  const { user: currentUser } = useAuthStore()

  // View state
  const [view, setView] = useState<'list' | 'room'>('list')
  const [activeRoom, setActiveRoom] = useState<GroupRoom | null>(null)

  // Rooms list state
  const [rooms, setRooms] = useState<GroupRoom[]>([])
  const [roomsLoading, setRoomsLoading] = useState(true)

  // Messages state
  const [messages, setMessages] = useState<GroupMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messagesCursor, setMessagesCursor] = useState<string | null>(null)
  const [messagesHasMore, setMessagesHasMore] = useState(false)

  // Input state
  const [messageText, setMessageText] = useState('')
  const [replyTo, setReplyTo] = useState<GroupMessage | null>(null)
  const [sending, setSending] = useState(false)

  // Voice note state
  const [isRecordingVoice, setIsRecordingVoice] = useState(false)
  const [uploadingVoice, setUploadingVoice] = useState(false)

  // Leave room confirmation
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)

  // Scroll ref
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Reply-to message lookup map
  const [messageMap, setMessageMap] = useState<Record<string, GroupMessage>>({})

  // Update message map whenever messages change
  useEffect(() => {
    setMessageMap((prev) => {
      const next = { ...prev }
      for (const msg of messages) {
        next[msg.id] = msg
      }
      return next
    })
  }, [messages])

  // Country flag
  const countryFlag = currentUser ? getCountryFlag(currentUser.country) : null

  // ============================================
  // Fetch Rooms
  // ============================================

  const fetchRooms = useCallback(async (silent = false) => {
    if (!currentUser) return

    try {
      const res = await fetch('/api/group/rooms', { credentials: 'same-origin' })
      const data = await res.json()

      if (data.ok) {
        const roomList = data.data || []
        setRooms(roomList)

        // Calculate total unread count for badge
        const totalUnread = roomList.filter((r: GroupRoom) => hasUnread(r)).length
        onUnreadCountChange?.(totalUnread)
      }
    } catch {
      // Silent fail
    } finally {
      if (!silent) setRoomsLoading(false)
    }
  }, [currentUser, onUnreadCountChange])

  useEffect(() => {
    if (currentUser) {
      fetchRooms()
    }
  }, [currentUser, fetchRooms])

  // Periodic refresh for rooms list (every 30s)
  useEffect(() => {
    if (!currentUser) return
    const interval = setInterval(() => fetchRooms(true), 30000)
    return () => clearInterval(interval)
  }, [currentUser, fetchRooms])

  // ============================================
  // Open Room
  // ============================================

  const openRoom = useCallback(async (room: GroupRoom) => {
    // If not a member, join first
    if (!room.membership) {
      try {
        const joinRes = await fetch(`/api/group/${room.id}/join`, {
          method: 'POST',
          credentials: 'same-origin',
        })
        const joinData = await joinRes.json()
        if (joinData.ok) {
          // Update room membership locally
          room.membership = {
            anonymous_name: joinData.data.anonymous_name,
            last_read_at: new Date().toISOString(),
          }
        } else {
          toast.error(joinData.error || 'Failed to join room')
          return
        }
      } catch {
        toast.error('Network error')
        return
      }
    }

    setActiveRoom(room)
    setView('room')
    setMessages([])
    setMessagesCursor(null)
    setMessagesHasMore(false)
    setReplyTo(null)
    setMessageText('')
    setIsRecordingVoice(false)
    fetchMessages(room.id)
  }, [])

  // ============================================
  // Fetch Messages
  // ============================================

  const fetchMessages = useCallback(async (roomId: string, beforeId?: string) => {
    try {
      if (!beforeId) setMessagesLoading(true)

      const params = new URLSearchParams()
      if (beforeId) params.set('before', beforeId)

      const res = await fetch(`/api/group/${roomId}/messages?${params.toString()}`, {
        credentials: 'same-origin',
      })
      const data = await res.json()

      if (data.ok) {
        const newMessages = data.data || []
        if (beforeId) {
          setMessages((prev) => [...newMessages, ...prev])
        } else {
          setMessages(newMessages)
        }
        setMessagesCursor(data.nextCursor || null)
        setMessagesHasMore(!!data.nextCursor)

        // Scroll to bottom on initial load
        if (!beforeId) {
          requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView())
        }
      }
    } catch {
      toast.error('Failed to load messages')
    } finally {
      setMessagesLoading(false)
    }
  }, [])

  // ============================================
  // Load Older Messages
  // ============================================

  const loadOlderMessages = useCallback(() => {
    if (!activeRoom || !messagesCursor || !messagesHasMore) return
    fetchMessages(activeRoom.id, messagesCursor)
  }, [activeRoom, messagesCursor, messagesHasMore, fetchMessages])

  // ============================================
  // Send Text Message
  // ============================================

  const sendMessage = useCallback(async () => {
    if (!activeRoom || !messageText.trim() || sending) return

    const text = messageText.trim()

    // Block links
    if (containsLink(text)) {
      toast.error('Links are not allowed')
      return
    }

    setSending(true)
    setMessageText('')

    try {
      const res = await fetch(`/api/group/${activeRoom.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: text,
          reply_to_id: replyTo?.id || null,
        }),
        credentials: 'same-origin',
      })
      const data = await res.json()

      if (data.ok) {
        const newMsg: GroupMessage = {
          id: data.data.id,
          sender_id: currentUser!.id,
          anonymous_name: data.data.anonymous_name,
          content: data.data.content,
          media_url: data.data.media_url,
          media_type: data.data.media_type,
          reply_to_id: data.data.reply_to_id,
          sent_at: data.data.sent_at,
        }
        setMessages((prev) => [...prev, newMsg])
        setReplyTo(null)
        requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }))
        // Refresh rooms list to update last message
        fetchRooms(true)
      } else {
        toast.error(data.error || 'Failed to send')
        setMessageText(text) // Restore text on failure
      }
    } catch {
      toast.error('Network error')
      setMessageText(text)
    } finally {
      setSending(false)
    }
  }, [activeRoom, messageText, sending, replyTo, currentUser, fetchRooms])

  // ============================================
  // Send Voice Note
  // ============================================

  const handleVoiceNoteSend = useCallback(async (audioBlob: Blob, durationSeconds: number) => {
    if (!activeRoom) return

    setUploadingVoice(true)

    try {
      // Step 1: Upload voice note to Telegram
      const formData = new FormData()
      formData.append('audio', audioBlob, 'voice.webm')
      formData.append('duration', durationSeconds.toString())

      const uploadRes = await fetch(`/api/group/${activeRoom.id}/upload-voice`, {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
      })
      const uploadData = await uploadRes.json()

      if (!uploadData.ok) {
        toast.error(uploadData.error || 'Voice note upload failed')
        return
      }

      // Step 2: Send message with voice note
      const res = await fetch(`/api/group/${activeRoom.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_url: uploadData.data.url,
          media_type: 'voice_note',
          content: durationSeconds.toString(),
          reply_to_id: replyTo?.id || null,
        }),
        credentials: 'same-origin',
      })
      const data = await res.json()

      if (data.ok) {
        const newMsg: GroupMessage = {
          id: data.data.id,
          sender_id: currentUser!.id,
          anonymous_name: data.data.anonymous_name,
          content: durationSeconds.toString(),
          media_url: uploadData.data.url,
          media_type: 'voice_note',
          reply_to_id: data.data.reply_to_id,
          sent_at: data.data.sent_at,
        }
        setMessages((prev) => [...prev, newMsg])
        setReplyTo(null)
        requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }))
        fetchRooms(true)
      } else {
        toast.error(data.error || 'Failed to send voice note')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setUploadingVoice(false)
      setIsRecordingVoice(false)
    }
  }, [activeRoom, replyTo, currentUser, fetchRooms])

  // ============================================
  // Leave Room
  // ============================================

  const leaveRoom = useCallback(async () => {
    if (!activeRoom) return

    try {
      const res = await fetch(`/api/group/${activeRoom.id}/leave`, {
        method: 'POST',
        credentials: 'same-origin',
      })
      const data = await res.json()

      if (data.ok) {
        toast.success('Left the room')
        setView('list')
        setActiveRoom(null)
        setMessages([])
        fetchRooms()
      } else {
        toast.error(data.error || 'Failed to leave room')
      }
    } catch {
      toast.error('Network error')
    }
  }, [activeRoom, fetchRooms])

  // ============================================
  // Reply handler
  // ============================================

  const handleReply = useCallback((message: GroupMessage) => {
    setReplyTo(message)
    if (navigator.vibrate) navigator.vibrate(10)
  }, [])

  // ============================================
  // Back to list
  // ============================================

  const goBackToList = useCallback(() => {
    setView('list')
    setActiveRoom(null)
    setMessages([])
    setReplyTo(null)
    setMessageText('')
    setIsRecordingVoice(false)
    fetchRooms(true)
  }, [fetchRooms])

  // ============================================
  // Pull-to-refresh for rooms list
  // ============================================

  const listRef = useRef<HTMLDivElement>(null)
  const pullStartRef = useRef<number>(0)
  const [isPulling, setIsPulling] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleListTouchStart = (e: React.TouchEvent) => {
    const el = listRef.current
    if (!el || el.scrollTop > 0) return
    pullStartRef.current = e.touches[0].clientY
  }

  const handleListTouchMove = (e: React.TouchEvent) => {
    const el = listRef.current
    if (!el || el.scrollTop > 0) return
    const dy = e.touches[0].clientY - pullStartRef.current
    setIsPulling(dy > 60)
  }

  const handleListTouchEnd = async () => {
    if (isPulling && !isRefreshing) {
      setIsRefreshing(true)
      await fetchRooms(true)
      setIsRefreshing(false)
    }
    setIsPulling(false)
  }

  // ============================================
  // RENDER — Room List View
  // ============================================

  if (view === 'list') {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="shrink-0 px-4 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-1.5">
              Mixer <Shuffle className="w-5 h-5 text-primary" />
            </h1>
            {countryFlag ? (
              <span className="text-lg">{countryFlag}</span>
            ) : (
              <Globe className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <p className="text-xs text-muted-foreground/60 mt-0.5">
            Your region's anonymous group chat
          </p>
        </div>

        {/* Rooms List */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto overscroll-contain gnect-scroll"
          onTouchStart={handleListTouchStart}
          onTouchMove={handleListTouchMove}
          onTouchEnd={handleListTouchEnd}
        >
          {/* Pull-to-refresh indicator */}
          <AnimatePresence>
            {(isPulling || isRefreshing) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 40, opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="flex items-center justify-center overflow-hidden"
              >
                <Loader2 className={`w-4 h-4 text-primary ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="text-xs text-muted-foreground ml-2">
                  {isRefreshing ? 'Refreshing...' : 'Pull to refresh'}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {roomsLoading ? (
            <div className="px-4 py-3 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
              ))}
            </div>
          ) : rooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4">
              <Users className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground/60 text-center">
                No room for your region yet.
              </p>
              <p className="text-xs text-muted-foreground/40 text-center mt-1">
                Check back soon — rooms are created automatically!
              </p>
            </div>
          ) : (
            <div className="px-4 pb-4 space-y-1.5">
              {rooms.map((room) => {
                const unread = hasUnread(room)

                return (
                  <motion.button
                    key={room.id}
                    onClick={() => openRoom(room)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left active:scale-[0.98] bg-primary/10 border border-primary/20"
                    whileTap={{ scale: 0.98 }}
                  >
                    {/* Room icon */}
                    <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 bg-primary/20">
                      <Hash className="w-5 h-5 text-primary" />
                    </div>

                    {/* Room info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold truncate text-primary">
                          {room.name}
                        </span>
                        <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-primary/40 text-primary shrink-0">
                          YOURS
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Users className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                        <span className="text-[11px] text-muted-foreground/50">
                          {room.memberCount} {room.memberCount === 1 ? 'member' : 'members'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground/60 mt-0.5 truncate">
                        {getRoomLastMessagePreview(room)}
                      </p>
                    </div>

                    {/* Time + unread badge */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {room.lastMessage && (
                        <span className="text-[10px] text-muted-foreground/40">
                          {relativeTime(room.lastMessage.sent_at)}
                        </span>
                      )}
                      {unread && (
                        <span className="min-w-[8px] h-[8px] rounded-full bg-primary shrink-0" />
                      )}
                    </div>
                  </motion.button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ============================================
  // RENDER — Room Chat View
  // ============================================

  const myAnonName = activeRoom?.membership?.anonymous_name || ''

  return (
    <div className="flex flex-col h-full">
      {/* Room Header */}
      <div className="shrink-0 flex items-center gap-2 px-2 py-2 gnect-glass border-b border-border/50 z-10">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={goBackToList}
          aria-label="Back to rooms"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Hash className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm font-semibold truncate">{activeRoom?.name || 'Room'}</span>
          </div>
          <div className="flex items-center gap-1.5 ml-5.5">
            <Users className="w-3 h-3 text-muted-foreground/50 shrink-0" />
            <span className="text-[10px] text-muted-foreground/50">
              {activeRoom?.memberCount || 0} members
            </span>
            <span className="text-[10px] text-muted-foreground/30">•</span>
            <span className="text-[10px] text-muted-foreground/50">You: </span>
            <AnonBadge name={myAnonName} className="!text-[9px] !py-0 !px-1" />
          </div>
        </div>

        {/* Leave room button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => setShowLeaveConfirm(true)}
          aria-label="Leave room"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain gnect-scroll px-3 py-2">
        {/* Load older messages button */}
        {messagesHasMore && (
          <div className="flex justify-center mb-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={loadOlderMessages}
              className="text-xs text-muted-foreground/50"
            >
              Load older messages
            </Button>
          </div>
        )}

        {messagesLoading ? (
          <div className="space-y-4 py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                <Skeleton className={`h-12 ${i % 2 === 0 ? 'w-40' : 'w-48'} rounded-2xl`} />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <Volume2 className="w-10 h-10 text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground/60 text-center">
              No messages yet
            </p>
            <p className="text-xs text-muted-foreground/40 text-center mt-1">
              Be the first to say something — you&apos;re anonymous!
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_id === currentUser?.id
            const replyToMsg = msg.reply_to_id ? messageMap[msg.reply_to_id] || null : null

            return (
              <GroupBubble
                key={msg.id}
                message={msg}
                isMine={isMine}
                replyTo={replyToMsg}
                onReply={handleReply}
                currentUserId={currentUser?.id || ''}
              />
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply preview bar */}
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="shrink-0 overflow-hidden border-t border-border/30"
          >
            <div className="flex items-center gap-2 px-3 py-2 bg-primary/5">
              <Reply className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-muted-foreground/50 block">
                  Replying to <span className={getAnonColor(replyTo.anonymous_name)}>{replyTo.anonymous_name}</span>
                </span>
                <span className="text-xs text-muted-foreground/70 truncate block">
                  {getReplyPreviewText(replyTo)}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => setReplyTo(null)}
                aria-label="Cancel reply"
              >
                <span className="text-muted-foreground text-sm">✕</span>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area — same pattern as chats-screen */}
      <div className="shrink-0 border-t border-border/30 px-2 py-2 gnect-glass safe-bottom">
        {isRecordingVoice ? (
          <VoiceNoteRecorder
            onSend={handleVoiceNoteSend}
            onCancel={() => setIsRecordingVoice(false)}
          />
        ) : (
          <div className="flex items-center gap-1.5">
            <Input
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder="Message anonymously..."
              className="flex-1 h-10 text-sm bg-secondary/50 border-border/30 rounded-xl"
              disabled={sending || uploadingVoice}
              maxLength={2000}
              autoComplete="off"
            />

            {/* Voice note button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-full"
              onClick={() => setIsRecordingVoice(true)}
              disabled={sending || uploadingVoice || !!messageText.trim()}
              aria-label="Record voice note"
            >
              {uploadingVoice ? (
                <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
              ) : (
                <Mic className="w-5 h-5 text-muted-foreground" />
              )}
            </Button>

            {/* Send button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-full"
              onClick={sendMessage}
              disabled={!messageText.trim() || sending || uploadingVoice}
              aria-label="Send message"
            >
              {sending ? (
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              ) : (
                <Send className={`w-5 h-5 ${messageText.trim() ? 'text-primary' : 'text-muted-foreground/50'}`} />
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Leave Room Confirmation Dialog */}
      <AnimatePresence>
        {showLeaveConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setShowLeaveConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="bg-card rounded-2xl p-5 max-w-xs w-full shadow-xl border border-border/50"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-semibold mb-2">Leave Room?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Your messages will remain visible with your anonymous name. You can rejoin anytime.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setShowLeaveConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {
                    setShowLeaveConfirm(false)
                    leaveRoom()
                  }}
                >
                  Leave
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
