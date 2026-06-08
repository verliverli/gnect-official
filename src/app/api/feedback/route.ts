// ============================================
// POST /api/feedback — Submit feedback (user-facing)
// Phase 9: Authenticated users can submit feedback/feature requests
// Rate limit: 3 per day per user
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { notifyAdmins } from '@/lib/notifications'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { type, content } = body as {
      type: 'feedback' | 'feature_request'
      content: string
    }

    // Validate
    if (!type || !['feedback', 'feature_request'].includes(type)) {
      return NextResponse.json(
        { ok: false, error: 'type must be "feedback" or "feature_request"' },
        { status: 400 }
      )
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: 'content is required' },
        { status: 400 }
      )
    }

    if (content.length > 1000) {
      return NextResponse.json(
        { ok: false, error: 'content must be 1000 characters or less' },
        { status: 400 }
      )
    }

    // Rate limit: 3 per day per user
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const todayCount = await db.feedback.count({
      where: {
        user_id: user.id,
        created_at: { gte: oneDayAgo },
      },
    })

    if (todayCount >= 3) {
      return NextResponse.json(
        { ok: false, error: 'Rate limit exceeded: 3 feedback submissions per day' },
        { status: 429 }
      )
    }

    const feedback = await db.feedback.create({
      data: {
        user_id: user.id,
        type,
        content: content.trim(),
        region: user.region,
      },
    })

    // Notify admins of new feedback (non-blocking)
    notifyAdmins({
      type: 'admin_event',
      title: `New ${type === 'feature_request' ? 'Feature Request' : 'Feedback'}`,
      body: `${user.nickname}: ${content.trim().slice(0, 80)}${content.trim().length > 80 ? '...' : ''}`,
      data: { eventType: 'new_feedback', feedbackId: feedback.id, userId: user.id, type },
    }).catch(() => {})

    return NextResponse.json({ ok: true, data: feedback }, { status: 201 })
  } catch (err) {
    console.error('Submit feedback error:', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
