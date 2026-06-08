// ============================================
// GET /api/admin/users/[userId] — Full user detail for admin
// Phase 9: All user fields + related data for admin panel
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { checkAdmin } from '@/lib/admin-helpers'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const result = await checkAdmin()
    if ('error' in result) return result.error

    const { userId } = await params
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Missing userId' }, { status: 400 })
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nickname: true,
        age: true,
        region: true,
        bio: true,
        height: true,
        weight: true,
        body_type: true,
        role: true,
        role_last_changed: true,
        availability: true,
        discretion_mode: true,
        secret_phrase: true,
        not_today: true,
        not_today_expires: true,
        is_premium: true,
        is_premium_free: true,
        is_early_adopter: true,
        is_admin: true,
        is_banned: true,
        banned_reason: true,
        is_banned_posting: true,
        is_online: true,
        last_seen: true,
        street: true,
        cucumber_size: true,
        show_cucumber: true,
        status_text: true,
        status_gradient: true,
        status_expires_at: true,
        status_views: true,
        notification_settings: true,
        created_at: true,
        updated_at: true,
        token_invalidated_before: true,
        // Explicitly EXCLUDE password_hash — never send to frontend
        photos: {
          orderBy: { upload_order: 'asc' },
        },
        into_tags: {
          select: { tag: true },
        },
        _count: {
          select: {
            reports_received: true,
            chat_participant1: true,
            chat_participant2: true,
            community_posts: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 })
    }

    // Calculate total chats (participant1 + participant2)
    const chatCount = user._count.chat_participant1 + user._count.chat_participant2

    return NextResponse.json({
      ok: true,
      data: {
        ...user,
        reportCount: user._count.reports_received,
        chatCount,
        postCount: user._count.community_posts,
        _count: undefined, // Remove raw _count
      },
    })
  } catch (err) {
    console.error('Admin user detail error:', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
