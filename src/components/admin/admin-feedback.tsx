'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Pin, MessageSquare, ChevronDown, ChevronRight, Lightbulb, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

interface FeedbackItem {
  id: string
  type: string
  content: string
  region: string
  status: string
  is_pinned: boolean
  admin_notes: string | null
  created_at: string
  userNickname: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-green-500/15 text-green-500 border-green-500/20',
  reviewed: 'bg-blue-500/15 text-blue-500 border-blue-500/20',
  planned: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/20',
  implemented: 'bg-primary/15 text-primary border-primary/20',
}

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  reviewed: 'Reviewed',
  planned: 'Planned',
  implemented: 'Implemented',
}

export function AdminFeedback() {
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<'' | 'feedback' | 'feature_request'>('')
  const [statusFilter, setStatusFilter] = useState<'' | 'new' | 'reviewed' | 'planned' | 'implemented'>('')
  const [expandedRegion, setExpandedRegion] = useState<string | null>(null)
  const [editingNotes, setEditingNotes] = useState<string | null>(null)
  const [notesValue, setNotesValue] = useState('')
  const [updating, setUpdating] = useState<string | null>(null)

  const fetchFeedback = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (typeFilter) params.set('type', typeFilter)
      if (statusFilter) params.set('status', statusFilter)

      const res = await fetch(`/api/admin/feedback?${params}`, { credentials: 'same-origin' })
      const data = await res.json()
      if (data.ok) {
        setFeedbacks(data.data.feedbacks)
        setPagination(data.data.pagination)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [typeFilter, statusFilter])

  useEffect(() => { fetchFeedback(1) }, [fetchFeedback])

  // Group by region
  const grouped = feedbacks.reduce<Record<string, FeedbackItem[]>>((acc, f) => {
    if (!acc[f.region]) acc[f.region] = []
    acc[f.region].push(f)
    return acc
  }, {})

  const handleUpdateFeedback = async (feedbackId: string, updates: { status?: string; admin_notes?: string; is_pinned?: boolean }) => {
    setUpdating(feedbackId)
    try {
      const res = await fetch(`/api/admin/feedback/${feedbackId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Updated')
        fetchFeedback(pagination.page)
      } else {
        toast.error(data.error || 'Failed')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setUpdating(null)
      setEditingNotes(null)
    }
  }

  const saveNotes = (feedbackId: string) => {
    handleUpdateFeedback(feedbackId, { admin_notes: notesValue })
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as '' | 'feedback' | 'feature_request')}
          className="h-8 px-2 rounded-lg border border-border bg-card text-xs"
        >
          <option value="">All Types</option>
          <option value="feedback">Feedback</option>
          <option value="feature_request">Feature Request</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as '' | 'new' | 'reviewed' | 'planned' | 'implemented')}
          className="h-8 px-2 rounded-lg border border-border bg-card text-xs"
        >
          <option value="">All Status</option>
          <option value="new">New</option>
          <option value="reviewed">Reviewed</option>
          <option value="planned">Planned</option>
          <option value="implemented">Implemented</option>
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : feedbacks.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-8">No feedback found</p>
      ) : (
        <div className="space-y-2">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([region, items]) => (
            <div key={region} className="bg-card border border-border rounded-xl overflow-hidden">
              {/* Region header */}
              <button
                onClick={() => setExpandedRegion(expandedRegion === region ? null : region)}
                className="w-full flex items-center gap-2 p-3 text-left hover:bg-card/80 transition-colors"
              >
                {expandedRegion === region ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                <span className="text-sm font-semibold flex-1">{region}</span>
                <Badge variant="secondary" className="text-[9px] h-4 px-1">{items.length}</Badge>
              </button>

              {/* Expanded items */}
              {expandedRegion === region && (
                <div className="border-t border-border px-3 pb-3 space-y-2">
                  {items.map((f) => (
                    <div key={f.id} className="pt-2 space-y-1.5">
                      {/* Badges row */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className="text-[9px] h-4 px-1">{f.type === 'feature_request' ? <><Lightbulb className="w-2.5 h-2.5 inline mr-0.5" /> Feature</> : <><MessageCircle className="w-2.5 h-2.5 inline mr-0.5" /> Feedback</>}</Badge>
                        <Badge className={`text-[9px] h-4 px-1 border ${STATUS_COLORS[f.status] || 'bg-secondary text-secondary-foreground'}`}>
                          {STATUS_LABELS[f.status] || f.status}
                        </Badge>
                        {f.is_pinned && <Badge className="text-[9px] h-4 px-1 bg-primary/20 text-primary border-primary/30"><Pin className="w-2.5 h-2.5 mr-0.5" />Pinned</Badge>}
                      </div>

                      {/* Content */}
                      <p className="text-sm">{f.content}</p>

                      {/* Meta */}
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>by <span className="text-foreground font-medium">{f.userNickname}</span></span>
                        <span>{new Date(f.created_at).toLocaleDateString()}</span>
                      </div>

                      {/* Admin notes */}
                      {f.admin_notes && editingNotes !== f.id && (
                        <div className="bg-secondary/30 rounded-lg p-2 text-xs text-muted-foreground">
                          <span className="text-[10px] font-semibold uppercase tracking-wider">Admin Notes:</span> {f.admin_notes}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/50">
                        <select
                          value={f.status}
                          onChange={(e) => handleUpdateFeedback(f.id, { status: e.target.value })}
                          className="h-6 px-1 rounded border border-border bg-card text-[10px]"
                          disabled={updating === f.id}
                        >
                          <option value="new">New</option>
                          <option value="reviewed">Reviewed</option>
                          <option value="planned">Planned</option>
                          <option value="implemented">Implemented</option>
                        </select>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] rounded gap-1 px-2"
                          onClick={() => {
                            if (editingNotes === f.id) {
                              saveNotes(f.id)
                            } else {
                              setEditingNotes(f.id)
                              setNotesValue(f.admin_notes || '')
                            }
                          }}
                          disabled={updating === f.id}
                        >
                          <MessageSquare className="w-2.5 h-2.5" />
                          {editingNotes === f.id ? 'Save' : 'Notes'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] rounded gap-1 px-2"
                          onClick={() => handleUpdateFeedback(f.id, { is_pinned: !f.is_pinned })}
                          disabled={updating === f.id}
                        >
                          <Pin className="w-2.5 h-2.5" /> {f.is_pinned ? 'Unpin' : 'Pin'}
                        </Button>
                      </div>

                      {/* Notes input */}
                      {editingNotes === f.id && (
                        <div className="space-y-1.5">
                          <Textarea
                            value={notesValue}
                            onChange={(e) => setNotesValue(e.target.value)}
                            placeholder="Add admin notes..."
                            className="rounded-lg text-xs resize-none"
                            rows={2}
                            maxLength={500}
                          />
                          <div className="flex gap-1.5">
                            <Button size="sm" className="h-6 text-[10px] rounded" onClick={() => saveNotes(f.id)} disabled={updating === f.id}>Save</Button>
                            <Button size="sm" variant="outline" className="h-6 text-[10px] rounded" onClick={() => setEditingNotes(null)}>Cancel</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Pagination */}
          {pagination.page < pagination.totalPages && (
            <Button
              variant="outline"
              className="w-full rounded-xl h-10 text-xs"
              onClick={() => fetchFeedback(pagination.page + 1)}
              disabled={loading}
            >
              Load More
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
