import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/cron/cleanup — Cleanup expired data
// Called periodically by external cron (cron-job.org) or manually by admin
// Supports two auth methods:
//   1. CRON_SECRET via Authorization header or ?secret= query param (for automated cron jobs)
//   2. Admin user session (for manual triggers)
export async function GET(request?: NextRequest) {
  try {
    // Check for CRON_SECRET — supports header or query param for external cron services
    const cronSecret = process.env.CRON_SECRET
    const authHeader = request?.headers?.get('authorization')
    const hasHeaderSecret = cronSecret && authHeader === `Bearer ${cronSecret}`
    const querySecret = request?.nextUrl?.searchParams?.get('secret')
    const hasQuerySecret = cronSecret && querySecret === cronSecret

    // If no cron secret match, require admin auth
    if (!hasHeaderSecret && !hasQuerySecret) {
      const user = await getCurrentUser()
      if (!user || !user.is_admin) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()

    // ===== 0. Stale online cleanup — mark users offline if last_seen > 5 min ago =====
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
    const staleOnlineUsers = await db.user.updateMany({
      where: {
        is_online: true,
        last_seen: { lt: fiveMinutesAgo },
      },
      data: {
        is_online: false,
        in_app_at: null, // Also clear in_app_at for stale users
      },
    })

    // ===== 0.5. Clear stale in_app_at for users who are offline but still have in_app_at =====
    const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000)
    const staleInAppUsers = await db.user.updateMany({
      where: {
        in_app_at: { not: null, lt: twoMinutesAgo },
      },
      data: {
        in_app_at: null,
      },
    })

    // ===== 1. Clear expired statuses =====
    // Find users with expired status and clear them
    const usersWithExpiredStatus = await db.user.findMany({
      where: {
        status_expires_at: { lt: now },
        NOT: { status_text: null },
      },
      select: { id: true },
    })
    let expiredStatuses = 0
    if (usersWithExpiredStatus.length > 0) {
      const result = await db.user.updateMany({
        where: {
          id: { in: usersWithExpiredStatus.map(u => u.id) },
        },
        data: {
          status_text: null,
          status_gradient: null,
          status_expires_at: null,
          status_views: 0,
        },
      })
      expiredStatuses = result.count
    }

    // ===== 2. Delete expired messages (auto_delete_at) =====
    // This handles: unopened media (30 min), opened media (24h), view-once after timer
    const expiredAutoDelete = await db.message.deleteMany({
      where: {
        NOT: { auto_delete_at: null },
        auto_delete_at: { lt: now },
      },
    })

    // ===== 3. Delete expired messages (hard_delete_at) =====
    // This is the 7-day hard limit — catches everything including text
    const expiredHardDelete = await db.message.deleteMany({
      where: {
        NOT: { hard_delete_at: null },
        hard_delete_at: { lt: now },
      },
    })

    // ===== 4. Delete old notifications (older than 30 days) =====
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const deletedNotifications = await db.notification.deleteMany({
      where: { created_at: { lt: thirtyDaysAgo } },
    })

    // ===== 5. Delete expired admin broadcasts =====
    const expiredBroadcasts = await db.adminBroadcast.deleteMany({
      where: {
        NOT: { expires_at: null },
        expires_at: { lt: now },
      },
    })

    // ===== 6. Delete expired community posts + comments (7-day auto-delete) =====
    // auto_delete_at is required (non-nullable) on these models, so no null check needed
    const expiredPosts = await db.communityPost.deleteMany({
      where: {
        auto_delete_at: { lt: now },
        is_deleted: false,
      },
    })

    const expiredComments = await db.postComment.deleteMany({
      where: {
        auto_delete_at: { lt: now },
        is_deleted: false,
      },
    })

    // ===== 7. Delete expired group messages (7-day auto-delete) =====
    // Group messages auto-delete after 7 days (hard_delete_at is non-nullable on GroupMessage)
    const expiredGroupMessages = await db.groupMessage.deleteMany({
      where: {
        hard_delete_at: { lt: now },
      },
    })

    // ===== 8. Clean up expired rate limits =====
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const expiredRateLimits = await db.rateLimit.deleteMany({
      where: { hour_window_start: { lt: oneHourAgo } },
    })

    // ===== 9. Reset not_today for expired users =====
    const usersWithExpiredNotToday = await db.user.findMany({
      where: {
        not_today: true,
        NOT: { not_today_expires: null },
        not_today_expires: { lt: now },
      },
      select: { id: true },
    })
    let resetNotToday = 0
    if (usersWithExpiredNotToday.length > 0) {
      const result = await db.user.updateMany({
        where: {
          id: { in: usersWithExpiredNotToday.map(u => u.id) },
        },
        data: {
          not_today: false,
          not_today_expires: null,
        },
      })
      resetNotToday = result.count
    }

    // ===== 10. Send scheduled broadcasts that are due =====
    const CHAT_SERVICE_URL = process.env.CHAT_SERVICE_URL || ''
    const scheduledBroadcasts = await db.adminBroadcast.findMany({
      where: {
        is_sent: false,
        scheduled_at: { not: null, lte: now },
      },
    })

    let sentBroadcasts = 0
    for (const broadcast of scheduledBroadcasts) {
      try {
        // Mark as sent
        await db.adminBroadcast.update({
          where: { id: broadcast.id },
          data: { is_sent: true, sent_at: new Date() },
        })

        // Create notification records for target users
        const targetUsers = await db.user.findMany({
          where: {
            is_banned: false,
            is_admin: false,
            ...(broadcast.target_region ? { region: broadcast.target_region } : {}),
          },
          select: { id: true, notification_settings: true },
        })

        const eligibleUsers = targetUsers.filter(u => {
          try {
            const settings = u.notification_settings ? JSON.parse(u.notification_settings) : {}
            return settings.admin_broadcast !== false
          } catch { return true }
        })

        if (eligibleUsers.length > 0) {
          await db.notification.createMany({
            data: eligibleUsers.map((u) => ({
              user_id: u.id,
              type: 'admin_broadcast',
              title: '🔔 Admin Notice',
              body: broadcast.message.slice(0, 100),
              data: JSON.stringify({ broadcastId: broadcast.id, level: broadcast.level }),
            })),
          })

          // Emit real-time broadcast via Socket.io
          const socketPayload = {
            id: broadcast.id,
            type: 'admin_broadcast',
            title: '🔔 Admin Notice',
            body: broadcast.message.slice(0, 100),
            data: { broadcastId: broadcast.id, level: broadcast.level },
            is_read: false,
            created_at: broadcast.created_at.toISOString(),
          }
          fetch(`${CHAT_SERVICE_URL}/emit-broadcast`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notification: socketPayload }),
          }).catch(() => {}) // Fire-and-forget
        }

        sentBroadcasts++
      } catch (e) {
        console.error(`Failed to send scheduled broadcast ${broadcast.id}:`, e)
      }
    }

    // ===== 11. Phase 8: Permanently delete soft-deleted accounts past grace period =====
    const softDeletedUsers = await db.user.findMany({
      where: {
        is_banned: true,
        banned_reason: { startsWith: '__SOFT_DELETE_PENDING__:' },
      },
      select: { id: true, banned_reason: true },
    })

    let permanentlyDeleted = 0
    for (const u of softDeletedUsers) {
      const deadlineStr = u.banned_reason?.replace('__SOFT_DELETE_PENDING__:', '')
      if (!deadlineStr) continue
      const deadline = new Date(deadlineStr)
      if (now > deadline) {
        // Grace period expired — permanently delete
        try {
          // Delete all related data
          await db.postReport.deleteMany({ where: { reporter_id: u.id } })
          await db.postUpvote.deleteMany({ where: { user_id: u.id } })
          await db.postComment.deleteMany({ where: { user_id: u.id } })
          await db.communityPost.deleteMany({ where: { user_id: u.id } })
          await db.broadcastAck.deleteMany({ where: { user_id: u.id } })
          await db.notification.deleteMany({ where: { user_id: u.id } })
          await db.pushSubscription.deleteMany({ where: { user_id: u.id } })
          await db.report.deleteMany({ where: { reporter_id: u.id } })
          await db.report.deleteMany({ where: { reported_user_id: u.id } })
          await db.block.deleteMany({ where: { blocker_id: u.id } })
          await db.block.deleteMany({ where: { blocked_id: u.id } })
          await db.savedProfile.deleteMany({ where: { user_id: u.id } })
          await db.savedProfile.deleteMany({ where: { saved_user_id: u.id } })
          await db.rateLimit.deleteMany({ where: { user_id: u.id } })
          await db.profilePhoto.deleteMany({ where: { user_id: u.id } })
          await db.intoTag.deleteMany({ where: { user_id: u.id } })
          // Missing models from original — add Feedback, Support, Ratings
          await db.feedback.deleteMany({ where: { user_id: u.id } })
          await db.supportMessage.deleteMany({ where: { sender_id: u.id } })
          await db.supportConversation.deleteMany({ where: { user_id: u.id } })
          await db.userRating.deleteMany({ where: { OR: [{ rater_id: u.id }, { rated_user_id: u.id }] } })
          const userChats = await db.chat.findMany({
            where: { OR: [{ user1_id: u.id }, { user2_id: u.id }] },
            select: { id: true },
          })
          for (const chat of userChats) {
            await db.message.deleteMany({ where: { chat_id: chat.id } })
            await db.chat.delete({ where: { id: chat.id } })
          }
          await db.user.delete({ where: { id: u.id } })
          permanentlyDeleted++
        } catch (e) {
          console.error(`Failed to permanently delete user ${u.id}:`, e)
        }
      }
    }

    return NextResponse.json({
      ok: true,
      staleOnlineCleaned: staleOnlineUsers.count,
      staleInAppCleaned: staleInAppUsers.count,
      expiredStatuses,
      expiredAutoDeleteMessages: expiredAutoDelete.count,
      expiredHardDeleteMessages: expiredHardDelete.count,
      deletedNotifications: deletedNotifications.count,
      expiredBroadcasts: expiredBroadcasts.count,
      expiredPosts: expiredPosts.count,
      expiredComments: expiredComments.count,
      expiredGroupMessages: expiredGroupMessages.count,
      expiredRateLimits: expiredRateLimits.count,
      resetNotToday,
      sentScheduledBroadcasts: sentBroadcasts,
      permanentlyDeletedAccounts: permanentlyDeleted,
    })
  } catch (err) {
    console.error('Cleanup error:', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
