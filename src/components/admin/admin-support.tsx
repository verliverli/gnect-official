'use client'

// ============================================
// AdminSupport — Admin support DM management tab
// Batch 2: Support DM to Manager
// ============================================

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Send, Trash2, XCircle, MessageCircle, Shield, Clock, ArrowLeft, Lightbulb, Lock, Bug, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { SUPPORT_CHANNELS, COUNTRY_NAMES, getCountryFlag } from '@/lib/constants'

type StatusFilter = 'all' | 'open' | 'replied' | 'closed'

interface Conversation {
  id: string
  user_id: string
  subject: string
  status: string
  created_at: string
  updated_at: string
  user: { id: string; nickname: string; region: string }
  last_message: {
    content: string
    is_from_admin: boolean
    created_at: string
  } | null
}

interface SupportMsg {
  id: string
  sender_id: string
  is_from_admin: boolean
  content: string
  created_at: string
  sender: { id: string; nickname: string; is_admin: boolean }
}

interface ConvDetail {
  id: string
  user_id: string
  subject: string
  status: string
  created_at: string
  updated_at: string
  user: { id: string; nickname: string; region: string }
  messages: SupportMsg[]
}

export function AdminSupport() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [convDetail, setConvDetail] = useState<ConvDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [replyContent, setReplyContent] = useState('')
  const [sending, setSending] = useState(false)
  const [deletingMsgId, setDeletingMsgId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null) // 'close' | 'delete'
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    try {
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : ''
      const res = await fetch(`/api/admin/support${params}`, { credentials: 'same-origin' })
      const data = await res.json()
      if (data.ok) setConversations(data.data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // Fetch conversation detail
  const fetchDetail = useCallback(async (convId: string) => {
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/admin/support/${convId}`, { credentials: 'same-origin' })
      const data = await res.json()
      if (data.ok) setConvDetail(data.data)
    } catch {
      // silent
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedConvId) {
      fetchDetail(selectedConvId)
    } else {
      setConvDetail(null)
    }
  }, [selectedConvId, fetchDetail])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [convDetail?.messages])

  // Admin reply
  const handleReply = async () => {
    if (!selectedConvId) return
    if (!replyContent.trim()) {
      toast.error('Reply cannot be empty')
      return
    }

    setSending(true)
    try {
      const res = await fetch(`/api/admin/support/${selectedConvId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: replyContent.trim() }),
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Reply sent!')
        setReplyContent('')
        await fetchDetail(selectedConvId)
        await fetchConversations()
      } else {
        toast.error(data.error || 'Failed to reply')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSending(false)
    }
  }

  // Delete single message
  const handleDeleteMessage = async (messageId: string) => {
    if (!selectedConvId || deletingMsgId) return
    setDeletingMsgId(messageId)
    try {
      const res = await fetch(`/api/admin/support/${selectedConvId}/delete-message`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId }),
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Message deleted')
        await fetchDetail(selectedConvId)
        await fetchConversations()
      } else {
        toast.error(data.error || 'Failed to delete')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setDeletingMsgId(null)
    }
  }

  // Close conversation
  const handleClose = async () => {
    if (!selectedConvId) return
    setActionLoading('close')
    try {
      const res = await fetch(`/api/admin/support/${selectedConvId}/close`, {
        method: 'POST',
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Conversation closed')
        await fetchDetail(selectedConvId)
        await fetchConversations()
      } else {
        toast.error(data.error || 'Failed to close')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setActionLoading(null)
    }
  }

  // Delete entire conversation
  const handleDeleteConv = async () => {
    if (!selectedConvId) return
    if (!confirm('Delete this entire conversation? This cannot be undone.')) return
    setActionLoading('delete')
    try {
      const res = await fetch(`/api/admin/support/${selectedConvId}/delete`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Conversation deleted')
        setSelectedConvId(null)
        await fetchConversations()
      } else {
        toast.error(data.error || 'Failed to delete')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setActionLoading(null)
    }
  }

  // Format time
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Status badge colors
  const statusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20'
      case 'replied': return 'bg-blue-500/15 text-blue-500 border-blue-500/20'
      case 'closed': return 'bg-muted text-muted-foreground border-border'
      default: return 'bg-muted text-muted-foreground border-border'
    }
  }

  // Subject icons
  const subjectIcon = (s: string) => {
    switch (s) {
      case 'Safety Concern': return <Shield className="w-4 h-4" />
      case 'Bug Report': return <Bug className="w-4 h-4" />
      case 'Feature Request': return <Lightbulb className="w-4 h-4" />
      case 'Account Issue': return <Lock className="w-4 h-4" />
      default: return <MessageCircle className="w-4 h-4" />
    }
  }

  const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'open', label: 'Open' },
    { key: 'replied', label: 'Replied' },
    { key: 'closed', label: 'Closed' },
  ]

  // Unique support channels (deduplicated by URL)
  const uniqueChannels = (() => {
    const seen = new Set<string>()
    const result: { country: string; flag: string; url: string }[] = []
    for (const country of COUNTRY_NAMES) {
      const url = SUPPORT_CHANNELS[country]
      if (url && !seen.has(url)) {
        seen.add(url)
        result.push({ country, flag: getCountryFlag(country), url })
      }
    }
    return result
  })()

  // Conversation detail view
  if (selectedConvId) {
    return (
      <div className="flex flex-col h-full">
        {/* Detail header */}
        <div className="flex items-center gap-2 mb-3 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSelectedConvId(null)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold truncate">
              {convDetail?.user.nickname || 'User'} — {convDetail?.subject || 'Loading...'}
            </h3>
            <p className="text-[10px] text-muted-foreground">
              {convDetail?.user.region || ''} · {convDetail && formatTime(convDetail.created_at)}
            </p>
          </div>
          {convDetail && (
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-medium border shrink-0 ${statusColor(convDetail.status)}`}>
              {convDetail.status}
            </span>
          )}
        </div>

        {/* Actions bar */}
        {convDetail && convDetail.status !== 'closed' && (
          <div className="flex items-center gap-2 mb-3 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="text-xs rounded-lg h-8"
              onClick={handleClose}
              disabled={actionLoading !== null}
            >
              {actionLoading === 'close' ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
              Close
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs rounded-lg h-8 text-destructive hover:text-destructive"
              onClick={handleDeleteConv}
              disabled={actionLoading !== null}
            >
              {actionLoading === 'delete' ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Trash2 className="w-3 h-3 mr-1" />}
              Delete All
            </Button>
          </div>
        )}

        {convDetail && convDetail.status === 'closed' && (
          <div className="flex items-center gap-2 mb-3 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="text-xs rounded-lg h-8 text-destructive hover:text-destructive"
              onClick={handleDeleteConv}
              disabled={actionLoading !== null}
            >
              {actionLoading === 'delete' ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Trash2 className="w-3 h-3 mr-1" />}
              Delete Conversation
            </Button>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto overscroll-contain gnect-scroll space-y-2 min-h-0 mb-3">
          {detailLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : convDetail?.messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No messages</p>
          ) : (
            convDetail?.messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.is_from_admin ? 'justify-start' : 'justify-end'}`}
              >
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 relative group ${
                  msg.is_from_admin
                    ? 'bg-primary text-primary-foreground rounded-bl-md'
                    : 'bg-secondary text-secondary-foreground rounded-br-md'
                }`}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] font-semibold opacity-70">
                      {msg.is_from_admin ? 'Admin' : msg.sender.nickname}
                    </span>
                    {/* Delete message button — only on hover */}
                    <button
                      onClick={() => handleDeleteMessage(msg.id)}
                      disabled={!!deletingMsgId}
                      className="opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                      aria-label="Delete message"
                    >
                      {deletingMsgId === msg.id ? (
                        <Loader2 className="w-3 h-3 animate-spin opacity-50" />
                      ) : (
                        <Trash2 className="w-3 h-3 opacity-50 hover:opacity-100 hover:text-destructive" />
                      )}
                    </button>
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  <p className={`text-[9px] mt-0.5 flex items-center gap-1 ${
                    msg.is_from_admin ? 'opacity-50' : 'text-muted-foreground/50'
                  }`}>
                    <Clock className="w-2.5 h-2.5" />
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply input */}
        {convDetail && convDetail.status !== 'closed' && (
          <div className="shrink-0 border-t border-border pt-3">
            <div className="flex items-end gap-2">
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                className="flex-1 bg-secondary/50 rounded-xl p-2.5 text-sm resize-none border border-border focus:border-primary/40 focus:outline-none transition-colors min-h-[44px] max-h-[80px]"
                placeholder="Type your reply..."
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleReply()
                  }
                }}
              />
              <Button
                onClick={handleReply}
                disabled={sending || !replyContent.trim()}
                size="icon"
                className="h-10 w-10 rounded-xl bg-primary text-primary-foreground shrink-0"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // List view
  return (
    <div className="space-y-3">
      {/* Support channels */}
      {uniqueChannels.length > 0 && (
        <div className="rounded-xl border border-border p-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Telegram Support Channels</h4>
          <div className="space-y-1.5">
            {uniqueChannels.map((ch) => (
              <div key={ch.country} className="flex items-center gap-2">
                <span className="text-sm">{ch.flag}</span>
                <span className="text-xs text-foreground flex-1">{ch.country}</span>
                <a
                  href={ch.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                >
                  <ExternalLink className="w-3 h-3" />
                  Channel
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status filter */}
      <div className="flex gap-1.5 overflow-x-auto gnect-scroll">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
              statusFilter === f.key
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Conversation list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <Shield className="w-6 h-6 text-primary/50" />
          </div>
          <p className="text-sm text-muted-foreground">No support conversations</p>
          <p className="text-xs text-muted-foreground/70">When users reach out, their messages will appear here</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setSelectedConvId(conv.id)}
              className="w-full flex items-start gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/20 transition-colors text-left active:scale-[0.99]"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-sm">
                {subjectIcon(conv.subject)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold truncate">{conv.user.nickname}</span>
                  <span className="text-[10px] text-muted-foreground">{conv.user.region}</span>
                </div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs text-muted-foreground">{conv.subject}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-medium border ${statusColor(conv.status)}`}>
                    {conv.status}
                  </span>
                </div>
                {conv.last_message && (
                  <p className="text-[11px] text-muted-foreground/70 truncate">
                    {conv.last_message.is_from_admin ? 'Admin: ' : ''}
                    {conv.last_message.content}
                  </p>
                )}
              </div>
              <span className="text-[9px] text-muted-foreground/50 shrink-0 mt-0.5">
                {formatTime(conv.updated_at)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
