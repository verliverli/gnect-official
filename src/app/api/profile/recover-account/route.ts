import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

// ============================================
// ACCOUNT RECOVERY — Phase 8
// Recover a soft-deleted account within 30-day
// grace period by logging back in
// ============================================

// POST /api/profile/recover-account
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
    }

    // Check if user is soft-deleted
    if (!user.is_banned || !user.banned_reason?.startsWith('__SOFT_DELETE_PENDING__:')) {
      return NextResponse.json({ ok: false, error: 'Account is not in recovery period.' }, { status: 400 })
    }

    // Extract deadline from banned_reason
    const deadlineStr = user.banned_reason.replace('__SOFT_DELETE_PENDING__:', '')
    const deadline = new Date(deadlineStr)

    if (new Date() > deadline) {
      // Grace period expired — account should be permanently deleted
      return NextResponse.json({
        ok: false,
        error: 'Recovery period has expired. Your account has been permanently deleted.',
      }, { status: 410 })
    }

    // Recover account
    await db.user.update({
      where: { id: user.id },
      data: {
        is_banned: false,
        banned_reason: null,
        not_today: false,
        is_online: true,
        last_seen: new Date(),
      },
    })

    return NextResponse.json({
      ok: true,
      message: 'Account recovered successfully! Welcome back.',
    })
  } catch (error) {
    console.error('[Recover Account Error]', error)
    return NextResponse.json({ ok: false, error: 'Failed to recover account.' }, { status: 500 })
  }
}
