'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Trash2, Ban, MessageSquare } from 'lucide-react'
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

type ReportType = 'user' | 'post' | 'all'

interface UserReport {
  id: string
  type: 'user'
  reporterNickname: string
  reportedNickname: string
  reason: string
  description: string | null
  createdAt: string
  status: 'pending'
}

interface PostReport {
  id: string
  type: 'post'
  reporterNickname: string
  postContent: string
  postAuthorNickname: string
  postIsDeleted: boolean
  reason: string
  createdAt: string
  status: 'pending'
}

type Report = UserReport | PostReport

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export function AdminReports() {
  const [reports, setReports] = useState<Report[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [reportType, setReportType] = useState<ReportType>('user')
  const [statusFilter, setStatusFilter] = useState<'pending' | 'resolved'>('pending')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    reportId: string
    action: 'dismiss' | 'warn' | 'ban_user' | 'ban_posting' | 'delete_post'
    label: string
    reportType: 'user' | 'post'
    userId?: string
  } | null>(null)

  const fetchReports = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const typeParam = reportType === 'all' ? 'user' : reportType
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        type: typeParam,
        status: statusFilter,
      })

      const res = await fetch(`/api/admin/reports?${params}`, { credentials: 'same-origin' })
      const data = await res.json()
      if (data.ok) {
        setReports(data.data.reports)
        setPagination(data.data.pagination)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [reportType, statusFilter])

  useEffect(() => { fetchReports(1) }, [fetchReports])

  const handleAction = async () => {
    if (!confirmDialog) return
    setActionLoading(confirmDialog.reportId)
    try {
      const res = await fetch(`/api/admin/reports/${confirmDialog.reportId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: confirmDialog.action,
          reportType: confirmDialog.reportType,
        }),
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Action taken')
        fetchReports(pagination.page)
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

  const typeTabs: { key: ReportType; label: string }[] = [
    { key: 'user', label: 'User Reports' },
    { key: 'post', label: 'Post Reports' },
    { key: 'all', label: 'All' },
  ]

  return (
    <div className="space-y-3">
      {/* Type tabs */}
      <div className="flex gap-1 p-1 bg-secondary/50 rounded-xl">
        {typeTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setReportType(t.key)}
            className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              reportType === t.key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Status filter */}
      <div className="flex gap-2">
        <button
          onClick={() => setStatusFilter('pending')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            statusFilter === 'pending' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
          }`}
        >
          Pending
        </button>
        <button
          onClick={() => setStatusFilter('resolved')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            statusFilter === 'resolved' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
          }`}
        >
          Resolved
        </button>
      </div>

      {/* Reports list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : reports.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-8">No reports</p>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <div key={r.id} className="bg-card border border-border rounded-xl p-3 space-y-2">
              {r.type === 'user' ? (
                <>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className="text-[9px] h-4 px-1">User</Badge>
                    <span className="text-muted-foreground">
                      <span className="text-foreground font-medium">{r.reporterNickname}</span> reported <span className="text-destructive font-medium">{r.reportedNickname}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-[9px] h-4 px-1">{r.reason}</Badge>
                  </div>
                  {r.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className="text-[9px] h-4 px-1">Post</Badge>
                    <span className="text-muted-foreground">
                      <span className="text-foreground font-medium">{r.reporterNickname}</span> reported a post by <span className="text-destructive font-medium">{r.postAuthorNickname}</span>
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 bg-secondary/30 p-2 rounded-lg">&ldquo;{r.postContent}&rdquo;</p>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-[9px] h-4 px-1">{r.reason}</Badge>
                    {r.postIsDeleted && <Badge variant="destructive" className="text-[9px] h-4 px-1">Deleted</Badge>}
                  </div>
                </>
              )}

              <div className="text-[10px] text-muted-foreground">
                {new Date(r.createdAt).toLocaleString()}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/50">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] rounded-lg gap-1"
                  onClick={() => setConfirmDialog({ reportId: r.id, action: 'dismiss', label: 'Dismiss this report?', reportType: r.type })}
                  disabled={actionLoading === r.id}
                >
                  <Trash2 className="w-3 h-3" /> Dismiss
                </Button>
                {r.type === 'user' && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px] rounded-lg gap-1"
                      onClick={() => setConfirmDialog({ reportId: r.id, action: 'ban_user', label: 'Ban this user?', reportType: 'user' })}
                      disabled={actionLoading === r.id}
                    >
                      <Ban className="w-3 h-3" /> Ban User
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px] rounded-lg gap-1"
                      onClick={() => setConfirmDialog({ reportId: r.id, action: 'ban_posting', label: 'Ban user from posting?', reportType: 'user' })}
                      disabled={actionLoading === r.id}
                    >
                      <MessageSquare className="w-3 h-3" /> Ban Posting
                    </Button>
                  </>
                )}
                {r.type === 'post' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px] rounded-lg gap-1 text-destructive hover:text-destructive"
                    onClick={() => setConfirmDialog({ reportId: r.id, action: 'delete_post', label: 'Delete this post?', reportType: 'post' })}
                    disabled={actionLoading === r.id}
                  >
                    <Trash2 className="w-3 h-3" /> Delete Post
                  </Button>
                )}
              </div>
            </div>
          ))}

          {/* Pagination */}
          {pagination.page < pagination.totalPages && (
            <Button
              variant="outline"
              className="w-full rounded-xl h-10 text-xs"
              onClick={() => fetchReports(pagination.page + 1)}
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
              variant={confirmDialog?.action === 'dismiss' ? 'outline' : 'destructive'}
              className="rounded-xl"
              onClick={handleAction}
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
