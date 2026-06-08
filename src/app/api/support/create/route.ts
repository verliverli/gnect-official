// ============================================
// POST /api/support/create — Create new support conversation
// Batch 2: Support DM to Manager
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { notifyAdmins } from '@/lib/notifications'

const VALID_SUBJECTS = ['Account Issue', 'Bug Report', 'Safety Concern', 'Feature Request', 'Other']

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { subject, content } = body as { subject?: string; content?: string }

    // Validate subject
    if (!subject || !VALID_SUBJECTS.includes(subject)) {
      return NextResponse.json(
        { ok: false, error: `Subject must be one of: ${VALID_SUBJECTS.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate content
    if (!content || content.trim().length < 20) {
      return NextResponse.json(
        { ok: false, error: 'Message must be at least 20 characters' },
        { status: 400 }
      )
    }

    // Create conversation + first message in a transaction
    const conversation = await db.supportConversation.create({
      data: {
        user_id: user.id,
        subject,
        messages: {
          create: {
            sender_id: user.id,
            is_from_admin: false,
            content: content.trim(),
          },
        },
      },
      include: {
        messages: true,
      },
    })

    // Notify admins of the new support ticket (non-blocking)
    notifyAdmins({
      type: 'admin_event',
      title: 'New Support Ticket',
      body: `${user.nickname} opened a ticket: ${subject}`,
      data: { eventType: 'new_support_ticket', conversationId: conversation.id, userId: user.id, subject },
    }).catch(() => {})

    return NextResponse.json({ ok: true, data: conversation })
  } catch (err) {
    console.error('Support create error:', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
