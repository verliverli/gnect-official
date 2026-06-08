// ============================================
// PUT /api/admin/feedback/[feedbackId] — Update feedback status/notes
// Phase 9: Admin updates feedback with audit log
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { checkAdmin, logAdminAction } from '@/lib/admin-helpers'
import { db } from '@/lib/db'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ feedbackId: string }> }
) {
  try {
    const result = await checkAdmin()
    if ('error' in result) return result.error
    const admin = result.user

    const { feedbackId } = await params
    if (!feedbackId) {
      return NextResponse.json({ ok: false, error: 'Missing feedbackId' }, { status: 400 })
    }

    const body = await request.json()
    const { status, admin_notes, is_pinned } = body as {
      status?: string
      admin_notes?: string
      is_pinned?: boolean
    }

    // Validate status if provided
    if (status && !['new', 'reviewed', 'planned', 'implemented'].includes(status)) {
      return NextResponse.json(
        { ok: false, error: 'status must be "new", "reviewed", "planned", or "implemented"' },
        { status: 400 }
      )
    }

    // Check feedback exists
    const feedback = await db.feedback.findUnique({ where: { id: feedbackId } })
    if (!feedback) {
      return NextResponse.json({ ok: false, error: 'Feedback not found' }, { status: 404 })
    }

    // Build update data
    const updateData: Record<string, unknown> = {}
    if (status !== undefined) updateData.status = status
    if (admin_notes !== undefined) updateData.admin_notes = admin_notes
    if (is_pinned !== undefined) updateData.is_pinned = is_pinned

    const updated = await db.feedback.update({
      where: { id: feedbackId },
      data: updateData,
    })

    // Log the action
    await logAdminAction({
      admin_id: admin.id,
      action: 'update_feedback',
      target_type: 'feedback',
      target_id: feedbackId,
      details: { status, admin_notes, is_pinned },
    })

    return NextResponse.json({ ok: true, data: updated })
  } catch (err) {
    console.error('Admin update feedback error:', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
