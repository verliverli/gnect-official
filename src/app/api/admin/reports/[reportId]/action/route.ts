// ============================================
// POST /api/admin/reports/[reportId]/action — Handle report action
// Phase 9: Dismiss, warn, ban user, ban posting, or delete post
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { checkAdmin, logAdminAction } from '@/lib/admin-helpers'
import { db } from '@/lib/db'
import { createNotification } from '@/lib/notifications'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const result = await checkAdmin()
    if ('error' in result) return result.error
    const admin = result.user

    const { reportId } = await params
    if (!reportId) {
      return NextResponse.json({ ok: false, error: 'Missing reportId' }, { status: 400 })
    }

    const body = await request.json()
    const { action, reportType } = body as {
      action: 'dismiss' | 'warn' | 'ban_user' | 'ban_posting' | 'delete_post'
      reportType: 'user' | 'post'
    }

    if (!action || !['dismiss', 'warn', 'ban_user', 'ban_posting', 'delete_post'].includes(action)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid action' },
        { status: 400 }
      )
    }
    if (!reportType || !['user', 'post'].includes(reportType)) {
      return NextResponse.json(
        { ok: false, error: 'reportType must be "user" or "post"' },
        { status: 400 }
      )
    }

    if (reportType === 'user') {
      // Find the user report
      const report = await db.report.findUnique({
        where: { id: reportId },
        include: { reported: { select: { id: true } } },
      })
      if (!report) {
        return NextResponse.json({ ok: false, error: 'Report not found' }, { status: 404 })
      }

      switch (action) {
        case 'dismiss':
          // Delete the report (dismiss = remove from queue)
          await db.report.delete({ where: { id: reportId } })
          break

        case 'warn':
          // Dismiss the report and send a warning notification to the reported user
          await db.report.delete({ where: { id: reportId } })
          try {
            await createNotification({
              userId: report.reported_user_id,
              type: 'admin_broadcast',
              title: '⚠️ Warning from GNECT Team',
              body: "You've received a warning. Please review community guidelines.",
            })
          } catch {
            // Notification failure should not block the action
          }
          break

        case 'ban_user':
          // Ban the reported user fully
          await db.user.update({
            where: { id: report.reported_user_id },
            data: {
              is_banned: true,
              banned_reason: `Banned by admin due to report: ${report.reason}`,
            },
          })
          await db.report.delete({ where: { id: reportId } })
          break

        case 'ban_posting':
          // Ban the reported user from posting
          await db.user.update({
            where: { id: report.reported_user_id },
            data: { is_banned_posting: true },
          })
          await db.report.delete({ where: { id: reportId } })
          break

        case 'delete_post':
          // Not applicable for user reports
          return NextResponse.json(
            { ok: false, error: 'delete_post action is only for post reports' },
            { status: 400 }
          )
      }

      // Log the action
      await logAdminAction({
        admin_id: admin.id,
        action: `report_${action}`,
        target_type: 'report',
        target_id: reportId,
        details: { reportType, reportedUserId: report.reported_user_id, originalReason: report.reason },
      })
    } else {
      // Post report
      const report = await db.postReport.findUnique({
        where: { id: reportId },
        include: {
          post: { select: { id: true, user_id: true } },
        },
      })
      if (!report) {
        return NextResponse.json({ ok: false, error: 'Report not found' }, { status: 404 })
      }

      switch (action) {
        case 'dismiss':
          await db.postReport.delete({ where: { id: reportId } })
          break

        case 'warn':
          // Dismiss + send warning notification to the post author
          await db.postReport.delete({ where: { id: reportId } })
          try {
            await createNotification({
              userId: report.post.user_id,
              type: 'admin_broadcast',
              title: '⚠️ Warning from GNECT Team',
              body: "You've received a warning. Please review community guidelines.",
            })
          } catch {
            // Notification failure should not block the action
          }
          break

        case 'ban_user':
          // Ban the post author
          await db.user.update({
            where: { id: report.post.user_id },
            data: {
              is_banned: true,
              banned_reason: `Banned by admin due to post report: ${report.reason}`,
            },
          })
          await db.postReport.delete({ where: { id: reportId } })
          break

        case 'ban_posting':
          // Ban the post author from posting
          await db.user.update({
            where: { id: report.post.user_id },
            data: { is_banned_posting: true },
          })
          await db.postReport.delete({ where: { id: reportId } })
          break

        case 'delete_post':
          // Soft delete the community post
          await db.communityPost.update({
            where: { id: report.post_id },
            data: { is_deleted: true },
          })
          await db.postReport.delete({ where: { id: reportId } })
          break
      }

      // Log the action
      await logAdminAction({
        admin_id: admin.id,
        action: `report_${action}`,
        target_type: 'report',
        target_id: reportId,
        details: { reportType, postId: report.post_id, postAuthorId: report.post.user_id, originalReason: report.reason },
      })
    }

    return NextResponse.json({
      ok: true,
      data: { reportId, action, reportType },
    })
  } catch (err) {
    console.error('Admin report action error:', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
