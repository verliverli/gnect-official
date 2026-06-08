// ============================================
// POST /api/admin/users/[userId]/ban — Ban/unban user
// Phase 9: Full ban or posting ban with audit log
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { checkAdmin, logAdminAction } from '@/lib/admin-helpers'
import { db } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const result = await checkAdmin()
    if ('error' in result) return result.error
    const admin = result.user

    const { userId } = await params
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Missing userId' }, { status: 400 })
    }

    // Admin cannot ban themselves
    if (userId === admin.id) {
      return NextResponse.json({ ok: false, error: 'Cannot ban yourself' }, { status: 400 })
    }

    const body = await request.json()
    const { action, reason, type } = body as {
      action: 'ban' | 'unban'
      reason?: string
      type?: 'full' | 'posting'
    }

    if (!action || !['ban', 'unban'].includes(action)) {
      return NextResponse.json({ ok: false, error: 'action must be "ban" or "unban"' }, { status: 400 })
    }

    const banType = type || 'full'

    // Check user exists
    const targetUser = await db.user.findUnique({ where: { id: userId } })
    if (!targetUser) {
      return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 })
    }

    if (banType === 'full') {
      await db.user.update({
        where: { id: userId },
        data: {
          is_banned: action === 'ban',
          banned_reason: action === 'ban' ? (reason || 'Banned by admin') : null,
        },
      })
    } else if (banType === 'posting') {
      await db.user.update({
        where: { id: userId },
        data: {
          is_banned_posting: action === 'ban',
        },
      })
    }

    // Log the action
    await logAdminAction({
      admin_id: admin.id,
      action: action === 'ban' ? (banType === 'posting' ? 'ban_posting' : 'ban_user') : (banType === 'posting' ? 'unban_posting' : 'unban_user'),
      target_type: 'user',
      target_id: userId,
      details: { action, type: banType, reason: reason || null },
    })

    return NextResponse.json({
      ok: true,
      data: {
        userId,
        action,
        type: banType,
      },
    })
  } catch (err) {
    console.error('Admin ban user error:', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
