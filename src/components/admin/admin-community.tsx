'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Trash2, Pin, Ban, AlertTriangle, ThumbsUp, MessageCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface AdminPost {
  id: string
  content: string
  category: string
  region_tag: string | null
  upvotes_count: number
  comments_count: number
  is_deleted: boolean
  is_pinned: boolean
  created_at: string
  authorId: string
  authorNickname: string
  reportCount: number
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export function AdminCommunity() {
  const [posts, setPosts] = useState<AdminPost[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'' | 'SFW' | 'NSFW'>('')
  const [showFilter, setShowFilter] = useState<'all' | 'reported' | 'deleted'>('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [confirmDialog, setConfirmDialog] = useState<{
    postId: string
    authorId?: string
    action: 'delete' | 'pin' | 'ban_author'
    label: string
  } | null>(null)

  const fetchPosts = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) params.set('search', search)
      if (categoryFilter) params.set('category', categoryFilter)
      if (showFilter === 'reported') params.set('has_reports', 'true')

      const res = await fetch(`/api/admin/community?${params}`, { credentials: 'same-origin' })
      const data = await res.json()
      if (data.ok) {
        setPosts(data.data.posts)
        setPagination(data.data.pagination)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [search, categoryFilter, showFilter])

  useEffect(() => { fetchPosts(1) }, [fetchPosts])

  const handleDeletePost = async (postId: string) => {
    setActionLoading(postId)
    try {
      const res = await fetch(`/api/admin/community/${postId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Post deleted')
        fetchPosts(pagination.page)
      } else {
        toast.error(data.error || 'Failed')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setActionLoading(null)
      setConfirmDialog(null)
    }
  }

  const handlePinPost = async (postId: string, currentlyPinned: boolean) => {
    setActionLoading(postId)
    try {
      const res = await fetch(`/api/admin/community/${postId}/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned: !currentlyPinned }),
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Pin status updated')
        fetchPosts(pagination.page)
      } else {
        toast.error(data.error || 'Failed')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setActionLoading(null)
      setConfirmDialog(null)
    }
  }

  const handleBanAuthor = async (postId: string, authorId: string) => {
    setActionLoading(postId)
    try {
      const res = await fetch(`/api/admin/users/${authorId}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ban',
          type: 'posting',
          reason: 'Community post violation — banned from posting by admin',
        }),
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Author banned from posting')
        fetchPosts(pagination.page)
      } else {
        toast.error(data.error || 'Failed to ban author')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setActionLoading(null)
      setConfirmDialog(null)
    }
  }

  const handleConfirmAction = async () => {
    if (!confirmDialog) return
    if (confirmDialog.action === 'delete') {
      await handleDeletePost(confirmDialog.postId)
    } else if (confirmDialog.action === 'pin') {
      const post = posts.find((p) => p.id === confirmDialog.postId)
      await handlePinPost(confirmDialog.postId, post?.is_pinned ?? false)
    } else if (confirmDialog.action === 'ban_author') {
      if (confirmDialog.authorId) {
        await handleBanAuthor(confirmDialog.postId, confirmDialog.authorId)
      } else {
        toast.error('Author ID not found')
        setConfirmDialog(null)
      }
    }
  }

  const filteredPosts = posts.filter((p) => {
    if (showFilter === 'deleted') return p.is_deleted
    if (showFilter === 'reported') return p.reportCount > 0
    return true
  })

  return (
    <div className="space-y-3">
      {/* Search */}
      <Input
        placeholder="Search post content..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-10 rounded-xl text-sm"
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as '' | 'SFW' | 'NSFW')}
          className="h-8 px-2 rounded-lg border border-border bg-card text-xs"
        >
          <option value="">All Categories</option>
          <option value="SFW">SFW</option>
          <option value="NSFW">NSFW</option>
        </select>
        <div className="flex gap-1">
          {(['all', 'reported', 'deleted'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setShowFilter(f)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all capitalize ${
                showFilter === f ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Posts */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : filteredPosts.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-8">No posts found</p>
      ) : (
        <div className="space-y-2">
          {filteredPosts.map((p) => (
            <div key={p.id} className={`bg-card border rounded-xl p-3 space-y-2 ${p.is_deleted ? 'border-destructive/20 opacity-60' : 'border-border'}`}>
              {/* Badges row */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="outline" className="text-[9px] h-4 px-1">{p.category}</Badge>
                {p.region_tag && <Badge variant="secondary" className="text-[9px] h-4 px-1">{p.region_tag}</Badge>}
                {p.is_pinned && <Badge className="text-[9px] h-4 px-1 bg-primary/20 text-primary border-primary/30"><Pin className="w-2.5 h-2.5 mr-0.5" />Pinned</Badge>}
                {p.is_deleted && <Badge variant="destructive" className="text-[9px] h-4 px-1">Deleted</Badge>}
                {p.reportCount > 0 && <Badge variant="destructive" className="text-[9px] h-4 px-1"><AlertTriangle className="w-2.5 h-2.5 mr-0.5" />{p.reportCount}</Badge>}
              </div>

              {/* Content */}
              <p className="text-sm line-clamp-3">{p.content}</p>

              {/* Meta */}
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span>by <span className="text-foreground font-medium">{p.authorNickname}</span></span>
                <span className="flex items-center gap-0.5"><ThumbsUp className="w-3 h-3" /> {p.upvotes_count}</span>
                <span className="flex items-center gap-0.5"><MessageCircle className="w-3 h-3" /> {p.comments_count}</span>
                <span>{new Date(p.created_at).toLocaleDateString()}</span>
              </div>

              {/* Actions */}
              <div className="flex gap-1.5 pt-1 border-t border-border/50">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] rounded-lg gap-1"
                  onClick={() => setConfirmDialog({ postId: p.id, action: 'pin', label: p.is_pinned ? 'Unpin this post?' : 'Pin this post?' })}
                  disabled={actionLoading === p.id}
                >
                  <Pin className="w-3 h-3" /> {p.is_pinned ? 'Unpin' : 'Pin'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] rounded-lg gap-1 text-destructive hover:text-destructive"
                  onClick={() => setConfirmDialog({ postId: p.id, action: 'delete', label: 'Delete this post?' })}
                  disabled={actionLoading === p.id || p.is_deleted}
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] rounded-lg gap-1"
                  onClick={() => setConfirmDialog({ postId: p.id, authorId: p.authorId, action: 'ban_author', label: `Ban @${p.authorNickname} from posting? They will no longer be able to create community posts.` })}
                  disabled={actionLoading === p.id}
                >
                  <Ban className="w-3 h-3" /> Ban Author
                </Button>
              </div>
            </div>
          ))}

          {/* Pagination */}
          {pagination.page < pagination.totalPages && (
            <Button
              variant="outline"
              className="w-full rounded-xl h-10 text-xs"
              onClick={() => fetchPosts(pagination.page + 1)}
              disabled={loading}
            >
              Load More
            </Button>
          )}
        </div>
      )}

      {/* Confirm Dialog */}
      <Dialog open={!!confirmDialog} onOpenChange={(open) => { if (!open) setConfirmDialog(null) }}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Confirm Action</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{confirmDialog?.label}</p>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setConfirmDialog(null)}>Cancel</Button>
            <Button
              variant={confirmDialog?.action === 'delete' || confirmDialog?.action === 'ban_author' ? 'destructive' : 'default'}
              className="rounded-xl"
              onClick={handleConfirmAction}
              disabled={!!actionLoading}
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
