// ============================================
// GET /api/support/[convId]/messages — Get messages in a conversation
// Batch 2: Support DM to Manager
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(
  _request: NextRequest,
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

    // Get messages ordered by created_at asc
    const messages = await db.supportMessage.findMany({
      where: { conversation_id: convId },
      orderBy: { created_at: 'asc' },
      include: {
        sender: {
          select: { id: true, nickname: true, is_admin: true },
        },
      },
    })

    return NextResponse.json({
      ok: true,
      data: {
        conversation: {
          id: conversation.id,
          subject: conversation.subject,
          status: conversation.status,
          created_at: conversation.created_at,
          updated_at: conversation.updated_at,
        },
        messages,
      },
    })
  } catch (err) {
    console.error('Support messages error:', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
