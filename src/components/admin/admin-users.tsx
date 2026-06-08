'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Ban, Crown, Star, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { COUNTRY_NAMES, getRegionsForCountry, getCountryFlag, ROLES, getMediaUrl } from '@/lib/constants'
import { toast } from 'sonner'

interface AdminUser {
  id: string
  nickname: string
  age: number
  country: string
  region: string
  role: string
  availability: string
  is_banned: boolean
  is_banned_posting: boolean
  is_premium: boolean
  is_early_adopter: boolean
  is_online: boolean
  last_seen: string
  created_at: string
}

interface UserDetail extends AdminUser {
  bio: string
  height: number | null
  weight: number | null
  body_type: string
  photos: { id: string; catbox_url: string; is_face_pic: boolean; is_locked: boolean }[]
  into_tags: { tag: string }[]
  reportCount: number
  chatCount: number
  postCount: number
  banned_reason: string | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [countryFilter, setCountryFilter] = useState('')
  const [regionFilter, setRegionFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'banned'>('all')
  const [premiumFilter, setPremiumFilter] = useState<'all' | 'premium' | 'free'>('all')
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Ban dialog
  const [banDialog, setBanDialog] = useState<{ userId: string; type: 'full' | 'posting'; action: 'ban' | 'unban' } | null>(null)
  const [banReason, setBanReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const fetchUsers = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) params.set('search', search)
      if (roleFilter) params.set('role', roleFilter)
      if (countryFilter) params.set('country', countryFilter)
      if (regionFilter) params.set('region', regionFilter)
      if (statusFilter === 'banned') params.set('is_banned', 'true')
      else if (statusFilter === 'active') params.set('is_banned', 'false')
      if (premiumFilter === 'premium') params.set('is_premium', 'true')
      else if (premiumFilter === 'free') params.set('is_premium', 'false')

      const res = await fetch(`/api/admin/users?${params}`, { credentials: 'same-origin' })
      const data = await res.json()
      if (data.ok) {
        setUsers(data.data.users)
        setPagination(data.data.pagination)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [search, roleFilter, countryFilter, regionFilter, statusFilter, premiumFilter])

  useEffect(() => { fetchUsers(1) }, [fetchUsers])

  const fetchUserDetail = async (userId: string) => {
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { credentials: 'same-origin' })
      const data = await res.json()
      if (data.ok) setSelectedUser(data.data)
    } catch {
      // silent
    } finally {
      setDetailLoading(false)
    }
  }

  const handleBan = async () => {
    if (!banDialog) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${banDialog.userId}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: banDialog.action,
          type: banDialog.type,
          reason: banReason || undefined,
        }),
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (data.ok) {
        toast.success(banDialog.action === 'ban' ? 'User banned' : 'User unbanned')
        setBanDialog(null)
        setBanReason('')
        fetchUsers(pagination.page)
        if (selectedUser?.id === banDialog.userId) fetchUserDetail(banDialog.userId)
      } else {
        toast.error(data.error || 'Failed')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleTogglePremium = async (userId: string, action: 'toggle_premium' | 'toggle_early_adopter') => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/premium`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Updated successfully')
        fetchUsers(pagination.page)
        if (selectedUser?.id === userId) fetchUserDetail(userId)
      } else {
        toast.error(data.error || 'Failed')
      }
    } catch {
      toast.error('Network error')
    }
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <Input
        placeholder="Search by nickname..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-10 rounded-xl text-sm"
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-8 px-2 rounded-lg border border-border bg-card text-xs"
        >
          <option value="">All Roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          value={countryFilter}
          onChange={(e) => {
            setCountryFilter(e.target.value)
            setRegionFilter('') // Reset region when country changes
          }}
          className="h-8 px-2 rounded-lg border border-border bg-card text-xs"
        >
          <option value="">All Countries</option>
          {COUNTRY_NAMES.map((c) => (
            <option key={c} value={c}>{getCountryFlag(c)} {c}</option>
          ))}
        </select>
        <select
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          className="h-8 px-2 rounded-lg border border-border bg-card text-xs"
        >
          <option value="">All Regions</option>
          {(countryFilter ? [countryFilter] : COUNTRY_NAMES).flatMap((c) =>
            getRegionsForCountry(c).map((r) => (
              <option key={String(r)} value={String(r)}>{getCountryFlag(c)} {String(r)}</option>
            ))
          )}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'banned')}
          className="h-8 px-2 rounded-lg border border-border bg-card text-xs"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="banned">Banned</option>
        </select>
        <select
          value={premiumFilter}
          onChange={(e) => setPremiumFilter(e.target.value as 'all' | 'premium' | 'free')}
          className="h-8 px-2 rounded-lg border border-border bg-card text-xs"
        >
          <option value="all">All Premium</option>
          <option value="premium">Premium</option>
          <option value="free">Free</option>
        </select>
      </div>

      {/* User list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : users.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-8">No users found</p>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <button
                onClick={() => {
                  if (expandedId === u.id) {
                    setExpandedId(null)
                    setSelectedUser(null)
                  } else {
                    setExpandedId(u.id)
                    fetchUserDetail(u.id)
                  }
                }}
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-card/80 transition-colors"
              >
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-primary">{u.nickname.charAt(0).toUpperCase()}</span>
                  </div>
                  {u.is_online && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-primary border-2 border-card animate-pulse" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">{u.nickname}</span>
                    {u.is_banned && <Badge variant="destructive" className="text-[9px] h-4 px-1">BANNED</Badge>}
                    {u.is_premium && <Badge className="text-[9px] h-4 px-1 bg-primary/20 text-primary border-primary/30"><Crown className="w-2.5 h-2.5 mr-0.5" />P</Badge>}
                    {u.is_early_adopter && <Badge className="text-[9px] h-4 px-1 bg-yellow-500/15 text-yellow-500 border-yellow-500/20"><Star className="w-2.5 h-2.5 mr-0.5" />EA</Badge>}
                    {u.is_banned_posting && <Badge variant="secondary" className="text-[9px] h-4 px-1">No Post</Badge>}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{u.age}yr</span>
                    <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                    <span>{getCountryFlag(u.country)} {u.region}</span>
                    <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                    <span>{u.role}</span>
                  </div>
                </div>
                {expandedId === u.id ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
              </button>

              {/* Expanded detail */}
              {expandedId === u.id && (
                <div className="border-t border-border px-3 pb-3">
                  {detailLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    </div>
                  ) : selectedUser ? (
                    <div className="space-y-3 pt-3">
                      {/* Photos */}
                      {selectedUser.photos.length > 0 && (
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Photos ({selectedUser.photos.length})</span>
                          <div className="flex gap-1.5 mt-1 overflow-x-auto">
                            {selectedUser.photos.map((p) => (
                              <div key={p.id} className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-secondary">
                                <img src={getMediaUrl(p.catbox_url) ?? undefined} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Info grid */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <span className="text-muted-foreground">Bio</span>
                        <span className="truncate">{selectedUser.bio || '—'}</span>
                        <span className="text-muted-foreground">Body</span>
                        <span>{selectedUser.body_type}{selectedUser.height ? ` · ${selectedUser.height}cm` : ''}{selectedUser.weight ? ` · ${selectedUser.weight}kg` : ''}</span>
                        <span className="text-muted-foreground">Availability</span>
                        <span>{selectedUser.availability}</span>
                        <span className="text-muted-foreground">Into Tags</span>
                        <span className="truncate">{selectedUser.into_tags.map((t) => t.tag).join(', ') || '—'}</span>
                        <span className="text-muted-foreground">Reports</span>
                        <span className={selectedUser.reportCount > 0 ? 'text-destructive font-medium' : ''}>{selectedUser.reportCount}</span>
                        <span className="text-muted-foreground">Chats</span>
                        <span>{selectedUser.chatCount}</span>
                        <span className="text-muted-foreground">Posts</span>
                        <span>{selectedUser.postCount}</span>
                        <span className="text-muted-foreground">Joined</span>
                        <span>{new Date(selectedUser.created_at).toLocaleDateString()}</span>
                        {selectedUser.banned_reason && (
                          <>
                            <span className="text-muted-foreground">Ban Reason</span>
                            <span className="text-destructive">{selectedUser.banned_reason}</span>
                          </>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
                        <Button
                          size="sm"
                          variant={selectedUser.is_banned ? 'outline' : 'destructive'}
                          className="h-8 text-xs rounded-lg gap-1"
                          onClick={() => setBanDialog({ userId: u.id, type: 'full', action: selectedUser.is_banned ? 'unban' : 'ban' })}
                        >
                          <Ban className="w-3 h-3" />
                          {selectedUser.is_banned ? 'Unban' : 'Ban'}
                        </Button>
                        <Button
                          size="sm"
                          variant={selectedUser.is_banned_posting ? 'outline' : 'secondary'}
                          className="h-8 text-xs rounded-lg gap-1"
                          onClick={() => setBanDialog({ userId: u.id, type: 'posting', action: selectedUser.is_banned_posting ? 'unban' : 'ban' })}
                        >
                          <MessageSquare className="w-3 h-3" />
                          {selectedUser.is_banned_posting ? 'Allow Posting' : 'Ban Posting'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs rounded-lg gap-1"
                          onClick={() => handleTogglePremium(u.id, 'toggle_premium')}
                        >
                          <Crown className="w-3 h-3" />
                          {selectedUser.is_premium ? 'Remove Premium' : 'Add Premium'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs rounded-lg gap-1"
                          onClick={() => handleTogglePremium(u.id, 'toggle_early_adopter')}
                        >
                          <Star className="w-3 h-3" />
                          {selectedUser.is_early_adopter ? 'Remove Early' : 'Add Early'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">Failed to load details</p>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Pagination */}
          {pagination.page < pagination.totalPages && (
            <Button
              variant="outline"
              className="w-full rounded-xl h-10 text-xs"
              onClick={() => fetchUsers(pagination.page + 1)}
              disabled={loading}
            >
              Load More ({pagination.total - pagination.page * pagination.limit} remaining)
            </Button>
          )}
        </div>
      )}

      {/* Ban Dialog */}
      <Dialog open={!!banDialog} onOpenChange={(open) => { if (!open) { setBanDialog(null); setBanReason('') } }}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {banDialog?.action === 'ban' ? (banDialog?.type === 'full' ? 'Ban User' : 'Ban from Posting') : (banDialog?.type === 'full' ? 'Unban User' : 'Allow Posting')}
            </DialogTitle>
          </DialogHeader>
          {banDialog?.action === 'ban' && (
            <Textarea
              placeholder="Reason for ban (optional)..."
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              className="rounded-xl text-sm resize-none"
              rows={3}
              maxLength={500}
            />
          )}
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => { setBanDialog(null); setBanReason('') }}>Cancel</Button>
            <Button
              variant={banDialog?.action === 'ban' ? 'destructive' : 'default'}
              className="rounded-xl"
              onClick={handleBan}
              disabled={actionLoading}
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
