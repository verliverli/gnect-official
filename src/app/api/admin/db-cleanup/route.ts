import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

// POST /api/admin/db-cleanup — Wipe all data except admin user (TEMPORARY ROUTE)
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user || !user.is_admin) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const results: Record<string, number> = {}

    // Find admin user to preserve
    const adminUsers = await db.user.findMany({ where: { is_admin: true }, select: { id: true, nickname: true } })
    if (adminUsers.length === 0) {
      return NextResponse.json({ error: 'No admin found — aborting' }, { status: 500 })
    }
    const adminIds = adminUsers.map(a => a.id)

    // Delete all dependent data (in dependency order)
    // Independent tables (no FK dependencies between them)
    const wipeTables = [
      'BroadcastAck',
      'Notification',
      'PushSubscription',
      'PostReport',
      'PostUpvote',
      'PostComment',
      'CommunityPost',
      'ConfessionReport',
      'ConfessionReaction',
      'Confession',
      'HotTakeVote',
      'HotTake',
      'DailyDare',
      'GroupMessage',
      'GroupMember',
      'GroupRoom',
      'UserRating',
      'SupportMessage',
      'SupportConversation',
      'AdminActionLog',
      'ErrorLog',
      'Feedback',
      'AdminBroadcast',
      'RateLimit',
      'IPRegistration',
      'Block',
      'Report',
      'SavedProfile',
      'IntoTag',
      'ProfilePhoto',
    ]

    for (const table of wipeTables) {
      try {
        // @ts-expect-error — dynamic table name
        const result = await db[table].deleteMany()
        results[table] = result.count
      } catch {
        results[table] = -1
      }
    }

    // Delete messages first (depends on Chat)
    try {
      const msgResult = await db.message.deleteMany()
      results['Message'] = msgResult.count
    } catch { results['Message'] = -1 }

    // Delete all chats
    try {
      const chatResult = await db.chat.deleteMany()
      results['Chat'] = chatResult.count
    } catch { results['Chat'] = -1 }

    // Delete all non-admin users
    try {
      const userResult = await db.user.deleteMany({
        where: { id: { notIn: adminIds } },
      })
      results['User (non-admin)'] = userResult.count
    } catch { results['User (non-admin)'] = -1 }

    // Reset admin state
    try {
      await db.user.updateMany({
        where: { is_admin: true },
        data: {
          is_online: false,
          in_app_at: null,
          status_text: null,
          status_gradient: null,
          status_expires_at: null,
          status_views: 0,
          not_today: false,
          not_today_expires: null,
        },
      })
      results['Admin reset'] = 1
    } catch { results['Admin reset'] = -1 }

    // Verify
    const remainingUsers = await db.user.findMany({
      select: { id: true, nickname: true, is_admin: true },
    })

    return NextResponse.json({
      ok: true,
      wiped: results,
      remainingUsers,
    })
  } catch (err) {
    console.error('[ADMIN] DB cleanup error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
