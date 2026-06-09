import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

// POST /api/profile/heartbeat — In-app heartbeat
// Called periodically by the client (every 60s) to indicate the user is actively using the app
// Updates in_app_at timestamp. If in_app_at is within the last 2 minutes, user shows "In App"
export async function POST() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        in_app_at: new Date(),
        is_online: true,
        last_seen: new Date(),
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Heartbeat error:', error)
    return NextResponse.json({ ok: false, error: 'Heartbeat failed' }, { status: 500 })
  }
}
