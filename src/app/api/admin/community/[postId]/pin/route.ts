// ============================================
// POST /api/admin/community/[postId]/pin — Pin/unpin post
// Phase 9: Toggle is_pinned with audit log
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { checkAdmin, logAdminAction } from '@/lib/admin-helpers'
import { db } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const result = await checkAdmin()
    if ('error' in result) return result.error
    const admin = result.user

    const { postId } = await params
    if (!postId) {
      return NextResponse.json({ ok: false, error: 'Missing postId' }, { status: 400 })
    }

    const body = await request.json()
    const { pinned } = body as { pinned: boolean }

    if (typeof pinned !== 'boolean') {
      return NextResponse.json(
        { ok: false, error: 'pinned must be a boolean' },
        { status: 400 }
      )
    }

    // Check post exists
    const post = await db.communityPost.findUnique({ where: { id: postId } })
    if (!post) {
      return NextResponse.json({ ok: false, error: 'Post not found' }, { status: 404 })
    }

    await db.communityPost.update({
      where: { id: postId },
      data: { is_pinned: pinned },
    })

    // Log the action
    await logAdminAction({
      admin_id: admin.id,
      action: pinned ? 'pin_post' : 'unpin_post',
      target_type: 'post',
      target_id: postId,
      details: { pinned },
    })

    return NextResponse.json({
      ok: true,
      data: { postId, is_pinned: pinned },
    })
  } catch (err) {
    console.error('Admin pin post error:', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
