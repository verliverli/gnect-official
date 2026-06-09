import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

// POST /api/admin/db-clean — Wipe all data except admin account
// Requires admin authentication + CRON_SECRET as query param
export async function POST(req: NextRequest) {
  try {
    // Verify admin
    const user = await getCurrentUser()
    if (!user || !user.is_admin) {
      return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 403 })
    }

    // Extra security: require CRON_SECRET
    const cronSecret = req.nextUrl.searchParams.get('secret')
    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 403 })
    }

    console.log('🔥 [DB-CLEAN] Starting database cleanup...')

    // Find admin user to preserve
    const admin = await db.user.findFirst({
      where: { is_admin: true }
    })

    if (!admin) {
      return NextResponse.json({ error: 'No admin found — aborting' }, { status: 500 })
    }

    const adminId = admin.id
    const results: Record<string, number> = {}

    // Delete in correct order (respecting foreign keys)
    const deletions = [
      ['GroupMessage', () => db.groupMessage.deleteMany()],
      ['GroupMember', () => db.groupMember.deleteMany()],
      ['GroupRoom', () => db.groupRoom.deleteMany()],
      ['UserRating', () => db.userRating.deleteMany()],
      ['SupportMessage', () => db.supportMessage.deleteMany()],
      ['SupportConversation', () => db.supportConversation.deleteMany()],
      ['AdminActionLog', () => db.adminActionLog.deleteMany()],
      ['ErrorLog', () => db.errorLog.deleteMany()],
      ['Feedback', () => db.feedback.deleteMany()],
      ['BroadcastAck', () => db.broadcastAck.deleteMany()],
      ['AdminBroadcast', () => db.adminBroadcast.deleteMany()],
      ['Notification', () => db.notification.deleteMany()],
      ['PushSubscription', () => db.pushSubscription.deleteMany()],
      ['PostReport', () => db.postReport.deleteMany()],
      ['PostUpvote', () => db.postUpvote.deleteMany()],
      ['PostComment', () => db.postComment.deleteMany()],
      ['CommunityPost', () => db.communityPost.deleteMany()],
      ['RateLimit', () => db.rateLimit.deleteMany()],
      ['Block', () => db.block.deleteMany()],
      ['Report', () => db.report.deleteMany()],
      ['SavedProfile', () => db.savedProfile.deleteMany()],
      ['Message', () => db.message.deleteMany()],
      ['Chat', () => db.chat.deleteMany()],
      ['IntoTag', () => db.intoTag.deleteMany()],
      ['ProfilePhoto', () => db.profilePhoto.deleteMany()],
      ['IPRegistration', () => db.iPRegistration.deleteMany()],
    ] as const

    for (const [name, deleteFn] of deletions) {
      try {
        const result = await deleteFn()
        results[name] = result.count
        console.log(`  ✅ ${name}: ${result.count} deleted`)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        results[name] = -1
        console.log(`  ⚠️ ${name}: ${msg}`)
      }
    }

    // Delete all non-admin users
    const deleteUsers = await db.user.deleteMany({
      where: { NOT: { id: adminId } }
    })
    results['User (non-admin)'] = deleteUsers.count
    console.log(`  ✅ Non-admin users: ${deleteUsers.count} deleted`)

    // Verify admin still exists
    const verifyAdmin = await db.user.findFirst({ where: { id: adminId } })
    if (!verifyAdmin) {
      return NextResponse.json({ error: 'Admin was accidentally deleted!', results }, { status: 500 })
    }

    // Reset AppSettings
    try {
      await db.appSettings.deleteMany()
      await db.appSettings.create({
        data: {
          id: 'app_settings',
          is_premium_free: true,
          early_adopter_count: 0,
          max_early_adopters: 100,
        }
      })
      results['AppSettings'] = 1
    } catch (e: unknown) {
      results['AppSettings'] = -1
    }

    console.log('🔥 [DB-CLEAN] Database cleanup complete!')

    return NextResponse.json({
      success: true,
      message: 'Database cleaned — only admin remains',
      adminPreserved: verifyAdmin.nickname,
      deletions: results,
    })

  } catch (error: unknown) {
    console.error('[DB-CLEAN] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
