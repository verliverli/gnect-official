'use client'

// ============================================
// SupportScreen — User-facing support DM screen
// Batch 2: Direct messaging between users and admin
// ============================================

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Send, MessageCircle, Plus, Loader2, Clock, Shield, Lightbulb, Lock, Bug, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/store'
// SUPPORT_CHANNELS and getCountryFlag removed — no longer needed

interface SupportScreenProps {
  onClose: () => void
}

const SUBJECTS = ['Account Issue', 'Bug Report', 'Safety Concern', 'Feature Request', 'Other'] as const
type Subject = (typeof SUBJECTS)[number]

interface Conversation {
  id: string
  subject: string
  status: string
  created_at: string
  updated_at: string
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

type View = 'list' | 'detail' | 'new'

export function SupportScreen({ onClose }: SupportScreenProps) {
  const { user: currentUser } = useAuthStore()

  const [view, setView] = useState<View>('list')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<SupportMsg[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [subject, setSubject] = useState<Subject>('Account Issue')
  const [newContent, setNewContent] = useState('')
  const [replyContent, setReplyContent] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/support/list', { credentials: 'same-origin' })
      const data = await res.json()
      if (data.ok) setConversations(data.data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // Fetch messages when a conversation is selected
  const fetchMessages = useCallback(async (convId: string) => {
    setMessagesLoading(true)
    try {
      const res = await fetch(`/api/support/${convId}/messages`, { credentials: 'same-origin' })
      const data = await res.json()
      if (data.ok) {
        setMessages(data.data.messages)
      }
    } catch {
      // silent
    } finally {
      setMessagesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedConvId) {
      fetchMessages(selectedConvId)
    }
  }, [selectedConvId, fetchMessages])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Open conversation detail
  const openConversation = (convId: string) => {
    setSelectedConvId(convId)
    setView('detail')
  }

  // Create new conversation
  const handleCreate = async () => {
    if (newContent.trim().length < 20) {
      toast.error('Message must be at least 20 characters')
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/support/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, content: newContent.trim() }),
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Message sent!')
        setNewContent('')
        setSubject('Account Issue')
        await fetchConversations()
        // Open the new conversation
        openConversation(data.data.id)
      } else {
        toast.error(data.error || 'Failed to send')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSending(false)
    }
  }

  // Reply to conversation
  const handleReply = async () => {
    if (!selectedConvId) return
    if (replyContent.trim().length < 20) {
      toast.error('Message must be at least 20 characters')
      return
    }

    setSending(true)
    try {
      const res = await fetch(`/api/support/${selectedConvId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: replyContent.trim() }),
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Reply sent!')
        setReplyContent('')
        await fetchMessages(selectedConvId)
        await fetchConversations()
      } else {
        toast.error(data.error || 'Failed to send')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSending(false)
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
      case 'open': return 'bg-primary/15 text-primary border-primary/20'
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

  const currentConv = conversations.find((c) => c.id === selectedConvId)

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border gnect-glass-elevated shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 gnect-press"
          onClick={() => {
            if (view === 'detail') {
              setView('list')
              setSelectedConvId(null)
            } else if (view === 'new') {
              setView('list')
            } else {
              onClose()
            }
          }}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            {view === 'list' ? 'Support' : view === 'new' ? 'New Message' : currentConv?.subject || 'Conversation'}
          </h2>
        </div>
        {view === 'list' && (
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 gnect-press"
            onClick={() => setView('new')}
          >
            <Plus className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {/* === LIST VIEW === */}
        {view === 'list' && (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="flex-1 overflow-y-auto overscroll-contain gnect-scroll"
          >
            {/* FAQ Section */}
            <details className="mx-4 mt-3 mb-2 rounded-xl border border-border bg-card">
              <summary className="p-3 cursor-pointer text-sm font-medium flex items-center gap-2 hover:bg-card/80 transition-colors">
                <Lightbulb className="w-4 h-4 text-primary" />
                Frequently Asked Questions
              </summary>
              <div className="px-3 pb-3 space-y-3 text-xs text-muted-foreground">
                <div>
                  <p className="font-medium text-foreground">How do I change my region?</p>
                  <p>Go to Profile → Edit Profile. Region can be changed once every 60 days.</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">How do I delete my account?</p>
                  <p>Go to Profile → Account → Delete Account. You have 30 days to recover.</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Is GNECT free?</p>
                  <p>Yes! All features are currently free during the test period.</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">How do I install GNECT as an app?</p>
                  <p>Tap the Install App button in your Profile or go to Help → Access Guide.</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Why is my VPN blocked?</p>
                  <p>GNECT requires you to turn off VPN during registration for security. You can use VPN after registering.</p>
                </div>
              </div>
            </details>

            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <MessageCircle className="w-8 h-8 text-primary/50" />
                </div>
                <p className="text-sm font-medium text-muted-foreground mb-1">No conversations yet</p>
                <p className="text-xs text-muted-foreground/70 mb-4">Need help? Start a conversation with the admin team</p>
                <Button
                  onClick={() => setView('new')}
                  className="rounded-xl bg-primary text-primary-foreground"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  New Message
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => openConversation(conv.id)}
                    className="w-full flex items-start gap-3 p-4 hover:bg-secondary/30 transition-colors text-left active:scale-[0.99]"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 text-base">
                      {subjectIcon(conv.subject)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold truncate">{conv.subject}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${statusColor(conv.status)}`}>
                          {conv.status}
                        </span>
                      </div>
                      {conv.last_message && (
                        <p className="text-xs text-muted-foreground truncate">
                          {conv.last_message.is_from_admin ? 'Admin: ' : ''}
                          {conv.last_message.content}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground/60 shrink-0 mt-0.5">
                      {formatTime(conv.updated_at)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* === NEW CONVERSATION VIEW === */}
        {view === 'new' && (
          <motion.div
            key="new"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="flex-1 overflow-y-auto overscroll-contain gnect-scroll p-4"
          >
            <div className="space-y-4">
              {/* Subject selector */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Subject</label>
                <div className="flex flex-wrap gap-2">
                  {SUBJECTS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSubject(s)}
                      className={`px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 gnect-press ${
                        subject === s
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                      }`}
                    >
                      <span>{subjectIcon(s)}</span>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message textarea */}
              <div>
                <div className="flex justify-between mb-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Your message</label>
                  <span className={`text-xs ${newContent.trim().length < 20 ? 'text-muted-foreground/50' : 'text-primary'}`}>
                    {newContent.trim().length}/min 20
                  </span>
                </div>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full bg-secondary/50 rounded-xl p-3 text-sm resize-none border border-border focus:border-primary/40 focus:outline-none transition-colors min-h-[120px]"
                  placeholder="Describe your issue or question in detail..."
                />
              </div>

              {/* Send button */}
              <Button
                onClick={handleCreate}
                disabled={sending || newContent.trim().length < 20}
                className="w-full rounded-xl h-11 bg-primary text-primary-foreground gnect-press"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Send Message
              </Button>
            </div>
          </motion.div>
        )}

        {/* === CONVERSATION DETAIL VIEW === */}
        {view === 'detail' && selectedConvId && (
          <motion.div
            key="detail"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            {/* Conversation status bar */}
            {currentConv && (
              <div className="px-4 py-2 bg-secondary/30 border-b border-border/50 shrink-0">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusColor(currentConv.status)}`}>
                    {currentConv.status === 'open' ? '●' : currentConv.status === 'replied' ? '●' : '○'} {currentConv.status}
                  </span>
                  {currentConv.status === 'closed' && (
                    <span className="text-[10px] text-muted-foreground">This conversation is closed</span>
                  )}
                </div>
              </div>
            )}

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto overscroll-contain gnect-scroll p-4 space-y-3">
              {messagesLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <p className="text-sm text-muted-foreground">No messages yet</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                    className={`flex ${msg.is_from_admin ? 'justify-start' : 'justify-end'}`}
                  >
                    <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
                      msg.is_from_admin
                        ? 'bg-primary text-primary-foreground rounded-bl-md'
                        : 'bg-secondary text-secondary-foreground rounded-br-md'
                    }`}>
                      {msg.is_from_admin && (
                        <p className="text-[10px] font-semibold opacity-70 mb-0.5 flex items-center gap-1">
                          Admin
                        </p>
                      )}
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                      <p className={`text-[9px] mt-1 flex items-center gap-1 ${
                        msg.is_from_admin ? 'opacity-50' : 'text-muted-foreground/50'
                      }`}>
                        <Clock className="w-2.5 h-2.5" />
                        {formatTime(msg.created_at)}
                      </p>
                    </div>
                  </motion.div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply input — only if not closed */}
            {currentConv && currentConv.status !== 'closed' && (
              <div className="shrink-0 border-t border-border bg-background/95 backdrop-blur-sm p-3">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      className="w-full bg-secondary/50 rounded-xl p-2.5 text-sm resize-none border border-border focus:border-primary/40 focus:outline-none transition-colors min-h-[44px] max-h-[100px]"
                      placeholder="Type your reply (min 20 chars)..."
                      rows={1}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleReply()
                        }
                      }}
                    />
                    <div className="flex justify-between mt-0.5">
                      <span className="text-[9px] text-muted-foreground/50">
                        {replyContent.trim().length < 20 ? `${20 - replyContent.trim().length} more chars needed` : <><Check className="w-3.5 h-3.5 inline" /> Ready</>}
                      </span>
                    </div>
                  </div>
                  <Button
                    onClick={handleReply}
                    disabled={sending || replyContent.trim().length < 20}
                    size="icon"
                    className="h-10 w-10 rounded-xl bg-primary text-primary-foreground shrink-0 gnect-press"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
