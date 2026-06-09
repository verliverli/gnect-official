'use client'

import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageCircle, Search, ArrowLeft, Send, ImagePlus,
  Check, CheckCheck, EyeOff, Lock, ChevronDown, Shield,
  Ban, Flag, XCircle, Camera, Reply, Trash2,
  Ghost, Loader2, X, Smile, Image, Link2, Star, Mic, RefreshCw
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
// DropdownMenu removed from message bubbles — message options now ONLY via hold (long-press) → action bar
// Still used in chat header for Block/Report/Delete chat
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/lib/store'
import { useDataStore } from '@/lib/data-store'
import { useAppCache, dedupFetch } from '@/lib/app-cache'
import { QUICK_REPLIES, MEDIA_LIMITS, getMediaUrl, containsLink } from '@/lib/constants'
import { toast } from 'sonner'
import { io, Socket } from 'socket.io-client'
import { ChatSelfDestruct } from '@/components/chat-self-destruct'
import { PhotoViewer } from '@/components/photo-viewer'
import { VoiceNoteRecorder } from '@/components/voice-note-recorder'
import { VoiceNotePlayer } from '@/components/voice-note-player'
// StarRating removed — inline star icons used in chat header instead

// ============================================
// Types
// ============================================

interface ChatListItem {
  id: string
  otherUser: {
    id: string
    nickname: string
    photo: string | null
    is_online: boolean
  }
  lastMessage: {
    content: string | null
    sent_at: string
    sender_id: string
    media_type: string | null
    is_view_once: boolean
  } | null
  unreadCount: number
  last_message_at: string
}

interface ChatMessage {
  id: string
  sender_id: string
  content: string | null
  media_url: string | null
  media_type: string | null
  is_view_once: boolean
  view_once_duration: number | null
  viewed: boolean
  is_unsent?: boolean
  reply_to_id: string | null
  delivered: boolean
  sent_at: string
}

// ============================================
// Helper: reply preview text
// Shows "Photo" or "Voice note" for media messages
// instead of raw content (which is null for photos or a number for voice notes)
// ============================================

function getReplyPreviewText(msg: ChatMessage | null): string {
  if (!msg) return '[Message removed]'
  if (msg.content === 'Message was unsent') return 'Message was unsent'
  // Media-type labels — always show these for media messages
  if (msg.media_type === 'voice_note') return 'Voice note'
  if (msg.media_type === 'photo') return 'Photo'
  if (msg.media_type === 'view_once_photo') return 'Locked photo'
  // If no content but has some other media_type
  if (!msg.content && msg.media_type) return '[Message removed]'
  // Text message — show truncated content
  return msg.content?.slice(0, 60) || '[Message removed]'
}

// ============================================
// Helper: relative time
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

// ============================================
// ViewOncePhoto Component — Privacy-first
// ALL photos are view-once. No "normal photo" mode.
// Sender: "Photo sent" → "Viewed & deleted" (after receiver views & deletes)
// Receiver: "Tap to view" → "Photo was viewed and deleted" (after viewing & deleting)
// ============================================

const ViewOncePhoto = memo(function ViewOncePhoto({
  message,
  isMine,
  onReveal,
  onOpenViewer,
}: {
  message: ChatMessage
  isMine: boolean
  onReveal: (messageId: string) => void
  onOpenViewer: (url: string, isViewOnce: boolean, messageId: string) => void
}) {
  // SENDER states
  if (isMine) {
    if (message.is_unsent || message.viewed) {
      // Sender: receiver has viewed & deleted → muted dead card
      return (
        <div className="relative rounded-xl overflow-hidden bg-muted/30 border border-border/20 max-w-[240px]">
          <div className="aspect-[3/4] flex flex-col items-center justify-center gap-2 p-4">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
              <Lock className="w-5 h-5 text-muted-foreground/40" />
            </div>
            <span className="text-xs text-muted-foreground/50 font-medium">Viewed & deleted</span>
            <span className="text-[10px] text-muted-foreground/30">Privacy-first photo</span>
          </div>
        </div>
      )
    }
    // Sender: not yet viewed → "Photo sent" with subtle card
    return (
      <div className="relative rounded-xl overflow-hidden bg-secondary/50 border border-border/50 max-w-[240px]">
        <div className="aspect-[3/4] flex flex-col items-center justify-center gap-2 p-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <span className="text-xs text-primary font-medium">Photo sent</span>
          <span className="text-[10px] text-muted-foreground/50">Privacy-first photo</span>
        </div>
      </div>
    )
  }

  // RECEIVER states
  if (message.is_unsent || message.viewed) {
    // Receiver: photo was viewed and deleted → gray inline info message (not a card)
    return (
      <div className="flex items-center gap-1.5 max-w-[240px] py-1">
        <Lock className="w-3 h-3 text-muted-foreground/30 shrink-0" />
        <span className="text-xs text-muted-foreground/40">Photo was viewed and deleted</span>
      </div>
    )
  }

  // Receiver: not yet viewed → "Tap to view" card
  const photoUrl = message.media_url ? getMediaUrl(message.media_url) : null
  return (
    <button
      onClick={() => {
        if (photoUrl) {
          onOpenViewer(photoUrl, true, message.id)
        }
      }}
      className="relative rounded-xl overflow-hidden bg-secondary/50 border border-primary/20 max-w-[240px] active:scale-95 transition-transform"
    >
      <div className="aspect-[3/4] flex flex-col items-center justify-center gap-2 p-4">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Lock className="w-5 h-5 text-primary" />
        </div>
        <span className="text-xs text-primary font-medium">Tap to view</span>
        <span className="text-[10px] text-muted-foreground/50">Privacy-first photo</span>
      </div>
    </button>
  )
})

// ============================================
// Chat Bubble Component
// ============================================

const ChatBubble = memo(function ChatBubble({
  message,
  isMine,
  replyTo,
  onUnsend,
  onGhostDelete,
  onRevealViewOnce,
  onSelect,
  isSelected,
  onPhotoClick,
  onReply,
  currentUserId,
}: {
  message: ChatMessage
  isMine: boolean
  replyTo: ChatMessage | null
  onUnsend: (messageId: string) => void
  onGhostDelete: (messageId: string) => void
  onRevealViewOnce: (messageId: string) => void
  onSelect: (messageId: string) => void
  isSelected: boolean
  onPhotoClick: (url: string, isViewOnce?: boolean, messageId?: string) => void
  onReply: (message: ChatMessage) => void
  currentUserId: string
}) {
  // Swipe-to-reply state
  const [swipeX, setSwipeX] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const SWIPE_THRESHOLD = 60
  const REPLY_ICON_SHOW = 20

  // Long-press state for hold-to-select (ONLY way to show action bar)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const LONG_PRESS_MS = 400 // 400ms hold = show action bar

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
    }
  }, [])

  // Read receipt — three states: ✓ sent, ✓✓ delivered (gray), ✓✓ read (blue)
  const readReceipt = isMine ? (
    message.viewed ? (
      <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
    ) : message.delivered ? (
      <CheckCheck className="w-3.5 h-3.5 text-muted-foreground/50" />
    ) : (
      <Check className="w-3.5 h-3.5 text-muted-foreground/50" />
    )
  ) : null

  // Long-press handlers — ONLY way to select a message (no tap-to-select)
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() }
    // Start long-press timer — if finger stays still, select the message
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = setTimeout(() => {
      onSelect(message.id)
      // Haptic feedback if available
      if (navigator.vibrate) navigator.vibrate(15)
    }, LONG_PRESS_MS)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    const touch = e.touches[0]
    const dx = touch.clientX - touchStartRef.current.x
    const dy = Math.abs(touch.clientY - touchStartRef.current.y)
    // Cancel long-press on any significant movement
    if (Math.abs(dx) > 8 || dy > 8) {
      if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null }
    }
    // Only allow right-swipe with minimal vertical movement
    if (dx > 10 && dy < 30) {
      setIsSwiping(true)
      setSwipeX(Math.max(0, Math.min(dx, 100)))
    } else if (dx < -10 && dy < 30) {
      setIsSwiping(false)
      setSwipeX(0)
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    // Cancel long-press timer
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null }

    if (!touchStartRef.current) {
      setSwipeX(0)
      setIsSwiping(false)
      return
    }

    // If swiping — check if past threshold for reply
    if (isSwiping && swipeX >= SWIPE_THRESHOLD) {
      onReply(message)
    }
    // TAP does NOTHING — only hold (long-press) selects

    // Reset swipe state
    setSwipeX(0)
    setIsSwiping(false)
    touchStartRef.current = null
  }

  // Desktop: mouse swipe + right-click for long-press
  const mouseStartRef = useRef<{ x: number; time: number } | null>(null)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return // Only left click
    mouseStartRef.current = { x: e.clientX, time: Date.now() }
    // Start long-press timer for desktop hold
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = setTimeout(() => {
      onSelect(message.id)
    }, LONG_PRESS_MS)
  }
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!mouseStartRef.current) return
    const dx = e.clientX - mouseStartRef.current.x
    // Cancel long-press on movement
    if (Math.abs(dx) > 5) {
      if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null }
    }
    if (dx > 10) {
      setIsSwiping(true)
      setSwipeX(Math.max(0, Math.min(dx, 100)))
    }
  }
  const handleMouseUp = () => {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null }
    if (isSwiping && swipeX >= SWIPE_THRESHOLD) {
      onReply(message)
    }
    setSwipeX(0)
    setIsSwiping(false)
    mouseStartRef.current = null
  }
  // Right-click on desktop = instant select (same as long-press)
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    onSelect(message.id)
  }

  // View-once photo
  if (message.media_type === 'view_once_photo') {
    const photoUrl = message.media_url ? getMediaUrl(message.media_url) : null
    return (
      <div
        className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1 ${isSelected ? 'ring-2 ring-primary/60 rounded-xl' : ''} gnect-bubble-enter`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setSwipeX(0); setIsSwiping(false); mouseStartRef.current = null; if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null } }}
        onContextMenu={handleContextMenu}
        style={{ transform: `translateX(${swipeX}px)`, transition: isSwiping ? 'none' : 'transform 0.2s ease-out' }}
      >
        {/* Swipe reply indicator */}
        {swipeX > REPLY_ICON_SHOW && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full pr-2 flex items-center">
            <Reply className="w-5 h-5 text-primary" />
          </div>
        )}
        <ViewOncePhoto message={message} isMine={isMine} onReveal={onRevealViewOnce} onOpenViewer={onPhotoClick as (url: string, isViewOnce: boolean, messageId: string) => void} />
      </div>
    )
  }

  // Voice note (P1.12)
  if (message.media_type === 'voice_note') {
    return (
      <div
        className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1 ${isSelected ? 'ring-2 ring-primary/60 rounded-xl' : ''} gnect-bubble-enter`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setSwipeX(0); setIsSwiping(false); mouseStartRef.current = null; if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null } }}
        onContextMenu={handleContextMenu}
        style={{ transform: `translateX(${swipeX}px)`, transition: isSwiping ? 'none' : 'transform 0.2s ease-out' }}
      >
        {/* Swipe reply indicator */}
        {swipeX > REPLY_ICON_SHOW && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full pr-2 flex items-center">
            <Reply className="w-5 h-5 text-primary" />
          </div>
        )}
        <div className="relative">
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
            {isMine && readReceipt}
          </div>
        </div>
      </div>
    )
  }

  // Regular photo
  if (message.media_type === 'photo' && message.media_url) {
    const photoUrl = getMediaUrl(message.media_url)
    return (
      <div
        className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1 ${isSelected ? 'ring-2 ring-primary/60 rounded-xl' : ''} gnect-bubble-enter`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setSwipeX(0); setIsSwiping(false); mouseStartRef.current = null; if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null } }}
        onContextMenu={handleContextMenu}
        style={{ transform: `translateX(${swipeX}px)`, transition: isSwiping ? 'none' : 'transform 0.2s ease-out' }}
      >
        {/* Swipe reply indicator */}
        {swipeX > REPLY_ICON_SHOW && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full pr-2 flex items-center">
            <Reply className="w-5 h-5 text-primary" />
          </div>
        )}
        <div className="max-w-[240px] order-1">
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

          {/* Photo — NO blur, always show directly */}
          <div className="relative rounded-xl overflow-hidden cursor-pointer">
            <img
              src={photoUrl ?? undefined}
              alt="Photo"
              className="w-full aspect-[3/4] object-cover"
              onClick={(e) => {
                if (!isSwiping && photoUrl) {
                  e.stopPropagation()
                  onPhotoClick(photoUrl)
                }
              }}
            />
          </div>

          <div className={`flex items-center gap-1 mt-0.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
            <span className="text-[10px] text-muted-foreground/50">{formatTime(message.sent_at)}</span>
            {readReceipt}
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
      onMouseLeave={() => { setSwipeX(0); setIsSwiping(false); mouseStartRef.current = null; if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null } }}
      onContextMenu={handleContextMenu}
      style={{ transform: `translateX(${swipeX}px)`, transition: isSwiping ? 'none' : 'transform 0.2s ease-out' }}
    >
      {/* Swipe reply indicator */}
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
        } ${isSelected ? 'ring-2 ring-primary/60' : ''}`}
      >
        {/* Reply preview */}
        {replyTo && (
          <div className={`text-[10px] px-3 pt-2 pb-0.5 rounded-t-2xl ${
            isMine ? 'bg-primary/10 text-primary/80' : 'bg-secondary/80 text-muted-foreground'
          }`}>
            <span className="font-medium truncate block">
              {getReplyPreviewText(replyTo)}
            </span>
          </div>
        )}

        {/* Content — NO hover dropdown. Only hold (long-press) shows action bar */}
        <div className="px-3 py-2">
          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
          <div className={`flex items-center gap-1 mt-0.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
            <span className="text-[10px] text-muted-foreground/50">{formatTime(message.sent_at)}</span>
            {readReceipt}
          </div>
        </div>
      </div>
    </div>
  )
})

// ============================================
// Main ChatsScreen Component
// ============================================

export function ChatsScreen({ openChatWithUserId, onChatOpened, onUnreadCountChange }: { openChatWithUserId?: string | null; onChatOpened?: () => void; onUnreadCountChange?: (count: number) => void }) {
  const { user: currentUser, disappearMode } = useAuthStore()
  const dataStore = useDataStore
  const appCache = useAppCache

  // Read cached chat list from store for instant rendering
  const cachedChatList = dataStore((s) => s.chatList)

  // ⚡ SPOTLIGHT INSTANT NAVIGATION — Skip chat list, go directly to messaging
  // When openChatWithUserId is set (from Spotlight MESSAGE button), initialize in 'chat' view
  // with optimistic user data from preload or discover cache. No flash of chat list!
  const _spotlightPreload = openChatWithUserId ? dataStore.getState().getChatPreload(openChatWithUserId) : null
  const _optimisticUser = (() => {
    if (!openChatWithUserId) return null
    // Best: from preload cache (has chatId, full user data, messages)
    if (_spotlightPreload?.otherUser) return _spotlightPreload.otherUser
    // Good: from discover data in dataStore (has name/avatar from nearby/all lists)
    const discoverUser = dataStore.getState().nearbyUsers.find(u => u.id === openChatWithUserId)
      || dataStore.getState().allUsers.find(u => u.id === openChatWithUserId)
    if (discoverUser) {
      return {
        id: discoverUser.id,
        nickname: discoverUser.nickname,
        photo: discoverUser.photos?.[0] ? getMediaUrl(discoverUser.photos[0].catbox_url) : null,
        is_online: discoverUser.is_online,
      }
    }
    // Fallback: generic placeholder (handleOpenChatWithUser will replace with real data)
    return { id: openChatWithUserId, nickname: 'User', photo: null, is_online: false }
  })()

  // Phase 6: Self-destruct timer state — initialize from preload if available
  const [selfDestructHours, setSelfDestructHours] = useState<number | null>(_spotlightPreload?.selfDestructHours ?? null)

  // Phase 6: Block/Report confirmation dialogs
  const [showBlockConfirm, setShowBlockConfirm] = useState(false)
  const [showReportConfirm, setShowReportConfirm] = useState<string | null>(null)

  // View state — If opening from Spotlight, start directly in 'chat' view (skip list!)
  const [view, setView] = useState<'list' | 'chat'>(openChatWithUserId ? 'chat' : 'list')
  const [activeChatId, setActiveChatId] = useState<string | null>(_spotlightPreload?.chatId || null)
  const [activeChatUser, setActiveChatUser] = useState<{ id: string; nickname: string; photo: string | null; is_online: boolean } | null>(_optimisticUser)

  // Chat list state — initialize from cache for instant rendering
  const [chats, setChats] = useState<ChatListItem[]>(cachedChatList)
  const [chatsLoading, setChatsLoading] = useState(cachedChatList.length === 0)
  const [chatsCursor, setChatsCursor] = useState<string | null>(null)
  const [chatsHasMore, setChatsHasMore] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Messages state — initialize from preload if available (instant messages from Spotlight!)
  const [messages, setMessages] = useState<ChatMessage[]>(_spotlightPreload?.messages ? _spotlightPreload.messages as ChatMessage[] : [])
  // ⚡ From Spotlight: NEVER show loading spinner — show "Say hey" empty state instantly
  // If no preload yet, the chat will be created in background and messages will appear when ready
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messagesCursor, setMessagesCursor] = useState<string | null>(_spotlightPreload?.nextCursor || null)
  const [messagesHasMore, setMessagesHasMore] = useState(!!_spotlightPreload?.nextCursor)

  // Input state
  const [messageText, setMessageText] = useState('')
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  // viewOnceMode removed — ALL photos are privacy-first (view_once_photo) by default

  // Photo preview before send
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)

  // Voice note recording state — P1.12
  const [isRecordingVoice, setIsRecordingVoice] = useState(false)
  const [uploadingVoice, setUploadingVoice] = useState(false)

  // Typing indicator — Bug 8: scoped to chat ID, not just boolean
  const [typingChatId, setTypingChatId] = useState<string | null>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Message action bar (long-press selection)
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null)

  // Inline rating in chat header (replaces popup)
  const [chatRating, setChatRating] = useState<number | null>(_spotlightPreload?.myRating ?? null)

  // Photo viewer — Bug 3: modern animated viewer with view-once support
  const [viewerImageUrl, setViewerImageUrl] = useState<string | null>(null)
  const [viewerIsViewOnce, setViewerIsViewOnce] = useState(false)
  const [viewerViewOnceMessageId, setViewerViewOnceMessageId] = useState<string | null>(null)

  const handlePhotoClick = useCallback((url: string, isViewOnce = false, messageId = '') => {
    setViewerImageUrl(url)
    setViewerIsViewOnce(isViewOnce)
    setViewerViewOnceMessageId(messageId || null)
    // Mark view-once as viewed when opening the viewer
    if (isViewOnce && messageId && activeChatId) {
      fetch(`/api/chat/${activeChatId}/view-once?messageId=${messageId}`, {
        method: 'PUT',
        credentials: 'same-origin',
      }).then(() => {
        socketRef.current?.emit('view-once-opened', { chatId: activeChatId, messageId })
        // Update local messages state to mark as viewed
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, viewed: true } : m))
        )
      }).catch(() => {})
    }
  }, [activeChatId])

  const handleViewerClose = useCallback(() => {
    setViewerImageUrl(null)
    setViewerIsViewOnce(false)
    setViewerViewOnceMessageId(null)
  }, [])

  // View-once: delete photo from both sides → mark as viewed & null media (NOT remove from chat)
  const handleDeleteBothSides = useCallback(async () => {
    // Capture values IMMEDIATELY before any state changes can nullify them
    const chatId = activeChatId
    const messageId = viewerViewOnceMessageId
    if (!chatId || !messageId) return

    try {
      // Use the dedicated view-once DELETE endpoint (allows RECEIVER to delete, unlike /unsend)
      const res = await fetch(`/api/chat/${chatId}/view-once?messageId=${messageId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      const data = await res.json()

      if (data.ok) {
        // Update message to placeholder instead of removing it
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, viewed: true, media_url: null, media_type: 'view_once_photo', is_unsent: true }
              : m
          )
        )
        // Emit socket event so the other side's chat UI updates in real-time
        socketRef.current?.emit('view-once-deleted', { chatId, messageId })
        toast.success('Photo deleted')
      } else {
        toast.error(data.error || 'Failed to delete')
      }
    } catch {
      toast.error('Network error')
    }
  }, [activeChatId, viewerViewOnceMessageId])

  // Socket.io
  const socketRef = useRef<Socket | null>(null)

  // Photo upload ref
  const photoInputRef = useRef<HTMLInputElement>(null)

  // Scroll refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatListRef = useRef<HTMLDivElement>(null)

  // ============================================
  // Socket.io Connection — connects ONCE per session, not per chat
  // ============================================

  useEffect(() => {
    if (!currentUser) return

    // Socket.io server URL — Bug 15: use env var only, no hardcoded fallback
    const envSocketUrl = process.env.NEXT_PUBLIC_SOCKET_URL
    if (!envSocketUrl) {
      console.warn('NEXT_PUBLIC_SOCKET_URL is not set — real-time features disabled')
      return
    }

    // Determine socket URL: if env points to localhost, use gateway proxy instead
    const isLocalhost = envSocketUrl.includes('localhost') || envSocketUrl.includes('127.0.0.1')
    const socketUrl = isLocalhost ? window.location.origin : envSocketUrl

    const socketOpts: Parameters<typeof io>[1] = {
      path: '/socket.io',       // Explicit path for HuggingFace Spaces
      query: {
        userId: currentUser.id,
        ...(isLocalhost ? { XTransformPort: '3003' } : {}),
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 30,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
      timeout: 10000,
    }

    const socket = io(socketUrl, socketOpts)

    socket.on('connect', () => {
      // Connected to chat service
    })

    socket.on('new-message', (data: { chatId: string; message: ChatMessage }) => {
      // Use functional update to access latest activeChatId via ref
      setActiveChatId((currentChatId) => {
        if (data.chatId === currentChatId) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.message.id)) return prev
            return [...prev, data.message]
          })
          requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }))
          // Emit delivery receipt back to sender
          socket.emit('message-delivered-receipt', { chatId: data.chatId, messageId: data.message.id })
        }
        return currentChatId // Don't change the ID, just read it
      })
      // Refresh chat list
      fetchChats(true)
    })

    // Bug 8: typing indicator scoped to chat ID
    socket.on('typing', (data: { chatId: string; userId: string; nickname: string }) => {
      if (data.userId !== currentUser.id) {
        setTypingChatId(data.chatId)
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = setTimeout(() => setTypingChatId(null), 3000)
      }
    })

    socket.on('stop-typing', (data: { chatId: string; userId: string }) => {
      if (data.userId !== currentUser.id) {
        setTypingChatId((prev) => prev === data.chatId ? null : prev)
      }
    })

    socket.on('message-delivered', (data: { chatId: string; messageId: string }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === data.messageId ? { ...m, delivered: true } : m))
      )
    })

    socket.on('message-viewed', (data: { chatId: string; messageId: string }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === data.messageId ? { ...m, viewed: true } : m))
      )
    })

    // view-once-opened — sender sees "Viewed & deleted" in real-time
    socket.on('view-once-opened', (data: { chatId: string; messageId: string }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === data.messageId ? { ...m, viewed: true } : m))
      )
    })

    // view-once-deleted — photo was viewed and deleted, show placeholder (not remove)
    socket.on('view-once-deleted', (data: { chatId: string; messageId: string }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId ? { ...m, viewed: true, media_url: null, is_unsent: true } : m
        )
      )
    })

    socket.on('message-unsent', (data: { chatId: string; messageId: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== data.messageId))
    })

    socket.on('chat-updated', () => {
      fetchChats(true)
    })

    socket.on('chat-deleted', (data: { chatId: string; deletedBy: string }) => {
      // If we're in this chat, close it immediately — other person deleted it
      if (data.chatId) {
        setMessages([])
        setView('list')
        setActiveChatId(null)
        setActiveChatUser(null)
        // P1.13: Dispatch active chat cleared for screenshot notification
        window.dispatchEvent(new CustomEvent('gnect-active-chat-change', { detail: { chatId: null } }))
        toast('Chat was deleted by the other person', { icon: <Lock className="w-4 h-4" /> })
      }
      // Refresh chat list to remove the deleted chat
      fetchChats(true)
    })

    socketRef.current = socket

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [currentUser]) // Only reconnect when user changes — NOT when activeChatId changes

  // Join/leave chat rooms when activeChatId changes (separate from socket connection)
  useEffect(() => {
    if (!activeChatId || !socketRef.current) return

    socketRef.current.emit('join-chat', { chatId: activeChatId })

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave-chat', { chatId: activeChatId })
      }
    }
  }, [activeChatId])

  // Auto-cache messages for active chat whenever they change (for instant reopen)
  useEffect(() => {
    if (activeChatId && messages.length > 0) {
      dataStore.getState().setChatMessages(activeChatId, messages)
    }
  }, [activeChatId, messages.length])

  // ============================================
  // Fetch Chat List
  // ============================================

  const fetchChats = useCallback(async (refresh = false, silent = false) => {
    if (!currentUser) return

    // If data is fresh and this is a refresh, skip the fetch entirely
    if (refresh && !appCache.getState().isStale('chatList') && dataStore.getState().chatList.length > 0) return

    const hasCachedData = dataStore.getState().chatList.length > 0

    try {
      const paramsKey = refresh ? 'chatlist-refresh' : `chatlist-${chatsCursor || 'first'}`

      await dedupFetch(paramsKey, async () => {
        const params = new URLSearchParams()
        if (!refresh && chatsCursor) params.set('cursor', chatsCursor)

        const res = await fetch(`/api/chat/list?${params.toString()}`, { credentials: 'same-origin' })
        const data = await res.json()

        if (data.ok) {
          if (refresh || !chatsCursor) {
            setChats(data.data || [])
            // Update data store cache
            dataStore.getState().setChatList(data.data || [])
            appCache.getState().setTimestamp('chatList')
          } else {
            setChats((prev) => [...prev, ...(data.data || [])])
          }
          setChatsCursor(data.nextCursor || null)
          setChatsHasMore(!!data.nextCursor)
        }
      })
    } catch {
      // Silent fail for background refresh
    } finally {
      if (!silent || !hasCachedData) setChatsLoading(false)
      else setChatsLoading(false) // Always clear loading even for silent
    }
  }, [currentUser, chatsCursor, dataStore, appCache])

  useEffect(() => {
    if (currentUser) {
      // If data is fresh and cache exists, skip fetch entirely
      if (!appCache.getState().isStale('chatList') && cachedChatList.length > 0) {
        return
      }
      if (cachedChatList.length > 0) {
        // Cached data exists (stale) — show it instantly, refresh silently in background
        fetchChats(true, true)
      } else {
        fetchChats(true)
      }
    }
  }, [currentUser])

  // Note: No periodic polling — Socket.io events (new-message, chat-updated) handle real-time updates.
  // Polling was removed to eliminate redundant API calls that duplicate socket events.

  // ============================================
  // Open Chat (from external trigger like Spotlight)
  // ============================================

  // Track whether we already initialized from preload on mount (skip redundant init)
  const spotlightInitRef = useRef(!!_spotlightPreload?.chatId)

  useEffect(() => {
    if (openChatWithUserId && currentUser) {
      // ⚡ If we already initialized from preload on mount, just do cleanup + background refresh
      if (spotlightInitRef.current && _spotlightPreload?.chatId) {
        const chatId = _spotlightPreload.chatId

        // 🚫 DON'T add empty chats to local list — only chats with messages belong there
        // The chat will be added to the list automatically when fetchChats runs after a message is sent

        // Dispatch active chat change for screenshot notification
        window.dispatchEvent(new CustomEvent('gnect-active-chat-change', { detail: { chatId } }))

        // Clean up preload cache — no longer needed
        dataStore.getState().clearChatPreload(openChatWithUserId)

        // Notify AppShell that the chat has been opened
        onChatOpened?.()

        // Scroll to bottom of messages
        requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView())

        // Background refresh: silently re-fetch messages to ensure we have the latest
        // (in case new messages arrived between preload and click)
        const preloadMsgCount = _spotlightPreload.messages?.length || 0
        fetch(`/api/chat/${chatId}/open`, { credentials: 'same-origin' })
          .then((r) => r.json())
          .then((d) => {
            if (d.ok) {
              const freshMsgs = d.data.messages || []
              // Only update if there are new messages (don't re-render for same data)
              if (freshMsgs.length > preloadMsgCount) {
                setMessages(freshMsgs)
                setMessagesCursor(d.data.nextCursor || null)
                setMessagesHasMore(!!d.data.nextCursor)
                setSelfDestructHours(d.data.selfDestructHours)
                setChatRating(d.data.myRating)
                dataStore.getState().setChatMessages(chatId, freshMsgs)
                requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView())
              }
            }
          })
          .catch(() => {})

        return // ✅ Done — already initialized from preload on mount!
      }

      // No preload or not initialized — use original flow (API calls)
      handleOpenChatWithUser(openChatWithUserId)
    }
  }, [openChatWithUserId, currentUser])

  const handleOpenChatWithUser = async (userId: string) => {
    // ⚡ INSTANT: Check if Spotlight already preloaded this chat
    const preloaded = dataStore.getState().getChatPreload(userId)

    if (preloaded && !preloaded.error && preloaded.chatId) {
      // ✅ PRELOADED — Open chat INSTANTLY with cached data, zero API calls
      const { chatId, otherUser, messages, nextCursor, selfDestructHours, myRating } = preloaded

      // 🚫 DON'T add empty chats to local list — only chats with messages belong there
      // The chat will appear in the list after the first message is sent (fetchChats refreshes from API)

      // Open chat with PRELOADED data — instant render!
      setActiveChatId(chatId)
      setActiveChatUser(otherUser)
      setView('chat')
      window.dispatchEvent(new CustomEvent('gnect-active-chat-change', { detail: { chatId } }))
      setMessagesCursor(nextCursor)
      setMessagesHasMore(!!nextCursor)
      setReplyTo(null)
      setTypingChatId(null)
      setSelectedMessage(null)
      setChatRating(myRating)
      setSelfDestructHours(selfDestructHours)
      setMessages(messages)
      setMessagesLoading(false)
      requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView())

      // Clean up preload cache — no longer needed
      dataStore.getState().clearChatPreload(userId)

      // Notify AppShell that the chat has been opened
      onChatOpened?.()

      // Background refresh: silently re-fetch messages to ensure we have the latest
      // (in case new messages arrived between preload and click)
      fetch(`/api/chat/${chatId}/open`, { credentials: 'same-origin' })
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) {
            const freshMsgs = d.data.messages || []
            // Only update if there are new messages (don't re-render for same data)
            if (freshMsgs.length > messages.length) {
              setMessages(freshMsgs)
              setMessagesCursor(d.data.nextCursor || null)
              setMessagesHasMore(!!d.data.nextCursor)
              setSelfDestructHours(d.data.selfDestructHours)
              setChatRating(d.data.myRating)
              dataStore.getState().setChatMessages(chatId, freshMsgs)
              requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView())
            }
          }
        })
        .catch(() => {})

      return // ✅ Done — no API calls needed for initial render!
    }

    // Fallback: Preload not available — use original flow (chat create + profile + open)
    // This handles: first visit, expired preload, direct chat list click
    try {
      const [chatRes, profileRes] = await Promise.all([
        fetch('/api/chat/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
          credentials: 'same-origin',
        }),
        fetch(`/api/profile/${userId}`, { credentials: 'same-origin' }),
      ])

      const data = await chatRes.json()
      const profileData = await profileRes.json()

      if (data.ok) {
        const otherUser = profileData.ok
          ? {
              id: userId,
              nickname: profileData.data.nickname,
              photo: getMediaUrl(profileData.data.photos?.[0]?.catbox_url) ?? null,
              is_online: profileData.data.is_online,
            }
          : { id: userId, nickname: 'User', photo: null, is_online: false }

        // 🚫 DON'T add empty chats to local list — only chats with messages belong there
        // The chat will appear in the list after the first message is sent

        openChat(data.data.id, otherUser, true) // skipLoading=true → show "Say hey" instead of spinner
        // Notify AppShell that the chat has been opened so it clears chatWithUserId
        onChatOpened?.()
      } else {
        toast.error(data.error || 'Failed to start chat')
      }
    } catch {
      toast.error('Network error')
    }
  }

  // ============================================
  // Open/Close Chat
  // ============================================

  const openChat = useCallback((chatId: string, otherUser: ChatListItem['otherUser'], skipLoading = false) => {
    setActiveChatId(chatId)
    setActiveChatUser(otherUser)
    setView('chat')
    // P1.13: Dispatch active chat change for screenshot notification
    window.dispatchEvent(new CustomEvent('gnect-active-chat-change', { detail: { chatId } }))
    setMessagesCursor(null)
    setReplyTo(null)
    setTypingChatId(null)
    setSelectedMessage(null)
    setChatRating(null)

    // INSTANT: Show cached messages immediately if available
    const cachedMsgs = dataStore.getState().getChatMessages(chatId)
    if (cachedMsgs.length > 0) {
      setMessages(cachedMsgs)
      setMessagesLoading(false)
      requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView())
    } else {
      setMessages([])
      // ⚡ From Spotlight: skip loading spinner — show "Say hey" empty state instead
      // The API fetch will populate messages when ready
      setMessagesLoading(!skipLoading)
    }

    // SINGLE combined API call — replaces 4 separate calls for maximum speed
    // Returns messages + self-destruct timer + rating + marks delivered
    fetch(`/api/chat/${chatId}/open`, { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          const msgs = d.data.messages || []
          setMessages(msgs)
          setMessagesCursor(d.data.nextCursor || null)
          setMessagesHasMore(!!d.data.nextCursor)
          setSelfDestructHours(d.data.selfDestructHours)
          setChatRating(d.data.myRating)
          // Cache messages for instant reopen
          dataStore.getState().setChatMessages(chatId, msgs)
          // Scroll to bottom
          requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView())
        } else {
          if (cachedMsgs.length === 0) {
            toast.error(d.error || 'Failed to load chat')
          }
        }
      })
      .catch(() => {
        if (cachedMsgs.length === 0) {
          toast.error('Network error')
        }
      })
      .finally(() => {
        setMessagesLoading(false)
      })
    // Socket room joining is handled by the activeChatId useEffect above
  }, [])

  const doCloseChat = useCallback(() => {
    // Cache messages before closing so reopening is instant
    if (activeChatId && messages.length > 0) {
      dataStore.getState().setChatMessages(activeChatId, messages)
    }
    // 🚫 If this chat has NO messages, remove it from local list
    // Empty chats shouldn't appear in chat list (only chats with actual messages)
    if (activeChatId && messages.length === 0) {
      setChats((prev) => prev.filter((c) => c.id !== activeChatId))
    }
    // P1.13: Dispatch active chat cleared for screenshot notification
    window.dispatchEvent(new CustomEvent('gnect-active-chat-change', { detail: { chatId: null } }))
    setActiveChatId(null)
    setActiveChatUser(null)
    setView('list')
    setMessages([])
    setMessagesCursor(null)
    setReplyTo(null)
    setSelectedMessage(null)
    setChatRating(null)
    setSelfDestructHours(null)
    setPhotoPreview(null)
    setPhotoFile(null)
    fetchChats(true)
  }, [activeChatId, messages, fetchChats])

  const closeChat = useCallback(() => {
    // No more rating popup — just close directly. Rating is done inline in the chat header.
    doCloseChat()
  }, [doCloseChat])

  // ============================================
  // Fetch Messages
  // ============================================

  const fetchMessages = useCallback(async (chatId: string, append = false) => {
    if (!currentUser) return

    if (!append) setMessagesLoading(true)
    else setMessagesLoading(true)
    try {
      const params = new URLSearchParams()
      if (append && messagesCursor) params.set('cursor', messagesCursor)

      const res = await fetch(`/api/chat/${chatId}/messages?${params.toString()}`, { credentials: 'same-origin' })
      const data = await res.json()

      if (data.ok) {
        const newMessages = data.data || []
        if (append) {
          setMessages((prev) => [...newMessages, ...prev])
        } else {
          setMessages(newMessages)
          // Cache messages for instant reopen
          dataStore.getState().setChatMessages(chatId, newMessages)
        }
        setMessagesCursor(data.nextCursor || null)
        setMessagesHasMore(!!data.nextCursor)

        // Scroll to bottom on initial load
        if (!append) {
          requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView())
        }
      }
    } catch {
      toast.error('Failed to load messages')
    } finally {
      setMessagesLoading(false)
    }
  }, [currentUser, messagesCursor])

  // ============================================
  // Mark Messages as Read (BUG 8 fix — no auto-mark on open)
  // ============================================

  const markMessagesAsRead = useCallback(async () => {
    if (!activeChatId || !currentUser) return

    // Get IDs of unread messages from the other user
    // EXCLUDE view-once photos — they must only be marked as viewed
    // when the receiver explicitly taps → fullscreen → closes (via /view-once API)
    const unreadIds = messages
      .filter((m) => m.sender_id !== currentUser.id && !m.viewed && m.media_type !== 'view_once_photo')
      .map((m) => m.id)

    if (unreadIds.length === 0) return

    try {
      await fetch(`/api/chat/${activeChatId}/mark-read`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageIds: unreadIds }),
        credentials: 'same-origin',
      })

      // Update local state — only non-view-once messages
      setMessages((prev) =>
        prev.map((m) =>
          unreadIds.includes(m.id) ? { ...m, viewed: true } : m
        )
      )

      // Notify via socket so sender sees blue ticks
      unreadIds.forEach((id) => {
        socketRef.current?.emit('message-viewed', { chatId: activeChatId, messageId: id })
      })
    } catch {
      // Silent fail — will retry on next scroll or timer
    }
  }, [activeChatId, currentUser, messages])

  // Mark messages as read after they're visible (with 1.5s delay)
  useEffect(() => {
    if (!activeChatId || view !== 'chat') return

    const timer = setTimeout(() => {
      markMessagesAsRead()
    }, 1500)

    return () => clearTimeout(timer)
  }, [activeChatId, view, messages.length, markMessagesAsRead])

  // Load more messages on scroll up
  const handleMessageScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.target as HTMLDivElement
    if (el.scrollTop < 100 && messagesHasMore && !messagesLoading) {
      fetchMessages(activeChatId!, true)
    }
    // Mark messages as read when user scrolls
    markMessagesAsRead()
  }, [activeChatId, messagesHasMore, messagesLoading, fetchMessages, markMessagesAsRead])

  // ============================================
  // Send Message
  // ============================================

  const handleSend = useCallback(async () => {
    if (!activeChatId || (!messageText.trim() && !replyTo) || sending) return

    const textToSend = messageText.trim()
    const replyToSend = replyTo
    setSending(true)

    // === OPTIMISTIC UPDATE: Show message in UI INSTANTLY ===
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const optimisticMsg: ChatMessage = {
      id: tempId,
      sender_id: currentUser!.id,
      content: textToSend,
      media_url: null,
      media_type: null,
      is_view_once: false,
      view_once_duration: null,
      viewed: false,
      delivered: false,
      reply_to_id: replyToSend?.id || null,
      sent_at: new Date().toISOString(),
    }

    // Add to UI immediately — FLASH fast
    setMessages((prev) => [...prev, optimisticMsg])
    setMessageText('')
    setReplyTo(null)

    // Scroll to bottom instantly
    requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }))

    // Stop typing indicator
    socketRef.current?.emit('stop-typing', { chatId: activeChatId, userId: currentUser!.id })

    // Send to server in background
    try {
      const res = await fetch(`/api/chat/${activeChatId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: textToSend,
          reply_to_id: replyToSend?.id || null,
        }),
        credentials: 'same-origin',
      })
      const data = await res.json()

      if (data.ok) {
        // Replace temp message with real one (has server ID and timestamp)
        const realMsg: ChatMessage = {
          id: data.data.id,
          sender_id: currentUser!.id,
          content: textToSend,
          media_url: null,
          media_type: null,
          is_view_once: false,
          view_once_duration: null,
          viewed: false,
          delivered: false,
          reply_to_id: replyToSend?.id || null,
          sent_at: data.data.sent_at,
        }

        setMessages((prev) => prev.map((m) => m.id === tempId ? realMsg : m))

        // Emit via socket so other user gets it
        socketRef.current?.emit('send-message', {
          chatId: activeChatId,
          message: realMsg,
        })

        // ✅ Add this chat to local list NOW (first message sent!)
        // This ensures the chat appears in the list when going back,
        // even before the API refresh completes
        if (activeChatUser) {
          const chatItem: ChatListItem = {
            id: activeChatId,
            otherUser: activeChatUser,
            lastMessage: {
              content: textToSend,
              sent_at: data.data.sent_at,
              sender_id: currentUser!.id,
              media_type: null,
              is_view_once: false,
            },
            unreadCount: 0,
            last_message_at: data.data.sent_at,
          }
          setChats((prev) => {
            const existing = prev.findIndex((c) => c.id === activeChatId)
            if (existing >= 0) {
              // Update existing entry with new last message
              const updated = [...prev]
              updated[existing] = { ...updated[existing], lastMessage: chatItem.lastMessage, last_message_at: chatItem.last_message_at }
              return updated
            }
            return [chatItem, ...prev]
          })
        }

        // Update chat list from server
        fetchChats(true)
      } else {
        // Server rejected — remove optimistic message and show error
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
        toast.error(data.error || 'Failed to send')
      }
    } catch {
      // Network error — remove optimistic message
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      toast.error('Network error')
    } finally {
      setSending(false)
    }
  }, [activeChatId, messageText, replyTo, sending, currentUser, fetchChats])

  // ============================================
  // Typing Indicator
  // ============================================

  const handleTyping = useCallback((value: string) => {
    setMessageText(value)

    if (!activeChatId || !currentUser) return

    // Emit typing
    socketRef.current?.emit('typing', {
      chatId: activeChatId,
      userId: currentUser.id,
      nickname: currentUser.nickname,
    })

    // Auto stop typing after 3 seconds of inactivity
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit('stop-typing', {
        chatId: activeChatId!,
        userId: currentUser!.id,
      })
    }, 3000)
  }, [activeChatId, currentUser])

  // ============================================
  // Photo Upload
  // ============================================

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeChatId) return

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Only JPEG, PNG, and WebP allowed')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Photo must be under 2MB')
      return
    }

    // Show preview instead of uploading immediately
    const reader = new FileReader()
    reader.onload = (ev) => {
      setPhotoPreview(ev.target?.result as string)
      setPhotoFile(file)
    }
    reader.readAsDataURL(file)
  }

  // Confirm photo send — actually upload and send
  const handleConfirmPhotoSend = useCallback(async () => {
    if (!photoFile || !activeChatId) return

    setUploading(true)
    setPhotoPreview(null)
    try {
      // Upload to Catbox
      const formData = new FormData()
      formData.append('photo', photoFile)

      const uploadRes = await fetch(`/api/chat/${activeChatId}/upload-media`, {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
      })
      const uploadData = await uploadRes.json()

      if (!uploadData.ok) {
        toast.error(uploadData.error || 'Upload failed')
        return
      }

      // ALL photos are privacy-first view-once — no more normal photo mode
      const isViewOnce = true
      const mediaType = 'view_once_photo'

      const res = await fetch(`/api/chat/${activeChatId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_url: uploadData.data.url,
          media_type: mediaType,
          is_view_once: isViewOnce,
          reply_to_id: replyTo?.id || null,
        }),
        credentials: 'same-origin',
      })
      const data = await res.json()

      if (data.ok) {
        const newMsg: ChatMessage = {
          id: data.data.id,
          sender_id: currentUser!.id,
          content: null,
          media_url: uploadData.data.url,
          media_type: mediaType,
          is_view_once: isViewOnce,
          view_once_duration: null,
          viewed: false,
          delivered: false,
          reply_to_id: replyTo?.id || null,
          sent_at: data.data.sent_at,
        }

        setMessages((prev) => [...prev, newMsg])
        setReplyTo(null)

        socketRef.current?.emit('send-message', {
          chatId: activeChatId,
          message: newMsg,
        })

        // ✅ Add this chat to local list NOW (first message — photo sent!)
        if (activeChatUser) {
          const chatItem: ChatListItem = {
            id: activeChatId,
            otherUser: activeChatUser,
            lastMessage: {
              content: null,
              sent_at: data.data.sent_at,
              sender_id: currentUser!.id,
              media_type: mediaType,
              is_view_once: isViewOnce,
            },
            unreadCount: 0,
            last_message_at: data.data.sent_at,
          }
          setChats((prev) => {
            const existing = prev.findIndex((c) => c.id === activeChatId)
            if (existing >= 0) {
              const updated = [...prev]
              updated[existing] = { ...updated[existing], lastMessage: chatItem.lastMessage, last_message_at: chatItem.last_message_at }
              return updated
            }
            return [chatItem, ...prev]
          })
        }

        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      } else {
        toast.error(data.error || 'Failed to send photo')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setUploading(false)
      setPhotoFile(null)
      if (photoInputRef.current) photoInputRef.current.value = ''
    }
  }, [photoFile, activeChatId, currentUser, replyTo])

  const handleCancelPhotoPreview = useCallback(() => {
    setPhotoPreview(null)
    setPhotoFile(null)
    if (photoInputRef.current) photoInputRef.current.value = ''
  }, [])

  // ============================================
  // Voice Note Send (P1.12) — Record → Upload → Send
  // ============================================

  const handleVoiceNoteSend = useCallback(async (audioBlob: Blob, durationSeconds: number) => {
    if (!activeChatId) return

    setIsRecordingVoice(false)
    setUploadingVoice(true)

    try {
      // Step 1: Upload voice note to Telegram
      const formData = new FormData()
      formData.append('audio', audioBlob, 'voice_note.webm')
      formData.append('duration', durationSeconds.toString())

      const uploadRes = await fetch(`/api/chat/${activeChatId}/upload-voice`, {
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
      const res = await fetch(`/api/chat/${activeChatId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_url: uploadData.data.url,
          media_type: 'voice_note',
          content: durationSeconds.toString(), // Store duration in content field
          reply_to_id: replyTo?.id || null,
        }),
        credentials: 'same-origin',
      })
      const data = await res.json()

      if (data.ok) {
        const newMsg: ChatMessage = {
          id: data.data.id,
          sender_id: currentUser!.id,
          content: durationSeconds.toString(),
          media_url: uploadData.data.url,
          media_type: 'voice_note',
          is_view_once: false,
          view_once_duration: null,
          viewed: false,
          delivered: false,
          reply_to_id: replyTo?.id || null,
          sent_at: data.data.sent_at,
        }

        setMessages((prev) => [...prev, newMsg])
        setReplyTo(null)

        socketRef.current?.emit('send-message', {
          chatId: activeChatId,
          message: newMsg,
        })

        // ✅ Add chat to local list (same as text message)
        if (activeChatUser) {
          const chatItem: ChatListItem = {
            id: activeChatId,
            otherUser: activeChatUser,
            lastMessage: {
              content: null,
              sent_at: data.data.sent_at,
              sender_id: currentUser!.id,
              media_type: 'voice_note',
              is_view_once: false,
            },
            unreadCount: 0,
            last_message_at: data.data.sent_at,
          }
          setChats((prev) => {
            const existing = prev.findIndex((c) => c.id === activeChatId)
            if (existing >= 0) {
              const updated = [...prev]
              updated[existing] = { ...updated[existing], lastMessage: chatItem.lastMessage, last_message_at: chatItem.last_message_at }
              return updated
            }
            return [chatItem, ...prev]
          })
        }

        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        fetchChats(true)
      } else {
        toast.error(data.error || 'Failed to send voice note')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setUploadingVoice(false)
    }
  }, [activeChatId, currentUser, replyTo, activeChatUser, fetchChats])

  const handleVoiceNoteCancel = useCallback(() => {
    setIsRecordingVoice(false)
  }, [])

  // ============================================
  // View-Once Photo Reveal
  // ============================================

  const handleRevealViewOnce = useCallback(async (messageId: string) => {
    if (!activeChatId) return

    try {
      await fetch(`/api/chat/${activeChatId}/view-once?messageId=${messageId}`, {
        method: 'PUT',
        credentials: 'same-origin',
      })

      socketRef.current?.emit('view-once-opened', { chatId: activeChatId, messageId })
    } catch {
      // Silent fail
    }
  }, [activeChatId])

  // ============================================
  // Unsend / Ghost Delete
  // ============================================

  const handleUnsend = useCallback(async (messageId: string) => {
    if (!activeChatId) return

    try {
      const res = await fetch(`/api/chat/${activeChatId}/unsend?messageId=${messageId}`, {
        method: 'PUT',
        credentials: 'same-origin',
      })
      const data = await res.json()

      if (data.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId))
        socketRef.current?.emit('message-unsent', { chatId: activeChatId, messageId })
        toast.success('Message unsent')
      } else {
        toast.error(data.error || 'Failed')
      }
    } catch {
      toast.error('Network error')
    }
  }, [activeChatId])

  const handleGhostDelete = useCallback(async (messageId: string) => {
    if (!activeChatId) return

    try {
      const res = await fetch(`/api/chat/${activeChatId}/ghost-delete?messageId=${messageId}`, {
        method: 'PUT',
        credentials: 'same-origin',
      })
      const data = await res.json()

      if (data.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId))
        toast.success('Deleted for you')
      } else {
        toast.error(data.error || 'Failed')
      }
    } catch {
      toast.error('Network error')
    }
  }, [activeChatId])

  // ============================================
  // Quick Reply
  // ============================================

  const handleQuickReply = useCallback((text: string) => {
    setMessageText(text)
    // Focus input
  }, [])

  // ============================================
  // Block/Report from Chat
  // ============================================

  const handleBlockFromChat = async () => {
    setShowBlockConfirm(false) // Close dialog first
    if (!activeChatUser) return
    try {
      const res = await fetch('/api/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: activeChatUser.id }),
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('User blocked. You won\'t see them anymore.')
        closeChat()
      } else {
        toast.error(data.error || 'Failed')
      }
    } catch {
      toast.error('Network error')
    }
  }

  const handleReportFromChat = async (reason: string) => {
    setShowReportConfirm(null) // Close dialog first
    if (!activeChatUser) return
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: activeChatUser.id, reason }),
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Report submitted. You won\'t see this person anymore.')
        closeChat()
      } else {
        toast.error(data.error || 'Failed')
      }
    } catch {
      toast.error('Network error')
    }
  }

  // Delete entire chat for BOTH users — hookup privacy, no trace
  const handleDeleteChat = async () => {
    if (!activeChatId) return
    try {
      const res = await fetch(`/api/chat/${activeChatId}/delete`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (data.ok) {
        // Notify other user via socket — chat is gone for both
        socketRef.current?.emit('chat-deleted', { chatId: activeChatId, deletedBy: currentUser!.id })
        toast.success('Chat deleted — no trace')
        closeChat()
      } else {
        toast.error(data.error || 'Failed')
      }
    } catch {
      toast.error('Network error')
    }
  }

  // ============================================
  // Build reply-to map
  // ============================================

  const messageMap = useMemo(() => {
    const map = new Map<string, ChatMessage>()
    for (const m of messages) {
      map.set(m.id, m)
    }
    return map
  }, [messages])

  // ============================================
  // Filtered chats for search
  // ============================================

  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats
    const q = searchQuery.toLowerCase()
    return chats.filter((c) => c.otherUser.nickname.toLowerCase().includes(q))
  }, [chats, searchQuery])

  // Calculate total unread count and notify parent
  const totalUnread = useMemo(() => {
    return chats.reduce((sum, c) => sum + c.unreadCount, 0)
  }, [chats])

  useEffect(() => {
    onUnreadCountChange?.(totalUnread)
  }, [totalUnread, onUnreadCountChange])

  // ============================================
  // RENDER: Chat List
  // ============================================

  // Pull-to-refresh state (chat list)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const pullStartY = useRef(0)
  const pullDistance = useRef(0)
  const isPulling = useRef(false)

  const handlePullRefresh = useCallback(async () => {
    setIsRefreshing(true)
    appCache.getState().setTimestamp('chatList', 0) // Force stale
    await fetchChats(true)
    setIsRefreshing(false)
  }, [fetchChats, appCache])

  // Pull-to-refresh state (messages view)
  const [isMessagesRefreshing, setIsMessagesRefreshing] = useState(false)
  const msgPullStartY = useRef(0)
  const msgPullDistance = useRef(0)
  const msgIsPulling = useRef(false)

  const handleMessagesPullRefresh = useCallback(async () => {
    if (!activeChatId) return
    setIsMessagesRefreshing(true)
    try {
      const res = await fetch(`/api/chat/${activeChatId}/open`, { credentials: 'same-origin' })
      const d = await res.json()
      if (d.ok) {
        const freshMsgs = d.data.messages || []
        setMessages(freshMsgs)
        setMessagesCursor(d.data.nextCursor || null)
        setMessagesHasMore(!!d.data.nextCursor)
        setSelfDestructHours(d.data.selfDestructHours)
        setChatRating(d.data.myRating)
        dataStore.getState().setChatMessages(activeChatId, freshMsgs)
      }
    } catch {
      // Silent fail
    } finally {
      setIsMessagesRefreshing(false)
    }
  }, [activeChatId, dataStore])

  const renderChatList = () => (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/50 shrink-0">
        <h2 className="text-lg font-bold">Chats</h2>
      </div>

      {/* Search */}
      <div className="px-3 py-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 rounded-xl text-sm"
            maxLength={20}
          />
        </div>
      </div>

      {/* Chat List with Pull-to-Refresh */}
      <div
        ref={chatListRef}
        className="flex-1 overflow-y-auto gnect-scroll"
        onTouchStart={(e) => {
          const el = e.currentTarget
          if (el.scrollTop <= 0) {
            pullStartY.current = e.touches[0].clientY
            isPulling.current = true
          }
        }}
        onTouchMove={(e) => {
          if (!isPulling.current) return
          const el = e.currentTarget
          if (el.scrollTop > 0) {
            isPulling.current = false
            pullDistance.current = 0
            return
          }
          pullDistance.current = Math.max(0, e.touches[0].clientY - pullStartY.current)
        }}
        onTouchEnd={() => {
          if (isPulling.current && pullDistance.current > 80 && !isRefreshing) {
            handlePullRefresh()
          }
          isPulling.current = false
          pullDistance.current = 0
        }}
      >
        {/* Pull-to-refresh indicator */}
        {isRefreshing && (
          <div className="flex items-center justify-center py-3 gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs font-medium">Refreshing...</span>
          </div>
        )}
        {chatsLoading ? (
          <div className="px-4 space-y-3 py-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <Skeleton className="w-12 h-12 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 gap-3 py-12">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageCircle className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              {chats.length === 0 ? 'No conversations yet' : 'No matches'}
            </h3>
            <p className="text-xs text-muted-foreground text-center max-w-xs">
              {chats.length === 0
                ? 'Discover people and start chatting'
                : 'Try a different search'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1 px-2">
            {filteredChats.map((chat) => (
              <motion.button
                key={chat.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => openChat(chat.id, chat.otherUser)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-card/50 active:bg-card/80 transition-colors rounded-xl"
                aria-label={`Chat with ${chat.otherUser.nickname}`}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-primary/10">
                    {chat.otherUser.photo && !disappearMode ? (
                      <img
                        src={getMediaUrl(chat.otherUser.photo) ?? undefined}
                        alt={chat.otherUser.nickname}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-primary font-bold text-lg">
                        {chat.otherUser.nickname.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  {/* Online dot */}
                  {chat.otherUser.is_online && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm truncate">{chat.otherUser.nickname}</span>
                    {chat.lastMessage && !disappearMode && (
                      <span className="text-[10px] text-muted-foreground/50 shrink-0">
                        {relativeTime(chat.lastMessage.sent_at)}
                      </span>
                    )}
                  </div>
                  {/* Phase 6: Disappear Mode — hide content */}
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-xs text-muted-foreground truncate">
                      {disappearMode ? (
                        <span className="text-muted-foreground/40">Message hidden</span>
                      ) : chat.lastMessage ? (
                        <>
                          {chat.lastMessage.sender_id === currentUser?.id && (
                            <span className="text-muted-foreground/50">You: </span>
                          )}
                          {chat.lastMessage.media_type === 'view_once_photo'
                            ? <><EyeOff className="w-3.5 h-3.5 inline" /> View-once photo</>
                            : chat.lastMessage.media_type === 'photo'
                            ? <><Camera className="w-3.5 h-3.5 inline" /> Photo</>
                            : chat.lastMessage.media_type === 'voice_note'
                            ? <><Mic className="w-3.5 h-3.5 inline" /> Voice note</>
                            : chat.lastMessage.content || 'Photo'}
                        </>
                      ) : (
                        'Start chatting...'
                      )}
                    </p>
                    {chat.unreadCount > 0 && !disappearMode && (
                      <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                        {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  // ============================================
  // RENDER: Chat View
  // ============================================

  const renderChatView = () => (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Chat Header — stays fixed at top, never disappears */}
      <div className="flex items-center gap-2 px-3 py-2 gnect-glass border-b border-border/50 shrink-0 z-10">
        <button
          onClick={closeChat}
          className="h-10 w-10 rounded-full flex items-center justify-center active:bg-secondary transition-colors shrink-0 gnect-press"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        {/* Avatar + Name */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-full overflow-hidden bg-primary/10">
              {activeChatUser?.photo ? (
                <img
                  src={getMediaUrl(activeChatUser.photo) ?? undefined}
                  alt={activeChatUser.nickname}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-primary font-bold text-sm">
                  {activeChatUser?.nickname?.charAt(0).toUpperCase() || '?'}
                </div>
              )}
            </div>
            {activeChatUser?.is_online && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-semibold text-sm truncate">{activeChatUser?.nickname}</p>
              {/* Inline rating stars — silent rating, no popup */}
              {activeChatUser && (
                <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/ratings', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'same-origin',
                            body: JSON.stringify({ ratedUserId: activeChatUser.id, stars: star }),
                          })
                          const data = await res.json()
                          if (data.ok) {
                            setChatRating(star)
                          }
                        } catch { /* silent */ }
                      }}
                      className="transition-transform active:scale-75"
                    >
                      <Star
                        className={`w-5 h-5 transition-colors ${
                          star <= (chatRating ?? 0)
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-amber-400/40'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
            {typingChatId === activeChatId ? (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-[10px] text-primary font-medium"
              >
                typing...
              </motion.p>
            ) : activeChatUser?.is_online ? (
              <p className="text-[10px] text-primary font-medium">Online</p>
            ) : null}
          </div>
        </div>

        {/* Safety dropdown + Phase 6: Self-destruct timer + Block/Report confirmations */}
        <div className="flex items-center gap-1">
          {/* Phase 6: Self-destruct timer */}
          {activeChatId && (
            <ChatSelfDestruct
              chatId={activeChatId}
              activeHours={selfDestructHours}
              onSetTimer={setSelfDestructHours}
            />
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-9 w-9 rounded-full flex items-center justify-center active:bg-secondary transition-colors shrink-0 gnect-press">
                <Shield className="w-4 h-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem className="text-destructive focus:text-destructive py-3" onClick={() => setShowBlockConfirm(true)}>
                <Ban className="w-4 h-4 mr-2" /> Block
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:text-destructive py-3" onClick={() => setShowReportConfirm('Fake')}>
                <Flag className="w-4 h-4 mr-2" /> Report Fake
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:text-destructive py-3" onClick={() => setShowReportConfirm('Spam')}>
                <Flag className="w-4 h-4 mr-2" /> Report Spam
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:text-destructive py-3" onClick={() => setShowReportConfirm('Harassment')}>
                <Flag className="w-4 h-4 mr-2" /> Report Harassment
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:text-destructive py-3" onClick={() => setShowReportConfirm('Underage')}>
                <Flag className="w-4 h-4 mr-2" /> Report Underage
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:text-destructive py-3" onClick={handleDeleteChat}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Phase 6: Block Confirmation Dialog */}
      <Dialog open={showBlockConfirm} onOpenChange={setShowBlockConfirm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Block {activeChatUser?.nickname}?</DialogTitle>
            <DialogDescription>
              They won\'t be able to contact you or see your profile. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowBlockConfirm(false)} className="rounded-xl">Cancel</Button>
            <Button variant="destructive" onClick={handleBlockFromChat} className="rounded-xl">Block</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Phase 6: Report Confirmation Dialog */}
      <Dialog open={!!showReportConfirm} onOpenChange={() => setShowReportConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Report {activeChatUser?.nickname}?</DialogTitle>
            <DialogDescription>
              You\'re reporting for: <span className="font-semibold text-foreground">{showReportConfirm}</span>. They won\'t see you anymore after this.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowReportConfirm(null)} className="rounded-xl">Cancel</Button>
            <Button variant="destructive" onClick={() => showReportConfirm && handleReportFromChat(showReportConfirm)} className="rounded-xl">Report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating Message Action Bar (WhatsApp-style) */}
      <AnimatePresence>
        {selectedMessage && (() => {
          const selectedMsg = messageMap.get(selectedMessage)
          const isSelectedMine = selectedMsg?.sender_id === currentUser?.id
          return (
            <motion.div
              key="action-bar"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.15 }}
              className="shrink-0 flex items-center justify-center gap-2 px-3 py-2 gnect-glass-elevated z-20"
            >
              {/* Reply */}
              <button
                onClick={() => {
                  if (selectedMsg) setReplyTo(selectedMsg)
                  setSelectedMessage(null)
                }}
                className="flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[44px] rounded-lg active:opacity-70 transition-opacity gnect-press"
                aria-label="Reply"
              >
                <Reply className="w-5 h-5 text-foreground" />
                <span className="text-[10px] text-foreground/80 font-medium">Reply</span>
              </button>

              {/* Unsend — only for own messages */}
              {isSelectedMine && (
                <button
                  onClick={() => {
                    handleUnsend(selectedMessage)
                    setSelectedMessage(null)
                  }}
                  className="flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[44px] rounded-lg active:opacity-70 transition-opacity gnect-press"
                  aria-label="Unsend"
                >
                  <Trash2 className="w-5 h-5 text-red-400" />
                  <span className="text-[10px] text-red-400 font-medium">Unsend</span>
                </button>
              )}

              {/* Delete for me — works for ALL messages (ghost delete) */}
              <button
                onClick={() => {
                  handleGhostDelete(selectedMessage)
                  setSelectedMessage(null)
                }}
                className="flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[44px] rounded-lg active:opacity-70 transition-opacity gnect-press"
                aria-label="Delete for me"
              >
                <Ghost className="w-5 h-5 text-red-400" />
                <span className="text-[10px] text-red-400 font-medium">Delete for me</span>
              </button>

              {/* Close */}
              <button
                onClick={() => setSelectedMessage(null)}
                className="flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[44px] rounded-lg active:opacity-70 transition-opacity gnect-press ml-1"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-foreground/70" />
                <span className="text-[10px] text-foreground/70 font-medium">Close</span>
              </button>
            </motion.div>
          )
        })()}
      </AnimatePresence>

      {/* Messages Area — with pull-to-refresh */}
      <div
        onScroll={handleMessageScroll}
        onTouchStart={(e) => {
          const el = e.currentTarget
          if (el.scrollTop <= 0) {
            msgPullStartY.current = e.touches[0].clientY
            msgIsPulling.current = true
          }
        }}
        onTouchMove={(e) => {
          if (!msgIsPulling.current) return
          const el = e.currentTarget
          if (el.scrollTop > 0) {
            msgIsPulling.current = false
            msgPullDistance.current = 0
            return
          }
          msgPullDistance.current = Math.max(0, e.touches[0].clientY - msgPullStartY.current)
        }}
        onTouchEnd={() => {
          if (msgIsPulling.current && msgPullDistance.current > 80 && !isMessagesRefreshing) {
            handleMessagesPullRefresh()
          }
          msgIsPulling.current = false
          msgPullDistance.current = 0
        }}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain gnect-scroll px-3 py-2"
      >
        {/* Pull-to-refresh indicator for messages */}
        {isMessagesRefreshing && (
          <div className="flex items-center justify-center py-2 gap-2 text-muted-foreground">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-xs font-medium">Refreshing...</span>
          </div>
        )}

        {/* Load more button */}
        {messagesHasMore && (
          <div className="flex justify-center py-2 mb-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground h-8 rounded-full"
              onClick={() => fetchMessages(activeChatId!, true)}
              disabled={messagesLoading}
            >
              {messagesLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Load earlier'}
            </Button>
          </div>
        )}

        {/* Loading state */}
        {messagesLoading && messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {/* Empty state */}
        {!messagesLoading && messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Say hey
            </p>
          </div>
        )}

        {/* Messages */}
        <AnimatePresence>
          {messages.map((msg) => {
            const isMine = msg.sender_id === currentUser?.id
            const replyToMsg = msg.reply_to_id ? (messageMap.get(msg.reply_to_id) ?? {
              id: msg.reply_to_id,
              sender_id: '',
              content: 'Message was unsent',
              media_url: null,
              media_type: null,
              is_view_once: false,
              viewed: false,
              reply_to_id: null,
              sent_at: '',
            } as ChatMessage) : null

            return (
              <ChatBubble
                key={msg.id}
                message={msg}
                isMine={isMine}
                replyTo={replyToMsg}
                onUnsend={handleUnsend}
                onGhostDelete={handleGhostDelete}
                onRevealViewOnce={handleRevealViewOnce}
                onSelect={setSelectedMessage}
                isSelected={selectedMessage === msg.id}
                onPhotoClick={(url, isViewOnce, messageId) => handlePhotoClick(url, isViewOnce, messageId)}
                onReply={(msg) => { setReplyTo(msg); setSelectedMessage(null) }}
                currentUserId={currentUser?.id ?? ''}
              />
            )
          })}
        </AnimatePresence>

        {/* Typing indicator */}
        {typingChatId === activeChatId && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start mb-1"
          >
            <div className="bg-secondary rounded-2xl rounded-bl-md px-3 py-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Reply Preview */}
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border/30 bg-card/50"
          >
            <div className="flex items-center gap-2 px-3 py-2">
              <Reply className="w-3.5 h-3.5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-primary font-medium">Replying</p>
                <p className="text-xs text-muted-foreground truncate">
                  {getReplyPreviewText(replyTo)}
                </p>
              </div>
              <button
                onClick={() => setReplyTo(null)}
                className="h-6 w-6 rounded-full flex items-center justify-center hover:bg-secondary"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Replies */}
      <div className="shrink-0 border-t border-border/20 bg-card/30 px-2 py-1.5 gnect-scroll">
        <div className="flex gap-1.5 overflow-x-auto gnect-scroll pb-0.5">
          {QUICK_REPLIES.map((qr) => (
            <button
              key={qr}
              onClick={() => handleQuickReply(qr)}
              className="shrink-0 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 active:scale-95 transition-all whitespace-nowrap"
              aria-label={`Quick reply: ${qr}`}
            >
              {qr}
            </button>
          ))}
        </div>
      </div>

      {/* Message Input — WhatsApp-style: Enter = newline, send button only */}
      <div className="shrink-0 gnect-glass border-t border-border/50 px-3 py-2 safe-bottom flex items-end gap-2">
        {/* Photo button — all photos are privacy-first */}
        <button
          onClick={() => photoInputRef.current?.click()}
          disabled={uploading || isRecordingVoice}
          className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 active:bg-secondary transition-colors gnect-press"
          aria-label="Send privacy-first photo"
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          ) : (
            <Camera className="w-5 h-5 text-muted-foreground" />
          )}
        </button>

        {/* Voice recording or text input */}
        {isRecordingVoice ? (
          <VoiceNoteRecorder
            onSend={handleVoiceNoteSend}
            onCancel={handleVoiceNoteCancel}
          />
        ) : (
          <>
            {/* Text input — auto-resize textarea, Enter = newline */}
            <div className="flex-1 min-w-0">
              <textarea
                value={messageText}
                onChange={(e) => {
                  handleTyping(e.target.value)
                  // Auto-resize: reset height then set to scrollHeight
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                }}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && messageText.trim() && !sending && !containsLink(messageText)) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="Type a message..."
                aria-label="Type a message"
                className={`w-full resize-none rounded-2xl text-sm px-4 py-2.5 bg-secondary/50 border-0 outline-none focus:ring-1 max-h-[120px] overflow-y-auto gnect-scroll gnect-input-responsive ${
                  containsLink(messageText) ? 'focus:ring-red-400' : 'focus:ring-primary/30'
                }`}
                maxLength={2000}
                disabled={sending || uploadingVoice}
                rows={1}
                style={{ height: '40px' }}
              />
              {containsLink(messageText) && (
                <p className="text-[10px] text-red-400 mt-0.5 px-1 flex items-center gap-0.5"><Link2 className="w-3 h-3" /> Links are not allowed</p>
              )}
            </div>

            {/* Mic button (when no text) or Send button (when text typed) */}
            {messageText.trim() ? (
              <button
                onClick={handleSend}
                disabled={sending || containsLink(messageText)}
                className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 transition-all gnect-btn-bounce gnect-press bg-primary text-primary-foreground shadow-sm"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => setIsRecordingVoice(true)}
                disabled={uploadingVoice}
                className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 active:bg-primary/10 active:scale-90 transition-all gnect-press"
                aria-label="Record voice note"
              >
                {uploadingVoice ? (
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                ) : (
                  <Mic className="w-5 h-5 text-muted-foreground" />
                )}
              </button>
            )}
          </>
        )}
      </div>

      {/* Hidden photo input */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handlePhotoUpload}
      />

      {/* Photo Viewer — Bug 3: Modern viewer with animations */}
      {viewerImageUrl && (
        <PhotoViewer
          imageUrl={viewerImageUrl}
          isViewOnce={viewerIsViewOnce}
          onClose={handleViewerClose}
          onDeleteBothSides={handleDeleteBothSides}
        />
      )}

      {/* Photo Preview Before Send */}
      <Dialog open={!!photoPreview} onOpenChange={(open) => { if (!open) handleCancelPhotoPreview() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Photo</DialogTitle>
            <DialogDescription>Preview your photo before sending</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            {photoPreview && (
              <div className="w-full max-w-[300px] rounded-2xl overflow-hidden bg-muted">
                <img
                  src={photoPreview}
                  alt="Photo preview"
                  className="w-full aspect-[3/4] object-cover"
                />
              </div>
            )}
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Lock className="w-3.5 h-3.5" />
              <span className="text-xs">This photo will be view-once</span>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCancelPhotoPreview} className="rounded-xl" disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleConfirmPhotoSend} className="rounded-xl" disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Photo
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )

  // ============================================
  // Main Render
  // ============================================

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={view}
        initial={{ opacity: 0, x: view === 'chat' ? 20 : -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: view === 'chat' ? -20 : 20 }}
        transition={{ duration: 0.15 }}
        className="h-full"
      >
        {view === 'list' ? renderChatList() : renderChatView()}
      </motion.div>

    </AnimatePresence>
  )
}
