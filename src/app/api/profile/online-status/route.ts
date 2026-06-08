import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/profile/online-status — Update user online status (called by chat service)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, isOnline } = body

    if (!userId || typeof isOnline !== 'boolean') {
      return NextResponse.json({ ok: false, error: 'userId and isOnline (boolean) required' }, { status: 400 })
    }

    await db.user.update({
      where: { id: userId },
      data: {
        is_online: isOnline,
        ...(isOnline ? {} : { last_seen: new Date() }),
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Online status update error:', error)
    return NextResponse.json({ ok: false, error: 'Failed to update online status' }, { status: 500 })
  }
}
