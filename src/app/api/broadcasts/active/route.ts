import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/broadcasts/active — Get active broadcasts for this user
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const now = new Date()

    const broadcasts = await db.adminBroadcast.findMany({
      where: {
        is_sent: true,
        expires_at: { gt: now },
        OR: [
          { target_region: user.region },
          { target_region: null },
        ],
      },
      orderBy: { created_at: 'desc' },
      include: {
        acknowledgements: {
          where: { user_id: user.id },
          select: { id: true, acked_at: true },
        },
      },
    })

    const result = broadcasts.map((b) => ({
      id: b.id,
      title: b.title,
      message: b.message,
      level: b.level,
      action_label: b.action_label,
      action_url: b.action_url,
      created_at: b.created_at,
      is_acknowledged: b.acknowledgements.length > 0,
    }))

    // Separate urgent (unacknowledged) from info
    const urgent = result.filter((b) => b.level === 'urgent' && !b.is_acknowledged)
    const info = result.filter((b) => b.level === 'info' || b.is_acknowledged)

    return NextResponse.json({ ok: true, urgent, info })
  } catch (err) {
    console.error('Active broadcasts error:', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
