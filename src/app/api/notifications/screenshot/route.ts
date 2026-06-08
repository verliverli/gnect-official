import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createNotification } from '@/lib/notifications'
import { db } from '@/lib/db'

// Rate limit: max 1 screenshot notification per user per 60 seconds
const screenshotNotifCooldown = new Map<string, number>()
const COOLDOWN_MS = 60_000

// POST /api/notifications/screenshot — Screenshot detected
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const chatId = searchParams.get('chatId')

    // Rate limit check
    const now = Date.now()
    const lastNotif = screenshotNotifCooldown.get(user.id)
    if (lastNotif && now - lastNotif < COOLDOWN_MS) {
      return NextResponse.json({ ok: true, rateLimited: true })
    }
    screenshotNotifCooldown.set(user.id, now)

    // Find the chat partner to send the notification to them
    let partnerId: string | null = null
    if (chatId) {
      const chat = await db.chat.findFirst({
        where: { id: chatId, OR: [{ user1_id: user.id }, { user2_id: user.id }] },
      })
      if (!chat) {
        return NextResponse.json({ ok: false, error: 'Chat not found' }, { status: 404 })
      }
      partnerId = chat.user1_id === user.id ? chat.user2_id : chat.user1_id
    }

    if (!partnerId) {
      return NextResponse.json({ ok: false, error: 'Chat ID required' }, { status: 400 })
    }

    // Create a notification for the chat partner that a screenshot was detected
    await createNotification({
      userId: partnerId,
      type: 'screenshot',
      title: '📸 Screenshot detected',
      body: 'A screenshot was captured in your chat. Be careful sharing sensitive content.',
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Screenshot notification error:', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
