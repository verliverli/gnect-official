// ============================================
// GET /api/admin/support — Admin lists all support conversations
// Batch 2: Support DM to Manager
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { checkAdmin } from '@/lib/admin-helpers'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const result = await checkAdmin()
    if ('error' in result) return result.error

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // "open" | "replied" | "closed" | null (all)

    const where: Record<string, unknown> = {}
    if (status && ['open', 'replied', 'closed'].includes(status)) {
      where.status = status
    }

    const conversations = await db.supportConversation.findMany({
      where,
      orderBy: { updated_at: 'desc' },
      include: {
        user: {
          select: { id: true, nickname: true, region: true },
        },
        messages: {
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
    })

    // Map to include last message preview
    const data = conversations.map((conv) => ({
      id: conv.id,
      user_id: conv.user_id,
      subject: conv.subject,
      status: conv.status,
      created_at: conv.created_at,
      updated_at: conv.updated_at,
      user: conv.user,
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
    console.error('Admin support list error:', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
