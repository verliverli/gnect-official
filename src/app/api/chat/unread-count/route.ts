import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

// GET /api/chat/unread-count — Returns total unread message count for the current user
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  // Get all chat IDs where user is a participant (user1 or user2)
  const chats = await db.chat.findMany({
    where: {
      OR: [
        { user1_id: user.id },
        { user2_id: user.id },
      ],
    },
    select: { id: true },
  })

  const chatIds = chats.map((c) => c.id)

  if (chatIds.length === 0) {
    return NextResponse.json({ ok: true, count: 0 })
  }

  // Count unread messages from other users across all chats
  const result = await db.message.aggregate({
    _count: { id: true },
    where: {
      chat_id: { in: chatIds },
      sender_id: { not: user.id },
      viewed: false,
      is_unsent: false,
      is_ghost_deleted: false,
    },
  })

  return NextResponse.json({ ok: true, count: result._count.id })
}
