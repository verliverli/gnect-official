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
        <StatCard icon={<Users className="w-4 h-4" />} label="Total Users" value={data.users.total} color="white" />
        <StatCard icon={<Wifi className="w-4 h-4" />} label="Online Now" value={data.users.online} color="green" />
        <StatCard icon={<UserPlus className="w-4 h-4" />} label="New Today" value={data.users.newToday} color="cyan" />
        <StatCard icon={<Calendar className="w-4 h-4" />} label="New This Week" value={data.users.newThisWeek} color="yellow" />
      </div>

      {/* Row 2: Content stats */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard icon={<MessageCircle className="w-4 h-4" />} label="Total Chats" value={data.content.totalChats} color="purple" />
        <StatCard icon={<FileText className="w-4 h-4" />} label="Community Posts" value={data.content.totalCommunityPosts} color="pink" />
        <StatCard icon={<AlertTriangle className="w-4 h-4" />} label="Pending Reports" value={pendingReports} color="red" />
        <StatCard icon={<Bug className="w-4 h-4" />} label="Errors" value={data.errors.unresolved} color="orange" />
      </div>

      {/* 7-day user growth chart */}
      <div className="bg-[#1e1e30] border border-white/10 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-[#4ade80]" />
          <span className="text-sm font-semibold text-white">7-Day Signups</span>
        </div>
        {data.userGrowth.length > 0 ? (
          <GrowthChart data={data.userGrowth} />
        ) : (
          <p className="text-xs text-gray-400 text-center py-4">No data</p>
        )}
      </div>

      {/* Top 5 regions */}
      <div className="bg-[#1e1e30] border border-white/10 rounded-xl p-4">
        <span className="text-sm font-semibold mb-3 block text-white">Top 5 Regions</span>
        {data.regionBreakdown.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-2">No data</p>
        ) : (
          <div className="space-y-2">
            {data.regionBreakdown.map((r, i) => {
              const maxCount = data.regionBreakdown[0]?.count || 1
              const pct = Math.max(10, (r.count / maxCount) * 100)
              const barColors = ['bg-[#4ade80]', 'bg-[#22d3ee]', 'bg-[#a78bfa]', 'bg-[#f472b6]', 'bg-[#fbbf24]']
              return (
                <div key={r.region} className="flex items-center gap-2">
                  <span className="text-sm shrink-0">{r.countryFlag}</span>
                  <span className="text-xs text-white w-24 truncate shrink-0 font-medium">{r.region}</span>
                  <div className="flex-1 h-6 bg-black/40 rounded-full overflow-hidden border border-white/10">
                    <div
                      className={`h-full ${barColors[i % barColors.length]} rounded-full transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-white w-10 text-right">{r.count}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Top 5 countries */}
      <div className="bg-[#1e1e30] border border-white/10 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-4 h-4 text-[#4ade80]" />
          <span className="text-sm font-semibold text-white">Top 5 Countries</span>
        </div>
        {data.countryBreakdown.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-2">No data</p>
        ) : (
          <div className="space-y-2">
            {data.countryBreakdown.map((c, ci) => {
              const maxCount = data.countryBreakdown[0]?.count || 1
              const pct = Math.max(10, (c.count / maxCount) * 100)
              const barColors = ['bg-[#4ade80]', 'bg-[#22d3ee]', 'bg-[#a78bfa]', 'bg-[#f472b6]', 'bg-[#fbbf24]']
              return (
                <div key={c.country} className="flex items-center gap-2">
                  <span className="text-sm shrink-0">{c.flag}</span>
                  <span className="text-xs text-white w-24 truncate shrink-0 font-medium">{c.country}</span>
                  <div className="flex-1 h-6 bg-black/40 rounded-full overflow-hidden border border-white/10">
                    <div
                      className={`h-full ${barColors[ci % barColors.length]} rounded-full transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-white w-10 text-right">{c.count}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Quick summary */}
      <div className="bg-[#1e1e30] border border-white/10 rounded-xl p-4">
        <span className="text-sm font-semibold mb-2 block text-white">Quick Summary</span>
        <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-xs">
          <span className="text-gray-400">Total Messages</span>
          <span className="font-bold text-white text-right">{data.content.totalMessages.toLocaleString()}</span>
          <span className="text-gray-400">New Feedback</span>
          <span className="font-bold text-[#4ade80] text-right">{data.feedback.newCount}</span>
          <span className="text-gray-400">User Reports</span>
          <span className="font-bold text-[#fbbf24] text-right">{data.reports.pendingUserReports}</span>
          <span className="text-gray-400">Post Reports</span>
          <span className="font-bold text-[#fbbf24] text-right">{data.reports.pendingPostReports}</span>
        </div>
      </div>
    </div>
  )
}

// Color map for StatCard — each stat gets a unique bright color
const CARD_STYLES: Record<string, { bg: string; border: string; icon: string; label: string; value: string }> = {
  white:  { bg: 'bg-[#1e1e30]', border: 'border-white/20', icon: 'text-white',       label: 'text-gray-300', value: 'text-white' },
  green:  { bg: 'bg-[#0a2e1a]', border: 'border-[#4ade80]/40', icon: 'text-[#4ade80]', label: 'text-[#86efac]', value: 'text-[#4ade80]' },
  cyan:   { bg: 'bg-[#0a1e2e]', border: 'border-[#22d3ee]/40', icon: 'text-[#22d3ee]', label: 'text-[#67e8f9]', value: 'text-[#22d3ee]' },
  yellow: { bg: 'bg-[#2e2a0a]', border: 'border-[#fbbf24]/40', icon: 'text-[#fbbf24]', label: 'text-[#fde68a]', value: 'text-[#fbbf24]' },
  purple: { bg: 'bg-[#1a0a2e]', border: 'border-[#a78bfa]/40', icon: 'text-[#a78bfa]', label: 'text-[#c4b5fd]', value: 'text-[#a78bfa]' },
  pink:   { bg: 'bg-[#2e0a1e]', border: 'border-[#f472b6]/40', icon: 'text-[#f472b6]', label: 'text-[#f9a8d4]', value: 'text-[#f472b6]' },
  red:    { bg: 'bg-[#2e0a0a]', border: 'border-[#f87171]/40', icon: 'text-[#f87171]', label: 'text-[#fca5a5]', value: 'text-[#f87171]' },
  orange: { bg: 'bg-[#2e1a0a]', border: 'border-[#fb923c]/40', icon: 'text-[#fb923c]', label: 'text-[#fdba74]', value: 'text-[#fb923c]' },
}

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode
  label: string
  value: number
  color: string
}) {
  const style = CARD_STYLES[color] || CARD_STYLES.white
  return (
    <div className={`rounded-xl p-3 border ${style.bg} ${style.border}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={style.icon}>{icon}</span>
        <span className={`text-[10px] uppercase tracking-wider font-medium ${style.label}`}>{label}</span>
      </div>
      <p className={`text-xl font-bold ${style.value}`}>
        {value.toLocaleString()}
      </p>
    </div>
  )
}
