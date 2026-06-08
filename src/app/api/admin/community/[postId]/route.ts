// ============================================
// DELETE /api/admin/community/[postId] — Admin soft-delete post
// Phase 9: Set is_deleted=true with audit log
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { checkAdmin, logAdminAction } from '@/lib/admin-helpers'
import { db } from '@/lib/db'

export async function DELETE(
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

    // Check post exists
    const post = await db.communityPost.findUnique({ where: { id: postId } })
    if (!post) {
      return NextResponse.json({ ok: false, error: 'Post not found' }, { status: 404 })
    }

    // Soft delete
    await db.communityPost.update({
      where: { id: postId },
      data: { is_deleted: true },
    })

    // Log the action
    await logAdminAction({
      admin_id: admin.id,
      action: 'delete_post',
      target_type: 'post',
      target_id: postId,
      details: { postAuthorId: post.user_id, contentPreview: post.content.slice(0, 100) },
    })

    return NextResponse.json({ ok: true, data: { postId, is_deleted: true } })
  } catch (err) {
    console.error('Admin delete post error:', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
