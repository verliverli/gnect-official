// ============================================
// GET /api/admin/dashboard — Admin dashboard stats
// Phase 9: Aggregated stats for the admin panel
// ============================================

import { NextResponse } from 'next/server'
import { checkAdmin } from '@/lib/admin-helpers'
import { db } from '@/lib/db'
import { COUNTRIES, getCountryFlag } from '@/lib/constants'

export async function GET() {
  try {
    const result = await checkAdmin()
    if ('error' in result) return result.error

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - 7)
    weekStart.setHours(0, 0, 0, 0)

    // User stats — run sequentially to avoid memory pressure
    const totalUsers = await db.user.count({ where: { is_admin: false } })
    const totalOnline = await db.user.count({ where: { is_admin: false, is_online: true } })
    const newUsersToday = await db.user.count({ where: { is_admin: false, created_at: { gte: todayStart } } })
    const newUsersThisWeek = await db.user.count({ where: { is_admin: false, created_at: { gte: weekStart } } })

    // Chat & content stats
    const totalChats = await db.chat.count()
    const totalMessages = await db.message.count()
    const totalCommunityPosts = await db.communityPost.count({ where: { is_deleted: false } })

    // Report stats
    const totalPendingUserReports = await db.report.count()
    const totalPendingPostReports = await db.postReport.count()

    // Error & feedback stats
    const unresolvedErrors = await db.errorLog.count({ where: { is_resolved: false } })
    const newFeedbackCount = await db.feedback.count({ where: { status: 'new' } })

    // Region breakdown: top 5 regions by user count (simplified)
    const allUsers = await db.user.findMany({
      where: { is_admin: false, region: { not: '' } },
      select: { region: true, country: true },
    })
    const regionCounts: Record<string, number> = {}
    const regionCountryMap: Record<string, string> = {} // region -> country mapping
    for (const u of allUsers) {
      regionCounts[u.region] = (regionCounts[u.region] || 0) + 1
      if (!regionCountryMap[u.region]) {
        regionCountryMap[u.region] = u.country || ''
      }
    }
    const regionBreakdown = Object.entries(regionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([region, count]) => ({
        region,
        count,
        country: regionCountryMap[region] || '',
        countryFlag: getCountryFlag(regionCountryMap[region] || ''),
      }))

    // Country breakdown: users per country
    const countryCounts: Record<string, number> = {}
    for (const u of allUsers) {
      const c = u.country || 'Unknown'
      countryCounts[c] = (countryCounts[c] || 0) + 1
    }
    const countryBreakdown = Object.entries(countryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([country, count]) => ({
        country,
        flag: getCountryFlag(country),
        count,
      }))

    // User growth: last 7 days — simplified (skip the loop for now, just return today's count)
    const userGrowth = [{ date: todayStart.toISOString().split('T')[0], count: newUsersToday }]

    return NextResponse.json({
      ok: true,
      data: {
        users: {
          total: totalUsers,
          online: totalOnline,
          newToday: newUsersToday,
          newThisWeek: newUsersThisWeek,
        },
        content: {
          totalChats,
          totalMessages,
          totalCommunityPosts,
        },
        reports: {
          pendingUserReports: totalPendingUserReports,
          pendingPostReports: totalPendingPostReports,
        },
        errors: {
          unresolved: unresolvedErrors,
        },
        feedback: {
          newCount: newFeedbackCount,
        },
        regionBreakdown: regionBreakdown.map((r) => ({
          region: r.region,
          count: r.count,
          country: r.country,
          countryFlag: r.countryFlag,
        })),
        countryBreakdown,
        userGrowth,
      },
    })
  } catch (err) {
    console.error('Admin dashboard error:', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
