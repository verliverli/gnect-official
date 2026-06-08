'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, CheckCircle, Trash2, ChevronDown, ChevronRight, Bug, Wifi, Globe, Monitor } from 'lucide-react'
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

interface ErrorItem {
  id: string
  message: string
  type: string
  screen: string | null
  count: number
  first_seen_at: string
  last_seen_at: string
  is_resolved: boolean
  user_id: string | null
  stack_trace?: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  frontend_crash: <Monitor className="w-3 h-3" />,
  api_error: <Globe className="w-3 h-3" />,
  network_error: <Wifi className="w-3 h-3" />,
  socket_error: <Bug className="w-3 h-3" />,
}

const TYPE_LABELS: Record<string, string> = {
  frontend_crash: 'Frontend',
  api_error: 'API',
  network_error: 'Network',
  socket_error: 'Socket',
}

export function AdminErrors({ onUnresolvedCount }: { onUnresolvedCount?: (count: number) => void }) {
  const [errors, setErrors] = useState<ErrorItem[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<'' | 'frontend_crash' | 'api_error' | 'network_error' | 'socket_error'>('')
  const [resolvedFilter, setResolvedFilter] = useState<'unresolved' | 'resolved' | 'all'>('unresolved')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{ errorId: string; action: 'resolve' | 'delete'; label: string } | null>(null)

  const fetchErrors = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (typeFilter) params.set('type', typeFilter)
      if (resolvedFilter === 'unresolved') params.set('is_resolved', 'false')
      else if (resolvedFilter === 'resolved') params.set('is_resolved', 'true')

      const res = await fetch(`/api/admin/errors?${params}`, { credentials: 'same-origin' })
      const data = await res.json()
      if (data.ok) {
        setErrors(data.data.errors)
        setPagination(data.data.pagination)
        // Report unresolved count to parent
        if (onUnresolvedCount && resolvedFilter === 'unresolved') {
          onUnresolvedCount(data.data.pagination.total)
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [typeFilter, resolvedFilter, onUnresolvedCount])

  useEffect(() => { fetchErrors(1) }, [fetchErrors])

  const handleResolve = async (errorId: string) => {
    setActionLoading(errorId)
    try {
      const res = await fetch(`/api/admin/errors/${errorId}/resolve`, {
        method: 'POST',
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Marked as resolved')
        fetchErrors(pagination.page)
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

  const handleDelete = async (errorId: string) => {
    setActionLoading(errorId)
    try {
      const res = await fetch(`/api/admin/errors/${errorId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Error deleted')
        fetchErrors(pagination.page)
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

  const handleConfirmAction = async () => {
    if (!confirmDialog) return
    if (confirmDialog.action === 'resolve') {
      await handleResolve(confirmDialog.errorId)
    } else if (confirmDialog.action === 'delete') {
      await handleDelete(confirmDialog.errorId)
    }
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as '' | 'frontend_crash' | 'api_error' | 'network_error' | 'socket_error')}
          className="h-8 px-2 rounded-lg border border-border bg-card text-xs"
        >
          <option value="">All Types</option>
          <option value="frontend_crash">Frontend</option>
          <option value="api_error">API</option>
          <option value="network_error">Network</option>
          <option value="socket_error">Socket</option>
        </select>
        <div className="flex gap-1">
          {(['unresolved', 'resolved', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setResolvedFilter(f)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all capitalize ${
                resolvedFilter === f ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Error list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : errors.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-8">No errors found</p>
      ) : (
        <div className="space-y-2">
          {errors.map((e) => (
            <div key={e.id} className={`bg-card border rounded-xl overflow-hidden ${e.is_resolved ? 'border-border opacity-50' : 'border-destructive/20'}`}>
              <button
                onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
                className="w-full p-3 text-left hover:bg-card/80 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Badge variant="outline" className="text-[9px] h-4 px-1 gap-0.5">
                        {TYPE_ICONS[e.type] || <Bug className="w-3 h-3" />}
                        {TYPE_LABELS[e.type] || e.type}
                      </Badge>
                      {e.screen && <Badge variant="secondary" className="text-[9px] h-4 px-1">{e.screen}</Badge>}
                      {!e.is_resolved && <Badge variant="destructive" className="text-[9px] h-4 px-1">×{e.count}</Badge>}
                      {e.is_resolved && <Badge variant="secondary" className="text-[9px] h-4 px-1">Resolved</Badge>}
                    </div>
                    <p className={`text-xs font-mono line-clamp-2 ${e.is_resolved ? 'text-muted-foreground' : 'text-destructive'}`}>
                      {e.message}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                      <span>Count: {e.count}</span>
                      <span>Last: {new Date(e.last_seen_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  {expandedId === e.id ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-1" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />}
                </div>
              </button>

              {/* Expanded detail */}
              {expandedId === e.id && (
                <div className="border-t border-border px-3 pb-3 space-y-2">
                  <div className="pt-2 space-y-1 text-xs">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <span className="text-muted-foreground">First Seen</span>
                      <span>{new Date(e.first_seen_at).toLocaleString()}</span>
                      <span className="text-muted-foreground">Last Seen</span>
                      <span>{new Date(e.last_seen_at).toLocaleString()}</span>
                      <span className="text-muted-foreground">Occurrences</span>
                      <span className="font-medium">{e.count}</span>
                    </div>
                  </div>

                  {/* Stack trace */}
                  {e.stack_trace && (
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Stack Trace</span>
                      <pre className="mt-1 p-2 bg-secondary/30 rounded-lg text-[10px] font-mono overflow-x-auto whitespace-pre-wrap text-muted-foreground max-h-32 overflow-y-auto gnect-scroll">
                        {e.stack_trace}
                      </pre>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-1.5 pt-2 border-t border-border/50">
                    {!e.is_resolved && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] rounded-lg gap-1"
                        onClick={() => setConfirmDialog({ errorId: e.id, action: 'resolve', label: 'Mark as resolved?' })}
                        disabled={actionLoading === e.id}
                      >
                        <CheckCircle className="w-3 h-3" /> Resolve
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px] rounded-lg gap-1 text-destructive hover:text-destructive"
                      onClick={() => setConfirmDialog({ errorId: e.id, action: 'delete', label: 'Delete this error log?' })}
                      disabled={actionLoading === e.id}
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Pagination */}
          {pagination.page < pagination.totalPages && (
            <Button
              variant="outline"
              className="w-full rounded-xl h-10 text-xs"
              onClick={() => fetchErrors(pagination.page + 1)}
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
              variant={confirmDialog?.action === 'delete' ? 'destructive' : 'default'}
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
