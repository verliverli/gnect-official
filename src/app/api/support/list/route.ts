// ============================================
// GET /api/support/list — List user's support conversations
// Batch 2: Support DM to Manager
// ============================================

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const conversations = await db.supportConversation.findMany({
      where: { user_id: user.id },
      orderBy: { updated_at: 'desc' },
      include: {
        messages: {
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
    })

    // Map to include last message preview
    const data = conversations.map((conv) => ({
      id: conv.id,
      subject: conv.subject,
      status: conv.status,
      created_at: conv.created_at,
      updated_at: conv.updated_at,
      last_message: conv.messages[0]
        ? {
            content: conv.messages[0].content,
            is_from_admin: conv.messages[0].is_from_admin,
            created_at: conv.messages[0].created_at,
          }
        : null,
    }))

    return NextResponse.json({ ok: true, data })
  } catch (err) {
    console.error('Support list error:', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
