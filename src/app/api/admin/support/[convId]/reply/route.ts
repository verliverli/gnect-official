// ============================================
// POST /api/admin/support/[convId]/reply — Admin replies to conversation
// Batch 2: Support DM to Manager
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { checkAdmin, logAdminAction } from '@/lib/admin-helpers'
import { db } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ convId: string }> }
) {
  try {
    const result = await checkAdmin()
    if ('error' in result) return result.error
    const admin = result.user

    const { convId } = await params
    if (!convId) {
      return NextResponse.json({ ok: false, error: 'Missing conversation ID' }, { status: 400 })
    }

    const conversation = await db.supportConversation.findUnique({
      where: { id: convId },
    })

    if (!conversation) {
      return NextResponse.json({ ok: false, error: 'Conversation not found' }, { status: 404 })
    }

    if (conversation.status === 'closed') {
      return NextResponse.json(
        { ok: false, error: 'This conversation is closed' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { content } = body as { content?: string }

    if (!content || content.trim().length < 1) {
      return NextResponse.json(
        { ok: false, error: 'Reply cannot be empty' },
        { status: 400 }
      )
    }

    // Create admin message + update status to "replied"
    const message = await db.supportMessage.create({
      data: {
        conversation_id: convId,
        sender_id: admin.id,
        is_from_admin: true,
        content: content.trim(),
      },
    })

    await db.supportConversation.update({
      where: { id: convId },
      data: { status: 'replied' },
    })

    // Log admin action
    await logAdminAction({
      admin_id: admin.id,
      action: 'support_reply',
      target_type: 'support_conversation',
      target_id: convId,
      details: { message_id: message.id },
    })

    return NextResponse.json({ ok: true, data: message })
  } catch (err) {
    console.error('Admin support reply error:', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
