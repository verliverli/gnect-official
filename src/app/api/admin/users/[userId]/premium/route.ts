// ============================================
// POST /api/admin/users/[userId]/premium — Toggle premium/early adopter
// Phase 9: Toggle user premium or early adopter status with audit log
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

    // Admin cannot modify themselves
    if (userId === admin.id) {
      return NextResponse.json({ ok: false, error: 'Cannot modify yourself' }, { status: 400 })
    }

    const body = await request.json()
    const { action } = body as { action: 'toggle_premium' | 'toggle_early_adopter' }

    if (!action || !['toggle_premium', 'toggle_early_adopter'].includes(action)) {
      return NextResponse.json(
        { ok: false, error: 'action must be "toggle_premium" or "toggle_early_adopter"' },
        { status: 400 }
      )
    }

    // Check user exists
    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, is_premium: true, is_early_adopter: true },
    })
    if (!targetUser) {
      return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 })
    }

    let newValue: boolean
    if (action === 'toggle_premium') {
      newValue = !targetUser.is_premium
      await db.user.update({
        where: { id: userId },
        data: { is_premium: newValue },
      })
    } else {
      newValue = !targetUser.is_early_adopter
      await db.user.update({
        where: { id: userId },
        data: { is_early_adopter: newValue },
      })
    }

    // Log the action
    await logAdminAction({
      admin_id: admin.id,
      action,
      target_type: 'user',
      target_id: userId,
      details: { field: action === 'toggle_premium' ? 'is_premium' : 'is_early_adopter', newValue },
    })

    return NextResponse.json({
      ok: true,
      data: {
        userId,
        action,
        newValue,
      },
    })
  } catch (err) {
    console.error('Admin premium toggle error:', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
