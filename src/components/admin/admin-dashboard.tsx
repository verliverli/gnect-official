'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Users, Wifi, UserPlus, Calendar, MessageCircle, FileText, AlertTriangle, Bug, Loader2, TrendingUp, Globe } from 'lucide-react'

// Dynamic import for recharts — heavy chart library (~60KB), only loads when admin views dashboard
const GrowthChart = dynamic(
  () => import('./growth-chart').then((mod) => mod.GrowthChart),
  {
    loading: () => <div className="h-[140px] flex items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>,
    ssr: false,
  }
)

interface DashboardData {
  users: { total: number; online: number; newToday: number; newThisWeek: number }
  content: { totalChats: number; totalMessages: number; totalCommunityPosts: number }
  reports: { pendingUserReports: number; pendingPostReports: number }
  errors: { unresolved: number }
  feedback: { newCount: number }
  regionBreakdown: { region: string; count: number; country: string; countryFlag: string }[]
  countryBreakdown: { country: string; flag: string; count: number }[]
  userGrowth: { date: string; count: number }[]
}

export function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/dashboard', { credentials: 'same-origin' })
      const json = await res.json()
      if (json.ok) setData(json.data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  if (!data) {
    return <p className="text-sm text-muted-foreground text-center py-8">Failed to load dashboard</p>
  }

  const pendingReports = data.reports.pendingUserReports + data.reports.pendingPostReports

  return (
    <div className="space-y-4">
      {/* Row 1: User stats */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard icon={<Users className="w-4 h-4" />} label="Total Users" value={data.users.total} />
        <StatCard icon={<Wifi className="w-4 h-4" />} label="Online Now" value={data.users.online} accent />
        <StatCard icon={<UserPlus className="w-4 h-4" />} label="New Today" value={data.users.newToday} />
        <StatCard icon={<Calendar className="w-4 h-4" />} label="New This Week" value={data.users.newThisWeek} />
      </div>

      {/* Row 2: Content stats */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard icon={<MessageCircle className="w-4 h-4" />} label="Total Chats" value={data.content.totalChats} />
        <StatCard icon={<FileText className="w-4 h-4" />} label="Community Posts" value={data.content.totalCommunityPosts} />
        <StatCard icon={<AlertTriangle className="w-4 h-4" />} label="Pending Reports" value={pendingReports} danger={pendingReports > 0} />
        <StatCard icon={<Bug className="w-4 h-4" />} label="Errors" value={data.errors.unresolved} danger={data.errors.unresolved > 0} />
      </div>

      {/* 7-day user growth chart */}
      <div className="bg-zinc-900/80 border border-zinc-700/60 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold text-zinc-100">7-Day Signups</span>
        </div>
        {data.userGrowth.length > 0 ? (
          <GrowthChart data={data.userGrowth} />
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">No data</p>
        )}
      </div>

      {/* Top 5 regions */}
      <div className="bg-zinc-900/80 border border-zinc-700/60 rounded-xl p-4">
        <span className="text-sm font-semibold mb-3 block text-zinc-100">Top 5 Regions</span>
        {data.regionBreakdown.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">No data</p>
        ) : (
          <div className="space-y-2">
            {data.regionBreakdown.map((r, i) => {
              const maxCount = data.regionBreakdown[0]?.count || 1
              const pct = Math.max(10, (r.count / maxCount) * 100)
              const barColors = ['bg-emerald-400', 'bg-emerald-500', 'bg-teal-400', 'bg-green-400', 'bg-lime-400']
              return (
                <div key={r.region} className="flex items-center gap-2">
                  <span className="text-sm shrink-0">{r.countryFlag}</span>
                  <span className="text-xs text-zinc-300 w-24 truncate shrink-0 font-medium">{r.region}</span>
                  <div className="flex-1 h-6 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700">
                    <div
                      className={`h-full ${barColors[i % barColors.length]} rounded-full transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-emerald-400 w-10 text-right">{r.count}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Top 5 countries */}
      <div className="bg-zinc-900/80 border border-zinc-700/60 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold text-zinc-100">Top 5 Countries</span>
        </div>
        {data.countryBreakdown.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">No data</p>
        ) : (
          <div className="space-y-2">
            {data.countryBreakdown.map((c, ci) => {
              const maxCount = data.countryBreakdown[0]?.count || 1
              const pct = Math.max(10, (c.count / maxCount) * 100)
              const barColors = ['bg-emerald-400', 'bg-emerald-500', 'bg-teal-400', 'bg-green-400', 'bg-lime-400']
              return (
                <div key={c.country} className="flex items-center gap-2">
                  <span className="text-sm shrink-0">{c.flag}</span>
                  <span className="text-xs text-zinc-300 w-24 truncate shrink-0 font-medium">{c.country}</span>
                  <div className="flex-1 h-6 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700">
                    <div
                      className={`h-full ${barColors[ci % barColors.length]} rounded-full transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-emerald-400 w-10 text-right">{c.count}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Quick summary */}
      <div className="bg-zinc-900/80 border border-zinc-700/60 rounded-xl p-4">
        <span className="text-sm font-semibold mb-2 block text-zinc-100">Quick Summary</span>
        <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-xs">
          <span className="text-zinc-400">Total Messages</span>
          <span className="font-bold text-zinc-100 text-right">{data.content.totalMessages.toLocaleString()}</span>
          <span className="text-zinc-400">New Feedback</span>
          <span className="font-bold text-emerald-400 text-right">{data.feedback.newCount}</span>
          <span className="text-zinc-400">User Reports</span>
          <span className="font-bold text-amber-400 text-right">{data.reports.pendingUserReports}</span>
          <span className="text-zinc-400">Post Reports</span>
          <span className="font-bold text-amber-400 text-right">{data.reports.pendingPostReports}</span>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, accent, danger }: {
  icon: React.ReactNode
  label: string
  value: number
  accent?: boolean
  danger?: boolean
}) {
  return (
    <div className={`rounded-xl p-3 border ${
      danger 
        ? 'bg-red-950/50 border-red-500/40' 
        : accent 
          ? 'bg-emerald-950/50 border-emerald-500/40' 
          : 'bg-zinc-900/80 border-zinc-700/60'
    }`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={accent ? 'text-emerald-400' : danger ? 'text-red-400' : 'text-zinc-400'}>{icon}</span>
        <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium">{label}</span>
      </div>
      <p className={`text-xl font-bold ${accent ? 'text-emerald-400' : danger ? 'text-red-400' : 'text-zinc-100'}`}>
        {value.toLocaleString()}
      </p>
    </div>
  )
}
