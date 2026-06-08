// ============================================
// POST /api/support/[convId]/reply — User sends follow-up message
// Batch 2: Support DM to Manager
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ convId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { convId } = await params
    if (!convId) {
      return NextResponse.json({ ok: false, error: 'Missing conversation ID' }, { status: 400 })
    }

    // Check conversation exists and belongs to user
    const conversation = await db.supportConversation.findUnique({
      where: { id: convId },
    })

    if (!conversation) {
      return NextResponse.json({ ok: false, error: 'Conversation not found' }, { status: 404 })
    }

    if (conversation.user_id !== user.id) {
      return NextResponse.json({ ok: false, error: 'Access denied' }, { status: 403 })
    }

    // Can't reply to closed conversation
    if (conversation.status === 'closed') {
      return NextResponse.json(
        { ok: false, error: 'This conversation is closed' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { content } = body as { content?: string }

    if (!content || content.trim().length < 20) {
      return NextResponse.json(
        { ok: false, error: 'Message must be at least 20 characters' },
        { status: 400 }
      )
    }

    // Create message + update conversation status to "open" if it was "replied"
    const message = await db.supportMessage.create({
      data: {
        conversation_id: convId,
        sender_id: user.id,
        is_from_admin: false,
        content: content.trim(),
      },
    })

    // Update conversation: set status to "open" if it was "replied"
    if (conversation.status === 'replied') {
      await db.supportConversation.update({
        where: { id: convId },
        data: { status: 'open' },
      })
    }

    return NextResponse.json({ ok: true, data: message })
  } catch (err) {
    console.error('Support reply error:', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
